
ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

CREATE INDEX IF NOT EXISTS threads_subgroup_pinned_idx
  ON public.threads (subgroup_id, is_pinned, pinned_at DESC)
  WHERE subgroup_id IS NOT NULL;

-- Is _user_id allowed to administer _subgroup_id?
CREATE OR REPLACE FUNCTION public.is_subgroup_admin(_subgroup_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.subgroups s
      WHERE s.id = _subgroup_id AND s.created_by = _user_id
    )
$$;
REVOKE ALL ON FUNCTION public.is_subgroup_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_subgroup_admin(uuid, uuid) TO authenticated, service_role;

-- Pin / unpin a thread inside a subgroup, enforcing max 3 pinned.
CREATE OR REPLACE FUNCTION public.pin_subgroup_thread(_thread_id uuid, _pinned boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subgroup uuid;
  v_count integer;
BEGIN
  SELECT subgroup_id INTO v_subgroup FROM public.threads WHERE id = _thread_id;
  IF v_subgroup IS NULL THEN
    RAISE EXCEPTION 'Thread is not in a subgroup';
  END IF;
  IF NOT public.is_subgroup_admin(v_subgroup, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to pin threads in this subgroup';
  END IF;
  IF _pinned THEN
    SELECT count(*) INTO v_count
    FROM public.threads
    WHERE subgroup_id = v_subgroup AND is_pinned = true AND id <> _thread_id;
    IF v_count >= 3 THEN
      RAISE EXCEPTION 'Pin limit reached (3 max). Unpin one first.';
    END IF;
    UPDATE public.threads
      SET is_pinned = true, pinned_at = now()
      WHERE id = _thread_id;
  ELSE
    UPDATE public.threads
      SET is_pinned = false, pinned_at = NULL
      WHERE id = _thread_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.pin_subgroup_thread(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pin_subgroup_thread(uuid, boolean) TO authenticated, service_role;
