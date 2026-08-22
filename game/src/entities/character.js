/**
 * Personnages : silhouette humaine articulée (boîtes), animation procédurale
 * de marche / course / visée, piétons autonomes qui longent les îlots,
 * panique collective et morts.
 */
import { m4, m4compose, m4mul, color, shade, clamp, lerp, damp, dampAngle, wrapAngle, rng, range, pick, dist2D } from '../engine/math.js';

const SKIN = ['#e8b48c', '#c98d63', '#8d5a3b', '#f0c9a6', '#6b4229', '#d9a077'];
const SHIRT = ['#d8453c', '#2f6fb4', '#e6e6e6', '#3f9a5c', '#e0a33a', '#7a4f9a', '#2b2f36', '#d97ea8', '#4fb0c0', '#f0f0f0'];
const PANTS = ['#2f3947', '#3a3a3a', '#5c4a34', '#22304a', '#6b6b6b', '#1f1f24'];
const HAIR = ['#241a12', '#4a3620', '#7a5a32', '#1a1a1a', '#a08050', '#5a5a5a'];

const tmpA = m4(), tmpB = m4();

/**
 * Dessine un humanoïde.
 * @param {object} s état : x,y,z,yaw,anim(0..1 phase),move(0..1),aim,dead,crouch
 */
export function drawHuman(R, s, look = null) {
  const dead = s.deadT !== undefined && s.deadT > 0;
  const fall = dead ? clamp(s.deadT * 3.2, 0, 1) : 0;
  const pitch = fall * Math.PI * 0.47;
  const drop = fall * 0.62;
  const base = m4compose(tmpA, s.x, s.y - drop * 0.0, s.z, s.yaw, 1, 1, 1, 0, 0);
  const bodyM = m4();
  if (fall > 0) {
    m4compose(bodyM, 0, 0, 0, 0, 1, 1, 1, pitch, 0);
    m4mul(base, base, bodyM);
  }
  const swing = Math.sin(s.anim * Math.PI * 2) * (0.35 + s.move * 0.65) * (1 - fall);
  const swing2 = Math.sin(s.anim * Math.PI * 2 + Math.PI) * (0.35 + s.move * 0.65) * (1 - fall);
  const bob = Math.abs(Math.sin(s.anim * Math.PI)) * 0.045 * s.move * (1 - fall);
  const crouch = s.crouch ? 0.24 : 0;
  const legLen = 0.86, armLen = 0.62;
  const hipY = 0.92 - crouch + bob;
  const skin = s.skin || [0.9, 0.72, 0.55];
  const shirt = s.shirt || [0.8, 0.25, 0.22];
  const pants = s.pants || [0.2, 0.24, 0.3];
  const hair = s.hair || [0.15, 0.11, 0.08];
  const shoe = [0.12, 0.11, 0.1];

  const part = (px, py, pz, sx, sy, sz, c, rx = 0, ry = 0, rz = 0, emit = 0) => {
    m4compose(tmpB, px, py, pz, ry, sx, sy, sz, rx, rz);
    m4mul(tmpB, base, tmpB);
    R.cube(tmpB, c, emit);
  };

  // jambes (pivot à la hanche)
  for (const [sx, a] of [[-1, swing], [1, swing2]]) {
    const cx = sx * 0.13;
    part(cx, hipY - Math.cos(a) * legLen / 2, -Math.sin(a) * legLen / 2, 0.19, legLen, 0.21, pants, a);
    part(cx, hipY - Math.cos(a) * legLen - 0.02, -Math.sin(a) * legLen + 0.04, 0.2, 0.11, 0.3, shoe, a * 0.4);
  }
  // torse
  const lean = s.aim ? 0.08 : s.move * 0.12;
  part(0, hipY + 0.34, 0, 0.46, 0.68, 0.27, shirt, lean);
  part(0, hipY + 0.64, 0, 0.4, 0.14, 0.25, skin, 0);
  // bras
  const aimAngle = s.aim ? -Math.PI / 2 + (look ? clamp(-look, -0.6, 0.6) : 0) : 0;
  for (const [sx, a0] of [[-1, swing2], [1, swing]]) {
    const a = s.aim ? aimAngle : a0 * 0.8;
    const shoulderY = hipY + 0.6;
    const cx = sx * 0.31;
    part(cx, shoulderY - Math.cos(a) * armLen / 2, -Math.sin(a) * armLen / 2, 0.15, armLen, 0.17,
      sx > 0 || !s.aim ? shirt : shirt, a);
    part(cx, shoulderY - Math.cos(a) * armLen - 0.03, -Math.sin(a) * armLen, 0.14, 0.14, 0.16, skin, a);
  }
  // tête
  const headY = hipY + 0.82;
  part(0, headY, 0.01, 0.25, 0.28, 0.26, skin, 0, look ? clamp(look * 0.3, -0.4, 0.4) : 0);
  part(0, headY + 0.15, -0.01, 0.27, 0.09, 0.28, hair);
  if (s.hat) part(0, headY + 0.22, 0, 0.3, 0.12, 0.31, s.hatColor || [0.1, 0.12, 0.2]);
}

/** Habillage aléatoire cohérent. */
export function randomLook(rand) {
  return {
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

  /** Périmètre de l'îlot que le piéton longe. */
  setBlock(b) {
    this.block = b;
    this.corner = Math.floor(Math.random() * 4);
    this.target = this.cornerPoint(this.corner);
  }

  cornerPoint(i) {
    const b = this.block;
    if (!b) return null;
    const r = b.half + 2.3;
    const pts = [[b.x - r, b.z - r], [b.x + r, b.z - r], [b.x + r, b.z + r], [b.x - r, b.z + r]];
    return pts[((i % 4) + 4) % 4];
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

    if (this.hostile || this.cop) {
      this.combatUpdate(dt, ctx, distPlayer, dpx, dpz);
    } else if (this.state === 'flee') {
      const away = Math.atan2(-dpx, -dpz);
      this.yaw = dampAngle(this.yaw, away, 6, dt);
      this.moveForward(dt, this.speed * 2.5, world);
      if (distPlayer > 70 && this.panic <= 0) this.state = 'walk';
    } else {
      this.walkUpdate(dt, world);
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
      this.moveForward(dt, this.speed * (this.cop ? 2.4 : 2.1), world);
    } else {
      this.move = damp(this.move, 0, 8, dt);
    }
    this.weaponCooldown -= dt;
    if (canSee && d < 42 && this.weaponCooldown <= 0 && game) {
      this.weaponCooldown = this.cop ? range(Math.random, 0.42, 0.95) : range(Math.random, 0.5, 1.2);
      game.npcShoot(this, target, d);
    }
  }

  walkUpdate(dt, world) {
    if (!this.target) { this.move = 0; return; }
    const dx = this.target[0] - this.x, dz = this.target[1] - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.6) {
      this.corner += this.dir;
      if (Math.random() < 0.12) this.dir *= -1;
      this.target = this.cornerPoint(this.corner);
      return;
    }
    this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 5, dt);
    this.moveForward(dt, this.speed, world);
  }

  moveForward(dt, speed, world) {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    this.x += fx * speed * dt;
    this.z += fz * speed * dt;
    const p = { x: this.x, z: this.z };
    world.pushCircle(p, 0.4, 2);
    this.x = p.x; this.z = p.z;
    this.move = clamp(speed / 2.4, 0, 1.4);
  }

  draw(R) {
    if (this.inVehicle) return;
    drawHuman(R, {
      x: this.x, y: this.y, z: this.z, yaw: this.yaw,
      anim: this.anim, move: this.move, aim: this.aim, deadT: this.deadT,
      ...this.look,
    });
    if (this.armed && !this.dead) {
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      const lx = 0.3, lz = this.aim ? 0.5 : 0.15;
      m4compose(tmpB, this.x + lx * c + lz * s, 1.28, this.z - lx * s + lz * c, this.yaw, 0.08, 0.14, 0.42);
      R.cube(tmpB, [0.12, 0.12, 0.14]);
    }
  }
}
