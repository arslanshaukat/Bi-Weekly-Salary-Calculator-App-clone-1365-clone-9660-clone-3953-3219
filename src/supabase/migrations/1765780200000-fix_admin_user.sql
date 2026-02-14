/* # Fix and Reset Admin User: info@gtintl.com.ph
   
   1. Operations
      - Ensures `pgcrypto` extension is enabled (for password hashing)
      - CLEANUP: Removes any existing user with email 'info@gtintl.com.ph' to ensure a fresh start
      - INSERT: Creates the user in `auth.users` with password 'Subic@123'
      - IDENTITY: Adds a corresponding record in `auth.identities` (crucial for some Auth setups)
      - The `handle_new_user` trigger will automatically handle the `public.profiles` entry and Admin role
*/

-- Ensure pgcrypto is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  new_uid uuid;
BEGIN
  -- 1. DELETE existing user to prevent conflicts (Cleanup)
  DELETE FROM auth.users WHERE email = 'info@gtintl.com.ph';

  -- 2. Generate a new UUID
  new_uid := gen_random_uuid();

  -- 3. INSERT new user into auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_uid,
    'authenticated',
    'authenticated',
    'info@gtintl.com.ph',
    crypt('Subic@123', gen_salt('bf')), -- Hash the password safely
    now(), -- Auto-confirm email
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "GT Admin"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- 4. INSERT into auth.identities (Required for consistent login behavior)
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_uid,
    jsonb_build_object('sub', new_uid, 'email', 'info@gtintl.com.ph'),
    'email',
    'info@gtintl.com.ph', -- For email provider, provider_id is the email
    now(),
    now(),
    now()
  );

  RAISE NOTICE 'User info@gtintl.com.ph has been successfully reset/created with ID %', new_uid;
END $$;