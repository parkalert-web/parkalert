/**
 * ParkAlert — déclencheurs Firebase.
 *
 * Pourquoi ce dossier existe
 * ──────────────────────────
 * Jusqu'ici, c'était le téléphone du conducteur qui part qui cherchait les
 * candidats : son application devait rester ouverte, et celle des autres aussi
 * pour recevoir la proposition. Aucune application de magasin ne peut
 * fonctionner ainsi.
 *
 * Ces fonctions déplacent la partie qui a besoin d'un serveur — choisir le bon
 * conducteur et le prévenir, même application fermée. Le reste (accepter,
 * confirmer, transmettre) demeure dans l'application, où il doit être.
 *
 * Ce fichier ne contient volontairement aucune règle métier : il branche les
 * événements sur les fonctions de matching.js, qui sont testées séparément.
 */

import { onValueWritten } from 'firebase-functions/v2/database';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { logger } from 'firebase-functions';

import {
  dispatchSpot, handleOfferResponse, sweepOffers, sessionNotifications,
} from './matching.js';
import { notifier } from './push.js';

initializeApp();

/**
 * Les fonctions doivent tourner dans la même région que la base, sinon les
 * déclencheurs restent muets. En production c'est europe-west1.
 */
const REGION = process.env.PARKALERT_REGION || 'europe-west1';
const INSTANCE = process.env.PARKALERT_DB_INSTANCE || 'parking-98737-default-rtdb';

setGlobalOptions({ region: REGION, maxInstances: 10 });

const db = () => getDatabase();
const push = () => notifier();

/**
 * Tant que ces fonctions ne tournent pas, l'application garde son ancien
 * fonctionnement, piloté par le téléphone. Au premier événement traité, elles
 * se signalent et l'application leur laisse la main.
 */
async function announceServerIsAlive() {
  await db().ref('config/serverMatching').set(true);
}

/* ─────────────────── Une place cherche un preneur ─────────────────── */

export const onSpotChanged = onValueWritten(
  { ref: '/spots/{donorUid}', instance: INSTANCE },
  async (event) => {
    const spot = event.data.after.val();
    if (!spot || spot.status !== 'open') return;
    await announceServerIsAlive();
    const res = await dispatchSpot(db(), event.params.donorUid, spot, push());
    logger.info('mise en relation', { donorUid: event.params.donorUid, ...res });
  },
);

/* ─────────────────── Le conducteur répond ─────────────────── */

export const onOfferAnswered = onValueWritten(
  { ref: '/offers/{seekerUid}/response', instance: INSTANCE },
  async (event) => {
    const res = await handleOfferResponse(
      db(), event.params.seekerUid, event.data.after.val(), push(),
    );
    logger.info('réponse à une proposition', { seekerUid: event.params.seekerUid, ...res });
  },
);

/* ─────────────────── Une proposition sans réponse ne bloque pas la place ─────────────────── */

export const sweep = onSchedule(
  { schedule: 'every 1 minutes', region: REGION },
  async () => {
    const res = await sweepOffers(db());
    if (res.expired.length || res.unblocked.length) logger.info('nettoyage', res);
  },
);

/* ─────────────────── Prévenir pendant la réservation ─────────────────── */

export const onSessionChanged = onValueWritten(
  { ref: '/sessions/{sessionId}', instance: INSTANCE },
  async (event) => {
    const res = await sessionNotifications(
      db(), event.data.before.val(), event.data.after.val(), push(),
    );
    if (res.sent.length) logger.info('notifications de réservation', res);
  },
);
