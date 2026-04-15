/* 
# Add Thirteenth Month Eligible Days Column
1. New Columns
  - `thirteenth_month_days` (numeric) in `pay_records` table
2. Purpose
  - To explicitly store the number of days used to calculate the 13th month accrual
  - Fixes display issues where "Days Present" differed from "Eligible Days"
*/

DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pay_records' AND column_name = 'thirteenth_month_days'
  ) THEN
    ALTER TABLE pay_records ADD COLUMN thirteenth_month_days numeric(5,2) DEFAULT 0;
  END IF;
END $$;