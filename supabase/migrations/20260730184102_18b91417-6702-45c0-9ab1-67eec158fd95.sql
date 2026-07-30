
CREATE POLICY "comprobantes_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comprobantes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "comprobantes_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'comprobantes' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
