/* # Definite Recursion Fix & Cleanup
   
   1. Fix Infinite Recursion
      - Drop ALL potential policies on `profiles` table.
      - Re-create `is_admin()` helper with strict `SECURITY DEFINER` settings to bypass RLS loops.
   
   2. Policy Definitions
      - SELECT: Allow authenticated users to view all profiles (Safe, non-recursive).
      - INSERT: Allow users to create their own profile.
      - UPDATE: 
        - Users can update their own profile.
        - Admins (via safe function) can update any profile.
   
   3. Cleanup
      - Remove all users except the two authorized super admins.
*/

-- 1. Reset Admin Check Function
-- We drop it first to ensure we can change return types or signatures if needed
DROP FUNCTION IF EXISTS public.is_admin();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER -- Critical: Runs as superuser/owner to bypass RLS
SET search_path = public -- Critical: Prevents search_path hijacking
AS $$
BEGIN
  -- Check if the current user has the 'admin' role
  -- Since this is SECURITY DEFINER, it won't trigger the RLS recursion on 'profiles'
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- 2. Drop ALL Existing Policies (Aggressive Cleanup)
-- We list every policy name used in previous steps to ensure a clean slate
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can select profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Super Admins can do everything on profiles" ON profiles;
DROP POLICY IF EXISTS "Enable anonymous access for profiles" ON profiles;

-- 3. Re-Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create Safe, Non-Recursive Policies

-- SELECT: Open to all authenticated users (Needed for Employee/User lists)
-- This uses a constant 'true' condition, impossible to recurse.
CREATE POLICY "Authenticated users can select profiles" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);

-- INSERT: Users can only create their own profile
CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- UPDATE (Self): Users can update their own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

-- UPDATE (Admin): Admins can update ANY profile
-- Uses the safe SECURITY DEFINER function
CREATE POLICY "Admins can update any profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (public.is_admin());

-- ALL (Super Admin): Hardcoded Email Bypass
-- This is the ultimate failsafe. It does NOT query the DB for permissions.
CREATE POLICY "Super Admins can do everything" 
ON public.profiles FOR ALL 
TO authenticated 
USING (
  auth.jwt() ->> 'email' IN ('arslanshaukat@hotmail.com', 'info@gtintl.com.ph')
) 
WITH CHECK (
  auth.jwt() ->> 'email' IN ('arslanshaukat@hotmail.com', 'info@gtintl.com.ph')
);

-- 5. Execute Cleanup
-- Delete unauthorized profiles
DELETE FROM public.profiles 
WHERE email NOT IN ('arslanshaukat@hotmail.com', 'info@gtintl.com.ph');

-- Delete unauthorized auth users
DELETE FROM auth.users 
WHERE email NOT IN ('arslanshaukat@hotmail.com', 'info@gtintl.com.ph');