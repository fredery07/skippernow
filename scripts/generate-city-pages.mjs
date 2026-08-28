// Génère automatiquement les pages SEO locales (skipper-<ville> et
// location-bateau-<ville>) à partir des données réelles de Supabase :
// une page n'est créée que s'il existe au moins un skipper/prestataire
// vérifié (pour "skipper-<ville>") ou au moins un bateau (pour
// "location-bateau-<ville>") dans cette ville.
//
// Lancé par le workflow GitHub Actions .github/workflows/generate-city-pages.yml
// Usage: node scripts/generate-city-pages.mjs

import fs from "fs";
import path from "path";

const SUPABASE_URL = "https://pzvlarwsfvhenrniepkw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_OxikOn1mhDcxkAVAucN5Lg_za-bJMS5";
const SITE_URL = "https://skippernow.fr";
const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");

// Ces 5 villes ont déjà une page écrite à la main (contenu plus riche) :
// on ne les régénère jamais automatiquement pour ne pas les écraser.
const STATIC_CITIES = new Set(["cannes", "antibes", "nice", "monaco", "saint-tropez"]);

// Pages Espagne écrites à la main (contenu SEO riche, en espagnol) : jamais
// régénérées ni supprimées, et toujours incluses dans le sitemap.
const STATIC_ES_PAGES = [
  "alquiler-barcos-empuriabrava",
  "alquiler-barcos-roses",
  "alquiler-barcos-barcelona",
  "alquiler-barcos-ibiza",
  "alquiler-barcos-palma-de-mallorca",
  "alquiler-barcos-marbella"
];

// Pages Floride/États-Unis écrites à la main (contenu SEO riche, en anglais) :
// même protection que les pages Espagne — jamais régénérées ni supprimées,
// toujours incluses dans le sitemap.
const STATIC_US_PAGES = [
  "boat-rental-miami",
  "boat-rental-miami-beach",
  "boat-rental-fort-lauderdale",
  "boat-rental-key-west",
  "boat-rental-islamorada",
  "boat-rental-palm-beach",
  "boat-rental-naples"
];

// Pages Bahamas écrites à la main (contenu SEO riche, en anglais) : même
// protection — jamais régénérées ni supprimées, toujours dans le sitemap.
const STATIC_BS_PAGES = [
  "boat-rental-nassau",
  "boat-rental-exuma",
  "boat-rental-freeport",
  "boat-rental-abaco",
  "boat-rental-bimini"
];

// Pages Porto Rico écrites à la main (contenu SEO riche, en anglais) : même
// protection — jamais régénérées ni supprimées, toujours dans le sitemap.
const STATIC_PR_PAGES = [
  "boat-rental-san-juan",
  "boat-rental-fajardo",
  "boat-rental-culebra",
  "boat-rental-vieques"
];

// Pages République dominicaine écrites à la main (contenu SEO riche, en
// espagnol, orienté excursions) : même protection — jamais régénérées ni
// supprimées, toujours dans le sitemap.
const STATIC_DO_PAGES = [
  "excursiones-las-terrenas",
  "excursiones-samana",
  "excursiones-punta-cana",
  "excursiones-puerto-plata"
];

// Pages Grèce écrites à la main (contenu SEO riche, en anglais) : même
// protection — jamais régénérées ni supprimées, toujours dans le sitemap.
const STATIC_GR_PAGES = [
  "boat-rental-athens",
  "boat-rental-mykonos",
  "boat-rental-santorini",
  "boat-rental-corfu"
];

// Pages Italie écrites à la main (contenu SEO riche, en italien, format
// location de bateau + skipper comme la Grèce) : même protection — jamais
// régénérées ni supprimées, toujours dans le sitemap.
const STATIC_IT_PAGES = [
  "noleggio-barche-portofino",
  "noleggio-barche-positano",
  "noleggio-barche-capri",
  "noleggio-barche-costa-smeralda"
];

function slugify(str) {
  return str
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Normalise un champ "home_port" saisi librement en un nom de ville
// plausible. Retourne null si la valeur ne ressemble pas à un lieu réel
// (trop courte, chiffres, mots-clés suspects), pour éviter de générer
// des pages avec des données sales.
function extractCity(raw) {
  if (!raw) return null;
  const first = raw.split(",")[0].trim();
  const cleaned = first.replace(/^(port|marina|vieux[- ]port|quai)\s+(de |d'|du |des )?/i, "").trim();
  const candidate = cleaned || first;
  if (candidate.length < 3 || candidate.length > 40) return null;
  if (!/^[a-zA-ZÀ-ÿ' -]+$/.test(candidate)) return null;
  if (/^(test|admin|xxx|na|n\/a)$/i.test(candidate)) return null;
  return candidate.replace(/\b\w/g, c => c.toUpperCase());
}

async function fetchTable(table, params) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  if (!res.ok) throw new Error(`Supabase ${table} fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

const BASE_CSS = `
:root{--navy:#071d32;--blue:#0d6672;--aqua:#39d1c5;--mist:#eef8f7;--ink:#102b3f;--muted:#647784;--line:#dce8e9;--brass:#b6883a;--brass-light:#e4c581;--paper:#faf7ef;--display:'Fraunces',Georgia,serif}
*{box-sizing:border-box}
body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:var(--paper);line-height:1.6}
a{color:var(--blue)}
.shell{max-width:980px;margin:auto;padding:0 24px}
header{height:76px;background:rgba(255,255,255,.96);display:flex;align-items:center;position:sticky;top:0;z-index:30;border-bottom:1px solid var(--line)}
nav{display:flex;align-items:center;justify-content:space-between;width:100%;max-width:1180px;margin:auto;padding:0 24px}
.logo{display:flex;align-items:center;gap:10px;font-weight:900;font-size:22px;color:var(--navy);text-decoration:none}
.mark{width:38px;height:38px;border-radius:11px;background:var(--navy);display:grid;place-items:center;color:var(--aqua);font-size:17px}
.nav-links{display:flex;gap:22px;font-weight:700;font-size:14.5px}
.nav-links a{color:var(--ink);text-decoration:none}
.primary{display:inline-block;border:0;background:var(--navy);color:#fff;border-radius:12px;padding:13px 20px;font-weight:800;text-decoration:none}
.hero{background:linear-gradient(135deg,#071d32 0%,#0d4551 66%,#157d80 100%);color:#fff;padding:60px 0 56px}
.eyebrow{display:inline-flex;color:var(--brass-light);font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:12px}
.hero h1{font-family:var(--display);font-weight:600;font-size:clamp(30px,4.6vw,46px);line-height:1.12;margin:16px 0}
.hero p{max-width:640px;font-size:17px;color:#dfeeee}
.breadcrumb{font-size:13px;color:#b9d0d0;margin-bottom:6px}
.breadcrumb a{color:#b9d0d0}
main{padding:48px 0 20px}
h2{font-family:var(--display);font-size:26px;color:var(--navy);margin:38px 0 12px}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px}
.cta-box{background:var(--mist);border-radius:20px;padding:28px;margin:36px 0;text-align:center}
footer{border-top:1px solid var(--line);margin-top:48px;padding:28px 0;color:var(--muted);font-size:13.5px}
footer a{color:var(--muted);margin-right:16px;text-decoration:none}
`;

function pageHtml({ title, desc, canonical, breadcrumbLabel, h1, intro, ctaHref, ctaLabel, serviceType, cityName }) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index,follow">
<link rel="icon" href="/skippernow-icon.svg">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SkipperNow">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${canonical}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;500;700;800;900&display=swap" rel="stylesheet">
<style>${BASE_CSS}</style>
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL + "/" },
    { "@type": "ListItem", position: 2, name: breadcrumbLabel, item: canonical }
  ]
})}</script>
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org", "@type": "Service",
  serviceType, provider: { "@type": "Organization", name: "SkipperNow", url: SITE_URL + "/" },
  areaServed: { "@type": "City", name: cityName }, url: canonical
})}</script>
</head>
<body>
<header><nav>
  <a class="logo" href="/"><span class="mark">⚓</span>SkipperNow</a>
  <div class="nav-links"><a href="/">Accueil</a><a href="/#destinations">Destinations</a></div>
</nav></header>
<section class="hero">
  <div class="shell">
    <div class="breadcrumb"><a href="/">Accueil</a> / ${breadcrumbLabel}</div>
    <span class="eyebrow">${serviceType}</span>
    <h1>${h1}</h1>
    <p>${intro}</p>
    <p style="margin-top:26px"><a class="primary" href="${ctaHref}">${ctaLabel}</a></p>
  </div>
</section>
<main class="shell">
  <div class="cta-box">
    <h2>${ctaLabel}</h2>
    <a class="primary" href="${ctaHref}">${ctaLabel}</a>
  </div>
  <p><a href="/">← Retour à la recherche SkipperNow</a></p>
</main>
<footer><div class="shell">
  <a href="/">Accueil</a><a href="/#legal">Mentions légales</a><span>&copy; 2026 SkipperNow.</span>
</div></footer>
</body>
</html>
`;
}

function buildSkipperPage(city) {
  const slug = slugify(city);
  const canonical = `${SITE_URL}/skipper-${slug}/`;
  return pageHtml({
    title: `Skipper à ${city} | Réserver un skipper professionnel – SkipperNow`,
    desc: `Trouvez et réservez un skipper professionnel à ${city} avec SkipperNow : profils vérifiés, recherche par port et paiement sécurisé.`,
    canonical,
    breadcrumbLabel: `Skipper à ${city}`,
    h1: `Trouver un skipper à ${city}`,
    intro: `Réservez un skipper professionnel disponible à ${city} pour une sortie en mer, une location avec équipage ou un convoyage, avec profils vérifiés et paiement sécurisé sur SkipperNow.`,
    ctaHref: `/?port=${encodeURIComponent(city)}&activity=skipper`,
    ctaLabel: `Voir les skippers à ${city}`,
    serviceType: "Location de skipper professionnel",
    cityName: city
  });
}

function buildRentalPage(city) {
  const slug = slugify(city);
  const canonical = `${SITE_URL}/location-bateau-${slug}/`;
  return pageHtml({
    title: `Location de bateau à ${city} | SkipperNow`,
    desc: `Louez un bateau à ${city} avec SkipperNow : annonces de propriétaires, réservation en ligne et paiement sécurisé avec caution.`,
    canonical,
    breadcrumbLabel: `Location de bateau à ${city}`,
    h1: `Louer un bateau à ${city}`,
    intro: `Parcourez les bateaux proposés à la location par leurs propriétaires à ${city} et réservez en ligne avec paiement sécurisé et caution définie par chaque propriétaire.`,
    ctaHref: `/?port=${encodeURIComponent(city)}&activity=boat_rental`,
    ctaLabel: `Voir les bateaux à ${city}`,
    serviceType: "Location de bateau",
    cityName: city
  });
}

async function main() {
  // Ne prendre en compte que les profils/bateaux créés à partir de la mise en
  // place de l'autocomplétion du port (17 août 2026) : les fiches plus
  // anciennes ont un champ "port" en texte libre non fiable et doivent être
  // corrigées manuellement avant d'être incluses.
  const CUTOFF_DATE = "2026-08-17";

  const profiles = await fetchTable(
    "profiles",
    `select=home_port,role,created_at&verified=eq.true&role=in.(skipper,provider)&created_at=gte.${CUTOFF_DATE}`
  );
  const boats = await fetchTable("boats", `select=home_port,created_at&created_at=gte.${CUTOFF_DATE}`);

  const skipperCities = new Map(); // slug -> display name
  for (const p of profiles) {
    const city = extractCity(p.home_port);
    if (!city) continue;
    const slug = slugify(city);
    if (STATIC_CITIES.has(slug)) continue;
    if (!skipperCities.has(slug)) skipperCities.set(slug, city);
  }

  const rentalCities = new Map();
  for (const b of boats) {
    const city = extractCity(b.home_port);
    if (!city) continue;
    const slug = slugify(city);
    if (STATIC_CITIES.has(slug)) continue;
    if (!rentalCities.has(slug)) rentalCities.set(slug, city);
  }

  let created = 0;
  for (const [slug, city] of skipperCities) {
    const dir = path.join(ROOT, `skipper-${slug}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), buildSkipperPage(city));
    created++;
  }
  for (const [slug, city] of rentalCities) {
    const dir = path.join(ROOT, `location-bateau-${slug}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), buildRentalPage(city));
    created++;
  }

  // Reconstruit le sitemap : les 5 pages statiques + toutes les pages
  // dynamiques trouvées ci-dessus.
  const urls = [`${SITE_URL}/`];
  for (const c of ["cannes", "antibes", "nice", "monaco", "saint-tropez"]) {
    urls.push(`${SITE_URL}/skipper-${c}/`, `${SITE_URL}/location-bateau-${c}/`);
  }
  for (const slug of skipperCities.keys()) urls.push(`${SITE_URL}/skipper-${slug}/`);
  for (const slug of rentalCities.keys()) urls.push(`${SITE_URL}/location-bateau-${slug}/`);
  for (const slug of STATIC_ES_PAGES) urls.push(`${SITE_URL}/${slug}/`);
  for (const slug of STATIC_US_PAGES) urls.push(`${SITE_URL}/${slug}/`);
  for (const slug of STATIC_BS_PAGES) urls.push(`${SITE_URL}/${slug}/`);
  for (const slug of STATIC_PR_PAGES) urls.push(`${SITE_URL}/${slug}/`);
  for (const slug of STATIC_DO_PAGES) urls.push(`${SITE_URL}/${slug}/`);
  for (const slug of STATIC_GR_PAGES) urls.push(`${SITE_URL}/${slug}/`);
  for (const slug of STATIC_IT_PAGES) urls.push(`${SITE_URL}/${slug}/`);

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(u => `  <url><loc>${u}</loc><changefreq>weekly</changefreq></url>`)
    .join("\n")}\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap);

  console.log(`Pages skipper générées: ${skipperCities.size}`);
  console.log(`Pages location-bateau générées: ${rentalCities.size}`);
  console.log(`Fichiers écrits: ${created + 1} (dont sitemap.xml)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
