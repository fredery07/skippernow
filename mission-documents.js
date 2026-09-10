/* Private payment receipts and provider-issued PDFs. No invoice is issued by SkipperNow. */
(()=>{
  let generation=0, owner=null;
  const labels={
    fr:{title:"Reçu et facture",loading:"Chargement…",receipt:"Reçu de paiement SkipperNow",getReceipt:"Afficher le reçu de paiement",print:"Imprimer / Enregistrer en PDF",provider:"Facture du prestataire",empty:"Le prestataire n’a pas encore déposé de facture.",upload:"Déposer un document",company:"Nom de l’entreprise émettrice",number:"Numéro du document",kind:"Type de document",invoice:"Facture",credit:"Avoir",file:"Document PDF · 8 Mo maximum",confirm:"Je confirme que ce document a été émis par mon entreprise pour cette mission et peut être partagé avec le client et SkipperNow.",save:"Déposer le PDF",saved:"Document enregistré et accessible au client et à SkipperNow.",download:"Télécharger",note:"Les documents précédents restent disponibles lorsqu’une correction ou un avoir est ajouté.",share:"Une même copie est accessible au client, au prestataire et à l’administration SkipperNow.",paid:"Montant payé",refund:"Montant remboursé",date:"Date du paiement",reference:"Référence du reçu",paymentReference:"Référence du paiement",mission:"Mission",legal:"Ce reçu atteste le paiement via SkipperNow. Il ne remplace pas la facture émise par le prestataire.",dispute:"Ce paiement fait l’objet d’une contestation.",pending:"Aucun paiement confirmé disponible.",retry:"Réessayer",error:"Opération indisponible. Réessayez.",saving:"Enregistrement…"},
    en:{title:"Receipt and invoice",loading:"Loading…",receipt:"SkipperNow payment receipt",getReceipt:"View payment receipt",print:"Print / Save as PDF",provider:"Provider invoice",empty:"The provider has not uploaded an invoice yet.",upload:"Upload a document",company:"Issuing business name",number:"Document number",kind:"Document type",invoice:"Invoice",credit:"Credit note",file:"PDF document · maximum 8 MB",confirm:"I confirm this document was issued by my business for this booking and may be shared with the client and SkipperNow.",save:"Upload PDF",saved:"Document saved and available to the client and SkipperNow.",download:"Download",note:"Previous documents remain available when a correction or credit note is added.",share:"The same copy is available to the client, provider and SkipperNow administrators.",paid:"Amount paid",refund:"Amount refunded",date:"Payment date",reference:"Receipt reference",paymentReference:"Payment reference",mission:"Booking",legal:"This receipt confirms payment through SkipperNow. It does not replace the provider’s invoice.",dispute:"This payment is disputed.",pending:"No confirmed payment available.",retry:"Retry",error:"Unavailable. Please try again.",saving:"Saving…"},
    es:{title:"Recibo y factura",loading:"Cargando…",receipt:"Recibo de pago SkipperNow",getReceipt:"Ver el recibo de pago",print:"Imprimir / Guardar PDF",provider:"Factura del profesional",empty:"El profesional todavía no ha subido la factura.",upload:"Subir un documento",company:"Nombre de la empresa emisora",number:"Número del documento",kind:"Tipo de documento",invoice:"Factura",credit:"Factura rectificativa",file:"Documento PDF · máximo 8 MB",confirm:"Confirmo que mi empresa ha emitido este documento para este servicio y que puede compartirse con el cliente y SkipperNow.",save:"Subir PDF",saved:"Documento guardado y disponible para el cliente y SkipperNow.",download:"Descargar",note:"Los documentos anteriores se conservan cuando se añade una corrección.",share:"La misma copia está disponible para el cliente, el profesional y la administración SkipperNow.",paid:"Importe pagado",refund:"Importe reembolsado",date:"Fecha del pago",reference:"Referencia del recibo",paymentReference:"Referencia del pago",mission:"Servicio",legal:"Este recibo acredita el pago a través de SkipperNow. No sustituye a la factura del profesional.",dispute:"Este pago está impugnado.",pending:"No hay un pago confirmado disponible.",retry:"Reintentar",error:"No disponible. Inténtalo de nuevo.",saving:"Guardando…"}
  };
  const L=()=>labels[currentLang]||labels.fr;
  const date=v=>v?new Date(v).toLocaleString(currentLang):"—";
  const amount=(c,currency)=>new Intl.NumberFormat(currentLang,{style:"currency",currency:currency.toUpperCase()}).format(c/100);
  async function request(action,missionId,extra={}){
    const {data:{session}}=await db.auth.getSession();
    if(!session)throw Error("Connectez-vous pour accéder aux documents.");
    const requestOwner=session.user.id, seq=generation;
    const form=extra instanceof FormData;
    const res=await fetch(SUPABASE_URL+"/functions/v1/mission-documents",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,apikey:SUPABASE_KEY,...(form?{}:{"Content-Type":"application/json"})},body:form?extra:JSON.stringify({action,missionId,...extra}),signal:AbortSignal.timeout(45000)});
    const body=await res.json();
    if(seq!==generation || owner!==requestOwner)throw Error("Session modifiée. Rouvrez vos documents.");
    if(!res.ok || body.error)throw Error(body.error||L().error);
    return body;
  }
  function receiptHtml(r){
    const l=L();
    return `<h2>${esc(l.receipt)}</h2><p><strong>SkipperNow</strong> · skippernow.fr</p><p>${esc(l.reference)} : ${esc(r.reference)}<br>${esc(l.date)} : ${esc(date(r.paidAt))}</p><p>${esc(l.mission)} : ${esc(r.missionId)}<br>${esc(r.port||"")} · ${esc(r.boat||"")}<br>${esc(r.description||"")}</p><hr><p><strong>${esc(l.paid)} : ${esc(amount(r.total,r.currency))}</strong></p>${r.refunded?`<p>${esc(l.refund)} : ${esc(amount(r.refunded,r.currency))}</p>`:""}${r.disputed?`<p>${esc(l.dispute)}</p>`:""}<p style="overflow-wrap:anywhere">${esc(l.paymentReference)} : ${esc(r.paymentReference)}</p><p>${esc(l.legal)}</p>`;
  }
  function printReceipt(html){
    document.querySelector("#receiptPrintFrame")?.remove();
    const frame=document.createElement("iframe");frame.id="receiptPrintFrame";frame.title=L().receipt;frame.style.cssText="position:fixed;width:1px;height:1px;left:-10000px;border:0";
    frame.onload=()=>{frame.contentWindow.focus();frame.contentWindow.print();};
    frame.srcdoc=`<!doctype html><html lang="${esc(currentLang)}"><head><meta charset="utf-8"><title>${esc(L().receipt)}</title><style>body{font:15px Arial,sans-serif;color:#102b3f;margin:36px;line-height:1.6;overflow-wrap:anywhere}h2{font-size:25px}hr{border:0;border-top:1px solid #ccd}@page{margin:18mm}</style></head><body>${html}</body></html>`;
    document.body.append(frame);
  }
  window.openInvoice=async function(missionId){
    const seq=++generation;owner=currentUser?.id;
    const root=document.querySelector("#invoiceContent");const l=L();
    root.innerHTML=`<div class="dialog-top"><h2>${esc(l.title)}</h2><button class="close" type="button" aria-label="Fermer" onclick="closeModal('invoiceModal')">×</button></div><div data-doc-body role="status">${esc(l.loading)}</div>`;
    openModal("invoiceModal");
    const body=root.querySelector("[data-doc-body]");
    try{
      const data=await request("list",missionId);if(seq!==generation)return;
      body.removeAttribute("role");
      body.innerHTML=`<section class="request-card"><h3 data-receipt-heading>${esc(l.receipt)}</h3><div data-receipt></div>${data.hasPayment?`<button class="small-btn" type="button" data-receipt-load>${esc(l.getReceipt)}</button>`:`<p>${esc(l.pending)}</p>`}</section><section class="request-card" style="margin-top:16px"><h3>${esc(l.provider)}</h3><p>${esc(l.share)}</p><div data-document-list></div>${data.documents.length?`<p class="muted">${esc(l.note)}</p>`:""}</section>${data.canUpload?`<section class="request-card" style="margin-top:16px"><h3>${esc(l.upload)}</h3><form data-upload><label>${esc(l.kind)}<select name="documentKind"><option value="invoice">${esc(l.invoice)}</option><option value="credit_note">${esc(l.credit)}</option></select></label><label>${esc(l.company)}<input name="issuerName" required maxlength="200" autocomplete="organization"></label><label>${esc(l.number)}<input name="invoiceNumber" required maxlength="100"></label><label>${esc(l.file)}<input name="file" type="file" accept="application/pdf,.pdf" required></label><label style="display:flex;gap:10px;align-items:flex-start"><input name="confirmed" type="checkbox" required style="width:auto;margin-top:4px"><span>${esc(l.confirm)}</span></label><button class="primary" type="submit">${esc(l.save)}</button><p role="status"></p></form></section>`:""}`;
      for(const label of body.querySelectorAll("form label"))label.style.cssText+=";display:block;margin:14px 0";
      for(const input of body.querySelectorAll('form input:not([type="checkbox"]),form select'))input.style.cssText="display:block;width:100%;max-width:100%;margin-top:6px;padding:10px;box-sizing:border-box";
      const list=body.querySelector("[data-document-list]");
      if(!data.documents.length)list.textContent=l.empty;
      for(const doc of data.documents){
        const row=document.createElement("div");row.style.cssText="border-top:1px solid #dce8e9;padding:12px 0";
        row.innerHTML=`<strong>${esc(doc.document_kind==="credit_note"?l.credit:l.invoice)} ${esc(doc.invoice_number)}</strong><div>${esc(doc.issuer_name)}</div><div class="muted">${esc(date(doc.created_at))}</div><button type="button" class="small-btn">${esc(l.download)}</button><p role="status"></p>`;
        row.querySelector("button").onclick=async e=>{
          const button=e.currentTarget;button.disabled=true;const status=row.querySelector('[role="status"]');status.textContent=l.loading;
          try{const result=await request("download",missionId,{documentId:doc.id});if(seq!==generation)return;
            const url=new URL(result.url);if(url.origin!==new URL(SUPABASE_URL).origin || !url.pathname.startsWith('/storage/v1/object/sign/provider-invoices/'))throw Error(l.error);
            const link=document.createElement("a");link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";link.textContent=l.download;status.replaceChildren(link);link.click();
          }catch(error){if(seq===generation)status.textContent=error.message;}finally{button.disabled=false;}
        };list.append(row);
      }
      body.querySelector("[data-receipt-load]")?.addEventListener("click",async e=>{
        const button=e.currentTarget;button.disabled=true;const target=body.querySelector("[data-receipt]");target.textContent=l.loading;
        try{const result=await request("receipt",missionId);if(seq!==generation)return;
          const html=receiptHtml(result.receipt);target.innerHTML=html;body.querySelector("[data-receipt-heading]").hidden=true;
          const print=document.createElement("button");print.type="button";print.className="small-btn";print.textContent=l.print;print.onclick=()=>printReceipt(html);print.style.marginBottom="16px";target.prepend(print);button.hidden=true;
        }catch(error){if(seq===generation)target.textContent=error.message;}finally{button.disabled=false;}
      });
      body.querySelector("[data-upload]")?.addEventListener("submit",async e=>{
        e.preventDefault();const form=e.target;const file=form.elements.file.files[0];const status=form.querySelector('[role="status"]');const button=form.querySelector('[type="submit"]');
        if(!file || file.size>8388608){status.textContent=l.file;return;}
        const fields=new FormData(form);fields.set("missionId",missionId);fields.set("confirmed",form.elements.confirmed.checked?"true":"false");button.disabled=true;status.textContent=l.saving;
        try{await request("upload",missionId,fields);if(seq!==generation)return;await window.openInvoice(missionId);const updated=document.querySelector('[data-upload] [role="status"]');if(updated)updated.textContent=l.saved;}
        catch(error){if(seq===generation)status.textContent=error.message;}finally{button.disabled=false;}
      });
    }catch(error){if(seq!==generation)return;body.textContent=error.message;const retry=document.createElement("button");retry.className="small-btn";retry.textContent=l.retry;retry.onclick=()=>window.openInvoice(missionId);body.append(retry);}
  };
  db.auth.onAuthStateChange((_event,session)=>{if(owner && owner!==session?.user?.id){generation++;owner=null;document.querySelector("#invoiceContent")?.replaceChildren();document.querySelector("#receiptPrintFrame")?.remove();closeModal("invoiceModal");}});
})();
