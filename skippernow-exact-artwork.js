(function(){
"use strict";
// Display the EXACT supplied approved artwork, not replacement stock imagery.
// If its binary asset has not been uploaded yet, preserve the existing functional homepage.
const asset="/skippernow-maquette.png";
const hotspots=[
 ["Louer un bateau",7.5,27.2,27,8.2,()=>document.getElementById("heroBoats")?.click()],
 ["Réserver un skipper",35.5,27.2,26.4,8.2,()=>document.getElementById("heroSkipper")?.click()],
 ["Demander une prestation",62.5,27.2,28.3,8.2,()=>document.getElementById("heroProviders")?.click()],
 ["Côte d’Azur",20.4,36.4,10.4,4,()=>document.querySelector('[data-zone="cote-azur"]')?.click()],
 ["Espagne",31.2,36.4,9.1,4,()=>document.querySelector('[data-zone="espagne"]')?.click()],
 ["Floride",41.2,36.4,8,4,()=>document.querySelector('[data-zone="floride"]')?.click()],
 ["Caraïbes",50.6,36.4,9.5,4,()=>document.querySelector('[data-zone="caraibes"]')?.click()],
 ["Italie",61,36.4,8.3,4,()=>document.querySelector('[data-zone="italie"]')?.click()],
 ["Croatie",69.3,36.4,9.2,4,()=>document.querySelector('[data-zone="croatie"]')?.click()],
 ["Voir les professionnels",80,75,16,5,()=>document.getElementById("viewAllProvidersBtn")?.click()],
 ["Louer un bateau — navigation",27,0,10,5,()=>document.getElementById("heroBoats")?.click()],
 ["Réserver un skipper — navigation",38,0,11,5,()=>document.getElementById("heroSkipper")?.click()],
 ["Services nautiques — navigation",50,0,11,5,()=>document.getElementById("heroProviders")?.click()],
 ["Comment ça marche — navigation",62,0,13,5,()=>document.querySelector(".sn-new-how")?.scrollIntoView({behavior:"smooth"})]
];
function mount(){
 if(document.querySelector(".sn-artwork-surface"))return;
 const hero=document.querySelector(".hero");
 if(!hero)return;
 const probe=new Image();
 probe.onload=()=>{
  const surface=document.createElement("section");surface.className="sn-artwork-surface";
  surface.setAttribute("aria-label","Accueil SkipperNow");
  const photo=document.createElement("img");photo.src=asset;photo.alt="Accueil SkipperNow : La mer commence ici";photo.decoding="async";surface.appendChild(photo);
  for(const [label,x,y,w,h,handler] of hotspots){
   const b=document.createElement("button");b.type="button";b.setAttribute("aria-label",label);
   b.className="sn-artwork-hotspot";b.style.cssText=`left:${x}%;top:${y}%;width:${w}%;height:${h}%`;
   b.onclick=handler;surface.appendChild(b);
  }
  hero.before(surface);
  document.body.classList.add("sn-artwork-active");
 };
 probe.onerror=()=>console.info("Approved SkipperNow illustration not yet available; original homepage retained.");
 probe.src=asset;
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})();