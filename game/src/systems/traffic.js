/**
 * Vie de la ville : circulation automobile pilotée par le réseau de nœuds,
 * voitures en stationnement, piétons, apparition et disparition autour du joueur.
 */
import { Vehicle, MODELS, CIVILIAN_MODELS } from '../entities/vehicle.js';
import { Ped } from '../entities/character.js';
import { rng, range, pick, clamp, wrapAngle, angleDelta, dist2D } from '../engine/math.js';
import { STREET, ROAD_W, GRID } from '../world/gen.js';

const LANE = 4.6;
const SPAWN_MIN = 105;
const SPAWN_MAX = 210;
const DESPAWN = 300;
const MAX_VEHICLES = 70;

export class Population {
  constructor(game) {
    this.game = game;
    this.rand = rng(777);
    this.maxTraffic = 26;
    this.maxParked = 30;
    this.maxPeds = 38;
    this.pedTimer = 0;
    // index des îlots par case de la trame : sert aux piétons qui traversent
    this.blocks = new Map();
    for (const b of game.data.blocks) this.blocks.set(`${b.gx},${b.gz}`, b);
    this.blockAt = (gx, gz) => this.blocks.get(`${gx},${gz}`) || null;
  }

  /** Nœud du graphe le plus proche d'un point. */
  nearestNode(x, z) {
    const nodes = this.game.data.graph.nodes;
    let best = 0, bd = 1e18;
    for (let i = 0; i < nodes.length; i++) {
      const d = (nodes[i].x - x) ** 2 + (nodes[i].z - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  /** Nœuds situés dans un anneau autour du joueur. */
  ringNodes(x, z, min, max) {
    const nodes = this.game.data.graph.nodes;
    const out = [];
    for (let i = 0; i < nodes.length; i++) {
      const d = Math.hypot(nodes[i].x - x, nodes[i].z - z);
      if (d > min && d < max) out.push(i);
    }
    return out;
  }

  spawnTraffic() {
    const g = this.game;
    const p = g.player;
    const cand = this.ringNodes(p.x, p.z, SPAWN_MIN, SPAWN_MAX);
    if (!cand.length) return null;
    const ni = pick(this.rand, cand);
    const node = g.data.graph.nodes[ni];
    if (!node.links.length) return null;
    const nj = pick(this.rand, node.links);
    const next = g.data.graph.nodes[nj];
    const yaw = Math.atan2(next.x - node.x, next.z - node.z);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const key = pick(this.rand, CIVILIAN_MODELS);
    const v = new Vehicle(key, node.x + rx * LANE, node.z + rz * LANE, yaw);
    v.ai = { node: ni, next: nj, cruise: range(this.rand, 11, 17), impatience: 0 };
    v.speed = v.ai.cruise * 0.7;
    v.vx = Math.sin(yaw) * v.speed;
    v.vz = Math.cos(yaw) * v.speed;
    // conducteur visible
    const d = new Ped(v.x, v.z, this.rand);
    d.inVehicle = v; d.seat = 0;
    v.occupants.push(d);
    v.driverPed = d;
    g.peds.push(d);
    g.vehicles.push(v);
    return v;
  }

  spawnParked() {
    const g = this.game;
    const p = g.player;
    const cand = this.ringNodes(p.x, p.z, 45, 165);
    if (!cand.length) return null;
    const ni = pick(this.rand, cand);
    const node = g.data.graph.nodes[ni];
    if (!node.links.length) return null;
    const nj = pick(this.rand, node.links);
    const next = g.data.graph.nodes[nj];
    const yaw = Math.atan2(next.x - node.x, next.z - node.z);
    const t = range(this.rand, 16, Math.max(20, Math.hypot(next.x - node.x, next.z - node.z) - 16));
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const side = this.rand() < 0.5 ? 1 : -1;
    const x = node.x + fx * t + rx * (ROAD_W / 2 - 1.6) * side;
    const z = node.z + fz * t + rz * (ROAD_W / 2 - 1.6) * side;
    for (const v of g.vehicles) if (dist2D(v.x, v.z, x, z) < 6) return null;
    const key = pick(this.rand, CIVILIAN_MODELS);
    const v = new Vehicle(key, x, z, yaw + (side < 0 ? Math.PI : 0), { parked: true });
    const test = { x, z };
    if (g.world.pushCircle(test, 2.4, 2)) return null;
    g.vehicles.push(v);
    return v;
  }

  spawnPed() {
    const g = this.game;
    const p = g.player;
    const blocks = g.data.blocks;
    let tries = 12;
    while (tries-- > 0) {
      const b = pick(this.rand, blocks);
      const d = dist2D(b.x, b.z, p.x, p.z);
      if (d < 22 || d > 130) continue;
      const ped = new Ped(b.x, b.z, this.rand);
      ped.setBlock(b, this.blockAt);
      const c = ped.cornerPoint(Math.floor(this.rand() * 4));
      ped.x = c[0] + range(this.rand, -6, 6);
      ped.z = c[1] + range(this.rand, -6, 6);
      const t = { x: ped.x, z: ped.z };
      if (g.world.pushCircle(t, 0.5, 2)) continue;
      g.peds.push(ped);
      return ped;
    }
    return null;
  }

  /**
   * Feux tricolores : un cycle unique pour toute la ville. 0 = nord-sud au
   * vert, 1 = est-ouest au vert ; les deux dernières secondes sont orange.
   */
  static lightPhase(time) {
    const CYCLE = 11;
    const t = (time % (CYCLE * 2)) / CYCLE;
    const green = Math.floor(t);
    const remaining = CYCLE - (time % CYCLE);
    return { green, amber: remaining < 2.2 };
  }

  /** Le véhicule doit-il s'arrêter au feu du prochain carrefour ? */
  mustStop(v, node, axis) {
    const g = this.game;
    const { green, amber } = Population.lightPhase(g.time || 0);
    if (axis === green && !amber) return false;
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    const dx = node.x - v.x, dz = node.z - v.z;
    const ahead = dx * fx + dz * fz;
    const dist = Math.hypot(dx, dz);
    if (ahead < 0 || dist > 16) return false;                 // déjà engagé, ou trop loin
    if (amber && dist < 7 && Math.abs(v.speed) > 8) return false;   // trop tard pour freiner
    return true;
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    const px = p.x, pz = p.z;

    // disparition au loin
    for (let i = g.vehicles.length - 1; i >= 0; i--) {
      const v = g.vehicles[i];
      if (v === p.vehicle || v.mission || v.persistent) continue;
      const d = dist2D(v.x, v.z, px, pz);
      if (d > DESPAWN || (v.dead && v.burnTime > 22)) {
        g.audio.stopEngine(v.id);
        if (v.driverPed) {
          const k = g.peds.indexOf(v.driverPed);
          if (k >= 0) g.peds.splice(k, 1);
        }
        g.vehicles.splice(i, 1);
      }
    }
    for (let i = g.peds.length - 1; i >= 0; i--) {
      const ped = g.peds[i];
      if (ped.mission || ped.inVehicle) continue;
      const d = dist2D(ped.x, ped.z, px, pz);
      if (d > 190 || (ped.dead && ped.deadT > 26)) g.peds.splice(i, 1);
    }

    // Filet de sécurité : quoi qu'il arrive, on plafonne le parc automobile.
    if (g.vehicles.length > MAX_VEHICLES) {
      const removable = g.vehicles
        .filter((v) => v !== p.vehicle && !v.mission)
        .sort((a, b) => dist2D(b.x, b.z, px, pz) - dist2D(a.x, a.z, px, pz));
      for (const v of removable.slice(0, g.vehicles.length - MAX_VEHICLES)) {
        g.audio.stopEngine(v.id);
        const i = g.vehicles.indexOf(v);
        if (i >= 0) g.vehicles.splice(i, 1);
      }
    }

    // apparition
    const traffic = g.vehicles.filter((v) => v.ai && !v.dead).length;
    const parked = g.vehicles.filter((v) => v.parked).length;
    const peds = g.peds.filter((x) => !x.dead && !x.inVehicle).length;
    if (traffic < this.maxTraffic && this.rand() < dt * 6) this.spawnTraffic();
    if (parked < this.maxParked && this.rand() < dt * 8) this.spawnParked();
    if (peds < this.maxPeds && this.rand() < dt * 9) this.spawnPed();

    // conduite autonome
    for (const v of g.vehicles) {
      if (!v.ai || v.dead || v === p.vehicle) continue;
      this.driveAI(v, dt);
    }
  }

  /** Pilotage d'un véhicule non-joueur. */
  driveAI(v, dt) {
    const g = this.game;
    const nodes = g.data.graph.nodes;
    const ai = v.ai;

    if (ai.chase) return this.driveChase(v, dt);

    let next = nodes[ai.next];
    if (!next) { ai.next = ai.node; next = nodes[ai.node]; }
    const yawSeg = Math.atan2(next.x - nodes[ai.node].x, next.z - nodes[ai.node].z);
    const rx = Math.cos(yawSeg), rz = -Math.sin(yawSeg);
    const tx = next.x + rx * LANE, tz = next.z + rz * LANE;
    const d = dist2D(v.x, v.z, tx, tz);
    if (d < 12) {
      // choisir la suite : tout droit de préférence
      const links = next.links.filter((l) => l !== ai.node);
      const options = links.length ? links : next.links;
      let chosen = options[0];
      if (options.length > 1) {
        let bestScore = -1e9;
        for (const o of options) {
          const n2 = nodes[o];
          const a = Math.atan2(n2.x - next.x, n2.z - next.z);
          const straight = Math.cos(angleDelta(yawSeg, a));
          const s = straight * 2 + this.rand() * 1.4;
          if (s > bestScore) { bestScore = s; chosen = o; }
        }
      }
      ai.node = ai.next;
      ai.next = chosen;
    }

    const desired = Math.atan2(tx - v.x, tz - v.z);
    const err = angleDelta(v.yaw, desired);
    v.steerInput = clamp(err * 1.9, -1, 1);

    // Espace libre devant le pare-chocs. Trop prudent, et la ville s'embouteille
    // définitivement : on ne s'arrête qu'à 2,5 m et on ralentit progressivement.
    let gap = 60;                       // obstacles durs : véhicules
    let soft = 60;                      // obstacles mous : piétons, joueur à pied
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    const sideX = Math.cos(v.yaw), sideZ = -Math.sin(v.yaw);
    const check = (ox, oz, len, w) => {
      const dx = ox - v.x, dz = oz - v.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * sideX + dz * sideZ);
      if (along > 0 && along < 30 && side < w) return along - len;
      return 60;
    };
    for (const o of g.vehicles) {
      if (o === v) continue;
      if (dist2D(o.x, o.z, v.x, v.z) > 32) continue;
      gap = Math.min(gap, check(o.x, o.z, o.hl + v.hl + 0.6, 2.1));
    }
    const pl = g.player;
    if (pl.onFoot && !pl.dead) soft = Math.min(soft, check(pl.x, pl.z, v.hl + 1.2, 1.8));
    for (const ped of g.peds) {
      if (ped.dead || ped.inVehicle) continue;
      if (dist2D(ped.x, ped.z, v.x, v.z) < 20) soft = Math.min(soft, check(ped.x, ped.z, v.hl + 1.2, 1.6));
    }

    // On cède le passage à un piéton, mais pas éternellement : au bout de
    // trois secondes on klaxonne et on avance au pas — sinon un badaud figé
    // sur la chaussée bloque la file jusqu'à la fin des temps.
    ai.pedWait = soft < 5 ? (ai.pedWait || 0) + dt : 0;
    const creep = ai.pedWait > 3;
    if (!creep) gap = Math.min(gap, soft);

    const turnFactor = 1 - Math.min(Math.abs(err) / 1.2, 0.75);
    let cruise = ai.cruise * turnFactor;

    // feu rouge au carrefour visé — un fuyard, lui, ne s'arrête pas
    if (!ai.fugitif && next.links.length >= 3 && Math.abs(next.gx) <= GRID && Math.abs(next.gz) <= GRID) {
      const seg = nodes[ai.node];
      const axis = Math.abs(next.x - seg.x) > Math.abs(next.z - seg.z) ? 1 : 0;
      if (this.mustStop(v, next, axis)) {
        const brakeDist = Math.max(0, Math.hypot(next.x - v.x, next.z - v.z) - 9);
        cruise = Math.min(cruise, brakeDist * 0.9);
      }
    }
    if (!ai.fugitif && g.player.wanted > 0 && dist2D(v.x, v.z, pl.x, pl.z) < 70) cruise *= 0.55;
    if (gap < 2.5) cruise = 0;
    else if (gap < 18) cruise *= clamp((gap - 2.5) / 15.5, 0, 1);
    if (creep) cruise = Math.max(cruise, Math.min(3.2, gap > 2.5 ? 3.2 : 0));

    v.throttle = clamp((cruise - v.speed) * 0.6, -1, 1);
    v.handbrake = cruise === 0 && v.speed < 0.4;
    ai.impatience = Math.min(gap, soft) < 6 ? ai.impatience + dt : 0;
    if (ai.impatience > 2.5 && this.rand() < dt * 1.5) { v.horn = 0.25; g.audio.hornSound(v.x, v.z); }
  }

  /** Poursuite policière. */
  driveChase(v, dt) {
    const g = this.game;
    const p = g.player;
    const tx = p.vehicle ? p.vehicle.x : p.x;
    const tz = p.vehicle ? p.vehicle.z : p.z;
    const d = dist2D(v.x, v.z, tx, tz);
    const desired = Math.atan2(tx - v.x, tz - v.z);
    let err = angleDelta(v.yaw, desired);

    // évitement grossier des immeubles : on sonde à gauche et à droite
    const probe = (a) => {
      const dx = Math.sin(v.yaw + a), dz = Math.cos(v.yaw + a);
      return g.world.raycast(v.x, 1, v.z, dx, 0, dz, 26);
    };
    const c0 = probe(0), cl = probe(-0.5), cr = probe(0.5);
    if (c0 < 16) err += (cl > cr ? -1 : 1) * 0.9;

    v.steerInput = clamp(err * 2.1, -1, 1);
    v.siren = true;

    // Un suspect à pied, on ne l'écrase pas : on se range à une dizaine de
    // mètres et on descend. C'est cet arrêt qui déclenche le déploiement.
    const aPied = !p.vehicle && !p.dead;
    if (aPied) {
      const cible = d > 45 ? v.model.top * 0.75 : d > 20 ? 15 : 0;
      v.throttle = clamp((cible - v.speed) * 0.7, -1, 1);
      if (d < 20 && v.speed > 1.5) v.throttle = -1;          // freinage franc
      v.handbrake = d < 17 && v.speed < 1.5;
      if (Math.abs(err) > 2.2 && v.speed > 4) v.throttle = -0.6;
      return;
    }

    const target = d > 26 ? v.model.top * 0.9 : d > 10 ? 22 : 12;
    v.throttle = clamp((target - v.speed) * 0.6, -1, 1);
    if (d < 14 && p.vehicle) v.throttle = 1;                 // tentative d'interception
    if (Math.abs(err) > 2.2 && v.speed > 4) v.throttle = -0.6;
    v.handbrake = false;
  }
}
