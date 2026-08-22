/**
 * ParkAlert — parcours de celui qui DONNE sa place.
 * §6 qualification · §10 annonce du départ · §13/§14 priorité · §15/§16 proposition
 * §20 « je suis prêt » · §23/§24 retard et réattribution · §28/§29 transmission et points
 */

import { TUNING } from './config.js';
import {
  buildQueue, estimatedSpotCm, transferValid, rewardEligibility, fmtDistance,
} from './core.js';
import * as db from './backend.js';
import {
  S, setPhase, currentVehicle, vehicleCard, every, after, clearTimer, unsubscribe, emit, requirePosition,
} from './state.js';
import { toast, notify, openModal, el, esc } from './ui.js';
import { askComfort, askDeparture, askExtraWait, confirmSheet, infoSheet } from './pickers.js';
import * as sess from './session.js';

const SPOT = (uid) => `spots/${uid}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ─────────────────────── §6 — stationnement et qualification ─────────────────────── */

export async function declareParked() {
  const pos = requirePosition();
  if (!pos) return;
  const vehicle = currentVehicle();
  if (!vehicle) { toast('Véhicule manquant', 'Enregistrez d’abord un véhicule dans votre profil.', '#ef4444'); return; }

  const parking = { lat: pos.lat, lng: pos.lng, vehicleId: vehicle.id, qual: null, customCm: null, since: db.now() };
  await db.write(`users/${S.uid}/parking`, parking);
  S.parking = parking;
  setPhase('parked');

  const answer = await askComfort({
    title: 'Vous êtes garé ? Comment est l’espace autour de votre voiture ?',
    subtitle: 'Cette information concerne cette place précise, pas votre véhicule.',
    value: 'normal',
    allowLater: true,
    explain: 'Pas besoin de mètre ni d’estimation au centimètre : un ordre d’idée suffit.',
  });
  if (answer && answer !== 'later') await saveQualification(answer);
  scheduleParkedReminder();
  emit();
}

export async function saveQualification({ qual, customCm }) {
  if (!S.parking) return;
  S.parking = { ...S.parking, qual, customCm };
  await db.patch(`users/${S.uid}/parking`, { qual, customCm: customCm ?? null });
  emit();
}

export async function editQualification() {
  const answer = await askComfort({
    title: 'Comment est l’espace autour de votre voiture ?',
    value: S.parking?.qual || 'normal',
    customCm: S.parking?.customCm || 60,
  });
  if (answer && answer !== 'later') await saveQualification(answer);
}

export async function clearParking() {
  await db.del(`users/${S.uid}/parking`);
  S.parking = null;
  clearTimer('parkedReminder');
  setPhase('idle');
}

/** §11 — rappel raisonnable et désactivable, pour annoncer AVANT de monter en voiture. */
function scheduleParkedReminder() {
  clearTimer('parkedReminder');
  if (!S.profile?.prefs?.reminders) return;
  after('parkedReminder', TUNING.parkedReminderS * 1000, () => {
    if (S.phase !== 'parked') return;
    notify('Vous allez bientôt reprendre votre voiture ?',
      'Annoncez votre départ quelques minutes avant, pour nous laisser le temps de trouver un conducteur.', '#38bdf8');
    scheduleParkedReminder();
  });
}

/* ─────────────────────── §10 — annoncer son départ ─────────────────────── */

export async function announceDeparture() {
  const vehicle = S.parking ? (S.vehicles.find((v) => v.id === S.parking.vehicleId) || currentVehicle()) : currentVehicle();
  if (!vehicle) { toast('Véhicule manquant', 'Enregistrez d’abord un véhicule dans votre profil.', '#ef4444'); return; }

  const pos = S.parking ? { lat: S.parking.lat, lng: S.parking.lng } : requirePosition();
  if (!pos) return;

  // §6 : si la place n'a pas été qualifiée, c'est le moment de le demander.
  let qual = S.parking?.qual;
  let customCm = S.parking?.customCm;
  if (!qual) {
    const answer = await askComfort({
      title: 'Comment est l’espace autour de votre voiture ?',
      subtitle: 'Dernière information avant de proposer votre place.',
      value: 'normal',
    });
    if (!answer || answer === 'later') return;
    qual = answer.qual; customCm = answer.customCm;
    if (S.parking) await saveQualification(answer);
  }

  const departure = await askDeparture();
  if (!departure) return;

  if (departure.mode === 'now') {
    const choice = await openModal({
      title: 'Vous partez maintenant',
      body: el('div', { class: 'note note-orange', html:
        'Si personne de l’application ne récupère réellement votre place, <b>vous ne gagnerez pas de points</b>. '
        + 'Vous recevrez seulement un « Merci » pour le signalement.' }),
      actions: [
        { label: 'J’attends un conducteur', value: 'wait', variant: 'btn-primary' },
        { label: 'Je pars sans attendre', value: 'leave', variant: 'btn-orange' },
      ],
    });
    if (choice === 'leave') { await signalFreeSpot({ pos, qual, customCm, vehicle, fromDeparture: true }); return; }
    if (choice !== 'wait') return;
  }

  const spotCm = estimatedSpotCm(vehicle.lengthCm, qual, customCm);
  const createdAt = db.now();
  const spot = {
    spotId: S.uid,
    donorUid: S.uid,
    donorPseudo: S.profile?.pseudo || 'Conducteur',
    lat: pos.lat,
    lng: pos.lng,
    qual,
    customCm: customCm ?? null,
    spotCm,
    vehicle: vehicleCard(vehicle),
    mode: departure.mode,
    readyInMin: departure.minutes,
    readyAt: createdAt + departure.minutes * 60_000,
    status: 'open',
    createdAt,
    expiresAt: createdAt + TUNING.spotTtlS * 1000,
    excluded: {},
    blockedAboveCm: null,
    donorPoints: S.profile?.points || 0,
  };
  await db.write(SPOT(S.uid), spot);
  db.updateOnDisconnect(SPOT(S.uid), { status: 'gone' });
  S.spot = spot;
  await db.addHistory(S.uid, 'Départ annoncé', 0, departure.mode === 'now' ? 'Maintenant' : `Dans ${departure.minutes} min`);
  setPhase('giving', 'donor');
  startOfferLoop();
}

/* ─────────────────────── §13 à §16 — boucle de mise en relation ─────────────────────── */

export function stopOfferLoop() {
  if (S.offerLoop) {
    S.offerLoop.cancelled = true;
    S.offerLoop.unwatch?.();
  }
  S.offerLoop = null;
  clearTimer('offerTick');
}

export function startOfferLoop() {
  stopOfferLoop();
  const token = { cancelled: false, status: 'Recherche de conducteurs compatibles…' };
  S.offerLoop = token;
  every('offerTick', 1000, emit);

  // Quand le serveur est en service, c'est lui qui cherche et qui prévient les
  // conducteurs — y compris application fermée. Le téléphone du donneur n'a
  // plus qu'à attendre qu'on lui présente un candidat.
  // Sans serveur déployé, on garde l'ancien fonctionnement, piloté ici.
  if (S.serverMatching) {
    token.status = 'Recherche en cours — vous pouvez fermer l’application.';
    watchServerMatching(token);
    return;
  }

  loop(token).catch((err) => {
    console.error('[parkalert] boucle de mise en relation', err);
    token.status = 'Erreur de connexion — nouvelle tentative…';
  });
}

/**
 * Mode serveur : on surveille sa propre place. Le serveur y dépose le candidat
 * qu'il a retenu ; le conducteur qui part garde la décision finale.
 */
function watchServerMatching(token) {
  let asking = false;
  token.unwatch = db.subscribe(SPOT(S.uid), async (spot) => {
    if (token.cancelled || !spot) return;
    S.spot = spot;

    if (spot.status === 'offering') {
      token.status = 'Un conducteur a été sollicité…';
      token.offerExpiresAt = Number(spot.offerExpiresAt) || null;
    } else if (spot.status === 'open') {
      token.status = 'Recherche en cours — vous pouvez fermer l’application.';
      token.offerExpiresAt = null;
    }
    emit();

    if (spot.status !== 'pending-confirm' || !spot.pendingSeeker || asking) return;

    asking = true;
    token.offerExpiresAt = null;
    const candidate = { ...spot.pendingSeeker };
    const accepted = await confirmCandidate(spot, candidate, { outOfRadius: spot.pendingSeeker.outOfRadius });
    asking = false;
    if (token.cancelled) return;

    if (!accepted) {
      // Refus : on écarte ce conducteur et la place repart en recherche côté serveur.
      await db.patch(`${SPOT(S.uid)}/excluded`, { [candidate.uid]: db.now() });
      await db.del(`offers/${candidate.uid}`).catch(() => {});
      await db.patch(SPOT(S.uid), { status: 'open', pendingSeeker: null, offeredTo: null, offerExpiresAt: null });
    }
  });
}

export function loopStatus() { return S.offerLoop?.status || ''; }
export function loopCountdown() {
  const t = S.offerLoop;
  if (!t?.offerExpiresAt) return null;
  return Math.max(0, Math.ceil((t.offerExpiresAt - Date.now()) / 1000));
}

async function loop(token) {
  while (!token.cancelled) {
    const spot = await db.readOnce(SPOT(S.uid));
    if (!spot || token.cancelled) return;
    if (spot.status === 'reserved' || spot.status === 'gone') return;
    S.spot = spot;

    const remainingMin = spot.mode === 'timed'
      ? Math.max(0, Math.ceil((spot.readyAt - Date.now()) / 60_000))
      : 0;
    // §13/§14 : priorité aux points pour un départ annoncé, au plus rapide sinon.
    const mode = (spot.mode === 'timed' && remainingMin > 0) ? 'points' : 'fastest';

    const seekers = freshSeekers(await db.readOnce('seekers'));
    const queue = buildQueue({
      spot: { lat: spot.lat, lng: spot.lng },
      spotCm: spot.spotCm,
      readyInMin: remainingMin,
      seekers,
      exclude: Object.keys(spot.excluded || {}),
      blockedAboveCm: spot.blockedAboveCm ?? null,
    }, mode);

    if (!queue.length) {
      token.status = mode === 'points'
        ? `Aucun conducteur compatible pour l’instant — nous continuons à chercher (${remainingMin} min restantes).`
        : 'Aucun conducteur compatible pour l’instant — nous continuons à chercher.';
      token.offerExpiresAt = null;
      emit();
      await wait(5000);
      continue;
    }

    let reserved = false;
    for (const candidate of queue) {
      if (token.cancelled) return;
      const offer = await claimOffer(candidate, spot);
      if (!offer) continue; // ce conducteur est déjà sollicité ailleurs

      token.status = `Proposition envoyée à un conducteur (arrivée estimée ${candidate.etaMin} min)…`;
      token.offerExpiresAt = offer.expiresAt;
      await db.patch(SPOT(S.uid), { status: 'offering' });
      emit();

      const outcome = await waitOffer(candidate.uid, offer.expiresAt, token);
      token.offerExpiresAt = null;

      if (token.cancelled) return;
      if (outcome === 'accepted') {
        const done = await confirmCandidate(spot, candidate, offer);
        if (done) { reserved = true; break; }
        await excludeCandidate(candidate.uid);
        await db.del(`offers/${candidate.uid}`);
        continue;
      }
      // Refus ou absence de réponse : la place passe au candidat suivant (§15).
      await db.del(`offers/${candidate.uid}`);
      await excludeCandidate(candidate.uid);
    }

    if (reserved) return;
    if (token.cancelled) return;
    await db.patch(SPOT(S.uid), { status: 'open' });
    await wait(3000);
  }
}

function freshSeekers(raw) {
  const cutoff = db.now() - TUNING.seekerTtlS * 1000;
  return db.toList(raw, 'uid').filter((s) => s && s.uid !== S.uid && (Number(s.ts) || 0) > cutoff);
}

/** Réserve l'attention d'un conducteur : un chercheur ne reçoit qu'une proposition à la fois. */
async function claimOffer(candidate, spot) {
  const offer = {
    offerId: `${spot.spotId}-${db.now()}`,
    spotId: spot.spotId,
    donorUid: spot.donorUid,
    donorPseudo: spot.donorPseudo,
    donorVehicle: spot.vehicle,
    lat: spot.lat,
    lng: spot.lng,
    qual: spot.qual,
    spotCm: spot.spotCm,
    mode: spot.mode,
    readyAt: spot.readyAt,
    etaMin: candidate.etaMin,
    destM: candidate.destM,
    approachM: candidate.approachM,
    outOfRadius: !!candidate.outOfRadius,
    requestedRadiusM: Number(candidate.radiusM) || null,
    marginal: !!candidate.fit?.marginal,
    gapCm: candidate.fit?.gapCm ?? null,
    createdAt: db.now(),
    expiresAt: db.now() + TUNING.offerTimeoutS * 1000,
    response: 'pending',
  };
  const res = await db.transaction(`offers/${candidate.uid}`, (cur) => {
    if (cur && cur.response === 'pending' && Number(cur.expiresAt) > Date.now()) return undefined;
    return offer;
  });
  return res.committed ? offer : null;
}

/** Attend la réponse du conducteur, ou l'expiration du délai (§15). */
function waitOffer(uid, expiresAt, token) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; clearInterval(poll); unsub(); resolve(v); };
    const unsub = db.subscribe(`offers/${uid}`, (value) => {
      if (!value) return finish('gone');
      if (value.response === 'accepted') finish('accepted');
      else if (value.response === 'declined') finish('declined');
    });
    const poll = setInterval(() => {
      if (token.cancelled) finish('cancelled');
      else if (Date.now() > expiresAt) finish('timeout');
    }, 500);
  });
}

async function excludeCandidate(uid) {
  await db.patch(`${SPOT(S.uid)}/excluded`, { [uid]: db.now() });
}

/** §16 — le donneur voit le véhicule candidat et décide. */
async function confirmCandidate(spot, candidate, offer) {
  const v = candidate.vehicle || {};
  const label = [v.label, v.color].filter(Boolean).join(' ') || 'Un véhicule';
  const decision = await openModal({
    title: `${label} souhaite récupérer votre place`,
    subtitle: `Arrivée estimée : ${candidate.etaMin} min`,
    body: el('div', { class: 'note', html:
      `<div class="kv"><span>Véhicule</span><b>${esc(label)}</b></div>`
      + `<div class="kv"><span>Arrivée estimée</span><b>${candidate.etaMin} min</b></div>`
      + `<div class="kv"><span>Distance</span><b>${fmtDistance(candidate.approachM)}</b></div>`
      + `<div class="kv"><span>Points d’entraide</span><b>${Number(candidate.points) || 0}</b></div>` }),
    actions: [
      { label: 'Accepter', value: 'yes', variant: 'btn-primary' },
      { label: 'Refuser', value: 'no', variant: 'btn-red' },
    ],
    dismissible: false,
  });

  if (decision !== 'yes') return false;

  // Verrou : la place ne doit pas être réservée deux fois (§16).
  const res = await db.transaction(`${SPOT(S.uid)}/status`, (cur) => (cur === 'reserved' ? undefined : 'reserved'));
  if (!res.committed) return false;

  const session = await sess.createSession({
    spot, offer, seeker: candidate, etaMin: candidate.etaMin,
  });
  await db.patch(SPOT(S.uid), { reservedBy: candidate.uid, sessionId: session.id, pendingSeeker: null });
  await db.patch(`offers/${candidate.uid}`, { response: 'confirmed', sessionId: session.id });
  await db.addHistory(S.uid, 'Place réservée par un conducteur', 0, label);
  stopOfferLoop();
  enterDonorSession(session.id);
  return true;
}

/* ─────────────────────── §18 à §28 — réservation côté donneur ─────────────────────── */

export function enterDonorSession(sessionId) {
  setPhase('session', 'donor');
  db.patch(`users/${S.uid}`, { activeSession: sessionId }).catch(() => {});
  sess.watchSession(sessionId, onDonorSessionUpdate);
  sess.startLiveShare(sessionId, 'donor');
  every('donorMonitor', 1000, donorMonitor);
}

function onDonorSessionUpdate(session) {
  if (!session) { exitDonorSession(); return; }
  if (session.status === 'completing') return; // clôture en cours des deux côtés
  if (session.status !== 'active') {
    if (session.status === 'completed') finishDonor(session);
    else if (session.reason === 'no-fit') onSeekerCannotPark(session);
    else if (session.reason === 'cancelled-seeker') onSeekerCancelled(session);
    else exitDonorSession();
    return;
  }
  // §28 — si l'autre conducteur confirme après nous, c'est ici que la boucle se ferme.
  if (session.confirmDonor && session.confirmSeeker) { tryComplete(session.id); return; }
  if (session.seekerState === sess.SEEKER_STATE.NEARBY && !S.flags?.nearbyNotified) {
    S.flags = { ...S.flags, nearbyNotified: true };
    notify('Votre correspondant est arrivé à proximité', 'Vous pouvez lui transmettre la place.', '#4ade80');
  }
  S.map?.setPartner(session.seekerPos, `${session.seekerPseudo} — ${[session.seekerVehicle?.label, session.seekerVehicle?.color].filter(Boolean).join(' ')}`);
}

/** §20 rappel avant l'arrivée · §23 gestion du retard. */
async function donorMonitor() {
  const session = S.session;
  if (!session || session.status !== 'active') return;
  const now = Date.now();
  const { dueAt, toleranceAt } = sess.deadlines(session);

  // §20 — quelques minutes avant l'arrivée, rejoindre sa voiture.
  if (session.donorState === sess.DONOR_STATE.AWAY
      && now >= dueAt - TUNING.readyReminderS * 1000
      && !S.flags?.readyReminded) {
    S.flags = { ...S.flags, readyReminded: true };
    const mins = Math.max(1, Math.round((dueAt - now) / 60_000));
    notify('Rejoignez votre voiture', `Votre conducteur arrive dans environ ${mins} min.`, '#f59e0b');
  }

  // §23 — au-delà de la tolérance, c'est le donneur qui décide.
  if (now > toleranceAt
      && session.seekerState !== sess.SEEKER_STATE.NEARBY
      && session.seekerState !== sess.SEEKER_STATE.PARKED
      && !S.flags?.lateAsked) {
    S.flags = { ...S.flags, lateAsked: true };
    await handleLate(session);
  }
  emit();
}

async function handleLate(session) {
  const lateMin = Math.max(2, Math.round(sess.lateS(session) / 60));
  const answer = await openModal({
    title: `Votre conducteur a ${lateMin} min de retard`,
    subtitle: 'Vous n’êtes pas obligé d’attendre.',
    body: el('div', { class: 'note note-orange', html: 'La réattribution donne la place au conducteur compatible qui peut arriver <b>le plus vite</b>.' }),
    actions: [
      { label: 'Oui, j’attends encore', value: 'wait', variant: 'btn-primary' },
      { label: 'Non, chercher un autre conducteur', value: 'reassign', variant: 'btn-orange' },
    ],
    dismissible: false,
  });

  if (answer === 'wait') {
    const extra = await askExtraWait();
    const ms = (extra || 2) * 60_000;
    await db.patch(sess.SESSION_PATH(session.id), { extraWaitMs: (Number(session.extraWaitMs) || 0) + ms });
    S.flags = { ...S.flags, lateAsked: false };
    toast('Attente prolongée', `Vous attendez ${extra || 2} min de plus.`, '#4ade80');
    return;
  }
  await reassign(session);
}

/** §24 — réattribution urgente : le plus rapide d'abord. */
export async function reassign(session) {
  await db.bumpCounter(session.seekerUid, 'late');
  await sess.closeSession(session.id, 'cancelled', 'late-reassign');
  sess.stopLiveShare();
  unsubscribe('session');
  clearTimer('donorMonitor');
  S.session = null;
  S.flags = {};

  const spot = await db.readOnce(SPOT(S.uid));
  if (!spot) { setPhase('idle'); return; }
  await db.patch(SPOT(S.uid), {
    status: 'open',
    mode: 'urgent',
    readyAt: db.now(),
    readyInMin: 0,
    reservedBy: null,
    sessionId: null,
    excluded: { ...(spot.excluded || {}), [session.seekerUid]: db.now() },
  });
  toast('Recherche d’un autre conducteur', 'Priorité au conducteur qui peut arriver le plus vite.', '#f59e0b');
  setPhase('giving', 'donor');
  startOfferLoop();
}

/** §20 — « Je suis dans ma voiture et prêt à partir ». */
export async function donorReady() {
  if (!S.session) return;
  await db.patch(sess.SESSION_PATH(S.session.id), { donorState: sess.DONOR_STATE.READY, readyAt: db.now() });
  toast('C’est noté', 'Le conducteur qui arrive est prévenu que la place se libère.', '#4ade80');
}

export async function donorHeading() {
  if (!S.session) return;
  await db.patch(sess.SESSION_PATH(S.session.id), { donorState: sess.DONOR_STATE.HEADING });
}

/** §28 — « Place transmise » côté donneur, puis validation croisée. */
export async function donorConfirmTransfer() {
  const session = S.session;
  if (!session) return;
  await db.patch(sess.SESSION_PATH(session.id), {
    confirmDonor: true, donorState: sess.DONOR_STATE.LEFT, donorPos: S.pos ? { ...S.pos, approx: false, ts: db.now() } : null,
  });
  toast('Transmission confirmée', 'En attente de la confirmation de l’autre conducteur.', '#4ade80');
  await tryComplete(session.id);
}

/**
 * §28/§29/§30 — clôture : double confirmation + cohérence GPS,
 * puis attribution des points en respectant les règles anti-triche.
 */
async function tryComplete(sessionId) {
  if (!sessionId) return;
  const session = await db.readOnce(sess.SESSION_PATH(sessionId));
  if (!session || session.status !== 'active') return;
  const check = transferValid({ ...session, id: sessionId });
  if (!check.valid) return;

  // La clôture peut être déclenchée deux fois (bouton + mise à jour temps réel) :
  // ce verrou garantit qu'une transmission n'est récompensée qu'une seule fois.
  const claim = await db.transaction(`${sess.SESSION_PATH(sessionId)}/status`,
    (cur) => (cur === 'active' ? 'completing' : undefined));
  if (!claim.committed) return;

  const profile = await db.readOnce(`users/${S.uid}`);
  const elig = rewardEligibility(profile, session.seekerUid);
  let awarded = 0;

  if (elig.eligible) {
    awarded = elig.points;
    await db.addPoints(S.uid, awarded);
    await db.patch(`users/${S.uid}`, { lastRewardAt: db.now() });
    await db.patch(`users/${S.uid}/pairCooldowns`, { [session.seekerUid]: db.now() });
  }
  await db.bumpStat(S.uid, 'given');
  await db.bumpStat(session.seekerUid, 'taken');
  await sess.closeSession(sessionId, 'completed', 'transferred', { pointsAwarded: awarded });
  await db.del(SPOT(S.uid));
  await db.del(`users/${S.uid}/parking`);
  await db.addHistory(S.uid, 'Place transmise avec succès', awarded,
    awarded ? '' : (elig.reason === 'cooldown' ? 'Sans points : moins de 30 min depuis la dernière récompense' : 'Sans points : déjà récompensé avec ce conducteur aujourd’hui'));
}

function finishDonor(session) {
  const pts = Number(session.pointsAwarded) || 0;
  exitDonorSession();
  if (pts > 0) {
    infoSheet('Transmission réussie',
      `Merci ! <b>+${pts} points d’entraide</b> ont été ajoutés à votre compte.<br>`
      + 'Ils vous rendront prioritaire la prochaine fois que vous chercherez une place.');
  } else {
    infoSheet('Transmission réussie',
      'Merci pour votre entraide !<br>Aucun point cette fois : une récompense n’est possible '
      + 'qu’une fois toutes les 30 minutes, et une fois par jour avec le même conducteur, pour éviter les fausses transmissions.');
  }
}

export function exitDonorSession() {
  db.patch(`users/${S.uid}`, { activeSession: null }).catch(() => {});
  sess.stopLiveShare();
  unsubscribe('session');
  clearTimer('donorMonitor');
  S.session = null;
  S.flags = {};
  S.map?.setPartner(null);
  setPhase(S.parking ? 'parked' : 'idle');
}

/** §25 — le donneur renonce alors que quelqu'un est déjà en route. */
export async function donorCancelSession() {
  const session = S.session;
  if (!session) return;
  const ok = await confirmSheet(
    'Annuler la transmission ?',
    'Un conducteur est déjà en route vers votre place.',
    'Oui, annuler', 'Non, je continue', 'btn-red',
    'Une annulation tardive répétée fait baisser votre indice de fiabilité.');
  if (!ok) return;
  await db.bumpCounter(S.uid, 'lateCancel');
  await sess.closeSession(session.id, 'cancelled', 'cancelled-donor');
  await db.del(SPOT(S.uid));
  await db.addHistory(S.uid, 'Transmission annulée par vous', 0);
  exitDonorSession();
}

/** §26/§27 — le conducteur arrivé n'arrive pas à se garer. */
export async function onSeekerCannotPark(session) {
  const blocked = Number(session.seekerNeededCm) || null;
  const keep = await openModal({
    title: 'Le conducteur ne peut pas se garer',
    subtitle: session.noFitReason === 'short' ? 'Place trop courte pour son véhicule' : 'Accès impossible',
    body: el('div', { class: 'note', html: 'Nous pouvons rechercher immédiatement un véhicule plus petit, ou vous pouvez partir : la place deviendra alors un simple signalement.' }),
    actions: [
      { label: 'Chercher un autre conducteur', value: 'keep', variant: 'btn-primary' },
      { label: 'Je pars maintenant', value: 'go', variant: 'btn-orange' },
    ],
    dismissible: false,
  });

  sess.stopLiveShare();
  unsubscribe('session');
  clearTimer('donorMonitor');
  S.session = null;
  S.flags = {};

  if (keep === 'keep') {
    const spot = await db.readOnce(SPOT(S.uid));
    await db.patch(SPOT(S.uid), {
      status: 'open',
      mode: 'urgent',
      readyAt: db.now(),
      readyInMin: 0,
      reservedBy: null,
      sessionId: null,
      blockedAboveCm: blocked,
      excluded: { ...(spot?.excluded || {}), [session.seekerUid]: db.now() },
    });
    setPhase('giving', 'donor');
    startOfferLoop();
    toast('Nouvelle recherche', 'Nous cherchons un véhicule plus petit ou demandant moins de marge.', '#38bdf8');
    return;
  }

  const vehicle = currentVehicle();
  await db.del(SPOT(S.uid));
  await signalFreeSpot({
    pos: { lat: session.spotLat, lng: session.spotLng },
    qual: session.spotQual, customCm: null, vehicle, fromDeparture: true,
  });
}

/** §25 — le conducteur qui arrivait renonce : la place est remise en jeu. */
export async function onSeekerCancelled(session) {
  sess.stopLiveShare();
  unsubscribe('session');
  clearTimer('donorMonitor');
  S.session = null;
  S.flags = {};
  const spot = await db.readOnce(SPOT(S.uid));
  if (!spot) { setPhase(S.parking ? 'parked' : 'idle'); return; }
  await db.patch(SPOT(S.uid), {
    status: 'open',
    reservedBy: null,
    sessionId: null,
    excluded: { ...(spot.excluded || {}), [session.seekerUid]: db.now() },
  });
  toast('Le conducteur a annulé', 'Votre place est de nouveau proposée aux autres conducteurs.', '#f59e0b');
  setPhase('giving', 'donor');
  startOfferLoop();
}

/* ─────────────────────── §32/§33 — signalement de place libre ─────────────────────── */

export async function signalFreeSpot(preset = null) {
  let pos = preset?.pos;
  let qual = preset?.qual;
  let customCm = preset?.customCm ?? null;
  const vehicle = preset?.vehicle || currentVehicle();

  if (!pos) {
    pos = requirePosition();
    if (!pos) return;
  }
  if (!qual) {
    const answer = await askComfort({
      title: 'Comment est cette place ?',
      subtitle: 'Une estimation suffit — vous pouvez vous servir de votre propre véhicule comme repère.',
      value: 'normal',
    });
    if (!answer || answer === 'later') return;
    qual = answer.qual; customCm = answer.customCm;
  }

  const spotCm = vehicle ? estimatedSpotCm(vehicle.lengthCm, qual, customCm) : null;
  const id = db.pushKey('freespots');
  const signal = {
    id,
    uid: S.uid,
    pseudo: S.profile?.pseudo || 'Conducteur',
    lat: pos.lat,
    lng: pos.lng,
    qual,
    spotCm,
    createdAt: db.now(),
    expiresAt: db.now() + TUNING.signalTtlS * 1000,
    guaranteed: false,
    thanks: {},
  };
  await db.write(`freespots/${id}`, signal);
  db.clearOnDisconnect(`freespots/${id}`);
  S.signal = signal;
  await db.bumpStat(S.uid, 'signals');
  await db.addHistory(S.uid, 'Place libre signalée', 0, preset?.fromDeparture ? 'Départ sans attendre' : '');
  setPhase('signal');
  after('signalExpire', TUNING.signalTtlS * 1000, () => { if (S.signal?.id === id) removeSignal(); });

  await infoSheet('Place signalée — disponibilité non garantie',
    'Merci ! Votre signalement est visible quelques minutes sur la carte.<br>'
    + 'Un simple signalement ne rapporte pas de points : seule une transmission confirmée des deux côtés en donne.',
    'C’est noté');
}

export async function removeSignal() {
  if (S.signal) await db.del(`freespots/${S.signal.id}`);
  S.signal = null;
  clearTimer('signalExpire');
  setPhase(S.parking ? 'parked' : 'idle');
}

/* ─────────────────────── Annulation de l'annonce ─────────────────────── */

export async function cancelGiving() {
  const ok = await confirmSheet('Retirer votre place ?', 'Elle ne sera plus proposée aux conducteurs.', 'Retirer', 'Garder', 'btn-red');
  if (!ok) return;
  stopOfferLoop();
  const spot = await db.readOnce(SPOT(S.uid));
  if (spot?.status === 'offering' && spot.reservedBy) await db.del(`offers/${spot.reservedBy}`);
  await db.del(SPOT(S.uid));
  S.spot = null;
  setPhase(S.parking ? 'parked' : 'idle');
}

/** §33 — le donneur part sans attendre : la place devient un simple signalement. */
export async function leaveWithoutWaiting() {
  const ok = await confirmSheet(
    'Partir sans attendre ?',
    'Votre place deviendra un simple signalement.',
    'Je pars', 'J’attends encore', 'btn-orange',
    'Pas de transmission confirmée = <b>pas de points</b>. Simple « Merci » pour avoir alerté la communauté.');
  if (!ok) return;
  stopOfferLoop();
  const spot = await db.readOnce(SPOT(S.uid));
  await db.del(SPOT(S.uid));
  await db.del(`users/${S.uid}/parking`);
  S.parking = null;
  const vehicle = currentVehicle();
  await signalFreeSpot({
    pos: { lat: spot?.lat ?? S.pos?.lat, lng: spot?.lng ?? S.pos?.lng },
    qual: spot?.qual || 'normal',
    customCm: spot?.customCm ?? null,
    vehicle,
    fromDeparture: true,
  });
}

/* ─────────────────────── Reprise après rechargement ─────────────────────── */

export async function resumeDonor() {
  const spot = await db.readOnce(SPOT(S.uid));
  if (!spot) return false;
  if (spot.status === 'reserved' && spot.sessionId) {
    const session = await db.readOnce(sess.SESSION_PATH(spot.sessionId));
    if (session && session.status === 'active') { S.spot = spot; enterDonorSession(spot.sessionId); return true; }
  }
  if (spot.status === 'gone' || (spot.expiresAt && spot.expiresAt < db.now())) {
    await db.del(SPOT(S.uid));
    return false;
  }
  S.spot = spot;
  await db.patch(SPOT(S.uid), { status: 'open' });
  db.updateOnDisconnect(SPOT(S.uid), { status: 'gone' });
  setPhase('giving', 'donor');
  startOfferLoop();
  return true;
}

export { scheduleParkedReminder };
