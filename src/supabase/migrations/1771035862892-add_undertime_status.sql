/* 
# Add Under Time Status to Attendance
1. Changes
  - Updates the check constraint on the `attendance` table to include 'undertime'.
*/

DO $$ 
BEGIN 
  ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
  ALTER TABLE attendance ADD CONSTRAINT attendance_status_check 
    CHECK (status IN ('present', 'absent', 'late', 'holiday', 'leave', 'sick', 'undertime'));
END $$;