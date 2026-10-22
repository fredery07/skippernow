(function(){
"use strict";
function init(){
  const main=document.querySelector("main.shell");
  const search=document.querySelector(".search-wrap.shell");
  const featured=main?.querySelector(".rental-hub");
  // Keep working search controls, but present the storytelling and real featured listings first.
  if(main&&search&&featured){featured.after(search);search.classList.add("sn-relocated-search");}
  document.querySelectorAll("[data-sn-nav]").forEach(button=>button.addEventListener("click",()=>{
    switch(button.dataset.snNav){
      case "boats":document.getElementById("heroBoats")?.click();break;
      case "skippers":document.getElementById("heroSkipper")?.click();break;
      case "services":document.getElementById("heroProviders")?.click();break;
      case "how":document.querySelector(".sn-new-how")?.scrollIntoView({behavior:"smooth",block:"start"});break;
    }
  }));
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();