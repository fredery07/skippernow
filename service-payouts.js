/* Authenticated service completion and Connect UI. No secret keys or money state writes. */
async function serviceRequest(action, missionId, extra={}){
  const {data:{session}}=await db.auth.getSession();
  if(!session) throw new Error("Connectez-vous pour continuer.");
  const isForm=extra instanceof FormData;
  const response=await fetch(SUPABASE_URL+"/functions/v1/service-payouts",{
    method:"POST",headers:{Authorization:"Bearer "+session.access_token,apikey:SUPABASE_KEY,...(isForm?{}:{"Content-Type":"application/json"})},
    body:isForm?extra:JSON.stringify({action,missionId,...extra})
  });
  const body=await response.json();
  if(!response.ok || body.error) throw new Error(body.error||"Opération indisponible");
  return body;
}
function serviceDialog(title){
  document.querySelector("#serviceDialog")?.remove();
  const dialog=document.createElement("dialog");dialog.id="serviceDialog";
  dialog.style.cssText="border:1px solid #dce8e9;border-radius:20px;padding:24px;width:min(520px,92vw);max-height:85vh;overflow:auto;color:#102b3f";
  dialog.innerHTML=`<button type="button" style="float:right" aria-label="Fermer">×</button><h2>${esc(title)}</h2><div class="service-dialog-body"></div>`;
  dialog.querySelector("button").onclick=()=>dialog.close();document.body.append(dialog);dialog.showModal();return dialog;
}
function openServiceCompletion(id){
  const dialog=serviceDialog("Terminer la prestation");
  dialog.querySelector(".service-dialog-body").innerHTML=`<form><p>Ajoutez une photo du bateau ou de la prestation réalisée. Elle sera visible uniquement par les parties de la mission et l’administration.</p><label>Photo obligatoire (JPEG, PNG, WebP · 8 Mo max.)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required style="display:block;margin:16px 0;max-width:100%"></label><p>La confirmation démarre un délai de 5 jours. L’administration peut verser avant ; sinon le transfert sera automatique si les versements sont activés, votre compte Stripe est prêt et aucun litige ou blocage n’est ouvert.</p><button class="primary" type="submit">Confirmer avec la photo</button><p role="status"></p></form>`;
  dialog.querySelector("form").onsubmit=async e=>{
    e.preventDefault(); const button=e.target.querySelector('[type="submit"]');const status=e.target.querySelector('[role="status"]');
    const photo=e.target.photo.files[0];if(!photo || photo.size>8388608){status.textContent="Choisissez une photo de 8 Mo maximum.";return;}
    button.disabled=true;status.textContent="Enregistrement de la preuve…";
    const form=new FormData();form.append("missionId",id);form.append("photo",photo);
    try{await serviceRequest("complete",id,form);dialog.close();await openDashboard();}
    catch(error){status.textContent=error.message;button.disabled=false;}
  };
}
async function showServiceProof(id){
  const dialog=serviceDialog("Photo de fin de prestation");const body=dialog.querySelector(".service-dialog-body");body.textContent="Chargement…";
  try{const result=await serviceRequest("proof",id);const img=document.createElement("img");img.alt="Preuve de fin de prestation";img.style.cssText="width:100%;height:auto";img.src=result.signedUrl;body.replaceChildren(img);}catch(error){body.textContent=error.message;}
}
function serviceSummary(c,j,enabled){
  if(j?.state==="transferred") return "Transfert Stripe confirmé. L’arrivée bancaire dépend du calendrier Stripe.";
  if(j) return "Versement engagé ou à vérifier. Aucun deuxième envoi automatique.";
  if(c.held) return "Versement suspendu par l’administration.";
  const when=new Date(c.due_at).toLocaleString(currentLang);
  return "Photo reçue. Échéance de versement : "+when+". "+(enabled?"Sous réserve d’un compte Stripe prêt et de l’absence de litige.":"Versements automatiques non activés pour le moment.");
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
    target.innerHTML=`<p class="note-box">${esc(serviceSummary(c,jobs.data.find(j=>j.mission_id===c.mission_id),settings.data.enabled))}</p><button class="small-btn" type="button">Voir la photo de fin</button>`;
    target.querySelector("button").onclick=()=>showServiceProof(c.mission_id);
  }
}
async function mountConnectSetup(main){
  const box=document.createElement("div");box.className="note-box";box.innerHTML=`<strong>Compte de versement</strong><p>Connectez votre compte Stripe pour recevoir vos versements et consulter leur arrivée bancaire.</p><p role="status">Vérification…</p><button class="small-btn" type="button" data-connect>Configurer les versements</button> <button class="small-btn" type="button" data-stripe hidden>Ouvrir mon espace Stripe</button>`;main.prepend(box);
  const message=box.querySelector('[role="status"]');
  for(const [selector,action] of [["[data-connect]","onboard"],["[data-stripe]","account_dashboard"]]) box.querySelector(selector).onclick=async e=>{
    e.target.disabled=true;
    try{const result=await serviceRequest(action);const url=new URL(result.url);if(url.protocol!=="https:" || !(url.hostname==="stripe.com" || url.hostname.endsWith(".stripe.com"))) throw new Error("Lien Stripe invalide");location.assign(url.href);}catch(error){message.textContent=error.message;e.target.disabled=false;}
  };
  try{const result=await serviceRequest("account_status");message.textContent=result.ready?"Compte Stripe prêt à recevoir les transferts.":result.connected?"Configuration Stripe à compléter.":"Aucun compte Stripe relié.";box.querySelector('[data-stripe]').hidden=!result.connected;}
  catch(error){message.textContent=error.message;}
}
async function renderServicePayoutAdmin(main,missions,byId){
  main.textContent="Chargement des versements…";
  const [cs,js,ss,acs]=await Promise.all([
    db.from("service_completions").select("mission_id,professional_id,due_at,held"),
    db.from("service_payouts").select("mission_id,state,error,transfer_id"),
    db.from("service_payout_settings").select("enabled").single(),
    db.from("connect_accounts").select("professional_id,ready")
  ]);
  if([cs,js,ss,acs].some(r=>r.error)){main.textContent="Impossible de charger les versements. Réessayez.";return;}
  const enabled=ss.data.enabled;
  const rows=missions.filter(m=>["paid","payout_ready","transferred","refund_requested"].includes(m.payment_status));
  const hasReadyAccount=acs.data.some(a=>a.ready);
  main.innerHTML=`<p class="note-box">${enabled?"Versements activés : manuellement ici, ou automatiquement 5 jours après la preuve photo, sans litige ni blocage.":"Versements non activés : configuration Stripe et vérification du parcours requises. Aucun transfert automatique ne part actuellement."} Un transfert Stripe n’est pas une confirmation d’arrivée sur le compte bancaire.</p><div class="request-actions"><button class="small-btn" type="button" data-toggle-payouts ${!enabled&&!hasReadyAccount?"disabled":""}>${enabled?"Suspendre les transferts":"Activer les transferts"}</button></div><p role="status" data-settings-status>${!enabled&&!hasReadyAccount?"Au moins un professionnel doit terminer la configuration Stripe avant l’activation.":""}</p>`;
  main.querySelector("[data-toggle-payouts]").onclick=async e=>{
    const next=!enabled;
    if(!confirm(next?"Activer les transferts réels et l’automatisation à J+5 ?":"Suspendre les nouveaux transferts manuels et automatiques ?")) return;
    e.target.disabled=true;
    try{await serviceRequest("set_enabled",undefined,{enabled:next});await renderAdminPanel("payouts");}
    catch(error){main.querySelector("[data-settings-status]").textContent=error.message;e.target.disabled=false;}
  };
  if(!rows.length) main.insertAdjacentHTML("beforeend",'<p class="empty-note">Aucun paiement à afficher.</p>');
  for(const m of rows){
    const c=cs.data.find(x=>x.mission_id===m.id),j=js.data.find(x=>x.mission_id===m.id);
    const pro=byId[m.provider_id||m.skipper_id];const account=acs.data.find(a=>a.professional_id===(m.provider_id||m.skipper_id));
    const blocked=m.dispute_status==="open" || !["paid","payout_ready"].includes(m.payment_status);
    const card=document.createElement("article");card.className="request-card";
    card.innerHTML=`<h3>${esc(m.port||"—")}</h3><p>${esc(pro?.full_name||"Professionnel non renseigné")} · ${esc(m.id.slice(0,8))}</p><strong>Net professionnel : ${moneyC(Math.max(0,Number(m.amount_cents||0)+Number(m.urgent_fee_cents||0)-Number(m.platform_fee_cents||0)),m.currency||"eur")}</strong><p>${esc(c?serviceSummary(c,j,enabled):"Ancienne mission sans preuve photo : aucun versement automatique programmé.")}</p><p>${blocked?"Litige, remboursement ou paiement à vérifier.":""} ${account?.ready?"Compte Stripe prêt.":"Compte Stripe du professionnel à configurer."}</p><div class="request-actions"></div><p role="status">${esc(j?.error||"")}</p>`;
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
