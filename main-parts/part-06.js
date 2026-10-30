"use strict";
async function ownerDashboardData(){
  const [{data:boats,error:boatError},{data:missions,error:missionError}]=await Promise.all([
    db.from("boats").select("*").eq("client_id",currentUser.id).in("listing_type",["rental","both"]).order("created_at",{ascending:false}),
    db.from("missions").select("*").eq("skipper_id",currentUser.id).order("created_at",{ascending:false})
  ]);
  return {boats:boats||[],missions:missions||[],boatError,missionError};
}
async function renderOwnerDashboard(){
  const nav=[
    {id:"owner-overview",label:ownerLabel("Vue d’ensemble","Overview","Resumen"),group:ownerLabel("GESTION LOCATIONS","RENTAL MANAGEMENT","GESTIÓN DE ALQUILERES")},
    {id:"boats",label:ownerLabel("Mes bateaux","My boats","Mis barcos")},
    {id:"owner-bookings",label:ownerLabel("Réservations reçues","Received bookings","Reservas recibidas")},
    {id:"quotes",label:ownerLabel("Mes devis","My quotes","Mis presupuestos")},
    {id:"owner-calendar",label:ownerLabel("Planning","Calendar","Calendario")},
    {id:"owner-availability",label:ownerLabel("Calendrier & tarifs","Availability & rates","Calendario y tarifas")},
    {id:"owner-revenue",label:ownerLabel("Revenus","Revenue","Ingresos"),group:ownerLabel("FINANCES","FINANCE","FINANZAS")},
    {id:"messages",label:t("dash.navMessages"),group:ownerLabel("MON COMPTE","ACCOUNT","MI CUENTA")},
    {id:"profile",label:t("dash.navProfile")},
    {id:"support",label:t("dash.navSupport")}
  ];
  document.querySelector("#dashRole").textContent=ownerLabel("ESPACE LOUEUR","BOAT OWNER","ESPACIO PROPIETARIO");
  document.querySelector("#dashTitle").textContent=ownerLabel("Tableau de bord loueur","Owner dashboard","Panel del propietario");
  document.querySelector("#dashboardBody").innerHTML=dashShell(nav,"owner-overview");
  bindDashNav(renderOwnerPanel);
  await renderOwnerPanel("owner-overview");
}
async function renderOwnerPanel(panel){
  refreshDashboardIdentity(panel);
  if(panel==="quotes"){await renderClientPanel("quotes");return;}
  const main=document.querySelector("#dashMain");
  if(panel==="boats") {await renderBoatsManager(main,()=>renderOwnerPanel("boats"));return;}
  if(panel==="owner-availability"){if(typeof window.renderOwnerAvailability==="function")await window.renderOwnerAvailability(main);else main.innerHTML="<div class=\"empty-note\">Actualisez la page pour charger le calendrier.</div>";return;}
  if(panel==="messages"){await renderMessagesPanel("skipper_id");return;}
  if(panel==="profile"){main.innerHTML=profileForm(currentProfile);bindProfileForm();return;}
  if(panel==="support"){await openSupportThread();return;}
  main.innerHTML='<div class="empty-note">Chargement…</div>';
  const {boats,missions,boatError,missionError}=await ownerDashboardData();
  if(boatError||missionError){
    main.innerHTML='<div class="empty-note">'+esc(ownerLabel("Impossible de charger les données. Actualisez la page.","Unable to load data. Refresh the page.","No se pudieron cargar los datos. Actualiza la página."))+'</div>';return;
  }
  const paid=missions.filter(m=>["paid","payout_ready","transferred"].includes(m.payment_status));
  const gross=paid.reduce((n,m)=>n+Number(m.amount_cents||0)+Number(m.urgent_fee_cents||0),0);
  const completed=missions.filter(m=>m.status==="completed").length;
  const pending=missions.filter(m=>["pending","quoted","accepted"].includes(m.status)).length;
  const upcoming=missions.filter(m=>m.starts_at&&new Date(m.starts_at)>=new Date()&&!["completed","cancelled","declined","rejected"].includes(m.status)).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
  const kpi=(label,value,sub)=>`<div class="request-card" style="padding:18px;min-width:0;border:1px solid #d5e5e7;border-radius:16px"><div class="muted" style="font-weight:700;font-size:13px">${esc(label)}</div><strong style="display:block;font-size:27px;margin:8px 0;color:#07394b">${esc(String(value))}</strong><small class="muted">${esc(sub)}</small></div>`;
  const readiness=[
    {ok:Boolean(currentProfile?.full_name&&currentProfile?.phone&&currentProfile?.home_port),label:ownerLabel("Compléter mon profil et mes coordonnées","Complete my profile","Completar mi perfil"),target:"profile"},
    {ok:boats.length>0,label:ownerLabel("Ajouter mon premier bateau","List my first boat","Publicar mi primer barco"),target:"boats"},
    {ok:boats.some(b=>b.photo_url||Array.isArray(b.photo_urls)&&b.photo_urls.length),label:ownerLabel("Ajouter des photos à mon annonce","Add boat photos","Añadir fotos"),target:"boats"},
    {ok:boats.some(b=>Number(b.price_per_day)>0||Number(b.price_half_day)>0),label:ownerLabel("Renseigner mes tarifs de location","Set rental prices","Indicar precios"),target:"boats"}
  ];
  const done=readiness.filter(x=>x.ok).length;
  const onboarding=`<section class="note-box" style="margin-bottom:16px;background:#f2fbfa;border:1px solid #b8e4dd;border-radius:16px;padding:18px">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><strong style="font-size:17px;color:#07394b">${esc(ownerLabel("Bien démarrer sur SkipperNow","Getting started on SkipperNow","Primeros pasos en SkipperNow"))}</strong><span class="tag">${done}/${readiness.length}</span></div>
    <p style="color:#436371;margin:8px 0 12px">${esc(ownerLabel("Suivez ces étapes pour mettre votre bateau en location et recevoir vos premières demandes.","Follow these steps to publish your boat and start receiving requests.","Sigue estos pasos para publicar tu barco y recibir solicitudes."))}</p>
    <div style="height:8px;background:#c8dddd;border-radius:20px;overflow:hidden;margin-bottom:12px"><div style="height:100%;width:${done/readiness.length*100}%;background:#0b9c8d"></div></div>
    <div style="display:grid;gap:8px">${readiness.map(x=>`<button type="button" data-owner-target="${x.target}" style="width:100%;text-align:left;padding:11px 13px;background:white;border:1px solid #c8dde0;border-radius:10px;color:#123b4b;font-weight:700;cursor:pointer">${x.ok?"✅":"○"} ${esc(x.label)} ${x.ok?"":" →"}</button>`).join("")}</div>
  </section>`;
  const metrics=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px;margin:16px 0 22px">
    ${kpi(ownerLabel("Bateaux enregistrés","Listed boats","Barcos registrados"),boats.length,ownerLabel("Annonces à gérer","Listings to manage","Anuncios para gestionar"))}
    ${kpi(ownerLabel("Demandes en attente","Pending requests","Solicitudes pendientes"),pending,ownerLabel("Réservations reçues","Booking requests","Reservas recibidas"))}
    ${kpi(ownerLabel("Missions terminées","Completed jobs","Servicios terminados"),completed,ownerLabel("Historique","History","Historial"))}
    ${kpi(ownerLabel("Montants payés","Paid amounts","Importes pagados"),money(gross),ownerLabel("Montant brut, hors frais","Gross before fees","Bruto antes de comisiones"))}
  </div>`;
  const action=(target,label)=>`<button type="button" class="small-btn fill" data-owner-target="${target}">${esc(label)}</button>`;
  const welcome=`<section style="background:linear-gradient(120deg,#07384b,#087f8c);padding:22px;border-radius:18px;color:white;margin-bottom:16px">
     <small style="color:#c4f3f0;letter-spacing:.08em;font-weight:800">${esc(ownerLabel("CENTRE DE LOCATION","RENTAL CENTER","CENTRO DE ALQUILER"))}</small>
     <h3 style="color:white;margin:10px 0;font-size:23px">${esc(ownerLabel("Gérez vos locations depuis un seul espace","Manage your rentals in one place","Gestiona tus alquileres en un solo lugar"))}</h3>
     <p style="color:#e2f3f3;margin:0 0 16px">${esc(ownerLabel("Vos annonces, demandes, échéances et revenus sont regroupés ici.","Listings, requests, schedule and earnings in one place.","Tus anuncios, reservas, calendario e ingresos en un solo lugar."))}</p>
     <div style="display:flex;gap:8px;flex-wrap:wrap">${action("boats",ownerLabel("Gérer mes bateaux","Manage boats","Gestionar barcos"))} ${action("owner-bookings",ownerLabel("Voir les réservations","View bookings","Ver reservas"))}</div>
  </section>`;
  const cards=items=>items.length?items.map(m=>requestCard(m,"pro",new Set())).join(""):`<div class="empty-note">${esc(ownerLabel("Aucune réservation pour le moment.","No bookings yet.","Todavía no hay reservas."))}</div>`;
  if(panel==="owner-overview"){
    main.innerHTML=welcome+(done<readiness.length?onboarding:"")+metrics+`<div class="panel-head"><h3>${esc(ownerLabel("Dernières demandes","Latest requests","Últimas solicitudes"))}</h3></div><div class="request-list">${cards(missions.slice(0,5))}</div>`;
  }else if(panel==="owner-bookings"){
    main.innerHTML=`<h3>${esc(ownerLabel("Réservations reçues","Received bookings","Reservas recibidas"))}</h3><p class="muted">${esc(ownerLabel("Demandes liées à votre compte loueur.","Requests linked to your owner account.","Solicitudes vinculadas a tu cuenta."))}</p><div class="request-list">${cards(missions)}</div>`;
  }else if(panel==="owner-calendar"){
    main.innerHTML=`<h3>${esc(ownerLabel("Prochaines réservations","Upcoming bookings","Próximas reservas"))}</h3><div class="request-list">${cards(upcoming)}</div>`;
  }else if(panel==="owner-revenue"){
    main.innerHTML=`<h3>${esc(ownerLabel("Suivi financier","Financial overview","Resumen financiero"))}</h3><div class="note-box">${esc(ownerLabel("Les montants correspondent aux paiements enregistrés, avant commission et versement. Ils ne représentent pas nécessairement votre solde disponible.","Figures reflect recorded payments before fees and payouts, not available balance.","Los importes reflejan pagos registrados antes de comisiones y transferencias."))}</div>${metrics}<div class="request-list">${cards(paid)}</div>`;
  }
  main.querySelectorAll("[data-owner-target]").forEach(btn=>btn.addEventListener("click",()=>main.closest(".dash-shell").querySelector(`.dash-side [data-panel="${btn.dataset.ownerTarget}"]`)?.click()));
  bindRequestActions();
}

function clientProfileCompletionNotice(){
  if(currentProfile?.phone && currentProfile?.home_port) return "";
  const copy = ({
    fr:{title:"Complétez votre profil",text:"Ajoutez vos coordonnées après votre première connexion pour faciliter le suivi de vos réservations.",cta:"Compléter mon profil"},
    en:{title:"Complete your profile",text:"Add your contact details after signing in to make booking follow-up easier.",cta:"Complete my profile"},
    es:{title:"Completa tu perfil",text:"Añade tus datos de contacto después de iniciar sesión para facilitar el seguimiento de tus reservas.",cta:"Completar mi perfil"}
  })[currentLang] || null;
  const c = copy || {title:"Complétez votre profil",text:"Ajoutez vos coordonnées pour faciliter le suivi de vos réservations.",cta:"Compléter mon profil"};
  return `<div class="note-box" data-client-profile-reminder style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:14px"><div><strong>${esc(c.title)}</strong><div class="muted" style="margin-top:4px">${esc(c.text)}</div></div><button type="button" class="small-btn fill" data-open-client-profile>${esc(c.cta)} →</button></div>`;
}
async function renderClientPanel(panel){
  refreshDashboardIdentity(panel);
  const main = document.querySelector("#dashMain");
  if(panel === "quotes"){
    main.innerHTML = '<div class="empty-note">Chargement des devis…</div>';
    const {data,error}=await db.from("missions").select("*").eq("client_id",currentUser.id).in("status",["quoted","accepted","paid","in_progress","awaiting_validation","completed"]).order("created_at",{ascending:false});
    if(error){main.innerHTML='<div class="empty-note">'+esc(saleText("Impossible de charger les devis. Réessayez.","Unable to load quotes. Please try again.","No se pudieron cargar los presupuestos."))+'</div>';return;}
    const rows=data||[];
    main.innerHTML='<h3>'+esc(saleText("Mes devis","My quotes","Mis presupuestos"))+'</h3><p class="muted">'+esc(saleText("Retrouvez ici les devis associés à vos demandes et réglez ceux en attente.","Find quotes associated with your requests and pay those pending.","Consulta los presupuestos de tus solicitudes."))+'</p>'+ (rows.length?rows.map(m=>requestCard(m,"client",new Set())).join(""):'<div class="empty-note">'+esc(t("dash.noRequests"))+'</div>');
    bindRequestActions();
    if(typeof window.showCleaningQuotes==="function"){
      const btn=document.createElement("button");btn.className="small-btn fill";btn.type="button";btn.textContent=saleText("Voir les devis de nettoyage","View cleaning quotes","Ver presupuestos de limpieza");btn.addEventListener("click",window.showCleaningQuotes);main.prepend(btn);
    }
    return;
  }
  if(panel === "requests"){
    // Un compte "client" peut aussi être propriétaire de bateau : il doit
    // donc voir à la fois les demandes qu'il a envoyées (client_id) ET les
    // demandes de location reçues pour son/ses bateau(x) (skipper_id), sinon
    // ces dernières restent invisibles pour lui.
    const {data} = await db.from("missions").select("*").or(`client_id.eq.${currentUser.id},skipper_id.eq.${currentUser.id}`).order("created_at",{ascending:false});
    let rows = data || [];
    const pendingChecks=rows.filter(m=>m.client_id===currentUser.id && m.status==='accepted' && m.stripe_payment_intent_id && ['unpaid','failed',null].includes(m.payment_status));
    let reconciled=false;
    for(const m of pendingChecks){try{const result=await paymentCall('clever-processor',{missionId:m.id});if(result.ok) reconciled=true;}catch(_error){/* Keep the request visible so the client can retry. */}}
    if(reconciled){const refreshed=await db.from('missions').select('*').or(`client_id.eq.${currentUser.id},skipper_id.eq.${currentUser.id}`).order('created_at',{ascending:false});if(!refreshed.error) rows=refreshed.data||rows;}
    const {data: reviewedRows} = await db.from("reviews").select("mission_id").eq("client_id", currentUser.id);
    const reviewedMissionIds = new Set((reviewedRows||[]).map(r=>String(r.mission_id)));
    const requestRows = rows.length ? rows.map(m=>{
      const rowContext = String(m.client_id) === String(currentUser.id) ? "client" : "pro";
      const tag = String(m.client_id) === String(currentUser.id) ? "" : `<span class="tag" style="margin-bottom:6px;display:inline-block">${esc(t("dash.requestReceived"))}</span>`;
      return tag + requestCard(m, rowContext, reviewedMissionIds);
    }).join("") : `<div class="empty-note">${esc(t("dash.noRequests"))}</div>`;
    main.innerHTML = clientProfileCompletionNotice() + requestRows;
    document.querySelector("[data-open-client-profile]")?.addEventListener("click", ()=>{
      document.querySelector('.dash-side [data-panel="profile"]')?.click();
    });
    bindRequestActions();
  }else if(panel === "messages"){
    await renderMessagesPanel("client_id");
  }else if(panel === "support"){
    await openSupportThread();
  }else if(panel === "boats"){
    await renderBoatsManager(main, ()=>renderClientPanel("boats"));
  }else if(panel === "profile"){
    main.innerHTML = profileForm(currentProfile);
    bindProfileForm();
  }
}
async function renderBoatsManager(main, refreshFn){
    const {data} = await db.from("boats").select("*").eq("client_id", currentUser.id).in("listing_type",["rental","both"]).order("created_at",{ascending:false});
    const rows = data || [];
    myBoatsCache = rows;
    const editing = editingBoatId ? rows.find(b=>String(b.id)===String(editingBoatId)) : null;
    const b = editing || {};
    const rentalCount = rows.length;
    const showForm = Boolean(editing) || rows.length===0;
    main.innerHTML = `
      <div class="note-box">${esc(saleText("Gérez ici tous vos bateaux proposés à la location.","Manage all your rental boat listings here.","Gestiona aquí todos tus barcos disponibles en alquiler."))}</div>
      <div class="kpi-grid rental-only-kpis" style="margin-bottom:16px">
        <button type="button" class="kpi rental-kpi-btn active" data-boat-list-filter="all" aria-pressed="true"><div class="kpi-top"><span>${esc(saleText("Total annonces","Total listings","Total anuncios"))}</span></div><strong>${rows.length}</strong></button>
        <button type="button" class="kpi rental-kpi-btn" data-boat-list-filter="rental" aria-pressed="false"><div class="kpi-top"><span>${esc(saleText("En location","For rent","En alquiler"))}</span></div><strong>${rentalCount}</strong></button>
      </div>
      <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px">
        <h3 style="margin:0" id="myBoatListTitle">${esc(saleText("Mes annonces","My listings","Mis anuncios"))} (${rows.length})</h3>
        <button class="small-btn fill" type="button" id="showAddBoatForm">+ ${esc(saleText("Ajouter un bateau","Add a boat","Añadir un barco"))}</button>
      </div>
      ${rows.length ? `<div id="myBoatCards">${rows.map(bt=>myBoatCard(bt)).join("")}</div>` : `<div class="empty-note">${esc(t("dash.noBoats"))}</div>`}
      <section id="boatEditorSection" style="${showForm?"":"display:none;"}margin-top:24px">
      <h3>${editing ? esc(saleText("Modifier cette annonce","Edit this listing","Modificar este anuncio")) : esc(saleText("Ajouter un bateau","Add a boat","Añadir un barco"))}</h3>
      <form id="addBoatForm" style="margin-top:16px">
        <div class="field"><label>${esc(t("account.nameLabel"))}</label><input id="boatNameInput" required value="${esc(b.name||"")}"></div>
        <div class="field"><label>${esc(t("boatDetail.brand"))}</label><input id="boatBrandInput" value="${esc(b.brand||"")}"></div>
        <div class="field"><label>${esc(t("boatDetail.model"))}</label><input id="boatModelInput" value="${esc(b.model||"")}"></div>
        <div class="field"><label>${esc(t("boatDetail.type"))}</label>
          <select id="boatTypeInput">
            <option value="sailboat" ${b.boat_type==="sailboat"?"selected":""}>${esc(t("boatDetail.typeSailboat"))}</option>
            <option value="motorboat" ${b.boat_type==="motorboat"?"selected":""}>${esc(t("boatDetail.typeMotorboat"))}</option>
            <option value="rib" ${b.boat_type==="rib"?"selected":""}>${esc(t("boatDetail.typeRib"))}</option>
            <option value="catamaran" ${b.boat_type==="catamaran"?"selected":""}>${esc(t("boatDetail.typeCatamaran"))}</option>
          </select>
        </div>
        <div class="field"><label>${esc(t("boatDetail.port"))}</label><input id="boatPortInput" value="${esc(b.home_port||"")}"></div>
        <div class="field"><label>${esc(t("boatDetail.length"))} (m)</label><input id="boatLengthInput" type="number" step="0.1" value="${b.length_m??""}"></div>
        <div class="field"><label>${esc(t("boatDetail.width"))} (m)</label><input id="boatWidthInput" type="number" step="0.1" value="${b.beam_m??""}"></div>
        <div class="field"><label>${esc(t("boatDetail.draft"))} (m)</label><input id="boatDraftInput" type="number" step="0.1" value="${b.draft_m??""}"></div>
        <div class="field"><label>${esc(t("boatDetail.capacity"))}</label><input id="boatCapacityInput" type="number" min="1" step="1" value="${b.capacity??""}"></div>
        <div class="field"><label>${esc(t("boatDetail.cabinsField"))}</label><input id="boatCabinsInput" type="number" min="0" step="1" value="${b.cabins??""}"></div>
        <div class="field"><label>${esc(t("boatDetail.berths"))}</label><input id="boatBerthsInput" type="number" min="0" step="1" value="${b.berths??""}"></div>
        <div class="field"><label>${esc(t("boatDetail.year"))}</label><input id="boatYearInput" type="number" min="1950" max="${new Date().getFullYear()}" step="1" value="${b.year_built??""}"></div>
        <div class="field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input id="boatSkipperInput" type="checkbox" style="width:auto" ${b.skipper_included?"checked":""}> ${esc(t("boatDetail.skipperIncluded"))}</label></div>
        <div class="field"><label>${esc(t("boatDetail.engineType"))}</label><input id="boatEngineTypeInput" value="${esc(b.engine_type||"")}"></div>
        <div class="field"><label>${esc(t("boatDetail.engineCount"))}</label><input id="boatEngineCountInput" type="number" min="0" step="1" value="${b.engine_count??""}"></div>
        <div class="field"><label>${esc(t("boatDetail.enginePower"))}</label><input id="boatEnginePowerInput" value="${esc(b.engine_power||"")}"></div>
        <div class="field"><label>${esc(t("boatDetail.fuelType"))}</label><input id="boatFuelTypeInput" value="${esc(b.fuel_type||"")}"></div>
        <div class="field"><label>${esc(t("boatDetail.fuelTank"))} (L)</label><input id="boatFuelTankInput" type="number" min="0" step="1" value="${b.fuel_tank_l??""}"></div>
        <div class="field"><label>${esc(t("boatDetail.waterTank"))} (L)</label><input id="boatWaterTankInput" type="number" min="0" step="1" value="${b.water_tank_l??""}"></div>
        <div class="field"><label>${esc(t("boatDetail.priceHalfDay"))} (€)</label><input id="boatPriceHalfInput" type="number" min="0" step="1" value="${b.price_half_day??""}"></div>
        <div class="field"><label>${esc(t("boatDetail.priceFullDay"))} (€)</label><input id="boatPriceDayInput" type="number" min="0" step="1" value="${b.price_per_day??""}"></div>
        <div class="field"><label>${esc(t("boatDetail.deposit"))} (€)</label><input id="boatDepositInput" type="number" min="0" step="1" value="${b.deposit_amount??""}"></div>
        <div class="field"><label>${esc(t("boatDetail.equipment"))}</label><input id="boatEquipmentInput" placeholder="${esc(t("boatDetail.equipmentPlaceholder"))}" value="${esc(b.equipment||"")}"></div>
        <div class="field"><label>${esc(t("boatDetail.description"))}</label><textarea id="boatDescInput" rows="3">${esc(b.description||"")}</textarea></div>
        <div class="field"><label>${esc(t("boatDetail.rules"))}</label><textarea id="boatRulesInput" rows="2">${esc(b.rules_text||"")}</textarea></div>
        <div class="field"><label>${esc(t("boatDetail.cancellationPolicy"))}</label><textarea id="boatCancelInput" rows="2">${esc(b.cancellation_policy||"")}</textarea></div>
        <div class="field"><label>${esc(t("boatDetail.photos"))}</label><input id="boatPhotosInput" type="file" accept="image/*" multiple></div>
        <div id="boatPhotosPreview" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"></div>
        <button class="primary wide" type="submit">${editing ? esc(t("dash.saveSettings")) : esc(t("join.ownerCta"))}</button>
        ${editing ? `<button class="small-btn wide" type="button" id="cancelEditBoat" style="margin-top:8px">${esc(t("dash.cancel"))}</button>` : ""}
      </form></section>`;
    bindMyBoatActions(refreshFn);
    document.querySelectorAll("[data-boat-list-filter]").forEach(btn=>btn.addEventListener("click", ()=>{
      const filter=btn.dataset.boatListFilter;
      document.querySelectorAll("[data-boat-list-filter]").forEach(other=>{
        const active=other===btn;
        other.classList.toggle("active",active);
        other.setAttribute("aria-pressed",active?"true":"false");
      });
      const visibleRows = filter==="rental" ? rows.filter(x=>["rental","both"].includes(x.listing_type||"rental")) : rows;
      const cards=document.querySelector("#myBoatCards");
      if(cards) cards.innerHTML = visibleRows.length ? visibleRows.map(bt=>myBoatCard(bt)).join("") : `<div class="empty-note">${esc(t("dash.noBoats"))}</div>`;
      const title=document.querySelector("#myBoatListTitle");
      if(title) title.textContent = (filter==="rental" ? saleText("Bateaux en location","Boats for rent","Barcos en alquiler") : saleText("Mes annonces","My listings","Mis anuncios")) + " (" + visibleRows.length + ")";
      bindMyBoatActions(refreshFn);
      document.querySelectorAll("[data-edit-boat]").forEach(editBtn=>editBtn.addEventListener("click", ()=>{
        editingBoatId = editBtn.dataset.editBoat;
        refreshFn().then?.(()=>document.querySelector("#boatEditorSection")?.scrollIntoView({behavior:"smooth",block:"start"}));
      }));
    }));
    document.querySelector("#showAddBoatForm")?.addEventListener("click", ()=>{
      editingBoatId = null;
      const editor=document.querySelector("#boatEditorSection");
      if(editor){ editor.style.display="block"; editor.scrollIntoView({behavior:"smooth",block:"start"}); }
    });
    document.querySelectorAll("[data-edit-boat]").forEach(btn=>btn.addEventListener("click", ()=>{
      editingBoatId = btn.dataset.editBoat;
      refreshFn().then?.(()=>document.querySelector("#boatEditorSection")?.scrollIntoView({behavior:"smooth",block:"start"}));
    }));
    const cancelBtn = document.querySelector("#cancelEditBoat");
    if(cancelBtn) cancelBtn.addEventListener("click", ()=>{ editingBoatId = null; refreshFn(); });
    let boatPhotoFiles = [];
    let keptPhotoUrls = editing ? [...(Array.isArray(editing.photo_urls) && editing.photo_urls.length ? editing.photo_urls : (editing.photo_url ? [editing.photo_url] : []))] : [];
    function renderBoatPhotosPreview(){
      const preview = document.querySelector("#boatPhotosPreview");
      const total = keptPhotoUrls.length + boatPhotoFiles.length;
      const keptHtml = keptPhotoUrls.map((url,i)=>`<div style="position:relative"><img loading="lazy" src="${esc(url)}" style="width:64px;height:64px;object-fit:cover;border-radius:10px">
          <button type="button" data-remove-kept-photo="${i}" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#c0392b;color:#fff;border:0;font-size:12px;cursor:pointer;line-height:1">×</button></div>`).join("");
      const newHtml = boatPhotoFiles.map((file,i)=>{
        const url = URL.createObjectURL(file);
        return `<div style="position:relative"><img loading="lazy" src="${url}" style="width:64px;height:64px;object-fit:cover;border-radius:10px">
          <button type="button" data-remove-boat-photo="${i}" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#c0392b;color:#fff;border:0;font-size:12px;cursor:pointer;line-height:1">×</button></div>`;
      }).join("");
      preview.innerHTML = keptHtml + newHtml + (total < 6 ? `<div class="muted" style="align-self:center;font-size:12.5px">${total}/6</div>` : "");
      preview.querySelectorAll("[data-remove-boat-photo]").forEach(btn=>btn.addEventListener("click", ()=>{
        boatPhotoFiles.splice(Number(btn.dataset.removeBoatPhoto), 1);
        renderBoatPhotosPreview();
      }));
      preview.querySelectorAll("[data-remove-kept-photo]").forEach(btn=>btn.addEventListener("click", ()=>{
        keptPhotoUrls.splice(Number(btn.dataset.removeKeptPhoto), 1);
        renderBoatPhotosPreview();
      }));
    }
    renderBoatPhotosPreview();
    document.querySelector("#boatPhotosInput").addEventListener("change", ()=>{
      const input = document.querySelector("#boatPhotosInput");
      const room = Math.max(0, 6 - keptPhotoUrls.length);
      boatPhotoFiles = boatPhotoFiles.concat([...input.files]).slice(0, room);
      input.value = "";
      renderBoatPhotosPreview();
    });
    document.querySelector("#addBoatForm").addEventListener("submit", async e=>{
      e.preventDefault();
      const submitBtn = e.target.querySelector("button[type=submit]");
      submitBtn.disabled = true;
      const photoFiles = boatPhotoFiles.slice(0, Math.max(0, 6 - keptPhotoUrls.length));
      const newUrls = [];
      for(const file of photoFiles){
        const path = `${currentUser.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g,"_")}`;
        const {error: uploadError} = await db.storage.from("mission-photos").upload(path, file);
        if(uploadError){ alert(friendlyError(uploadError)); submitBtn.disabled = false; return; }
        const {data: pub} = db.storage.from("mission-photos").getPublicUrl(path);
        newUrls.push(pub.publicUrl);
      }
      const photoUrls = keptPhotoUrls.concat(newUrls);
      const payload = {
        name: document.querySelector("#boatNameInput").value.trim(),
        listing_type: "rental",
        sale_price: null,
        engine_hours: null,
        sale_status: "available",
        brand: document.querySelector("#boatBrandInput").value.trim(),
        model: document.querySelector("#boatModelInput").value.trim(),
        boat_type: document.querySelector("#boatTypeInput").value,
        home_port: document.querySelector("#boatPortInput").value.trim(),
        length_m: Number(document.querySelector("#boatLengthInput").value) || null,
        beam_m: Number(document.querySelector("#boatWidthInput").value) || null,
        draft_m: Number(document.querySelector("#boatDraftInput").value) || null,
        capacity: Number(document.querySelector("#boatCapacityInput").value) || null,
        cabins: Number(document.querySelector("#boatCabinsInput").value) || null,
        berths: Number(document.querySelector("#boatBerthsInput").value) || null,
        year_built: Number(document.querySelector("#boatYearInput").value) || null,
        skipper_included: document.querySelector("#boatSkipperInput").checked,
        engine_type: document.querySelector("#boatEngineTypeInput").value.trim(),
        engine_count: Number(document.querySelector("#boatEngineCountInput").value) || null,
        engine_power: document.querySelector("#boatEnginePowerInput").value.trim(),
        fuel_type: document.querySelector("#boatFuelTypeInput").value.trim(),
        fuel_tank_l: Number(document.querySelector("#boatFuelTankInput").value) || null,
        water_tank_l: Number(document.querySelector("#boatWaterTankInput").value) || null,
        price_half_day: Number(document.querySelector("#boatPriceHalfInput").value) || null,
        price_per_day: Number(document.querySelector("#boatPriceDayInput").value) || null,
        deposit_amount: Number(document.querySelector("#boatDepositInput").value) || null,
        equipment: document.querySelector("#boatEquipmentInput").value.trim(),
        rules_text: document.querySelector("#boatRulesInput").value.trim(),
        cancellation_policy: document.querySelector("#boatCancelInput").value.trim(),
        description: document.querySelector("#boatDescInput").value.trim(),
        photo_url: photoUrls[0] || null,
        photo_urls: photoUrls.length ? photoUrls : null
      };
      const {error} = editing
        ? await db.from("boats").update(payload).eq("id", editing.id)
        : await db.from("boats").insert({client_id: currentUser.id, ...payload});
      if(error){ alert(friendlyError(error)); submitBtn.disabled = false; return; }
      editingBoatId = null;
      await refreshFn();
    });
}

function myBoatCard(b){
  const photo = b.photo_url || (Array.isArray(b.photo_urls) && b.photo_urls[0]) || "";
  return `<article class="request-card">
    <div class="request-top">
      ${photo ? `<img loading="lazy" src="${esc(photo)}" style="width:76px;height:76px;object-fit:cover;border-radius:12px;flex-shrink:0">` : `<div style="width:76px;height:76px;border-radius:12px;background:var(--mist);display:grid;place-items:center;font-size:26px;flex-shrink:0">⛵</div>`}
      <div>
        <h3>${esc(b.name||"Bateau")}</h3>
        <div class="muted">${esc(b.model||"")}${b.home_port?" · "+esc(b.home_port):""}</div>
        <div class="muted">${boatSpecsLine(b)||""}</div>
        <div class="muted">${esc(saleText("Location","Rental","Alquiler"))}</div>
        <span class="tag" style="display:inline-block;margin-top:7px;background:${b.rental_available===false?"#fff0e4":"#e3f7ee"};color:${b.rental_available===false?"#8b3a0e":"#086748"}">${esc(b.rental_available===false?saleText("Indisponible","Unavailable","No disponible"):saleText("Disponible","Available","Disponible"))}</span>
      </div>
    </div>
    <div class="request-actions">
      <button class="small-btn" type="button" data-owner-boat-calendar="${esc(b.id)}">${esc(saleText("📅 Calendrier & tarifs","📅 Calendar & rates","📅 Calendario y tarifas"))}</button>
      <button class="small-btn" type="button" data-toggle-rental-availability="${esc(b.id)}" data-next-availability="${b.rental_available===false?"true":"false"}">${esc(b.rental_available===false?saleText("Rendre disponible","Make available","Marcar disponible"):saleText("Mettre indisponible","Mark unavailable","Marcar no disponible"))}</button>
      <button class="small-btn fill" data-edit-boat="${b.id}">${esc(saleText("Modifier l'annonce","Edit listing","Modificar anuncio"))}</button>
      <button class="small-btn danger" data-delete-my-boat="${b.id}">${esc(t("dash.delete"))}</button>
    </div>
  </article>`;
}
function bindMyBoatActions(refreshFn){
  document.querySelectorAll("[data-owner-boat-calendar]").forEach(btn=>btn.addEventListener("click",()=>{
    const nav=document.querySelector('#dashboardModal .dash-side [data-panel="owner-availability"]');
    if(nav)nav.click();
  }));
  document.querySelectorAll("[data-toggle-rental-availability]").forEach(btn=>btn.addEventListener("click",async()=>{
    const available=btn.dataset.nextAvailability==="true";
    btn.disabled=true;
    const {error}=await db.from("boats").update({rental_available:available}).eq("id",btn.dataset.toggleRentalAvailability).eq("client_id",currentUser.id);
    if(error){alert(friendlyError(error));btn.disabled=false;return;}
    await refreshFn();
  }));

  document.querySelectorAll("[data-delete-my-boat]").forEach(btn=>btn.addEventListener("click", async ()=>{
    if(!confirm(t("dash.delete")+" ?")) return;
    const {error} = await db.from("boats").delete().eq("id", btn.dataset.deleteMyBoat);
    if(error){ alert(friendlyError(error)); return; }
    if(String(editingBoatId)===String(btn.dataset.deleteMyBoat)) editingBoatId = null;
    refreshFn();
  }));
}
function proPaymentText(fr,en,es){ return currentLang === "en" ? en : currentLang === "es" ? es : fr; }
function proPaymentBucket(m){
  if(m.payment_status === "transferred") return "transferred";
  if(["refunded","refund_requested"].includes(m.payment_status)) return "refund";
  if(m.dispute_status === "open") return "blocked";
  if(["paid","payout_ready"].includes(m.payment_status)) return "pending";
  if(["cancelled","rejected"].includes(m.status)) return "closed";
  return "unpaid";
}
async function renderProPayments(main){
  const userId = currentUser?.id;
  if(!userId) return;
  main.innerHTML = `<p role="status">${esc(t("dash.loading"))}</p>`;
  const {data,error} = await db.from("missions")
    .select("id,provider_id,skipper_id,port,starts_at,created_at,status,payment_status,amount_cents,urgent_fee_cents,platform_fee_cents,currency,dispute_status")
    .or(`provider_id.eq.${userId},skipper_id.eq.${userId}`).order("created_at",{ascending:false});
  if(currentUser?.id !== userId || !main.isConnected || !document.querySelector('.dash-side [data-panel="payments"].active')) return;
  if(error){
    main.innerHTML = `<p role="alert">${esc(proPaymentText("Impossible de charger les paiements. Réessayez.","Unable to load payments. Please retry.","No se pueden cargar los pagos. Inténtalo de nuevo."))}</p>`;
    return;
  }
  const rows = (data||[]).filter(m=>m.provider_id===userId || m.skipper_id===userId);
  const labels = {
    unpaid:proPaymentText("En attente du paiement client","Awaiting client payment","Pendiente de pago del cliente"),
    pending:proPaymentText("Payé par le client · en attente de versement","Client paid · awaiting payout","Cliente pagado · pendiente de abono"),
    transferred:proPaymentText("Transfert Stripe confirmé","Stripe transfer confirmed","Transferencia Stripe confirmada"),
    blocked:proPaymentText("Litige · montant bloqué","Dispute · amount on hold","Disputa · importe retenido"),
    refund:proPaymentText("Remboursement demandé ou déclaré","Refund requested or reported","Reembolso solicitado o declarado"),
    closed:proPaymentText("Annulée / refusée","Cancelled / rejected","Cancelada / rechazada")
  };
  const net = m=>Math.max(0,Number(m.amount_cents||0)+Number(m.urgent_fee_cents||0)-Number(m.platform_fee_cents||0));
  const format = (amount,currency)=>new Intl.NumberFormat(currentLang,{style:"currency",currency:currency||"EUR"}).format(amount/100);
  const totals = key=>{
    const sums = {};
    rows.filter(m=>proPaymentBucket(m)===key).forEach(m=>{const c=(m.currency||"eur").toUpperCase();sums[c]=(sums[c]||0)+net(m);});
    return Object.entries(sums).map(([c,n])=>esc(format(n,c))).join(" · ") || "—";
  };
  main.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px">${["unpaid","pending","transferred","blocked"].map(key=>`<div class="request-card"><div class="muted">${esc(labels[key])}</div><strong style="display:block;font-size:24px;margin-top:8px">${totals(key)}</strong></div>`).join("")}</div>
    <p class="note-box">${esc(proPaymentText("Montants nets après commission de la plateforme. Un paiement client ne confirme pas encore un transfert. Après confirmation du transfert Stripe, vérifiez son arrivée dans votre espace Stripe ou sur votre relevé bancaire.","Net amounts after platform commission. A client payment does not yet confirm a transfer. Once the Stripe transfer is confirmed, verify its arrival in Stripe or on your bank statement.","Importes netos tras la comisión. Un pago del cliente todavía no confirma una transferencia. Cuando Stripe la confirme, comprueba su llegada en Stripe o en tu extracto bancario."))}</p>
    <label>${esc(proPaymentText("Filtrer les paiements","Filter payments","Filtrar pagos"))} <select id="proPaymentFilter"><option value="all">${esc(t("dash.tabAll"))}</option>${Object.entries(labels).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join("")}</select></label>
    <button class="small-btn" id="proPaymentRefresh" type="button">${esc(proPaymentText("Actualiser","Refresh","Actualizar"))}</button>
    <div id="proPaymentRows" aria-live="polite" style="margin-top:16px"></div>`;
  function renderRows(){
    const filter = main.querySelector("#proPaymentFilter").value;
    const visible = rows.filter(m=>filter==="all" || proPaymentBucket(m)===filter);
    main.querySelector("#proPaymentRows").innerHTML = visible.length ? visible.map(m=>`<article class="request-card"><h3>${esc(m.port||"—")}</h3><div class="muted">${esc(String(m.id).slice(0,8))} · ${esc(m.starts_at ? new Date(m.starts_at).toLocaleDateString(currentLang) : "—")}</div><p><span class="tag">${esc(labels[proPaymentBucket(m)])}</span> · ${esc(t("status."+m.status))}</p><div>${esc(t("dash.total"))}: ${esc(format(Number(m.amount_cents||0)+Number(m.urgent_fee_cents||0),m.currency))} · ${esc(t("dash.commission"))}: ${esc(format(Number(m.platform_fee_cents||0),m.currency))}</div><strong>${esc(t("dash.netPro"))}: ${esc(format(net(m),m.currency))}</strong><div data-service-summary="${esc(m.id)}"></div></article>`).join("") : `<p class="empty-note">${esc(proPaymentText("Aucun paiement pour ce filtre.","No payments for this filter.","No hay pagos para este filtro."))}</p>`;
  }
  main.querySelector("#proPaymentFilter").addEventListener("change",async()=>{
    renderRows();
    await mountServiceSummaries(main, rows);
  });
  main.querySelector("#proPaymentRefresh").addEventListener("click",()=>renderProPayments(main));
  renderRows();
  await mountConnectSetup(main);
  await mountServiceSummaries(main, rows);
}
async function renderProDashboard(){
  const body = document.querySelector("#dashboardBody");
  const isBoatRentalPro = currentProfile?.provider_activity === "boat_rental_pro";
  const isProvider = currentProfile?.role === "provider";
  const navItems = [
    {id:"requests", label:t("dash.navRequests")},
    {id:"payments", label:proPaymentText("Paiements", "Payments", "Pagos")},
    {id:"messages", label:t("dash.navMessages")},
    {id:"support", label:t("dash.navSupport")}
  ];
  if(isBoatRentalPro) navItems.push({id:"boats", label:saleText("Mes annonces","My listings","Mis anuncios")});
  if(isProvider) navItems.push({id:"excursions", label:t("dash.navExcursions")}, {id:"nucDocs",label:"⚓ Documents NUC"});
  navItems.push({id:"myLink", label:t("dash.navMyLink")});
  navItems.push({id:"profile", label:t("dash.navProfile")}, {id:"availability", label:t("dash.navAvailability")});
  body.innerHTML = dashShell(navItems, "requests");
  bindDashNav(renderProPanel);
  await renderProPanel("requests");
}
function profileNeedsDiploma(profile){
  return profile?.role === "skipper" ||
    (profile?.role === "provider" && ["skipper", "day_sailor"].includes(profile.provider_activity));
}
function profileReminderBannerHtml(p){
  if(!p || !["skipper","provider"].includes(p.role)) return "";
  const missing = [];
  if(!p.phone) missing.push(t("dash.reqPhone"));
  if(profileNeedsDiploma(p) && !p.diploma_url) missing.push(t("dash.reqDiploma"));
  if(!p.profile_photo_url) missing.push(t("dash.reqPhoto"));
  if(!missing.length) return "";
  return `<div class="note-box" style="background:#fff4d6;border-color:#e9d197;color:#8a6d1a;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
    <div>⚠️ ${esc(t("dash.profileIncompleteReminder"))}: <strong>${missing.join(", ")}</strong></div>
    <a href="#" id="profileReminderLink" style="font-weight:800;white-space:nowrap">${esc(t("dash.completeProfile"))} →</a>
  </div>`;
}
function bindProfileReminderLink(){
  document.querySelector("#profileReminderLink")?.addEventListener("click", (e)=>{
    e.preventDefault();
    document.querySelector('[data-panel="profile"]')?.click();
  });
}
async function renderProPanel(panel){
  refreshDashboardIdentity(panel);
  const main = document.querySelector("#dashMain");
  const profileReminder = profileReminderBannerHtml(currentProfile);
  if(panel === "payments"){
    await renderProPayments(main);
  }else if(panel === "requests"){
    const {data} = await db.from("missions").select("*").order("created_at",{ascending:false});
    const rows = (data||[]).filter(m => String(m.skipper_id||"") === String(currentUser.id) || String(m.provider_id||"") === String(currentUser.id) || (!m.skipper_id && !m.provider_id && m.status === "pending"));
    main.innerHTML = profileReminder + (rows.length ? rows.map(m=>requestCard(m,"pro")).join("") : `<div class="empty-note">${esc(t("dash.noMissions"))}</div>`);
    bindRequestActions();
    bindProfileReminderLink();
  }else if(panel === "excursions"){
    await renderExcursionsManager(main);
  }else if(panel === "nucDocs"){
    await renderNucOwnerPanel(main);
  }else if(panel === "myLink"){
    const link = location.origin + "/?pro=" + currentUser.id;
    const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" + encodeURIComponent(link);
    main.innerHTML = `
      <div class="dash-section-title">${esc(t("dash.navMyLink"))}</div>
      <p class="muted" style="max-width:520px">${esc(t("directReq.dashboardExplain"))}</p>
      <div class="hero-admin-card" style="max-width:420px;padding:20px;text-align:center">
        <img loading="lazy" src="${qrUrl}" alt="QR code" width="200" height="200" style="border-radius:12px;margin-bottom:14px">
        <div class="field"><input id="myLinkInput" type="text" readonly value="${esc(link)}" style="text-align:center"></div>
        <button type="button" class="primary wide" id="myLinkCopyBtn" style="margin-top:10px">${esc(t("directReq.copyLink"))}</button>
        <div id="myLinkCopyMsg" class="muted" style="margin-top:8px;font-size:12.5px"></div>
      </div>`;
    document.querySelector("#myLinkCopyBtn")?.addEventListener("click", async ()=>{
      try{
        await navigator.clipboard.writeText(link);
        document.querySelector("#myLinkCopyMsg").textContent = t("directReq.copied");
      }catch(_e){
        document.querySelector("#myLinkInput").select();
      }
    });
  }else if(panel === "messages"){
    await renderMessagesPanel("skipper_id");
  }else if(panel === "support"){
    await openSupportThread();
  }else if(panel === "boats"){
    await renderBoatsManager(main, ()=>renderProPanel("boats"));
  }else if(panel === "profile"){
    main.innerHTML = profileReminder + profileForm(currentProfile);
    bindProfileForm();
    bindProfileReminderLink();
  }else if(panel === "availability"){
    const {data} = await db.from("skipper_unavailability").select("*").eq("skipper_id", currentUser.id).order("unavailable_date");
    const rows = data || [];
    main.innerHTML = `
      <form id="blockDateForm" class="field" style="display:flex;gap:10px;align-items:end;flex-wrap:wrap">
        <div style="flex:1;min-width:180px"><label>${esc(t("search.dateLabel"))}</label><input id="blockDateInput" type="date" min="${localDateStr()}" required></div>
        <button class="primary" type="submit">${esc(t("dash.navAvailability"))}</button>
      </form>
      ${rows.map(r=>`<div class="request-card"><strong>${new Date(r.unavailable_date+"T12:00:00").toLocaleDateString(currentLang)}</strong> — ${esc(r.reason||"")} <button class="small-btn danger" data-unblock="${r.id}">×</button></div>`).join("") || `<div class="empty-note">—</div>`}`;
    document.querySelector("#blockDateForm").addEventListener("submit", async e=>{
      e.preventDefault();
      await db.from("skipper_unavailability").insert({skipper_id: currentUser.id, unavailable_date: document.querySelector("#blockDateInput").value});
      await renderProPanel("availability");
    });
    main.querySelectorAll("[data-unblock]").forEach(btn=>btn.addEventListener("click", async ()=>{
      await db.from("skipper_unavailability").delete().eq("id", btn.dataset.unblock);
      await renderProPanel("availability");
    }));
  }
}

let editingExcId = null;
