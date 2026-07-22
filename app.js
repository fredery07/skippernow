const cfg = window.SKIPPERNOW_CONFIG || {};
const configured = cfg.supabaseUrl && !cfg.supabaseUrl.includes("COLLE_") && cfg.supabaseAnonKey && !cfg.supabaseAnonKey.includes("COLLE_");
const db = configured ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

const skippers = [
  {id:1,name:"Thomas R.",port:"Cannes",experience:"8 ans",price:300,rating:"4,9",emoji:"👨🏻‍✈️",tags:["Français","English","Voile & moteur"],bio:"Skipper professionnel spécialisé dans les sorties côtières et les convoyages."},
  {id:2,name:"Alexandre M.",port:"Antibes",experience:"12 ans",price:350,rating:"5,0",emoji:"👨🏼‍✈️",tags:["Français","English","Yacht"],bio:"Capitaine expérimenté sur yachts à moteur, disponible pour sorties privées et événements."},
  {id:3,name:"Sofia D.",port:"Golfe-Juan",experience:"6 ans",price:280,rating:"4,8",emoji:"👩🏽‍✈️",tags:["Français","Español","Moteur"],bio:"Skipper bilingue, sorties familiales, baignade et découverte des îles de Lérins."}
];

let mode = "login";
let currentUser = null;
let selectedSkipper = null;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

$("#date").min = new Date().toISOString().slice(0,10);
$("#date").value = $("#date").min;

function renderSkippers(list=skippers){
  $("#count").textContent = `${list.length} profil${list.length>1?"s":""}`;
  $("#skipperGrid").innerHTML = list.map(s=>`
    <article class="card">
      <div class="photo">${s.emoji}</div>
      <div class="card-body">
        <div class="card-head"><h3>${s.name}</h3><span class="rating">★ ${s.rating}</span></div>
        <p class="meta">${s.port} · ${s.experience} d’expérience</p>
        <div class="tags">${s.tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
        <div class="price-row"><span class="price">${s.price} €</span><button class="ghost profile-btn" data-id="${s.id}">Voir le profil</button></div>
      </div>
    </article>`).join("");
  $$(".profile-btn").forEach(b=>b.onclick=()=>openProfile(Number(b.dataset.id)));
}
renderSkippers();

$("#searchBtn").onclick=()=>{
  const p=$("#port").value;
  renderSkippers(p?skippers.filter(s=>s.port===p):skippers);
  $("#skipperGrid").scrollIntoView({behavior:"smooth"});
};

$$("[data-open='auth']").forEach(b=>b.onclick=()=>$("#authDialog").showModal());
$$("[data-open='skipper']").forEach(b=>b.onclick=()=>{setMode("signup");$("#role").value="skipper";$("#authDialog").showModal();});
$$("[data-close]").forEach(b=>b.onclick=()=>b.closest("dialog").close());

function setMode(next){
  mode=next;
  $("#loginTab").classList.toggle("active",mode==="login");
  $("#signupTab").classList.toggle("active",mode==="signup");
  $$(".signup-only").forEach(el=>el.classList.toggle("hidden",mode==="login"));
  $("#forgotBtn").classList.toggle("hidden",mode==="signup");
  $("#authMessage").textContent="";
}
$("#loginTab").onclick=()=>setMode("login");
$("#signupTab").onclick=()=>setMode("signup");

$("#authForm").onsubmit=async e=>{
  e.preventDefault();
  const email=$("#email").value.trim(), password=$("#password").value, name=$("#name").value.trim(), role=$("#role").value;
  if(!configured){ $("#authMessage").textContent="Ajoute d’abord les clés Supabase dans config.js."; return; }
  try{
    if(mode==="signup"){
      const {data,error}=await db.auth.signUp({email,password,options:{data:{name,role}}});
      if(error) throw error;
      $("#authMessage").style.color="#08794e";
      $("#authMessage").textContent="Compte créé. Tu peux maintenant te connecter.";
      setMode("login");
    }else{
      const {data,error}=await db.auth.signInWithPassword({email,password});
      if(error) throw error;
      currentUser=data.user;
      $("#authDialog").close();
      openDashboard();
    }
  }catch(err){$("#authMessage").style.color="#b42318";$("#authMessage").textContent=err.message;}
};

$("#forgotBtn").onclick=async()=>{
  const email=$("#email").value.trim();
  if(!email){$("#authMessage").textContent="Entre ton adresse email.";return}
  if(!configured){$("#authMessage").textContent="Ajoute les clés Supabase dans config.js.";return}
  const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin});
  $("#authMessage").textContent=error?error.message:"Email de réinitialisation envoyé.";
};

async function openProfile(id){
  selectedSkipper=skippers.find(s=>s.id===id);
  $("#profileContent").innerHTML=`
    <div class="photo">${selectedSkipper.emoji}</div>
    <h2>${selectedSkipper.name}</h2>
    <p class="meta">${selectedSkipper.port} · ${selectedSkipper.experience} d’expérience · ★ ${selectedSkipper.rating}</p>
    <p>${selectedSkipper.bio}</p>
    <div class="tags">${selectedSkipper.tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
    <div class="price-row"><span class="price">${selectedSkipper.price} € / jour</span><button class="primary" id="bookNow">Réserver</button></div>`;
  $("#profileDialog").showModal();
  $("#bookNow").onclick=()=>{ $("#profileDialog").close(); $("#bookingSkipper").value=selectedSkipper.name; $("#bookingDialog").showModal(); };
}

$("#bookingForm").onsubmit=async e=>{
  e.preventDefault();
  if(!currentUser){
    $("#bookingMessage").textContent="Connecte-toi avant d’envoyer une demande.";
    return;
  }
  const booking={
    user_id:currentUser.id,
    skipper_name:$("#bookingSkipper").value,
    port:$("#port").value||selectedSkipper?.port||"Cannes",
    mission_date:$("#date").value,
    duration:$("#duration").value,
    boat:$("#boat").value,
    phone:$("#phone").value,
    message:$("#message").value,
    status:"pending"
  };
  if(configured){
    const {error}=await db.from("bookings").insert(booking);
    if(error){$("#bookingMessage").textContent=error.message;return}
  }else{
    const local=JSON.parse(localStorage.getItem("skippernow_bookings")||"[]");
    local.unshift({...booking,id:Date.now()});
    localStorage.setItem("skippernow_bookings",JSON.stringify(local));
  }
  $("#bookingMessage").style.color="#08794e";
  $("#bookingMessage").textContent="Demande envoyée avec succès.";
  e.target.reset();
};

async function openDashboard(){
  if(configured && !currentUser){
    const {data}=await db.auth.getUser();
    currentUser=data.user;
  }
  if(!currentUser){$("#authDialog").showModal();return}
  $("#home").classList.add("hidden");
  $(".topbar").classList.add("hidden");
  $("#dashboard").classList.remove("hidden");
  const meta=currentUser.user_metadata||{};
  $("#welcome").textContent=`Bienvenue ${meta.name||currentUser.email}`;
  $("#roleLabel").textContent=`ESPACE ${(meta.role||"client").toUpperCase()}`;
  renderDashboard("overview");
}

async function getBookings(){
  if(configured){
    const {data}=await db.from("bookings").select("*").order("created_at",{ascending:false});
    return data||[];
  }
  return JSON.parse(localStorage.getItem("skippernow_bookings")||"[]");
}

async function renderDashboard(tab){
  $$("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  const bookings=await getBookings();
  if(tab==="overview"){
    $("#dashBody").innerHTML=`<div class="stat-grid">
      <div class="stat"><span>Demandes</span><strong>${bookings.length}</strong></div>
      <div class="stat"><span>En attente</span><strong>${bookings.filter(b=>b.status==="pending").length}</strong></div>
      <div class="stat"><span>Confirmées</span><strong>${bookings.filter(b=>b.status==="confirmed").length}</strong></div>
    </div><div class="panel"><h3>Dernières réservations</h3>${bookings.slice(0,4).map(renderBooking).join("")||"<p>Aucune réservation.</p>"}</div>`;
  }else if(tab==="bookings"){
    $("#dashBody").innerHTML=`<div class="panel"><h3>Mes réservations</h3>${bookings.map(renderBooking).join("")||"<p>Aucune réservation.</p>"}</div>`;
  }else{
    const m=currentUser.user_metadata||{};
    $("#dashBody").innerHTML=`<div class="panel"><h3>Mon profil</h3><p><strong>Nom :</strong> ${m.name||"Non renseigné"}</p><p><strong>Email :</strong> ${currentUser.email}</p><p><strong>Type de compte :</strong> ${m.role||"client"}</p></div>`;
  }
}
function renderBooking(b){return `<div class="booking"><strong>${b.skipper_name||"Skipper à confirmer"}</strong><p class="meta">${b.port||""} · ${b.mission_date||""} · ${b.duration||""}<br>Statut : ${b.status||"pending"}</p></div>`}
$$("[data-tab]").forEach(b=>b.onclick=()=>renderDashboard(b.dataset.tab));
$("#logoutBtn").onclick=async()=>{if(configured)await db.auth.signOut();currentUser=null;$("#dashboard").classList.add("hidden");$("#home").classList.remove("hidden");$(".topbar").classList.remove("hidden")};

(async()=>{if(configured){const {data}=await db.auth.getSession();currentUser=data.session?.user||null;}})();
