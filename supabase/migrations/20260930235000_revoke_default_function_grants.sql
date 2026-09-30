-- Supabase grants EXECUTE on new public functions directly to anon and
-- authenticated (default privileges), so "REVOKE ... FROM PUBLIC" alone does
-- not remove their access. Revoke from those roles explicitly.
-- Only permissions change; no function body or data is modified.

-- ---------------------------------------------------------------------------
-- 1. Email queue wrappers (server/edge-function only). If callable from the
--    API, anyone could read queued auth emails (password-reset / confirmation
--    links), send arbitrary emails from the project, or delete queued mail.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, int, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

-- Pin search_path on these SECURITY DEFINER functions (pgmq calls are
-- already schema-qualified).
ALTER FUNCTION public.read_email_batch(text, int, int) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

-- ---------------------------------------------------------------------------
-- 2. RPCs that only make sense for signed-in users (admin tools, messaging,
--    invites, appeals). They check auth.uid()/is_admin() internally already;
--    this removes logged-out access entirely. Signed-in users keep access.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'admin_delete_user', 'admin_get_user_emails', 'admin_list_users',
        'admin_search_user_ids_by_email', 'get_my_profile', 'mark_message_read',
        'mark_conversation_read', 'my_thread_ids', 'decide_join_request',
        'redeem_subgroup_invite', 'pin_subgroup_thread', 'submit_moderation_appeal',
        'enforce_rate_limit', 'search_public_profiles',
        'clear_conversation', 'delete_conversation', 'delete_message_for_everyone',
        'edit_message', 'forward_message', 'set_conversation_archived',
        'set_conversation_pinned'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END
$$;

-- Server-only helpers from the previous migrations: make sure the direct
-- anon/authenticated grants are gone too.
DO $$
DECLARE
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'resolve_username_to_email', 'email_is_registered', 'enforce_client_rate_limit',
        'create_email_short_link', 'prune_email_short_links',
        'prune_issue_report_contact_emails', 'prune_search_rate_limits'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- 3. Internal tables that are only used through SECURITY DEFINER functions.
--    RLS was on with no policies (already deny-all); state it explicitly so
--    the intent is clear and a future permissive policy can't open them up.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "No direct API access" ON public.client_rate_limits;
CREATE POLICY "No direct API access"
  ON public.client_rate_limits AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No direct API access" ON public.email_short_links;
CREATE POLICY "No direct API access"
  ON public.email_short_links AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
