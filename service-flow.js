/* Authenticated service completion and Connect UI. No secret keys or money state writes. */
const SERVICE_I18N={
  fr:{login:"Connectez-vous pour continuer.",unavailable:"Opération indisponible",close:"Fermer",completeTitle:"Terminer la prestation",completeIntro:"Ajoutez une photo du bateau ou de la prestation réalisée. Elle sera visible uniquement par les parties de la mission et l’administration.",photoRequired:"Photo obligatoire (JPEG, PNG, WebP · 8 Mo max.)",completeDelay:"La confirmation démarre un délai de 5 jours. L’administration peut verser avant ; sinon le transfert sera automatique si les versements sont activés, vos coordonnées de versement sont vérifiées et aucun litige ou blocage n’est ouvert.",confirmPhoto:"Confirmer avec la photo",photoTooLarge:"Choisissez une photo de 8 Mo maximum.",savingProof:"Enregistrement de la preuve…",proofTitle:"Photo de fin de prestation",loading:"Chargement…",proofAlt:"Preuve de fin de prestation",transferred:"Transfert Stripe confirmé. L’arrivée bancaire dépend du calendrier Stripe.",payoutPending:"Versement engagé ou à vérifier. Aucun deuxième envoi automatique.",payoutHeld:"Versement suspendu par l’administration.",photoReceived:"Photo reçue. Échéance de versement : {date}.",payoutConditions:"Sous réserve de coordonnées de versement vérifiées et de l’absence de litige.",payoutDisabled:"Versements automatiques non activés pour le moment.",viewProof:"Voir la photo de fin",secureFormError:"Le formulaire sécurisé ne se charge pas. Vérifiez votre connexion puis réessayez.",sessionEnded:"Session terminée. Reconnectez-vous.",sessionEndedShort:"Session terminée.",payoutConfigSupport:"Configuration des versements à vérifier par le support.",payoutDetails:"Mes coordonnées de versement",payoutDetailsIntro:"Renseignez votre identité et votre IBAN ici pour recevoir vos versements. Votre compte SkipperNow suffit. Les informations sont transmises de façon sécurisée à notre partenaire de paiement Stripe.",checking:"Vérification…",businessCountry:"Pays où votre activité est établie",businessCountryAria:"Pays de votre activité",enterDetails:"Renseigner mes coordonnées",trackPayouts:"Suivre mes versements bancaires",refresh:"Actualiser",secureFormRefresh:"Le formulaire sécurisé ne se charge pas. Cliquez sur Actualiser pour réessayer.",detailsVerified:"Coordonnées vérifiées : vous pouvez recevoir des versements.",detailsSaved:"Vos informations sont enregistrées. Complétez les éléments demandés ou attendez leur vérification.",detailsNeeded:"Ajoutez vos coordonnées pour recevoir vos versements.",editDetails:"Compléter ou modifier mes coordonnées",openingSecure:"Ouverture du formulaire sécurisé…",closeForm:"Fermer le formulaire",loadingPayouts:"Chargement des versements…",payoutLoadError:"Impossible de charger les versements. Réessayez.",payoutsEnabled:"Versements activés : manuellement ici, ou automatiquement 5 jours après la preuve photo, sans litige ni blocage.",payoutsDisabledAdmin:"Versements non activés : configuration Stripe et vérification du parcours requises. Aucun transfert automatique ne part actuellement.",stripeTransferNote:"Un transfert Stripe n’est pas une confirmation d’arrivée sur le compte bancaire.",suspendTransfers:"Suspendre les transferts",activateTransfers:"Activer les transferts",needReadyAccount:"Au moins un professionnel doit terminer la configuration Stripe avant l’activation.",confirmEnable:"Activer les transferts réels et l’automatisation à J+5 ?",confirmSuspend:"Suspendre les nouveaux transferts manuels et automatiques ?",noPayments:"Aucun paiement à afficher.",unknownPro:"Professionnel non renseigné",netPro:"Net professionnel",legacyNoProof:sf("legacyNoProof"),blocked:sf("blocked"),detailsReady:sf("detailsReady"),detailsIncomplete:sf("detailsIncomplete"),viewPhoto:"Voir la photo",blockPayout:"Bloquer le versement",sendTransfer:"Effectuer le transfert Stripe",confirmTransfer:"Déclencher le transfert réel de cette mission vers le compte Stripe du professionnel ?",verifyTransfer:"Vérifier le transfert Stripe",adminNewRequest:"📩 {n} nouvelle(s) demande(s) envoyée(s)",needTitle:"Dites-nous ce dont vous avez besoin",needText:sf("needText"),freeRequest:sf("freeRequest"),freeTrust:sf("freeTrust"),viewProfile:sf("viewProfile"),professional:sf("professional")},
  en:{login:"Log in to continue.",unavailable:"Operation unavailable",close:"Close",completeTitle:"Complete the service",completeIntro:"Add a photo of the boat or completed service. It will only be visible to the parties to the booking and the administration.",photoRequired:"Required photo (JPEG, PNG, WebP · max. 8 MB)",completeDelay:"Confirmation starts a 5-day period. The administration may pay out earlier; otherwise the transfer will be automatic if payouts are enabled, your payout details are verified and there is no dispute or hold.",confirmPhoto:"Confirm with photo",photoTooLarge:"Choose a photo no larger than 8 MB.",savingProof:"Saving proof…",proofTitle:"Service completion photo",loading:"Loading…",proofAlt:"Service completion proof",transferred:"Stripe transfer confirmed. Bank arrival depends on Stripe's schedule.",payoutPending:"Payout initiated or awaiting verification. No second automatic transfer.",payoutHeld:"Payout suspended by the administration.",photoReceived:"Photo received. Payout due: {date}.",payoutConditions:"Subject to verified payout details and no dispute.",payoutDisabled:"Automatic payouts are not enabled yet.",viewProof:"View completion photo",secureFormError:"The secure form could not load. Check your connection and try again.",sessionEnded:"Session ended. Log in again.",sessionEndedShort:"Session ended.",payoutConfigSupport:"Payout configuration must be checked by support.",payoutDetails:"My payout details",payoutDetailsIntro:"Enter your identity and IBAN here to receive payouts. Your SkipperNow account is enough. The information is securely sent to our payment partner Stripe.",checking:"Checking…",businessCountry:"Country where your business is established",businessCountryAria:"Business country",enterDetails:"Enter my details",trackPayouts:"Track my bank payouts",refresh:"Refresh",secureFormRefresh:"The secure form could not load. Click Refresh to try again.",detailsVerified:"Details verified: you can receive payouts.",detailsSaved:"Your information is saved. Complete the requested items or wait for verification.",detailsNeeded:"Add your payout details to receive payouts.",editDetails:"Complete or edit my details",openingSecure:"Opening secure form…",closeForm:"Close form",loadingPayouts:"Loading payouts…",payoutLoadError:"Unable to load payouts. Try again.",payoutsEnabled:"Payouts enabled: manually here, or automatically 5 days after photo proof, with no dispute or hold.",payoutsDisabledAdmin:"Payouts disabled: Stripe configuration and flow verification are required. No automatic transfer is currently sent.",stripeTransferNote:"A Stripe transfer does not confirm arrival in the bank account.",suspendTransfers:"Suspend transfers",activateTransfers:"Enable transfers",needReadyAccount:"At least one professional must complete Stripe setup before activation.",confirmEnable:"Enable real transfers and J+5 automation?",confirmSuspend:"Suspend new manual and automatic transfers?",noPayments:"No payments to display.",unknownPro:"Professional not specified",netPro:"Professional net",legacyNoProof:"Older job without photo proof: no automatic payout scheduled.",blocked:"Dispute, refund or payment requires review.",detailsReady:"Payout details verified.",detailsIncomplete:"Professional payout details need to be completed.",viewPhoto:"View photo",blockPayout:"Block payout",sendTransfer:"Send Stripe transfer",confirmTransfer:"Send the real transfer for this job to the professional's Stripe account?",verifyTransfer:"Verify Stripe transfer",adminNewRequest:"📩 {n} new request(s) submitted",needTitle:"Tell us what you need",needText:"Send a free request: available skippers and service providers can reply directly with their price.",freeRequest:"Send a free request",freeTrust:"Free request · No commitment · Secure payment",viewProfile:"View profile",professional:"Professional"},
  es:{login:"Inicia sesión para continuar.",unavailable:"Operación no disponible",close:"Cerrar",completeTitle:"Finalizar el servicio",completeIntro:"Añade una foto del barco o del servicio realizado. Solo será visible para las partes del servicio y la administración.",photoRequired:"Foto obligatoria (JPEG, PNG, WebP · máximo 8 MB)",completeDelay:"La confirmación inicia un plazo de 5 días. La administración puede transferir antes; de lo contrario, la transferencia será automática si los pagos están activados, tus datos de cobro están verificados y no hay ninguna disputa o bloqueo.",confirmPhoto:"Confirmar con la foto",photoTooLarge:"Elige una foto de 8 MB como máximo.",savingProof:"Guardando la prueba…",proofTitle:"Foto de fin del servicio",loading:"Cargando…",proofAlt:"Prueba de finalización del servicio",transferred:"Transferencia de Stripe confirmada. La llegada al banco depende del calendario de Stripe.",payoutPending:"Transferencia iniciada o pendiente de verificación. No se realizará un segundo envío automático.",payoutHeld:"Transferencia suspendida por la administración.",photoReceived:"Foto recibida. Fecha prevista de transferencia: {date}.",payoutConditions:"Sujeto a datos de cobro verificados y a la ausencia de disputas.",payoutDisabled:"Las transferencias automáticas todavía no están activadas.",viewProof:"Ver la foto de finalización",secureFormError:"El formulario seguro no se carga. Comprueba tu conexión e inténtalo de nuevo.",sessionEnded:"La sesión ha terminado. Vuelve a iniciar sesión.",sessionEndedShort:"La sesión ha terminado.",payoutConfigSupport:"La configuración de las transferencias debe ser revisada por soporte.",payoutDetails:"Mis datos de cobro",payoutDetailsIntro:"Indica aquí tu identidad y tu IBAN para recibir transferencias. Tu cuenta de SkipperNow es suficiente. La información se envía de forma segura a nuestro socio de pagos Stripe.",checking:"Verificando…",businessCountry:"País donde está establecida tu actividad",businessCountryAria:"País de tu actividad",enterDetails:"Indicar mis datos",trackPayouts:"Seguir mis transferencias bancarias",refresh:"Actualizar",secureFormRefresh:"El formulario seguro no se carga. Pulsa Actualizar para volver a intentarlo.",detailsVerified:"Datos verificados: puedes recibir transferencias.",detailsSaved:"Tus datos están guardados. Completa los elementos solicitados o espera su verificación.",detailsNeeded:"Añade tus datos de cobro para recibir transferencias.",editDetails:"Completar o modificar mis datos",openingSecure:"Abriendo el formulario seguro…",closeForm:"Cerrar formulario",loadingPayouts:"Cargando transferencias…",payoutLoadError:"No se pudieron cargar las transferencias. Inténtalo de nuevo.",payoutsEnabled:"Transferencias activadas: manualmente aquí o automáticamente 5 días después de la prueba fotográfica, sin disputas ni bloqueos.",payoutsDisabledAdmin:"Transferencias desactivadas: se requiere configurar Stripe y verificar el proceso. Actualmente no se envía ninguna transferencia automática.",stripeTransferNote:"Una transferencia de Stripe no confirma la llegada a la cuenta bancaria.",suspendTransfers:"Suspender transferencias",activateTransfers:"Activar transferencias",needReadyAccount:"Al menos un profesional debe completar la configuración de Stripe antes de la activación.",confirmEnable:"¿Activar las transferencias reales y la automatización a los 5 días?",confirmSuspend:"¿Suspender las nuevas transferencias manuales y automáticas?",noPayments:"No hay pagos para mostrar.",unknownPro:"Profesional no indicado",netPro:"Neto profesional",legacyNoProof:"Servicio antiguo sin prueba fotográfica: no hay transferencia automática programada.",blocked:"Disputa, reembolso o pago pendiente de revisión.",detailsReady:"Datos de cobro verificados.",detailsIncomplete:"El profesional debe completar sus datos de cobro.",viewPhoto:"Ver foto",blockPayout:"Bloquear transferencia",sendTransfer:"Realizar transferencia Stripe",confirmTransfer:"¿Realizar la transferencia real de este servicio a la cuenta Stripe del profesional?",verifyTransfer:"Verificar transferencia Stripe",adminNewRequest:"📩 {n} nueva(s) solicitud(es) enviada(s)",needTitle:sf("needTitle"),needText:"Envía una solicitud gratuita: los skippers y profesionales disponibles pueden responderte directamente con su precio.",freeRequest:"Hacer una solicitud gratis",freeTrust:"Solicitud gratis · Sin compromiso · Pago seguro",viewProfile:"Ver perfil",professional:"Profesional"}
};
function sf(key,vars){let s=(SERVICE_I18N[currentLang]||SERVICE_I18N.fr)[key]||SERVICE_I18N.fr[key]||key;if(vars)for(const k in vars)s=s.replace("{"+k+"}",vars[k]);return s;}

async function serviceRequest(action, missionId, extra={}){
  const {data:{session}}=await db.auth.getSession();
  if(!session) throw new Error(sf("login"));
  const isForm=extra instanceof FormData;
  const response=await fetch(SUPABASE_URL+"/functions/v1/service-flow",{
    method:"POST",headers:{Authorization:"Bearer "+session.access_token,apikey:SUPABASE_KEY,...(isForm?{}:{"Content-Type":"application/json"})},
    body:isForm?extra:JSON.stringify({action,missionId,...extra})
  });
  const body=await response.json();
  if(!response.ok || body.error) throw new Error(body.error||sf("unavailable"));
  return body;
}
function serviceDialog(title){
  document.querySelector("#serviceDialog")?.remove();
  const dialog=document.createElement("dialog");dialog.id="serviceDialog";
  dialog.style.cssText="border:1px solid #dce8e9;border-radius:20px;padding:24px;width:min(520px,92vw);max-height:85vh;overflow:auto;color:#102b3f";
  dialog.innerHTML=`<button type="button" style="float:right" aria-label="${esc(sf("close"))}">×</button><h2>${esc(title)}</h2><div class="service-dialog-body"></div>`;
  dialog.querySelector("button").onclick=()=>dialog.close();document.body.append(dialog);dialog.showModal();return dialog;
}
function openServiceCompletion(id){
  const dialog=serviceDialog(sf("completeTitle"));
  dialog.querySelector(".service-dialog-body").innerHTML=`<form><p>${esc(sf("completeIntro"))}</p><label>${esc(sf("photoRequired"))}<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required style="display:block;margin:16px 0;max-width:100%"></label><p>${esc(sf("completeDelay"))}</p><button class="primary" type="submit">${esc(sf("confirmPhoto"))}</button><p role="status"></p></form>`;
  dialog.querySelector("form").onsubmit=async e=>{
    e.preventDefault(); const button=e.target.querySelector('[type="submit"]');const status=e.target.querySelector('[role="status"]');
    const photo=e.target.photo.files[0];if(!photo || photo.size>8388608){status.textContent=sf("photoTooLarge");return;}
    button.disabled=true;status.textContent=sf("savingProof");
    const form=new FormData();form.append("missionId",id);form.append("photo",photo);
    try{await serviceRequest("complete",id,form);dialog.close();await openDashboard();}
    catch(error){status.textContent=error.message;button.disabled=false;}
  };
}
async function showServiceProof(id){
  const dialog=serviceDialog(sf("proofTitle"));const body=dialog.querySelector(".service-dialog-body");body.textContent=sf("loading");
  try{const result=await serviceRequest("proof",id);const img=document.createElement("img");img.alt=sf("proofAlt");img.style.cssText="width:100%;height:auto";img.src=result.signedUrl;body.replaceChildren(img);}catch(error){body.textContent=error.message;}
}
function serviceSummary(c,j,enabled){
  if(j?.state==="transferred") return sf("transferred");
  if(j) return sf("payoutPending");
  if(c.held) return sf("payoutHeld");
  const when=new Date(c.due_at).toLocaleString(currentLang);
  return sf("photoReceived",{date:when})+" "+(enabled?sf("payoutConditions"):sf("payoutDisabled"));
}
async function mountServiceSummaries(main,rows){
  if(!rows.length) return;
  const ids=rows.map(m=>m.id).slice(0,100);
  const [completions,jobs,settings]=await Promise.all([
    db.from("service_completions").select("mission_id,due_at,held").in("mission_id",ids),
    db.from("service_payouts").select("mission_id,state").in("mission_id",ids),
    db.from("service_payout_settings").select("enabled").single()
  ]);
  if(!main.isConnected || completions.error || jobs.error || settings.error) return;
  for(const c of completions.data||[]){
    const target=main.querySelector(`[data-service-summary="${c.mission_id}"]`);
    if(!target) continue;
    target.innerHTML=`<p class="note-box">${esc(serviceSummary(c,jobs.data.find(j=>j.mission_id===c.mission_id),settings.data.enabled))}</p><button class="small-btn" type="button">${esc(sf("viewProof"))}</button>`;
    target.querySelector("button").onclick=()=>showServiceProof(c.mission_id);
  }
}
let connectScriptPromise;
let connectOwner=null, connectInstancePromise=null, connectGeneration=0;
function loadConnectScript(){
  if(window.StripeConnect?.init) return Promise.resolve(window.StripeConnect);
  if(connectScriptPromise) return connectScriptPromise;
  connectScriptPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://connect-js.stripe.com/v1.0/connect.js';script.async=true;
    const timer=setTimeout(()=>fail(),20000);
    function fail(){clearTimeout(timer);script.remove();connectScriptPromise=null;reject(new Error(sf('secureFormError')));}
    script.onerror=fail;
    window.StripeConnect=window.StripeConnect||{};
    window.StripeConnect.onLoad=()=>{clearTimeout(timer);resolve(window.StripeConnect);};
    script.onload=()=>{if(window.StripeConnect?.init){clearTimeout(timer);resolve(window.StripeConnect);}};
    document.head.append(script);
  });
  return connectScriptPromise;
}
function resetConnectSession(){
  connectGeneration++;
  const old=connectInstancePromise;connectInstancePromise=null;connectOwner=null;
  document.querySelectorAll('[data-connect-components]').forEach(el=>el.replaceChildren());
  if(old) old.then(instance=>instance.logout()).catch(()=>{});
}
async function connectInstance(country){
  const {data:{session}}=await db.auth.getSession();
  if(!session) throw new Error(sf('login'));
  const owner=session.user.id;
  if(connectOwner && connectOwner!==owner) resetConnectSession();
  if(connectInstancePromise) return connectInstancePromise;
  connectOwner=owner;
  const generation=connectGeneration;
  const fetchClientSecret=async()=>{
    const {data:{session:latest}}=await db.auth.getSession();
    if(generation!==connectGeneration || latest?.user.id!==owner) throw new Error(sf('sessionEnded'));
    const result=await serviceRequest('embedded_session',undefined,{country});
    if(generation!==connectGeneration) throw new Error(sf('sessionEndedShort'));
    if(result.livemode!==STRIPE_PUBLISHABLE_KEY.startsWith('pk_live_')) throw new Error(sf('payoutConfigSupport'));
    return result.client_secret;
  };
  connectInstancePromise=(async()=>{
    const sdk=await loadConnectScript();
    let firstSecret=await fetchClientSecret();
    return sdk.init({publishableKey:STRIPE_PUBLISHABLE_KEY,locale:currentLang||'fr',
      fetchClientSecret:async()=>{
        const {data:{session:latest}}=await db.auth.getSession();
        if(generation!==connectGeneration || latest?.user.id!==owner){firstSecret=null;throw new Error('Session terminée. Reconnectez-vous.');}
        if(firstSecret){const secret=firstSecret;firstSecret=null;return secret;}return fetchClientSecret();
      },
      appearance:{overlays:'dialog',variables:{colorPrimary:'#087f8c',colorText:'#102b3f',colorBackground:'#ffffff',borderRadius:'12px',fontFamily:'Arial, sans-serif'}}});
  })().catch(error=>{if(generation===connectGeneration){connectInstancePromise=null;connectOwner=null;}throw error;});
  return connectInstancePromise;
}
async function mountConnectSetup(main){
  const box=document.createElement('section');box.className='note-box';box.style.cssText='background:#f2fafa;min-width:0;';
  box.innerHTML=`<h3 style="margin-top:0">${esc(sf("payoutDetails"))}</h3><p>${esc(sf("payoutDetailsIntro"))}</p><p role="status" aria-live="polite">${esc(sf("checking"))}</p><div data-country hidden><label>${esc(sf("businessCountry"))} <select aria-label="${esc(sf("businessCountryAria"))}" style="display:block;width:100%;max-width:360px;padding:12px;margin:8px 0"></select></label></div><div class="request-actions"><button class="small-btn" type="button" data-connect disabled>${esc(sf("enterDetails"))}</button><button class="small-btn" type="button" data-payouts hidden>${esc(sf("trackPayouts"))}</button><button class="small-btn" type="button" data-refresh>${esc(sf("refresh"))}</button></div><div data-connect-components><div data-notifications></div><div data-form hidden style="margin-top:20px;background:white;padding:12px;border-radius:12px;min-width:0"></div></div>`;
  main.prepend(box);
  const message=box.querySelector('[role="status"]'), form=box.querySelector('[data-form]'), notices=box.querySelector('[data-notifications]');
  const start=box.querySelector('[data-connect]'),payouts=box.querySelector('[data-payouts]'),countryBox=box.querySelector('[data-country]'),select=box.querySelector('select');
  const countries='AD AE AL AR AT AU BE BG BH BR CA CH CI CL CM CO CR CY CZ DE DK DO DZ EE EG ES FI FR GB GF GI GP GR HK HR HU ID IE IL IN IS IT JP KE KR KW LI LT LU LV MA MC ME MG MQ MT MU MX MY NC NG NL NO NZ PA PE PF PH PL PM PT QA RE RO RS SA SE SG SI SK SN TH TN TR TW US VN ZA'.split(' ');
  const names=new Intl.DisplayNames([currentLang||'fr'],{type:'region'});
  for(const code of countries.sort((a,b)=>names.of(a).localeCompare(names.of(b)))){const option=document.createElement('option');option.value=code;option.textContent=names.of(code);select.append(option);}
  select.value='FR';
  let status=null,busy=false,noticeMounted=false,active=null;
  function component(instance,name){
    const el=instance.create(name);
    el.setOnLoadError(()=>{if(box.isConnected){message.textContent=sf('secureFormRefresh');active=null;}});
    el.setOnLoaderStart(()=>{if(box.isConnected) message.textContent='';});
    return el;
  }
  async function notifications(instance){
    if(noticeMounted || !box.isConnected) return;
    notices.replaceChildren(component(instance,'notification-banner'));noticeMounted=true;
  }
  async function refresh(){
    try{
      const result=await serviceRequest('account_status');if(!box.isConnected) return;
      status=result;
      message.textContent=result.ready?sf('detailsVerified'):result.connected?sf('detailsSaved'):sf('detailsNeeded');
      start.textContent=result.connected?sf('editDetails'):sf('enterDetails');start.disabled=false;
      payouts.hidden=!result.connected;countryBox.hidden=result.connected;
      if(result.country){select.value=result.country;select.disabled=true;}
      if(result.connected) await notifications(await connectInstance(result.country));
    }catch(error){if(box.isConnected) message.textContent=error.message;}
  }
  async function open(kind){
    if(busy || active===kind) return;busy=true;start.disabled=true;payouts.disabled=true;select.disabled=true;
    message.textContent=sf('openingSecure');
    try{
      const instance=await connectInstance(select.value);if(!box.isConnected) return;
      await notifications(instance);
      const el=component(instance,kind);active=kind;
      if(kind==='account-onboarding') el.setOnExit(()=>{active=null;form.hidden=true;form.replaceChildren();void refresh();});
      form.hidden=false;form.replaceChildren(el);
      const close=document.createElement('button');close.type='button';close.className='small-btn';close.textContent=sf('closeForm');close.style.marginTop='16px';
      close.onclick=()=>{active=null;form.hidden=true;form.replaceChildren();void refresh();};form.append(close);
      countryBox.hidden=true;payouts.hidden=false;
    }catch(error){if(box.isConnected){message.textContent=error.message;select.disabled=!!status?.country;}}
    finally{busy=false;start.disabled=false;payouts.disabled=false;}
  }
  start.onclick=()=>open(status?.ready?'account-management':'account-onboarding');
  payouts.onclick=()=>open('payouts');
  box.querySelector('[data-refresh]').onclick=async()=>{active=null;form.hidden=true;form.replaceChildren();notices.replaceChildren();noticeMounted=false;await refresh();};
  await refresh();
}
if(typeof db!=='undefined') db.auth.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_OUT' || (connectOwner && session?.user.id!==connectOwner)) resetConnectSession();
});

async function renderServicePayoutAdmin(main,missions,byId){
  main.textContent=sf("loadingPayouts");
  const [cs,js,ss,acs]=await Promise.all([
    db.from("service_completions").select("mission_id,professional_id,due_at,held"),
    db.from("service_payouts").select("mission_id,state,error,transfer_id"),
    db.from("service_payout_settings").select("enabled").single(),
    db.from("connect_accounts").select("professional_id,ready")
  ]);
  if([cs,js,ss,acs].some(r=>r.error)){main.textContent=sf("payoutLoadError");return;}
  const enabled=ss.data.enabled;
  const rows=missions.filter(m=>["paid","payout_ready","transferred","refund_requested"].includes(m.payment_status));
  const hasReadyAccount=acs.data.some(a=>a.ready);
  main.innerHTML=`<p class="note-box">${esc(enabled?sf("payoutsEnabled"):sf("payoutsDisabledAdmin"))} ${esc(sf("stripeTransferNote"))}</p><div class="request-actions"><button class="small-btn" type="button" data-toggle-payouts ${!enabled&&!hasReadyAccount?"disabled":""}>${esc(enabled?sf("suspendTransfers"):sf("activateTransfers"))}</button></div><p role="status" data-settings-status>${!enabled&&!hasReadyAccount?esc(sf("needReadyAccount")):""}</p>`;
  main.querySelector("[data-toggle-payouts]").onclick=async e=>{
    const next=!enabled;
    if(!confirm(next?sf("confirmEnable"):sf("confirmSuspend"))) return;
    e.target.disabled=true;
    try{await serviceRequest("set_enabled",undefined,{enabled:next});await renderAdminPanel("payouts");}
    catch(error){main.querySelector("[data-settings-status]").textContent=error.message;e.target.disabled=false;}
  };
  if(!rows.length) main.insertAdjacentHTML("beforeend",`<p class="empty-note">${esc(sf("noPayments"))}</p>`);
  for(const m of rows){
    const c=cs.data.find(x=>x.mission_id===m.id),j=js.data.find(x=>x.mission_id===m.id);
    const pro=byId[m.provider_id||m.skipper_id];const account=acs.data.find(a=>a.professional_id===(m.provider_id||m.skipper_id));
    const blocked=m.dispute_status==="open" || !["paid","payout_ready"].includes(m.payment_status);
    const card=document.createElement("article");card.className="request-card";card.tabIndex=0;card.setAttribute("role","button");card.dataset.adminDetail="mission";card.dataset.adminId=m.id;
    card.innerHTML=`<h3>${esc(m.port||"—")}</h3><p>${esc(pro?.full_name||sf("unknownPro"))} · ${esc(m.id.slice(0,8))}</p><strong>${esc(sf("netPro"))} : ${moneyC(Math.max(0,Number(m.amount_cents||0)+Number(m.urgent_fee_cents||0)-Number(m.platform_fee_cents||0)),m.currency||"eur")}</strong><p>${esc(c?serviceSummary(c,j,enabled):"Ancienne mission sans preuve photo : aucun versement automatique programmé.")}</p><p>${blocked?"Litige, remboursement ou paiement à vérifier.":""} ${account?.ready?"Coordonnées de versement vérifiées.":"Coordonnées de versement du professionnel à compléter."}</p><div class="request-actions"></div><p role="status">${esc(j?.error||"")}</p>`;
    const actions=card.querySelector(".request-actions");
    function button(label,action,disabled=false){const b=document.createElement("button");b.className="small-btn";b.textContent=label;b.disabled=disabled;b.onclick=async()=>{b.disabled=true;try{await action();}catch(e){card.querySelector('[role="status"]').textContent=e.message;}finally{b.disabled=disabled;}};actions.append(b);}
    if(c){
      button("Voir la photo",()=>showServiceProof(m.id));
      if(!j){
        button(c.held?"Lever le blocage":"Bloquer le versement",async()=>{await serviceRequest("hold",m.id,{held:!c.held});await renderAdminPanel("payouts");});
        button("Effectuer le transfert Stripe",async()=>{if(!confirm("Déclencher le transfert réel de cette mission vers le compte Stripe du professionnel ?")) return;await serviceRequest("transfer",m.id);await renderAdminPanel("payouts");},!enabled || blocked || c.held || !account?.ready);
      }
    }
    if(j && j.state!=="transferred") button("Vérifier le transfert Stripe",async()=>{await serviceRequest("reconcile",m.id);await renderAdminPanel("payouts");});
    main.append(card);
  }
}

/* Admin activity notifications: new accounts + new requests. */
const baseRefreshNotifications = refreshNotifications;
function adminSeenKey(kind){
  return `skippernow-admin-${kind}-seen-${currentUser?.id||"anon"}`;
}
function adminLatestDate(rows){
  return (rows||[]).reduce((latest,row)=>row?.created_at && (!latest || row.created_at>latest) ? row.created_at : latest, "");
}
function adminSetNavBadge(panel,count){
  const btn=document.querySelector(`.dash-side button[data-panel="${panel}"]`);
  if(!btn) return;
  let badge=btn.querySelector("[data-admin-activity-badge]");
  if(!count){ badge?.remove(); return; }
  if(!badge){
    badge=document.createElement("span");
    badge.dataset.adminActivityBadge="1";
    badge.style.cssText="margin-left:auto;background:#c0392b;color:#fff;border-radius:999px;min-width:19px;height:19px;padding:0 5px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:900";
    btn.style.display="flex";btn.style.alignItems="center";btn.style.gap="8px";
    btn.append(badge);
  }
  badge.textContent=count>9?"9+":String(count);
}
async function adminOpenActivity(panel,kind,latest){
  if(latest) localStorage.setItem(adminSeenKey(kind),latest);
  document.querySelector("#notifPanel").style.display="none";
  await openDashboard();
  document.querySelectorAll(".dash-side button").forEach(b=>b.classList.toggle("active",b.dataset.panel===panel));
  await renderAdminPanel(panel);
  await refreshNotifications();
}
async function enhanceAdminNotifications(){
  if(!currentUser || currentProfile?.role!=="admin") return;
  const usersKey=adminSeenKey("users");
  const requestsKey=adminSeenKey("requests");
  let seenUsers=localStorage.getItem(usersKey);
  let seenRequests=localStorage.getItem(requestsKey);
  if(!seenUsers || !seenRequests){
    const [lastUser,lastRequest]=await Promise.all([
      db.from("profiles").select("created_at").order("created_at",{ascending:false}).limit(1),
      db.from("missions").select("created_at").order("created_at",{ascending:false}).limit(1)
    ]);
    const now=new Date().toISOString();
    if(!seenUsers){seenUsers=lastUser.data?.[0]?.created_at||now;localStorage.setItem(usersKey,seenUsers);}
    if(!seenRequests){seenRequests=lastRequest.data?.[0]?.created_at||now;localStorage.setItem(requestsKey,seenRequests);}
  }
  const [usersRes,requestsRes]=await Promise.all([
    db.from("profiles").select("id,full_name,role,created_at").gt("created_at",seenUsers).order("created_at",{ascending:false}).limit(50),
    db.from("missions").select("id,port,activity,created_at,client_id").gt("created_at",seenRequests).order("created_at",{ascending:false}).limit(50)
  ]);
  const newUsers=usersRes.data||[];
  const newRequests=requestsRes.data||[];
  const latestUsers=adminLatestDate(newUsers);
  const latestRequests=adminLatestDate(newRequests);
  adminSetNavBadge("users",newUsers.length);
  adminSetNavBadge("missions",newRequests.length);
  const panel=document.querySelector("#notifPanel");
  if(!panel) return;
  if(newUsers.length || newRequests.length) panel.querySelector(".empty-note")?.remove();
  const makeButton=(label,panelId,kind,latest)=>{
    const button=document.createElement("button");button.type="button";button.className="request-card";
    button.style.cssText="width:100%;text-align:left;cursor:pointer;display:block;margin-bottom:6px;border-color:#b9e9e4;background:#f2fafa";
    button.textContent=label;button.addEventListener("click",()=>adminOpenActivity(panelId,kind,latest));return button;
  };
  if(newRequests.length) panel.prepend(makeButton(`📩 ${newRequests.length} nouvelle${newRequests.length>1?"s":""} demande${newRequests.length>1?"s":""} envoyée${newRequests.length>1?"s":""}`,"missions","requests",latestRequests));
  if(newUsers.length) panel.prepend(makeButton(`👤 ${newUsers.length} nouvel${newUsers.length>1?"s":""} utilisateur${newUsers.length>1?"s":""}`,"users","users",latestUsers));
  const extra=newUsers.length+newRequests.length;
  if(extra){
    const badge=document.querySelector("#notifBadge");
    const base=badge.style.display==="none"?0:(badge.textContent==="9+"?9:Number(badge.textContent)||0);
    const total=base+extra;badge.textContent=total>9?"9+":String(total);badge.style.display="flex";
  }
  [["users",usersKey,latestUsers],["missions",requestsKey,latestRequests]].forEach(([panelId,key,latest])=>{
    const btn=document.querySelector(`.dash-side button[data-panel="${panelId}"]`);
    if(btn && !btn.dataset.adminSeenBound){
      btn.dataset.adminSeenBound="1";btn.addEventListener("click",()=>{
        const stamp=panelId==="users"?latestUsers:latestRequests;
        if(stamp) localStorage.setItem(key,stamp);setTimeout(()=>refreshNotifications(),0);
      });
    }
  });
}
refreshNotifications = async function(){
  await baseRefreshNotifications();
  try{await enhanceAdminNotifications();}catch(error){console.warn("Admin notifications:",error);}
};

/* Homepage conversion boost: make the free request the clearest next step. */
function conversionCopy(){
  if((window.currentLang||"fr")==="en") return {title:"Tell us what you need",subtitle:"Send one free request and available skippers or marine professionals can reply with their price.",cta:"Send my free request",hero:"Get offers from available professionals",proof:"Free request · No commitment · Secure payment",profiles:"Available professionals right now",view:"View profile"};
  if((window.currentLang||"fr")==="es") return {title:"Dinos qué necesitas",subtitle:"Envía una solicitud gratuita y los skippers o profesionales disponibles podrán responderte con su precio.",cta:"Enviar mi solicitud gratis",hero:"Recibir propuestas de profesionales disponibles",proof:"Solicitud gratis · Sin compromiso · Pago seguro",profiles:"Profesionales disponibles ahora",view:"Ver perfil"};
  return {title:"Dites-nous simplement ce qu’il vous faut",subtitle:"Envoyez une demande gratuite : les skippers et prestataires disponibles peuvent vous répondre directement avec leur tarif.",cta:"Faire une demande gratuitement",hero:"Recevoir des propositions de professionnels disponibles",proof:"Demande gratuite · Sans engagement · Paiement sécurisé",profiles:"Professionnels disponibles maintenant",view:"Voir le profil"};
}
function openConversionRequest(source){
  try{if(typeof trackBookingEvent==="function") trackBookingEvent("conversion_cta_clicked",{source});}catch(_e){}
  if(typeof openQuickRequest==="function") openQuickRequest();
}
async function mountConversionProfiles(anchor){
  if(!anchor || document.querySelector("#conversionProfiles")) return;
  try{
    const {data,error}=await db.from("profiles").select("id,full_name,home_port,profile_photo_url,provider_activity").eq("verified",true).eq("available",true).in("role",["skipper","provider"]).order("created_at",{ascending:false}).limit(3);
    if(error || !data?.length) return;
    const c=conversionCopy();
    const section=document.createElement("section");section.id="conversionProfiles";
    section.style.cssText="margin:18px 0 28px;padding:18px;border:1px solid var(--line);border-radius:20px;background:#fff;box-shadow:0 8px 24px rgba(16,43,63,.05)";
    section.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px"><strong style="color:var(--navy);font-size:16px">${esc(c.profiles)}</strong><span style="font-size:12px;color:var(--ok);font-weight:800">● En ligne</span></div><div style="display:grid;grid-template-columns:repeat(${Math.min(data.length,3)},1fr);gap:10px">${data.map(p=>`<button type="button" data-conversion-profile="${p.id}" style="border:1px solid var(--line);background:#fafdfd;border-radius:14px;padding:12px;text-align:left;cursor:pointer;min-width:0"><div style="display:flex;align-items:center;gap:10px">${p.profile_photo_url?`<img src="${esc(p.profile_photo_url)}" alt="" style="width:44px;height:44px;border-radius:50%;object-fit:cover">`:`<span style="width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--mist);font-size:20px">⚓</span>`}<div style="min-width:0"><strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.full_name||"Professionnel")}</strong><small style="color:var(--muted)">${esc(p.home_port||"")}</small></div></div><span style="display:block;margin-top:8px;color:var(--navy);font-size:12px;font-weight:800">${esc(c.view)} →</span></button>`).join("")}</div>`;
    anchor.insertAdjacentElement("afterend",section);
    section.querySelectorAll("[data-conversion-profile]").forEach(btn=>btn.addEventListener("click",()=>openProfileDetail(btn.dataset.conversionProfile)));
  }catch(_e){}
}
function mountHomepageConversionBoost(){
  const quick=document.querySelector(".quick-request-bar");
  const quickBtn=document.querySelector("#quickRequestBtn");
  if(!quick || !quickBtn || document.body.dataset.conversionBoost==="1") return;
  document.body.dataset.conversionBoost="1";
  const c=conversionCopy();
  const strong=quick.querySelector(".quick-request-copy strong");
  const sub=quick.querySelector(".quick-request-copy span");
  if(strong) strong.textContent=c.title;
  if(sub) sub.textContent=c.subtitle;
  quickBtn.textContent=c.cta;
  quick.style.border="2px solid var(--aqua)";
  quick.style.boxShadow="0 12px 32px rgba(13,102,114,.13)";
  const proof=document.createElement("div");proof.style.cssText="font-size:12px;color:var(--muted);font-weight:700;margin:-2px 0 12px 24px";proof.textContent="✓ "+c.proof;quick.insertAdjacentElement("afterend",proof);
  const hero=document.querySelector(".hero-cta");
  if(hero && !document.querySelector("#heroConversionRequest")){
    const btn=document.createElement("button");btn.id="heroConversionRequest";btn.type="button";btn.className="primary";btn.textContent=c.hero;btn.addEventListener("click",()=>openConversionRequest("hero"));hero.prepend(btn);
  }
  quickBtn.addEventListener("click",()=>{try{if(typeof trackBookingEvent==="function") trackBookingEvent("conversion_cta_clicked",{source:"quick_bar"});}catch(_e){}});
  const style=document.createElement("style");style.textContent=`#mobileConversionCta{display:none}@media(max-width:720px){body{padding-bottom:76px}#mobileConversionCta{display:block;position:fixed;left:12px;right:12px;bottom:10px;z-index:999;border:0;border-radius:15px;background:var(--aqua);color:var(--navy);font-weight:900;padding:15px 16px;box-shadow:0 12px 34px rgba(7,29,50,.28);font-size:15px}.quick-request-bar{border-width:2px!important}.quick-request-copy strong{font-size:18px!important}#conversionProfiles>div:nth-child(2){grid-template-columns:1fr!important}}`;document.head.append(style);
  const mobile=document.createElement("button");mobile.id="mobileConversionCta";mobile.type="button";mobile.textContent="⚓ "+c.cta;mobile.addEventListener("click",()=>openConversionRequest("mobile_sticky"));document.body.append(mobile);
  mountConversionProfiles(proof);
}
setTimeout(mountHomepageConversionBoost,0);
