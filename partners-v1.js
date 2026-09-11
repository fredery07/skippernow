(function(){
  "use strict";
  if(window.__skippernowPartnersV1Loaded) return;
  window.__skippernowPartnersV1Loaded = true;

  const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const home = location.pathname === "/" || location.pathname === "/index.html";
  let editId = null;
  let cachedRows = [];

  function ensureStyle(){
    if(document.getElementById("snPartnersStyle")) return;
    const s=document.createElement("style");
    s.id="snPartnersStyle";
    s.textContent=`
      .sn-partners{max-width:1180px;margin:34px auto 8px;padding:0 24px}
      .sn-partners-card{position:relative;overflow:hidden;border:1px solid rgba(188,153,90,.28);border-radius:28px;padding:24px;background:linear-gradient(135deg,#fffdf8 0%,#f4fbfa 48%,#fff8eb 100%);box-shadow:0 18px 55px rgba(3,21,36,.10)}
      .sn-partners-card:before{content:"";position:absolute;width:260px;height:260px;border-radius:50%;right:-100px;top:-145px;background:radial-gradient(circle,rgba(240,190,91,.22),rgba(240,190,91,0) 68%);pointer-events:none}
      .sn-partners-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:16px}
      .sn-partners-kicker{display:block;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#9b6b20;margin-bottom:6px}
      .sn-partners-head h2{font-family:var(--display,Georgia,serif);font-size:27px;line-height:1.15;margin:0;color:#031a2e}.sn-partners-head p{margin:5px 0 0;color:#60727a;font-size:13.5px}
      .sn-partners-track{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding:2px 2px 8px;scroll-behavior:smooth}.sn-partners-track::-webkit-scrollbar{display:none}
      .sn-partner{position:relative;flex:0 0 min(340px,82vw);height:190px;border-radius:20px;overflow:hidden;scroll-snap-align:start;background:#0a2b43;box-shadow:0 10px 26px rgba(3,21,36,.14);text-decoration:none!important;color:#fff!important}
      .sn-partner img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s ease}.sn-partner:hover img{transform:scale(1.035)}
      .sn-partner:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.04) 20%,rgba(2,19,32,.82) 100%)}
      .sn-partner-badge{position:absolute;z-index:2;left:14px;top:14px;padding:7px 10px;border-radius:999px;background:rgba(255,252,245,.94);color:#7b5318;font-size:10.5px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;backdrop-filter:blur(6px)}
      .sn-partner-copy{position:absolute;z-index:2;left:16px;right:16px;bottom:15px}.sn-partner-copy strong{display:block;font-size:17px;margin-bottom:4px}.sn-partner-copy span{display:block;font-size:12.5px;color:#e4eeee;line-height:1.35}.sn-partner-copy b{display:inline-block;margin-top:8px;color:#f2cb78;font-size:12px}
      .sn-partner-nav{display:flex;gap:8px;flex:0 0 auto}.sn-partner-nav button{width:38px;height:38px;border-radius:50%;border:1px solid #d8c39a;background:#fffaf0;color:#08253b;font-weight:900;cursor:pointer}.sn-partner-nav button:hover{background:#f8e9c9}
      .sn-partners-empty{padding:24px;border:1px dashed #d7c59e;border-radius:18px;text-align:center;color:#6d7477;background:rgba(255,255,255,.65)}
      .sn-partner-admin-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.sn-partner-admin-grid label{font-size:12px;font-weight:800;color:#53636d}.sn-partner-admin-grid input,.sn-partner-admin-grid textarea{width:100%;margin-top:5px;padding:10px 11px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink)}
      .sn-partner-admin-list{display:grid;gap:10px;margin-top:18px}.sn-partner-admin-item{display:grid;grid-template-columns:110px 1fr auto;gap:12px;align-items:center;padding:11px;border:1px solid var(--line);border-radius:14px;background:#fff}.sn-partner-admin-item img{width:110px;height:76px;border-radius:10px;object-fit:cover;background:#eef4f4}.sn-partner-admin-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
      .sn-partner-status{display:inline-flex;gap:6px;align-items:center;font-size:11px;font-weight:900;margin-top:5px}.sn-partner-status.off{color:#a22e2e}.sn-partner-status.on{color:#057554}
      @media(max-width:700px){.sn-partners{padding:0 14px;margin-top:24px}.sn-partners-card{padding:18px}.sn-partners-head{align-items:flex-start}.sn-partners-head h2{font-size:23px}.sn-partner{height:175px}.sn-partner-admin-grid{grid-template-columns:1fr}.sn-partner-admin-item{grid-template-columns:76px 1fr}.sn-partner-admin-item img{width:76px;height:62px}.sn-partner-admin-actions{grid-column:1/-1;justify-content:flex-start}}
    `;
    document.head.appendChild(s);
  }

  async function fetchActive(){
    if(typeof db === "undefined") return [];
    const {data,error}=await db.from("home_partners").select("id,name,subtitle,image_url,link_url,badge,sponsored,sort_order").eq("is_active",true).order("sort_order",{ascending:true}).order("created_at",{ascending:true});
    if(error){ console.warn("SkipperNow partners:",error.message); return []; }
    return data||[];
  }

  function publicCard(p){
    const label=p.sponsored?"Sponsorisé":(p.badge||"Partenaire");
    const inner=`<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy"><span class="sn-partner-badge">${esc(label)}</span><span class="sn-partner-copy"><strong>${esc(p.name)}</strong>${p.subtitle?`<span>${esc(p.subtitle)}</span>`:""}${p.link_url?"<b>Découvrir →</b>":""}</span>`;
    if(!p.link_url) return `<div class="sn-partner">${inner}</div>`;
    return `<a class="sn-partner" href="${esc(p.link_url)}" target="_blank" rel="${p.sponsored?"sponsored ":""}noopener noreferrer">${inner}</a>`;
  }

  async function renderPublic(){
    if(!home || document.querySelector("[data-sn-partners]")) return;
    ensureStyle();
    const rows=await fetchActive();
    if(!rows.length) return;
    const section=document.createElement("section");
    section.className="sn-partners";section.dataset.snPartners="1";
    section.innerHTML=`<div class="sn-partners-card"><div class="sn-partners-head"><div><span class="sn-partners-kicker">Partenaires SkipperNow</span><h2>Des adresses et marques qui partagent notre univers</h2><p>Ports, services nautiques et partenaires sélectionnés.</p></div><div class="sn-partner-nav"><button type="button" data-sn-prev aria-label="Précédent">←</button><button type="button" data-sn-next aria-label="Suivant">→</button></div></div><div class="sn-partners-track">${rows.map(publicCard).join("")}</div></div>`;
    const anchor=document.querySelector("[data-sn-home-conversion]")||document.querySelector(".search-wrap")||document.querySelector(".rental-hub")||document.querySelector("main");
    if(anchor?.parentNode) anchor.parentNode.insertBefore(section,anchor.nextSibling); else document.body.appendChild(section);
    const track=section.querySelector(".sn-partners-track");
    const step=()=>Math.min(360,Math.max(260,track.clientWidth*.72));
    section.querySelector("[data-sn-prev]").onclick=()=>track.scrollBy({left:-step(),behavior:"smooth"});
    section.querySelector("[data-sn-next]").onclick=()=>track.scrollBy({left:step(),behavior:"smooth"});
    if(rows.length>1 && !matchMedia("(prefers-reduced-motion: reduce)").matches){
      let paused=false;
      section.addEventListener("mouseenter",()=>paused=true);section.addEventListener("mouseleave",()=>paused=false);
      setInterval(()=>{if(paused||document.hidden)return;const nearEnd=track.scrollLeft+track.clientWidth>=track.scrollWidth-25;track.scrollTo({left:nearEnd?0:track.scrollLeft+step(),behavior:"smooth"});},4500);
    }
  }

  function isAdmin(){ try{return typeof currentProfile!=="undefined" && currentProfile?.role==="admin";}catch(_e){return false;} }

  async function fetchAll(){
    const {data,error}=await db.from("home_partners").select("*").order("sort_order",{ascending:true}).order("created_at",{ascending:true});
    if(error) throw error; cachedRows=data||[]; return cachedRows;
  }

  async function uploadImage(file){
    if(!file) return null;
    if(!file.type.startsWith("image/")) throw new Error("Choisis une image.");
    if(file.size>5*1024*1024) throw new Error("Image trop lourde : maximum 5 Mo.");
    const safe=(file.name||"partner.jpg").replace(/[^a-zA-Z0-9._-]/g,"-");
    const path=`partners/${Date.now()}-${safe}`;
    const {error}=await db.storage.from("site-media").upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type});
    if(error) throw error;
    const {data}=db.storage.from("site-media").getPublicUrl(path);
    return data.publicUrl;
  }

  function rowHtml(p){
    return `<div class="sn-partner-admin-item"><img src="${esc(p.image_url)}" alt=""><div><strong>${esc(p.name)}</strong><div class="muted">${esc(p.subtitle||"")}</div><span class="sn-partner-status ${p.is_active?"on":"off"}">${p.is_active?"● Visible sur l’accueil":"● Masqué"}${p.sponsored?" · Sponsorisé":""} · ordre ${Number(p.sort_order||0)}</span></div><div class="sn-partner-admin-actions"><button class="small-btn" type="button" data-sn-edit-partner="${p.id}">Modifier</button><button class="small-btn" type="button" data-sn-toggle-partner="${p.id}">${p.is_active?"Masquer":"Afficher"}</button><button class="small-btn danger" type="button" data-sn-delete-partner="${p.id}">Supprimer</button></div></div>`;
  }

  async function renderAdmin(){
    if(!isAdmin()) return;
    ensureStyle();
    const main=document.querySelector("#dashMain");if(!main)return;
    main.innerHTML='<div class="empty-note">Chargement des partenaires…</div>';
    let rows=[];try{rows=await fetchAll();}catch(e){main.innerHTML=`<div class="empty-note">${esc(e.message||String(e))}</div>`;return;}
    const editing=editId?rows.find(x=>String(x.id)===String(editId)):null;
    main.innerHTML=`<div class="panel-head"><div><h3>Partenaires & publicités</h3><p class="muted">Gère le carrousel affiché sur la page d’accueil. Les cartes marquées “Sponsorisé” sont identifiées comme publicité.</p></div><a class="small-btn" href="/" target="_blank" rel="noopener">Voir l’accueil ↗</a></div>
      <form id="snPartnerForm" class="profile-form" style="margin-top:14px"><div class="sn-partner-admin-grid">
        <label>Nom / marque<input id="snPartnerName" required maxlength="100" value="${esc(editing?.name||"")}"></label>
        <label>Sous-titre<input id="snPartnerSubtitle" maxlength="180" value="${esc(editing?.subtitle||"")}" placeholder="Ex. Port partenaire à Cannes"></label>
        <label>Lien du partenaire<input id="snPartnerLink" type="url" value="${esc(editing?.link_url||"")}" placeholder="https://..."></label>
        <label>Badge<input id="snPartnerBadge" maxlength="40" value="${esc(editing?.badge||"Partenaire")}" placeholder="Partenaire"></label>
        <label>Ordre d’affichage<input id="snPartnerOrder" type="number" min="0" max="9999" value="${Number(editing?.sort_order??100)}"></label>
        <label>Photo${editing?" (laisser vide pour garder l’actuelle)":""}<input id="snPartnerImage" type="file" accept="image/*" ${editing?"":"required"}></label>
      </div><div style="display:flex;gap:16px;flex-wrap:wrap;margin:14px 0"><label><input id="snPartnerActive" type="checkbox" ${editing?.is_active!==false?"checked":""}> Visible sur l’accueil</label><label><input id="snPartnerSponsored" type="checkbox" ${editing?.sponsored?"checked":""}> Contenu sponsorisé / publicité</label></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="primary" type="submit">${editing?"Enregistrer les modifications":"Ajouter le partenaire"}</button>${editing?'<button class="small-btn" type="button" id="snPartnerCancel">Annuler</button>':""}</div><p id="snPartnerMsg" class="muted" style="margin-top:10px"></p></form>
      <div class="sn-partner-admin-list">${rows.length?rows.map(rowHtml).join(""):'<div class="sn-partners-empty"><strong>Aucun partenaire pour le moment.</strong><br>Ajoute le premier avec le formulaire ci-dessus.</div>'}</div>`;

    document.querySelector("#snPartnerCancel")?.addEventListener("click",()=>{editId=null;renderAdmin();});
    document.querySelectorAll("[data-sn-edit-partner]").forEach(b=>b.onclick=()=>{editId=b.dataset.snEditPartner;renderAdmin();});
    document.querySelectorAll("[data-sn-toggle-partner]").forEach(b=>b.onclick=async()=>{const p=rows.find(x=>String(x.id)===String(b.dataset.snTogglePartner));if(!p)return;const{error}=await db.from("home_partners").update({is_active:!p.is_active}).eq("id",p.id);if(error)alert(error.message);else renderAdmin();});
    document.querySelectorAll("[data-sn-delete-partner]").forEach(b=>b.onclick=async()=>{if(!confirm("Supprimer définitivement ce partenaire ?"))return;const{error}=await db.from("home_partners").delete().eq("id",b.dataset.snDeletePartner);if(error)alert(error.message);else{if(String(editId)===String(b.dataset.snDeletePartner))editId=null;renderAdmin();}});
    document.querySelector("#snPartnerForm").onsubmit=async e=>{
      e.preventDefault();const msg=document.querySelector("#snPartnerMsg");const submit=e.target.querySelector('button[type="submit"]');submit.disabled=true;msg.textContent="Enregistrement…";
      try{
        const current=editing||null;const file=document.querySelector("#snPartnerImage").files?.[0];const uploaded=await uploadImage(file);const imageUrl=uploaded||current?.image_url;if(!imageUrl)throw new Error("Ajoute une photo.");
        const payload={name:document.querySelector("#snPartnerName").value.trim(),subtitle:document.querySelector("#snPartnerSubtitle").value.trim()||null,link_url:document.querySelector("#snPartnerLink").value.trim()||null,badge:document.querySelector("#snPartnerBadge").value.trim()||"Partenaire",sort_order:Number(document.querySelector("#snPartnerOrder").value||100),is_active:document.querySelector("#snPartnerActive").checked,sponsored:document.querySelector("#snPartnerSponsored").checked,image_url:imageUrl};
        if(!payload.name)throw new Error("Le nom est obligatoire.");
        const q=editing?db.from("home_partners").update(payload).eq("id",editing.id):db.from("home_partners").insert(payload);const{error}=await q;if(error)throw error;editId=null;await renderAdmin();
      }catch(err){msg.textContent=err.message||String(err);msg.style.color="#a22e2e";submit.disabled=false;}
    };
  }

  function installAdminEntry(){
    if(!isAdmin()) return;
    const side=document.querySelector("#dashboardBody .dash-side");if(!side||side.querySelector("[data-sn-partners-admin]"))return;
    const btn=document.createElement("button");btn.type="button";btn.dataset.snPartnersAdmin="1";btn.dataset.panel="partners";btn.innerHTML="🤝 <span>Partenaires & pubs</span>";
    btn.addEventListener("click",async()=>{side.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===btn));await renderAdmin();});
    side.appendChild(btn);
  }

  const observer=new MutationObserver(()=>installAdminEntry());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  function start(){ensureStyle();renderPublic();installAdminEntry();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();