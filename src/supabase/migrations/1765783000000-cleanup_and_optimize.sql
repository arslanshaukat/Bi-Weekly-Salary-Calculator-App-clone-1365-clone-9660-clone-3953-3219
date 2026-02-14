/* # Cleanup Users and Optimize Performance
   
   1. Cleanup
      - Remove all user profiles EXCEPT 'arslanshaukat@hotmail.com' and 'info@gtintl.com.ph'
      - Remove all auth users EXCEPT the whitelisted emails (Clean Slate)
   
   2. Optimization (Indexing)
      - Add indexes to frequent search columns (name, department, dates)
      - This reduces Supabase Resource Usage (Compute/Disk IO)
*/

-- 1. DELETE Unwanted Profiles
DELETE FROM public.profiles
WHERE email NOT IN ('arslanshaukat@hotmail.com', 'info@gtintl.com.ph');

-- 2. DELETE Unwanted Auth Users
-- This cleans the authentication system
DELETE FROM auth.users
WHERE email NOT IN ('arslanshaukat@hotmail.com', 'info@gtintl.com.ph');

-- 3. Performance Indexes

-- Speed up Employee List & Search
CREATE INDEX IF NOT EXISTS idx_employees_search_composite 
ON employees(name, employee_id, department);

-- Speed up Pay Record retrieval by Employee + Date (Critical for Payslip history)
CREATE INDEX IF NOT EXISTS idx_pay_records_composite_lookup
ON pay_records(employee_id, pay_year, pay_month);

-- Speed up Attendance retrieval for specific ranges
CREATE INDEX IF NOT EXISTS idx_attendance_lookup
ON attendance(employee_id, date);

-- Speed up Profile Role checks
CREATE INDEX IF NOT EXISTS idx_profiles_role
ON profiles(role);