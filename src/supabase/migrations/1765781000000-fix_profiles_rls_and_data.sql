/* # Fix Profiles RLS and Ensure Admin Data
   
   1. Purpose
      - Ensure `profiles` table allows SELECT for authenticated users.
      - Ensure `arslanshaukat@hotmail.com` has a profile entry.
      - Fix any potential RLS policy conflicts.

   2. Changes
      - Re-apply RLS policies for `profiles`.
      - Upsert admin profile.
*/

-- 1. Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Reset and Re-apply Policies
-- Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can select profiles" ON profiles;

-- Create permissive SELECT policy for authenticated users
CREATE POLICY "Authenticated users can select profiles" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);

-- Create UPDATE policy for users (own profile)
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

-- Create UPDATE policy for Admins (all profiles)
-- Note: This requires the user to have role='admin' in their OWN profile row
CREATE POLICY "Admins can update any profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- 3. Ensure Admin Profile Exists for Arslan
-- We need to find the user ID from auth.users first
DO $$ 
DECLARE 
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'arslanshaukat@hotmail.com';
  
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name, role, permissions)
    VALUES (
      v_user_id, 
      'arslanshaukat@hotmail.com', 
      'Arslan Shaukat', 
      'admin',
      jsonb_build_object(
        'manage_employees', true,
        'delete_employees', true,
        'manage_payroll', true,
        'delete_payroll', true,
        'manage_attendance', true
      )
    )
    ON CONFLICT (id) DO UPDATE SET 
      role = 'admin',
      permissions = EXCLUDED.permissions;
  END IF;
END $$;