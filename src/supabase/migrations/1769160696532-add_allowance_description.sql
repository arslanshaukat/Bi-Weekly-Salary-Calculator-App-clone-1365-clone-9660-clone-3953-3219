/* 
  # Add Allowance Description Support
  
  1. Modified Tables
    - `pay_records`: Added `allowance_description` (text) to store custom explanations for allowances.
*/

DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pay_records' AND column_name = 'allowance_description'
  ) THEN 
    ALTER TABLE pay_records ADD COLUMN allowance_description text;
  END IF;
END $$;