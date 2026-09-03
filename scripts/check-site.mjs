#!/usr/bin/env node
// Contrôle simple et rapide pour le dépôt SkipperNow (pas de dépendances).
//
// Vérifie :
//   1. La syntaxe de tous les scripts JS : fichiers .js/.mjs autonomes et
//      chaque bloc <script> (sans "src") embarqué dans les pages HTML.
//   2. Les IDs HTML en double dans le HTML statique de chaque page (une
//      vraie collision qui casserait getElementById/querySelector), et un
//      signalement à part (informatif) des IDs générés dynamiquement en JS
//      qui apparaissent plusieurs fois dans le fichier (souvent sans risque
//      si les deux rendus ne coexistent jamais dans le DOM en même temps).
//   3. Que chaque page HTML de production référence /analytics.js une seule
//      fois (jamais zéro pour les pages qui doivent suivre les visites,
//      jamais deux fois sur la même page), et que analytics.js existe bien.
//   4. Quelques références croisées HTML <-> JS basiques : les IDs cités en
//      dur dans document.querySelector("#...")/getElementById("...") dans le
//      script principal de index.html existent bien quelque part dans le
//      fichier (statique ou généré dynamiquement).
//
// Usage : node scripts/check-site.mjs
// Sort avec un code différent de 0 si une erreur bloquante est trouvée.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let errors = 0;
let warnings = 0;

function ok(msg){ console.log("  OK  " + msg); }
function fail(msg){ console.log(" FAIL " + msg); errors++; }
function warn(msg){ console.log(" WARN " + msg); warnings++; }

function walk(dir, exts, out = []){
  for(const entry of fs.readdirSync(dir, { withFileTypes: true })){
    if(entry.name === ".git" || entry.name === "node_modules" || entry.name === "archive") continue;
    const full = path.join(dir, entry.name);
    if(entry.isDirectory()) walk(full, exts, out);
    else if(exts.some(ext => entry.name.endsWith(ext))) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------
// 1. Syntaxe JavaScript
// ---------------------------------------------------------------------
console.log("\n== 1. Syntaxe JavaScript ==");

function checkJsSyntax(code, label, isModule){
  if(isModule){
    // Les modules ES (import/export) ne sont pas gérés par vm.Script : on
    // passe par `node --check` sur un fichier temporaire, ce qui utilise le
    // vrai parseur de Node (fiable aussi pour la syntaxe moderne).
    const tmpFile = path.join(os.tmpdir(), "skippernow-check-" + Date.now() + "-" + Math.random().toString(36).slice(2) + ".mjs");
    try{
      fs.writeFileSync(tmpFile, code);
      execFileSync(process.execPath, ["--check", tmpFile], { stdio: ["ignore", "pipe", "pipe"] });
      return true;
    }catch(err){
      const detail = (err.stderr ? err.stderr.toString() : err.message).split("\n").slice(0, 3).join(" ");
      fail(`${label}: ${detail}`);
      return false;
    }finally{
      try{ fs.unlinkSync(tmpFile); }catch(_e){}
    }
  }
  try{
    // new vm.Script() analyse la syntaxe sans exécuter le code.
    new vm.Script(code, { filename: label });
    return true;
  }catch(err){
    fail(`${label}: ${err.message}`);
    return false;
  }
}

for(const jsFile of walk(ROOT, [".js", ".mjs"])){
  const rel = path.relative(ROOT, jsFile);
  const code = fs.readFileSync(jsFile, "utf8");
  if(checkJsSyntax(code, rel, jsFile.endsWith(".mjs"))) ok(rel);
}

const htmlFiles = walk(ROOT, [".html"]);
for(const htmlFile of htmlFiles){
  const rel = path.relative(ROOT, htmlFile);
  const html = fs.readFileSync(htmlFile, "utf8");
  const JS_TYPES = new Set(["", "text/javascript", "application/javascript", "module"]);
  const allScriptTags = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
  let blockIndex = 0;
  let checked = 0;
  let allOk = true;
  for(const match of allScriptTags){
    const attrs = match[1];
    if(/\bsrc=/.test(attrs)) continue; // script externe, rien à parser ici
    const typeMatch = attrs.match(/\btype=["']([^"']*)["']/i);
    const type = typeMatch ? typeMatch[1].toLowerCase() : "";
    if(!JS_TYPES.has(type)) continue; // ex : application/ld+json, ce n'est pas du JS
    blockIndex++;
    const code = match[2];
    if(!code.trim()) continue;
    checked++;
    if(!checkJsSyntax(code, `${rel} <script #${blockIndex}>`)) allOk = false;
  }
  if(allOk && checked) ok(`${rel} (${checked} bloc(s) <script> inline)`);
}

// ---------------------------------------------------------------------
// 2. IDs HTML en double
// ---------------------------------------------------------------------
console.log("\n== 2. IDs HTML en double ==");

for(const htmlFile of htmlFiles){
  const rel = path.relative(ROOT, htmlFile);
  const html = fs.readFileSync(htmlFile, "utf8");

  // HTML statique uniquement : on retire le contenu des <script>...</script>
  // avant de chercher des attributs id="..." sur de vraies balises.
  const staticHtml = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  const staticIds = {};
  for(const m of staticHtml.matchAll(/\bid="([^"]+)"/g)){
    staticIds[m[1]] = (staticIds[m[1]] || 0) + 1;
  }
  const staticDupes = Object.entries(staticIds).filter(([, n]) => n > 1);
  if(staticDupes.length){
    fail(`${rel}: ID(s) HTML statique en double : ${staticDupes.map(([id,n])=>`${id} (x${n})`).join(", ")}`);
  }else{
    ok(`${rel}: aucun ID statique en double`);
  }

  // Signalement informatif : IDs qui apparaissent plusieurs fois dans tout
  // le fichier (y compris dans des template strings JS générées à
  // l'exécution). Ce n'est un vrai bug que si les deux rendus peuvent
  // coexister dans le DOM en même temps - à vérifier manuellement.
  const allIds = {};
  for(const m of html.matchAll(/\bid="([^"]+)"/g)){
    allIds[m[1]] = (allIds[m[1]] || 0) + 1;
  }
  const allDupes = Object.entries(allIds).filter(([id, n]) => n > 1 && !staticIds[id]);
  // IDs déjà comptés comme statiques en double sont déjà en fail ci-dessus.
  const dynamicDupesOnly = Object.entries(allIds).filter(([id, n]) => n > 1);
  if(dynamicDupesOnly.length){
    warn(`${rel}: ID(s) réutilisés dans le fichier (y compris HTML généré en JS) : ${dynamicDupesOnly.map(([id,n])=>`${id} (x${n})`).join(", ")} — vérifier qu'ils ne sont jamais présents dans le DOM en même temps.`);
  }
}

// ---------------------------------------------------------------------
// 3. Fichiers analytics
// ---------------------------------------------------------------------
console.log("\n== 3. Références à /analytics.js ==");

if(!fs.existsSync(path.join(ROOT, "analytics.js"))){
  fail("analytics.js est introuvable à la racine du dépôt.");
}else{
  ok("analytics.js présent à la racine.");
}

for(const htmlFile of htmlFiles){
  const rel = path.relative(ROOT, htmlFile);
  const html = fs.readFileSync(htmlFile, "utf8");
  const count = (html.match(/\/analytics\.js/g) || []).length;
  if(count === 0){
    warn(`${rel}: ne charge pas /analytics.js (normal seulement pour une page technique, ex. vérification Google).`);
  }else if(count > 1){
    fail(`${rel}: charge /analytics.js ${count} fois (devrait être une seule fois).`);
  }else{
    ok(`${rel}: charge /analytics.js une seule fois.`);
  }
}

// ---------------------------------------------------------------------
// 4. Références croisées HTML <-> JS (index.html)
// ---------------------------------------------------------------------
console.log("\n== 4. Références croisées HTML <-> JS (index.html) ==");

const indexPath = path.join(ROOT, "index.html");
if(fs.existsSync(indexPath)){
  const html = fs.readFileSync(indexPath, "utf8");
  const referenced = new Set();
  const idRefPattern = /(?:querySelector|querySelectorAll)\(\s*["'`]#([\w-]+)["'`]\s*\)|getElementById\(\s*["']([\w-]+)["']\s*\)/g;
  for(const m of html.matchAll(idRefPattern)){
    referenced.add(m[1] || m[2]);
  }
  const definedIds = new Set();
  for(const m of html.matchAll(/\bid="([^"]+)"/g)) definedIds.add(m[1]);
  for(const m of html.matchAll(/\bid='([^']+)'/g)) definedIds.add(m[1]);

  const missing = [...referenced].filter(id => !definedIds.has(id)).sort();
  if(missing.length){
    warn(`index.html: sélecteur(s) référencé(s) en JS sans id="..." correspondant trouvé dans le fichier : ${missing.join(", ")} (peut être un faux positif si l'ID est construit dynamiquement).`);
  }else{
    ok(`index.html: tous les sélecteurs #id littéraux référencés en JS existent dans le fichier (${referenced.size} vérifiés).`);
  }
}else{
  warn("index.html introuvable, étape 4 ignorée.");
}

// ---------------------------------------------------------------------
console.log(`\n== Résumé : ${errors} erreur(s), ${warnings} avertissement(s) ==`);
process.exit(errors > 0 ? 1 : 0);
