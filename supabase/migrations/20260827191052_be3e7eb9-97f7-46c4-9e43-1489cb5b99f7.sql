CREATE TABLE public.inbound_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  resend_email_id text,
  recipients text,
  from_address text,
  subject text,
  outcome text NOT NULL,
  detail text,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL
);

CREATE INDEX inbound_email_log_received_at_idx ON public.inbound_email_log (received_at DESC);

GRANT SELECT ON public.inbound_email_log TO authenticated;
GRANT ALL ON public.inbound_email_log TO service_role;

ALTER TABLE public.inbound_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read inbound email log"
ON public.inbound_email_log
FOR SELECT
TO authenticated
USING (public.is_active_admin(auth.uid()));