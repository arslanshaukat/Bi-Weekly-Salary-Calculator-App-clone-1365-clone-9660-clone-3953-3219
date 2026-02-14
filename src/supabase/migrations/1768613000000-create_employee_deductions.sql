/* 
# Create Employee Deductions Table
1. New Tables
  - `employee_deductions`
    - `id` (uuid, primary key)
    - `employee_id` (uuid, foreign key)
    - `category` (text) - e.g., 'Cash Advance', 'Loan', 'Food', 'Others'
    - `amount` (numeric)
    - `date` (date)
    - `notes` (text)
    - `is_processed` (boolean) - Track if used in a payslip
    - `processed_in_record_id` (uuid, optional) - Link to the payslip
2. Security
  - Enable RLS
  - Add public access policy (matching current project settings)
*/

CREATE TABLE IF NOT EXISTS employee_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('Cash Advance', 'Loan', 'Food', 'Others')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  is_processed boolean DEFAULT false,
  processed_in_record_id uuid REFERENCES pay_records(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE employee_deductions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access for deductions" ON employee_deductions FOR ALL TO public USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_deductions_employee_processed ON employee_deductions(employee_id, is_processed);