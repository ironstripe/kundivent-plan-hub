ALTER TABLE public.events
  ADD COLUMN responsible_user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS events_responsible_user_id_idx ON public.events (responsible_user_id);