/**
 * ParkAlert — cycle de vie d'une réservation (§16 à §30).
 *
 * Une « session » est le contrat entre le donneur et le conducteur qui arrive.
 * Chacun n'écrit que sa propre partie ; le donneur est responsable de la
 * clôture (attribution des points) puisque c'est lui qui possède la place.
 */

import { TUNING } from './config.js';
import { distanceM, coarsen, travelEstimate } from './core.js';
import * as db from './backend.js';
import { S, every, clearTimer, unsubscribe, emit } from './state.js';

export const SESSION_PATH = (id) => `sessions/${id}`;

/** États du donneur (§18 §20) et du conducteur qui arrive. */
export const DONOR_STATE = { AWAY: 'away', HEADING: 'heading', READY: 'ready', LEFT: 'left' };
export const SEEKER_STATE = { ENROUTE: 'enroute', NEARBY: 'nearby', PARKED: 'parked' };

export function donorStatusText(session) {
  if (!session) return '';
  const name = session.donorPseudo || 'Le conducteur';
  switch (session.donorState) {
    case DONOR_STATE.HEADING: return `${name} rejoint son véhicule`;
    case DONOR_STATE.READY: return `${name} est dans sa voiture, prêt à partir`;
    case DONOR_STATE.LEFT: return `${name} a libéré la place`;
    default: return `${name} n’a pas encore rejoint son véhicule`;
  }
}

export function seekerStatusText(session) {
  if (!session) return '';
  const name = session.seekerPseudo || 'Le conducteur';
  switch (session.seekerState) {
    case SEEKER_STATE.NEARBY: return `${name} est arrivé à proximité`;
    case SEEKER_STATE.PARKED: return `${name} est garé`;
    default: return `${name} est en route`;
  }
}

/** Heure limite d'arrivée + tolérance de 2 minutes (§23). */
export function deadlines(session) {
  const due = Number(session?.dueAt) || 0;
  return {
    dueAt: due,
    toleranceAt: due + TUNING.lateToleranceS * 1000 + (Number(session?.extraWaitMs) || 0),
  };
}

export function remainingS(session, now = Date.now()) {
  return Math.round((deadlines(session).dueAt - now) / 1000);
}

export function lateS(session, now = Date.now()) {
  return Math.max(0, Math.round((now - deadlines(session).dueAt) / 1000));
}

export function spotPos(session) {
  return session ? { lat: session.spotLat, lng: session.spotLng } : null;
}

/** §22 — le conducteur est-il réellement arrivé près de la place ? */
export function seekerIsNearby(session, pos = S.pos) {
  if (!session || !pos) return false;
  return distanceM(spotPos(session), pos) <= TUNING.proximityM;
}

/* ─────────────────── Création / clôture ─────────────────── */

export async function createSession({ spot, offer, seeker, etaMin }) {
  const id = db.pushKey('sessions');
  const createdAt = db.now();
  const session = {
    id,
    createdAt,
    status: 'active',
    spotId: spot.spotId,
    spotLat: spot.lat,
    spotLng: spot.lng,
    spotQual: spot.qual,
    spotCm: spot.spotCm,

    donorUid: spot.donorUid,
    donorPseudo: spot.donorPseudo,
    donorVehicle: spot.vehicle,
    donorState: DONOR_STATE.AWAY,

    seekerUid: seeker.uid,
    seekerPseudo: seeker.pseudo,
    seekerVehicle: seeker.vehicle,
    seekerNeededCm: seeker.neededCm,
    seekerState: SEEKER_STATE.ENROUTE,

    etaMin,
    dueAt: createdAt + etaMin * 60_000,
    extraWaitMs: 0,
    confirmDonor: false,
    confirmSeeker: false,
    outOfRadius: !!offer?.outOfRadius,
  };
  await db.write(SESSION_PATH(id), session);
  return session;
}

/**
 * Termine une session et coupe le partage de position des deux côtés (§19).
 * @param {string} reason  'completed' | 'cancelled-donor' | 'cancelled-seeker'
 *                         | 'late-reassign' | 'no-fit' | 'expired'
 */
export async function closeSession(sessionId, status, reason, extra = {}) {
  if (!sessionId) return;
  await db.patch(SESSION_PATH(sessionId), {
    status, reason, endedAt: db.now(), donorPos: null, seekerPos: null, ...extra,
  });
}

/* ─────────────────── Partage de position temporaire (§18 §19) ─────────────────── */

/**
 * Publie ma position pendant la réservation.
 * Côté donneur, tant qu'il n'a pas déclaré rejoindre son véhicule, on ne publie
 * qu'une position approximative : le suivi sert à synchroniser la transmission,
 * pas à savoir dans quel restaurant il se trouve.
 */
export function startLiveShare(sessionId, role) {
  const push = async () => {
    const session = S.session;
    if (!session || session.id !== sessionId || session.status !== 'active' || !S.pos) return;
    const field = role === 'donor' ? 'donorPos' : 'seekerPos';
    const coarse = role === 'donor' && session.donorState === DONOR_STATE.AWAY;
    const value = coarse
      ? { ...coarsen(S.pos), ts: db.now() }
      : { lat: S.pos.lat, lng: S.pos.lng, approx: false, ts: db.now() };
    await db.patch(SESSION_PATH(sessionId), { [field]: value });
  };
  push();
  every('liveShare', TUNING.liveShareIntervalS * 1000, push);
  // Si l'onglet se ferme, la position ne doit pas rester publiée.
  db.updateOnDisconnect(SESSION_PATH(sessionId), { [role === 'donor' ? 'donorPos' : 'seekerPos']: null });
}

export function stopLiveShare() {
  clearTimer('liveShare');
}

/* ─────────────────── Abonnement ─────────────────── */

export function watchSession(sessionId, onUpdate) {
  unsubscribe('session');
  S.unsub.session = db.subscribe(SESSION_PATH(sessionId), (value) => {
    S.session = value ? { ...value, id: sessionId } : null;
    onUpdate(S.session);
    emit();
  });
}

/** Temps d'arrivée réactualisé à partir de la position réelle du conducteur. */
export function liveEta(session) {
  const pos = session?.seekerPos;
  if (!pos) return null;
  return travelEstimate(distanceM({ lat: pos.lat, lng: pos.lng }, spotPos(session)));
}
