CREATE TYPE public.age_group AS ENUM ('iniciados','intermedios','avanzados');
CREATE TYPE public.training_day AS ENUM ('lunes','miercoles','viernes');

ALTER TABLE public.players
  ADD COLUMN birth_year integer,
  ADD COLUMN age_group public.age_group NOT NULL DEFAULT 'iniciados',
  ADD COLUMN training_day public.training_day NOT NULL DEFAULT 'miercoles';

CREATE OR REPLACE FUNCTION public.players_set_age_group()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.birth_year IS NOT NULL THEN
    IF NEW.birth_year >= 2018 THEN
      NEW.age_group := 'iniciados';
    ELSIF NEW.birth_year >= 2016 THEN
      NEW.age_group := 'intermedios';
    ELSE
      NEW.age_group := 'avanzados';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER players_set_age_group_trg
BEFORE INSERT OR UPDATE OF birth_year ON public.players
FOR EACH ROW EXECUTE FUNCTION public.players_set_age_group();

UPDATE public.players SET age_group = CASE WHEN category = 'SUB15' THEN 'avanzados'::public.age_group ELSE 'iniciados'::public.age_group END;

DROP POLICY IF EXISTS notices_select ON public.notices;

ALTER TABLE public.players DROP COLUMN category;

CREATE POLICY notices_select ON public.notices
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR target_category = 'all'
  OR EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.parent_id = auth.uid() AND p.age_group::text = notices.target_category
  )
);