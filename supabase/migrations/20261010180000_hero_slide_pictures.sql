-- Hero slider: each slide now has a picture that shows what it is about
-- (made by scripts/banners/make_hero_backgrounds.py, served from
-- abiaconnect.com/banners/). The slides' words and buttons are unchanged.
--   "One People. One Voice. One Platform." (Tower! Great)  -> Abia State Tower
--   "Distance Doesn't Divide Us"                            -> in flight above the clouds
-- The welcome slide's picture (Aba Main Park) is set in the website's code.
-- A slide that an admin has already given a picture is left alone.

UPDATE public.hero_slides
   SET image_url = 'https://abiaconnect.com/banners/hero-tower.webp'
 WHERE id = 'dcd443ab-0629-48a2-93fb-7ee1881380ea'
   AND coalesce(image_url, '') = '';

UPDATE public.hero_slides
   SET image_url = 'https://abiaconnect.com/banners/hero-diaspora.webp'
 WHERE id = '772abde1-709a-4084-9f8f-8a71ce6b6890'
   AND coalesce(image_url, '') = '';
