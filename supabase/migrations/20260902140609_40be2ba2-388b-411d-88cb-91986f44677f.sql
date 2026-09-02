ALTER TABLE public.backup_runs
  ADD COLUMN IF NOT EXISTS external_backup_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS external_backup_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS external_backup_error text;