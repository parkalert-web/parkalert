/**
 * ParkAlert — le cœur de la mise en relation, côté serveur.
 *
 * Tout ce qui décide et écrit vit ici, sous forme de fonctions ordinaires qui
 * reçoivent la base et le notificateur en paramètres. Les déclencheurs Firebase
 * (index.js) ne font que les appeler. C'est ce qui permet de rejouer ces règles
 * contre la base locale sans déployer quoi que ce soit — voir
 * tests/server.test.mjs.
 *
 * Les règles de compatibilité et de priorité ne sont pas réécrites : elles
 * viennent de shared/core.js, copie conforme de src/core.js.
 */

import { buildQueue } from './shared/core.js';
import { TUNING } from './shared/config.js';

const now = () => Date.now();

/** Le silence n'est pas une erreur : sans notificateur, on écrit quand même en base. */
const NO_PUSH = { toUser: async () => ({ sent: 0, removed: 0 }) };

/* ─────────────────── Lecture des chercheurs ─────────────────── */

/** Une recherche trop ancienne est ignorée : son auteur s'est déjà garé. */
export async function freshSeekers(db, donorUid) {
  const snap = await db.ref('seekers').get();
  const cutoff = now() - TUNING.seekerTtlS * 1000;
  return Object.entries(snap.val() || {})
    .map(([uid, s]) => ({ ...s, uid }))
    .filter((s) => s && s.uid !== donorUid
      && (!s.state || s.state === 'searching')
      && (Number(s.ts) || 0) > cutoff);
}

/* ─────────────────── 1. Choisir et solliciter ─────────────────── */

/**
 * Une place vient de passer en recherche : on choisit le meilleur conducteur
 * et on le prévient. Un seul est sollicité à la fois.
 *
 * @returns {Promise<{status:string, seekerUid?:string, etaMin?:number}>}
 */
export async function dispatchSpot(db, donorUid, spot, push = NO_PUSH) {
  if (!spot) return { status: 'no-spot' };
  if (spot.status !== 'open') return { status: 'not-open' };
  if (spot.pendingSeeker) return { status: 'awaiting-donor' };

  const remainingMin = spot.mode === 'timed'
    ? Math.max(0, Math.ceil((spot.readyAt - now()) / 60_000))
    : 0;
  // Départ annoncé et pas encore échu : priorité aux points.
  // Départ immédiat ou réattribution : priorité au plus rapide.
  const mode = (spot.mode === 'timed' && remainingMin > 0) ? 'points' : 'fastest';

  const seekers = await freshSeekers(db, donorUid);
  if (!seekers.length) return { status: 'no-seekers' };

  const queue = buildQueue({
    spot: { lat: spot.lat, lng: spot.lng },
    spotCm: spot.spotCm,
    readyInMin: remainingMin,
    seekers,
    exclude: Object.keys(spot.excluded || {}),
    blockedAboveCm: spot.blockedAboveCm ?? null,
  }, mode);

  if (!queue.length) return { status: 'no-match' };

  for (const candidate of queue) {
    const offer = await claimOffer(db, candidate, spot);
    if (!offer) continue; // déjà sollicité pour une autre place

    await db.ref(`spots/${donorUid}`).update({
      status: 'offering',
      offeredTo: candidate.uid,
      offerExpiresAt: offer.expiresAt,
    });

    await push.toUser(candidate.uid, {
      title: 'Une place se libère',
      body: `À ${Math.round(candidate.destM)} m de votre destination · environ ${candidate.etaMin} min de route`,
      tag: 'parkalert-offer',
    });

    return { status: 'offered', seekerUid: candidate.uid, etaMin: candidate.etaMin };
  }

  return { status: 'all-busy' };
}

/** Réserve l'attention d'un conducteur, sans jamais en solliciter deux à la fois. */
async function claimOffer(db, candidate, spot) {
  const offer = {
    offerId: `${spot.spotId}-${now()}`,
    spotId: spot.spotId,
    donorUid: spot.donorUid,
    donorPseudo: spot.donorPseudo ?? null,
    donorVehicle: spot.vehicle ?? null,
    lat: spot.lat,
    lng: spot.lng,
    qual: spot.qual ?? null,
    spotCm: spot.spotCm,
    mode: spot.mode,
    readyAt: spot.readyAt ?? null,
    seekerPseudo: candidate.pseudo ?? null,
    etaMin: candidate.etaMin,
    destM: candidate.destM,
    approachM: candidate.approachM,
    outOfRadius: !!candidate.outOfRadius,
    requestedRadiusM: Number(candidate.radiusM) || null,
    marginal: !!candidate.fit?.marginal,
    gapCm: candidate.fit?.gapCm ?? null,
    createdAt: now(),
    expiresAt: now() + TUNING.offerTimeoutS * 1000,
    response: 'pending',
    by: 'server',
  };

  const res = await db.ref(`offers/${candidate.uid}`).transaction((cur) => {
    if (cur && cur.response === 'pending' && Number(cur.expiresAt) > Date.now()) return undefined;
    return offer;
  });
  return res.committed ? offer : null;
}

/* ─────────────────── 2. Le conducteur répond ─────────────────── */

/**
 * Acceptation : on présente le candidat au conducteur qui part — c'est lui qui
 * décide, le serveur ne réserve jamais à sa place.
 * Refus ou expiration : on écarte le candidat et la place repart en recherche.
 */
export async function handleOfferResponse(db, seekerUid, response, push = NO_PUSH) {
  if (!response || response === 'pending') return { status: 'ignored' };

  const offer = (await db.ref(`offers/${seekerUid}`).get()).val();
  if (!offer?.donorUid) return { status: 'no-offer' };
  const donorRef = db.ref(`spots/${offer.donorUid}`);

  if (response === 'accepted') {
    const seeker = (await db.ref(`seekers/${seekerUid}`).get()).val();
    await donorRef.update({
      status: 'pending-confirm',
      pendingSeeker: {
        uid: seekerUid,
        pseudo: offer.seekerPseudo || seeker?.pseudo || 'Un conducteur',
        vehicle: seeker?.vehicle ?? null,
        points: Number(seeker?.points) || 0,
        neededCm: Number(seeker?.neededCm) || null,
        etaMin: Number(offer.etaMin) || null,
        approachM: Number(offer.approachM) || null,
        askedAt: now(),
      },
    });

    const v = seeker?.vehicle || {};
    await push.toUser(offer.donorUid, {
      title: 'Un conducteur veut votre place',
      body: `${[v.label, v.color].filter(Boolean).join(' ') || 'Un véhicule'} · arrivée dans ${offer.etaMin} min`,
      tag: 'parkalert-confirm',
    });
    return { status: 'awaiting-donor', donorUid: offer.donorUid };
  }

  await donorRef.child(`excluded/${seekerUid}`).set(now());
  await db.ref(`offers/${seekerUid}`).remove();
  // Repasser en « open » relance la recherche au candidat suivant.
  await donorRef.update({ status: 'open', offeredTo: null, offerExpiresAt: null });
  return { status: 'next', donorUid: offer.donorUid };
}

/* ─────────────────── 3. Ne pas bloquer une place sur un silence ─────────────────── */

/**
 * Passe en revue les propositions échues. Marquer « declined » suffit :
 * le traitement de la réponse fait le reste.
 */
export async function sweepOffers(db) {
  const offers = (await db.ref('offers').get()).val() || {};
  const t = now();
  const expired = [];

  for (const [seekerUid, offer] of Object.entries(offers)) {
    if (!offer || offer.response !== 'pending') continue;
    if (Number(offer.expiresAt) > t) continue;
    await db.ref(`offers/${seekerUid}/response`).set('declined');
    expired.push(seekerUid);
  }

  // Filet de sécurité : une place restée « offering » sans proposition vivante
  // doit repartir en recherche, sinon elle resterait bloquée indéfiniment.
  const spots = (await db.ref('spots').get()).val() || {};
  const unblocked = [];
  for (const [donorUid, spot] of Object.entries(spots)) {
    if (!spot || spot.status !== 'offering') continue;
    if (Number(spot.offerExpiresAt) > t) continue;
    const live = offers[spot.offeredTo];
    if (live && live.response === 'pending' && Number(live.expiresAt) > t) continue;
    await db.ref(`spots/${donorUid}`).update({ status: 'open', offeredTo: null, offerExpiresAt: null });
    unblocked.push(donorUid);
  }

  return { expired, unblocked };
}

/* ─────────────────── 4. Prévenir pendant la réservation ─────────────────── */

/** Les deux moments où l'autre conducteur doit être prévenu même écran éteint. */
export async function sessionNotifications(db, before, after, push = NO_PUSH) {
  if (!after || after.status !== 'active') return { sent: [] };
  const sent = [];

  if (before?.donorState !== 'ready' && after.donorState === 'ready') {
    await push.toUser(after.seekerUid, {
      title: 'La place se libère',
      body: `${after.donorPseudo || 'Le conducteur'} est dans sa voiture, prêt à partir.`,
      tag: 'parkalert-ready',
    });
    sent.push('donor-ready');
  }

  if (before?.seekerState !== 'nearby' && after.seekerState === 'nearby') {
    await push.toUser(after.donorUid, {
      title: 'Votre conducteur est arrivé',
      body: 'Il vous attend à proximité de la place.',
      tag: 'parkalert-nearby',
    });
    sent.push('seeker-nearby');
  }

  return { sent };
}
