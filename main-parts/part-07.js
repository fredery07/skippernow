"use strict";
async function renderExcursionsManager(main){
  const {data: rows} = await db.from("excursions").select("*").eq("provider_id", currentUser.id).order("created_at",{ascending:false});
  const tiles = rows || [];
  const editing = editingExcId ? tiles.find(x=>String(x.id)===String(editingExcId)) : null;
  const s = editing || {};
  main.innerHTML = `
    <div class="dash-section-title">${NAV_ICONS.excursions}${esc(t("dash.navExcursions"))} (${tiles.length})</div>
    <div class="hero-admin-grid">
      ${tiles.length ? tiles.map(sl=>`
        <div class="hero-admin-card${sl.active?"":" hero-admin-card--inactive"}">
          ${Array.isArray(sl.photo_urls) && sl.photo_urls[0] ? `<div class="hero-admin-thumb" style="background-image:url('${esc(sl.photo_urls[0])}')"></div>` : ""}
          <div class="hero-admin-body">
            <div class="hero-admin-order" style="font-family:inherit;font-weight:800;color:var(--navy)">${esc(sl.title)}</div>
            <div class="hero-admin-order">${esc(sl.port)} · ${moneyC(sl.price_cents, sl.currency)} / ${esc(t("dash.guests"))} · ${esc(String(sl.duration_hours))}h${sl.active?"":` · ${esc(t("dash.heroActive"))} ✕`}</div>
            <div class="hero-admin-actions">
              <button type="button" class="link" data-edit-exc="${sl.id}">${esc(t("dash.contentEdit"))}</button>
              <button type="button" class="link" style="color:#c0392b" data-delete-exc="${sl.id}">${esc(t("dash.contentDelete"))}</button>
            </div>
          </div>
        </div>`).join("") : `<div class="empty-note">${esc(t("dash.excNoTiles"))}</div>`}
    </div>
    <h3 style="margin-top:24px">${editing ? esc(t("dash.contentEdit")) : esc(t("dash.excAddTile"))}</h3>
    <form id="excForm" style="margin-top:14px">
      <div class="field"><label>${esc(t("dash.excPort"))}</label><input id="excPortInput" required value="${esc(s.port||"")}" placeholder="Ex. Fajardo"></div>
      <div class="field"><label>${esc(t("dash.excTitle"))}</label><input id="excTitleInput" required value="${esc(s.title||"")}"></div>
      <div class="field"><label>${esc(t("dash.excDesc"))}</label><textarea id="excDescInput" rows="3" required>${esc(s.description||"")}</textarea></div>
      <div class="field"><label>${esc(t("dash.excIncluded"))}</label><textarea id="excIncludedInput" rows="2">${esc(s.included||"")}</textarea></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="field"><label>${esc(t("dash.excPrice"))}</label><input id="excPriceInput" type="number" min="1" step="0.01" required value="${s.price_cents?(s.price_cents/100):""}"></div>
        <div class="field"><label>${esc(t("dash.settingsCurrency")||"Devise")}</label>
          <select id="excCurrencyInput">
            <option value="eur" ${(s.currency||"eur")==="eur"?"selected":""}>EUR (€)</option>
            <option value="usd" ${s.currency==="usd"?"selected":""}>USD ($)</option>
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="field"><label>${esc(t("dash.excDuration"))}</label><input id="excDurationInput" type="number" min="0.5" step="0.5" required value="${s.duration_hours||""}"></div>
        <div class="field"><label>${esc(t("dash.excMaxGuests"))}</label><input id="excMaxGuestsInput" type="number" min="1" step="1" required value="${s.max_guests||""}"></div>
      </div>
      <div class="field"><label>${esc(t("dash.heroUploadLabel"))}</label>
        <input id="excFileInput" type="file" accept="image/*">
        <div id="excUploadStatus" class="muted" style="font-size:12px;margin-top:4px"></div>
      </div>
      <div id="excPreviewBox" style="margin:6px 0 14px;${(Array.isArray(s.photo_urls)&&s.photo_urls[0])?"":"display:none"}">
        <div class="hero-admin-thumb hero-admin-thumb--big" id="excPreviewImg" style="background-image:url('${esc((s.photo_urls&&s.photo_urls[0])||"")}')"></div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:13.5px;margin-bottom:14px"><input id="excActiveInput" type="checkbox" ${editing && s.active?"checked":""}> ${esc(t("dash.heroActive"))}</label>
      <div style="display:flex;gap:10px">
        <button class="primary wide" type="submit">${esc(t("dash.contentSave"))}</button>
        ${editing ? `<button type="button" class="secondary" id="excCancelEdit">${esc(t("dash.contentCancel")||"Annuler")}</button>` : ""}
      </div>
      <div class="note-box">Publication après validation des documents obligatoires par SkipperNow. Déposez vos justificatifs dans « Documents NUC » après avoir enregistré votre excursion.</div><div id="excFormMsg" class="muted" style="margin-top:8px"></div>
    </form>`;
  bindExcursionsForm(s);
  main.querySelectorAll("[data-edit-exc]").forEach(btn=>btn.addEventListener("click", ()=>{ editingExcId = btn.dataset.editExc; renderExcursionsManager(main); }));
  main.querySelectorAll("[data-delete-exc]").forEach(btn=>btn.addEventListener("click", async ()=>{
    if(!confirm(t("dash.contentDelete")+" ?")) return;
    await db.from("excursions").delete().eq("id", btn.dataset.deleteExc).eq("provider_id", currentUser.id);
    await renderExcursionsManager(main);
  }));
}
function bindExcursionsForm(current){
  let uploadedUrl = (current.photo_urls && current.photo_urls[0]) || "";
  const fileInput = document.querySelector("#excFileInput");
  fileInput?.addEventListener("change", async ()=>{
    const file = fileInput.files[0];
    if(!file) return;
    const status = document.querySelector("#excUploadStatus");
    status.textContent = t("dash.heroUploading");
    const path = `${currentUser.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g,"_")}`;
    const {error} = await db.storage.from("mission-photos").upload(path, file);
    if(error){ status.textContent = friendlyError(error); return; }
    const {data} = db.storage.from("mission-photos").getPublicUrl(path);
    uploadedUrl = data.publicUrl;
    status.textContent = t("dash.heroUploaded");
    const box = document.querySelector("#excPreviewBox"), img = document.querySelector("#excPreviewImg");
    box.style.display = ""; img.style.backgroundImage = `url('${uploadedUrl}')`;
  });
  document.querySelector("#excCancelEdit")?.addEventListener("click", ()=>{ editingExcId = null; renderProPanel("excursions"); });
  document.querySelector("#excForm").addEventListener("submit", async e=>{
    e.preventDefault();
    const msg = document.querySelector("#excFormMsg");
    const payload = {
      provider_id: currentUser.id,
      port: document.querySelector("#excPortInput").value.trim(),
      title: document.querySelector("#excTitleInput").value.trim(),
      description: document.querySelector("#excDescInput").value.trim(),
      included: document.querySelector("#excIncludedInput").value.trim() || null,
      price_cents: Math.round(Number(document.querySelector("#excPriceInput").value)*100),
      currency: document.querySelector("#excCurrencyInput").value,
      duration_hours: Number(document.querySelector("#excDurationInput").value),
      max_guests: Number(document.querySelector("#excMaxGuestsInput").value),
      photo_urls: uploadedUrl ? [uploadedUrl] : null,
      active: document.querySelector("#excActiveInput").checked
    };
    const {error} = editingExcId
      ? await db.from("excursions").update(payload).eq("id", editingExcId).eq("provider_id", currentUser.id)
      : await db.from("excursions").insert(payload);
    if(error){ msg.style.color = "#b42318"; msg.textContent = friendlyError(error); }
    else { msg.textContent = t("dash.contentSaved"); msg.style.color = ""; editingExcId = null; await renderProPanel("excursions"); }
  });
}

async function renderAdminDashboard(){
  const body = document.querySelector("#dashboardBody");
  body.innerHTML = dashShell([
    {id:"overview", label:t("dash.navOverview"), group:t("dash.groupActivity")},
    {id:"traffic", label:t("dash.navTraffic"), group:t("dash.groupActivity")},
    {id:"forms", label:t("dash.navForms"), group:t("dash.groupActivity")},
    {id:"missions", label:t("dash.navMissions"), group:t("dash.groupActivity")},
    {id:"directRequests", label:"Demandes aux prestataires", group:t("dash.groupActivity")},
    {id:"messages", label:t("dash.navMessages"), group:t("dash.groupActivity")},
    {id:"payments", label:t("dash.navPayments"), group:t("dash.groupFinance")},
    {id:"payouts", label:t("dash.navPayouts"), group:t("dash.groupFinance")},
    {id:"refunds", label:t("dash.navRefunds"), group:t("dash.groupFinance")},
    {id:"disputes", label:t("dash.navDisputes"), group:t("dash.groupFinance")},
    {id:"commissions", label:t("dash.navCommissions"), group:t("dash.groupFinance")},
    {id:"users", label:t("dash.navUsers"), group:t("dash.groupAccounts")},

    {id:"nucReviews", label:"⚓ Contrôle NUC",group:t("dash.groupAccounts")},
    {id:"content", label:t("dash.navContent"), group:t("dash.groupContent")},
    {id:"hero", label:t("dash.navHero"), group:t("dash.groupContent")},
    {id:"destinations", label:t("dash.navDestinations"), group:t("dash.groupContent")},
    {id:"activities", label:t("dash.navActivities"), group:t("dash.groupContent")}
  ], "overview");
  bindDashNav(renderAdminPanel);
  bindAdminDashboardInteractions();
  await renderAdminPanel("overview");
}
async function loadAdminData(){
  const [{data:profiles},{data:missions},{data:settings},{data:boats},{data:payouts},{data:ports},{data:heroSlides},{data:destTiles},{data:activities}] = await Promise.all([
    db.from("profiles").select("*").order("created_at",{ascending:false}),
    db.from("missions").select("*").order("created_at",{ascending:false}),
    db.from("platform_settings").select("*").eq("id",1).maybeSingle(),
    db.from("boats").select("*").order("created_at",{ascending:false}),
    db.from("payout_details").select("*"),
    db.from("ports").select("*").order("order_index",{ascending:true}),
    db.from("hero_slides").select("*").order("order_index",{ascending:true}),
    db.from("destination_tiles").select("*").order("order_index",{ascending:true}),
    db.from("port_activities").select("*").order("order_index",{ascending:true})
  ]);
  return {
    profiles: profiles || [],
    missions: missions || [],
    settings: settings || {first_commission_percent:15, urgent_fee_cents:1900, support_email:""},
    boats: boats || [],
    payoutsById: Object.fromEntries((payouts||[]).map(p=>[String(p.profile_id), p])),
    ports: ports || [],
    heroSlides: heroSlides || [],
    destTiles: destTiles || [],
    activities: activities || []
  };
}
function profilesById(list){ return Object.fromEntries(list.map(p=>[String(p.id), p])); }

function adminUiCopy(){
  return ({
    fr:{started:"Commencés",unfinished:"Inachevés",created:"Demandes créées",inProgress:"En cours",failed:"Échec",completed:"Demande créée",anonymous:"Visiteur non connecté",lastStep:"Dernière étape",openDetail:"Ouvrir le détail",contact:"Coordonnées",service:"Service",city:"Ville / port",date:"Date demandée",duration:"Durée",boat:"Bateau",details:"Besoin indiqué",target:"Professionnel ciblé",photos:"Photos",history:"Historique",status:"Statut",createdAt:"Créée le",updatedAt:"Dernière mise à jour",payment:"Paiement",amount:"Montant",mission:"Détail de la demande",user:"Détail de l'utilisateur",form:"Détail du formulaire",all:"Tous",noForms:"Aucun formulaire enregistré pour le moment.",migration:"Le suivi détaillé démarre après l'installation de la migration Supabase.",close:"Fermer",unknown:"Non renseigné",event:{booking_opened:"Formulaire ouvert",booking_progress:"Champ renseigné",booking_abandoned:"Formulaire quitté",booking_login_required:"Connexion demandée",booking_submitted:"Envoi tenté",booking_created:"Demande créée",booking_failed:"Erreur d'envoi"}},
    en:{started:"Started",unfinished:"Unfinished",created:"Requests created",inProgress:"In progress",failed:"Failed",completed:"Request created",anonymous:"Signed-out visitor",lastStep:"Last step",openDetail:"Open details",contact:"Contact",service:"Service",city:"City / port",date:"Requested date",duration:"Duration",boat:"Boat",details:"Request details",target:"Target professional",photos:"Photos",history:"History",status:"Status",createdAt:"Created",updatedAt:"Last update",payment:"Payment",amount:"Amount",mission:"Request details",user:"User details",form:"Form details",all:"All",noForms:"No forms recorded yet.",migration:"Detailed tracking starts after the Supabase migration is installed.",close:"Close",unknown:"Not provided",event:{booking_opened:"Form opened",booking_progress:"Field completed",booking_abandoned:"Form left",booking_login_required:"Login required",booking_submitted:"Submission attempted",booking_created:"Request created",booking_failed:"Submission error"}},
    es:{started:"Iniciados",unfinished:"Incompletos",created:"Solicitudes creadas",inProgress:"En curso",failed:"Error",completed:"Solicitud creada",anonymous:"Visitante sin sesión",lastStep:"Último paso",openDetail:"Abrir detalle",contact:"Contacto",service:"Servicio",city:"Ciudad / puerto",date:"Fecha solicitada",duration:"Duración",boat:"Barco",details:"Necesidad indicada",target:"Profesional elegido",photos:"Fotos",history:"Historial",status:"Estado",createdAt:"Creado",updatedAt:"Última actualización",payment:"Pago",amount:"Importe",mission:"Detalle de la solicitud",user:"Detalle del usuario",form:"Detalle del formulario",all:"Todos",noForms:"Todavía no hay formularios registrados.",migration:"El seguimiento detallado empieza después de instalar la migración de Supabase.",close:"Cerrar",unknown:"No indicado",event:{booking_opened:"Formulario abierto",booking_progress:"Campo completado",booking_abandoned:"Formulario abandonado",booking_login_required:"Inicio de sesión solicitado",booking_submitted:"Envío intentado",booking_created:"Solicitud creada",booking_failed:"Error de envío"}}
  })[currentLang] || null;
}
function adminField(label, value, wide){
  const c = adminUiCopy();
  const display = value === null || value === undefined || value === "" ? c.unknown : value;
  return `<div class="admin-detail-field${wide?" admin-detail-field--wide":""}"><small>${esc(label)}</small><div>${esc(display)}</div></div>`;
}
function adminDate(value){ return value ? new Date(value).toLocaleString(currentLang) : ""; }
function closeAdminDetail(){ document.querySelector("#adminDetailBackdrop")?.remove(); }
function showAdminDetail(title, eyebrow, html){
  closeAdminDetail();
  const wrap = document.createElement("div");
  wrap.id = "adminDetailBackdrop";
  wrap.className = "admin-detail-backdrop";
  wrap.innerHTML = `<section class="admin-detail-card" role="dialog" aria-modal="true" aria-labelledby="adminDetailTitle"><div class="admin-detail-head"><div><small>${esc(eyebrow)}</small><h2 id="adminDetailTitle">${esc(title)}</h2></div><button class="close" type="button" data-close-admin-detail aria-label="${esc(adminUiCopy().close)}">×</button></div>${html}</section>`;
  wrap.addEventListener("click", e=>{ if(e.target===wrap || e.target.closest("[data-close-admin-detail]")) closeAdminDetail(); });
  document.body.appendChild(wrap);
  wrap.querySelector("[data-close-admin-detail]")?.focus();
}
function missionHistory(m){
  const rows = [
    [m.created_at,"Demande créée"],[m.updated_at,"Demande mise à jour"],[m.paid_at,"Paiement reçu"],
    [m.completed_at,"Prestation terminée"],[m.validated_at,"Prestation validée"],[m.transferred_at,"Virement effectué"],
    [m.dispute_opened_at,"Litige ouvert"],[m.dispute_resolved_at,"Litige résolu"]
  ].filter(x=>x[0]).sort((a,b)=>new Date(a[0])-new Date(b[0]));
  return rows;
}
function openAdminMissionDetail(id){
  const m = adminMissionsCache.find(row=>String(row.id)===String(id));
  if(!m) return;
  const byId = profilesById(adminProfilesCache), client = byId[String(m.client_id)], pro = byId[String(m.provider_id||m.skipper_id)], c=adminUiCopy();
  const total = Number(m.amount_cents||0)+Number(m.urgent_fee_cents||0);
  const photos = Array.isArray(m.photo_urls) ? m.photo_urls : [];
  const history = missionHistory(m);
  showAdminDetail(m.port||c.mission, c.mission, `<div class="admin-detail-grid">
    ${adminField(c.contact, `${client?.full_name||"—"}\n${client?.contact_email||client?.email||""}\n${client?.phone||""}`, true)}
    ${adminField(c.service, m.boat_type||m.activity||m.provider_activity)}${adminField(c.city,m.port)}
    ${adminField(c.date,m.starts_at?new Date(m.starts_at).toLocaleDateString(currentLang):"")}${adminField(c.duration,m.starts_at&&m.ends_at?`${adminDate(m.starts_at)} → ${adminDate(m.ends_at)}`:"")}
    ${adminField(c.target, `${pro?.full_name||"—"}${pro?.phone?" · "+pro.phone:""}`, true)}
    ${adminField(c.details,m.description,true)}${adminField(c.status,t("status."+(m.status||"pending")))}${adminField(c.payment,t("paymentStatus."+(m.payment_status||"unpaid")))}${adminField(c.amount,total?money(total):t("booking.priceTbd"))}
    ${photos.length?`<div class="admin-detail-field admin-detail-field--wide"><small>${esc(c.photos)}</small><div style="display:flex;gap:8px;flex-wrap:wrap">${photos.map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="" style="width:82px;height:82px;object-fit:cover;border-radius:10px"></a>`).join("")}</div></div>`:""}
  </div><h3>${esc(c.history)}</h3><ul class="admin-history">${history.map(h=>`<li>${esc(h[1])}<time>${esc(adminDate(h[0]))}</time></li>`).join("")||`<li>${esc(c.unknown)}</li>`}</ul>`);
}
function openAdminUserDetail(id){
  const p = adminProfilesCache.find(row=>String(row.id)===String(id));
  if(!p) return;
  const c=adminUiCopy(), related=adminMissionsCache.filter(m=>[m.client_id,m.skipper_id,m.provider_id].some(x=>String(x)===String(p.id)));
  showAdminDetail(p.full_name||c.user,c.user,`<div class="admin-detail-grid">
    ${adminField(c.contact,`${p.contact_email||p.email||""}\n${p.phone||""}`,true)}${adminField(c.status,p.suspended?t("dash.suspended"):(p.verified?"✓":"—"))}${adminField("Rôle",p.role)}${adminField(c.city,p.home_port)}${adminField(c.service,p.provider_activity?activityLabel(p.provider_activity):"")}${adminField("Bio",p.bio,true)}${adminField(t("dash.missionsCount"),related.length)}${adminField(c.createdAt,adminDate(p.created_at))}${adminField(t("dash.internalNoteLabel"),p.admin_notes,true)}
  </div>`);
}
function bookingSessionStatus(session){
  const c=adminUiCopy(), names=session.events.map(e=>e.event_name), last=session.events[0];
  if(names.includes("booking_created")) return {key:"created",label:c.completed,css:"ok"};
  if(last?.event_name === "booking_failed") return {key:"unfinished",label:c.failed,css:"danger"};
  const fresh = last && Date.now()-new Date(last.created_at).getTime()<30*60*1000 && !names.includes("booking_abandoned");
  return {key:"unfinished",label:fresh?c.inProgress:c.unfinished,css:fresh?"":"danger"};
}
function groupBookingSessions(events, profiles){
  const map=new Map(), byId=profilesById(profiles);
  (events||[]).forEach(e=>{
    const key=e.form_session_id || e.metadata?.session_id || `legacy-${e.visitor_id}`;
    if(!map.has(key)) map.set(key,{id:key,events:[],profile:null,metadata:{}});
    const s=map.get(key); s.events.push(e); if(e.profile_id) s.profile=byId[String(e.profile_id)]||s.profile;
  });
  return [...map.values()].map(s=>{
    s.events.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    s.metadata=s.events.find(e=>e.metadata && Object.values(e.metadata).some(Boolean))?.metadata||{};
    s.status=bookingSessionStatus(s); return s;
  }).sort((a,b)=>{
    if(a.status.key!==b.status.key) return a.status.key==="unfinished"?-1:b.status.key==="unfinished"?1:0;
    return new Date(b.events[0]?.created_at||0)-new Date(a.events[0]?.created_at||0);
  });
}
function openAdminFormDetail(id){
  const s=adminFormSessionsCache.find(row=>row.id===id); if(!s) return;
  const c=adminUiCopy(), m=s.metadata||{}, contact=s.profile?`${s.profile.full_name||"—"}\n${s.profile.contact_email||s.profile.email||""}\n${s.profile.phone||""}`:c.anonymous;
  const last=s.events[0], stage=last?.metadata?.stage||last?.event_name||"";
  const linkedMission = m.mission_id && adminMissionsCache.some(row=>String(row.id)===String(m.mission_id));
  showAdminDetail(m.port||m.activity||c.form,c.form,`<div class="admin-detail-grid">
    ${adminField(c.contact,contact,true)}${adminField(c.status,s.status.label)}${adminField(c.lastStep,stage)}${adminField(c.service,m.activity)}${adminField("Sous-catégorie",m.subcategory)}${adminField(c.city,m.port)}${adminField(c.date,m.date)}${adminField(c.duration,m.duration+(m.days?` · ${m.days} jours`:""))}${adminField(c.boat,m.boat_type)}${adminField(c.target,m.target_name||m.target_id,true)}${adminField(c.details,m.details,true)}${adminField(c.photos,m.photo_count||0)}${adminField(c.updatedAt,adminDate(last?.created_at))}
  </div>${linkedMission?`<button class="primary wide" type="button" data-open-linked-mission="${esc(m.mission_id)}">${esc(c.mission)}</button>`:""}<h3>${esc(c.history)}</h3><ul class="admin-history">${[...s.events].reverse().map(e=>`<li>${esc(c.event[e.event_name]||e.event_name)}${e.metadata?.stage?` · ${esc(e.metadata.stage)}`:""}<time>${esc(adminDate(e.created_at))}</time></li>`).join("")}</ul>`);
  document.querySelector("[data-open-linked-mission]")?.addEventListener("click", e=>openAdminMissionDetail(e.currentTarget.dataset.openLinkedMission));
}
async function loadAdminFormSessions(profiles){
  const since=new Date(Date.now()-30*24*60*60*1000).toISOString();
  const bookingEventNames=["booking_opened","booking_progress","booking_abandoned","booking_login_required","booking_submitted","booking_created","booking_failed"];
  const {data,error}=await db.from("booking_events").select("id,visitor_id,profile_id,form_session_id,event_name,path,metadata,created_at").in("event_name",bookingEventNames).gte("created_at",since).order("created_at",{ascending:false}).limit(1500);
  if(error) throw error;
  adminFormSessionsCache=groupBookingSessions(data||[],profiles);
  return adminFormSessionsCache;
}
function renderAdminFormsList(main, sessions, filter="all"){
  const c=adminUiCopy(), filtered=filter==="all"?sessions:sessions.filter(s=>filter.startsWith("booking_")?s.events.some(e=>e.event_name===filter):s.status.key===filter);
  main.innerHTML=`<div class="kpi-grid"><div class="kpi" tabindex="0" role="button" data-form-filter="all"><div class="kpi-top"><span>${esc(c.started)}</span></div><strong>${sessions.length}</strong></div><div class="kpi kpi--danger" tabindex="0" role="button" data-form-filter="unfinished"><div class="kpi-top"><span>${esc(c.unfinished)}</span></div><strong>${sessions.filter(s=>s.status.key==="unfinished").length}</strong></div><div class="kpi kpi--good" tabindex="0" role="button" data-form-filter="created"><div class="kpi-top"><span>${esc(c.created)}</span></div><strong>${sessions.filter(s=>s.status.key==="created").length}</strong></div></div>
    ${filtered.length?`<div class="form-session-list">${filtered.map(s=>{const m=s.metadata||{},p=s.profile,last=s.events[0];return `<article class="form-session-row" tabindex="0" role="button" data-admin-detail="form" data-admin-id="${esc(s.id)}"><div class="form-session-main"><strong>${esc(p?.full_name||c.anonymous)}</strong><span>${esc(p?.contact_email||p?.email||p?.phone||adminDate(last?.created_at))}</span></div><div class="form-session-meta">${esc(m.activity||"—")} · ${esc(m.port||"—")}<span>${esc(m.date||"")}</span></div><div class="form-session-step">${esc(c.lastStep)} : ${esc(last?.metadata?.stage||last?.event_name||"—")}</div><span class="status-pill ${s.status.css}">${esc(s.status.label)}</span></article>`;}).join("")}</div>`:`<div class="empty-note">${esc(c.noForms)}</div>`}`;
  main.querySelectorAll("[data-form-filter]").forEach(btn=>{
    const apply=()=>renderAdminFormsList(main,sessions,btn.dataset.formFilter);
    btn.addEventListener("click",apply); btn.addEventListener("keydown",e=>{if(["Enter"," "].includes(e.key)){e.preventDefault();apply();}});
  });
}
function goToAdminPanel(panel){
  const btn=[...document.querySelectorAll(".dash-side [data-panel]")].find(b=>b.dataset.panel===panel);
  if(btn) btn.click();
}
function bindAdminDashboardInteractions(){
  const body=document.querySelector("#dashboardBody");
  if(!body || body.dataset.adminClickBound) return;
  body.dataset.adminClickBound="1";
  const activate=e=>{
    const target=e.target.closest("[data-admin-panel],[data-admin-detail],[data-open-path]");
    if(!target || (e.type==="keydown" && !["Enter"," "].includes(e.key))) return;
    if(e.target.closest("button,select,input,textarea,a") && e.target!==target) return;
    if(e.type==="keydown") e.preventDefault();
    if(target.dataset.adminPanel){
      if(target.dataset.adminPanel==="forms") adminFormsInitialFilter=target.dataset.adminFormFilter||"all";
      goToAdminPanel(target.dataset.adminPanel);
    }
    else if(target.dataset.openPath) window.open(target.dataset.openPath,"_blank","noopener");
    else if(target.dataset.adminDetail==="mission") openAdminMissionDetail(target.dataset.adminId);
    else if(target.dataset.adminDetail==="user") openAdminUserDetail(target.dataset.adminId);
    else if(target.dataset.adminDetail==="form") openAdminFormDetail(target.dataset.adminId);
  };
  body.addEventListener("click",activate); body.addEventListener("keydown",activate);
}

function renderAdminDirectRequests(main, missions, byId, filter="pending"){
  const rows=missions.filter(m=>m.client_id&&(m.provider_id||m.skipper_id));
  const unanswered=rows.filter(m=>m.status==="pending");
  const shown=filter==="pending"?unanswered:rows;
  const age=m=>{const hours=Math.max(0,Math.floor((Date.now()-new Date(m.created_at).getTime())/3600000));return Number.isFinite(hours)?hours<24?`${hours} h`:`${Math.floor(hours/24)} j`:"—";};
  main.innerHTML=`<div class="panel-head"><div><h3>Demandes adressées aux prestataires</h3><p class="muted">Suivez les réponses et relancez les professionnels en attente.</p></div></div>
    <div class="kpi-grid"><button class="kpi ${filter==="pending"?"kpi--warn":""}" type="button" data-direct-filter="pending"><div class="kpi-top">Sans devis</div><strong>${unanswered.length}</strong></button><button class="kpi" type="button" data-direct-filter="all"><div class="kpi-top">Toutes les demandes</div><strong>${rows.length}</strong></button></div>
    <div class="request-list">${shown.length?shown.map(m=>{const client=byId[String(m.client_id)]||{},pro=byId[String(m.provider_id||m.skipper_id)]||{};const email=pro.contact_email||pro.email||"";const subject=`Relance SkipperNow — demande ${m.port||"nautique"}`;const message=`Bonjour ${pro.full_name||""}, une demande client du ${new Date(m.created_at).toLocaleDateString("fr-FR")} attend votre devis sur SkipperNow. Pouvez-vous la consulter depuis votre espace prestataire ? Merci, Fredery`;const href=email?`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`:"";return `<article class="request-card"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><strong>${esc(m.boat_type||"Prestation nautique")} · ${esc(m.port||"—")}</strong><div class="muted">Client : ${esc(client.full_name||"—")} · Prestataire : ${esc(pro.full_name||"—")}</div><div class="muted">Créée le ${esc(adminDate(m.created_at))} · Il y a ${esc(age(m))}</div></div><span class="status-pill ${statusPillClass(m.status)}">${esc(t("status."+(m.status||"pending")))}</span></div><p>${esc(m.description||"")}</p><div class="request-actions"><button class="small-btn" type="button" data-admin-detail="mission" data-admin-id="${esc(m.id)}">Voir la demande</button>${m.status==="pending"&&href?`<a class="small-btn fill" href="${esc(href)}">Relancer par e-mail</a>`:""}${m.status==="pending"&&pro.phone?`<a class="small-btn" href="tel:${esc(pro.phone)}">Appeler</a>`:""}${m.status==="pending"&&!href&&!pro.phone?'<span class="muted">Coordonnées à compléter sur le profil prestataire.</span>':""}</div></article>`;}).join(""):'<div class="empty-note">Aucune demande dans cette catégorie.</div>'}</div>`;
  main.querySelectorAll("[data-direct-filter]").forEach(btn=>btn.addEventListener("click",()=>renderAdminDirectRequests(main,missions,byId,btn.dataset.directFilter)));
}

async function renderAdminPanel(panel){
  refreshDashboardIdentity(panel);
  const main = document.querySelector("#dashMain");
  const {profiles, missions, settings, boats, payoutsById, ports, heroSlides, destTiles, activities} = await loadAdminData();
  adminProfilesCache = profiles;
  const byId = profilesById(profiles);
  adminMissionsCache = missions;
  const pending = profiles.filter(p => ["skipper","provider"].includes(p.role) && !p.verified);
  const activeMissions = missions.filter(m => !["cancelled","completed"].includes(m.status));
  const heldFunds = missions.filter(m => ["paid","payout_ready"].includes(m.payment_status)).reduce((s,m)=>s+Number(m.amount_cents||0),0);
  const toPayout = missions.filter(m => m.payment_status === "payout_ready");
  const revenue = missions.filter(m => ["paid","transferred","payout_ready"].includes(m.payment_status)).reduce((s,m)=> s + Number(m.platform_fee_cents||0), 0);
  const weekAgo = new Date(Date.now() - 7*24*60*60*1000);
  const newUsers = profiles.filter(p => p.created_at && new Date(p.created_at) > weekAgo).length;
  const openDisputes = missions.filter(m => m.dispute_status === "open").length;

  if(panel === "nucReviews"){ await renderNucAdminPanel(main); return; }
  if(panel === "overview"){
    const {count: completedAllTime, error: completedCountError} = await db.from("missions").select("id", {count:"exact",head:true}).eq("status","completed");
    const completedTotal = completedCountError ? missions.filter(m=>m.status==="completed").length : (completedAllTime ?? 0);
    const priorityItems = [
      ...pending.slice(0,5).map(p=>({type:"validation",level:"warn",title:p.full_name||"—",sub:t("dash.priorityValidation")+" · "+(p.role==="skipper"?t("account.roleSkipper"):t("account.roleProvider")),id:p.id})),
      ...missions.filter(m=>m.dispute_status==="open").slice(0,5).map(m=>({type:"dispute",level:"danger",title:(byId[m.skipper_id]?.full_name||byId[m.client_id]?.full_name||"—"),sub:t("dash.priorityDispute")+" · "+money(m.amount_cents||0),id:m.id})),
      ...toPayout.slice(0,5).map(m=>({type:"payout",level:"warn",title:byId[m.skipper_id]?.full_name||"—",sub:t("dash.priorityPayout")+" · "+money(m.amount_cents||0),id:m.id}))
    ];
    main.innerHTML = `
      <div class="priority-queue">
        <div class="priority-queue-head">${NAV_ICONS.disputes}${esc(t("dash.priorityQueueTitle"))}${priorityItems.length?`<span class="count-pill">${priorityItems.length}</span>`:""}</div>
        ${priorityItems.length ? priorityItems.map(it=>`<div class="priority-row" tabindex="0" role="button" data-admin-panel="${it.type==="validation"?"users":it.type==="dispute"?"disputes":"payouts"}"><span class="pr-dot ${it.level}"></span><div class="pr-body"><div class="pr-title">${esc(it.title)}</div><div class="pr-sub">${esc(it.sub)}</div></div></div>`).join("") : `<div class="priority-empty">${esc(t("dash.priorityEmpty"))}</div>`}
      </div>
      <div class="kpi-grid">
        <div class="kpi kpi--good" tabindex="0" role="button" data-admin-panel="missions"><div class="kpi-top"><span>${esc(saleText("Prestations terminées depuis la création","Completed jobs since launch","Servicios terminados desde el inicio"))}</span><span class="kpi-icon">${NAV_ICONS.missions}</span></div><strong>${completedTotal}</strong><div class="kpi-trend">${esc(saleText("Toutes dates confondues","All-time total","Total histórico"))}</div></div>
        <div class="kpi" tabindex="0" role="button" data-admin-panel="missions"><div class="kpi-top"><span>${esc(t("dash.kpiActiveMissions"))}</span><span class="kpi-icon">${NAV_ICONS.missions}</span></div><strong>${activeMissions.length}</strong></div>
        <div class="kpi" tabindex="0" role="button" data-admin-panel="payments"><div class="kpi-top"><span>${esc(t("dash.kpiHeldFunds"))}</span><span class="kpi-icon">${NAV_ICONS.payments}</span></div><strong>${money(heldFunds)}</strong></div>
        <div class="kpi ${toPayout.length?'kpi--warn':''}" tabindex="0" role="button" data-admin-panel="payouts"><div class="kpi-top"><span>${esc(t("dash.kpiToPayout"))}</span><span class="kpi-icon">${NAV_ICONS.payouts}</span></div><strong>${toPayout.length}</strong></div>
        <div class="kpi kpi--good" tabindex="0" role="button" data-admin-panel="commissions"><div class="kpi-top"><span>${esc(t("dash.kpiPlatformRevenue"))}</span><span class="kpi-icon">${NAV_ICONS.commissions}</span></div><strong>${money(revenue)}</strong></div>
        <div class="kpi" tabindex="0" role="button" data-admin-panel="users"><div class="kpi-top"><span>${esc(t("dash.kpiNewUsers"))}</span><span class="kpi-icon">${NAV_ICONS.users}</span></div><strong>${newUsers}</strong><div class="kpi-trend">${esc(t("dash.kpiTrendWeek"))}</div></div>
        <div class="kpi ${openDisputes?'kpi--danger':''}" tabindex="0" role="button" data-admin-panel="disputes"><div class="kpi-top"><span>${esc(t("dash.kpiOpenDisputes"))}</span><span class="kpi-icon">${NAV_ICONS.disputes}</span></div><strong>${openDisputes}</strong></div>
      </div>
      <div class="dash-section-title">${NAV_ICONS.users}${esc(t("dash.navValidations"))} (${pending.length})</div>
      ${pending.length ? pending.map(p=>profileCard(p)).join("") : `<div class="empty-note">—</div>`}`;
    bindProfileActions();
  }else if(panel === "traffic"){
    // Les statistiques sont agrégées côté serveur par la RPC admin
    // get_traffic_stats() : le dashboard ne télécharge plus toute la table
    // page_views (elle peut contenir des dizaines de milliers de lignes).
    const {data: stats, error: statsError} = await db.rpc("get_traffic_stats");
    if(statsError){
      main.innerHTML = `<div class="empty-note">${esc(friendlyError(statsError))}</div>`;
      return;
    }
    const s = stats || {};
    const now = Date.now();
    const isWithin30Days = value => value && (now - new Date(value).getTime()) < 30*24*60*60*1000;
    const accounts30 = profiles.filter(p=>isWithin30Days(p.created_at)).length;
    const requests30 = missions.filter(m=>isWithin30Days(m.created_at)).length;
    const completed30 = missions.filter(m=>m.status === "completed" && isWithin30Days(m.updated_at || m.created_at)).length;
    const verifiedPros = profiles.filter(p=>p.verified && ["skipper","provider"].includes(p.role)).length;
    const topPages = Array.isArray(s.top_pages_30d) ? s.top_pages_30d : [];
    const bookingEvents = s.booking_events_30d || {};
    const trackingSinceText = s.tracking_since ? new Date(s.tracking_since).toLocaleDateString(currentLang) : t("dash.trackingSinceUnknown");
    main.innerHTML = `
      <div class="note-box">${esc(t("dash.visitorsTrackingNote",{date: trackingSinceText}))}</div>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-top"><span>${esc(t("dash.kpiVisitorsToday"))}</span></div><strong>${s.visitors_today ?? 0}</strong></div>
        <div class="kpi"><div class="kpi-top"><span>${esc(t("dash.kpiVisitors7d"))}</span></div><strong>${s.visitors_7d ?? 0}</strong></div>
        <div class="kpi"><div class="kpi-top"><span>${esc(t("dash.kpiVisitors30d"))}</span></div><strong>${s.visitors_30d ?? 0}</strong></div>
        <div class="kpi"><div class="kpi-top"><span>${esc(t("dash.kpiVisitorsYear"))}</span></div><strong>${s.visitors_year ?? 0}</strong></div>
      </div>
      <div class="dash-section-title">${esc(t("dash.performance30d"))}</div>
      <div class="kpi-grid">
        <div class="kpi" tabindex="0" role="button" data-admin-panel="users"><div class="kpi-top"><span>${esc(t("dash.kpiAccounts30d"))}</span></div><strong>${accounts30}</strong></div>
        <div class="kpi" tabindex="0" role="button" data-admin-panel="missions"><div class="kpi-top"><span>${esc(t("dash.kpiRequests30d"))}</span></div><strong>${requests30}</strong></div>
        <div class="kpi kpi--good" tabindex="0" role="button" data-admin-panel="missions"><div class="kpi-top"><span>${esc(t("dash.kpiCompleted30d"))}</span></div><strong>${completed30}</strong></div>
        <div class="kpi" tabindex="0" role="button" data-admin-panel="users"><div class="kpi-top"><span>${esc(t("stats.pros"))}</span></div><strong>${verifiedPros}</strong></div>
      </div>
      <div class="dash-section-title">${esc(t("dash.bookingFunnelTitle"))}</div>
      <div class="kpi-grid">
        <div class="kpi" tabindex="0" role="button" data-admin-panel="forms" data-admin-form-filter="booking_opened"><div class="kpi-top"><span>${esc(t("dash.bookingOpened"))}</span></div><strong>${Number(bookingEvents.booking_opened || 0)}</strong></div>
        <div class="kpi" tabindex="0" role="button" data-admin-panel="forms" data-admin-form-filter="booking_login_required"><div class="kpi-top"><span>${esc(t("dash.bookingLoginRequired"))}</span></div><strong>${Number(bookingEvents.booking_login_required || 0)}</strong></div>
        <div class="kpi" tabindex="0" role="button" data-admin-panel="forms" data-admin-form-filter="booking_submitted"><div class="kpi-top"><span>${esc(t("dash.bookingSubmitted"))}</span></div><strong>${Number(bookingEvents.booking_submitted || 0)}</strong></div>
        <div class="kpi kpi--good" tabindex="0" role="button" data-admin-panel="forms" data-admin-form-filter="booking_created"><div class="kpi-top"><span>${esc(t("dash.bookingCreated"))}</span></div><strong>${Number(bookingEvents.booking_created || 0)}</strong></div>
        <div class="kpi ${Number(bookingEvents.booking_failed || 0) ? 'kpi--danger' : ''}" tabindex="0" role="button" data-admin-panel="forms" data-admin-form-filter="booking_failed"><div class="kpi-top"><span>${esc(t("dash.bookingFailed"))}</span></div><strong>${Number(bookingEvents.booking_failed || 0)}</strong></div>
      </div>
      <div class="dash-section-title">${esc(t("dash.topPagesTitle"))}${Number.isFinite(s.views_30d) ? ` · ${esc(t("dash.pageViews30d",{count:s.views_30d}))}` : ""}</div>
      ${topPages.length ? `<div class="traffic-table">${topPages.map(p=>`<div class="traffic-row" tabindex="0" role="button" data-open-path="${esc(p.path)}"><span class="traffic-path">${esc(p.path)}</span><span class="traffic-count">${p.views}</span></div>`).join("")}</div>` : `<div class="empty-note">${esc(t("dash.noViewsYet"))}</div>`}`;
  }else if(panel === "forms"){
    main.innerHTML = `<div class="empty-note">${esc(t("dash.loading"))}</div>`;
    try{
      const sessions = await loadAdminFormSessions(profiles);
      const initialFilter=adminFormsInitialFilter;
      adminFormsInitialFilter="all";
      renderAdminFormsList(main,sessions,initialFilter);
    }catch(error){
      main.innerHTML = `<div class="empty-note">${esc(friendlyError(error))}<br><small>${esc(adminUiCopy().migration)}</small></div>`;
    }
  }else if(panel === "directRequests"){
    renderAdminDirectRequests(main, missions, byId);
  }else if(panel === "missions"){
    main.innerHTML = missions.length ? missions.map(m=>adminMissionCard(m, byId)).join("") : `<div class="empty-note">${esc(t("dash.noMissions"))}</div>`;
    bindAdminMissionActions("missions");
  }else if(panel === "messages"){
    await renderMessagesPanel("both");
  }else if(panel === "payments"){
    const rows = missions.filter(m => ["paid","transferred","payout_ready","refund_requested","refunded","refund_rejected"].includes(m.payment_status));
    main.innerHTML = `<div class="note-box">${esc(t("dash.paymentsNote"))}</div>` + (rows.length ? rows.map(m=>adminMissionCard(m, byId, true)).join("") : `<div class="empty-note">${esc(t("dash.noMissions"))}</div>`);
    bindAdminMissionActions("payments");
  }else if(panel === "payouts"){
    await renderServicePayoutAdmin(main, missions, byId);
  }else if(panel === "refunds"){
    const rows = missions.filter(m => ["refund_requested","refunded","refund_rejected"].includes(m.payment_status));
    main.innerHTML = rows.length ? rows.map(m=>adminMissionCard(m, byId, true)).join("") : `<div class="empty-note">${esc(t("dash.noRefunds"))}</div>`;
    bindAdminMissionActions("refunds");
  }else if(panel === "disputes"){
    const rows = missions.filter(m => m.dispute_status === "open");
    const closedRows = missions.filter(m => m.dispute_status === "resolved");
    main.innerHTML = (rows.length ? rows.map(m=>adminMissionCard(m, byId, true)).join("") : `<div class="empty-note">${esc(t("dash.noDisputes"))}</div>`)
      + (closedRows.length ? `<h3 style="margin-top:24px">${esc(t("dash.disputeResolved"))}</h3>${closedRows.map(m=>adminMissionCard(m, byId, true)).join("")}` : "");
    bindAdminMissionActions("disputes");
  }else if(panel === "commissions"){
    const s = settings;
    const providers = profiles.filter(p => ["skipper","provider"].includes(p.role));
    main.innerHTML = `
      <h3>${esc(t("dash.commissionGlobalTitle"))}</h3>
      <div class="setting-row"><div><strong>${esc(t("dash.settingsCommission"))}</strong></div><input id="settingCommission" type="number" min="0" max="50" value="${Number(s.first_commission_percent||15)}"></div>
      <div class="setting-row"><div><strong>${esc(t("dash.settingsUrgent"))}</strong></div><input id="settingUrgent" type="number" min="0" value="${Number(s.urgent_fee_cents||0)/100}"></div>
      <div class="setting-row"><div><strong>${esc(t("dash.settingsSupport"))}</strong></div><input id="settingSupport" type="email" value="${esc(s.support_email||"")}"></div>
      <button class="primary wide" id="saveSettingsBtn">${esc(t("dash.saveSettings"))}</button>
      <p class="ok-text" id="settingsMsg"></p>
      ${providers.length ? `<h3 style="margin-top:24px">${esc(t("dash.commissionProviderTitle"))}</h3>
      <div class="field"><label>${esc(t("dash.chooseProvider"))}</label>
        <select id="commissionProviderSelect">${providers.map(p=>`<option value="${p.id}">${esc(p.full_name||"—")} — ${Number(p.commission_percent ?? s.first_commission_percent ?? 15)}%</option>`).join("")}</select>
      </div>
      <div class="field"><label>${esc(t("dash.customRate"))}</label><input id="commissionCustomRate" type="number" min="0" max="50" step="0.5"></div>
      <button class="primary wide" id="saveProviderRateBtn">${esc(t("dash.saveRate"))}</button>
      <p class="ok-text" id="providerRateMsg"></p>` : ""}
      <div class="note-box">${esc(t("dash.stripeNote"))}</div>`;
    document.querySelector("#saveSettingsBtn").addEventListener("click", async ()=>{
      const {error} = await db.from("platform_settings").upsert({
        id:1,
        first_commission_percent: Number(document.querySelector("#settingCommission").value),
        urgent_fee_cents: Math.round(Number(document.querySelector("#settingUrgent").value)*100),
        support_email: document.querySelector("#settingSupport").value.trim(),
        updated_at: new Date().toISOString()
      });
      document.querySelector("#settingsMsg").textContent = error ? error.message : t("dash.saveSettings");
    });
    const saveRateBtn = document.querySelector("#saveProviderRateBtn");
    if(saveRateBtn) saveRateBtn.addEventListener("click", async ()=>{
      const id = document.querySelector("#commissionProviderSelect").value;
      const rate = Math.max(0, Math.min(50, Number(document.querySelector("#commissionCustomRate").value)));
      const msg = document.querySelector("#providerRateMsg");
      const {error} = await db.from("profiles").update({commission_percent: rate}).eq("id", id);
      msg.textContent = error ? error.message : t("dash.saveRate");
      if(!error) await renderAdminPanel("commissions");
    });
  }else if(panel === "users"){
     const defaultCommission = Number(settings?.first_commission_percent ?? 15);
     main.innerHTML = `<input id="userSearch" type="text" placeholder="Rechercher par nom ou email..." style="width:100%;padding:10px;margin-bottom:12px;border:1px solid var(--line);border-radius:8px;font-size:15px">` + (profiles.length ? `<div id="userCardsList">${profiles.map(p=>adminUserCard(p, missions, defaultCommission)).join("")}</div>` : `<div class="empty-note">Aucun utilisateur</div>`);
document.querySelector("#userSearch").addEventListener("input", (e)=>{
  const q = e.target.value.trim().toLowerCase();
  const filtered = profiles.filter(p => (p.full_name||"").toLowerCase().includes(q) || (p.contact_email||p.email||"").toLowerCase().includes(q));
  document.querySelector("#userCardsList").innerHTML = filtered.length ? filtered.map(p=>adminUserCard(p, missions, defaultCommission)).join("") : `<div class="empty-note">Aucun résultat</div>`;
  bindProfileActions();
});
    bindProfileActions();
  }else if(panel === "boats"){
    const [{data:managedOwners},{data:saleInquiries}] = await Promise.all([
      db.from("boat_managed_owners").select("*"),
      db.from("boat_sale_inquiries").select("*").order("created_at",{ascending:false}).limit(50)
    ]);
    const managedByBoat=Object.fromEntries((managedOwners||[]).map(row=>[String(row.boat_id),row]));
    const ownerFilter = adminBoatsFilterOwnerId ? boats.filter(b=>String(b.client_id)===String(adminBoatsFilterOwnerId)) : boats;
    const ownerName = adminBoatsFilterOwnerId ? (byId[String(adminBoatsFilterOwnerId)]?.full_name || "—") : "";
    main.innerHTML = adminManagedBoatFormHtml()
      + (adminBoatsFilterOwnerId ? `<div class="note-box">${esc(t("dash.boatsOf"))} <strong>${esc(ownerName)}</strong> — <a href="#" id="clearBoatsFilter">${esc(t("dash.clearFilter"))}</a></div>` : "")
      + (ownerFilter.length ? ownerFilter.map(b=>adminBoatCard(b, byId, managedByBoat[String(b.id)])).join("") : `<div class="empty-note">—</div>`)
      + adminManagedInquiriesHtml(saleInquiries||[], boats);
    const clearBtn = document.querySelector("#clearBoatsFilter");
    if(clearBtn) clearBtn.addEventListener("click", (e)=>{ e.preventDefault(); adminBoatsFilterOwnerId = null; renderAdminPanel("boats"); });
    bindAdminBoatActions();
    await bindAdminManagedBoatForm();
  }else if(panel === "content"){
    renderContentPanel(ports);
  }else if(panel === "hero"){
    renderHeroPanel(heroSlides);
  }else if(panel === "destinations"){
    renderDestinationsPanel(destTiles);
  }else if(panel === "activities"){
    renderActivitiesPanel(activities);
  }
}
let editingPortId = null;
