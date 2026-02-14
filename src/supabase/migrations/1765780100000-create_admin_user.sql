/* # Create Admin User: info@gtintl.com.ph
   
   1. Operations
      - Enables `pgcrypto` extension for password hashing
      - Inserts user 'info@gtintl.com.ph' into `auth.users`
      - Sets password to 'Subic@123' (hashed)
      - Auto-confirms the email
      - The existing database trigger will automatically:
        - Create the profile in `public.profiles`
        - Assign the 'admin' role (based on the email allowlist)
*/

-- Ensure pgcrypto is available for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Only insert if the user doesn't exist
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'info@gtintl.com.ph') THEN
    
    new_user_id := gen_random_uuid();

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
      new_user_id,
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
    
    -- Raise notice for confirmation
    RAISE NOTICE 'User info@gtintl.com.ph created successfully with ID %', new_user_id;
  ELSE
    RAISE NOTICE 'User info@gtintl.com.ph already exists';
  END IF;
END $$;