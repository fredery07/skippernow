-- Run inside a transaction; the caller MUST roll back. No committed fixtures.
SELECT set_config('test.client',client_id::text,true),set_config('test.pro',coalesce(skipper_id,provider_id)::text,true) FROM public.missions WHERE coalesce(skipper_id,provider_id) IS NOT NULL LIMIT 1;
SELECT set_config('test.mission',gen_random_uuid()::text,true);
INSERT INTO public.missions(id,client_id,provider_id,port,status,payment_status,amount_cents,urgent_fee_cents,currency,boat_type,starts_at,ends_at)
VALUES(current_setting('test.mission')::uuid,current_setting('test.client')::uuid,current_setting('test.pro')::uuid,'TEST ROLLBACK','pending','unpaid',0,0,'eur','TEST',now()+interval '1 day',now()+interval '2 days');
SELECT set_config('request.jwt.claim.sub',current_setting('test.client'),true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    UPDATE public.missions SET payment_status='paid' WHERE id=current_setting('test.mission')::uuid;
    RAISE EXCEPTION 'TEST_FAILED: client forged payment';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST_FAILED:%' THEN RAISE; END IF; END;
  BEGIN
    INSERT INTO public.reviews(mission_id,client_id,skipper_id,rating) VALUES(current_setting('test.mission')::uuid,auth.uid(),current_setting('test.pro')::uuid,5);
    RAISE EXCEPTION 'TEST_FAILED: review before completion';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('test.pro'),true);
SET LOCAL ROLE authenticated;
UPDATE public.missions SET status='quoted',amount_cents=10000 WHERE id=current_setting('test.mission')::uuid;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('test.client'),true);
SET LOCAL ROLE authenticated;
UPDATE public.missions SET status='accepted' WHERE id=current_setting('test.mission')::uuid;
DO $$ BEGIN
  BEGIN
    UPDATE public.missions SET amount_cents=1 WHERE id=current_setting('test.mission')::uuid;
    RAISE EXCEPTION 'TEST_FAILED: accepted price changed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST_FAILED:%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE public.missions SET status='in_progress',payment_status='paid',stripe_payment_intent_id='pi_fixture' WHERE id=current_setting('test.mission')::uuid;
SELECT set_config('request.jwt.claim.sub',current_setting('test.pro'),true);
SET LOCAL ROLE authenticated;
UPDATE public.missions SET status='awaiting_validation' WHERE id=current_setting('test.mission')::uuid;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('test.client'),true);
SET LOCAL ROLE authenticated;
UPDATE public.missions SET status='completed' WHERE id=current_setting('test.mission')::uuid;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.missions WHERE id=current_setting('test.mission')::uuid AND status='completed' AND validated_at IS NOT NULL) THEN RAISE EXCEPTION 'TEST_FAILED: flow incomplete'; END IF;
  BEGIN
    INSERT INTO public.reviews(mission_id,client_id,skipper_id,rating) VALUES(current_setting('test.mission')::uuid,auth.uid(),auth.uid(),5);
    RAISE EXCEPTION 'TEST_FAILED: wrong review target';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
INSERT INTO public.reviews(mission_id,client_id,skipper_id,rating,comment) VALUES(current_setting('test.mission')::uuid,auth.uid(),current_setting('test.pro')::uuid,5,'TEST ROLLBACK');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.reviews(mission_id,client_id,skipper_id,rating) VALUES(current_setting('test.mission')::uuid,auth.uid(),current_setting('test.pro')::uuid,5);
    RAISE EXCEPTION 'TEST_FAILED: duplicate review';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
RESET ROLE;
SELECT 'PASS: provider quote, client acceptance, protected price/payment, provider completion, client validation, eligible unique review' AS result;
