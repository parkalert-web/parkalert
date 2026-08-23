/**
 * ParkAlert — parcours de celui qui CHERCHE une place.
 * §8 recherche autour d'une destination · §9 rayon intelligent · §15 proposition
 * §21 ne pas bloquer la rue · §22 proximité · §23 retard · §26 « je ne peux pas me garer »
 */

import { TUNING } from './config.js';
import { distanceM, fmtDistance, cancelImpact, fmtMetres } from './core.js';
import * as db from './backend.js';
import {
  S, setPhase, currentVehicle, vehicleById, vehicleCard, neededForVehicle,
  every, clearTimer, unsubscribe, emit, requirePosition,
} from './state.js';
import { toast, notify, openModal, closeModal, el, esc, chooser, $ } from './ui.js';
import { askNoFitReason, confirmSheet, infoSheet, fitBadge, askNewEta } from './pickers.js';
import { geocode, reverseGeocode } from './mapview.js';
import * as sess from './session.js';

const SEEK = () => `seekers/${S.uid}`;

/* ─────────────────────── §8 — lancer une recherche ─────────────────────── */

export async function startSearch() {
  const pos = requirePosition();
  if (!pos) return;
  const vehicle = currentVehicle();
  if (!vehicle) { toast('Véhicule manquant', 'Enregistrez d’abord un véhicule dans votre profil.', '#ef4444'); return; }

  const form = await destinationForm(pos, vehicle);
  if (!form) return;

  const needed = neededForVehicle(form.vehicle);
  const seeker = {
    uid: S.uid,
    pseudo: S.profile?.pseudo || 'Conducteur',
    points: S.profile?.points || 0,
    reliability: S.reliability ?? 100,
    lat: pos.lat,
    lng: pos.lng,
    destLat: form.dest.lat,
    destLng: form.dest.lng,
    destLabel: form.dest.label || 'Destination',
    radiusM: form.radiusM,
    neededCm: needed,
    vehicle: vehicleCard(form.vehicle),
    state: 'searching',
    ts: db.now(),
  };
  await db.write(SEEK(), seeker);
  db.clearOnDisconnect(SEEK());
  S.seeker = seeker;
  S.map?.setDestination(form.dest, form.radiusM);
  setPhase('searching', 'seeker');
  every('seekPing', 10_000, pingSeeker);
  await db.addHistory(S.uid, 'Recherche de place lancée', 0, seeker.destLabel);
  toast('Recherche lancée', 'Vous serez prévenu dès qu’une place compatible se libère.', '#38bdf8');
}

async function pingSeeker() {
  if (S.phase !== 'searching' || !S.pos) return;
  await db.patch(SEEK(), { lat: S.pos.lat, lng: S.pos.lng, ts: db.now(), points: S.profile?.points || 0 });
}

export async function stopSearch(silent = false) {
  clearTimer('seekPing');
  await db.del(SEEK());
  S.seeker = null;
  S.map?.setDestination(null);
  setPhase(S.parking ? 'parked' : 'idle');
  if (!silent) toast('Recherche annulée', 'Vous n’êtes plus visible par les conducteurs qui partent.', '#64748b');
}

/** Formulaire de recherche : destination, rayon, véhicule, confort (§8). */
async function destinationForm(pos, defaultVehicle) {
  let dest = null;

  const input = el('input', { class: 'field', id: 'dest-input', type: 'search', placeholder: 'Adresse, lieu, quartier…', autocomplete: 'off' });
  const results = el('div', { class: 'results' });
  const chosen = el('div', { class: 'chosen', text: 'Aucune destination choisie' });

  const setDest = (d) => {
    dest = d;
    chosen.textContent = d ? `${d.label}` : 'Aucune destination choisie';
    chosen.classList.toggle('ok', !!d);
    results.innerHTML = '';
  };

  const runSearch = async () => {
    const q = input.value.trim();
    if (q.length < 3) return;
    results.innerHTML = '<div class="muted">Recherche…</div>';
    try {
      const list = await geocode(q, pos);
      results.innerHTML = '';
      if (!list.length) { results.innerHTML = '<div class="muted">Aucun résultat</div>'; return; }
      for (const r of list.slice(0, 5)) {
        results.append(el('button', {
          class: 'result', type: 'button',
          onclick: () => setDest({ lat: r.lat, lng: r.lng, label: r.short }),
        }, el('b', { text: r.short }), el('span', { text: r.label })));
      }
    } catch { results.innerHTML = '<div class="muted">Recherche indisponible — utilisez la carte.</div>'; }
  };

  let debounce;
  input.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(runSearch, 500); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } });

  const btnHere = el('button', {
    class: 'btn btn-ghost small', type: 'button',
    onclick: async () => {
      setDest({ lat: pos.lat, lng: pos.lng, label: 'Ma position actuelle' });
      const name = await reverseGeocode(pos);
      if (name && dest?.label === 'Ma position actuelle') setDest({ ...dest, label: name });
    },
  }, 'Ma position');

  const btnMap = el('button', {
    class: 'btn btn-ghost small', type: 'button',
    onclick: async () => {
      closeModal('map-pick');
      toast('Choisissez sur la carte', 'Appuyez à l’endroit où vous allez.', '#38bdf8', 8000);
      const p = await S.map.pick();
      const name = await reverseGeocode(p);
      pendingPick = { ...p, label: name || 'Point choisi sur la carte' };
    },
  }, 'Sur la carte');

  const radius = el('input', { type: 'range', min: '100', max: '1500', step: '50', value: String(S.lastRadius || 400), class: 'slider' });
  const radiusVal = el('b', { text: `${S.lastRadius || 400} m` });
  radius.addEventListener('input', () => { radiusVal.textContent = `${radius.value} m`; });

  const vehiclePicker = chooser(S.vehicles.map((v) => ({ id: v.id, label: `${v.brand} ${v.model}`, hint: `${fmtMetres(v.lengthCm)}${v.color ? ` · ${v.color}` : ''}` })),
    { value: defaultVehicle.id, columns: 1 });

  const needNote = el('p', { class: 'form-note' });
  const refreshNeed = () => {
    const v = vehicleById(vehiclePicker.value);
    needNote.textContent = v
      ? `Nous chercherons une place d’au moins ${fmtMetres(neededForVehicle(v))} — la taille qu’il faut à cette voiture.`
      : '';
  };
  vehiclePicker.addEventListener('choose', refreshNeed);
  refreshNeed();

  const body = el('div', {},
    el('div', { class: 'sublabel', text: 'Où allez-vous ?' }),
    input,
    el('div', { class: 'btn-row' }, btnHere, btnMap),
    results,
    chosen,
    el('div', { class: 'sublabel', text: 'À quelle distance maximale ?' }),
    el('div', { class: 'slider-row' }, radius, radiusVal),
    el('div', { class: 'sublabel', text: 'Véhicule utilisé' }),
    vehiclePicker,
    needNote,
  );

  if (S.pendingDest) { setDest(S.pendingDest); S.pendingDest = null; }

  const res = await openModal({
    title: 'Je cherche une place',
    body,
    actions: [{ label: 'Lancer la recherche', value: 'ok', variant: 'btn-primary', keep: true, onClick: () => {
      if (!dest) { toast('Destination manquante', 'Indiquez où vous allez.', '#ef4444'); return; }
      closeModal('ok');
    } }],
  });

  if (res === 'map-pick') {
    // L'utilisateur pointe la destination sur la carte, puis le formulaire revient.
    const picked = await waitPick();
    S.pendingDest = picked;
    S.lastRadius = Number(radius.value);
    return destinationForm(pos, vehicleById(vehiclePicker.value));
  }
  if (res !== 'ok') return null;

  S.lastRadius = Number(radius.value);
  return {
    dest,
    radiusM: Number(radius.value),
    vehicle: vehicleById(vehiclePicker.value),
  };
}

let pendingPick = null;
function waitPick() {
  return new Promise((resolve) => {
    const iv = setInterval(() => {
      if (pendingPick) { clearInterval(iv); const p = pendingPick; pendingPick = null; resolve(p); }
    }, 200);
  });
}

/* ─────────────────────── §15 — réception d'une proposition ─────────────────────── */

export function watchOffers() {
  unsubscribe('offers');
  S.unsub.offers = db.subscribe(`offers/${S.uid}`, async (offer) => {
    S.offer = offer;
    if (!offer) {
      // Le donneur a refusé ou retiré sa place : on ne reste pas bloqué en attente.
      if (S.phase === 'offered') {
        offerShownFor = null;
        setPhase('searching', 'seeker');
        toast('Place non attribuée', 'Le conducteur a choisi un autre candidat. Votre recherche continue.', '#f59e0b');
      }
      return;
    }
    if (offer.response === 'confirmed' && offer.sessionId) {
      if (S.session?.id === offer.sessionId) return; // déjà entré dans cette réservation
      closeModal();
      await db.del(SEEK());
      clearTimer('seekPing');
      enterSeekerSession(offer.sessionId);
      return;
    }
    if (offer.response !== 'pending') return;
    if (Number(offer.expiresAt) < db.now()) return;
    if (S.phase !== 'searching') return;
    showOffer(offer);
  });
}

let offerShownFor = null;

async function showOffer(offer) {
  if (offerShownFor === offer.offerId) return;
  offerShownFor = offer.offerId;

  notify('Une place compatible va se libérer', `À ${fmtDistance(offer.destM)} de votre destination`, '#4ade80');

  const countdown = el('div', { class: 'countdown' });
  const bar = el('div', { class: 'countdown-bar' });
  const tick = () => {
    const left = Math.max(0, Math.ceil((offer.expiresAt - Date.now()) / 1000));
    countdown.textContent = `${left} s pour répondre`;
    bar.style.width = `${Math.max(0, (left / TUNING.offerTimeoutS) * 100)}%`;
    if (left <= 0) { clearInterval(iv); closeModal('timeout'); }
  };
  const iv = setInterval(tick, 250); tick();

  const extra = offer.outOfRadius
    ? `<div class="note note-orange">Cette place est à ${fmtDistance(offer.destM)} de votre destination alors que vous aviez demandé ${fmtDistance(offer.requestedRadiusM)}. Voulez-vous quand même la voir ?</div>`
    : '';

  const body = el('div', {},
    el('div', { class: 'offer-hero', html:
      `<div class="offer-line">À <b>${fmtDistance(offer.destM)}</b> de votre destination</div>`
      + `<div class="offer-line">Vous pouvez y arriver dans environ <b>${offer.etaMin} min</b></div>`
      + `<div class="offer-line small">${esc([offer.donorVehicle?.label, offer.donorVehicle?.color].filter(Boolean).join(' ') || 'Véhicule sur place')} libère la place</div>`
      + `<div style="margin-top:8px">${fitBadge({ ok: true, marginal: offer.marginal })}</div>` }),
    el('div', { html: extra }),
    el('div', { class: 'countdown-wrap' }, bar),
    countdown,
  );

  const res = await openModal({
    title: 'Une place compatible va se libérer',
    body,
    actions: [
      { label: 'Je veux cette place', value: 'accept', variant: 'btn-primary' },
      { label: 'Non merci', value: 'decline' },
    ],
    dismissible: false,
  });
  clearInterval(iv);

  if (res === 'accept') {
    const ok = await db.transaction(`offers/${S.uid}/response`, (cur) => (cur === 'pending' ? 'accepted' : undefined));
    if (!ok.committed) { toast('Trop tard', 'Cette proposition n’est plus disponible.', '#f59e0b'); offerShownFor = null; return; }
    setPhase('offered', 'seeker');
    toast('Demande envoyée', 'En attente de la confirmation du conducteur qui part…', '#38bdf8');
  } else if (res === 'decline') {
    await db.patch(`offers/${S.uid}`, { response: 'declined' });
    offerShownFor = null;
  } else {
    offerShownFor = null; // expiration : la place passe au candidat suivant
  }
}

/* ─────────────────────── §18 à §28 — réservation côté chercheur ─────────────────────── */

export function enterSeekerSession(sessionId) {
  setPhase('session', 'seeker');
  S.flags = {};
  // La réservation devient la référence : la proposition n'a plus lieu d'être.
  db.patch(`users/${S.uid}`, { activeSession: sessionId }).then(() => db.del(`offers/${S.uid}`)).catch(() => {});
  sess.watchSession(sessionId, onSeekerSessionUpdate);
  sess.startLiveShare(sessionId, 'seeker');
  every('seekerMonitor', 1000, seekerMonitor);
  const s = S.session;
  if (s) S.map?.center({ lat: s.spotLat, lng: s.spotLng }, 17);
}

function onSeekerSessionUpdate(session) {
  if (!session) { exitSeekerSession(); return; }
  if (session.status === 'completing') return; // clôture en cours des deux côtés
  if (session.status !== 'active') {
    if (session.status === 'completed') finishSeeker(session);
    else if (session.reason === 'late-reassign') {
      exitSeekerSession();
      infoSheet('La place a été réattribuée',
        'Le conducteur qui donnait la place ne pouvait plus attendre.<br>'
        + 'Un retard ponctuel n’a pas d’impact important sur votre fiabilité.');
      relaunchSearch();
    } else if (session.reason === 'cancelled-donor') {
      exitSeekerSession();
      infoSheet('Le conducteur a annulé', 'La place n’est plus disponible. Nous relançons votre recherche.');
      relaunchSearch();
    } else exitSeekerSession();
    return;
  }

  // §20 — le donneur signale qu'il est prêt.
  if (session.donorState === sess.DONOR_STATE.READY && !S.flags?.donorReadyNotified) {
    S.flags = { ...S.flags, donorReadyNotified: true };
    notify(`${session.donorPseudo} est prêt`, 'La place peut être libérée dès votre arrivée.', '#4ade80');
  }
  S.map?.setPartner(session.donorPos, `${session.donorPseudo} — ${[session.donorVehicle?.label, session.donorVehicle?.color].filter(Boolean).join(' ')}`);
}

async function seekerMonitor() {
  const session = S.session;
  if (!session || session.status !== 'active') return;
  const now = Date.now();

  // §22 — confirmation d'arrivée par GPS.
  const near = sess.seekerIsNearby(session);
  if (near && session.seekerState === sess.SEEKER_STATE.ENROUTE) {
    await db.patch(sess.SESSION_PATH(session.id), { seekerState: sess.SEEKER_STATE.NEARBY, nearbyAt: db.now() });
    notify('Vous êtes arrivé à proximité', 'Le conducteur qui part a été prévenu.', '#4ade80');
  }

  // §21 — ne pas bloquer la rue si le donneur n'est pas encore prêt.
  if (near && session.donorState !== sess.DONOR_STATE.READY && session.donorState !== sess.DONOR_STATE.LEFT
      && !S.flags?.circleAdvised) {
    S.flags = { ...S.flags, circleAdvised: true };
    notify('Ne bloquez pas la circulation',
      'Le conducteur n’est pas encore prêt : continuez et refaites un tour. Votre réservation reste active.', '#f59e0b');
  }

  // §23 — alerte avant la fin de la tolérance de 2 minutes.
  const { dueAt } = sess.deadlines(session);
  if (!near && now > dueAt && !S.flags?.lateWarned) {
    S.flags = { ...S.flags, lateWarned: true };
    notify('Vous avez du retard',
      'Votre réservation risque d’être annulée si vous n’arrivez pas dans les 2 prochaines minutes.', '#ef4444');
  }
  emit();
}

/** §26 — « Je ne peux pas me garer », avec contrôle GPS obligatoire. */
/**
 * Celui qui roule corrige son heure d'arrivée : il voit qu'il sera plus tôt,
 * ou qu'il sera en retard. Le conducteur qui attend est prévenu aussitôt.
 *
 * Repousser son arrivée est limité : sans cela, on pourrait faire attendre
 * indéfiniment quelqu'un en décalant l'heure à chaque fois.
 */
export async function updateEta() {
  const session = S.session;
  if (!session) return;

  const restant = Math.max(0, Math.round(sess.remainingS(session) / 60));
  const pushbacks = Number(session.etaPushbacks) || 0;

  const minutes = await askNewEta(restant);
  if (!minutes) return;

  const nouveauDue = db.now() + minutes * 60_000;
  const repousse = nouveauDue > (Number(session.dueAt) || 0) + 30_000;

  if (repousse && pushbacks >= TUNING.etaPushbacksMax) {
    await infoSheet('Vous ne pouvez plus repousser',
      'Vous avez déjà retardé votre arrivée deux fois. Le conducteur qui vous attend a besoin '
      + 'd’une heure fiable.<br>Si vous ne pouvez vraiment pas venir, utilisez « Annuler ma réservation ».');
    return;
  }

  await db.patch(sess.SESSION_PATH(session.id), {
    etaMin: minutes,
    dueAt: nouveauDue,
    etaPushbacks: repousse ? pushbacks + 1 : pushbacks,
    etaUpdatedAt: db.now(),
    // Le sens de LA DERNIÈRE correction : le compteur cumulé ne le dit pas,
    // et le conducteur qui attend a besoin de savoir si c'est plus tôt ou plus tard.
    etaDirection: repousse ? 'later' : 'earlier',
  });

  // Nouvelle échéance, donc nouvelle alerte de retard à armer : sans cela, un
  // conducteur prévenu une fois ne le serait plus jamais.
  S.flags = { ...S.flags, lateWarned: false };

  toast(repousse ? 'Arrivée repoussée' : 'Arrivée avancée',
    `Le conducteur sait maintenant que vous arrivez dans ${minutes} min.`,
    repousse ? '#9a5b00' : '#0f7a45');
}

export async function cannotPark() {
  const session = S.session;
  if (!session) return;
  const d = distanceM(sess.spotPos(session), S.pos);

  if (!(d <= TUNING.proximityM)) {
    await infoSheet('Vous n’êtes pas encore sur place',
      `Ce motif n’est accepté sans malus que si le GPS confirme votre présence près de la place `
      + `(vous êtes à ${fmtDistance(d)}).<br>Si vous souhaitez abandonner, utilisez « Annuler ma réservation ».`,
      'J’ai compris');
    return;
  }

  const answer = await askNoFitReason();
  if (!answer) return;

  await db.patch(sess.SESSION_PATH(session.id), {
    noFit: true, noFitReason: answer.reason, noFitDegree: answer.degree, noFitAt: db.now(),
  });
  await sess.closeSession(session.id, 'cancelled', 'no-fit');
  await db.addHistory(S.uid, 'Place trop petite signalée sur site', 0, 'Aucun malus');
  exitSeekerSession();
  await infoSheet('Merci pour le retour',
    'Aucun malus : le GPS confirme que vous étiez bien sur place.<br>'
    + 'La place est immédiatement reproposée à un véhicule plus petit.');
  relaunchSearch();
}

/** §28 — « Je suis garé ». */
export async function confirmParked() {
  const session = S.session;
  if (!session) return;
  const d = distanceM(sess.spotPos(session), S.pos);
  if (!(d <= TUNING.proximityM * 1.5)) {
    toast('Trop loin de la place', `Le GPS vous situe à ${fmtDistance(d)}. Approchez-vous puis réessayez.`, '#ef4444');
    return;
  }
  await db.patch(sess.SESSION_PATH(session.id), {
    confirmSeeker: true,
    seekerState: sess.SEEKER_STATE.PARKED,
    seekerPos: { lat: S.pos.lat, lng: S.pos.lng, approx: false, ts: db.now() },
  });
  toast('Confirmé', 'En attente de la confirmation du conducteur qui part.', '#4ade80');
}

async function finishSeeker(session) {
  await db.addHistory(S.uid, 'Place obtenue grâce à l’entraide', 0, session.donorPseudo || '');
  // La place devient mon stationnement en cours : elle pourra être requalifiée (§6).
  await db.write(`users/${S.uid}/parking`, {
    lat: session.spotLat, lng: session.spotLng, vehicleId: S.defaultVehicleId,
    qual: session.spotQual || null, customCm: null, since: db.now(),
  });
  S.parking = await db.readOnce(`users/${S.uid}/parking`);
  exitSeekerSession();
  await infoSheet('Bon stationnement !',
    'La transmission est validée des deux côtés.<br>'
    + 'Les points de cette transmission reviennent au conducteur qui vous a laissé la place : '
    + 'votre bénéfice à vous, c’est la place.');
}

export function exitSeekerSession() {
  db.patch(`users/${S.uid}`, { activeSession: null }).catch(() => {});
  sess.stopLiveShare();
  unsubscribe('session');
  clearTimer('seekerMonitor');
  S.session = null;
  S.flags = {};
  offerShownFor = null;
  S.map?.setPartner(null);
  setPhase(S.parking ? 'parked' : 'idle');
}

/** §25 — annulation par celui qui cherche, avec conséquence graduée. */
export async function cancelReservation() {
  const session = S.session;
  if (!session) return;
  const total = Math.max(1, session.dueAt - session.createdAt);
  const ratio = (Date.now() - session.createdAt) / total;
  const impact = cancelImpact(ratio, sess.seekerIsNearby(session));

  const ok = await confirmSheet(
    'Annuler ma réservation ?',
    impact.label,
    'Oui, annuler', 'Non, je continue', 'btn-red',
    impact.severity === 'high'
      ? 'Une annulation à la dernière minute pénalise le conducteur qui vous attend : répétée, elle fait baisser votre fiabilité.'
      : 'Annuler tôt n’a aucune conséquence : c’est le bon réflexe si vous changez d’avis.');
  if (!ok) return;

  if (impact.counter) await db.bumpCounter(S.uid, impact.counter);
  await sess.closeSession(session.id, 'cancelled', 'cancelled-seeker');
  await db.addHistory(S.uid, 'Réservation annulée', 0, impact.label);
  exitSeekerSession();
  relaunchSearch();
}

/** Après un échec, on remet automatiquement le conducteur en recherche. */
async function relaunchSearch() {
  const prev = S.seeker;
  if (!prev || !S.pos) return;
  const seeker = { ...prev, lat: S.pos.lat, lng: S.pos.lng, ts: db.now(), state: 'searching' };
  await db.write(SEEK(), seeker);
  db.clearOnDisconnect(SEEK());
  S.seeker = seeker;
  S.map?.setDestination({ lat: seeker.destLat, lng: seeker.destLng }, seeker.radiusM);
  setPhase('searching', 'seeker');
  every('seekPing', 10_000, pingSeeker);
}

/** Renoncer pendant l'attente de la confirmation du donneur. */
export async function abandonOffer() {
  await db.patch(`offers/${S.uid}`, { response: 'declined' }).catch(() => {});
  offerShownFor = null;
  setPhase('searching', 'seeker');
  toast('Demande retirée', 'Votre recherche continue.', '#64748b');
}

/* ─────────────────────── §32 — remercier un signalement ─────────────────────── */

export async function thankSignal(id) {
  await db.patch(`freespots/${id}/thanks`, { [S.uid]: db.now() });
  toast('Merci envoyé', 'Le conducteur qui a signalé la place a été remercié.', '#a855f7');
}

export async function reportSignal(id) {
  const ok = await confirmSheet('Signaler une information erronée ?', 'Cette place n’existe pas ou est déjà occupée.', 'Signaler', 'Annuler', 'btn-red');
  if (!ok) return;
  const signal = await db.readOnce(`freespots/${id}`);
  await db.patch(`freespots/${id}/reports`, { [S.uid]: db.now() });
  if (signal?.uid) {
    const reports = { ...(signal.reports || {}), [S.uid]: 1 };
    // §31/§32 : seuls les faux signalements répétés font baisser la fiabilité.
    if (Object.keys(reports).length >= 2) await db.bumpCounter(signal.uid, 'falseReport');
  }
  toast('Signalement envoyé', 'Merci, cela aide à garder la carte fiable.', '#ef4444');
}

/* ─────────────────────── Reprise après rechargement ─────────────────────── */

export async function resumeSeeker() {
  const activeId = S.profile?.activeSession || (await db.readOnce(`offers/${S.uid}`))?.sessionId;
  if (activeId) {
    const session = await db.readOnce(sess.SESSION_PATH(activeId));
    if (session?.status === 'active' && session.seekerUid === S.uid) { enterSeekerSession(activeId); return true; }
    await db.del(`offers/${S.uid}`);
    await db.patch(`users/${S.uid}`, { activeSession: null });
  }
  const seeker = await db.readOnce(SEEK());
  if (!seeker) return false;
  if (db.now() - (Number(seeker.ts) || 0) > TUNING.seekerTtlS * 1000) { await db.del(SEEK()); return false; }
  S.seeker = seeker;
  S.map?.setDestination({ lat: seeker.destLat, lng: seeker.destLng }, seeker.radiusM);
  setPhase('searching', 'seeker');
  every('seekPing', 10_000, pingSeeker);
  return true;
}
