/*
# Create Employees Table

1. New Tables
- `employees` - Main employee information table
- `id` (uuid, primary key)
- `employee_id` (text, unique)
- `name` (text)
- `department` (text)
- `position` (text)
- `daily_salary` (numeric)
- `bank_account` (text)
- `tin_number` (text)
- `sss_number` (text)
- `philhealth_number` (text)
- `pagibig_number` (text)
- `notes` (text)
- `is_active` (boolean)
- `created_at` (timestamp)
- `updated_at` (timestamp)

2. Security
- Enable RLS on `employees` table
- Add policy for authenticated users to manage employees
*/

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text UNIQUE NOT NULL,
  name text NOT NULL,
  department text,
  position text,
  daily_salary numeric(10,2) DEFAULT 0,
  bank_account text,
  tin_number text,
  sss_number text,
  philhealth_number text,
  pagibig_number text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage employees" ON employees FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();