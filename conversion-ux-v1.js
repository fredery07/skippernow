(function(){
  "use strict";
  if(window.__skippernowConversionUxV1) return;
  window.__skippernowConversionUxV1 = true;

  const path = location.pathname || "/";
  const track = (name, meta) => { try{ if(typeof window.skTrackEvent === "function") window.skTrackEvent(name, meta || {}); }catch(_e){} };

  function activityFromHref(href){
    try{ return new URL(href, location.origin).searchParams.get("activity") || ""; }
    catch(_e){ return ""; }
  }

  // If the user signs in from one of the home choice links, return to a clean
  // homepage instead of reopening the activity modal from the old query string.
  // INITIAL_SESSION is deliberately ignored so an already signed-in user can
  // still click a home choice and open the corresponding search normally.
  function installPostLoginCleanup(){
    try{
      if(typeof db === "undefined" || !db?.auth?.onAuthStateChange) return;
      db.auth.onAuthStateChange((event)=>{
        if(event !== "SIGNED_IN") return;
        const url = new URL(location.href);
        if(url.searchParams.get("source") !== "home_choice") return;
        if(sessionStorage.getItem("skippernow-quick-request")) return;
        location.replace("/");
      });
    }catch(_e){}
  }

  document.addEventListener("click", function(e){
    const el = e.target.closest && e.target.closest("a,button");
    if(!el) return;
    const text = (el.textContent || "").trim().toLowerCase();
    const href = el.getAttribute && el.getAttribute("href");
    if(href && (href.includes("activity=") || href.includes("port="))){
      track("cta_clicked", {source:el.dataset?.snSource || "landing_cta",stage:"click",activity:activityFromHref(href)});
    }
    if(text.includes("inscri") || text.includes("créer un compte") || text.includes("creer un compte")){
      track("signup_started", {source:"site",stage:"click"});
    }
  }, true);

  const home = path === "/" || path === "/index.html";
  const landing = /\/(skipper-|location-bateau-|boat-rental-|alquiler-barcos-)/i.test(path);

  function installHomeConversion(){
    if(!home || document.querySelector("[data-sn-home-conversion]")) return;
    const target = document.querySelector(".search-wrap") || document.querySelector("main") || document.body.firstElementChild;
    if(!target || !target.parentNode) return;

    const section = document.createElement("section");
    section.dataset.snHomeConversion = "1";
    section.className = "sn-home-choice-shell";
    section.innerHTML = `
      <div class="sn-home-choice">
        <div class="sn-home-choice-head">
          <span class="sn-home-kicker">Que recherchez-vous aujourd’hui ?</span>
          <h2>Choisissez, SkipperNow s’occupe du reste.</h2>
          <p>Accédez directement au bon parcours. La demande est gratuite et vous gardez le contrôle avant tout paiement.</p>
        </div>
        <div class="sn-home-choice-grid">
          <a class="sn-home-choice-card" data-sn-source="home_choice" href="/?activity=boat_rental&source=home_choice">
            <span class="sn-home-choice-icon">🛥️</span><strong>Louer un bateau</strong><small>Voir les bateaux et disponibilités</small><b>Voir les bateaux →</b>
          </a>
          <a class="sn-home-choice-card" data-sn-source="home_choice" href="/?activity=skipper&source=home_choice">
            <span class="sn-home-choice-icon">⚓</span><strong>Réserver un skipper</strong><small>Trouver un professionnel disponible</small><b>Voir les skippers →</b>
          </a>
          <a class="sn-home-choice-card" data-sn-source="home_choice" href="/?activity=service&source=home_choice">
            <span class="sn-home-choice-icon">🧰</span><strong>Demander une prestation</strong><small>Nettoyage, préparation, convoyage et services à quai</small><b>Déposer une demande →</b>
          </a>
        </div>
        <div class="sn-home-reassurance"><span>✓ Demande gratuite</span><span>✓ Professionnels vérifiés</span><span>✓ Paiement sécurisé</span><span>✓ Vous validez le prix avant de payer</span></div>
      </div>`;

    const style = document.createElement("style");
    style.textContent = `
      .sn-home-choice-shell{max-width:1180px;margin:22px auto 20px;padding:0 24px;position:relative;z-index:6}
      .sn-home-choice{background:#fff;border:1px solid #dce8e9;border-radius:24px;padding:24px;box-shadow:0 18px 55px rgba(7,29,50,.11)}
      .sn-home-choice-head{text-align:center;max-width:760px;margin:0 auto 18px}.sn-home-kicker{display:inline-block;color:#0d6672;font-weight:900;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
      .sn-home-choice-head h2{margin:7px 0 7px;color:#071d32;font-size:28px;line-height:1.2}.sn-home-choice-head p{margin:0;color:#506773;font-size:14px;line-height:1.5}
      .sn-home-choice-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.sn-home-choice-card{display:flex;flex-direction:column;min-height:165px;padding:18px;border:1px solid #dce8e9;border-radius:18px;text-decoration:none!important;color:#102b3f!important;background:#fff;transition:.18s}
      .sn-home-choice-card:hover{transform:translateY(-2px);border-color:#39d1c5;box-shadow:0 10px 24px rgba(16,43,63,.08)}.sn-home-choice-icon{font-size:26px}.sn-home-choice-card strong{margin-top:8px;font-size:17px;color:#071d32}.sn-home-choice-card small{margin-top:5px;color:#506773;line-height:1.4;flex:1}.sn-home-choice-card b{margin-top:14px;color:#0d6672;font-size:13px}
      .sn-home-reassurance{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:18px;padding-top:15px;border-top:1px solid #eef3f3;color:#506773;font-size:12.5px;font-weight:700}
      .search-wrap.sn-search-after-choice{margin-top:0!important;position:relative;z-index:5}
      .search-wrap.sn-search-after-choice .search-card{margin-top:0!important}
      @media(max-width:760px){.sn-home-choice-shell{padding:0 14px;margin:14px auto 16px}.sn-home-choice{padding:18px}.sn-home-choice-grid{grid-template-columns:1fr}.sn-home-choice-card{min-height:120px}.sn-home-choice-head h2{font-size:23px}.sn-home-reassurance{justify-content:flex-start;gap:9px 14px}.search-wrap.sn-search-after-choice{margin-top:0!important}}
    `;
    document.head.appendChild(style);
    if(target.classList && target.classList.contains("search-wrap")) target.classList.add("sn-search-after-choice");
    target.parentNode.insertBefore(section,target);
    track("landing_cta_shown", {source:"home_choice",stage:"view",activity:"multi"});
  }

  function getConfig(){
    const slug = path.split("/").filter(Boolean)[0] || "";
    const city = slug.replace(/^skipper-/i,"").replace(/^location-bateau-/i,"").replace(/^boat-rental-/i,"").replace(/^alquiler-barcos-/i,"").split("-").map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(" ");
    const isSkipper = /^skipper-/i.test(slug);
    const activity = isSkipper ? "skipper" : "boat_rental";
    const label = isSkipper ? "Voir les skippers disponibles" : "Voir les bateaux disponibles";
    const sub = isSkipper ? "Demande gratuite · profils vérifiés · paiement sécurisé" : "Disponibilités · réservation sécurisée · réponse rapide";
    return {city,activity,label,sub};
  }

  function installSticky(){
    if(!landing || document.querySelector("[data-sn-conversion-bar]")) return;
    const cfg = getConfig();
    const href = "/?port=" + encodeURIComponent(cfg.city) + "&activity=" + encodeURIComponent(cfg.activity) + "&source=seo_cta";
    const bar = document.createElement("div");
    bar.dataset.snConversionBar = "1";
    bar.setAttribute("role","region");
    bar.setAttribute("aria-label","Réservation SkipperNow");
    bar.innerHTML = '<div class="sn-conv-inner"><div class="sn-conv-copy"><strong>'+cfg.label+'</strong><span>'+cfg.sub+'</span></div><a class="sn-conv-btn" data-sn-source="seo_sticky" href="'+href+'">'+cfg.label+'</a></div>';
    const style = document.createElement("style");
    style.textContent = '.sn-conv-bar{position:fixed;left:0;right:0;bottom:0;z-index:2200;background:#071d32;color:#fff;border-top:1px solid rgba(255,255,255,.15);box-shadow:0 -8px 30px rgba(7,29,50,.18);padding:10px 16px}.sn-conv-inner{max-width:1080px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:16px}.sn-conv-copy{display:flex;flex-direction:column;line-height:1.25}.sn-conv-copy strong{font-size:14px}.sn-conv-copy span{font-size:12px;opacity:.82;margin-top:3px}.sn-conv-btn{display:inline-flex;align-items:center;justify-content:center;background:#39d1c5;color:#071d32!important;text-decoration:none!important;font-weight:900;border-radius:11px;padding:11px 16px;white-space:nowrap}@media(max-width:680px){body{padding-bottom:86px}.sn-conv-bar{padding:9px 10px}.sn-conv-inner{gap:10px}.sn-conv-copy span{font-size:11px}.sn-conv-copy strong{display:none}.sn-conv-btn{width:100%;padding:12px 14px}}';
    document.head.appendChild(style);
    bar.className = "sn-conv-bar";
    document.body.appendChild(bar);
    track("landing_cta_shown", {source:"seo",stage:"view",activity:cfg.activity});
  }

  function install(){
    installPostLoginCleanup();
    installHomeConversion();
    installSticky();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, {once:true});
  else install();
})();