(function(){
  "use strict";

  let selectedBoatId = null;
  const moneyRental = cents => new Intl.NumberFormat(document.documentElement.lang || "fr", {style:"currency", currency:"EUR"}).format(Number(cents||0)/100);
  const escRental = value => String(value ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function rentalLabel(status){
    const fr={pending:"En attente du propriétaire",accepted:"Acceptée — paiement à effectuer",declined:"Refusée",cancelled:"Annulée",confirmed:"Confirmée",in_progress:"En cours",completed:"Terminée"};
    return fr[status] || status;
  }

  async function rentalPaymentCall(body){
    const {data:{session}}=await db.auth.getSession();
    if(!session) throw new Error("Reconnectez-vous pour continuer.");
    const res=await fetch(SUPABASE_URL+"/functions/v1/boat-rental-payment",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token,apikey:SUPABASE_KEY},body:JSON.stringify(body)});
    const json=await res.json();
    if(!res.ok) throw new Error(json.error||"Paiement indisponible");
    return json;
  }

  async function payRental(requestId){
    const stripe=window.Stripe ? window.Stripe(STRIPE_PUBLISHABLE_KEY) : null;
    if(!stripe){ alert("Paiement indisponible."); return; }
    const modal=document.createElement("div");
    modal.className="modal show";
    modal.style.zIndex="2500";
    modal.innerHTML=`<div class="dialog"><div class="dialog-top"><div><small>PAIEMENT SÉCURISÉ</small><h2>Payer la location</h2></div><button class="close" type="button">×</button></div><div id="snRentalPaymentElement"></div><p class="error-text" id="snRentalPaymentMsg"></p><button class="primary wide" id="snRentalPayBtn" type="button" style="margin-top:14px;display:none">Payer</button></div>`;
    document.body.appendChild(modal);
    modal.querySelector(".close").onclick=()=>modal.remove();
    const msg=modal.querySelector("#snRentalPaymentMsg");
    try{
      const init=await rentalPaymentCall({action:"create",requestId});
      if(init.paid){ modal.remove(); await renderRentalPanel(); return; }
      const elements=stripe.elements({clientSecret:init.client_secret});
      elements.create("payment").mount("#snRentalPaymentElement");
      const btn=modal.querySelector("#snRentalPayBtn"); btn.style.display="block";
      btn.onclick=async()=>{
        btn.disabled=true; msg.textContent="";
        try{
          const {error,paymentIntent}=await stripe.confirmPayment({elements,confirmParams:{return_url:location.origin+"/"},redirect:"if_required"});
          if(error) throw error;
          const done=await rentalPaymentCall({action:"confirm",requestId,paymentIntentId:paymentIntent?.id});
          if(!done.ok) throw new Error("Paiement en cours de confirmation.");
          modal.remove(); await renderRentalPanel();
        }catch(e){msg.textContent=e.message||String(e);}
        finally{btn.disabled=false;}
      };
    }catch(e){msg.textContent=e.message||String(e);}
  }

  async function renderRentalPanel(){
    const body=document.querySelector("#dashboardBody");
    if(!body || !currentUser) return;
    const {data,error}=await db.from("boat_rental_requests")
      .select("id,boat_id,renter_id,owner_id,starts_at,ends_at,duration_type,guest_count,wants_skipper,notes,amount_cents,status,payment_status,created_at,boats(name,brand,model,home_port,photo_url)")
      .order("created_at",{ascending:false});
    if(error){ body.innerHTML=`<div class="empty-note">${escRental(friendlyError(error))}</div>`; return; }
    const rows=data||[];
    body.innerHTML=`<div class="panel-head"><div><h3>Locations de bateaux</h3><p class="muted">Vos demandes envoyées et les demandes reçues pour vos bateaux.</p></div></div>
      <div class="request-list">${rows.length?rows.map(r=>{
        const b=r.boats||{};
        const isOwner=String(r.owner_id)===String(currentUser.id);
        const title=[b.brand,b.model].filter(Boolean).join(" ") || b.name || "Bateau";
        const date=new Date(r.starts_at).toLocaleDateString(document.documentElement.lang||"fr-FR");
        let actions="";
        if(isOwner && r.status==="pending") actions=`<button class="small-btn fill" data-rental-action="accept" data-id="${r.id}">Accepter</button> <button class="small-btn" data-rental-action="decline" data-id="${r.id}">Refuser</button>`;
        if(!isOwner && ["pending","accepted"].includes(r.status) && r.payment_status==="unpaid") actions+=` <button class="small-btn" data-rental-action="cancel" data-id="${r.id}">Annuler</button>`;
        if(!isOwner && r.status==="accepted" && r.payment_status==="unpaid") actions+=` <button class="small-btn fill" data-rental-pay="${r.id}">Payer ${moneyRental(r.amount_cents)}</button>`;
        return `<article class="request-card"><div style="display:flex;gap:12px;align-items:flex-start">${b.photo_url?`<img src="${escRental(b.photo_url)}" alt="" style="width:92px;height:72px;object-fit:cover;border-radius:12px">`:""}<div style="flex:1"><strong>${escRental(title)}</strong><div class="muted">📍 ${escRental(b.home_port||"—")} · ${escRental(date)}</div><div style="margin-top:6px"><span class="tag">${escRental(rentalLabel(r.status))}</span> <strong>${moneyRental(r.amount_cents)}</strong>${r.wants_skipper?` <span class="tag">Skipper demandé</span>`:""}</div>${r.notes?`<p class="muted">${escRental(r.notes)}</p>`:""}<div style="margin-top:10px">${actions}</div></div></div></article>`;
      }).join(""):`<div class="empty-note">Aucune demande de location pour le moment.</div>`}</div>`;

    body.querySelectorAll("[data-rental-action]").forEach(btn=>btn.addEventListener("click",async()=>{
      btn.disabled=true;
      const action=btn.dataset.rentalAction;
      const next=action==="accept"?"accepted":action==="decline"?"declined":"cancelled";
      const {error}=await db.from("boat_rental_requests").update({status:next}).eq("id",btn.dataset.id);
      if(error) alert(friendlyError(error));
      await renderRentalPanel();
    }));
    body.querySelectorAll("[data-rental-pay]").forEach(btn=>btn.addEventListener("click",()=>payRental(btn.dataset.rentalPay)));
  }

  function installDashboardEntry(){
    const side=document.querySelector(".dash-side");
    if(!side || side.querySelector("[data-panel='boat-rentals']")) return;
    const btn=document.createElement("button");
    btn.type="button"; btn.dataset.panel="boat-rentals"; btn.innerHTML="🚤 <span>Locations bateaux</span>";
    btn.addEventListener("click",async()=>{side.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b===btn));await renderRentalPanel();});
    side.appendChild(btn);
  }

  function install(){
    if(typeof window.openBoatDetail==="function"){
      const originalBoatDetail=window.openBoatDetail;
      window.openBoatDetail=function(id){ selectedBoatId=String(id); return originalBoatDetail.apply(this,arguments); };
    }

    const submit=document.querySelector("#bookingSubmit");
    if(submit) submit.addEventListener("click",async function(ev){
      if(!bookingContext || bookingContext.activity!=="boat_rental") return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      const msg=document.querySelector("#bookingMessage");
      if(!currentUser){ msg.textContent=t("booking.needLogin"); return; }
      if(!selectedBoatId){ msg.textContent="Bateau introuvable. Fermez puis rouvrez l’annonce."; return; }
      if(String(bookingContext.targetId||"")===String(currentUser.id)){ msg.textContent=t("boatDetail.ownListing"); return; }
      const date=document.querySelector("#bookingDate").value;
      const duration=document.querySelector("#bookingDuration").value;
      const days=duration==="multi"?Math.max(2,Math.round(Number(document.querySelector("#bookingDays").value||2))):1;
      if(!date || date<localDateStr()){ msg.textContent=t(date?"booking.needFutureDate":"booking.needDate"); return; }
      const start=new Date(date+"T09:00:00"); const hours=duration==="half"?4:duration==="day"?8:days*24; const end=new Date(start.getTime()+hours*3600000);
      const notes=sanitizeContactInfo(document.querySelector("#bookingDetails").value.trim());
      msg.textContent=t("booking.sending"); submit.disabled=true;
      const {error}=await db.from("boat_rental_requests").insert({boat_id:selectedBoatId,renter_id:currentUser.id,starts_at:start.toISOString(),ends_at:end.toISOString(),duration_type:duration,wants_skipper:false,notes:notes||null});
      submit.disabled=false;
      if(error){ msg.style.color="#b42318"; msg.textContent=friendlyError(error); return; }
      if(typeof window.skTrackEvent==="function") window.skTrackEvent("boat_rental_created",{boat_id:selectedBoatId,duration});
      document.querySelector("#bookingForm").style.display="none"; document.querySelector("#bookingSuccess").style.display="block";
    },true);

    const originalOpenDashboard=window.openDashboard;
    if(typeof originalOpenDashboard==="function") window.openDashboard=async function(){const result=await originalOpenDashboard.apply(this,arguments);installDashboardEntry();return result;};
    setTimeout(installDashboardEntry,500);
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",install,{once:true}); else install();
})();
