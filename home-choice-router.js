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
   const chooseCategory=(selected,label)=>{

     const title=layer.querySelector("h2");
     title.textContent=label;
     layer.querySelector("p").textContent="Comment souhaitez-vous trouver votre professionnel ?";
     grid.innerHTML='<button type="button" data-path="open" style="padding:20px;text-align:left;background:#e1faf3;border:1px solid #29bba4;border-radius:14px;font:inherit"><strong>📝 Déposer ma demande</strong><div style="margin-top:7px;font-size:14px">Recevoir plusieurs devis sans choisir de professionnel.</div></button><button type="button" data-path="profiles" style="padding:20px;text-align:left;background:#f7faf9;border:1px solid #d7e1dc;border-radius:14px;font:inherit"><strong>👥 Voir les prestataires</strong><div style="margin-top:7px;font-size:14px">Comparer les profils et contacter directement un professionnel.</div></button>';
     const back=document.createElement("button");back.type="button";back.textContent="← Changer de prestation";back.style.cssText="margin-top:16px;padding:9px;border:0;background:transparent;cursor:pointer;color:#0d6373";
     back.onclick=()=>{layer.remove();const url=new URL(location.href);url.searchParams.set("activity","service");history.replaceState(null,"",url.pathname+url.search+url.hash);launch();};
     grid.after(back);
     grid.querySelector('[data-path="open"]').onclick=()=>{
       if(typeof window.openBookingFor!=="function"){alert("Le formulaire est indisponible. Réactualisez la page.");return;}
       close();window.openBookingFor(null,"Demande ouverte — "+label,params.get("port")||"",selected,"","provider");
     };
     grid.querySelector('[data-path="profiles"]').onclick=()=>{
       if(typeof showProviderResults!=="function"||typeof openModal!=="function"){alert("La liste des professionnels est indisponible.");return;}
       close();showProviderResults(selected);openModal("providerModal");
     };
   };
   grid.querySelectorAll("[data-activity]").forEach(b=>b.onclick=()=>chooseCategory(b.dataset.activity,b.textContent.trim()));
   document.body.appendChild(layer);
   window.snServiceChoiceBack=(selected,label)=>{if(document.getElementById("snServiceChooser"))return; const url=new URL(location.href);url.searchParams.set("activity","service");history.replaceState(null,"",url.pathname+url.search+url.hash);launch();setTimeout(()=>{const item=document.querySelector("#snServiceChooser [data-activity=\""+selected+"\"]");if(item)item.click();},180);};
 };
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(kick,100),{once:true});else setTimeout(kick,100);
}
launch();
})();