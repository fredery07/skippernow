(function(){
  "use strict";

  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const isIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
  const isStandalone=()=>window.matchMedia?.('(display-mode: standalone)').matches===true||navigator.standalone===true;
  function vapidKey(){return typeof VAPID_PUBLIC_KEY!=="undefined"?VAPID_PUBLIC_KEY:window.VAPID_PUBLIC_KEY;}
  function b64(s){const p="=".repeat((4-s.length%4)%4),v=(s+p).replace(/-/g,"+").replace(/_/g,"/");const raw=atob(v);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));}
  async function session(){const{data:{session}}=await db.auth.getSession();return session;}
  async function profile(){if(window.currentProfile)return window.currentProfile;if(!currentUser)return null;const{data}=await db.from("profiles").select("role,suspended").eq("id",currentUser.id).single();return data;}
  async function supported(){return !!("Notification" in window&&"serviceWorker" in navigator&&"PushManager" in window);}
  async function registration(){return navigator.serviceWorker.register("/sw.js",{scope:"/"});}
  async function currentSubscription(){if(!await supported())return null;const reg=await registration();return reg.pushManager.getSubscription();}
  async function persist(sub){if(!currentUser||!sub)return false;const json=sub.toJSON();if(!json.endpoint||!json.keys?.p256dh||!json.keys?.auth)throw new Error("Abonnement push incomplet");const{error}=await db.from("push_subscriptions").upsert({user_id:currentUser.id,endpoint:json.endpoint,p256dh:json.keys.p256dh,auth:json.keys.auth},{onConflict:"endpoint"});if(error)throw error;localStorage.setItem("skippernow-push-enabled","1");return true;}
  async function activate(){
    if(!await supported())throw new Error(isIOS()&&!isStandalone()?"Sur iPhone, ajoutez d’abord SkipperNow à l’écran d’accueil puis ouvrez-le depuis l’icône pour activer les notifications.":"Les notifications push ne sont pas prises en charge sur cet appareil.");
    if(!currentUser)throw new Error("Reconnectez-vous pour continuer.");
    const permission=await Notification.requestPermission();
    if(permission!=="granted")throw new Error(permission==="denied"?"Les notifications sont bloquées dans les réglages du navigateur.":"Autorisation de notification non accordée.");
    const reg=await registration();
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(vapidKey())});
    await persist(sub);return sub;
  }
  async function syncGranted(){try{if(!currentUser||!await supported()||Notification.permission!=="granted")return false;let sub=await currentSubscription();if(!sub){const reg=await registration();sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(vapidKey())});}return persist(sub);}catch(e){console.warn("push sync",e);return false;}}
  async function testPush(){const s=await session();if(!s)throw new Error("Reconnectez-vous pour continuer.");const r=await fetch(SUPABASE_URL+"/functions/v1/push-self-test",{method:"POST",headers:{Authorization:"Bearer "+s.access_token,apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:"{}"});const b=await r.json();if(!r.ok||b.error)throw new Error(b.error||"Test impossible");if(!b.sent)throw new Error("Aucun appareil actif n’a reçu le test. Réactivez les notifications puis réessayez.");return b;}
  async function state(){
    const okSupport=await supported();
    if(!okSupport)return{kind:"unsupported",label:isIOS()&&!isStandalone()?"Installation requise sur iPhone":"Non compatible",detail:isIOS()&&!isStandalone()?"Ajoutez SkipperNow à l’écran d’accueil, ouvrez l’app depuis l’icône puis activez les notifications.":"Cet appareil ne prend pas en charge les notifications Web Push."};
    const permission=Notification.permission;
    if(permission==="denied")return{kind:"blocked",label:"Notifications bloquées",detail:"Autorisez les notifications pour SkipperNow dans les réglages de votre navigateur ou de votre téléphone."};
    const sub=permission==="granted"?await currentSubscription():null;
    if(permission==="granted"&&sub)return{kind:"active",label:"Notifications actives",detail:"Cet appareil est abonné. Vous pouvez envoyer un test pour vérifier la réception."};
    return{kind:"inactive",label:"Notifications désactivées",detail:"Activez-les pour recevoir immédiatement les nouvelles missions et demandes."};
  }
  async function render(){
    const body=document.querySelector("#dashboardBody");if(!body)return;
    const st=await state();
    const icon=st.kind==="active"?"✅":st.kind==="blocked"?"⛔":"🔔";
    const canActivate=["inactive","unsupported"].includes(st.kind);
    body.innerHTML=`<div class="panel-head"><div><h3>Notifications</h3><p class="muted">Recevez immédiatement les nouvelles missions, demandes et messages importants.</p></div></div><div class="request-card" style="max-width:680px"><div style="font-size:34px;margin-bottom:8px">${icon}</div><h3 style="margin:0 0 6px">${esc(st.label)}</h3><p class="muted" style="line-height:1.55">${esc(st.detail)}</p><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">${canActivate?`<button class="small-btn fill" type="button" data-push-activate>Activer les notifications</button>`:""}${st.kind==="active"?`<button class="small-btn fill" type="button" data-push-test>Envoyer une notification test</button><button class="small-btn" type="button" data-push-sync>Resynchroniser cet appareil</button>`:""}</div><p class="muted" data-push-message style="margin-top:12px"></p></div><div class="note-box" style="max-width:680px;margin-top:12px"><strong>Conseil</strong><br>Activez les notifications sur chaque téléphone, tablette ou ordinateur que vous utilisez pour SkipperNow. Chaque appareil possède son propre abonnement.</div>`;
    const msg=body.querySelector("[data-push-message]");
    body.querySelector("[data-push-activate]")?.addEventListener("click",async e=>{const b=e.currentTarget;b.disabled=true;msg.textContent="Activation…";try{await activate();msg.textContent="Notifications activées sur cet appareil.";setTimeout(render,500);}catch(err){msg.textContent=err.message||String(err);b.disabled=false;}});
    body.querySelector("[data-push-sync]")?.addEventListener("click",async e=>{const b=e.currentTarget;b.disabled=true;msg.textContent="Synchronisation…";try{const ok=await syncGranted();msg.textContent=ok?"Appareil resynchronisé.":"Impossible de resynchroniser cet appareil.";}catch(err){msg.textContent=err.message||String(err);}finally{b.disabled=false;}});
    body.querySelector("[data-push-test]")?.addEventListener("click",async e=>{const b=e.currentTarget;b.disabled=true;msg.textContent="Envoi du test…";try{const r=await testPush();msg.textContent=`Test envoyé à ${r.sent} appareil${r.sent>1?"s":""}.`;}catch(err){msg.textContent=err.message||String(err);}finally{b.disabled=false;}});
  }
  async function install(){
    if(!currentUser)return;
    const p=await profile();if(!p||p.suspended||!["skipper","provider"].includes(p.role))return;
    const side=document.querySelector(".dash-side");if(!side||side.querySelector("[data-panel='pro-notifications']"))return;
    const btn=document.createElement("button");btn.type="button";btn.dataset.panel="pro-notifications";btn.innerHTML="🔔 <span>Notifications</span>";btn.onclick=async()=>{side.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===btn));await render();};side.appendChild(btn);
    await syncGranted();
  }
  const old=window.openDashboard;if(typeof old==="function")window.openDashboard=async function(){const r=await old.apply(this,arguments);setTimeout(install,0);return r;};
  setTimeout(install,600);
  const q=new URLSearchParams(location.search);if(q.get("dashboard")==="notifications")setTimeout(()=>{window.openDashboard?.();setTimeout(()=>document.querySelector("[data-panel='pro-notifications']")?.click(),800);},900);
  window.skPush={activate,syncGranted,testPush,state};
})();
