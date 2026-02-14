/* # Promote Arslan to Admin
   
   1. Operations
      - Updates the profile for `arslanshaukat@hotmail.com` to have the 'admin' role.
      - This ensures that if the user already exists, they are promoted.
      - New signups are already handled by the existing trigger.
*/

UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'arslanshaukat@hotmail.com';