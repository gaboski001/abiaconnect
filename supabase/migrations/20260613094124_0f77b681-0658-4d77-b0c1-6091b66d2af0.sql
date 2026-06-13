
DROP FUNCTION IF EXISTS public.get_public_donations(integer);
DROP FUNCTION IF EXISTS public.get_donation_totals();
DROP TABLE IF EXISTS public.donations CASCADE;
DROP TABLE IF EXISTS public.donation_accounts CASCADE;
DELETE FROM public.site_settings WHERE key LIKE 'donation%';
