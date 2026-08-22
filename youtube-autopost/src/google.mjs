/**
 * Authentification Google — sans aucune dépendance npm.
 *
 * Le robot ne connaît jamais votre mot de passe : il détient un « jeton de
 * rafraîchissement » (obtenu une fois pour toutes par `npm run yt:auth`) qu'il
 * échange à chaque exécution contre un jeton d'accès valable une heure.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export const SCOPES_BASE = ['https://www.googleapis.com/auth/youtube.upload'];
export const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive.readonly';

/** Identifiants lus dans l'environnement (Secrets GitHub, ou fichier .env en local). */
export function credentialsFromEnv(env = process.env) {
  const manquants = ['YT_CLIENT_ID', 'YT_CLIENT_SECRET', 'YT_REFRESH_TOKEN'].filter((k) => !env[k]);
  if (manquants.length) {
    throw new Error(
      `Secrets manquants : ${manquants.join(', ')}.\n`
      + 'En local : créez youtube-autopost/.env (voir .env.example).\n'
      + 'Sur GitHub : Settings → Secrets and variables → Actions → New repository secret.',
    );
  }
  return { clientId: env.YT_CLIENT_ID, clientSecret: env.YT_CLIENT_SECRET, refreshToken: env.YT_REFRESH_TOKEN };
}

/** Échange le jeton de rafraîchissement contre un jeton d'accès. */
export async function accessToken({ clientId, clientSecret, refreshToken }) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: refreshToken, grant_type: 'refresh_token',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(explainTokenError(res.status, data));
  return data.access_token;
}

/** Traduit les erreurs OAuth les plus fréquentes en consigne actionnable. */
function explainTokenError(status, data) {
  const code = data.error || `HTTP ${status}`;
  if (code === 'invalid_grant') {
    return 'Jeton de rafraîchissement refusé (invalid_grant). Causes habituelles :\n'
      + '  • l\'écran de consentement est resté en mode « Test » → le jeton expire au bout de 7 jours.\n'
      + '    Google Cloud → Écran de consentement OAuth → « Publier l\'application » (mode Production).\n'
      + '  • le mot de passe Google a changé, ou l\'accès a été révoqué.\n'
      + '  Relancez `npm run yt:auth` pour régénérer YT_REFRESH_TOKEN.';
  }
  if (code === 'invalid_client') {
    return 'Identifiants client refusés (invalid_client) : vérifiez YT_CLIENT_ID et YT_CLIENT_SECRET.';
  }
  return `Échec de l'authentification Google : ${code} ${data.error_description || ''}`.trim();
}

/**
 * Appel JSON aux API Google, avec relance sur les erreurs passagères
 * (429 et 5xx) : une coupure réseau ne doit pas faire sauter la publication.
 */
export async function apiFetch(url, options = {}, { essais = 4 } = {}) {
  let dernier;
  for (let i = 0; i < essais; i++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429 || res.status >= 500) {
        dernier = new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
      } else {
        return res;
      }
    } catch (err) {
      dernier = err;
    }
    await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
  }
  throw dernier;
}

/** Réponse JSON attendue, message d'erreur lisible sinon. */
export async function apiJson(url, options = {}) {
  const res = await apiFetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data.error || {};
    const raison = e.errors?.[0]?.reason || e.status || res.status;
    throw new Error(`${e.message || 'Erreur API Google'} (${raison})`);
  }
  return data;
}
