/*
# Fix RLS Policies for Public Access
1. Security Changes
   - Drop existing restrictive policies to ensure clean state
   - Create explicit public access policies for all tables
   - Ensure anonymous users can perform all CRUD operations
   - Fix "new row violates row-level security policy" error
*/

-- Employees Table
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Drop potential existing policies to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can manage employees" ON employees;
DROP POLICY IF EXISTS "Enable anonymous access for employees" ON employees;
DROP POLICY IF EXISTS "Public access for employees" ON employees;

-- Create comprehensive public policy
CREATE POLICY "Public access for employees"
ON employees FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Pay Records Table
ALTER TABLE pay_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage pay records" ON pay_records;
DROP POLICY IF EXISTS "Enable anonymous access for pay records" ON pay_records;
DROP POLICY IF EXISTS "Public access for pay records" ON pay_records;

CREATE POLICY "Public access for pay records"
ON pay_records FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Attendance Table
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage attendance" ON attendance;
DROP POLICY IF EXISTS "Enable anonymous access for attendance" ON attendance;
DROP POLICY IF EXISTS "Public access for attendance" ON attendance;

CREATE POLICY "Public access for attendance"
ON attendance FOR ALL
TO public
USING (true)
WITH CHECK (true);