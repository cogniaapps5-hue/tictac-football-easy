
CREATE TABLE public.historial_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocurrido_en timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL,
  player_id uuid,
  parent_id uuid,
  monto integer,
  detalle text,
  realizado_por uuid DEFAULT auth.uid()
);
GRANT SELECT ON public.historial_eventos TO authenticated;
GRANT ALL ON public.historial_eventos TO service_role;
ALTER TABLE public.historial_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY historial_select_admin ON public.historial_eventos FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.contratos_firmados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  aceptado_en timestamptz NOT NULL DEFAULT now(),
  version text NOT NULL DEFAULT '2026',
  dispositivo text
);
GRANT SELECT ON public.contratos_firmados TO authenticated;
GRANT ALL ON public.contratos_firmados TO service_role;
ALTER TABLE public.contratos_firmados ENABLE ROW LEVEL SECURITY;
CREATE POLICY contratos_select ON public.contratos_firmados FOR SELECT TO authenticated USING (parent_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.resumen_pagos_mensuales (
  periodo date PRIMARY KEY,
  total_recaudado integer NOT NULL DEFAULT 0,
  pagos_recibidos integer NOT NULL DEFAULT 0,
  morosos integer NOT NULL DEFAULT 0,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.resumen_pagos_mensuales TO authenticated;
GRANT ALL ON public.resumen_pagos_mensuales TO service_role;
ALTER TABLE public.resumen_pagos_mensuales ENABLE ROW LEVEL SECURITY;
CREATE POLICY resumen_select_admin ON public.resumen_pagos_mensuales FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.actualizar_resumen_mes(_periodo date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ini date := date_trunc('month',_periodo)::date; fin date := (date_trunc('month',_periodo)+interval '1 month')::date;
BEGIN
  INSERT INTO public.resumen_pagos_mensuales (periodo,total_recaudado,pagos_recibidos,morosos,actualizado_en)
  SELECT ini,
    COALESCE((SELECT sum(amount) FROM payments WHERE status='approved' AND due_date>=ini AND due_date<fin),0),
    (SELECT count(*) FROM payments WHERE status='approved' AND due_date>=ini AND due_date<fin),
    (SELECT count(*) FROM players pl WHERE NOT pl.is_scholarship AND pl.access_status<>'inactive'
       AND NOT EXISTS (SELECT 1 FROM payments pg WHERE pg.player_id=pl.id AND pg.status='approved' AND pg.due_date>=ini AND pg.due_date<fin)),
    now()
  ON CONFLICT (periodo) DO UPDATE SET total_recaudado=EXCLUDED.total_recaudado, pagos_recibidos=EXCLUDED.pagos_recibidos, morosos=EXCLUDED.morosos, actualizado_en=now();
END $$;
REVOKE EXECUTE ON FUNCTION public.actualizar_resumen_mes(date) FROM anon;

CREATE OR REPLACE FUNCTION public.log_pago() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR NEW.receipt_url IS DISTINCT FROM OLD.receipt_url THEN
    INSERT INTO historial_eventos(tipo,player_id,monto,detalle) VALUES ('pago_registrado',NEW.player_id,NEW.amount,NEW.concept||' · '||NEW.status);
  END IF;
  PERFORM public.actualizar_resumen_mes(NEW.due_date);
  RETURN NEW;
END $$;
CREATE TRIGGER payments_log_trg AFTER INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.log_pago();

CREATE OR REPLACE FUNCTION public.log_asistencia() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO historial_eventos(tipo,player_id,detalle) VALUES ('asistencia_confirmada',NEW.player_id,NEW.session_date::text||' · '||NEW.status);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER attendance_log_trg AFTER INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.log_asistencia();

CREATE OR REPLACE FUNCTION public.log_contrato() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.contract_accepted_at IS NOT NULL AND NEW.contract_accepted_at IS DISTINCT FROM OLD.contract_accepted_at THEN
    INSERT INTO contratos_firmados(parent_id,aceptado_en,dispositivo) VALUES (NEW.id,NEW.contract_accepted_at,current_setting('request.headers',true)::json->>'user-agent');
    INSERT INTO historial_eventos(tipo,parent_id,detalle) VALUES ('contrato_aceptado',NEW.id,'Contrato 2026');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_contrato_trg AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.log_contrato();

INSERT INTO public.contratos_firmados(parent_id,aceptado_en,dispositivo)
SELECT id,contract_accepted_at,'registro previo' FROM public.profiles WHERE contract_accepted_at IS NOT NULL;

DO $$ DECLARE m date; BEGIN
  FOR m IN SELECT DISTINCT date_trunc('month',due_date)::date FROM public.payments LOOP
    PERFORM public.actualizar_resumen_mes(m);
  END LOOP;
END $$;
