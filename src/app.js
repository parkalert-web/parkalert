/**
 * ParkAlert — amorçage de l'application.
 * Site statique + Firebase : aucun serveur applicatif à héberger.
 */

import { TUNING } from './config.js';
import { distanceM, fmtDistance } from './core.js';
import * as db from './backend.js';
import {
  S, emit, onChange, setPhase, startGPS, unsubscribe, every,
} from './state.js';
import { $, $$, el, esc, toast, showScreen, showView, openModal, closeModal, LS } from './ui.js';
import { MapView, ICONS } from './mapview.js';
import { renderPanel, renderHeader } from './panel.js';
import * as profile from './profile.js';
import * as give from './give.js';
import * as seek from './seek.js';

/* ─────────────────────────── Authentification ─────────────────────────── */

function authTab(tab) {
  $('#tab-login').classList.toggle('active', tab === 'login');
  $('#tab-signup').classList.toggle('active', tab === 'signup');
  $('#field-pseudo').style.display = tab === 'signup' ? 'block' : 'none';
  $('#btn-auth').textContent = tab === 'signup' ? 'CRÉER MON COMPTE' : 'SE CONNECTER';
  $('#auth-err').textContent = '';
}

function authError(e) {
  $('#auth-err').textContent = db.authErrorMessage(e?.code);
  console.warn('[parkalert] auth', e);
}

function bindAuth() {
  $('#tab-login').onclick = () => authTab('login');
  $('#tab-signup').onclick = () => authTab('signup');

  $('#btn-auth').onclick = async () => {
    const email = $('#inp-email').value.trim();
    const pass = $('#inp-pass').value;
    const isSignup = $('#tab-signup').classList.contains('active');
    if (!email || !pass) { $('#auth-err').textContent = 'Renseignez votre email et votre mot de passe.'; return; }
    $('#btn-auth').disabled = true;
    try {
      if (isSignup) await db.signUp(email, pass, $('#inp-pseudo').value.trim());
      else await db.signIn(email, pass);
    } catch (e) { authError(e); } finally { $('#btn-auth').disabled = false; }
  };

  $('#btn-google').onclick = async () => { try { await db.signInGoogle(); } catch (e) { authError(e); } };
  $('#btn-guest').onclick = async () => { try { await db.signInGuest(); } catch (e) { authError(e); } };
  $('#inp-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-auth').click(); });
}

export async function doLogout() {
  await cleanupUser();
  await db.logout();
  location.reload();
}

async function cleanupUser() {
  if (!S.uid) return;
  give.stopOfferLoop();
  try {
    await db.del(`seekers/${S.uid}`);
    const spot = await db.readOnce(`spots/${S.uid}`);
    if (spot && spot.status !== 'reserved') await db.del(`spots/${S.uid}`);
    if (S.signal) await db.del(`freespots/${S.signal.id}`);
  } catch { /* hors ligne */ }
}

/* ─────────────────────────── Données utilisateur ─────────────────────────── */

function watchProfile() {
  unsubscribe('profile');
  S.unsub.profile = db.subscribe(`users/${S.uid}`, (value) => {
    if (!value) return;
    S.profile = { ...value, uid: S.uid };
    S.reliability = profile.computeReliability(value);
    S.vehicles = db.toList(value.vehicles, 'id');
    S.defaultVehicleId = value.defaultVehicle || S.vehicles[0]?.id || null;
    S.parking = value.parking || null;
    emit();
  });
}

function watchHistory() {
  unsubscribe('history');
  S.unsub.history = db.subscribe(`users/${S.uid}/history`, (value) => {
    const entries = db.toList(value, 'hid').sort((a, b) => b.ts - a.ts).slice(0, 40);
    profile.renderHistory(entries);
  });
}

/* ─────────────────────────── Carte temps réel ─────────────────────────── */

function watchWorld() {
  unsubscribe('spots');
  S.unsub.spots = db.subscribe('spots', (value) => {
    const now = db.now();
    S.liveSpots = db.toList(value, 'key').filter((s) => s
      && s.status !== 'gone'
      && (!s.expiresAt || s.expiresAt > now));
    if (S.spot && value?.[S.uid]) S.spot = { ...value[S.uid], spotId: S.uid };
    drawSpots();
    emit();
  });

  unsubscribe('seekers');
  S.unsub.seekers = db.subscribe('seekers', (value) => {
    const cutoff = db.now() - TUNING.seekerTtlS * 1000;
    S.liveSeekers = db.toList(value, 'key').filter((s) => s && (Number(s.ts) || 0) > cutoff);
    drawSeekers();
    emit();
  });

  unsubscribe('signals');
  S.unsub.signals = db.subscribe('freespots', (value) => {
    const now = db.now();
    S.liveSignals = db.toList(value, 'key').filter((s) => s && (!s.expiresAt || s.expiresAt > now));
    drawSignals();
    emit();
  });
}

function spotPopup(s) {
  const v = s.vehicle || {};
  const mine = s.donorUid === S.uid;
  const ready = s.mode === 'timed'
    ? `libère dans ${Math.max(0, Math.round((s.readyAt - Date.now()) / 60000))} min`
    : 'part maintenant';
  const d = S.pos ? fmtDistance(distanceM(S.pos, s)) : '—';
  return `<div class="pop">
    <b style="color:#f59e0b">Place annoncée</b>
    <div>${esc(s.donorPseudo || 'Conducteur')} ${esc(ready)}</div>
    <div class="muted">Longueur estimée ${(s.spotCm / 100).toFixed(2)} m · ${esc([v.label, v.color].filter(Boolean).join(' '))}</div>
    <div class="muted">À ${d} de vous${mine ? ' · votre place' : ''}</div>
    <div class="muted small">${s.status === 'reserved' ? 'Déjà réservée' : 'Les conducteurs compatibles sont contactés par ordre de priorité.'}</div>
  </div>`;
}

function drawSpots() {
  S.map?.sync('spots', S.liveSpots.map((s) => ({ ...s, key: s.key })),
    (s) => (s.status === 'reserved' ? ICONS.spotReserved : ICONS.spot), spotPopup);
}

function drawSeekers() {
  S.map?.sync('seekers', S.liveSeekers.filter((s) => s.uid !== S.uid),
    () => ICONS.seeker,
    (s) => `<div class="pop"><b style="color:#38bdf8">Conducteur en recherche</b><div class="muted">${esc(s.pseudo || '')}</div></div>`);
}

function drawSignals() {
  S.map?.sync('signals', S.liveSignals, () => ICONS.signal, (s) => {
    const left = Math.max(0, Math.round((s.expiresAt - Date.now()) / 60000));
    const thanks = Object.keys(s.thanks || {}).length;
    return `<div class="pop">
      <b style="color:#a855f7">Place libre signalée</b>
      <div class="muted">Disponibilité non garantie · expire dans ${left} min</div>
      <div class="muted">Signalée par ${esc(s.pseudo || '')}${thanks ? ` · ${thanks} merci` : ''}</div>
      <div class="pop-actions">
        <button data-act="thank" data-id="${esc(s.id)}">Merci</button>
        <button data-act="report" data-id="${esc(s.id)}" class="danger">Info erronée</button>
      </div>
    </div>`;
  });
}

// Les boutons des bulles Leaflet sont recréés à chaque ouverture : on délègue.
document.addEventListener('click', (e) => {
  const b = e.target.closest('.pop-actions button');
  if (!b) return;
  if (b.dataset.act === 'thank') seek.thankSignal(b.dataset.id);
  if (b.dataset.act === 'report') seek.reportSignal(b.dataset.id);
});

/* ─────────────────────────── Navigation ─────────────────────────── */

function bindNav() {
  $$('.nav-btn').forEach((b) => {
    b.onclick = () => {
      showView(b.dataset.view);
      if (b.dataset.view === 'map') S.map?.invalidate();
      if (b.dataset.view === 'profile') profile.renderProfile();
    };
  });
  $('#btn-locate').onclick = () => { if (!S.map) return; S.map.followMe = true; S.map.center(S.pos, 17); };
  $('#modal-close').onclick = () => closeModal(null);
  $('#modal-back').addEventListener('click', (e) => {
    if (e.target.id === 'modal-back' && $('#modal-back').dataset.dismissible === '1') closeModal(null);
  });
  $('#toast-close').onclick = () => $('#toast').classList.remove('show');
  $('#btn-help').onclick = showHelp;
}

function showHelp() {
  openModal({
    title: 'Comment ça marche',
    body: el('div', { class: 'note', html: `
      <p><b>J’aide les autres → je gagne des points → je suis prioritaire quand j’ai besoin d’une place.</b></p>
      <p><b>Celui qui cherche</b> indique où il va, à quelle distance maximum, et avec quelle marge il sait se garer.</p>
      <p><b>Celui qui donne</b> dit comment est sa place et dans combien de temps maximum il est prêt à la libérer.</p>
      <p><b>ParkAlert</b> vérifie la taille, la destination, le temps d’arrivée et la disponibilité, puis prévient
      en priorité les conducteurs qui ont le plus de points — sauf en cas d’urgence, où c’est le plus rapide qui passe devant.</p>
      <p>Une transmission ne compte que si elle est <b>confirmée des deux côtés</b>, avec les deux téléphones près de la place.</p>
      <p class="muted">Le partage de position démarre à la réservation et s’arrête automatiquement à la fin.</p>` }),
    actions: [{ label: 'FERMER', value: true, variant: 'btn-green' }],
  });
}

/* ─────────────────────────── Boucle de rendu ─────────────────────────── */

let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderPanel();
    renderHeader();
    if ($('#view-profile')?.classList.contains('active')) profile.renderProfile();
  });
}

/* ─────────────────────────── Démarrage ─────────────────────────── */

async function onSignedIn(user) {
  S.user = user;
  S.uid = user.uid;
  const stored = LS.get('pseudo');
  S.profile = await db.ensureProfile(user, user.displayName || stored || undefined);
  S.reliability = profile.computeReliability(S.profile);

  showScreen('screen-app');
  if (!S.map) {
    S.map = new MapView('map');
    S.map.invalidate();
  }
  startGPS();
  watchProfile();
  watchHistory();
  watchWorld();
  seek.watchOffers();

  // Laisse arriver le premier instantané du profil avant l'accueil.
  await new Promise((r) => setTimeout(r, 400));
  await profile.onboarding();

  const resumed = (await give.resumeDonor()) || (await seek.resumeSeeker());
  if (!resumed) setPhase(S.parking ? 'parked' : 'idle');
  if (S.parking) give.scheduleParkedReminder();

  every('uiTick', 1000, emit);
  emit();
}

function onSignedOut() {
  S.user = null; S.uid = null; S.profile = null;
  Object.keys(S.unsub).forEach(unsubscribe);
  showScreen('screen-auth');
}

function boot() {
  bindAuth();
  bindNav();
  onChange(scheduleRender);
  db.watchAuth((user) => { if (user) onSignedIn(user).catch(console.error); else onSignedOut(); });

  // Les annonces éphémères (recherche, signalement, place ouverte) sont retirées
  // côté serveur par les règles onDisconnect posées à leur création.

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* hors ligne */ });
  }
}

boot();
export { showHelp };
