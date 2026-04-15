/* 
# Restrict Mel's Permissions to Attendance Only
1. Changes
  - Updates the profile for `gtsubic@gmail.com` (Mel)
  - Sets all management permissions to false except `manage_attendance`
2. Purpose
  - Ensures the UI logic matches the database permissions for security
*/

UPDATE public.profiles 
SET permissions = jsonb_build_object(
  'manage_employees', false,
  'manage_attendance', true,
  'manage_payroll', false,
  'delete_payroll', false,
  'delete_employees', false
)
WHERE email = 'gtsubic@gmail.com';