-- Follow-up to booking audit: completed-service reviews and protected payment state.
BEGIN;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Client reviews completed mission" ON public.reviews;
CREATE POLICY "Client reviews completed mission" ON public.reviews FOR INSERT TO authenticated
WITH CHECK (
  client_id = (select auth.uid()) AND rating BETWEEN 1 AND 5
  AND coalesce(length(comment),0) <= 2000
  AND EXISTS (SELECT 1 FROM public.missions m WHERE m.id=mission_id
    AND m.client_id=(select auth.uid()) AND m.status='completed'
    AND reviews.skipper_id=coalesce(m.skipper_id,m.provider_id))
);
CREATE OR REPLACE FUNCTION public.guard_mission_payment_state()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE actor uuid := auth.uid(); is_owner boolean; is_pro boolean;
BEGIN
  -- Server payment functions run as service_role. Ordinary API writes must not
  -- manufacture payments, reassign a paid order, or change a price during checkout.
  IF current_user NOT IN ('anon','authenticated') THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.payment_status IS DISTINCT FROM 'unpaid' OR NEW.stripe_payment_intent_id IS NOT NULL
      OR NEW.paid_at IS NOT NULL OR NEW.status NOT IN ('pending','searching') THEN
      RAISE EXCEPTION 'Une demande doit commencer sans paiement';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
    OR NEW.stripe_checkout_session_id IS DISTINCT FROM OLD.stripe_checkout_session_id
    OR NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
    RAISE EXCEPTION 'La confirmation du paiement est réservée au serveur';
  END IF;
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    IF NOT ((NEW.payment_status='refund_requested' AND OLD.payment_status IN ('paid','payout_ready','transferred') AND actor=OLD.client_id)
      OR (public.is_admin() AND NEW.payment_status IN ('transferred','refund_rejected') AND OLD.payment_status IN ('payout_ready','refund_requested'))) THEN
      RAISE EXCEPTION 'Cette modification du paiement est réservée au serveur';
    END IF;
  END IF;
  IF OLD.status NOT IN ('pending','searching') AND (
    NEW.amount_cents IS DISTINCT FROM OLD.amount_cents OR NEW.urgent_fee_cents IS DISTINCT FROM OLD.urgent_fee_cents
    OR NEW.currency IS DISTINCT FROM OLD.currency OR NEW.client_id IS DISTINCT FROM OLD.client_id
    OR NEW.skipper_id IS DISTINCT FROM OLD.skipper_id OR NEW.provider_id IS DISTINCT FROM OLD.provider_id) THEN
    RAISE EXCEPTION 'Le devis envoyé ne peut plus être modifié';
  END IF;
  IF OLD.stripe_payment_intent_id IS NOT NULL AND NEW.status IN ('cancelled','rejected') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Contactez le support pour annuler un paiement commencé';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT public.is_admin() THEN
    is_owner := actor=OLD.client_id;
    is_pro := actor=coalesce(OLD.skipper_id,OLD.provider_id);
    IF NOT coalesce((coalesce(is_owner,false) AND ((OLD.status='quoted' AND NEW.status IN ('accepted','rejected'))
      OR (OLD.status IN ('pending','accepted') AND NEW.status='cancelled')
      OR (OLD.status='awaiting_validation' AND NEW.status='completed'))
      OR ((coalesce(is_pro,false) OR (OLD.skipper_id IS NULL AND OLD.provider_id IS NULL AND NEW.skipper_id=actor
          AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=actor AND p.role IN ('skipper','provider') AND p.verified AND NOT coalesce(p.suspended,false))))
        AND ((OLD.status='pending' AND NEW.status='quoted') OR (OLD.status='in_progress' AND NEW.status='awaiting_validation')))),false) THEN
      RAISE EXCEPTION 'Transition de mission non autorisée';
    END IF;
  END IF;
  IF NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed' THEN NEW.completed_at=now();NEW.validated_at=now(); END IF;
  IF NEW.status='accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN NEW.accepted_at=now(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_mission_payment_state ON public.missions;
CREATE TRIGGER guard_mission_payment_state BEFORE INSERT OR UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.guard_mission_payment_state();
COMMIT;
