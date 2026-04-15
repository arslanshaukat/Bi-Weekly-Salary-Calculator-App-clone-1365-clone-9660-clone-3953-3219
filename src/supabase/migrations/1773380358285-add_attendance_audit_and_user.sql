/* 
# Attendance Audit & New User Setup
1. New Columns
  - `attendance` table:
    - `modified_by_name` (text): Stores the name of the user who last changed the record.
    - `modified_at` (timestamptz): Stores the exact time of the last modification.
2. New User Creation
  - Creates user `gtsubic@gmail.com` with password `Subic@123`.
  - Creates a profile for "Mel" with specific permissions:
    - `manage_employees`: true (to see/manage personnel)
    - `manage_attendance`: true (to manage logs)
3. Security
  - Maintains existing RLS policies.
*/

-- 1. Add metadata columns to attendance
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS modified_by_name text,
ADD COLUMN IF NOT EXISTS modified_at timestamptz DEFAULT now();

-- 2. Create the User 'Mel'
DO $$ 
DECLARE new_uid uuid;
BEGIN
  -- Cleanup existing if any to avoid conflicts
  DELETE FROM auth.identities WHERE provider_id = 'gtsubic@gmail.com';
  DELETE FROM auth.users WHERE email = 'gtsubic@gmail.com';

  -- Create fresh user
  new_uid := gen_random_uuid();
  
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, 
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, confirmation_token, email_change, 
    email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', new_uid, 'authenticated', 'authenticated', 
    'gtsubic@gmail.com', crypt('Subic@123', gen_salt('bf')), 
    now(), '{"provider": "email", "providers": ["email"]}', 
    '{"full_name": "Mel"}', now(), now(), '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, 
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), new_uid, jsonb_build_object('sub', new_uid, 'email', 'gtsubic@gmail.com'), 
    'email', 'gtsubic@gmail.com', now(), now(), now()
  );

  -- 3. Create Profile with specific permissions
  INSERT INTO public.profiles (id, email, full_name, role, permissions)
  VALUES (
    new_uid, 
    'gtsubic@gmail.com', 
    'Mel', 
    'user', 
    jsonb_build_object(
      'manage_employees', true,
      'manage_attendance', true,
      'manage_payroll', false,
      'delete_payroll', false,
      'delete_employees', false
    )
  ) ON CONFLICT (id) DO UPDATE SET 
    full_name = 'Mel',
    permissions = EXCLUDED.permissions;

END $$;