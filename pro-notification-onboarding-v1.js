(function(){
  "use strict";

  const MAX_NEW_PROFILE_AGE_MS = 48 * 60 * 60 * 1000;
  const REMIND_AFTER_MS = 24 * 60 * 60 * 1000;
  const sleep = ms => new Promise(r=>setTimeout(r,ms));

  function userId(){ return (typeof currentUser!=="undefined" && currentUser?.id) || window.currentUser?.id || null; }
  function reminderKey(id){ return `skippernow-push-onboarding-remind-${id}`; }
  function modalId(){ return "snPushOnboarding"; }

  async function getProfessional(){
    const id=userId(); if(!id || typeof db==="undefined") return null;
    const {data,error}=await db.from("profiles").select("id,role,suspended,created_at").eq("id",id).maybeSingle();
    if(error || !data || data.suspended || !["skipper","provider"].includes(data.role)) return null;
    return data;
  }

  function isNewProfile(p){
    const created=new Date(p?.created_at||0).getTime();
    return Number.isFinite(created) && created>0 && Date.now()-created <= MAX_NEW_PROFILE_AGE_MS;
  }

  function dismissedRecently(id){
    const t=Number(localStorage.getItem(reminderKey(id))||0);
    return t && Date.now()-t < REMIND_AFTER_MS;
  }

  function closeModal(){ document.getElementById(modalId())?.remove(); }

  function showBanner(){
    if(document.querySelector("[data-sn-push-reminder]")) return;
    const dash=document.querySelector("#dashboardBody") || document.querySelector("#dashMain");
    if(!dash) return;
    const bar=document.createElement("div");
    bar.dataset.snPushReminder="1";
    bar.className="note-box";
    bar.style.cssText="margin-bottom:14px;border:1px solid #f0d79b;background:#fff8e8";
    bar.innerHTML=`<strong>🔔 Activez les notifications</strong><br><span>Pour ne pas manquer les missions express et nouvelles demandes, activez les notifications sur cet appareil.</span> <button type="button" class="small-btn fill" data-sn-open-push style="margin-left:8px">Activer</button>`;
    bar.querySelector("[data-sn-open-push]")?.addEventListener("click",()=>showModal(false));
    dash.prepend(bar);
  }

  async function showModal(forceNew){
    if(document.getElementById(modalId())) return;
    const p=await getProfessional(); if(!p || !window.skPush) return;
    const st=await window.skPush.state();
    if(st.kind==="active") { document.querySelector("[data-sn-push-reminder]")?.remove(); return; }

    const overlay=document.createElement("div");
    overlay.id=modalId();
    overlay.style.cssText="position:fixed;inset:0;z-index:9999;background:rgba(7,29,50,.62);display:grid;place-items:center;padding:20px";
    const fresh = forceNew || isNewProfile(p);
    overlay.innerHTML=`<div style="width:min(520px,100%);background:#fff;border-radius:22px;padding:26px;box-shadow:0 24px 70px rgba(0,0,0,.28)">
      <div style="font-size:40px;margin-bottom:8px">🔔</div>
      <h2 style="margin:0 0 10px;color:var(--navy)">${fresh?"Dernière étape : activez les notifications":"Ne manquez aucune mission"}</h2>
      <p style="line-height:1.6;color:var(--muted);margin:0 0 16px">Les nouvelles missions express peuvent être prises très vite. Activez les notifications pour être prévenu immédiatement sur cet appareil.</p>
      <div class="note-box" style="margin-bottom:16px"><strong>${st.label}</strong><br>${st.detail}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button type="button" class="small-btn fill" data-sn-push-now>Activer maintenant</button>
        <button type="button" class="small-btn" data-sn-push-later>Plus tard</button>
      </div>
      <p class="muted" data-sn-push-msg style="margin:12px 0 0;font-size:12px"></p>
    </div>`;
    document.body.appendChild(overlay);
    const msg=overlay.querySelector("[data-sn-push-msg]");
    overlay.querySelector("[data-sn-push-now]")?.addEventListener("click",async e=>{
      const b=e.currentTarget; b.disabled=true; msg.textContent="Activation…";
      try{
        await window.skPush.activate();
        localStorage.removeItem(reminderKey(p.id));
        msg.textContent="Notifications activées ✅";
        document.querySelector("[data-sn-push-reminder]")?.remove();
        setTimeout(closeModal,500);
      }catch(err){ msg.textContent=err?.message||String(err); b.disabled=false; }
    });
    overlay.querySelector("[data-sn-push-later]")?.addEventListener("click",()=>{
      localStorage.setItem(reminderKey(p.id),String(Date.now()));
      closeModal();
      showBanner();
    });
  }

  async function run(){
    for(let i=0;i<20;i++){
      if(userId() && window.skPush && typeof db!=="undefined") break;
      await sleep(300);
    }
    const p=await getProfessional(); if(!p || !window.skPush) return;
    const st=await window.skPush.state();
    if(st.kind==="active") return;
    showBanner();
    if(isNewProfile(p) && !dismissedRecently(p.id)) showModal(true);
  }

  const old=window.openDashboard;
  if(typeof old==="function" && !window.__snPushOnboardingDashboardHook){
    window.__snPushOnboardingDashboardHook=true;
    window.openDashboard=async function(){const r=await old.apply(this,arguments);setTimeout(run,250);return r;};
  }

  if(!window.__skippernowLiveTrackingV1){
    window.__skippernowLiveTrackingV1=true;
    const s=document.createElement("script");
    s.src="/skipper-live-tracking-v1.js";
    s.defer=true;
    document.head.appendChild(s);
  }

  setTimeout(run,1200);
})();
