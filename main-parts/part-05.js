"use strict";
document.querySelector("#listBoatBtn").addEventListener("click", ()=>{
  if(currentUser && currentProfile){ openDashboard(); return; }
  openAccountModal("create", "owner");
});
document.querySelector("#sellBoatBtn")?.addEventListener("click", ()=>{
  if(currentUser && currentProfile){ openDashboard(); return; }
  openAccountModal("create", "owner");
});
document.querySelector("#homeProsViewAll")?.addEventListener("click", ()=>{
  showProviderCategories();
  openModal("providerModal");
});
document.querySelectorAll("[data-role]").forEach(el=>{
  if(el.closest("#roleChoice")) return;
  el.addEventListener("click", ()=>openAccountModal("create", el.dataset.role));
});
document.querySelector("#footerBecomePro").addEventListener("click", ()=>openAccountModal("create","provider"));
document.querySelector("#footerAddBoat").addEventListener("click", ()=>openAccountModal("create","owner"));
document.querySelector("#footerSellBoat")?.addEventListener("click", ()=>openAccountModal("create","owner"));
document.querySelector("#footerFindSkipper").addEventListener("click", ()=>{showProviderResults("skipper");openModal("providerModal")});
document.querySelector("#footerFindProvider").addEventListener("click", ()=>{showProviderCategories();openModal("providerModal")});
document.querySelector("#footerContact").addEventListener("click", async ()=>{
  const {data} = await db.from("platform_settings").select("support_email").eq("id",1).maybeSingle();
  window.location.href = "mailto:" + (data?.support_email || "contact@skippernow.com");
});
document.querySelector("#goHome").addEventListener("click", ()=>window.scrollTo({top:0,behavior:"smooth"}));

const LEGAL_SECTIONS = ["mentions","cgu","cgv","privacy","cancellation","refund","cookies","community"];
function renderLegalTabs(active){
  document.querySelector("#legalTabs").innerHTML = LEGAL_SECTIONS.map(k=>`<button type="button" class="tag" data-legal-tab="${k}" style="cursor:pointer;border:1px solid var(--line)${k===active?";background:var(--navy);color:#fff":""}">${esc(t("legal."+k+"Title"))}</button>`).join("");
  document.querySelectorAll("[data-legal-tab]").forEach(btn=>btn.addEventListener("click", ()=>openLegal(btn.dataset.legalTab)));
}
window.openLegal = function(key){
  document.querySelector("#legalTitle").textContent = t("legal."+key+"Title");
  document.querySelector("#legalContent").textContent = t("legal."+key+"Body");
  renderLegalTabs(key);
  openModal("legalModal");
};
document.querySelectorAll("[data-legal]").forEach(a=>a.addEventListener("click", ()=>openLegal(a.dataset.legal)));

document.querySelector("#authSubmit").addEventListener("click", async ()=>{
  const submit = document.querySelector("#authSubmit");
  const msg = document.querySelector("#authMessage");
  if(submit.disabled) return; // Prevent duplicate requests on slow mobile connections.
  const email = document.querySelector("#accountEmail").value.trim().toLowerCase();
  const password = document.querySelector("#accountPassword").value;
  const name = document.querySelector("#accountName").value.trim();
  const portValue = document.querySelector("#accountPort").value.trim();
  const activity = document.querySelector("#accountActivity").value;
  msg.style.color = "#b42318";
  msg.textContent = "";

  if(!email || password.length < 8){ msg.textContent = t("account.errMissing"); return; }
  if(authMode !== "login"){
    if(!name){ msg.textContent = t("account.errName"); return; }
    if(["skipper","provider","owner"].includes(selectedRole) && !portValue){ msg.textContent = t("account.errPort"); return; }
  }

  submit.disabled = true;
  submit.setAttribute("aria-busy","true");
  const modeAtSubmit = authMode;
  try{
    if(modeAtSubmit === "login"){
      const {data, error} = await db.auth.signInWithPassword({email, password});
      if(error) throw error;
      if(!data?.user) throw new Error("Missing authenticated user");
      currentUser = data.user;
      await loadProfile();
      closeModal("accountModal");
      refreshAccountButton();
      if(sessionStorage.getItem("skippernow-quick-request")) openQuickRequest();
      else openDashboard();
      return;
    }

    const dbRole = selectedRole === "owner" ? "client" : selectedRole;
    const metadata = {full_name:name, role:dbRole, lang:currentLang};
    if(selectedRole === "owner") metadata.account_type = "owner";
    if(selectedRole !== "client") metadata.home_port = portValue;
    if(selectedRole === "provider") metadata.provider_activity = activity;
    else if(selectedRole === "skipper") metadata.provider_activity = "skipper";

    const {data, error} = await db.auth.signUp({email, password, options:{data:metadata}});
    if(error) throw error;
    if(!data?.user) throw new Error("Missing signup user");
    if(!data.session){
      msg.style.color = "#08794e";
      msg.textContent = t("account.signupSuccess");
      return;
    }
    currentUser = data.user;
    await loadProfile();
    closeModal("accountModal");
    refreshAccountButton();
    if(sessionStorage.getItem("skippernow-quick-request")) openQuickRequest();
    else openDashboard();
  }catch(error){
    console.error("SkipperNow authentication failed:", error);
    msg.style.color = "#b42318";
    const message = String(error?.message || "").toLowerCase();
    msg.textContent = modeAtSubmit === "login" && message.includes("email not confirmed")
      ? t("account.emailNotConfirmed")
      : modeAtSubmit === "login" && (message.includes("invalid login credentials") || message.includes("invalid credentials"))
        ? t("account.loginError")
        : friendlyError(error);
  }finally{
    submit.disabled = false;
    submit.removeAttribute("aria-busy");
  }
});

document.querySelector("#forgotPasswordBtn").addEventListener("click", async ()=>{
  const email = document.querySelector("#accountEmail").value.trim().toLowerCase();
  const msg = document.querySelector("#authMessage");
  if(!email){ msg.textContent = t("account.forgotNeedEmail"); return; }
  const {error} = await db.auth.resetPasswordForEmail(email, {redirectTo: location.href.split("#")[0]});
  msg.style.color = error ? "#b42318" : "#08794e";
  msg.textContent = error ? t("account.forgotError") + error.message : t("account.forgotSent");
});

document.querySelector("#recoverySubmit")?.addEventListener("click", async ()=>{
  const pass=document.querySelector("#recoveryPassword").value;
  const confirmPass=document.querySelector("#recoveryPasswordConfirm").value;
  const msg=document.querySelector("#recoveryMessage");
  if(pass.length<8){ msg.textContent=saleText("Le mot de passe doit contenir au moins 8 caractères.","Password must be at least 8 characters.","La contraseña debe tener al menos 8 caracteres."); return; }
  if(pass!==confirmPass){ msg.textContent=saleText("Les deux mots de passe ne correspondent pas.","Passwords do not match.","Las contraseñas no coinciden."); return; }
  const btn=document.querySelector("#recoverySubmit"); btn.disabled=true;
  const {error}=await db.auth.updateUser({password:pass});
  btn.disabled=false;
  msg.style.color=error?"#b42318":"#08794e";
  msg.textContent=error?friendlyError(error):saleText("Mot de passe modifié. Vous pouvez maintenant vous connecter.","Password changed. You can now sign in.","Contraseña modificada. Ya puedes iniciar sesión.");
  if(!error){
    setTimeout(()=>{ closeModal("passwordRecoveryModal"); openDashboard(); },700);
  }
});

async function loadProfile(){
  if(!currentUser){ currentProfile = null; return; }
  const {data} = await db.from("profiles").select("*").eq("id", currentUser.id).maybeSingle();
  currentProfile = data;
}
function refreshAccountButton(){
  const loginBtn = document.querySelector("#loginBtn");
  const signupBtn = document.querySelector("#signupBtn");
  const avatar = document.querySelector("#accountAvatar");
  if(currentUser){
    loginBtn.textContent = t("nav.myAccount");
    signupBtn.style.display = "none";
    avatar.style.display = "inline-flex";
    const photo = currentProfile?.profile_photo_url;
    if(photo){
      avatar.style.backgroundImage = `url('${photo}')`;
      avatar.textContent = "";
    }else{
      avatar.style.backgroundImage = "";
      const source = (currentProfile?.full_name || currentUser.email || "?").trim();
      avatar.textContent = source.split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase();
    }
  }else{
    loginBtn.textContent = t("nav.login");
    signupBtn.style.display = "";
    avatar.style.display = "none";
  }
  document.querySelector("#notifWrap").style.display = currentUser ? "block" : "none";
  if(currentUser) refreshNotifications(); else document.querySelector("#notifBadge").style.display = "none";
}
async function refreshNotifications(){
  if(!currentUser || !currentProfile) return;
  const items = [];
  try{
    const {count: unreadMsgCount} = await db.from("messages").select("id", {count:"exact", head:true}).is("read_at", null).neq("sender_id", currentUser.id).in("conversation_id",
      (await db.from("conversations").select("id").or(`client_id.eq.${currentUser.id},skipper_id.eq.${currentUser.id}`)).data?.map(c=>c.id) || []);
    if(unreadMsgCount) items.push({label: `${unreadMsgCount} ${t("notif.unreadMessages")}`, panel:"messages"});
  }catch(_e){}
  const role = currentProfile.role;
  if(role === "client"){
    const {data: quoted} = await db.from("missions").select("id",{count:"exact"}).eq("client_id", currentUser.id).eq("status","quoted");
    if(quoted?.length) items.push({label: `${quoted.length} ${t("notif.quotesReceived")}`, panel:"requests"});
    const {data: awaiting} = await db.from("missions").select("id",{count:"exact"}).eq("client_id", currentUser.id).eq("status","awaiting_validation");
    if(awaiting?.length) items.push({label: `${awaiting.length} ${t("notif.awaitingValidation")}`, panel:"requests"});
  }else if(["skipper","provider"].includes(role)){
    const {data: pending} = await db.from("missions").select("id",{count:"exact"}).eq("status","pending").is("skipper_id", null);
    if(pending?.length) items.push({label: `${pending.length} ${t("notif.newRequests")}`, panel:"requests"});
  }else if(role === "admin"){
    const {data: newRequests} = await db.from("missions").select("id").eq("status","pending");
    if(newRequests?.length) items.push({label: `${newRequests.length} ${t("notif.adminNewRequests")}`, panel:"missions"});
    const {data: pendingUsers} = await db.from("profiles").select("id",{count:"exact"}).eq("verified", false).in("role",["skipper","provider"]);
    if(pendingUsers?.length) items.push({label: `${pendingUsers.length} ${t("notif.pendingValidations")}`, panel:"validations"});
    const {data: refunds} = await db.from("missions").select("id",{count:"exact"}).eq("payment_status","refund_requested");
    if(refunds?.length) items.push({label: `${refunds.length} ${t("notif.refundRequests")}`, panel:"refunds"});
    const {data: disputes} = await db.from("missions").select("id",{count:"exact"}).eq("dispute_status","open");
    if(disputes?.length) items.push({label: `${disputes.length} ${t("notif.openDisputes")}`, panel:"disputes"});
  }
  const badge = document.querySelector("#notifBadge");
  const total = items.reduce((s,it)=>s + (Number(String(it.label).match(/^\d+/)?.[0]) || 1), 0);
  badge.textContent = total > 9 ? "9+" : String(total);
  badge.style.display = total > 0 ? "flex" : "none";
  const showPushCta = ("Notification" in window) && Notification.permission !== "granted";
  const pushCtaHtml = showPushCta ? `<button type="button" id="enablePushBtn" class="request-card" style="width:100%;text-align:left;cursor:pointer;display:block;margin-bottom:6px;background:var(--mist);font-weight:800">🔔 ${esc(t("push.enable"))}</button>` : "";
  document.querySelector("#notifPanel").innerHTML = pushCtaHtml + (items.length
    ? items.map(it=>`<button type="button" class="request-card" style="width:100%;text-align:left;cursor:pointer;display:block;margin-bottom:6px" data-notif-panel="${it.panel}">${esc(it.label)}</button>`).join("")
    : (showPushCta ? "" : `<div class="empty-note" style="padding:12px">${esc(t("notif.empty"))}</div>`));
  document.querySelector("#enablePushBtn")?.addEventListener("click", async (e)=>{
    e.stopPropagation();
    const ok = await enablePushNotifications();
    if(ok) alert(t("push.enabled"));
    await refreshNotifications();
  });
  document.querySelectorAll("[data-notif-panel]").forEach(btn=>btn.addEventListener("click", async ()=>{
    document.querySelector("#notifPanel").style.display = "none";
    await openDashboard();
    document.querySelectorAll(".dash-side button").forEach(b=>b.classList.toggle("active", b.dataset.panel===btn.dataset.notifPanel));
    if(currentProfile.role === "client") await renderClientPanel(btn.dataset.notifPanel);
    else if(currentProfile.role === "admin") await renderAdminPanel(btn.dataset.notifPanel);
    else await renderProPanel(btn.dataset.notifPanel);
  }));
}
document.querySelector("#notifBtn").addEventListener("click", ()=>{
  const panel = document.querySelector("#notifPanel");
  panel.style.display = panel.style.display === "none" ? "block" : "none";
});
document.addEventListener("click", (e)=>{
  const wrap = document.querySelector("#notifWrap");
  if(wrap && !wrap.contains(e.target)) document.querySelector("#notifPanel").style.display = "none";
});
setInterval(()=>{ if(currentUser) refreshNotifications(); }, 45000);

const BOOKING_DRAFT_KEY = "skippernow-quick-request";
function newBookingSessionId(){
  if(window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return "form-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
}
function bookingFormSnapshot(stage){
  const duration = document.querySelector("#bookingDuration")?.value || "";
  const details = sanitizeContactInfo(document.querySelector("#bookingDetails")?.value.trim() || "");
  const files = document.querySelector("#bookingPhotos")?.files;
  return {
    session_id: bookingContext.formSessionId || "",
    stage: stage || "",
    activity: bookingContext.activity || activeActivity,
    subcategory: bookingContext.subcategory || "",
    source: bookingContext.targetId ? "listing" : "quick_request",
    port: document.querySelector("#bookingPort")?.value.trim() || "",
    date: document.querySelector("#bookingDate")?.value || "",
    duration,
    days: duration === "multi" ? (document.querySelector("#bookingDays")?.value || "") : "",
    boat_type: bookingContext.activity === "boat_rental" ? (bookingContext.name || "") : (document.querySelector("#bookingBoat")?.value.trim() || ""),
    details,
    target_id: bookingContext.targetId || "",
    target_name: bookingContext.name || "",
    has_target: Boolean(bookingContext.targetId),
    has_photos: Boolean(files?.length),
    photo_count: files?.length || 0
  };
}
function trackBookingEvent(eventName, metadata){
  try{
    if(typeof window.skTrackEvent === "function"){
      const detail = eventName.startsWith("booking_") ? bookingFormSnapshot(metadata?.stage || eventName.replace("booking_","")) : {};
      window.skTrackEvent(eventName, {...detail, ...(metadata || {}), session_id: bookingContext.formSessionId || metadata?.session_id || ""});
    }
  }catch(_e){}
}
let bookingProgressTimer = null;
function queueBookingProgress(stage){
  if(!bookingContext.formSessionId || bookingContext.sent) return;
  bookingContext.lastStage = stage;
  clearTimeout(bookingProgressTimer);
  bookingProgressTimer = setTimeout(()=>trackBookingEvent("booking_progress", {stage}), 450);
}
function updateBookingDaysVisibility(){
  const durationValue = document.querySelector("#bookingDuration").value;
  document.querySelector("#bookingDaysField").style.display = durationValue === "multi" ? "block" : "none";
}
document.querySelector("#bookingDuration").addEventListener("change", updateBookingDaysVisibility);
function clearBookingDraft(){
  try{ sessionStorage.removeItem(BOOKING_DRAFT_KEY); }catch(_e){}
}
window.openBookingFor = function(targetId, name, homePort, activity, subcategory, targetRole){
  if(currentUser && targetId && String(targetId) === String(currentUser.id)){
    alert(t("boatDetail.ownListing"));
    return;
  }
  bookingContext = {targetId, name, homePort, activity, subcategory, targetRole, formSessionId:newBookingSessionId(), sent:false, abandonTracked:false, lastStage:"opened"};
  document.querySelector("#bookingTargetName").textContent = name || t("booking.defaultTarget");
  document.querySelector("#bookingSummaryPrice").textContent = t("booking.priceTbd");
  const bookingPort = document.querySelector("#bookingPort");
  const bookingDate = document.querySelector("#bookingDate");
  const bookingDuration = document.querySelector("#bookingDuration");
  bookingPort.value = homePort || portInput.value || "";
  bookingDate.min = dateInput.min || localDateStr();
  bookingDate.value = dateInput.value || bookingDate.min;
  bookingDuration.value = document.querySelector("#durationInput").value || "day";
  document.querySelector("#bookingDays").value = "2";
  updateBookingDaysVisibility();
  document.querySelector("#bookingForm").style.display = "block";
  document.querySelector("#bookingSuccess").style.display = "none";
  document.querySelector("#bookingMessage").textContent = "";
  document.querySelector("#bookingSubmit").disabled = false;
  const isBoatRental = activity === "boat_rental";
  const isSupply = activity === "provisioning";
  document.querySelector("#bookingBoatField").style.display = isBoatRental ? "none" : "block";
  const detailsLabel = document.querySelector("#bookingDetailsLabel");
  const detailsInput = document.querySelector("#bookingDetails");
  const subDef = subcategory && (PROVIDER_SUBCATEGORIES[activity]||[]).find(s=>s.key===subcategory);
  const subLabel = subDef ? t(subDef.labelKey) : "";
  if(isSupply){
    detailsLabel.textContent = subDef ? `${activityLabel(activity)} – ${subLabel}` : t("booking.detailsLabel");
    detailsInput.placeholder = t("booking.provisioningPlaceholder", {sub: subLabel || t("sub.provisioning.custom")});
  }else{
    detailsLabel.textContent = isBoatRental ? t("booking.rentalDetailsLabel") : t("booking.detailsLabel");
    detailsInput.placeholder = isBoatRental ? t("booking.rentalDetailsPlaceholder") : t("booking.detailsPlaceholder");
  }
  detailsInput.value = "";
  document.querySelector("#bookingBoat").value = "";
  document.querySelector("#bookingPhotos").value = "";
  document.querySelector("#bookingPhotosPreview").innerHTML = "";
  openModal("bookingModal");
  // Open-service requests return to the two choices instead of closing the journey.
  const modal = document.querySelector("#bookingModal");
  let returnBtn = modal?.querySelector("[data-sn-return-choice]");
  if(!returnBtn && modal){
    returnBtn=document.createElement("button");
    returnBtn.type="button";
    returnBtn.dataset.snReturnChoice="1";
    returnBtn.textContent="← Retour aux deux options";
    returnBtn.style.cssText="display:block;margin:0 0 14px;padding:10px 14px;border:1px solid #cadad9;border-radius:10px;background:#fff;color:#123b4a;font-weight:700;cursor:pointer";
    const heading=modal.querySelector("#bookingTargetName");
    (heading?.parentElement||modal.firstElementChild||modal).prepend(returnBtn);
  }
  if(returnBtn){
    const openService=!targetId && activity && activity!=="skipper" && activity!=="boat_rental";
    returnBtn.style.display=openService?"block":"none";
    returnBtn.onclick=()=>{
      closeModal("bookingModal");
      if(typeof window.snServiceChoiceBack==="function") window.snServiceChoiceBack(activity,name);
      else location.href="/?activity=service&source=home_choice";
    };
  }
  trackBookingEvent("booking_opened", {
    activity: activity || activeActivity,
    has_target: Boolean(targetId),
    source: targetId ? "listing" : "quick_request"
  });
};
// Reprend un brouillon de demande (barre "demande rapide" OU formulaire de
// réservation complet interrompu par une connexion/inscription) et
// rouvre automatiquement le bon formulaire, pré-rempli.
function applyBookingDraftAndOpen(draft){
  if(draft.port) portInput.value = draft.port;
  if(draft.date) dateInput.value = draft.date;
  if(draft.duration) document.querySelector("#durationInput").value = draft.duration;
  activeActivity = TAB_CONFIG[draft.activity] ? draft.activity : "skipper";
  clearBookingDraft();
  const targetId = draft.targetId || null;
  const name = targetId ? (draft.name || t("booking.defaultTarget")) : t("quickRequest.openTitle");
  window.openBookingFor(targetId, name, draft.port || portInput.value, activeActivity, draft.subcategory || "", draft.targetRole || "");
  // openBookingFor vient de réinitialiser le formulaire avec des valeurs par
  // défaut : on restaure par-dessus les valeurs conservées du brouillon.
  if(draft.date) document.querySelector("#bookingDate").value = draft.date;
  if(draft.duration){
    document.querySelector("#bookingDuration").value = draft.duration;
    updateBookingDaysVisibility();
  }
  if(draft.days) document.querySelector("#bookingDays").value = draft.days;
  if(draft.boatType) document.querySelector("#bookingBoat").value = draft.boatType;
  if(draft.details) document.querySelector("#bookingDetails").value = draft.details;
}
function openQuickRequest(){
  let saved = null;
  try{ saved = JSON.parse(sessionStorage.getItem(BOOKING_DRAFT_KEY) || "null"); }catch(_e){}
  const draft = saved || {
    activity: activeActivity,
    port: portInput.value.trim(),
    date: dateInput.value,
    duration: document.querySelector("#durationInput").value
  };
  if(!currentUser){
    try{ sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify(draft)); }catch(_e){}
    openAccountModal("create", "client");
    return;
  }
  if(currentProfile && !["client","admin"].includes(currentProfile.role)){
    alert(t("booking.needClient"));
    return;
  }
  applyBookingDraftAndOpen(draft);
}
document.querySelector("#bookingPhotos").addEventListener("change", (e)=>{
  const preview = document.querySelector("#bookingPhotosPreview");
  preview.innerHTML = "";
  [...e.target.files].slice(0,4).forEach(file=>{
    const url = URL.createObjectURL(file);
    preview.innerHTML += `<img loading="lazy" src="${url}" style="width:64px;height:64px;object-fit:cover;border-radius:10px">`;
  });
  queueBookingProgress("photos");
});
["bookingPort","bookingDate","bookingDuration","bookingDays","bookingBoat","bookingDetails"].forEach(id=>{
  const field = document.querySelector("#"+id);
  if(!field) return;
  const stage = ({bookingPort:"port",bookingDate:"date",bookingDuration:"duration",bookingDays:"days",bookingBoat:"boat_type",bookingDetails:"details"})[id];
  field.addEventListener(id === "bookingDetails" ? "input" : "change", ()=>queueBookingProgress(stage));
});
function trackBookingAbandonment(){
  const modal = document.querySelector("#bookingModal");
  if(!modal?.classList.contains("open") || !bookingContext.formSessionId || bookingContext.sent || bookingContext.abandonTracked) return;
  bookingContext.abandonTracked = true;
  clearTimeout(bookingProgressTimer);
  trackBookingEvent("booking_abandoned", {stage:"closed_after_"+(bookingContext.lastStage||"opened")});
}
document.querySelector("#bookingModal [data-close='bookingModal']")?.addEventListener("click", trackBookingAbandonment, {capture:true});
document.querySelector("#bookingModal")?.addEventListener("click", e=>{ if(e.target === e.currentTarget) trackBookingAbandonment(); }, {capture:true});
window.addEventListener("pagehide", trackBookingAbandonment);
document.querySelector("#bookingSubmit").addEventListener("click", async ()=>{
  const msg = document.querySelector("#bookingMessage");
  const submitBtn = document.querySelector("#bookingSubmit");
  if(submitBtn.disabled) return; // évite un double envoi (double-clic pendant le chargement)
  if(!currentUser){
    // On conserve le formulaire en cours (port, date, durée, jours, type de
    // service, bateau/pro ciblé, description) pour le restaurer après la
    // connexion ou la création de compte.
    const durationValue = document.querySelector("#bookingDuration").value;
    const draft = {
      targetId: bookingContext.targetId || null,
      name: bookingContext.name || "",
      activity: bookingContext.activity || activeActivity,
      subcategory: bookingContext.subcategory || "",
      targetRole: bookingContext.targetRole || "",
      port: document.querySelector("#bookingPort").value.trim(),
      date: document.querySelector("#bookingDate").value,
      duration: durationValue,
      days: durationValue === "multi" ? document.querySelector("#bookingDays").value : "",
      boatType: bookingContext.activity === "boat_rental" ? "" : document.querySelector("#bookingBoat").value.trim(),
      details: document.querySelector("#bookingDetails").value.trim()
    };
    try{ sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify(draft)); }catch(_e){}
    trackBookingEvent("booking_login_required", {
      activity: draft.activity,
      has_target: Boolean(draft.targetId)
    });
    closeModal("bookingModal");
    openAccountModal("login");
    msg.textContent = t("booking.needLogin");
    return;
  }
  if(!currentProfile || (currentProfile.role !== "client" && currentProfile.role !== "admin")){ msg.textContent = t("booking.needClient"); return; }
  const isBoatRental = bookingContext.activity === "boat_rental";
  const boatType = isBoatRental ? (bookingContext.name || "") : document.querySelector("#bookingBoat").value.trim();
  const requestedPort = document.querySelector("#bookingPort").value.trim();
  const requestedDate = document.querySelector("#bookingDate").value;
  const details = sanitizeContactInfo(document.querySelector("#bookingDetails").value.trim());
  // Une mission ne doit jamais être créée sans port, date ou description.
  if(!requestedPort){ msg.textContent = t("booking.needPort"); return; }
  if(!requestedDate){ msg.textContent = t("booking.needDate"); return; }
  if(requestedDate < localDateStr()){ msg.textContent = t("booking.needFutureDate"); return; }
  if(!details){ msg.textContent = t("booking.needDetails"); return; }
  const durationValue = document.querySelector("#bookingDuration").value;
  let days = 1;
  if(durationValue === "multi"){
    days = Math.round(Number(document.querySelector("#bookingDays").value));
    if(!Number.isFinite(days) || days < 2){ msg.textContent = t("booking.needDays"); return; }
  }
  msg.style.color = "";
  msg.textContent = t("booking.sending");
  submitBtn.disabled = true;
  trackBookingEvent("booking_submitted", {
    activity: bookingContext.activity || activeActivity,
    duration: durationValue,
    has_target: Boolean(bookingContext.targetId),
    has_photos: document.querySelector("#bookingPhotos").files.length > 0
  });

  const start = new Date(requestedDate + "T09:00:00");
  // Demi-journée = 4h, journée = 8h, plusieurs jours = nombre de jours x 24h.
  const hours = durationValue === "half" ? 4 : durationValue === "day" ? 8 : days*24;
  const end = new Date(start.getTime() + hours*3600000);

  try{
    const photoFiles = [...document.querySelector("#bookingPhotos").files].slice(0,4);
    const photoUrls = [];
    for(const file of photoFiles){
      const path = `${currentUser.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g,"_")}`;
      const {error: uploadError} = await db.storage.from("mission-photos").upload(path, file);
      if(uploadError){
        trackBookingEvent("booking_failed", {stage:"photo_upload"});
        msg.style.color = "#b42318"; msg.textContent = friendlyError(uploadError); submitBtn.disabled = false; return;
      }
      const {data: pub} = db.storage.from("mission-photos").getPublicUrl(path);
      photoUrls.push(pub.publicUrl);
    }

    // Open cleaning requests are marketplace listings, not assigned missions.
    // Direct requests continue through the existing mission/payment workflow.
    if(!bookingContext.targetId && (bookingContext.activity || activeActivity) === "cleaning"){
      const {data: openRequest,error: openError} = await db.from("provider_requests").insert({
        client_id: currentUser.id,
        provider_id: null,
        activity: "cleaning",
        port: requestedPort,
        boat_name: boatType || "Bateau",
        task_description: details,
        desired_date: requestedDate || null,
        photo_urls: photoUrls,
        status: "open"
      }).select("id").single();
      if(openError){msg.style.color="#b42318";msg.textContent=friendlyError(openError);submitBtn.disabled=false;return;}
      trackBookingEvent("booking_created",{activity:"cleaning",source:"open_request",request_id:openRequest.id});
      bookingContext.sent=true;clearBookingDraft();
      document.querySelector("#bookingForm").style.display="none";
      document.querySelector("#bookingSuccess").style.display="block";
      return;
    }
    const missionPayload = {
      client_id: currentUser.id,
      port: requestedPort,
      boat_type: boatType,
      description: details,
      photo_urls: photoUrls.length ? photoUrls : null,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      amount_cents: 0,
      urgent_fee_cents: 0,
      platform_fee_cents: 0,
      status: "pending",
      payment_status: "unpaid"
    };
    if(bookingContext.targetId){
      if(bookingContext.targetRole === "provider") missionPayload.provider_id = bookingContext.targetId;
      else missionPayload.skipper_id = bookingContext.targetId;
    }
    const {data: createdMission, error} = await db.from("missions").insert(missionPayload).select("id").single();
    if(error){
      trackBookingEvent("booking_failed", {stage:"mission_insert"});
      msg.style.color = "#b42318"; msg.textContent = friendlyError(error); submitBtn.disabled = false; return;
    }
    trackBookingEvent("booking_created", {
      activity: bookingContext.activity || activeActivity,
      duration: durationValue,
      has_target: Boolean(bookingContext.targetId),
      mission_id: createdMission.id
    });
    bookingContext.sent = true;
    clearBookingDraft();
    document.querySelector("#bookingForm").style.display = "none";
    document.querySelector("#bookingSuccess").style.display = "block";
  }catch(err){
    // Le bouton est réactivé en cas d'erreur (réseau, etc.) pour permettre un nouvel essai.
    trackBookingEvent("booking_failed", {stage:"unexpected"});
    msg.style.color = "#b42318";
    msg.textContent = friendlyError(err);
    submitBtn.disabled = false;
  }
});
document.querySelector("#bookingSuccessDone").addEventListener("click", ()=>{ closeModal("bookingModal"); openDashboard(); });

let paymentOpenVersion=0;
let paymentConfirmedIntent=null;
async function paymentCall(name,body){
  const {data:{session}}=await db.auth.getSession();
  if(!session) throw new Error(t("payment.session"));
  const res=await fetch(SUPABASE_URL+"/functions/v1/"+name,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token,apikey:SUPABASE_KEY},body:JSON.stringify(body)});
  const json=await res.json();
  if(!res.ok) throw new Error(json.error||t("payment.unavailable"));
  return json;
}
window.openPaymentFor = async function(missionId, amountCents){
  const version=++paymentOpenVersion;
  currentPaymentMissionId=missionId;paymentConfirmedIntent=null;paymentElementsInstance=null;
  closeModal("dashboardModal");
  document.querySelector("#paymentAmount").textContent=money(amountCents);
  document.querySelector("#paymentMessage").textContent="";
  document.querySelector("#paymentElementWrap").innerHTML=`<div class="empty-note">${esc(t("dash.loading"))}</div>`;
  const submit=document.querySelector("#paymentSubmit");
  submit.style.display="none";submit.disabled=false;submit.textContent=t("payment.pay");
  openModal("paymentModal");
  try{
    await loadStripeClient();
    const json=await paymentCall("smooth-function",{missionId});
    if(version!==paymentOpenVersion) return;
    if(json.paid){closeModal("paymentModal");await openDashboard();return;}
    if(json.processing){document.querySelector("#paymentElementWrap").textContent=t("payment.processing");return;}
    document.querySelector("#paymentAmount").textContent=moneyC(json.amount,json.currency);
    document.querySelector("#paymentElementWrap").innerHTML="";
    paymentElementsInstance=stripeClient.elements({clientSecret:json.client_secret});
    paymentElementsInstance.create("payment").mount("#paymentElementWrap");
    submit.style.display="block";
  }catch(err){document.querySelector("#paymentElementWrap").textContent=friendlyError(err);}
};
document.querySelector("#paymentSubmit").addEventListener("click",async ()=>{
  const msg=document.querySelector("#paymentMessage"), btn=document.querySelector("#paymentSubmit");
  if(btn.disabled || !paymentElementsInstance) return;
  btn.disabled=true;msg.textContent="";
  try{
    if(!paymentConfirmedIntent){
      const returnUrl=new URL(location.origin+"/");returnUrl.searchParams.set("payment_mission",currentPaymentMissionId);
      const {error,paymentIntent}=await stripeClient.confirmPayment({elements:paymentElementsInstance,confirmParams:{return_url:returnUrl.href},redirect:"if_required"});
      if(error) throw error;
      if(!paymentIntent) throw new Error(t("payment.processing"));
      paymentConfirmedIntent=paymentIntent.id;
    }
    btn.textContent=t("payment.check");
    const result=await paymentCall("clever-processor",{missionId:currentPaymentMissionId,paymentIntentId:paymentConfirmedIntent});
    if(!result.ok){msg.textContent=t("payment.processing");return;}
    closeModal("paymentModal");await openDashboard();
  }catch(err){msg.textContent=friendlyError(err);}
  finally{btn.disabled=false;}
});
async function resumePaymentReturn(){
  const params=new URLSearchParams(location.search), missionId=params.get("payment_mission");
  if(!missionId) return false;
  const intentId=params.get("payment_intent"), clean=new URL(location.href);
  ["payment_intent","payment_intent_client_secret","redirect_status"].forEach(k=>clean.searchParams.delete(k));
  history.replaceState(null,"",clean.pathname+clean.search+clean.hash);
  if(!currentUser){openAccountModal("login");return true;}
  closeModal("accountModal");openModal("paymentModal");
  document.querySelector("#paymentSubmit").style.display="none";
  document.querySelector("#paymentElementWrap").textContent=t("dash.loading");
  try{
    const result=await paymentCall("clever-processor",{missionId,paymentIntentId:intentId});
    document.querySelector("#paymentElementWrap").textContent=t(result.ok?"payment.confirmed":"payment.processing");
    if(result.ok){clean.searchParams.delete("payment_mission");history.replaceState(null,"",clean.pathname+clean.search+clean.hash);closeModal("paymentModal");await openDashboard();}
  }catch(err){document.querySelector("#paymentElementWrap").textContent=friendlyError(err);}
  return true;
}

async function openDashboard(){
  if(!currentUser){ openAccountModal("login"); return; }
  if(!currentProfile) await loadProfile();
  if(!currentProfile){ alert(t("account.signupSuccess")); return; }

  const role = currentProfile.role;
  const roleEyebrow = role==="admin" ? "dash.adminEyebrow" : ["skipper","provider"].includes(role) ? "dash.proEyebrow" : "dash.clientEyebrow";
  const roleTitle = role==="admin" ? "dash.adminTitle" : ["skipper","provider"].includes(role) ? "dash.proTitle" : "dash.clientTitle";
  document.querySelector("#dashRole").textContent = t(roleEyebrow);
  document.querySelector("#dashTitle").textContent = t(roleTitle);

  if(role === "admin") await renderAdminDashboard();
  else if(["skipper","provider"].includes(role)) await renderProDashboard();
  else await renderClientDashboard();

  openModal("dashboardModal");
}

const NAV_ICONS = {
  overview:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19h16M8 19V9m4 10V5m4 14v-7"/></svg>',
  missions:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v5m0 13v-5M4.2 6.2l3.5 3.5m8.6 8.6l3.5 3.5M2 12h5m10 0h5M4.2 17.8l3.5-3.5m8.6-8.6l3.5-3.5"/></svg>',
  messages:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>',
  payments:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
  payouts:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  refunds:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
  disputes:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  commissions:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 5L5 19M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/></svg>',
  users:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>',
  boats:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20a3 3 0 003 1.5 3 3 0 003-1.5 3 3 0 003 1.5 3 3 0 003-1.5 3 3 0 003 1.5 3 3 0 003-1.5M4 18l-1-6h18l-2 6M6 12V6h9l3 6"/></svg>',
  requests:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
  forms:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>',
  support:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  profile:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  content:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>',
  hero:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
  destinations:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><path d="M8 2v16M16 6v16"/></svg>',
  activities:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h5l2-8 4 16 2-8h7"/></svg>',
  excursions:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>'
};
function dashboardAccountHtml(p){
  if(!p) return "";
  const copy = ({fr:{current:"Compte connecté",client:"Client",skipper:"Skipper",sailor:"Marin à la journée",provider:"Prestataire",owner:"Propriétaire",admin:"Administrateur",verified:"Profil vérifié",pending:"À valider",suspended:"Profil suspendu",available:"Disponible",unavailable:"Indisponible",progress:"Présentation du profil",hint:"Ce pourcentage décrit les informations renseignées, pas la validation du compte."},en:{current:"Signed-in account",client:"Client",skipper:"Skipper",sailor:"Day sailor",provider:"Service provider",owner:"Boat owner",admin:"Administrator",verified:"Verified profile",pending:"Awaiting verification",suspended:"Suspended profile",available:"Available",unavailable:"Unavailable",progress:"Profile details",hint:"This percentage reflects completed information, not account verification."},es:{current:"Cuenta conectada",client:"Cliente",skipper:"Patrón",sailor:"Marinero por día",provider:"Prestador",owner:"Propietario",admin:"Administrador",verified:"Perfil verificado",pending:"Pendiente de validación",suspended:"Perfil suspendido",available:"Disponible",unavailable:"No disponible",progress:"Información del perfil",hint:"Este porcentaje refleja la información completada, no la validación de la cuenta."}})[currentLang] || null;
  const c = copy || {current:t("dash.navProfile"),client:t("account.roleClient"),skipper:t("account.roleSkipper"),provider:t("account.roleProvider")};
  const professional = ["skipper","provider"].includes(p.role);
  const role = p.role === "skipper" || (p.role === "provider" && p.provider_activity === "skipper") ? c.skipper : p.role === "provider" && p.provider_activity === "day_sailor" ? c.sailor : c[p.role] || p.role;
  const activity = p.role === "provider" && !["skipper","day_sailor"].includes(p.provider_activity) && p.provider_activity ? activityLabel(p.provider_activity) : "";
  const name = p.full_name || currentUser?.email || role;
  const completion = profileCompletionPercent(p);
  const status = p.suspended ? c.suspended : p.verified ? c.verified : c.pending;
  const photo = /^https?:\/\//i.test(p.profile_photo_url||"") ? p.profile_photo_url : "";
  return `<section class="dash-account" aria-label="${esc(c.current)}">
    <div class="dash-identity">${photo ? `<img class="dash-avatar" src="${esc(photo)}" alt="">` : `<div class="dash-avatar" aria-hidden="true">${esc(name.slice(0,1).toUpperCase())}</div>`}
      <div class="dash-identity-text"><small>${esc(c.current)}</small><h3>${esc(name)}</h3><div class="dash-account-email">${esc(currentUser?.email || p.contact_email || "")}</div>
        <div class="dash-account-tags"><span>${esc(role)}</span>${activity ? `<span>${esc(activity)}</span>` : ""}${professional ? `<span class="${p.suspended ? "is-suspended" : p.verified ? "is-ok" : "is-pending"}">${esc(status)}</span>${!p.suspended && p.verified ? `<span>${esc(p.available ? c.available : c.unavailable)}</span>` : ""}` : ""}</div>
        ${p.home_port ? `<div class="dash-account-email" style="margin-top:8px">${esc(p.home_port)}</div>` : ""}
      </div></div>
    ${completion !== null ? `<div class="dash-account-progress"><strong>${esc(c.progress)} · ${completion}%</strong><progress max="100" value="${completion}" aria-label="${esc(c.progress)}"></progress><p>${esc(c.hint)}</p></div>` : ""}
  </section>`;
}
function refreshDashboardIdentity(panel){
  const identity = document.querySelector("#dashAccountIdentity");
  if(identity) identity.innerHTML = dashboardAccountHtml(currentProfile);
  const nav = [...document.querySelectorAll(".dash-side [data-panel]")].find(btn=>btn.dataset.panel === panel);
  const heading = document.querySelector("#dashPanelHeading");
  if(nav && heading) heading.textContent = nav.textContent.trim();
}
function dashShell(navItems, activePanel){
  let lastGroup = null, rows = "";
  navItems.forEach(n=>{
    if(n.group && n.group !== lastGroup){ rows += `<div class="dash-side-group">${esc(n.group)}</div>`; lastGroup = n.group; }
    rows += `<button class="${n.id===activePanel?"active":""}" data-panel="${n.id}">${NAV_ICONS[n.id]||""}<span>${esc(n.label)}</span></button>`;
  });
  return `<div id="dashAccountIdentity">${dashboardAccountHtml(currentProfile)}</div><div class="dash-shell">
    <aside class="dash-side">
      ${rows}
      <button class="logout-btn" data-panel="__logout">${NAV_ICONS.payouts.replace('M12 19V5M5 12l7-7 7 7','M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9')}<span>${esc(t("dash.logout"))}</span></button>
    </aside>
    <section class="dash-main"><h3 class="dash-panel-heading" id="dashPanelHeading">${esc(navItems.find(n=>n.id===activePanel)?.label || "")}</h3><div id="dashMain"></div></section>
  </div>`;
}
function bindDashNav(renderFn){
  document.querySelectorAll(".dash-side button").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      if(btn.dataset.panel === "__logout"){ await logout(); return; }
      if(btn.dataset.panel === "boats"){ adminBoatsFilterOwnerId = null; editingBoatId = null; }
      unsubscribeThreadChannel();
      document.querySelectorAll(".dash-side button").forEach(b=>b.classList.toggle("active", b===btn));
      const heading = document.querySelector("#dashPanelHeading");
      if(heading) heading.textContent = btn.textContent.trim();
      await renderFn(btn.dataset.panel);
    });
  });
}
async function logout(){
  unsubscribeThreadChannel();
  const {error}=await db.auth.signOut();
  if(error){alert(saleText("Déconnexion impossible. Réessayez.","Unable to sign out. Please try again.","No se pudo cerrar sesión."));return;}
  currentUser = null; currentProfile = null;
  closeModal("dashboardModal");
  refreshAccountButton();
}

async function renderClientDashboard(){
  // Owners currently retain the database role "client"; recognize their
  // original owner signup and existing rental listings without changing auth.
  const signupOwner = currentUser?.user_metadata?.account_type === "owner" ||
    (currentUser?.user_metadata?.home_port && currentUser?.user_metadata?.role === "client");
  const {data:ownerBoats,error:boatsError} = await db.from("boats").select("id").eq("client_id",currentUser.id).in("listing_type",["rental","both"]).limit(1);
  if(signupOwner || (!boatsError && ownerBoats?.length)){
    await renderOwnerDashboard();
    return;
  }
  const body = document.querySelector("#dashboardBody");
  body.innerHTML = dashShell([
    {id:"requests", label:t("dash.navRequests")},
    {id:"quotes", label:saleText("Mes devis","My quotes","Mis presupuestos")},
    {id:"messages", label:t("dash.navMessages")},
    {id:"support", label:t("dash.navSupport")},
    {id:"boats", label:saleText("Mes annonces","My listings","Mis anuncios")},
    {id:"profile", label:t("dash.navProfile")}
  ], "requests");
  bindDashNav(renderClientPanel);
  await renderClientPanel("requests");
}
const ownerLabel=(fr,en,es)=>saleText(fr,en,es);
