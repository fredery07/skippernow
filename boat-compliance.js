"use strict";
(function(){
  const table="boat_compliance_documents", bucket="boat-compliance";
  const labels={
    insurance:"Insurance / Assurance",
    registration:"Vessel registration / Immatriculation",
    commercial_license:"Commercial authorization / Autorisation commerciale",
    captain_license:"Captain license / Licence capitaine",
    business_registration:"Business registration / Enregistrement entreprise",
    other:"Other document / Autre document"
  };
  const required=["insurance","registration"];
  const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const css=document.createElement("style");
  css.textContent=".boatdocs-backdrop{position:fixed;inset:0;background:#05192ab8;z-index:999999;display:flex;align-items:center;justify-content:center;padding:16px}.boatdocs-modal{background:white;color:#172d40;border-radius:16px;max-width:700px;width:100%;max-height:88vh;overflow:auto;padding:24px;box-shadow:0 20px 60px #0018}.boatdocs-modal button{cursor:pointer}.boatdocs-line{border-bottom:1px solid #e6edf1;padding:12px 0}.boatdocs-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.boatdocs-modal input,.boatdocs-modal select{max-width:100%;padding:8px;margin:5px 0}.boatdocs-modal .small-btn{border:1px solid #a3b6c8;border-radius:7px;padding:7px 12px;background:#f5f9fa}.boatdocs-status{font-weight:700}.boatdocs-help{font-size:13px;color:#486073}.boatdocs-alert{color:#a12727}";
  document.head.appendChild(css);
  function getUser(){try{return typeof currentUser!=="undefined" && currentUser ? currentUser:null;}catch(e){return null;}}
  function getDb(){try{return typeof db!=="undefined" && db?db:null;}catch(e){return null;}}
  function addButtons(){
    document.querySelectorAll("#myBoatCards [data-edit-boat], [data-verify-boat], [data-unverify-boat]").forEach(el=>{
      const id=el.getAttribute("data-edit-boat")||el.getAttribute("data-verify-boat")||el.getAttribute("data-unverify-boat");
      const admin=!el.hasAttribute("data-edit-boat");
      if(!id || !el.parentElement || el.parentElement.querySelector('[data-boat-docs="'+id+'"]'))return;
      const btn=document.createElement("button");btn.type="button";btn.className="small-btn";btn.textContent="📄 "+(admin?"Documents / Review":"Documents / Upload");
      btn.setAttribute("data-boat-docs",id);btn.setAttribute("data-boat-admin",String(admin));el.parentElement.insertBefore(btn,el);
    });
  }
  document.addEventListener("click",e=>{
    const b=e.target.closest("[data-boat-docs]");
    if(!b)return;
    e.preventDefault();e.stopPropagation();
    openDocs(b.getAttribute("data-boat-docs"),b.getAttribute("data-boat-admin")==="true");
  });
  const observer=new MutationObserver(()=>{if(getUser())addButtons();});
  function init(){if(document.body){observer.observe(document.body,{subtree:true,childList:true});addButtons();}}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
  async function openDocs(boatId,admin){
    const supa=getDb(),user=getUser();if(!supa||!user)return alert("Please sign in.");
    const backdrop=document.createElement("div");backdrop.className="boatdocs-backdrop";
    backdrop.innerHTML='<div class="boatdocs-modal" role="dialog" aria-modal="true" aria-label="Boat compliance documents"><button type="button" class="small-btn" id="boatdocsClose" style="float:right">✕ Close / Fermer</button><h2>📄 Boat documents / Documents du bateau</h2><p class="boatdocs-help">Private compliance records, accessible only to the boat owner and SkipperNow administrators. / Documents confidentiels réservés au loueur et à l’administration.</p><div id="boatdocsContent">Loading / Chargement…</div></div>';
    document.body.appendChild(backdrop);
    const close=()=>backdrop.remove();backdrop.querySelector("#boatdocsClose").onclick=close;
    backdrop.addEventListener("click",e=>{if(e.target===backdrop)close()});
    document.addEventListener("keydown",function escKey(e){if(e.key==="Escape"){close();document.removeEventListener("keydown",escKey)}});
    const root=backdrop.querySelector("#boatdocsContent");
    async function render(){
      const {data:docs,error}=await supa.from(table).select("*").eq("boat_id",boatId).order("created_at",{ascending:false});
      if(error){root.textContent=error.message;return;}
      const valid=d=>d.review_status==="approved"&&(!d.expires_on||d.expires_on>=new Date().toISOString().slice(0,10));
      const missing=required.filter(t=>!docs.some(d=>d.document_type===t&&valid(d)));
      root.innerHTML="<p class='"+(missing.length?"boatdocs-alert":"boatdocs-help")+"'>"+(missing.length?"Required approval pending / En attente : "+missing.map(t=>labels[t]).join(", "):"✓ Minimum documents approved / Documents minimum approuvés")+"</p>";
      docs.forEach(d=>{
        const row=document.createElement("div");row.className="boatdocs-line";
        const expires=d.expires_on?" · expires / expire : "+escapeHtml(d.expires_on):"";
        row.innerHTML="<strong>"+escapeHtml(labels[d.document_type]||d.document_type)+"</strong><div>"+escapeHtml(d.file_name)+"</div><div class='boatdocs-help boatdocs-status'>"+escapeHtml(d.review_status)+expires+"</div>"+(d.rejection_reason?"<div class='boatdocs-alert'>"+escapeHtml(d.rejection_reason)+"</div>":"")+"<div class='boatdocs-actions'></div>";
        const acts=row.querySelector(".boatdocs-actions");
        const view=document.createElement("button");view.className="small-btn";view.textContent="View / Voir";
        view.onclick=async()=>{const r=await supa.storage.from(bucket).createSignedUrl(d.storage_path,120);if(r.error)alert(r.error.message);else window.open(r.data.signedUrl,"_blank","noopener,noreferrer");};acts.appendChild(view);
        if(admin&&d.review_status!=="approved"){
          const approve=document.createElement("button");approve.className="small-btn";approve.textContent="✓ Approve / Approuver";approve.onclick=()=>review(d,"approved");acts.appendChild(approve);
        }
        if(admin&&d.review_status!=="rejected"){
          const reject=document.createElement("button");reject.className="small-btn";reject.textContent="✕ Reject / Refuser";reject.onclick=()=>review(d,"rejected");acts.appendChild(reject);
        }
        if(!admin&&d.review_status==="pending"){
          const del=document.createElement("button");del.className="small-btn";del.textContent="Delete / Supprimer";del.onclick=async()=>{if(!confirm("Delete this pending document? / Supprimer ce document en attente ?"))return;const r=await supa.from(table).delete().eq("id",d.id);if(r.error)alert(r.error.message);else{await supa.storage.from(bucket).remove([d.storage_path]);render()}};acts.appendChild(del);
        }
        root.appendChild(row);
      });
      if(!admin){
        const section=document.createElement("form");section.className="boatdocs-line";
        section.innerHTML="<h3>Add a document / Ajouter un document</h3><label>Document type / Type <select required name='type'>"+Object.entries(labels).map(([k,v])=>"<option value='"+k+"'>"+escapeHtml(v)+"</option>").join("")+"</select></label><div><label>PDF or image (max 10 MB) / PDF ou photo <input required name='file' type='file' accept='.pdf,image/jpeg,image/png,image/webp'></label></div><label>Expiry date / Date d’expiration (if applicable) <input name='expiry' type='date'></label><div><button class='small-btn' type='submit'>Upload for review / Envoyer pour validation</button></div><p class='boatdocs-help' aria-live='polite'></p>";
        section.onsubmit=async e=>{
          e.preventDefault();
          const state=section.querySelector("p"),file=section.querySelector('[name="file"]').files[0],type=section.querySelector('[name="type"]').value,expiry=section.querySelector('[name="expiry"]').value;
          if(!file||file.size>10485760||!["application/pdf","image/jpeg","image/png","image/webp"].includes(file.type)){state.textContent="Invalid file type or size / Fichier non valide (10 MB max)";return;}
          const ext=file.name.split(".").pop().toLowerCase(),path=user.id+"/"+boatId+"/"+Date.now()+"-"+crypto.randomUUID()+"."+ext;
          const button=section.querySelector("button");button.disabled=true;state.textContent="Uploading / Envoi…";
          const up=await supa.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type});
          if(up.error){state.textContent=up.error.message;button.disabled=false;return;}
          const inserted=await supa.from(table).insert({boat_id:boatId,owner_id:user.id,document_type:type,file_name:file.name,storage_path:path,expires_on:expiry||null});
          if(inserted.error){await supa.storage.from(bucket).remove([path]);state.textContent=inserted.error.message;button.disabled=false;return;}
          await render();
        };root.appendChild(section);
      }else{
        const note=document.createElement("p");note.className="boatdocs-help";note.textContent="Before approval, verify document authenticity, validity, insured charter usage and jurisdiction-specific permits. / Vérifiez la validité, la couverture de location et les autorisations locales.";root.appendChild(note);
      }
    }
    async function review(d,status){
      let reason=null;if(status==="rejected"){reason=prompt("Reason / Motif du refus :");if(!reason||!reason.trim())return;}
      const payload={review_status:status,rejection_reason:status==="rejected"?reason.trim():null,checked_at:new Date().toISOString(),checked_by:user.id};
      const r=await supa.from(table).update(payload).eq("id",d.id);if(r.error)alert(r.error.message);else render();
    }
    render();
  }
})();