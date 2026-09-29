(function(){
  "use strict";
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const photos=rows=>Array.isArray(rows)?rows.filter(u=>typeof u==="string"&&/^https:\/\//.test(u)).slice(0,8):[];
  let carouselTimer=null;
  function addEditor(){
    const input=document.querySelector("#profilePhotoInput");
    const anchor=input?.closest(".field")||document.querySelector('#dashMain [data-pd-legacy="profile"]')?.closest(".request-card");
    if(!anchor||document.querySelector("#profileGalleryEditor")||!["provider","skipper"].includes(currentProfile?.role))return;
    const box=document.createElement("section");box.id="profileGalleryEditor";box.className="field";
    box.innerHTML='<label for="profileGalleryInput">Photos de vos prestations (8 maximum)</label><p class="muted">Montrez vos réalisations aux clients. La photo de profil reste indépendante.</p><div id="profileGalleryList" style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0"></div><input id="profileGalleryInput" type="file" accept="image/jpeg,image/png,image/webp" multiple><div style="margin-top:10px"><button type="button" class="small-btn fill" id="profileGallerySave">Ajouter les photos</button></div><p id="profileGalleryMsg" class="muted" role="status"></p>';
    anchor.after(box);
    let urls=photos(currentProfile?.profile_gallery_urls);
    const list=box.querySelector("#profileGalleryList"),message=box.querySelector("#profileGalleryMsg");
    const render=()=>{list.innerHTML=urls.length?urls.map((url,i)=>`<div style="position:relative"><img src="${esc(url)}" alt="Réalisation ${i+1}" style="width:110px;height:82px;object-fit:cover;border-radius:10px"><button type="button" class="small-btn" data-gallery-remove="${i}" aria-label="Retirer la photo ${i+1}" style="position:absolute;right:3px;top:3px;padding:2px 7px;background:white">×</button></div>`).join(""):'<span class="muted">Aucune photo de prestation ajoutée.</span>';};
    render();
    list.addEventListener("click",async e=>{
      const btn=e.target.closest("[data-gallery-remove]");if(!btn)return;
      const next=urls.filter((_,i)=>i!==Number(btn.dataset.galleryRemove));btn.disabled=true;
      const {error}=await db.from("profiles").update({profile_gallery_urls:next}).eq("id",currentUser.id);
      if(error){message.textContent=error.message;btn.disabled=false;return;}
      urls=next;currentProfile.profile_gallery_urls=next;message.textContent="Photo retirée.";render();
    });
    box.querySelector("#profileGallerySave").onclick=async()=>{
      const files=[...box.querySelector("#profileGalleryInput").files],button=box.querySelector("#profileGallerySave");
      if(!files.length){message.textContent="Choisissez une ou plusieurs photos.";return;}
      if(files.length+urls.length>8){message.textContent="Vous pouvez afficher huit photos au maximum.";return;}
      if(files.some(f=>!["image/jpeg","image/png","image/webp"].includes(f.type)||f.size>8*1024*1024)){message.textContent="Choisissez des images JPEG, PNG ou WebP de 8 Mo maximum.";return;}
      button.disabled=true;message.textContent="Ajout des photos en cours…";
      const added=[];
      try{
        for(const file of files){
          const path=`${currentUser.id}/gallery-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
          const {error}=await db.storage.from("mission-photos").upload(path,file,{contentType:file.type});
          if(error)throw error;
          added.push(db.storage.from("mission-photos").getPublicUrl(path).data.publicUrl);
        }
        const next=[...urls,...added];
        const {error}=await db.from("profiles").update({profile_gallery_urls:next}).eq("id",currentUser.id);
        if(error)throw error;
        urls=next;currentProfile.profile_gallery_urls=next;box.querySelector("#profileGalleryInput").value="";message.textContent="Photos ajoutées à votre profil.";render();
      }catch(error){message.textContent=error.message||"Impossible d’ajouter les photos. Réessayez.";}
      finally{button.disabled=false;}
    };
  }
  const original=window.openProfileDetail;
  if(typeof original==="function")window.openProfileDetail=function(id,adminView){
    clearInterval(carouselTimer);
    const result=original.apply(this,arguments);
    const content=document.querySelector("#profileDetailContent");if(!content)return result;
    content.dataset.galleryProfileId=String(id);
    db.from("profiles").select("role,profile_photo_url,second_photo_url,profile_gallery_urls").eq("id",id).maybeSingle().then(({data:p,error})=>{
      if(error||!p||content.dataset.galleryProfileId!==String(id)||!document.querySelector("#profileDetailModal.open")||!["provider","skipper"].includes(p.role))return;
      const urls=[p.profile_photo_url,p.second_photo_url,...photos(p.profile_gallery_urls)].filter(Boolean).filter((u,i,a)=>a.indexOf(u)===i);
      if(urls.length<2)return;
      const hero=content.firstElementChild;if(!hero)return;
      hero.style.backgroundImage="none";hero.querySelector(".ph-icon")?.remove();
      const img=document.createElement("img");img.src=urls[0];img.alt="Photos du prestataire";img.style.cssText="width:100%;height:100%;object-fit:cover;border-radius:22px 22px 0 0";hero.prepend(img);
      const controls=document.createElement("div");controls.style.cssText="position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;pointer-events:none;padding:12px";
      controls.innerHTML='<button type="button" aria-label="Photo précédente" class="small-btn" style="pointer-events:auto;background:#fff">‹</button><button type="button" aria-label="Photo suivante" class="small-btn" style="pointer-events:auto;background:#fff">›</button>';
      hero.append(controls);
      const count=document.createElement("span");count.style.cssText="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);background:#08253bcc;color:white;padding:3px 9px;border-radius:20px;font-size:13px";hero.append(count);
      let i=0;const show=n=>{i=(n+urls.length)%urls.length;img.src=urls[i];count.textContent=`${i+1} / ${urls.length}`;};show(0);
      const buttons=controls.querySelectorAll("button");buttons[0].onclick=()=>show(i-1);buttons[1].onclick=()=>show(i+1);
      carouselTimer=setInterval(()=>{if(!hero.isConnected){clearInterval(carouselTimer);return;}if(document.querySelector("#profileDetailModal.open"))show(i+1);},4500);
    });
    return result;
  };
  new MutationObserver(addEditor).observe(document.querySelector("#dashboardBody")||document.body,{childList:true,subtree:true});
  addEditor();
})();
