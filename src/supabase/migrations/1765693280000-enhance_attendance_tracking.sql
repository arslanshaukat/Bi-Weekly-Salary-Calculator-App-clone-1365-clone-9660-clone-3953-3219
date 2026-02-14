/*
# Enhanced Attendance Tracking

1. Schema Updates
- Add missing columns for comprehensive attendance tracking
- Improve data integrity with proper constraints
- Add indexes for better query performance

2. Purpose
- Support for detailed attendance tracking
- Better integration with payroll calculations
- Enhanced reporting capabilities

3. Data Integrity
- Maintain backward compatibility
- Add sensible defaults for new columns
- Ensure data consistency
*/

-- Add missing columns if they don't exist
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS overtime_hours decimal(4,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS undertime_hours decimal(4,2) DEFAULT 0;

-- Update existing records
UPDATE attendance 
SET overtime_hours = 0 WHERE overtime_hours IS NULL;
UPDATE attendance 
SET undertime_hours = 0 WHERE undertime_hours IS NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);