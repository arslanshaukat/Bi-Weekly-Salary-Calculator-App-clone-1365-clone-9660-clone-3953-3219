/* # Fix Profiles Schema - Add Missing Columns
   
   1. Purpose
      - Resolve error: "column profiles.full_name does not exist".
      - Ensure table structure is compatible with the User Management code.
   
   2. Changes
      - Safely add `full_name` column if missing.
      - Safely add `permissions` and `role` columns if missing.
      - Update existing admin records to have a display name.
*/

DO $$ 
BEGIN 
  -- 1. Add full_name if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'full_name') THEN 
    ALTER TABLE public.profiles ADD COLUMN full_name text;
  END IF;

  -- 2. Add permissions if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'permissions') THEN 
    ALTER TABLE public.profiles ADD COLUMN permissions jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- 3. Add role if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN 
    ALTER TABLE public.profiles ADD COLUMN role text DEFAULT 'user';
  END IF;
END $$;

-- 4. Backfill data for critical admins to ensure the UI looks good
UPDATE public.profiles 
SET full_name = 'Arslan Shaukat' 
WHERE email = 'arslanshaukat@hotmail.com' AND (full_name IS NULL OR full_name = '');

UPDATE public.profiles 
SET full_name = 'GT Admin' 
WHERE email = 'info@gtintl.com.ph' AND (full_name IS NULL OR full_name = '');