"use strict";
function renderContentPanel(ports){
  const main = document.querySelector("#dashMain");
  const editing = editingPortId ? ports.find(p=>String(p.id)===String(editingPortId)) : null;
  const p = editing || {};
  main.innerHTML = `
    <div class="dash-section-title">${NAV_ICONS.content}${esc(t("dash.navContent"))} (${ports.length})</div>
    ${ports.length ? ports.map((pt,idx)=>`
      <div class="port-admin-card${pt.active?"":" port-admin-card--inactive"}">
        <div class="port-admin-reorder">
          <button type="button" class="link" data-move-port="${pt.id}" data-dir="up" ${idx===0?"disabled":""} title="↑">↑</button>
          <button type="button" class="link" data-move-port="${pt.id}" data-dir="down" ${idx===ports.length-1?"disabled":""} title="↓">↓</button>
        </div>
        <div class="port-admin-main">
          <div class="port-admin-name">${esc(pt.name)} ${pt.active?"":`<span class="port-admin-badge">${esc(t("dash.contentPortActive"))} ✕</span>`}</div>
          <div class="port-admin-coords">${Number(pt.lat).toFixed(4)}, ${Number(pt.lng).toFixed(4)} · #${pt.order_index}</div>
          ${pt.description ? `<div class="port-admin-desc">${esc(pt.description)}</div>` : ""}
        </div>
        <div class="port-admin-actions">
          <button type="button" class="link" data-edit-port="${pt.id}">${esc(t("dash.contentEdit"))}</button>
          <button type="button" class="link" style="color:#c0392b" data-delete-port="${pt.id}">${esc(t("dash.contentDelete"))}</button>
        </div>
      </div>`).join("") : `<div class="empty-note">${esc(t("dash.contentNoPorts"))}</div>`}
    <h3 style="margin-top:24px">${editing ? esc(t("dash.contentEdit")) : esc(t("dash.contentAddPort"))}</h3>
    <form id="portForm" style="margin-top:14px">
      <div class="field"><label>${esc(t("dash.contentPortName"))}</label><input id="portNameInput" required value="${esc(p.name||"")}"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="field"><label>${esc(t("dash.contentPortLat"))}</label><input id="portLatInput" type="number" step="0.0001" required value="${p.lat??""}"></div>
        <div class="field"><label>${esc(t("dash.contentPortLng"))}</label><input id="portLngInput" type="number" step="0.0001" required value="${p.lng??""}"></div>
      </div>
      <div class="field"><label>${esc(t("dash.contentPortDesc"))}</label><textarea id="portDescInput" rows="2">${esc(p.description||"")}</textarea></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:end">
        <div class="field"><label>${esc(t("dash.contentPortOrder"))}</label><input id="portOrderInput" type="number" value="${p.order_index??ports.length+1}"></div>
        <label style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:13.5px;padding-bottom:14px"><input id="portActiveInput" type="checkbox" ${editing ? (p.active?"checked":"") : "checked"}> ${esc(t("dash.contentPortActive"))}</label>
      </div>
      <div style="display:flex;gap:10px">
        <button class="primary wide" type="submit">${esc(t("dash.contentSave"))}</button>
        ${editing ? `<button type="button" class="secondary-light" id="cancelPortEdit">${esc(t("dash.contentCancel"))}</button>` : ""}
      </div>
      <p class="ok-text" id="portFormMsg"></p>
    </form>`;
  document.querySelectorAll("[data-edit-port]").forEach(btn=>{
    btn.addEventListener("click", ()=>{ editingPortId = btn.dataset.editPort; renderAdminPanel("content"); });
  });
  document.querySelectorAll("[data-move-port]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.dataset.movePort;
      const dir = btn.dataset.dir;
      const idx = ports.findIndex(p=>String(p.id)===String(id));
      const swapIdx = dir==="up" ? idx-1 : idx+1;
      if(swapIdx < 0 || swapIdx >= ports.length) return;
      const a = ports[idx], b = ports[swapIdx];
      const {error:e1} = await db.from("ports").update({order_index:b.order_index}).eq("id", a.id);
      const {error:e2} = await db.from("ports").update({order_index:a.order_index}).eq("id", b.id);
      if(e1||e2) alert(friendlyError(e1||e2)); else await renderAdminPanel("content");
    });
  });
  document.querySelectorAll("[data-delete-port]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      if(!confirm(t("dash.contentConfirmDelete"))) return;
      const {error} = await db.from("ports").delete().eq("id", btn.dataset.deletePort);
      if(error) alert(friendlyError(error)); else { editingPortId = null; await renderAdminPanel("content"); }
    });
  });
  const cancelBtn = document.querySelector("#cancelPortEdit");
  if(cancelBtn) cancelBtn.addEventListener("click", ()=>{ editingPortId = null; renderAdminPanel("content"); });
  document.querySelector("#portForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const payload = {
      name: document.querySelector("#portNameInput").value.trim(),
      lat: Number(document.querySelector("#portLatInput").value),
      lng: Number(document.querySelector("#portLngInput").value),
      description: document.querySelector("#portDescInput").value.trim(),
      order_index: Number(document.querySelector("#portOrderInput").value)||0,
      active: document.querySelector("#portActiveInput").checked,
      updated_at: new Date().toISOString()
    };
    const msg = document.querySelector("#portFormMsg");
    const {error} = editingPortId
      ? await db.from("ports").update(payload).eq("id", editingPortId)
      : await db.from("ports").insert(payload);
    if(error){ msg.textContent = friendlyError(error); msg.style.color = "#c0392b"; }
    else { msg.textContent = t("dash.contentSaved"); msg.style.color = ""; editingPortId = null; await renderAdminPanel("content"); }
  });
}
let editingHeroId = null;
function renderHeroPanel(slides){
  const main = document.querySelector("#dashMain");
  const editing = editingHeroId ? slides.find(s=>String(s.id)===String(editingHeroId)) : null;
  const s = editing || {};
  main.innerHTML = `
    <div class="dash-section-title">${NAV_ICONS.hero}${esc(t("dash.navHero"))} (${slides.length})</div>
    <div class="hero-admin-grid">
      ${slides.length ? slides.map((sl,idx)=>`
        <div class="hero-admin-card${sl.active?"":" hero-admin-card--inactive"}">
          <div class="hero-admin-thumb" style="background-image:url('${esc(sl.image_url)}')"></div>
          <div class="hero-admin-body">
            <div class="hero-admin-order">#${sl.order_index}${sl.active?"":` · ${esc(t("dash.heroActive"))} ✕`}</div>
            <div class="hero-admin-reorder">
              <button type="button" class="link" data-move-hero="${sl.id}" data-dir="up" ${idx===0?"disabled":""} title="↑">↑</button>
              <button type="button" class="link" data-move-hero="${sl.id}" data-dir="down" ${idx===slides.length-1?"disabled":""} title="↓">↓</button>
            </div>
            <div class="hero-admin-actions">
              <button type="button" class="link" data-edit-hero="${sl.id}">${esc(t("dash.contentEdit"))}</button>
              <button type="button" class="link" style="color:#c0392b" data-delete-hero="${sl.id}">${esc(t("dash.contentDelete"))}</button>
            </div>
          </div>
        </div>`).join("") : `<div class="empty-note">${esc(t("dash.heroNoSlides"))}</div>`}
    </div>
    <h3 style="margin-top:24px">${editing ? esc(t("dash.contentEdit")) : esc(t("dash.heroAddSlide"))}</h3>
    <form id="heroForm" style="margin-top:14px">
      <div class="field"><label>${esc(t("dash.heroUploadLabel"))}</label>
        <input id="heroFileInput" type="file" accept="image/*">
        <div id="heroUploadStatus" class="muted" style="font-size:12px;margin-top:4px"></div>
      </div>
      <div class="field"><label>${esc(t("dash.heroImageUrl"))}</label><input id="heroUrlInput" type="url" required value="${esc(s.image_url||"")}" placeholder="https://..."></div>
      <div class="field"><label>${esc(t("dash.heroAlt"))}</label><input id="heroAltInput" value="${esc(s.alt_text||"")}"></div>
      <div id="heroPreviewBox" style="margin:6px 0 14px;${s.image_url?"":"display:none"}">
        <div class="hero-admin-thumb hero-admin-thumb--big" id="heroPreviewImg" style="background-image:url('${esc(s.image_url||"")}')"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:end">
        <div class="field"><label>${esc(t("dash.heroOrder"))}</label><input id="heroOrderInput" type="number" value="${s.order_index??slides.length+1}"></div>
        <label style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:13.5px;padding-bottom:14px"><input id="heroActiveInput" type="checkbox" ${editing ? (s.active?"checked":"") : "checked"}> ${esc(t("dash.heroActive"))}</label>
      </div>
      <div style="display:flex;gap:10px">
        <button class="primary wide" type="submit">${esc(t("dash.contentSave"))}</button>
        ${editing ? `<button type="button" class="secondary-light" id="cancelHeroEdit">${esc(t("dash.contentCancel"))}</button>` : ""}
      </div>
      <p class="ok-text" id="heroFormMsg"></p>
    </form>`;
  document.querySelectorAll("[data-edit-hero]").forEach(btn=>{
    btn.addEventListener("click", ()=>{ editingHeroId = btn.dataset.editHero; renderAdminPanel("hero"); });
  });
  document.querySelectorAll("[data-move-hero]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.dataset.moveHero;
      const dir = btn.dataset.dir;
      const idx = slides.findIndex(s=>String(s.id)===String(id));
      const swapIdx = dir==="up" ? idx-1 : idx+1;
      if(swapIdx < 0 || swapIdx >= slides.length) return;
      const a = slides[idx], b = slides[swapIdx];
      const {error:e1} = await db.from("hero_slides").update({order_index:b.order_index}).eq("id", a.id);
      const {error:e2} = await db.from("hero_slides").update({order_index:a.order_index}).eq("id", b.id);
      if(e1||e2) alert(friendlyError(e1||e2)); else await renderAdminPanel("hero");
    });
  });
  document.querySelectorAll("[data-delete-hero]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      if(!confirm(t("dash.contentConfirmDelete"))) return;
      const {error} = await db.from("hero_slides").delete().eq("id", btn.dataset.deleteHero);
      if(error) alert(friendlyError(error)); else { editingHeroId = null; await renderAdminPanel("hero"); }
    });
  });
  const cancelBtn = document.querySelector("#cancelHeroEdit");
  if(cancelBtn) cancelBtn.addEventListener("click", ()=>{ editingHeroId = null; renderAdminPanel("hero"); });
  const fileInput = document.querySelector("#heroFileInput");
  const uploadStatus = document.querySelector("#heroUploadStatus");
  fileInput.addEventListener("change", async ()=>{
    const file = fileInput.files[0];
    if(!file) return;
    uploadStatus.textContent = t("dash.heroUploading");
    const ext = (file.name.split(".").pop()||"jpg").toLowerCase();
    const path = `hero/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const {error} = await db.storage.from("site-media").upload(path, file, {cacheControl:"3600", upsert:false});
    if(error){ uploadStatus.textContent = friendlyError(error); uploadStatus.style.color = "#c0392b"; return; }
    const {data} = db.storage.from("site-media").getPublicUrl(path);
    document.querySelector("#heroUrlInput").value = data.publicUrl;
    document.querySelector("#heroUrlInput").dispatchEvent(new Event("input"));
    uploadStatus.textContent = t("dash.heroUploaded");
    uploadStatus.style.color = "";
  });
  const urlInput = document.querySelector("#heroUrlInput");
  urlInput.addEventListener("input", ()=>{
    const box = document.querySelector("#heroPreviewBox");
    const img = document.querySelector("#heroPreviewImg");
    if(urlInput.value.trim()){ box.style.display = ""; img.style.backgroundImage = `url('${urlInput.value.trim()}')`; }
    else box.style.display = "none";
  });
  document.querySelector("#heroForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const payload = {
      image_url: document.querySelector("#heroUrlInput").value.trim(),
      alt_text: document.querySelector("#heroAltInput").value.trim(),
      order_index: Number(document.querySelector("#heroOrderInput").value)||0,
      active: document.querySelector("#heroActiveInput").checked,
      updated_at: new Date().toISOString()
    };
    const msg = document.querySelector("#heroFormMsg");
    const {error} = editingHeroId
      ? await db.from("hero_slides").update(payload).eq("id", editingHeroId)
      : await db.from("hero_slides").insert(payload);
    if(error){ msg.textContent = friendlyError(error); msg.style.color = "#c0392b"; }
    else { msg.textContent = t("dash.contentSaved"); msg.style.color = ""; editingHeroId = null; await renderAdminPanel("hero"); }
  });
}
let editingDestId = null;
function renderDestinationsPanel(tiles){
  const main = document.querySelector("#dashMain");
  const editing = editingDestId ? tiles.find(s=>String(s.id)===String(editingDestId)) : null;
  const s = editing || {};
  main.innerHTML = `
    <div class="dash-section-title">${NAV_ICONS.destinations}${esc(t("dash.navDestinations"))} (${tiles.length})</div>
    <div class="hero-admin-grid">
      ${tiles.length ? tiles.map((sl,idx)=>`
        <div class="hero-admin-card${sl.active?"":" hero-admin-card--inactive"}">
          <div class="hero-admin-thumb" style="background-image:url('${esc(sl.image_url)}')"></div>
          <div class="hero-admin-body">
            <div class="hero-admin-order" style="font-family:inherit;font-weight:800;color:var(--navy)">${esc(sl.name)}</div>
            <div class="hero-admin-order">#${sl.order_index}${sl.active?"":` · ${esc(t("dash.heroActive"))} ✕`}</div>
            <div class="hero-admin-reorder">
              <button type="button" class="link" data-move-dest="${sl.id}" data-dir="up" ${idx===0?"disabled":""} title="↑">↑</button>
              <button type="button" class="link" data-move-dest="${sl.id}" data-dir="down" ${idx===tiles.length-1?"disabled":""} title="↓">↓</button>
            </div>
            <div class="hero-admin-actions">
              <button type="button" class="link" data-edit-dest="${sl.id}">${esc(t("dash.contentEdit"))}</button>
              <button type="button" class="link" style="color:#c0392b" data-delete-dest="${sl.id}">${esc(t("dash.contentDelete"))}</button>
            </div>
          </div>
        </div>`).join("") : `<div class="empty-note">${esc(t("dash.destNoTiles"))}</div>`}
    </div>
    <h3 style="margin-top:24px">${editing ? esc(t("dash.contentEdit")) : esc(t("dash.destAddTile"))}</h3>
    <form id="destForm" style="margin-top:14px">
      <div class="field"><label>${esc(t("dash.destName"))}</label><input id="destNameInput" required value="${esc(s.name||"")}"></div>
      <div class="field"><label>${esc(t("dash.heroUploadLabel"))}</label>
        <input id="destFileInput" type="file" accept="image/*">
        <div id="destUploadStatus" class="muted" style="font-size:12px;margin-top:4px"></div>
      </div>
      <div class="field"><label>${esc(t("dash.heroImageUrl"))}</label><input id="destUrlInput" type="url" required value="${esc(s.image_url||"")}" placeholder="https://..."></div>
      <div id="destPreviewBox" style="margin:6px 0 14px;${s.image_url?"":"display:none"}">
        <div class="hero-admin-thumb hero-admin-thumb--big" id="destPreviewImg" style="background-image:url('${esc(s.image_url||"")}')"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:end">
        <div class="field"><label>${esc(t("dash.heroOrder"))}</label><input id="destOrderInput" type="number" value="${s.order_index??tiles.length+1}"></div>
        <label style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:13.5px;padding-bottom:14px"><input id="destActiveInput" type="checkbox" ${editing ? (s.active?"checked":"") : "checked"}> ${esc(t("dash.heroActive"))}</label>
      </div>
      <div style="display:flex;gap:10px">
        <button class="primary wide" type="submit">${esc(t("dash.contentSave"))}</button>
        ${editing ? `<button type="button" class="secondary-light" id="cancelDestEdit">${esc(t("dash.contentCancel"))}</button>` : ""}
      </div>
      <p class="ok-text" id="destFormMsg"></p>
    </form>`;
  document.querySelectorAll("[data-edit-dest]").forEach(btn=>{
    btn.addEventListener("click", ()=>{ editingDestId = btn.dataset.editDest; renderAdminPanel("destinations"); });
  });
  document.querySelectorAll("[data-move-dest]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.dataset.moveDest;
      const dir = btn.dataset.dir;
      const idx = tiles.findIndex(s=>String(s.id)===String(id));
      const swapIdx = dir==="up" ? idx-1 : idx+1;
      if(swapIdx < 0 || swapIdx >= tiles.length) return;
      const a = tiles[idx], b = tiles[swapIdx];
      const {error:e1} = await db.from("destination_tiles").update({order_index:b.order_index}).eq("id", a.id);
      const {error:e2} = await db.from("destination_tiles").update({order_index:a.order_index}).eq("id", b.id);
      if(e1||e2) alert(friendlyError(e1||e2)); else await renderAdminPanel("destinations");
    });
  });
  document.querySelectorAll("[data-delete-dest]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      if(!confirm(t("dash.contentConfirmDelete"))) return;
      const {error} = await db.from("destination_tiles").delete().eq("id", btn.dataset.deleteDest);
      if(error) alert(friendlyError(error)); else { editingDestId = null; await renderAdminPanel("destinations"); }
    });
  });
  const cancelBtn = document.querySelector("#cancelDestEdit");
  if(cancelBtn) cancelBtn.addEventListener("click", ()=>{ editingDestId = null; renderAdminPanel("destinations"); });
  const fileInput = document.querySelector("#destFileInput");
  const uploadStatus = document.querySelector("#destUploadStatus");
  fileInput.addEventListener("change", async ()=>{
    const file = fileInput.files[0];
    if(!file) return;
    uploadStatus.textContent = t("dash.heroUploading");
    const ext = (file.name.split(".").pop()||"jpg").toLowerCase();
    const path = `destinations/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const {error} = await db.storage.from("site-media").upload(path, file, {cacheControl:"3600", upsert:false});
    if(error){ uploadStatus.textContent = friendlyError(error); uploadStatus.style.color = "#c0392b"; return; }
    const {data} = db.storage.from("site-media").getPublicUrl(path);
    document.querySelector("#destUrlInput").value = data.publicUrl;
    document.querySelector("#destUrlInput").dispatchEvent(new Event("input"));
    uploadStatus.textContent = t("dash.heroUploaded");
    uploadStatus.style.color = "";
  });
  const urlInput = document.querySelector("#destUrlInput");
  urlInput.addEventListener("input", ()=>{
    const box = document.querySelector("#destPreviewBox");
    const img = document.querySelector("#destPreviewImg");
    if(urlInput.value.trim()){ box.style.display = ""; img.style.backgroundImage = `url('${urlInput.value.trim()}')`; }
    else box.style.display = "none";
  });
  document.querySelector("#destForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const payload = {
      name: document.querySelector("#destNameInput").value.trim(),
      image_url: document.querySelector("#destUrlInput").value.trim(),
      order_index: Number(document.querySelector("#destOrderInput").value)||0,
      active: document.querySelector("#destActiveInput").checked,
      updated_at: new Date().toISOString()
    };
    const msg = document.querySelector("#destFormMsg");
    const {error} = editingDestId
      ? await db.from("destination_tiles").update(payload).eq("id", editingDestId)
      : await db.from("destination_tiles").insert(payload);
    if(error){ msg.textContent = friendlyError(error); msg.style.color = "#c0392b"; }
    else { msg.textContent = t("dash.contentSaved"); msg.style.color = ""; editingDestId = null; await renderAdminPanel("destinations"); }
  });
}
let editingActId = null;
function renderActivitiesPanel(tiles){
  const main = document.querySelector("#dashMain");
  const editing = editingActId ? tiles.find(s=>String(s.id)===String(editingActId)) : null;
  const s = editing || {};
  main.innerHTML = `
    <div class="dash-section-title">${NAV_ICONS.activities}${esc(t("dash.navActivities"))} (${tiles.length})</div>
    <div class="hero-admin-grid">
      ${tiles.length ? tiles.map((sl,idx)=>`
        <div class="hero-admin-card${sl.active?"":" hero-admin-card--inactive"}">
          <div class="hero-admin-thumb" style="background-image:url('${esc(sl.image_url)}')"></div>
          <div class="hero-admin-body">
            <div class="hero-admin-order" style="font-family:inherit;font-weight:800;color:var(--navy)">${esc(sl.title)}</div>
            <div class="hero-admin-order">${esc(sl.port_name)} · #${sl.order_index}${sl.active?"":` · ${esc(t("dash.heroActive"))} ✕`}</div>
            <div class="hero-admin-reorder">
              <button type="button" class="link" data-move-act="${sl.id}" data-dir="up" ${idx===0?"disabled":""} title="↑">↑</button>
              <button type="button" class="link" data-move-act="${sl.id}" data-dir="down" ${idx===tiles.length-1?"disabled":""} title="↓">↓</button>
            </div>
            <div class="hero-admin-actions">
              <button type="button" class="link" data-edit-act="${sl.id}">${esc(t("dash.contentEdit"))}</button>
              <button type="button" class="link" style="color:#c0392b" data-delete-act="${sl.id}">${esc(t("dash.contentDelete"))}</button>
            </div>
          </div>
        </div>`).join("") : `<div class="empty-note">${esc(t("dash.actNoTiles"))}</div>`}
    </div>
    <h3 style="margin-top:24px">${editing ? esc(t("dash.contentEdit")) : esc(t("dash.actAddTile"))}</h3>
    <form id="actForm" style="margin-top:14px">
      <div class="field"><label>${esc(t("dash.actPortName"))}</label><input id="actPortInput" required value="${esc(s.port_name||"")}" placeholder="Ex. Cannes"></div>
      <div class="field"><label>${esc(t("dash.actTitle"))}</label><input id="actTitleInput" required value="${esc(s.title||"")}"></div>
      <div class="field"><label>${esc(t("dash.actDesc"))}</label><textarea id="actDescInput" rows="2">${esc(s.description||"")}</textarea></div>
      <div class="field"><label>${esc(t("dash.heroUploadLabel"))}</label>
        <input id="actFileInput" type="file" accept="image/*">
        <div id="actUploadStatus" class="muted" style="font-size:12px;margin-top:4px"></div>
      </div>
      <div class="field"><label>${esc(t("dash.heroImageUrl"))}</label><input id="actUrlInput" type="url" required value="${esc(s.image_url||"")}" placeholder="https://..."></div>
      <div id="actPreviewBox" style="margin:6px 0 14px;${s.image_url?"":"display:none"}">
        <div class="hero-admin-thumb hero-admin-thumb--big" id="actPreviewImg" style="background-image:url('${esc(s.image_url||"")}')"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:end">
        <div class="field"><label>${esc(t("dash.heroOrder"))}</label><input id="actOrderInput" type="number" value="${s.order_index??tiles.length+1}"></div>
        <label style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:13.5px;padding-bottom:14px"><input id="actActiveInput" type="checkbox" ${editing ? (s.active?"checked":"") : "checked"}> ${esc(t("dash.heroActive"))}</label>
      </div>
      <div style="display:flex;gap:10px">
        <button class="primary wide" type="submit">${esc(t("dash.contentSave"))}</button>
        ${editing ? `<button type="button" class="secondary-light" id="cancelActEdit">${esc(t("dash.contentCancel"))}</button>` : ""}
      </div>
      <p class="ok-text" id="actFormMsg"></p>
    </form>`;
  document.querySelectorAll("[data-edit-act]").forEach(btn=>{
    btn.addEventListener("click", ()=>{ editingActId = btn.dataset.editAct; renderAdminPanel("activities"); });
  });
  document.querySelectorAll("[data-move-act]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.dataset.moveAct;
      const dir = btn.dataset.dir;
      const idx = tiles.findIndex(s=>String(s.id)===String(id));
      const swapIdx = dir==="up" ? idx-1 : idx+1;
      if(swapIdx < 0 || swapIdx >= tiles.length) return;
      const a = tiles[idx], b = tiles[swapIdx];
      const {error:e1} = await db.from("port_activities").update({order_index:b.order_index}).eq("id", a.id);
      const {error:e2} = await db.from("port_activities").update({order_index:a.order_index}).eq("id", b.id);
      if(e1||e2) alert(friendlyError(e1||e2)); else await renderAdminPanel("activities");
    });
  });
  document.querySelectorAll("[data-delete-act]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      if(!confirm(t("dash.contentConfirmDelete"))) return;
      const {error} = await db.from("port_activities").delete().eq("id", btn.dataset.deleteAct);
      if(error) alert(friendlyError(error)); else { editingActId = null; await renderAdminPanel("activities"); }
    });
  });
  const cancelBtn = document.querySelector("#cancelActEdit");
  if(cancelBtn) cancelBtn.addEventListener("click", ()=>{ editingActId = null; renderAdminPanel("activities"); });
  const fileInput = document.querySelector("#actFileInput");
  const uploadStatus = document.querySelector("#actUploadStatus");
  fileInput.addEventListener("change", async ()=>{
    const file = fileInput.files[0];
    if(!file) return;
    uploadStatus.textContent = t("dash.heroUploading");
    const ext = (file.name.split(".").pop()||"jpg").toLowerCase();
    const path = `activities/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const {error} = await db.storage.from("site-media").upload(path, file, {cacheControl:"3600", upsert:false});
    if(error){ uploadStatus.textContent = friendlyError(error); uploadStatus.style.color = "#c0392b"; return; }
    const {data} = db.storage.from("site-media").getPublicUrl(path);
    document.querySelector("#actUrlInput").value = data.publicUrl;
    document.querySelector("#actUrlInput").dispatchEvent(new Event("input"));
    uploadStatus.textContent = t("dash.heroUploaded");
    uploadStatus.style.color = "";
  });
  const urlInput = document.querySelector("#actUrlInput");
  urlInput.addEventListener("input", ()=>{
    const box = document.querySelector("#actPreviewBox");
    const img = document.querySelector("#actPreviewImg");
    if(urlInput.value.trim()){ box.style.display = ""; img.style.backgroundImage = `url('${urlInput.value.trim()}')`; }
    else box.style.display = "none";
  });
  document.querySelector("#actForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const payload = {
      port_name: document.querySelector("#actPortInput").value.trim(),
      title: document.querySelector("#actTitleInput").value.trim(),
      description: document.querySelector("#actDescInput").value.trim(),
      image_url: document.querySelector("#actUrlInput").value.trim(),
      order_index: Number(document.querySelector("#actOrderInput").value)||0,
      active: document.querySelector("#actActiveInput").checked,
      updated_at: new Date().toISOString()
    };
    const msg = document.querySelector("#actFormMsg");
    const {error} = editingActId
      ? await db.from("port_activities").update(payload).eq("id", editingActId)
      : await db.from("port_activities").insert(payload);
    if(error){ msg.textContent = friendlyError(error); msg.style.color = "#c0392b"; }
    else { msg.textContent = t("dash.contentSaved"); msg.style.color = ""; editingActId = null; await renderAdminPanel("activities"); }
  });
}
function adminMissionCard(m, byId, showFinance, payoutsById){
  const client = byId[String(m.client_id)];
  const pro = byId[String(m.provider_id||m.skipper_id)];
  const total = Number(m.amount_cents||0) + Number(m.urgent_fee_cents||0);
  const fee = Number(m.platform_fee_cents||0);
  const net = Math.max(0, total - fee);
  const payout = payoutsById ? payoutsById[String(m.provider_id||m.skipper_id)] : null;
  return `<article class="request-card" tabindex="0" role="button" data-admin-detail="mission" data-admin-id="${esc(m.id)}">
    <div class="request-top">
      <div>
        <h3>${esc(m.port||"—")} · ${esc(m.boat_type||"")}</h3>
        <div class="muted">${m.starts_at ? new Date(m.starts_at).toLocaleDateString(currentLang) : ""}</div>
        <div class="muted">${esc(t("dash.client"))}: ${esc(client?.full_name || "—")}${client?.phone?` · 📞 ${esc(client.phone)}`:""} · ${esc(t("dash.professional"))}: ${esc(pro?.full_name || "—")}${pro?.phone?` · 📞 ${esc(pro.phone)}`:""}</div>
      </div>
      <span class="status-pill ${statusPillClass(m.status)}">${esc(t("status."+(m.status||"pending")))}</span>
    </div>
    ${showFinance ? `<div class="muted" style="margin-top:6px">${esc(t("dash.total"))}: <strong>${money(total)}</strong> · ${esc(t("dash.commission"))}: ${money(fee)} · ${esc(t("dash.netPro"))}: ${money(net)}</div>` : `<div class="muted" style="margin-top:6px">${total ? money(total) : t("booking.priceTbd")}</div>`}
    <div class="muted">${esc(t("dash.paymentStatus"))}: ${esc(t("paymentStatus."+(m.payment_status||"unpaid")))}</div>
    ${payoutsById ? (payout?.iban ? `<div class="note-box">${esc(t("dash.ibanLabel"))}: <strong>${esc(payout.iban)}</strong>${payout.bic?` · ${esc(t("dash.bicLabel"))}: ${esc(payout.bic)}`:""}${payout.bank_holder_name?` · ${esc(payout.bank_holder_name)}`:""}</div>` : `<div class="note-box">${esc(t("dash.noIban"))}</div>`) : ""}
    ${m.dispute_status ? `<div class="note-box" style="background:#fff0f0;border-color:#f0c4c4;color:#8a2020"><strong>${esc(t(m.dispute_status==="open"?"dash.disputeOpen":"dash.disputeResolved"))}</strong> — ${esc(m.dispute_reason||"")}</div>` : ""}
    <div class="request-actions">
      <select data-status-select="${m.id}">
        ${["pending","quoted","accepted","rejected","in_progress","awaiting_validation","completed","cancelled"].map(s=>`<option value="${s}" ${s===m.status?"selected":""}>${esc(t("status."+s))}</option>`).join("")}
      </select>
      ${m.payment_status==="refund_requested" ? `<button class="small-btn fill" data-approve-refund="${m.id}">${esc(t("dash.approveRefund"))}</button><button class="small-btn danger" data-reject-refund="${m.id}">${esc(t("dash.rejectRefund"))}</button>` : ""}
      ${m.dispute_status==="open" ? `<button class="small-btn fill" data-resolve-dispute="${m.id}">${esc(t("dash.resolveDispute"))}</button>` : ""}
      ${m.stripe_payment_intent_id ? `<button class="small-btn" data-open-invoice="${m.id}">${esc(t("dash.viewInvoice"))}</button>` : ""}
      <button class="small-btn danger" data-delete-mission="${m.id}">${esc(t("dash.delete"))}</button>
    </div>
  </article>`;
}
function bindAdminMissionActions(panel){
  document.querySelectorAll("[data-open-invoice]").forEach(btn=>btn.addEventListener("click", ()=>openInvoice(btn.dataset.openInvoice)));
  document.querySelectorAll("[data-status-select]").forEach(sel=>sel.addEventListener("change", async ()=>{
    const {error} = await db.from("missions").update({status: sel.value}).eq("id", sel.dataset.statusSelect);
    if(error) alert(friendlyError(error)); else renderAdminPanel(panel);
  }));
  document.querySelectorAll("[data-delete-mission]").forEach(btn=>btn.addEventListener("click", async ()=>{
    if(!confirm(t("dash.delete")+" ?")) return;
    const {error} = await db.from("missions").delete().eq("id", btn.dataset.deleteMission);
    if(error) alert(friendlyError(error)); else renderAdminPanel(panel);
  }));
  document.querySelectorAll("[data-approve-refund]").forEach(btn=>btn.addEventListener("click", async ()=>{
    if(!confirm(t("dash.approveRefund")+" ?")) return;
    const {data:{session}} = await db.auth.getSession();
    const res = await fetch(SUPABASE_URL + "/functions/v1/rapid-task", {
      method: "POST",
      headers: {"Content-Type":"application/json", "Authorization":"Bearer "+session.access_token, "apikey": SUPABASE_KEY},
      body: JSON.stringify({missionId: btn.dataset.approveRefund})
    });
    if(res.ok) renderAdminPanel(panel); else { const j = await res.json(); alert(j.error || "Erreur"); }
  }));
  document.querySelectorAll("[data-reject-refund]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const {error} = await db.from("missions").update({payment_status:"refund_rejected"}).eq("id", btn.dataset.rejectRefund);
    if(error) alert(friendlyError(error)); else renderAdminPanel(panel);
  }));
  document.querySelectorAll("[data-resolve-dispute]").forEach(btn=>btn.addEventListener("click", async ()=>{
    if(!confirm(t("dash.resolveDispute")+" ?")) return;
    const {error} = await db.from("missions").update({dispute_status:"resolved", dispute_resolved_at: new Date().toISOString()}).eq("id", btn.dataset.resolveDispute);
    if(error) alert(friendlyError(error)); else renderAdminPanel(panel);
  }));
}
function adminUserCard(p, missions, defaultCommission){
  const missionCount = missions.filter(m => String(m.client_id)===String(p.id) || String(m.skipper_id)===String(p.id)).length;
  const isProfessional = ["skipper","provider"].includes(p.role);
  return `<article class="request-card" tabindex="0" role="button" data-admin-detail="user" data-admin-id="${esc(p.id)}">
    <div class="request-top">
      <div>
        <h3>${esc(p.full_name||"—")}${featuredBadgeHtml(p)}</h3>
        <div class="muted">${esc(p.role||"")}${p.provider_activity?" · "+esc(activityLabel(p.provider_activity)):""} · ${esc(p.home_port||"—")}</div>
        <div class="muted">${esc(p.contact_email||p.email||"—")} · ${esc(p.phone||"—")}</div>
        <div class="muted">${esc(t("dash.missionsCount"))}: ${missionCount}${p.rating?` · ★ ${Number(p.rating).toFixed(1)}`:""}</div>
      </div>
      <span class="status-pill ${p.suspended?"danger":p.verified?"ok":""}">${p.suspended?esc(t("dash.suspended")):p.verified?"✓":"—"}</span>
    </div>
    ${p.document_rejection_reason ? `<div class="note-box" style="background:#fff0f0;border-color:#f0c4c4;color:#8a2020">${esc(t("dash.documentRejected"))}: ${esc(p.document_rejection_reason)}</div>` : ""}
    ${isProfessional ? `<div style="display:flex;align-items:center;gap:8px;margin-top:8px">
      <label class="muted" style="font-size:12.5px;white-space:nowrap">${esc(t("dash.commissionProviderTitle"))}</label>
      <input type="number" min="0" max="50" step="0.5" value="${Number(p.commission_percent ?? defaultCommission)}" data-commission-input="${p.id}" style="width:70px;padding:6px 8px;border:1px solid var(--line);border-radius:8px">
      <span class="muted" style="font-size:12.5px">%</span>
      <button class="small-btn" data-save-commission="${p.id}">${esc(t("dash.saveRate"))}</button>
      <span class="ok-text" data-commission-msg="${p.id}" style="font-size:12.5px"></span>
    </div>` : ""}
    <div style="margin-top:8px">
      <label class="muted" style="font-size:12.5px">${esc(t("dash.internalNoteLabel"))}</label>
      <textarea data-note-input="${p.id}" rows="2" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:8px;font-size:13px;margin-top:4px">${esc(p.admin_notes||"")}</textarea>
      <button class="small-btn" data-save-note="${p.id}" style="margin-top:4px">${esc(t("dash.saveNote"))}</button>
      <span class="ok-text" data-note-msg="${p.id}" style="font-size:12.5px"></span>
    </div>
    <div class="request-actions">
${!p.verified ? `<button class="small-btn fill" data-approve="${p.id}">${esc(t("dash.approve"))}</button><button class="small-btn danger" data-reject-doc="${p.id}">${esc(t("dash.rejectDocument"))}</button>` : (String(p.id)===String(currentUser.id) ? `` : `<button class="small-btn danger" data-suspend="${p.id}">${esc(t("dash.suspend"))}</button>`)}
      ${(isProfessional && p.verified) ? (p.featured ? `<button class="small-btn" data-unfeature="${p.id}">${esc(t("dash.unfeature"))}</button>` : `<button class="small-btn" data-feature="${p.id}">${esc(t("dash.markFeatured"))}</button>`) : ""}
      ${(p.suspended && String(p.id)!==String(currentUser.id)) ? `<button class="small-btn danger" data-delete-user="${p.id}">${esc(t("dash.delete"))}</button>` : ""}
      <button class="small-btn" data-view-profile="${p.id}">${esc(t("card.viewProfile"))}</button>
      
      ${p.role !== "admin" ? `<button class="small-btn" data-message-user="${p.id}">${esc(t("dash.navMessages"))}</button>` : ""}
    </div>
  </article>`;
}

function adminManagedBoatFormHtml(){
  return `<section class="request-card" style="border:1px solid var(--aqua);margin-bottom:18px">
    <div class="request-top"><div><h3 style="margin:0">Publier un bateau pour un propriétaire</h3><div class="muted">L'équipe SkipperNow publie et gère l'annonce. Le propriétaire n'a pas besoin de créer de compte.</div></div><span class="tag">SkipperNow</span></div>
    <form id="adminManagedBoatForm" style="margin-top:14px">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px">
        <div class="field"><label>NOM DU PROPRIÉTAIRE *</label><input id="managedOwnerName" required></div>
        <div class="field"><label>TÉLÉPHONE</label><input id="managedOwnerPhone" inputmode="tel"></div>
        <div class="field"><label>EMAIL</label><input id="managedOwnerEmail" type="email"></div>
        <div class="field"><label>NOM DE L'ANNONCE *</label><input id="managedBoatName" required placeholder="Ex. Jeanneau Cap Camarat 7.5 WA"></div>
        <div class="field"><label>MARQUE</label><input id="managedBoatBrand"></div>
        <div class="field"><label>MODÈLE</label><input id="managedBoatModel"></div>
        <div class="field"><label>TYPE</label><select id="managedBoatType"><option value="motorboat">Bateau à moteur</option><option value="sailboat">Voilier</option><option value="rib">Semi-rigide</option><option value="catamaran">Catamaran</option></select></div>
        <div class="field"><label>PORT / LOCALISATION *</label><input id="managedBoatPort" required></div>
        <div class="field"><label>ANNÉE</label><input id="managedBoatYear" type="number" min="1950" max="${new Date().getFullYear()}"></div>
        <div class="field"><label>LONGUEUR (m)</label><input id="managedBoatLength" type="number" min="0" step="0.1"></div>
        <div class="field"><label>PRIX DE VENTE (€) *</label><input id="managedBoatSalePrice" type="number" min="1" step="100" required></div>
        <div class="field"><label>HEURES MOTEUR</label><input id="managedBoatEngineHours" type="number" min="0" step="1"></div>
      </div>
      <div class="field"><label>DESCRIPTION</label><textarea id="managedBoatDescription" rows="4" placeholder="État, entretien, équipements, travaux récents…"></textarea></div>
      <div class="field"><label>PHOTOS</label><input id="managedBoatPhotos" type="file" accept="image/*" multiple></div>
      <div class="field"><label>NOTE INTERNE PROPRIÉTAIRE</label><textarea id="managedOwnerNotes" rows="2" placeholder="Informations privées visibles uniquement par l'équipe SkipperNow"></textarea></div>
      <button class="primary wide" type="submit">Publier au nom de SkipperNow</button>
      <p class="ok-text" id="managedBoatMsg"></p>
    </form>
  </section>`;
}
async function bindAdminManagedBoatForm(){
  const form=document.querySelector("#adminManagedBoatForm");
  if(!form) return;
  form.addEventListener("submit", async e=>{
    e.preventDefault();
    const btn=form.querySelector('button[type="submit"]'), msg=document.querySelector("#managedBoatMsg");
    btn.disabled=true; msg.style.color=""; msg.textContent="Publication en cours…";
    try{
      const files=[...(document.querySelector("#managedBoatPhotos")?.files||[])].slice(0,12);
      const photoUrls=[];
      for(const file of files){
        const path=`${currentUser.id}/managed-sale-${Date.now()}-${Math.random().toString(36).slice(2,8)}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g,"_")}`;
        const {error:uploadError}=await db.storage.from("mission-photos").upload(path,file);
        if(uploadError) throw uploadError;
        photoUrls.push(db.storage.from("mission-photos").getPublicUrl(path).data.publicUrl);
      }
      const n=value=>{const x=Number(value);return Number.isFinite(x)&&x>0?x:null;};
      const payload={
        owner_name:document.querySelector("#managedOwnerName").value.trim(),
        owner_phone:document.querySelector("#managedOwnerPhone").value.trim()||null,
        owner_email:document.querySelector("#managedOwnerEmail").value.trim()||null,
        owner_notes:document.querySelector("#managedOwnerNotes").value.trim()||null,
        name:document.querySelector("#managedBoatName").value.trim(),
        brand:document.querySelector("#managedBoatBrand").value.trim()||null,
        model:document.querySelector("#managedBoatModel").value.trim()||null,
        boat_type:document.querySelector("#managedBoatType").value,
        home_port:document.querySelector("#managedBoatPort").value.trim(),
        year_built:n(document.querySelector("#managedBoatYear").value),
        length_m:n(document.querySelector("#managedBoatLength").value),
        sale_price:n(document.querySelector("#managedBoatSalePrice").value),
        engine_hours:n(document.querySelector("#managedBoatEngineHours").value),
        description:document.querySelector("#managedBoatDescription").value.trim()||null,
        photo_urls:photoUrls
      };
      const {error}=await db.rpc("admin_create_managed_boat",{p_payload:payload});
      if(error) throw error;
      msg.style.color="#08794e";
      msg.textContent="Annonce publiée par SkipperNow pour le compte du propriétaire.";
      await renderAdminPanel("boats");
    }catch(error){
      msg.style.color="#b42318";
      msg.textContent=friendlyError(error);
      btn.disabled=false;
    }
  });
}
function adminManagedInquiriesHtml(rows, boats){
  if(!rows?.length) return "";
  const byBoat=Object.fromEntries((boats||[]).map(b=>[String(b.id),b]));
  return `<div class="dash-section-title" style="margin-top:22px">Demandes d'achat reçues (${rows.length})</div>${rows.map(q=>{
    const boat=byBoat[String(q.boat_id)];
    return `<article class="request-card"><div class="request-top"><div><h3>${esc(boat?normalizeBoatTitle(boat):"Bateau")}</h3><div class="muted">${new Date(q.created_at).toLocaleString(currentLang)} · ${esc(q.buyer_email||"")}</div></div><span class="status-pill ${q.status==="new"?"ok":""}">${esc(q.status==="new"?"Nouveau":q.status)}</span></div><p style="white-space:pre-wrap">${esc(q.message||"")}</p>${q.buyer_email?`<a class="small-btn fill" href="mailto:${esc(q.buyer_email)}">Répondre par e-mail</a>`:""}</article>`;
  }).join("")}`;
}

function adminBoatCard(b, byId, managedOwner){
  const owner = byId[String(b.client_id)];
  const photo = b.photo_url || (Array.isArray(b.photo_urls) && b.photo_urls[0]) || "";
  const isFeaturedNow = b.featured && b.featured_until && new Date(b.featured_until) > new Date();
  const daysLeft = isFeaturedNow ? Math.ceil((new Date(b.featured_until) - new Date())/(1000*60*60*24)) : 0;
  return `<article class="request-card">
    <div class="request-top">
      ${photo ? `<img loading="lazy" src="${esc(photo)}" style="width:88px;height:88px;object-fit:cover;border-radius:12px;flex-shrink:0" onclick="window.open('${esc(photo)}','_blank')">` : `<div style="width:88px;height:88px;border-radius:12px;background:var(--mist);display:grid;place-items:center;font-size:28px;flex-shrink:0">⛵</div>`}
      <div>
        <h3>${esc(b.name||"—")}${b.verified ? verifiedBoatBadgeHtml() : ""}${b.managed_by_platform ? ` <span class="verified-badge" style="background:#e8f3ff;color:#174a75">SkipperNow · pour le propriétaire</span>` : ""}${isFeaturedNow ? ` <span class="verified-badge" style="background:#fff4d6;color:#8a6d1a">★ ${esc(t("dash.featuredBadge"))}</span>` : ""}</h3>
        <div class="muted">${esc(b.model||"")}${b.boat_type?" · "+esc(boatTypeLabel(b.boat_type)):""} · ${esc(b.home_port||"—")}</div>
        <div class="muted">${b.length_m?b.length_m+" m · ":""}${b.capacity?b.capacity+" pers. · ":""}${b.cabins!=null?b.cabins+" cabines · ":""}${b.year_built?b.year_built:""}</div>
        <div class="muted">${esc(t("dash.owner"))}: ${b.managed_by_platform && managedOwner ? `${esc(managedOwner.owner_name||"—")}${managedOwner.owner_email?` · ${esc(managedOwner.owner_email)}`:""}${managedOwner.owner_phone?` · 📞 ${esc(managedOwner.owner_phone)}`:""}` : `${esc(owner?.full_name||"—")} · ${esc(owner?.contact_email||owner?.email||"—")}${owner?.phone?` · 📞 ${esc(owner.phone)}`:""}`}${b.skipper_included?` · ${esc(t("boatDetail.skipperIncluded"))}`:""}</div>
        ${b.managed_by_platform && managedOwner?.notes ? `<div class="muted" style="margin-top:4px"><strong>Note interne :</strong> ${esc(managedOwner.notes)}</div>` : ""}
        ${b.description ? `<div class="muted" style="margin-top:4px">${esc(b.description)}</div>` : ""}
        ${Array.isArray(b.photo_urls) && b.photo_urls.length > 1 ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${b.photo_urls.map(u=>`<img loading="lazy" src="${esc(u)}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;cursor:pointer" onclick="window.open('${esc(u)}','_blank')">`).join("")}</div>` : ""}
        ${isFeaturedNow ? `<div class="muted" style="margin-top:6px;color:#8a6d1a;font-weight:700">${esc(t("dash.featuredUntil"))} ${new Date(b.featured_until).toLocaleDateString()} (${daysLeft} ${esc(t("dash.daysLeft"))})</div>` : ""}
      </div>
    </div>
    <div class="request-actions">
      ${b.verified ? `<button class="small-btn" data-unverify-boat="${b.id}">${esc(t("dash.unverifyBoat"))}</button>` : `<button class="small-btn fill" data-verify-boat="${b.id}">${esc(t("dash.verifyBoat"))}</button>`}
      ${isFeaturedNow
        ? `<button class="small-btn" data-unfeature-boat="${b.id}">${esc(t("dash.removeFeatured"))}</button>`
        : `<select class="small-btn" data-feature-days="${b.id}" style="cursor:pointer">
            <option value="">${esc(t("dash.featureFor"))}</option>
            <option value="3">3 ${esc(t("dash.days"))}</option>
            <option value="7">7 ${esc(t("dash.days"))}</option>
            <option value="14">14 ${esc(t("dash.days"))}</option>
            <option value="30">30 ${esc(t("dash.days"))}</option>
          </select>`}
      <button class="small-btn danger" data-delete-boat="${b.id}">${esc(t("dash.delete"))}</button>
    </div>
  </article>`;
}
