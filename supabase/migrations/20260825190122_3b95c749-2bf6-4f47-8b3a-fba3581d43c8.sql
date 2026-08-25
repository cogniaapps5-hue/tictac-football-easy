DROP POLICY IF EXISTS comprobantes_update ON storage.objects;
CREATE POLICY comprobantes_update ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'comprobantes' AND (((storage.foldername(name))[1] = auth.uid()::text) OR public.has_role(auth.uid(), 'admin')))
WITH CHECK (bucket_id = 'comprobantes' AND (((storage.foldername(name))[1] = auth.uid()::text) OR public.has_role(auth.uid(), 'admin')));

REVOKE EXECUTE ON FUNCTION public.revisar_suscripciones() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revisar_suscripciones() TO service_role;