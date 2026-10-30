"use strict";
function bindAdminBoatActions(){
  document.querySelectorAll("[data-delete-boat]").forEach(btn=>btn.addEventListener("click", async ()=>{
    if(!confirm(t("dash.delete")+" ?")) return;
    btn.disabled = true;
    const {data:{session}} = await db.auth.getSession();
    try{
      const res = await fetch(SUPABASE_URL + "/functions/v1/delete-boat-admin", {
        method: "POST",
        headers: {"Content-Type":"application/json", "Authorization":"Bearer "+session.access_token, "apikey": SUPABASE_KEY},
        body: JSON.stringify({boatId: btn.dataset.deleteBoat})
      });
      const j = await res.json();
      if(!res.ok || !j.ok){ alert(j.error || "Erreur"); btn.disabled = false; return; }
      renderAdminPanel("boats");
    }catch(err){ alert(friendlyError(err)); btn.disabled = false; }
  }));
  document.querySelectorAll("[data-verify-boat]").forEach(btn=>btn.addEventListener("click", async ()=>{
    if(!confirm(t("dash.boatVerifyChecklist"))) return;
    const {error} = await db.from("boats").update({verified:true}).eq("id", btn.dataset.verifyBoat);
    if(error) alert(friendlyError(error)); else renderAdminPanel("boats");
  }));
  document.querySelectorAll("[data-unverify-boat]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const {error} = await db.from("boats").update({verified:false}).eq("id", btn.dataset.unverifyBoat);
    if(error) alert(friendlyError(error)); else renderAdminPanel("boats");
  }));
  document.querySelectorAll("[data-feature-days]").forEach(sel=>sel.addEventListener("change", async ()=>{
    const days = Number(sel.value);
    if(!days) return;
    const until = new Date(Date.now() + days*24*60*60*1000).toISOString();
    const {error} = await db.from("boats").update({featured:true, featured_until:until}).eq("id", sel.dataset.featureDays);
    if(error) alert(friendlyError(error)); else renderAdminPanel("boats");
  }));
  document.querySelectorAll("[data-unfeature-boat]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const {error} = await db.from("boats").update({featured:false, featured_until:null}).eq("id", btn.dataset.unfeatureBoat);
    if(error) alert(friendlyError(error)); else renderAdminPanel("boats");
  }));
}

function statusPillClass(status){
  if(["accepted","paid","completed"].includes(status)) return "ok";
  if(["rejected","cancelled"].includes(status)) return "danger";
  return "";
}
function missionNextStep(m, context, reviewedMissionIds){
  const pro=context==="pro";
  if(m.status==="cancelled"||m.status==="rejected") return t("flow."+m.status);
  if(m.status==="completed") return t(pro?"flow.completedPro":reviewedMissionIds?.has(String(m.id))?"flow.reviewed":"flow.completed");
  if(m.status==="awaiting_validation") return t(pro?"flow.validationPro":"flow.validation");
  if(m.status==="in_progress" || ["paid","payout_ready","transferred"].includes(m.payment_status)) return t("flow.progress");
  if(m.status==="accepted" && m.stripe_payment_intent_id && !pro) return t("flow.prepared");
  const key=["pending","quoted","accepted"].includes(m.status)?m.status:"pending";
  return t("flow."+key+(pro?"Pro":""));
}
function requestCard(m, context, reviewedMissionIds){
  const total = Number(m.amount_cents||0) + Number(m.urgent_fee_cents||0);
  const priceText = total ? money(total) : t("booking.priceTbd");
  let actions = "";
  if(context === "pro" && m.status === "pending" && ((!m.skipper_id && !m.provider_id) || String(m.skipper_id||"")===String(currentUser.id) || String(m.provider_id||"")===String(currentUser.id))){
    actions += `<button class="small-btn fill" data-quote="${m.id}" data-has-provider="${m.provider_id?"1":""}">${esc(t("dash.proposePrice"))}</button>`;
  }
  if(context === "client" && m.status === "quoted"){
    actions += `<button class="small-btn fill" data-accept-quote="${m.id}">${esc(t("dash.acceptQuote"))}</button>`;
    actions += `<button class="small-btn danger" data-reject-quote="${m.id}">${esc(t("dash.refuseQuote"))}</button>`;
  }
  if(context === "client" && m.status === "accepted" && [null,"unpaid","failed"].includes(m.payment_status)){
   actions += `<button class="small-btn fill" data-pay-mission="${m.id}" data-pay-amount="${total}">${esc(t("dash.pay"))}</button>`;if(!m.stripe_payment_intent_id) actions += `<button class="small-btn danger" data-cancel="${m.id}">${esc(t("dash.cancel"))}</button>`;
  }
  if(context === "pro" && m.status === "in_progress"){
    actions += `<button class="small-btn fill" data-complete="${m.id}">${esc(t("dash.markDone"))}</button>`;
  }
  if(context === "client" && m.status === "awaiting_validation"){
    actions += `<button class="small-btn fill" data-validate="${m.id}">${esc(t("dash.validate"))}</button>`;
  }
  if(context === "client" && m.status === "completed" && ["paid","transferred","payout_ready"].includes(m.payment_status)){
    actions += `<button class="small-btn danger" data-request-refund="${m.id}">${esc(t("dash.requestRefund"))}</button>`;
  }
  if(context === "client" && m.status === "completed" && (m.skipper_id||m.provider_id) && reviewedMissionIds && !reviewedMissionIds.has(String(m.id))){
    actions += `<button class="small-btn fill" data-leave-review="${m.id}" data-review-target="${m.skipper_id||m.provider_id}">${esc(t("dash.leaveReview"))}</button>`;
  }
  if((context === "client" || context === "pro") && ["paid","transferred","payout_ready","refund_requested","refunded","refund_rejected"].includes(m.payment_status)){
    actions += `<button class="small-btn" data-open-invoice="${m.id}">${esc(t("dash.viewInvoice"))}</button>`;
  }
  if((context === "client" || context === "pro") && ["completed","in_progress","awaiting_validation"].includes(m.status) && !m.dispute_status){
    actions += `<button class="small-btn" data-open-dispute="${m.id}">${esc(t("dash.reportProblem"))}</button>`;
  }
  if(m.dispute_status === "open"){
    actions += `<span class="tag" style="background:#fff0f0;color:#b42318">${esc(t("dash.disputeOpen"))}</span>`;
  }else if(m.dispute_status === "resolved"){
    actions += `<span class="tag">${esc(t("dash.disputeResolved"))}</span>`;
  }
  if(context === "admin" && !["cancelled","completed"].includes(m.status)){
    actions += `<button class="small-btn danger" data-cancel="${m.id}">${esc(t("dash.cancel"))}</button>`;
  }
  if((context === "client" || context === "pro") && (m.skipper_id||m.provider_id)){
    actions += `<button class="small-btn" data-open-chat="${m.client_id}|${m.skipper_id||m.provider_id}">${esc(t("dash.navMessages"))}</button>`;
  }
  return `<article class="request-card">
    <div class="request-top">
      <div><h3>${esc(m.port||"—")} · ${esc(m.boat_type||"")}</h3><div class="muted">${m.starts_at ? new Date(m.starts_at).toLocaleDateString(currentLang) : ""} — ${esc(m.description||"")}</div></div>
      <span class="status-pill ${statusPillClass(m.status)}">${esc(t("status."+(m.status||"pending")))}</span>
    </div>
    ${Array.isArray(m.photo_urls) && m.photo_urls.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${m.photo_urls.map(u=>`<img loading="lazy" src="${esc(u)}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;cursor:pointer" onclick="window.open('${esc(u)}','_blank')">`).join("")}</div>` : ""}
    <div class="muted" style="margin-top:6px">${priceText}${m.guest_count ? ` · ${esc(String(m.guest_count))} ${esc(t("dash.guests"))}` : ""}</div>
    <div class="muted">${esc(t("dash.paymentStatus"))}: ${esc(t("paymentStatus."+(m.payment_status||"unpaid")))}</div>
    <div class="request-next"><strong>${esc(t("flow.next"))}</strong>${esc(missionNextStep(m,context,reviewedMissionIds))}</div>
    <div data-service-summary="${esc(m.id)}"></div>
    <div class="request-actions">${actions}</div>
  </article>`;
}
window.openInvoice = function(){
  alert(currentLang === "fr" ? "Les documents ne sont pas disponibles. Actualisez la page." : "Documents unavailable. Please reload the page.");
};
function bindRequestActions(){
  document.querySelectorAll("[data-leave-review]").forEach(btn=>btn.addEventListener("click", ()=>{
    openReviewModal(btn.dataset.leaveReview, btn.dataset.reviewTarget);
  }));
  document.querySelectorAll("[data-quote]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const amount = prompt(t("dash.proposePrice") + " (€) :");
    if(amount === null) return;
    const euros = Number(String(amount).replace(",", "."));
    if(!Number.isFinite(euros) || euros <= 0) return;
    const {data:settings} = await db.from("platform_settings").select("*").eq("id",1).maybeSingle();
    const rate = Number(settings?.first_commission_percent ?? 15) / 100;
    const patch = {
      amount_cents: Math.round(euros*100),
      platform_fee_cents: Math.round(euros*100*rate),
      status: "quoted"
    };
    if(!btn.dataset.hasProvider) patch.skipper_id = currentUser.id;
    const {error} = await db.from("missions").update(patch).eq("id", btn.dataset.quote);
    if(error) alert(friendlyError(error)); else openDashboard();
  }));
  document.querySelectorAll("[data-accept-quote]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const {error} = await db.from("missions").update({status:"accepted"}).eq("id", btn.dataset.acceptQuote).eq("client_id", currentUser.id);
    if(error) alert(friendlyError(error)); else openDashboard();
  }));
  document.querySelectorAll("[data-reject-quote]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const {error} = await db.from("missions").update({status:"rejected"}).eq("id", btn.dataset.rejectQuote).eq("client_id", currentUser.id);
    if(error) alert(friendlyError(error)); else openDashboard();
  }));
  document.querySelectorAll("[data-complete]").forEach(btn=>btn.addEventListener("click", async ()=>{
    openServiceCompletion(btn.dataset.complete);
  }));
  document.querySelectorAll("[data-validate]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const {error} = await db.from("missions").update({status:"completed"}).eq("id", btn.dataset.validate).eq("client_id", currentUser.id);
    if(error) alert(friendlyError(error)); else openDashboard();
  }));
  document.querySelectorAll("[data-cancel]").forEach(btn=>btn.addEventListener("click", async ()=>{
    if(!confirm(t("dash.cancel")+" ?")) return;
    const {error} = await db.from("missions").update({status:"cancelled"}).eq("id", btn.dataset.cancel);
    if(error) alert(friendlyError(error)); else openDashboard();
  }));
  document.querySelectorAll("[data-pay-mission]").forEach(btn=>btn.addEventListener("click", ()=>{
    openPaymentFor(btn.dataset.payMission, Number(btn.dataset.payAmount));
  }));
  document.querySelectorAll("[data-request-refund]").forEach(btn=>btn.addEventListener("click", async ()=>{
    if(!confirm(t("dash.requestRefund")+" ?")) return;
    const {error} = await db.from("missions").update({payment_status:"refund_requested"}).eq("id", btn.dataset.requestRefund).eq("client_id", currentUser.id);
    if(error) alert(friendlyError(error)); else openDashboard();
  }));
  document.querySelectorAll("[data-open-invoice]").forEach(btn=>btn.addEventListener("click", ()=>openInvoice(btn.dataset.openInvoice)));
  document.querySelectorAll("[data-open-dispute]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const reason = prompt(t("dash.reportProblem") + " — " + t("dispute.reasonPrompt"));
    if(reason === null || !reason.trim()) return;
    const {error} = await db.from("missions").update({
      dispute_status: "open",
      dispute_reason: reason.trim(),
      dispute_opened_by: currentUser.id,
      dispute_opened_at: new Date().toISOString()
    }).eq("id", btn.dataset.openDispute);
    if(error) alert(friendlyError(error)); else openDashboard();
  }));
  document.querySelectorAll("[data-open-chat]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const [clientId, skipperId] = btn.dataset.openChat.split("|");
    document.querySelectorAll(".dash-side button").forEach(b=>b.classList.toggle("active", b.dataset.panel==="messages"));
    if(currentProfile.role === "client") await renderClientPanel("messages");
    else await renderProPanel("messages");
    await openConversationThread(clientId, skipperId);
  }));
}
let reviewMissionId = null;
let reviewTargetId = null;
let reviewSelectedStars = 0;
function openReviewModal(missionId, targetId){
  reviewMissionId = missionId;
  reviewTargetId = targetId;
  reviewSelectedStars = 0;
  document.querySelector("#reviewComment").value = "";
  document.querySelector("#reviewMsg").textContent = "";
  paintReviewStars();
  openModal("reviewModal");
}
function paintReviewStars(){
  document.querySelectorAll(".review-star").forEach(s=>{
    s.setAttribute("aria-label",t("review.stars",{n:s.dataset.star}));
    s.setAttribute("aria-pressed",String(Number(s.dataset.star)===reviewSelectedStars));
    s.style.color = Number(s.dataset.star) <= reviewSelectedStars ? "var(--brass)" : "var(--line)";
  });
}
document.querySelectorAll(".review-star").forEach(s=>s.addEventListener("click", ()=>{
  reviewSelectedStars = Number(s.dataset.star);
  paintReviewStars();
}));
document.querySelector("#submitReviewBtn").addEventListener("click", async ()=>{
  const msg = document.querySelector("#reviewMsg");
  if(!reviewSelectedStars){ msg.style.color = "#b42318"; msg.textContent = t("dash.reviewNeedStars"); return; }
  const btn = document.querySelector("#submitReviewBtn");
  btn.disabled = true;
  const {error} = await db.from("reviews").insert({
    mission_id: reviewMissionId,
    client_id: currentUser.id,
    skipper_id: reviewTargetId,
    rating: reviewSelectedStars,
    comment: document.querySelector("#reviewComment").value.trim() || null
  });
  btn.disabled = false;
  if(error){ msg.style.color = "#b42318"; msg.textContent = friendlyError(error); return; }
  closeModal("reviewModal");
  await renderClientPanel("requests");
});
function profileCard(p){
  const badge = p.verified ? "ok" : "";
  const isProfessional = ["skipper","provider"].includes(p.role);
  const missing = [];
  if(isProfessional){
    if(!p.phone) missing.push(t("dash.reqPhone"));
    if(profileNeedsDiploma(p) && !p.diploma_url) missing.push(t("dash.reqDiploma"));
    if(!p.profile_photo_url) missing.push(t("dash.reqPhoto"));
  }
  const canApprove = !p.verified && missing.length === 0;
  return `<article class="request-card" tabindex="0" role="button" data-admin-detail="user" data-admin-id="${esc(p.id)}">
    <div class="request-top">
      <div><h3>${esc(p.full_name||"—")}</h3><div class="muted">${esc(p.role||"")} · ${esc(p.home_port||"—")}${p.provider_activity?" · "+esc(activityLabel(p.provider_activity)):""}</div>
      <div class="muted">${esc(p.contact_email||p.email||"—")}${p.phone?` · 📞 ${esc(p.phone)}`:` · <span style="color:#c0392b">${esc(t("dash.reqPhone"))}</span>`}</div>
      <div class="muted">${p.diploma_url ? `<a href="${esc(p.diploma_url)}" target="_blank">${esc(t("account.diplomaCurrent"))}</a>` : (profileNeedsDiploma(p) ? `<span style="color:#c0392b">${esc(t("dash.reqDiploma"))}</span>` : "")}</div>
      <div class="muted">${p.profile_photo_url ? `<a href="${esc(p.profile_photo_url)}" target="_blank">${esc(t("dash.reqPhotoLink"))}</a>` : `<span style="color:#c0392b">${esc(t("dash.reqPhoto"))}</span>`}</div></div>
      <span class="status-pill ${badge}">${p.verified ? "✓" : "—"}</span>
    </div>
    ${!p.verified && missing.length ? `<div class="note-box" style="background:#fff0f0;border-color:#f0c4c4;color:#8a2020">${esc(t("dash.missingBeforeApproval"))}: ${missing.join(", ")}</div>` : ""}
    <div class="request-actions">
      ${!p.verified ? `<button class="small-btn fill" data-approve="${p.id}">${esc(t("dash.approve"))}</button>` : `<button class="small-btn danger" data-suspend="${p.id}">${esc(t("dash.suspend"))}</button>`}
    </div>
  </article>`;
}
function bindProfileActions(){
  document.querySelectorAll("[data-approve]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const {error} = await db.from("profiles").update({verified:true, available:true}).eq("id", btn.dataset.approve);
    if(error) alert(friendlyError(error)); else openDashboard();
  }));
  document.querySelectorAll("[data-suspend]").forEach(btn=>btn.addEventListener("click", async ()=>{
    if(!confirm(t("dash.suspend")+" ?")) return;
    const {error} = await db.from("profiles").update({verified:false, available:false, suspended:true}).eq("id", btn.dataset.suspend);
    if(error) alert(friendlyError(error)); else openDashboard();
  }));
  document.querySelectorAll("[data-reject-doc]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const reason = prompt(t("dash.rejectDocument") + " — " + t("dispute.reasonPrompt"));
    if(reason === null || !reason.trim()) return;
    const {error} = await db.from("profiles").update({verified:false, document_rejection_reason: reason.trim()}).eq("id", btn.dataset.rejectDoc);
    if(error) alert(friendlyError(error)); else openDashboard();
  }));
  document.querySelectorAll("[data-feature]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const {error} = await db.from("profiles").update({featured:true}).eq("id", btn.dataset.feature);
    if(error) alert(friendlyError(error)); else openDashboard();
  }));
  document.querySelectorAll("[data-unfeature]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const {error} = await db.from("profiles").update({featured:false}).eq("id", btn.dataset.unfeature);
    if(error) alert(friendlyError(error)); else openDashboard();
  }));
  document.querySelectorAll("[data-save-note]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const id = btn.dataset.saveNote;
    const note = document.querySelector(`[data-note-input="${id}"]`).value.trim();
    const msg = document.querySelector(`[data-note-msg="${id}"]`);
    const {error} = await db.from("profiles").update({admin_notes: note}).eq("id", id);
    if(error){ msg.style.color = "#b42318"; msg.textContent = friendlyError(error); }
    else { msg.style.color = "#08794e"; msg.textContent = t("action.savedSuccess"); }
  }));
  document.querySelectorAll("[data-delete-user]").forEach(btn=>btn.addEventListener("click", async ()=>{
    if(!confirm(t("dash.delete")+" ?")) return;
    btn.disabled = true;
    const {data:{session}} = await db.auth.getSession();
    try{
      const res = await fetch(SUPABASE_URL + "/functions/v1/delete-user-admin", {
        method: "POST",
        headers: {"Content-Type":"application/json", "Authorization":"Bearer "+session.access_token, "apikey": SUPABASE_KEY},
        body: JSON.stringify({userId: btn.dataset.deleteUser})
      });
      const j = await res.json();
      if(!res.ok || !j.ok){ alert(j.error || "Erreur"); btn.disabled = false; return; }
      openDashboard();
    }catch(err){ alert(friendlyError(err)); btn.disabled = false; }
  }));
  document.querySelectorAll("[data-message-user]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const targetId = btn.dataset.messageUser;
    document.querySelectorAll(".dash-side button").forEach(b=>b.classList.toggle("active", b.dataset.panel==="messages"));
    await renderAdminPanel("messages");
    const list = document.querySelector("#conversationList");
    const thread = document.querySelector("#conversationThread");
    if(list) list.style.display = "none";
    if(thread) thread.style.display = "block";
    await openConversationThread(targetId, currentUser.id);
  }));
  document.querySelectorAll("[data-view-profile]").forEach(btn=>btn.addEventListener("click", ()=>{
    openProfileDetail(btn.dataset.viewProfile, true);
  }));
  document.querySelectorAll("[data-save-commission]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const id = btn.dataset.saveCommission;
    const input = document.querySelector(`[data-commission-input="${id}"]`);
    const msg = document.querySelector(`[data-commission-msg="${id}"]`);
    const rate = Math.max(0, Math.min(50, Number(input.value)));
    const {error} = await db.from("profiles").update({commission_percent: rate}).eq("id", id);
    if(msg){ msg.style.color = error ? "#b42318" : "#08794e"; msg.textContent = error ? error.message : t("dash.saveRate"); }
  }));
  document.querySelectorAll("[data-view-boats]").forEach(btn=>btn.addEventListener("click", async ()=>{
    adminBoatsFilterOwnerId = btn.dataset.viewBoats;
    document.querySelectorAll(".dash-side button").forEach(b=>b.classList.toggle("active", b.dataset.panel==="boats"));
    await renderAdminPanel("boats");
  }));
}
async function getOrCreateConversation(clientId, skipperId){
  const {data, error: lookupError} = await db.from("conversations").select("*").eq("client_id", clientId).eq("skipper_id", skipperId).order("created_at", {ascending:true}).order("id", {ascending:true}).limit(1).maybeSingle();
  if(lookupError) throw lookupError;
  if(data) return data;
  const {data:created, error} = await db.from("conversations").insert({client_id: clientId, skipper_id: skipperId}).select().single();
  if(error) throw error;
  return created;
}
async function openSupportThread(){
  const main = document.querySelector("#dashMain");
  main.innerHTML = `<div class="empty-note">${esc(t("dash.loading"))}</div>`;
  const {data: admin, error} = await db.from("profiles").select("id").eq("role","admin").limit(1).maybeSingle();
  if(error || !admin){ main.innerHTML = `<div class="empty-note">${esc(t("dash.noSupport"))}</div>`; return; }
  main.innerHTML = `<div class="note-box">${esc(t("dash.supportIntro"))}</div><div id="conversationThread"></div>`;
  await openConversationThread(currentUser.id, admin.id);
}

function roleLabel(p){
  if(!p) return "";
  if(p.role === "skipper") return t("account.roleSkipper");
  if(p.role === "provider") return t("account.roleProvider") + (p.provider_activity ? " · " + activityLabel(p.provider_activity) : "");
  if(p.role === "client") return t("account.roleClient");
  if(p.role === "admin") return "Admin";
  return "";
}
function messageSelectionCopy(){
  return ({fr:{all:"Tout sélectionner",select:"Sélectionner la conversation",remove:"Supprimer la sélection",selected:"sélectionnée(s)",scope:"Conversations affichées",confirm:"Supprimer définitivement {n} conversation(s) et leurs messages pour tous les participants ?",failed:"Certaines conversations n’ont pas pu être supprimées."},en:{all:"Select all",select:"Select conversation",remove:"Delete selected",selected:"selected",scope:"Displayed conversations",confirm:"Permanently delete {n} conversation(s) and their messages for all participants?",failed:"Some conversations could not be deleted."},es:{all:"Seleccionar todo",select:"Seleccionar conversación",remove:"Eliminar selección",selected:"seleccionada(s)",scope:"Conversaciones mostradas",confirm:"¿Eliminar definitivamente {n} conversación(es) y sus mensajes para todos los participantes?",failed:"No se pudieron eliminar algunas conversaciones."}})[currentLang] || {all:"Select all",select:"Select conversation",remove:"Delete selected",selected:"selected",scope:"Displayed conversations",confirm:"Delete {n} conversations and their messages for all participants?",failed:"Some conversations could not be deleted."};
}
function bindConversationSelection(main, myRoleColumn){
  const boxes = [...main.querySelectorAll("[data-select-conversation]")];
  const all = main.querySelector("#selectAllConversations");
  const remove = main.querySelector("#deleteSelectedConversations");
  const count = main.querySelector("#conversationSelectionCount");
  if(!all || !remove || !count) return;
  const copy = messageSelectionCopy();
  let busy = false;
  const update = ()=>{
    const selected = boxes.filter(box=>box.checked).length;
    all.checked = boxes.length > 0 && selected === boxes.length;
    all.indeterminate = selected > 0 && selected < boxes.length;
    remove.disabled = busy || selected === 0;
    count.textContent = `${selected} ${copy.selected}`;
  };
  all.addEventListener("change", ()=>{ if(busy) return; boxes.forEach(box=>box.checked=all.checked); update(); });
  boxes.forEach(box=>box.addEventListener("change", update));
  remove.addEventListener("click", async ()=>{
    if(busy) return;
    const ids = boxes.filter(box=>box.checked).map(box=>box.dataset.selectConversation);
    if(!ids.length || !confirm(copy.confirm.replace("{n}", String(ids.length)))) return;
    busy = true; all.disabled = true; boxes.forEach(box=>box.disabled=true); update();
    try{
      const {data, error} = await db.from("conversations").delete().in("id", ids).select("id");
      if(error) throw error;
      if((data||[]).length !== ids.length) alert(copy.failed);
      await refreshNotifications();
      await renderMessagesPanel(myRoleColumn);
    }catch(error){
      alert(friendlyError(error));
    }finally{
      busy = false; all.disabled = false; boxes.forEach(box=>box.disabled=false); update();
    }
  });
  update();
}
async function renderMessagesPanel(myRoleColumn, filterMode){
  const main = document.querySelector("#dashMain");
  main.innerHTML = `<div class="empty-note">${esc(t("dash.loading"))}</div>`;
  currentMessagesRoleColumn = myRoleColumn;
  const mode = filterMode || currentMessagesFilterMode || "unread";
  currentMessagesFilterMode = mode;
  // Match the notification badge: a professional can also be a client in a conversation.
  const query = db.from("conversations").select("*")
    .or(`client_id.eq.${currentUser.id},skipper_id.eq.${currentUser.id}`)
    .order("created_at",{ascending:false});
  const {data: conversations, error} = await query;
  if(error){ main.innerHTML = `<div class="note-box">${esc(friendlyError(error))}</div>`; return; }
  const rows = conversations || [];
  const tabsHtml = `<div style="display:flex;gap:8px;margin-bottom:12px">
    <button type="button" class="small-btn${mode==="unread" ? " active" : ""}" data-messages-filter="unread">${esc(t("dash.tabUnread"))}</button>
    <button type="button" class="small-btn${mode==="all" ? " active" : ""}" data-messages-filter="all">${esc(t("dash.tabAll"))}</button>
  </div>`;
  if(!rows.length){ main.innerHTML = tabsHtml + `<div class="empty-note">${esc(t("dash.noMessages"))}</div>`; bindMessagesFilterTabs(main, myRoleColumn); return; }
  const otherIds = rows.map(c => String(c.client_id) === String(currentUser.id) ? c.skipper_id : c.client_id);
  const {data: profiles} = await db.from("profiles").select("id,full_name,role,provider_activity").in("id", otherIds);
  const byId = Object.fromEntries((profiles||[]).map(p=>[String(p.id), p]));
  const {data: unreadRows} = await db.from("messages").select("id,conversation_id").is("read_at", null).neq("sender_id", currentUser.id).in("conversation_id", rows.map(c=>c.id));
  const unreadByConv = {};
  (unreadRows||[]).forEach(m => { unreadByConv[m.conversation_id] = (unreadByConv[m.conversation_id]||0) + 1; });
  const sorted = mode === "unread" ? rows.filter(c => unreadByConv[c.id] > 0) : rows;
  if(!sorted.length){ main.innerHTML = tabsHtml + `<div class="empty-note">${esc(mode==="unread" ? t("dash.noUnreadMessages") : t("dash.noMessages"))}</div>`; bindMessagesFilterTabs(main, myRoleColumn); return; }
  const selectionCopy = messageSelectionCopy();
  main.innerHTML = tabsHtml + `<div id="conversationList"><div class="message-selection-bar">
    <label><input type="checkbox" class="message-select-box" id="selectAllConversations">${esc(selectionCopy.all)}</label>
    <span class="message-selection-count">${esc(selectionCopy.scope)} · <span id="conversationSelectionCount" aria-live="polite"></span></span>
    <button type="button" class="small-btn danger" id="deleteSelectedConversations" disabled>${esc(selectionCopy.remove)}</button>
  </div>${sorted.map(c=>{
    const otherId = String(c.client_id) === String(currentUser.id) ? c.skipper_id : c.client_id;
    const p = byId[String(otherId)];
    const unread = unreadByConv[c.id] || 0;
    return `<div style="display:flex;align-items:stretch;gap:6px">
      <label class="message-select-row"><input type="checkbox" class="message-select-box" data-select-conversation="${c.id}" aria-label="${esc(selectionCopy.select)} : ${esc(p?.full_name || "—")}"></label>
      <button type="button" class="request-card" style="flex:1;text-align:left;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px;${unread ? "border-color:var(--aqua);background:var(--mist)" : ""}" data-conversation-id="${c.id}" data-conversation="${c.client_id}|${c.skipper_id}"><strong>${unread ? "🔵 " : ""}${esc(p?.full_name || "—")}</strong><span style="display:flex;align-items:center;gap:8px"><span class="tag">${esc(roleLabel(p))}</span>${unread ? `<span class="tag" style="background:#c0392b;color:#fff">${unread}</span>` : ""}</span></button>
      <button type="button" class="small-btn danger" data-delete-conversation="${c.id}" title="${esc(t("dash.deleteConversation"))}" style="flex:0 0 auto">🗑</button>
    </div>`;
  }).join("")}</div><div id="conversationThread" style="display:none"></div>`;
  bindMessagesFilterTabs(main, myRoleColumn);
  bindConversationSelection(main, myRoleColumn);
  main.querySelectorAll("[data-conversation]").forEach(btn=>btn.addEventListener("click", ()=>{
    const [clientId, skipperId] = btn.dataset.conversation.split("|");
    document.querySelector("#conversationList").style.display = "none";
    document.querySelector("#conversationThread").style.display = "block";
    openConversationThread(clientId, skipperId, btn.dataset.conversationId);
  }));
  main.querySelectorAll("[data-delete-conversation]").forEach(btn=>btn.addEventListener("click", async (e)=>{
    e.stopPropagation();
    if(!confirm(t("dash.confirmDeleteConversation"))) return;
    const {error: delConvError} = await db.from("conversations").delete().eq("id", btn.dataset.deleteConversation);
    if(delConvError){ alert(friendlyError(delConvError)); return; }
    await renderMessagesPanel(myRoleColumn);
  }));
}
async function openConversationThread(clientId, skipperId, conversationId){
  unsubscribeThreadChannel();
  const thread = document.querySelector("#conversationThread") || document.querySelector("#dashMain");
  thread.innerHTML = `<div class="empty-note">${esc(t("dash.loading"))}</div>`;
  try{
    let conversation;
    if(conversationId){
      const {data, error} = await db.from("conversations").select("*").eq("id", conversationId).eq("client_id", clientId).eq("skipper_id", skipperId).single();
      if(error) throw error;
      conversation = data;
    }else{
      conversation = await getOrCreateConversation(clientId, skipperId);
    }
    const otherId = String(clientId) === String(currentUser.id) ? skipperId : clientId;
    const [{data: messages, error}, {data: otherProfile}] = await Promise.all([
      db.from("messages").select("*").eq("conversation_id", conversation.id).order("created_at",{ascending:true}),
      db.from("profiles").select("full_name,role,provider_activity,contact_email,preferred_language").eq("id", otherId).maybeSingle()
    ]);
    if(error) throw error;
    const rows = messages || [];
    const unreadIds = rows.filter(m => String(m.sender_id) !== String(currentUser.id) && !m.read_at).map(m=>m.id);
    if(unreadIds.length){
      const {error: readError} = await db.from("messages").update({read_at: new Date().toISOString()}).eq("conversation_id", conversation.id).neq("sender_id", currentUser.id).in("id", unreadIds);
      if(readError) throw readError;
      await refreshNotifications();
    }
    thread.innerHTML = `
      <button type="button" class="back-link" id="backToConversationList" style="margin:0 0 12px">← ${esc(t("common.back"))}</button>
      <div class="request-top" style="margin-bottom:10px">
        <div><h3 style="margin:0">${esc(otherProfile?.full_name || "—")}</h3></div>
        <span class="tag">${esc(roleLabel(otherProfile))}</span>
      </div>
      <div class="note-box">${esc(t("booking.privacyNote"))}</div>
      <div id="messageThreadBody" style="max-height:320px;overflow:auto;display:flex;flex-direction:column;gap:8px;margin:12px 0">
        ${rows.length ? rows.map(m=>`<div style="align-self:${String(m.sender_id)===String(currentUser.id)?"flex-end":"flex-start"};max-width:80%;display:flex;align-items:flex-end;gap:6px">${String(m.sender_id)===String(currentUser.id)?`<button type="button" class="small-btn" data-delete-message="${m.id}" title="${esc(t("dash.deleteMessage"))}" style="border:0;background:transparent;color:var(--muted);padding:2px 4px;font-size:12px">✕</button>`:""}<div style="background:${String(m.sender_id)===String(currentUser.id)?"var(--navy)":"var(--mist)"};color:${String(m.sender_id)===String(currentUser.id)?"#fff":"var(--ink)"};padding:10px 13px;border-radius:14px">${esc(m.body)}</div></div>`).join("") : `<div class="empty-note">${esc(t("dash.noMessages"))}</div>`}
      </div>
      <div style="display:flex;gap:8px">
        <input id="messageInput" placeholder="${esc(t("dash.messagePlaceholder"))}" style="flex:1;border:1px solid var(--line);border-radius:12px;padding:11px">
        <button class="primary" id="messageSendBtn">${esc(t("dash.send"))}</button>
      </div>`;
    const scrollBody = document.querySelector("#messageThreadBody");
    if(scrollBody) scrollBody.scrollTop = scrollBody.scrollHeight;
    currentThreadChannel = db.channel("conversation-"+conversation.id)
      .on("postgres_changes", {event:"INSERT", schema:"public", table:"messages", filter:`conversation_id=eq.${conversation.id}`}, payload=>{
        const m = payload.new;
        const body_ = document.querySelector("#messageThreadBody");
        if(!body_) return;
        const mine = String(m.sender_id) === String(currentUser.id);
        if(!mine){
          const emptyNote = body_.querySelector(".empty-note");
          if(emptyNote) emptyNote.remove();
          const bubble = document.createElement("div");
          bubble.style.cssText = "align-self:flex-start;max-width:80%;display:flex;align-items:flex-end;gap:6px";
          bubble.innerHTML = `<div style="background:var(--mist);color:var(--ink);padding:10px 13px;border-radius:14px">${esc(m.body)}</div>`;
          body_.appendChild(bubble);
          body_.scrollTop = body_.scrollHeight;
          db.from("messages").update({read_at: new Date().toISOString()}).eq("id", m.id).then(()=>refreshNotifications());
        }
      })
      .subscribe();
    document.querySelectorAll("[data-delete-message]").forEach(btn=>btn.addEventListener("click", async (e)=>{
      e.preventDefault();
      e.stopPropagation();
      if(!confirm(t("dash.confirmDeleteMessage"))) return;
      const {error: delError} = await db.from("messages").delete().eq("id", btn.dataset.deleteMessage);
      if(delError){ alert(friendlyError(delError)); return; }
      await openConversationThread(clientId, skipperId, conversation.id);
    }));
    document.querySelector("#backToConversationList").addEventListener("click", ()=>{ unsubscribeThreadChannel(); renderMessagesPanel(currentMessagesRoleColumn); });
    document.querySelector("#messageSendBtn").addEventListener("click", async ()=>{
      const input = document.querySelector("#messageInput");
      const body = sanitizeContactInfo(input.value.trim());
      if(!body) return;
      const {error: sendError} = await db.from("messages").insert({conversation_id: conversation.id, sender_id: currentUser.id, body});
      if(sendError){ alert(friendlyError(sendError)); return; }
      if(otherProfile?.contact_email){
        fetch(SUPABASE_URL + "/functions/v1/notify-new-message", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            to: otherProfile.contact_email,
            recipientName: otherProfile.full_name || "",
            senderName: currentProfile?.full_name || "",
            preview: body.slice(0, 180)
          })
        }).catch(()=>{});
      }
      notifyRecipient(otherId, currentProfile?.full_name || "SkipperNow", body.slice(0, 150), "https://skippernow.fr");
      input.value = "";
      await openConversationThread(clientId, skipperId, conversation.id);
    });
  }catch(err){
    thread.innerHTML = `<div class="note-box">${esc(friendlyError(err))}</div>`;
  }
}

function profileCompletionPercent(profile){
  if(!profile || !["skipper","provider"].includes(profile.role)) return null;
  const checks = [
    !!profile.profile_photo_url,
    !!(profile.bio && profile.bio.trim()),
    !!(profile.price_from_cents || profile.price_half_day_cents || profile.price_hour_cents),
    !!(profile.skills && profile.skills.trim()),
    !!profile.experience_years,
    !!(profile.phone && profile.phone.trim())
  ];
  if(profileNeedsDiploma(profile)) checks.push(!!(profile.diploma_type && profile.diploma_type.trim()));
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}
function profileForm(profile){
 const isPro = ["skipper","provider","owner"].includes(profile?.role);
 const showPayout = ["skipper","provider"].includes(profile?.role);
 const needsDiploma = profileNeedsDiploma(profile);
 const completion = profileCompletionPercent(profile);
  return `${completion !== null ? `<div class="field" style="margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;color:var(--navy);margin-bottom:6px"><span>${esc(t("account.profileCompletion"))}</span><span>${completion}%</span></div>
      <div style="background:var(--line);border-radius:999px;height:10px;overflow:hidden"><div style="background:var(--aqua);height:100%;width:${completion}%;border-radius:999px;transition:width .3s"></div></div>
    </div>` : ""}
    ${!profile?.profile_photo_url ? `<div class="note-box" style="background:#fff8e6;border-color:#f5d98a;color:#8a6d1a">${esc(t("account.photoReminder"))}</div>` : ""}
    <div class="field"><label>${esc(t("account.photoLabel"))}</label>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        ${profile?.profile_photo_url ? `<img loading="lazy" src="${esc(profile.profile_photo_url)}" style="width:64px;height:64px;object-fit:cover;border-radius:50%">` : `<div style="width:64px;height:64px;border-radius:50%;background:var(--mist);display:grid;place-items:center;font-size:24px">⚓</div>`}
        <input id="profilePhotoInput" type="file" accept="image/*">
      </div>
    </div>
    <div class="field"><label>${esc(t("account.nameLabel"))}</label><input id="profileName" value="${esc(profile?.full_name||"")}"></div>
    <div class="field" style="position:relative"><label>${esc(profile?.role === "provider" ? t("account.zoneLabel") : t("account.portLabel"))}</label><input id="profilePort" autocomplete="off" value="${esc(profile?.home_port||"")}">
      <div id="profilePortSuggestions" class="port-suggestions"></div>
      <div class="muted" style="margin-top:4px;font-size:12px">${esc(t("account.portHelp"))}</div>
    </div>
    <div class="field"><label>${esc(t("account.phoneLabel"))}${needsDiploma ? ' <span style="color:#b42318">*</span>' : ""}</label><input id="profilePhone" value="${esc(profile?.phone||"")}"></div>
    ${isPro ? `<div class="field"><label>${esc(t("account.experienceLabel"))}</label><input id="profileExperience" type="number" min="0" step="1" value="${profile?.experience_years??""}"></div>
    <div class="field"><label>${esc(t("account.languagesLabel"))}</label><input id="profileLanguages" placeholder="${esc(t("account.languagesPlaceholder"))}" value="${esc(profile?.languages||"")}"></div>
    <div class="field"><label>${esc(t("account.skillsLabel"))}</label><input id="profileSkills" placeholder="${esc(t("account.skillsPlaceholder"))}" value="${esc(profile?.skills||"")}"></div>
    <div class="field"><label>${esc(t("account.travelRadiusLabel"))} (km)</label><input id="profileTravelRadius" type="number" min="0" step="1" value="${profile?.travel_radius_km??""}"></div>` : ""}
    ${isPro ? `<div class="field"><label>${esc(t("card.priceFrom"))} (€)</label><input id="profilePriceFrom" type="number" min="0" step="1" value="${profile?.price_from_cents ? Number(profile.price_from_cents)/100 : ""}" placeholder="Ex. 200"></div>
    <div class="field"><label>${esc(t("account.priceHalfDayLabel"))} (€)</label><input id="profilePriceHalf" type="number" min="0" step="1" value="${profile?.price_half_day_cents ? Number(profile.price_half_day_cents)/100 : ""}"></div>
    <div class="field"><label>${esc(t("account.priceHourLabel"))} (€)</label><input id="profilePriceHour" type="number" min="0" step="1" value="${profile?.price_hour_cents ? Number(profile.price_hour_cents)/100 : ""}"></div>
    <div class="field"><label>${esc(t("account.travelFeeLabel"))} (€)</label><input id="profileTravelFee" type="number" min="0" step="1" value="${profile?.travel_fee_cents ? Number(profile.travel_fee_cents)/100 : ""}"></div>` : ""}
    <div class="field"><label>${esc(t("boatDetail.description"))}</label><textarea id="profileBio" rows="4">${esc(profile?.bio||"")}</textarea></div>
    ${needsDiploma ? `<div class="field"><label>${esc(t("account.diplomaLabel"))}</label>
      ${profile?.diploma_url ? `<div class="muted" style="margin-bottom:6px"><a href="${esc(profile.diploma_url)}" target="_blank">${esc(t("account.diplomaCurrent"))}</a></div>` : ""}
      <input id="profileDiplomaInput" type="file" accept="image/*,.pdf">
      <div class="muted" style="margin-top:4px;font-size:12.5px">${esc(t("account.diplomaNote"))}</div>
    </div>
    <div class="field"><label>${esc(t("account.diplomaTypeLabel"))}</label><input id="profileDiplomaType" placeholder="${esc(t("account.diplomaTypePlaceholder"))}" value="${esc(profile?.diploma_type||"")}"></div>` : ""}
    ${["skipper","provider"].includes(profile?.role) ? `<div class="field"><label>${esc(t("account.siretLabel"))}</label><input id="profileSiret" value="${esc(profile?.siret||"")}"></div>
    <div class="field"><label>${esc(t("account.insuranceLabel"))}</label><input id="profileInsurance" placeholder="${esc(t("account.insurancePlaceholder"))}" value="${esc(profile?.insurance_info||"")}"></div>` : ""}
    ${showPayout ? `<div class="note-box"><p>${esc(t("dash.payoutSetupNote"))}</p><button class="small-btn" type="button" id="profilePayoutLink">${esc(t("dash.managePayoutDetails"))}</button></div>` : ""}
    <div class="note-box" style="margin-top:14px">
      <strong>${esc(saleText("Sécurité du compte","Account security","Seguridad de la cuenta"))}</strong>
      <div class="field" style="margin-top:10px"><label>${esc(saleText("Nouveau mot de passe","New password","Nueva contraseña"))}</label><input id="profileNewPassword" type="password" minlength="8" placeholder="${esc(saleText("8 caractères minimum","At least 8 characters","Mínimo 8 caracteres"))}"></div>
      <div class="field"><label>${esc(saleText("Confirmer le mot de passe","Confirm password","Confirmar contraseña"))}</label><input id="profileNewPasswordConfirm" type="password" minlength="8"></div>
      <button class="small-btn" type="button" id="changePasswordBtn">${esc(saleText("Changer mon mot de passe","Change my password","Cambiar mi contraseña"))}</button>
      <p class="ok-text" id="changePasswordMsg"></p>
    </div>
    <button class="primary wide" id="saveProfileBtn">${esc(t("dash.saveSettings"))}</button>
    <p class="ok-text" id="profileMsg"></p>`;
}
let profilePortSearchTimer;
function bindProfilePortAutocomplete(){
  const input = document.querySelector("#profilePort");
  const box = document.querySelector("#profilePortSuggestions");
  if(!input || !box || input.dataset.bound) return;
  input.dataset.bound = "1";
  const render = (items)=>{
    box.innerHTML = items.map((x,i)=>`<button type="button" class="port-option" data-i="${i}"><strong>${esc(x.name)}</strong><small>${esc(x.place)}</small></button>`).join("");
    box.classList.toggle("open", items.length>0);
    [...box.querySelectorAll(".port-option")].forEach((btn,i)=>btn.onclick=()=>{
      input.value = items[i].place && items[i].place !== items[i].name ? `${items[i].name}, ${items[i].place}` : items[i].name;
      box.classList.remove("open");
    });
  };
  const search = async (q)=>{
    const local = localPortMatches(q);
    if(q.length < 3){ render(local); return; }
    try{
      const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=" + encodeURIComponent(q + " port marina");
      const res = await fetch(url,{headers:{"Accept-Language":currentLang}});
      const data = await res.json();
      const remote = data.map(x=>({name:(x.name||x.display_name.split(",")[0]),place:x.display_name}));
      const seen = new Set();
      const merged = [...local, ...remote].filter(x=>{const k=(x.name+"|"+x.place).toLowerCase();if(seen.has(k))return false;seen.add(k);return true}).slice(0,10);
      render(merged);
    }catch(_e){ render(local); }
  };
  input.addEventListener("focus", ()=>{ if(!input.value) render(POPULAR_PORTS.slice(0,8).map(x=>({name:x[0],place:x[1]}))); });
  input.addEventListener("input", ()=>{ clearTimeout(profilePortSearchTimer); profilePortSearchTimer = setTimeout(()=>search(input.value.trim()),300); });
  document.addEventListener("click", e=>{ if(!e.target.closest("#profilePortSuggestions") && e.target.id!=="profilePort") box.classList.remove("open"); });
}
