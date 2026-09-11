(function(){
"use strict";

const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>window.currentUser?.id||(typeof currentUser!=="undefined"&&currentUser?.id)||null;
const allowed=new Set(["application/pdf","image/jpeg","image/png","image/webp","image/heic","image/heif"]);

function modalShell(title,body){
  const m=document.createElement("div");
  m.className="modal open show sn-provider-doc-modal";
  m.style.cssText="position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(5,29,47,.62);overflow:auto";
  m.innerHTML=`<div class="dialog" role="dialog" aria-modal="true" style="width:min(720px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:20px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.28)"><div class="dialog-top" style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px"><div><small>SKIPPERNOW</small><h2 style="margin:4px 0 0">${esc(title)}</h2></div><button class="close" type="button" aria-label="Fermer" style="border:0;background:#eef4f5;border-radius:999px;width:38px;height:38px;font-size:24px;cursor:pointer">×</button></div><div style="margin-top:18px">${body}</div></div>`;
  document.body.appendChild(m);
  const close=()=>m.remove();
  m.querySelector(".close").onclick=close;
  m.addEventListener("click",e=>{if(e.target===m)close();});
  document.addEventListener("keydown",function onKey(e){if(e.key==="Escape"&&m.isConnected){close();document.removeEventListener("keydown",onKey);}});
  return m;
}

async function listMine(){
  const id=uid();
  if(!id) throw new Error("Session utilisateur introuvable.");
  const{data,error}=await db.from("provider_documents").select("id,document_type,label,file_name,mime_type,size_bytes,status,admin_note,created_at,object_path").eq("provider_id",id).order("created_at",{ascending:false});
  if(error)throw error;
  return data||[];
}

function statusLabel(s){return s==="approved"?"Validé":s==="rejected"?"Refusé":"En attente";}
function statusStyle(s){return s==="approved"?"background:#dcf8ef;color:#057554":s==="rejected"?"background:#ffe6e6;color:#a22e2e":"background:#fff0cf;color:#8a5a00";}

async function openFile(path){
  const{data,error}=await db.storage.from("provider-documents").createSignedUrl(path,120);
  if(error)throw error;
  if(!data?.signedUrl)throw new Error("Impossible d'ouvrir le document.");
  window.open(data.signedUrl,"_blank","noopener");
}

async function openManage(){
  const m=modalShell("Mes documents",`<p class="muted">Retrouvez les documents envoyés à l'équipe SkipperNow et leur statut de validation.</p><div id="snMyDocs"><p class="muted">Chargement…</p></div>`);
  const host=m.querySelector("#snMyDocs");
  try{
    const docs=await listMine();
    host.innerHTML=docs.length?docs.map(d=>`<div class="request-card" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><strong>${esc(d.label||d.file_name)}</strong><div class="muted" style="font-size:12px">${esc(d.document_type)} · ${new Date(d.created_at).toLocaleDateString()}</div>${d.admin_note?`<div class="note-box" style="margin-top:8px">${esc(d.admin_note)}</div>`:""}</div><span class="tag" style="${statusStyle(d.status)}">${statusLabel(d.status)}</span></div><div style="margin-top:10px"><button class="small-btn" data-open-doc="${esc(d.object_path)}" type="button">Voir le document</button></div></div>`).join(""):`<div class="empty-note">Aucun document envoyé pour le moment.</div>`;
    host.querySelectorAll("[data-open-doc]").forEach(b=>b.onclick=async()=>{try{await openFile(b.dataset.openDoc);}catch(e){alert(e.message||e);}});
  }catch(e){host.innerHTML=`<div class="empty-note">${esc(e.message||e)}</div>`;}
}

async function openUpload(){
  const m=modalShell("Envoyer un document",`<p class="muted">Envoyez un justificatif directement au service SkipperNow. Formats acceptés : PDF, JPG, PNG, WEBP, HEIC. 10 Mo maximum.</p><div class="field"><label>Type de document</label><select id="snDocType" style="width:100%;padding:11px;border:1px solid #d7e3e5;border-radius:10px"><option value="identity">Pièce d'identité</option><option value="insurance">Assurance professionnelle</option><option value="siret">SIRET / justificatif d'entreprise</option><option value="diploma">Diplôme / qualification</option><option value="other">Autre document</option></select></div><div class="field" style="margin-top:12px"><label>Nom du document</label><input id="snDocLabel" placeholder="Ex. Attestation d'assurance 2026" style="width:100%;padding:11px;border:1px solid #d7e3e5;border-radius:10px"></div><div class="field" style="margin-top:12px"><label>Choisir un fichier ou une photo</label><input id="snDocFile" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif" style="width:100%;padding:12px;border:1px dashed #a9bec3;border-radius:10px;background:#f7fbfb"></div><p id="snDocMsg" class="muted" style="min-height:20px"></p><button id="snDocSend" class="primary wide" type="button" style="width:100%">Envoyer à SkipperNow</button>`);
  const send=m.querySelector("#snDocSend"),msg=m.querySelector("#snDocMsg"),fileInput=m.querySelector("#snDocFile");
  send.onclick=async()=>{
    const file=fileInput.files?.[0];
    const label=m.querySelector("#snDocLabel").value.trim();
    const type=m.querySelector("#snDocType").value;
    if(!file){msg.style.color="#a22e2e";msg.textContent="Choisissez un fichier ou une photo.";return;}
    if(file.size>10*1024*1024){msg.style.color="#a22e2e";msg.textContent="Le fichier dépasse 10 Mo.";return;}
    const mime=file.type||({jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",heic:"image/heic",heif:"image/heif",pdf:"application/pdf"}[(file.name.split('.').pop()||'').toLowerCase()]||"");
    if(!allowed.has(mime)){msg.style.color="#a22e2e";msg.textContent="Format non accepté. Utilisez PDF, JPG, PNG, WEBP ou HEIC.";return;}
    const id=uid();
    if(!id){msg.style.color="#a22e2e";msg.textContent="Session expirée. Reconnectez-vous.";return;}
    send.disabled=true;msg.style.color="";msg.textContent="Envoi sécurisé en cours…";
    const ext=(file.name.split(".").pop()||"bin").replace(/[^a-z0-9]/gi,"").toLowerCase();
    const random=(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)+Date.now());
    const path=`${id}/${Date.now()}-${random}.${ext}`;
    try{
      const up=await db.storage.from("provider-documents").upload(path,file,{contentType:mime,upsert:false});
      if(up.error)throw up.error;
      const ins=await db.from("provider_documents").insert({provider_id:id,document_type:type,label:label||file.name,file_name:file.name,object_path:path,mime_type:mime,size_bytes:file.size});
      if(ins.error){await db.storage.from("provider-documents").remove([path]);throw ins.error;}
      msg.style.color="#057554";msg.textContent="Document envoyé ✅ L'équipe SkipperNow le verra dans le tableau de bord admin.";send.textContent="Envoyé ✅";
      setTimeout(()=>m.remove(),1400);
    }catch(e){msg.style.color="#a22e2e";msg.textContent=e.message||String(e);send.disabled=false;}
  };
}

function interceptProviderButtons(){
  document.addEventListener("click",e=>{
    const b=e.target.closest&&e.target.closest("button");
    if(!b)return;
    if(b.matches("[data-pd-doc-upload]")){e.preventDefault();e.stopImmediatePropagation();openUpload();return;}
    if(b.matches("[data-pd-doc-manage]")){e.preventDefault();e.stopImmediatePropagation();openManage();return;}
    const txt=(b.textContent||"").trim().toLowerCase();
    if(txt.includes("envoyer un document")||txt.includes("transmettre un document")){e.preventDefault();e.stopImmediatePropagation();openUpload();}
    else if(txt.includes("gérer mes documents")||txt.includes("voir / gérer mes documents")||txt==="mes documents"){e.preventDefault();e.stopImmediatePropagation();openManage();}
  },true);
}

async function renderAdmin(){
  const body=document.querySelector("#dashboardBody");if(!body)return;
  body.innerHTML=`<div class="panel-head"><div><h3>Documents prestataires</h3><p class="muted">Documents envoyés par les prestataires pour contrôle.</p></div><select id="snAdminDocFilter" style="padding:9px;border:1px solid var(--line);border-radius:10px"><option value="pending">En attente</option><option value="all">Tous</option><option value="approved">Validés</option><option value="rejected">Refusés</option></select></div><div id="snAdminDocs"><p class="muted">Chargement…</p></div>`;
  const filter=body.querySelector("#snAdminDocFilter"),host=body.querySelector("#snAdminDocs");
  async function load(){
    let q=db.from("provider_documents").select("id,provider_id,document_type,label,file_name,object_path,mime_type,size_bytes,status,admin_note,created_at,profiles!provider_documents_provider_id_fkey(full_name,email,provider_activity)").order("created_at",{ascending:false});
    if(filter.value!=="all")q=q.eq("status",filter.value);
    const{data,error}=await q;
    if(error){host.innerHTML=`<div class="empty-note">${esc(error.message)}</div>`;return;}
    const rows=data||[];
    host.innerHTML=rows.length?rows.map(d=>{const p=d.profiles||{};return `<article class="request-card" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><strong>${esc(p.full_name||"Prestataire")}</strong><div class="muted">${esc(p.email||"")} · ${esc(p.provider_activity||"")}</div><div style="margin-top:8px"><strong>${esc(d.label||d.file_name)}</strong><div class="muted" style="font-size:12px">${esc(d.document_type)} · ${new Date(d.created_at).toLocaleString()}</div></div></div><span class="tag" style="${statusStyle(d.status)}">${statusLabel(d.status)}</span></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="small-btn" data-admin-view="${esc(d.object_path)}" type="button">Voir</button>${d.status!=="approved"?`<button class="small-btn fill" data-admin-approve="${d.id}" type="button">Valider</button>`:""}${d.status!=="rejected"?`<button class="small-btn danger" data-admin-reject="${d.id}" type="button">Refuser</button>`:""}</div>${d.admin_note?`<div class="note-box" style="margin-top:10px">Note admin : ${esc(d.admin_note)}</div>`:""}</article>`}).join(""):`<div class="empty-note">Aucun document dans cette catégorie.</div>`;
    host.querySelectorAll("[data-admin-view]").forEach(b=>b.onclick=async()=>{try{await openFile(b.dataset.adminView);}catch(e){alert(e.message||e);}});
    host.querySelectorAll("[data-admin-approve]").forEach(b=>b.onclick=()=>review(b.dataset.adminApprove,"approved"));
    host.querySelectorAll("[data-admin-reject]").forEach(b=>b.onclick=()=>review(b.dataset.adminReject,"rejected"));
  }
  async function review(id,status){
    const note=prompt(status==="approved"?"Note interne (optionnelle)":"Motif du refus à transmettre au prestataire","")||"";
    const{error}=await db.from("provider_documents").update({status,admin_note:note||null,reviewed_at:new Date().toISOString(),reviewed_by:uid()}).eq("id",id);
    if(error){alert(error.message);return;}
    await load();
  }
  filter.onchange=load;load();
}

async function getCurrentProfile(){
  const local=window.currentProfile||(typeof currentProfile!=="undefined"?currentProfile:null);
  if(local?.role)return local;
  const id=uid();if(!id)return null;
  const{data}=await db.from("profiles").select("role").eq("id",id).maybeSingle();
  return data||null;
}

async function installAdminEntry(){
  const p=await getCurrentProfile();if(!p||p.role!=="admin")return;
  const side=document.querySelector("#dashboardModal .dash-side");if(!side||side.querySelector("[data-panel='provider-documents-admin']"))return;
  const {count}=await db.from("provider_documents").select("id",{count:"exact",head:true}).eq("status","pending");
  const b=document.createElement("button");b.type="button";b.dataset.panel="provider-documents-admin";b.innerHTML=`📄 <span>Documents prestataires${count?` (${count})`:""}</span>`;
  b.onclick=()=>{side.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));renderAdmin();};side.appendChild(b);
}

interceptProviderButtons();
const obs=new MutationObserver(()=>setTimeout(installAdminEntry,0));
obs.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(installAdminEntry,800);
window.skProviderDocuments={openUpload,openManage,renderAdmin,openFile};
})();