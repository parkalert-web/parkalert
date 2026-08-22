/**
 * ParkAlert — notifications qui arrivent même application fermée.
 *
 * C'est ce qui sépare « un site qu'il faut garder ouvert » d'une vraie
 * application : le conducteur qui roule ne peut pas rester l'écran allumé
 * en attendant qu'une place se libère.
 *
 * Le navigateur crée un abonnement, on le range dans la base, et le serveur
 * s'en sert pour réveiller le téléphone. La clé publique vient de la base :
 * elle est fabriquée par le serveur au premier envoi, il n'y a donc rien à
 * recopier à la main depuis une console.
 *
 * Tant que le serveur n'est pas déployé, il n'y a pas de clé publique et ce
 * module ne fait simplement rien — l'application continue de fonctionner
 * comme avant.
 */

import * as db from './backend.js';
import { LS } from './ui.js';

/** Identifiant stable d'un appareil, pour ne pas empiler les abonnements. */
function deviceId() {
  let id = LS.get('deviceId');
  if (!id) {
    id = (crypto.randomUUID?.() || String(Math.random()).slice(2)).replace(/-/g, '').slice(0, 20);
    LS.set('deviceId', id);
  }
  return id;
}

/** La clé publique VAPID voyage en base64url ; l'API navigateur veut des octets. */
function urlBase64ToUint8Array(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Abonne cet appareil, si c'est possible et si l'utilisateur a déjà accepté
 * les notifications. N'ouvre jamais de demande d'autorisation lui-même :
 * c'est à l'application de choisir le bon moment pour la poser.
 *
 * @returns {Promise<'ok'|'unsupported'|'denied'|'no-server'|'error'>}
 */
export async function subscribeIfPossible(uid) {
  if (!uid || !pushSupported()) return 'unsupported';
  if (Notification.permission !== 'granted') return 'denied';

  try {
    const publicKey = await db.readOnce('config/vapidPublicKey');
    if (!publicKey) return 'no-server';

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    // Un abonnement créé avec une autre clé ne fonctionnerait pas : on le refait.
    if (sub && LS.get('pushKey') !== publicKey) {
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const { endpoint, keys } = sub.toJSON();
    if (!endpoint || !keys?.p256dh || !keys?.auth) return 'error';

    await db.write(`users/${uid}/pushSubs/${deviceId()}`, {
      endpoint, keys, updatedAt: db.now(),
    });
    LS.set('pushKey', publicKey);
    return 'ok';
  } catch (err) {
    console.warn('[parkalert] abonnement aux notifications impossible', err);
    return 'error';
  }
}

/** Retire cet appareil : plus aucune notification ne lui sera envoyée. */
export async function unsubscribe(uid) {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch { /* déjà parti */ }
  if (uid) await db.del(`users/${uid}/pushSubs/${deviceId()}`).catch(() => {});
  LS.del('pushKey');
}
