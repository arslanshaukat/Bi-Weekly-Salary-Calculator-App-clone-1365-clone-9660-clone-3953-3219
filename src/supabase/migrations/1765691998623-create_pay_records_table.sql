/*
# Create Pay Records Table

1. New Tables
- `pay_records` - Payroll calculation records
- `id` (uuid, primary key)
- `employee_id` (uuid, foreign key)
- `pay_period` (text)
- `start_date` (date)
- `end_date` (date)
- `days_present` (integer)
- `basic_salary` (numeric)
- `overtime_hours` (numeric)
- `overtime_pay` (numeric)
- `holiday_hours` (numeric)
- `holiday_pay` (numeric)
- `allowances` (numeric)
- `sss_contribution` (numeric)
- `philhealth_contribution` (numeric)
- `pagibig_contribution` (numeric)
- `other_deductions` (numeric)
- `gross_pay` (numeric)
- `net_pay` (numeric)
- `created_at` (timestamp)

2. Security
- Enable RLS on `pay_records` table
- Add policy for authenticated users to manage pay records
*/

CREATE TABLE IF NOT EXISTS pay_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  pay_period text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_present integer DEFAULT 0,
  basic_salary numeric(12,2) DEFAULT 0,
  overtime_hours numeric(5,2) DEFAULT 0,
  overtime_pay numeric(12,2) DEFAULT 0,
  holiday_hours numeric(5,2) DEFAULT 0,
  holiday_pay numeric(12,2) DEFAULT 0,
  undertime_hours numeric(5,2) DEFAULT 0,
  undertime_deduction numeric(12,2) DEFAULT 0,
  late_minutes integer DEFAULT 0,
  late_deduction numeric(12,2) DEFAULT 0,
  allowances numeric(12,2) DEFAULT 0,
  thirteenth_month numeric(12,2) DEFAULT 0,
  sss_contribution numeric(12,2) DEFAULT 0,
  philhealth_contribution numeric(12,2) DEFAULT 0,
  pagibig_contribution numeric(12,2) DEFAULT 0,
  cash_advance numeric(12,2) DEFAULT 0,
  loans numeric(12,2) DEFAULT 0,
  food_allowance numeric(12,2) DEFAULT 0,
  other_deductions numeric(12,2) DEFAULT 0,
  gross_pay numeric(12,2) DEFAULT 0,
  net_pay numeric(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pay_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage pay records" ON pay_records FOR ALL TO authenticated USING (true) WITH CHECK (true);