(function(){
"use strict";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const lang=(fr,en,es)=>(typeof currentLang!=="undefined"&&currentLang==="en")?en:(typeof currentLang!=="undefined"&&currentLang==="es")?es:fr;
const fmt=d=>String(d||"").slice(0,10);
const err=e=>String(e?.message||e||lang("Erreur inconnue","Unknown error","Error desconocido"));
async function refresh(main){
 const user=typeof currentUser!=="undefined"?currentUser:null;
 if(!user?.id){main.textContent=lang("Reconnectez-vous.","Please sign in.","Inicia sesión.");return;}
 main.innerHTML='<div class="empty-note">Chargement…</div>';
 const [boatsR,blocksR,ratesR]=await Promise.all([
 db.from("boats").select("id,name,home_port,price_per_day,rental_available,photo_url").eq("client_id",user.id).in("listing_type",["rental","both"]).order("created_at",{ascending:false}),
 db.from("boat_calendar_blocks").select("id,boat_id,start_date,end_date,reason").eq("owner_id",user.id).order("start_date",{ascending:true}),
 db.from("boat_season_rates").select("id,boat_id,start_date,end_date,price_per_day").eq("owner_id",user.id).order("start_date",{ascending:true})
 ]);
 if(boatsR.error||blocksR.error||ratesR.error){main.innerHTML='<div class="empty-note">'+esc(err(boatsR.error||blocksR.error||ratesR.error))+'</div>';return;}
 const boats=boatsR.data||[],blocks=blocksR.data||[],rates=ratesR.data||[];
 if(!boats.length){main.innerHTML='<div class="note-box">'+esc(lang("Commencez par ajouter votre bateau dans « Mes bateaux ».","Add your first boat under My boats.","Añade primero tu barco en Mis barcos."))+'</div>';return;}
 const options=boats.map(b=>'<option value="'+esc(b.id)+'">'+esc(b.name||"Bateau")+'</option>').join("");
 const today=new Date().toISOString().slice(0,10);
 const formStyle='display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px;align-items:end';
 main.innerHTML=`
 <section style="padding:20px;border-radius:17px;background:linear-gradient(120deg,#08394b,#087f89);color:white;margin-bottom:16px">
  <small style="color:#cef2ef;font-weight:800;letter-spacing:.08em">${esc(lang("GESTION DE FLOTTE","FLEET CONTROL","GESTIÓN DE FLOTA"))}</small>
  <h3 style="color:white;margin:8px 0">${esc(lang("Calendrier et tarifs de vos bateaux","Boat availability and seasonal pricing","Calendario y tarifas por temporada"))}</h3>
  <p style="color:#e4f5f4;margin:0">${esc(lang("Bloquez les dates où votre bateau ne peut pas être loué et préparez vos tarifs par saison.","Block unavailable dates and set seasonal rates.","Bloquea fechas y establece tarifas de temporada."))}</p>
 </section>
 <section class="request-card" style="padding:18px;margin-bottom:15px">
  <h3>${esc(lang("Bloquer des dates","Block dates","Bloquear fechas"))}</h3>
  <form id="ownerBlockForm" style="${formStyle}">
   <label>${esc(lang("Bateau","Boat","Barco"))}<select name="boat" required>${options}</select></label>
   <label>${esc(lang("Du","From","Desde"))}<input name="start" type="date" min="${today}" required></label>
   <label>${esc(lang("Au (inclus)","Until (inclusive)","Hasta (incluido)"))}<input name="end" type="date" min="${today}" required></label>
   <button class="small-btn fill" type="submit">${esc(lang("Bloquer la période","Block period","Bloquear período"))}</button>
  </form><p role="status" id="ownerBlockStatus"></p>
 </section>
 <section class="request-card" style="padding:18px;margin-bottom:15px">
  <h3>${esc(lang("Tarifs saisonniers","Seasonal rates","Tarifas de temporada"))}</h3>
  <form id="ownerRateForm" style="${formStyle}">
   <label>${esc(lang("Bateau","Boat","Barco"))}<select name="boat" required>${options}</select></label>
   <label>${esc(lang("Du","From","Desde"))}<input name="start" type="date" required></label>
   <label>${esc(lang("Au (inclus)","Until (inclusive)","Hasta (incluido)"))}<input name="end" type="date" required></label>
   <label>${esc(lang("Prix / jour (€)","Daily price (€)","Precio / día (€)"))}<input name="price" type="number" min="1" step=".01" required></label>
   <button class="small-btn fill" type="submit">${esc(lang("Enregistrer le tarif","Save rate","Guardar tarifa"))}</button>
  </form><p role="status" id="ownerRateStatus"></p>
 </section>
 <div class="note-box" style="margin-bottom:15px">${esc(lang("Les périodes et tarifs sont enregistrés dans votre espace. La confirmation automatique des réservations selon ces règles sera activée après validation du moteur de réservation.","Dates and rates are saved; automatic booking enforcement still requires booking-engine integration.","Fechas y tarifas guardadas; la validación automática de reservas requiere integrar el motor de reservas."))}</div>
 <h3>${esc(lang("Vos bateaux et périodes","Your boats and periods","Tus barcos y períodos"))}</h3>
 <div class="request-list">${boats.map(b=>`
 <article class="request-card" style="padding:16px;margin-bottom:12px">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
   <div><strong>${esc(b.name||"Bateau")}</strong><div class="muted">${esc(b.home_port||"")} · ${esc(b.rental_available===false?lang("Indisponible","Unavailable","No disponible"):lang("En ligne","Online","En línea"))}</div></div>
   <strong>${Number(b.price_per_day||0)>0?esc(Number(b.price_per_day).toLocaleString("fr-FR",{style:"currency",currency:"EUR"}))+lang(" / jour"," / day"," / día"):"—"}</strong>
  </div>
  <div style="margin-top:12px"><strong>${esc(lang("Dates bloquées","Blocked dates","Fechas bloqueadas"))}</strong>
   ${blocks.filter(x=>x.boat_id===b.id).length?blocks.filter(x=>x.boat_id===b.id).map(x=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:7px"><span>${esc(fmt(x.start_date))} → ${esc(fmt(x.end_date))}</span><button type="button" class="small-btn" data-delete-block="${esc(x.id)}">${esc(lang("Supprimer","Remove","Eliminar"))}</button></div>`).join(""):`<p class="muted">${esc(lang("Aucune période bloquée","No blocked dates","Sin fechas bloqueadas"))}</p>`}
  </div>
  <div style="margin-top:12px"><strong>${esc(lang("Tarifs saisonniers","Seasonal rates","Tarifas de temporada"))}</strong>
   ${rates.filter(x=>x.boat_id===b.id).length?rates.filter(x=>x.boat_id===b.id).map(x=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:7px"><span>${esc(fmt(x.start_date))} → ${esc(fmt(x.end_date))}: ${esc(Number(x.price_per_day).toLocaleString("fr-FR",{style:"currency",currency:"EUR"}))}</span><button type="button" class="small-btn" data-delete-rate="${esc(x.id)}">${esc(lang("Supprimer","Remove","Eliminar"))}</button></div>`).join(""):`<p class="muted">${esc(lang("Aucun tarif saisonnier","No seasonal rates","Sin tarifas de temporada"))}</p>`}
  </div>
 </article>`).join("")}</div>`;
 const hook=async(id,table,status,columns)=>{
  const form=main.querySelector("#"+id);
  form.onsubmit=async e=>{
   e.preventDefault();const f=new FormData(form);const start=fmt(f.get("start")),end=fmt(f.get("end"));
   if(end<start){main.querySelector("#"+status).textContent=lang("La date de fin précède le début.","End date is before start.","La fecha final precede a la inicial.");return;}
   const btn=form.querySelector('[type="submit"]');btn.disabled=true;
   const row={boat_id:f.get("boat"),owner_id:user.id,start_date:start,end_date:end,...columns(f)};
   const {error}=await db.from(table).insert(row);
   if(error){main.querySelector("#"+status).textContent=err(error);btn.disabled=false;return;}
   await refresh(main);
  };
 };
 hook("ownerBlockForm","boat_calendar_blocks","ownerBlockStatus",()=>({reason:"unavailable"}));
 hook("ownerRateForm","boat_season_rates","ownerRateStatus",f=>({price_per_day:Number(f.get("price"))}));
 for(const [attr,table] of [["data-delete-block","boat_calendar_blocks"],["data-delete-rate","boat_season_rates"]]){
  main.querySelectorAll("["+attr+"]").forEach(btn=>btn.addEventListener("click",async()=>{
   btn.disabled=true;const {error}=await db.from(table).delete().eq("id",btn.getAttribute(attr)).eq("owner_id",user.id);
   if(error){alert(err(error));btn.disabled=false;}else await refresh(main);
  }));
 }
}
window.renderOwnerAvailability=refresh;
})();