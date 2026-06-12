
CREATE TABLE public.subgroup_membership_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subgroup_id UUID NOT NULL REFERENCES public.subgroups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('joined','duplicate_ignored','left')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX subgroup_membership_audit_user_idx ON public.subgroup_membership_audit(user_id, created_at DESC);
CREATE INDEX subgroup_membership_audit_subgroup_idx ON public.subgroup_membership_audit(subgroup_id, created_at DESC);

GRANT SELECT, INSERT ON public.subgroup_membership_audit TO authenticated;
GRANT ALL ON public.subgroup_membership_audit TO service_role;

ALTER TABLE public.subgroup_membership_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own audit rows"
  ON public.subgroup_membership_audit FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own audit rows"
  ON public.subgroup_membership_audit FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
