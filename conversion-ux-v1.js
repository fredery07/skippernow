(function(){
  "use strict";
  if(window.__skippernowConversionUxV1) return;
  window.__skippernowConversionUxV1 = true;

  const path = location.pathname || "/";
  const track = (name, meta) => {
    try{ if(typeof window.skTrackEvent === "function") window.skTrackEvent(name, meta || {}); }catch(_e){}
  };

  function activityFromHref(href){
    try{
      const u = new URL(href, location.origin);
      return u.searchParams.get("activity") || "";
    }catch(_e){ return ""; }
  }

  document.addEventListener("click", function(e){
    const el = e.target.closest && e.target.closest("a,button");
    if(!el) return;
    const text = (el.textContent || "").trim().toLowerCase();
    const href = el.getAttribute && el.getAttribute("href");
    if(href && (href.includes("activity=") || href.includes("port="))){
      track("cta_clicked", {source:"landing_cta",stage:"click",activity:activityFromHref(href)});
    }
    if(text.includes("inscri") || text.includes("créer un compte") || text.includes("creer un compte")){
      track("signup_started", {source:"site",stage:"click"});
    }
  }, true);

  const landing = /\/(skipper-|location-bateau-|boat-rental-|alquiler-barcos-)/i.test(path);
  if(!landing) return;

  function getConfig(){
    const slug = path.split("/").filter(Boolean)[0] || "";
    const city = slug
      .replace(/^skipper-/i,"")
      .replace(/^location-bateau-/i,"")
      .replace(/^boat-rental-/i,"")
      .replace(/^alquiler-barcos-/i,"")
      .split("-").map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(" ");
    const isSkipper = /^skipper-/i.test(slug);
    const activity = isSkipper ? "skipper" : "boat_rental";
    const label = isSkipper ? "Voir les skippers disponibles" : "Voir les bateaux disponibles";
    const sub = isSkipper ? "Demande gratuite · profils vérifiés · paiement sécurisé" : "Disponibilités · réservation sécurisée · réponse rapide";
    return {city,activity,label,sub};
  }

  function installSticky(){
    if(document.querySelector("[data-sn-conversion-bar]")) return;
    const cfg = getConfig();
    const href = "/?port=" + encodeURIComponent(cfg.city) + "&activity=" + encodeURIComponent(cfg.activity) + "&source=seo_cta";
    const bar = document.createElement("div");
    bar.dataset.snConversionBar = "1";
    bar.setAttribute("role","region");
    bar.setAttribute("aria-label","Réservation SkipperNow");
    bar.innerHTML = '<div class="sn-conv-inner"><div class="sn-conv-copy"><strong>'+cfg.label+'</strong><span>'+cfg.sub+'</span></div><a class="sn-conv-btn" href="'+href+'">'+cfg.label+'</a></div>';
    const style = document.createElement("style");
    style.textContent = '.sn-conv-bar{position:fixed;left:0;right:0;bottom:0;z-index:2200;background:#071d32;color:#fff;border-top:1px solid rgba(255,255,255,.15);box-shadow:0 -8px 30px rgba(7,29,50,.18);padding:10px 16px}.sn-conv-inner{max-width:1080px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:16px}.sn-conv-copy{display:flex;flex-direction:column;line-height:1.25}.sn-conv-copy strong{font-size:14px}.sn-conv-copy span{font-size:12px;opacity:.82;margin-top:3px}.sn-conv-btn{display:inline-flex;align-items:center;justify-content:center;background:#39d1c5;color:#071d32!important;text-decoration:none!important;font-weight:900;border-radius:11px;padding:11px 16px;white-space:nowrap}@media(max-width:680px){body{padding-bottom:86px}.sn-conv-bar{padding:9px 10px}.sn-conv-inner{gap:10px}.sn-conv-copy span{font-size:11px}.sn-conv-copy strong{display:none}.sn-conv-btn{width:100%;padding:12px 14px}}';
    document.head.appendChild(style);
    bar.className = "sn-conv-bar";
    document.body.appendChild(bar);
    track("landing_cta_shown", {source:"seo",stage:"view",activity:cfg.activity});
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", installSticky, {once:true});
  else installSticky();
})();
