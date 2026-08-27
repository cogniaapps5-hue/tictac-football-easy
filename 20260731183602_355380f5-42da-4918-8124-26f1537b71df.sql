ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contract_accepted_at timestamptz;

CREATE TABLE public.coaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL DEFAULT 'Profesor',
  photo_url text,
  bio text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coaches TO authenticated;
GRANT ALL ON public.coaches TO service_role;

ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY coaches_select ON public.coaches FOR SELECT TO authenticated USING (true);
CREATE POLICY coaches_insert_admin ON public.coaches FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY coaches_update_admin ON public.coaches FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY coaches_delete_admin ON public.coaches FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER coaches_updated_at BEFORE UPDATE ON public.coaches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.coaches (name, role, photo_url, bio) VALUES
('Carlos Martínez', 'Director Técnico', NULL, 'Entrenador con 12 años formando categorías menores. Licencia CONMEBOL C y especialista en fundamentos técnicos.'),
('Luis Fuentes', 'Preparador Físico', NULL, 'Profesor de Educación Física, magíster en preparación física infantil. Trabaja la coordinación y prevención de lesiones.');
