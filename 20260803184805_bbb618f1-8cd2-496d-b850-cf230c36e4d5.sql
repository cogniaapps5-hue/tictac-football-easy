CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_player_id ON public.payments(player_id);
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON public.payments(due_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_player_id ON public.attendance(player_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_date ON public.attendance(session_date);
CREATE INDEX IF NOT EXISTS idx_players_parent_id ON public.players(parent_id);
CREATE INDEX IF NOT EXISTS idx_players_age_group ON public.players(age_group);
CREATE INDEX IF NOT EXISTS idx_players_training_day ON public.players(training_day);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_notices_created_at ON public.notices(created_at DESC);

ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'otro';
UPDATE public.notices SET category = 'partido_amistoso' WHERE category = 'torneo';
UPDATE public.notices SET category = 'informacion_importante' WHERE category = 'reunion';
ALTER TABLE public.notices DROP CONSTRAINT IF EXISTS notices_category_check;
ALTER TABLE public.notices ADD CONSTRAINT notices_category_check CHECK (category IN ('partido_amistoso','informacion_importante','entrenamiento','suspension','otro'));