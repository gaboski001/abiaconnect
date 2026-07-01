
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_location text,
  ADD COLUMN IF NOT EXISTS occupation text,
  ADD COLUMN IF NOT EXISTS sex text,
  ADD COLUMN IF NOT EXISTS marital_status text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_sex_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_sex_check
    CHECK (sex IS NULL OR sex IN ('male','female','other','prefer_not_to_say'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_marital_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_marital_status_check
    CHECK (marital_status IS NULL OR marital_status IN ('single','married','in_relationship','engaged','divorced','widowed','separated','prefer_not_to_say'));
