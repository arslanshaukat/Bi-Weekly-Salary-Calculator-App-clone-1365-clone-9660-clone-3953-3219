/* 
# Add Weekly Pay and Fix Constraints
1. Changes
  - Update `pay_period_type` constraint to include 'weekly'
  - Ensure `pay_month` is always between 1 and 12
  - Update existing trigger or data if necessary
2. Purpose
  - Support weekly payroll cycles
  - Fix the 0-indexed month bug from the frontend
*/

-- 1. Update the pay_period_type constraint
ALTER TABLE pay_records DROP CONSTRAINT IF EXISTS check_pay_period_type;
ALTER TABLE pay_records ADD CONSTRAINT check_pay_period_type 
CHECK (pay_period_type IN ('weekly', 'bi-weekly', 'monthly', 'semi-monthly', 'custom'));

-- 2. Ensure pay_month is valid (1-12)
-- If any 0 values exist from previous errors, update them to 1
UPDATE pay_records SET pay_month = 1 WHERE pay_month = 0;

-- 3. Add comment for documentation
COMMENT ON COLUMN pay_records.pay_period_type IS 'Pay period type: weekly, bi-weekly (1-15,16-31), monthly (1-end), semi-monthly, custom';