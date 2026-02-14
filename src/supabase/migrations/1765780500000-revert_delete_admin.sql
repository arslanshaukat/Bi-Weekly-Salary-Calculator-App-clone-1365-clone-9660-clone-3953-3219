/* # Revert: Delete Admin User info@gtintl.com.ph
   
   1. Operations
      - Removes the user `info@gtintl.com.ph` from `auth.identities`.
      - Removes the user `info@gtintl.com.ph` from `auth.users`.
      - Removes the user `info@gtintl.com.ph` from `public.profiles`.
   
   This cleans up any partial or failed attempts to create this user from previous migrations.
*/

-- 1. Remove from identities (linked to user)
-- Using provider_id matches the email for email-based logins
DELETE FROM auth.identities WHERE provider_id = 'info@gtintl.com.ph';

-- 2. Remove from users (main auth record)
DELETE FROM auth.users WHERE email = 'info@gtintl.com.ph';

-- 3. Ensure profile is gone (Cleanup for public schema)
DELETE FROM public.profiles WHERE email = 'info@gtintl.com.ph';