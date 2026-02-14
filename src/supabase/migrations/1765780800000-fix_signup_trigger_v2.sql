/* # Fix Signup Trigger (Robust Version)
   
   1. Purpose
      - Replaces the `handle_new_user` trigger with a crash-proof version.
      - Adds `ON CONFLICT` handling to prevent "duplicate key" errors if a profile already exists.
      - Ensures `permissions` column exists.
      - Sets `search_path` for security.
      - Handles NULL metadata gracefully.

   2. Changes
      - Adds `permissions` column if missing.
      - Updates `handle_new_user` function.
*/

-- 1. Ensure permissions column exists (Safety check)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'permissions') THEN 
    ALTER TABLE public.profiles ADD COLUMN permissions jsonb DEFAULT '{}'::jsonb; 
  END IF; 
END $$;

-- 2. Create the Robust Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_full_name text;
  v_role text;
BEGIN
  -- Extract full_name safely, default to empty string if null
  v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', '');
  
  -- Determine role based on email whitelist
  IF new.email IN ('arslanshaukat@hotmail.com', 'info@gtintl.com.ph') THEN
    v_role := 'admin';
  ELSE
    v_role := 'user';
  END IF;

  -- Insert profile with conflict handling
  INSERT INTO public.profiles (id, email, full_name, role, permissions)
  VALUES (
    new.id,
    new.email,
    v_full_name,
    v_role,
    '{}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    -- Only upgrade to admin if matches whitelist, otherwise keep existing role
    role = CASE 
        WHEN EXCLUDED.email IN ('arslanshaukat@hotmail.com', 'info@gtintl.com.ph') THEN 'admin'
        ELSE profiles.role 
    END,
    updated_at = now();

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but allow signup to proceed (Profile might be missing, but Auth works)
    -- This prevents "Database error saving new user" blocking the user entirely
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN new;
END;
$$;

-- 3. Ensure Trigger is Linked
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();