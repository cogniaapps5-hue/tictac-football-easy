-- 1. Remove scheduled cron job if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE command ILIKE '%aplicar_bloqueos_morosidad%';
  END IF;
END $$;

-- 2. Trigger on payments -> updates players.access_status
CREATE OR REPLACE FUNCTION public.payments_sync_access_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    UPDATE public.players SET access_status = 'active'
    WHERE id = NEW.player_id AND access_status <> 'exception';
  ELSIF NEW.status = 'pending' AND NEW.receipt_url IS NOT NULL THEN
    UPDATE public.players SET access_status = 'pending_review'
    WHERE id = NEW.player_id AND access_status <> 'exception';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.payments_sync_access_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS payments_sync_access_status_trg ON public.payments;
CREATE TRIGGER payments_sync_access_status_trg
AFTER INSERT OR UPDATE OF status, receipt_url ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.payments_sync_access_status();

-- 3. Morosidad check, run on demand by admin, no automatic notifications
CREATE OR REPLACE FUNCTION public.aplicar_bloqueos_morosidad()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  FOR r IN SELECT id, access_status FROM public.players LOOP
    CONTINUE WHEN r.access_status = 'exception';

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
$$;

REVOKE ALL ON FUNCTION public.aplicar_bloqueos_morosidad() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_bloqueos_morosidad() TO authenticated;