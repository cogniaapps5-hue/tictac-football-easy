
CREATE TYPE public.app_role AS ENUM ('admin', 'parent');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- demo account registry: assigns role + links students on signup
CREATE TABLE public.demo_accounts (
  email text PRIMARY KEY,
  role public.app_role NOT NULL,
  full_name text NOT NULL
);
GRANT SELECT ON public.demo_accounts TO authenticated;
GRANT ALL ON public.demo_accounts TO service_role;
ALTER TABLE public.demo_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo_accounts_read" ON public.demo_accounts FOR SELECT TO authenticated USING (true);

CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  parent_email text,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'SUB12',
  rut text,
  schedule text NOT NULL DEFAULT 'Miércoles 15:00',
  coach text NOT NULL DEFAULT 'Carlos Martínez',
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players_select" ON public.players FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "players_update" ON public.players FOR UPDATE TO authenticated
  USING (parent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (parent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "players_insert_admin" ON public.players FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "players_delete_admin" ON public.players FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  amount integer NOT NULL DEFAULT 50000,
  concept text NOT NULL DEFAULT 'Mensualidad',
  due_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'pending',
  receipt_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_select" ON public.payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = payments.player_id AND p.parent_id = auth.uid()));
CREATE POLICY "payments_insert" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = payments.player_id AND p.parent_id = auth.uid()));
CREATE POLICY "payments_update" ON public.payments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = payments.player_id AND p.parent_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = payments.player_id AND p.parent_id = auth.uid()));

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  status text NOT NULL DEFAULT 'no_response',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, session_date)
);
GRANT SELECT, INSERT, UPDATE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_select" ON public.attendance FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = attendance.player_id AND p.parent_id = auth.uid()));
CREATE POLICY "attendance_insert" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = attendance.player_id AND p.parent_id = auth.uid()));
CREATE POLICY "attendance_update" ON public.attendance FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = attendance.player_id AND p.parent_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = attendance.player_id AND p.parent_id = auth.uid()));

CREATE TABLE public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  target_category text NOT NULL DEFAULT 'all',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.notices TO authenticated;
GRANT ALL ON public.notices TO service_role;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notices_select" ON public.notices FOR SELECT TO authenticated USING (true);
CREATE POLICY "notices_insert_admin" ON public.notices FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "notices_delete_admin" ON public.notices FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.nutrition_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  semester integer NOT NULL DEFAULT 1,
  year integer NOT NULL DEFAULT 2026,
  status text NOT NULL DEFAULT 'pending',
  scheduled_date date
);
GRANT SELECT, INSERT, UPDATE ON public.nutrition_sessions TO authenticated;
GRANT ALL ON public.nutrition_sessions TO service_role;
ALTER TABLE public.nutrition_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nutrition_select" ON public.nutrition_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = nutrition_sessions.player_id AND p.parent_id = auth.uid()));
CREATE POLICY "nutrition_update" ON public.nutrition_sessions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = nutrition_sessions.player_id AND p.parent_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = nutrition_sessions.player_id AND p.parent_id = auth.uid()));

-- new user handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.app_role := 'parent';
  v_name text;
BEGIN
  SELECT d.role, d.full_name INTO v_role, v_name FROM public.demo_accounts d WHERE d.email = NEW.email;
  IF v_role IS NULL THEN v_role := 'parent'; END IF;

  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), v_name, split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'phone'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.players SET parent_id = NEW.id WHERE parent_email = NEW.email AND parent_id IS NULL;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- demo seed
INSERT INTO public.demo_accounts (email, role, full_name) VALUES
  ('admin@tictac.cl', 'admin', 'María González'),
  ('padre1@demo.cl', 'parent', 'Carlos Pizarro'),
  ('padre2@demo.cl', 'parent', 'Ana Martínez');

INSERT INTO public.players (id, parent_email, name, category, rut, schedule, coach, emergency_contact_name, emergency_contact_phone) VALUES
  ('11111111-1111-1111-1111-111111111111', 'padre1@demo.cl', 'Alejandro Pizarro', 'SUB12', '22.345.678-9', 'Miércoles 15:00', 'Carlos Martínez', 'María Pizarro (Madre)', '+56 9 1234 5678'),
  ('22222222-2222-2222-2222-222222222222', 'padre2@demo.cl', 'Sofía Martínez', 'SUB12', '23.111.222-3', 'Miércoles 15:00', 'Carlos Martínez', 'Ana Martínez (Madre)', '+56 9 8765 4321'),
  ('33333333-3333-3333-3333-333333333333', NULL, 'Benjamín Rojas', 'SUB15', '21.555.444-2', 'Viernes 17:00', 'Luis Fuentes', 'Pedro Rojas (Padre)', '+56 9 5555 1234'),
  ('44444444-4444-4444-4444-444444444444', NULL, 'Matías Soto', 'SUB15', '21.777.888-1', 'Viernes 17:00', 'Luis Fuentes', 'Carla Soto (Madre)', '+56 9 4444 2222');

INSERT INTO public.payments (player_id, amount, concept, due_date, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 50000, 'Mensualidad Enero', '2026-01-15', 'pending'),
  ('22222222-2222-2222-2222-222222222222', 50000, 'Mensualidad Enero', '2026-01-15', 'approved'),
  ('33333333-3333-3333-3333-333333333333', 50000, 'Mensualidad Enero', '2026-01-15', 'pending'),
  ('44444444-4444-4444-4444-444444444444', 50000, 'Mensualidad Diciembre', '2025-12-15', 'pending'),
  ('11111111-1111-1111-1111-111111111111', 50000, 'Mensualidad Diciembre', '2025-12-15', 'approved');

INSERT INTO public.attendance (player_id, session_date, status) VALUES
  ('11111111-1111-1111-1111-111111111111', current_date - 7, 'confirmed'),
  ('11111111-1111-1111-1111-111111111111', current_date - 14, 'absent'),
  ('22222222-2222-2222-2222-222222222222', current_date - 7, 'confirmed'),
  ('33333333-3333-3333-3333-333333333333', current_date - 7, 'confirmed'),
  ('44444444-4444-4444-4444-444444444444', current_date - 7, 'absent');

INSERT INTO public.notices (title, content, target_category, created_at) VALUES
  ('Torneo Sábado', 'Cita 9:00 AM - Cancha 1. Traer camiseta blanca y bidón de agua.', 'SUB12', now()),
  ('Reunión de apoderados', 'Viernes 19:00 en la sede. Los esperamos a todos.', 'all', now() - interval '1 day');

INSERT INTO public.nutrition_sessions (player_id, semester, year, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 1, 2026, 'pending'),
  ('22222222-2222-2222-2222-222222222222', 1, 2026, 'pending');
