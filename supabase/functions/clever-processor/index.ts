// Reconcile the Stripe result, including return visits and repeated confirmations.
import {context, stripe, confirmMission, reply} from "../_shared/payment.ts";
Deno.serve(async req=>{
  if(req.method==="OPTIONS") return reply({ok:true});
  if(req.method!=="POST") return reply({error:"Méthode non autorisée"},405);
  try{
    const {user,admin}=await context(req);
    const {missionId,paymentIntentId}=await req.json();
    const {data:m,error}=await admin.from("missions").select("*").eq("id",missionId).eq("client_id",user.id).single();
    if(error||!m) return reply({error:"Mission introuvable"},404);
    const id=m.stripe_payment_intent_id||paymentIntentId;
    if(!/^pi_[a-zA-Z0-9]+$/.test(id||"")) return reply({error:"Paiement introuvable"},400);
    const pi=await stripe("payment_intents/"+encodeURIComponent(id));
    if(pi.status!=="succeeded") return reply({ok:false,status:pi.status});
    await confirmMission(admin,m,pi);
    return reply({ok:true,status:"succeeded"});
  }catch(e){return reply({error:e.message},e.message==="Non authentifié"?401:400);}
});
