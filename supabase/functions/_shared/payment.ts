import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export const cors = {"Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Content-Type":"application/json"};
export function reply(body, status=200){ return new Response(JSON.stringify(body), {status, headers:cors}); }
export async function context(req){
  const auth = req.headers.get("Authorization");
  if(!auth) throw new Error("Non authentifié");
  const client = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_ANON_KEY"), {global:{headers:{Authorization:auth}}});
  const {data:{user},error} = await client.auth.getUser();
  if(error || !user) throw new Error("Non authentifié");
  const admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  return {user,admin};
}
export async function stripe(path, body, key){
  const secret = Deno.env.get("STRIPE_SECRET_KEY");
  if(!secret) throw new Error("Paiement temporairement indisponible");
  const response = await fetch("https://api.stripe.com/v1/"+path, {
    method:body ? "POST" : "GET",
    headers:{Authorization:"Bearer "+secret, ...(body?{"Content-Type":"application/x-www-form-urlencoded"}:{}), ...(key?{"Idempotency-Key":key}:{})},
    body:body ? new URLSearchParams(body) : undefined
  });
  const data=await response.json();
  if(!response.ok) throw new Error(data.error?.message || "Erreur du service de paiement");
  return data;
}
export function matches(pi,m){
  return pi.metadata?.mission_id===m.id && Number(pi.amount)===Number(m.amount_cents||0)+Number(m.urgent_fee_cents||0) && pi.currency===(m.currency||"eur").toLowerCase();
}
export async function confirmMission(admin,m,pi){
  if(!matches(pi,m) || pi.status!=="succeeded" || Number(pi.amount_received)!==Number(pi.amount)) throw new Error("Paiement non confirmé pour cette mission");
  if(m.stripe_payment_intent_id && m.stripe_payment_intent_id!==pi.id) throw new Error("Paiement différent de celui de la mission");
  if(["paid","payout_ready","transferred","refund_requested","refunded","refund_rejected"].includes(m.payment_status)) return;
  if(m.status!=="accepted") throw new Error("Statut de mission incompatible avec ce paiement. Contactez le support.");
  let query=admin.from("missions").update({payment_status:"paid",status:"in_progress",paid_at:new Date().toISOString(),stripe_payment_intent_id:pi.id})
    .eq("id",m.id).eq("client_id",m.client_id).eq("status","accepted");
  query=m.payment_status==null ? query.is("payment_status",null) : query.eq("payment_status",m.payment_status);
  const {data,error}=await query.select("id");
  if(error) throw error;
  if(!data?.length){
    const {data:latest}=await admin.from("missions").select("payment_status,stripe_payment_intent_id").eq("id",m.id).single();
    if(latest?.stripe_payment_intent_id!==pi.id || !["paid","payout_ready","transferred"].includes(latest?.payment_status)) throw new Error("Confirmation en attente. Actualisez votre espace.");
  }
}
