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

/* --------------------------------------------------------- page autonome */

/**
 * `game/losantos.html` réunit tout le jeu dans un fichier ouvrable en
 * double-clic. Il est engagé dans le dépôt : ce test refuse qu'il prenne du
 * retard sur les sources.
 */
test('la page autonome est à jour et cohérente', async () => {
  const { buildStandalone, OUTPUT } = await import('../game/build.mjs');
  const { page, count } = buildStandalone();
  assert.ok(count >= 15, `tous les modules doivent être embarqués (${count})`);
  assert.ok(!/\bimport\s+\{/.test(page), 'aucun import ne doit subsister');
  assert.ok(!page.includes('src/main.js') && !page.includes('href="style.css"'),
    'plus aucune référence à un fichier extérieur');
  assert.ok(page.includes('<canvas id="scene">'), 'la page garde son interface');
  assert.ok(page.includes("+250 000 $"), 'le remplacement ne doit pas tronquer le code');
  assert.ok(page.length > 200000, 'la page contient bien tout le jeu');

  const onDisk = fs.readFileSync(OUTPUT, 'utf8');
  assert.equal(onDisk, page,
    'game/losantos.html est périmé : relancez « npm run build:game »');
});

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
    for (const f of ['name', 'cls', 'len', 'wid', 'h', 'mass', 'power', 'top', 'grip', 'brake', 'steer']) {
      assert.ok(Number.isFinite(m[f]) || typeof m[f] === 'string', `${key} : champ ${f} manquant`);
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

/**
 * Garde-fou né d'un vrai bug : quatre modèles (ambulance, camion de pompiers,
 * Benson, bus) n'avaient pas de valeur de braquage. Un `undefined` dans la
 * physique, et la position devenait NaN dès la première image — le véhicule
 * disparaissait de la carte sans un mot.
 */
test('aucun modèle ne part en NaN, à l’arrêt comme à fond', () => {
  const data = generateWorld(20130917);
  const world = new World(data);
  for (const key of Object.keys(MODELS)) {
    for (const scenario of ['arrêt', 'plein gaz', 'virage serré']) {
      const v = new Vehicle(key, 0, 1.5, -45, 0);
      v.x = 4.6; v.y = MODELS[key].fly ? 30 : 0; v.z = -300;
      for (let i = 0; i < 150; i++) {
        if (scenario === 'plein gaz') v.throttle = 1;
        if (scenario === 'virage serré') { v.throttle = 1; v.steerInput = 1; }
        v.update(1 / 30, world, null);
        assert.ok(Number.isFinite(v.x) && Number.isFinite(v.z) && Number.isFinite(v.y),
          `${key} (${scenario}) : position non finie à l'image ${i}`);
        assert.ok(Number.isFinite(v.speed) && Number.isFinite(v.yaw),
          `${key} (${scenario}) : vitesse ou cap non fini à l'image ${i}`);
      }
    }
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

/* ------------------------------------------------- commandes et collisions */

/** Un jeu minimal, suffisant pour faire marcher le joueur. */
async function stubGame(world, vehicles = []) {
  const { Player } = await import('../game/src/entities/player.js');
  const player = new Player('franklin');
  const game = {
    world, vehicles, peds: [], weather: { wet: 0 },
    camera: { yaw: 0, pitch: 0 },
    input: { moveX: 0, moveY: 0, sprint: false, jumpPressed: false, aim: false, down: () => false },
    audio: { impact() {}, footstep() {} },
    player,
  };
  player.update = player.update.bind(player);
  return { game, player };
}

function walk(game, player, seconds, moveX, moveY) {
  const dt = 1 / 60;
  game.input.moveX = moveX;
  game.input.moveY = moveY;
  for (let i = 0; i < seconds * 60; i++) player.update(dt, game);
}

test('les commandes envoient là où on regarde', async () => {
  const world = new World(generateWorld(20130917));
  const { game, player } = await stubGame(world);
  // au milieu d'un carrefour dégagé, caméra vers +Z
  player.x = 0; player.z = -45; game.camera.yaw = 0;

  walk(game, player, 2, 0, 1);
  assert.ok(player.z > -43, `avancer doit suivre l'axe de la caméra (z=${player.z.toFixed(1)})`);
  assert.ok(Math.abs(player.x) < 0.5, 'sans dérive latérale');

  player.x = 0; player.z = -45; player.vx = 0; player.vz = 0;
  walk(game, player, 2, 1, 0);
  // La droite de l'écran est (-cos, sin) : à lacet nul, c'est -X.
  assert.ok(player.x < -2, `« droite » doit aller vers -X (x=${player.x.toFixed(1)})`);

  player.x = 0; player.z = -45; player.vx = 0; player.vz = 0;
  game.camera.yaw = Math.PI / 2;                 // caméra vers +X
  walk(game, player, 2, 0, 1);
  assert.ok(player.x > 2, `avancer suit la caméra tournée (x=${player.x.toFixed(1)})`);

  player.x = 0; player.z = -45; player.vx = 0; player.vz = 0;
  walk(game, player, 2, 1, 0);
  assert.ok(player.z > -43, `et « droite » reste à droite de l'écran (z=${player.z.toFixed(1)})`);
});

test('le joueur ne traverse ni les murs ni les voitures', async () => {
  const data = generateWorld(20130917);
  const world = new World(data);
  const wall = data.colliders.find((c) => c.kind === 'building' && c.h > 8 && c.hw > 8);
  const { game, player } = await stubGame(world);

  // face sud du bâtiment, on fonce dedans pendant six secondes
  player.x = wall.x; player.z = wall.z - wall.hd - 5;
  game.camera.yaw = 0;
  walk(game, player, 6, 0, 1);
  assert.ok(player.z < wall.z - wall.hd + 0.5,
    `le mur doit arrêter le joueur (z=${player.z.toFixed(1)}, façade=${(wall.z - wall.hd).toFixed(1)})`);
  assert.ok(player.z > wall.z - wall.hd - 1.6, 'et il doit tout de même arriver au contact');

  // une voiture en travers du chemin
  const v = new Vehicle('granger', 0, -40, 0);
  const { game: g2, player: p2 } = await stubGame(world, [v]);
  p2.x = 0; p2.z = -55;
  g2.camera.yaw = 0;
  walk(g2, p2, 6, 0, 1);
  assert.ok(p2.z < v.z - v.hl + 0.4,
    `la voiture doit arrêter le joueur (z=${p2.z.toFixed(1)}, pare-chocs=${(v.z - v.hl).toFixed(1)})`);
});

test('deux véhicules se repoussent selon leur vraie emprise', async () => {
  const { resolveVehicleCollisions, supportRadius } = await import('../game/src/systems/physics.js');
  // Une boîte vue de face : son rayon d'appui vaut sa demi-longueur.
  const probe = new Vehicle('asterope', 0, 0, 0);
  assert.ok(Math.abs(supportRadius(probe, 0, 1) - probe.hl) < 1e-6, 'de face : demi-longueur');
  assert.ok(Math.abs(supportRadius(probe, 1, 0) - probe.hw) < 1e-6, 'de côté : demi-largeur');

  // Choc arrière : la voiture qui suit ne doit pas entrer dans celle de devant.
  const a = new Vehicle('comete', 0, 0, 0);
  const b = new Vehicle('granger', 0, 6, 0);
  a.vz = 20;
  const w = { pushCircle: () => null };
  let crashes = 0;
  for (let i = 0; i < 120; i++) {
    a.update(1 / 60, w, null);
    b.update(1 / 60, w, null);
    resolveVehicleCollisions([a, b], () => { crashes++; });
  }
  assert.ok(crashes > 0, 'le choc doit être signalé');
  const gap = b.z - a.z;
  assert.ok(gap > a.hl + b.hl - 0.35,
    `pas d'interpénétration à l'arrêt (écart ${gap.toFixed(2)} m pour ${(a.hl + b.hl).toFixed(2)} m)`);
  assert.ok(b.vz > 0.5, 'la voiture percutée est poussée en avant');
  assert.ok(a.health < a.maxHealth, 'et les deux encaissent');

  // Choc latéral : l'emprise utile est bien plus étroite.
  const c = new Vehicle('comete', 0, 0, 0);
  const d = new Vehicle('comete', 2.6, 0, 0);
  resolveVehicleCollisions([c, d], null);
  assert.ok(d.x - c.x > c.hw + d.hw - 0.05, 'côte à côte : on se sépare à la largeur');
  assert.ok(d.x - c.x < 4, 'sans pousser jusqu’à la longueur');
});

/* ------------------------------------------------------------- circulation */

test('la circulation roule et reste sur la chaussée', async () => {
  const { Population } = await import('../game/src/systems/traffic.js');
  const data = generateWorld(20130917);
  const world = new World(data);
  // un jeu minimal : la circulation n'a besoin que de ça
  const game = {
    data, world, vehicles: [], peds: [], time: 0, threatLevel: 0,
    player: { x: 0, z: -45, wanted: 0, onFoot: true, dead: false, vehicle: null },
    audio: { stopEngine() {}, hornSound() {} },
  };
  const pop = new Population(game);
  // Comme la boucle du jeu : les piétons vivent aussi, sinon on simule des
  // statues plantées sur la chaussée et toute la ville s'embouteille.
  const ctx = { player: game.player, world, game };
  const tick = () => {
    game.time += dt;
    pop.update(dt);
    for (const v of game.vehicles) v.update(dt, world, null);
    for (const ped of game.peds) if (!ped.inVehicle) ped.update(dt, ctx);
  };
  for (let i = 0; i < 40; i++) pop.spawnTraffic();
  const traffic = game.vehicles.filter((v) => v.ai);
  assert.ok(traffic.length > 10, 'la circulation doit apparaître');
  const start = new Map(traffic.map((v) => [v, { x: v.x, z: v.z }]));

  const dt = 1 / 30;
  for (let step = 0; step < 30 * 30; step++) tick();     // 30 secondes simulées

  let moved = 0; let offRoad = 0;
  const live = game.vehicles.filter((v) => v.ai && !v.dead);
  const near = (c) => Math.abs(((c % STREET) + STREET * 1.5) % STREET - STREET / 2);
  const stopped = [];
  // On ne juge de la distance parcourue que sur les voitures du départ : les
  // autres viennent d'apparaître et n'ont pas encore eu le temps de rouler.
  const suivies = live.filter((v) => start.has(v));
  for (const v of live) {
    const s0 = start.get(v);
    if (s0 && dist2D(v.x, v.z, s0.x, s0.z) > 30) moved++;
    if (Math.abs(v.speed) < 0.5) stopped.push({ v, x: v.x, z: v.z });
    if (near(v.x) > 14 && near(v.z) > 14) offRoad++;
    assert.ok(!world.solidAt(v.x, 1, v.z), `voiture encastrée en (${v.x.toFixed(0)}, ${v.z.toFixed(0)})`);
  }
  assert.ok(live.length > 8, 'la circulation ne doit pas se détruire toute seule');
  assert.ok(suivies.length > 4, `il doit rester des voitures du départ (${suivies.length})`);
  assert.ok(moved > suivies.length * 0.6, `les voitures doivent avancer (${moved}/${suivies.length})`);
  assert.ok(offRoad < live.length * 0.3, `les voitures restent sur la chaussée (${offRoad} hors route)`);
  const vitesse = live.reduce((a, v) => a + Math.abs(v.speed), 0) / live.length;
  assert.ok(vitesse > 4, `la circulation ne doit pas être à l'arrêt (${vitesse.toFixed(1)} m/s)`);

  // Une voiture à l'arrêt attend un feu, elle n'est pas bloquée : après un
  // cycle complet, la plupart doivent être reparties.
  for (let step = 0; step < 30 * 26; step++) tick();
  const encore = stopped.filter((r) => game.vehicles.includes(r.v));
  const repartis = encore.filter((r) => dist2D(r.v.x, r.v.z, r.x, r.z) > 6).length;
  assert.ok(encore.length === 0 || repartis > encore.length * 0.55,
    `les voitures arrêtées doivent repartir (${repartis}/${encore.length})`);
});

test('une voiture lancée à fond ne traverse pas un immeuble', async () => {
  const data = generateWorld(20130917);
  const world = new World(data);
  // un immeuble bien épais, loin du bord de carte
  const mur = data.colliders
    .filter((c) => c.kind === 'building' && c.hw > 9 && c.hd > 9 && Math.abs(c.x) < 300 && Math.abs(c.z) < 300)
    .sort((a, b) => b.hw - a.hw)[0];
  assert.ok(mur, 'il faut un immeuble pour ce test');

  for (const kmh of [90, 160, 260]) {
    const v = new Vehicle('comete', mur.x, mur.z - mur.hd - 30, 0);
    v.speed = kmh / 3.6;
    v.vz = v.speed;
    const dt = 1 / 30;
    let dedans = false;
    for (let i = 0; i < 90; i++) {
      v.throttle = 1;
      v.update(dt, world, null);
      if (world.solidAt(v.x, 1, v.z)) dedans = true;
    }
    assert.ok(!dedans, `à ${kmh} km/h la voiture ne doit pas entrer dans le mur`);
    assert.ok(v.z < mur.z + mur.hd, `à ${kmh} km/h la voiture ne doit pas ressortir de l'autre côté (z=${v.z.toFixed(1)})`);
  }
});

test('les piétons vivent leur vie sans traverser les murs', async () => {
  const { Population } = await import('../game/src/systems/traffic.js');
  const data = generateWorld(20130917);
  const world = new World(data);
  const game = {
    data, world, vehicles: [], peds: [], time: 0, threatLevel: 0,
    player: { x: 0, z: -45, wanted: 0, onFoot: true, dead: false, vehicle: null },
    audio: { stopEngine() {}, hornSound() {} },
  };
  const pop = new Population(game);
  for (let i = 0; i < 90; i++) pop.spawnPed();
  const peds = [...game.peds];
  assert.ok(peds.length > 20, `des piétons doivent apparaître (${peds.length})`);
  const depart = peds.map((c) => ({ c, x: c.x, z: c.z, b: c.block }));

  const ctx = { player: game.player, world, game };
  const dt = 1 / 30;
  let dansLeMur = 0;
  const pauses = new Set();
  for (let step = 0; step < 30 * 120; step++) {         // deux minutes de trottoir
    game.time += dt;
    for (const c of game.peds) c.update(dt, ctx);
    for (const c of game.peds) if (c.idleT > 0) pauses.add(c.id);
    if (step % 60 === 0) for (const c of game.peds) if (world.solidAt(c.x, 1, c.z)) dansLeMur++;
  }
  assert.equal(dansLeMur, 0, `aucun piéton ne doit finir dans un mur (${dansLeMur})`);

  const bouges = depart.filter((r) => dist2D(r.c.x, r.c.z, r.x, r.z) > 8).length;
  assert.ok(bouges > depart.length * 0.7, `les piétons doivent marcher (${bouges}/${depart.length})`);
  const traverses = depart.filter((r) => r.c.block !== r.b).length;
  assert.ok(traverses > 2, `certains piétons doivent traverser la rue (${traverses})`);
  assert.ok(pauses.size > 2, `certains piétons doivent marquer une pause (${pauses.size})`);
});

test('un piéton s’écarte d’une voiture qui lui fonce dessus', async () => {
  const { Ped } = await import('../game/src/entities/character.js');
  const data = generateWorld(20130917);
  const world = new World(data);
  const rand = () => 0.5;
  const ped = new Ped(4.6, 0, rand);
  ped.setBlock(data.blocks[0]);
  const car = new Vehicle('comete', 4.6, -20, 0);
  car.speed = 16;
  const game = { vehicles: [car], threatLevel: 0 };
  const ctx = { player: { x: 400, z: 400 }, world, game };
  const dt = 1 / 60;
  let ecart = 0;
  for (let i = 0; i < 60; i++) {
    car.z += car.speed * dt;
    ped.update(dt, ctx);
    ecart = Math.max(ecart, Math.abs(ped.x - 4.6));
  }
  assert.ok(ecart > 1.4, `le piéton doit sauter sur le côté (${ecart.toFixed(2)} m)`);
});

test('chaque type de repère a sa propre forme sur la carte', async () => {
  const { BLIP_LEGEND, drawBlip } = await import('../game/src/systems/hud.js');

  /** Faux contexte 2D : on enregistre la suite des ordres de dessin. */
  const faux = () => {
    const ops = [];
    const c = {
      ops, lineJoin: '', strokeStyle: '', lineWidth: 0, fillStyle: '', font: '',
      textAlign: '', textBaseline: '',
      save() {}, restore() {}, translate() {}, rotate() {},
      beginPath() { ops.push('début'); },
      moveTo(x, y) { ops.push(`m${x.toFixed(1)},${y.toFixed(1)}`); },
      lineTo(x, y) { ops.push(`l${x.toFixed(1)},${y.toFixed(1)}`); },
      arc(x, y, r) { ops.push(`a${r.toFixed(1)}`); },
      closePath() { ops.push('fermer'); },
      fill() { ops.push('remplir'); }, stroke() { ops.push('tracer'); },
      fillText(t) { ops.push(`texte:${t}`); },
    };
    return c;
  };

  const empreintes = new Map();
  for (const e of BLIP_LEGEND) {
    const c = faux();
    drawBlip(c, 0, 0, e, 10);
    assert.ok(c.ops.length > 2, `${e.kind} doit dessiner quelque chose`);
    const forme = c.ops.filter((o) => !o.startsWith('texte:')).join('|');
    if (!empreintes.has(e.shape)) empreintes.set(e.shape, forme);
    else assert.equal(empreintes.get(e.shape), forme, `deux ${e.shape} doivent se dessiner pareil`);
  }
  assert.equal(empreintes.size, new Set([...empreintes.values()]).size,
    'deux formes différentes ne doivent pas se dessiner de la même façon');
  assert.ok(empreintes.size >= 6, `il faut au moins six formes distinctes (${empreintes.size})`);

  // les commerces se distinguent par leur symbole
  const symboles = BLIP_LEGEND.filter((e) => e.glyph).map((e) => e.glyph);
  assert.equal(symboles.length, new Set(symboles).size, 'chaque symbole doit être unique');

  // et chaque entrée de légende est expliquée en français
  for (const e of BLIP_LEGEND) {
    assert.ok(e.label && e.label.length > 4, `${e.kind} doit avoir un libellé lisible`);
  }
});

test('griller un feu devant une patrouille coûte une étoile', async () => {
  const { Game } = await import('../game/src/game.js');
  const { Population } = await import('../game/src/systems/traffic.js');
  const data = generateWorld(20130917);
  const world = new World(data);

  /** Un jeu réduit à ce que checkTrafficOffences a besoin de lire. */
  const faireJeu = (avecPatrouille) => {
    const g = Object.create(Game.prototype);
    const v = new Vehicle('comete', 0, -30, 0);
    v.speed = 14; v.vz = 14;
    const patrouille = new Vehicle('police', 14, -6, 0);
    g.world = world;
    g.time = 0;
    g.vehicles = avecPatrouille ? [v, patrouille] : [v];
    g.peds = [];
    g.player = { x: v.x, z: v.z, wanted: 0, dead: false, vehicle: v };
    g.audio = { ui() {} };
    g.motifs = [];
    g.notify = (t, sub) => g.motifs.push(sub);
    g.police = { addWanted: (n) => { g.player.wanted += n; } };
    return { g, v };
  };

  // on choisit un instant où l'axe est-ouest est rouge, puis on traverse en X
  let t = 0;
  while (Population.lightPhase(t).green === 1 || Population.lightPhase(t).amber) t += 0.2;

  const traverser = (avecPatrouille) => {
    const { g, v } = faireJeu(avecPatrouille);
    g.time = t;
    v.x = -20; v.z = 0; v.yaw = Math.PI / 2; v.speed = 14;   // plein est
    g.player.x = v.x; g.player.z = v.z;
    for (let i = 0; i < 120; i++) {
      v.x += 14 / 30;
      g.player.x = v.x;
      g.time += 1 / 30;
      g.checkTrafficOffences(1 / 30);
    }
    return { etoiles: g.player.wanted, motifs: g.motifs };
  };

  const vu = traverser(true);
  assert.equal(vu.etoiles, 1, 'une patrouille voit le feu grillé');
  assert.ok(vu.motifs.some((m) => /feu rouge/.test(m)), `le motif doit être le feu (${vu.motifs})`);

  const pasVu = traverser(false);
  assert.equal(pasVu.etoiles, 0, 'un carrefour désert ne coûte rien');
});

test('rouler à contresens finit par se voir', async () => {
  const { Game } = await import('../game/src/game.js');
  const data = generateWorld(20130917);
  const world = new World(data);
  const g = Object.create(Game.prototype);
  const v = new Vehicle('comete', -4.6, -30, 0);
  const patrouille = new Vehicle('police', 4.6, -25, Math.PI);   // en face, sur l'autre file
  g.world = world; g.time = 40;
  g.vehicles = [v, patrouille];
  g.peds = [];
  g.player = { x: v.x, z: v.z, wanted: 0, dead: false, vehicle: v };
  g.audio = { ui() {} };
  g.motifs = [];
  g.notify = (titre, sub) => g.motifs.push(sub);
  g.police = { addWanted: (n) => { g.player.wanted += n; } };

  // rue nord-sud (x ≈ 0) : en allant vers +z il faut rouler côté +x.
  // On roule côté -x : c'est le contresens.
  v.yaw = 0; v.speed = 12;
  for (let i = 0; i < 30 * 6; i++) {
    v.z += 12 / 30;
    if (v.z > -12) v.z = -40;                    // on reste entre deux carrefours
    g.player.x = v.x; g.player.z = v.z;
    g.time += 1 / 30;
    g.checkTrafficOffences(1 / 30);
  }
  assert.equal(g.player.wanted, 1, 'le contresens doit finir par coûter une étoile');
  assert.ok(g.motifs.some((m) => /contresens/.test(m)), `motif attendu (${g.motifs})`);

  // et du bon côté, rien
  const g2 = Object.create(Game.prototype);
  Object.assign(g2, g, { player: { ...g.player, wanted: 0 }, motifs: [], offenceCooldown: 0, wrongWayT: 0 });
  g2.notify = (titre, sub) => g2.motifs.push(sub);
  g2.police = { addWanted: (n) => { g2.player.wanted += n; } };
  const v2 = g2.player.vehicle;
  v2.x = 4.6; v2.yaw = 0; v2.speed = 12;
  for (let i = 0; i < 30 * 6; i++) {
    v2.z += 12 / 30;
    if (v2.z > -12) v2.z = -40;
    g2.player.x = v2.x; g2.player.z = v2.z;
    g2.time += 1 / 30;
    g2.checkTrafficOffences(1 / 30);
  }
  assert.equal(g2.player.wanted, 0, 'du bon côté de la chaussée, rien à signaler');
});

test('être à sec renvoie au menu principal', async () => {
  const { Game } = await import('../game/src/game.js');

  const faireJeu = (argent) => {
    const g = Object.create(Game.prototype);
    g.state = 'play';
    g.player = { money: argent, character: 'franklin' };
    g.missions = { active: null, done: new Set() };
    g.audio = { ui() {} };
    g.bannieres = [];
    g.showBanner = (t, sub) => g.bannieres.push(t);
    g.menu = null;
    g.showMainMenu = (t, sub) => { g.menu = { t, sub }; g.state = 'menu'; };
    g.notify = () => {};
    return g;
  };

  // avec de l'argent, il ne se passe rien
  {
    const g = faireJeu(1200);
    for (let i = 0; i < 200; i++) g.checkRuin(1 / 30);
    assert.equal(g.ruined, undefined, 'on ne ruine pas un joueur solvable');
  }

  // à zéro, la bannière tombe puis le menu s'ouvre
  {
    const g = faireJeu(0);
    for (let i = 0; i < 20; i++) g.checkRuin(1 / 30);          // 0,66 s
    assert.equal(g.ruined, true, 'plus un sou : la partie s’arrête');
    assert.ok(g.bannieres.includes('RUINÉ'), 'le joueur doit être prévenu');
    assert.ok(g.ruinDelay > 0, 'on laisse voir la bannière avant le menu');
    // la bannière ne doit pas se répéter
    const avant = g.bannieres.length;
    for (let i = 0; i < 60; i++) g.checkRuin(1 / 30);
    assert.equal(g.bannieres.length, avant, 'une seule bannière');
  }

  // un solde nul fugace (achat puis paie) ne déclenche rien
  {
    const g = faireJeu(0);
    g.checkRuin(1 / 30);
    g.player.money = 9000;
    g.checkRuin(1 / 30);
    assert.equal(g.ruined, undefined, 'un passage à zéro d’une image ne compte pas');
  }
});

test('on entre et on ressort de chaque intérieur', async () => {
  const { Game } = await import('../game/src/game.js');
  const data = generateWorld(20130917);
  const world = new World(data);

  assert.ok(data.interiors.length >= 4, 'il faut plusieurs intérieurs');
  for (const it of data.interiors) {
    assert.ok(it.name && it.hint, `${it.id} : présentation incomplète`);
    // La pièce est bâtie au large de la ville, mais sur la terre ferme : posée
    // au-delà du trait de côte elle passerait sous le plan d'eau.
    assert.ok(Math.max(Math.abs(it.x), Math.abs(it.z)) > STREET * GRID + 250,
      `${it.id} : la pièce empiète sur la ville`);
    assert.ok(it.x > -640 + 120, `${it.id} : la pièce est dans l'océan (x=${it.x})`);
    assert.ok(Math.abs(it.x) < 1080 && Math.abs(it.z) < 1080,
      `${it.id} : la pièce déborde de la dalle de sol`);
    // la porte, elle, est bien en ville et pas dans un mur
    assert.ok(Math.hypot(it.door.x, it.door.z) < 1400, `${it.id} : porte hors de la ville`);
    assert.ok(!world.solidAt(it.door.x, 1, it.door.z), `${it.id} : la porte est dans un mur`);
    // on peut se tenir au point d'apparition, au comptoir et à la sortie
    for (const [nom, q] of [['apparition', it.spawn], ['sortie', it.exit], ['comptoir', it.counter]]) {
      const t = { x: q.x, z: q.z };
      world.pushCircle(t, 0.42, 2);
      assert.ok(Math.hypot(t.x - q.x, t.z - q.z) < 1.4,
        `${it.id} : le point « ${nom} » est encastré dans le décor`);
    }
    // les murs tiennent : on ne sort pas de la pièce en marchant
    const dehors = { x: it.x, z: it.z - it.d / 2 - 0.3 };
    assert.ok(world.solidAt(dehors.x, 1, dehors.z), `${it.id} : le mur du fond ne bloque pas`);
  }

  // deux intérieurs ne doivent pas se chevaucher
  for (let i = 0; i < data.interiors.length; i++) {
    for (let j = i + 1; j < data.interiors.length; j++) {
      const a = data.interiors[i], b = data.interiors[j];
      assert.ok(Math.abs(a.x - b.x) > (a.w + b.w) / 2 + 4 || Math.abs(a.z - b.z) > (a.d + b.d) / 2 + 4,
        `${a.id} et ${b.id} se chevauchent`);
    }
  }

  /* ------------------------ aller-retour depuis un faux jeu ------------------------ */
  const g = Object.create(Game.prototype);
  const it = data.interiors[0];
  g.data = data;
  g.inside = null;
  g.player = { x: it.door.x, z: it.door.z, y: 0, yaw: 1.1, vx: 0, vz: 0, onFoot: true, dead: false };
  g.camera = { yaw: 1.1 };
  g.population = {};
  g.audio = { ui() {} };
  g.notify = () => {};

  assert.equal(g.nearDoor(), it, 'la porte doit être détectée depuis le parvis');
  assert.ok(g.enterInterior(it), 'on doit pouvoir entrer');
  assert.equal(g.inside, it);
  assert.ok(dist2D(g.player.x, g.player.z, it.spawn.x, it.spawn.z) < 0.01, 'on arrive au point d’apparition');
  assert.equal(g.population.indoors, true, 'la circulation est suspendue à l’intérieur');
  assert.equal(g.nearDoor(), null, 'à l’intérieur, plus de porte à franchir');
  assert.equal(g.enterInterior(data.interiors[1]), false, 'on n’entre pas dans un intérieur depuis un autre');

  assert.ok(g.exitInterior(), 'on doit pouvoir ressortir');
  assert.equal(g.inside, null);
  assert.ok(dist2D(g.player.x, g.player.z, it.door.x, it.door.z) < 0.01, 'on ressort là où on est entré');
  assert.ok(Math.abs(g.player.yaw - 1.1) < 1e-9, 'et on retrouve son orientation');
  assert.equal(g.population.indoors, false, 'la ville repart');
  assert.equal(g.exitInterior(), false, 'sortir deux fois ne fait rien');
});

test('la prise en main est complète et cohérente', async () => {
  const { TUTORIAL_STEPS, HELP_SECTIONS, contextKeys, Onboarding } =
    await import('../game/src/systems/onboarding.js');

  // --- tutoriel
  assert.ok(TUTORIAL_STEPS.length >= 6, 'il faut plusieurs premiers pas');
  const ids = TUTORIAL_STEPS.map((s) => s.id);
  assert.equal(ids.length, new Set(ids).size, 'pas deux fois la même étape');
  for (const s of TUTORIAL_STEPS) {
    assert.ok(s.goal && s.why, `${s.id} : consigne ou raison manquante`);
    assert.equal(typeof s.done, 'function', `${s.id} : pas de condition de réussite`);
    assert.ok(/<b>/.test(s.goal) || /<b>/.test(s.why),
      `${s.id} : la touche à utiliser doit ressortir quelque part`);
  }

  // --- aide
  const touchesAide = HELP_SECTIONS.flatMap((sec) => sec.rows.map((r) => r[0]));
  for (const t of ['Z Q S D', 'Souris', 'E', 'M', 'I', 'H', 'Échap', 'V', 'Alt']) {
    assert.ok(touchesAide.includes(t), `l’aide doit expliquer « ${t} »`);
  }
  for (const sec of HELP_SECTIONS) {
    assert.ok(sec.title && sec.rows.length, `section « ${sec.title} » vide`);
    for (const [k, txt] of sec.rows) assert.ok(k && txt && txt.length > 3, `ligne d’aide incomplète (${k})`);
  }

  // --- barre de commandes selon la situation
  const faireJeu = (over = {}) => ({
    state: 'play',
    inside: null,
    peds: [],
    hud: { actionLabel: '', mapOpen: false, invOpen: false },
    player: { x: 0, z: 0, dead: false, vehicle: null, move: 0, weaponDef: { melee: false } },
    nearestVehicle: () => null,
    input: { mouseDX: 0, mouseDY: 0 },
    camera: { yaw: 0, pitch: 0 },
    ...over,
  });

  const aPied = contextKeys(faireJeu());
  assert.ok(aPied.length >= 4, 'à pied, la barre doit être garnie');
  assert.ok(aPied.some(([k]) => k === 'Souris'), 'la souris doit être annoncée : c’est elle qui oriente la vue');
  assert.ok(aPied.some(([k]) => k === 'H'), 'l’aide doit être rappelée');

  const enVoiture = contextKeys(faireJeu({ player: { ...faireJeu().player, vehicle: {} } }));
  assert.ok(enVoiture.some(([, t]) => /Descendre/.test(t)), 'en voiture on doit savoir comment descendre');
  assert.ok(!enVoiture.some(([, t]) => /Marcher/.test(t)), 'et pas comment marcher');

  const dedans = contextKeys(faireJeu({ inside: { name: 'Ammu-Nation' }, hud: { actionLabel: 'Acheter' } }));
  assert.ok(dedans.some(([k, t]) => k === 'E' && t === 'Acheter'), 'à l’intérieur, E doit dire ce qu’il fait');

  const mort = contextKeys(faireJeu({ player: { ...faireJeu().player, dead: true } }));
  assert.deepEqual(mort, [], 'mort, plus de barre');

  // --- l'avancement suit vraiment les gestes du joueur
  const g = faireJeu();
  const onb = new Onboarding(g);
  g.tuto = { looked: 0, walked: 0, driven: 0, reachedCar: false, openedMap: false, openedInv: false, talked: false };
  assert.equal(onb.current.id, 'look', 'on commence par apprendre à regarder');
  for (let i = 0; i < 60; i++) onb.update(1 / 30);
  assert.equal(onb.current.id, 'look', 'caméra immobile : on reste à la première étape');
  // on fait tourner la caméra, comme le ferait la souris
  for (let i = 0; i < 60; i++) { g.camera.yaw += 0.05; onb.update(1 / 30); }
  assert.equal(onb.current.id, 'walk', 'après avoir regardé autour, on passe à la marche');

  onb.skip();
  assert.equal(onb.current, null, 'on doit pouvoir passer le tutoriel');
  assert.equal(onb.finished, true);
});

test('on peut adresser la parole à un passant', async () => {
  const { Ped, PED_LINES, PED_LINES_PANIC } = await import('../game/src/entities/character.js');
  assert.ok(PED_LINES.length >= 8, 'il faut de quoi varier les répliques');
  assert.equal(PED_LINES.length, new Set(PED_LINES).size, 'pas de réplique en double');

  const q = new Ped(10, 10, () => 0.5);
  assert.equal(q.line, null, 'au départ, il ne dit rien');
  const dit = q.talk(10, 4);
  assert.ok(PED_LINES.includes(dit), `la réplique doit venir du répertoire (${dit})`);
  assert.equal(q.line, dit);
  assert.ok(q.talkT > 2, 'la bulle reste affichée quelques secondes');
  assert.ok(q.idleT > 2, 'il s’arrête pour répondre');
  assert.ok(Math.abs(q.yaw - Math.atan2(0, -6)) < 1e-6, 'il se tourne vers nous');

  // la bulle s'efface toute seule
  for (let i = 0; i < 300; i++) q.talkT = Math.max(0, q.talkT - 1 / 30);
  assert.equal(q.talkT, 0, 'la bulle finit par disparaître');

  // paniqué, il ne fait pas la conversation
  const effraye = new Ped(0, 0, () => 0.5);
  effraye.panic = 1;
  assert.ok(PED_LINES_PANIC.includes(effraye.talk(0, -3)), 'sous la panique, le ton change');

  // un mort ne répond pas
  const mort = new Ped(0, 0, () => 0.5);
  mort.dead = true;
  assert.equal(mort.talk(0, -3), null, 'un mort ne parle pas');
});

test('la visée assistée accroche la bonne cible', async () => {
  const { Game } = await import('../game/src/game.js');
  const { Ped } = await import('../game/src/entities/character.js');
  const data = generateWorld(20130917);
  const world = new World(data);

  const faireJeu = () => {
    const g = Object.create(Game.prototype);
    g.world = world;
    g.state = 'play';
    g.peds = [];
    g.player = {
      x: 0, z: -300, dead: false, aiming: false,
      weaponDef: { melee: false },
    };
    // caméra derrière le joueur, regardant plein +z
    g.camera = { eye: [0, 1.6, -304], yaw: 0, pitch: 0, aimRay: () => [0, 0, 1] };
    return g;
  };

  // une cible pile dans l'axe, une autre nettement sur le côté
  {
    const g = faireJeu();
    const dansLAxe = new Ped(0.4, -280, Math.random);
    const surLeCote = new Ped(14, -280, Math.random);
    g.peds.push(surLeCote, dansLAxe);
    g.updateAimAssist();
    assert.equal(g.lockTarget, dansLAxe, 'c’est la cible la plus centrée qui est accrochée');
  }

  // rien derrière soi
  {
    const g = faireJeu();
    const derriere = new Ped(0, -330, Math.random);
    g.peds.push(derriere);
    g.updateAimAssist();
    assert.equal(g.lockTarget, null, 'on n’accroche pas ce qui est dans le dos');
  }

  // un mort n'est plus une cible
  {
    const g = faireJeu();
    const mort = new Ped(0.3, -280, Math.random);
    mort.dead = true;
    g.peds.push(mort);
    g.updateAimAssist();
    assert.equal(g.lockTarget, null, 'un piéton mort n’est plus accroché');
  }

  // à l'arme blanche, pas d'accroche
  {
    const g = faireJeu();
    g.player.weaponDef = { melee: true };
    g.peds.push(new Ped(0.3, -280, Math.random));
    g.updateAimAssist();
    assert.equal(g.lockTarget, null, 'pas de visée assistée à la batte');
  }

  // un ennemi passe devant un passant à égalité de centrage
  {
    const g = faireJeu();
    const passant = new Ped(0.5, -278, Math.random);
    const ennemi = new Ped(-0.5, -281, Math.random, { hostile: true });
    g.peds.push(passant, ennemi);
    g.updateAimAssist();
    assert.equal(g.lockTarget, ennemi, 'la menace passe avant le badaud');
  }

  // hors de portée
  {
    const g = faireJeu();
    g.peds.push(new Ped(0, -180, Math.random));    // 120 m
    g.updateAimAssist();
    assert.equal(g.lockTarget, null, 'trop loin pour être accroché');
  }
});

test('la projection à l’écran place la cible au bon endroit', async () => {
  const { projectPoint } = await import('../game/src/game.js');
  const proj = m4perspective(m4(), 1.1, 16 / 9, 0.5, 500);
  // caméra à l'origine regardant -Z : la vue est l'identité
  const vp = proj;
  const centre = projectPoint(vp, 0, 0, -20, 800, 450);
  assert.ok(centre, 'un point devant la caméra doit se projeter');
  assert.ok(Math.abs(centre[0] - 400) < 0.5 && Math.abs(centre[1] - 225) < 0.5,
    `droit devant = centre de l’écran (${centre[0].toFixed(1)}, ${centre[1].toFixed(1)})`);
  assert.ok(projectPoint(vp, 0, 0, 20, 800, 450) === null, 'derrière la caméra : rien');
  const droite = projectPoint(vp, 5, 0, -20, 800, 450);
  assert.ok(droite[0] > 400, 'un point à droite se projette à droite');
  const haut = projectPoint(vp, 0, 5, -20, 800, 450);
  assert.ok(haut[1] < 225, 'un point en hauteur se projette vers le haut de l’écran');
});

test('tirer anime le personnage', async () => {
  const { Player } = await import('../game/src/entities/player.js');
  const p = new Player();
  p.giveWeapon('pistol', 60);
  p.switchWeapon('pistol');
  assert.equal(p.fireAnim, 0, 'au repos, aucune animation de tir');
  p.consumeAmmo();
  assert.equal(p.fireAnim, 1, 'le coup part : le recul démarre au maximum');

  // et il retombe en une fraction de seconde, pas instantanément
  const dt = 1 / 60;
  let images = 0;
  while (p.fireAnim > 0 && images < 200) { p.fireCooldown -= dt; p.fireAnim = Math.max(0, p.fireAnim - dt * 7); images++; }
  const duree = images * dt;
  assert.ok(duree > 0.08 && duree < 0.4, `le recul dure une fraction de seconde (${duree.toFixed(2)} s)`);
});

test('la pose de tir lève l’arme même sans viser', async () => {
  const { drawHuman } = await import('../game/src/entities/character.js');
  // faux moteur de rendu : on enregistre la position des pièces dessinées
  const capture = () => {
    const pieces = [];
    const lire = (m, c, emit = 0) => pieces.push({ x: m[12], y: m[13], z: m[14], emit });
    return { pieces, cube: lire, cyl: lire, sphere: lire };
  };
  const etat = (fire) => ({
    x: 0, y: 0, z: 0, yaw: 0, anim: 0, move: 0, aim: false, deadT: 0, fire,
    weapon: { len: 0.32, wide: 0.075 },
  });
  const repos = capture(); drawHuman(repos, etat(0), 0);
  const tir = capture(); drawHuman(tir, etat(1), 0);

  const plusHaut = (r) => Math.max(...r.pieces.filter((q) => q.z > 0.2).map((q) => q.y));
  const eclair = (r) => r.pieces.some((q) => q.emit >= 1);
  assert.ok(!eclair(repos), 'au repos, pas d’éclair de bouche');
  assert.ok(eclair(tir), 'en tirant, un éclair s’allume au bout du canon');
  assert.ok(plusHaut(tir) > plusHaut(repos) + 0.2,
    `l’arme doit se lever en tirant (${plusHaut(repos).toFixed(2)} → ${plusHaut(tir).toFixed(2)})`);
});

test('la police descend de voiture et ouvre le feu', async () => {
  const { Population } = await import('../game/src/systems/traffic.js');
  const { PoliceSystem } = await import('../game/src/systems/police.js');
  const data = generateWorld(20130917);
  const world = new World(data);
  let tirs = 0;
  const game = {
    data, world, vehicles: [], peds: [], time: 0, threatLevel: 0,
    player: { x: 0, z: -45, wanted: 4, onFoot: true, dead: false, vehicle: null, damage() {} },
    audio: { stopEngine() {}, hornSound() {}, ui() {}, updateSiren() {}, gunshot() {} },
    particles: { spawn() {} },
    notify() {}, explode() {}, onPedKilled() {},
    npcShoot() { tirs++; }, npcShootFrom() { tirs++; },
  };
  const pop = new Population(game);
  const police = new PoliceSystem(game);
  game.police = police;

  const ctx = { player: game.player, world, game };
  const dt = 1 / 30;
  let auRalenti = 0;
  for (let step = 0; step < 30 * 45; step++) {
    game.time += dt;
    game.player.wanted = 4;                       // on ne se laisse pas semer
    police.update(dt);
    pop.update(dt);
    for (const v of game.vehicles) v.update(dt, world, null);
    for (const ped of game.peds) if (!ped.inVehicle) ped.update(dt, ctx);
    for (const v of game.vehicles) {
      if (v.ai && v.ai.chase && !v.dead && Math.abs(v.speed) < 3
        && dist2D(v.x, v.z, 0, -45) < 40) auRalenti++;
    }
  }

  const aPied = game.peds.filter((c) => c.cop && !c.dead && !c.inVehicle).length;
  assert.ok(auRalenti > 0, 'une patrouille doit se ranger au lieu de foncer sur un piéton');
  assert.ok(aPied >= 2, `des agents doivent descendre de voiture (${aPied})`);
  assert.ok(tirs > 5, `la police doit ouvrir le feu (${tirs} tirs)`);
});

test('une patrouille ne fonce plus sur un suspect à pied', async () => {
  const { Population } = await import('../game/src/systems/traffic.js');
  const data = generateWorld(20130917);
  const world = new World(data);
  const game = {
    data, world, vehicles: [], peds: [], time: 0,
    player: { x: 0, z: -45, wanted: 3, onFoot: true, dead: false, vehicle: null },
    audio: { stopEngine() {}, hornSound() {} },
  };
  const pop = new Population(game);
  const v = new Vehicle('police', 0, -110, 0);
  v.ai = { chase: true, node: 0, next: 0, cruise: 26 };
  v.speed = 24; v.vz = 24;
  game.vehicles.push(v);

  const dt = 1 / 30;
  let mini = 1e9; let vitesseAuPlusPres = 0;
  for (let step = 0; step < 30 * 20; step++) {
    game.time += dt;
    pop.driveAI(v, dt);
    v.update(dt, world, null);
    const d = dist2D(v.x, v.z, 0, -45);
    if (d < mini) { mini = d; vitesseAuPlusPres = Math.abs(v.speed); }
  }
  assert.ok(mini < 30, `la patrouille doit s'approcher (au plus près : ${mini.toFixed(0)} m)`);
  assert.ok(vitesseAuPlusPres < 6,
    `et arriver au pas, pas à pleine vitesse (${(vitesseAuPlusPres * 3.6).toFixed(0)} km/h)`);
});

test('une longue traque ne fait pas enfler le parc automobile', async () => {
  const { Population } = await import('../game/src/systems/traffic.js');
  const { PoliceSystem } = await import('../game/src/systems/police.js');
  const data = generateWorld(20130917);
  const world = new World(data);
  const game = {
    data, world, vehicles: [], peds: [], time: 0,
    player: { x: 0, z: -45, wanted: 5, onFoot: true, dead: false, vehicle: null, damage() {} },
    audio: { stopEngine() {}, hornSound() {}, ui() {}, updateSiren() {} },
    notify() {}, explode() {}, npcShootFrom() {}, onPedKilled() {},
  };
  const pop = new Population(game);
  const police = new PoliceSystem(game);
  game.police = police;

  const dt = 1 / 30;
  let peak = 0;
  for (let step = 0; step < 30 * 240; step++) {          // quatre minutes de traque
    game.time += dt;
    police.update(dt);
    pop.update(dt);
    for (const v of game.vehicles) v.update(dt, world, null);
    game.player.wanted = 5;                               // on ne se laisse jamais semer
    peak = Math.max(peak, game.vehicles.length);
  }
  assert.ok(peak < 90, `le nombre de véhicules doit rester borné (pic : ${peak})`);
  assert.ok(game.peds.length < 140, `et celui des piétons aussi (${game.peds.length})`);
  const wrecks = game.vehicles.filter((v) => v.dead).length;
  assert.ok(wrecks < 25, `les épaves finissent par disparaître (${wrecks} restantes)`);
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
      // race et collect portent une liste de points ; les autres un seul
      const pts = (s2.type === 'race' || s2.type === 'collect') ? s2.points
        : (s2.x !== undefined ? [[s2.x, s2.z]] : []);
      for (const [x, z] of pts) {
        assert.ok(!solid(x, z), `${m.id}/${s2.type} : point (${x}, ${z}) dans un mur`);
        if (s2.vehicle || ['deliver', 'race', 'spawnVehicle', 'chase', 'protect'].includes(s2.type)) {
          assert.ok(drivable(x, z), `${m.id}/${s2.type} : point (${x}, ${z}) inaccessible en voiture`);
        }
      }
      for (const e of s2.enemies || []) {
        assert.ok(!solid(e.x, e.z), `${m.id} : ennemi en (${e.x}, ${e.z}) dans un mur`);
      }
      for (const [x, z] of s2.ambush || []) {
        assert.ok(!solid(x, z), `${m.id} : embuscade en (${x}, ${z}) dans un mur`);
        assert.ok(drivable(x, z), `${m.id} : embuscade en (${x}, ${z}) hors de la route`);
      }
      if (s2.area) {
        assert.ok(!solid(s2.area.x, s2.area.z),
          `${m.id}/${s2.type} : centre de zone (${s2.area.x}, ${s2.area.z}) dans un mur`);
      }
    }
  }
  // Une mission est abandonnée au-delà de 1100 m de son objectif pendant 40 s :
  // aucune étape légitime ne doit envoyer aussi loin.
  for (const m of MISSIONS) {
    let prev = [m.x, m.z];
    for (const s2 of m.steps) {
      const pts = (s2.type === 'race' || s2.type === 'collect') ? s2.points
        : (s2.x !== undefined ? [[s2.x, s2.z]] : []);
      for (const [x, z] of pts) {
        const d = dist2D(prev[0], prev[1], x, z);
        assert.ok(d < 1000, `${m.id}/${s2.type} : étape de ${Math.round(d)} m, trop loin`);
        prev = [x, z];
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
  const collide = new World(w);
  for (const [key, c] of Object.entries(CHARACTERS)) {
    assert.ok(Number.isFinite(c.home.x) && Number.isFinite(c.home.z), 'domicile mal défini');
    const q = { x: c.home.x, z: c.home.z };
    assert.equal(collide.pushCircle(q, 0.5, 2), null,
      `${key} apparaît dans un mur en (${c.home.x}, ${c.home.z})`);
    // et pas pile sur un marqueur de mission, sinon elle se lance toute seule
    for (const m of MISSIONS) {
      assert.ok(dist2D(c.home.x, c.home.z, m.x, m.z) > 4, `${key} apparaît sur la mission ${m.id}`);
    }
  }
});

test('chaque nouvelle quête se joue jusqu’au bout', async () => {
  const { MissionSystem } = await import('../game/src/systems/missions.js');
  const { Population } = await import('../game/src/systems/traffic.js');
  const { Ped } = await import('../game/src/entities/character.js');
  const data = generateWorld(20130917);
  const world = new World(data);

  /** Le strict nécessaire pour qu'une mission tourne sans navigateur. */
  const faireJeu = () => {
    const g = {
      data, world, vehicles: [], peds: [], time: 0, threatLevel: 0, objectif: '', banniere: null,
      player: {
        x: 0, z: 0, wanted: 0, dead: false, vehicle: null, money: 0,
        onFoot: true, character: 'franklin', health: 200, maxHealth: 200,
      },
      audio: { ui() {}, stopEngine() {}, hornSound() {}, updateSiren() {}, gunshot() {} },
      particles: { spawn() {} },
      hud: { setObjective(t) { g.objectif = t; } },
      notify() {}, explode() {}, onPedKilled() {}, npcShoot() {}, npcShootFrom() {},
      showBanner(t, sub) { g.banniere = { t, sub }; },
      police: { addWanted(n) { g.player.wanted += n; }, clear() { g.player.wanted = 0; } },
      spawnPedAt(x, z, opts) { const q = new Ped(x, z, Math.random, opts); g.peds.push(q); return q; },
    };
    g.population = new Population(g);
    g.missions = new MissionSystem(g);
    return g;
  };

  /** Fait avancer le jeu, en plaçant le joueur là où on lui demande d'aller. */
  const jouer = (g, secondes, aChaqueImage) => {
    const dt = 1 / 30;
    for (let i = 0; i < secondes * 30; i++) {
      g.time += dt;
      if (aChaqueImage) aChaqueImage(g, i);
      const wp = g.missions.waypoint;
      if (wp) {                                   // on « conduit » droit au but
        g.player.x += Math.max(-16 * dt, Math.min(16 * dt, wp.x - g.player.x));
        g.player.z += Math.max(-16 * dt, Math.min(16 * dt, wp.z - g.player.z));
        if (g.player.vehicle) { g.player.vehicle.x = g.player.x; g.player.vehicle.z = g.player.z; }
      }
      g.population.update(dt);
      for (const v of g.vehicles) v.update(dt, world, null);
      g.missions.update(dt);
      if (!g.missions.active) return true;        // terminée (ou échouée)
    }
    return false;
  };

  const missionPar = (id) => MISSIONS.find((m) => m.id === id);
  const monterEnVoiture = (g) => {
    const v = new Vehicle('comete', g.player.x, g.player.z, 0);
    g.vehicles.push(v);
    g.player.vehicle = v;
    g.player.onFoot = false;
    return v;
  };

  /* ---------------------------------------------------------- poursuite */
  {
    const g = faireJeu();
    g.player.x = -85; g.player.z = 268;
    g.missions.start(missionPar('pursuit'));
    monterEnVoiture(g);
    const fini = jouer(g, 60, (jeu) => {
      const f = jeu.missions.refs.fugitif;
      if (f && dist2D(jeu.player.x, jeu.player.z, f.x, f.z) < 14) f.damage(9);
    });
    assert.ok(fini, 'la poursuite doit se conclure');
    assert.ok(g.missions.done.has('pursuit'), `la poursuite doit être réussie (${g.banniere && g.banniere.sub})`);
  }

  /* -------------------------------------------------------- récupération */
  {
    const g = faireJeu();
    g.player.x = -536; g.player.z = -266;
    g.missions.start(missionPar('stash'));
    const fini = jouer(g, 120);
    assert.ok(fini && g.missions.done.has('stash'),
      `les sacs doivent pouvoir être ramassés (objectif : ${g.objectif})`);
  }

  /* ------------------------------------------------------------ survie */
  {
    const g = faireJeu();
    g.player.x = 176; g.player.z = 626;
    g.missions.start(missionPar('siege'));
    const fini = jouer(g, 200, (jeu) => {
      for (const q of jeu.peds) if (q.hostile) q.dead = true;   // on tient la position
    });
    assert.ok(fini && g.missions.done.has('siege'),
      `la survie doit s’achever (objectif : ${g.objectif})`);
    assert.ok(/\d+ s$/.test(g.objectif) === false, 'et l’objectif ne doit pas rester figé');
  }

  /* --------------------------------------------------------- sabotage */
  {
    const g = faireJeu();
    g.player.x = 448; g.player.z = 448;
    g.missions.start(missionPar('wreck'));
    const fini = jouer(g, 180, (jeu) => {
      const cible = jeu.missions.targets && jeu.missions.targets.find((v) => !v.dead);
      if (cible && dist2D(jeu.player.x, jeu.player.z, cible.x, cible.z) < 14) cible.damage(400);
      // une fois les camions détruits, on sème la police
      if (jeu.missions.stepData && jeu.missions.stepData.type === 'losePolice') jeu.player.wanted = 0;
    });
    assert.ok(fini && g.missions.done.has('wreck'),
      `le sabotage doit s’achever (objectif : ${g.objectif})`);
  }

  /* ---------------------------------------------------------- escorte */
  {
    const g = faireJeu();
    g.player.x = 268; g.player.z = -85;
    g.player.character = 'michael';
    g.missions.start(missionPar('escort'));
    monterEnVoiture(g);
    const fini = jouer(g, 200);
    assert.ok(fini && g.missions.done.has('escort'),
      `l’escorte doit arriver à bon port (objectif : ${g.objectif})`);
  }
});

test('les missions sont bien formées', () => {
  // On lit les types d'étapes réellement traités dans missions.js : ainsi une
  // mission ne peut pas référencer une mécanique qui n'existe pas.
  const src = fs.readFileSync(path.join(GAME_DIR, 'systems/missions.js'), 'utf8');
  const entre = (debut, fin) => src.split(debut)[1].split(fin)[0];
  const miseEnPlace = entre('\n  nextStep() {', '\n  fail(');
  const suivi = entre('\n  update(dt) {', '\n  /** Cible actuelle');
  const casDe = (txt) => new Set([...txt.matchAll(/case '([a-zA-Z]+)':/g)].map((m) => m[1]));
  const gerees = casDe(miseEnPlace);
  const suivies = casDe(suivi);
  const instantanees = new Set(['spawnVehicle']);   // enchaînent tout de suite
  assert.ok(gerees.size >= 8, `nextStep doit préparer plusieurs mécaniques (${gerees.size})`);

  const ids = new Set();
  for (const m of MISSIONS) {
    assert.ok(!ids.has(m.id), `identifiant de mission en double : ${m.id}`);
    ids.add(m.id);
    assert.ok(m.name && m.brief && m.letter, `${m.id} : présentation incomplète`);
    assert.ok(m.reward > 0, `${m.id} : récompense manquante`);
    assert.ok(Number.isFinite(m.x) && Number.isFinite(m.z), `${m.id} : marqueur sans position`);
    assert.ok(m.steps.length > 0, `${m.id} : aucune étape`);
    assert.ok(m.kind, `${m.id} : genre de mission non annoncé`);
    for (const s of m.steps) {
      // toute étape doit être suivie dans update(), sinon la mission se bloque
      assert.ok(suivies.has(s.type) || instantanees.has(s.type),
        `${m.id} : type d'étape « ${s.type} » jamais suivi — la mission resterait bloquée`);
      if (s.type === 'race') assert.ok(s.points.length >= 3);
      if (s.type === 'collect') assert.ok(s.points.length >= 2, `${m.id} : trop peu de points à ramasser`);
      if (s.type === 'goto' || s.type === 'deliver' || s.type === 'protect' || s.type === 'survive') {
        assert.ok(Number.isFinite(s.x) && Number.isFinite(s.z), `${m.id} : étape sans destination`);
      }
    }
  }
  // chaque personnage a au moins une mission
  for (const c of ['michael', 'franklin', 'trevor']) {
    assert.ok(MISSIONS.some((m) => m.char === c), `aucune mission pour ${c}`);
  }

  // et surtout : les missions ne doivent pas toutes se ressembler
  const genres = new Set(MISSIONS.map((m) => m.kind));
  assert.ok(genres.size >= 7, `il faut des genres variés (${[...genres].join(', ')})`);
  const types = new Set(MISSIONS.flatMap((m) => m.steps.map((s) => s.type)));
  assert.ok(types.size >= 10, `il faut des mécaniques variées (${types.size} types d'étapes)`);
  const sansPersonnage = MISSIONS.filter((m) => !m.char).length;
  assert.ok(sansPersonnage >= 3, 'plusieurs missions doivent être jouables avec n’importe qui');
});
