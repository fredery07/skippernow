"use strict";
async function openBoatFinder(presetPort, presetType){
  openModal("boatFinderModal");
  const box = document.querySelector("#boatFinderResults");
  box.innerHTML = `<div class="empty-note">…</div>`;
  const finderPort = document.querySelector("#boatFinderPortInput");
  if(presetPort) finderPort.value = presetPort;
  else if(portInput.value.trim()) finderPort.value = portInput.value.trim();
  if(presetType) document.querySelector("#boatFinderTypeInput").value = presetType;
  const {data, error} = await db.from("boats").select("*").in("listing_type",["rental","both"]).eq("rental_available",true).order("created_at",{ascending:false});
  if(error){ box.innerHTML = `<div class="empty-note">${esc(friendlyError(error))}</div>`; return; }
  boatCache = data || [];
  renderBoatResults();
  if(!finderPort.dataset.bound){
    finderPort.dataset.bound = "1";
    finderPort.addEventListener("input", debounce(renderBoatResults, 350));
    document.querySelector("#boatFinderTypeInput").addEventListener("change", renderBoatResults);
    document.querySelector("#boatFinderCapacityInput").addEventListener("input", debounce(renderBoatResults, 350));
    document.querySelector("#boatFinderSkipperInput").addEventListener("change", renderBoatResults);
  }
}
async function renderBoatResults(){
  const box = document.querySelector("#boatFinderResults");
  const portFilter = (document.querySelector("#boatFinderPortInput")?.value || "").trim().toLowerCase();
  const typeFilter = document.querySelector("#boatFinderTypeInput")?.value || "";
  const capacityFilter = Number(document.querySelector("#boatFinderCapacityInput")?.value) || 0;
  const skipperFilter = document.querySelector("#boatFinderSkipperInput")?.value || "";
  const byPort = await filterByPortNearby(boatCache, portFilter, b=>b.home_port, 25);
  const list = byPort.filter(b=>{
    if(typeFilter && b.boat_type !== typeFilter) return false;
    if(capacityFilter && Number(b.capacity||0) < capacityFilter) return false;
    if(skipperFilter === "with" && !b.skipper_included) return false;
    if(skipperFilter === "without" && b.skipper_included) return false;
    return true;
  });
  box.innerHTML = list.length ? list.map(b=>boatListCardHtml(b,"rental")).join("") : `<div class="empty-note">${esc(t("boatFinder.empty"))}</div>`;
  startBoatCardCarousels();
}
function saleText(fr,en,es){ return currentLang === "en" ? en : currentLang === "es" ? es : fr; }
async function openBoatSaleFinder(presetPort){
  openModal("boatSaleFinderModal");
  const box = document.querySelector("#boatSaleResults");
  box.innerHTML = `<div class="empty-note">…</div>`;
  const finderPort = document.querySelector("#boatSalePortInput");
  if(presetPort) finderPort.value = presetPort;
  else if(portInput.value.trim()) finderPort.value = portInput.value.trim();
  const {data,error} = await db.from("boats").select("*").eq("managed_by_platform",true).eq("listing_type","sale").eq("sale_status","available").order("featured",{ascending:false}).order("created_at",{ascending:false});
  if(error){ box.innerHTML = `<div class="empty-note">${esc(friendlyError(error))}</div>`; return; }
  saleBoatCache = data || [];
  renderBoatSaleResults();
  if(!finderPort.dataset.bound){
    finderPort.dataset.bound = "1";
    finderPort.addEventListener("input", debounce(renderBoatSaleResults, 300));
    document.querySelector("#boatSaleTypeInput").addEventListener("change", renderBoatSaleResults);
    document.querySelector("#boatSaleMaxPriceInput").addEventListener("input", debounce(renderBoatSaleResults, 300));
  }
}
async function renderBoatSaleResults(){
  const box = document.querySelector("#boatSaleResults");
  const portFilter = (document.querySelector("#boatSalePortInput")?.value || "").trim().toLowerCase();
  const typeFilter = document.querySelector("#boatSaleTypeInput")?.value || "";
  const maxPrice = Number(document.querySelector("#boatSaleMaxPriceInput")?.value) || 0;
  const byPort = await filterByPortNearby(saleBoatCache, portFilter, b=>b.home_port, 50);
  const list = byPort.filter(b=>{
    if(typeFilter && b.boat_type !== typeFilter) return false;
    if(maxPrice && Number(b.sale_price||0) > maxPrice) return false;
    return true;
  });
  box.innerHTML = list.length ? list.map(b=>boatListCardHtml(b,"sale")).join("") : `<div class="empty-note">${esc(saleText("Aucun bateau à vendre ne correspond à votre recherche.","No boats for sale match your search.","Ningún barco en venta coincide con tu búsqueda."))}</div>`;
  startBoatCardCarousels();
}
let excursionCache = [];
let excursionRequestTarget = null;
async function openExcursionFinder(presetPort){
  openModal("excursionFinderModal");
  const box = document.querySelector("#excFinderResults");
  box.innerHTML = `<div class="empty-note">…</div>`;
  const finderPort = document.querySelector("#excFinderPortInput");
  if(presetPort) finderPort.value = presetPort;
  else if(portInput.value.trim()) finderPort.value = portInput.value.trim();
  const {data, error} = await db.from("excursions").select("*").eq("active", true).order("created_at",{ascending:false});
  if(error){ box.innerHTML = `<div class="empty-note">${esc(friendlyError(error))}</div>`; return; }
  excursionCache = data || [];
  renderExcursionResults();
  if(!finderPort.dataset.bound){
    finderPort.dataset.bound = "1";
    finderPort.addEventListener("input", debounce(renderExcursionResults, 350));
  }
}
async function renderExcursionResults(){
  const box = document.querySelector("#excFinderResults");
  const portFilter = (document.querySelector("#excFinderPortInput")?.value || "").trim().toLowerCase();
  const list = await filterByPortNearby(excursionCache, portFilter, x=>x.port, 25);
  box.innerHTML = list.length ? list.map(x=>excursionCardHtml(x)).join("") : `<div class="empty-note">${esc(t("excFinder.empty"))}</div>`;
  box.querySelectorAll("[data-request-exc]").forEach(btn=>btn.addEventListener("click", ()=>openExcursionRequest(btn.dataset.requestExc)));
}
function excursionCardHtml(x){
  const photo = Array.isArray(x.photo_urls) && x.photo_urls[0] ? x.photo_urls[0] : "";
  return `<article class="boat-card">
    ${photo ? `<div class="boat-card-photo" style="background-image:url('${esc(photo)}')"></div>` : ""}
    <div class="boat-card-body">
      <h3>${esc(x.title)}</h3>
      <div class="muted">${esc(x.port)} · ${esc(String(x.duration_hours))}h · ${esc(String(x.max_guests))} ${esc(t("dash.guests"))} max</div>
      <p style="margin:8px 0">${esc(x.description||"")}</p>
      ${x.included ? `<div class="muted" style="font-size:12.5px">${esc(x.included)}</div>` : ""}
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px">
        <strong>${moneyC(x.price_cents, x.currency)} <span class="muted" style="font-weight:400">${esc(t("excFinder.perPerson"))}</span></strong>
        <button class="small-btn fill" data-request-exc="${x.id}">${esc(t("dash.requestExcursion"))}</button>
      </div>
    </div>
  </article>`;
}
function openExcursionRequest(excursionId){
  excursionRequestTarget = excursionCache.find(x=>String(x.id)===String(excursionId));
  if(!excursionRequestTarget) return;
  document.querySelector("#excReqGuests").max = excursionRequestTarget.max_guests;
  document.querySelector("#excRequestMsg").textContent = "";
  openModal("excursionRequestModal");
}
const excReqDate = document.querySelector("#excReqDate");
if (excReqDate) {
  excReqDate.min = localDateStr();
}
document.querySelector("#excRequestForm")?.addEventListener("submit", async e=>{
  e.preventDefault();
  const msg = document.querySelector("#excRequestMsg");
  if(!currentUser){ msg.style.color = "#b42318"; msg.textContent = t("booking.needAccount") || t("nav.login"); return; }
  const x = excursionRequestTarget;
  if(!x) return;
  const guests = Number(document.querySelector("#excReqGuests").value);
  const date = document.querySelector("#excReqDate").value;
  const starts = new Date(date + "T10:00:00");
  const ends = new Date(starts.getTime() + Number(x.duration_hours)*3600000);
  const {error} = await db.from("missions").insert({
    client_id: currentUser.id,
    provider_id: x.provider_id,
    excursion_id: x.id,
    guest_count: guests,
    port: x.port,
    boat_type: x.title,
    description: x.description,
    photo_urls: x.photo_urls || null,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    amount_cents: 0,
    urgent_fee_cents: 0,
    platform_fee_cents: 0,
    currency: x.currency,
    status: "pending",
    payment_status: "unpaid"
  });
  if(error){ msg.style.color = "#b42318"; msg.textContent = friendlyError(error); return; }
  msg.style.color = "";
  msg.textContent = t("dash.excRequestSent");
  setTimeout(()=>closeModal("excursionRequestModal"), 1400);
});

let directRequestTarget = null;
async function openDirectRequest(proId){
  const {data: pro, error} = await db.from("profiles").select("id,full_name,role,home_port").eq("id", proId).eq("verified", true).eq("suspended", false).maybeSingle();
  if(error || !pro) return;
  directRequestTarget = pro;
  // A returning client who follows the professional's link must land on the
  // request already sent, not on an empty form that could create a duplicate.
  if(currentUser && currentProfile?.role === "client"){
    const {data: existing} = await db.from("missions").select("id")
      .eq("client_id", currentUser.id)
      .or(`provider_id.eq.${pro.id},skipper_id.eq.${pro.id}`)
      .in("status", ["pending","quoted","accepted","in_progress","awaiting_validation"])
      .order("created_at", {ascending:false}).limit(1).maybeSingle();
    if(existing){
      closeModal("directRequestModal");
      await openDashboard();
      return;
    }
  }
  document.querySelector("#directReqProName").textContent = t("directReq.title") + " — " + (pro.full_name || "");
  document.querySelector("#directReqPort").value = pro.home_port || "";
  const loggedOut = document.querySelector("#directReqLoggedOut");
  const form = document.querySelector("#directReqForm");
  if(currentUser){ loggedOut.style.display = "none"; form.style.display = ""; }
  else{ loggedOut.style.display = ""; form.style.display = "none"; }
  document.querySelector("#directReqMsg").textContent = "";
  openModal("directRequestModal");
}
document.querySelector("#directReqLoginBtn")?.addEventListener("click", ()=>{
  closeModal("directRequestModal");
  openAccountModal("login");
});
document.querySelector("#directReqForm")?.addEventListener("submit", async e=>{
  e.preventDefault();
  const msg = document.querySelector("#directReqMsg");
  if(!currentUser || !directRequestTarget) return;
  const pro = directRequestTarget;
  const port = document.querySelector("#directReqPort").value.trim();
  const date = document.querySelector("#directReqDate").value;
  const description = document.querySelector("#directReqDesc").value.trim();
  const payload = {
    client_id: currentUser.id,
    port,
    boat_type: t("directReq.requestLabel"),
    description,
    starts_at: date ? new Date(date + "T10:00:00").toISOString() : null,
    amount_cents: 0,
    urgent_fee_cents: 0,
    platform_fee_cents: 0,
    status: "pending",
    payment_status: "unpaid"
  };
  if(pro.role === "provider") payload.provider_id = pro.id; else payload.skipper_id = pro.id;
  const {error} = await db.from("missions").insert(payload);
  if(error){ msg.style.color = "#b42318"; msg.textContent = friendlyError(error); return; }
  msg.style.color = "";
  msg.textContent = t("directReq.sent");
  setTimeout(async ()=>{ closeModal("directRequestModal"); await openDashboard(); }, 900);
});
function boatTypeLabel(type){
  const key = type === "motorboat" ? "boatDetail.typeMotorboat" : type === "rib" ? "boatDetail.typeRib" : type === "catamaran" ? "boatDetail.typeCatamaran" : "boatDetail.typeSailboat";
  return t(key);
}
function boatSpecsChips(b){
  const parts = [];
  if(b.brand) parts.push(esc(b.brand));
  if(b.boat_type) parts.push(boatTypeLabel(b.boat_type));
  if(b.skipper_included !== null && b.skipper_included !== undefined) parts.push(t(b.skipper_included ? "boatDetail.skipperIncludedTag" : "boatDetail.skipperOptionalTag"));
  if(b.capacity) parts.push(`${b.capacity} ${esc(t("boatDetail.pax"))}`);
  if(b.cabins !== null && b.cabins !== undefined) parts.push(`${b.cabins} ${esc(t(b.cabins===1?"boatDetail.cabin":"boatDetail.cabins"))}`);
  if(b.berths) parts.push(`${b.berths} ${esc(t("boatDetail.berths"))}`);
  if(b.year_built) parts.push(String(b.year_built));
  if(b.length_m) parts.push(`${esc(b.length_m)} m`);
  return parts;
}
function boatSpecsLine(b){
  return boatSpecsChips(b).join(" · ");
}
function isFavoriteBoat(id){
  try{ return JSON.parse(localStorage.getItem("skippernow-boat-favorites")||"[]").includes(String(id)); }catch(_e){ return false; }
}
window.toggleBoatFavorite = function(id, ev){
  ev.stopPropagation();
  let favs = [];
  try{ favs = JSON.parse(localStorage.getItem("skippernow-boat-favorites")||"[]"); }catch(_e){}
  const key = String(id);
  favs = favs.includes(key) ? favs.filter(x=>x!==key) : [...favs, key];
  localStorage.setItem("skippernow-boat-favorites", JSON.stringify(favs));
  const btn = document.querySelector(`[data-favorite-btn="${key}"]`);
  if(btn) btn.textContent = favs.includes(key) ? "♥" : "♡";
};
function normalizeBoatTitle(b){
  const composed = [b.brand, b.model].filter(Boolean).join(" ").trim();
  if(composed) return composed;
  if(b.name && b.name.trim()) return b.name.trim().replace(/\w\S*/g, w=>w[0].toUpperCase()+w.slice(1).toLowerCase());
  return "Bateau";
}
function normalizePlaceLabel(place){
  if(!place || !place.trim()) return "—";
  return place.trim().replace(/\w\S*/g, w=>w[0].toUpperCase()+w.slice(1).toLowerCase());
}
function boatPriceLabel(b, mode="rental"){
  if(mode === "sale"){
    const sale = Number(b.sale_price||0);
    return sale ? money(sale*100) : esc(saleText("Prix sur demande","Price on request","Precio a consultar"));
  }
  const day = Number(b.price_per_day||b.daily_price||b.price||0);
  const half = Number(b.price_half_day||0);
  if(day) return `${esc(t("card.priceFrom"))} ${money(day*100)}${esc(t("boatDetail.perDaySuffix"))}`;
  if(half) return `${esc(t("card.priceFrom"))} ${money(half*100)}${esc(t("boatDetail.perHalfDaySuffix"))}`;
  return esc(t("boatDetail.onRequest"));
}
function boatListCardHtml(b, mode="rental"){
  const priceLabel = boatPriceLabel(b, mode);
  const photos = (Array.isArray(b.photo_urls) && b.photo_urls.length ? b.photo_urls : (b.photo_url ? [b.photo_url] : []));
  const specsLine = boatSpecsLine(b);
  return `<article class="boat-list-card" onclick="openBoatDetail('${b.id}','${mode}')">
    <div class="boat-list-photo" data-carousel="${b.id}">
      ${photos.length ? photos.map((url,i)=>`<div class="boat-photo-slide ${i===0?"active":""}" style="background-image:url('${esc(url)}')"></div>`).join("") : `<div class="no-photo">⛵</div>`}
      ${photos.length > 1 ? `<div class="boat-card-dots">${photos.map((_,i)=>`<span class="${i===0?"active":""}"></span>`).join("")}</div>` : ""}
      ${mode==="sale" ? `<span class="sale-listing-badge">${esc(saleText("À VENDRE","FOR SALE","EN VENTA"))}</span>` : ""}
      ${mode==="sale" && b.managed_by_platform ? `<span class="sale-listing-badge" style="top:48px;background:var(--navy);color:#fff">SKIPPERNOW</span>` : ""}
      <button type="button" class="boat-card-fav" data-favorite-btn="${b.id}" onclick="toggleBoatFavorite('${b.id}', event)">${isFavoriteBoat(b.id) ? "♥" : "♡"}</button>
    </div>
    <div class="boat-list-body">
      <div class="boat-list-top">
        <h3 style="margin:0">${esc(normalizeBoatTitle(b))}${b.verified ? verifiedBoatBadgeHtml() : ""}</h3>
      </div>
      <div class="boat-card-port">📍 ${esc(normalizePlaceLabel(b.home_port))}</div>
      ${b.description ? `<p class="boat-list-desc">${esc(b.description)}</p>` : ""}
      <div class="boat-list-bottom">
        ${specsLine ? `<div class="boat-card-specs-line">${specsLine}</div>` : "<span></span>"}
        <strong>${priceLabel}</strong>
      </div>
    </div>
  </article>`;
}
function boatCardHtml(b, mode="rental"){
  const priceLabel = boatPriceLabel(b, mode);
  const photos = (Array.isArray(b.photo_urls) && b.photo_urls.length ? b.photo_urls : (b.photo_url ? [b.photo_url] : []));
  const chips = boatSpecsChips(b);
  const isFeaturedNow = b.featured && b.featured_until && new Date(b.featured_until) > new Date();
  return `<article class="boat-card" onclick="openBoatDetail('${b.id}','${mode}')">
    <div class="boat-card-photo" data-carousel="${b.id}">
      ${photos.length ? photos.map((url,i)=>`<div class="boat-photo-slide ${i===0?"active":""}" style="background-image:url('${esc(url)}')"></div>`).join("") : `<div class="no-photo">⛵</div>`}
      ${photos.length > 1 ? `<div class="boat-card-dots">${photos.map((_,i)=>`<span class="${i===0?"active":""}"></span>`).join("")}</div>` : ""}
      <button type="button" class="boat-card-fav" data-favorite-btn="${b.id}" onclick="toggleBoatFavorite('${b.id}', event)">${isFavoriteBoat(b.id) ? "♥" : "♡"}</button>
      ${mode==="sale" && b.managed_by_platform ? `<span class="sale-listing-badge" style="background:var(--navy);color:#fff">SKIPPERNOW</span>` : ""}
      ${isFeaturedNow ? `<span class="boat-card-featured">★ ${esc(t("card.featuredBadge"))}</span>` : ""}
      <span class="boat-card-price">${priceLabel}</span>
    </div>
    <div class="boat-card-body">
      <h3>${esc(normalizeBoatTitle(b))}${b.verified ? verifiedBoatBadgeHtml() : ""}</h3>
      <div class="boat-card-port">📍 ${esc(normalizePlaceLabel(b.home_port))}</div>
      ${chips.length ? `<div class="boat-card-specs-line">${chips.map(c=>`<span class="spec-chip">${c}</span>`).join("")}</div>` : ""}
    </div>
  </article>`;
}
let activeCardIntervals = [];
function stopBoatCardCarousels(){
  activeCardIntervals.forEach(id=>clearInterval(id));
  activeCardIntervals = [];
}
function startBoatCardCarousels(){
  stopBoatCardCarousels();
  document.querySelectorAll("[data-carousel]").forEach(box=>{
    const slides = [...box.querySelectorAll(".boat-photo-slide")];
    const dots = [...box.querySelectorAll(".boat-card-dots span")];
    if(slides.length < 2) return;
    let index = 0;
    const intervalId = setInterval(()=>{
      slides[index].classList.remove("active");
      dots[index]?.classList.remove("active");
      index = (index + 1) % slides.length;
      slides[index].classList.add("active");
      dots[index]?.classList.add("active");
    }, 2800);
    activeCardIntervals.push(intervalId);
  });
}
function renderHomeBoatStrip(){
  const box = document.querySelector("#homeBoatStrip");
  const list = boatCache.slice(0,4);
  box.innerHTML = list.length ? `<div class="boat-grid${list.length===1?" boat-grid--single":""}">${list.map(b=>boatCardHtml(b,"rental")).join("")}</div>` : `
    <div class="home-empty-state">
      <span class="home-empty-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><path d="M3 15.5h18l-2.4 3.2a3 3 0 0 1-2.4 1.2H7.8a3 3 0 0 1-2.4-1.2L3 15.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M7 15.5 9.2 8h5.9l2 7.5M12 8V4m0 0 3.2 2.1M12 4 8.8 6.1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      <span class="home-empty-state-copy"><strong>${esc(t("rental.emptyTitle"))}</strong><span>${esc(t("rental.emptyText"))}</span></span>
      <button id="emptyListBoatBtn" type="button">${esc(t("rental.emptyCta"))}</button>
    </div>`;
  document.querySelector("#emptyListBoatBtn")?.addEventListener("click", ()=>document.querySelector("#listBoatBtn")?.click());
  startBoatCardCarousels();
}
async function preloadHomeBoats(){
  const nowIso = new Date().toISOString();
  const {data:featuredData} = await db.from("boats").select("*").in("listing_type",["rental","both"]).eq("rental_available",true).eq("featured", true).gt("featured_until", nowIso).order("featured_until",{ascending:true}).limit(4);
  const featured = featuredData || [];
  let list = featured;
  if(list.length < 4){
    const {data:recentData} = await db.from("boats").select("*").in("listing_type",["rental","both"]).eq("rental_available",true).order("created_at",{ascending:false}).limit(4 + featured.length);
    const featuredIds = new Set(featured.map(b=>String(b.id)));
    const recent = (recentData||[]).filter(b=>!featuredIds.has(String(b.id)));
    list = featured.concat(recent).slice(0,4);
  }
  boatCache = list;
  renderHomeBoatStrip();
}
function renderHomeSaleBoatStrip(){
  const box = document.querySelector("#homeSaleBoatStrip");
  if(!box) return;
  const list = saleBoatCache.slice(0,4);
  box.innerHTML = list.length ? `<div class="boat-grid${list.length===1?" boat-grid--single":""}">${list.map(b=>boatCardHtml(b,"sale")).join("")}</div>` : `<div class="home-empty-state"><span class="home-empty-state-icon">⚓</span><span class="home-empty-state-copy"><strong>${esc(saleText("Les premières ventes arrivent","First boats for sale coming soon","Próximamente los primeros barcos en venta"))}</strong><span>${esc(saleText("Publiez gratuitement votre bateau dès maintenant.","List your boat for free now.","Publica tu barco gratis ahora."))}</span></span><button id="emptySellBoatBtn" type="button">${esc(saleText("Vendre mon bateau","Sell my boat","Vender mi barco"))}</button></div>`;
  document.querySelector("#emptySellBoatBtn")?.addEventListener("click", ()=>document.querySelector("#sellBoatBtn")?.click());
  startBoatCardCarousels();
}
async function preloadHomeSales(){
  const {data,error} = await db.from("boats").select("*").eq("managed_by_platform",true).eq("listing_type","sale").eq("sale_status","available").order("featured",{ascending:false}).order("created_at",{ascending:false}).limit(4);
  if(error){ console.warn("SkipperNow home sales:",error); saleBoatCache=[]; renderHomeSaleBoatStrip(); return; }
  saleBoatCache = data || [];
  renderHomeSaleBoatStrip();
}
let homeProvidersCache = [];
let homeProvidersIndex = 0;
async function preloadHomeProviders(){
  const {data,error} = await db.from("profiles")
    .select("id,full_name,role,provider_activity,home_port,profile_photo_url,rating,rating_count,featured,created_at")
    .eq("verified", true)
    .eq("available", true)
    .in("role",["skipper","provider"])
    .order("featured",{ascending:false})
    .order("created_at",{ascending:false})
    .limit(8);
  if(error){ console.warn("SkipperNow home providers:",error); homeProvidersCache = []; renderHomeProvidersStrip(); return; }
  homeProvidersCache = data || [];
  renderHomeProvidersStrip();
}
function renderHomeProvidersStrip(){
  const box = document.querySelector("#homeProvidersStrip");
  if(!box) return;
  if(!homeProvidersCache.length){
    box.innerHTML = `<div class="home-empty-state"><span class="home-empty-state-icon" aria-hidden="true">⚓</span><span class="home-empty-state-copy"><strong>${esc(t("providersShowcase.empty"))}</strong><span>${esc(t("join.providerText"))}</span></span><button id="emptyJoinProviderBtn" type="button">${esc(t("join.providerCta"))}</button></div>`;
    document.querySelector("#emptyJoinProviderBtn")?.addEventListener("click",()=>openAccountModal("create","provider"));
    return;
  }
  homeProvidersIndex = 0;
  resultsCache = resultsCache.concat(homeProvidersCache);
  box.innerHTML = `
    <div class="provider-spotlight" id="providerSpotlightPhoto">
      <span class="provider-spotlight-badge">✓ ${esc(t("card.verifiedBadge"))}</span>
      <span class="provider-spotlight-rating" id="providerSpotlightRating"></span>
    </div>
    <div class="provider-spotlight-body">
      <h4 id="providerSpotlightName"></h4>
      <div class="muted" id="providerSpotlightMeta"></div>
      <button class="small-btn fill" id="providerSpotlightCta" type="button" style="margin-top:10px">${esc(t("card.viewProfile"))}</button>
    </div>
    <div class="boat-card-dots" id="providerSpotlightDots" style="position:static;margin-top:10px;justify-content:flex-start"></div>`;
  renderProviderSpotlight();
  if(homeProvidersCache.length > 1 && !box.dataset.carouselRunning){
    box.dataset.carouselRunning = "1";
    setInterval(()=>{
      const photo = document.querySelector("#providerSpotlightPhoto");
      if(photo) photo.style.opacity = "0";
      setTimeout(()=>{
        homeProvidersIndex = (homeProvidersIndex + 1) % homeProvidersCache.length;
        renderProviderSpotlight();
        if(photo) photo.style.opacity = "1";
      }, 250);
    }, 3400);
  }
}
document.querySelector("#viewAllProvidersBtn")?.addEventListener("click",()=>{
  showProviderCategories();
  openModal("providerModal");
});
const ACTIVITY_ICON = {skipper:"⚓",cleaning:"🧽",dock_service:"🧽",shipyard:"🛠️",day_sailor:"👷",boat_rental_pro:"🚤",provisioning:"🛒"};
function renderProviderSpotlight(){
  const p = homeProvidersCache[homeProvidersIndex];
  if(!p) return;
  const photo = document.querySelector("#providerSpotlightPhoto");
  if(!photo) return;
  const activity = p.provider_activity || "skipper";
  photo.style.backgroundImage = p.profile_photo_url ? `url('${esc(p.profile_photo_url)}')` : "";
  const iconEl = photo.querySelector(".ph-icon");
  if(iconEl) iconEl.remove();
  if(!p.profile_photo_url) photo.insertAdjacentHTML("afterbegin", `<div class="ph-icon">${ACTIVITY_ICON[activity]||"⚓"}</div>`);
  document.querySelector("#providerSpotlightName").textContent = p.full_name || "—";
  document.querySelector("#providerSpotlightMeta").textContent = `${activityLabel(activity)} · ${p.home_port||"—"}`;
  document.querySelector("#providerSpotlightRating").textContent = profileRatingText(p);
  const cta = document.querySelector("#providerSpotlightCta");
  if(cta) cta.onclick = ()=>openProfileDetail(p.id);
  const dots = document.querySelector("#providerSpotlightDots");
  if(dots) dots.innerHTML = homeProvidersCache.map((_,i)=>`<span class="${i===homeProvidersIndex?"active":""}"></span>`).join("");
}
window.openBoatDetail = async function(id, mode){
  let boat = [...boatCache,...saleBoatCache].find(b=>String(b.id)===String(id));
  if(!boat){
    const {data} = await db.from("boats").select("*").eq("id",id).maybeSingle();
    boat = data;
  }
  if(!boat) return;
  const viewMode = mode || (boat.listing_type==="sale" ? "sale" : "rental");
  closeModal("boatFinderModal");
  closeModal("boatSaleFinderModal");
  const content = document.querySelector("#boatDetailContent");
  const half = Number(boat.price_half_day||0), day = Number(boat.price_per_day||boat.daily_price||boat.price||0), sale = Number(boat.sale_price||0);
  const photos = (Array.isArray(boat.photo_urls) && boat.photo_urls.length ? boat.photo_urls : (boat.photo_url ? [boat.photo_url] : []));
  const saleFacts = viewMode==="sale" ? `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:18px">
      <div style="border:1px solid var(--line);border-radius:14px;padding:12px;text-align:center"><div style="color:var(--muted);font-size:11px;font-weight:800;text-transform:uppercase">${esc(saleText("Prix de vente","Sale price","Precio de venta"))}</div><div class="sale-price" style="margin-top:4px">${sale?money(sale*100):esc(saleText("Sur demande","On request","A consultar"))}</div></div>
      ${boat.engine_hours!=null ? `<div style="border:1px solid var(--line);border-radius:14px;padding:12px;text-align:center"><div style="color:var(--muted);font-size:11px;font-weight:800;text-transform:uppercase">${esc(saleText("Heures moteur","Engine hours","Horas de motor"))}</div><div style="font-size:18px;font-weight:900;margin-top:4px">${esc(boat.engine_hours)} h</div></div>` : ""}
      ${boat.year_built ? `<div style="border:1px solid var(--line);border-radius:14px;padding:12px;text-align:center"><div style="color:var(--muted);font-size:11px;font-weight:800;text-transform:uppercase">${esc(saleText("Année","Year","Año"))}</div><div style="font-size:18px;font-weight:900;margin-top:4px">${esc(boat.year_built)}</div></div>` : ""}
    </div>` : `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">
      <div style="border:1px solid var(--line);border-radius:14px;padding:12px;text-align:center"><div style="color:var(--muted);font-size:11px;font-weight:800;text-transform:uppercase">${esc(t("boatDetail.halfDay"))}</div><div style="font-size:18px;font-weight:900;margin-top:4px">${half?money(half*100):esc(t("boatDetail.onRequest"))}</div></div>
      <div style="border:1px solid var(--line);border-radius:14px;padding:12px;text-align:center"><div style="color:var(--muted);font-size:11px;font-weight:800;text-transform:uppercase">${esc(t("boatDetail.fullDay"))}</div><div style="font-size:18px;font-weight:900;margin-top:4px">${day?money(day*100):esc(t("boatDetail.onRequest"))}</div></div>
    </div>`;
  const action = (currentUser && String(boat.client_id)===String(currentUser.id))
    ? `<div class="note-box">${esc(t("boatDetail.ownListing"))}</div>`
    : viewMode==="sale"
      ? `<button class="primary wide" onclick="openSaleInquiry('${esc(boat.id)}')">${esc(boat.managed_by_platform ? saleText("Contacter SkipperNow","Contact SkipperNow","Contactar con SkipperNow") : saleText("Contacter le vendeur","Contact seller","Contactar al vendedor"))}</button>`
      : `<button class="primary wide" onclick="closeModal('boatDetailModal');openBookingFor('${esc(boat.client_id||"")}','${esc(String(boat.name||"Bateau").replace(/'/g,"\\'"))}','${esc(String(boat.home_port||"").replace(/'/g,"\\'"))}','boat_rental')">${esc(t("boatDetail.request"))}</button>`;
  content.innerHTML = `
    <div class="boat-detail-photo" style="margin:-26px -26px 0;height:230px;border-radius:22px 22px 0 0;overflow:hidden;${photos.length?"":"background:linear-gradient(135deg,#173b51,#3f9c9a)"}">
      ${photos.length ? photos.map((url,i)=>`<div class="boat-photo-slide ${i===0?"active":""}" data-detail-slide style="background-image:url('${esc(url)}')"></div>`).join("") : `<div style="position:absolute;inset:0;display:grid;place-items:center;font-size:42px;color:rgba(255,255,255,.85)">⛵</div>`}
      ${photos.length > 1 ? `<button type="button" class="boat-carousel-arrow prev" onclick="stepBoatDetailPhoto(-1)">‹</button><button type="button" class="boat-carousel-arrow next" onclick="stepBoatDetailPhoto(1)">›</button><div class="boat-card-dots" data-detail-dots>${photos.map((_,i)=>`<span class="${i===0?"active":""}"></span>`).join("")}</div>` : ""}
      <button class="close" type="button" onclick="closeModal('boatDetailModal')" style="position:absolute;top:14px;right:14px;background:rgba(255,255,255,.92);z-index:3">×</button>
      ${viewMode==="sale" ? `<span class="sale-listing-badge">${esc(saleText("À VENDRE","FOR SALE","EN VENTA"))}</span>` : ""}
    </div>
    <div style="padding-top:18px">
      <small style="color:var(--muted);font-weight:800;letter-spacing:.05em;text-transform:uppercase;font-size:11px">${esc(viewMode==="sale"?saleText("VENTE DE BATEAUX","BOATS FOR SALE","BARCOS EN VENTA"):t("boatFinder.eyebrow"))}</small>
      <h2 style="margin:4px 0 6px">${esc(normalizeBoatTitle(boat))}${boat.verified ? verifiedBoatBadgeHtml() : ""}</h2>
      <div class="boat-card-port" style="margin-bottom:12px">📍 ${esc(boat.home_port||"—")}</div>
      ${boatSpecsLine(boat) ? `<div class="boat-card-specs-line" style="margin-bottom:18px;font-size:14px">${boatSpecsLine(boat)}</div>` : ""}
      ${saleFacts}
      ${viewMode==="sale" && boat.managed_by_platform ? `<div class="note-box" style="margin-bottom:14px"><strong>SkipperNow</strong> · ${esc(saleText("Annonce publiée et gérée par SkipperNow pour le compte du propriétaire.","Listing published and managed by SkipperNow on behalf of the owner.","Anuncio publicado y gestionado por SkipperNow por cuenta del propietario."))}</div>` : ""}
      <p class="muted">${esc(boat.description||t("boatDetail.noDescription"))}</p>
      ${boat.equipment ? `<div style="margin:14px 0"><strong style="font-size:13px">${esc(t("boatDetail.equipment"))}</strong><div class="tags" style="margin-top:6px">${boat.equipment.split(",").map(x=>x.trim()).filter(Boolean).map(x=>`<span class="tag">${esc(x)}</span>`).join("")}</div></div>` : ""}
      ${viewMode!=="sale" && boat.deposit_amount ? `<div class="note-box" style="margin-bottom:10px">${esc(t("boatDetail.deposit"))}: <strong>${money(Number(boat.deposit_amount)*100)}</strong></div>` : ""}
      ${viewMode!=="sale" && boat.cancellation_policy ? `<p class="muted"><strong>${esc(t("boatDetail.cancellationPolicy"))}:</strong> ${esc(boat.cancellation_policy)}</p>` : ""}
      ${boat.rules_text ? `<p class="muted"><strong>${esc(t("boatDetail.rules"))}:</strong> ${esc(boat.rules_text)}</p>` : ""}
      ${action}
      ${boat.listing_type==="both" ? `<button class="small-btn wide" style="margin-top:9px" onclick="openBoatDetail('${esc(boat.id)}','${viewMode==="sale"?"rental":"sale"}')">${esc(viewMode==="sale"?saleText("Voir les tarifs de location","See rental rates","Ver tarifas de alquiler"):saleText("Voir le prix de vente","See sale price","Ver precio de venta"))}</button>` : ""}
    </div>`;
  boatDetailPhotoIndex = 0;
  openModal("boatDetailModal");
};
window.openSaleInquiry = function(boatId){
  const boat = [...saleBoatCache,...boatCache].find(b=>String(b.id)===String(boatId));
  if(!boat) return;
  closeModal("boatDetailModal");
  if(!currentUser){ openAccountModal("login"); return; }
  saleInquiryTarget = boat;
  document.querySelector("#saleInquiryTitle").textContent = (boat.managed_by_platform ? saleText("Contacter SkipperNow — ","Contact SkipperNow — ","Contactar con SkipperNow — ") : saleText("Contacter le vendeur — ","Contact seller — ","Contactar al vendedor — ")) + normalizeBoatTitle(boat);
  document.querySelector("#saleInquiryMessage").value = saleText("Bonjour, je souhaite avoir plus d'informations sur ce bateau et organiser une visite.","Hello, I would like more information about this boat and to arrange a viewing.","Hola, me gustaría recibir más información sobre este barco y organizar una visita.");
  document.querySelector("#saleInquiryMsg").textContent = "";
  openModal("saleInquiryModal");
};
document.querySelector("#saleInquiryForm")?.addEventListener("submit", async e=>{
  e.preventDefault();
  const msg=document.querySelector("#saleInquiryMsg");
  if(!currentUser || !saleInquiryTarget) return;
  if(String(currentUser.id)===String(saleInquiryTarget.client_id)){ msg.textContent=saleText("Vous êtes le vendeur de cette annonce.","You are the seller of this listing.","Eres el vendedor de este anuncio."); return; }
  const message=document.querySelector("#saleInquiryMessage").value.trim();
  if(message.length<10) return;
  const btn=e.target.querySelector("button[type=submit]"); btn.disabled=true;
  const {error}=await db.from("boat_sale_inquiries").insert({
    boat_id:saleInquiryTarget.id,
    buyer_id:currentUser.id,
    seller_id:saleInquiryTarget.client_id,
    buyer_email:currentUser.email||null,
    message
  });
  btn.disabled=false;
  if(error){ msg.textContent=friendlyError(error); return; }
  msg.style.color="#18794e";
  msg.textContent=saleText("Votre demande a été envoyée au vendeur.","Your inquiry has been sent to the seller.","Tu consulta ha sido enviada al vendedor.");
  setTimeout(()=>closeModal("saleInquiryModal"),1000);
});
let boatDetailPhotoIndex = 0;
window.stepBoatDetailPhoto = function(dir){
  const slides = [...document.querySelectorAll("[data-detail-slide]")];
  const dots = [...document.querySelectorAll("[data-detail-dots] span")];
  if(!slides.length) return;
  slides[boatDetailPhotoIndex].classList.remove("active");
  dots[boatDetailPhotoIndex]?.classList.remove("active");
  boatDetailPhotoIndex = (boatDetailPhotoIndex + dir + slides.length) % slides.length;
  slides[boatDetailPhotoIndex].classList.add("active");
  dots[boatDetailPhotoIndex]?.classList.add("active");
};
window.openProfileDetail = function(id, adminView){
  const p = (adminView ? adminProfilesCache : resultsCache).find(x=>String(x.id)===String(id));
  if(!p) return;
  closeModal("providerModal");
  closeModal("boatFinderModal");
  const content = document.querySelector("#profileDetailContent");
  if(p.role === "client"){
    content.innerHTML = `<button class="close" type="button" onclick="closeModal('profileDetailModal')">×</button>
      ${p.profile_photo_url ? `<img class="dash-avatar" src="${esc(p.profile_photo_url)}" alt="">` : ""}
      <small class="muted">${esc(roleLabel(p))}</small>
      <h2>${esc(p.full_name||"—")}</h2>
      <div class="boat-card-port">📍 ${esc(p.home_port||"—")}</div>
      <p class="muted">${esc(p.bio||t("boatDetail.noDescription"))}</p>`;
    openModal("profileDetailModal");
    return;
  }
  const activity = p.provider_activity || "skipper";
  const canRequest = p.available !== false && !p.suspended;
  const photoStyle = p.profile_photo_url ? `background-image:url('${esc(p.profile_photo_url)}')` : "background:linear-gradient(135deg,#173b51,#3f9c9a)";
  content.innerHTML = `
    <div style="margin:-26px -26px 0;height:200px;${photoStyle};background-size:cover;background-position:center;border-radius:22px 22px 0 0;position:relative">
      ${p.profile_photo_url ? "" : `<div style="position:absolute;inset:0;display:grid;place-items:center;font-size:42px;color:rgba(255,255,255,.85)">⚓</div>`}
      <button class="close" type="button" onclick="closeModal('profileDetailModal')" style="position:absolute;top:14px;right:14px;background:rgba(255,255,255,.92)">×</button>
    </div>
    <div style="padding-top:18px">
      <small style="color:var(--muted);font-weight:800;letter-spacing:.05em;text-transform:uppercase;font-size:11px">${esc(activityLabel(activity))}</small>
      <div class="name-row" style="margin:4px 0 6px"><h2 style="margin:0">${esc(p.full_name||"—")}${p.verified ? `<span class="ig-badge" title="${esc(t("card.verifiedBadge"))}"><svg width="18" height="18" viewBox="0 0 24 24" role="img" aria-label="${esc(t("card.verifiedBadge"))}"><circle cx="12" cy="12" r="12" fill="#3897f0"/><path d="M9.5 12.8l-2-2-1.4 1.4L9.5 15.6l7.4-7.4-1.4-1.4z" fill="#fff"/></svg></span>` : ""}${featuredBadgeHtml(p)}</h2></div>
      <div class="boat-card-port" style="margin-bottom:6px">📍 ${esc(p.home_port||"—")}</div>
      <div class="meta" style="margin-bottom:14px">${esc(profileRatingText(p))}${p.rating_count ? ` (${p.rating_count} ${esc(t(p.rating_count>1 ? "card.reviewsPlural" : "card.reviewsSingle"))})` : ""} · ${p.experience_years||0} ${esc(t("card.experience"))}${p.languages?" · "+esc(p.languages):""}</div>
      <div class="profile-facts"><div><strong>${esc(t("profile.area"))}</strong>${esc(p.home_port||"—")}${p.travel_radius_km ? `<p>${esc(t("profile.radius",{km:p.travel_radius_km}))}</p>` : ""}</div><div><strong>${esc(t("dash.navAvailability"))}</strong>${esc(t(canRequest ? "profile.available" : "profile.unavailable"))}</div></div>
      <p class="muted" style="line-height:1.6">${esc(p.bio||t("boatDetail.noDescription"))}</p>
      ${p.skills ? `<div style="margin:14px 0"><strong style="font-size:13px">${esc(t("account.skillsLabel"))}</strong><div class="tags" style="margin-top:6px">${p.skills.split(",").map(x=>x.trim()).filter(Boolean).map(x=>`<span class="tag">${esc(x)}</span>`).join("")}</div></div>` : ""}
      ${(p.price_half_day_cents || p.price_hour_cents || p.travel_fee_cents) ? `<div class="muted" style="margin-bottom:10px">
        ${p.price_half_day_cents ? `${esc(t("account.priceHalfDayLabel"))}: <strong>${money(p.price_half_day_cents)}</strong><br>` : ""}
        ${p.price_hour_cents ? `${esc(t("account.priceHourLabel"))}: <strong>${money(p.price_hour_cents)}</strong><br>` : ""}
        ${p.travel_fee_cents ? `${esc(t("account.travelFeeLabel"))}: <strong>${money(p.travel_fee_cents)}</strong>` : ""}
      </div>` : ""}
      <div class="note-box" style="margin-top:14px">${p.price_from_cents ? `${esc(t("card.priceFrom"))} <strong>${money(p.price_from_cents)}</strong> — ${esc(t("card.priceNote"))}` : esc(t("card.priceOnRequest"))}</div>
      ${p.verified && profileNeedsDiploma(p) && p.diploma_type ? `<div class="tag" style="display:inline-block;margin-top:10px">🎓 ${esc(t("card.diplomaBadgePrefix"))} ${esc(p.diploma_type)}</div>` : ""}
      ${adminView && p.diploma_url ? `<div class="muted" style="margin-top:10px"><a href="${esc(p.diploma_url)}" target="_blank">${esc(t("account.diplomaCurrent"))}</a></div>` : ""}
      ${adminView ? ""
        : (currentUser && String(p.id)===String(currentUser.id))
          ? `<div class="note-box" style="margin-top:18px">${esc(t("boatDetail.ownListing"))}</div>`
          : `<div class="profile-actions">
              <button ${canRequest ? "" : "disabled"} class="primary wide" style="flex:1;min-width:160px" onclick="closeModal('profileDetailModal');openBookingFor('${p.id}','${esc(String(p.full_name||"").replace(/'/g,"\\'"))}','${esc(String(p.home_port||"").replace(/'/g,"\\'"))}','${activity}','${esc(currentProviderSubcategory||"")}','${esc(p.role||"")}')">${esc(t("profile.quote"))}</button>
              <button class="ghost wide" style="flex:1;min-width:160px" onclick="messageProfile('${p.id}')">${esc(t("card.sendMessage"))}</button>
            </div>`}
    </div>`;
  content.insertAdjacentHTML("beforeend", `<section><h3>${esc(t("profile.reviews"))}</h3><div id="profileReviews" aria-live="polite">${esc(t("dash.loading"))}</div></section>`);
  loadProfileReviews(p.id, document.querySelector("#profileReviews"));
  openModal("profileDetailModal");
};
async function loadProfileReviews(profileId, box, offset=0){
  const {data,error}=await db.from("reviews").select("rating,comment,created_at").eq("skipper_id",profileId).order("created_at",{ascending:false}).range(offset,offset+9);
  if(!box.isConnected) return;
  box.querySelector("button")?.remove();
  if(error){box.insertAdjacentHTML("beforeend",`<p>${esc(t("profile.reviewError"))}</p>`);return;}
  if(!offset) box.innerHTML="";
  if(!data?.length && !offset) box.textContent=t("profile.noReviews");
  for(const review of data||[]){
    box.insertAdjacentHTML("beforeend",`<article class="profile-review"><strong>${"★".repeat(Math.min(5,Math.max(1,Number(review.rating))))} · ${esc(t("profile.reviewVerified"))}</strong><div class="muted">${esc(new Date(review.created_at).toLocaleDateString(currentLang))}</div>${review.comment ? `<p>${esc(review.comment)}</p>` : ""}</article>`);
  }
  if(data?.length===10){const more=document.createElement("button");more.className="ghost";more.textContent=t("profile.moreReviews");more.onclick=()=>{more.disabled=true;loadProfileReviews(profileId,box,offset+10);};box.append(more);}
}
window.closeModal = closeModal;
window.messageProfile = async function(targetId){
  closeModal("profileDetailModal");
  if(!currentUser){ openAccountModal("login"); return; }
  await openDashboard();
  const roleCol = currentProfile?.role === "admin" ? "both" : ["skipper","provider"].includes(currentProfile?.role) ? "skipper_id" : "client_id";
  await renderMessagesPanel(roleCol);
  document.querySelectorAll(".dash-side button").forEach(b=>b.classList.toggle("active", b.dataset.panel==="messages"));
  const list = document.querySelector("#conversationList");
  const thread = document.querySelector("#conversationThread");
  if(list) list.style.display = "none";
  if(thread) thread.style.display = "block";
  await openConversationThread(currentUser.id, targetId);
};

let authMode = "create";
let selectedRole = "client";

function trackSignupStarted(source){
  try{
    if(typeof window.skTrackEvent === "function"){
      window.skTrackEvent("signup_started", {source:source || "account_modal",stage:"form_opened",role:selectedRole});
    }
  }catch(_e){}
}

function setAuthMode(mode){
  authMode = mode;
  document.querySelector("#authModeCreate").classList.toggle("active", mode==="create");
  document.querySelector("#authModeLogin").classList.toggle("active", mode==="login");
  document.querySelector("#roleChoice").style.display = mode==="create" ? "grid" : "none";
  document.querySelector("#nameField").style.display = mode==="create" ? "block" : "none";
  document.querySelector("#forgotPasswordBtn").style.display = mode==="login" ? "block" : "none";
  document.querySelector("#accountTitle").textContent = mode==="create" ? t("account.createTitle") : t("account.loginTitle");
  document.querySelector("#authSubmit").textContent = mode==="create" ? t("account.createSubmit") : t("account.loginSubmit");
  document.querySelector("#authMessage").textContent = "";
  refreshRoleFields();
}
function setRole(role){
  selectedRole = role;
  document.querySelectorAll("#roleChoice .choice-card").forEach(c=>c.classList.toggle("active", c.dataset.role===role));
  refreshRoleFields();
}
function refreshRoleFields(){
  const needsPort = authMode==="create" && ["skipper","provider","owner"].includes(selectedRole);
  document.querySelector("#portField").style.display = needsPort ? "block" : "none";
  document.querySelector("#activityField").style.display = (authMode==="create" && selectedRole==="provider") ? "block" : "none";
  if(authMode==="create" && selectedRole==="skipper") document.querySelector("#accountActivity").value = "skipper";
  const portLabel = document.querySelector("#portField label");
  const portInputField = document.querySelector("#accountPort");
  if(selectedRole==="provider"){
    portLabel.textContent = t("account.zoneLabel");
    portInputField.placeholder = t("account.zonePlaceholder");
  }else{
    portLabel.textContent = t("account.portLabel");
    portInputField.placeholder = t("account.portPlaceholder");
  }
}
document.querySelector("#authModeCreate").addEventListener("click", ()=>{
  const startsSignup = authMode !== "create";
  setAuthMode("create");
  if(startsSignup) trackSignupStarted("account_tab");
});
document.querySelector("#authModeLogin").addEventListener("click", ()=>setAuthMode("login"));
document.querySelectorAll("#roleChoice .choice-card").forEach(card=>card.addEventListener("click", ()=>setRole(card.dataset.role)));

let accountPortSearchTimer;
function bindAccountPortAutocomplete(){
  const input = document.querySelector("#accountPort");
  const box = document.querySelector("#accountPortSuggestions");
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
  input.addEventListener("focus", ()=>{
    const q = input.value.trim();
    render(q ? localPortMatches(q) : POPULAR_PORTS.slice(0,8).map(x=>({name:x[0],place:x[1]})));
  });
  input.addEventListener("input", ()=>{
    clearTimeout(accountPortSearchTimer);
    accountPortSearchTimer = setTimeout(()=>render(localPortMatches(input.value.trim())),180);
  });
  document.addEventListener("click", e=>{
    if(!e.target.closest("#portField")) box.classList.remove("open");
  });
}
bindAccountPortAutocomplete();

function openAccountModal(mode, role){
  const nextMode = mode || "create";
  setAuthMode(nextMode);
  if(role) setRole(role);
  openModal("accountModal");
  if(nextMode === "create") trackSignupStarted("account_modal");
}
document.querySelector("#loginBtn").addEventListener("click", ()=>{
  if(currentUser){ openDashboard(); return; }
  openAccountModal("login");
});
document.querySelector("#signupBtn").addEventListener("click", ()=>{
  if(currentUser){ openDashboard(); return; }
  openAccountModal("create", "client");
});
