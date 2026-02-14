/* 
# Create System Activity Table
1. New Tables
  - `system_activity_1767442700392`
    - `id` (uuid, primary key)
    - `activity_type` (text) - e.g., 'heartbeat', 'session_start'
    - `client_info` (jsonb) - store browser/os info
    - `created_at` (timestamp)
2. Security
  - Enable RLS
  - Add policy for public/anonymous inserts (to ensure it runs even if login fails)
*/

CREATE TABLE IF NOT EXISTS system_activity_1767442700392 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type text NOT NULL DEFAULT 'heartbeat',
  client_info jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE system_activity_1767442700392 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable anonymous inserts for heartbeats" 
ON system_activity_1767442700392 FOR INSERT 
TO public 
WITH CHECK (true);

CREATE POLICY "Enable public select for health checks" 
ON system_activity_1767442700392 FOR SELECT 
TO public 
USING (true);

-- Maintenance: Automatically delete logs older than 7 days to save space
-- Note: Supabase doesn't support scheduled workers in pure SQL easily without pg_cron, 
-- but we can trigger a cleanup occasionally during a heartbeat insert.