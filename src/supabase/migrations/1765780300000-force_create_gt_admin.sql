/* # Force Reset Admin User: info@gtintl.com.ph
   
   1. Operations
      - Enables `pgcrypto` extension.
      - FORCE DELETE: explicitly removes any existing user and identity for this email.
      - INSERT USER: Creates the user in `auth.users` with password 'Subic@123'.
      - INSERT IDENTITY: Manually creates the `auth.identities` record (critical for login).
      - INSERT PROFILE: Manually creates the `public.profiles` record with 'admin' role (bypassing triggers to ensure success).
*/

-- Ensure pgcrypto is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  new_uid uuid;
BEGIN
  -- 1. CLEANUP: Delete existing user and identities to ensure a clean slate
  -- Note: Deleting from auth.users typically cascades, but we delete from identities first just in case
  DELETE FROM auth.identities WHERE provider_id = 'info@gtintl.com.ph';
  DELETE FROM auth.users WHERE email = 'info@gtintl.com.ph';
  
  -- 2. Generate a new UUID for the fresh user
  new_uid := gen_random_uuid();

  -- 3. INSERT USER into auth.users
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
    crypt('Subic@123', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "GT Admin"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- 4. INSERT IDENTITY into auth.identities (Critical for Supabase Auth to work)
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
    'info@gtintl.com.ph',
    now(),
    now(),
    now()
  );

  -- 5. MANUALLY INSERT PROFILE (To ensure Admin role is set immediately)
  -- We use ON CONFLICT DO UPDATE just in case a trigger already created it
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new_uid, 'info@gtintl.com.ph', 'GT Admin', 'admin')
  ON CONFLICT (id) DO UPDATE 
  SET role = 'admin', full_name = 'GT Admin';

  RAISE NOTICE 'Admin user info@gtintl.com.ph has been successfully force-created with ID %', new_uid;
END $$;