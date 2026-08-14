ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS university text,
  ADD COLUMN IF NOT EXISTS graduation_year integer,
  ADD COLUMN IF NOT EXISTS qualification text,
  ADD COLUMN IF NOT EXISTS registry_number text,
  ADD COLUMN IF NOT EXISTS rut text,
  ADD COLUMN IF NOT EXISTS certificate_folio text,
  ADD COLUMN IF NOT EXISTS certificate_date date,
  ADD COLUMN IF NOT EXISTS certificate_type text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 100;

DELETE FROM public.coaches;

INSERT INTO public.coaches (name, role, bio, title, university, graduation_year, qualification, registry_number, rut, certificate_folio, certificate_date, certificate_type, sort_order) VALUES
('Luis Felipe Guerrero Ossa', 'director', '', 'Profesor de Educación Física', 'Universidad de Atacama, Copiapó', 2004, NULL, NULL, '13.458.157-3', '500710509283', '2026-08-11', 'fines_especiales', 1),
('Sebastián Antonio Cerda Tapia', 'staff', '', 'Profesor de Educación Física', 'Universidad Pedro de Valdivia, La Serena', 2010, 'Aprobado con dos votos de distinción', NULL, '17.535.133-7', '500710508071', '2026-08-11', 'fines_especiales', 2),
('Cristopher Alan Hormazábal Torres', 'staff', '', 'Técnico de Nivel Superior en Deportes', 'Centro de Formación Técnica Santo Tomás, Sede La Serena', 2022, 'Aprobado con Distinción Máxima', '132758', '16.893.442-4', '500710589603', '2026-08-11', 'fines_especiales', 3);