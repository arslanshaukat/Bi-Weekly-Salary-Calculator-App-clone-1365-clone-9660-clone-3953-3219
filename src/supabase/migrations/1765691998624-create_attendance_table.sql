/*
# Create Attendance Table

1. New Tables
- `attendance` - Daily attendance tracking
- `id` (uuid, primary key)
- `employee_id` (uuid, foreign key)
- `date` (date)
- `status` (text)
- `check_in_time` (time)
- `check_out_time` (time)
- `late_minutes` (integer)
- `undertime_minutes` (integer)
- `overtime_hours` (decimal)
- `notes` (text)
- `created_at` (timestamp)

2. Security
- Enable RLS on `attendance` table
- Add policy for authenticated users to manage attendance
*/

CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'holiday', 'leave', 'sick')),
  check_in_time time,
  check_out_time time,
  late_minutes integer DEFAULT 0,
  undertime_minutes integer DEFAULT 0,
  overtime_hours decimal(4,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, date)
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage attendance" ON attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);