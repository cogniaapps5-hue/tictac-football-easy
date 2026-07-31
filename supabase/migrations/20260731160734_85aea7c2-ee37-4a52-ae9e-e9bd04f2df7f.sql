-- PROFILES
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- PLAYERS
DROP POLICY IF EXISTS players_select ON public.players;
DROP POLICY IF EXISTS players_insert_admin ON public.players;
DROP POLICY IF EXISTS players_update ON public.players;
DROP POLICY IF EXISTS players_delete_admin ON public.players;
CREATE POLICY players_select ON public.players FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY players_insert_admin ON public.players FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY players_update_admin ON public.players FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY players_delete_admin ON public.players FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- PAYMENTS
DROP POLICY IF EXISTS payments_select ON public.payments;
DROP POLICY IF EXISTS payments_insert ON public.payments;
DROP POLICY IF EXISTS payments_update ON public.payments;
CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = payments.player_id AND p.parent_id = auth.uid()));
CREATE POLICY payments_insert ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = payments.player_id AND p.parent_id = auth.uid()));
CREATE POLICY payments_update_admin ON public.payments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- Parents may only attach a receipt while the payment is still pending
CREATE POLICY payments_update_receipt_parent ON public.payments FOR UPDATE TO authenticated
  USING (status = 'pending' AND EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = payments.player_id AND p.parent_id = auth.uid()))
  WITH CHECK (status = 'pending' AND EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = payments.player_id AND p.parent_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.payments_guard_parent_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- non-admins may only change receipt_url
  IF NEW.player_id IS DISTINCT FROM OLD.player_id
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.concept IS DISTINCT FROM OLD.concept
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
    RAISE EXCEPTION 'Solo la administradora puede modificar el estado del pago';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS payments_guard_parent_update ON public.payments;
CREATE TRIGGER payments_guard_parent_update BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.payments_guard_parent_update();

-- ATTENDANCE
DROP POLICY IF EXISTS attendance_select ON public.attendance;
DROP POLICY IF EXISTS attendance_insert ON public.attendance;
DROP POLICY IF EXISTS attendance_update ON public.attendance;
CREATE POLICY attendance_select ON public.attendance FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = attendance.player_id AND p.parent_id = auth.uid()));
CREATE POLICY attendance_insert ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = attendance.player_id AND p.parent_id = auth.uid()));
CREATE POLICY attendance_update ON public.attendance FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = attendance.player_id AND p.parent_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = attendance.player_id AND p.parent_id = auth.uid()));

-- NOTICES
DROP POLICY IF EXISTS notices_select ON public.notices;
DROP POLICY IF EXISTS notices_insert_admin ON public.notices;
DROP POLICY IF EXISTS notices_delete_admin ON public.notices;
CREATE POLICY notices_select ON public.notices FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR target_category = 'all' OR EXISTS (
    SELECT 1 FROM public.players p WHERE p.parent_id = auth.uid() AND p.category = notices.target_category));
CREATE POLICY notices_insert_admin ON public.notices FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY notices_update_admin ON public.notices FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY notices_delete_admin ON public.notices FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- NUTRITION SESSIONS
DROP POLICY IF EXISTS nutrition_select ON public.nutrition_sessions;
DROP POLICY IF EXISTS nutrition_update ON public.nutrition_sessions;
CREATE POLICY nutrition_select ON public.nutrition_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = nutrition_sessions.player_id AND p.parent_id = auth.uid()));
CREATE POLICY nutrition_update_admin ON public.nutrition_sessions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY nutrition_insert_admin ON public.nutrition_sessions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Grants (idempotent)
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.nutrition_sessions TO authenticated;
GRANT ALL ON public.profiles, public.players, public.payments, public.attendance, public.notices, public.nutrition_sessions TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_sessions ENABLE ROW LEVEL SECURITY;