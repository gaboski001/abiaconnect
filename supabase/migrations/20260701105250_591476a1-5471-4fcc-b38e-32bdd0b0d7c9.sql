
-- Blocks first (referenced by profile SELECT policy)
CREATE TABLE public.relationship_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, blocked_id),
  CHECK (user_id <> blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.relationship_blocks TO authenticated;
GRANT ALL ON public.relationship_blocks TO service_role;
ALTER TABLE public.relationship_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own blocks"
ON public.relationship_blocks
FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_relationship_blocks_user ON public.relationship_blocks (user_id);
CREATE INDEX idx_relationship_blocks_blocked ON public.relationship_blocks (blocked_id);

-- Profiles
CREATE TABLE public.relationship_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  headline text,
  about text,
  dob date,
  looking_for text CHECK (looking_for IS NULL OR looking_for IN ('friendship','dating','serious','marriage','networking')),
  interests text[] NOT NULL DEFAULT '{}',
  height_cm int CHECK (height_cm IS NULL OR (height_cm BETWEEN 100 AND 250)),
  current_location text,
  occupation text,
  sex text CHECK (sex IS NULL OR sex IN ('male','female','other','prefer_not_to_say')),
  marital_status text CHECK (marital_status IS NULL OR marital_status IN ('single','in_relationship','engaged','married','divorced','widowed','complicated','prefer_not_to_say')),
  lga text,
  photos text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relationship_profiles TO authenticated;
GRANT ALL ON public.relationship_profiles TO service_role;
ALTER TABLE public.relationship_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own relationship profile"
ON public.relationship_profiles
FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authenticated can view active relationship profiles"
ON public.relationship_profiles
FOR SELECT TO authenticated
USING (
  is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.relationship_blocks b
    WHERE b.user_id = relationship_profiles.user_id
      AND b.blocked_id = auth.uid()
  )
);

CREATE INDEX idx_relationship_profiles_active ON public.relationship_profiles (is_active, updated_at DESC);
CREATE INDEX idx_relationship_profiles_lga ON public.relationship_profiles (lga);
CREATE INDEX idx_relationship_profiles_sex ON public.relationship_profiles (sex);

CREATE TRIGGER trg_relationship_profiles_updated_at
BEFORE UPDATE ON public.relationship_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.relationship_profiles;
