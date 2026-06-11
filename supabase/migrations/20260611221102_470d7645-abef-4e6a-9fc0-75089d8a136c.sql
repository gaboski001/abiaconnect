
-- 1) Protect anonymous author identity on threads
REVOKE SELECT (author_id) ON public.threads FROM anon, authenticated;

-- 2) Replace permissive WITH CHECK (true) on issue_reports with validated checks
DROP POLICY IF EXISTS "Anyone can submit reports" ON public.issue_reports;

CREATE POLICY "Anyone can submit reports"
ON public.issue_reports
FOR INSERT
TO anon, authenticated
WITH CHECK (
  type IS NOT NULL
  AND length(type) BETWEEN 1 AND 100
  AND description IS NOT NULL
  AND length(description) BETWEEN 20 AND 2000
  AND (page_url IS NULL OR length(page_url) <= 500)
  AND (
    contact_email IS NULL
    OR (
      length(contact_email) <= 255
      AND contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    )
  )
);
