ALTER TABLE public.categories ADD CONSTRAINT categories_name_key UNIQUE (name);
ALTER TABLE public.subgroups  ADD CONSTRAINT subgroups_name_key  UNIQUE (name);