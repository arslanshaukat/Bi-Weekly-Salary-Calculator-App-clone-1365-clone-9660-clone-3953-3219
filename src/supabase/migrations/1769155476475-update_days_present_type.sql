/* # Update Days Present to Decimal
1. Changes
  - Change `days_present` column in `pay_records` table from `integer` to `numeric(5,2)`.
2. Purpose
  - To support fractional day calculations (e.g., 10.5 days) for employees who check in after 12:00 PM.
*/

DO $$ 
BEGIN 
  ALTER TABLE IF EXISTS pay_records 
  ALTER COLUMN days_present TYPE numeric(5,2);
END $$;