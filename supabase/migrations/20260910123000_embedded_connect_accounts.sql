-- Server-owned creation state. No bank details, identity documents or session secrets.
ALTER TABLE public.connect_accounts
  ADD COLUMN IF NOT EXISTS account_api text NOT NULL DEFAULT 'v1' CHECK (account_api IN ('v1','v2')),
  ADD COLUMN IF NOT EXISTS embedded_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS embedded_country text CHECK (embedded_country ~ '^[A-Z]{2}$');
-- Existing SELECT ownership policies remain in place; clients cannot change mappings.
REVOKE INSERT, UPDATE, DELETE ON public.connect_accounts FROM anon, authenticated;
