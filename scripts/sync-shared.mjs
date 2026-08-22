/**
 * Le serveur doit appliquer EXACTEMENT les mêmes règles de compatibilité et de
 * priorité que l'application. Plutôt que de réécrire cette logique deux fois —
 * et de la voir diverger au premier ajustement — on copie les deux fichiers
 * purs dans functions/shared/.
 *
 * Un test vérifie que les copies sont à jour : voir tests/core.test.mjs.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SHARED = ['core.js', 'config.js'];
const BANNIERE = '/* Copie automatique de src/%s — ne pas modifier ici. */\n'
  + '/* Régénérer avec : npm run sync                                */\n';

export function sharedContent(name) {
  return BANNIERE.replace('%s', name.padEnd(9)) + readFileSync(path.join(ROOT, 'src', name), 'utf8');
}

export function sharedPath(name) {
  return path.join(ROOT, 'functions', 'shared', name);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(path.join(ROOT, 'functions', 'shared'), { recursive: true });
  for (const name of SHARED) {
    writeFileSync(sharedPath(name), sharedContent(name));
    console.log(`functions/shared/${name} mis à jour`);
  }
}
