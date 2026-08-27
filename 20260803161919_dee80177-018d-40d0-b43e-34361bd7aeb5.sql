ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS training_tuesday boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS training_thursday boolean NOT NULL DEFAULT false;

UPDATE public.players
SET training_tuesday = (training_day = 'martes'),
    training_thursday = (training_day = 'jueves');