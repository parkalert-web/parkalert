/**
 * Envoi d'une vidéo sur YouTube (API Data v3, upload « resumable »).
 *
 * Coût en quota : 1 600 unités par envoi, sur les 10 000 unités gratuites
 * offertes chaque jour — soit six vidéos par jour au maximum. Une publication
 * quotidienne tient donc très largement dans le quota gratuit.
 */

import { apiFetch, apiJson } from './google.mjs';

const UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos';

/** Construit la ressource `video` envoyée à YouTube. */
export function videoResource({ titre, description, tags, publication }) {
  return {
    snippet: {
      title: titre.slice(0, 100),
      description: String(description || '').slice(0, 4900),
      tags: (tags || []).map((t) => String(t).slice(0, 60)).slice(0, 60),
      categoryId: String(publication.categorieId || '22'),
      defaultLanguage: publication.langue || undefined,
      defaultAudioLanguage: publication.langue || undefined,
    },
    status: {
      privacyStatus: publication.confidentialite,
      selfDeclaredMadeForKids: !!publication.pourEnfants,
      embeddable: true,
      license: 'youtube',
    },
  };
}

/**
 * Envoie la vidéo et retourne { id, url }.
 * @param {object} o
 * @param {string} o.token    Jeton d'accès Google.
 * @param {Buffer|Uint8Array} o.bytes  Contenu du fichier.
 * @param {string} o.mime     Type MIME (video/mp4…).
 * @param {object} o.resource Ressource `video` (voir videoResource).
 * @param {boolean} o.notifySubscribers  Prévenir les abonnés de la chaîne.
 */
export async function uploadVideo({ token, bytes, mime = 'video/mp4', resource, notifySubscribers = true, log = () => {} }) {
  const taille = bytes.byteLength ?? bytes.length;
  const parts = 'snippet,status';

  // 1. Ouverture de la session : YouTube renvoie une URL d'envoi à usage unique.
  const debut = await apiFetch(`${UPLOAD_URL}?uploadType=resumable&part=${parts}&notifySubscribers=${!!notifySubscribers}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': String(taille),
      'X-Upload-Content-Type': mime,
    },
    body: JSON.stringify({ snippet: resource.snippet, status: resource.status }),
  });
  if (!debut.ok) throw new Error(await explainUploadError(debut));
  const session = debut.headers.get('location');
  if (!session) throw new Error("YouTube n'a pas renvoyé d'URL d'envoi (en-tête Location absent).");

  // 2. Envoi des octets, avec reprise là où ça s'est arrêté en cas de coupure.
  let offset = 0;
  for (let essai = 0; essai < 5; essai++) {
    try {
      const res = await fetch(session, {
        method: 'PUT',
        headers: {
          'Content-Type': mime,
          'Content-Length': String(taille - offset),
          ...(offset ? { 'Content-Range': `bytes ${offset}-${taille - 1}/${taille}` } : {}),
        },
        body: bytes.subarray(offset),
      });
      if (res.ok) {
        const video = await res.json();
        return { id: video.id, url: `https://www.youtube.com/shorts/${video.id}`, video };
      }
      if (res.status === 308) { offset = await resumeOffset(session, taille); continue; }
      throw new Error(await explainUploadError(res));
    } catch (err) {
      if (essai === 4) throw err;
      log(`  ↻ reprise de l'envoi (${err.message.slice(0, 120)})`);
      await new Promise((r) => setTimeout(r, 3000 * 2 ** essai));
      offset = await resumeOffset(session, taille).catch(() => offset);
    }
  }
  throw new Error("Envoi impossible après plusieurs tentatives.");
}

/** Demande à YouTube combien d'octets il a déjà reçus. */
async function resumeOffset(session, taille) {
  const res = await fetch(session, {
    method: 'PUT',
    headers: { 'Content-Range': `bytes */${taille}`, 'Content-Length': '0' },
  });
  if (res.status !== 308) return 0;
  const range = res.headers.get('range');            // ex. « bytes=0-524287 »
  return range ? Number(range.split('-')[1]) + 1 : 0;
}

/** Messages d'erreur YouTube traduits en consigne concrète. */
async function explainUploadError(res) {
  const texte = await res.text().catch(() => '');
  let data = {};
  try { data = JSON.parse(texte); } catch { /* réponse non JSON */ }
  const raison = data.error?.errors?.[0]?.reason || '';
  const message = data.error?.message || texte.slice(0, 300) || `HTTP ${res.status}`;

  if (raison === 'quotaExceeded') {
    return 'Quota YouTube épuisé pour aujourd\'hui (10 000 unités = 6 envois). Réessayez demain.';
  }
  if (raison === 'uploadLimitExceeded') {
    return 'Limite d\'envois de la chaîne atteinte pour aujourd\'hui (limite YouTube, pas du script).';
  }
  if (raison === 'youtubeSignupRequired') {
    return 'Le compte Google utilisé n\'a pas de chaîne YouTube : créez-la, puis relancez `npm run yt:auth`.';
  }
  if (raison === 'forbidden' || res.status === 403) {
    return `Accès refusé par YouTube (${raison || 403}) : ${message}\n`
      + 'Vérifiez que l\'API « YouTube Data API v3 » est activée dans le projet Google Cloud.';
  }
  if (res.status === 401) return 'Jeton expiré ou révoqué (401) : relancez `npm run yt:auth`.';
  return `YouTube a refusé l'envoi (${res.status}) : ${message}`;
}

/** Vérifie que le compte possède bien une chaîne (contrôle de `--check`). */
export async function myChannel(token) {
  const data = await apiJson('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.items?.[0] || null;
}
