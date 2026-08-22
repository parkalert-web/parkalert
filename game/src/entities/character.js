/**
 * Personnages : silhouette humaine articulée (boîtes), animation procédurale
 * de marche / course / visée, piétons autonomes qui longent les îlots,
 * panique collective et morts.
 */
import { m4, m4compose, m4mul, color, shade, clamp, lerp, damp, dampAngle, wrapAngle, rng, range, pick, dist2D } from '../engine/math.js';
import { pushOutOfVehicles } from '../systems/physics.js';

const SKIN = ['#e8b48c', '#c98d63', '#8d5a3b', '#f0c9a6', '#6b4229', '#d9a077'];
const SHIRT = ['#d8453c', '#2f6fb4', '#e6e6e6', '#3f9a5c', '#e0a33a', '#7a4f9a', '#2b2f36', '#d97ea8', '#4fb0c0', '#f0f0f0'];
const PANTS = ['#2f3947', '#3a3a3a', '#5c4a34', '#22304a', '#6b6b6b', '#1f1f24'];
const HAIR = ['#241a12', '#4a3620', '#7a5a32', '#1a1a1a', '#a08050', '#5a5a5a'];

const tmpA = m4(), tmpB = m4();

/* Proportions, en mètres. Un adulte fait 1,78 m. */
const THIGH = 0.44, CALF = 0.42, UPPER_ARM = 0.30, FOREARM = 0.28;

/**
 * Dessine un humanoïde articulé : membres en cylindres, articulations en
 * sphères, tête ronde. Les jambes et les bras ont deux segments, si bien que
 * le genou et le coude plient vraiment pendant la marche.
 *
 * @param {object} s x, y, z, yaw, anim (phase), move (0..1), aim, crouch,
 *                   deadT, swimming, et les couleurs (skin, shirt, pants…)
 * @param {number|null} look inclinaison de la tête (visée)
 */
export function drawHuman(R, s, look = null) {
  const fall = s.deadT > 0 ? clamp(s.deadT * 3.2, 0, 1) : 0;
  const base = m4compose(tmpA, s.x, s.y, s.z, s.yaw, 1, 1, 1, 0, 0);
  if (fall > 0) {
    m4compose(tmpB, 0, 0, 0, 0, 1, 1, 1, fall * Math.PI * 0.47, 0);
    m4mul(base, base, tmpB);
  }

  const skin = s.skin || [0.9, 0.72, 0.55];
  const shirt = s.shirt || [0.8, 0.25, 0.22];
  const pants = s.pants || [0.2, 0.24, 0.3];
  const hair = s.hair || [0.15, 0.11, 0.08];
  const shoe = [0.11, 0.1, 0.1];

  // pièces élémentaires, exprimées dans le repère du personnage
  // k : taille générale, w : carrure. Deux piétons ne se ressemblent jamais tout à fait.
  const k = s.scale || 1;
  const w = (s.build || 1) * k;
  const box = (x, y, z, sx, sy, sz, c, rx = 0, ry = 0, rz = 0) => {
    m4compose(tmpB, x * w, y * k, z * k, ry, sx * w, sy * k, sz * k, rx, rz);
    m4mul(tmpB, base, tmpB);
    R.cube(tmpB, c);
  };
  const ball = (x, y, z, d, c, dy = d, dz = d) => {
    m4compose(tmpB, x * w, y * k, z * k, 0, d * w, dy * k, dz * k);
    m4mul(tmpB, base, tmpB);
    R.sphere(tmpB, c);
  };
  /** Segment de membre : cylindre partant du pivot, incliné de `a` (plan sagittal). */
  const limb = (px, py, pz, a, len, thick, c) => {
    const cy = py - Math.cos(a) * len / 2;
    const cz = pz - Math.sin(a) * len / 2;
    m4compose(tmpB, px * w, cy * k, cz * k, 0, thick * w, len * k, thick * w, a, 0);
    m4mul(tmpB, base, tmpB);
    R.cyl(tmpB, c);
    return [px, py - Math.cos(a) * len, pz - Math.sin(a) * len];   // extrémité
  };

  const swimming = !!s.swimming;
  const phase = s.anim * Math.PI * 2;
  const amp = (0.28 + s.move * 0.62) * (1 - fall);
  const crouch = s.crouch ? 0.22 : 0;
  const bob = Math.abs(Math.sin(phase)) * 0.04 * s.move * (1 - fall);
  const hipY = 0.90 - crouch + bob;
  const lean = fall ? 0 : (s.aim ? 0.06 : s.move * 0.14);

  /* ------------------------------------------------------------- jambes */
  for (const side of [-1, 1]) {
    const swing = Math.sin(phase + (side > 0 ? Math.PI : 0)) * amp;
    // le genou plie quand la jambe part vers l'arrière
    const bend = Math.max(0, -Math.sin(phase + (side > 0 ? Math.PI : 0))) * amp * 1.5 + 0.06;
    const hx = side * 0.115;
    ball(hx, hipY, 0, 0.24, pants);
    const knee = limb(hx, hipY, 0, swing, THIGH, 0.19, pants);
    ball(knee[0], knee[1], knee[2], 0.185, pants);
    const ankle = limb(knee[0], knee[1], knee[2], swing + bend, CALF, 0.16, pants);
    ball(ankle[0], ankle[1], ankle[2], 0.15, shoe);
    box(ankle[0], ankle[1] - 0.03, ankle[2] + 0.07, 0.15, 0.09, 0.28, shoe, swing * 0.25);
  }

  /* -------------------------------------------------------------- tronc */
  const chestY = hipY + 0.34;
  box(0, hipY + 0.08, -lean * 0.05, 0.32, 0.22, 0.23, pants, lean);      // bassin
  m4compose(tmpB, 0, (hipY + 0.2) * k, 0, 0, 0.29 * w, 0.24 * k, 0.25 * w, lean, 0);
  m4mul(tmpB, base, tmpB); R.cyl(tmpB, shirt);                           // taille
  box(0, chestY - 0.02, 0, 0.36, 0.26, 0.25, shirt, lean);               // bas du torse
  box(0, chestY + 0.16, 0, 0.42, 0.24, 0.27, shirt, lean);               // poitrine
  ball(0, chestY + 0.24, 0, 0.44, shirt, 0.2, 0.28);                     // épaules arrondies

  /* --------------------------------------------------------------- tête */
  const neckY = chestY + 0.32;
  m4compose(tmpB, 0, (neckY - 0.03) * k, 0, 0, 0.12 * w, 0.11 * k, 0.12 * w);
  m4mul(tmpB, base, tmpB); R.cyl(tmpB, skin);
  const headTilt = look !== null ? clamp(look * 0.3, -0.35, 0.35) : 0;
  const hy = neckY + 0.16;
  ball(0, hy, 0.012, 0.235, skin, 0.26, 0.245);                          // crâne
  if (!s.hat) {
    ball(0, hy + 0.075, -0.022, 0.245, hair, 0.15, 0.235);               // cheveux
    ball(0, hy + 0.02, -0.09, 0.22, hair, 0.2, 0.12);                    // nuque
  }
  box(0, hy - 0.025, 0.115, 0.055, 0.06, 0.05, skin, headTilt);          // nez
  for (const e of [-1, 1]) ball(e * 0.062, hy + 0.02, 0.1, 0.045, [0.1, 0.1, 0.12]);
  if (s.hat) {
    ball(0, hy + 0.06, -0.01, 0.26, s.hatColor || [0.1, 0.12, 0.2], 0.2, 0.26);
    box(0, hy + 0.045, 0.15, 0.24, 0.035, 0.14, s.hatColor || [0.1, 0.12, 0.2]);
  }

  /* --------------------------------------------------------------- bras */
  const shoulderY = chestY + 0.24;
  let hand = null;
  for (const side of [-1, 1]) {
    const sx = side * 0.225;
    let a1;
    let a2;
    if (s.aim) {                                   // les deux mains sur l'arme
      a1 = -Math.PI / 2 + (look !== null ? clamp(-look, -0.5, 0.5) : 0);
      a2 = side > 0 ? 0.12 : 0.55;
    } else if (swimming) {
      a1 = Math.sin(phase + (side > 0 ? 0 : Math.PI)) * 1.5 - 0.8;
      a2 = 0.5;
    } else {
      a1 = Math.sin(phase + (side > 0 ? 0 : Math.PI)) * amp * 0.8;
      a2 = 0.1 + Math.max(0, Math.sin(phase + (side > 0 ? 0 : Math.PI))) * amp * 0.55;
    }
    ball(sx, shoulderY, 0, 0.185, shirt);
    const elbow = limb(sx, shoulderY, 0, a1, UPPER_ARM, 0.155, shirt);
    ball(elbow[0], elbow[1], elbow[2], 0.15, shirt);
    const wrist = limb(elbow[0], elbow[1], elbow[2], a1 + a2, FOREARM, 0.13, skin);
    ball(wrist[0], wrist[1], wrist[2], 0.125, skin);
    if (side > 0) hand = wrist;                   // point d'accroche de l'arme
  }

  /* --------------------------------------------------------------- arme */
  if (s.weapon && !fall && hand) {
    const w = s.weapon;
    const pitch = s.aim && look !== null ? clamp(-look, -0.5, 0.5) : 0;
    const fwd = s.aim ? 1 : 0.35;
    const gx = hand[0];
    const gy = hand[1] + (s.aim ? 0.04 : -0.02);
    const gz = hand[2] + w.len * 0.35 * fwd;
    box(gx, gy, gz, w.wide || 0.075, 0.11, w.len, w.color || [0.13, 0.13, 0.15], pitch);
    if (w.len > 0.45) box(gx, gy - 0.09, gz - w.len * 0.2, 0.06, 0.14, 0.1, [0.3, 0.22, 0.15], pitch);
    if (!s.aim) box(gx, gy - 0.08, gz - w.len * 0.3, 0.07, 0.13, 0.09, w.color || [0.13, 0.13, 0.15], pitch);
  }
}

/** Habillage aléatoire cohérent. */
export function randomLook(rand) {
  return {
    scale: range(rand, 0.9, 1.09),
    build: range(rand, 0.88, 1.14),
    skin: color(pick(rand, SKIN)),
    shirt: color(pick(rand, SHIRT)),
    pants: color(pick(rand, PANTS)),
    hair: color(pick(rand, HAIR)),
    hat: rand() < 0.18,
    hatColor: color(pick(rand, SHIRT)),
  };
}

let pedId = 1;

export class Ped {
  constructor(x, z, rand, opts = {}) {
    this.id = pedId++;
    this.rand = rand;          // le même tirage que la population : tout est reproductible
    this.x = x; this.y = 0; this.z = z;
    this.yaw = rand() * Math.PI * 2;
    this.vx = 0; this.vz = 0;
    this.anim = rand();
    this.move = 0;
    this.speed = range(rand, 1.15, 1.7);
    this.health = 100;
    this.dead = false;
    this.deadT = 0;
    this.panic = 0;
    this.dodgeT = 0;
    this.dodgeDir = null;
    this.idleT = 0;
    this.idleTurn = 0;
    this.jogger = rand() < 0.14;
    this.neighbour = null;
    if (this.jogger) this.speed *= 1.9;
    this.look = randomLook(rand);
    this.state = 'walk';
    this.target = null;
    this.block = null;
    this.dir = rand() < 0.5 ? 1 : -1;
    this.corner = 0;
    this.hostile = !!opts.hostile;
    this.cop = !!opts.cop;
    this.armed = !!opts.armed;
    this.weaponCooldown = 0;
    this.aim = false;
    this.inVehicle = null;
    this.seat = 0;
    this.talkT = 0;
    this.driverOf = null;
    this.mission = opts.mission || null;
    if (this.cop) {
      this.look.shirt = [0.13, 0.17, 0.3];
      this.look.pants = [0.1, 0.12, 0.18];
      this.look.hat = true;
      this.look.hatColor = [0.1, 0.12, 0.2];
      this.health = 150;
      this.armed = true;
    }
    if (this.hostile) {
      this.look.shirt = opts.shirt || [0.2, 0.2, 0.22];
      this.health = opts.health || 120;
      this.armed = true;
    }
  }

  /**
   * Périmètre de l'îlot que le piéton longe. `neighbour(gx, gz)` lui permet,
   * de temps en temps, de traverser la rue vers l'îlot d'en face.
   */
  setBlock(b, neighbour = null) {
    this.block = b;
    if (neighbour) this.neighbour = neighbour;
    this.corner = Math.floor(this.rand() * 4);
    this.target = this.cornerPoint(this.corner);
  }

  cornerPoint(i, b = this.block) {
    if (!b) return null;
    const r = b.half + 2.3;
    const pts = [[b.x - r, b.z - r], [b.x + r, b.z - r], [b.x + r, b.z + r], [b.x - r, b.z + r]];
    return pts[((i % 4) + 4) % 4];
  }

  /** Traverse vers l'îlot voisin : on vise son coin le plus proche. */
  crossStreet(vehicles) {
    const b = this.block;
    if (!this.neighbour || !b) return false;
    // on regarde avant de traverser
    if (vehicles) {
      for (const v of vehicles) {
        if (v.dead || Math.abs(v.speed) < 4) continue;
        const dx = this.x - v.x, dz = this.z - v.z;
        if (dx * dx + dz * dz > 650) continue;
        const dir = v.speed < 0 ? -1 : 1;
        if (dx * Math.sin(v.yaw) * dir + dz * Math.cos(v.yaw) * dir > -2) return false;
      }
    }
    const side = Math.floor(this.rand() * 4);
    const gx = b.gx + [0, 1, 0, -1][side];
    const gz = b.gz + [-1, 0, 1, 0][side];
    const nb = this.neighbour(gx, gz);
    if (!nb) return false;
    let best = 0, bd = Infinity;
    for (let i = 0; i < 4; i++) {
      const c = this.cornerPoint(i, nb);
      const d = dist2D(this.x, this.z, c[0], c[1]);
      if (d < bd) { bd = d; best = i; }
    }
    if (bd > 74) return false;                    // jamais plus loin qu'un pâté
    this.block = nb;
    this.corner = best;
    this.target = this.cornerPoint(best);
    return true;
  }

  damage(amount, game, byPlayer, isHead) {
    if (this.dead) return false;
    this.health -= amount * (isHead ? 3.2 : 1);
    this.panic = 1;
    if (this.health <= 0) {
      this.dead = true;
      this.deadT = 0.001;
      this.state = 'dead';
      if (game) game.onPedKilled(this, byPlayer);
      return true;
    }
    if (!this.cop && !this.hostile) this.state = 'flee';
    return false;
  }

  /**
   * Réflexe piéton : quand une voiture fonce droit dessus, on saute sur le
   * côté. Sans ça un badaud planté sur la chaussée fige toute une file de
   * voitures, et la ville s'embouteille pour de bon.
   */
  dodgeTraffic(dt, vehicles) {
    this.dodgeT = Math.max(0, (this.dodgeT || 0) - dt);
    if (!vehicles) return this.dodgeT > 0;
    let worst = 0;
    for (const v of vehicles) {
      if (v.dead) continue;
      const sp = Math.abs(v.speed);
      if (sp < 3) continue;
      const dx = this.x - v.x, dz = this.z - v.z;
      if (dx * dx + dz * dz > 900) continue;
      const dir = v.speed < 0 ? -1 : 1;
      const fx = Math.sin(v.yaw) * dir, fz = Math.cos(v.yaw) * dir;
      const reach = Math.max(8, sp * 1.6);
      const along = dx * fx + dz * fz;
      if (along < -1 || along > reach) continue;
      const side = dx * fz - dz * fx;             // écart latéral signé
      if (Math.abs(side) > v.hw + 1.4) continue;
      const urgency = 1 - along / reach;
      if (urgency > worst) {
        worst = urgency;
        const s = side >= 0 ? 1 : -1;             // on fuit du côté où l'on penche déjà
        this.dodgeDir = [fz * s, -fx * s];
        this.dodgeT = 0.85;
      }
    }
    return this.dodgeT > 0;
  }

  update(dt, ctx) {
    if (this.dead) {
      this.deadT += dt;
      this.move = 0;
      return;
    }
    const { player, world, game } = ctx;
    const dpx = player.x - this.x, dpz = player.z - this.z;
    const distPlayer = Math.hypot(dpx, dpz);

    if (this.panic > 0) this.panic -= dt * 0.25;

    const vehicles = game && game.vehicles;
    if (!this.hostile && !this.cop && this.dodgeTraffic(dt, vehicles)) {
      this.yaw = dampAngle(this.yaw, Math.atan2(this.dodgeDir[0], this.dodgeDir[1]), 11, dt);
      this.moveForward(dt, this.speed * 2.3, world, vehicles);
      this.anim += this.move * dt * 1.9;
      return;
    }

    if (this.hostile || this.cop) {
      this.combatUpdate(dt, ctx, distPlayer, dpx, dpz);
    } else if (this.state === 'flee') {
      const away = Math.atan2(-dpx, -dpz);
      this.yaw = dampAngle(this.yaw, away, 6, dt);
      this.moveForward(dt, this.speed * 2.5, world, game && game.vehicles);
      if (distPlayer > 70 && this.panic <= 0) this.state = 'walk';
    } else {
      this.walkUpdate(dt, world, game && game.vehicles);
      // réaction : arme sortie, coup de feu, voiture qui fonce
      if (game && game.threatLevel > 0 && distPlayer < 26) this.state = 'flee';
    }
    this.anim += this.move * dt * 1.9;
  }

  combatUpdate(dt, ctx, distPlayer, dpx, dpz) {
    const { player, world, game } = ctx;
    const target = this.combatTarget || player;
    const tx = target.x, tz = target.z;
    const dx = tx - this.x, dz = tz - this.z;
    const d = Math.hypot(dx, dz);
    const face = Math.atan2(dx, dz);
    this.yaw = dampAngle(this.yaw, face, 7, dt);
    const canSee = world.visible(this.x, 1.5, this.z, tx, 1.4, tz);
    this.aim = canSee && d < 42;
    if (d > (this.cop ? 12 : 9) || !canSee) {
      this.moveForward(dt, this.speed * (this.cop ? 2.4 : 2.1), world, game && game.vehicles);
    } else {
      this.move = damp(this.move, 0, 8, dt);
    }
    this.weaponCooldown -= dt;
    if (canSee && d < 42 && this.weaponCooldown <= 0 && game) {
      this.weaponCooldown = this.cop ? range(this.rand, 0.42, 0.95) : range(this.rand, 0.5, 1.2);
      game.npcShoot(this, target, d);
    }
  }

  walkUpdate(dt, world, vehicles) {
    if (this.idleT > 0) {                       // on souffle, on regarde son écran
      this.idleT -= dt;
      this.yaw += this.idleTurn * dt;
      this.move = damp(this.move, 0, 8, dt);
      return;
    }
    if (!this.target) { this.move = 0; return; }
    const dx = this.target[0] - this.x, dz = this.target[1] - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.6) {
      const r = this.rand();
      if (r < 0.22 && this.crossStreet(vehicles)) return;   // on traverse
      if (r > 0.86 && !this.jogger) {               // on s'arrête un instant
        this.idleT = 1.4 + this.rand() * 4;
        this.idleTurn = (this.rand() - 0.5) * 0.9;
      }
      this.corner += this.dir;
      if (this.rand() < 0.12) this.dir *= -1;
      this.target = this.cornerPoint(this.corner);
      return;
    }
    this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 5, dt);
    this.moveForward(dt, this.speed, world, vehicles);
  }

  moveForward(dt, speed, world, vehicles) {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    this.x += fx * speed * dt;
    this.z += fz * speed * dt;
    const p = { x: this.x, z: this.z };
    world.pushCircle(p, 0.4, 2);
    if (vehicles) pushOutOfVehicles(p, 0.4, vehicles);
    this.x = p.x; this.z = p.z;
    this.move = clamp(speed / 2.4, 0, 1.4);
  }

  draw(R) {
    if (this.inVehicle) return;
    drawHuman(R, {
      x: this.x, y: this.y, z: this.z, yaw: this.yaw,
      anim: this.anim, move: this.move, aim: this.aim, deadT: this.deadT,
      weapon: this.armed && !this.dead ? { len: this.cop ? 0.3 : 0.44 } : null,
      ...this.look,
    }, this.aim ? 0 : null);
  }
}
