
CREATE OR REPLACE FUNCTION public.eliminar_alumno(_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Solo la administradora puede eliminar alumnos';
  END IF;
  DELETE FROM public.attendance WHERE player_id = _player_id;
  DELETE FROM public.notifications WHERE player_id = _player_id;
  DELETE FROM public.payment_reminders WHERE player_id = _player_id;
  DELETE FROM public.nutrition_sessions WHERE player_id = _player_id;
  DELETE FROM public.payments WHERE player_id = _player_id;
  DELETE FROM public.players WHERE id = _player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.eliminar_alumno(uuid) TO authenticated;

DELETE FROM public.attendance WHERE player_id IN ('bb977f55-1920-45f5-b4e0-d7108f805e29','5d88dee1-7646-4b80-b7e5-123c271b0933');
DELETE FROM public.notifications WHERE player_id IN ('bb977f55-1920-45f5-b4e0-d7108f805e29','5d88dee1-7646-4b80-b7e5-123c271b0933');
DELETE FROM public.payment_reminders WHERE player_id IN ('bb977f55-1920-45f5-b4e0-d7108f805e29','5d88dee1-7646-4b80-b7e5-123c271b0933');
DELETE FROM public.nutrition_sessions WHERE player_id IN ('bb977f55-1920-45f5-b4e0-d7108f805e29','5d88dee1-7646-4b80-b7e5-123c271b0933');
DELETE FROM public.payments WHERE player_id IN ('bb977f55-1920-45f5-b4e0-d7108f805e29','5d88dee1-7646-4b80-b7e5-123c271b0933');
DELETE FROM public.players WHERE id IN ('bb977f55-1920-45f5-b4e0-d7108f805e29','5d88dee1-7646-4b80-b7e5-123c271b0933');
