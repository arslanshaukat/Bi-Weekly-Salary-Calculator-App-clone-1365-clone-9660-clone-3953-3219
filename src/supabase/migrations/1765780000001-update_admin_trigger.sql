/*
# Update Admin Trigger for Secondary Admin
1. Changes
   - Update `handle_new_user` function to include 'info@gtintl.com.ph'
   - Requires recreating the function with the new logic
   - Ensures both 'arslanshaukat@hotmail.com' and 'info@gtintl.com.ph' get admin roles automatically
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    CASE
      WHEN new.email IN ('arslanshaukat@hotmail.com', 'info@gtintl.com.ph') THEN 'admin'
      ELSE 'user'
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;