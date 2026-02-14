/* 
# Add Employee Type and Account Info
1. Changes
  - Add `employee_type` to `employees` table (Full Time vs Temporary)
  - Ensure account number columns exist for editing
2. Security
  - Maintain existing RLS
*/

DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'employee_type') THEN
    ALTER TABLE employees ADD COLUMN employee_type text DEFAULT 'Full Time' CHECK (employee_type IN ('Full Time', 'Temporary'));
  END IF;
END $$;

-- Update existing records to default to Full Time
UPDATE employees SET employee_type = 'Full Time' WHERE employee_type IS NULL;