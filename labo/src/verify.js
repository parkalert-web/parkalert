#!/usr/bin/env node
/* Harnais de validation du moteur, hors navigateur.
   Vérifie les invariants du modèle puis imprime les résultats de référence.
   Usage : node verify.js */
const { World } = require('./sim.js');

const RHO = 0.95;
const SEEDS = [11, 23, 47, 91];
const WARM = 500, MEAS = 1500, DT = 0.05;

function run(rho, adoption, seed) {
  const w = new World(seed, adoption);
  w.init(Math.round(rho * w.g.nSpots));
  for (let t = 0; t < WARM; t += DT) w.step(DT);
  w.resetAcc(); w.cruiseMeters = 0; w.stolen = 0;
  for (let t = 0; t < MEAS; t += DT) w.step(DT);
  const c = w.cumulative(), s = w.stats();
  return { sub: c.sub, non: c.non, all: c.all, km: w.cruiseMeters / 1000, stolen: w.stolen, cruising: s.cruising, occ: s.occ };
}

const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const avg = (rho, ad, pick) => mean(SEEDS.map(s => pick(run(rho, ad, s))).filter(isFinite));

let failures = 0;
function assert(label, ok, detail) {
  console.log((ok ? '  ok   ' : '  ÉCHEC') + '  ' + label + (detail ? '   ' + detail : ''));
  if (!ok) failures++;
}

const w0 = new World(1, 0);
console.log(`ville : ${w0.g.N} intersections · ${w0.g.edges.length} tronçons · ${w0.g.nSpots} places`);
console.log(`mesure : pression ${RHO}, ${SEEDS.length} graines, ${WARM}+${MEAS} minutes simulées\n`);

console.log('── invariants ──');

// 1. deux mondes de même graine et même adoption sont indiscernables
{
  const a = new World(7, 0.4), b = new World(7, 0.4);
  a.init(300); b.init(300);
  for (let i = 0; i < 4000; i++) { a.step(DT); b.step(DT); }
  const sig = w => w.cars.map(c => c.st + c.e + c.u.toFixed(9)).join('|');
  assert('déterminisme : même graine → même trajectoire', sig(a) === sig(b));
}

// 2. aucune place ne peut porter deux véhicules
{
  const w = new World(3, 0.5);
  w.init(Math.round(RHO * w.g.nSpots));
  let clash = 0;
  for (let i = 0; i < 8000; i++) {
    w.step(DT);
    if (i % 500 === 0) {
      const seen = new Set();
      for (const E of w.g.edges) for (const s of E.spots) {
        if (s.occ !== null) { if (seen.has(s.occ)) clash++; seen.add(s.occ); }
      }
      const parked = w.cars.filter(c => c.st === 'PARKED').length;
      if (parked !== seen.size) clash++;
    }
  }
  assert('conservation : un véhicule garé ↔ une place occupée', clash === 0);
}

// 3. l'ensemble des équipés est monotone en fonction du taux
{
  const w = new World(5, 0);
  const set = a => { w.adoption = a; return new Set(w.cars.filter(c => w.isSub(c)).map(c => c.id)); };
  w.init(300);
  const s3 = set(0.3), s6 = set(0.6);
  assert('monotonie : passer de 30 % à 60 % n’enlève aucun équipé',
    [...s3].every(id => s6.has(id)), `${s3.size} ⊂ ${s6.size}`);
}

// 4. à 0 % d'adoption, le monde ne fait aucune réservation
{
  const w = new World(9, 0);
  w.init(Math.round(RHO * w.g.nSpots));
  let res = 0;
  for (let i = 0; i < 4000; i++) {
    w.step(DT);
    if (i % 400 === 0) for (const E of w.g.edges) for (const s of E.spots) if (s.res !== null || s.ann) res++;
  }
  assert('témoin : aucune réservation ni annonce à 0 %', res === 0);
}

console.log('\n── effet du taux d’équipement ──');
console.log("équip. | T équipés | T non-équ. | T ville | D équipés | D non-équ. | km à vide | soufflées");
const rows = [];
for (const ad of [0, .1, .25, .5, .75, .9, 1]) {
  const r = SEEDS.map(s => run(RHO, ad, s));
  const m = pick => mean(r.map(pick).filter(isFinite));
  const row = {
    ad,
    subT: m(x => x.sub.T), nonT: m(x => x.non.T), allT: m(x => x.all.T),
    subD: m(x => x.sub.D), nonD: m(x => x.non.D),
    km: m(x => x.km), stolen: m(x => x.stolen),
  };
  rows.push(row);
  const f = (v, d, u) => (isFinite(v) ? v.toFixed(d) + (u || '') : '—');
  console.log(
    (ad * 100).toFixed(0).padStart(5) + '%',
    '|', f(row.subT, 2, ' min').padStart(9),
    '|', f(row.nonT, 2, ' min').padStart(10),
    '|', f(row.allT, 2, ' min').padStart(7),
    '|', f(row.subD, 0, ' m').padStart(9),
    '|', f(row.nonD, 0, ' m').padStart(10),
    '|', f(row.km, 0).padStart(9),
    '|', f(row.stolen, 0).padStart(9)
  );
}

console.log('\n── résultats annoncés sur la page ──');
const r10 = rows.find(r => r.ad === .1), r0 = rows.find(r => r.ad === 0), r100 = rows.find(r => r.ad === 1);
const r90 = rows.find(r => r.ad === .9);
assert('01 · l’équipé cherche ≈ deux fois moins longtemps dès 10 %',
  r10.nonT / r10.subT > 1.6, `rapport ${(r10.nonT / r10.subT).toFixed(2)}×`);
assert('01 · et roule ≈ deux fois moins',
  r10.nonD / r10.subD > 1.6, `rapport ${(r10.nonD / r10.subD).toFixed(2)}×`);
assert('02 · le temps de la ville bouge peu jusqu’à 50 %',
  rows.find(r => r.ad === .5).allT / r0.allT > 0.85,
  `${r0.allT.toFixed(2)} → ${rows.find(r => r.ad === .5).allT.toFixed(2)} min`);
assert('02 · mais le gain existe à 100 %',
  r100.allT < r0.allT * 0.85, `${r0.allT.toFixed(2)} → ${r100.allT.toFixed(2)} min`);
assert('03 · le non-équipé se dégrade quand les autres s’équipent',
  r90.nonT > r0.allT * 1.4, `${r0.allT.toFixed(2)} → ${r90.nonT.toFixed(2)} min`);
assert('collectif · les kilomètres à vide baissent nettement',
  r100.km < r0.km * 0.7, `${r0.km.toFixed(0)} → ${r100.km.toFixed(0)} km`);

console.log(failures ? `\n${failures} vérification(s) en échec.` : '\nToutes les vérifications passent.');
process.exit(failures ? 1 : 0);
