-- 1. Estado de acceso en players
DO $$ BEGIN
  CREATE TYPE public.access_status AS ENUM ('active','pending_review','blocked','exception');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS access_status public.access_status NOT NULL DEFAULT 'active';

-- 2. Avisos personales por alumno
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.players p WHERE p.id = notifications.player_id AND p.parent_id = auth.uid())
  );

-- 3. Revisión diaria de morosidad
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
  FOR r IN SELECT id, name, access_status FROM public.players LOOP
    -- excepción autorizada manualmente: nunca se toca automáticamente
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
        INSERT INTO public.notifications (player_id, title, body)
        VALUES (
          r.id,
          'Acceso suspendido',
          'Tu acceso ha sido suspendido por pago pendiente. Sube tu comprobante o contacta a administración.'
        );
      END IF;
    END IF;
  END LOOP;

  RETURN bloqueados;
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_bloqueos_morosidad() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_bloqueos_morosidad() TO service_role;

-- 4. Programación diaria 06:00 hora de Chile (10:00 UTC)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN
  PERFORM cron.unschedule('bloqueos-morosidad-diario');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'bloqueos-morosidad-diario',
  '0 10 * * *',
  $$SELECT public.aplicar_bloqueos_morosidad();$$
);