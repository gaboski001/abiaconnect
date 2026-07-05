ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS native_app_installed_at timestamptz,
  ADD COLUMN IF NOT EXISTS native_app_platform text,
  ADD COLUMN IF NOT EXISTS native_app_version text;