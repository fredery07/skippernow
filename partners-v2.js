(function(){
  "use strict";
  if(window.__skippernowPartnersV2) return;
  window.__skippernowPartnersV2 = true;

  const HOME = location.pathname === "/" || location.pathname === "/index.html";
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let editingId = null;

  function waitForDb(timeout=15000){
    return new Promise(resolve => {
      const started=Date.now();
      const tick=()=>{
        if(typeof window.db !== "undefined" && window.db?.from) return resolve(window.db);
        try{ if(typeof db !== "undefined" && db?.from) return resolve(db); }catch(_e){}
        if(Date.now()-started>timeout) return resolve(null);
        setTimeout(tick,150);
      };
      tick();
    });
  }

  function getDb(){
    try{ if(typeof db !== "undefined" && db?.from) return db; }catch(_e){}
    return window.db?.from ? window.db : null;
  }

  function installStyles(){
    if(document.getElementById("snPartnersV2Style")) return;
    const s=document.createElement("style");
    s.id="snPartnersV2Style";
    s.textContent=`
      #homeProvidersSection{display:none!important}
      .sn-p2{margin:36px 0 8px;padding:24px;border:1px solid rgba(184,138,69,.28);border-radius:24px;background:linear-gradient(135deg,#fffdf8,#f1faf7 55%,#fff7e8);box-shadow:0 18px 50px rgba(6,24,39,.09);overflow:hidden}
      .sn-p2-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:16px}.sn-p2-head h2{font-family:var(--display,Georgia,serif);font-size:27px;margin:0;color:var(--navy,#061827)}.sn-p2-head p{margin:5px 0 0;color:var(--muted,#5d6f76);font-size:13.5px}.sn-p2-kicker{display:block;color:#a67832;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px}
      .sn-p2-nav{display:flex;gap:8px}.sn-p2-nav button{width:38px;height:38px;border-radius:50%;border:1px solid #d9c69f;background:#fffaf0;color:#08253b;font-weight:900;cursor:pointer}
      .sn-p2-track{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;scroll-behavior:smooth;padding:2px 2px 7px}.sn-p2-track::-webkit-scrollbar{display:none}
      .sn-p2-item{position:relative;flex:0 0 min(345px,83vw);height:190px;border-radius:19px;overflow:hidden;background:#082d40;color:#fff!important;text-decoration:none!important;scroll-snap-align:start;box-shadow:0 10px 25px rgba(6,24,39,.14)}.sn-p2-item img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s}.sn-p2-item:hover img{transform:scale(1.035)}.sn-p2-item:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.03) 24%,rgba(3,19,31,.85) 100%)}
      .sn-p2-badge{position:absolute;z-index:2;top:13px;left:13px;background:rgba(255,252,245,.95);color:#7c5418;border-radius:999px;padding:6px 9px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.05em}.sn-p2-copy{position:absolute;z-index:2;left:16px;right:16px;bottom:14px}.sn-p2-copy strong{display:block;font-size:17px}.sn-p2-copy span{display:block;margin-top:3px;color:#e3eeee;font-size:12.5px}.sn-p2-copy b{display:inline-block;margin-top:7px;color:#f2cb78;font-size:12px}
      .sn-p2-admin-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.sn-p2-admin-grid label{font-size:12px;font-weight:800;color:#53636d}.sn-p2-admin-grid input{width:100%;margin-top:5px;padding:10px 11px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink)}.sn-p2-list{display:grid;gap:10px;margin-top:18px}.sn-p2-row{display:grid;grid-template-columns:100px 1fr auto;gap:12px;align-items:center;padding:11px;border:1px solid var(--line);border-radius:14px;background:#fff}.sn-p2-row img{width:100px;height:70px;object-fit:cover;border-radius:9px;background:#eef4f4}.sn-p2-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.sn-p2-status{font-size:11px;font-weight:850;color:#057554;margin-top:5px}.sn-p2-status.off{color:#a22e2e}
      @media(max-width:700px){.sn-p2{padding:18px;margin-top:24px}.sn-p2-head{align-items:flex-start}.sn-p2-head h2{font-size:23px}.sn-p2-admin-grid{grid-template-columns:1fr}.sn-p2-row{grid-template-columns:72px 1fr}.sn-p2-row img{width:72px;height:58px}.sn-p2-actions{grid-column:1/-1;justify-content:flex-start}}
    `;
    document.head.appendChild(s);
  }

  function killProviderShowcase(){
    if(!HOME) return;
    document.querySelectorAll("#homeProvidersSection").forEach(el=>el.remove());
  }

  async function activePartners(){
    const d=getDb(); if(!d) return [];
    const {data,error}=await d.from("home_partners").select("id,name,subtitle,image_url,link_url,badge,sponsored,sort_order,created_at").eq("is_active",true).order("sort_order",{ascending:true}).order("created_at",{ascending:true});
    if(error){console.warn("partners-v2",error.message);return [];} return data||[];
  }

  function card(p){
    const label=p.sponsored?"Sponsorisé":(p.badge||"Partenaire");
    const inner=`<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy"><span class="sn-p2-badge">${esc(label)}</span><span class="sn-p2-copy"><strong>${esc(p.name)}</strong>${p.subtitle?`<span>${esc(p.subtitle)}</span>`:""}${p.link_url?"<b>Découvrir →</b>":""}</span>`;
    return p.link_url?`<a class="sn-p2-item" href="${esc(p.link_url)}" target="_blank" rel="${p.sponsored?"sponsored ":""}noopener noreferrer">${inner}</a>`:`<div class="sn-p2-item">${inner}</div>`;
  }

  async function renderPublic(){
    if(!HOME) return;
    killProviderShowcase();
    if(document.querySelector("[data-sn-p2-public]")) return;
    const rows=await activePartners(); if(!rows.length) return;
    const sec=document.createElement("section"); sec.className="sn-p2"; sec.dataset.snP2Public="1";
    sec.innerHTML=`<div class="sn-p2-head"><div><span class="sn-p2-kicker">Partenaires SkipperNow</span><h2>Nos partenaires</h2><p>Ports, services nautiques et marques qui partagent notre univers.</p></div><div class="sn-p2-nav"><button type="button" data-p2-prev aria-label="Précédent">←</button><button type="button" data-p2-next aria-label="Suivant">→</button></div></div><div class="sn-p2-track">${rows.map(card).join("")}</div>`;
    const dest=[...document.querySelectorAll(".tile-browse")].find(x=>/destinations/i.test(x.textContent||"")) || document.querySelector(".tile-browse");
    if(dest?.parentNode) dest.parentNode.insertBefore(sec,dest); else (document.querySelector("main")||document.body).appendChild(sec);
    const track=sec.querySelector(".sn-p2-track"), step=()=>Math.min(360,Math.max(260,track.clientWidth*.72));
    sec.querySelector("[data-p2-prev]").onclick=()=>track.scrollBy({left:-step(),behavior:"smooth"});
    sec.querySelector("[data-p2-next]").onclick=()=>track.scrollBy({left:step(),behavior:"smooth"});
    if(rows.length>1 && !matchMedia("(prefers-reduced-motion: reduce)").matches){let pause=false;sec.onmouseenter=()=>pause=true;sec.onmouseleave=()=>pause=false;setInterval(()=>{if(pause||document.hidden)return;const end=track.scrollLeft+track.clientWidth>=track.scrollWidth-20;track.scrollTo({left:end?0:track.scrollLeft+step(),behavior:"smooth"});},4500);}
  }

  async function userIsAdmin(){
    const d=getDb(); if(!d?.auth?.getUser) return false;
    try{
      const {data:{user}}=await d.auth.getUser(); if(!user) return false;
      const {data,error}=await d.from("profiles").select("role").eq("id",user.id).maybeSingle();
      return !error && data?.role==="admin";
    }catch(_e){return false;}
  }

  async function allPartners(){
    const d=getDb(); const {data,error}=await d.from("home_partners").select("*").order("sort_order",{ascending:true}).order("created_at",{ascending:true}); if(error)throw error; return data||[];
  }

  async function upload(file){
    if(!file) return null; if(!file.type?.startsWith("image/"))throw new Error("Choisis une image."); if(file.size>5*1024*1024)throw new Error("Image trop lourde : 5 Mo maximum.");
    const d=getDb(), safe=(file.name||"partner.jpg").replace(/[^a-zA-Z0-9._-]/g,"-"); const path=`partners/${Date.now()}-${safe}`;
    const {error}=await d.storage.from("site-media").upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type}); if(error)throw error;
    return d.storage.from("site-media").getPublicUrl(path).data.publicUrl;
  }

  function adminRow(p){
    return `<div class="sn-p2-row"><img src="${esc(p.image_url)}" alt=""><div><strong>${esc(p.name)}</strong><div class="muted">${esc(p.subtitle||"")}</div><div class="sn-p2-status ${p.is_active?"":"off"}">${p.is_active?"● Visible":"● Masqué"}${p.sponsored?" · Sponsorisé":""} · ordre ${Number(p.sort_order||0)}</div></div><div class="sn-p2-actions"><button class="small-btn" type="button" data-p2-edit="${p.id}">Modifier</button><button class="small-btn" type="button" data-p2-toggle="${p.id}">${p.is_active?"Masquer":"Afficher"}</button><button class="small-btn danger" type="button" data-p2-delete="${p.id}">Supprimer</button></div></div>`;
  }

  async function renderAdmin(){
    const main=document.querySelector("#dashMain"); if(!main)return;
    main.innerHTML='<div class="empty-note">Chargement…</div>';
    let rows; try{rows=await allPartners();}catch(e){main.innerHTML=`<div class="empty-note">${esc(e.message||e)}</div>`;return;}
    const p=editingId?rows.find(x=>String(x.id)===String(editingId)):null;
    main.innerHTML=`<div class="panel-head"><div><h3>Partenaires & publicités</h3><p class="muted">Ajoute, modifie et classe les partenaires affichés sur la page d’accueil.</p></div><a class="small-btn" href="/" target="_blank" rel="noopener">Voir l’accueil ↗</a></div><form id="p2Form" class="profile-form" style="margin-top:14px"><div class="sn-p2-admin-grid"><label>Nom / marque<input id="p2Name" required maxlength="100" value="${esc(p?.name||"")}"></label><label>Sous-titre<input id="p2Subtitle" maxlength="180" value="${esc(p?.subtitle||"")}" placeholder="Ex. Port partenaire à Cannes"></label><label>Lien<input id="p2Link" type="url" value="${esc(p?.link_url||"")}" placeholder="https://..."></label><label>Badge<input id="p2Badge" maxlength="40" value="${esc(p?.badge||"Partenaire")}"></label><label>Ordre<input id="p2Order" type="number" min="0" max="9999" value="${Number(p?.sort_order??100)}"></label><label>Photo${p?" (vide = conserver)":""}<input id="p2Image" type="file" accept="image/*" ${p?"":"required"}></label></div><div style="display:flex;gap:16px;flex-wrap:wrap;margin:14px 0"><label><input id="p2Active" type="checkbox" ${p?.is_active!==false?"checked":""}> Visible sur l’accueil</label><label><input id="p2Sponsored" type="checkbox" ${p?.sponsored?"checked":""}> Sponsorisé / publicité</label></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="primary" type="submit">${p?"Enregistrer":"Ajouter le partenaire"}</button>${p?'<button id="p2Cancel" class="small-btn" type="button">Annuler</button>':""}</div><p id="p2Msg" class="muted"></p></form><div class="sn-p2-list">${rows.length?rows.map(adminRow).join(""):'<div class="empty-note">Aucun partenaire. Ajoute le premier ci-dessus.</div>'}</div>`;
    document.querySelector("#p2Cancel")?.addEventListener("click",()=>{editingId=null;renderAdmin();});
    document.querySelectorAll("[data-p2-edit]").forEach(b=>b.onclick=()=>{editingId=b.dataset.p2Edit;renderAdmin();});
    document.querySelectorAll("[data-p2-toggle]").forEach(b=>b.onclick=async()=>{const row=rows.find(x=>String(x.id)===String(b.dataset.p2Toggle));if(!row)return;const{error}=await getDb().from("home_partners").update({is_active:!row.is_active}).eq("id",row.id);if(error)alert(error.message);else renderAdmin();});
    document.querySelectorAll("[data-p2-delete]").forEach(b=>b.onclick=async()=>{if(!confirm("Supprimer ce partenaire ?"))return;const{error}=await getDb().from("home_partners").delete().eq("id",b.dataset.p2Delete);if(error)alert(error.message);else{editingId=null;renderAdmin();}});
    document.querySelector("#p2Form").onsubmit=async e=>{e.preventDefault();const msg=document.querySelector("#p2Msg"),submit=e.target.querySelector('button[type="submit"]');submit.disabled=true;msg.textContent="Enregistrement…";try{const file=document.querySelector("#p2Image").files?.[0],image=(await upload(file))||p?.image_url;if(!image)throw new Error("Ajoute une photo.");const payload={name:document.querySelector("#p2Name").value.trim(),subtitle:document.querySelector("#p2Subtitle").value.trim()||null,link_url:document.querySelector("#p2Link").value.trim()||null,badge:document.querySelector("#p2Badge").value.trim()||"Partenaire",sort_order:Number(document.querySelector("#p2Order").value||100),is_active:document.querySelector("#p2Active").checked,sponsored:document.querySelector("#p2Sponsored").checked,image_url:image};const q=p?getDb().from("home_partners").update(payload).eq("id",p.id):getDb().from("home_partners").insert(payload);const{error}=await q;if(error)throw error;editingId=null;await renderAdmin();}catch(err){msg.style.color="#a22e2e";msg.textContent=err.message||String(err);submit.disabled=false;}};
  }

  async function installAdminButton(){
    const side=document.querySelector("#dashboardBody .dash-side"); if(!side||side.querySelector("[data-p2-admin]")) return;
    if(!(await userIsAdmin())) return;
    const btn=document.createElement("button");btn.type="button";btn.dataset.p2Admin="1";btn.dataset.panel="partners";btn.innerHTML="🤝 <span>Partenaires & pubs</span>";btn.onclick=async()=>{side.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===btn));await renderAdmin();};side.appendChild(btn);
  }

  async function boot(){
    installStyles(); killProviderShowcase(); await waitForDb(); killProviderShowcase(); renderPublic(); installAdminButton();
    const obs=new MutationObserver(()=>{killProviderShowcase();void installAdminButton();});obs.observe(document.documentElement,{childList:true,subtree:true});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();