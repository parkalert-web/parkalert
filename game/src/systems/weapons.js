/**
 * Armement : catalogue, tirs instantanés (raycast), projectiles, explosions.
 */
import { clamp } from '../engine/math.js';

export const WEAPONS = {
  fist: { name: 'Poings', slot: 0, dmg: 14, rate: 0.42, melee: true, range: 1.9, icon: '✊' },
  bat: { name: 'Batte de baseball', slot: 0, dmg: 34, rate: 0.55, melee: true, range: 2.3, icon: '🏏' },
  pistol: { name: 'Pistolet', slot: 1, dmg: 26, rate: 0.17, mag: 12, spread: 0.014, range: 130, icon: '🔫', ammo: 90, noise: 1 },
  smg: { name: 'Micro-SMG', slot: 2, dmg: 19, rate: 0.072, mag: 30, spread: 0.036, range: 110, auto: true, icon: '🔫', ammo: 180, noise: 1.1 },
  shotgun: { name: 'Fusil à pompe', slot: 3, dmg: 15, pellets: 9, rate: 0.82, mag: 8, spread: 0.075, range: 45, icon: '🔫', ammo: 40, noise: 1.4 },
  rifle: { name: "Carabine d'assaut", slot: 4, dmg: 27, rate: 0.09, mag: 30, spread: 0.024, range: 160, auto: true, icon: '🔫', ammo: 210, noise: 1.3 },
  sniper: { name: 'Fusil de précision', slot: 5, dmg: 140, rate: 1.35, mag: 10, spread: 0.0012, range: 800, scope: true, icon: '🎯', ammo: 30, noise: 1.6 },
  rpg: { name: 'Lance-roquettes', slot: 6, dmg: 0, rate: 1.7, mag: 1, projectile: 'rocket', range: 400, icon: '🚀', ammo: 8, noise: 1.8 },
  grenade: { name: 'Grenade', slot: 7, dmg: 0, rate: 1.1, mag: 1, projectile: 'grenade', thrown: true, icon: '💣', ammo: 10, noise: 0 },
};

export const WEAPON_ORDER = ['fist', 'bat', 'pistol', 'smg', 'shotgun', 'rifle', 'sniper', 'rpg', 'grenade'];

/** Test rayon / cylindre vertical (piéton). */
function hitPed(p, ox, oy, oz, dx, dy, dz, maxT) {
  if (p.dead) return null;
  const r = 0.42;
  const px = ox - p.x, pz = oz - p.z;
  const a = dx * dx + dz * dz;
  if (a < 1e-6) return null;
  const b = 2 * (px * dx + pz * dz);
  const c = px * px + pz * pz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < 0.2 || t > maxT) return null;
  const y = oy + dy * t;
  const top = p.dead ? 0.6 : 1.85;
  if (y < 0.05 || y > top) return null;
  return { t, head: y > 1.52 && !p.dead };
}

/** Test rayon / boîte orientée (véhicule). */
function hitVehicle(v, ox, oy, oz, dx, dy, dz, maxT) {
  const s = Math.sin(v.yaw), c = Math.cos(v.yaw);
  const px = ox - v.x, pz = oz - v.z;
  const lx = px * c - pz * s;
  const lz = px * s + pz * c;
  const ldx = dx * c - dz * s;
  const ldz = dx * s + dz * c;
  const ly = oy - v.y, ldy = dy;
  const h = v.model.h;
  let tmin = 0, tmax = maxT;
  const slab = (o, d, lo, hi) => {
    if (Math.abs(d) < 1e-7) return o >= lo && o <= hi;
    let t1 = (lo - o) / d, t2 = (hi - o) / d;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    return tmax >= tmin;
  };
  if (!slab(lx, ldx, -v.hw, v.hw)) return null;
  if (!slab(lz, ldz, -v.hl, v.hl)) return null;
  if (!slab(ly, ldy, 0, h)) return null;
  if (tmin < 0.2) return null;
  return { t: tmin };
}

/**
 * Lance un rayon dans la scène et retourne le premier impact.
 * @returns {{type:string, t:number, x:number,y:number,z:number, ent:any, head:boolean}}
 */
export function raycastScene(game, ox, oy, oz, dx, dy, dz, maxDist, ignore) {
  let best = { type: 'sky', t: maxDist, ent: null, head: false };
  const wt = game.world.raycast(ox, oy, oz, dx, dy, dz, maxDist);
  if (wt < best.t) best = { type: 'world', t: wt, ent: null, head: false };
  if (dy < 0 && oy > 0) {                       // sol
    const t = -oy / dy;
    if (t > 0 && t < best.t) best = { type: 'ground', t, ent: null, head: false };
  }
  for (const p of game.peds) {
    if (p === ignore) continue;
    const h = hitPed(p, ox, oy, oz, dx, dy, dz, best.t);
    if (h) best = { type: 'ped', t: h.t, ent: p, head: h.head };
  }
  if (game.player.onFoot || ignore !== game.player) {
    const pl = game.player;
    if (ignore !== pl && pl.onFoot && !pl.dead) {
      const h = hitPed(pl, ox, oy, oz, dx, dy, dz, best.t);
      if (h) best = { type: 'player', t: h.t, ent: pl, head: h.head };
    }
  }
  for (const v of game.vehicles) {
    if (v === ignore) continue;
    const h = hitVehicle(v, ox, oy, oz, dx, dy, dz, best.t);
    if (h) best = { type: 'vehicle', t: h.t, ent: v, head: false };
  }
  best.x = ox + dx * best.t;
  best.y = oy + dy * best.t;
  best.z = oz + dz * best.t;
  return best;
}

/** Projectiles (roquettes, grenades). */
export class Projectile {
  constructor(kind, x, y, z, vx, vy, vz, owner) {
    this.kind = kind;
    this.x = x; this.y = y; this.z = z;
    this.vx = vx; this.vy = vy; this.vz = vz;
    this.life = kind === 'grenade' ? 2.6 : 6;
    this.owner = owner;
    this.dead = false;
    this.bounces = 0;
  }

  update(dt, game) {
    this.life -= dt;
    if (this.kind === 'grenade') {
      this.vy -= 19 * dt;
    }
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt, nz = this.z + this.vz * dt;
    const d = Math.hypot(nx - this.x, ny - this.y, nz - this.z);
    if (d > 0.001) {
      const hit = raycastScene(game, this.x, this.y, this.z, (nx - this.x) / d, (ny - this.y) / d, (nz - this.z) / d, d, this.owner);
      if (hit.type !== 'sky') {
        if (this.kind === 'rocket') {
          this.dead = true;
          game.explode(hit.x, hit.y, hit.z, 12, null, this.owner);
          return;
        }
        // grenade : rebond
        this.bounces++;
        if (hit.type === 'ground') { this.y = 0.12; this.vy = Math.abs(this.vy) * 0.35; }
        else { this.vx *= -0.4; this.vz *= -0.4; this.vy *= 0.4; }
        this.vx *= 0.7; this.vz *= 0.7;
        return;
      }
    }
    this.x = nx; this.y = ny; this.z = nz;
    if (this.y < 0.1 && this.kind === 'grenade') {
      this.y = 0.1;
      this.vy = Math.abs(this.vy) * 0.3;
      this.vx *= 0.72; this.vz *= 0.72;
    }
    if (this.life <= 0) {
      this.dead = true;
      game.explode(this.x, this.y, this.z, this.kind === 'grenade' ? 11 : 12, null, this.owner);
    }
  }
}
