/* # Delete User: info@gtintl.com.ph
   
   1. Operations
      - Removes the user with email 'info@gtintl.com.ph' from the authentication system
      - Due to ON DELETE CASCADE constraints, this will automatically remove:
        - The user's profile from `public.profiles`
        - Any linked data (if foreign keys are set to cascade)
*/

DO $$
BEGIN
  -- Attempt to delete the user from auth.users
  -- This requires appropriate permissions (like running in Supabase SQL Editor)
  DELETE FROM auth.users WHERE email = 'info@gtintl.com.ph';
END $$;