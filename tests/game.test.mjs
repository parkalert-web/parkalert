/**
 * Tests du jeu Los Santos (dossier game/).
 * On ne teste ici que ce qui ne dépend ni du DOM ni de WebGL : mathématiques,
 * génération du monde, orientation des faces, physique des véhicules, armes.
 *
 *   node --test tests/game.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  clamp, lerp, wrapAngle, angleDelta, rng, color, m4, m4compose, m4mul,
  m4perspective, frustumFromVP, aabbInFrustum, dist2D,
} from '../game/src/engine/math.js';
import { Geo, VERTEX_FLOATS } from '../game/src/engine/gl.js';
import { generateWorld, densityAt, zoneAt, STREET, GRID } from '../game/src/world/gen.js';
import { buildWorldGeometry } from '../game/src/world/build.js';
import { World } from '../game/src/world/collide.js';
import { Vehicle, MODELS } from '../game/src/entities/vehicle.js';
import { WEAPONS, WEAPON_ORDER } from '../game/src/systems/weapons.js';
import { MISSIONS } from '../game/src/systems/missions.js';
import { CHARACTERS } from '../game/src/entities/player.js';

const GAME_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../game/src');

function sourceFiles(dir = GAME_DIR, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) sourceFiles(f, out);
    else if (e.name.endsWith('.js')) out.push(f);
  }
  return out;
}

/* ------------------------------------------------------------ hygiène du code */

/**
 * Deux méthodes du même nom dans une classe : la seconde écrase la première
 * en silence. C'est ainsi qu'une méthode `load()` de sauvegarde a un jour
 * remplacé le chargement du monde — le jeu démarrait sur une ville vide.
 */
test('aucune méthode n’est déclarée deux fois dans une classe', () => {
  const method = /^ {2}(?:static\s+)?(?:async\s+)?(?:\*\s*)?([A-Za-z_$][\w$]*)\s*\(/;
  for (const file of sourceFiles()) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    let inClass = false;
    let seen = new Map();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^(export\s+)?class\s/.test(line)) { inClass = true; seen = new Map(); continue; }
      if (inClass && /^\}/.test(line)) { inClass = false; continue; }
      if (!inClass) continue;
      const m = line.match(method);
      if (!m) continue;
      if (['if', 'for', 'while', 'switch', 'catch', 'return', 'else'].includes(m[1])) continue;
      const prev = seen.get(m[1]);
      assert.equal(prev, undefined,
        `${path.basename(file)} : méthode « ${m[1]} » déclarée ligne ${prev} puis ligne ${i + 1}`);
      seen.set(m[1], i + 1);
    }
  }
});

test('les fichiers du jeu s’importent sans effet de bord', async () => {
  for (const file of sourceFiles()) {
    if (file.endsWith('main.js')) continue;        // point d'entrée : touche le DOM
    await import(file);                            // une erreur ici fait échouer le test
  }
});

/* ----------------------------------------------------------------- maths */

test('les utilitaires numériques se comportent comme attendu', () => {
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(clamp(-5, 0, 1), 0);
  assert.equal(lerp(0, 10, 0.25), 2.5);
  assert.ok(Math.abs(wrapAngle(Math.PI * 3)) - Math.PI < 1e-6);
  assert.ok(Math.abs(angleDelta(3.0, -3.0) - 0.2831853) < 1e-4, 'le plus court chemin passe par PI');
  assert.equal(Math.round(dist2D(0, 0, 3, 4)), 5);
});

test('le générateur pseudo-aléatoire est déterministe', () => {
  const a = rng(1234); const b = rng(1234);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
  const c = rng(99);
  assert.notEqual(rng(1234)(), c());
});

test('les couleurs sont converties en espace linéaire', () => {
  const [r, g, b] = color('#ffffff');
  assert.ok(Math.abs(r - 1) < 1e-6 && Math.abs(g - 1) < 1e-6 && Math.abs(b - 1) < 1e-6);
  const mid = color('#808080')[0];
  assert.ok(mid > 0.2 && mid < 0.25, `le gris moyen sRGB vaut ~0,216 en linéaire (obtenu ${mid})`);
  assert.deepEqual(color('#000000'), [0, 0, 0]);
});

test('m4compose place et oriente correctement', () => {
  // à lacet nul, +Z local est l'avant du monde
  const m = m4compose(m4(), 5, 1, -2, 0, 1, 1, 1);
  assert.deepEqual([m[12], m[13], m[14]], [5, 1, -2]);
  assert.ok(Math.abs(m[8]) < 1e-6 && Math.abs(m[10] - 1) < 1e-6);
  // lacet de 90° : +Z local pointe vers +X
  const r = m4compose(m4(), 0, 0, 0, Math.PI / 2, 1, 1, 1);
  assert.ok(Math.abs(r[8] - 1) < 1e-6, 'la colonne Z doit pointer vers +X');
});

test('le frustum rejette ce qui est derrière la caméra', () => {
  const proj = m4perspective(m4(), 1.1, 16 / 9, 0.5, 500);
  const planes = frustumFromVP(proj, new Float32Array(24));
  assert.ok(aabbInFrustum(planes, 0, 0, -20, 1, 1, 1), 'devant la caméra');
  assert.ok(!aabbInFrustum(planes, 0, 0, 40, 1, 1, 1), 'derrière la caméra');
});

/* -------------------------------------------------------------- géométrie */

/** Toutes les faces doivent être enroulées dans le sens de leur normale,
 *  sinon elles disparaissent à cause du tri des faces arrière. */
function windingErrors(geo) {
  let bad = 0;
  for (let k = 0; k < geo.i.length; k += 3) {
    const idx = [geo.i[k], geo.i[k + 1], geo.i[k + 2]];
    const P = idx.map((i) => [geo.v[i * VERTEX_FLOATS], geo.v[i * VERTEX_FLOATS + 1], geo.v[i * VERTEX_FLOATS + 2]]);
    const N = idx.map((i) => [geo.v[i * VERTEX_FLOATS + 3], geo.v[i * VERTEX_FLOATS + 4], geo.v[i * VERTEX_FLOATS + 5]]);
    const u = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]];
    const w = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
    const c = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    if (Math.hypot(...c) < 1e-9) continue;                  // triangle dégénéré (pôles)
    const a = [0, 1, 2].map((j) => (N[0][j] + N[1][j] + N[2][j]) / 3);
    if (c[0] * a[0] + c[1] * a[1] + c[2] * a[2] <= 0) bad++;
  }
  return bad;
}

test('les primitives sont orientées vers l’extérieur', () => {
  const cases = {
    box: (g) => g.box(0, 0, 0, 2, 3, 4, [1, 1, 1], 0.7),
    slab: (g) => g.slab(1, 2, 4, 4, 0.5, [1, 1, 1]),
    cyl: (g) => g.cyl(0, 0, 0, 1, 3, [1, 1, 1], 10),
    cone: (g) => g.cone(0, 0, 0, 2, 5, [1, 1, 1], 8),
    sphere: (g) => g.sphere(0, 0, 0, 1.5, [1, 1, 1], 10, 6),
    roof: (g) => g.roof(0, 2, 0, 6, 2, 5, [1, 1, 1]),
  };
  for (const [name, fn] of Object.entries(cases)) {
    const g = new Geo(); fn(g);
    assert.equal(windingErrors(g), 0, `primitive « ${name} » enroulée à l'envers`);
    assert.ok(g.count > 0 && g.i.length > 0);
  }
});

test('la fusion de géométries décale bien les sommets et les indices', () => {
  const a = new Geo(); a.box(0, 0, 0, 1, 1, 1, [1, 0, 0]);
  const b = new Geo(); b.box(0, 0, 0, 1, 1, 1, [0, 1, 0]);
  const n = a.count, tri = a.i.length;
  a.merge(b, 10, 0, 0);
  assert.equal(a.count, n * 2);
  assert.equal(a.i.length, tri * 2);
  assert.ok(a.i.reduce((m, x) => Math.max(m, x), 0) === a.count - 1);
  assert.ok(a.max[0] > 9, 'la copie décalée doit repousser la boîte englobante');
});

/* ------------------------------------------------------------------ monde */

test('le monde est reproductible et cohérent', () => {
  const a = generateWorld(20130917);
  const b = generateWorld(20130917);
  assert.equal(a.buildings.length, b.buildings.length);
  assert.equal(a.props.length, b.props.length);
  assert.deepEqual(a.buildings[42], b.buildings[42]);
  assert.notEqual(generateWorld(7).buildings.length, 0);

  assert.ok(a.buildings.length > 500, 'la ville doit être dense');
  assert.ok(a.graph.nodes.length >= (GRID * 2 + 1) ** 2, 'la trame routière est complète');
  for (const n of a.graph.nodes) assert.ok(n.links.length > 0, 'aucun nœud isolé');

  // le réseau doit être d'un seul tenant : sinon la circulation reste bloquée
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    for (const l of a.graph.nodes[queue.pop()].links) if (!seen.has(l)) { seen.add(l); queue.push(l); }
  }
  assert.equal(seen.size, a.graph.nodes.length, 'le réseau routier doit être connexe');
  for (const b2 of a.buildings) {
    assert.ok(b2.h > 0 && b2.w > 0 && b2.d > 0, 'dimensions positives');
    assert.ok(Number.isFinite(b2.x) && Number.isFinite(b2.z));
  }
});

test('les quartiers et la densité suivent le plan', () => {
  assert.equal(zoneAt(160, -40), 'Downtown Los Santos');
  assert.equal(zoneAt(-500, 120), 'Vespucci Beach');
  assert.ok(densityAt(150, -20) > 0.9, 'le centre est dense');
  assert.ok(densityAt(-500, 400) < 0.3, 'la périphérie ne l’est pas');
});

test('aucun immeuble ne déborde sur la chaussée', () => {
  const w = generateWorld(20130917);
  const half = 8.5;                                   // demi-largeur de chaussée
  for (const b of w.buildings) {
    for (const axis of ['x', 'z']) {
      const v = b[axis];
      const size = axis === 'x' ? b.w : b.d;
      const nearest = Math.round(v / STREET) * STREET;
      if (Math.abs(v) > GRID * STREET) continue;
      assert.ok(Math.abs(v - nearest) - size / 2 > half - 0.5,
        `immeuble en ${b.x},${b.z} trop près de l'axe ${axis}=${nearest}`);
    }
  }
});

test('rien ne bloque la chaussée', () => {
  const w = generateWorld(20130917);
  // rectangle d'une route, légèrement rétréci : les bordures peuvent affleurer
  for (const r of w.roads) {
    const hw = r.w / 2 - 1.5;
    const hd = r.d / 2 - 1.5;
    if (hw <= 0 || hd <= 0) continue;
    for (const c of w.colliders) {
      if (c.h < 1.5) continue;
      const overlap = Math.abs(c.x - r.x) < hw + c.hw && Math.abs(c.z - r.z) < hd + c.hd;
      assert.ok(!overlap,
        `obstacle (${Math.round(c.x)}, ${Math.round(c.z)}) sur la route ${r.horiz ? 'est-ouest' : 'nord-sud'} `
        + `centrée en (${Math.round(r.x)}, ${Math.round(r.z)})`);
    }
  }
});

test('la géométrie de la ville se construit sans anomalie', () => {
  const w = generateWorld(20130917);
  const chunks = buildWorldGeometry(w);
  assert.ok(chunks.length > 50, 'la ville est découpée en tuiles');
  let verts = 0;
  for (const c of chunks) {
    verts += c.geo.count;
    assert.equal(c.geo.v.length, c.geo.count * VERTEX_FLOATS);
    assert.equal(c.geo.i.length % 3, 0);
    for (const idx of c.geo.i) assert.ok(idx < c.geo.count, 'index hors limites');
  }
  assert.ok(verts > 100000, 'la ville doit avoir du détail');
  for (const v of chunks[0].geo.v) assert.ok(Number.isFinite(v), 'aucune valeur NaN');
});

test('les collisions repoussent hors des immeubles', () => {
  const data = generateWorld(20130917);
  const world = new World(data);
  const b = data.colliders.find((c) => c.kind === 'building' && c.h > 5);
  const p = { x: b.x, z: b.z };
  const hit = world.pushCircle(p, 0.5, 2);
  assert.ok(hit, 'un point au centre d’un immeuble doit être repoussé');
  assert.ok(Math.abs(p.x - b.x) > 0.1 || Math.abs(p.z - b.z) > 0.1, 'la position doit changer');
  assert.ok(world.solidAt(b.x, 1, b.z), 'le centre de l’immeuble est solide');
  assert.ok(!world.solidAt(b.x, b.h + 50, b.z), 'au-dessus du toit, c’est vide');

  // un rayon parti de l’intérieur touche tout de suite, un rayon en l’air ne touche rien
  assert.ok(world.raycast(b.x - 200, 1.5, b.z, 1, 0, 0, 400) < Infinity);
  assert.equal(world.raycast(b.x, 400, b.z, 1, 0, 0, 300), Infinity);
});

/* -------------------------------------------------------------- véhicules */

/** Fait rouler un véhicule sans monde ni jeu (collisions neutres). */
function drive(v, seconds, controls, world) {
  const dt = 1 / 60;
  const w = world || { pushCircle: () => null };
  for (let i = 0; i < seconds * 60; i++) {
    Object.assign(v, controls);
    v.update(dt, w, null);
  }
  return v;
}

test('chaque modèle du catalogue est complet', () => {
  for (const [key, m] of Object.entries(MODELS)) {
    for (const f of ['name', 'cls', 'len', 'wid', 'h', 'mass', 'power', 'top', 'grip', 'brake']) {
      assert.ok(m[f] !== undefined, `${key} : champ ${f} manquant`);
    }
    const v = new Vehicle(key, 0, 0, 0);
    assert.ok(v.geo.parts.length > 4, `${key} : carrosserie trop pauvre`);
    if (m.fly) { assert.equal(v.geo.wheels.length, 0, `${key} : un aéronef n'a pas de roues`); continue; }
    assert.equal(v.geo.wheels.length, 4, `${key} : il faut quatre roues`);
    // les roues touchent le sol et la caisse ne flotte pas
    for (const wl of v.geo.wheels) assert.ok(Math.abs(wl.y - wl.r) < 1e-9, `${key} : roue mal posée`);
    assert.ok(v.geo.floor < v.geo.wheels[0].r * 1.05, `${key} : caisse trop haute sur roues`);
  }
});

test('le rayon de braquage reste réaliste à haute vitesse', () => {
  const v = new Vehicle('asterope', 0, 0, 0);
  const w = { pushCircle: () => null };
  for (let i = 0; i < 60 * 6; i++) { v.throttle = 1; v.steerInput = 0; v.update(1 / 60, w, null); }
  const speed = v.speed;
  let maxOmega = 0;
  const y0 = v.yaw;
  for (let i = 0; i < 30; i++) {
    const before = v.yaw;
    v.throttle = 1; v.steerInput = 1;
    v.update(1 / 60, w, null);
    maxOmega = Math.max(maxOmega, Math.abs(v.yaw - before) * 60);
  }
  const lateral = maxOmega * speed;               // v * omega = accélération latérale
  assert.ok(speed > 25, `l'essai doit se faire vite (${speed.toFixed(0)} m/s)`);
  assert.ok(lateral < 20, `moins de 2 g en virage (obtenu ${(lateral / 9.81).toFixed(1)} g)`);
  assert.ok(v.yaw - y0 > 0.01, 'tout en tournant réellement');
});

test('une voiture accélère, freine et se dirige', () => {
  const v = new Vehicle('comete', 0, 0, 0);
  drive(v, 4, { throttle: 1, steerInput: 0, handbrake: false });
  assert.ok(v.kmh > 150, `la Comète doit dépasser 150 km/h en 4 s (obtenu ${v.kmh.toFixed(0)})`);
  assert.ok(v.z > 80, `elle doit avancer vers +Z (obtenu ${v.z.toFixed(0)} m)`);
  assert.ok(v.kmh < MODELS.comete.top * 3.6 + 1, 'sans dépasser sa vitesse maximale');

  const before = v.speed;
  drive(v, 1.5, { throttle: -1, steerInput: 0, handbrake: false });
  assert.ok(v.speed < before * 0.55, 'le frein doit ralentir nettement');

  const t = new Vehicle('asterope', 0, 0, 0);
  let maxX = 0;
  const w = { pushCircle: () => null };
  for (let i = 0; i < 60 * 4; i++) {
    t.throttle = 1; t.steerInput = 1;
    t.update(1 / 60, w, null);
    maxX = Math.max(maxX, Math.abs(t.x));
  }
  assert.ok(Math.abs(t.yaw) > 1, 'braquer doit faire tourner');
  assert.ok(maxX > 8, `et décrire une courbe (écart max ${maxX.toFixed(1)} m)`);
});

test('le frein à main fait déraper', () => {
  const a = new Vehicle('dominator', 0, 0, 0);
  drive(a, 3, { throttle: 1, steerInput: 0 });
  drive(a, 1.2, { throttle: 1, steerInput: 1, handbrake: true });
  assert.ok(a.skid > 0.4, `la glisse doit être détectée (obtenu ${a.skid.toFixed(2)})`);

  const b = new Vehicle('dominator', 0, 0, 0);
  drive(b, 3, { throttle: 1, steerInput: 0 });
  drive(b, 1.2, { throttle: 1, steerInput: 1, handbrake: false });
  assert.ok(a.skid > b.skid, 'davantage qu’en virage normal');
});

test('un véhicule encaisse, meurt et explose', () => {
  const v = new Vehicle('ingot', 0, 0, 0);
  assert.equal(v.dead, false);
  v.damage(400);
  assert.ok(v.health > 0 && v.health < v.maxHealth);
  v.damage(2000);
  assert.equal(v.dead, true);
  assert.equal(v.health, 0);

  let exploded = null;
  const fakeGame = { explode: (x, y, z, r) => { exploded = { x, y, z, r }; }, onCrash() {} };
  for (let i = 0; i < 60 * 4; i++) v.update(1 / 60, { pushCircle: () => null }, fakeGame);
  assert.ok(exploded, 'l’épave doit finir par exploser');
  assert.ok(exploded.r > 5);
});

test('un véhicule ne traverse pas les immeubles', () => {
  const data = generateWorld(20130917);
  const world = new World(data);
  const b = data.colliders.find((c) => c.kind === 'building' && c.hw > 8 && c.h > 10);
  // on lance la voiture pile sur la façade sud
  const v = new Vehicle('dominator', b.x, b.z - b.hd - 30, 0);
  let crashed = false;
  const game = { onCrash: () => { crashed = true; }, explode() {} };
  for (let i = 0; i < 60 * 6; i++) {
    v.throttle = 1;
    v.update(1 / 60, world, game);
  }
  assert.ok(crashed, 'l’impact doit être signalé');
  assert.ok(v.z < b.z - b.hd + 1.5, `la voiture ne doit pas entrer dans l'immeuble (z=${v.z.toFixed(1)})`);
  assert.ok(v.health < v.maxHealth, 'et prendre des dégâts');
});

test("l'hélicoptère décolle, avance et se pose", () => {
  const w = { pushCircle: () => null };
  const h = new Vehicle('maverick', 0, 0, 0);
  h.driver = {};
  const fly = (sec, ctrl) => {
    for (let i = 0; i < sec * 60; i++) { Object.assign(h, ctrl); h.update(1 / 60, w, null); }
  };
  fly(5, { collective: 1, pitchInput: 0, yawInput: 0 });
  assert.ok(h.y > 25, `il doit monter (altitude ${h.y.toFixed(0)} m)`);

  const y0 = h.y;
  fly(5, { collective: 0, pitchInput: 1, yawInput: 0 });
  assert.ok(h.z > 40, `il doit avancer (${h.z.toFixed(0)} m)`);
  assert.ok(Math.abs(h.y - y0) < 12, 'et tenir à peu près son altitude sans collectif');
  assert.ok(h.kmh > 40 && h.kmh <= MODELS.maverick.top * 3.6 + 1, `vitesse ${h.kmh.toFixed(0)} km/h`);

  const yaw0 = h.yaw;
  fly(2, { collective: 0, pitchInput: 0, yawInput: 1 });
  assert.ok(Math.abs(h.yaw - yaw0) > 0.5, 'le lacet doit le faire pivoter');

  fly(20, { collective: -0.4, pitchInput: 0, yawInput: 0 });
  assert.ok(h.y < 1, `il doit finir posé (altitude ${h.y.toFixed(2)} m)`);
  assert.ok(h.health > h.maxHealth * 0.55, 'un posé en douceur ne le détruit pas');
});

test('les places assises et la sortie restent près du véhicule', () => {
  const v = new Vehicle('granger', 100, 200, 1.1);
  const [sx, sy, sz] = v.seatPos(0);
  assert.ok(dist2D(sx, sz, v.x, v.z) < 3);
  assert.ok(sy > 0.4 && sy < v.model.h);
  const world = new World(generateWorld(20130917));
  const [ex, ez] = v.exitPos(world);
  assert.ok(dist2D(ex, ez, v.x, v.z) < 4);
});

/* ------------------------------------------------------------- circulation */

test('la circulation roule et reste sur la chaussée', async () => {
  const { Population } = await import('../game/src/systems/traffic.js');
  const data = generateWorld(20130917);
  const world = new World(data);
  // un jeu minimal : la circulation n'a besoin que de ça
  const game = {
    data, world, vehicles: [], peds: [],
    player: { x: 0, z: -45, wanted: 0, onFoot: true, dead: false, vehicle: null },
    audio: { stopEngine() {}, hornSound() {} },
  };
  const pop = new Population(game);
  for (let i = 0; i < 40; i++) pop.spawnTraffic();
  const traffic = game.vehicles.filter((v) => v.ai);
  assert.ok(traffic.length > 10, 'la circulation doit apparaître');
  const start = new Map(traffic.map((v) => [v, { x: v.x, z: v.z }]));

  const dt = 1 / 30;
  for (let step = 0; step < 30 * 30; step++) {          // 30 secondes simulées
    pop.update(dt);
    for (const v of game.vehicles) v.update(dt, world, null);
  }

  let moved = 0; let stuck = 0; let offRoad = 0;
  const live = game.vehicles.filter((v) => v.ai && !v.dead);
  const near = (c) => Math.abs(((c % STREET) + STREET * 1.5) % STREET - STREET / 2);
  for (const v of live) {
    const s0 = start.get(v);
    if (s0 && dist2D(v.x, v.z, s0.x, s0.z) > 30) moved++;
    if (Math.abs(v.speed) < 0.5) stuck++;
    if (near(v.x) > 14 && near(v.z) > 14) offRoad++;
    assert.ok(!world.solidAt(v.x, 1, v.z), `voiture encastrée en (${v.x.toFixed(0)}, ${v.z.toFixed(0)})`);
  }
  assert.ok(live.length > 8, 'la circulation ne doit pas se détruire toute seule');
  assert.ok(moved > live.length * 0.4, `les voitures doivent avancer (${moved}/${live.length})`);
  assert.ok(stuck < live.length * 0.4, `peu de voitures à l'arrêt (${stuck}/${live.length})`);
  assert.ok(offRoad < live.length * 0.3, `les voitures restent sur la chaussée (${offRoad} hors route)`);
});

/* ------------------------------------------------------- armes et missions */

test('le catalogue d’armes est cohérent', () => {
  assert.equal(WEAPON_ORDER.length, Object.keys(WEAPONS).length);
  for (const k of WEAPON_ORDER) {
    const w = WEAPONS[k];
    assert.ok(w, `arme ${k} absente du catalogue`);
    assert.ok(w.name && w.icon, `${k} : présentation incomplète`);
    assert.ok(w.rate > 0, `${k} : cadence invalide`);
    if (!w.melee && !w.projectile) {
      assert.ok(w.dmg > 0 && w.range > 0 && w.mag > 0, `${k} : arme à feu incomplète`);
    }
  }
  assert.ok(WEAPONS.sniper.dmg > WEAPONS.pistol.dmg, 'le fusil de précision frappe plus fort');
  assert.ok(WEAPONS.smg.rate < WEAPONS.pistol.rate, 'la SMG tire plus vite');
});

/** Un marqueur ne doit jamais tomber dans un mur, ni hors d'atteinte d'une voiture. */
test('les points de mission sont posés sur un terrain valide', () => {
  const w = generateWorld(20130917);
  const solid = (x, z) => w.colliders.some(
    (c) => Math.abs(x - c.x) <= c.hw + 0.8 && Math.abs(z - c.z) <= c.hd + 0.8 && c.h > 1.5);
  const modDist = (v) => Math.abs(((v % STREET) + STREET * 1.5) % STREET - STREET / 2);
  const openBlock = (x, z) => w.blocks.some(
    (b) => Math.abs(x - b.x) < b.half && Math.abs(z - b.z) < b.half
      && (b.ground === 'asphalt' || b.ground === 'grass'));
  const drivable = (x, z) => modDist(x) < 9 || modDist(z) < 9 || openBlock(x, z);

  for (const m of MISSIONS) {
    assert.ok(!solid(m.x, m.z), `${m.id} : le marqueur de départ est dans un mur`);
    for (const s2 of m.steps) {
      const pts = s2.type === 'race' ? s2.points : (s2.x !== undefined ? [[s2.x, s2.z]] : []);
      for (const [x, z] of pts) {
        assert.ok(!solid(x, z), `${m.id}/${s2.type} : point (${x}, ${z}) dans un mur`);
        if (s2.vehicle || s2.type === 'deliver' || s2.type === 'race' || s2.type === 'spawnVehicle') {
          assert.ok(drivable(x, z), `${m.id}/${s2.type} : point (${x}, ${z}) inaccessible en voiture`);
        }
      }
      for (const e of s2.enemies || []) {
        assert.ok(!solid(e.x, e.z), `${m.id} : ennemi en (${e.x}, ${e.z}) dans un mur`);
      }
    }
  }
  // et les lieux de vie du jeu
  for (const k of ['hospital', 'police', 'garage', 'ammunation', 'jewelry']) {
    const spot = w.spots[k];
    assert.ok(spot, `lieu ${k} introuvable`);
    assert.ok(!solid(spot.entrance.x, spot.entrance.z), `parvis de ${k} dans un mur`);
    assert.ok(!solid(spot.street.x, spot.street.z), `accès rue de ${k} dans un mur`);
    assert.ok(drivable(spot.street.x, spot.street.z), `${k} inaccessible en voiture`);
  }
  for (const c of Object.values(CHARACTERS)) {
    assert.ok(Number.isFinite(c.home.x) && Number.isFinite(c.home.z), 'domicile mal défini');
  }
});

test('les missions sont bien formées', () => {
  const ids = new Set();
  for (const m of MISSIONS) {
    assert.ok(!ids.has(m.id), `identifiant de mission en double : ${m.id}`);
    ids.add(m.id);
    assert.ok(m.name && m.brief && m.letter, `${m.id} : présentation incomplète`);
    assert.ok(m.reward > 0, `${m.id} : récompense manquante`);
    assert.ok(Number.isFinite(m.x) && Number.isFinite(m.z), `${m.id} : marqueur sans position`);
    assert.ok(m.steps.length > 0, `${m.id} : aucune étape`);
    for (const s of m.steps) {
      assert.ok(['spawnVehicle', 'goto', 'steal', 'deliver', 'wait', 'killAll', 'needVehicle', 'race'].includes(s.type),
        `${m.id} : type d'étape inconnu « ${s.type} »`);
      if (s.type === 'race') assert.ok(s.points.length >= 3);
      if (s.type === 'goto' || s.type === 'deliver') {
        assert.ok(Number.isFinite(s.x) && Number.isFinite(s.z), `${m.id} : étape sans destination`);
      }
    }
  }
  // chaque personnage a au moins une mission
  for (const c of ['michael', 'franklin', 'trevor']) {
    assert.ok(MISSIONS.some((m) => m.char === c), `aucune mission pour ${c}`);
  }
});
