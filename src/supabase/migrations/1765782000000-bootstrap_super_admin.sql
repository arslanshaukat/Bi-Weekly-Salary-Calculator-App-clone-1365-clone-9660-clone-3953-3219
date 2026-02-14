/* # Bootstrap Super Admin Access
   
   1. Purpose
      - Ensure 'arslanshaukat@hotmail.com' and 'info@gtintl.com.ph' can ALWAYS perform actions on the `profiles` table.
      - This bypasses the need to check the `role` column in the database, relying instead on the secure authenticated email.
      - Solves "Database changes not approved" by guaranteeing write access for these specific users.

   2. Changes
      - Create a high-priority RLS policy for Super Admins on `profiles`.
*/

-- Create a policy that allows specific emails to do ANYTHING on the profiles table
-- This acts as a master key for the admin users
CREATE POLICY "Super Admins can do everything on profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  auth.jwt() ->> 'email' IN ('arslanshaukat@hotmail.com', 'info@gtintl.com.ph')
)
WITH CHECK (
  auth.jwt() ->> 'email' IN ('arslanshaukat@hotmail.com', 'info@gtintl.com.ph')
);