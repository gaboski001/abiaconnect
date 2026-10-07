-- Fix: online donations could not be deleted (for example test entries in
-- Admin -> Donations). Deleting a donation unlinks its payment record
-- (donation_id ON DELETE SET NULL), which broke the rule that a donation
-- payment must always point to a donation. The payment record is kept
-- (unlinked) for the books; the rule now only requires a plan for premium
-- payments. New donation payments still always get their donation linked
-- by donation_create_transaction().

ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_purpose_fields;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_purpose_fields
  CHECK (purpose <> 'subscription' OR plan_id IS NOT NULL)
  NOT VALID;
