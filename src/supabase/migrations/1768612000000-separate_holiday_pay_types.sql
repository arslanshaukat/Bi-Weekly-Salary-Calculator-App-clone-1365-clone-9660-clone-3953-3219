/* 
# Separate Holiday Pay Types
1. New Columns
  - `reg_holiday_pay` (numeric): Specifically for Regular Holidays (200% rate)
  - `spec_holiday_pay` (numeric): Specifically for Special Non-Working Holidays (130% rate)
2. Purpose
  - Allows the payslip to explicitly state which type of holiday pay is being disbursed.
  - Improves transparency for labor compliance.
*/

DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pay_records' AND column_name = 'reg_holiday_pay') THEN
    ALTER TABLE pay_records ADD COLUMN reg_holiday_pay numeric(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pay_records' AND column_name = 'spec_holiday_pay') THEN
    ALTER TABLE pay_records ADD COLUMN spec_holiday_pay numeric(12,2) DEFAULT 0;
  END IF;
END $$;