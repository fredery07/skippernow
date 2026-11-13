"use strict";
(function(){
  function init(){
    const button=document.getElementById("snAdvantageOwnerBtn");
    if(!button)return;
    button.addEventListener("click",function(){
      const ownerButton=document.querySelector('#join button[data-role="owner"]');
      if(ownerButton){ownerButton.click();return;}
      document.getElementById("join")?.scrollIntoView({behavior:"smooth",block:"start"});
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();