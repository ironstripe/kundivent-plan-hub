ALTER TABLE public.events ADD COLUMN created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX idx_events_created_by ON public.events(created_by);