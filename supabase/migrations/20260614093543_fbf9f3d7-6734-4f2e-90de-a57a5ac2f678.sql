SELECT cron.alter_job(
  job_id := jobid,
  command := $$
    SELECT net.http_post(
      url := 'https://project--852599ee-9672-47c9-9813-728476778005-dev.lovable.app/api/public/hooks/sync-results',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
)
FROM cron.job
WHERE jobname = 'sync-wc-results';