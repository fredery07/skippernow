import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = "https://skippernow.fr";

const destinations = [
  {lang:"es",city:"Barcelona",slug:"barcelona",ports:"Port Olímpic, Port Vell y Marina Vela",area:"la costa de Barcelona, el Maresme y Sitges"},
  {lang:"es",city:"Ibiza",slug:"ibiza",ports:"Marina Ibiza, Marina Botafoch y Santa Eulària",area:"Formentera, Cala Comte y Es Vedrà"},
  {lang:"es",city:"Palma de Mallorca",slug:"palma-de-mallorca",ports:"Real Club Náutico de Palma, Marina Port de Mallorca y Port Calanova",area:"la bahía de Palma, Illetes y la costa de Tramuntana"},
  {lang:"en",city:"Miami",slug:"miami",ports:"Miami Beach Marina, Dinner Key Marina and Sea Isle Marina",area:"Biscayne Bay, Key Biscayne and the Miami skyline"},
  {lang:"en",city:"Fort Lauderdale",slug:"fort-lauderdale",ports:"Bahia Mar, Las Olas Marina and Pier Sixty-Six",area:"the Intracoastal Waterway, Port Everglades and the Atlantic coast"},
  {lang:"en",city:"Key West",slug:"key-west",ports:"Key West Bight, Stock Island Marina Village and Garrison Bight",area:"the Lower Keys, nearby sandbars and the Gulf waters"}
];

const types = [
  {key:"captain",esPrefix:"patron-barco",enPrefix:"boat-captain"},
  {key:"service",esPrefix:"servicios-nauticos",enPrefix:"marine-services"}
];

const css = `:root{--navy:#071d32;--blue:#0d6672;--aqua:#39d1c5;--paper:#faf7ef;--ink:#102b3f;--muted:#5d707b;--line:#dce8e9;--display:'Fraunces',Georgia,serif}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,system-ui,sans-serif;line-height:1.65}.shell{max-width:980px;margin:auto;padding:0 24px}header{height:72px;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center}nav{display:flex;align-items:center;justify-content:space-between}.logo{font-size:22px;font-weight:900;color:var(--navy);text-decoration:none}.hero{padding:58px 0;background:linear-gradient(135deg,#071d32,#0d6672);color:#fff}.crumb,.crumb a{color:#bdd5d5;font-size:13px}.eyebrow{display:block;margin-top:17px;color:#e4c581;font-weight:800;font-size:12px;letter-spacing:.12em;text-transform:uppercase}h1,h2{font-family:var(--display)}h1{font-size:clamp(34px,5vw,50px);line-height:1.08;margin:12px 0}.hero p{max-width:720px;color:#e1efef;font-size:17px}.actions,.links{display:flex;gap:11px;flex-wrap:wrap;margin-top:22px}.btn{display:inline-block;border-radius:12px;padding:13px 18px;background:var(--aqua);color:var(--navy);font-weight:900;text-decoration:none}.btn.alt{background:#fff}.main{padding-top:42px;padding-bottom:42px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.card,.faq{background:#fff;border:1px solid var(--line);border-radius:17px;padding:22px}.card h2{margin-top:0}.faq{margin:10px 0}.faq h3{margin:0 0 7px}.cta{margin:38px 0;padding:28px;border-radius:20px;background:var(--navy);color:#fff;text-align:center}.cta h2{margin-top:0}.links a{padding:8px 12px;border-radius:999px;background:#eef8f7;color:var(--blue);font-weight:800;text-decoration:none}footer{padding:28px 0;border-top:1px solid var(--line);color:var(--muted)}@media(max-width:680px){.grid{grid-template-columns:1fr}.hero{padding:44px 0}}`;

function copy(d,type){
  const es=d.lang==="es";
  const captain=type.key==="captain";
  if(es){
    return captain ? {
      title:`Patrón de barco en ${d.city} | SkipperNow`, h1:`Encontrar patrón de barco en ${d.city}`,
      desc:`Reserva un patrón profesional en ${d.city} para una salida, entrega o manejo del barco. Solicitud gratuita y precio propuesto antes del pago.`,
      badge:`Patrones profesionales · ${d.ports}`, action:"Buscar un patrón", activity:"skipper",
      first:`Un patrón local puede acompañarte desde ${d.ports} para navegar por ${d.area}. Indica la fecha, la duración y el tipo de barco para recibir una propuesta adaptada.`,
      pro:"¿Eres patrón profesional? Registra tu perfil, añade tus puertos de trabajo y recibe solicitudes locales sin mezclar tu servicio con los barcos de alquiler.",
      faq:[[`¿Para qué servicios puedo contratar un patrón en ${d.city}?`,`Salidas privadas, manejo del barco, acompañamiento y entregas, según la experiencia y las titulaciones del profesional.`],["¿Quién fija el precio?","El patrón propone libremente su tarifa. El cliente puede aceptarla o rechazarla antes del pago."],["¿Dónde puede empezar el servicio?",`La solicitud puede indicar ${d.ports} u otro puerto cercano.`]]
    } : {
      title:`Servicios náuticos en ${d.city} | SkipperNow`, h1:`Prestadores de servicios náuticos en ${d.city}`,
      desc:`Encuentra profesionales para limpieza, preparación, aprovisionamiento y mantenimiento de barcos en ${d.city}. Solicitud gratuita en SkipperNow.`,
      badge:`Servicios náuticos · ${d.ports}`, action:"Solicitar un servicio", activity:"service",
      first:`Describe el trabajo, el barco y el puerto alrededor de ${d.ports}. Los profesionales disponibles pueden estudiar las fotos y proponer su propio precio.`,
      pro:"¿Ofreces servicios náuticos? Crea tu perfil, selecciona los puertos donde trabajas y presenta tus servicios a propietarios y navegantes de la zona.",
      faq:[[`¿Qué servicios puedo solicitar en ${d.city}?`,`Limpieza, preparación, aprovisionamiento, asistencia en el muelle y mantenimiento, según los profesionales disponibles.`],["¿Puedo añadir fotos?","Sí. Las fotos ayudan al prestador a evaluar el trabajo y preparar una oferta más precisa."],["¿El prestador aparece como barco de alquiler?","No. Los barcos, los patrones y los prestadores se muestran en categorías diferentes."]]
    };
  }
  return captain ? {
    title:`Boat Captain in ${d.city} | SkipperNow`, h1:`Find a boat captain in ${d.city}`,
    desc:`Book a professional boat captain in ${d.city} for a private trip, boat handling or delivery. Free request and quote before payment.`,
    badge:`Professional captains · ${d.ports}`, action:"Find a captain", activity:"skipper",
    first:`A local captain can join you from ${d.ports} to navigate ${d.area}. Add your date, duration and boat details to receive a suitable quote.`,
    pro:"Are you a professional captain? Create your profile, add the marinas where you work and receive local requests separately from boat rental listings.",
    faq:[[`What can I hire a captain for in ${d.city}?`,`Private outings, boat handling, local guidance and deliveries, depending on the professional's experience and credentials.`],["Who sets the price?","The captain submits a quote. The customer chooses whether to accept it before payment."],["Where can the trip start?",`Your request can specify ${d.ports} or another nearby marina.`]]
  } : {
    title:`Marine Services in ${d.city} | SkipperNow`, h1:`Find marine service providers in ${d.city}`,
    desc:`Find boat cleaning, preparation, provisioning and maintenance professionals in ${d.city}. Send a free request on SkipperNow.`,
    badge:`Marine services · ${d.ports}`, action:"Request a service", activity:"service",
    first:`Describe the job, boat and marina around ${d.ports}. Available professionals can review your photos and submit their own quote.`,
    pro:"Do you provide marine services? Create your profile, select the marinas you cover and present your services to local boat owners and customers.",
    faq:[[`Which marine services can I request in ${d.city}?`,`Cleaning, boat preparation, provisioning, dock assistance and maintenance, depending on provider availability.`],["Can I add photos?","Yes. Photos help providers assess the work and prepare a more accurate quote."],["Are providers mixed with rental boats?","No. Boats, captains and marine service providers remain in separate categories."]]
  };
}

function render(d,type){
  const c=copy(d,type), es=d.lang==="es";
  const prefix=es?type.esPrefix:type.enPrefix;
  const slug=`${prefix}-${d.slug}`;
  const canonical=`${site}/${slug}/`;
  const home=es?"Inicio":"Home", other=es?"Otras soluciones en esta zona":"Other options in this area";
  const rentalSlug=es?`alquiler-barcos-${d.slug}`:`boat-rental-${d.slug}`;
  const captainSlug=es?`patron-barco-${d.slug}`:`boat-captain-${d.slug}`;
  const serviceSlug=es?`servicios-nauticos-${d.slug}`:`marine-services-${d.slug}`;
  const schema={"@context":"https://schema.org","@graph":[{"@type":"Service","name":c.h1,"description":c.desc,"provider":{"@type":"Organization","name":"SkipperNow","url":site+"/"},"areaServed":{"@type":"City","name":d.city},"url":canonical},{"@type":"FAQPage","mainEntity":c.faq.map(([q,a])=>({"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}}))}]};
  return `<!doctype html>\n<html lang="${d.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${c.title}</title><meta name="description" content="${c.desc}"><link rel="canonical" href="${canonical}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="icon" href="/skippernow-icon.svg"><meta property="og:type" content="website"><meta property="og:site_name" content="SkipperNow"><meta property="og:title" content="${c.title}"><meta property="og:description" content="${c.desc}"><meta property="og:url" content="${canonical}"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet"><style>${css}</style><script type="application/ld+json">${JSON.stringify(schema)}</script><script src="/analytics.js" defer></script></head><body><header><nav class="shell"><a class="logo" href="/">⚓ SkipperNow</a><a href="/">${home}</a></nav></header><section class="hero"><div class="shell"><div class="crumb"><a href="/">${home}</a> / ${c.h1}</div><span class="eyebrow">${c.badge}</span><h1>${c.h1}</h1><p>${c.desc}</p><div class="actions"><a class="btn" href="/?port=${encodeURIComponent(d.city)}&activity=${c.activity}&source=seo">${c.action}</a><a class="btn alt" href="/?port=${encodeURIComponent(d.city)}&activity=${c.activity}&source=pro_signup">${es?"Registrarme como profesional":"Join as a professional"}</a></div></div></section><main class="shell main"><div class="grid"><article class="card"><h2>${es?"Una solicitud local y precisa":"A clear local request"}</h2><p>${c.first}</p></article><article class="card"><h2>${es?"Profesionales visibles en sus puertos":"Professionals visible by marina"}</h2><p>${c.pro}</p></article></div><h2>${es?"Preguntas frecuentes":"Frequently asked questions"}</h2>${c.faq.map(([q,a])=>`<article class="faq"><h3>${q}</h3><p>${a}</p></article>`).join("")}<section class="cta"><h2>${c.action}</h2><p>${es?"Envía tu solicitud gratis y recibe una propuesta adaptada.":"Send a free request and receive a suitable quote."}</p><a class="btn" href="/?port=${encodeURIComponent(d.city)}&activity=${c.activity}&source=seo">${c.action}</a></section><h2>${other}</h2><div class="links"><a href="/${rentalSlug}/">${es?"Alquiler de barcos":"Boat rental"}</a><a href="/${captainSlug}/">${es?"Patrones":"Captains"}</a><a href="/${serviceSlug}/">${es?"Servicios náuticos":"Marine services"}</a></div></main><footer><div class="shell">© 2026 SkipperNow</div></footer></body></html>\n`;
}

for(const destination of destinations){
  for(const type of types){
    const prefix=destination.lang==="es"?type.esPrefix:type.enPrefix;
    const dir=path.join(root,`${prefix}-${destination.slug}`);
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,"index.html"),render(destination,type));
  }
}

console.log(`${destinations.length*types.length} pages internationales professionnelles générées.`);
