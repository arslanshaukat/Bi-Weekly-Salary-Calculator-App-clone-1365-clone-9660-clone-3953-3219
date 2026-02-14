/*
# Enhance Pay Records Table with Date Tracking

1. Schema Changes
- Add `pay_year` (integer) - Year of pay period
- Add `pay_month` (integer) - Month number (1-12)
- Add `pay_month_name` (text) - Full month name
- Add `pay_period_type` (text) - Type of pay period (bi-weekly, monthly, semi-monthly)
- Add `pay_date` (date) - Actual payment date

2. Purpose
- Better tracking of pay periods by year and month
- Support for different pay period types
- Clear indication of when payment will be made
- Improved reporting and querying capabilities

3. Data Integrity
- All new columns are optional with sensible defaults
- Existing records will not be affected
- New records will include comprehensive date tracking
*/

-- Add new columns to pay_records table
ALTER TABLE pay_records 
ADD COLUMN IF NOT EXISTS pay_year integer,
ADD COLUMN IF NOT EXISTS pay_month integer,
ADD COLUMN IF NOT EXISTS pay_month_name text,
ADD COLUMN IF NOT EXISTS pay_period_type text DEFAULT 'bi-weekly',
ADD COLUMN IF NOT EXISTS pay_date date;

-- Add constraint for pay_period_type
ALTER TABLE pay_records 
ADD CONSTRAINT IF NOT EXISTS check_pay_period_type 
CHECK (pay_period_type IN ('bi-weekly', 'monthly', 'semi-monthly'));

-- Add constraints for month values
ALTER TABLE pay_records 
ADD CONSTRAINT IF NOT EXISTS check_pay_month 
CHECK (pay_month >= 1 AND pay_month <= 12);

-- Add constraint for pay_year
ALTER TABLE pay_records 
ADD CONSTRAINT IF NOT EXISTS check_pay_year 
CHECK (pay_year >= 2020 AND pay_year <= 2100);