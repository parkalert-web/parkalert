/**
 * Notifications qui arrivent même quand l'application est fermée.
 *
 * On utilise le protocole Web Push standard plutôt que Firebase Cloud
 * Messaging : la paire de clés VAPID est fabriquée toute seule au premier
 * envoi et rangée dans la base. Personne n'a donc de clé à recopier depuis
 * une console — une étape manuelle en moins, et une source d'erreur en moins.
 *
 * La clé publique est lisible par l'application (elle doit l'être, c'est ce
 * qui identifie l'expéditeur auprès du navigateur). La clé privée reste dans
 * un chemin que les règles de sécurité interdisent à tout le monde : seules
 * ces fonctions, qui passent outre les règles, peuvent la lire.
 */

import webpush from 'web-push';
import { getDatabase } from 'firebase-admin/database';
import { logger } from 'firebase-functions';

const CONTACT = 'mailto:contact@parkalert.app';

let cached = null;

/** Récupère la paire de clés, ou la fabrique la première fois. */
async function vapidKeys() {
  if (cached) return cached;
  const db = getDatabase();

  const existing = (await db.ref('config/vapid').get()).val();
  if (existing?.publicKey && existing?.privateKey) {
    cached = existing;
    return cached;
  }

  const keys = webpush.generateVAPIDKeys();
  // Deux écritures : la clé publique est lisible par l'application,
  // la privée vit sous un chemin fermé.
  await db.ref('config/vapid').set(keys);
  await db.ref('config/vapidPublicKey').set(keys.publicKey);
  logger.info('paire de clés VAPID créée');
  cached = keys;
  return cached;
}

/**
 * Envoie une notification à tous les appareils d'un utilisateur.
 * Un abonnement refusé (410/404) veut dire que l'utilisateur a désinstallé
 * ou refusé : on le supprime plutôt que de réessayer indéfiniment.
 */
async function toUser(uid, { title, body, tag, url = '/' }) {
  if (!uid) return { sent: 0, removed: 0 };
  const db = getDatabase();
  const subs = (await db.ref(`users/${uid}/pushSubs`).get()).val() || {};
  const ids = Object.keys(subs);
  if (!ids.length) return { sent: 0, removed: 0 };

  const keys = await vapidKeys();
  webpush.setVapidDetails(CONTACT, keys.publicKey, keys.privateKey);

  const payload = JSON.stringify({ title, body, tag, url });
  let sent = 0;
  let removed = 0;

  await Promise.all(ids.map(async (id) => {
    const sub = subs[id];
    if (!sub?.endpoint) return;
    try {
      await webpush.sendNotification(sub, payload, { TTL: 300, urgency: 'high' });
      sent += 1;
    } catch (err) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await db.ref(`users/${uid}/pushSubs/${id}`).remove();
        removed += 1;
      } else {
        logger.warn('envoi de notification échoué', { uid, statusCode: err?.statusCode });
      }
    }
  }));

  return { sent, removed };
}

export function notifier() {
  return { toUser };
}
