-- WhatsApp updates: a member's WhatsApp number and their permission.
--
-- A member adds the number in Dashboard -> Settings -> Notifications and
-- ticks "Send me WhatsApp updates". A row here means the member has agreed;
-- removing the number deletes the row and withdraws the permission.
--
-- The number is kept out of the profiles table on purpose: profiles can be
-- read by other members, and a phone number must never be. Here each member
-- can see and change only their own row. Nothing is sent yet; the sender
-- (service role) will read this table once WhatsApp sending is set up.

CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- International format: + and the country code, digits only (+2348012345678).
  phone       text NOT NULL CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
  opted_in_at timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_contacts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_contacts TO authenticated;

DROP POLICY IF EXISTS "Members manage their own WhatsApp number" ON public.whatsapp_contacts;
CREATE POLICY "Members manage their own WhatsApp number"
  ON public.whatsapp_contacts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- The dates are set by the database, whatever the app sends: the permission
-- date is renewed only when the number itself changes.
CREATE OR REPLACE FUNCTION public.whatsapp_contacts_stamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' OR NEW.phone IS DISTINCT FROM OLD.phone THEN
    NEW.opted_in_at := now();
  ELSE
    NEW.opted_in_at := OLD.opted_in_at;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS whatsapp_contacts_stamp ON public.whatsapp_contacts;
CREATE TRIGGER whatsapp_contacts_stamp
  BEFORE INSERT OR UPDATE ON public.whatsapp_contacts
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_contacts_stamp();
