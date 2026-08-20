/**
 * ParkAlert — rendu du panneau d'action (le bas de l'écran).
 * Une seule zone, un seul état à la fois : l'utilisateur n'a jamais
 * plus de deux décisions à prendre (§34).
 */

import { TUNING, COMFORT } from './config.js';
import { distanceM, fmtDistance, fmtDuration, reliabilityLabel } from './core.js';
import { S } from './state.js';
import { el, esc, $ } from './ui.js';
import * as give from './give.js';
import * as seek from './seek.js';
import * as sess from './session.js';

const comfortLabel = (id) => COMFORT.find((c) => c.id === id)?.label || '—';
const metres = (cm) => (cm ? `${(cm / 100).toFixed(2)} m` : '—');

function big(label, cls, onclick, sub) {
  return el('button', { class: `btn ${cls}`, onclick },
    el('span', { class: 'btn-main', text: label }),
    sub ? el('span', { class: 'btn-sub', text: sub }) : null);
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

/* ─────────────────────── Accueil : les trois actions (§2) ─────────────────────── */

function panelIdle() {
  const vehicle = S.vehicles[0];
  const wrap = el('div', {});
  if (!vehicle) {
    wrap.append(info('Enregistrez d’abord votre véhicule dans l’onglet <b>Profil</b> : ParkAlert en a besoin pour savoir dans quelles places vous rentrez.', 'info-orange'));
  }
  wrap.append(
    big('JE CHERCHE UNE PLACE', 'btn-blue', () => seek.startSearch()),
    big('JE VAIS LIBÉRER MA PLACE', 'btn-green', () => give.announceDeparture()),
    big('JE SIGNALE UNE PLACE LIBRE', 'btn-purple', () => give.signalFreeSpot(), 'Sans m’y garer — disponibilité non garantie'),
    el('button', { class: 'btn btn-ghost small', onclick: () => give.declareParked() }, 'Je viens de me garer ici'),
  );
  return wrap;
}

/* ─────────────────────── Stationné (§6 §11) ─────────────────────── */

function panelParked() {
  const since = S.parking?.since ? Math.round((Date.now() - S.parking.since) / 1000) : 0;
  const qual = S.parking?.qual;
  return el('div', {},
    info(kv('Garé depuis', fmtDuration(since))
      + kv('Espace autour de la voiture', qual ? comfortLabel(qual) : 'Non renseigné')),
    !qual ? info('Vous pourrez qualifier la place plus tard : elle vous sera demandée avant de proposer votre place.', 'info-blue') : null,
    big('JE VAIS LIBÉRER MA PLACE', 'btn-green', () => give.announceDeparture()),
    el('div', { class: 'btn-row' },
      el('button', { class: 'btn btn-ghost small', onclick: () => give.editQualification() }, qual ? 'Modifier la place' : 'Qualifier la place'),
      el('button', { class: 'btn btn-ghost small', onclick: () => give.clearParking() }, 'Je suis reparti'),
    ),
  );
}

/* ─────────────────────── Départ annoncé (§13 à §16) ─────────────────────── */

function panelGiving() {
  const spot = S.spot;
  const countdown = give.loopCountdown();
  const remaining = spot?.mode === 'timed'
    ? Math.max(0, Math.round((spot.readyAt - Date.now()) / 1000))
    : 0;

  return el('div', {},
    info(
      kv('Votre place', `${metres(spot?.spotCm)} estimés (${comfortLabel(spot?.qual)})`)
      + (spot?.mode === 'timed'
        ? kv('Vous partez dans', fmtDuration(remaining))
        : kv('Mode', spot?.mode === 'urgent' ? 'Réattribution urgente' : 'Départ immédiat'))
      + kv('Priorité', (spot?.mode === 'timed' && remaining > 0) ? 'Aux points d’entraide' : 'Au plus rapide'),
      'info-green'),
    info(esc(give.loopStatus()) + (countdown != null ? ` <b>${countdown} s</b>` : '')
      + '<div class="muted small" style="margin-top:6px">Gardez l’application ouverte : c’est votre téléphone qui contacte les conducteurs.</div>', 'info-orange'),
    big('JE PARS SANS ATTENDRE', 'btn-orange', () => give.leaveWithoutWaiting(), 'La place devient un simple signalement'),
    el('button', { class: 'btn btn-ghost small', onclick: () => give.cancelGiving() }, 'Retirer ma place'),
  );
}

/* ─────────────────────── Recherche en cours (§8 §9) ─────────────────────── */

function panelSearching() {
  const s = S.seeker;
  const compatible = S.liveSpots.filter((sp) => sp.status === 'open' || sp.status === 'offering');
  return el('div', {},
    info(
      kv('Destination', s?.destLabel || '—')
      + kv('Rayon demandé', fmtDistance(s?.radiusM))
      + kv('Longueur nécessaire', metres(s?.neededCm))
      + kv('Places annoncées autour', String(compatible.length)),
      'info-blue'),
    info('Vous serez prévenu dès qu’une place compatible se libère près de votre destination. Gardez l’application ouverte.', ''),
    el('button', { class: 'btn btn-ghost', onclick: () => seek.stopSearch() }, 'ANNULER LA RECHERCHE'),
  );
}

function panelOffered() {
  return el('div', {},
    info('Votre demande a été transmise. Le conducteur qui part doit maintenant confirmer qu’il vous laisse la place.', 'info-green'),
    el('div', { class: 'spinner' }),
    el('button', { class: 'btn btn-ghost small', onclick: () => seek.abandonOffer() }, 'Renoncer à cette place'),
  );
}

/* ─────────────────────── Signalement actif (§32) ─────────────────────── */

function panelSignal() {
  const left = S.signal ? Math.max(0, Math.round((S.signal.expiresAt - Date.now()) / 1000)) : 0;
  return el('div', {},
    info(kv('Place signalée', comfortLabel(S.signal?.qual)) + kv('Expire dans', fmtDuration(left)), 'info-purple'),
    info('Disponibilité non garantie : un signalement n’est pas une réservation.', ''),
    el('button', { class: 'btn btn-ghost', onclick: () => give.removeSignal() }, 'RETIRER LE SIGNALEMENT'),
  );
}

/* ─────────────────────── Réservation — donneur (§18 §20 §28) ─────────────────────── */

function panelSessionDonor() {
  const s = S.session;
  if (!s) return null;
  const eta = sess.liveEta(s);
  const left = sess.remainingS(s);
  const late = sess.lateS(s);
  const v = s.seekerVehicle || {};
  const vehicleTxt = [v.label, v.color].filter(Boolean).join(' ') || 'Véhicule';

  const rows = kv('Véhicule à reconnaître', vehicleTxt)
    + kv('Arrivée estimée', eta ? `${eta.minutes} min` : `${s.etaMin} min`)
    + kv(late > 0 ? 'Retard' : 'Il vous reste', late > 0 ? fmtDuration(late) : fmtDuration(left))
    + kv('Conducteur', sess.seekerStatusText(s));

  const wrap = el('div', {}, info(rows, late > 0 ? 'info-orange' : 'info-green'));

  if (s.confirmDonor) {
    wrap.append(info('Transmission confirmée de votre côté. En attente de « Je suis garé » de l’autre conducteur (§28).', 'info-green'));
  } else if (s.donorState !== sess.DONOR_STATE.READY) {
    if (s.donorState === sess.DONOR_STATE.AWAY) {
      wrap.append(el('button', { class: 'btn btn-blue', onclick: () => give.donorHeading() }, 'JE REJOINS MA VOITURE'));
    }
    wrap.append(big('JE SUIS DANS MA VOITURE ET PRÊT', 'btn-green', () => give.donorReady()));
  } else {
    wrap.append(big('PLACE TRANSMISE', 'btn-green', () => give.donorConfirmTransfer(), 'Confirmez quand vous quittez la place'));
  }

  wrap.append(el('button', { class: 'btn btn-ghost small', onclick: () => give.donorCancelSession() }, 'Annuler la transmission'));
  return wrap;
}

/* ─────────────────────── Réservation — chercheur (§18 §21 §26 §28) ─────────────────────── */

function panelSessionSeeker() {
  const s = S.session;
  if (!s) return null;
  const d = S.pos ? distanceM(sess.spotPos(s), S.pos) : null;
  const left = sess.remainingS(s);
  const near = sess.seekerIsNearby(s);
  const v = s.donorVehicle || {};
  const vehicleTxt = [v.label, v.color].filter(Boolean).join(' ') || 'Véhicule';

  const rows = kv('Véhicule à reconnaître', vehicleTxt)
    + kv('Distance restante', d != null ? fmtDistance(d) : '—')
    + kv(left >= 0 ? 'Arrivée prévue dans' : 'Retard', fmtDuration(Math.abs(left)))
    + kv('Statut du donneur', sess.donorStatusText(s));

  const wrap = el('div', {}, info(rows, left < 0 ? 'info-orange' : 'info-green'));

  if (near && s.donorState !== sess.DONOR_STATE.READY && s.donorState !== sess.DONOR_STATE.LEFT) {
    wrap.append(info('Le conducteur n’est pas encore prêt : <b>ne bloquez pas la rue</b>, continuez et refaites un tour. Votre réservation reste active (§21).', 'info-orange'));
  }
  if (s.donorState === sess.DONOR_STATE.READY) {
    wrap.append(info('La place est libre : le conducteur est prêt à partir.', 'info-green'));
  }

  if (s.confirmSeeker) {
    wrap.append(info('Vous avez confirmé être garé. En attente de « Place transmise » du donneur (§28).', 'info-green'));
  } else {
    wrap.append(big('JE SUIS GARÉ', 'btn-green', () => seek.confirmParked(), 'Confirme la transmission'));
    wrap.append(el('button', { class: 'btn btn-orange small', onclick: () => seek.cannotPark() }, 'JE NE PEUX PAS ME GARER'));
  }
  wrap.append(el('button', { class: 'btn btn-ghost small', onclick: () => seek.cancelReservation() }, 'Annuler ma réservation'));
  return wrap;
}

/* ─────────────────────── Bandeau du haut ─────────────────────── */

export function renderHeader() {
  const pts = S.profile?.points || 0;
  const rel = S.reliability ?? 100;
  const { label, color } = reliabilityLabel(rel);
  const set = (sel, value, col) => { const n = $(sel); if (n) { n.textContent = value; if (col) n.style.color = col; } };
  set('#hdr-points', String(pts));
  set('#hdr-rel', String(rel), color);
  set('#hdr-rel-label', label);
  set('#hdr-pseudo', S.profile?.pseudo || '—');
  set('#count-spots', String(S.liveSpots.filter((s) => s.status === 'open' || s.status === 'offering').length));
  set('#count-seekers', String(S.liveSeekers.length));
}

export const PROXIMITY_M = TUNING.proximityM;
