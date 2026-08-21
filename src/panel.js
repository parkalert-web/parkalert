/**
 * ParkAlert — rendu du panneau d'action (le bas de l'écran).
 *
 * Règle de conception : à tout instant, l'écran répond à UNE question —
 * « qu'est-ce qui se passe, et qu'est-ce que je fais maintenant ? ».
 * L'information la plus utile est en gros, le reste tient en une phrase,
 * et il n'y a jamais plus d'une action principale.
 */

import { TUNING, COMFORT } from './config.js';
import { distanceM, fmtDistance, fmtDuration, fmtMetres, reliabilityLabel } from './core.js';
import { S } from './state.js';
import { el, esc, $ } from './ui.js';
import * as give from './give.js';
import * as seek from './seek.js';
import * as sess from './session.js';

const comfortLabel = (id) => COMFORT.find((c) => c.id === id)?.label || '—';
const metres = fmtMetres;
const vehicleName = (v) => [v?.label, v?.color].filter(Boolean).join(' ') || 'Véhicule';

/** Bouton pleine largeur, avec une seconde ligne facultative. */
function big(label, cls, onclick, sub) {
  return el('button', { class: `btn ${cls}`, onclick },
    el('span', { class: 'btn-main', text: label }),
    sub ? el('span', { class: 'btn-sub', text: sub }) : null);
}

/** L'information du moment, en gros, avec sa légende. */
function hero(value, label) {
  return el('div', { class: 'hero' },
    el('div', { class: 'hero-value', text: value }),
    label ? el('div', { class: 'hero-label', text: label }) : null);
}

function info(html, cls = '') { return el('div', { class: `info ${cls}`, html }); }

function kv(label, value) { return `<div class="kv"><span>${esc(label)}</span><b>${esc(value)}</b></div>`; }

export function renderPanel() {
  const panel = $('#panel');
  if (!panel) return;
  panel.innerHTML = '';
  const node = build();
  if (node) panel.append(node);
}

function build() {
  switch (S.phase) {
    case 'parked': return panelParked();
    case 'giving': return panelGiving();
    case 'searching': return panelSearching();
    case 'offered': return panelOffered();
    case 'signal': return panelSignal();
    case 'session': return S.role === 'donor' ? panelSessionDonor() : panelSessionSeeker();
    default: return panelIdle();
  }
}

/* ─────────────────────── Accueil : les trois actions ─────────────────────── */

function panelIdle() {
  const wrap = el('div', {});
  if (!S.vehicles[0]) {
    wrap.append(info('Enregistrez votre voiture dans l’onglet <b>Profil</b> : ParkAlert en a besoin pour savoir dans quelles places elle rentre.', 'info-orange'));
  }
  wrap.append(
    big('Je cherche une place', 'btn-primary', () => seek.startSearch()),
    big('Je vais libérer ma place', 'btn-secondary', () => give.announceDeparture()),
    big('Je signale une place libre', 'btn-secondary', () => give.signalFreeSpot(), 'Sans m’y garer — disponibilité non garantie'),
    el('button', { class: 'btn btn-quiet small', onclick: () => give.declareParked() }, 'Je viens de me garer ici'),
  );
  return wrap;
}

/* ─────────────────────── Stationné ─────────────────────── */

function panelParked() {
  const since = S.parking?.since ? Math.round((Date.now() - S.parking.since) / 1000) : 0;
  const qual = S.parking?.qual;
  return el('div', {},
    hero(fmtDuration(since), qual ? `Garé · espace ${comfortLabel(qual).toLowerCase()} autour de la voiture` : 'Garé ici'),
    big('Je vais libérer ma place', 'btn-primary', () => give.announceDeparture(),
      qual ? null : 'Nous vous demanderons l’espace autour de la voiture'),
    el('div', { class: 'btn-row' },
      el('button', { class: 'btn btn-quiet small', onclick: () => give.editQualification() }, qual ? 'Modifier la place' : 'Décrire la place'),
      el('button', { class: 'btn btn-quiet small', onclick: () => give.clearParking() }, 'Je suis reparti'),
    ),
  );
}

/* ─────────────────────── Départ annoncé ─────────────────────── */

function panelGiving() {
  const spot = S.spot;
  const countdown = give.loopCountdown();
  const remaining = spot?.mode === 'timed' ? Math.max(0, Math.round((spot.readyAt - Date.now()) / 1000)) : 0;

  // Tant qu'il reste du temps, la priorité va aux conducteurs qui ont le plus aidé.
  // Dès que le départ est immédiat ou qu'il faut réattribuer, elle va au plus rapide.
  const byPoints = spot?.mode === 'timed' && remaining > 0;
  const headline = byPoints ? fmtDuration(remaining) : 'Maintenant';
  const sub = byPoints ? 'avant votre départ' : 'nous cherchons le conducteur le plus rapide';

  return el('div', {},
    hero(headline, sub),
    info(esc(give.loopStatus()) + (countdown != null ? ` <b>${countdown} s</b>` : ''), 'info-blue'),
    el('p', { class: 'form-note', text: `Place d’environ ${metres(spot?.spotCm)} · gardez l’application ouverte pendant la recherche.` }),
    big('Je pars sans attendre', 'btn-warning', () => give.leaveWithoutWaiting(), 'La place devient un simple signalement'),
    el('button', { class: 'btn btn-quiet small', onclick: () => give.cancelGiving() }, 'Retirer ma place'),
  );
}

/* ─────────────────────── Recherche en cours ─────────────────────── */

function panelSearching() {
  const s = S.seeker;
  return el('div', {},
    hero('Recherche…', `${s?.destLabel || 'Destination'} · ${fmtDistance(s?.radiusM)} autour`),
    info('Vous serez prévenu dès qu’une place se libère près de votre destination. Laissez l’application ouverte.'),
    el('button', { class: 'btn btn-quiet', onclick: () => seek.stopSearch() }, 'Annuler la recherche'),
  );
}

function panelOffered() {
  return el('div', {},
    el('div', { class: 'spinner' }),
    info('Votre demande est partie. Le conducteur qui s’en va doit confirmer qu’il vous laisse la place.', 'info-blue'),
    el('button', { class: 'btn btn-quiet small', onclick: () => seek.abandonOffer() }, 'Renoncer à cette place'),
  );
}

/* ─────────────────────── Signalement actif ─────────────────────── */

function panelSignal() {
  const left = S.signal ? Math.max(0, Math.round((S.signal.expiresAt - Date.now()) / 1000)) : 0;
  return el('div', {},
    hero(fmtDuration(left), 'avant que votre signalement n’expire'),
    info('Vous avez signalé une place libre. Elle n’est pas réservée : sa disponibilité n’est pas garantie.'),
    el('button', { class: 'btn btn-quiet', onclick: () => give.removeSignal() }, 'Retirer le signalement'),
  );
}

/* ─────────────────────── Réservation — celui qui donne ─────────────────────── */

function panelSessionDonor() {
  const s = S.session;
  if (!s) return null;
  const eta = sess.liveEta(s);
  const left = sess.remainingS(s);
  const late = sess.lateS(s);

  const wrap = el('div', {});

  if (late > 0) {
    wrap.append(hero(`${fmtDuration(late)} de retard`, `${vehicleName(s.seekerVehicle)} n’est pas encore là`));
  } else {
    wrap.append(hero(eta ? `${eta.minutes} min` : `${s.etaMin} min`, `avant l’arrivée de ${vehicleName(s.seekerVehicle)}`));
  }

  wrap.append(info(kv('Voiture à reconnaître', vehicleName(s.seekerVehicle))
    + kv('Conducteur', sess.seekerStatusText(s))
    + (late > 0 ? '' : kv('Il vous reste', fmtDuration(left))),
  late > 0 ? 'info-orange' : ''));

  if (s.confirmDonor) {
    wrap.append(info('C’est confirmé de votre côté. Nous attendons que l’autre conducteur confirme qu’il est garé.', 'info-green'));
  } else if (s.donorState !== sess.DONOR_STATE.READY) {
    if (s.donorState === sess.DONOR_STATE.AWAY) {
      wrap.append(big('Je rejoins ma voiture', 'btn-secondary', () => give.donorHeading()));
    }
    wrap.append(big('Je suis dans ma voiture et prêt', 'btn-primary', () => give.donorReady()));
  } else {
    wrap.append(big('Place transmise', 'btn-success', () => give.donorConfirmTransfer(), 'À confirmer au moment où vous partez'));
  }

  wrap.append(el('button', { class: 'btn btn-quiet small', onclick: () => give.donorCancelSession() }, 'Annuler la transmission'));
  return wrap;
}

/* ─────────────────────── Réservation — celui qui cherche ─────────────────────── */

function panelSessionSeeker() {
  const s = S.session;
  if (!s) return null;
  const d = S.pos ? distanceM(sess.spotPos(s), S.pos) : null;
  const left = sess.remainingS(s);
  const near = sess.seekerIsNearby(s);

  const wrap = el('div', {});
  wrap.append(near
    ? hero('Vous y êtes', `Cherchez ${vehicleName(s.donorVehicle)}`)
    : hero(d != null ? fmtDistance(d) : '—', `de la place · ${vehicleName(s.donorVehicle)}`));

  wrap.append(info(kv('Voiture à reconnaître', vehicleName(s.donorVehicle))
    + kv('Le conducteur', sess.donorStatusText(s))
    + kv(left >= 0 ? 'Vous êtes attendu dans' : 'Retard', fmtDuration(Math.abs(left))),
  left < 0 ? 'info-orange' : ''));

  if (near && s.donorState !== sess.DONOR_STATE.READY && s.donorState !== sess.DONOR_STATE.LEFT) {
    wrap.append(info('Le conducteur n’est pas encore prêt. <b>Ne bloquez pas la rue</b> : continuez et refaites un tour, votre réservation reste valable.', 'info-orange'));
  }
  if (s.donorState === sess.DONOR_STATE.READY) {
    wrap.append(info('La place se libère : le conducteur est dans sa voiture, prêt à partir.', 'info-green'));
  }

  if (s.confirmSeeker) {
    wrap.append(info('C’est confirmé de votre côté. Nous attendons que l’autre conducteur confirme son départ.', 'info-green'));
  } else {
    wrap.append(big('Je suis garé', 'btn-success', () => seek.confirmParked()));
    wrap.append(el('button', { class: 'btn btn-warning small', onclick: () => seek.cannotPark() }, 'Je ne peux pas me garer'));
  }
  wrap.append(el('button', { class: 'btn btn-quiet small', onclick: () => seek.cancelReservation() }, 'Annuler ma réservation'));
  return wrap;
}

/* ─────────────────────── Bandeau du haut ─────────────────────── */

export function renderHeader() {
  const rel = S.reliability ?? 100;
  const { label, color } = reliabilityLabel(rel);
  const set = (sel, value, col) => { const n = $(sel); if (n) { n.textContent = value; if (col) n.style.color = col; } };
  set('#hdr-points', String(S.profile?.points || 0));
  set('#hdr-rel', String(rel), color);
  set('#hdr-rel-label', label);
  set('#hdr-pseudo', S.profile?.pseudo || '—');
  set('#count-spots', String(S.liveSpots.filter((s) => s.status === 'open' || s.status === 'offering').length));
  set('#count-seekers', String(S.liveSeekers.length));
}

export const PROXIMITY_M = TUNING.proximityM;
