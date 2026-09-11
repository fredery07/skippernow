(function(){
  "use strict";
  if(window.__snPartnersFixV2) return;
  window.__snPartnersFixV2=true;
  const home=location.pathname==="/"||location.pathname==="/index.html";
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let editId=null;

  function hideProviders(){
    if(!home) return;
    let style=document.getElementById("sn-hide-home-providers-v2");
    if(!style){style=document.createElement("style");style.id="sn-hide-home-providers-v2";style.textContent="#homeProvidersSection{display:none!important;height:0!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important}";document.head.appendChild(style);}
    document.querySelectorAll("#homeProvidersSection").forEach(el=>el.remove());
  }

  function moveExistingPartners(){
    if(!home) return;
    const section=document.querySelector("[data-sn-partners]");
    const dest=[...document.querySelectorAll("h2")].find(h=>(h.textContent||"").trim().toLowerCase().includes("destinations phares"));
    const target=dest?.closest("section")||dest?.parentElement;
    if(section&&target?.parentNode&&section.nextElementSibling!==target){target.parentNode.insertBefore(section,target);section.style.marginTop="36px";}
  }

  async function waitDb(timeout=15000){
    const start=Date.now();
    while(Date.now()-start<timeout){if(typeof window.db!=="undefined"&&window.db) return window.db;await new Promise(r=>setTimeout(r,150));}
    return null;
  }

  async function renderPartnersFallback(){
    if(!home||document.querySelector("[data-sn-partners]")) return moveExistingPartners();
    const db=await waitDb(); if(!db) return;
    const {data,error}=await db.from("home_partners").select("id,name,subtitle,image_url,link_url,badge,sponsored,sort_order,created_at").eq("is_active",true).order("sort_order",{ascending:true}).order("created_at",{ascending:true});
    if(error||!data?.length) return;
    if(document.querySelector("[data-sn-partners]")) return moveExistingPartners();
    const style=document.createElement("style");style.textContent=".sn2-wrap{max-width:1180px;margin:36px auto 10px;padding:0 24px}.sn2-card{border:1px solid rgba(184,138,69,.28);border-radius:26px;padding:24px;background:linear-gradient(135deg,#fffdf8,#f1faf7 52%,#fff7e7);box-shadow:0 18px 55px rgba(3,21,36,.10)}.sn2-head{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:16px}.sn2-head h2{font-family:var(--display,Georgia,serif);margin:0;color:#061827;font-size:27px}.sn2-head p{margin:5px 0 0;color:#60727a}.sn2-track{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}.sn2-track::-webkit-scrollbar{display:none}.sn2-item{position:relative;flex:0 0 min(340px,82vw);height:190px;border-radius:19px;overflow:hidden;scroll-snap-align:start;background:#0a2b43;color:#fff!important;text-decoration:none!important}.sn2-item img{width:100%;height:100%;object-fit:cover}.sn2-item:after{content:\"\";position:absolute;inset:0;background:linear-gradient(180deg,transparent 20%,rgba(2,19,32,.84))}.sn2-badge,.sn2-copy{position:absolute;z-index:2}.sn2-badge{left:14px;top:14px;background:#fffaf0;color:#7b5318;border-radius:999px;padding:7px 10px;font-size:10px;font-weight:900;text-transform:uppercase}.sn2-copy{left:16px;right:16px;bottom:14px}.sn2-copy strong{display:block;font-size:17px}.sn2-copy span{display:block;font-size:12px;color:#e4eeee;margin-top:3px}.sn2-copy b{display:block;color:#e7c985;margin-top:8px;font-size:12px}@media(max-width:700px){.sn2-wrap{padding:0 14px}.sn2-card{padding:18px}.sn2-head h2{font-size:23px}}";document.head.appendChild(style);
    const section=document.createElement("section");section.dataset.snPartners="1";section.className="sn2-wrap";
    section.innerHTML=`<div class="sn2-card"><div class="sn2-head"><div><small style="font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#9b6b20">Partenaires SkipperNow</small><h2>Nos partenaires</h2><p>Marques, ports et services qui partagent notre univers.</p></div></div><div class="sn2-track">${data.map(p=>{const inner=`<img src="${esc(p.image_url)}" alt="${esc(p.name)}"><span class="sn2-badge">${esc(p.sponsored?"Sponsorisé":(p.badge||"Partenaire"))}</span><span class="sn2-copy"><strong>${esc(p.name)}</strong>${p.subtitle?`<span>${esc(p.subtitle)}</span>`:""}${p.link_url?"<b>Découvrir →</b>":""}</span>`;return p.link_url?`<a class="sn2-item" href="${esc(p.link_url)}" target="_blank" rel="${p.sponsored?"sponsored ":""}noopener noreferrer">${inner}</a>`:`<div class="sn2-item">${inner}</div>`}).join("")}</div></div>`;
    const dest=[...document.querySelectorAll("h2")].find(h=>(h.textContent||"").trim().toLowerCase().includes("destinations phares"));
    const target=dest?.closest("section")||dest?.parentElement;
    if(target?.parentNode) target.parentNode.insertBefore(section,target); else document.querySelector("main")?.appendChild(section);
  }

  async function isAdmin(){
    const db=await waitDb(); if(!db) return false;
    try{const {data:{user}}=await db.auth.getUser();if(!user) return false;const {data}=await db.from("profiles").select("role").eq("id",user.id).maybeSingle();return data?.role==="admin";}catch(_e){return false;}
  }

  async function upload(file){
    if(!file) return null;if(!file.type.startsWith("image/")) throw new Error("Choisis une image.");
    const db=await waitDb();const safe=(file.name||"partner.jpg").replace(/[^a-zA-Z0-9._-]/g,"-");const path=`partners/${Date.now()}-${safe}`;
    const {error}=await db.storage.from("site-media").upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type});if(error) throw error;return db.storage.from("site-media").getPublicUrl(path).data.publicUrl;
  }

  async function renderAdmin(){
    const db=await waitDb();const main=document.querySelector("#dashMain");if(!db||!main) return;
    const {data:rows,error}=await db.from("home_partners").select("*").order("sort_order",{ascending:true}).order("created_at",{ascending:true});if(error){main.innerHTML=`<div class="empty-note">${esc(error.message)}</div>`;return;}
    const editing=editId?rows.find(x=>String(x.id)===String(editId)):null;
    main.innerHTML=`<div class="panel-head"><div><h3>Partenaires & publicités</h3><p class="muted">Ajoute, modifie, masque ou supprime les partenaires affichés sur l’accueil.</p></div></div><form id="sn2Form" style="display:grid;gap:10px;margin-top:14px"><input id="sn2Name" required placeholder="Nom / marque" value="${esc(editing?.name||"")}" style="padding:11px;border:1px solid var(--line);border-radius:10px"><input id="sn2Sub" placeholder="Sous-titre" value="${esc(editing?.subtitle||"")}" style="padding:11px;border:1px solid var(--line);border-radius:10px"><input id="sn2Link" type="url" placeholder="https://..." value="${esc(editing?.link_url||"")}" style="padding:11px;border:1px solid var(--line);border-radius:10px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><input id="sn2Badge" placeholder="Badge" value="${esc(editing?.badge||"Partenaire")}" style="padding:11px;border:1px solid var(--line);border-radius:10px"><input id="sn2Order" type="number" value="${Number(editing?.sort_order??100)}" style="padding:11px;border:1px solid var(--line);border-radius:10px"></div><input id="sn2Image" type="file" accept="image/*" ${editing?"":"required"}><div style="display:flex;gap:16px;flex-wrap:wrap"><label><input id="sn2Active" type="checkbox" ${editing?.is_active!==false?"checked":""}> Visible</label><label><input id="sn2Sponsored" type="checkbox" ${editing?.sponsored?"checked":""}> Sponsorisé / publicité</label></div><div><button class="primary" type="submit">${editing?"Enregistrer":"Ajouter le partenaire"}</button>${editing?'<button class="small-btn" id="sn2Cancel" type="button" style="margin-left:8px">Annuler</button>':""}</div><div id="sn2Msg" class="muted"></div></form><div style="display:grid;gap:10px;margin-top:18px">${rows.length?rows.map(p=>`<div style="display:grid;grid-template-columns:90px 1fr auto;gap:12px;align-items:center;border:1px solid var(--line);border-radius:12px;padding:10px"><img src="${esc(p.image_url)}" style="width:90px;height:64px;object-fit:cover;border-radius:9px"><div><strong>${esc(p.name)}</strong><div class="muted">${esc(p.subtitle||"")}</div><small>${p.is_active?"Visible":"Masqué"}${p.sponsored?" · Sponsorisé":""}</small></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="small-btn" data-sn2-edit="${p.id}">Modifier</button><button class="small-btn" data-sn2-toggle="${p.id}">${p.is_active?"Masquer":"Afficher"}</button><button class="small-btn danger" data-sn2-del="${p.id}">Supprimer</button></div></div>`).join(""):'<div class="empty-note">Aucun partenaire pour le moment.</div>'}</div>`;
    document.querySelector("#sn2Cancel")?.addEventListener("click",()=>{editId=null;renderAdmin();});
    document.querySelectorAll("[data-sn2-edit]").forEach(b=>b.onclick=()=>{editId=b.dataset.sn2Edit;renderAdmin();});
    document.querySelectorAll("[data-sn2-toggle]").forEach(b=>b.onclick=async()=>{const p=rows.find(x=>String(x.id)===String(b.dataset.sn2Toggle));if(!p)return;await db.from("home_partners").update({is_active:!p.is_active}).eq("id",p.id);renderAdmin();});
    document.querySelectorAll("[data-sn2-del]").forEach(b=>b.onclick=async()=>{if(!confirm("Supprimer ce partenaire ?"))return;await db.from("home_partners").delete().eq("id",b.dataset.sn2Del);renderAdmin();});
    document.querySelector("#sn2Form").onsubmit=async e=>{e.preventDefault();const msg=document.querySelector("#sn2Msg");try{const file=document.querySelector("#sn2Image").files?.[0];const image=await upload(file)||editing?.image_url;if(!image)throw new Error("Ajoute une photo.");const payload={name:document.querySelector("#sn2Name").value.trim(),subtitle:document.querySelector("#sn2Sub").value.trim()||null,link_url:document.querySelector("#sn2Link").value.trim()||null,badge:document.querySelector("#sn2Badge").value.trim()||"Partenaire",sort_order:Number(document.querySelector("#sn2Order").value||100),is_active:document.querySelector("#sn2Active").checked,sponsored:document.querySelector("#sn2Sponsored").checked,image_url:image};const q=editing?db.from("home_partners").update(payload).eq("id",editing.id):db.from("home_partners").insert(payload);const {error}=await q;if(error)throw error;editId=null;renderAdmin();}catch(err){msg.textContent=err.message||String(err);msg.style.color="#a22e2e";}};
  }

  async function installAdmin(){
    if(!(await isAdmin())) return;
    const side=document.querySelector("#dashboardBody .dash-side");if(!side||side.querySelector("[data-sn2-partners]")) return;
    const btn=document.createElement("button");btn.type="button";btn.dataset.sn2Partners="1";btn.innerHTML="🤝 <span>Partenaires & pubs</span>";btn.onclick=async()=>{side.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===btn));await renderAdmin();};side.appendChild(btn);
  }

  hideProviders();
  const obs=new MutationObserver(()=>{hideProviders();moveExistingPartners();installAdmin();});obs.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>renderPartnersFallback(),500);setTimeout(()=>renderPartnersFallback(),1800);setTimeout(()=>installAdmin(),1000);setTimeout(()=>installAdmin(),3000);
})();