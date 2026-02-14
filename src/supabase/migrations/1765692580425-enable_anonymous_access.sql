/*
# Enable Anonymous Access for Public Operations

1. Security Changes
- Update RLS policies to allow anonymous access for public operations
- This allows the app to work without requiring authentication
- All tables will be publicly readable and writable for demo purposes
*/

-- Update employees table policies
DROP POLICY IF EXISTS "Authenticated users can manage employees" ON employees;
CREATE POLICY "Enable anonymous access for employees" ON employees FOR ALL USING (true) WITH CHECK (true);

-- Update pay_records table policies
DROP POLICY IF EXISTS "Authenticated users can manage pay records" ON pay_records;
CREATE POLICY "Enable anonymous access for pay records" ON pay_records FOR ALL USING (true) WITH CHECK (true);

-- Update attendance table policies
DROP POLICY IF EXISTS "Authenticated users can manage attendance" ON attendance;
CREATE POLICY "Enable anonymous access for attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);