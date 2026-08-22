/**
 * Transforme la description du monde en géométrie 3D, découpée en tuiles
 * pour le tri par frustum. Aucune dépendance WebGL ici : on ne produit que
 * des objets Geo, que le moteur téléversera.
 */
import { Geo } from '../engine/gl.js';
import { color, shade, rng, range, irange, pick, clamp, lerp } from '../engine/math.js';
import { STREET, ROAD_W, WALK_W, GRID, CITY_MAX, SHORE_X, OCEAN_X } from './gen.js';

const CHUNK = 180;

const C = {
  asphalt: color('#484c52'),
  asphaltDark: color('#3f4348'),
  lineWhite: color('#d8d6cc'),
  lineYellow: color('#c9a83c'),
  walk: color('#b0aca4'),
  median: color('#6f7c5a'),
  walkEdge: color('#87847e'),
  curb: color('#c6c2b8'),
  pavement: color('#a09c94'),
  grass: color('#5d7a41'),
  grassDark: color('#4c6836'),
  sand: color('#d6c396'),
  dirt: color('#8a7355'),
  roof: color('#4e5257'),
  glassDark: color('#1d2a33'),
  window: color('#ffe9b0'),
  metal: color('#8f959a'),
  wood: color('#6b4c30'),
  trunk: color('#5a4128'),
  leaf: color('#3f6b33'),
  palmLeaf: color('#4f7d3a'),
  poolWater: color('#3f9fd0'),
  concrete: color('#a9a49b'),
  red: color('#b53a2f'),
  white: color('#e8e6e0'),
};

class Chunks {
  constructor() { this.map = new Map(); }
  at(x, z) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const k = cx * 1000 + cz;
    let g = this.map.get(k);
    if (!g) { g = new Geo(); this.map.set(k, g); }
    return g;
  }
  list() { return [...this.map.values()].map((geo) => ({ geo })); }
}

/* -------------------------------------------------------------------- sol */

function buildGround(ch, world) {
  // Grande dalle de base : béton urbain, herbe au nord, sable à l'ouest
  const step = CHUNK;
  for (let x = -1100; x < 1100; x += step) {
    for (let z = -1100; z < 1100; z += step) {
      const cx = x + step / 2, cz = z + step / 2;
      if (cx < OCEAN_X) continue;                       // c'est l'océan
      let col = C.pavement;
      if (cx < SHORE_X + 30) col = C.sand;
      else if (Math.abs(cx) > CITY_MAX + 40 || Math.abs(cz) > CITY_MAX + 40) col = C.grassDark;
      const g = ch.at(cx, cz);
      g.slab(cx, cz, step + 0.5, step + 0.5, 0, col);
    }
  }
  // Transition sable / ville
  for (let z = -1100; z < 1100; z += 40) {
    ch.at(SHORE_X + 20, z + 20).slab(SHORE_X + 20, z + 20, 90, 41, 0.04, C.sand);
  }
}

function roadMarkings(g, r) {
  const y = 0.19;
  if (r.horiz) {
    const x0 = r.x - r.w / 2, x1 = r.x + r.w / 2;
    if (r.boulevard) {
      // terre-plein central planté
      for (let x = x0; x < x1; x += 24) {
        const seg = Math.min(18, x1 - x);
        g.slab(x + seg / 2, r.z, seg, 3.6, 0.2, C.median);
      }
    } else {
      for (let x = x0; x < x1; x += 8) g.slab(x + 2, r.z, 4, 0.32, y, C.lineYellow);
    }
    const off = r.d / 2 - 4.4;
    for (const s of [-1, 1]) {
      for (let x = x0; x < x1; x += 10) g.slab(x + 3, r.z + s * off, 5, 0.22, y, C.lineWhite);
    }
    for (let x = x0; x < x1; x += 2.4) {                 // bordure extérieure
      g.slab(x, r.z - r.d / 2 + 0.5, 2.4, 0.2, y, C.lineWhite);
      g.slab(x, r.z + r.d / 2 - 0.5, 2.4, 0.2, y, C.lineWhite);
    }
  } else {
    const z0 = r.z - r.d / 2, z1 = r.z + r.d / 2;
    if (r.boulevard) {
      for (let z = z0; z < z1; z += 24) {
        const seg = Math.min(18, z1 - z);
        g.slab(r.x, z + seg / 2, 3.6, seg, 0.2, C.median);
      }
    } else {
      for (let z = z0; z < z1; z += 8) g.slab(r.x, z + 2, 0.32, 4, y, C.lineYellow);
    }
    const off = r.w / 2 - 4.4;
    for (const s of [-1, 1]) {
      for (let z = z0; z < z1; z += 10) g.slab(r.x + s * off, z + 3, 0.22, 5, y, C.lineWhite);
    }
    for (let z = z0; z < z1; z += 2.4) {
      g.slab(r.x - r.w / 2 + 0.5, z, 0.2, 2.4, y, C.lineWhite);
      g.slab(r.x + r.w / 2 - 0.5, z, 0.2, 2.4, y, C.lineWhite);
    }
  }
}

function buildRoads(ch, world) {
  // Les rues est-ouest sont continues ; les rues nord-sud sont découpées entre
  // les carrefours, ce qui évite tout recouvrement de dalles (z-fighting).
  for (const r of world.roads) {
    if (r.horiz) {
      const x0 = r.x - r.w / 2;
      for (let x = x0; x < r.x + r.w / 2; x += 60) {
        const seg = Math.min(60, r.x + r.w / 2 - x);
        ch.at(x + seg / 2, r.z).slab(x + seg / 2, r.z, seg + 0.05, r.d, 0.14, C.asphalt);
      }
    } else {
      const z0 = r.z - r.d / 2;
      for (let z = z0; z < r.z + r.d / 2; z += 60) {
        const seg = Math.min(60, r.z + r.d / 2 - z);
        const cz = z + seg / 2;
        ch.at(r.x, cz).slab(r.x, cz, r.w, seg + 0.05, 0.12, C.asphalt);
      }
    }
  }
  for (const r of world.roads) {
    // marquages : découpés eux aussi par tuile
    if (r.horiz) {
      for (let x = r.x - r.w / 2; x < r.x + r.w / 2; x += CHUNK) {
        const seg = Math.min(CHUNK, r.x + r.w / 2 - x);
        roadMarkings(ch.at(x + seg / 2, r.z), { ...r, x: x + seg / 2, w: seg });
      }
    } else {
      for (let z = r.z - r.d / 2; z < r.z + r.d / 2; z += CHUNK) {
        const seg = Math.min(CHUNK, r.z + r.d / 2 - z);
        roadMarkings(ch.at(r.x, z + seg / 2), { ...r, z: z + seg / 2, d: seg });
      }
    }
  }
  // passages piétons aux carrefours
  for (let gz = -GRID; gz <= GRID; gz++) {
    for (let gx = -GRID; gx <= GRID; gx++) {
      const x = gx * STREET, z = gz * STREET;
      const g = ch.at(x, z);
      const o = ROAD_W / 2 + 1.6;
      for (let i = -3; i <= 3; i++) {
        g.slab(x + i * 2.2, z - o, 1.1, 4.4, 0.2, C.lineWhite);
        g.slab(x + i * 2.2, z + o, 1.1, 4.4, 0.2, C.lineWhite);
        g.slab(x - o, z + i * 2.2, 4.4, 1.1, 0.2, C.lineWhite);
        g.slab(x + o, z + i * 2.2, 4.4, 1.1, 0.2, C.lineWhite);
      }
    }
  }
}

function buildSidewalks(ch, world) {
  const H = 0.30;
  for (const b of world.blocks) {
    const s = b.half + WALK_W;
    const g = ch.at(b.x, b.z);
    // quatre bandes de trottoir autour du bloc
    g.box(b.x, H / 2, b.z - s + WALK_W / 2, s * 2, H, WALK_W, C.walk, 0, { top: C.walk, side: C.curb, noBottom: true });
    g.box(b.x, H / 2, b.z + s - WALK_W / 2, s * 2, H, WALK_W, C.walk, 0, { top: C.walk, side: C.curb, noBottom: true });
    g.box(b.x - s + WALK_W / 2, H / 2, b.z, WALK_W, H, s * 2 - WALK_W * 2, C.walk, 0, { top: C.walk, side: C.curb, noBottom: true });
    g.box(b.x + s - WALK_W / 2, H / 2, b.z, WALK_W, H, s * 2 - WALK_W * 2, C.walk, 0, { top: C.walk, side: C.curb, noBottom: true });
    // sol intérieur du bloc
    const col = b.ground === 'grass' ? C.grass : b.ground === 'asphalt' ? C.asphaltDark
      : b.ground === 'dirt' ? C.dirt : b.ground === 'concrete' ? C.concrete : C.pavement;
    g.slab(b.x, b.z, b.half * 2, b.half * 2, 0.3, col);
    if (b.parking) {
      for (let i = -3; i <= 3; i++) {
        for (const s2 of [-1, 1]) {
          g.slab(b.x + i * 6, b.z + s2 * 14, 0.25, 11, 0.33, C.lineWhite);
        }
      }
    }
  }
}

/* --------------------------------------------------------------- immeubles */

/**
 * Façade : un bandeau vitré par étage, recoupé par des meneaux verticaux de la
 * couleur du bâtiment. Beaucoup moins de géométrie qu'une fenêtre par case,
 * pour un quadrillage identique de loin — et des étages allumés la nuit.
 */
function windowBands(g, b, base) {
  const rand = rng(b.seed || 1234);
  const floors = clamp(Math.round(b.floors), 1, 60);
  const fh = b.h / floors;
  if (fh < 1.6) return;
  const bandH = Math.min(fh * 0.5, 1.9);
  const inset = 0.13;
  const litFloor = [];
  // valeur négative : la vitre reste sombre le jour et s'allume la nuit
  for (let f = 0; f < floors; f++) litFloor.push(rand() < 0.36 ? -range(rand, 0.35, 0.8) : -0.02);

  for (const [ax, az] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const w = ax === 0 ? b.w : b.d;                 // largeur de cette façade
    const depth = ax === 0 ? b.d : b.w;
    const fx = b.x + ax * (depth / 2 + inset);
    const fz = b.z + az * (depth / 2 + inset);
    for (let f = 0; f < floors; f++) {
      const y = fh * (f + 0.55);
      if (y + bandH / 2 > b.h - 0.3) continue;
      g.box(ax === 0 ? b.x : fx, y, az === 0 ? b.z : fz,
        ax === 0 ? w * 0.94 : 0.16, bandH, az === 0 ? w * 0.94 : 0.16,
        C.glassDark, 0, { emit: litFloor[f], top: C.glassDark });
    }
    // meneaux : ils découpent les bandeaux en fenêtres
    const n = clamp(Math.round(w / 4.2), 1, 16);
    const mx = b.x + ax * (depth / 2 + inset + 0.06);
    const mz = b.z + az * (depth / 2 + inset + 0.06);
    for (let i = 1; i < n; i++) {
      const t = i / n - 0.5;
      g.box(ax === 0 ? b.x + t * w : mx, b.h / 2, az === 0 ? b.z + t * w : mz,
        ax === 0 ? 0.55 : 0.2, b.h, az === 0 ? 0.55 : 0.2, shade(base, 0.9));
    }
    // allège continue au pied de l'immeuble
    g.box(ax === 0 ? b.x : fx, fh * 0.14, az === 0 ? b.z : fz,
      ax === 0 ? w * 0.96 : 0.22, fh * 0.28, az === 0 ? w * 0.96 : 0.22, shade(base, 0.82));
  }
}

function buildBuilding(g, b) {
  const base = color(b.color);
  const rand = rng((b.seed || 7) + 91);
  const roofCol = shade(base, 0.62);

  if (b.kind === 'tower') {
    // volumes empilés avec retraits
    let y = 0, w = b.w, d = b.d;
    const tiers = b.h > 110 ? 3 : b.h > 60 ? 2 : 1;
    for (let t = 0; t < tiers; t++) {
      const th = t === tiers - 1 ? b.h - y : b.h * (t === 0 ? 0.55 : 0.28);
      g.box(b.x, y + th / 2, b.z, w, th, d, base, 0, { top: roofCol, side: base });
      const tier = new Geo();
      windowBands(tier, { x: b.x, z: b.z, w, d, h: th, floors: Math.max(1, Math.round(th / 3.7)), seed: (b.seed || 3) + t * 13 }, base);
      g.merge(tier, 0, y, 0);
      // corniche
      g.box(b.x, y + th + 0.35, b.z, w + 1.1, 0.7, d + 1.1, shade(base, 0.8));
      y += th;
      w *= 0.78; d *= 0.78;
    }
    // toit technique
    g.box(b.x + w * 0.1, y + 1.6, b.z, w * 0.4, 3.2, d * 0.4, C.metal);
    if (b.antenna) {
      g.cyl(b.x, y + 3, b.z, 0.35, 22, C.metal, 6);
      g.box(b.x, y + 26, b.z, 0.9, 0.9, 0.9, [1, 0.15, 0.12], 0, { emit: 1, emitTop: 1 });
    }
  } else if (b.kind === 'civic') {
    g.box(b.x, b.h / 2, b.z, b.w, b.h, b.d, base, 0, { top: roofCol });
    windowBands(g, b, base);
    // enseigne
    const ac = color(b.accent || '#c0392b');
    g.box(b.x, b.h + 1.4, b.z - b.d / 2 - 0.1, b.w * 0.8, 2.6, 0.5, ac, 0, { emit: 0.9, emitTop: 0.9 });
    g.box(b.x, 2.4, b.z - b.d / 2 - 0.35, b.w * 0.55, 4.6, 0.5, shade(base, 0.75));
    g.box(b.x, 1.4, b.z - b.d / 2 - 0.6, b.w * 0.3, 2.8, 0.3, C.glassDark, 0, { emit: 0.4 });
  } else if (b.kind === 'midrise' || b.kind === 'warehouse') {
    g.box(b.x, b.h / 2, b.z, b.w, b.h, b.d, base, 0, { top: roofCol });
    if (b.kind === 'midrise') windowBands(g, b, base);
    else {
      for (let i = 0; i < 4; i++) {
        g.box(b.x - b.w / 2 + 2 + i * (b.w / 4), b.h * 0.6, b.z - b.d / 2 - 0.1, b.w / 7, b.h * 0.3, 0.3, C.glassDark, 0, { emit: 0.25 });
      }
      g.box(b.x, b.h + 0.5, b.z, b.w + 0.8, 1, b.d + 0.8, shade(base, 0.7));
    }
    if (b.shop) {   // devanture au rez-de-chaussée
      const ac = color(b.accent);
      g.box(b.x, 1.8, b.z - b.d / 2 - 0.22, b.w * 0.92, 3.6, 0.44, C.glassDark, 0, { emit: 0.55 });
      g.box(b.x, 4.1, b.z - b.d / 2 - 0.5, b.w * 0.92, 1.1, 1.0, ac, 0, { emit: 0.5, emitTop: 0.2 });
    }
    if (b.ac) {
      for (let i = 0; i < 3; i++) {
        g.box(b.x + range(rand, -b.w / 3, b.w / 3), b.h + 0.7, b.z + range(rand, -b.d / 3, b.d / 3), 2.2, 1.4, 2.2, C.metal);
      }
    }
  } else if (b.kind === 'house' || b.kind === 'mansion') {
    const wallH = b.h * 0.78;
    g.box(b.x, wallH / 2, b.z, b.w, wallH, b.d, base, 0, { top: shade(base, 0.9) });
    g.roof(b.x, wallH, b.z, b.w + 1.2, b.h - wallH + 1.2, b.d + 1.2, color(b.roof || '#7a4b39'));
    // porte + fenêtres
    g.box(b.x, 1.05, b.z - b.d / 2 - 0.12, 1.1, 2.1, 0.25, C.wood);
    for (const s of [-1, 1]) {
      g.box(b.x + s * b.w * 0.28, 1.7, b.z - b.d / 2 - 0.1, b.w * 0.22, 1.3, 0.2, C.glassDark, 0, { emit: 0.5 });
      g.box(b.x + s * (b.w / 2 + 0.1), 1.7, b.z, 0.2, 1.3, b.d * 0.3, C.glassDark, 0, { emit: 0.35 });
    }
    if (b.kind === 'mansion') {
      for (const s of [-1, 1]) g.cyl(b.x + s * b.w * 0.34, 0, b.z - b.d / 2 - 0.6, 0.28, wallH * 0.95, C.white, 8);
      g.box(b.x, wallH * 0.98, b.z - b.d / 2 - 0.6, b.w * 0.8, 0.4, 1.6, C.white);
    }
  } else if (b.kind === 'skeleton') {
    const floors = b.floors;
    const fh = b.h / floors;
    for (let f = 0; f <= floors; f++) {
      g.box(b.x, f * fh, b.z, b.w, 0.4, b.d, C.concrete);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      g.box(b.x + sx * (b.w / 2 - 0.5), b.h / 2, b.z + sz * (b.d / 2 - 0.5), 0.9, b.h, 0.9, C.concrete);
    }
  }
}

/* ------------------------------------------------------------ accessoires */

function buildProp(g, p) {
  const s = p.s || 1;
  switch (p.kind) {
    case 'palm': {
      const h = 7.5 * s;
      g.cyl(p.x, 0, p.z, 0.28 * s, h, C.trunk, 6, 0.2 * s);
      for (let i = 0; i < 7; i++) {
        const a = p.r + (i / 7) * Math.PI * 2;
        const dx = Math.cos(a), dz = Math.sin(a);
        g.box(p.x + dx * 1.9 * s, h + 0.2 - Math.abs(i % 2) * 0.25, p.z + dz * 1.9 * s,
          4.2 * s, 0.16, 1.0 * s, C.palmLeaf, -a, { top: C.palmLeaf });
      }
      g.sphere(p.x, h + 0.1, p.z, 0.5 * s, C.palmLeaf, 6, 4);
      break;
    }
    case 'tree': {
      const h = 4.2 * s;
      g.cyl(p.x, 0, p.z, 0.32 * s, h, C.trunk, 6);
      g.sphere(p.x, h + 1.4 * s, p.z, 2.3 * s, C.leaf, 7, 5);
      g.sphere(p.x + 0.9 * s, h + 0.5 * s, p.z + 0.6 * s, 1.6 * s, shade(C.leaf, 0.85), 6, 4);
      break;
    }
    case 'lamp': {
      g.cyl(p.x, 0, p.z, 0.14, 7.2, C.metal, 6);
      const dx = Math.cos(p.r) * 1.7, dz = Math.sin(p.r) * 1.7;
      g.box(p.x + dx / 2, 7.2, p.z + dz / 2, 1.9, 0.16, 0.16, C.metal, -p.r);
      g.box(p.x + dx, 7.0, p.z + dz, 1.0, 0.3, 0.5, [1, 0.93, 0.72], -p.r, { emit: 1, emitTop: 0.2, bottom: [1, 0.95, 0.8] });
      break;
    }
    case 'trafficlight': {
      g.cyl(p.x, 0, p.z, 0.12, 4.4, C.metal, 5);
      g.box(p.x, 4.9, p.z, 0.45, 1.3, 0.45, [0.15, 0.15, 0.16]);
      g.box(p.x, 5.3, p.z - 0.24, 0.2, 0.2, 0.1, [1, 0.2, 0.15], 0, { emit: 1 });
      g.box(p.x, 4.9, p.z - 0.24, 0.2, 0.2, 0.1, [0.9, 0.7, 0.1], 0, { emit: 0.25 });
      g.box(p.x, 4.5, p.z - 0.24, 0.2, 0.2, 0.1, [0.2, 0.9, 0.3], 0, { emit: 0.25 });
      break;
    }
    case 'bench':
      g.box(p.x, 0.45, p.z, 1.8, 0.12, 0.55, C.wood, p.r);
      g.box(p.x - Math.sin(p.r) * 0.25, 0.75, p.z - Math.cos(p.r) * 0.25, 1.8, 0.5, 0.1, C.wood, p.r);
      break;
    case 'hydrant':
      g.cyl(p.x, 0, p.z, 0.18, 0.8, C.red, 6);
      g.sphere(p.x, 0.85, p.z, 0.2, C.red, 6, 4);
      break;
    case 'trash':
      g.cyl(p.x, 0, p.z, 0.35, 1.0, shade(C.metal, 0.7), 8);
      break;
    case 'busstop':
      g.box(p.x, 1.4, p.z, 3.4, 0.14, 1.5, C.metal, p.r);
      for (const s2 of [-1, 1]) g.cyl(p.x + Math.cos(p.r) * s2 * 1.5, 0, p.z - Math.sin(p.r) * s2 * 1.5, 0.08, 2.8, C.metal, 5);
      g.box(p.x + Math.sin(p.r) * 0.7, 1.2, p.z + Math.cos(p.r) * 0.7, 3.2, 2.2, 0.1, [0.6, 0.75, 0.8], p.r, { emit: 0.15 });
      break;
    case 'billboard': {
      const c = color(p.c || '#d94f4f');
      g.cyl(p.x - 3, 0, p.z, 0.2, p.y, C.metal, 5);
      g.cyl(p.x + 3, 0, p.z, 0.2, p.y, C.metal, 5);
      g.box(p.x, p.y + 2.6, p.z, 9, 5, 0.4, c, p.r, { emit: 0.75, top: shade(c, 0.6) });
      break;
    }
    case 'container': {
      const c = color(p.c || '#b4462f');
      for (let i = 0; i < (p.h || 1); i++) {
        g.box(p.x, 1.35 + i * 2.65, p.z, 12.2, 2.6, 2.44, c, p.r, { top: shade(c, 0.8) });
      }
      break;
    }
    case 'pool':
      g.box(p.x, 0.1, p.z, 8, 0.2, 5, C.concrete);
      g.slab(p.x, p.z, 7, 4, 0.22, C.poolWater);
      break;
    case 'fountain':
      g.cyl(p.x, 0, p.z, 5, 0.8, C.concrete, 12);
      g.slab(p.x, p.z, 8.6, 8.6, 0.85, C.poolWater);
      g.cyl(p.x, 0.8, p.z, 0.8, 2.4, C.concrete, 8, 0.4);
      break;
    case 'bush':
      g.sphere(p.x, 0.35 * s, p.z, 0.9 * s, shade(C.leaf, 0.85), 6, 4);
      g.sphere(p.x + 0.7 * s, 0.25 * s, p.z + 0.4 * s, 0.6 * s, shade(C.leaf, 0.7), 5, 3);
      break;
    case 'rock': {
      const c = [0.42, 0.4, 0.37];
      g.cone(p.x, -0.4 * s, p.z, 1.5 * s, 2.1 * s, c, 5);
      g.sphere(p.x + 0.8 * s, 0.2 * s, p.z - 0.5 * s, 0.7 * s, shade(c, 0.85), 5, 3);
      break;
    }
    case 'windmill': {
      const h = 34 * s;
      g.cyl(p.x, 0, p.z, 1.1, h, [0.88, 0.88, 0.86], 8, 0.6);
      const dx = Math.cos(p.r), dz = Math.sin(p.r);
      g.box(p.x + dx * 1.2, h + 1, p.z + dz * 1.2, 2.4, 1.8, 1.8, [0.85, 0.85, 0.83], -p.r);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + p.r;
        g.box(p.x + dx * 2, h + 1 + Math.sin(a) * 9, p.z + dz * 2 + Math.cos(a) * 0, 0.5, 18, 1.2,
          [0.92, 0.92, 0.9], -p.r, {});
      }
      break;
    }
    case 'parasol':
      g.cyl(p.x, 0, p.z, 0.07, 2.2, C.wood, 5);
      g.cone(p.x, 2.0, p.z, 1.7 * s, 0.7, pick(rng(Math.floor(p.x * 13 + p.z)), [[0.9, 0.35, 0.3], [0.95, 0.8, 0.3], [0.35, 0.6, 0.9]]), 8);
      break;
    default: break;
  }
}

/* -------------------------------------------------------------- monuments */

function buildLandmarks(ch, world) {
  for (const l of world.landmarks) {
    const g = ch.at(l.x, l.z);
    if (l.kind === 'pier') {
      const y = 3.2;
      for (let i = 0; i < l.len; i += 8) {
        const x = l.x - i;
        ch.at(x, l.z).box(x, y, l.z, 8.2, 0.5, l.w, C.wood);
        for (const s of [-1, 1]) ch.at(x, l.z).cyl(x, -4, l.z + s * (l.w / 2 - 1.5), 0.4, y + 4, shade(C.wood, 0.7), 6);
        if (i % 24 === 0) {
          ch.at(x, l.z).cyl(x, y + 0.25, l.z - l.w / 2 + 1, 0.12, 3.4, C.metal, 5);
          ch.at(x, l.z).box(x, y + 3.8, l.z - l.w / 2 + 1, 0.5, 0.35, 0.5, [1, 0.92, 0.7], 0, { emit: 1, emitTop: 1 });
        }
      }
      // grande roue au bout de la jetée
      const wx = l.x - l.len + 20, wz = l.z, R = 26;
      const gw = ch.at(wx, wz);
      for (const s of [-1, 1]) {
        gw.cyl(wx, y, wz + s * 6, 0.7, R, C.metal, 6, 0.3);
      }
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2;
        const cy = y + R + Math.sin(a) * R, cz2 = wz + Math.cos(a) * R;
        gw.box(wx, cy, cz2, 1.2, 1.4, 1.4, i % 2 ? [0.9, 0.25, 0.3] : [0.95, 0.85, 0.3], 0, { emit: 0.8 });
        const a2 = ((i + 1) / 22) * Math.PI * 2;
        gw.box(wx, y + R + Math.sin((a + a2) / 2) * R * 0.99, wz + Math.cos((a + a2) / 2) * R * 0.99,
          0.5, 0.35, R * 0.29, [0.85, 0.85, 0.9], 0, { emit: 0.35 });
      }
    } else if (l.kind === 'stadium') {
      const r = l.r;
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2, a2 = ((i + 1) / 28) * Math.PI * 2;
        const am = (a + a2) / 2;
        const px = l.x + Math.cos(am) * r * 0.86, pz = l.z + Math.sin(am) * r * 0.86;
        g.box(px, 13, pz, r * 0.22, 26, r * 0.34, C.concrete, -am, { top: shade(C.concrete, 0.8) });
        g.box(px, 27.5, pz, r * 0.22, 3, r * 0.3, [0.85, 0.85, 0.9], -am, { emit: 0.2 });
      }
      g.slab(l.x, l.z, r * 1.1, r * 0.8, 0.3, C.grass);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.box(l.x + Math.cos(a) * r * 0.95, 32, l.z + Math.sin(a) * r * 0.95, 5, 3, 1.5, [1, 0.98, 0.85], -a, { emit: 1, emitTop: 1 });
      }
    } else if (l.kind === 'vinewood-sign') {
      const letters = 'VINEWOOD';
      for (let i = 0; i < letters.length; i++) {
        const x = l.x + (i - letters.length / 2) * 17;
        const gg = ch.at(x, l.z);
        gg.box(x, l.y + 7, l.z, 12, 15, 1.4, C.white, 0, { emit: 0.5, top: C.white });
        gg.cyl(x, l.y - 12, l.z, 0.5, 12, shade(C.white, 0.6), 5);
      }
    } else if (l.kind === 'airport') {
      const g2 = ch.at(l.x, l.z);
      // piste
      for (let x = l.x - 340; x < l.x + 340; x += 60) {
        ch.at(x, l.z).slab(x + 30, l.z, 60, 60, 0.14, C.asphaltDark);
        ch.at(x, l.z).slab(x + 30, l.z, 26, 1.1, 0.2, C.lineWhite);
      }
      for (let x = l.x - 320; x < l.x + 340; x += 120) {
        ch.at(x, l.z).box(x, 0.4, l.z - 34, 0.8, 0.8, 0.8, [0.3, 0.8, 1], 0, { emit: 1, emitTop: 1 });
        ch.at(x, l.z).box(x, 0.4, l.z + 34, 0.8, 0.8, 0.8, [0.3, 0.8, 1], 0, { emit: 1, emitTop: 1 });
      }
      // terminal + hangars
      ch.at(l.x - 250, l.z - 100).box(l.x - 250, 11, l.z - 100, 92, 22, 52, color('#cfd3d6'), 0, { top: C.metal });
      for (let i = 0; i < 4; i++) {
        const hx = l.x - 60 + i * 90;
        ch.at(hx, l.z - 90).box(hx, 9, l.z - 90, 62, 18, 40, color('#b8bec2'), 0, { top: C.metal });
      }
      // tour de contrôle
      ch.at(l.x - 330, l.z - 90).cyl(l.x - 330, 0, l.z - 90, 4, 34, C.concrete, 8);
      ch.at(l.x - 330, l.z - 90).box(l.x - 330, 36, l.z - 90, 12, 5, 12, C.glassDark, 0, { emit: 0.5 });
    } else if (l.kind === 'port') {
      for (let i = 0; i < 4; i++) {
        const cx = l.x - 120 + i * 80;
        const gg = ch.at(cx, l.z - 140);
        for (const s of [-1, 1]) {
          gg.cyl(cx + s * 12, 0, l.z - 150, 1.2, 46, [0.85, 0.4, 0.2], 6);
          gg.cyl(cx + s * 12, 0, l.z - 118, 1.2, 46, [0.85, 0.4, 0.2], 6);
        }
        gg.box(cx, 48, l.z - 134, 30, 4, 40, [0.9, 0.45, 0.25]);
        gg.box(cx, 46, l.z - 168, 6, 3, 40, [0.9, 0.45, 0.25]);
      }
    } else if (l.kind === 'crane') {
      g.cyl(l.x, 0, l.z, 1.1, 62, [0.95, 0.75, 0.2], 4);
      g.box(l.x + 14, 63, l.z, 44, 1.8, 1.8, [0.95, 0.75, 0.2]);
      g.box(l.x + 26, 58, l.z, 1.2, 9, 1.2, [0.4, 0.4, 0.42]);
    }
  }
  // montagnes
  for (const m of world.mountains) {
    const g = ch.at(clamp(m.x, -1050, 1050), clamp(m.z, -1050, 1050));
    const c = m.h > 200 ? [0.42, 0.44, 0.4] : [0.36, 0.42, 0.32];
    g.cone(m.x, -8, m.z, m.r, m.h, c, 7);
    if (m.h > 210) g.cone(m.x, m.h - 62, m.z, m.r * 0.28, 60, [0.85, 0.87, 0.9], 7);
  }
}

/** Construit toute la géométrie statique. */
export function buildWorldGeometry(world) {
  const ch = new Chunks();
  buildGround(ch, world);
  buildRoads(ch, world);
  buildSidewalks(ch, world);
  for (const b of world.buildings) buildBuilding(ch.at(b.x, b.z), b);
  for (const p of world.props) buildProp(ch.at(p.x, p.z), p);
  buildLandmarks(ch, world);
  return ch.list();
}
