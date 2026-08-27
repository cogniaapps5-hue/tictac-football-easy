CREATE TABLE public.payment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  parent_id uuid,
  period date NOT NULL,
  kind text NOT NULL DEFAULT 'upcoming',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, period, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_reminders TO authenticated;
GRANT ALL ON public.payment_reminders TO service_role;

ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY reminders_select ON public.payment_reminders FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (status = 'sent' AND EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = payment_reminders.player_id AND p.parent_id = auth.uid()
  ))
);

CREATE POLICY reminders_insert_admin ON public.payment_reminders FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY reminders_update_admin ON public.payment_reminders FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY reminders_delete_admin ON public.payment_reminders FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.payment_reminders_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER payment_reminders_touch_trg
BEFORE UPDATE ON public.payment_reminders
FOR EACH ROW EXECUTE FUNCTION public.payment_reminders_touch();

CREATE OR REPLACE FUNCTION public.generar_recordatorios_pago()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hoy date := (now() AT TIME ZONE 'America/Santiago')::date;
  inicio date := date_trunc('month', hoy)::date;
  fin date := (date_trunc('month', hoy) + interval '1 month')::date;
  dia integer := EXTRACT(DAY FROM hoy);
  mes text;
  creados integer := 0;
  r record;
  al_dia boolean;
  tipo text;
  nombre text;
  texto text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Solo la administradora puede generar recordatorios';
  END IF;

  mes := CASE EXTRACT(MONTH FROM hoy)
    WHEN 1 THEN 'Enero' WHEN 2 THEN 'Febrero' WHEN 3 THEN 'Marzo' WHEN 4 THEN 'Abril'
    WHEN 5 THEN 'Mayo' WHEN 6 THEN 'Junio' WHEN 7 THEN 'Julio' WHEN 8 THEN 'Agosto'
    WHEN 9 THEN 'Septiembre' WHEN 10 THEN 'Octubre' WHEN 11 THEN 'Noviembre' ELSE 'Diciembre' END;

  IF dia >= 6 THEN
    tipo := 'overdue';
  ELSIF dia >= 3 THEN
    tipo := 'upcoming';
  ELSE
    RETURN 0;
  END IF;

  FOR r IN
    SELECT pl.id, pl.name, pl.parent_id, COALESCE(NULLIF(pr.full_name, ''), 'apoderado') AS parent_name
    FROM public.players pl
    LEFT JOIN public.profiles pr ON pr.id = pl.parent_id
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.payments pg
      WHERE pg.player_id = r.id
        AND pg.due_date >= inicio AND pg.due_date < fin
        AND (pg.status = 'approved' OR (pg.status = 'pending' AND pg.receipt_url IS NOT NULL))
    ) INTO al_dia;

    CONTINUE WHEN al_dia;
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.payment_reminders pm
      WHERE pm.player_id = r.id AND pm.period = inicio AND pm.kind = tipo
    );

    nombre := r.parent_name;

    IF tipo = 'upcoming' THEN
      texto := 'Hola ' || nombre || ' 🌟' || E'\n\n'
        || 'Te recordamos que la mensualidad de ' || mes || ' está por vencer el día 6.' || E'\n\n'
        || 'Monto: $20.000' || E'\n\n'
        || 'Puedes subir tu comprobante directamente en la app. ¡Te esperamos! ⚽' || E'\n\n'
        || 'Escuela TIC TAC - Siempre Feliz';
    ELSE
      texto := 'Hola ' || nombre || E'\n\n'
        || 'Notamos que aún no hemos recibido tu pago de la mensualidad de ' || mes || '.' || E'\n\n'
        || 'Por favor, sube tu comprobante en la app o contáctanos para regularizar tu situación.' || E'\n\n'
        || 'Si ya realizaste el pago y no lo has subido, por favor adjunta el comprobante para actualizar tu estado.' || E'\n\n'
        || 'Gracias por tu comprensión. 🙏' || E'\n\n'
        || 'Escuela TIC TAC - Siempre Feliz';
    END IF;

    INSERT INTO public.payment_reminders (player_id, parent_id, period, kind, message)
    VALUES (r.id, r.parent_id, inicio, tipo, texto);
    creados := creados + 1;
  END LOOP;

  RETURN creados;
END;
$$;

REVOKE ALL ON FUNCTION public.payment_reminders_touch() FROM public, anon, authenticated;
