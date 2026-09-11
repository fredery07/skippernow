(function(){
  "use strict";
  const home = location.pathname === "/" || location.pathname === "/index.html";
  if(!home || window.__skippernowHomeLayoutV1) return;
  window.__skippernowHomeLayoutV1 = true;

  function install(){
    const providers = document.querySelector("#homeProvidersSection");
    if(!providers || document.querySelector("[data-sn-partners-slot]")) return;

    const slot = document.createComment("sn-partners-slot");
    slot.__snPartnersSlot = true;
    providers.parentNode.insertBefore(slot, providers);
    providers.remove();

    const movePartners = () => {
      const section = document.querySelector("[data-sn-partners]");
      if(!section || !slot.parentNode) return false;
      slot.parentNode.insertBefore(section, slot.nextSibling);
      section.style.marginTop = "36px";
      section.style.marginBottom = "8px";
      return true;
    };

    if(movePartners()) return;
    const observer = new MutationObserver(() => {
      if(movePartners()) observer.disconnect();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),15000);
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, {once:true});
  else install();
})();
