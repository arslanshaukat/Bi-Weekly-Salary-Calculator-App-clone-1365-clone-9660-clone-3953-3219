/* # Emergency Fix: Create Admin User (Pure SQL)
   
   1. Operations
      - Ensures pgcrypto is enabled.
      - First, DELETES the user and identity to ensure no conflicts (Clean Slate).
      - Uses a CTE (Common Table Expression) to:
        1. Insert the new user into `auth.users`.
        2. Capture the new User ID.
        3. Insert the corresponding Identity into `auth.identities`.
        4. Upsert the Profile in `public.profiles` to guarantee Admin role.
   
   This method avoids PL/pgSQL 'DO' blocks which can sometimes fail in web-based runners.
*/

-- 0. Enable required extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Cleanup: Remove existing user and identity to prevent unique constraint errors
DELETE FROM auth.identities WHERE provider_id = 'info@gtintl.com.ph';
DELETE FROM auth.users WHERE email = 'info@gtintl.com.ph';

-- 2. Create User, Identity, and Profile in one atomic transaction using CTEs
WITH new_user_insert AS (
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
    gen_random_uuid(),
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
  )
  RETURNING id, email, raw_user_meta_data
),
identity_insert AS (
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  SELECT 
    gen_random_uuid(),
    id,
    jsonb_build_object('sub', id, 'email', email),
    'email',
    email,
    now(),
    now(),
    now()
  FROM new_user_insert
)
-- 3. Ensure Profile exists with Admin role (Upsert)
INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
  id, 
  email, 
  raw_user_meta_data->>'full_name', 
  'admin'
FROM new_user_insert
ON CONFLICT (id) DO UPDATE 
SET 
  role = 'admin',
  full_name = EXCLUDED.full_name;