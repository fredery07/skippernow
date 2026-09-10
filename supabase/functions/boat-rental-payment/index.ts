import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});

async function stripe(path:string, body?:Record<string,string>, key?:string){
  const secret=Deno.env.get("STRIPE_SECRET_KEY");
  if(!secret) throw new Error("Paiement indisponible");
  const r=await fetch("https://api.stripe.com/v1/"+path,{method:body?"POST":"GET",headers:{Authorization:"Bearer "+secret,...(body?{"Content-Type":"application/x-www-form-urlencoded"}:{}),...(key?{"Idempotency-Key":key}:{})},body:body?new URLSearchParams(body):undefined});
  const data=await r.json();
  if(!r.ok) throw new Error(data.error?.message||"Erreur Stripe");
  return data;
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return reply({error:"Méthode non autorisée"},405);
  try{
    const auth=req.headers.get("Authorization");
    if(!auth) return reply({error:"Non authentifié"},401);
    const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
    const {data:{user}}=await client.auth.getUser();
    if(!user) return reply({error:"Non authentifié"},401);
    const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const input=await req.json();
    const {data:rental,error}=await admin.from("boat_rental_requests").select("*").eq("id",String(input.requestId||"")).eq("renter_id",user.id).single();
    if(error||!rental) return reply({error:"Réservation introuvable"},404);

    if(input.action==="create"){
      if(rental.status!=="accepted"||rental.payment_status!=="unpaid") return reply({error:"Cette réservation n'est pas prête à être payée"},409);
      let pi;
      if(rental.stripe_payment_intent_id) pi=await stripe("payment_intents/"+encodeURIComponent(rental.stripe_payment_intent_id));
      else{
        pi=await stripe("payment_intents",{amount:String(rental.amount_cents),currency:rental.currency||"eur","automatic_payment_methods[enabled]":"true","metadata[boat_rental_id]":rental.id},"boat-rental-"+rental.id);
        const {error:saveError}=await admin.from("boat_rental_requests").update({stripe_payment_intent_id:pi.id,payment_status:"processing",updated_at:new Date().toISOString()}).eq("id",rental.id).eq("payment_status","unpaid");
        if(saveError) throw saveError;
      }
      if(pi.metadata?.boat_rental_id!==rental.id||Number(pi.amount)!==Number(rental.amount_cents)) throw new Error("Montant de réservation incohérent");
      if(pi.status==="succeeded"){
        await admin.from("boat_rental_requests").update({payment_status:"paid",status:"confirmed",paid_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",rental.id);
        return reply({paid:true});
      }
      return reply({client_secret:pi.client_secret,amount:pi.amount,currency:pi.currency});
    }

    if(input.action==="confirm"){
      const id=rental.stripe_payment_intent_id||String(input.paymentIntentId||"");
      if(!id) return reply({error:"Paiement introuvable"},400);
      const pi=await stripe("payment_intents/"+encodeURIComponent(id));
      if(pi.metadata?.boat_rental_id!==rental.id||Number(pi.amount)!==Number(rental.amount_cents)||pi.status!=="succeeded"||Number(pi.amount_received)!==Number(pi.amount)) return reply({ok:false,status:pi.status});
      await admin.from("boat_rental_requests").update({stripe_payment_intent_id:pi.id,payment_status:"paid",status:"confirmed",paid_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",rental.id);
      return reply({ok:true});
    }
    return reply({error:"Action inconnue"},400);
  }catch(e){return reply({error:e instanceof Error?e.message:"Erreur"},400);}
});
