-- Snapshot the authenticated contact email for stable Stripe account-creation retries.
-- Existing owner/admin SELECT policy and server-only writes are preserved.
ALTER TABLE public.connect_accounts ADD COLUMN IF NOT EXISTS embedded_contact_email text;
