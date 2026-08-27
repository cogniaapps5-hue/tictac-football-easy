-- 1) demo_accounts: solo admin
DROP POLICY IF EXISTS demo_accounts_read ON public.demo_accounts;
CREATE POLICY demo_accounts_read_admin ON public.demo_accounts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) pagos: apoderado solo puede tocar receipt_url en pagos pendientes
DROP POLICY IF EXISTS payments_update_receipt_parent ON public.payments;
CREATE POLICY payments_update_receipt_parent ON public.payments
  FOR UPDATE TO authenticated
  USING (
    status = 'pending'
    AND EXISTS (SELECT 1 FROM public.players p WHERE p.id = payments.player_id AND p.parent_id = auth.uid())
  )
  WITH CHECK (
    status = 'pending'
    AND EXISTS (SELECT 1 FROM public.players p WHERE p.id = payments.player_id AND p.parent_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.payments_guard_parent_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.player_id IS DISTINCT FROM OLD.player_id
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.concept IS DISTINCT FROM OLD.concept
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Solo la administradora puede modificar el estado del pago';
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) políticas de borrado explícitas para la administradora
DROP POLICY IF EXISTS nutrition_delete_admin ON public.nutrition_sessions;
CREATE POLICY nutrition_delete_admin ON public.nutrition_sessions
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS attendance_delete_admin ON public.attendance;
CREATE POLICY attendance_delete_admin ON public.attendance
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT DELETE ON public.nutrition_sessions TO authenticated;
GRANT DELETE ON public.attendance TO authenticated;
