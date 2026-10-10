-- Hero slider: two slides become designed banners (made by
-- scripts/banners/make_designed_banners.py, served from abiaconnect.com/banners/),
-- each with a wide picture for computers and a tall one for phones.
--   "One People. One Voice. One Platform." (Tower! Great)  -> the Abia State Tower
--   "Distance Doesn't Divide Us"                            -> the Abia State coat of arms
-- The slides keep their words (now part of the picture, and still read out as
-- the picture's description) and their button's link: the whole banner is the link.
-- A slide that an admin has given a different picture of their own is left alone.

UPDATE public.hero_slides
   SET image_url = 'https://abiaconnect.com/banners/tower-desktop.webp',
       mobile_image_url = 'https://abiaconnect.com/banners/tower-mobile.webp',
       full_image = true
 WHERE id = 'dcd443ab-0629-48a2-93fb-7ee1881380ea'
   AND coalesce(image_url, '') IN ('', 'https://abiaconnect.com/banners/hero-tower.webp');

UPDATE public.hero_slides
   SET image_url = 'https://abiaconnect.com/banners/diaspora-desktop.webp',
       mobile_image_url = 'https://abiaconnect.com/banners/diaspora-mobile.webp',
       full_image = true
 WHERE id = '772abde1-709a-4084-9f8f-8a71ce6b6890'
   AND coalesce(image_url, '') IN ('', 'https://abiaconnect.com/banners/hero-diaspora.webp');
