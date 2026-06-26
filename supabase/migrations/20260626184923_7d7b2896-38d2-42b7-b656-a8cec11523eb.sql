
-- 1) Hide threads.private_author_id from anon/authenticated.
--    Revoke table-level SELECT and re-grant it on every column EXCEPT private_author_id.
--    Other privileges (INSERT/UPDATE/DELETE) stay so RLS keeps governing writes.
REVOKE SELECT ON public.threads FROM anon, authenticated;

GRANT SELECT (
  id, category_id, subgroup_id, user_id, title, content, tags,
  allow_replies, is_anonymous, is_deleted, created_at, updated_at,
  author_id, is_pinned, upvotes, view_count, pinned_at
) ON public.threads TO anon, authenticated;

-- INSERT must list private_author_id because the policy requires
-- private_author_id = auth.uid(); grant it explicitly.
GRANT INSERT (
  id, category_id, subgroup_id, user_id, title, content, tags,
  allow_replies, is_anonymous, is_deleted, created_at, updated_at,
  author_id, is_pinned, upvotes, view_count, private_author_id, pinned_at
) ON public.threads TO authenticated;

GRANT UPDATE (
  category_id, subgroup_id, user_id, title, content, tags,
  allow_replies, is_anonymous, is_deleted, updated_at,
  author_id, is_pinned, upvotes, view_count, pinned_at
) ON public.threads TO authenticated;

GRANT DELETE ON public.threads TO authenticated;
GRANT ALL ON public.threads TO service_role;

-- 2) subgroup_members: block direct self-join into PRIVATE subgroups
--    unless the user has an accepted join request or a valid unused invite.
DROP POLICY IF EXISTS "User joins self" ON public.subgroup_members;

CREATE POLICY "User joins self"
ON public.subgroup_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    -- Public subgroup → direct join allowed
    EXISTS (
      SELECT 1 FROM public.subgroups s
      WHERE s.id = subgroup_members.subgroup_id
        AND COALESCE(s.is_private, false) = false
    )
    -- Admins can always insert
    OR public.is_admin(auth.uid())
    -- Subgroup owner
    OR EXISTS (
      SELECT 1 FROM public.subgroups s
      WHERE s.id = subgroup_members.subgroup_id
        AND s.created_by = auth.uid()
    )
    -- Approved join request for this user+subgroup
    OR EXISTS (
      SELECT 1 FROM public.subgroup_join_requests r
      WHERE r.subgroup_id = subgroup_members.subgroup_id
        AND r.user_id = auth.uid()
        AND r.status = 'approved'
    )
    -- A still-valid invite exists for this subgroup
    OR EXISTS (
      SELECT 1 FROM public.subgroup_invites i
      WHERE i.subgroup_id = subgroup_members.subgroup_id
        AND (i.expires_at IS NULL OR i.expires_at > now())
        AND (i.single_use = false OR i.used = false)
    )
  )
);

-- 3) issue_reports: reduce long-term exposure of contact_email.
--    Auto-purge contact_email from resolved/closed reports older than 90 days.
CREATE OR REPLACE FUNCTION public.prune_issue_report_contact_emails()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.issue_reports
     SET contact_email = NULL
   WHERE contact_email IS NOT NULL
     AND created_at < now() - interval '90 days';
$$;
