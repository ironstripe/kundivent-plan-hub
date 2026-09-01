create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create table public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  backup_type text not null check (backup_type in ('database_snapshot','excel_export')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running','success','failed')),
  storage_path text,
  file_size bigint,
  event_count integer,
  error_message text,
  created_at timestamptz not null default now()
);

grant select on public.backup_runs to authenticated;
grant all on public.backup_runs to service_role;

alter table public.backup_runs enable row level security;

create policy "Admins read backup runs"
on public.backup_runs for select to authenticated
using (public.is_active_admin(auth.uid()));

create index backup_runs_type_started_idx on public.backup_runs (backup_type, started_at desc);

-- Secret token used by the scheduled jobs to authenticate against the backup endpoint.
select vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'kundivent_backup_cron_token', 'Token für geplante Kundivent-Sicherungen');

create or replace function public.verify_backup_token(_token text)
returns boolean
language sql
stable
security definer
set search_path = public, vault, extensions
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'kundivent_backup_cron_token'
      and decrypted_secret = _token
  )
$$;

revoke all on function public.verify_backup_token(text) from public, anon, authenticated;
grant execute on function public.verify_backup_token(text) to service_role;

select cron.schedule(
  'kundivent-backup-database',
  '30 0 * * *',
  $$
  select net.http_post(
    url := 'https://project--698de5b8-4a93-47e4-a897-e8b42c9a8798.lovable.app/api/public/backups/run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-backup-token', (select decrypted_secret from vault.decrypted_secrets where name = 'kundivent_backup_cron_token')
    ),
    body := jsonb_build_object('type', 'database_snapshot'),
    timeout_milliseconds := 120000
  );
  $$
);

select cron.schedule(
  'kundivent-backup-excel',
  '0 1 * * 1',
  $$
  select net.http_post(
    url := 'https://project--698de5b8-4a93-47e4-a897-e8b42c9a8798.lovable.app/api/public/backups/run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-backup-token', (select decrypted_secret from vault.decrypted_secrets where name = 'kundivent_backup_cron_token')
    ),
    body := jsonb_build_object('type', 'excel_export'),
    timeout_milliseconds := 120000
  );
  $$
);