/**
 * Minecraft JS — entités : créatures, objets au sol, flèches, orbes
 * d'expérience, TNT amorcée, et le système de particules.
 *
 * Les modèles sont décrits en pavés (comme les modèles du jeu) : chaque partie
 * a sa taille, sa couleur et son point de pivot, ce qui suffit à animer une
 * marche, un balancement de tête ou les huit pattes d'une araignée.
 */

import { move, inFluid, entitiesOverlap, rayHitsEntity } from './physics.js';
import { BLOCKS, idByName } from './blocks.js';
import { T } from './textures.js';
import { WORLD_H } from './chunk.js';

const GRAVITY = 28;
const AIR = 0;

let nextId = 1;

export class Entity {
  constructor(x, y, z) {
    this.id = nextId++;
    this.x = x; this.y = y; this.z = z;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = 0; this.pitch = 0;
    this.width = 0.6; this.height = 1.8;
    this.onGround = false;
    this.dead = false;
    this.age = 0;
    this.inWater = false;
    this.fallDistance = 0;
  }

  /** Intégration : gravité, frottements, collisions. */
  physics(dt, world, opts = {}) {
    const gravity = opts.gravity ?? GRAVITY;
    this.inWater = inFluid(world, this, 'water');
    const drag = this.inWater ? 0.55 : (opts.drag ?? 0.86);

    this.vy -= gravity * dt * (this.inWater ? 0.35 : 1);
    if (this.inWater) this.vy = Math.max(this.vy, -3);
    this.vy = Math.max(this.vy, -60);

    const hit = move(world, this, this.vx * dt, this.vy * dt, this.vz * dt);
    this.onGround = hit.ground;
    if (hit.ground) {
      if (this.fallDistance > 0) this.onLand?.(this.fallDistance);
      this.fallDistance = 0;
      this.vy = 0;
    } else if (hit.ceiling) this.vy = 0;
    else if (this.vy < 0) this.fallDistance -= this.vy * dt;

    if (hit.x) this.vx = 0;
    if (hit.z) this.vz = 0;

    const groundDrag = opts.groundDrag ?? 0.72;
    const f = this.onGround ? Math.pow(drag * groundDrag, dt * 60) : Math.pow(drag, dt * 60);
    this.vx *= f; this.vz *= f;
    if (Math.abs(this.vx) < 0.003) this.vx = 0;
    if (Math.abs(this.vz) < 0.003) this.vz = 0;
    return hit;
  }

  distanceTo(o) { return Math.hypot(this.x - o.x, this.y - o.y, this.z - o.z); }
}

/* ─────────────────────────── Objets au sol ─────────────────────────── */

export class ItemEntity extends Entity {
  constructor(x, y, z, stack) {
    super(x, y, z);
    this.stack = stack;
    this.width = 0.25; this.height = 0.25;
    this.pickupDelay = 0.5;
    this.spin = Math.random() * Math.PI * 2;
    this.life = 300; // 5 minutes comme dans le jeu
  }

  update(dt, ctx) {
    this.age += dt;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.pickupDelay = Math.max(0, this.pickupDelay - dt);
    this.spin += dt * 1.4;
    this.physics(dt, ctx.world, { drag: 0.82 });

    // Fusion avec un objet identique tout proche : évite les tapis d'objets.
    if (this.age > 0.6 && (ctx.tick % 10 === 0)) {
      for (const o of ctx.entities) {
        if (o === this || o.dead || !(o instanceof ItemEntity)) continue;
        if (o.stack.item !== this.stack.item || o.stack.dmg !== this.stack.dmg) continue;
        if (this.distanceTo(o) > 0.8) continue;
        const max = ctx.maxStack(this.stack.item);
        const room = max - this.stack.count;
        if (room <= 0) continue;
        const moved = Math.min(room, o.stack.count);
        this.stack.count += moved; o.stack.count -= moved;
        if (o.stack.count <= 0) o.dead = true;
      }
    }
  }
}

/* ────────────────────────── Orbes d'expérience ────────────────────────── */

export class XPOrb extends Entity {
  constructor(x, y, z, amount) {
    super(x, y, z);
    this.amount = amount;
    this.width = 0.25; this.height = 0.25;
    this.life = 300;
  }

  update(dt, ctx) {
    this.age += dt; this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    const p = ctx.player;
    const d = this.distanceTo(p);
    if (d < 5 && this.age > 0.2) {
      // Attirée par le joueur, de plus en plus vite.
      const k = (5 - d) * 3.2;
      this.vx += ((p.x - this.x) / d) * k * dt;
      this.vy += ((p.y + 0.8 - this.y) / d) * k * dt;
      this.vz += ((p.z - this.z) / d) * k * dt;
    }
    this.physics(dt, ctx.world, { gravity: 8, drag: 0.9 });
  }
}

/* ──────────────────────────────── Flèches ──────────────────────────────── */

export class Arrow extends Entity {
  constructor(x, y, z, vx, vy, vz, shooter, damage = 4) {
    super(x, y, z);
    this.vx = vx; this.vy = vy; this.vz = vz;
    this.width = 0.15; this.height = 0.15;
    this.shooter = shooter;
    this.damage = damage;
    this.stuck = false;
    this.life = 60;
  }

  update(dt, ctx) {
    this.age += dt; this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (this.stuck) return;

    this.yaw = Math.atan2(-this.vx, this.vz);
    this.pitch = Math.atan2(this.vy, Math.hypot(this.vx, this.vz));

    // Impact sur une créature ?
    const speed = Math.hypot(this.vx, this.vy, this.vz);
    const dist = speed * dt;
    const dir = [this.vx / speed, this.vy / speed, this.vz / speed];
    for (const e of ctx.entities) {
      if (e === this || e.dead || !(e instanceof Mob)) continue;
      if (e === this.shooter) continue;
      const t = rayHitsEntity(this.x, this.y, this.z, dir[0], dir[1], dir[2], e, dist);
      if (t !== null) {
        e.hurt(this.damage, ctx, this.shooter);
        this.dead = true;
        return;
      }
    }
    if (this.shooter && this.shooter.isPlayer === undefined && ctx.player) {
      const t = rayHitsEntity(this.x, this.y, this.z, dir[0], dir[1], dir[2], ctx.player, dist);
      if (t !== null) { ctx.player.hurt(this.damage, 'arrow', ctx); this.dead = true; return; }
    }

    const hit = this.physics(dt, ctx.world, { gravity: 20, drag: 0.99 });
    if (hit.x || hit.y || hit.z) {
      this.stuck = true;
      this.vx = this.vy = this.vz = 0;
      ctx.sound?.('arrowHit', this);
    }
  }
}

/* ──────────────────────────────── TNT ──────────────────────────────── */

export class PrimedTNT extends Entity {
  constructor(x, y, z) {
    super(x, y, z);
    this.width = 0.9; this.height = 0.9;
    this.fuse = 4;
    this.vy = 3;
    this.vx = (Math.random() - 0.5) * 0.6;
    this.vz = (Math.random() - 0.5) * 0.6;
  }

  update(dt, ctx) {
    this.age += dt;
    this.fuse -= dt;
    this.physics(dt, ctx.world, { drag: 0.9 });
    if (this.fuse <= 0) {
      this.dead = true;
      explode(ctx, this.x, this.y + 0.5, this.z, 4);
    }
  }
}

/**
 * Explosion : détruit les blocs peu résistants et projette ce qui est autour.
 */
export function explode(ctx, x, y, z, power) {
  const world = ctx.world;
  const r = Math.ceil(power);
  const drops = [];
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        const d = Math.hypot(dx, dy, dz);
        if (d > power) continue;
        const bx = Math.floor(x + dx), by = Math.floor(y + dy), bz = Math.floor(z + dz);
        if (by < 1 || by >= WORLD_H) continue;
        const id = world.getBlock(bx, by, bz);
        if (!id) continue;
        const bl = BLOCKS[id];
        if (bl.hardness < 0 || bl.hardness > 20) continue; // bedrock, obsidienne
        if (bl.fluid) continue;
        if (Math.random() < d / power * 0.6) continue;
        if (Math.random() < 0.28) drops.push({ x: bx + 0.5, y: by + 0.5, z: bz + 0.5, bl, data: world.getData(bx, by, bz) });
        world.setBlock(bx, by, bz, AIR);
      }
    }
  }
  for (const d of drops) ctx.dropBlock?.(d.x, d.y, d.z, d.bl, d.data);

  // Souffle : dégâts et projection.
  const affect = (e, isPlayer) => {
    const dist = Math.hypot(e.x - x, e.y + e.height / 2 - y, e.z - z);
    if (dist > power * 2) return;
    const f = Math.max(0, 1 - dist / (power * 2));
    const dmg = Math.round(f * f * 14 + f * 3);
    if (dmg > 0) {
      if (isPlayer) e.hurt(dmg, 'explosion', ctx);
      else e.hurt(dmg, ctx, null);
    }
    const n = Math.max(0.001, dist);
    e.vx += ((e.x - x) / n) * f * 14;
    e.vy += ((e.y - y) / n) * f * 10 + f * 4;
    e.vz += ((e.z - z) / n) * f * 14;
  };
  for (const e of ctx.entities) if (e instanceof Mob && !e.dead) affect(e, false);
  if (ctx.player) affect(ctx.player, true);

  ctx.sound?.('explode', { x, y, z });
  ctx.particles?.explosion(x, y, z, power);
}

/* ─────────────────────────── Modèles de créatures ─────────────────────────── */

/** Pavé d'un modèle : position (centre), taille, couleur, animation. */
const box = (pos, size, color, anim = null) => ({ pos, size, color, anim });

export const MOBS = {
  pig: {
    label: 'Cochon', hostile: false, hp: 10, speed: 1.5, width: 0.9, height: 0.9, eye: 0.8,
    xp: [1, 3], drops: [{ item: 'porkchop', min: 1, max: 3 }],
    parts: [
      box([0, 0.5, 0], [0.62, 0.5, 1.0], '#e89aa0'),
      box([0, 0.62, 0.62], [0.5, 0.5, 0.44], '#e89aa0', 'head'),
      box([0, 0.58, 0.87], [0.25, 0.19, 0.12], '#c97b84', 'head'),
      box([-0.12, 0.72, 0.85], [0.08, 0.08, 0.02], '#241a1a', 'head'),
      box([0.12, 0.72, 0.85], [0.08, 0.08, 0.02], '#241a1a', 'head'),
      box([-0.2, 0.19, 0.32], [0.25, 0.38, 0.25], '#d98a90', 'leg0'),
      box([0.2, 0.19, 0.32], [0.25, 0.38, 0.25], '#d98a90', 'leg1'),
      box([-0.2, 0.19, -0.32], [0.25, 0.38, 0.25], '#d98a90', 'leg2'),
      box([0.2, 0.19, -0.32], [0.25, 0.38, 0.25], '#d98a90', 'leg3'),
    ],
  },
  cow: {
    label: 'Vache', hostile: false, hp: 10, speed: 1.4, width: 0.9, height: 1.4, eye: 1.2,
    xp: [1, 3], drops: [{ item: 'beef', min: 1, max: 3 }, { item: 'leather', min: 0, max: 2 }],
    parts: [
      box([0, 0.85, 0], [0.72, 0.62, 1.12], '#4a3b2c'),
      box([0, 0.9, 0], [0.74, 0.4, 0.5], '#e8e2d8'),
      box([0, 1.05, 0.72], [0.5, 0.5, 0.44], '#4a3b2c', 'head'),
      box([0, 0.98, 0.95], [0.32, 0.25, 0.08], '#e8b0a8', 'head'),
      box([-0.28, 1.22, 0.66], [0.14, 0.1, 0.1], '#e8e2d8', 'head'),
      box([0.28, 1.22, 0.66], [0.14, 0.1, 0.1], '#e8e2d8', 'head'),
      box([-0.14, 1.16, 0.92], [0.08, 0.08, 0.02], '#241a1a', 'head'),
      box([0.14, 1.16, 0.92], [0.08, 0.08, 0.02], '#241a1a', 'head'),
      box([-0.24, 0.27, 0.38], [0.25, 0.55, 0.25], '#4a3b2c', 'leg0'),
      box([0.24, 0.27, 0.38], [0.25, 0.55, 0.25], '#4a3b2c', 'leg1'),
      box([-0.24, 0.27, -0.38], [0.25, 0.55, 0.25], '#4a3b2c', 'leg2'),
      box([0.24, 0.27, -0.38], [0.25, 0.55, 0.25], '#4a3b2c', 'leg3'),
    ],
  },
  sheep: {
    label: 'Mouton', hostile: false, hp: 8, speed: 1.4, width: 0.9, height: 1.3, eye: 1.1,
    xp: [1, 3], drops: [{ item: 'mutton', min: 1, max: 2 }],
    parts: [
      box([0, 0.82, 0], [0.72, 0.62, 1.12], '#efeeea', 'wool'),
      box([0, 0.95, 0.66], [0.4, 0.4, 0.5], '#e8e2d8', 'head'),
      box([-0.11, 1.02, 0.88], [0.08, 0.08, 0.02], '#241a1a', 'head'),
      box([0.11, 1.02, 0.88], [0.08, 0.08, 0.02], '#241a1a', 'head'),
      box([-0.22, 0.26, 0.34], [0.22, 0.52, 0.22], '#e8e2d8', 'leg0'),
      box([0.22, 0.26, 0.34], [0.22, 0.52, 0.22], '#e8e2d8', 'leg1'),
      box([-0.22, 0.26, -0.34], [0.22, 0.52, 0.22], '#e8e2d8', 'leg2'),
      box([0.22, 0.26, -0.34], [0.22, 0.52, 0.22], '#e8e2d8', 'leg3'),
    ],
  },
  chicken: {
    label: 'Poule', hostile: false, hp: 4, speed: 1.3, width: 0.4, height: 0.7, eye: 0.6,
    xp: [1, 3], drops: [{ item: 'chicken', min: 1, max: 1 }, { item: 'feather', min: 0, max: 2 }],
    float: true,
    parts: [
      box([0, 0.4, 0], [0.32, 0.32, 0.44], '#efeeea'),
      box([0, 0.6, 0.18], [0.24, 0.28, 0.24], '#efeeea', 'head'),
      box([0, 0.58, 0.34], [0.12, 0.1, 0.1], '#f0a52a', 'head'),
      box([0, 0.72, 0.22], [0.14, 0.1, 0.12], '#c8392a', 'head'),
      box([-0.07, 0.63, 0.29], [0.06, 0.06, 0.02], '#241a1a', 'head'),
      box([0.07, 0.63, 0.29], [0.06, 0.06, 0.02], '#241a1a', 'head'),
      box([-0.18, 0.42, 0], [0.06, 0.28, 0.34], '#e6e4de'),
      box([0.18, 0.42, 0], [0.06, 0.28, 0.34], '#e6e4de'),
      box([-0.09, 0.12, 0], [0.08, 0.24, 0.08], '#f0a52a', 'leg0'),
      box([0.09, 0.12, 0], [0.08, 0.24, 0.08], '#f0a52a', 'leg1'),
    ],
  },
  villager: {
    label: 'Villageois', hostile: false, hp: 20, speed: 1.1, width: 0.6, height: 1.95, eye: 1.7,
    xp: [0, 0], drops: [], sedentaire: true,
    parts: [
      box([0, 1.05, 0], [0.5, 0.85, 0.3], '#7d5539'),
      box([0, 1.45, 0], [0.52, 0.12, 0.32], '#b0483a'),
      box([0, 1.68, 0], [0.5, 0.5, 0.5], '#c8956a'),
      box([0, 1.62, 0.3], [0.12, 0.26, 0.12], '#b07a52'),
      box([0, 1.84, 0.27], [0.5, 0.06, 0.03], '#3f2f22'),
      box([-0.14, 1.74, 0.26], [0.09, 0.09, 0.02], '#241a1a'),
      box([0.14, 1.74, 0.26], [0.09, 0.09, 0.02], '#241a1a'),
      box([0, 1.2, 0.24], [0.62, 0.28, 0.18], '#6b472f'),
      box([-0.13, 0.34, 0], [0.25, 0.68, 0.25], '#4a3a2a', 'leg0'),
      box([0.13, 0.34, 0], [0.25, 0.68, 0.25], '#4a3a2a', 'leg1'),
    ],
  },
  zombie: {
    label: 'Zombie', hostile: true, hp: 20, speed: 1.9, width: 0.6, height: 1.95, eye: 1.7,
    damage: 3, xp: [5, 5], burnsInSun: true,
    drops: [{ item: 'rotten_flesh', min: 0, max: 2 }],
    parts: [
      box([0, 1.05, 0], [0.5, 0.75, 0.25], '#3f6b3a'),
      box([0, 1.65, 0], [0.5, 0.5, 0.5], '#5b9e50', 'head'),
      box([-0.13, 1.72, 0.24], [0.1, 0.1, 0.03], '#1a2a1a', 'head'),
      box([0.13, 1.72, 0.24], [0.1, 0.1, 0.03], '#1a2a1a', 'head'),
      box([-0.37, 1.15, 0.2], [0.25, 0.72, 0.25], '#5b9e50', 'arm0'),
      box([0.37, 1.15, 0.2], [0.25, 0.72, 0.25], '#5b9e50', 'arm1'),
      box([-0.13, 0.34, 0], [0.25, 0.68, 0.25], '#3a4b8a', 'leg0'),
      box([0.13, 0.34, 0], [0.25, 0.68, 0.25], '#3a4b8a', 'leg1'),
    ],
  },
  skeleton: {
    label: 'Squelette', hostile: true, hp: 20, speed: 1.9, width: 0.6, height: 1.95, eye: 1.7,
    damage: 2, xp: [5, 5], burnsInSun: true, ranged: true,
    drops: [{ item: 'bone', min: 0, max: 2 }, { item: 'arrow', min: 0, max: 2 }],
    parts: [
      box([0, 1.05, 0], [0.4, 0.75, 0.2], '#d4d4d4'),
      box([0, 1.65, 0], [0.5, 0.5, 0.5], '#e2e2e2', 'head'),
      box([-0.13, 1.72, 0.24], [0.1, 0.1, 0.03], '#141414', 'head'),
      box([0.13, 1.72, 0.24], [0.1, 0.1, 0.03], '#141414', 'head'),
      box([-0.3, 1.15, 0.15], [0.14, 0.72, 0.14], '#d4d4d4', 'arm0'),
      box([0.3, 1.15, 0.15], [0.14, 0.72, 0.14], '#d4d4d4', 'arm1'),
      box([-0.11, 0.34, 0], [0.14, 0.68, 0.14], '#d4d4d4', 'leg0'),
      box([0.11, 0.34, 0], [0.14, 0.68, 0.14], '#d4d4d4', 'leg1'),
    ],
  },
  creeper: {
    label: 'Creeper', hostile: true, hp: 20, speed: 1.7, width: 0.6, height: 1.7, eye: 1.5,
    damage: 0, xp: [5, 5], explodes: true,
    drops: [{ item: 'gunpowder', min: 0, max: 2 }],
    parts: [
      box([0, 0.9, 0], [0.5, 0.75, 0.25], '#4f9e3f'),
      box([0, 1.5, 0], [0.5, 0.5, 0.5], '#5cb04a', 'head'),
      box([-0.13, 1.57, 0.24], [0.12, 0.12, 0.03], '#141414', 'head'),
      box([0.13, 1.57, 0.24], [0.12, 0.12, 0.03], '#141414', 'head'),
      box([0, 1.42, 0.24], [0.12, 0.2, 0.03], '#141414', 'head'),
      box([-0.13, 0.19, 0.19], [0.25, 0.38, 0.25], '#4f9e3f', 'leg0'),
      box([0.13, 0.19, 0.19], [0.25, 0.38, 0.25], '#4f9e3f', 'leg1'),
      box([-0.13, 0.19, -0.19], [0.25, 0.38, 0.25], '#4f9e3f', 'leg2'),
      box([0.13, 0.19, -0.19], [0.25, 0.38, 0.25], '#4f9e3f', 'leg3'),
    ],
  },
  spider: {
    label: 'Araignée', hostile: true, hp: 16, speed: 2.6, width: 1.4, height: 0.9, eye: 0.7,
    damage: 2, xp: [5, 5], climbs: true,
    drops: [{ item: 'string', min: 0, max: 2 }, { item: 'spider_eye', min: 0, max: 1, chance: 0.33 }],
    parts: [
      box([0, 0.45, -0.25], [0.62, 0.5, 0.62], '#2f2222'),
      box([0, 0.45, 0.3], [0.5, 0.44, 0.44], '#3a2a2a', 'head'),
      box([-0.14, 0.52, 0.5], [0.1, 0.1, 0.03], '#c81b1b', 'head'),
      box([0.14, 0.52, 0.5], [0.1, 0.1, 0.03], '#c81b1b', 'head'),
      box([-0.5, 0.35, 0.25], [0.7, 0.1, 0.1], '#2a1c1c', 'leg0'),
      box([0.5, 0.35, 0.25], [0.7, 0.1, 0.1], '#2a1c1c', 'leg1'),
      box([-0.5, 0.35, 0.05], [0.7, 0.1, 0.1], '#2a1c1c', 'leg2'),
      box([0.5, 0.35, 0.05], [0.7, 0.1, 0.1], '#2a1c1c', 'leg3'),
      box([-0.5, 0.35, -0.15], [0.7, 0.1, 0.1], '#2a1c1c', 'leg1'),
      box([0.5, 0.35, -0.15], [0.7, 0.1, 0.1], '#2a1c1c', 'leg0'),
      box([-0.5, 0.35, -0.35], [0.7, 0.1, 0.1], '#2a1c1c', 'leg3'),
      box([0.5, 0.35, -0.35], [0.7, 0.1, 0.1], '#2a1c1c', 'leg2'),
    ],
  },
};

export const PASSIVE = ['pig', 'cow', 'sheep', 'chicken'];
export const HOSTILE = ['zombie', 'skeleton', 'creeper', 'spider'];

/* ──────────────────────────── Créatures ──────────────────────────── */

export class Mob extends Entity {
  constructor(type, x, y, z) {
    super(x, y, z);
    const m = MOBS[type];
    this.type = type;
    this.def = m;
    this.width = m.width;
    this.height = m.height;
    this.hp = m.hp;
    this.maxHp = m.hp;
    this.hurtTime = 0;
    this.attackCd = 0;
    this.state = 'idle';
    this.stateTime = 0;
    this.limbSwing = 0;
    this.headYaw = 0;
    this.fuse = 0;
    this.burning = 0;
    this.sheared = false;
    this.wanderTarget = null;
    this.yaw = Math.random() * Math.PI * 2;
    this.eggTimer = 300 + Math.random() * 300;
  }

  get hostile() { return this.def.hostile; }

  update(dt, ctx) {
    this.age += dt;
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.stateTime -= dt;

    const player = ctx.player;
    const dist = player && !player.dead ? this.distanceTo(player) : Infinity;

    // Disparition des créatures trop lointaines (comme dans le jeu).
    if (dist > 110) { this.dead = true; return; }
    // Les villageois ne disparaissent pas : leur village serait vide au retour.
    if (!this.def.sedentaire && dist > 40 && this.age > 30 && Math.random() < dt * 0.02) { this.dead = true; return; }

    this.think(dt, ctx, player, dist);
    this.applyMovement(dt, ctx);
    this.environment(dt, ctx);
  }

  /** Choix de la conduite : errer, poursuivre, attaquer, fuir. */
  think(dt, ctx, player, dist) {
    const d = this.def;
    const canSee = dist < 26 && this.hasLineOfSight(ctx.world, player);
    const nightTime = ctx.world.isNight();

    if (d.hostile && player && !player.dead && player.mode !== 'creative') {
      const range = this.type === 'spider' && !nightTime ? 8 : 20;
      if (dist < range && canSee) {
        this.state = 'chase';
        this.target = player;
      } else if (this.state === 'chase' && dist > 32) this.state = 'idle';
    } else if (this.state === 'flee' && this.stateTime <= 0) this.state = 'idle';

    if (this.state === 'chase' && this.target) {
      this.faceTo(this.target.x, this.target.z);
      const close = dist < (this.width + this.target.width) / 2 + 0.6;

      if (d.explodes) {
        if (dist < 3.2) {
          this.fuse += dt;
          this.moveForward = dist > 1.6 ? 0.3 : 0;
          if (this.fuse > 1.5) {
            this.dead = true;
            explode(ctx, this.x, this.y + 0.8, this.z, 3.2);
          }
        } else { this.fuse = Math.max(0, this.fuse - dt * 0.5); this.moveForward = 1; }
        return;
      }

      if (d.ranged) {
        this.moveForward = dist > 9 ? 1 : dist < 4 ? -0.6 : 0.25;
        if (this.attackCd <= 0 && dist < 16 && dist > 2) {
          this.shootArrow(ctx, this.target);
          this.attackCd = 1.8 + Math.random() * 0.6;
        }
        return;
      }

      this.moveForward = close ? 0 : 1;
      if (close && this.attackCd <= 0) {
        this.target.hurt(d.damage, 'mob', ctx, this);
        this.attackCd = 1;
        ctx.sound?.('hurt', this);
      }
      return;
    }

    // Flânerie
    this.moveForward = 0;
    if (this.stateTime <= 0) {
      this.stateTime = 2 + Math.random() * 5;
      if (Math.random() < 0.55) {
        this.state = 'wander';
        this.yaw += (Math.random() - 0.5) * 2.6;
      } else this.state = 'idle';
    }
    if (this.state === 'wander' || this.state === 'flee') this.moveForward = this.state === 'flee' ? 1.35 : 0.65;
  }

  faceTo(x, z) {
    const target = Math.atan2(-(x - this.x), z - this.z);
    let diff = target - this.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.yaw += Math.max(-0.25, Math.min(0.25, diff));
  }

  hasLineOfSight(world, other) {
    if (!other) return false;
    const ox = this.x, oy = this.y + this.def.eye, oz = this.z;
    const dx = other.x - ox, dy = (other.y + other.height * 0.8) - oy, dz = other.z - oz;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.1) return true;
    const hit = world.raycast(ox, oy, oz, dx / len, dy / len, dz / len, Math.min(len, 30));
    return !hit || hit.dist >= len - 0.6;
  }

  shootArrow(ctx, target) {
    const ox = this.x, oy = this.y + this.def.eye - 0.2, oz = this.z;
    const dx = target.x - ox;
    const dy = (target.y + target.height * 0.6) - oy;
    const dz = target.z - oz;
    const len = Math.hypot(dx, dy, dz);
    const speed = 24;
    const spread = 0.04;
    const a = new Arrow(ox, oy, oz,
      (dx / len) * speed + (Math.random() - 0.5) * spread * speed,
      (dy / len) * speed + len * 0.06 + (Math.random() - 0.5) * spread * speed,
      (dz / len) * speed + (Math.random() - 0.5) * spread * speed,
      this, 3);
    ctx.spawn(a);
    ctx.sound?.('bow', this);
  }

  applyMovement(dt, ctx) {
    const speed = this.def.speed * (this.state === 'flee' ? 1.4 : 1);
    // On vise directement la vitesse voulue : les créatures gèrent leur propre
    // « frottement », sinon celui du sol les immobiliserait presque.
    if (this.moveForward) {
      const s = speed * this.moveForward;
      const tvx = -Math.sin(this.yaw) * s;
      const tvz = Math.cos(this.yaw) * s;
      const k = Math.min(1, dt * (this.onGround ? 14 : 3));
      this.vx += (tvx - this.vx) * k;
      this.vz += (tvz - this.vz) * k;
      this.limbSwing += Math.hypot(this.vx, this.vz) * dt * 2.4;
    } else {
      const k = Math.min(1, dt * 12);
      this.vx -= this.vx * k;
      this.vz -= this.vz * k;
      this.limbSwing += dt * 0.4;
    }

    const before = { x: this.x, z: this.z };
    const hit = this.physics(dt, ctx.world, { drag: 1, groundDrag: 1 });

    // Sauter par-dessus un obstacle d'un bloc, ou grimper (araignée).
    if ((hit.x || hit.z) && this.moveForward) {
      if (this.def.climbs) this.vy = 3.2;
      else if (this.onGround) {
        const fx = this.x - Math.sin(this.yaw) * 0.6;
        const fz = this.z + Math.cos(this.yaw) * 0.6;
        const feet = ctx.world.getBlock(Math.floor(fx), Math.floor(this.y), Math.floor(fz));
        const head = ctx.world.getBlock(Math.floor(fx), Math.floor(this.y + 1.2), Math.floor(fz));
        if (BLOCKS[feet].solid && !BLOCKS[head].solid) this.vy = 7.6;
        else if (Math.random() < 0.1) this.yaw += (Math.random() - 0.5) * 2;
      }
    }
    if (this.inWater && this.vy < 1.5) this.vy += 12 * dt;
    if (this.def.float && this.vy < -1.5) this.vy = -1.5;

    // Éviter de tomber d'une falaise sans raison.
    if (this.onGround && this.moveForward && this.state !== 'chase') {
      const fx = Math.floor(this.x - Math.sin(this.yaw) * 0.8);
      const fz = Math.floor(this.z + Math.cos(this.yaw) * 0.8);
      let drop = 0;
      for (let dy = 1; dy <= 4; dy++) {
        if (BLOCKS[ctx.world.getBlock(fx, Math.floor(this.y) - dy, fz)].solid) break;
        drop = dy;
      }
      if (drop >= 3) { this.x = before.x; this.z = before.z; this.yaw += 2.2; this.vx = this.vz = 0; }
    }
  }

  /** Feu du jour, noyade, dégâts de chute, cactus, lave. */
  environment(dt, ctx) {
    const world = ctx.world;
    if (this.def.burnsInSun && world.isDay() && !this.inWater) {
      const sky = world.getSkyLight(Math.floor(this.x), Math.floor(this.y + this.height * 0.8), Math.floor(this.z));
      if (sky >= 14 && world.skyBrightness() > 0.6) {
        this.burning = Math.max(this.burning, 1);
      }
    }
    if (this.burning > 0) {
      this.burning -= dt;
      this.burnTick = (this.burnTick || 0) + dt;
      if (this.burnTick > 1) { this.burnTick = 0; this.hurt(1, ctx, null); }
      ctx.particles?.flame(this.x, this.y + this.height * 0.6, this.z, 1);
    }
    const feet = BLOCKS[world.getBlock(Math.floor(this.x), Math.floor(this.y + 0.2), Math.floor(this.z))];
    if (feet.hurt) {
      this.envTick = (this.envTick || 0) + dt;
      if (this.envTick > 0.5) { this.envTick = 0; this.hurt(feet.hurt, ctx, null); if (feet.fluid === 'lava') this.burning = 6; }
    }
    if (this.type === 'chicken' && !this.def.hostile) {
      this.eggTimer -= dt;
      if (this.eggTimer <= 0) {
        this.eggTimer = 300 + Math.random() * 300;
        ctx.dropItem?.(this.x, this.y + 0.3, this.z, { item: 'egg', count: 1, dmg: 0 });
      }
    }
  }

  onLand(fallDistance) {
    if (fallDistance > 3.5) this.pendingFallDamage = Math.floor(fallDistance - 3);
  }

  hurt(amount, ctx, source) {
    if (this.dead || this.hurtTime > 0.25) return;
    this.hp -= amount;
    this.hurtTime = 0.5;
    ctx.sound?.('hurt', this);
    ctx.particles?.damage(this.x, this.y + this.height * 0.6, this.z);
    if (source) {
      const dx = this.x - source.x, dz = this.z - source.z;
      const n = Math.hypot(dx, dz) || 1;
      this.vx += (dx / n) * 5.5; this.vz += (dz / n) * 5.5; this.vy = Math.max(this.vy, 4.2);
    }
    if (!this.def.hostile) {
      this.state = 'flee';
      this.stateTime = 4;
      if (source) this.yaw = Math.atan2(-(this.x - source.x), this.z - source.z);
    } else if (source && this.state !== 'chase') {
      this.state = 'chase';
      this.target = source;
    }
    if (this.hp <= 0) this.die(ctx, source);
  }

  die(ctx, source) {
    this.dead = true;
    ctx.sound?.('death', this);
    ctx.particles?.death(this.x, this.y + this.height * 0.5, this.z, this.def.parts[0].color);
    for (const d of this.def.drops) {
      if (d.chance !== undefined && Math.random() > d.chance) continue;
      const n = d.min + Math.floor(Math.random() * (d.max - d.min + 1));
      if (n > 0) {
        let item = d.item;
        // Le feu cuit la viande, comme dans le jeu.
        if (this.burning > 0) {
          const cooked = { porkchop: 'cooked_porkchop', beef: 'cooked_beef', chicken: 'cooked_chicken', mutton: 'cooked_mutton' };
          if (cooked[item]) item = cooked[item];
        }
        ctx.dropItem?.(this.x, this.y + this.height * 0.4, this.z, { item, count: n, dmg: 0 });
      }
    }
    if (this.type === 'sheep' && !this.sheared) {
      ctx.dropItem?.(this.x, this.y + 0.5, this.z, { item: 'wool_white', count: 1, dmg: 0 });
    }
    const [xmin, xmax] = this.def.xp;
    const xp = xmin + Math.floor(Math.random() * (xmax - xmin + 1));
    if (xp > 0) ctx.spawnXP?.(this.x, this.y + 0.5, this.z, xp);
  }
}

/* ────────────────────────── Apparition naturelle ────────────────────────── */

/**
 * L'emplacement convient-il à une créature terrestre ?
 * Il faut un sol solide et sec, et deux blocs libres au-dessus : sans le test
 * des fluides, les monstres apparaissaient au fond de l'eau, la mer étant
 * « non solide » pour le calcul de hauteur.
 */
function placeLibre(world, x, y, z) {
  const sol = BLOCKS[world.getBlock(x, y - 1, z)];
  if (!sol.solid || sol.fluid) return false;
  for (const dy of [0, 1]) {
    const b = BLOCKS[world.getBlock(x, y + dy, z)];
    if (b.solid || b.fluid) return false;
  }
  return true;
}

/**
 * Fait apparaître des créatures autour du joueur, avec les règles du jeu :
 * les hostiles dans le noir, les paisibles sur l'herbe en pleine lumière.
 */
export function spawnCycle(ctx) {
  const { world, player, entities } = ctx;
  let hostiles = 0, passives = 0;
  for (const e of entities) {
    if (!(e instanceof Mob)) continue;
    if (e.def.hostile) hostiles++; else passives++;
  }
  const maxHostile = world.isNight() ? 22 : 6;
  const maxPassive = 14;

  for (let attempt = 0; attempt < 14; attempt++) {
    const hostile = Math.random() < (world.isNight() ? 0.8 : 0.35);
    if (hostile && hostiles >= maxHostile) continue;
    if (!hostile && passives >= maxPassive) continue;

    const ang = Math.random() * Math.PI * 2;
    const r = 20 + Math.random() * 28;
    const x = Math.floor(player.x + Math.cos(ang) * r);
    const z = Math.floor(player.z + Math.sin(ang) * r);
    if (!world.isLoaded(x, z)) continue;
    const y = world.topSolidY(x, z);
    if (y < 2 || y > WORLD_H - 4) continue;

    if (!placeLibre(world, x, y, z)) continue;
    const ground = BLOCKS[world.getBlock(x, y - 1, z)];

    const lightHere = Math.max(world.getBlockLight(x, y, z), Math.round(world.getSkyLight(x, y, z) * world.skyBrightness()));
    let type;
    if (hostile) {
      if (lightHere > 7) continue;
      type = HOSTILE[(Math.random() * HOSTILE.length) | 0];
    } else {
      if (lightHere < 9 || ground.name !== 'grass_block') continue;
      type = PASSIVE[(Math.random() * PASSIVE.length) | 0];
    }
    if (Math.hypot(x - player.x, z - player.z) < 16) continue;

    // Un petit groupe, comme les hordes du jeu.
    const groupSize = hostile ? 1 + ((Math.random() * 2) | 0) : 2 + ((Math.random() * 3) | 0);
    for (let i = 0; i < groupSize; i++) {
      const gx = x + (Math.random() * 5 - 2.5);
      const gz = z + (Math.random() * 5 - 2.5);
      const gy = world.topSolidY(Math.floor(gx), Math.floor(gz));
      if (Math.abs(gy - y) > 2) continue;
      if (!placeLibre(world, Math.floor(gx), gy, Math.floor(gz))) continue;
      ctx.spawn(new Mob(type, gx + 0.5, gy, gz + 0.5));
      if (hostile) hostiles++; else passives++;
    }
    break;
  }
}

/* ──────────────────────────── Particules ──────────────────────────── */

export class Particles {
  constructor(max = 1600) {
    this.list = [];
    this.max = max;
  }

  add(p) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push(p);
  }

  /** Éclats d'un bloc cassé : un morceau de sa propre texture. */
  block(x, y, z, layer, count = 12, spread = 0.6) {
    for (let i = 0; i < count; i++) {
      this.add({
        x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread, z: z + (Math.random() - 0.5) * spread,
        vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3.5, vz: (Math.random() - 0.5) * 3,
        life: 0.6 + Math.random() * 0.8, size: 0.09 + Math.random() * 0.05,
        layer, uvScale: 0.25, uvOffX: Math.random() * 0.75, uvOffY: Math.random() * 0.75,
        gravity: 20, light: 1,
      });
    }
  }

  damage(x, y, z) {
    for (let i = 0; i < 6; i++) {
      this.add({
        x, y, z,
        vx: (Math.random() - 0.5) * 2.4, vy: Math.random() * 2.4, vz: (Math.random() - 0.5) * 2.4,
        life: 0.35, size: 0.11, layer: T('white'), color: [1, 0.15, 0.15, 1], gravity: 14, light: 1,
        uvScale: 0.2, uvOffX: 0.4, uvOffY: 0.4,
      });
    }
  }

  death(x, y, z) {
    for (let i = 0; i < 20; i++) {
      this.add({
        x, y, z,
        vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 3,
        life: 0.8, size: 0.12, layer: T('white'), gravity: 8, light: 0.6,
        uvScale: 0.2, uvOffX: 0.4, uvOffY: 0.4,
      });
    }
  }

  explosion(x, y, z, power) {
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI;
      const s = Math.random() * power * 2.4;
      this.add({
        x, y, z,
        vx: Math.sin(b) * Math.cos(a) * s, vy: Math.cos(b) * s, vz: Math.sin(b) * Math.sin(a) * s,
        life: 0.7 + Math.random(), size: 0.35 + Math.random() * 0.5,
        layer: T('white'), gravity: 2, light: 1,
        uvScale: 0.2, uvOffX: 0.4, uvOffY: 0.4,
        fade: true,
      });
    }
  }

  flame(x, y, z, n = 1) {
    for (let i = 0; i < n; i++) {
      this.add({
        x: x + (Math.random() - 0.5) * 0.4, y: y + Math.random() * 0.4, z: z + (Math.random() - 0.5) * 0.4,
        vx: 0, vy: 1.2, vz: 0, life: 0.5, size: 0.16, layer: T('lava'), gravity: -2, light: 1,
        uvScale: 0.3, uvOffX: 0.3, uvOffY: 0.3,
      });
    }
  }

  splash(x, y, z, n = 8) {
    for (let i = 0; i < n; i++) {
      this.add({
        x: x + (Math.random() - 0.5) * 0.6, y, z: z + (Math.random() - 0.5) * 0.6,
        vx: (Math.random() - 0.5) * 2, vy: 1.5 + Math.random() * 2, vz: (Math.random() - 0.5) * 2,
        life: 0.6, size: 0.1, layer: T('water'), gravity: 16, light: 1,
        uvScale: 0.25, uvOffX: 0.3, uvOffY: 0.3,
      });
    }
  }

  update(dt, world) {
    const out = [];
    for (const p of this.list) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy -= (p.gravity ?? 16) * dt;
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
      // Rebond simple sur le décor.
      if (BLOCKS[world.getBlock(Math.floor(nx), Math.floor(p.y), Math.floor(p.z))].solid) { p.vx *= -0.3; }
      else p.x = nx;
      if (BLOCKS[world.getBlock(Math.floor(p.x), Math.floor(ny), Math.floor(p.z))].solid) { p.vy *= -0.28; p.vx *= 0.7; p.vz *= 0.7; }
      else p.y = ny;
      if (BLOCKS[world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(nz))].solid) { p.vz *= -0.3; }
      else p.z = nz;
      out.push(p);
    }
    this.list = out;
  }
}
