// Nom de fonction déployé : "rapid-task" (nom auto-généré côté Supabase, conservé
// tel quel car index.html l'appelle littéralement via /functions/v1/rapid-task).
// Rôle réel : remboursement d'une mission par un administrateur (vérification du rôle
// faite côté serveur via la clé service_role — bonne pratique, contrairement à un
// contrôle uniquement côté client).
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
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: cors });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: requesterProfile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
    if (requesterProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Réservé à l'administrateur" }), { status: 403, headers: cors });
    }

    const { data: mission, error: missionErr } = await supabaseAdmin.from("missions").select("*").eq("id", missionId).single();
    if (missionErr || !mission || !mission.stripe_payment_intent_id) {
      return new Response(JSON.stringify({ error: "Mission ou paiement introuvable" }), { status: 404, headers: cors });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const resp = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + stripeKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ payment_intent: mission.stripe_payment_intent_id }),
    });
    const refund = await resp.json();
    if (!resp.ok) return new Response(JSON.stringify({ error: refund.error?.message || "Erreur Stripe" }), { status: 400, headers: cors });

    const { error } = await supabaseAdmin.from("missions").update({ payment_status: "refunded" }).eq("id", missionId);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
  }
});
