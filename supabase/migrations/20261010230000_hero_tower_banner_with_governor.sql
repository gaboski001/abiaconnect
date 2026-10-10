-- Hero slider: the Abia Tower banner now carries the present Governor's
-- portrait (from his official website, credited on the banner). New file
-- names, because browsers keep an old picture by its address.
-- Only replaces the earlier tower banner; a picture an admin chose is left alone.

UPDATE public.hero_slides
   SET image_url = 'https://abiaconnect.com/banners/tower-v2-desktop.webp',
       mobile_image_url = 'https://abiaconnect.com/banners/tower-v2-mobile.webp',
       full_image = true
 WHERE id = 'dcd443ab-0629-48a2-93fb-7ee1881380ea'
   AND coalesce(image_url, '') IN (
     '',
     'https://abiaconnect.com/banners/hero-tower.webp',
     'https://abiaconnect.com/banners/tower-desktop.webp'
   );
