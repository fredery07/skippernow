(function(){
  "use strict";

  const SUPABASE_URL = "https://pzvlarwsfvhenrniepkw.supabase.co";
  const SUPABASE_KEY = "sb_publishable_OxikOn1mhDcxkAVAucN5Lg_za-bJMS5";
  const VISITOR_KEY = "skippernow-visitor-id";

  function makeVisitorId(){
    if(window.crypto && typeof window.crypto.randomUUID === "function"){
      return window.crypto.randomUUID();
    }
    return "sn-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function getVisitorId(){
    try{
      let visitorId = window.localStorage.getItem(VISITOR_KEY);
      if(!visitorId){
        visitorId = makeVisitorId();
        window.localStorage.setItem(VISITOR_KEY, visitorId);
      }
      return visitorId;
    }catch(_error){
      return makeVisitorId();
    }
  }

  const path = location.pathname || "/";
  const referrer = document.referrer && !document.referrer.startsWith(location.origin)
    ? document.referrer.slice(0, 500)
    : null;

  fetch(SUPABASE_URL + "/rest/v1/rpc/record_page_visit", {
    method: "POST",
    keepalive: true,
    headers: {
      "apikey": SUPABASE_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      p_visitor_id: getVisitorId(),
      p_path: path.slice(0, 500),
      p_referrer: referrer
    })
  }).catch(function(error){
    console.warn("SkipperNow analytics:", error);
  });
})();
