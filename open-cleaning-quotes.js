(function(){
"use strict";
const safe = value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const euros = value=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(Number(value||0)/100);
let busy=false;
async function showCleaningQuotes(){
 if(busy)return;busy=true;
 try{
 const user=(typeof currentUser!=="undefined")?currentUser:null;
 if(!user){alert("Connectez-vous à votre compte client.");return;}
 let dialog=document.getElementById("snOpenCleaningDialog");
 if(!dialog){dialog=document.createElement("div");dialog.id="snOpenCleaningDialog";dialog.style.cssText="position:fixed;inset:0;z-index:99999;background:rgba(7,29,50,.68);display:flex;align-items:center;justify-content:center;padding:20px";
 dialog.innerHTML='<div style="background:white;border-radius:18px;padding:24px;width:min(780px,100%);max-height:85vh;overflow:auto"><div style="display:flex;align-items:center;justify-content:space-between"><h2>Mes demandes de nettoyage et devis</h2><button type="button" data-close-cleaning style="padding:10px">Fermer ✕</button></div><div data-cleaning-list>Chargement…</div></div>';
 dialog.querySelector("[data-close-cleaning]").onclick=()=>dialog.remove();document.body.appendChild(dialog);}
 const list=dialog.querySelector("[data-cleaning-list]");
 const {data:requests,error}=await db.from("provider_requests").select("id,port,boat_name,task_description,desired_date,status,accepted_quote_id,created_at").eq("client_id",user.id).order("created_at",{ascending:false});
 if(error)throw error;
 const ids=(requests||[]).map(r=>r.id);
 let quotes=[];
 if(ids.length){const qr=await db.from("provider_quotes").select("id,request_id,amount_cents,details,status,provider_id,professional_net_cents").in("request_id",ids).order("created_at",{ascending:true});if(qr.error)throw qr.error;quotes=qr.data||[];}
 list.innerHTML=requests?.length?requests.map(r=>{
 const offers=quotes.filter(q=>q.request_id===r.id);
 return '<article style="padding:14px;margin:12px 0;border:1px solid #ddd;border-radius:12px"><strong>'+safe(r.boat_name)+' — '+safe(r.port)+'</strong><p>'+safe(r.task_description)+'</p><small>Statut : '+safe(r.status)+' · '+safe(r.desired_date||"Date à convenir")+'</small><div>'+ (offers.length?offers.map(q=>'<div style="padding:10px;margin-top:8px;border:1px solid #dce5e9;border-radius:9px"><b>Offre '+euros(q.amount_cents)+'</b> <small>'+safe(q.status)+'</small><p>'+safe(q.details||"")+'</p>'+(r.status==="open"&&q.status==="proposed"?'<button type="button" data-accept-cleaning="'+safe(q.id)+'" style="padding:10px;border-radius:8px;background:#09263b;color:white">Choisir ce devis</button>':"")+'</div>').join(""):"<p>Aucun devis reçu pour le moment.</p>")+'</div></article>';
 }).join(""):'<p>Aucune demande de nettoyage ouverte pour le moment.</p>';
 list.querySelectorAll("[data-accept-cleaning]").forEach(button=>button.onclick=async()=>{
 if(!confirm("Accepter ce devis et préparer le paiement sécurisé ?"))return;
 button.disabled=true;
 const {data,error}=await db.rpc("accept_open_provider_quote",{p_quote:button.dataset.acceptCleaning});
 if(error){alert(error.message);button.disabled=false;return;}
 alert("Devis accepté. Votre mission est créée : rendez-vous dans Mes demandes pour procéder au paiement sécurisé.");
 dialog.remove();if(typeof openDashboard==="function")await openDashboard();
 });
 }catch(e){console.error(e);alert("Impossible de récupérer les offres : "+e.message);}
 finally{busy=false;}
}
async function mount(){
 const p=(typeof currentProfile!=="undefined")?currentProfile:null;
 const area=document.getElementById("dashMain");
 if(!area||!p||p.role!=="client"||area.dataset.snCleaningChecked||area.querySelector("[data-sn-cleaning-quotes]"))return;
 // Only show this client-side service shortcut on the requests tab.
 const active=document.querySelector('.dash-side [data-panel="requests"].active');
 if(!active)return;
 area.dataset.snCleaningChecked="pending";
 const user=(typeof currentUser!=="undefined")?currentUser:null;
 if(!user?.id)return;
 try{
   const {data,error}=await db.from("provider_requests").select("id").eq("client_id",user.id).limit(1);
   if(error)throw error;
   if(!data?.length)return; // No dockside requests: keep boat-owner dashboard clean.
   if(!area.isConnected||document.getElementById("dashMain")!==area)return;
   const button=document.createElement("button");
   button.type="button";button.dataset.snCleaningQuotes="1";
   button.className="small-btn fill";button.style.cssText="margin:12px 0;padding:12px";
   button.textContent="🧽 Mes demandes de nettoyage et devis";
   button.onclick=showCleaningQuotes;area.prepend(button);
 }catch(e){
   console.warn("Unable to check cleaning requests:",e);
 }finally{
   area.dataset.snCleaningChecked="1";
 }
}
const root=document.getElementById("dashboardModal")||document.body;
new MutationObserver(()=>{if(!window.__snCleaningMountPending){window.__snCleaningMountPending=true;requestAnimationFrame(()=>{window.__snCleaningMountPending=false;mount();});}}).observe(root,{childList:true,subtree:true});
setTimeout(mount,900);
})();