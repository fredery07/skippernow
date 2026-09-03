(function(){
  "use strict";

  try{
    const SUPABASE_URL = "https://pzvlarwsfvhenrniepkw.supabase.co";
    const SUPABASE_KEY = "sb_publishable_OxikOn1mhDcxkAVAucN5Lg_za-bJMS5";
    const VISITOR_KEY = "skippernow-visitor-id";
    const SENT_FLAG = "__skippernowAnalyticsSent";

    if(window[SENT_FLAG]) return;
    window[SENT_FLAG] = true;

    const EXCLUDED_PATH_PATTERNS = [
      /^\/google[a-f0-9]+\.html$/i,
      /^\/index\s?\([0-9]+\)\.html$/i,
      /^\/index-formulaire-simple\.html$/i,
      /^\/index-services\.html$/i,
      /^\/archive\//i
    ];

    const path = location.pathname || "/";
    const decodedPath = (function(){
      try{ return decodeURIComponent(path); }catch(_e){ return path; }
    })();
    if(EXCLUDED_PATH_PATTERNS.some(function(re){ return re.test(decodedPath); })){
      return;
    }

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
    }).then(function(response){
      if(!response.ok){
        console.warn("SkipperNow analytics: HTTP " + response.status);
      }
    }).catch(function(error){
      console.warn("SkipperNow analytics:", error);
    });
  }catch(error){
    try{ console.warn("SkipperNow analytics:", error); }catch(_e){}
  }
})();
