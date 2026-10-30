"use strict";
function bindProfileForm(){
  bindProfilePortAutocomplete();
  document.querySelector("#profilePayoutLink")?.addEventListener("click", ()=>document.querySelector('.dash-side [data-panel="payments"]')?.click());
  document.querySelector("#changePasswordBtn")?.addEventListener("click", async ()=>{
    const pass=document.querySelector("#profileNewPassword")?.value||"";
    const confirmPass=document.querySelector("#profileNewPasswordConfirm")?.value||"";
    const msg=document.querySelector("#changePasswordMsg");
    if(pass.length<8){ msg.style.color="#b42318"; msg.textContent=saleText("Le mot de passe doit contenir au moins 8 caractères.","Password must be at least 8 characters.","La contraseña debe tener al menos 8 caracteres."); return; }
    if(pass!==confirmPass){ msg.style.color="#b42318"; msg.textContent=saleText("Les deux mots de passe ne correspondent pas.","Passwords do not match.","Las contraseñas no coinciden."); return; }
    const btn=document.querySelector("#changePasswordBtn"); btn.disabled=true;
    const {error}=await db.auth.updateUser({password:pass});
    btn.disabled=false;
    msg.style.color=error?"#b42318":"#08794e";
    msg.textContent=error?friendlyError(error):saleText("Mot de passe modifié.","Password changed.","Contraseña modificada.");
    if(!error){ document.querySelector("#profileNewPassword").value=""; document.querySelector("#profileNewPasswordConfirm").value=""; }
  });
  document.querySelector("#saveProfileBtn").addEventListener("click", async ()=>{
    const btn = document.querySelector("#saveProfileBtn");
    const msg = document.querySelector("#profileMsg");
    btn.disabled = true;
    const needsPhoto = ["skipper","provider"].includes(currentProfile?.role);
    const photoFileEarly = document.querySelector("#profilePhotoInput")?.files[0];
    if(needsPhoto && !photoFileEarly && !currentProfile?.profile_photo_url){
      msg.style.color = "#b42318";
      msg.textContent = t("account.photoRequiredError");
      btn.disabled = false;
      return;
    }
    const phoneEarly = document.querySelector("#profilePhone")?.value.trim();
    if(needsPhoto && !phoneEarly){
      msg.style.color = "#b42318";
      msg.textContent = t("account.phoneRequiredError");
      btn.disabled = false;
      return;
    }
    const priceInput = document.querySelector("#profilePriceFrom");
    const patch = {
      full_name: document.querySelector("#profileName").value.trim(),
      home_port: document.querySelector("#profilePort").value.trim(),
      phone: document.querySelector("#profilePhone").value.trim(),
      bio: sanitizeContactInfo(document.querySelector("#profileBio").value.trim())
    };
    const expInput = document.querySelector("#profileExperience");
    if(expInput) patch.experience_years = Number(expInput.value) || null;
    const langInput = document.querySelector("#profileLanguages");
    if(langInput) patch.languages = langInput.value.trim();
    const skillsInput = document.querySelector("#profileSkills");
    if(skillsInput) patch.skills = skillsInput.value.trim();
    const radiusInput = document.querySelector("#profileTravelRadius");
    if(radiusInput) patch.travel_radius_km = Number(radiusInput.value) || null;
    const siretInput = document.querySelector("#profileSiret");
    if(siretInput) patch.siret = siretInput.value.trim();
    const insuranceInput = document.querySelector("#profileInsurance");
    if(insuranceInput) patch.insurance_info = insuranceInput.value.trim();
    const diplomaTypeInput = document.querySelector("#profileDiplomaType");
    if(diplomaTypeInput) patch.diploma_type = diplomaTypeInput.value.trim();
    const priceHalfInput = document.querySelector("#profilePriceHalf");
    if(priceHalfInput){
      const half = Number(priceHalfInput.value);
      patch.price_half_day_cents = Number.isFinite(half) && half > 0 ? Math.round(half*100) : null;
    }
    const priceHourInput = document.querySelector("#profilePriceHour");
    if(priceHourInput){
      const hour = Number(priceHourInput.value);
      patch.price_hour_cents = Number.isFinite(hour) && hour > 0 ? Math.round(hour*100) : null;
    }
    const travelFeeInput = document.querySelector("#profileTravelFee");
    if(travelFeeInput){
      const fee = Number(travelFeeInput.value);
      patch.travel_fee_cents = Number.isFinite(fee) && fee > 0 ? Math.round(fee*100) : null;
    }
    const photoFile = document.querySelector("#profilePhotoInput")?.files[0];
    if(photoFile){
      const path = `${currentUser.id}/avatar-${Date.now()}-${photoFile.name.replace(/[^a-zA-Z0-9.\-_]/g,"_")}`;
      const {error: upErr} = await db.storage.from("mission-photos").upload(path, photoFile);
      if(upErr){ msg.style.color = "#b42318"; msg.textContent = friendlyError(upErr); btn.disabled = false; return; }
      patch.profile_photo_url = db.storage.from("mission-photos").getPublicUrl(path).data.publicUrl;
    }
    const diplomaFile = document.querySelector("#profileDiplomaInput")?.files[0];
    if(diplomaFile){
      const path = `${currentUser.id}/diploma-${Date.now()}-${diplomaFile.name.replace(/[^a-zA-Z0-9.\-_]/g,"_")}`;
      const {error: upErr} = await db.storage.from("mission-photos").upload(path, diplomaFile);
      if(upErr){ msg.style.color = "#b42318"; msg.textContent = friendlyError(upErr); btn.disabled = false; return; }
      patch.diploma_url = db.storage.from("mission-photos").getPublicUrl(path).data.publicUrl;
    }
    if(priceInput){
      const euros = Number(priceInput.value);
      patch.price_from_cents = Number.isFinite(euros) && euros > 0 ? Math.round(euros*100) : null;
    }
    const {error} = await db.from("profiles").update(patch).eq("id", currentUser.id);
    if(error){ msg.style.color = "#b42318"; msg.textContent = friendlyError(error); btn.disabled = false; return; }
    await loadProfile();
    refreshDashboardIdentity("profile");
    msg.style.color = "#08794e";
    msg.textContent = t("action.savedSuccess");
    btn.disabled = false;
  });
}

function refreshDynamicTexts(){
  const heading = document.querySelector("#resultsHeading");
  const sub = document.querySelector("#resultsSub");
  const cfg = TAB_CONFIG[activeActivity] || TAB_CONFIG.skipper;
  if(heading) heading.textContent = t(cfg.headingKey);
  if(sub) sub.textContent = t(cfg.subKey);
  updateSeoMeta();
  loadListings();
  renderHomeBoatStrip();
  refreshAccountButton();
}

const FAQ_ENTRIES = [
  {keywords:["prix","tarif","coût","cout","combien"], answerKey:"faq.price"},
  {keywords:["réserv","reserv","booking","comment ça marche","comment ca marche"], answerKey:"faq.booking"},
  {keywords:["annul","cancel"], answerKey:"faq.cancel"},
  {keywords:["rembours","refund"], answerKey:"faq.refund"},
  {keywords:["skipper","devenir","inscri","join","prestataire"], answerKey:"faq.become"},
  {keywords:["paiement","payer","pay","sécuri","securi","stripe"], answerKey:"faq.payment"},
  {keywords:["contact","support","aide","help","humain"], answerKey:"faq.contact"}
];
const FAQ_CHIPS = ["faq.price","faq.booking","faq.become","faq.contact"];

function faqAppendMessage(text, who){
  const box = document.querySelector("#faqMessages");
  const bubble = document.createElement("div");
  bubble.style.cssText = `align-self:${who==="user"?"flex-end":"flex-start"};max-width:85%;padding:9px 12px;border-radius:13px;font-size:14px;line-height:1.4;background:${who==="user"?"var(--navy)":"var(--mist)"};color:${who==="user"?"#fff":"var(--ink)"}`;
  bubble.textContent = text;
  box.appendChild(bubble);
  box.scrollTop = box.scrollHeight;
}
function faqAnswerFor(message){
  const lower = message.toLowerCase();
  const hit = FAQ_ENTRIES.find(e => e.keywords.some(k => lower.includes(k)));
  return t(hit ? hit.answerKey : "faq.fallback");
}
function faqRenderChips(){
  const chipsBox = document.querySelector("#faqChips");
  chipsBox.innerHTML = FAQ_CHIPS.map(k=>`<button type="button" class="tag" style="cursor:pointer;border:1px solid var(--line)" data-faq-chip="${k}">${esc(t(k+"Chip"))}</button>`).join("");
  chipsBox.querySelectorAll("[data-faq-chip]").forEach(btn=>btn.addEventListener("click", ()=>{
    const question = btn.textContent;
    faqAppendMessage(question, "user");
    faqAppendMessage(t(btn.dataset.faqChip), "bot");
  }));
}
function initFaqBot(){
  const toggle = document.querySelector("#faqToggle");
  const panel = document.querySelector("#faqPanel");
  const closeBtn = document.querySelector("#faqClose");
  const sendBtn = document.querySelector("#faqSend");
  const input = document.querySelector("#faqInput");
  let opened = false;
  toggle.addEventListener("click", ()=>{
    opened = !opened;
    panel.style.display = opened ? "flex" : "none";
    if(opened && !document.querySelector("#faqMessages").childElementCount){
      faqAppendMessage(t("faq.greeting"), "bot");
      faqRenderChips();
    }
  });
  closeBtn.addEventListener("click", ()=>{ opened = false; panel.style.display = "none"; });
  function send(){
    const value = input.value.trim();
    if(!value) return;
    faqAppendMessage(value, "user");
    input.value = "";
    setTimeout(()=>faqAppendMessage(faqAnswerFor(value), "bot"), 250);
  }
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", e=>{ if(e.key === "Enter") send(); });
}

let heroCarouselTimer = null;
function startHeroCarousel(){
  if(heroCarouselTimer) clearInterval(heroCarouselTimer);
  const slides = [...document.querySelectorAll(".hero-bg")];
  if(slides.length < 2) return;
  let index = slides.findIndex(s=>s.classList.contains("active"));
  if(index < 0) index = 0;
  heroCarouselTimer = setInterval(()=>{
    slides[index].classList.remove("active");
    index = (index + 1) % slides.length;
    loadDeferredBackground(slides[index]);
    slides[index].classList.add("active");
  }, 2500);
}
async function loadHeroSlides(){
  const container = document.querySelector("#heroBgContainer");
  if(!container) return;
  const {data, error} = await db.from("hero_slides").select("*").eq("active", true).order("order_index",{ascending:true});
  if(error || !data || !data.length) return;
  container.innerHTML = data.map((s,i)=>`<div class="hero-bg${i===0?" active":""}" ${i===0?`style="background-image:url('${esc(s.image_url)}')"`:`data-bg="${esc(s.image_url)}"`} ${s.alt_text?`role="img" aria-label="${esc(s.alt_text)}"`:""}></div>`).join("");
  startHeroCarousel();
}
async function loadDestinationTiles(){
  const row = document.querySelector("#portTileRow");
  if(!row) return;
  const {data, error} = await db.from("destination_tiles").select("*").eq("active", true).order("order_index",{ascending:true});
  const tiles = (data && !error) ? data : [];
  if(!tiles.length) return;
  row.innerHTML = tiles.map(tl=>`<button type="button" class="tile-scroll-card" data-port="${esc(tl.name)}" style="background-image:url('${esc(tl.image_url)}')"><span>${esc(tl.name)}</span></button>`).join("");
  row.querySelectorAll(".tile-scroll-card").forEach(tile=>{
    tile.addEventListener("click", ()=>{ openBoatFinder(tile.dataset.port); highlightPortActivities(tile.dataset.port); });
  });
  autoScrollTileRow("portTileRow");
}
const activityPhotoCredits = {
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/Mediterranean_coast_-_Eze%2C_France_-_panoramio.jpg/960px-Mediterranean_coast_-_Eze%2C_France_-_panoramio.jpg": {
    "id": "11af0976-748e-4f7b-b441-9db7dd5caa98",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/Mediterranean_coast_-_Eze%2C_France_-_panoramio.jpg/960px-Mediterranean_coast_-_Eze%2C_France_-_panoramio.jpg",
    "file": "Mediterranean coast - Eze, France - panoramio.jpg",
    "author": "Sergey Ashmarin",
    "caption": "La côte vue depuis Èze",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/"
  },
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6a/Sainte-Marguerite_%28south_coast%29.jpg/960px-Sainte-Marguerite_%28south_coast%29.jpg": {
    "id": "2b07c1d2-3c49-4f78-9f7a-bf01bdf16a98",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6a/Sainte-Marguerite_%28south_coast%29.jpg/960px-Sainte-Marguerite_%28south_coast%29.jpg",
    "file": "Sainte-Marguerite (south coast).jpg",
    "author": "Tangopaso",
    "caption": "Littoral de l’île Sainte-Marguerite",
    "license": "Domaine public",
    "licenseUrl": "https://commons.wikimedia.org/wiki/File:Sainte-Marguerite_(south_coast).jpg"
  },
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/Baie_de_Juan_Les_Pins.jpg/960px-Baie_de_Juan_Les_Pins.jpg": {
    "id": "6f4f8a9b-842e-4714-a849-eb63714e1c73",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/Baie_de_Juan_Les_Pins.jpg/960px-Baie_de_Juan_Les_Pins.jpg",
    "file": "Baie de Juan Les Pins.jpg",
    "author": "Frederic Parizot",
    "caption": "Coucher de soleil sur la baie de Juan-les-Pins",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/"
  },
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dc/Juan-les-Pins.jpg/960px-Juan-les-Pins.jpg": {
    "id": "078e3a2d-f8e8-4825-8bb6-a077225876f3",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dc/Juan-les-Pins.jpg/960px-Juan-les-Pins.jpg",
    "file": "Juan-les-Pins.jpg",
    "author": "JaayJay",
    "caption": "Plage et baie de Juan-les-Pins",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/"
  },
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b1/Plage_Mala_%C3%A0_Cap_d%27ail.jpg/960px-Plage_Mala_%C3%A0_Cap_d%27ail.jpg": {
    "id": "11af0976-748e-4f7b-b441-9db7dd5caa98",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b1/Plage_Mala_%C3%A0_Cap_d%27ail.jpg/960px-Plage_Mala_%C3%A0_Cap_d%27ail.jpg",
    "file": "Plage Mala à Cap d'ail.jpg",
    "author": "Jon Mountjoy",
    "caption": "Plage Mala, entre Monaco et Èze",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0"
  },
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Baie_des_milliardaires_2.JPG/960px-Baie_des_milliardaires_2.JPG": {
    "id": "078e3a2d-f8e8-4825-8bb6-a077225876f3",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Baie_des_milliardaires_2.JPG/960px-Baie_des_milliardaires_2.JPG",
    "file": "Baie des milliardaires 2.JPG",
    "author": "Abxbay",
    "caption": "Crique de la baie des Milliardaires, cap d’Antibes",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Sud-est_%C3%AEle_Saint-Honorat_%282014%29.JPG/960px-Sud-est_%C3%AEle_Saint-Honorat_%282014%29.JPG": {
    "id": "2b07c1d2-3c49-4f78-9f7a-bf01bdf16a98",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Sud-est_%C3%AEle_Saint-Honorat_%282014%29.JPG/960px-Sud-est_%C3%AEle_Saint-Honorat_%282014%29.JPG",
    "file": "Sud-est île Saint-Honorat (2014).JPG",
    "author": "Florian Pépellin",
    "caption": "Eaux claires de Saint-Honorat, îles de Lérins",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0"
  }
};
function activityPhotoCreditHtml(url){
  const p = activityPhotoCredits[url];
  if(!p) return "";
  return `<small class="activity-photo-credit" style="display:block;font-size:11px;line-height:1.45;color:var(--muted);margin:0 0 10px">${esc(p.caption)} · <a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(p.file)}" target="_blank" rel="noopener noreferrer">${esc(p.author)}</a> · <a href="${esc(p.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(p.license)}</a> · recadrage</small>`;
}
let portActivitiesCache = [];
async function loadPortActivities(){
  const row = document.querySelector("#activityRow");
  if(!row) return;
  const {data, error} = await db.from("port_activities").select("*").eq("active", true).order("order_index",{ascending:true});
  portActivitiesCache = (data && !error) ? data : [];
  renderPortActivities();
}
function renderPortActivities(highlightPort){
  const row = document.querySelector("#activityRow");
  if(!row) return;
  if(!portActivitiesCache.length){ document.querySelector("#activityRow").closest("section").style.display = "none"; return; }
  let list = portActivitiesCache;
  const badge = document.querySelector("#activityFilterBadge");
  const label = document.querySelector("#activityFilterLabel");
  if(highlightPort){
    const matches = portActivitiesCache.filter(a=>a.port_name.toLowerCase() === highlightPort.toLowerCase());
    const others = portActivitiesCache.filter(a=>a.port_name.toLowerCase() !== highlightPort.toLowerCase());
    list = matches.concat(others);
    if(matches.length){ badge.style.display = "inline-flex"; label.textContent = `${t("activities.filterShowing")} ${highlightPort}`; }
    else badge.style.display = "none";
  }else{
    badge.style.display = "none";
  }
  row.innerHTML = list.map(a=>`<article class="activity-card" data-activity-port="${esc(a.port_name)}">
    <div class="activity-card-photo" style="background-image:url('${esc(a.image_url)}')"><span class="activity-card-port">${esc(a.port_name)}</span></div>
    <div class="activity-card-body">
      ${activityPhotoCreditHtml(a.image_url)}
      <h3>${esc(a.title)}</h3>
      ${a.description ? `<p>${esc(a.description)}</p>` : ""}
      <div class="activity-card-cta">${esc(t("activities.reserve"))}</div>
    </div>
  </article>`).join("");
  row.querySelectorAll(".activity-card").forEach(card=>{
    card.addEventListener("click", (event)=>{ if(!event.target.closest("a")) openBoatFinder(card.dataset.activityPort); });
  });
}
function highlightPortActivities(port){
  renderPortActivities(port);
  document.querySelector("#activityRow")?.scrollTo({left:0, behavior:"smooth"});
}
document.querySelector("#activityFilterClear")?.addEventListener("click", ()=>renderPortActivities());

function slugifyPort(name){
  return (name||"").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
}
function nmDistance(lat1, lng1, lat2, lng2){
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2-lat1), dLng = toRad(lng2-lng1);
  const avgLatCos = Math.cos(toRad((lat1+lat2)/2));
  const latNm = dLat * 3440.065;
  const lngNm = dLng * avgLatCos * 3440.065;
  return Math.sqrt(latNm*latNm + lngNm*lngNm);
}
function ddToDms(deg, isLat){
  const dir = isLat ? (deg>=0?"N":"S") : (deg>=0?"E":"W");
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const mFull = (abs-d)*60;
  const m = Math.floor(mFull);
  const s = Math.round((mFull-m)*60);
  return `${d}°${String(m).padStart(2,"0")}'${String(s).padStart(2,"0")}"${dir}`;
}
async function loadLogbook(){
  const section = document.querySelector("#logbookSection");
  if(!section) return;
  const {data, error} = await db.from("ports").select("*").eq("active", true).order("order_index",{ascending:true});
  const ports = (data && !error) ? data : [];
  if(!ports.length){ section.style.display = "none"; return; }
  const strip = document.querySelector("#logbookStrip");
  const totalEl = document.querySelector("#logbookTotal");
  let totalNm = 0;
  let html = "";
  ports.forEach((p, i)=>{
    html += `<div class="logbook-port">
      <div class="logbook-port-index">Port ${String(i+1).padStart(2,"0")}</div>
      <div class="logbook-port-name">${esc(p.name)}</div>
      <div class="logbook-port-coords">${ddToDms(p.lat,true)} ${ddToDms(p.lng,false)}</div>
      ${p.description ? `<p class="logbook-port-desc">${esc(p.description)}</p>` : ""}
      <a class="logbook-port-link" href="/skipper-${slugifyPort(p.name)}/">${esc(t("logbook.seeSkippers"))}</a>
    </div>`;
    if(i < ports.length-1){
      const next = ports[i+1];
      const leg = nmDistance(p.lat, p.lng, next.lat, next.lng);
      totalNm += leg;
      html += `<div class="logbook-leg"><div class="logbook-leg-line"></div><div class="logbook-leg-nm">${Math.round(leg)}&nbsp;${esc(t("logbook.nm"))}</div></div>`;
    }
  });
  strip.innerHTML = html;
  totalEl.textContent = `~${Math.round(totalNm)}\u00A0${t("logbook.nm").toUpperCase()} · ${ports[0].name.toUpperCase()} → ${ports[ports.length-1].name.toUpperCase()}`;
}

(async function init(){
  applyStaticTranslations();
  observeDeferredBackgrounds();
  startHeroCarousel();
  initFaqBot();
  const params = new URLSearchParams(location.search);
  const urlPort = params.get("port");
  const urlActivity = params.get("activity");
  if(urlPort) portInput.value = urlPort;
  if(urlActivity && TAB_CONFIG[urlActivity]){
    activeActivity = urlActivity;
    document.querySelectorAll("#listingTabs button").forEach(b=>b.classList.toggle("active", b.dataset.activity===urlActivity));
  }
  if(urlActivity === "skipper"){
    showProviderResults("skipper");
    openModal("providerModal");
  }
  if(urlActivity === "boat_rental"){ openBoatFinder(urlPort||""); }
  if(urlActivity === "boat_sale"){ openBoatSaleFinder(urlPort||""); }
  if(urlActivity === "excursion"){ openExcursionFinder(urlPort||""); }
  const urlJoin = params.get("join");
  if(urlJoin === "owner" || urlJoin === "skipper" || urlJoin === "provider"){ openAccountModal("create", urlJoin); }
  updateSeoMeta();
  const {data:{session}} = await db.auth.getSession();
  currentUser = session?.user || null;
  if(currentUser) await loadProfile();
  refreshAccountButton();
  await resumePaymentReturn();
  const urlPro = params.get("pro");
  if(urlPro) openDirectRequest(urlPro);
  const loadHomeContent = ()=>Promise.all([
    preloadHomeBoats(), preloadHomeProviders(), loadListings(), loadTrustStats(),
    loadLogbook(), loadHeroSlides(), loadDestinationTiles(), loadPortActivities()
  ]).catch(error=>console.warn("SkipperNow home content:",error));
  const needsImmediateContent = Boolean(urlPort || urlActivity || urlPro);
  if(needsImmediateContent) await loadHomeContent();
  else setTimeout(loadHomeContent, 500);
  if(currentUser && sessionStorage.getItem("skippernow-quick-request")) openQuickRequest();
})();

db.auth.onAuthStateChange(async (event, session)=>{
  if(event === "SIGNED_OUT"){ currentUser = null; currentProfile = null; refreshAccountButton(); return; }
  if(event === "PASSWORD_RECOVERY"){
    currentUser = session?.user || currentUser;
    document.querySelector("#recoveryMessage").textContent="";
    document.querySelector("#recoveryPassword").value="";
    document.querySelector("#recoveryPasswordConfirm").value="";
    openModal("passwordRecoveryModal");
    return;
  }
  if(session?.user){
    currentUser = session.user;
    await loadProfile();
    refreshAccountButton();
    if(event === "SIGNED_IN" && new URLSearchParams(location.search).has("payment_mission")) setTimeout(()=>resumePaymentReturn(),0);
    const urlPro = new URLSearchParams(location.search).get("pro");
    if(urlPro) openDirectRequest(urlPro);
  }
});


/* Documentation NUC — uploads privately stored; server validation is authoritative. */
const nucDocKinds={registration:"Enregistrement / immatriculation",navigation_permit:"Permis de navigation NUC",armament_permit:"Permis d'armement (si applicable)",commercial_insurance:"Assurance commerciale",captain_certificate:"Titre professionnel du capitaine",safety_certificate:"Documents de sécurité",other:"Autre justificatif"};
function nucStatus(st){return ({pending:"À examiner",approved:"Validé",rejected:"Refusé",expired:"Expiré"})[st]||st;}
async function renderNucOwnerPanel(main){
 if(!currentUser)return;
 const [{data:ex,error:err},{data:docs,error:derr}]=await Promise.all([
  db.from("excursions").select("id,title,port,active,compliance_status,compliance_rejection_reason").eq("provider_id",currentUser.id).order("created_at",{ascending:false}),
  db.from("excursion_compliance_documents").select("*").eq("owner_id",currentUser.id).order("created_at",{ascending:false})
 ]);
 if(err||derr){main.textContent=(err||derr).message;return;}
 const rows=ex||[], files=docs||[];
 main.innerHTML='<h3>⚓ Documents et contrôle des excursions</h3><p class="muted">Les sorties commerciales ne peuvent être proposées avant validation. Les documents sont privés. Pour les activités hors régime NUC, contactez SkipperNow afin de vérifier le régime local applicable.</p>'+
 (rows.length?rows.map(e=>'<div class="request-card"><strong>'+esc(e.title)+'</strong> · '+esc(e.port||'')+' · '+esc(nucStatus(e.compliance_status))+(e.compliance_rejection_reason?'<p>'+esc(e.compliance_rejection_reason)+'</p>':'')+'<div style="font-size:13px;margin:8px 0">Publication : '+(e.active?'Active':'Non publiée')+'</div>'+files.filter(d=>d.excursion_id===e.id).map(d=>'<div style="padding:5px 0">'+esc(nucDocKinds[d.document_type])+' — '+esc(nucStatus(d.review_status))+(d.expires_on?' · expire le '+esc(d.expires_on):'')+'</div>').join('')+'<form data-nuc-upload="'+esc(e.id)+'" style="margin-top:12px"><label>Type de document</label><select name="kind">'+Object.entries(nucDocKinds).map(([k,v])=>'<option value="'+k+'">'+esc(v)+'</option>').join('')+'</select><label>Date de fin de validité (si indiquée)</label><input name="expiry" type="date"><label>Justificatif PDF ou image (10 Mo max.)</label><input name="document" type="file" accept=".pdf,image/jpeg,image/png,image/webp" required><button type="submit" class="small-btn fill" style="margin-top:8px">Envoyer pour contrôle</button><p class="muted" data-upload-msg></p></form></div>').join(''):'<p class="empty-note">Créez d’abord une excursion dans « Mes excursions » pour transmettre les pièces justificatives.</p>');
 main.querySelectorAll('[data-nuc-upload]').forEach(form=>form.addEventListener('submit',async ev=>{
  ev.preventDefault();const msg=form.querySelector('[data-upload-msg]');const btn=form.querySelector('button[type=submit]');const f=form.elements.document.files[0];
  if(!f||f.size>10485760||!['application/pdf','image/jpeg','image/png','image/webp'].includes(f.type)){msg.textContent='Fichier PDF ou image, 10 Mo maximum.';return;}
  btn.disabled=true;msg.textContent='Envoi en cours…';
  const excId=form.dataset.nucUpload;
  const safe=f.name.replace(/[^a-z0-9._-]/gi,'_');
  const path=currentUser.id+'/'+excId+'/'+crypto.randomUUID()+'-'+safe;
  const up=await db.storage.from('excursion-compliance').upload(path,f,{contentType:f.type});
  if(up.error){msg.textContent=up.error.message;btn.disabled=false;return;}
  const insert=await db.from('excursion_compliance_documents').insert({excursion_id:excId,owner_id:currentUser.id,document_type:form.elements.kind.value,storage_path:path,expires_on:form.elements.expiry.value||null});
  if(insert.error){await db.storage.from('excursion-compliance').remove([path]);msg.textContent=insert.error.message;btn.disabled=false;return;}
  await renderNucOwnerPanel(main);
 }));
}
async function renderNucAdminPanel(main){
 const [{data:ex,error:err},{data:docs,error:derr}]=await Promise.all([
 db.from('excursions').select('id,title,port,provider_id,active,compliance_status,compliance_rejection_reason').order('created_at',{ascending:false}),
 db.from('excursion_compliance_documents').select('*').order('created_at',{ascending:false})
 ]);
 if(err||derr){main.textContent=(err||derr).message;return;}
 const rows=ex||[], files=docs||[];
 main.innerHTML='<h3>⚓ Vérification des excursions</h3><p class="muted">Contrôler la validité des documents, les qualifications et le régime juridique applicable avant validation. Ce contrôle interne ne remplace pas une autorisation maritime.</p>'+
 (rows.length?rows.map(e=>'<div class="request-card"><h4>'+esc(e.title)+' — '+esc(e.port||'')+'</h4><p>'+esc(nucStatus(e.compliance_status))+' · '+(e.active?'Publiée':'Non publiée')+'</p>'+files.filter(d=>d.excursion_id===e.id).map(d=>'<div style="border-top:1px solid #ddd;padding:8px 0"><strong>'+esc(nucDocKinds[d.document_type])+'</strong> · '+esc(nucStatus(d.review_status))+(d.expires_on?' · '+esc(d.expires_on):'')+' <button class="small-btn" type="button" data-nuc-view="'+esc(d.id)+'">Consulter</button> <button class="small-btn" type="button" data-nuc-doc="'+esc(d.id)+'" data-nuc-status="approved">Accepter</button> <button class="small-btn" type="button" data-nuc-doc="'+esc(d.id)+'" data-nuc-status="rejected">Refuser</button></div>').join('')+'<p><button type="button" class="small-btn fill" data-nuc-exc="'+esc(e.id)+'" data-nuc-decision="approved">Valider l’excursion</button> <button type="button" class="small-btn" data-nuc-exc="'+esc(e.id)+'" data-nuc-decision="rejected">Refuser / suspendre</button></p></div>').join(''):'<p class="empty-note">Aucune excursion à vérifier.</p>');
 main.querySelectorAll('[data-nuc-view]').forEach(btn=>btn.addEventListener('click',async()=>{const d=files.find(x=>x.id===btn.dataset.nucView);if(!d)return;const {data,error}=await db.storage.from('excursion-compliance').createSignedUrl(d.storage_path,60);if(error)return alert(error.message);window.open(data.signedUrl,'_blank','noopener,noreferrer');}));
 main.querySelectorAll('[data-nuc-doc]').forEach(btn=>btn.addEventListener('click',async()=>{const decision=btn.dataset.nucStatus;const reason=decision==='rejected'?prompt('Motif du refus (obligatoire)'):null;if(decision==='rejected'&&!reason?.trim())return;const {error}=await db.from('excursion_compliance_documents').update({review_status:decision,checked_by:currentUser.id,checked_at:new Date().toISOString(),rejection_reason:reason||null}).eq('id',btn.dataset.nucDoc);if(error)alert(error.message);else await renderNucAdminPanel(main);}));
 main.querySelectorAll('[data-nuc-exc]').forEach(btn=>btn.addEventListener('click',async()=>{const decision=btn.dataset.nucDecision;const reason=decision==='rejected'?prompt('Motif du refus / suspension (obligatoire)'):null;if(decision==='rejected'&&!reason?.trim())return;const changes={compliance_status:decision,compliance_reviewed_by:currentUser.id,compliance_reviewed_at:new Date().toISOString(),compliance_rejection_reason:reason||null,active:false};const {error}=await db.from('excursions').update(changes).eq('id',btn.dataset.nucExc);if(error)alert(error.message);else await renderNucAdminPanel(main);}));
}
