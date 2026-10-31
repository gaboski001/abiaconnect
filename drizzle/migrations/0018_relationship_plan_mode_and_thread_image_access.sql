CREATE TABLE public.relationship_access_settings (
  id boolean PRIMARY KEY DEFAULT true CONSTRAINT relationship_access_singleton CHECK (id),
  plans_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.relationship_access_settings TO authenticated;
GRANT ALL ON public.relationship_access_settings TO service_role;
ALTER TABLE public.relationship_access_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read relationship access settings" ON public.relationship_access_settings FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.relationship_plans_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT plans_enabled FROM public.relationship_access_settings WHERE id = true), true) $$;
REVOKE ALL ON FUNCTION public.relationship_plans_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relationship_plans_enabled() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_relationship_plan_mode(_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE old_mode boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501'; END IF;
  IF _enabled IS NULL THEN RAISE EXCEPTION 'Choose on or off' USING ERRCODE = '22023'; END IF;
  old_mode := public.relationship_plans_enabled();
  INSERT INTO public.relationship_access_settings (id, plans_enabled, updated_at, updated_by)
  VALUES (true, _enabled, now(), auth.uid())
  ON CONFLICT (id) DO UPDATE SET plans_enabled = EXCLUDED.plans_enabled, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;
  INSERT INTO public.monetization_audit_log (actor_id, action, target, old_value, new_value)
  VALUES (auth.uid(), 'relationship.plan_mode', 'all_members', jsonb_build_object('enabled', old_mode), jsonb_build_object('enabled', _enabled));
END $$;
REVOKE ALL ON FUNCTION public.admin_set_relationship_plan_mode(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_relationship_plan_mode(boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dating_current_plan(_uid uuid)
RETURNS public.subscription_plans LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE result public.subscription_plans;
BEGIN
  SELECT p.* INTO result FROM public.subscription_plans p
  WHERE p.code = 'free' OR p.id IN (
    SELECT s.plan_id FROM public.user_subscriptions s
    WHERE s.user_id = _uid AND s.status = 'active' AND now() >= s.starts_at AND now() < s.ends_at
  ) ORDER BY (p.code <> 'free') DESC, p.sort_order DESC LIMIT 1;
  IF _uid IS NOT NULL AND NOT public.relationship_plans_enabled() THEN
    result.id := NULL;
    result.code := 'community_premium';
    result.name := 'Community Premium';
    result.tier := 'premium';
    result.limits := jsonb_build_object('daily_likes', NULL, 'see_likes', true, 'likes_you_preview', 0,
      'advanced_filters', true, 'premium_badge', true, 'remove_ads', true,
      'message_without_match', true, 'send_before_reply', true);
  END IF;
  RETURN result;
END $$;

CREATE POLICY "Read attachments of visible threads and replies" ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'thread-attachments' AND (
    EXISTS (SELECT 1 FROM public.threads t WHERE
      strpos(t.content, 'thread-attachments/' || storage.objects.name || '?') > 0 OR
      strpos(t.content, 'thread-attachments/' || storage.objects.name || '"') > 0)
    OR EXISTS (SELECT 1 FROM public.replies r WHERE
      strpos(r.content, 'thread-attachments/' || storage.objects.name || '?') > 0 OR
      strpos(r.content, 'thread-attachments/' || storage.objects.name || '"') > 0)
  )
);
