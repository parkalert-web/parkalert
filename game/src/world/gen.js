/**
 * Génération de Los Santos : plan de la ville, immeubles, quartiers, réseau
 * routier pour la circulation et la carte. Purement mathématique (aucun DOM,
 * aucun WebGL) pour rester testable en dehors du navigateur.
 *
 * Repère : X vers l'est, Z vers le sud, Y vers le haut. 1 unité = 1 mètre.
 */
import { rng, range, irange, pick, clamp } from '../engine/math.js';

export const STREET = 90;      // pas de la trame urbaine
export const ROAD_W = 17;      // largeur de chaussée
export const WALK_W = 4.5;     // largeur de trottoir
export const GRID = 6;         // indices de -6 à +6
export const CITY_MAX = GRID * STREET;      // 540
export const SHORE_X = -640;   // limite de la plage
export const OCEAN_X = -700;   // début de l'eau
export const WORLD = 1100;

export const ZONES = [
  { name: 'Vespucci Beach', x: -500, z: 120, r: 260 },
  { name: 'Del Perro', x: -470, z: -260, r: 220 },
  { name: 'Rockford Hills', x: -120, z: -420, r: 260 },
  { name: 'Vinewood Hills', x: 180, z: -520, r: 300 },
  { name: 'Downtown Los Santos', x: 160, z: -40, r: 300 },
  { name: 'Pillbox Hill', x: -40, z: 60, r: 200 },
  { name: 'Little Seoul', x: -300, z: 40, r: 200 },
  { name: 'Strawberry', x: -60, z: 330, r: 250 },
  { name: 'Davis', x: 220, z: 380, r: 240 },
  { name: 'La Mesa', x: 420, z: 160, r: 240 },
  { name: 'Mirror Park', x: 430, z: -300, r: 240 },
  { name: 'LS International', x: -260, z: 700, r: 340 },
  { name: 'Port of Los Santos', x: 520, z: 520, r: 240 },
];

/** Palettes façades par quartier. */
const PAL = {
  glass: ['#3f5f7a', '#2f4d63', '#4a7390', '#26506b', '#5a8099', '#1e3d52', '#6d93a8'],
  office: ['#b9b2a4', '#a89f92', '#cfc7b8', '#8d867a', '#d8d2c4', '#9aa39c'],
  house: ['#d8c9a8', '#e2d3b6', '#c9b391', '#efe0c4', '#d0bfa0', '#e8d9bd', '#c2ab88'],
  shop: ['#c86b4e', '#d99a5a', '#7c9b6f', '#b5533f', '#6f8fa8', '#d4c05a', '#a55f8a'],
  industrial: ['#8a8f92', '#767c80', '#9aa0a3', '#6e7477', '#a4a8a6'],
  mansion: ['#f0e6d2', '#e8dcc4', '#fbf2e0', '#ded1b6'],
};

const ROOF = '#5a5f63';

export function zoneAt(x, z) {
  let best = 'Los Santos', bd = 1e9;
  for (const zo of ZONES) {
    const d = Math.hypot(x - zo.x, z - zo.z) - zo.r * 0.35;
    if (d < bd) { bd = d; best = zo.name; }
  }
  return best;
}

/** Densité / hauteur d'un quartier : 0 pavillonnaire, 1 gratte-ciel. */
export function densityAt(x, z) {
  const dt = Math.max(0, 1 - Math.hypot(x - 150, z + 20) / 300);        // centre-ville
  const mid = Math.max(0, 1 - Math.hypot(x + 60, z - 60) / 420) * 0.55;  // Pillbox
  return clamp(Math.max(dt * 1.15, mid), 0, 1);
}

/** Le bloc est-il constructible ? (l'aéroport et le port ont leur propre plan) */
function specialBlock(gx, gz) {
  if (gx === -1 && gz === 1) return 'park';        // parc central
  if (gx === 4 && gz === -4) return 'park';
  if (gx === -5 && gz === -2) return 'park';
  if (gx === 2 && gz === 4) return 'stadium';
  if (gx === 0 && gz === -1) return 'hospital';
  if (gx === -2 && gz === 0) return 'police';
  if (gx === 1 && gz === 2) return 'garage';       // Los Santos Customs
  if (gx === -3 && gz === 2) return 'ammunation';
  if (gx === 3 && gz === 0) return 'maze';         // tour principale
  if (gx === -4 && gz === 3) return 'parking';
  if (gx === 5 && gz === -2) return 'parking';
  if (gx === -1 && gz === -3) return 'construction';
  return null;
}

/**
 * Construit toute la description du monde.
 * @param {number} seed graine déterministe
 */
export function generateWorld(seed = 20130917) {
  const rand = rng(seed);
  const roads = [];
  const buildings = [];
  const props = [];
  const colliders = [];
  const blocks = [];
  const landmarks = [];
  const nodes = [];
  const nodeIndex = new Map();

  /* --------------------------------------------------------- trame routière */
  const key = (gx, gz) => `${gx},${gz}`;
  for (let gz = -GRID; gz <= GRID; gz++) {
    for (let gx = -GRID; gx <= GRID; gx++) {
      const i = nodes.length;
      nodes.push({ x: gx * STREET, z: gz * STREET, gx, gz, links: [] });
      nodeIndex.set(key(gx, gz), i);
    }
  }
  const link = (a, b) => {
    if (a < 0 || b < 0) return;
    if (!nodes[a].links.includes(b)) nodes[a].links.push(b);
    if (!nodes[b].links.includes(a)) nodes[b].links.push(a);
  };
  for (let gz = -GRID; gz <= GRID; gz++) {
    for (let gx = -GRID; gx <= GRID; gx++) {
      const i = nodeIndex.get(key(gx, gz));
      if (gx < GRID) link(i, nodeIndex.get(key(gx + 1, gz)));
      if (gz < GRID) link(i, nodeIndex.get(key(gx, gz + 1)));
    }
  }

  // Les boulevards (tous les 3 axes) sont plus larges et plantés de palmiers.
  const isBoulevard = (g) => g % 3 === 0;
  for (let g = -GRID; g <= GRID; g++) {
    const w = isBoulevard(g) ? ROAD_W + 9 : ROAD_W;
    roads.push({ x: 0, z: g * STREET, w: CITY_MAX * 2 + ROAD_W, d: w, horiz: true, boulevard: isBoulevard(g), g });
    roads.push({ x: g * STREET, z: 0, w, d: CITY_MAX * 2 + ROAD_W, horiz: false, boulevard: isBoulevard(g), g });
  }

  // Route côtière et accès à la plage
  roads.push({ x: SHORE_X + 40, z: 0, w: 14, d: CITY_MAX * 2 + 260, horiz: false, coast: true });
  roads.push({ x: (SHORE_X + 40 - CITY_MAX) / 2 - 40, z: -180, w: CITY_MAX - SHORE_X - 20, d: 14, horiz: true, coast: true });
  roads.push({ x: (SHORE_X + 40 - CITY_MAX) / 2 - 40, z: 180, w: CITY_MAX - SHORE_X - 20, d: 14, horiz: true, coast: true });

  const coastNodes = [];
  for (let gz = -GRID - 1; gz <= GRID + 1; gz++) {
    const i = nodes.length;
    nodes.push({ x: SHORE_X + 40, z: gz * STREET, gx: -99, gz, links: [] });
    coastNodes.push(i);
  }
  for (let k = 0; k < coastNodes.length - 1; k++) link(coastNodes[k], coastNodes[k + 1]);
  for (let gz = -GRID; gz <= GRID; gz += 2) {
    const i = coastNodes[gz + GRID + 1];
    const j = nodeIndex.get(key(-GRID, gz));
    if (i !== undefined && j !== undefined) {
      link(i, j);
      roads.push({ x: (SHORE_X + 40 - CITY_MAX) / 2, z: gz * STREET, w: CITY_MAX + SHORE_X * -1 - 100, d: 13, horiz: true, link: true });
    }
  }

  /* ------------------------------------------------------------------ blocs */
  const half = (STREET - ROAD_W) / 2 - WALK_W;   // demi-côté constructible
  for (let gz = -GRID; gz < GRID; gz++) {
    for (let gx = -GRID; gx < GRID; gx++) {
      const cx = gx * STREET + STREET / 2;
      const cz = gz * STREET + STREET / 2;
      const kind = specialBlock(gx, gz);
      const dens = densityAt(cx, cz);
      const block = { x: cx, z: cz, half, kind, dens, gx, gz };
      blocks.push(block);
      fillBlock(block, rand, buildings, props, colliders, landmarks);
    }
  }

  /* ------------------------------------------------------- décor hors trame */
  const beach = { x0: OCEAN_X, x1: SHORE_X + 30, z0: -CITY_MAX - 120, z1: CITY_MAX + 120 };
  const pier = { x: SHORE_X - 95, z: -190, len: 240, w: 26 };
  landmarks.push({ kind: 'pier', ...pier });

  // Palmiers et parasols sur la plage
  for (let i = 0; i < 260; i++) {
    const x = range(rand, OCEAN_X + 30, SHORE_X + 26);
    const z = range(rand, -CITY_MAX - 100, CITY_MAX + 100);
    if (Math.abs(z - pier.z) < 22 && x < SHORE_X) continue;
    props.push({ kind: rand() < 0.72 ? 'palm' : 'parasol', x, z, r: rand() * 6.28, s: range(rand, 0.8, 1.35) });
  }

  // Montagnes du nord (fond de décor) + panneau Vinewood
  const mountains = [];
  for (let i = 0; i < 26; i++) {
    const x = -900 + i * 74 + range(rand, -30, 30);
    const z = -820 - range(rand, 0, 190);
    mountains.push({ x, z, r: range(rand, 130, 240), h: range(rand, 110, 290) });
  }
  mountains.push({ x: 60, z: -830, r: 300, h: 330 });
  landmarks.push({ kind: 'vinewood-sign', x: -60, z: -742, y: 96 });

  // Aéroport (sud-ouest)
  const airport = { x: -230, z: 720, w: 700, d: 300 };
  landmarks.push({ kind: 'airport', ...airport });
  colliders.push({ x: airport.x - 250, z: airport.z - 100, hw: 46, hd: 26, h: 24, kind: 'building' });

  // Port (sud-est) : grues et conteneurs
  const port = { x: 560, z: 560, w: 300, d: 300 };
  landmarks.push({ kind: 'port', ...port });
  for (let i = 0; i < 90; i++) {
    const x = port.x + range(rand, -130, 130);
    const z = port.z + range(rand, -130, 130);
    props.push({ kind: 'container', x, z, r: (rand() < 0.5 ? 0 : Math.PI / 2), s: 1, h: irange(rand, 1, 3), c: pick(rand, ['#b4462f', '#2f6fb4', '#3f9a5c', '#c9a13a', '#8a8f92']) });
    colliders.push({ x, z, hw: 6.2, hd: 2.6, h: 2.7, kind: 'prop' });
  }

  /* ------------------------------------------------- lampadaires et feux */
  for (let g = -GRID; g <= GRID; g++) {
    for (let t = -GRID * STREET; t <= GRID * STREET; t += 45) {
      if (Math.abs(t % STREET) < 20) continue;
      const off = ROAD_W / 2 + 2.6 + (isBoulevard(g) ? 4.5 : 0);
      props.push({ kind: 'lamp', x: t, z: g * STREET + off, r: Math.PI });
      props.push({ kind: 'lamp', x: g * STREET - off, z: t, r: -Math.PI / 2 });
    }
  }
  for (let gz = -GRID; gz <= GRID; gz++) {
    for (let gx = -GRID; gx <= GRID; gx++) {
      const o = ROAD_W / 2 + 2.4;
      props.push({ kind: 'trafficlight', x: gx * STREET - o, z: gz * STREET - o, r: 0 });
      props.push({ kind: 'trafficlight', x: gx * STREET + o, z: gz * STREET + o, r: Math.PI });
    }
  }

  /* ------------------------------------------- points d'intérêt du gameplay */
  const findLandmark = (k) => landmarks.find((l) => l.kind === k) || { x: 0, z: 0 };
  const spots = {
    hospital: findLandmark('hospital'),
    police: findLandmark('police'),
    garage: findLandmark('garage'),
    ammunation: findLandmark('ammunation'),
    stadium: findLandmark('stadium'),
  };

  return {
    seed, roads, buildings, props, colliders, blocks, landmarks, mountains,
    beach, pier, airport, port, spots,
    graph: { nodes },
    bounds: { min: -WORLD, max: WORLD },
  };
}

/* ------------------------------------------------------------------ blocs */

function addBuilding(list, colliders, b) {
  list.push(b);
  colliders.push({ x: b.x, z: b.z, hw: b.w / 2, hd: b.d / 2, h: b.h, kind: 'building' });
}

function fillBlock(block, rand, buildings, props, colliders, landmarks) {
  const { x, z, half, kind, dens } = block;
  const S = half * 2;

  if (kind === 'park') {
    block.ground = 'grass';
    for (let i = 0; i < 26; i++) {
      props.push({
        kind: rand() < 0.75 ? 'tree' : 'palm',
        x: x + range(rand, -half + 3, half - 3),
        z: z + range(rand, -half + 3, half - 3),
        r: rand() * 6.28, s: range(rand, 0.85, 1.4),
      });
    }
    for (let i = 0; i < 6; i++) {
      props.push({ kind: 'bench', x: x + range(rand, -half, half), z: z + range(rand, -half, half), r: rand() * 6.28 });
    }
    props.push({ kind: 'fountain', x, z, r: 0 });
    colliders.push({ x, z, hw: 5, hd: 5, h: 1.6, kind: 'prop' });
    return;
  }

  if (kind === 'stadium') {
    block.ground = 'concrete';
    landmarks.push({ kind: 'stadium', x, z, r: half - 2 });
    colliders.push({ x, z, hw: half - 3, hd: half - 3, h: 30, kind: 'building' });
    return;
  }

  if (kind === 'parking') {
    block.ground = 'asphalt';
    block.parking = true;
    for (let i = 0; i < 4; i++) {
      props.push({ kind: 'lamp', x: x - half + 8 + i * (S / 4), z, r: 0 });
    }
    return;
  }

  if (kind === 'construction') {
    block.ground = 'dirt';
    landmarks.push({ kind: 'crane', x: x + 10, z: z - 8 });
    addBuilding(buildings, colliders, {
      x, z, w: S * 0.6, d: S * 0.6, h: 34, kind: 'skeleton', color: '#8d8579', floors: 10,
    });
    for (let i = 0; i < 8; i++) {
      props.push({ kind: 'container', x: x + range(rand, -half, half), z: z + range(rand, -half, half), r: rand() * 6.28, h: 1, c: '#c9a13a' });
    }
    return;
  }

  if (kind === 'hospital' || kind === 'police' || kind === 'garage' || kind === 'ammunation' || kind === 'maze') {
    block.ground = 'concrete';
    const meta = {
      hospital: { h: 38, color: '#e8ece9', label: 'CENTRAL LS MEDICAL', accent: '#d7443b' },
      police: { h: 26, color: '#b9bec4', label: 'LSPD', accent: '#2a4d8f' },
      garage: { h: 12, color: '#d9d2c4', label: 'LS CUSTOMS', accent: '#e0a33a' },
      ammunation: { h: 14, color: '#7d6b57', label: 'AMMU-NATION', accent: '#c0392b' },
      maze: { h: 205, color: '#2f4d63', label: '', accent: '#8fd0e8' },
    }[kind];
    const w = kind === 'maze' ? S * 0.62 : S * 0.78;
    addBuilding(buildings, colliders, {
      x, z, w, d: w, h: meta.h, kind: kind === 'maze' ? 'tower' : 'civic',
      color: meta.color, accent: meta.accent, label: meta.label, floors: Math.floor(meta.h / 3.6),
      landmark: kind,
    });
    landmarks.push({ kind, x, z, w, h: meta.h });
    return;
  }

  /* --------- îlot ordinaire : on découpe le bloc en 2x2 à 4x4 parcelles --- */
  block.ground = 'pavement';
  const n = dens > 0.65 ? irange(rand, 1, 2) : dens > 0.3 ? irange(rand, 2, 3) : irange(rand, 2, 4);
  const cell = S / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const px = x - half + cell * (i + 0.5);
      const pz = z - half + cell * (j + 0.5);
      const margin = dens > 0.5 ? 1.5 : range(rand, 2.5, 6);
      const w = cell - margin * 2;
      const d = cell - margin * 2;
      if (w < 6) continue;
      if (dens < 0.28 && rand() < 0.12) {            // terrain vague / jardin
        for (let t = 0; t < 3; t++) {
          props.push({ kind: 'tree', x: px + range(rand, -w / 3, w / 3), z: pz + range(rand, -d / 3, d / 3), r: rand() * 6.28, s: range(rand, 0.9, 1.3) });
        }
        continue;
      }
      const roll = rand();
      let h, bkind, palette;
      if (dens > 0.62) {
        h = range(rand, 55, 165) * (0.75 + dens * 0.5);
        bkind = 'tower';
        palette = roll < 0.65 ? PAL.glass : PAL.office;
      } else if (dens > 0.3) {
        h = range(rand, 16, 46);
        bkind = 'midrise';
        palette = roll < 0.4 ? PAL.office : PAL.shop;
      } else if (Math.abs(pz) > 400 && rand() < 0.35) {
        h = range(rand, 9, 15);
        bkind = 'warehouse';
        palette = PAL.industrial;
      } else if (pz < -380 && rand() < 0.55) {
        h = range(rand, 7, 12);
        bkind = 'mansion';
        palette = PAL.mansion;
      } else {
        h = range(rand, 5.5, 11);
        bkind = 'house';
        palette = PAL.house;
      }
      const b = {
        x: px, z: pz, w, d, h, kind: bkind,
        color: pick(rand, palette),
        accent: pick(rand, PAL.shop),
        roof: ROOF,
        floors: Math.max(1, Math.round(h / (bkind === 'house' || bkind === 'mansion' ? 3.1 : 3.7))),
        seed: Math.floor(rand() * 65535),
        shop: bkind !== 'tower' && rand() < 0.5,
        ac: rand() < 0.6,
        antenna: bkind === 'tower' && rand() < 0.4,
      };
      addBuilding(buildings, colliders, b);
      if (bkind === 'mansion' && rand() < 0.7) {
        props.push({ kind: 'pool', x: px + range(rand, -w / 2, w / 2) * 0.4, z: pz + d / 2 + 4, r: 0, s: 1 });
      }
      if ((bkind === 'house' || bkind === 'mansion') && rand() < 0.8) {
        props.push({ kind: 'tree', x: px + w / 2 + range(rand, 1, 3), z: pz + range(rand, -d / 2, d / 2), r: rand() * 6.28, s: range(rand, 0.9, 1.4) });
      }
      if (bkind === 'tower' && rand() < 0.35) {
        props.push({ kind: 'billboard', x: px, z: pz - d / 2 - 0.4, r: 0, y: h * 0.8, c: pick(rand, ['#d94f4f', '#4f7fd9', '#43a05c', '#d9a13a', '#a04fd9']) });
      }
    }
  }

  // mobilier de trottoir
  const edge = half + 2.2;
  for (let i = 0; i < 5; i++) {
    const t = range(rand, -half, half);
    const side = Math.floor(rand() * 4);
    const px = side === 0 ? x + t : side === 1 ? x + t : x - edge;
    const pz = side === 0 ? z - edge : side === 1 ? z + edge : z + t;
    const fx = side === 3 ? x + edge : px;
    props.push({ kind: pick(rand, ['hydrant', 'trash', 'bench', 'busstop', 'trash']), x: fx, z: pz, r: rand() * 6.28 });
  }
}

/**
 * Point le plus proche du réseau routier (pour réapparition et IA).
 */
export function nearestNode(graph, x, z) {
  let best = 0, bd = 1e18;
  for (let i = 0; i < graph.nodes.length; i++) {
    const n = graph.nodes[i];
    const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
