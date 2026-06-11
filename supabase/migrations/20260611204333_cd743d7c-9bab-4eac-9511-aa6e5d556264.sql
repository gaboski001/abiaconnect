
-- Add thread_count + is_active to categories, and auto-maintain thread_count via trigger.
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS thread_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Backfill thread_count from existing threads
UPDATE public.categories c
SET thread_count = sub.cnt
FROM (
  SELECT category_id, count(*)::int AS cnt
  FROM public.threads
  WHERE category_id IS NOT NULL
  GROUP BY category_id
) sub
WHERE c.id = sub.category_id;

-- Auto-maintain thread_count
CREATE OR REPLACE FUNCTION public.update_category_thread_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.category_id IS NOT NULL THEN
      UPDATE public.categories
        SET thread_count = thread_count + 1, updated_at = now()
        WHERE id = NEW.category_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.category_id IS NOT NULL THEN
      UPDATE public.categories
        SET thread_count = GREATEST(thread_count - 1, 0), updated_at = now()
        WHERE id = OLD.category_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.category_id IS DISTINCT FROM NEW.category_id THEN
      IF OLD.category_id IS NOT NULL THEN
        UPDATE public.categories
          SET thread_count = GREATEST(thread_count - 1, 0), updated_at = now()
          WHERE id = OLD.category_id;
      END IF;
      IF NEW.category_id IS NOT NULL THEN
        UPDATE public.categories
          SET thread_count = thread_count + 1, updated_at = now()
          WHERE id = NEW.category_id;
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS threads_update_category_count ON public.threads;
CREATE TRIGGER threads_update_category_count
  AFTER INSERT OR DELETE OR UPDATE OF category_id ON public.threads
  FOR EACH ROW EXECUTE FUNCTION public.update_category_thread_count();
