BEGIN;
CREATE TABLE public.payment_receipt_numbers(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 mission_id uuid NOT NULL REFERENCES public.missions(id),
 stripe_charge_id text NOT NULL UNIQUE,
 issued_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_receipt_numbers_mission ON public.payment_receipt_numbers(mission_id);
ALTER TABLE public.payment_receipt_numbers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_receipt_numbers FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.payment_receipt_numbers TO service_role;
REVOKE ALL ON SEQUENCE public.payment_receipt_numbers_id_seq FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE,SELECT ON SEQUENCE public.payment_receipt_numbers_id_seq TO service_role;
COMMENT ON TABLE public.payment_receipt_numbers IS 'Stable unique payment receipt references, not fiscal invoice numbers. Sequence is global and may have gaps; Stripe identifiers remain private.';
COMMIT;
