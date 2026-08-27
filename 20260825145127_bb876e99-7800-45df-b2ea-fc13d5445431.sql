-- Nuevo valor de rol para el dueño de la app
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_name text NOT NULL DEFAULT 'Escuela',
  status text NOT NULL DEFAULT 'active',
  monthly_amount numeric NOT NULL DEFAULT 30000,
  next_payment_date date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 month')::date,
  last_payment_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_status_chk CHECK (status IN ('active','past_due','suspended')),
  CONSTRAINT subscriptions_school_unique UNIQUE (school_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Super admin por rol o por correo del dueño de la app
CREATE OR REPLACE FUNCTION public.es_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role::text = 'super_admin'
  ) OR lower(COALESCE(auth.jwt() ->> 'email','')) IN ('emilioapps5@gmail.com','emilio@tictac.cl')
$$;

CREATE POLICY subscriptions_select ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.es_super_admin() OR school_id = auth.uid());

CREATE POLICY subscriptions_insert_super ON public.subscriptions
  FOR INSERT TO authenticated WITH CHECK (public.es_super_admin());

CREATE POLICY subscriptions_update_super ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (public.es_super_admin()) WITH CHECK (public.es_super_admin());

CREATE POLICY subscriptions_delete_super ON public.subscriptions
  FOR DELETE TO authenticated USING (public.es_super_admin());

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Al cambiar el estado de la suscripción se sincroniza el acceso del perfil de la escuela
CREATE OR REPLACE FUNCTION public.subscriptions_sync_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'suspended' THEN
    UPDATE public.profiles SET access_status = 'suspended' WHERE id = NEW.school_id;
  ELSE
    UPDATE public.profiles SET access_status = 'active'
    WHERE id = NEW.school_id AND access_status = 'suspended';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER subscriptions_sync_access_trg
  AFTER INSERT OR UPDATE OF status ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.subscriptions_sync_access();

-- Revisión diaria de vencimientos
CREATE OR REPLACE FUNCTION public.revisar_suscripciones()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hoy date := (now() AT TIME ZONE 'America/Santiago')::date;
  vencidas integer := 0;
  suspendidas integer := 0;
BEGIN
  UPDATE public.subscriptions SET status = 'suspended'
  WHERE status IN ('active','past_due') AND next_payment_date < hoy - INTERVAL '5 days';
  suspendidas := ROW_COUNT_HACK();
  RETURN jsonb_build_object('vencidas', vencidas, 'suspendidas', suspendidas);
END;
$$;
