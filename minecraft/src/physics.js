/**
 * Minecraft JS — collisions.
 *
 * Chaque entité est une boîte alignée sur les axes. Le déplacement est résolu
 * axe par axe (Y, puis X, puis Z) : c'est ce qui permet de glisser le long
 * d'un mur au lieu de s'y coller, et de monter une marche sans rester bloqué.
 */

import { BLOCKS } from './blocks.js';
import { WORLD_H } from './chunk.js';

/** Hauteur de collision d'un bloc (les lits et la neige sont plus bas). */
function boxHeight(bl) { return bl.boxH ?? 1; }

/** Le bloc gêne-t-il le passage ? */
function blocks(bl) { return bl.solid; }

/**
 * Déplace une entité en tenant compte du décor.
 * @param {object} world
 * @param {{x,y,z,width,height}} e entité (x,z = centre ; y = pieds)
 * @param {number} dx @param {number} dy @param {number} dz
 * @returns {{x:boolean,y:boolean,z:boolean,ground:boolean,ceiling:boolean}}
 */
export function move(world, e, dx, dy, dz) {
  const hit = { x: false, y: false, z: false, ground: false, ceiling: false };
  const hw = e.width / 2;

  // Y
  if (dy !== 0) {
    const y0 = e.y + (dy < 0 ? dy : 0);
    const y1 = e.y + e.height + (dy > 0 ? dy : 0);
    const c = sweepY(world, e.x - hw, y0, e.z - hw, e.x + hw, y1, e.z + hw, dy, e);
    if (c !== null) {
      e.y = dy > 0 ? c - e.height - 1e-4 : c + 1e-4;
      hit.y = true;
      if (dy < 0) hit.ground = true; else hit.ceiling = true;
    } else e.y += dy;
  }

  // X
  if (dx !== 0) {
    const c = sweepAxis(world, e, dx, 0);
    if (c !== null) { e.x = dx > 0 ? c - hw - 1e-4 : c + hw + 1e-4; hit.x = true; }
    else e.x += dx;
  }

  // Z
  if (dz !== 0) {
    const c = sweepAxis(world, e, dz, 2);
    if (c !== null) { e.z = dz > 0 ? c - hw - 1e-4 : c + hw + 1e-4; hit.z = true; }
    else e.z += dz;
  }

  return hit;
}

function sweepY(world, x0, y0, z0, x1, y1, z1, dy, e) {
  const bx0 = Math.floor(x0), bx1 = Math.floor(x1);
  const bz0 = Math.floor(z0), bz1 = Math.floor(z1);
  const by0 = Math.floor(Math.max(0, y0)), by1 = Math.floor(Math.min(WORLD_H - 1, y1));
  let best = null;
  for (let by = by0; by <= by1; by++) {
    for (let bz = bz0; bz <= bz1; bz++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        const bl = BLOCKS[world.getBlock(bx, by, bz)];
        if (!blocks(bl)) continue;
        const top = by + boxHeight(bl);
        if (dy < 0) {
          if (top <= e.y + 1e-6 && (best === null || top > best)) best = top;
        } else if (by >= e.y + e.height - 1e-6 && (best === null || by < best)) best = by;
      }
    }
  }
  if (best === null) return null;
  if (dy < 0 && e.y + dy >= best - 1e-6) return null;
  if (dy > 0 && e.y + e.height + dy <= best + 1e-6) return null;
  return best;
}

/** Balayage horizontal : axis 0 = X, axis 2 = Z. */
function sweepAxis(world, e, delta, axis) {
  const hw = e.width / 2;
  const y0 = Math.floor(e.y + 1e-4);
  const y1 = Math.floor(e.y + e.height - 1e-4);
  const pos = axis === 0 ? e.x : e.z;
  const other = axis === 0 ? e.z : e.x;
  const target = pos + delta + (delta > 0 ? hw : -hw);
  const from = pos + (delta > 0 ? hw : -hw);
  const b0 = Math.floor(Math.min(from, target));
  const b1 = Math.floor(Math.max(from, target));
  const o0 = Math.floor(other - hw), o1 = Math.floor(other + hw);
  let best = null;
  for (let b = b0; b <= b1; b++) {
    for (let o = o0; o <= o1; o++) {
      for (let y = Math.max(0, y0); y <= Math.min(WORLD_H - 1, y1); y++) {
        const bx = axis === 0 ? b : o;
        const bz = axis === 0 ? o : b;
        const bl = BLOCKS[world.getBlock(bx, y, bz)];
        if (!blocks(bl)) continue;
        if (y === y0 && e.y >= y + boxHeight(bl) - 1e-6) continue;
        const face = delta > 0 ? b : b + 1;
        if (delta > 0 ? face >= from - 1e-6 : face <= from + 1e-6) {
          if (best === null || (delta > 0 ? face < best : face > best)) best = face;
        }
      }
    }
  }
  if (best === null) return null;
  if (delta > 0 && target <= best + 1e-6) return null;
  if (delta < 0 && target >= best - 1e-6) return null;
  return best;
}

/** Le bloc sous les pieds est-il solide ? (utilisé pour l'accroupissement) */
export function supportedAt(world, x, y, z, width) {
  const hw = width / 2;
  for (const [dx, dz] of [[-hw, -hw], [hw, -hw], [-hw, hw], [hw, hw]]) {
    const bl = BLOCKS[world.getBlock(Math.floor(x + dx), Math.floor(y - 0.05), Math.floor(z + dz))];
    if (bl.solid) return true;
  }
  return false;
}

/** Tous les blocs (non solides compris) recouverts par la boîte d'une entité. */
export function forEachBlockIn(world, e, fn) {
  const hw = e.width / 2;
  const x0 = Math.floor(e.x - hw), x1 = Math.floor(e.x + hw);
  const z0 = Math.floor(e.z - hw), z1 = Math.floor(e.z + hw);
  const y0 = Math.floor(e.y), y1 = Math.floor(e.y + e.height);
  for (let y = Math.max(0, y0); y <= Math.min(WORLD_H - 1, y1); y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const id = world.getBlock(x, y, z);
        if (id) fn(id, x, y, z);
      }
    }
  }
}

/**
 * Y a-t-il ce fluide au contact ?
 * Comme dans le jeu, la boîte entière compte : les pieds qui trempent
 * suffisent. C'est ce qui permet de nager pour se hisser sur une berge, au
 * lieu de flotter indéfiniment au ras de la surface.
 */
export function inFluid(world, e, fluid, atEyes = false) {
  const hw = (e.width / 2) * 0.8;
  const hauteurs = atEyes ? [e.height * 0.9] : [0.1, e.height * 0.4];
  for (const h of hauteurs) {
    const y = Math.floor(e.y + h);
    for (const [dx, dz] of [[0, 0], [-hw, -hw], [hw, hw], [-hw, hw], [hw, -hw]]) {
      const bl = BLOCKS[world.getBlock(Math.floor(e.x + dx), y, Math.floor(e.z + dz))];
      if (bl.fluid === fluid) return true;
    }
  }
  return false;
}

/** Intersection de deux boîtes d'entités. */
export function entitiesOverlap(a, b, margin = 0) {
  const ah = a.width / 2 + margin, bh = b.width / 2;
  return Math.abs(a.x - b.x) < ah + bh
    && Math.abs(a.z - b.z) < ah + bh
    && a.y < b.y + b.height + margin && b.y < a.y + a.height + margin;
}

/** Rayon → entité (pour frapper une créature au clic). */
export function rayHitsEntity(ox, oy, oz, dx, dy, dz, e, maxDist) {
  const hw = e.width / 2 + 0.1;
  const bx0 = e.x - hw, bx1 = e.x + hw;
  const by0 = e.y - 0.1, by1 = e.y + e.height + 0.1;
  const bz0 = e.z - hw, bz1 = e.z + hw;
  let tmin = 0, tmax = maxDist;
  for (const [o, d, lo, hi] of [[ox, dx, bx0, bx1], [oy, dy, by0, by1], [oz, dz, bz0, bz1]]) {
    if (Math.abs(d) < 1e-8) { if (o < lo || o > hi) return null; continue; }
    let t1 = (lo - o) / d, t2 = (hi - o) / d;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}
