import test from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceM, travelEstimate, neededLengthCm, estimatedSpotCm, sizeFit,
  selectCandidates, rankCandidates, buildQueue, rewardEligibility,
  transferValid, reliabilityFrom, cancelImpact, coarsen,
} from '../src/core.js';
import { TUNING } from '../src/config.js';
import { identify } from '../src/vehicles.js';

const SPOT = { lat: 48.8566, lng: 2.3522 };
/** Décale un point de ~n mètres vers le nord. */
const north = (p, m) => ({ lat: p.lat + m / 111320, lng: p.lng });

test('distance et estimation de trajet', () => {
  assert.ok(Math.abs(distanceM(SPOT, north(SPOT, 500)) - 500) < 5);
  const t = travelEstimate(500);
  assert.ok(t.minutes >= 1 && t.minutes <= 5, `eta inattendu: ${t.minutes}`);
  assert.equal(travelEstimate(Infinity).minutes, Infinity);
});

test('la place nécessaire dépend de la voiture, pas d’une préférence', () => {
  // 4,20 m + 15 % => 4,83 m ; une seule entrée : la longueur du véhicule.
  assert.equal(neededLengthCm(420), 483);
  assert.equal(neededLengthCm(357), 411);   // Fiat 500
  assert.equal(neededLengthCm(475), 546);   // Tesla Model Y
  assert.equal(neededLengthCm(0), 0);

  // Plus la voiture est longue, plus il lui faut de place — jamais l'inverse.
  const besoins = [241, 357, 420, 475, 508].map((cm) => neededLengthCm(cm));
  for (let i = 1; i < besoins.length; i += 1) assert.ok(besoins[i] > besoins[i - 1]);

  // Une petite voiture ne peut pas réclamer la place d'une grande.
  assert.ok(neededLengthCm(357) < neededLengthCm(475));

  // Le minimum absolu protège les tout petits véhicules (Citroën Ami).
  assert.equal(neededLengthCm(241), 241 + TUNING.manoeuvre.minCm);
});

test('§6/§7 qualification de la place par le donneur', () => {
  assert.equal(estimatedSpotCm(423, 'serre'), 453);
  assert.equal(estimatedSpotCm(423, 'normal'), 473);
  assert.equal(estimatedSpotCm(423, 'aise'), 523);
  assert.deepEqual(sizeFit(473, 470), { ok: true, marginal: true, gapCm: 3 });
  assert.equal(sizeFit(453, 520).ok, false);
  // Peugeot 208 (4,06 m) dans la place « normale » d'un Captur : ça passe, tout juste.
  assert.deepEqual(sizeFit(estimatedSpotCm(423, 'normal'), neededLengthCm(406)), { ok: true, marginal: true, gapCm: 6 });
});

test('à points égaux, une grande place va à la grande voiture', () => {
  // Un créneau de 5,60 m : la Tesla (5,46 m nécessaires) comme la Fiat 500
  // (4,11 m) y rentrent. La Tesla, elle, ne rentre presque nulle part ailleurs.
  const spotCm = 560;
  const grande = mkSeeker({ uid: 'grande', pos: north(SPOT, 200), neededCm: neededLengthCm(475) });
  const petite = mkSeeker({ uid: 'petite', pos: north(SPOT, 200), neededCm: neededLengthCm(357) });

  const rank = (a, b) => rankCandidates(
    selectCandidates({ spot: SPOT, spotCm, readyInMin: 10, seekers: [a, b] }), 'points',
  ).map((r) => r.uid);

  // Mêmes points : la grande voiture passe devant.
  assert.deepEqual(rank(petite, grande), ['grande', 'petite']);
  // L'ordre d'arrivée dans la liste ne change rien.
  assert.deepEqual(rank(grande, petite), ['grande', 'petite']);

  // Mais les points restent le critère principal : la petite mieux dotée l'emporte.
  const petiteDotee = { ...petite, points: 40 };
  assert.deepEqual(rank(petiteDotee, grande), ['petite', 'grande']);

  // Et un seul point d'écart suffit à faire basculer la priorité.
  assert.deepEqual(rank({ ...petite, points: 1 }, grande), ['petite', 'grande']);

  // Même arbitrage en mode urgent, à temps d'arrivée et points identiques.
  const urgent = rankCandidates(
    selectCandidates({ spot: SPOT, spotCm, readyInMin: 0, seekers: [petite, grande] }), 'fastest',
  ).map((r) => r.uid);
  assert.deepEqual(urgent, ['grande', 'petite']);
});

test('§7 une petite voiture qui quitte une place serrée n’alerte pas les grandes', () => {
  const smallSpot = estimatedSpotCm(357, 'serre'); // Fiat 500 garée serrée => 387 cm
  const bigNeed = neededLengthCm(475);             // Tesla Model Y => 546 cm
  assert.equal(sizeFit(smallSpot, bigNeed).ok, false);
});

const mkSeeker = (o) => ({
  uid: o.uid, pseudo: o.uid, points: o.points ?? 0, reliability: o.reliability ?? 100,
  neededCm: o.neededCm ?? 455, radiusM: o.radiusM ?? 400,
  destLat: (o.dest ?? SPOT).lat, destLng: (o.dest ?? SPOT).lng,
  lat: o.pos.lat, lng: o.pos.lng, state: 'searching',
});

test('§12 les 4 critères obligatoires filtrent avant toute priorité', () => {
  const seekers = [
    mkSeeker({ uid: 'tropGrand', pos: north(SPOT, 300), neededCm: 900 }),
    mkSeeker({ uid: 'tropLoinDest', pos: north(SPOT, 300), dest: north(SPOT, 5000) }),
    mkSeeker({ uid: 'tropLent', pos: north(SPOT, 6000) }),
    mkSeeker({ uid: 'ok', pos: north(SPOT, 300) }),
  ];
  const res = selectCandidates({ spot: SPOT, spotCm: 473, readyInMin: 10, seekers });
  assert.deepEqual(res.map((r) => r.uid), ['ok']);
});

test('§13 départ dans 10 min : priorité aux points', () => {
  // A: 6 min / 520 pts — B: 4 min / 300 pts — C: 3 min / 80 pts (table du cahier des charges)
  const seekers = [
    mkSeeker({ uid: 'A', pos: north(SPOT, 1300), points: 520 }),
    mkSeeker({ uid: 'B', pos: north(SPOT, 800), points: 300 }),
    mkSeeker({ uid: 'C', pos: north(SPOT, 400), points: 80 }),
  ];
  const q = buildQueue({ spot: SPOT, spotCm: 473, readyInMin: 10, seekers }, 'points');
  assert.deepEqual(q.map((r) => r.uid), ['A', 'B', 'C']);
  assert.ok(q.every((r) => r.etaMin <= 10));
});

test('§14 « Maintenant » : priorité au plus rapide, pas aux points', () => {
  const seekers = [
    mkSeeker({ uid: 'A', pos: north(SPOT, 200), points: 50 }),
    mkSeeker({ uid: 'B', pos: north(SPOT, 1400), points: 600 }),
  ];
  const q = buildQueue({ spot: SPOT, spotCm: 473, readyInMin: 0, seekers }, 'fastest');
  assert.deepEqual(q.map((r) => r.uid), ['A', 'B']);
});

test('§35 temps très proches : les points départagent', () => {
  const near = [
    { uid: 'peu', points: 10, reliability: 100, etaMin: 5, outOfRadius: false },
    { uid: 'beaucoup', points: 900, reliability: 100, etaMin: 5, outOfRadius: false },
  ];
  assert.deepEqual(rankCandidates(near, 'fastest').map((r) => r.uid), ['beaucoup', 'peu']);
});

test('§24 réattribution urgente : on repart sur le plus rapide en excluant le retardataire', () => {
  const seekers = [
    mkSeeker({ uid: 'retardataire', pos: north(SPOT, 150), points: 999 }),
    mkSeeker({ uid: 'rapide', pos: north(SPOT, 250) }),
    mkSeeker({ uid: 'lent', pos: north(SPOT, 900) }),
  ];
  const q = buildQueue(
    { spot: SPOT, spotCm: 473, readyInMin: 0, seekers, exclude: ['retardataire'] },
    'fastest',
  );
  assert.deepEqual(q.map((r) => r.uid), ['rapide', 'lent']);
});

test('§9 le rayon élargi ne sert que si personne n’est compatible dans le rayon', () => {
  const loin = mkSeeker({ uid: 'loin', pos: north(SPOT, 200), dest: north(SPOT, 520), radiusM: 400 });
  const proche = mkSeeker({ uid: 'proche', pos: north(SPOT, 200), radiusM: 400 });

  const seul = buildQueue({ spot: SPOT, spotCm: 473, readyInMin: 10, seekers: [loin] }, 'points');
  assert.deepEqual(seul.map((r) => r.uid), ['loin']);
  assert.equal(seul[0].outOfRadius, true);

  const avecProche = buildQueue({ spot: SPOT, spotCm: 473, readyInMin: 10, seekers: [loin, proche] }, 'points');
  assert.deepEqual(avecProche.map((r) => r.uid), ['proche']);
});

test('§27 après un échec, on ne repropose pas à un véhicule au moins aussi grand', () => {
  const seekers = [
    mkSeeker({ uid: 'memeTaille', pos: north(SPOT, 200), neededCm: 460 }),
    mkSeeker({ uid: 'plusPetit', pos: north(SPOT, 200), neededCm: 400 }),
  ];
  const q = buildQueue(
    { spot: SPOT, spotCm: 473, readyInMin: 10, seekers, blockedAboveCm: 460 },
    'points',
  );
  assert.deepEqual(q.map((r) => r.uid), ['plusPetit']);
});

test('§30 anti-triche : 30 min entre deux récompenses, 24 h avec le même partenaire', () => {
  const now = Date.now();
  assert.equal(rewardEligibility({}, 'bob', now).eligible, true);
  assert.equal(rewardEligibility({ lastRewardAt: now - 60_000 }, 'bob', now).reason, 'cooldown');
  assert.equal(rewardEligibility({ lastRewardAt: now - 31 * 60_000 }, 'bob', now).eligible, true);
  assert.equal(
    rewardEligibility({ lastRewardAt: now - 31 * 60_000, pairCooldowns: { bob: now - 3600_000 } }, 'bob', now).reason,
    'pair',
  );
});

test('§28 transmission : double confirmation + cohérence GPS', () => {
  const base = { spotLat: SPOT.lat, spotLng: SPOT.lng, donorPos: SPOT, seekerPos: SPOT };
  assert.equal(transferValid({ ...base, confirmDonor: true }).reason, 'double-confirm');
  assert.equal(transferValid({ ...base, confirmDonor: true, confirmSeeker: true }).valid, true);
  assert.equal(
    transferValid({ ...base, confirmDonor: true, confirmSeeker: true, seekerPos: north(SPOT, 800) }).reason,
    'gps',
  );
});

test('§31 la fiabilité ne sanctionne que la répétition', () => {
  assert.equal(reliabilityFrom({}), 100);
  assert.equal(reliabilityFrom({ late: 1 }), 100);
  assert.ok(reliabilityFrom({ late: 5 }) < 100);
  assert.ok(reliabilityFrom({ noShow: 4 }) < reliabilityFrom({ late: 4 }));
});

test('§25 annulation : impact gradué', () => {
  assert.equal(cancelImpact(0.05).severity, 'none');
  assert.equal(cancelImpact(0.4).severity, 'low');
  assert.equal(cancelImpact(0.9).severity, 'high');
  assert.equal(cancelImpact(0.9, true).severity, 'none');
});

test('§19 la position approximative perd bien en précision', () => {
  const c = coarsen({ lat: 48.856612, lng: 2.352233 }, 3);
  assert.equal(c.approx, true);
  assert.ok(distanceM({ lat: 48.856612, lng: 2.352233 }, c) < 120);
});

test('§4 l’identification propose des dimensions issues de la base, jamais inventées', () => {
  const r = identify('Renault Captur 2023 rouge');
  assert.equal(r.year, 2023);
  assert.equal(r.color, 'rouge');
  assert.equal(r.matches[0].model, 'Captur II');
  assert.equal(r.matches[0].source, 'db');
  assert.equal(r.matches[0].lengthCm, 423);
  assert.deepEqual(identify('véhicule totalement inconnu zzz').matches, []);
});

test('les constantes de calibration restent centralisées', () => {
  assert.equal(TUNING.manoeuvre.ratioPct, 15);
  assert.equal(TUNING.manoeuvre.minCm, 45);
  assert.equal(TUNING.lateToleranceS, 120);
  assert.equal(TUNING.points.transfer, 10);
});
