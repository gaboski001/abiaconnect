ALTER TABLE public.payment_transactions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_user_id_fkey;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_purpose_check;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_purpose_check CHECK (purpose IN ('subscription', 'donation'));

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS donation_id uuid REFERENCES public.donations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS payment_transactions_donation_idx ON public.payment_transactions (donation_id)
  WHERE donation_id IS NOT NULL;

ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_purpose_fields;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_purpose_fields
  CHECK ((purpose = 'subscription' AND plan_id IS NOT NULL) OR (purpose = 'donation' AND donation_id IS NOT NULL))
  NOT VALID;

CREATE OR REPLACE FUNCTION public.donation_create_transaction(
  _provider text,
  _amount_minor bigint,
  _currency text,
  _donor_name text,
  _donor_email text,
  _message text,
  _is_anonymous boolean,
  _user uuid DEFAULT NULL
)
RETURNS public.payment_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prov public.payment_providers;
  v_tx public.payment_transactions;
  v_donation_id uuid;
  v_ref text;
  v_name text := btrim(coalesce(_donor_name, ''));
  v_email text := lower(btrim(coalesce(_donor_email, '')));
BEGIN
  SELECT * INTO v_prov FROM public.payment_providers WHERE provider = _provider AND is_enabled;
  IF NOT FOUND THEN RAISE EXCEPTION 'provider_unavailable' USING ERRCODE = 'P0001'; END IF;
  IF upper(coalesce(_currency, '')) <> 'NGN' THEN RAISE EXCEPTION 'currency_unsupported' USING ERRCODE = 'P0001'; END IF;
  IF _amount_minor IS NULL OR _amount_minor < 10000 OR _amount_minor > 1000000000 THEN
    RAISE EXCEPTION 'amount_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 80 THEN RAISE EXCEPTION 'name_invalid' USING ERRCODE = 'P0001'; END IF;
  IF length(v_email) > 255 OR v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' THEN
    RAISE EXCEPTION 'email_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF length(coalesce(_message, '')) > 500 THEN RAISE EXCEPTION 'message_too_long' USING ERRCODE = 'P0001'; END IF;
  IF (SELECT count(*) FROM public.donations d
       WHERE lower(d.donor_email) = v_email AND d.status = 'pending'
         AND d.payment_method IN ('paystack', 'monnify', 'squad')
         AND d.created_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'too_many_checkouts' USING ERRCODE = 'P0001';
  END IF;

  v_ref := 'ABIAD' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 23));

  INSERT INTO public.donations
    (donor_name, donor_email, amount, currency, message, is_anonymous, payment_method, reference, status, created_by)
  VALUES
    (v_name, v_email, round(_amount_minor / 100.0, 2), 'NGN', NULLIF(btrim(coalesce(_message, '')), ''),
     coalesce(_is_anonymous, false), _provider, v_ref, 'pending', _user)
  RETURNING id INTO v_donation_id;

  INSERT INTO public.payment_transactions
    (user_id, provider, reference, purpose, donation_id, amount_minor, currency, mode)
  VALUES
    (_user, _provider, v_ref, 'donation', v_donation_id, _amount_minor, 'NGN', v_prov.mode)
  RETURNING * INTO v_tx;

  PERFORM public.log_monetization_event(_user, 'DONATION_CHECKOUT_STARTED',
    jsonb_build_object('provider', _provider, 'reference', v_ref, 'amount_minor', _amount_minor));
  RETURN v_tx;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.donation_create_transaction(text, bigint, text, text, text, text, boolean, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.donation_create_transaction(text, bigint, text, text, text, text, boolean, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.payment_apply_result(
  _provider text,
  _reference text,
  _status text,
  _paid_minor bigint,
  _currency text,
  _provider_reference text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx public.payment_transactions;
  v_plan public.subscription_plans;
  v_start timestamptz;
  v_sub_id uuid;
BEGIN
  IF _status NOT IN ('success', 'failed', 'abandoned') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_tx FROM public.payment_transactions
  WHERE reference = _reference AND provider = _provider
  FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown_reference'; END IF;

  IF v_tx.status = 'success' THEN RETURN 'already_fulfilled'; END IF;
  IF v_tx.status IN ('refunded', 'amount_mismatch') THEN RETURN 'ignored_' || v_tx.status; END IF;

  IF _status <> 'success' THEN
    IF v_tx.status = 'pending' THEN
      UPDATE public.payment_transactions
         SET status = _status, verified_at = now(), failure_reason = _status,
             provider_reference = COALESCE(provider_reference, _provider_reference)
       WHERE id = v_tx.id;
      IF v_tx.purpose = 'donation' THEN
        UPDATE public.donations
           SET status = 'rejected', admin_notes = format('Online payment %s', _status)
         WHERE id = v_tx.donation_id AND status = 'pending';
      END IF;
      PERFORM public.log_monetization_event(v_tx.user_id, 'PAYMENT_FAILED',
        jsonb_build_object('reference', v_tx.reference, 'provider', _provider, 'status', _status));
    END IF;
    RETURN 'marked_' || _status;
  END IF;

  IF _paid_minor IS NULL OR _paid_minor < v_tx.amount_minor OR upper(COALESCE(_currency, '')) <> upper(v_tx.currency) THEN
    UPDATE public.payment_transactions
       SET status = 'amount_mismatch', verified_at = now(),
           failure_reason = format('paid %s %s, expected %s %s', _paid_minor, _currency, v_tx.amount_minor, v_tx.currency)
     WHERE id = v_tx.id;
    IF v_tx.purpose = 'donation' THEN
      UPDATE public.donations
         SET admin_notes = format('Amount mismatch: paid %s %s, expected %s %s. Check before confirming.',
                                  _paid_minor, _currency, v_tx.amount_minor, v_tx.currency)
       WHERE id = v_tx.donation_id;
    END IF;
    PERFORM public.log_monetization_event(v_tx.user_id, 'PAYMENT_AMOUNT_MISMATCH',
      jsonb_build_object('reference', v_tx.reference, 'provider', _provider));
    RETURN 'amount_mismatch';
  END IF;

  IF v_tx.purpose = 'donation' THEN
    UPDATE public.payment_transactions
       SET status = 'success', verified_at = now(),
           provider_reference = COALESCE(provider_reference, _provider_reference)
     WHERE id = v_tx.id;
    UPDATE public.donations
       SET status = 'confirmed', confirmed_at = now(),
           admin_notes = COALESCE(admin_notes, format('Paid online via %s', _provider))
     WHERE id = v_tx.donation_id;
    PERFORM public.log_monetization_event(v_tx.user_id, 'DONATION_SUCCESS',
      jsonb_build_object('reference', v_tx.reference, 'provider', _provider, 'amount_minor', v_tx.amount_minor));
    IF v_tx.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, message, link)
      VALUES (v_tx.user_id, 'payment_success',
              format('Thank you! Your donation of NGN %s to AbiaConnect was received.',
                     to_char(v_tx.amount_minor / 100.0, 'FM999,999,999,990.00')),
              '/donate');
    END IF;
    RETURN 'fulfilled';
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_tx.plan_id;

  SELECT GREATEST(now(), COALESCE(max(s.ends_at), now())) INTO v_start
  FROM public.user_subscriptions s
  WHERE s.user_id = v_tx.user_id AND s.plan_id = v_plan.id AND s.status = 'active' AND s.ends_at > now();

  UPDATE public.payment_transactions
     SET status = 'success', verified_at = now(),
         provider_reference = COALESCE(provider_reference, _provider_reference)
   WHERE id = v_tx.id;

  IF v_tx.user_id IS NULL THEN
    RETURN 'fulfilled_no_account';
  END IF;

  INSERT INTO public.user_subscriptions (user_id, plan_id, status, source, payment_id, starts_at, ends_at)
  VALUES (v_tx.user_id, v_plan.id, 'active', 'payment', v_tx.id, v_start,
          v_start + make_interval(days => v_plan.duration_days))
  RETURNING id INTO v_sub_id;

  PERFORM public.log_monetization_event(v_tx.user_id, 'PAYMENT_SUCCESS',
    jsonb_build_object('reference', v_tx.reference, 'provider', _provider, 'amount_minor', v_tx.amount_minor, 'currency', v_tx.currency));
  PERFORM public.log_monetization_event(v_tx.user_id, 'SUBSCRIPTION_STARTED',
    jsonb_build_object('plan', v_plan.code, 'subscription_id', v_sub_id));
  INSERT INTO public.notifications (user_id, type, message, link)
  VALUES (v_tx.user_id, 'payment_success',
          format('Payment successful. Your %s benefits are now active.', v_plan.name), '/relationship/premium');
  RETURN 'fulfilled';
END;
$$;

CREATE OR REPLACE FUNCTION public.payment_apply_refund(_provider text, _ref text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx public.payment_transactions;
BEGIN
  SELECT * INTO v_tx FROM public.payment_transactions
  WHERE provider = _provider AND (reference = _ref OR provider_reference = _ref)
  FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown_reference'; END IF;
  IF v_tx.status = 'refunded' THEN RETURN 'already_refunded'; END IF;
  IF v_tx.status <> 'success' THEN RETURN 'ignored_' || v_tx.status; END IF;

  UPDATE public.payment_transactions SET status = 'refunded', refunded_at = now() WHERE id = v_tx.id;

  IF v_tx.purpose = 'donation' THEN
    UPDATE public.donations SET status = 'rejected', admin_notes = 'Refunded by provider' WHERE id = v_tx.donation_id;
  ELSE
    UPDATE public.user_subscriptions SET status = 'refunded', note = 'Refunded by provider'
     WHERE payment_id = v_tx.id AND status = 'active';
  END IF;

  PERFORM public.log_monetization_event(v_tx.user_id, 'REFUND_ISSUED',
    jsonb_build_object('reference', v_tx.reference, 'provider', _provider, 'purpose', v_tx.purpose));
  IF v_tx.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (v_tx.user_id, 'payment_refund',
            CASE WHEN v_tx.purpose = 'donation'
                 THEN 'Your donation was refunded.'
                 ELSE 'Your payment was refunded and the related benefits have ended.' END,
            CASE WHEN v_tx.purpose = 'donation' THEN '/donate' ELSE '/relationship/premium' END);
  END IF;
  RETURN 'refunded';
END;
$$;