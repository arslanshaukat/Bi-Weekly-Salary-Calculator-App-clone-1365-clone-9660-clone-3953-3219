/* # Force Policy Reset (Dynamic)
   
   1. Dynamic Cleanup
      - Uses a PL/pgSQL loop to find and DROP ALL policies on the `profiles` table.
      - This guarantees no "zombie" recursive policies remain, regardless of their name.
   
   2. Secure Function
      - Re-defines `is_admin()` with `SECURITY DEFINER` and specific search path.
      - Adds null check for `auth.uid()`.
   
   3. Simplified Policies
      - Re-applies the strict, non-recursive policies for SELECT, INSERT, UPDATE.
      - Includes the Super Admin bypass using JWT claims (no DB access).
*/

-- 1. Dynamic Drop of ALL Policies on 'profiles'
DO $$ 
DECLARE 
  pol record;
BEGIN 
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' 
  LOOP 
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname); 
  END LOOP; 
END $$;

-- 2. Reset Admin Check Function (Security Definer)
-- We drop it after policies are gone to avoid dependency errors
DROP FUNCTION IF EXISTS public.is_admin();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- Safety check
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- Privileged check (Bypasses RLS)
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- 3. Re-Enable RLS (Just in case)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create Safe Policies

-- SELECT: Public read access for authenticated users
-- "USING (true)" is a constant, preventing any recursion.
CREATE POLICY "profiles_select_policy" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);

-- INSERT: Users can create their own profile
CREATE POLICY "profiles_insert_policy" 
ON public.profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- UPDATE (Self): Users can update their own profile
CREATE POLICY "profiles_update_self_policy" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

-- UPDATE (Admin): Admins can update ANY profile
-- Uses the SECURITY DEFINER function to avoid recursion
CREATE POLICY "profiles_update_admin_policy" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (public.is_admin());

-- SUPER ADMIN BYPASS (Hardcoded Emails)
-- This allows the specific emails to perform ALL actions (DELETE, etc)
-- It uses JWT claims, so it never touches the database (Zero Recursion Risk)
CREATE POLICY "profiles_super_admin_policy" 
ON public.profiles FOR ALL 
TO authenticated 
USING (
  auth.jwt() ->> 'email' IN ('arslanshaukat@hotmail.com', 'info@gtintl.com.ph')
) 
WITH CHECK (
  auth.jwt() ->> 'email' IN ('arslanshaukat@hotmail.com', 'info@gtintl.com.ph')
);

-- 5. Ensure Permissions Column Exists (Self-Healing)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'permissions') THEN 
    ALTER TABLE public.profiles ADD COLUMN permissions jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;