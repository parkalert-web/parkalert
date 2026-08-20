/**
 * Banc d'essai bout en bout : plusieurs « téléphones » (contextes Chromium isolés)
 * pilotent la vraie application contre le vrai Firebase.
 *
 *   npm install --no-save playwright
 *   npx playwright install chromium      # inutile si PLAYWRIGHT_BROWSERS_PATH est déjà servi
 *   node tests/e2e/transfer.e2e.mjs
 *
 * Les comptes créés sont supprimés en fin de scénario.
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ORIGIN = 'https://parkalert.test';
export const BASE = `${ORIGIN}/?transport=longpolling`;
export const PASS = 'Test123456!';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const log = (tag, ...m) => console.log(`[${tag}]`, ...m);
/** Décale un point de n mètres vers le nord. */
export const north = (p, m) => ({ latitude: p.latitude + m / 111320, longitude: p.longitude });

/**
 * Certains environnements n'autorisent la sortie réseau que depuis Node
 * (proxy d'entreprise) : on relaie alors les requêtes du navigateur.
 */
async function buildRelay() {
  if (!process.env.HTTPS_PROXY) return null;
  const { ProxyAgent, request } = await import('undici');
  const agent = new ProxyAgent(process.env.HTTPS_PROXY);
  return async (route) => {
    const req = route.request();
    try {
      const headers = { ...req.headers() };
      delete headers.host; delete headers[':authority'];
      headers['accept-encoding'] = 'identity';
      const res = await request(req.url(), {
        method: req.method(), headers, body: req.postDataBuffer() || undefined, dispatcher: agent,
      });
      const body = Buffer.from(await res.body.arrayBuffer());
      const out = {};
      for (const [k, v] of Object.entries(res.headers)) {
        if (['content-encoding', 'content-length', 'transfer-encoding'].includes(k.toLowerCase())) continue;
        out[k] = Array.isArray(v) ? v.join(', ') : String(v);
      }
      return route.fulfill({ status: res.statusCode, headers: out, body });
    } catch { return route.abort(); }
  };
}

export async function launch() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
  });
  const relay = await buildRelay();
  return { browser, relay };
}

/** Ouvre un « téléphone » : contexte isolé, position GPS propre, site servi depuis le disque. */
export async function openPhone({ browser, relay }, { tag, geo }) {
  const ctx = await browser.newContext({
    permissions: ['geolocation', 'notifications'],
    geolocation: geo,
    viewport: { width: 400, height: 860 },
    locale: 'fr-FR',
    ignoreHTTPSErrors: true,
  });
  if (relay) await ctx.route('**/*', (route) => (route.request().url().startsWith(ORIGIN) ? route.fallback() : relay(route)));
  await ctx.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    const rel = url.pathname === '/' ? '/index.html' : url.pathname;
    try {
      const body = await fs.readFile(path.join(ROOT, rel));
      await route.fulfill({ status: 200, body, headers: { 'content-type': TYPES[path.extname(rel)] || 'application/octet-stream' } });
    } catch { await route.fulfill({ status: 404, body: 'not found' }); }
  });

  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => { errors.push(String(e)); log(tag, 'PAGE ERROR:', String(e)); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  return { tag, ctx, page, errors, geo };
}

/* ─────────────────── Aides d'interaction ─────────────────── */

export async function modalTitle(page) {
  if (!(await page.locator('#modal-back.show').count())) return null;
  return (await page.locator('#modal-title').textContent())?.trim();
}

export async function waitModal(page, re, timeout = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const t = await modalTitle(page);
    if (t && re.test(t)) return t;
    await sleep(200);
  }
  throw new Error(`modale attendue ${re} — visible : ${await modalTitle(page)}`);
}

export async function clickAction(page, text) {
  const btn = page.locator('#modal-actions .btn', { hasText: text }).first();
  await btn.waitFor({ state: 'visible', timeout: 20000 });
  await btn.click();
}

/** Inscription + parcours de première configuration (pseudonyme, véhicule, confort). */
export async function signUp(phone, { pseudo, vehicle, comfort = 'NORMAL' }) {
  const { page, tag } = phone;
  phone.email = `pa-e2e-${pseudo.toLowerCase()}-${Date.now()}@example.com`;
  await page.click('#tab-signup');
  await page.fill('#inp-pseudo', pseudo);
  await page.fill('#inp-email', phone.email);
  await page.fill('#inp-pass', PASS);
  await page.click('#btn-auth');
  await page.waitForSelector('#screen-app.active', { timeout: 30000 });

  const t = await waitModal(page, /Bienvenue|Enregistrez votre véhicule/, 30000);
  if (/Bienvenue/.test(t)) {
    await page.fill('#modal-body input[type="text"]', pseudo);
    await clickAction(page, 'CONTINUER');
    await waitModal(page, /Enregistrez votre véhicule/);
  }
  await page.fill('#veh-q', vehicle);
  await page.waitForSelector('#modal-body .result.sel', { timeout: 15000 });
  const found = await page.locator('#modal-body .result.sel b').first().textContent();
  await clickAction(page, 'CONFIRMER CE VÉHICULE');
  await waitModal(page, /comment aimez-vous vous garer/i);
  await page.click(`#modal-body .choice:has-text("${comfort}")`);
  await clickAction(page, 'VALIDER');
  await sleep(1000);
  log(tag, `inscrit — véhicule reconnu : ${found}`);
  return found;
}

/** Lance une recherche centrée sur la position courante (§8). */
export async function startSearch(phone, { radius } = {}) {
  const { page, tag } = phone;
  await page.click('#panel .btn-blue');
  await waitModal(page, /Je cherche une place/);
  await page.click('#modal-body .btn-row .btn:has-text("MA POSITION")');
  await page.waitForSelector('#modal-body .chosen.ok', { timeout: 15000 });
  if (radius) await page.locator('#modal-body .slider').fill(String(radius));
  await clickAction(page, 'LANCER LA RECHERCHE');
  await page.waitForSelector('#panel .btn-ghost:has-text("ANNULER LA RECHERCHE")', { timeout: 15000 });
  log(tag, 'recherche active');
}

/** Annonce un départ (§10). `when` = libellé du choix : MAINTENANT, 5 min, 10 min… */
export async function announceDeparture(phone, when = '10 min') {
  const { page, tag } = phone;
  await page.click('#panel .btn-green');
  const t = await waitModal(page, /espace autour de votre voiture|Dans combien de temps/i);
  if (/espace autour/i.test(t)) {
    await clickAction(page, 'VALIDER');
    await waitModal(page, /Dans combien de temps/i);
  }
  await page.click(`#modal-body .choice:has-text("${when}")`);
  await clickAction(page, 'CONTINUER');
  if (when === 'MAINTENANT') {
    await waitModal(page, /Vous partez maintenant/i);
    await clickAction(page, 'J’ATTENDS UN CONDUCTEUR');
  }
  log(tag, `départ annoncé : ${when}`);
}

/** Supprime le compte de test et ses données. */
export async function cleanup(phone) {
  await phone.page.evaluate(async () => {
    const m = await import('./src/backend.js');
    const uid = m.auth.currentUser?.uid;
    if (!uid) return;
    await Promise.allSettled([
      m.del(`users/${uid}`), m.del(`seekers/${uid}`), m.del(`spots/${uid}`), m.del(`offers/${uid}`),
    ]);
    try { await m.auth.currentUser.delete(); } catch { /* déjà supprimé */ }
  }).catch(() => {});
}

export function assert(cond, message) {
  if (!cond) throw new Error(message);
  console.log('  ✓', message);
}
