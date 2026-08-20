/**
 * ParkAlert — accès Firebase (Auth + Realtime Database).
 *
 * Hébergement 100 % gratuit : le site est statique (GitHub Pages) et
 * toute la synchronisation passe par le plan gratuit de Firebase.
 * Il n'y a donc pas de serveur applicatif : c'est le téléphone du DONNEUR
 * qui déroule la boucle de mise en relation pour sa propre place.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, signInAnonymously, signOut, updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getDatabase, ref, get, set, update, remove, push, onValue, off,
  runTransaction, onDisconnect, serverTimestamp, forceLongPolling,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';
import { FIREBASE_CONFIG } from './config.js';

// Certains réseaux d'entreprise bloquent les WebSockets : ?transport=longpolling
// permet de basculer sur le mode de secours sans rien changer d'autre.
if (new URLSearchParams(location.search).get('transport') === 'longpolling') forceLongPolling();

const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getDatabase(app);

export const R = (path) => ref(db, path);
export const now = () => Date.now();
export { serverTimestamp };

/* ─────────────────────────── Authentification ─────────────────────────── */

export function watchAuth(cb) { return onAuthStateChanged(auth, cb); }

export async function signUp(email, password, pseudo) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: pseudo || 'Conducteur' });
  return cred.user;
}
export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signInGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signInGuest = () => signInAnonymously(auth);
export const logout = () => signOut(auth);

export function authErrorMessage(code) {
  const m = {
    'auth/invalid-credential': 'Email ou mot de passe incorrect.',
    'auth/wrong-password': 'Mot de passe incorrect.',
    'auth/user-not-found': 'Aucun compte avec cet email.',
    'auth/email-already-in-use': 'Cet email est déjà utilisé.',
    'auth/weak-password': 'Mot de passe trop court (6 caractères minimum).',
    'auth/invalid-email': 'Email invalide.',
    'auth/popup-closed-by-user': 'Connexion annulée.',
    'auth/popup-blocked': 'La fenêtre Google a été bloquée par le navigateur.',
    'auth/network-request-failed': 'Connexion réseau impossible.',
    'auth/operation-not-allowed': 'Ce mode de connexion n’est pas activé sur le projet Firebase.',
    'auth/admin-restricted-operation': 'Le mode invité n’est pas activé sur le projet Firebase.',
  };
  return m[code] || `Erreur : ${code || 'inconnue'}`;
}

/* ─────────────────────────── Lecture / écriture ─────────────────────────── */

export async function readOnce(path) {
  const snap = await get(R(path));
  return snap.exists() ? snap.val() : null;
}
export const write = (path, value) => set(R(path), value);
export const patch = (path, value) => update(R(path), value);
export const del = (path) => remove(R(path));
export const pushKey = (path) => push(R(path)).key;

/** Abonnement temps réel ; renvoie la fonction de désabonnement. */
export function subscribe(path, cb) {
  const r = R(path);
  const handler = onValue(r, (snap) => cb(snap.exists() ? snap.val() : null));
  return () => off(r, 'value', handler);
}

/** Transforme un objet Firebase { key: value } en tableau avec la clé injectée. */
export const toList = (obj, keyName = 'key') => (obj
  ? Object.entries(obj).map(([k, v]) => (v && typeof v === 'object' ? { ...v, [keyName]: k } : v))
  : []);

/**
 * Écriture conditionnelle : `mutate(current)` doit renvoyer la nouvelle valeur,
 * ou `undefined` pour abandonner. Utilisé pour éviter qu'une même place
 * soit réservée deux fois (§16) ou qu'un chercheur reçoive deux propositions.
 */
export async function transaction(path, mutate) {
  const res = await runTransaction(R(path), (current) => {
    const next = mutate(current);
    return next === undefined ? undefined : next;
  });
  return { committed: res.committed, value: res.snapshot.exists() ? res.snapshot.val() : null };
}

/** Nettoyage automatique si l'onglet se ferme ou perd le réseau. */
export function clearOnDisconnect(path) {
  const od = onDisconnect(R(path));
  od.remove();
  return () => od.cancel();
}
export function updateOnDisconnect(path, value) {
  const od = onDisconnect(R(path));
  od.update(value);
  return () => od.cancel();
}

/* ─────────────────────────── Profil utilisateur ─────────────────────────── */

export async function ensureProfile(user, pseudoFallback) {
  const path = `users/${user.uid}`;
  const existing = await readOnce(path);
  if (existing) {
    if (!existing.pseudo && pseudoFallback) await patch(path, { pseudo: pseudoFallback });
    return { ...existing, uid: user.uid };
  }
  const profile = {
    pseudo: pseudoFallback || user.displayName || 'Conducteur',
    points: 0,
    counters: {},
    stats: { given: 0, taken: 0, signals: 0 },
    lastRewardAt: 0,
    prefs: { reminders: true, sound: true },
    createdAt: now(),
    anonymous: !!user.isAnonymous,
  };
  await write(path, profile);
  return { ...profile, uid: user.uid };
}

export async function addPoints(uid, delta) {
  await transaction(`users/${uid}/points`, (p) => Math.max(0, (Number(p) || 0) + delta));
}
export async function bumpCounter(uid, key, by = 1) {
  await transaction(`users/${uid}/counters/${key}`, (v) => (Number(v) || 0) + by);
}
export async function bumpStat(uid, key, by = 1) {
  await transaction(`users/${uid}/stats/${key}`, (v) => (Number(v) || 0) + by);
}
export async function addHistory(uid, action, delta = 0, detail = '') {
  const key = pushKey(`users/${uid}/history`);
  await write(`users/${uid}/history/${key}`, { ts: now(), action, delta, detail });
}
