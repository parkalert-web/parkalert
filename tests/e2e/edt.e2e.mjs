/**
 * « En commun » de bout en bout, dans un vrai navigateur.
 *
 * Un emploi du temps est dessiné dans une page (une grille comme celles que
 * l'on photographie), exporté en PNG, puis importé dans l'outil comme le ferait
 * un utilisateur. On vérifie que la vraie chaîne — préparation de l'image,
 * OCR Tesseract, reconstruction de la grille — retrouve bien les cours, puis
 * que la comparaison avec un second emploi du temps dit ce qu'il faut.
 *
 *   npm install --no-save playwright
 *   node tests/e2e/edt.e2e.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { launch, ROOT, ORIGIN, sleep, log } from './harness.mjs';

const PAGE = `${ORIGIN}/edt/index.html`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

const assert = (cond, msg) => { if (!cond) throw new Error(`ÉCHEC : ${msg}`); log('OK', msg); };

/* ─────────── L'emploi du temps que l'on « photographie » ─────────── */

const GRILLE = {
  Lundi: [
    [8, 10, 'MATHEMATIQUES', 'M. DUPONT', 'Salle 204'],
    [10, 12, 'ANGLAIS', 'Mme MARTIN', 'Salle B12'],
    [14, 16, 'EPS', 'M. BERNARD', 'GYMNASE'],
  ],
  Mardi: [
    [9, 11, 'PHYSIQUE', 'Mme PETIT', 'Salle 108'],
    [13, 15, 'SVT', 'M. LEROY', 'Salle 210'],
  ],
  Mercredi: [[8, 10, 'HISTOIRE', 'Mme ROUX', 'Salle 112']],
  Jeudi: [
    [10, 12, 'MATHEMATIQUES', 'M. DUPONT', 'Salle 204'],
    [14, 17, 'PHILOSOPHIE', 'Mme PETIT', 'Salle 301'],
  ],
  Vendredi: [[8, 12, 'PROJET', 'M. LEROY', 'Salle 210']],
};

/** Dessine la grille dans la page et renvoie le PNG en base64. */
function dessine(grille) {
  const H0 = 8; const H1 = 18;
  const W = 1180; const HEAD = 54; const GUT = 66; const ROW = 62;
  const height = HEAD + (H1 - H0) * ROW + 12;
  const days = Object.keys(grille);
  const colW = (W - GUT - 12) / days.length;

  const c = document.createElement('canvas');
  c.width = W; c.height = height;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, height);
  x.strokeStyle = '#333'; x.lineWidth = 2;
  x.textBaseline = 'middle';

  const yOf = (h) => HEAD + (h - H0) * ROW;
  const xOf = (i) => GUT + i * colW;

  // Heures à gauche
  x.fillStyle = '#111'; x.font = '17px DejaVu Sans, Arial, sans-serif'; x.textAlign = 'right';
  for (let h = H0; h <= H1; h += 1) x.fillText(`${h}h00`, GUT - 10, yOf(h));

  // Titres des jours
  x.textAlign = 'center'; x.font = 'bold 20px DejaVu Sans, Arial, sans-serif';
  days.forEach((d, i) => x.fillText(d.toUpperCase(), xOf(i) + colW / 2, HEAD / 2));

  // Cadre + traits verticaux
  x.strokeRect(GUT, HEAD, colW * days.length, (H1 - H0) * ROW);
  for (let i = 0; i <= days.length; i += 1) {
    x.beginPath(); x.moveTo(xOf(i), HEAD); x.lineTo(xOf(i), yOf(H1)); x.stroke();
  }

  // Traits horizontaux : sautés à l'intérieur d'un cours (case fusionnée)
  days.forEach((d, i) => {
    for (let h = H0; h <= H1; h += 1) {
      const dedans = grille[d].some(([a, b]) => h > a && h < b);
      if (dedans) continue;
      x.beginPath(); x.moveTo(xOf(i), yOf(h)); x.lineTo(xOf(i + 1), yOf(h)); x.stroke();
    }
  });

  // Contenu des cases
  days.forEach((d, i) => {
    for (const [a, b, matiere, prof, salle] of grille[d]) {
      const cy = (yOf(a) + yOf(b)) / 2;
      x.fillStyle = '#111'; x.font = 'bold 17px DejaVu Sans, Arial, sans-serif';
      x.fillText(matiere, xOf(i) + colW / 2, cy - 20);
      x.font = '16px DejaVu Sans, Arial, sans-serif';
      x.fillText(prof, xOf(i) + colW / 2, cy + 2);
      x.fillStyle = '#444'; x.font = '15px DejaVu Sans, Arial, sans-serif';
      x.fillText(salle, xOf(i) + colW / 2, cy + 24);
    }
  });

  return c.toDataURL('image/png').split(',')[1];
}

/* ─────────── Le second emploi du temps, saisi à la main ─────────── */

const SAM = {
  id: 'sam-test',
  name: 'Sam',
  color: '#c0332b',
  source: 'manuel',
  courses: [
    { day: 0, start: 480, end: 540, subject: 'Mathématiques', teacher: 'M. Dupont', room: '204', kind: 'cours' },
    { day: 0, start: 600, end: 720, subject: 'Histoire-Géo', teacher: 'Mme Roux', room: '112', kind: 'cours' },
    { day: 0, start: 780, end: 960, subject: 'SVT', teacher: 'M. Leroy', room: '210', kind: 'cours' },
    { day: 1, start: 540, end: 660, subject: 'Anglais', teacher: 'Mme Martin', room: 'B12', kind: 'cours' },
  ],
};

/* ─────────────────────────── Scénario ─────────────────────────── */

const rig = await launch();
const ctx = await rig.browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'fr-FR', ignoreHTTPSErrors: true });
if (rig.relay) await ctx.route('**/*', (route) => (route.request().url().startsWith(ORIGIN) ? route.fallback() : rig.relay(route)));
await ctx.route(`${ORIGIN}/**`, async (route) => {
  const rel = new URL(route.request().url()).pathname;
  try {
    const body = await fs.readFile(path.join(ROOT, rel));
    await route.fulfill({ status: 200, body, headers: { 'content-type': TYPES[path.extname(rel)] || 'application/octet-stream' } });
  } catch { await route.fulfill({ status: 404, body: 'not found' }); }
});

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(String(e)); log('PAGE', 'ERREUR', String(e)); });
page.on('console', (m) => (m.type() === 'error' ? log('PAGE', m.text().slice(0, 200)) : null));

try {
  // 1. Un emploi du temps déjà saisi + la lecture rapide (dictionnaire léger).
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((sam) => localStorage.setItem('edt.v1', JSON.stringify({ schedules: [sam], options: { quality: 'fast', minCommon: 15, minLunch: 30, tolerance: 0 } })), SAM);
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  assert(await page.locator('.person').count() === 1, 'l’emploi du temps enregistré est retrouvé au chargement');

  // 2. On fabrique la « photo » et on l'importe comme le ferait l'utilisateur.
  const b64 = await page.evaluate(dessine, GRILLE);
  const png = Buffer.from(b64, 'base64');
  await fs.writeFile(path.join(ROOT, 'fail-edt-source.png'), png);
  log('IMG', `grille de test : ${Math.round(png.length / 1024)} ko`);
  await page.setInputFiles('#file', { name: 'edt.png', mimeType: 'image/png', buffer: png });

  // 3. Lecture (téléchargement du moteur + du dictionnaire au premier passage).
  const carte = page.locator('.person').nth(1);
  const t0 = Date.now();
  let statut = '';
  while (Date.now() - t0 < 300000) {
    statut = (await carte.locator('.p-status').textContent().catch(() => '')) || '';
    if (/cours/.test(statut) || /Rien n’a pu/.test(statut)) break;
    await sleep(1500);
  }
  log('OCR', `${statut.trim()} — en ${Math.round((Date.now() - t0) / 1000)} s`);

  const lu = await page.evaluate(() => JSON.parse(localStorage.getItem('edt.v1')).schedules[1]);
  log('LU', JSON.stringify(lu.courses.map((c) => [c.day, c.start, c.end, c.subject, c.teacher, c.room])));

  assert(lu.courses.length >= 7, `au moins 7 cours retrouvés (${lu.courses.length})`);
  const lundi = lu.courses.filter((c) => c.day === 0);
  assert(lundi.length === 3, `3 cours le lundi (${lundi.length})`);
  assert(lundi[0].start === 480 && lundi[0].end === 600, `maths de 8h à 10h (${lundi[0].start}→${lundi[0].end})`);
  assert(/MATH/i.test(lundi[0].subject), `matière lue « ${lundi[0].subject} »`);
  assert(/DUPONT/i.test(lundi[0].teacher || ''), `professeur lu « ${lundi[0].teacher} »`);
  assert(/204/.test(lundi[0].room || ''), `salle lue « ${lundi[0].room} »`);
  const vendredi = lu.courses.filter((c) => c.day === 4);
  assert(vendredi.length === 1 && vendredi[0].end - vendredi[0].start === 240, 'le cours de 4 heures du vendredi n’est pas coupé');

  // 4. La comparaison est affichée.
  await page.waitForSelector('#results:not([hidden])', { timeout: 15000 });
  const texte = await page.locator('#details').innerText();
  log('CMP', texte.split('\n').slice(0, 14).join(' | '));
  assert(/lundi/i.test(texte), 'le lundi est analysé');
  assert(/tout le monde commence à 8h00/i.test(texte), 'même heure de début détectée');
  assert(/12h00 → 13h00/.test(texte), 'le trou commun du lundi midi est trouvé');
  assert(/même cours/i.test(texte), 'le cours suivi ensemble est signalé');
  assert(/Dupont/i.test(texte) && /Leroy/i.test(texte), 'les profs en commun sont listés');

  const tuiles = await page.locator('#summary').innerText();
  log('TUILES', tuiles.replace(/\n/g, ' · '));
  assert(/libres ensemble/i.test(tuiles) && !/^0 min$/mi.test(tuiles), 'le temps libre commun est chiffré');
  assert(await page.locator('#week .blk').count() > 8, 'la semaine est dessinée');

  assert(errors.length === 0, `aucune erreur de page (${errors.join(' / ') || 'aucune'})`);
  await fs.unlink(path.join(ROOT, 'fail-edt-source.png')).catch(() => {});
  log('FIN', '✅ tout est bon');
} catch (e) {
  await page.screenshot({ path: path.join(ROOT, 'fail-edt.png'), fullPage: true }).catch(() => {});
  log('FIN', `❌ ${e.message}`);
  process.exitCode = 1;
} finally {
  await ctx.close();
  await rig.browser.close();
}
