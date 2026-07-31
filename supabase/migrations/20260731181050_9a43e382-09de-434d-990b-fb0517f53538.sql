REVOKE ALL ON FUNCTION public.generar_recordatorios_pago() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.generar_recordatorios_pago() TO authenticated;