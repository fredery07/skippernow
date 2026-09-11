(function(){
  "use strict";
  const home = location.pathname === "/" || location.pathname === "/index.html";
  if(!home || window.__skippernowHomeLayoutV1) return;
  window.__skippernowHomeLayoutV1 = true;

  // Hide the legacy verified-professionals showcase immediately, even if the
  // homepage renderer recreates it later.
  const style = document.createElement("style");
  style.id = "snHomeLayoutStyle";
  style.textContent = `#homeProvidersSection,.home-pros#homeProvidersSection{display:none!important}`;
  document.head.appendChild(style);

  let marker = null;

  function ensureMarker(){
    const providers = document.querySelector("#homeProvidersSection");
    if(providers){
      if(!marker || !marker.isConnected){
        marker = document.createElement("span");
        marker.dataset.snPartnersSlot = "1";
        marker.style.display = "none";
        providers.parentNode?.insertBefore(marker, providers);
      }
      providers.remove();
      return;
    }

    // Fallback position: immediately before the destinations block.
    if(!marker || !marker.isConnected){
      const destinations = [...document.querySelectorAll("section,.tile-browse")].find(el =>
        /Nos destinations phares/i.test(el.textContent || "") || el.classList?.contains("tile-browse")
      );
      if(destinations?.parentNode){
        marker = document.createElement("span");
        marker.dataset.snPartnersSlot = "1";
        marker.style.display = "none";
        destinations.parentNode.insertBefore(marker, destinations);
      }
    }
  }

  function movePartners(){
    const section = document.querySelector("[data-sn-partners]");
    if(!section || !marker?.parentNode) return;
    marker.parentNode.insertBefore(section, marker.nextSibling);
    section.style.marginTop = "36px";
    section.style.marginBottom = "8px";
  }

  function sync(){
    ensureMarker();
    movePartners();
  }

  sync();
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once:true});

  // The homepage content is partly rendered asynchronously. Keep enforcing the
  // layout so the old provider block cannot reappear after a data refresh.
  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
