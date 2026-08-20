/**
 * ParkAlert — état partagé de l'application + suivi GPS.
 */

import { TUNING } from './config.js';
import { neededLengthCm } from './core.js';
import { toast, setText, LS } from './ui.js';

export const S = {
  user: null,
  uid: null,
  profile: null,
  vehicles: [],
  defaultVehicleId: null,

  pos: null,            // position GPS courante
  posAccuracy: null,
  speed: null,

  phase: 'idle',        // idle | parked | giving | searching | offered | session
  role: null,           // 'donor' | 'seeker' pendant une réservation

  parking: null,        // stationnement déclaré (§6)
  spot: null,           // place que je propose (donneur)
  seeker: null,         // ma recherche en cours
  offer: null,          // proposition reçue
  session: null,        // réservation active
  signal: null,         // mon signalement de place libre (§32)

  liveSpots: [],
  liveSeekers: [],
  liveSignals: [],

  map: null,
  unsub: {},
  timers: {},
  offerLoop: null,      // jeton d'annulation de la boucle de mise en relation
};

export const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit() { for (const fn of listeners) fn(S); }

export function setPhase(phase, role = null) {
  S.phase = phase;
  S.role = role;
  emit();
}

export function clearTimer(name) {
  if (S.timers[name]) { clearInterval(S.timers[name]); clearTimeout(S.timers[name]); delete S.timers[name]; }
}
export function every(name, ms, fn) {
  clearTimer(name);
  S.timers[name] = setInterval(fn, ms);
}
export function after(name, ms, fn) {
  clearTimer(name);
  S.timers[name] = setTimeout(fn, ms);
}
export function unsubscribe(name) {
  if (S.unsub[name]) { try { S.unsub[name](); } catch { /* ignoré */ } delete S.unsub[name]; }
}

/* ─────────────────────────── Véhicules ─────────────────────────── */

export function currentVehicle() {
  return S.vehicles.find((v) => v.id === S.defaultVehicleId) || S.vehicles[0] || null;
}

export function vehicleById(id) {
  return S.vehicles.find((v) => v.id === id) || currentVehicle();
}

/** Longueur nécessaire pour se garer avec le confort mémorisé du véhicule (§5). */
export function neededForVehicle(vehicle, overrideMode, overrideCustom) {
  if (!vehicle) return null;
  const mode = overrideMode || vehicle.marginMode || 'normal';
  const custom = overrideCustom ?? vehicle.marginCm;
  return neededLengthCm(vehicle.lengthCm, mode, custom);
}

/** Résumé affiché aux deux conducteurs (§17) : modèle + couleur uniquement. */
export function vehicleCard(vehicle) {
  if (!vehicle) return null;
  return {
    label: [vehicle.brand, vehicle.model].filter(Boolean).join(' '),
    color: vehicle.color || '',
    lengthCm: vehicle.lengthCm,
  };
}

/* ─────────────────────────── GPS ─────────────────────────── */

let watchId = null;
const gpsCallbacks = new Set();
export function onPosition(fn) { gpsCallbacks.add(fn); return () => gpsCallbacks.delete(fn); }

export function startGPS() {
  if (!navigator.geolocation) { setText('#gps-bar', 'Géolocalisation non disponible sur cet appareil'); return; }
  if (watchId != null) return;
  setText('#gps-bar', 'Acquisition GPS…');
  watchId = navigator.geolocation.watchPosition(
    (p) => {
      S.pos = { lat: p.coords.latitude, lng: p.coords.longitude };
      S.posAccuracy = p.coords.accuracy;
      S.speed = p.coords.speed;
      const acc = p.coords.accuracy ? ` · précision ${Math.round(p.coords.accuracy)} m` : '';
      setText('#gps-bar', `GPS actif${acc}`);
      S.map?.setMe(S.pos);
      for (const fn of gpsCallbacks) fn(S.pos);
      emit();
    },
    (err) => {
      const msg = err.code === 1
        ? 'Localisation refusée — autorisez-la pour utiliser ParkAlert'
        : 'GPS indisponible pour le moment';
      setText('#gps-bar', msg);
      if (err.code === 1 && !LS.get('gpsWarned')) {
        LS.set('gpsWarned', true);
        toast('Localisation nécessaire', 'ParkAlert a besoin de votre position pour vous mettre en relation.', '#ef4444', 9000);
      }
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
  );
}

export function stopGPS() {
  if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
}

/** Position utilisable, avec un message clair si le GPS n'est pas prêt. */
export function requirePosition() {
  if (!S.pos) {
    toast('Position inconnue', 'Activez la localisation puis réessayez.', '#ef4444');
    return null;
  }
  return S.pos;
}

export const TTL = TUNING;
