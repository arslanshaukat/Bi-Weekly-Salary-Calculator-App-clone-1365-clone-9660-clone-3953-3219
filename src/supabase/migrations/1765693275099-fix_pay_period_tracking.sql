/*
# Comprehensive Pay Period Tracking Fix

1. Schema Updates
- Ensure all pay record columns are properly added
- Fix constraints for pay period types
- Add proper indexes for performance
- Update existing data where needed

2. Purpose
- Ensure database schema supports enhanced pay period tracking
- Fix any missing columns from previous migrations
- Support for custom period types and auto-detection
- Better reporting and querying capabilities

3. Data Integrity
- Maintain backward compatibility
- Update existing records with default values where needed
- Ensure all constraints are properly applied
*/

-- First, ensure all columns exist
ALTER TABLE pay_records 
ADD COLUMN IF NOT EXISTS pay_year integer,
ADD COLUMN IF NOT EXISTS pay_month integer, 
ADD COLUMN IF NOT EXISTS pay_month_name text,
ADD COLUMN IF NOT EXISTS pay_period_type text DEFAULT 'bi-weekly',
ADD COLUMN IF NOT EXISTS pay_date date;

-- Drop and recreate constraints to ensure they're properly applied
ALTER TABLE pay_records DROP CONSTRAINT IF EXISTS check_pay_period_type;
ALTER TABLE pay_records DROP CONSTRAINT IF EXISTS check_pay_month;
ALTER TABLE pay_records DROP CONSTRAINT IF EXISTS check_pay_year;

-- Add all constraints
ALTER TABLE pay_records 
ADD CONSTRAINT check_pay_period_type 
CHECK (pay_period_type IN ('bi-weekly', 'monthly', 'semi-monthly', 'custom'));

ALTER TABLE pay_records 
ADD CONSTRAINT check_pay_month 
CHECK (pay_month >= 1 AND pay_month <= 12);

ALTER TABLE pay_records 
ADD CONSTRAINT check_pay_year 
CHECK (pay_year >= 2020 AND pay_year <= 2100);

-- Update existing records with default values
UPDATE pay_records 
SET 
  pay_year = EXTRACT(YEAR FROM created_at),
  pay_month = EXTRACT(MONTH FROM created_at),
  pay_month_name = TO_CHAR(created_at, 'Month'),
  pay_date = created_at,
  pay_period_type = CASE 
    WHEN EXTRACT(DAY FROM created_at) <= 15 THEN 'bi-weekly'
    ELSE 'bi-weekly'
  END
WHERE pay_year IS NULL OR pay_month IS NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pay_records_year_month ON pay_records(pay_year, pay_month);
CREATE INDEX IF NOT EXISTS idx_pay_records_employee_year ON pay_records(employee_id, pay_year);
CREATE INDEX IF NOT EXISTS idx_pay_records_period_type ON pay_records(pay_period_type);
CREATE INDEX IF NOT EXISTS idx_pay_records_dates ON pay_records(start_date, end_date);

-- Add comments for documentation
COMMENT ON COLUMN pay_records.pay_year IS 'Year of the pay period (e.g., 2024)';
COMMENT ON COLUMN pay_records.pay_month IS 'Month number (1-12)';
COMMENT ON COLUMN pay_records.pay_month_name IS 'Full month name (e.g., January)';
COMMENT ON COLUMN pay_records.pay_period_type IS 'Pay period type: bi-weekly (1-15, 16-31), monthly (1-end), semi-monthly (custom 15-day), custom (any date range)';
COMMENT ON COLUMN pay_records.pay_date IS 'Actual payment date';