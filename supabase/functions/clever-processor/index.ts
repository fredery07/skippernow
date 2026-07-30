// Nom de fonction déployé : "clever-processor" (nom auto-généré côté Supabase, conservé
// tel quel car index.html l'appelle littéralement via /functions/v1/clever-processor).
// Rôle réel : confirme côté serveur qu'un PaymentIntent Stripe a réussi et marque la
// mission correspondante comme payée.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { missionId, paymentIntentId } = await req.json();
    const authHeader = req.headers.get("Authorization")!;
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: cors });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const resp = await fetch("https://api.stripe.com/v1/payment_intents/" + paymentIntentId, {
      headers: { "Authorization": "Bearer " + stripeKey },
    });
    const pi = await resp.json();
    if (!resp.ok || pi.status !== "succeeded") {
      return new Response(JSON.stringify({ error: "Paiement non confirmé" }), { status: 400, headers: cors });
    }

    // Vérification anti-fraude : ce PaymentIntent doit avoir été créé pour CETTE mission
    // (metadata posée par smooth-function), sinon un paiement valide sur une mission bon
    // marché pourrait être réutilisé pour en valider une plus chère.
    if (String(pi.metadata?.mission_id || "") !== String(missionId)) {
      return new Response(JSON.stringify({ error: "Paiement non associé à cette mission" }), { status: 400, headers: cors });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Vérification du montant : le PaymentIntent doit couvrir exactement le prix attendu
    // de la mission, pas seulement avoir réussi.
    const { data: mission, error: missionErr } = await supabaseAdmin
      .from("missions").select("amount_cents, urgent_fee_cents, client_id")
      .eq("id", missionId).single();
    if (missionErr || !mission || mission.client_id !== user.id) {
      return new Response(JSON.stringify({ error: "Mission introuvable" }), { status: 404, headers: cors });
    }
    const expectedTotal = Number(mission.amount_cents || 0) + Number(mission.urgent_fee_cents || 0);
    if (Number(pi.amount) !== expectedTotal) {
      return new Response(JSON.stringify({ error: "Montant payé incorrect" }), { status: 400, headers: cors });
    }

    const { error } = await supabaseAdmin.from("missions")
      .update({ payment_status: "paid", stripe_payment_intent_id: paymentIntentId })
      .eq("id", missionId).eq("client_id", user.id);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
  }
});
