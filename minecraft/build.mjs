/**
 * Minecraft JS — assemblage en un fichier unique.
 *
 *   node minecraft/build.mjs        →  minecraft/minecraft.html
 *
 * Les modules restent la source de vérité ; ce script les recopie dans un seul
 * fichier HTML, avec la feuille de style, pour qu'on puisse le télécharger et
 * l'ouvrir d'un double-clic (y compris en file://, où les modules ES sont
 * refusés par le navigateur).
 *
 * Chaque module garde sa portée grâce à une fonction : les noms internes
 * identiques d'un fichier à l'autre (« ID », « el », « GRAVITY »…) ne se
 * marchent pas dessus, exactement comme avec de vrais modules.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, 'src');
const ENTRY = 'main.js';

/* ─────────────────────── Lecture et analyse des modules ─────────────────────── */

const IMPORT_RE = /^[ \t]*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?[ \t]*\n?/gm;

/** Découpe un module : ses dépendances, son code sans les `import`. */
function parse(name) {
  const code = readFileSync(resolve(SRC, name), 'utf8');
  const deps = [];
  const body = code.replace(IMPORT_RE, (_, spec, from) => {
    const dep = basename(from);
    deps.push(dep);
    const clause = spec.trim();
    if (!clause.startsWith('{')) {
      throw new Error(`${name} : seuls les imports nommés sont gérés (« ${clause} »)`);
    }
    // { a, b as c } → const { a, b: c } = …
    const names = clause.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => s.replace(/\s+as\s+/, ': '));
    return `const { ${names.join(', ')} } = __m['${dep}'];\n`;
  });
  return { name, deps, body };
}

/** Noms exportés, et code débarrassé du mot-clé `export`. */
function stripExports(body, name) {
  const exported = new Set();

  // export { A, B };
  let out = body.replace(/^[ \t]*export\s*\{([^}]*)\};?[ \t]*$/gm, (_, list) => {
    for (const raw of list.split(',')) {
      const n = raw.trim().split(/\s+as\s+/).pop();
      if (n) exported.add(n);
    }
    return '';
  });

  // export const/let/function/class/async function
  out = out.replace(/^[ \t]*export\s+(async\s+function|function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
    (_, kind, n) => { exported.add(n); return `${kind} ${n}`; });

  if (/^\s*export\s/m.test(out)) {
    const reste = out.match(/^\s*export\s.*/m)[0];
    throw new Error(`${name} : forme d'export non gérée → ${reste.trim()}`);
  }
  return { code: out, exported: [...exported] };
}

/** Ordre de chargement : une dépendance est toujours écrite avant son utilisateur. */
function order(entry) {
  const mods = new Map();
  const sorted = [];
  const state = new Map();   // 0 = en cours, 1 = fini

  const visit = (name, from) => {
    if (state.get(name) === 1) return;
    if (state.get(name) === 0) throw new Error(`dépendance circulaire : ${from} ↔ ${name}`);
    state.set(name, 0);
    const mod = parse(name);
    mods.set(name, mod);
    for (const d of mod.deps) visit(d, name);
    state.set(name, 1);
    sorted.push(mod);
  };

  visit(entry, '(racine)');
  return sorted;
}

/* ─────────────────────────────── Assemblage ─────────────────────────────── */

const modules = order(ENTRY);
const chunks = [];
for (const mod of modules) {
  const { code, exported } = stripExports(mod.body, mod.name);
  chunks.push(
    `/* ══════ ${mod.name} ══════ */\n`
    + `__m['${mod.name}'] = (function () {\n${code}\n`
    + `return { ${exported.join(', ')} };\n})();\n`,
  );
}

const css = readFileSync(resolve(HERE, 'style.css'), 'utf8');
const script = `(function () {
'use strict';
const __m = Object.create(null);

${chunks.join('\n')}
})();`;

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/>
<title>Minecraft JS — un bac à sable de voxels dans le navigateur</title>
<meta name="description" content="Recréation de Minecraft en JavaScript : monde infini généré par bruit de Perlin, lumière dynamique, artisanat, créatures, survie et mode créatif. Un seul fichier, aucune dépendance."/>
<meta name="theme-color" content="#1a1a1a"/>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%238a6543'/%3E%3Crect width='16' height='5' fill='%2379c05a'/%3E%3C/svg%3E"/>
<!--
  Minecraft JS — fichier unique, engendré par minecraft/build.mjs.
  Ne pas modifier ici : les sources sont dans minecraft/src/.
  Aucune dépendance, aucune image, aucun son : les textures sont peintes au
  démarrage et les bruitages synthétisés par Web Audio.
-->
<style>
${css}
</style>
</head>
<body>
  <canvas id="game" tabindex="0"></canvas>
  <div id="ui"></div>
  <div id="menu" class="menu"></div>
  <noscript>Ce jeu a besoin de JavaScript et de WebGL2.</noscript>
<script>
${script}
</script>
</body>
</html>
`;

const outPath = resolve(HERE, 'minecraft.html');
writeFileSync(outPath, html);

const ko = (n) => `${(n / 1024).toFixed(0)} Ko`;
console.log(`${modules.length} modules assemblés → ${basename(outPath)} (${ko(html.length)})`);
console.log(`ordre : ${modules.map((m) => m.name.replace('.js', '')).join(' → ')}`);
