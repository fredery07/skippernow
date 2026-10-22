(function(){
"use strict";
function launch(){
 const params=new URLSearchParams(location.search);
 const activity=params.get("activity");
 if(activity!=="service"&&activity!=="skipper")return;
 const kick=()=>{
   if(activity==="skipper"){
     if(document.querySelector("#providerModal.open"))return;
     if(typeof showProviderResults==="function"&&typeof openModal==="function"){
       showProviderResults("skipper");openModal("providerModal");
     }
     return;
   }
   if(document.getElementById("snServiceChooser"))return;
   const layer=document.createElement("div");
   layer.id="snServiceChooser";
   layer.style.cssText="position:fixed;inset:0;z-index:99999;background:rgba(5,23,41,.7);display:flex;align-items:center;justify-content:center;padding:18px";
   layer.innerHTML='<section role="dialog" aria-modal="true" aria-label="Choix de prestation" style="max-width:650px;width:100%;background:#fff;border-radius:20px;padding:22px;box-shadow:0 20px 55px #0004"><div style="display:flex;justify-content:space-between;align-items:center;gap:16px"><h2 style="margin:0;color:#10283c">Quelle prestation recherchez-vous ?</h2><button type="button" data-close style="padding:10px;border-radius:9px">✕</button></div><p>Publiez une demande gratuite sans choisir de prestataire.</p><div data-choices style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px"></div></section>';
   const options=[["cleaning","🧽 Nettoyage de bateau"],["dock_service","⚓ Services à quai"],["shipyard","🔧 Entretien et réparations"],["day_sailor","👷 Marin à la journée"],["provisioning","📦 Avitaillement"]];
   const grid=layer.querySelector("[data-choices]");
   grid.innerHTML=options.map(([code,label])=>'<button type="button" data-activity="'+code+'" style="padding:16px;text-align:left;background:#f7faf9;border:1px solid #d7e1dc;border-radius:12px;font:inherit;font-weight:700">'+label+'</button>').join("");
   const close=()=>{layer.remove();const url=new URL(location.href);url.searchParams.delete("activity");url.searchParams.delete("source");history.replaceState(null,"",url.pathname+url.search+url.hash);};
   layer.querySelector("[data-close]").onclick=close;
   grid.querySelectorAll("[data-activity]").forEach(b=>b.onclick=()=>{
     if(typeof window.openBookingFor!=="function"){alert("Le formulaire est en cours de chargement. Actualisez la page.");return;}
     const selected=b.dataset.activity,label=b.textContent;
     close();
     window.openBookingFor(null,"Demande ouverte — "+label,params.get("port")||"",selected,"","provider");
   });
   document.body.appendChild(layer);
 };
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(kick,100),{once:true});else setTimeout(kick,100);
}
launch();
})();