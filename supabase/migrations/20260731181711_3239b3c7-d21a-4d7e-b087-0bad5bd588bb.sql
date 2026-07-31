-- 1. Nuevo enum de días (martes / jueves)
ALTER TABLE public.players ALTER COLUMN training_day DROP DEFAULT;
ALTER TABLE public.players ALTER COLUMN training_day TYPE text USING training_day::text;
UPDATE public.players SET training_day = CASE WHEN training_day = 'viernes' THEN 'jueves' ELSE 'martes' END;
DROP TYPE public.training_day;
CREATE TYPE public.training_day AS ENUM ('martes', 'jueves');
ALTER TABLE public.players ALTER COLUMN training_day TYPE public.training_day USING training_day::public.training_day;
ALTER TABLE public.players ALTER COLUMN training_day SET DEFAULT 'martes'::public.training_day;

-- 2. Tabla de sedes/horarios fijos
CREATE TABLE public.training_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day public.training_day NOT NULL UNIQUE,
  start_time time NOT NULL,
  end_time time NOT NULL,
  venue text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.training_slots TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.training_slots TO authenticated;
GRANT ALL ON public.training_slots TO service_role;

ALTER TABLE public.training_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_slots_select" ON public.training_slots
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "training_slots_write_admin" ON public.training_slots
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER training_slots_updated_at
  BEFORE UPDATE ON public.training_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.training_slots (day, start_time, end_time, venue) VALUES
  ('martes', '19:00', '20:00', 'Rancho Rossi Peñuelas'),
  ('jueves', '19:00', '20:00', 'Forza Club Simdempart');

-- 3. Sincronizar el texto de horario del alumno con su día y sede
CREATE OR REPLACE FUNCTION public.players_set_schedule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  s record;
BEGIN
  SELECT * INTO s FROM public.training_slots WHERE day = NEW.training_day;
  IF FOUND THEN
    NEW.schedule := initcap(NEW.training_day::text) || ' ' || to_char(s.start_time, 'HH24:MI') || ' hrs · ' || s.venue;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS players_set_schedule_trg ON public.players;
CREATE TRIGGER players_set_schedule_trg
  BEFORE INSERT OR UPDATE OF training_day ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.players_set_schedule();

UPDATE public.players SET training_day = training_day;

-- 4. Avisos segmentados también por sede/día
DROP POLICY IF EXISTS notices_select ON public.notices;
CREATE POLICY notices_select ON public.notices
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR target_category = 'all'
    OR EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.parent_id = auth.uid()
        AND (p.age_group::text = notices.target_category OR p.training_day::text = notices.target_category)
    )
  );