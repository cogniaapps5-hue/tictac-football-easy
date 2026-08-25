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
  WHERE status IN ('active','past_due')
    AND next_payment_date < (hoy - 5);
  GET DIAGNOSTICS suspendidas = ROW_COUNT;

  UPDATE public.subscriptions SET status = 'past_due'
  WHERE status = 'active' AND next_payment_date < hoy;
  GET DIAGNOSTICS vencidas = ROW_COUNT;

  RETURN jsonb_build_object('vencidas', vencidas, 'suspendidas', suspendidas);
END;
$$;

REVOKE ALL ON FUNCTION public.revisar_suscripciones() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revisar_suscripciones() TO service_role;

REVOKE ALL ON FUNCTION public.es_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_super_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.subscriptions_sync_access() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aplicar_bloqueos_morosidad() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_bloqueos_morosidad() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.generar_recordatorios_pago() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generar_recordatorios_pago() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payments_guard_parent_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payments_sync_access_status() FROM PUBLIC, anon, authenticated;
