/* # Enforce Admin Privileges for Super Users
   
   1. Purpose
      - Explicitly force `role = 'admin'` for `arslanshaukat@hotmail.com`.
      - Populate `permissions` JSONB with all available permissions set to `true`.
      - This acts as a self-healing migration for existing user profiles.

   2. Changes
      - Updates `public.profiles` for the specific email.
*/

UPDATE public.profiles 
SET 
  role = 'admin',
  permissions = jsonb_build_object(
    'manage_employees', true,
    'delete_employees', true,
    'manage_payroll', true,
    'delete_payroll', true,
    'manage_attendance', true
  ),
  updated_at = now()
WHERE email = 'arslanshaukat@hotmail.com';

-- Also ensure info@gtintl.com.ph is fully equipped
UPDATE public.profiles 
SET 
  role = 'admin',
  permissions = jsonb_build_object(
    'manage_employees', true,
    'delete_employees', true,
    'manage_payroll', true,
    'delete_payroll', true,
    'manage_attendance', true
  ),
  updated_at = now()
WHERE email = 'info@gtintl.com.ph';