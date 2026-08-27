CREATE TABLE public.event_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text,
  file_size bigint,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_attachments_event_id ON public.event_attachments(event_id);

GRANT SELECT, INSERT, DELETE ON public.event_attachments TO authenticated;
GRANT ALL ON public.event_attachments TO service_role;

ALTER TABLE public.event_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read attachments"
  ON public.event_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users add attachments"
  ON public.event_attachments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users delete attachments"
  ON public.event_attachments FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users read attachment files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'event-attachments');

CREATE POLICY "Authenticated users upload attachment files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-attachments');

CREATE POLICY "Authenticated users delete attachment files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'event-attachments');