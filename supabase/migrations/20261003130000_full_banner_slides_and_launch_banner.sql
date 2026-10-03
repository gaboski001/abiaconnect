-- Hero slider: "full banner" slides (a designed image shown in full, with a
-- portrait version for phones), plus the official launch & founder's
-- birthday banner, shown first for 24 hours from when this runs.

ALTER TABLE public.hero_slides
  ADD COLUMN IF NOT EXISTS full_image boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mobile_image_url text;

-- Launch & birthday banner (images are served from abiaconnect.com/banners/).
-- order 0 = shown before the welcome slide. Not added twice if re-run.
INSERT INTO public.hero_slides
  (title, subtitle, image_url, mobile_image_url, full_image, cta_label, cta_url, "order", is_active, expires_at)
SELECT
  'Abians, your digital home is open. Happy Birthday, Okechukwu Gabriel E., Founder & CEO, AbiaConnect',
  'Official launch · 3 October 2026',
  'https://abiaconnect.com/banners/launch-birthday-2026-desktop.webp',
  'https://abiaconnect.com/banners/launch-birthday-2026-mobile.webp',
  true,
  'Join free today',
  '/register',
  0,
  true,
  now() + interval '24 hours'
WHERE NOT EXISTS (
  SELECT 1 FROM public.hero_slides WHERE image_url = 'https://abiaconnect.com/banners/launch-birthday-2026-desktop.webp'
);
