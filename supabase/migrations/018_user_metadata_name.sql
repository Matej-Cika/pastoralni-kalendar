-- Use 'name' from user_metadata when user registers with a name.
-- AuthContext passes options.data.name on signUp, which becomes raw_user_meta_data.name.
-- Previously the trigger only checked full_name (Supabase default), so custom name was ignored.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    CASE
      WHEN NEW.email = 'ivanterze@gmail.com' THEN 'PRIEST'::user_role
      ELSE 'PARISHIONER'::user_role
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
