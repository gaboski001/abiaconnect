-- Google sign-in: Google hands over the person's name as `full_name`, so a
-- member who joins with Google gets their real name on their profile instead
-- of their email address. Email/password sign-up keeps sending `display_name`,
-- so the order below only adds fallbacks. Members who already exist are left
-- exactly as they are.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, username, lga, dob) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NEW.email
    ),
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'lga',
    NULLIF(NEW.raw_user_meta_data->>'dob', '')::date
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'Member')
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;