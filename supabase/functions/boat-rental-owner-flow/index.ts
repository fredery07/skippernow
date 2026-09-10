import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const apiVersion="2026-08-26.dahlia";

async function checked(result:any){if(result.error) throw result.error;return result.data;}
async function stripe(path:string,body?:Record<string,string>,key?:string){
  const secret=Deno.env.get("STRIPE_SECRET_KEY"); if(!secret) throw new Error("Configuration Stripe indisponible");
  const r=await fetch("https://api.stripe.com/v1/"+path,{method:body?"POST":"GET",headers:{Authorization:"Bearer "+secret,...(body?{"Content-Type":"application/x-www-form-urlencoded"}:{}),...(key?{"Idempotency-Key":key}:{})},body:body?new URLSearchParams(body):undefined});
  const data=await r.json(); if(!r.ok) throw new Error(data.error?.message||"Erreur Stripe"); return data;
}
async function connectStripe(path:string,body?:any,key?:string){
  const secret=Deno.env.get("STRIPE_SECRET_KEY"); if(!secret) throw new Error("Configuration Stripe indisponible");
  const v2=path.startsWith("v2/");
  const r=await fetch("https://api.stripe.com/"+path,{method:body?"POST":"GET",headers:{Authorization:"Bearer "+secret,"Stripe-Version":apiVersion,...(body?{"Content-Type":v2?"application/json":"application/x-www-form-urlencoded"}:{}),...(key?{"Idempotency-Key":key}:{})},body:body?(v2?JSON.stringify(body):new URLSearchParams(body)):undefined});
  const data=await r.json(); if(!r.ok) throw new Error("Le formulaire de versement est indisponible. Réessayez ou contactez le support."); return data;
}
function ready(account:any,version:string){
  if(version==="v2"){const b=account.configuration?.recipient?.capabilities?.stripe_balance;return b?.stripe_transfers?.status==="active"&&b?.payouts?.status==="active";}
  return account.payouts_enabled===true&&account.capabilities?.transfers==="active";
}
async function retrieve(row:any){return row.account_api==="v2"?connectStripe("v2/core/accounts/"+encodeURIComponent(row.account_id)+"?include[0]=configuration.recipient&include[1]=defaults"):stripe("accounts/"+encodeURIComponent(row.account_id));}
function sessionOptions(row:any,account:any){
  const noAuth=row.account_api==="v2"?account.dashboard==="none"&&account.defaults?.responsibilities?.requirements_collector==="application":account.controller?.requirement_collection==="application";
  const body:Record<string,string>={account:row.account_id};
  for(const name of ["account_onboarding","account_management","notification_banner","payouts"]){body[`components[${name}][enabled]`]="true";body[`components[${name}][features][external_account_collection]`]="true";if(noAuth)body[`components[${name}][features][disable_stripe_user_authentication]`]="true";}
  body["components[payouts][features][standard_payouts]"]="false"; body["components[payouts][features][edit_payout_schedule]"]="false"; return body;
}
async function ensureAccount(db:any,user:any,country:string){
  await checked(await db.from("connect_accounts").upsert({professional_id:user.id},{onConflict:"professional_id",ignoreDuplicates:true}));
  let row=await checked(await db.from("connect_accounts").select("*").eq("professional_id",user.id).single());
  if(row.account_id) return row;
  if(!/^[A-Z]{2}$/.test(country||"")) throw new Error("Choisissez le pays où votre activité de location est établie.");
  if(!row.embedded_started_at){await checked(await db.from("connect_accounts").update({embedded_started_at:new Date().toISOString(),embedded_country:country,embedded_contact_email:user.email}).eq("professional_id",user.id));row=await checked(await db.from("connect_accounts").select("*").eq("professional_id",user.id).single());}
  const email=row.embedded_contact_email||user.email; if(!email) throw new Error("Ajoutez une adresse e-mail à votre compte.");
  const payload={contact_email:email,dashboard:"none",identity:{country:(row.embedded_country||country).toLowerCase()},defaults:{responsibilities:{fees_collector:"application",losses_collector:"application"}},configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{requested:true}}}}},metadata:{professional_id:user.id,skippernow_account_api:"v2",skippernow_owner:"true"}};
  const account=await connectStripe("v2/core/accounts",payload,"boat-owner-connect-"+row.creation_key);
  await checked(await db.from("connect_accounts").update({account_id:account.id,account_api:"v2"}).eq("professional_id",user.id).is("account_id",null));
  return checked(await db.from("connect_accounts").select("*").eq("professional_id",user.id).single());
}
async function transfer(db:any,requestId:string,actor:string){
  const claim=await checked(await db.rpc("claim_boat_rental_payout",{p_request:requestId,p_actor:actor}));
  if(!claim.claimed) return claim;
  try{
    const row=await checked(await db.from("connect_accounts").select("account_id,account_api").eq("account_id",claim.destination).single());
    const account=await retrieve(row); if(!ready(account,row.account_api)) throw new Error("Le compte de versement du propriétaire n'est pas prêt.");
    const pi=await stripe("payment_intents/"+encodeURIComponent(claim.payment_intent));
    const charge=await stripe("charges/"+encodeURIComponent(pi.latest_charge));
    if(pi.status!=="succeeded"||pi.metadata?.boat_rental_id!==requestId||pi.amount!==claim.total||pi.amount_received!==claim.total||charge.payment_intent!==pi.id||!charge.paid||charge.refunded||charge.disputed||charge.amount_refunded>0||pi.transfer_data?.destination||charge.transfer) throw new Error("Paiement non éligible au versement");
    const tr=await stripe("transfers",{amount:String(claim.amount_cents),currency:claim.currency,destination:claim.destination,source_transaction:charge.id,transfer_group:"skippernow-rental-"+requestId,"metadata[boat_rental_id]":requestId},"boat-rental-payout-"+requestId);
    await checked(await db.rpc("finish_boat_rental_payout",{p_request:requestId,p_transfer:tr.id}));
    return {transferred:true,transfer_id:tr.id};
  }catch(e){await db.from("boat_rental_payouts").update({state:"uncertain",error:String(e instanceof Error?e.message:e).slice(0,350)}).eq("request_id",requestId).eq("state","processing");throw e;}
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors}); if(req.method!=="POST") return reply({error:"Méthode non autorisée"},405);
  try{
    const auth=req.headers.get("Authorization"); if(!auth) return reply({error:"Non authentifié"},401);
    const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
    const {data:{user}}=await client.auth.getUser(); if(!user) return reply({error:"Non authentifié"},401);
    const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!); const input=await req.json();
    const profile=await checked(await db.from("profiles").select("role,suspended").eq("id",user.id).single()); if(profile.suspended) return reply({error:"Compte suspendu"},403);
    const ownsBoat=(await checked(await db.from("boats").select("id").eq("client_id",user.id).limit(1))).length>0;
    if(["account_status","embedded_session"].includes(input.action)){
      if(!ownsBoat) return reply({error:"Ajoutez d'abord un bateau à votre compte."},403);
      let row=await checked(await db.from("connect_accounts").select("*").eq("professional_id",user.id).maybeSingle());
      if(input.action==="embedded_session") row=await ensureAccount(db,user,input.country);
      if(!row?.account_id) return reply({connected:false,ready:false,country:row?.embedded_country||null});
      const account=await retrieve(row); const isReady=ready(account,row.account_api); await db.from("connect_accounts").update({ready:isReady,checked_at:new Date().toISOString(),last_error:null}).eq("professional_id",user.id);
      if(input.action==="embedded_session"){const session=await connectStripe("v1/account_sessions",sessionOptions(row,account));return reply({client_secret:session.client_secret,livemode:session.livemode,ready:isReady});}
      return reply({connected:true,ready:isReady,country:row.embedded_country||null});
    }
    if(input.action==="complete"){
      const rental=await checked(await db.from("boat_rental_requests").select("*").eq("id",input.requestId).eq("renter_id",user.id).single());
      if(rental.status!=="confirmed"||rental.payment_status!=="paid") return reply({error:"Cette location ne peut pas encore être validée."},409);
      if(new Date(rental.starts_at).getTime()>Date.now()) return reply({error:"La location n'a pas encore commencé."},409);
      await checked(await db.from("boat_rental_requests").update({status:"completed",updated_at:new Date().toISOString()}).eq("id",rental.id).eq("status","confirmed"));
      try{return reply({ok:true,...await transfer(db,rental.id,user.id)});}catch(e){return reply({ok:true,payout_pending:true,message:e instanceof Error?e.message:"Versement en attente"});}
    }
    if(input.action==="transfer"){
      if(profile.role!=="admin") return reply({error:"Administrateur requis"},403);
      return reply(await transfer(db,String(input.requestId||""),user.id));
    }
    return reply({error:"Action inconnue"},400);
  }catch(e){return reply({error:e instanceof Error?e.message:"Erreur"},400);}
});
