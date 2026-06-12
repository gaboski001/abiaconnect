
CREATE INDEX IF NOT EXISTS idx_sgr_created ON public.subgroup_join_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sgi_created ON public.subgroup_invites(created_at DESC);
