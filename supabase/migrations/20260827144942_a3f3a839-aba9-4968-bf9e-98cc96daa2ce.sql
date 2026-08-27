-- 1. Inbound email token on events
CREATE OR REPLACE FUNCTION public.new_inbound_email_token()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  candidate text;
BEGIN
  LOOP
    candidate := lower(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 10));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.events WHERE inbound_email_token = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS inbound_email_token text;

UPDATE public.events
SET inbound_email_token = lower(substr(md5(id::text || 'kundivent-inbound'), 1, 10))
WHERE inbound_email_token IS NULL;

ALTER TABLE public.events ALTER COLUMN inbound_email_token SET DEFAULT public.new_inbound_email_token();
ALTER TABLE public.events ALTER COLUMN inbound_email_token SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_inbound_email_token_key'
  ) THEN
    ALTER TABLE public.events ADD CONSTRAINT events_inbound_email_token_key UNIQUE (inbound_email_token);
  END IF;
END $$;

-- 2. event_emails table
CREATE TABLE IF NOT EXISTS public.event_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  resend_email_id text NOT NULL UNIQUE,
  message_id text,
  from_address text NOT NULL,
  from_name text,
  to_address text NOT NULL,
  subject text,
  text_body text,
  html_body text,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_emails TO authenticated;
GRANT ALL ON public.event_emails TO service_role;

ALTER TABLE public.event_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read event emails"
  ON public.event_emails FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_event_emails_event_id ON public.event_emails(event_id);
CREATE INDEX IF NOT EXISTS idx_event_emails_received_at ON public.event_emails(received_at DESC);

-- 3. attachment origin
ALTER TABLE public.event_attachments ADD COLUMN IF NOT EXISTS event_email_id uuid REFERENCES public.event_emails(id) ON DELETE SET NULL;
ALTER TABLE public.event_attachments ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_attachments_source_check') THEN
    ALTER TABLE public.event_attachments ADD CONSTRAINT event_attachments_source_check CHECK (source IN ('manual', 'email'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_event_attachments_email_id ON public.event_attachments(event_email_id);