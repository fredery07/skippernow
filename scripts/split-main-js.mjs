import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "skippernow-main.js"), "utf8");
const lines = source.match(/.*(?:\n|$)/g).filter(Boolean);
const outDir = path.join(root, "main-parts");
fs.mkdirSync(outDir, { recursive: true });
for (const name of fs.readdirSync(outDir)) if (/^part-\d+\.js$/.test(name)) fs.unlinkSync(path.join(outDir, name));

const target = 48000;
const parts = [];
let start = 0;
while (start < lines.length) {
  let chars = 0;
  let ideal = start;
  while (ideal < lines.length && chars < target) chars += lines[ideal++].length;
  let end = Math.min(ideal, lines.length);
  let chunk = "";
  while (end > start) {
    chunk = lines.slice(start, end).join("");
    try { new vm.Script(chunk); break; } catch { end--; }
  }
  if (end === start) {
    end = ideal;
    while (end <= lines.length) {
      chunk = lines.slice(start, end).join("");
      try { new vm.Script(chunk); break; } catch { end++; }
    }
  }
  if (!chunk || end > lines.length) throw new Error(`Impossible de découper le script à partir de la ligne ${start + 1}`);
  parts.push(chunk);
  start = end;
}

parts.forEach((part, index) => {
  const banner = index === 0 ? "" : '"use strict";\n';
  fs.writeFileSync(path.join(outDir, `part-${String(index + 1).padStart(2, "0")}.js`), banner + part);
});

console.log(`${parts.length} fichiers générés, maximum ${Math.max(...parts.map(x => x.length))} caractères.`);
