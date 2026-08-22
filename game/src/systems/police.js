/**
 * Indice de recherche (les étoiles), renforts, hélicoptère et perte de la police.
 */
import { Vehicle } from '../entities/vehicle.js';
import { Ped } from '../entities/character.js';
import { m4, m4compose, m4mul, clamp, damp, dampAngle, angleDelta, dist2D, rng, range, pick } from '../engine/math.js';

const STAR_ESCAPE = [0, 12, 18, 26, 34, 44];   // secondes hors de vue pour perdre l'indice
const COP_CARS = [0, 1, 2, 4, 5, 7];
const HELIS = [0, 0, 0, 1, 1, 2];

export class Helicopter {
  constructor(x, z) {
    this.x = x; this.y = 62; this.z = z;
    this.yaw = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.rotor = 0;
    this.health = 400;
    this.dead = false;
    this.fireT = 0;
    this.mat = m4(); this.tmp = m4(); this.out = m4();
    this.orbit = Math.random() * 6.28;
  }

  update(dt, game) {
    const p = game.player;
    if (this.dead) {
      this.vy -= 16 * dt;
      this.y += this.vy * dt;
      this.yaw += dt * 4;
      this.rotor += dt * 8;
      if (this.y <= 1) {
        game.explode(this.x, 2, this.z, 16, null, null);
        this.remove = true;
      }
      return;
    }
    this.orbit += dt * 0.42;
    const R = 42;
    const tx = p.x + Math.cos(this.orbit) * R;
    const tz = p.z + Math.sin(this.orbit) * R;
    const ty = 48 + Math.sin(this.orbit * 0.7) * 6;
    this.vx = damp(this.vx, (tx - this.x) * 0.9, 2, dt);
    this.vz = damp(this.vz, (tz - this.z) * 0.9, 2, dt);
    this.vy = damp(this.vy, (ty - this.y) * 1.2, 2, dt);
    this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
    this.yaw = dampAngle(this.yaw, Math.atan2(p.x - this.x, p.z - this.z), 2.4, dt);
    this.rotor += dt * 26;
    this.fireT -= dt;
    const d = dist2D(this.x, this.z, p.x, p.z);
    if (game.player.wanted >= 4 && this.fireT <= 0 && d < 70 && !p.dead) {
      this.fireT = 0.16;
      game.npcShootFrom(this.x, this.y - 2, this.z, p, 9, 'smg');
    }
  }

  damage(v, game) {
    this.health -= v;
    if (this.health <= 0 && !this.dead) {
      this.dead = true;
      this.vy = 2;
    }
  }

  draw(R, env) {
    const body = [0.12, 0.14, 0.2];
    m4compose(this.mat, this.x, this.y, this.z, this.yaw, 1, 1, 1, this.dead ? 0.4 : 0.12, this.dead ? 0.6 : 0);
    const part = (x, y, z, sx, sy, sz, c, ry = 0, emit = 0, rx = 0, rz = 0) => {
      m4compose(this.tmp, x, y, z, ry, sx, sy, sz, rx, rz);
      m4mul(this.out, this.mat, this.tmp);
      R.cube(this.out, c, emit);
    };
    part(0, 0, 0.4, 1.9, 1.7, 4.4, body);
    part(0, 0.25, 2.3, 1.6, 1.1, 1.2, [0.08, 0.11, 0.16], 0, 0.06);
    part(0, 0.1, -3.6, 0.5, 0.6, 3.6, body);
    part(0, 1.1, -5.2, 0.3, 1.6, 0.7, body);
    part(0, 0.95, 0.2, 0.35, 0.6, 0.5, [0.4, 0.4, 0.45]);
    for (const s of [-1, 1]) part(s * 1.05, -0.9, 0.3, 0.16, 0.5, 3.2, [0.35, 0.35, 0.4]);
    // rotor principal
    for (let i = 0; i < 2; i++) {
      part(0, 1.5, 0.2, 12, 0.09, 0.5, [0.15, 0.15, 0.17], this.rotor + i * Math.PI / 2);
    }
    part(0.35, 1.1, -5.2, 2.6, 0.08, 0.28, [0.15, 0.15, 0.17], 0, 0, 0, this.rotor * 1.6);
    // feux
    part(0, -0.9, 2.0, 0.3, 0.3, 0.3, [1, 0.2, 0.2], 0, 1);
    if (env.emitBoost > 0.3) {
      m4compose(this.tmp, 0, -1.2, 1.6, 0, 26, 46, 26, 0, 0);
      m4mul(this.out, this.mat, this.tmp);
      R.ghost('cone', this.out, [1, 0.98, 0.85], 0.9);
    }
  }
}

export class PoliceSystem {
  constructor(game) {
    this.game = game;
    this.rand = rng(4242);
    this.escapeTimer = 0;
    this.seen = true;
    this.helis = [];
    this.spawnTimer = 0;
    this.flash = 0;
    this.lastSeen = null;
  }

  get wanted() { return this.game.player.wanted; }

  /** Ajoute des étoiles (avec un plafond) et relance la traque. */
  addWanted(n, reason) {
    const p = this.game.player;
    const before = p.wanted;
    p.wanted = clamp(p.wanted + n, 0, 5);
    this.escapeTimer = 0;
    if (p.wanted > before) {
      this.game.notify(`Indice de recherche : ${'★'.repeat(p.wanted)}`, reason || '');
      this.game.audio.ui(340, 0.12, 0.16);
    }
  }

  clear() {
    this.game.player.wanted = 0;
    this.escapeTimer = 0;
    for (const v of this.game.vehicles) this.standDown(v);
    for (const p of this.game.peds) if (p.cop) p.remove = true;
    this.helis.length = 0;
  }

  /** Fin de poursuite : la patrouille reprend sa route et peut disparaître. */
  standDown(v) {
    if (!v.ai || !v.ai.chase) return;
    v.siren = false;
    v.ai.chase = false;
    v.ai.dropped = false;
    v.ai.cruise = 14;
    v.persistent = false;
    this.game.audio.updateSiren(v);
  }

  copCount() {
    return this.game.vehicles.filter((v) => v.ai && v.ai.chase && !v.dead).length;
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    if (p.wanted === 0) {
      if (this.helis.length) this.helis.length = 0;
      return;
    }

    // le joueur est-il vu ?
    let seen = false;
    const px = p.vehicle ? p.vehicle.x : p.x;
    const pz = p.vehicle ? p.vehicle.z : p.z;
    for (const v of g.vehicles) {
      if (!v.ai || !v.ai.chase || v.dead) continue;
      if (dist2D(v.x, v.z, px, pz) < 110 && g.world.visible(v.x, 1.4, v.z, px, 1.4, pz)) { seen = true; break; }
    }
    if (!seen) {
      for (const c of g.peds) {
        if (!c.cop || c.dead) continue;
        if (dist2D(c.x, c.z, px, pz) < 70 && g.world.visible(c.x, 1.6, c.z, px, 1.4, pz)) { seen = true; break; }
      }
    }
    if (!seen && this.helis.some((h) => dist2D(h.x, h.z, px, pz) < 90)) seen = true;
    this.seen = seen;
    if (seen) this.lastSeen = { x: px, z: pz };
    this.escapeTimer = seen ? 0 : this.escapeTimer + dt;
    this.flash = seen ? 0 : this.escapeTimer / STAR_ESCAPE[p.wanted];
    if (this.escapeTimer > STAR_ESCAPE[p.wanted]) {
      p.wanted = 0;
      this.escapeTimer = 0;
      g.notify('Vous avez semé la police', '');
      g.audio.ui(720, 0.2, 0.16);
      for (const v of g.vehicles) this.standDown(v);
      for (const c of g.peds) if (c.cop) c.remove = true;
      this.helis.length = 0;
      return;
    }

    // renforts
    this.spawnTimer -= dt;
    const wantCars = COP_CARS[p.wanted];
    if (this.spawnTimer <= 0 && this.copCount() < wantCars) {
      this.spawnTimer = 2.2;
      this.spawnCopCar();
    }
    while (this.helis.length < HELIS[p.wanted]) {
      this.helis.push(new Helicopter(px + range(this.rand, -120, 120), pz + range(this.rand, -120, 120)));
    }
    for (let i = this.helis.length - 1; i >= 0; i--) {
      const h = this.helis[i];
      h.update(dt, g);
      if (h.remove) this.helis.splice(i, 1);
    }

    // policiers à pied quand le joueur est à pied
    for (const v of g.vehicles) {
      if (!v.ai || !v.ai.chase || v.dead) continue;
      const d = dist2D(v.x, v.z, px, pz);
      if (!p.vehicle && d < 26 && Math.abs(v.speed) < 4 && !v.ai.dropped) {
        v.ai.dropped = true;
        const n = p.wanted >= 3 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const cop = new Ped(v.x + range(this.rand, -2.5, 2.5), v.z + range(this.rand, -2.5, 2.5), this.rand, { cop: true });
          cop.combatTarget = p;
          g.peds.push(cop);
        }
      }
      if (p.vehicle) v.ai.dropped = false;
    }
    for (const c of g.peds) {
      if (c.cop && !c.dead) c.combatTarget = p;
    }
  }

  spawnCopCar() {
    const g = this.game;
    const p = g.player;
    const px = p.vehicle ? p.vehicle.x : p.x;
    const pz = p.vehicle ? p.vehicle.z : p.z;
    const nodes = g.data.graph.nodes;
    const cand = [];
    for (let i = 0; i < nodes.length; i++) {
      const d = dist2D(nodes[i].x, nodes[i].z, px, pz);
      if (d > 90 && d < 220) cand.push(i);
    }
    if (!cand.length) return;
    const ni = pick(this.rand, cand);
    const node = nodes[ni];
    const yaw = Math.atan2(px - node.x, pz - node.z);
    const key = p.wanted >= 3 && this.rand() < 0.5 ? 'police2' : 'police';
    const v = new Vehicle(key, node.x, node.z, yaw);
    v.ai = { chase: true, node: ni, next: node.links[0] ?? ni, cruise: 26 };
    v.siren = true;
    v.persistent = true;
    const d = new Ped(v.x, v.z, this.rand, { cop: true });
    d.inVehicle = v; d.seat = 0;
    v.occupants.push(d);
    v.driverPed = d;
    g.peds.push(d);
    g.vehicles.push(v);
  }

  drawHelis(R, env) {
    for (const h of this.helis) h.draw(R, env);
  }
}
