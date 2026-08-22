#!/usr/bin/env node
/**
 * Fabrique « losantos.html » : le jeu entier — 21 fichiers, la feuille de style
 * et tous les modules — réuni dans une seule page autonome.
 *
 * Pourquoi : un navigateur refuse de charger des modules JavaScript depuis
 * file:// (règle d'origine croisée). Un fichier unique avec tout en ligne
 * s'ouvre en revanche d'un simple double-clic, sans serveur ni connexion.
 *
 *   node game/build.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(DIR, 'src');
const ENTRY = 'main.js';

const IMPORT_RE = /^\s*import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]\s*;?\s*$/gm;
const EXPORT_DECL_RE = /^\s*export\s+(?=(?:const|let|var|function|class|async)\b)/gm;
const EXPORT_NAME_RE = /^\s*export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;

/** Lit un module et en extrait dépendances, exports et corps nettoyé. */
function readModule(rel) {
  const code = fs.readFileSync(path.join(SRC, rel), 'utf8');
  const deps = [];
  let body = code.replace(IMPORT_RE, (_m, names, from) => {
    const dep = path.posix.normalize(path.posix.join(path.posix.dirname(rel), from));
    deps.push(dep);
    const list = names.split(',').map((n) => n.trim()).filter(Boolean).join(', ');
    return `  const { ${list} } = __m[${JSON.stringify(dep)}];`;
  });
  const exports = [];
  let m;
  EXPORT_NAME_RE.lastIndex = 0;
  while ((m = EXPORT_NAME_RE.exec(code))) exports.push(m[1]);
  body = body.replace(EXPORT_DECL_RE, '');
  const leftover = body.match(/^\s*export\b/m);
  if (leftover) throw new Error(`${rel} : forme d'export non gérée -> ${leftover[0].trim()}`);
  return { rel, deps, exports, body };
}

/** Parcours en profondeur : les dépendances sont émises avant leurs utilisateurs. */
function order(entry) {
  const modules = new Map();
  const sorted = [];
  const state = new Map();                 // 1 = en cours, 2 = terminé
  const visit = (rel, stack) => {
    if (state.get(rel) === 2) return;
    if (state.get(rel) === 1) throw new Error(`cycle d'imports : ${[...stack, rel].join(' -> ')}`);
    state.set(rel, 1);
    const mod = modules.get(rel) || readModule(rel);
    modules.set(rel, mod);
    for (const d of mod.deps) visit(d, [...stack, rel]);
    state.set(rel, 2);
    sorted.push(mod);
  };
  visit(entry, []);
  return sorted;
}

/** Assemble la page autonome et la retourne (sans rien écrire sur le disque). */
export function buildStandalone() {
  const modules = order(ENTRY);
  const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(DIR, 'style.css'), 'utf8');

  const bundle = [
    '(() => {',
    '  "use strict";',
    '  const __m = Object.create(null);',
    ...modules.map((mod) => [
      `  /* ---------------------------------------------- ${mod.rel} */`,
      `  __m[${JSON.stringify(mod.rel)}] = (() => {`,
      mod.body.trimEnd(),
      `    return { ${mod.exports.join(', ')} };`,
      '  })();',
    ].join('\n')),
    '})();',
  ].join('\n');

  // Attention : on passe des fonctions à replace(). Avec une chaîne, les
  // séquences « $' » ou « $& » présentes dans le code seraient interprétées
  // comme des références au motif — le fichier produit serait tronqué.
  const page = html
    .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}\n</style>`)
    .replace('<script type="module" src="src/main.js"></script>', () => `<script>\n${bundle}\n</script>`)
    .replace('<title>', () => '<!-- Page autonome fabriquée par game/build.mjs — ne pas modifier à la main. -->\n<title>');

  if (page.includes('src/main.js') || page.includes('style.css')) {
    throw new Error('le remplacement des balises a échoué : index.html a changé de forme');
  }
  // garde-fou : le paquet doit être du JavaScript valide
  try {
    new Function(bundle);                  // eslint-disable-line no-new-func
  } catch (e) {
    throw new Error(`le paquet produit n'est pas valide : ${e.message}`);
  }
  return { page, count: modules.length };
}

export const OUTPUT = path.join(DIR, 'losantos.html');

// Exécution directe : on écrit le fichier.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { page, count } = buildStandalone();
  fs.writeFileSync(OUTPUT, page);
  console.log(`${path.relative(process.cwd(), OUTPUT)} — ${count} modules, ${(Buffer.byteLength(page) / 1024).toFixed(0)} Ko`);
}
