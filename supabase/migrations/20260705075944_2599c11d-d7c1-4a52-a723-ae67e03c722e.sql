DO $$
BEGIN
  BEGIN
    PERFORM vault.create_secret('5420eafda19fe97e5fc2ed8f58dfab39e887beff183b478a800a891c874ace40', 'push_internal_secret');
  EXCEPTION WHEN unique_violation THEN
    UPDATE vault.secrets SET secret = '5420eafda19fe97e5fc2ed8f58dfab39e887beff183b478a800a891c874ace40' WHERE name = 'push_internal_secret';
  END;
END $$;

CREATE OR REPLACE FUNCTION public.push_on_new_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  fn_url text := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/send-push';
  push_key text;
  v_title text;
BEGIN
  SELECT decrypted_secret INTO push_key
  FROM vault.decrypted_secrets
  WHERE name = 'push_internal_secret';

  IF push_key IS NULL THEN
    RETURN NEW;
  END IF;

  v_title := CASE NEW.type
    WHEN 'reply'   THEN 'New reply'
    WHEN 'vote'    THEN 'New upvote'
    WHEN 'mention' THEN 'You were mentioned'
    WHEN 'message' THEN 'New message'
    WHEN 'system'  THEN 'AbiaConnect'
    ELSE 'AbiaConnect'
  END;

  BEGIN
    PERFORM net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || push_key
      ),
      body := jsonb_build_object(
        'userId',  NEW.user_id,
        'title',   v_title,
        'message', COALESCE(NEW.message, ''),
        'data', jsonb_build_object(
          'url',  COALESCE(NEW.link, '/notifications'),
          'type', NEW.type
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.push_on_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  fn_url text := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/send-push';
  push_key text;
  v_recipient uuid;
  v_user1 uuid;
  v_user2 uuid;
  v_sender_name text;
  v_preview text;
BEGIN
  SELECT decrypted_secret INTO push_key
  FROM vault.decrypted_secrets
  WHERE name = 'push_internal_secret';

  IF push_key IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user1_id, user2_id INTO v_user1, v_user2
  FROM public.conversations WHERE id = NEW.conversation_id;

  IF v_user1 IS NULL THEN
    RETURN NEW;
  END IF;

  v_recipient := CASE WHEN NEW.sender_id = v_user1 THEN v_user2 ELSE v_user1 END;

  IF v_recipient IS NULL OR v_recipient = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, username, 'Someone')
    INTO v_sender_name
  FROM public.profiles WHERE id = NEW.sender_id;

  v_preview := COALESCE(NULLIF(trim(NEW.content), ''), 'Sent an attachment');
  IF length(v_preview) > 140 THEN
    v_preview := substring(v_preview from 1 for 140) || '…';
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || push_key
      ),
      body := jsonb_build_object(
        'userId',  v_recipient,
        'title',   COALESCE(v_sender_name, 'New message'),
        'message', v_preview,
        'data', jsonb_build_object(
          'url',            '/messages/' || NEW.conversation_id::text,
          'type',           'message',
          'conversationId', NEW.conversation_id::text,
          'senderId',       NEW.sender_id::text
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;