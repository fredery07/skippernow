BEGIN;
CREATE TABLE public.mission_invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mission_id uuid NOT NULL REFERENCES public.missions(id),
 professional_id uuid NOT NULL REFERENCES public.profiles(id),
 client_id uuid NOT NULL REFERENCES public.profiles(id),
 object_path text NOT NULL UNIQUE,
 sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
 size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 12 AND 8388608),
 invoice_number text NOT NULL CHECK(length(invoice_number) BETWEEN 1 AND 100),
 issuer_name text NOT NULL CHECK(length(issuer_name) BETWEEN 1 AND 200),
 document_kind text NOT NULL DEFAULT 'invoice' CHECK(document_kind IN ('invoice','credit_note')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(mission_id,sha256)
);
CREATE INDEX mission_invoices_mission_date ON public.mission_invoices(mission_id,created_at DESC);
ALTER TABLE public.mission_invoices ENABLE ROW LEVEL SECURITY;
-- Only the authenticated Edge Function may access document metadata.
REVOKE ALL ON public.mission_invoices FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.mission_invoices TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('provider-invoices','provider-invoices',false,8388608,ARRAY['application/pdf']);
-- Block even pre-existing broad permissive policies for direct browser access.
CREATE POLICY provider_invoices_server_only ON storage.objects AS RESTRICTIVE
FOR ALL TO anon,authenticated USING(bucket_id <> 'provider-invoices') WITH CHECK(bucket_id <> 'provider-invoices');
COMMENT ON TABLE public.mission_invoices IS 'Provider-issued PDFs shared with the mission parties and administrators through mission-documents. Append-only; corrections keep previous copies.';
COMMIT;
