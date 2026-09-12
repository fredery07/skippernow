(function(){
  "use strict";
  if(window.__skippernowPartnersCarouselV3) return;
  window.__skippernowPartnersCarouselV3 = true;

  const HOME = location.pathname === "/" || location.pathname === "/index.html";
  if(!HOME) return;

  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let timer = null;
  let current = 0;
  let rows = [];

  function getDb(){
    try{ if(typeof db !== "undefined" && db?.from) return db; }catch(_e){}
    return window.db?.from ? window.db : null;
  }

  function waitForDb(timeout=15000){
    return new Promise(resolve=>{
      const started=Date.now();
      const tick=()=>{
        const d=getDb();
        if(d) return resolve(d);
        if(Date.now()-started>timeout) return resolve(null);
        setTimeout(tick,150);
      };
      tick();
    });
  }

  function installStyles(){
    if(document.getElementById("snPartnerCarouselV3Style")) return;
    const s=document.createElement("style");
    s.id="snPartnerCarouselV3Style";
    s.textContent=`
      #seaCarousel.sn-partner-carousel{cursor:default}
      #seaCarousel.sn-partner-carousel .sea-slide{display:block;text-decoration:none;color:inherit}
      #seaCarousel.sn-partner-carousel .sea-carousel-caption{max-width:72%;padding-right:10px}
      #seaCarousel.sn-partner-carousel .sn-pc-kicker{display:block;font-family:Inter,system-ui,sans-serif;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#f0cf88;margin-bottom:6px}
      #seaCarousel.sn-partner-carousel .sn-pc-title{display:block;font-size:28px;line-height:1.12}
      #seaCarousel.sn-partner-carousel .sn-pc-sub{display:block;font-family:Inter,system-ui,sans-serif;font-size:13px;line-height:1.4;margin-top:7px;color:#eef7f6;font-weight:600}
      #seaCarousel.sn-partner-carousel .sn-pc-badge{position:absolute;z-index:3;left:24px;top:22px;border-radius:999px;padding:7px 11px;background:rgba(255,250,239,.94);color:#76501b;font:900 10px/1 Inter,system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase;box-shadow:0 4px 16px rgba(0,0,0,.12)}
      #seaCarousel.sn-partner-carousel .sn-pc-arrow{position:absolute;z-index:4;top:50%;transform:translateY(-50%);width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.6);background:rgba(7,29,50,.42);backdrop-filter:blur(8px);color:#fff;font-size:22px;font-weight:800;display:grid;place-items:center;cursor:pointer;opacity:.88;transition:.2s}
      #seaCarousel.sn-partner-carousel .sn-pc-arrow:hover{background:rgba(7,29,50,.68);opacity:1}
      #seaCarousel.sn-partner-carousel .sn-pc-prev{left:18px}.sn-pc-next{right:18px}
      #seaCarousel.sn-partner-carousel .sea-carousel-dots span{cursor:pointer}
      @media(max-width:640px){#seaCarousel.sn-partner-carousel{height:300px}#seaCarousel.sn-partner-carousel .sea-carousel-caption{left:20px;bottom:22px;max-width:72%}#seaCarousel.sn-partner-carousel .sn-pc-title{font-size:22px}#seaCarousel.sn-partner-carousel .sn-pc-sub{font-size:12px}#seaCarousel.sn-partner-carousel .sn-pc-arrow{width:36px;height:36px;font-size:19px}.sn-pc-prev{left:10px!important}.sn-pc-next{right:10px!important}}
    `;
    document.head.appendChild(s);
  }

  function removeOldPartnerBlock(){
    document.querySelectorAll("[data-sn-p2-public]").forEach(el=>el.remove());
  }

  async function loadPartners(){
    const d=getDb();
    if(!d) return [];
    const {data,error}=await d.from("home_partners")
      .select("id,name,subtitle,image_url,link_url,badge,sponsored,sort_order,created_at")
      .eq("is_active",true)
      .order("sort_order",{ascending:true})
      .order("created_at",{ascending:true});
    if(error){ console.warn("partners-carousel-v3",error.message); return []; }
    return (data||[]).filter(x=>x.image_url);
  }

  function captionFor(p){
    const label=p.sponsored?"Sponsorisé":(p.badge||"Partenaire SkipperNow");
    return `<span class="sn-pc-kicker">${esc(label)}</span><span class="sn-pc-title">${esc(p.name)}</span>${p.subtitle?`<span class="sn-pc-sub">${esc(p.subtitle)}${p.link_url?" · Découvrir →":""}</span>`:""}`;
  }

  function show(index){
    if(!rows.length) return;
    current=(index+rows.length)%rows.length;
    const carousel=document.querySelector("#seaCarousel");
    if(!carousel) return;
    const slides=[...carousel.querySelectorAll(".sea-slide")];
    const dots=[...carousel.querySelectorAll(".sea-carousel-dots span")];
    slides.forEach((el,i)=>el.classList.toggle("active",i===current));
    dots.forEach((el,i)=>el.classList.toggle("active",i===current));
    const caption=carousel.querySelector(".sea-carousel-caption");
    if(caption) caption.innerHTML=captionFor(rows[current]);
    const badge=carousel.querySelector(".sn-pc-badge");
    if(badge) badge.textContent=rows[current].sponsored?"Sponsorisé":(rows[current].badge||"Partenaire");
  }

  function restart(){
    clearInterval(timer);
    if(rows.length<2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer=setInterval(()=>{ if(!document.hidden) show(current+1); },4800);
  }

  function render(){
    const carousel=document.querySelector("#seaCarousel");
    if(!carousel || !rows.length) return;
    carousel.classList.add("sn-partner-carousel");
    carousel.dataset.partnerCarousel="1";

    const track=carousel.querySelector(".sea-carousel-track");
    const caption=carousel.querySelector(".sea-carousel-caption");
    const dots=carousel.querySelector(".sea-carousel-dots");
    if(!track || !caption || !dots) return;

    track.innerHTML=rows.map((p,i)=>{
      const style=`background-image:url('${String(p.image_url).replace(/'/g,"%27")}')`;
      const rel=p.sponsored?"sponsored noopener noreferrer":"noopener noreferrer";
      return p.link_url
        ? `<a class="sea-slide${i===0?" active":""}" href="${esc(p.link_url)}" target="_blank" rel="${rel}" style="${style}" aria-label="${esc(p.name)}"></a>`
        : `<div class="sea-slide${i===0?" active":""}" style="${style}" aria-label="${esc(p.name)}"></div>`;
    }).join("");

    dots.innerHTML=rows.map((_,i)=>`<span class="${i===0?"active":""}" data-sn-pc-dot="${i}" aria-label="Partenaire ${i+1}"></span>`).join("");
    caption.removeAttribute("data-i18n");
    caption.innerHTML=captionFor(rows[0]);

    carousel.querySelector(".sn-pc-badge")?.remove();
    carousel.querySelectorAll(".sn-pc-arrow").forEach(x=>x.remove());
    const badge=document.createElement("span");
    badge.className="sn-pc-badge";
    badge.textContent=rows[0].sponsored?"Sponsorisé":(rows[0].badge||"Partenaire");
    carousel.appendChild(badge);

    if(rows.length>1){
      const prev=document.createElement("button"); prev.type="button"; prev.className="sn-pc-arrow sn-pc-prev"; prev.innerHTML="‹"; prev.setAttribute("aria-label","Partenaire précédent");
      const next=document.createElement("button"); next.type="button"; next.className="sn-pc-arrow sn-pc-next"; next.innerHTML="›"; next.setAttribute("aria-label","Partenaire suivant");
      prev.onclick=e=>{e.preventDefault();e.stopPropagation();show(current-1);restart();};
      next.onclick=e=>{e.preventDefault();e.stopPropagation();show(current+1);restart();};
      carousel.append(prev,next);
    }

    dots.querySelectorAll("[data-sn-pc-dot]").forEach(dot=>dot.onclick=()=>{show(Number(dot.dataset.snPcDot));restart();});
    carousel.onmouseenter=()=>clearInterval(timer);
    carousel.onmouseleave=()=>restart();
    show(0);
    restart();
  }

  async function boot(){
    installStyles();
    await waitForDb();
    rows=await loadPartners();
    if(!rows.length) return;
    removeOldPartnerBlock();
    render();
    const obs=new MutationObserver(()=>removeOldPartnerBlock());
    obs.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();
