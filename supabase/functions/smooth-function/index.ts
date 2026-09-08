// Create or resume one payment for an accepted quote. Never trust client amounts.
import {context, stripe, matches, confirmMission, reply} from "../_shared/payment.ts";
Deno.serve(async req=>{
  if(req.method==="OPTIONS") return reply({ok:true});
  if(req.method!=="POST") return reply({error:"Méthode non autorisée"},405);
  try{
    const {user,admin}=await context(req);
    const {missionId}=await req.json();
    const {data:m,error}=await admin.from("missions").select("*").eq("id",missionId).eq("client_id",user.id).single();
    if(error||!m) return reply({error:"Mission introuvable"},404);
    if(m.status!=="accepted" || ![null,"unpaid","failed"].includes(m.payment_status)) return reply({error:"Cette mission ne nécessite pas de nouveau paiement"},409);
    const total=Number(m.amount_cents||0)+Number(m.urgent_fee_cents||0);
    if(!Number.isSafeInteger(total)||total<=0) return reply({error:"Montant invalide"},400);
    let pi;
    if(m.stripe_payment_intent_id){
      pi=await stripe("payment_intents/"+encodeURIComponent(m.stripe_payment_intent_id));
    }else{
      pi=await stripe("payment_intents",{amount:String(total),currency:(m.currency||"eur").toLowerCase(),"automatic_payment_methods[enabled]":"true","metadata[mission_id]":m.id},"mission-"+m.id);
      if(!matches(pi,m)) throw new Error("Le tarif a changé. Contactez le support avant de payer.");
      const {data:saved,error:saveError}=await admin.from("missions").update({stripe_payment_intent_id:pi.id})
        .eq("id",m.id).eq("status","accepted").is("stripe_payment_intent_id",null).select("id");
      if(saveError) throw saveError;
      if(!saved?.length){
        const {data:latest}=await admin.from("missions").select("stripe_payment_intent_id,status,payment_status").eq("id",m.id).single();
        if(latest?.stripe_payment_intent_id!==pi.id || latest.status!=="accepted" || ![null,"unpaid","failed"].includes(latest.payment_status)) throw new Error("La demande a changé. Actualisez votre espace.");
      }
    }
    if(!matches(pi,m)) throw new Error("Le tarif a changé. Contactez le support avant de payer.");
    if(pi.status==="succeeded"){await confirmMission(admin,m,pi);return reply({paid:true});}
    if(pi.status==="processing") return reply({processing:true});
    if(pi.status==="canceled") return reply({error:"Paiement annulé. Contactez le support."},409);
    return reply({client_secret:pi.client_secret,amount:total,currency:pi.currency});
  }catch(e){return reply({error:e.message},e.message==="Non authentifié"?401:400);}
});
