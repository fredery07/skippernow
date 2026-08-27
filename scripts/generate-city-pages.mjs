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
footer{border-top:1px solid
