
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['messages','replies','threads','notifications','poll_votes']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;
