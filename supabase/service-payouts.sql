-- Apply transactionally. Existing completed missions are NOT enrolled retroactively.
BEGIN;
CREATE TABLE public.service_completions (
  mission_id uuid PRIMARY KEY REFERENCES public.missions(id),
  professional_id uuid NOT NULL REFERENCES public.profiles(id),
  photo_path text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL DEFAULT (now() + interval '120 hours'),
  held boolean NOT NULL DEFAULT false,
  hold_reason text,
  CHECK (due_at >= submitted_at + interval '120 hours')
);
CREATE TABLE public.connect_accounts (
  professional_id uuid PRIMARY KEY REFERENCES public.profiles(id),
  account_id text UNIQUE,
  creation_key uuid NOT NULL DEFAULT gen_random_uuid(),
  creation_started_at timestamptz,
  ready boolean NOT NULL DEFAULT false,
  checked_at timestamptz
);
CREATE TABLE public.service_payouts (
  mission_id uuid PRIMARY KEY REFERENCES public.missions(id),
  professional_id uuid NOT NULL REFERENCES public.profiles(id),
  destination text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL,
  state text NOT NULL CHECK(state IN ('processing','transferred','uncertain')),
  transfer_id text UNIQUE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error text,
  initiated_by uuid,
  automatic boolean NOT NULL
);
CREATE TABLE public.service_payout_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  enabled boolean NOT NULL DEFAULT false,
  worker_hash text
);
INSERT INTO public.service_payout_settings(id) VALUES(true);
ALTER TABLE public.service_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_payout_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.service_completions,public.connect_accounts,public.service_payouts,public.service_payout_settings FROM anon,authenticated;
GRANT SELECT ON public.service_completions,public.connect_accounts,public.service_payouts TO authenticated;
GRANT SELECT(id,enabled) ON public.service_payout_settings TO authenticated;
GRANT ALL ON public.service_completions,public.connect_accounts,public.service_payouts,public.service_payout_settings TO service_role;
CREATE POLICY completion_parties_read ON public.service_completions FOR SELECT TO authenticated USING (
  professional_id=(select auth.uid()) OR public.is_admin() OR EXISTS(SELECT 1 FROM public.missions m WHERE m.id=mission_id AND m.client_id=(select auth.uid()))
);
CREATE POLICY connect_owner_read ON public.connect_accounts FOR SELECT TO authenticated USING (professional_id=(select auth.uid()) OR public.is_admin());
CREATE POLICY payout_parties_read ON public.service_payouts FOR SELECT TO authenticated USING (
  professional_id=(select auth.uid()) OR public.is_admin() OR EXISTS(SELECT 1 FROM public.missions m WHERE m.id=mission_id AND m.client_id=(select auth.uid()))
);
CREATE POLICY payout_settings_read ON public.service_payout_settings FOR SELECT TO authenticated USING(true);
CREATE INDEX service_completion_due ON public.service_completions(due_at) WHERE NOT held;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('completion-proofs','completion-proofs',false,8388608,ARRAY['image/jpeg','image/png','image/webp']);
-- No direct object policies: upload and short-lived viewing links use the
-- authenticated edge endpoint after it checks the mission parties.

CREATE FUNCTION public.protect_profile_authority() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  IF current_user NOT IN ('anon','authenticated') THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.role='admin' OR coalesce(NEW.verified,false) OR NEW.stripe_account_id IS NOT NULL THEN
      RAISE EXCEPTION 'Profil initial non autorisé';
    END IF;
  ELSIF NOT public.is_admin() AND (
    NEW.role IS DISTINCT FROM OLD.role OR NEW.verified IS DISTINCT FROM OLD.verified
    OR NEW.suspended IS DISTINCT FROM OLD.suspended
    OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
    OR NEW.stripe_onboarding_complete IS DISTINCT FROM OLD.stripe_onboarding_complete) THEN
    RAISE EXCEPTION 'Modification réservée à l’administration';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_profile_authority BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_authority();

CREATE FUNCTION public.protect_service_payout() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.payment_status <> 'unpaid' OR EXISTS(SELECT 1 FROM public.service_completions WHERE mission_id=OLD.id) THEN
      RAISE EXCEPTION 'Mission financière à conserver';
    END IF;
    RETURN OLD;
  END IF;
  -- Neither a user nor an admin may declare a fictitious Stripe transfer.
  IF current_user IN ('anon','authenticated') THEN
    IF NEW.stripe_transfer_id IS DISTINCT FROM OLD.stripe_transfer_id
       OR NEW.transferred_at IS DISTINCT FROM OLD.transferred_at
       OR (NEW.payment_status='transferred' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status)
       OR (OLD.status NOT IN ('pending','searching') AND NEW.platform_fee_cents IS DISTINCT FROM OLD.platform_fee_cents) THEN
      RAISE EXCEPTION 'Versement et commission réservés au serveur';
    END IF;
    IF NEW.status='awaiting_validation' AND OLD.status IS DISTINCT FROM NEW.status THEN
      RAISE EXCEPTION 'Utilisez la confirmation avec photo';
    END IF;
    IF NOT public.is_admin() AND OLD.dispute_status='open' AND NEW.dispute_status IS DISTINCT FROM 'open' THEN
      RAISE EXCEPTION 'Seule l’administration clôture un litige';
    END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM public.service_payouts WHERE mission_id=OLD.id) AND (
    NEW.amount_cents IS DISTINCT FROM OLD.amount_cents OR NEW.urgent_fee_cents IS DISTINCT FROM OLD.urgent_fee_cents
    OR NEW.platform_fee_cents IS DISTINCT FROM OLD.platform_fee_cents OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.provider_id IS DISTINCT FROM OLD.provider_id OR NEW.skipper_id IS DISTINCT FROM OLD.skipper_id) THEN
    RAISE EXCEPTION 'Versement déjà engagé : montant et destinataire figés';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_service_payout BEFORE UPDATE OR DELETE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.protect_service_payout();

CREATE FUNCTION public.submit_service_completion(p_mission uuid,p_actor uuid,p_photo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE m public.missions; c public.service_completions;
BEGIN
  SELECT * INTO m FROM public.missions WHERE id=p_mission FOR UPDATE;
  IF NOT FOUND OR p_actor IS DISTINCT FROM coalesce(m.provider_id,m.skipper_id) THEN RAISE EXCEPTION 'Mission non autorisée'; END IF;
  SELECT * INTO c FROM public.service_completions WHERE mission_id=m.id;
  IF FOUND THEN RETURN to_jsonb(c); END IF;
  IF m.status <> 'in_progress' OR m.payment_status <> 'paid' OR m.dispute_status='open' THEN RAISE EXCEPTION 'Mission non éligible'; END IF;
  IF p_photo NOT LIKE m.id::text || '/%' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='completion-proofs' AND name=p_photo) THEN RAISE EXCEPTION 'Photo requise'; END IF;
  INSERT INTO public.service_completions(mission_id,professional_id,photo_path) VALUES(m.id,p_actor,p_photo) RETURNING * INTO c;
  UPDATE public.missions SET status='awaiting_validation' WHERE id=m.id;
  RETURN to_jsonb(c);
END $$;

CREATE FUNCTION public.claim_service_payout(p_mission uuid,p_actor uuid,p_automatic boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE m public.missions; c public.service_completions; a public.connect_accounts; j public.service_payouts; n integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.service_payout_settings WHERE enabled) THEN RAISE EXCEPTION 'Versements non activés'; END IF;
  IF NOT p_automatic AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role='admin' AND NOT coalesce(suspended,false)) THEN RAISE EXCEPTION 'Administrateur requis'; END IF;
  SELECT * INTO m FROM public.missions WHERE id=p_mission FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mission introuvable'; END IF;
  IF EXISTS(SELECT 1 FROM public.service_payouts WHERE mission_id=m.id) THEN RETURN jsonb_build_object('claimed',false); END IF;
  SELECT * INTO c FROM public.service_completions WHERE mission_id=m.id FOR UPDATE;
  IF NOT FOUND OR c.held OR c.professional_id IS DISTINCT FROM coalesce(m.provider_id,m.skipper_id)
    OR (p_automatic AND c.due_at>now()) THEN RAISE EXCEPTION 'Photo, délai ou blocage à vérifier'; END IF;
  IF m.payment_status NOT IN ('paid','payout_ready') OR m.status NOT IN ('awaiting_validation','completed')
    OR m.dispute_status='open' OR m.stripe_transfer_id IS NOT NULL OR m.stripe_payment_intent_id IS NULL THEN RAISE EXCEPTION 'Paiement non éligible'; END IF;
  SELECT * INTO a FROM public.connect_accounts WHERE professional_id=c.professional_id;
  IF NOT FOUND OR a.account_id IS NULL OR NOT a.ready THEN RAISE EXCEPTION 'Compte Stripe à configurer'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=c.professional_id AND verified AND NOT coalesce(suspended,false)) THEN RAISE EXCEPTION 'Profil non éligible'; END IF;
  n:=coalesce(m.amount_cents,0)+coalesce(m.urgent_fee_cents,0)-coalesce(m.platform_fee_cents,0);
  IF n<=0 OR coalesce(m.platform_fee_cents,0)<0 THEN RAISE EXCEPTION 'Montant invalide'; END IF;
  INSERT INTO public.service_payouts(mission_id,professional_id,destination,amount_cents,currency,state,initiated_by,automatic)
  VALUES(m.id,c.professional_id,a.account_id,n,lower(coalesce(m.currency,'eur')),'processing',p_actor,p_automatic) RETURNING * INTO j;
  RETURN jsonb_build_object('claimed',true,'job',to_jsonb(j),'payment_intent',m.stripe_payment_intent_id,'total',coalesce(m.amount_cents,0)+coalesce(m.urgent_fee_cents,0));
END $$;

CREATE FUNCTION public.finish_service_payout(p_mission uuid,p_transfer text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  PERFORM 1 FROM public.missions WHERE id=p_mission FOR UPDATE;
  IF p_transfer NOT LIKE 'tr_%' THEN RAISE EXCEPTION 'Référence Stripe invalide'; END IF;
  UPDATE public.service_payouts SET state='transferred',transfer_id=p_transfer,finished_at=now(),error=null
  WHERE mission_id=p_mission AND state IN ('processing','uncertain');
  IF NOT FOUND THEN RETURN; END IF;
  -- Preserve a dispute/refund reported while Stripe was processing the transfer.
  UPDATE public.missions SET stripe_transfer_id=p_transfer,transferred_at=now(),
    payment_status=CASE WHEN payment_status IN ('paid','payout_ready') THEN 'transferred' ELSE payment_status END,
    status=CASE WHEN status='awaiting_validation' THEN 'completed' ELSE status END
  WHERE id=p_mission;
END $$;
CREATE FUNCTION public.hold_service_payout(p_mission uuid,p_actor uuid,p_hold boolean) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role='admin' AND NOT coalesce(suspended,false)) THEN RAISE EXCEPTION 'Administrateur requis'; END IF;
  PERFORM 1 FROM public.missions WHERE id=p_mission FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.service_payouts WHERE mission_id=p_mission) THEN RAISE EXCEPTION 'Versement engagé : vérification Stripe nécessaire'; END IF;
  UPDATE public.service_completions SET held=p_hold WHERE mission_id=p_mission;
  IF NOT FOUND THEN RAISE EXCEPTION 'Preuve de fin absente'; END IF;
END $$;
CREATE FUNCTION public.list_due_service_payouts(p_limit integer DEFAULT 10) RETURNS TABLE(mission_id uuid)
LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
  SELECT c.mission_id
  FROM public.service_completions c
  WHERE NOT c.held AND c.due_at<=now()
    AND NOT EXISTS(SELECT 1 FROM public.service_payouts j WHERE j.mission_id=c.mission_id)
  ORDER BY c.due_at
  LIMIT least(greatest(p_limit,1),25)
$$;
REVOKE ALL ON FUNCTION public.submit_service_completion(uuid,uuid,text),public.claim_service_payout(uuid,uuid,boolean),public.finish_service_payout(uuid,text),public.hold_service_payout(uuid,uuid,boolean),public.list_due_service_payouts(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_service_completion(uuid,uuid,text),public.claim_service_payout(uuid,uuid,boolean),public.finish_service_payout(uuid,text),public.hold_service_payout(uuid,uuid,boolean),public.list_due_service_payouts(integer) TO service_role;

-- The secret remains encrypted in Vault. The scheduled command only looks it
-- up at execution time; it is never exposed to browser clients.
SELECT vault.create_secret(
  encode(gen_random_bytes(32),'hex'),
  'service_payout_worker_token',
  'Authenticates the J+5 service payout worker'
)
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name='service_payout_worker_token');
UPDATE public.service_payout_settings
SET worker_hash=(
  SELECT encode(digest(decrypted_secret,'sha256'),'hex')
  FROM vault.decrypted_secrets
  WHERE name='service_payout_worker_token'
)
WHERE id=true;
SELECT cron.schedule(
  'service-payouts-every-15-minutes',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://pzvlarwsfvhenrniepkw.supabase.co/functions/v1/service-flow',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-service-worker',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='service_payout_worker_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $cron$
);
COMMIT;
