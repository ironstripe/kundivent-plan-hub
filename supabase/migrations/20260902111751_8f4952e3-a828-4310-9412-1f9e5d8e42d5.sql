select cron.schedule(
  'kundivent-radar-sync-stein-am-rhein',
  '30 4 * * *',
  $$
  select net.http_post(
    url := 'https://project--698de5b8-4a93-47e4-a897-e8b42c9a8798.lovable.app/api/public/radar/sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-backup-token', (select decrypted_secret from vault.decrypted_secrets where name = 'kundivent_backup_cron_token')
    ),
    body := jsonb_build_object('sourceId', 'stein-am-rhein'),
    timeout_milliseconds := 120000
  );
  $$
);