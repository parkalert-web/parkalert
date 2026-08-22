#!/usr/bin/env node
/**
 * Obtention du jeton de rafraîchissement Google — à lancer **une seule fois**,
 * sur votre ordinateur :
 *
 *   npm run yt:auth
 *
 * Le script ouvre une page de consentement Google, récupère le code de retour
 * sur http://localhost:8787/, l'échange contre un jeton de rafraîchissement et
 * l'écrit dans youtube-autopost/.env. Ce jeton est ensuite à recopier dans les
 * Secrets GitHub sous le nom YT_REFRESH_TOKEN.
 *
 * Sécurité : échange protégé par PKCE, et le serveur local n'écoute que sur
 * 127.0.0.1 le temps de l'autorisation.
 */

import http from 'node:http';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT, loadConfig } from './config.mjs';
import { SCOPES_BASE, SCOPE_DRIVE } from './google.mjs';

const PORT = Number(process.env.YT_AUTH_PORT || 8787);
const REDIRECT = `http://localhost:${PORT}/`;
const ENV = path.join(ROOT, '.env');

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Lit une valeur dans .env, sinon la demande au clavier. */
async function demande(cle, question, env) {
  if (process.env[cle]) return process.env[cle];
  if (env[cle] && !env[cle].startsWith('xxxx')) return env[cle];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const rep = (await rl.question(`${question} : `)).trim();
  rl.close();
  if (!rep) throw new Error(`${cle} est indispensable.`);
  return rep;
}

async function lireEnv() {
  if (!existsSync(ENV)) return {};
  const env = {};
  for (const ligne of (await readFile(ENV, 'utf8')).split('\n')) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

/** Écrit (ou remplace) une clé dans .env. */
async function ecrisEnv(cle, valeur) {
  if (!existsSync(ENV)) {
    await writeFile(ENV, `${cle}=${valeur}\n`, 'utf8');
    return;
  }
  const contenu = await readFile(ENV, 'utf8');
  if (new RegExp(`^\\s*${cle}\\s*=`, 'm').test(contenu)) {
    await writeFile(ENV, contenu.replace(new RegExp(`^\\s*${cle}\\s*=.*$`, 'm'), `${cle}=${valeur}`), 'utf8');
  } else {
    await appendFile(ENV, `${contenu.endsWith('\n') ? '' : '\n'}${cle}=${valeur}\n`);
  }
}

const PAGE = (titre, message, couleur) => `<!doctype html><html lang="fr"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${titre}</title>
<body style="font:16px/1.6 system-ui,sans-serif;max-width:34rem;margin:16vh auto;padding:0 1.5rem;color:#101623">
<h1 style="color:${couleur};font-size:1.4rem">${titre}</h1><p>${message}</p>
<p style="color:#59626f">Vous pouvez fermer cet onglet et revenir au terminal.</p></body></html>`;

/** Attend le retour de Google sur le serveur local. */
function attendCode(state) {
  return new Promise((resolve, reject) => {
    const serveur = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT);
      const code = url.searchParams.get('code');
      const erreur = url.searchParams.get('error');
      if (!code && !erreur) { res.writeHead(404).end(); return; }

      const ok = code && url.searchParams.get('state') === state;
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(ok
        ? PAGE('Autorisation accordée ✅', 'Le robot peut désormais publier sur votre chaîne.', '#0f7a45')
        : PAGE('Autorisation refusée', `Google a répondu : <code>${erreur || 'state invalide'}</code>.`, '#c0332b'));
      serveur.close();
      ok ? resolve(code) : reject(new Error(erreur || 'Réponse inattendue (state invalide).'));
    });
    serveur.on('error', (e) => reject(e.code === 'EADDRINUSE'
      ? new Error(`Le port ${PORT} est occupé. Relancez avec : YT_AUTH_PORT=8899 npm run yt:auth`)
      : e));
    serveur.listen(PORT, '127.0.0.1');
    setTimeout(() => { serveur.close(); reject(new Error('Délai dépassé (5 minutes).')); }, 300000).unref();
  });
}

async function main() {
  const env = await lireEnv();
  const config = await loadConfig().catch(() => ({ source: 'depot' }));
  const drive = config.source === 'drive' || process.argv.includes('--drive');
  const scopes = [...SCOPES_BASE, ...(drive ? [SCOPE_DRIVE] : [])];

  console.log('\n── Autorisation Google ──────────────────────────────────────\n');
  console.log('Il vous faut un identifiant OAuth (Google Cloud → API et services →');
  console.log(`Identifiants) autorisant la redirection ${REDIRECT}. Voir le README.\n`);

  const clientId = await demande('YT_CLIENT_ID', 'ID client', env);
  const clientSecret = await demande('YT_CLIENT_SECRET', 'Code secret du client', env);

  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: clientId, redirect_uri: REDIRECT, response_type: 'code',
    scope: scopes.join(' '), access_type: 'offline', prompt: 'consent',
    include_granted_scopes: 'true', state, code_challenge: challenge, code_challenge_method: 'S256',
  }).toString();

  console.log('\n1. Ouvrez ce lien dans votre navigateur, connecté au compte de la chaîne :\n');
  console.log(`   ${url}\n`);
  console.log('2. Google affichera « Cette application n\'est pas validée » : c\'est normal,');
  console.log('   c\'est VOTRE application. Cliquez « Paramètres avancés » → « Accéder à … ».');
  console.log(`\n3. J'attends le retour sur ${REDIRECT} …\n`);

  const code = await attendCode(state);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: REDIRECT, grant_type: 'authorization_code', code_verifier: verifier,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.refresh_token) {
    throw new Error(`Échange du code impossible : ${data.error_description || data.error || res.status}`
      + (res.ok ? "\n(Google n'a pas renvoyé de refresh_token : révoquez l'accès sur "
        + 'https://myaccount.google.com/permissions puis recommencez.)' : ''));
  }

  await ecrisEnv('YT_CLIENT_ID', clientId);
  await ecrisEnv('YT_CLIENT_SECRET', clientSecret);
  await ecrisEnv('YT_REFRESH_TOKEN', data.refresh_token);

  console.log('\n✅ Jeton obtenu et enregistré dans youtube-autopost/.env\n');
  console.log('Recopiez maintenant ces trois valeurs dans GitHub →');
  console.log('Settings → Secrets and variables → Actions → New repository secret :\n');
  console.log(`   YT_CLIENT_ID      ${clientId}`);
  console.log(`   YT_CLIENT_SECRET  ${clientSecret}`);
  console.log(`   YT_REFRESH_TOKEN  ${data.refresh_token}\n`);
  console.log('Puis vérifiez le tout avec :  npm run yt:check\n');
  console.log('⚠ Pensez à passer l\'écran de consentement OAuth en mode « Production »,');
  console.log('  sinon Google invalide ce jeton au bout de 7 jours.\n');
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}\n`);
  process.exitCode = 1;
});
