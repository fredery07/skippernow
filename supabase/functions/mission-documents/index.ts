import {context, cors} from "../_shared/payment.ts";

const bucket="provider-invoices";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const paidStatuses=["paid","payout_ready","transferred","refund_requested","refunded","refund_rejected"];
function fail(message,status=400){throw Object.assign(new Error(message),{status,public:true});}
function response(body,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,"Cache-Control":"no-store"}});}
async function checked(result){if(result.error) throw result.error;return result.data;}
export function canRead(m,user,profile){return !profile.suspended && (profile.role==="admin" || m.client_id===user.id || (m.provider_id||m.skipper_id)===user.id);}
export function canUpload(m,user,profile){return !profile.suspended && profile.verified===true && ["skipper","provider"].includes(profile.role) && (m.provider_id||m.skipper_id)===user.id && paidStatuses.includes(m.payment_status) && !!m.stripe_payment_intent_id;}
export function validatePdf(bytes){
  if(bytes.length<12 || bytes.length>8388608 || new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-" || !new TextDecoder().decode(bytes.slice(-2048)).includes("%%EOF")) fail("Choisissez un fichier PDF valide de 8 Mo maximum.");
}
export function paymentReceipt(pi,charge,m){
  const expected=Number(m.amount_cents||0)+Number(m.urgent_fee_cents||0);
  if(pi.id!==m.stripe_payment_intent_id || pi.status!=="succeeded" || pi.metadata?.mission_id!==m.id || pi.amount_received!==expected || pi.amount!==expected || pi.currency!==(m.currency||"eur").toLowerCase() || charge.payment_intent!==pi.id || charge.paid!==true || charge.amount_captured!==expected || charge.currency!==pi.currency) fail("Le paiement de cette mission ne peut pas être confirmé. Contactez le support.",409);
  return {reference:"SN-"+charge.id,paymentReference:pi.id,paidAt:new Date(charge.created*1000).toISOString(),total:pi.amount_received,refunded:Number(charge.amount_refunded||0),currency:pi.currency,disputed:!!charge.disputed,missionId:m.id,port:m.port,boat:m.boat_type,description:m.description,serviceAt:m.starts_at};
}
async function stripeRead(path){
  const secret=Deno.env.get("STRIPE_SECRET_KEY");if(!secret)fail("Le justificatif de paiement est temporairement indisponible.",503);
  const res=await fetch("https://api.stripe.com/v1/"+path,{headers:{Authorization:"Bearer "+secret},signal:AbortSignal.timeout(18000)});
  if(!res.ok)fail("Impossible de vérifier le paiement pour le moment. Réessayez plus tard.",503);
  return res.json();
}
export async function handle(req){
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return response({error:"Méthode non autorisée"},405);
  try{
    let ctx;try{ctx=await context(req);}catch{fail("Connectez-vous pour accéder à vos documents.",401);}
    const {user,admin:db}=ctx;
    const p=await checked(await db.from("profiles").select("role,verified,suspended").eq("id",user.id).single());
    if(p.suspended)fail("Compte suspendu.",403);
    const multipart=req.headers.get("content-type")?.includes("multipart/form-data");
    if(Number(req.headers.get("content-length")||0)>9*1024*1024)fail("Fichier trop volumineux.",413);
    const input=multipart?await req.formData():await req.json();
    const get=k=>multipart?input.get(k):input[k];
    const missionId=get("missionId");if(!uuid.test(missionId||""))fail("Référence de mission invalide.");
    const m=await checked(await db.from("missions").select("*").eq("id",missionId).maybeSingle());
    if(!m || !canRead(m,user,p))fail("Document inaccessible.",403);
    const action=multipart?"upload":get("action");
    if(action==="list"){
      const documents=await checked(await db.from("mission_invoices").select("id,invoice_number,issuer_name,created_at,size_bytes,document_kind").eq("mission_id",m.id).order("created_at",{ascending:false}));
      return response({documents,canUpload:canUpload(m,user,p),hasPayment:!!m.stripe_payment_intent_id && paidStatuses.includes(m.payment_status),mission:{id:m.id,port:m.port,boat:m.boat_type,description:m.description}});
    }
    if(action==="receipt"){
      if(!m.stripe_payment_intent_id)fail("Aucun paiement confirmé pour cette mission.",409);
      const pi=await stripeRead("payment_intents/"+encodeURIComponent(m.stripe_payment_intent_id));
      if(!pi.latest_charge)fail("Aucun paiement confirmé pour cette mission.",409);
      const charge=await stripeRead("charges/"+encodeURIComponent(pi.latest_charge));
      return response({receipt:paymentReceipt(pi,charge,m)});
    }
    if(action==="download"){
      if(!uuid.test(get("documentId")||""))fail("Référence de document invalide.");
      const doc=await checked(await db.from("mission_invoices").select("id,object_path").eq("mission_id",m.id).eq("id",get("documentId")).maybeSingle());
      if(!doc)fail("Document inaccessible.",404);
      const link=await checked(await db.storage.from(bucket).createSignedUrl(doc.object_path,60,{download:"document-prestataire-"+doc.id+".pdf"}));
      return response({url:link.signedUrl});
    }
    if(action!=="upload")fail("Action inconnue.");
    if(!canUpload(m,user,p))fail("Seul le prestataire vérifié de cette mission payée peut déposer sa facture.",403);
    const invoiceNumber=String(get("invoiceNumber")||"").trim();const issuerName=String(get("issuerName")||"").trim();const kind=String(get("documentKind")||"invoice");
    if(!invoiceNumber || invoiceNumber.length>100 || !issuerName || issuerName.length>200 || !["invoice","credit_note"].includes(kind) || get("confirmed")!=="true")fail("Renseignez l’entreprise, le numéro du document et confirmez le partage.");
    const file=get("file");if(!(file instanceof File) || file.size>8388608 || (file.type && file.type!=="application/pdf"))fail("Choisissez un fichier PDF de 8 Mo maximum.");
    const bytes=new Uint8Array(await file.arrayBuffer());validatePdf(bytes);
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(x=>x.toString(16).padStart(2,"0")).join("");
    const existing=await checked(await db.from("mission_invoices").select("id").eq("mission_id",m.id).eq("sha256",hash).maybeSingle());
    if(existing)return response({ok:true,existing:true});
    const path=m.id+"/"+crypto.randomUUID()+".pdf";
    await checked(await db.storage.from(bucket).upload(path,bytes,{contentType:"application/pdf",upsert:false}));
    const saved=await db.from("mission_invoices").insert({mission_id:m.id,professional_id:user.id,client_id:m.client_id,object_path:path,sha256:hash,size_bytes:bytes.length,invoice_number:invoiceNumber,issuer_name:issuerName,document_kind:kind});
    if(saved.error){
      await db.storage.from(bucket).remove([path]);
      if(saved.error.code==="23505")return response({ok:true,existing:true});
      throw saved.error;
    }
    return response({ok:true});
  }catch(e){
    if(!e.public)console.error("mission-documents",e.code||e.name||"error");
    return response({error:e.public?e.message:"Documents temporairement indisponibles. Réessayez."},e.public?e.status:503);
  }
}
Deno.serve(handle);
