/* # Fix Infinite Recursion & Retry Cleanup
   
   1. Fix Recursion Error
      - Problem: The "Admins can update" policy was checking the `profiles` table, which triggered a "Can I select?" check, which checked `profiles` again -> Infinite Loop.
      - Solution: Create a `SECURITY DEFINER` function `is_admin()`. This runs with system privileges, bypassing the RLS loop safely.
   
   2. Policy Reset
      - Drop ALL existing policies on `profiles` to ensure no recursive logic remains.
      - Re-apply clean, simple policies using the new helper function.
   
   3. Cleanup (Retry)
      - Execute the user cleanup again, as the previous attempt likely failed due to the recursion error.
*/

-- 1. Create Safe Admin Check Function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  -- This query runs with the privileges of the function creator (postgres),
  -- avoiding the RLS recursion loop on the 'profiles' table.
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop ALL policies to ensure clean slate
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can select profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Super Admins can do everything on profiles" ON profiles;

-- 3. Re-create Policies (Non-Recursive)

-- SELECT: Allow authenticated users to see all profiles (Needed for User Management list)
CREATE POLICY "Authenticated users can select profiles" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);

-- INSERT: Users can create their own profile
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
-- Uses the SECURITY DEFINER function to avoid recursion
CREATE POLICY "Admins can update any profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (public.is_admin());

-- ALL (Super Admin): Whitelist email bypass (Ultimate Failsafe)
CREATE POLICY "Super Admins can do everything on profiles" 
ON public.profiles FOR ALL 
TO authenticated 
USING (
  auth.jwt() ->> 'email' IN ('arslanshaukat@hotmail.com', 'info@gtintl.com.ph')
) 
WITH CHECK (
  auth.jwt() ->> 'email' IN ('arslanshaukat@hotmail.com', 'info@gtintl.com.ph')
);

-- 4. Retry Cleanup (Clean Slate)
-- Delete profiles first to be safe
DELETE FROM public.profiles 
WHERE email NOT IN ('arslanshaukat@hotmail.com', 'info@gtintl.com.ph');

-- Delete auth users (Cascades to profiles usually, but we did profiles first just in case)
DELETE FROM auth.users 
WHERE email NOT IN ('arslanshaukat@hotmail.com', 'info@gtintl.com.ph');