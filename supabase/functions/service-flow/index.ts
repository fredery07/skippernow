import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { context, cors, reply, stripe } from "../_shared/payment.ts";

import {ensureAccount, retrieveAccount, accountReady, sessionOptions, connectStripe, refreshAccountStatuses} from "./connect.ts";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function checked(result){ if(result.error) throw result.error; return result.data; }
async function rpc(db,name,args){ return checked(await db.rpc(name,args)); }
async function missionFor(db,id,user,isAdmin){
  if(!uuid.test(id||"")) throw new Error("Référence invalide");
  const m=await checked(await db.from("missions").select("*").eq("id",id).single());
  if(!isAdmin && m.client_id!==user.id && (m.provider_id||m.skipper_id)!==user.id) throw new Error("Accès refusé");
  return m;
}
export function photoType(bytes){
  if(bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return "image/jpeg";
  if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) return "image/png";
  if(new TextDecoder().decode(bytes.slice(0,4))==="RIFF" && new TextDecoder().decode(bytes.slice(8,12))==="WEBP") return "image/webp";
  throw new Error("Photo JPEG, PNG ou WebP requise (8 Mo maximum)");
}
export function verifyTransferPayment(pi,charge,job,total){
  if(pi.status!=="succeeded" || pi.metadata?.mission_id!==job.mission_id || pi.amount!==total || pi.amount_received!==total
    || pi.currency!==job.currency || charge.payment_intent!==pi.id || !charge.paid || charge.disputed || charge.refunded
    || charge.amount_refunded>0 || pi.transfer_data?.destination || charge.transfer
    || job.amount_cents<=0 || job.amount_cents>total) throw new Error("Paiement Stripe non éligible au versement");
}
async function transfer(db,missionId,actor,automatic){
  const claim=await rpc(db,"claim_service_payout",{p_mission:missionId,p_actor:actor,p_automatic:automatic});
  if(!claim.claimed) return {existing:true};
  const j=claim.job;
  try{
    const row=await checked(await db.from("connect_accounts").select("account_id,account_api").eq("account_id",j.destination).single());
    const account=await retrieveAccount(row);
    if(!accountReady(account,row.account_api)) throw new Error("Coordonnées de versement incomplètes ou restreintes");
    const pi=await stripe("payment_intents/"+encodeURIComponent(claim.payment_intent));
    const charge=await stripe("charges/"+encodeURIComponent(pi.latest_charge));
    verifyTransferPayment(pi,charge,j,claim.total);
    // Recheck disputes/holds immediately before requesting the transfer.
    const m=await checked(await db.from("missions").select("payment_status,dispute_status").eq("id",missionId).single());
    if(!["paid","payout_ready"].includes(m.payment_status) || m.dispute_status==="open") throw new Error("Versement suspendu");
    const tr=await stripe("transfers",{
      amount:String(j.amount_cents),currency:j.currency,destination:j.destination,source_transaction:charge.id,
      transfer_group:"skippernow-service-"+missionId,"metadata[mission_id]":missionId
    },"service-payout-"+missionId);
    await rpc(db,"finish_service_payout",{p_mission:missionId,p_transfer:tr.id});
    return {transferred:true};
  }catch(e){
    // Never retry a money movement blindly. A durable claim survives Stripe's
    // idempotency retention window; an admin can reconcile, never re-create it.
    await db.from("service_payouts").update({state:"uncertain",error:String(e.message||e).slice(0,350)}).eq("mission_id",missionId).eq("state","processing");
    throw new Error("Versement à vérifier dans Stripe. Aucun nouvel envoi automatique ne sera tenté pour cette mission.");
  }
}
async function reconcile(db,missionId){
  const j=await checked(await db.from("service_payouts").select("*").eq("mission_id",missionId).single());
  const result=await stripe("transfers?"+new URLSearchParams({transfer_group:"skippernow-service-"+missionId,limit:"100"}));
  const matches=(result.data||[]).filter(tr=>tr.metadata?.mission_id===missionId && tr.destination===j.destination && tr.amount===j.amount_cents && tr.currency===j.currency && !tr.reversed);
  if(matches.length!==1 || result.has_more) throw new Error("Aucun transfert unique confirmé. Vérifiez Stripe avant toute autre action.");
  await rpc(db,"finish_service_payout",{p_mission:missionId,p_transfer:matches[0].id});
  return {transferred:true};
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return reply({error:"Méthode non autorisée"},405);
  try{
    const workerToken=req.headers.get("x-service-worker");
    if(workerToken){
      const db=createClient(Deno.env.get("SUPABASE_URL"),Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
      const settings=await checked(await db.from("service_payout_settings").select("enabled,worker_hash").single());
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(workerToken)))).map(v=>v.toString(16).padStart(2,"0")).join("");
      if(!settings.worker_hash || hash!==settings.worker_hash) return reply({error:"Non autorisé"},401);
      const input=await req.json();
      if(input.dry_run){
        // Read-only: confirms Connect API access without creating an account or transfer.
        const accounts=await stripe("accounts?limit=1");
        let v2_access;
        try{await connectStripe("v2/core/accounts?limit=1");v2_access={ok:true};}
        catch(e){v2_access={ok:false,code:e.stripe_code,param:e.stripe_param,request_id:e.stripe_request_id};}
        return reply({ok:true,enabled:settings.enabled,connect_access:true,has_accounts:!!accounts.data?.length,v2_access});
      }
      await refreshAccountStatuses(db);
      if(!settings.enabled) return reply({enabled:false});
      const due=await rpc(db,"list_due_service_payouts",{p_limit:10});
      const results=[];
      for(const c of due){try{results.push({mission:c.mission_id,...await transfer(db,c.mission_id,null,true)});}catch(e){results.push({mission:c.mission_id,error:e.message});}}
      return reply({results});
    }
    const {user,admin:db}=await context(req);
    const p=await checked(await db.from("profiles").select("role,verified,suspended").eq("id",user.id).single());
    if(p.suspended) return reply({error:"Compte suspendu"},403);
    const isAdmin=p.role==="admin";
    if(req.headers.get("content-type")?.includes("multipart/form-data")){
      if(Number(req.headers.get("content-length")||0)>9*1024*1024) return reply({error:"Photo trop volumineuse"},413);
      const form=await req.formData();
      const m=await missionFor(db,String(form.get("missionId")),user,isAdmin);
      if((m.provider_id||m.skipper_id)!==user.id || !p.verified) return reply({error:"Prestataire de la mission requis"},403);
      const old=await checked(await db.from("service_completions").select("due_at").eq("mission_id",m.id).maybeSingle());
      if(old) return reply({ok:true,...old});
      if(m.status!=="in_progress" || m.payment_status!=="paid") throw new Error("Mission non éligible");
      const file=form.get("photo");
      if(!(file instanceof File) || file.size<16 || file.size>8*1024*1024) throw new Error("Photo requise, 8 Mo maximum");
      const bytes=new Uint8Array(await file.arrayBuffer()); const type=photoType(bytes);
      const path=m.id+"/"+crypto.randomUUID()+"."+type.split("/")[1];
      await checked(await db.storage.from("completion-proofs").upload(path,bytes,{contentType:type,upsert:false}));
      try{return reply({ok:true,...await rpc(db,"submit_service_completion",{p_mission:m.id,p_actor:user.id,p_photo:path})});}
      catch(e){await db.storage.from("completion-proofs").remove([path]);throw e;}
    }
    const input=await req.json();
    if(input.action==="set_enabled"){
      if(!isAdmin) return reply({error:"Administrateur requis"},403);
      const enabled=input.enabled===true;
      if(enabled){
        const ready=await checked(await db.from("connect_accounts").select("professional_id").eq("ready",true).limit(1));
        if(!ready.length) throw new Error("Aucun compte Stripe professionnel prêt. Terminez d’abord une configuration Stripe.");
        await stripe("accounts?limit=1");
      }
      await checked(await db.from("service_payout_settings").update({enabled}).eq("id",true));
      return reply({enabled});
    }
    if(["account_status","embedded_session","onboard","account_dashboard"].includes(input.action)){
      if(!["provider","skipper"].includes(p.role) || !p.verified) return reply({error:"Profil professionnel vérifié requis"},403);
      if(["onboard","account_dashboard"].includes(input.action))
        return reply({error:"Actualisez SkipperNow pour utiliser le formulaire intégré à votre espace."},409);
      try{
      // Never accept a destination/account/professional ID supplied by the browser.
      let a=await checked(await db.from("connect_accounts").select("*").eq("professional_id",user.id).maybeSingle());
      if(input.action==="embedded_session") a=await ensureAccount(db,user.id,input.country,user.email);
      if(!a?.account_id) return reply({connected:false,ready:false,country:a?.embedded_country||null});
      const account=await retrieveAccount(a);
      const ready=accountReady(account,a.account_api);
      await checked(await db.from("connect_accounts").update({ready,checked_at:new Date().toISOString(),last_error:null}).eq("professional_id",user.id));
      if(input.action==="embedded_session"){
        const session=await connectStripe("v1/account_sessions",sessionOptions(a,account));
        return new Response(JSON.stringify({client_secret:session.client_secret,livemode:session.livemode}),
          {headers:{...cors,"Cache-Control":"no-store"}});
      }
      return reply({connected:true,ready,country:a.embedded_country||null});
      }catch(e){
        if(e.stripe_request_id || e.stripe_code){
          await db.from("connect_accounts").update({last_error:{code:e.stripe_code,param:e.stripe_param,request_id:e.stripe_request_id,at:new Date().toISOString()}}).eq("professional_id",user.id);
        }
        throw e;
      }
    }
    const m=await missionFor(db,input.missionId,user,isAdmin);
    if(input.action==="proof"){
      const c=await checked(await db.from("service_completions").select("photo_path").eq("mission_id",m.id).single());
      return reply(await checked(await db.storage.from("completion-proofs").createSignedUrl(c.photo_path,120)));
    }
    if(!isAdmin) return reply({error:"Administrateur requis"},403);
    if(input.action==="transfer") return reply(await transfer(db,m.id,user.id,false));
    if(input.action==="reconcile") return reply(await reconcile(db,m.id));
    if(input.action==="hold") {await rpc(db,"hold_service_payout",{p_mission:m.id,p_actor:user.id,p_hold:input.held===true});return reply({ok:true});}
    return reply({error:"Action inconnue"},400);
  }catch(e){return reply({error:String(e.message||e)},400);}
});
