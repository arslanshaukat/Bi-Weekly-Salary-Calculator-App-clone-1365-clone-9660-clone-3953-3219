/*
# Enhance Pay Records for Custom Period Support

1. Schema Changes
- Add support for custom period types in pay_period_type constraint
- Update constraint to include 'custom' period type

2. Purpose
- Support for flexible date range selections
- Allow non-standard pay periods
- Better tracking for irregular payment schedules
- Enhanced period detection capabilities

3. Data Integrity
- Maintain backward compatibility
- Add new period type without breaking existing data
- Support for auto-detected and manual period types
*/

-- Update pay_period_type constraint to include custom periods
ALTER TABLE pay_records 
DROP CONSTRAINT IF EXISTS check_pay_period_type;

ALTER TABLE pay_records 
ADD CONSTRAINT check_pay_period_type 
CHECK (pay_period_type IN ('bi-weekly', 'monthly', 'semi-monthly', 'custom'));

-- Add comment to clarify period types
COMMENT ON COLUMN pay_records.pay_period_type IS 'Pay period type: bi-weekly (1-15, 16-31), monthly (1-end), semi-monthly (custom 15-day), custom (any date range)';