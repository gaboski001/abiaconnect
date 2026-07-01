
UPDATE public.categories SET display_order = display_order + 1 WHERE display_order >= 2;

INSERT INTO public.categories (name, slug, description, icon, color, is_active, is_popular, display_order, thread_count)
VALUES ('Relationship', 'relationship', 'Meet, connect, and build meaningful relationships with fellow Abians.', '💚', '#D4AF37', true, true, 2, 0);
