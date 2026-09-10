// Embedded Connect sessions are issued only after service-flow authenticates the owner.
// Stripe owns the identity/bank fields; SkipperNow never receives or stores those fields.
const apiVersion = "2026-08-26.dahlia";
export async function connectStripe(path, body, key){
  const secret=Deno.env.get("STRIPE_SECRET_KEY");
  if(!secret) throw new Error("Configuration des versements indisponible.");
  const v2=path.startsWith("v2/");
  const response=await fetch("https://api.stripe.com/"+path,{
    method:body?"POST":"GET",
    headers:{Authorization:"Bearer "+secret,"Stripe-Version":apiVersion,
      ...(body?{"Content-Type":v2?"application/json":"application/x-www-form-urlencoded"}:{}),
      ...(key?{"Idempotency-Key":key}:{})},
    body:body?(v2?JSON.stringify(body):new URLSearchParams(body)):undefined,
    signal:AbortSignal.timeout(20000)
  });
  const data=await response.json();
  if(!response.ok){
    // Do not expose Stripe responses, request payloads, or session secrets to logs/UI.
    console.error("connect_api_error",{status:response.status,code:data.error?.code||data.code||null,request_id:response.headers.get("request-id")});
    throw Object.assign(new Error("Le formulaire de versement est indisponible. Réessayez ou contactez le support."),{
      stripe_code:data.error?.code||data.code||null,
      stripe_param:data.error?.param||null,
      stripe_request_id:response.headers.get("request-id")
    });
  }
  return data;
}
async function checked(result){if(result.error) throw result.error;return result.data;}
export function accountPayload(owner,country,contactEmail){
  if(typeof contactEmail!=="string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))
    throw new Error("Renseignez une adresse e-mail valide dans votre compte SkipperNow avant de configurer vos versements.");
  return {contact_email:contactEmail,dashboard:"none",identity:{country:country.toLowerCase()},
    defaults:{responsibilities:{fees_collector:"application",losses_collector:"application"}},
    configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{requested:true}}}}},
    metadata:{professional_id:owner,skippernow_account_api:"v2"}};
}
export function accountReady(account,version){
  if(account.closed || account.deleted) return false;
  if(version==="v2"){
    const balance=account.configuration?.recipient?.capabilities?.stripe_balance;
    return balance?.stripe_transfers?.status==="active" && balance?.payouts?.status==="active";
  }
  return account.payouts_enabled===true && account.capabilities?.transfers==="active";
}
export async function retrieveAccount(row,api=connectStripe){
  return row.account_api==="v2"
    ? api("v2/core/accounts/"+encodeURIComponent(row.account_id)+"?include[0]=configuration.recipient&include[1]=defaults")
    : api("v1/accounts/"+encodeURIComponent(row.account_id));
}
// Poll a bounded batch so asynchronous Stripe verification is reflected even
// when the provider closes SkipperNow. Oldest checked accounts go first.
export async function refreshAccountStatuses(db,api=connectStripe){
  const rows=await checked(await db.from("connect_accounts").select("professional_id,account_id,account_api")
    .not("account_id","is",null).order("checked_at",{ascending:true,nullsFirst:true}).limit(10));
  await Promise.all(rows.map(async row=>{
    let patch={checked_at:new Date().toISOString()};
    try{patch={...patch,...{ready:accountReady(await retrieveAccount(row,api),row.account_api)}};}
    catch{ /* A later poll retries; transfer always rechecks Stripe before money moves. */ }
    await checked(await db.from("connect_accounts").update(patch).eq("professional_id",row.professional_id));
  }));
}
export function sessionOptions(row,account){
  const noStripeAuth=row.account_api==="v2"
    ? account.dashboard==="none" && account.defaults?.responsibilities?.requirements_collector==="application"
    : account.controller?.requirement_collection==="application";
  const body={account:row.account_id};
  for(const name of ["account_onboarding","account_management","notification_banner","payouts"]){
    body[`components[${name}][enabled]`]="true";
    // Stripe requires the bank-collection setting to match across components.
    // Collecting an IBAN does not grant permission to initiate a payout.
    body[`components[${name}][features][external_account_collection]`]="true";
    if(noStripeAuth) body[`components[${name}][features][disable_stripe_user_authentication]`]="true";
  }
  // Providers can inspect bank payouts but only SkipperNow controls money movements.
  body["components[payouts][features][standard_payouts]"]="false";
  // Instant payouts are disabled by default; do not grant that feature.
  body["components[payouts][features][edit_payout_schedule]"]="false";
  return body;
}
async function findExisting(owner,api){
  let cursor;
  const matches=[];
  for(let page=0;page<10;page++){
    const query=new URLSearchParams({limit:"100",...(cursor?{starting_after:cursor}:{})});
    const list=await api("v1/accounts?"+query);
    matches.push(...(list.data||[]).filter(a=>a.metadata?.professional_id===owner));
    if(!list.has_more){
      if(matches.length>1) throw new Error("Plusieurs comptes de versement existent. Contactez le support.");
      return matches[0]||null;
    }
    cursor=list.data?.at(-1)?.id;
    if(!cursor) break;
  }
  throw new Error("Vérification du compte de versement nécessaire. Contactez le support.");
}
export async function ensureAccount(db,owner,country,contactEmail,api=connectStripe,now=Date.now()){
  await checked(await db.from("connect_accounts").upsert({professional_id:owner},{onConflict:"professional_id",ignoreDuplicates:true}));
  // The query is thenable: await it before inspecting its result.
  let row=await checked(await db.from("connect_accounts").select("*").eq("professional_id",owner).single());
  if(row.account_id) return row;
  // Recover successful-but-unrecorded requests from either the old or new flow.
  const recovered=await findExisting(owner,api);
  if(recovered){
    await checked(await db.from("connect_accounts").update({account_id:recovered.id,account_api:recovered.metadata?.skippernow_account_api==="v2"?"v2":"v1"}).eq("professional_id",owner).is("account_id",null));
    return checked(await db.from("connect_accounts").select("*").eq("professional_id",owner).single());
  }
  if(!row.embedded_started_at){
    if(!/^[A-Z]{2}$/.test(country||"")) throw new Error("Choisissez le pays où votre activité est établie.");
    await checked(await db.from("connect_accounts").update({embedded_started_at:new Date(now).toISOString(),embedded_country:country})
      .eq("professional_id",owner).is("account_id",null).is("embedded_started_at",null));
    row=await checked(await db.from("connect_accounts").select("*").eq("professional_id",owner).single());
  }
  if(row.account_id) return row;
  // The payload stays identical on retry, including when a profile/country changes.
  // Never recreate after Stripe's 24h idempotency retention period.
  if(now-new Date(row.embedded_started_at).getTime()>23*60*60*1000)
    throw new Error("La création du compte doit être vérifiée par le support avant de reprendre.");
  if(!row.embedded_contact_email){
    // Snapshot the authenticated user's email once, including validation-failed
    // attempts from the previous release. Preserve the creation key and deadline.
    const email=typeof contactEmail==="string"?contactEmail.trim():"";
    accountPayload(owner,row.embedded_country,email);
    await checked(await db.from("connect_accounts").update({embedded_contact_email:email})
      .eq("professional_id",owner).is("account_id",null).is("embedded_contact_email",null));
    row=await checked(await db.from("connect_accounts").select("*").eq("professional_id",owner).single());
    if(row.account_id) return row;
  }
  const account=await api("v2/core/accounts",accountPayload(owner,row.embedded_country,row.embedded_contact_email),"connect-embedded-v2-"+row.creation_key);
  await checked(await db.from("connect_accounts").update({account_id:account.id,account_api:"v2"}).eq("professional_id",owner).is("account_id",null));
  row=await checked(await db.from("connect_accounts").select("*").eq("professional_id",owner).single());
  if(row.account_id!==account.id) throw new Error("Vérification du compte de versement nécessaire.");
  return row;
}
