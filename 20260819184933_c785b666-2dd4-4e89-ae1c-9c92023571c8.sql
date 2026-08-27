ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_scholarship boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.aplicar_bloqueos_morosidad()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  hoy date := (now() AT TIME ZONE 'America/Santiago')::date;
  inicio date := date_trunc('month', hoy)::date;
  fin date := (date_trunc('month', hoy) + interval '1 month')::date;
  bloqueados integer := 0;
  r record;
  al_dia boolean;
  nuevo public.access_status;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Solo la administradora puede ejecutar la revisión de morosidad';
  END IF;

  FOR r IN SELECT id, access_status, is_scholarship FROM public.players LOOP
    CONTINUE WHEN r.access_status = 'exception';
    CONTINUE WHEN r.is_scholarship;

    SELECT EXISTS (
      SELECT 1 FROM public.payments pg
      WHERE pg.player_id = r.id
        AND pg.due_date >= inicio AND pg.due_date < fin
        AND (pg.status = 'approved' OR (pg.status = 'pending' AND pg.receipt_url IS NOT NULL))
    ) INTO al_dia;

    IF al_dia THEN
      SELECT CASE WHEN EXISTS (
        SELECT 1 FROM public.payments pg
        WHERE pg.player_id = r.id AND pg.due_date >= inicio AND pg.due_date < fin AND pg.status = 'approved'
      ) THEN 'active'::public.access_status ELSE 'pending_review'::public.access_status END INTO nuevo;
    ELSIF EXTRACT(DAY FROM hoy) >= 6 THEN
      nuevo := 'blocked';
    ELSE
      nuevo := 'active';
    END IF;

    IF nuevo IS DISTINCT FROM r.access_status THEN
      UPDATE public.players SET access_status = nuevo WHERE id = r.id;
      IF nuevo = 'blocked' THEN
        bloqueados := bloqueados + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN bloqueados;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generar_recordatorios_pago()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    WHERE pl.is_scholarship = false
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
$function$;