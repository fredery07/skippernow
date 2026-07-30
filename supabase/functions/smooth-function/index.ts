// Nom de fonction déployé : "smooth-function" (nom auto-généré côté Supabase, conservé
// tel quel car index.html l'appelle littéralement via /functions/v1/smooth-function).
// Rôle réel : crée le PaymentIntent Stripe pour le paiement d'une mission par le client.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { missionId } = await req.json();
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: cors });

    const { data: mission, error: missionErr } = await supabase
      .from("missions").select("*").eq("id", missionId).eq("client_id", user.id).single();
    if (missionErr || !mission) return new Response(JSON.stringify({ error: "Mission introuvable" }), { status: 404, headers: cors });

    const total = Number(mission.amount_cents || 0) + Number(mission.urgent_fee_cents || 0);
    if (total <= 0) return new Response(JSON.stringify({ error: "Montant invalide" }), { status: 400, headers: cors });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const resp = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + stripeKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        amount: String(total),
        currency: "eur",
        "automatic_payment_methods[enabled]": "true",
        "metadata[mission_id]": String(missionId),
      }),
    });
    const pi = await resp.json();
    if (!resp.ok) return new Response(JSON.stringify({ error: pi.error?.message || "Erreur Stripe" }), { status: 400, headers: cors });

    return new Response(JSON.stringify({ client_secret: pi.client_secret }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
  }
});
