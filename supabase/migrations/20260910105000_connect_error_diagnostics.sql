-- Only a Stripe error code, parameter name, and request ID; never account/session payloads.
ALTER TABLE public.connect_accounts ADD COLUMN IF NOT EXISTS last_error jsonb;
