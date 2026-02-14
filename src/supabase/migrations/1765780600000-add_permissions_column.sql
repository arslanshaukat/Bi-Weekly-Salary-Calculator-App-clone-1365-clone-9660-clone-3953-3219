/* # Add Permissions Column to Profiles
   
   1. Schema Changes
      - Add `permissions` (jsonb) column to `public.profiles` table.
      - Default value is an empty object `{}`.
   
   2. Purpose
      - Stores granular access rights for users (e.g., {"can_delete": true}).
      - Allows admins to define limitations for specific users.
*/

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.permissions IS 'JSON object storing granular permissions (e.g., can_delete_employees, can_manage_payroll)';