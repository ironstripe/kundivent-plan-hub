insert into public.radar_sources (id, name, source_type, base_url, active, sync_enabled)
values ('diessenhofen', 'Stadtgemeinde Diessenhofen', 'regional_event', 'https://www.diessenhofen.ch/staedtlileben/veranstaltungen.html/100', true, true)
on conflict (id) do update set
  name = excluded.name,
  source_type = excluded.source_type,
  base_url = excluded.base_url,
  active = true,
  sync_enabled = true;

select cron.unschedule('kundivent-radar-sync-diessenhofen')
where exists (select 1 from cron.job where jobname = 'kundivent-radar-sync-diessenhofen');

select cron.schedule(
  'kundivent-radar-sync-diessenhofen',
  '40 4 * * *',
  $$
  select net.http_post(
    url := 'https://project--698de5b8-4a93-47e4-a897-e8b42c9a8798.lovable.app/api/public/radar/sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-backup-token', (select decrypted_secret from vault.decrypted_secrets where name = 'kundivent_backup_cron_token')
    ),
    body := jsonb_build_object('sourceId', 'diessenhofen'),
    timeout_milliseconds := 120000
  );
  $$
);