UPDATE public.site_settings
SET value = to_jsonb(replace(value::text, '.png', '.webp'))
WHERE key = 'site_logo' AND value::text LIKE '%ABIALOGO.png%';