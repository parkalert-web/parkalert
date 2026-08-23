/**
 * Rejoue la mise en relation côté serveur contre une VRAIE base Realtime
 * Database, lancée en local par l'émulateur Firebase. Aucun compte, aucune
 * facturation, aucun accès réseau : tout tourne sur la machine.
 *
 *   npm run test:server
 *
 * L'émulateur est démarré et arrêté par « firebase emulators:exec » : ce
 * fichier suppose donc la base déjà en écoute sur 127.0.0.1:9000.
 *
 * Ce que ces tests couvrent : le choix du conducteur, la règle de priorité,
 * l'unicité de la sollicitation, le passage au suivant après un refus, le
 * fait que le serveur ne réserve jamais à la place du donneur, et le
 * nettoyage des propositions restées sans réponse.
 */

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { initializeApp, deleteApp, getApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import {
  dispatchSpot, handleOfferResponse, sweepOffers, sessionNotifications,
} from '../functions/matching.js';

const PROJECT = 'demo-parkalert';
const NS = `${PROJECT}-default-rtdb`;
const HOST = '127.0.0.1:9000';

const SPOT = { lat: 48.8566, lng: 2.3522 };
const north = (m) => ({ lat: SPOT.lat + m / 111320, lng: SPOT.lng });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let db;

/** Un notificateur d'essai : il retient les envois au lieu de les faire. */
function fakePush() {
  const sent = [];
  return {
    sent,
    toUser: async (uid, payload) => { sent.push({ uid, ...payload }); return { sent: 1, removed: 0 }; },
  };
}

/** Un conducteur qui cherche une place, à 200 m de la place et de sa destination. */
const seeker = (uid, neededCm, points) => ({
  uid,
  pseudo: uid,
  points,
  reliability: 100,
  lat: north(200).lat,
  lng: north(200).lng,
  destLat: SPOT.lat,
  destLng: SPOT.lng,
  destLabel: 'Destination',
  radiusM: 400,
  neededCm,
  state: 'searching',
  ts: Date.now(),
  vehicle: { label: uid, color: 'gris', lengthCm: neededCm - 60 },
});

/** Une place de 6 m qui se libère dans dix minutes : tout le monde y rentre. */
const grandePlace = (donorUid = 'paul', extra = {}) => ({
  spotId: `spot-${donorUid}`,
  donorUid,
  donorPseudo: 'Paul',
  lat: SPOT.lat,
  lng: SPOT.lng,
  spotCm: 600,
  qual: 'normal',
  mode: 'timed',
  readyAt: Date.now() + 10 * 60_000,
  status: 'open',
  vehicle: { label: 'Renault Captur', color: 'rouge' },
  ...extra,
});

before(async () => {
  const url = `http://${HOST}/.json?ns=${NS}`;
  let up = false;
  for (let i = 0; i < 30 && !up; i += 1) {
    try { up = (await fetch(url)).ok; } catch { await sleep(1000); }
  }
  if (!up) throw new Error(`base locale injoignable sur ${HOST} — lancez « npm run test:server »`);

  process.env.FIREBASE_DATABASE_EMULATOR_HOST = HOST;
  initializeApp({ projectId: PROJECT, databaseURL: `http://${HOST}?ns=${NS}` });
  db = getDatabase();
}, { timeout: 60_000 });

after(async () => {
  // Sans cela, la connexion à la base garde le processus de test en vie.
  await db.goOffline();
  await deleteApp(getApp());
});

beforeEach(async () => { await db.ref('/').set(null); });

test('à points égaux, la grande place va à la grande voiture', async () => {
  await db.ref('seekers/petite').set(seeker('petite', 411, 0));
  await db.ref('seekers/grande').set(seeker('grande', 546, 0));

  const push = fakePush();
  const res = await dispatchSpot(db, 'paul', grandePlace(), push);

  assert.equal(res.status, 'offered');
  assert.equal(res.seekerUid, 'grande');

  // Un seul conducteur est sollicité à la fois.
  assert.equal((await db.ref('offers/petite').get()).val(), null);
  assert.equal((await db.ref('offers/grande').get()).val().response, 'pending');

  // Et il a bien reçu une notification, même application fermée.
  assert.equal(push.sent.length, 1);
  assert.equal(push.sent[0].uid, 'grande');

  const spot = (await db.ref('spots/paul').get()).val() || {};
  assert.equal(spot.offeredTo ?? 'grande', 'grande');
});

test('les points l’emportent sur la taille', async () => {
  await db.ref('seekers/grande').set(seeker('grande', 546, 0));
  await db.ref('seekers/riche').set(seeker('riche', 411, 50));

  const res = await dispatchSpot(db, 'paul', grandePlace(), fakePush());
  assert.equal(res.seekerUid, 'riche');
});

test('un refus fait passer au candidat suivant', async () => {
  await db.ref('seekers/petite').set(seeker('petite', 411, 0));
  await db.ref('seekers/grande').set(seeker('grande', 546, 0));
  await db.ref('spots/paul').set(grandePlace());

  await dispatchSpot(db, 'paul', (await db.ref('spots/paul').get()).val(), fakePush());
  await db.ref('offers/grande/response').set('declined');
  const res = await handleOfferResponse(db, 'grande', 'declined', fakePush());
  assert.equal(res.status, 'next');

  const spot = (await db.ref('spots/paul').get()).val();
  assert.equal(spot.status, 'open', 'la place doit repartir en recherche');
  assert.ok(spot.excluded?.grande, 'le conducteur qui refuse ne doit pas être resollicité');
  assert.equal((await db.ref('offers/grande').get()).val(), null);

  // Le tour suivant sollicite la petite voiture, seule restante.
  const suivant = await dispatchSpot(db, 'paul', spot, fakePush());
  assert.equal(suivant.seekerUid, 'petite');
});

test('le serveur ne réserve jamais à la place du conducteur qui part', async () => {
  await db.ref('seekers/lea').set(seeker('lea', 467, 0));
  await db.ref('spots/paul').set(grandePlace());
  await dispatchSpot(db, 'paul', (await db.ref('spots/paul').get()).val(), fakePush());

  const push = fakePush();
  await db.ref('offers/lea/response').set('accepted');
  const res = await handleOfferResponse(db, 'lea', 'accepted', push);
  assert.equal(res.status, 'awaiting-donor');

  const spot = (await db.ref('spots/paul').get()).val();
  assert.equal(spot.status, 'pending-confirm');
  assert.equal(spot.pendingSeeker.uid, 'lea');
  // Le donneur reçoit de quoi décider : le véhicule et le temps d'arrivée.
  assert.ok(spot.pendingSeeker.vehicle, 'le véhicule doit être transmis');
  assert.ok(spot.pendingSeeker.etaMin > 0, 'le temps d’arrivée doit être transmis');
  assert.equal(push.sent[0].uid, 'paul', 'c’est le donneur qui est prévenu');
});

test('une proposition sans réponse libère la place', async () => {
  await db.ref('seekers/lea').set(seeker('lea', 467, 0));
  await db.ref('spots/paul').set(grandePlace());
  await dispatchSpot(db, 'paul', (await db.ref('spots/paul').get()).val(), fakePush());

  // On fait comme si le délai de réponse était écoulé.
  const passe = Date.now() - 1000;
  await db.ref('offers/lea/expiresAt').set(passe);
  await db.ref('spots/paul/offerExpiresAt').set(passe);

  const res = await sweepOffers(db);
  assert.deepEqual(res.expired, ['lea']);
  assert.equal((await db.ref('offers/lea/response').get()).val(), 'declined');

  // Le traitement de la réponse remet ensuite la place en recherche.
  await handleOfferResponse(db, 'lea', 'declined', fakePush());
  assert.equal((await db.ref('spots/paul/status').get()).val(), 'open');
});

test('une place bloquée sans proposition vivante repart en recherche', async () => {
  await db.ref('spots/paul').set(grandePlace('paul', {
    status: 'offering', offeredTo: 'disparu', offerExpiresAt: Date.now() - 5000,
  }));

  const res = await sweepOffers(db);
  assert.deepEqual(res.unblocked, ['paul']);
  assert.equal((await db.ref('spots/paul/status').get()).val(), 'open');
});

test('une place n’attend pas éternellement la décision du conducteur qui part', async () => {
  await db.ref('seekers/lea').set(seeker('lea', 467, 0));
  await db.ref('spots/paul').set(grandePlace());
  await dispatchSpot(db, 'paul', (await db.ref('spots/paul').get()).val(), fakePush());
  await db.ref('offers/lea/response').set('accepted');
  await handleOfferResponse(db, 'lea', 'accepted', fakePush());

  // Le conducteur qui part laisse son téléphone dans sa poche.
  await db.ref('spots/paul/pendingSeeker/askedAt').set(Date.now() - 5 * 60_000);

  const res = await sweepOffers(db);
  assert.deepEqual(res.unblocked, ['paul']);

  const spot = (await db.ref('spots/paul').get()).val();
  assert.equal(spot.status, 'open', 'la place repart en recherche');
  assert.equal(spot.pendingSeeker ?? null, null);
  assert.equal(spot.confirmMisses, 1);
  assert.equal((await db.ref('offers/lea').get()).val(), null,
    'le candidat ne doit pas rester bloqué à attendre');
});

test('une annonce dont personne ne s’occupe finit par être abandonnée', async () => {
  await db.ref('spots/paul').set(grandePlace('paul', {
    status: 'pending-confirm',
    confirmMisses: 1,
    pendingSeeker: { uid: 'lea', pseudo: 'Léa', askedAt: Date.now() - 5 * 60_000 },
  }));

  const res = await sweepOffers(db);
  assert.deepEqual(res.abandoned, ['paul']);
  assert.equal((await db.ref('spots/paul').get()).val(), null);
});

test('une recherche trop ancienne est ignorée', async () => {
  const vieux = { ...seeker('vieux', 411, 0), ts: Date.now() - 3 * 3600_000 };
  await db.ref('seekers/vieux').set(vieux);

  const res = await dispatchSpot(db, 'paul', grandePlace(), fakePush());
  // Elle est écartée avant même le calcul de compatibilité.
  assert.equal(res.status, 'no-seekers');
  assert.equal((await db.ref('offers/vieux').get()).val(), null);
});

test('une voiture qui ne rentre pas n’est jamais sollicitée', async () => {
  await db.ref('seekers/camion').set(seeker('camion', 900, 999));

  const res = await dispatchSpot(db, 'paul', grandePlace(), fakePush());
  assert.equal(res.status, 'no-match', 'les points ne rendent pas une voiture compatible');
});

test('les deux moments clés de la réservation déclenchent une notification', async () => {
  const session = {
    status: 'active', donorUid: 'paul', seekerUid: 'lea', donorPseudo: 'Paul',
    donorState: 'heading', seekerState: 'enroute',
  };

  const p1 = fakePush();
  await sessionNotifications(db, session, { ...session, donorState: 'ready' }, p1);
  assert.deepEqual(p1.sent.map((s) => s.uid), ['lea'], 'celui qui arrive est prévenu');

  const p2 = fakePush();
  await sessionNotifications(db, session, { ...session, seekerState: 'nearby' }, p2);
  assert.deepEqual(p2.sent.map((s) => s.uid), ['paul'], 'celui qui part est prévenu');

  // Pas de notification en double si l'état n'a pas changé.
  const p3 = fakePush();
  const pret = { ...session, donorState: 'ready' };
  await sessionNotifications(db, pret, pret, p3);
  assert.equal(p3.sent.length, 0);
});
