(function(){
  "use strict";

  const lang = () => (document.documentElement.lang || "fr").slice(0,2);
  const TEXT = {
    fr:{quoted:"En attente de l’acceptation du client",proposal:"Vous recevrez",payment:"Paiement en attente",waiting:"Montant net prévu pour vous. Le prix final client inclut les frais SkipperNow.",details:"Voir les détails",hide:"Masquer les détails",copy:"Copier mon lien",copied:"Lien copié !",confirmed:"Payée – Mission confirmée"},
    en:{quoted:"Waiting for client approval",proposal:"You will receive",payment:"Payment pending",waiting:"Your expected net amount. The client's final price includes SkipperNow fees.",details:"View details",hide:"Hide details",copy:"Copy my link",copied:"Link copied!",confirmed:"Paid – Job confirmed"},
    es:{quoted:"Esperando la aceptación del cliente",proposal:"Recibirás",payment:"Pago pendiente",waiting:"Tu importe neto previsto. El precio final del cliente incluye las tarifas de SkipperNow.",details:"Ver los detalles",hide:"Ocultar los detalles",copy:"Copiar mi enlace",copied:"¡Enlace copiado!",confirmed:"Pagada – Misión confirmada"}
  };
  function tx(k){ const l=TEXT[lang()]?lang():"fr"; return TEXT[l][k] || TEXT.fr[k]; }
  function escHtml(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
  function formatMoney(cents){
    try{return new Intl.NumberFormat(lang()==="en"?"en-GB":lang()==="es"?"es-ES":"fr-FR",{style:"currency",currency:"EUR"}).format(Number(cents||0)/100);}catch(_e){return (Number(cents||0)/100).toFixed(2)+" €";}
  }

  if(typeof window.requestCard === "function" && !window.__skippernowRequestCardUx){
    const originalRequestCard = window.requestCard;
    window.requestCard = function(m, context, reviewedMissionIds){
      let html = originalRequestCard(m, context, reviewedMissionIds);
      if(context !== "pro") return html;

      const gross = Number(m.amount_cents||0) + Number(m.urgent_fee_cents||0);
      const inferredNet = Math.max(0,Number(m.amount_cents||0)-Number(m.platform_fee_cents||0));
      const proTotal = Number(m.professional_net_cents||inferredNet) + Number(m.urgent_fee_cents||0);
      const isQuoted = m.status === "quoted";
      const isPaid = ["paid","in_progress","awaiting_validation","completed"].includes(m.status) || ["paid","transferred","payout_ready"].includes(m.payment_status);
      const badgeText = isQuoted ? tx("quoted") : isPaid ? tx("confirmed") : null;
      if(badgeText){
        html = html.replace(/(<span class="status-pill[^>]*>)(.*?)(<\/span>)/, `$1${escHtml(badgeText)}$3`);
      }

      if(isQuoted && proTotal > 0){
        const info = `<div class="sn-quote-state" style="margin-top:12px;padding:12px 14px;border:1px solid #f0d79b;background:#fff8e8;border-radius:12px">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
            <strong style="color:var(--navy)">${escHtml(tx("proposal"))} : ${escHtml(formatMoney(proTotal))} net</strong>
            <span style="font-size:12px;font-weight:800;color:#8a5a00">${escHtml(tx("payment"))}</span>
          </div>
          <div class="muted" style="margin-top:5px;font-size:12.5px">${escHtml(tx("waiting"))}</div>
        </div>`;
        html = html.replace('<div class="request-actions">', info + '<div class="request-actions">');
      }

      const detailPayload = {
        port:m.port||"—",
        date:m.starts_at ? new Date(m.starts_at).toLocaleDateString() : "—",
        boat:m.boat_type||"—",
        description:m.description||"—",
        amount:proTotal?formatMoney(proTotal)+" net":"—"
      };
      const detailId = `sn-detail-${String(m.id).replace(/[^a-zA-Z0-9_-]/g,"")}`;
      const detailBtn = `<button class="small-btn sn-detail-toggle" type="button" data-sn-detail="${detailId}">${escHtml(tx("details"))}</button>`;
      const details = `<div id="${detailId}" class="sn-request-details" style="display:none;margin-top:10px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--mist);font-size:13px;line-height:1.6"><strong>${escHtml(detailPayload.port)}</strong> · ${escHtml(detailPayload.date)}<br>${escHtml(detailPayload.boat)} · ${escHtml(detailPayload.amount)}<br>${escHtml(detailPayload.description)}</div>`;
      html = html.replace('<div class="request-actions">', details + '<div class="request-actions">' + detailBtn);
      return html;
    };
    window.__skippernowRequestCardUx = true;
  }

  document.addEventListener("click", async function(e){
    const detailBtn = e.target.closest && e.target.closest(".sn-detail-toggle");
    if(detailBtn){
      const box = document.getElementById(detailBtn.dataset.snDetail);
      if(box){ const open = box.style.display !== "none"; box.style.display = open ? "none" : "block"; detailBtn.textContent = open ? tx("details") : tx("hide"); }
      return;
    }
    const copyBtn = e.target.closest && e.target.closest("[data-sn-copy-direct]");
    if(copyBtn){
      const url = copyBtn.dataset.snCopyDirect;
      try{await navigator.clipboard.writeText(url); copyBtn.textContent=tx("copied"); setTimeout(()=>copyBtn.textContent=tx("copy"),1600);}catch(_e){}
    }
  });

  function enhanceDirectLink(){
    document.querySelectorAll("#dashMain, #dashboardBody").forEach(root=>{
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(n=>{
        const text=(n.nodeValue||"").trim();
        if(!text.includes("?pro=")) return;
        const parent=n.parentElement; if(!parent || parent.querySelector?.("[data-sn-copy-direct]")) return;
        const m=text.match(/https?:\/\/[^\s]+\?pro=[a-zA-Z0-9-]+/); if(!m) return;
        const btn=document.createElement("button"); btn.type="button"; btn.className="small-btn fill"; btn.dataset.snCopyDirect=m[0]; btn.textContent=tx("copy"); btn.style.marginLeft="8px"; parent.appendChild(btn);
      });
    });
  }

  const observer = new MutationObserver(()=>enhanceDirectLink());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  enhanceDirectLink();

  if(!window.__skippernowBoatRentalV1){
    window.__skippernowBoatRentalV1 = true;
    const rental = document.createElement("script");
    rental.src = "/boat-rental-v1.js";
    rental.defer = true;
    document.head.appendChild(rental);
  }
  if(!window.__skippernowSkipperDispatchV1){
    window.__skippernowSkipperDispatchV1 = true;
    const dispatch = document.createElement("script");
    dispatch.src = "/skipper-dispatch-v1.js";
    dispatch.defer = true;
    document.head.appendChild(dispatch);
  }
  if(!window.__skippernowNetPricingV1){
    window.__skippernowNetPricingV1 = true;
    const pricing = document.createElement("script");
    pricing.src = "/net-pricing-v1.js";
    pricing.defer = true;
    document.head.appendChild(pricing);
  }
  if(!window.__skippernowAgencyDashboardV1){
    window.__skippernowAgencyDashboardV1 = true;
    const agency = document.createElement("script");
    agency.src = "/agency-dashboard-v1.js";
    agency.defer = true;
    document.head.appendChild(agency);
  }
  if(!window.__skippernowProviderDashboardV2){
    window.__skippernowProviderDashboardV2 = true;
    const provider = document.createElement("script");
    provider.src = "/provider-dashboard-v2.js";
    provider.defer = true;
    document.head.appendChild(provider);
  }
})();