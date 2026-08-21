ALTER TABLE public.events
  ADD COLUMN deposit_received boolean NOT NULL DEFAULT false,
  ADD COLUMN deposit_amount numeric(10,2);