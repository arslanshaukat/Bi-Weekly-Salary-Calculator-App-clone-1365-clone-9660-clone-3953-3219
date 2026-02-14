/* 
# Add undertime_minutes to pay_records
1. Changes
  - Add `undertime_minutes` column to `pay_records` table to match application logic.
  - Set default value to 0.
2. Purpose
  - Fixes "undertime_minutes column not found" error during payroll calculation saving.
*/

DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pay_records' AND column_name = 'undertime_minutes'
  ) THEN 
    ALTER TABLE pay_records ADD COLUMN undertime_minutes integer DEFAULT 0;
  END IF;
END $$;