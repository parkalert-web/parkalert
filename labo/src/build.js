#!/usr/bin/env node
/* Assemble la page autonome : gabarit + moteur + fontes embarquées.
   Usage : node build.js [chemin/de/sortie.html] */
const fs = require('fs'), path = require('path');

const here = __dirname;
const read = f => fs.readFileSync(path.join(here, f), 'utf8');

const b64 = f => fs.readFileSync(path.join(here, f)).toString('base64');

const page = read('page.html');
const sim = read('sim.js')
  .replace(/\nif \(typeof module[^\n]*\n?/, '\n');   // l'export CommonJS ne sert qu'aux tests

const out = page
  .replace('__SIM__', () => sim.trim())
  .replace('__BEBAS__', () => b64('fonts/bebas.woff2'))
  .replace('__DM400__', () => b64('fonts/dm400.woff2'))
  .replace('__DM500__', () => b64('fonts/dm500.woff2'));

for (const tok of ['__SIM__', '__BEBAS__', '__DM400__', '__DM500__']) {
  if (out.includes(tok)) { console.error('jeton non substitué :', tok); process.exit(1); }
}

const dest = process.argv[2] || path.join(here, 'la-chasse.html');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);
console.log(dest, '·', (Buffer.byteLength(out) / 1024).toFixed(0), 'Ko');
