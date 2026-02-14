/* 
# Setup Automated Database Heartbeat
1. Extensions
  - Enable `pg_cron` (Standard Supabase extension for scheduled tasks)
2. Scheduled Task
  - Create a job that runs every day at midnight (00:00)
  - The job inserts a record into the activity table to signal "activity" to Supabase
3. Purpose
  - Prevents Supabase project from pausing due to 7 days of inactivity
  - Runs automatically on the server without any user interaction
*/

-- 1. Enable the cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Schedule the heartbeat task
-- Format: 'minute hour day month day_of_week'
-- '0 0 * * *' means every day at 12:00 AM
SELECT cron.schedule(
  'supabase-daily-heartbeat', -- unique name for the job
  '0 0 * * *',               -- every day at midnight
  $$
    INSERT INTO system_activity_1767442700392 (activity_type, client_info)
    VALUES ('automated_cron', '{"system": "pg_cron", "origin": "database_internal"}');
  $$
);

-- 3. Optional: Schedule a weekly cleanup of the activity logs
-- Runs every Sunday at 1:00 AM
SELECT cron.schedule(
  'activity-logs-cleanup',
  '0 1 * * 0',
  $$
    DELETE FROM system_activity_1767442700392 
    WHERE created_at < now() - interval '7 days';
  $$
);