/**
 * Minecraft JS — le joueur.
 *
 * Déplacement (marche, course, accroupissement, nage, vol créatif), minage
 * progressif selon l'outil, pose de blocs, faim, santé, expérience, sommeil.
 * Les valeurs suivent celles du jeu : 4,317 blocs/s à la marche, 20 points de
 * vie, 20 de nourriture, dégâts de chute au-delà de 3 blocs.
 */

import { Entity } from './entities.js';
import { move, inFluid, supportedAt } from './physics.js';
import { BLOCKS, block, idByName, breakTime, canHarvest, blockDrops, FACING_TO_FACE } from './blocks.js';
import { PlayerInventory } from './inventory.js';
import { getItem, toolStats, attackDamage, stack } from './items.js';
import { WORLD_H } from './chunk.js';

const WALK = 4.317;
const SPRINT = 5.612;
const SNEAK = 1.31;
const SWIM = 2.2;
const FLY = 10.9;
const JUMP_V = 8.4;
const GRAVITY = 28;
const REACH = 5;
const REACH_CREATIVE = 6;

const ID = {};
for (const n of ['air', 'water', 'lava', 'farmland', 'dirt', 'grass_block', 'coarse_dirt', 'wheat',
  'crafting_table', 'furnace', 'furnace_lit', 'chest', 'bed', 'torch', 'ladder', 'tnt', 'cactus',
  'snow_block', 'ice', 'obsidian']) ID[n] = idByName(n);

export class Player extends Entity {
  constructor(opts = {}) {
    super(opts.x ?? 0.5, opts.y ?? 70, opts.z ?? 0.5);
    this.isPlayer = true;
    this.width = 0.6;
    this.height = 1.8;
    this.eyeHeight = 1.62;
    this.mode = opts.mode ?? 'survival';
    this.inventory = new PlayerInventory();

    this.health = 20;
    this.food = 20;
    this.saturation = 5;
    this.exhaustion = 0;
    this.air = 300;
    this.xp = 0;
    this.level = 0;

    this.yaw = 0; this.pitch = 0;
    this.sprinting = false;
    this.sneaking = false;
    this.flying = false;
    this.onLadder = false;
    this.inWater = false;
    this.headInWater = false;
    this.headInLava = false;

    this.breakTarget = null;
    this.breakProgress = 0;
    this.swing = 0;
    this.useCooldown = 0;
    this.eatingTime = 0;
    this.bowCharge = -1;
    this.hurtFlash = 0;
    this.invulnerable = 0;
    this.dead = false;
    this.sleeping = false;
    this.spawnPoint = null;
    this.bobbing = 0;
    this.lastDamageCause = null;
    this.stats = { blocksMined: 0, blocksPlaced: 0, distance: 0, deaths: 0, mobsKilled: 0 };
  }

  get eyeY() { return this.y + (this.sneaking ? this.eyeHeight - 0.22 : this.eyeHeight); }
  get reach() { return this.mode === 'creative' ? REACH_CREATIVE : REACH; }

  /** Direction du regard. */
  lookVector() {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    return [-Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp];
  }

  /* ──────────────────────────── Boucle ──────────────────────────── */

  update(dt, ctx) {
    const { world, input } = ctx;
    this.age += dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.useCooldown = Math.max(0, this.useCooldown - dt);
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 3.6);

    if (this.dead) { this.vx = this.vz = 0; return; }
    if (this.sleeping) {
      this.vx = this.vz = 0;
      return;
    }

    this.headInWater = inFluid(world, this, 'water', true);
    this.headInLava = inFluid(world, this, 'lava', true);
    this.inWater = inFluid(world, this, 'water');
    this.inLava = inFluid(world, this, 'lava');
    this.onLadder = this.checkLadder(world);

    this.movement(dt, ctx);
    this.survival(dt, ctx);
  }

  checkLadder(world) {
    const b = BLOCKS[world.getBlock(Math.floor(this.x), Math.floor(this.y + 0.5), Math.floor(this.z))];
    return b.climbable;
  }

  movement(dt, ctx) {
    const { world, input } = ctx;
    const wasOnGround = this.onGround;

    // Direction voulue, dans le repère du joueur.
    let fx = 0, fz = 0;
    if (input.forward) fz += 1;
    if (input.back) fz -= 1;
    if (input.left) fx -= 1;
    if (input.right) fx += 1;
    const len = Math.hypot(fx, fz);
    if (len > 0) { fx /= len; fz /= len; }

    if (this.sprinting && (len === 0 || this.food <= 6)) this.sprinting = false;

    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    let dirX = fx * cy - fz * sy;
    let dirZ = fx * sy + fz * cy;
    // Repère : yaw 0 regarde vers +Z.
    dirX = -fz * sy + fx * cy;
    dirZ = fz * cy + fx * sy;

    if (this.flying) {
      const speed = FLY * (input.sprint ? 2.2 : 1) * (this.sneaking ? 0.4 : 1);
      this.vx = dirX * speed;
      this.vz = dirZ * speed;
      this.vy = 0;
      if (input.jump) this.vy = speed * 0.75;
      if (input.sneak) this.vy = -speed * 0.75;
      move(world, this, this.vx * dt, this.vy * dt, this.vz * dt);
      this.onGround = false;
      return;
    }

    const swimming = this.inWater || this.inLava;
    let speed = this.sneaking ? SNEAK : this.sprinting ? SPRINT : WALK;
    if (swimming) speed = SWIM * (this.inLava ? 0.5 : 1);
    if (!this.onGround && !swimming) speed *= 1.0;

    // Accélération progressive : on n'atteint pas la vitesse maximale d'un coup.
    const accel = this.onGround || swimming ? 26 : 9;
    this.vx += (dirX * speed - this.vx) * Math.min(1, accel * dt);
    this.vz += (dirZ * speed - this.vz) * Math.min(1, accel * dt);

    if (this.onLadder) {
      this.vy = input.jump ? 3.2 : (input.sneak ? -1.6 : (len > 0 ? 2.4 : Math.max(this.vy, -1.6)));
      if (!input.jump && !input.sneak && len === 0) this.vy = 0;
    } else if (swimming) {
      this.vy -= GRAVITY * 0.32 * dt;
      if (input.jump) this.vy = Math.min(this.vy + 22 * dt, 3.4);
      this.vy = Math.max(this.vy, -3);
    } else {
      this.vy -= GRAVITY * dt;
      if (input.jump && this.onGround) {
        this.vy = JUMP_V;
        if (this.sprinting) { this.vx *= 1.12; this.vz *= 1.12; this.addExhaustion(0.2); }
        else this.addExhaustion(0.05);
      }
    }
    this.vy = Math.max(this.vy, -78);

    const before = { x: this.x, z: this.z };
    let hit = move(world, this, this.vx * dt, this.vy * dt, this.vz * dt);

    // Accroupi : on ne tombe pas du rebord.
    if (this.sneaking && wasOnGround && !hit.ground && this.vy <= 0) {
      if (!supportedAt(world, this.x, this.y, this.z, this.width)) {
        const tryX = { ...this, x: before.x };
        if (supportedAt(world, before.x, this.y, this.z, this.width)) this.x = before.x;
        else if (supportedAt(world, this.x, this.y, before.z, this.width)) this.z = before.z;
        else { this.x = before.x; this.z = before.z; }
      }
    }

    this.onGround = hit.ground;
    if (hit.ground) {
      if (this.fallDistance > 3 && !this.inWater) {
        const dmg = Math.floor(this.fallDistance - 3);
        if (dmg > 0) { this.hurt(dmg, 'fall', ctx); ctx.sound?.('fall', this); }
      }
      this.fallDistance = 0;
      this.vy = 0;
    } else if (hit.ceiling) this.vy = 0;
    else if (this.vy < 0 && !this.inWater && !this.onLadder) this.fallDistance -= this.vy * dt;
    if (this.inWater) this.fallDistance = 0;

    if (hit.x) this.vx = 0;
    if (hit.z) this.vz = 0;

    // Frottement au sol.
    const f = Math.pow(this.onGround ? 0.03 : 0.72, dt);
    if (len === 0) { this.vx *= f; this.vz *= f; }

    // Statistiques et dépense d'énergie.
    const moved = Math.hypot(this.x - before.x, this.z - before.z);
    this.stats.distance += moved;
    this.bobbing += moved * (this.onGround ? 1 : 0.2);
    if (moved > 0.0005 && this.mode === 'survival') {
      this.addExhaustion(moved * (this.sprinting ? 0.1 : this.sneaking ? 0.005 : 0.01));
    }

    // Bruit de pas.
    if (this.onGround && moved > 0.001) {
      this.stepDist = (this.stepDist || 0) + moved;
      if (this.stepDist > 1.9) {
        this.stepDist = 0;
        const under = world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z));
        if (under) ctx.sound?.('step', this, BLOCKS[under].sound);
      }
    }
  }

  /** Faim, régénération, noyade, brûlure, expérience. */
  survival(dt, ctx) {
    if (this.mode !== 'survival') { this.food = 20; this.air = 300; return; }
    const world = ctx.world;

    // Respiration
    if (this.headInWater) {
      this.air -= dt * 20;
      if (this.air <= 0) {
        this.air = 0;
        this.drownTimer = (this.drownTimer || 0) + dt;
        if (this.drownTimer > 1) { this.drownTimer = 0; this.hurt(2, 'drown', ctx); }
      }
    } else {
      this.air = Math.min(300, this.air + dt * 60);
      this.drownTimer = 0;
    }

    // Lave, cactus, feu
    if (this.inLava) {
      this.burnTimer = (this.burnTimer || 0) + dt;
      if (this.burnTimer > 0.5) { this.burnTimer = 0; this.hurt(4, 'lava', ctx); }
      this.burning = 6;
    }
    if (this.burning > 0 && !this.inWater) {
      this.burning -= dt;
      this.fireTimer = (this.fireTimer || 0) + dt;
      if (this.fireTimer > 1) { this.fireTimer = 0; this.hurt(1, 'fire', ctx); }
    } else if (this.inWater) this.burning = 0;

    // Cactus : contact latéral
    const cx = Math.floor(this.x), cy = Math.floor(this.y + 0.5), cz = Math.floor(this.z);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (world.getBlock(cx + dx, cy, cz + dz) === ID.cactus) {
        const dist = Math.abs((cx + dx + 0.5) - this.x) + Math.abs((cz + dz + 0.5) - this.z);
        if (dist < 1.2) {
          this.cactusTimer = (this.cactusTimer || 0) + dt;
          if (this.cactusTimer > 0.5) { this.cactusTimer = 0; this.hurt(1, 'cactus', ctx); }
        }
      }
    }

    // Vide
    if (this.y < -6) {
      this.voidTimer = (this.voidTimer || 0) + dt;
      if (this.voidTimer > 0.5) { this.voidTimer = 0; this.hurt(4, 'void', ctx); }
    }

    // Faim et régénération
    if (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
      else this.food = Math.max(0, this.food - 1);
    }
    if (this.food >= 18 && this.health < 20) {
      this.regenTimer = (this.regenTimer || 0) + dt;
      if (this.regenTimer > 4) {
        this.regenTimer = 0;
        this.health = Math.min(20, this.health + 1);
        this.addExhaustion(6);
      }
    } else this.regenTimer = 0;
    if (this.food === 0) {
      this.starveTimer = (this.starveTimer || 0) + dt;
      if (this.starveTimer > 4) { this.starveTimer = 0; this.hurt(1, 'starve', ctx); }
    }
    if (this.regeneration > 0) {
      this.regeneration -= dt;
      this.regenBoost = (this.regenBoost || 0) + dt;
      if (this.regenBoost > 1.2) { this.regenBoost = 0; this.health = Math.min(20, this.health + 1); }
    }
  }

  addExhaustion(n) { if (this.mode === 'survival') this.exhaustion += n; }

  /* ──────────────────────────── Dégâts ──────────────────────────── */

  hurt(amount, cause, ctx, source = null) {
    if (this.dead || this.mode === 'creative' || this.invulnerable > 0) return;
    // L'armure absorbe une part des dégâts.
    const def = this.inventory.defense;
    let dmg = amount * (1 - Math.min(0.8, def * 0.04));
    dmg = Math.max(cause === 'starve' || cause === 'drown' ? amount : dmg * 0.25, dmg);
    this.health -= dmg;
    this.hurtFlash = 1;
    this.invulnerable = 0.5;
    this.lastDamageCause = cause;
    if (def > 0 && cause !== 'starve' && cause !== 'drown') this.inventory.damageArmor(1);
    ctx.sound?.('playerHurt', this);
    if (source) {
      const dx = this.x - source.x, dz = this.z - source.z;
      const n = Math.hypot(dx, dz) || 1;
      this.vx += (dx / n) * 4.5; this.vz += (dz / n) * 4.5; this.vy = Math.max(this.vy, 4);
    }
    if (this.health <= 0) this.die(ctx);
  }

  die(ctx) {
    this.health = 0;
    this.dead = true;
    this.stats.deaths++;
    ctx.sound?.('death', this);
    if (this.mode === 'survival') {
      // On lâche tout, comme dans le jeu.
      for (let i = 0; i < this.inventory.size; i++) {
        const s = this.inventory.get(i);
        if (s) { ctx.dropItem?.(this.x, this.y + 1, this.z, s, true); this.inventory.set(i, null); }
      }
      for (let i = 0; i < 4; i++) {
        const s = this.inventory.armor[i];
        if (s) { ctx.dropItem?.(this.x, this.y + 1, this.z, s, true); this.inventory.armor[i] = null; }
      }
      this.xp = 0; this.level = 0;
    }
  }

  respawn(ctx) {
    const world = ctx.world;
    const p = this.spawnPoint || ctx.worldSpawn;
    this.x = p.x; this.y = p.y; this.z = p.z;
    this.vx = this.vy = this.vz = 0;
    this.health = 20; this.food = 20; this.saturation = 5; this.air = 300;
    this.dead = false;
    this.fallDistance = 0;
    this.burning = 0;
    this.invulnerable = 1.5;
  }

  /* ────────────────────────── Expérience ────────────────────────── */

  addXP(n) {
    this.xp += n;
    while (this.xp >= this.xpToNext()) { this.xp -= this.xpToNext(); this.level++; }
  }

  xpToNext() {
    const l = this.level;
    if (l < 16) return 2 * l + 7;
    if (l < 31) return 5 * l - 38;
    return 9 * l - 158;
  }

  /* ──────────────────────────── Nourriture ──────────────────────────── */

  canEat(itemName) {
    const it = getItem(itemName);
    if (!it || !it.food) return false;
    return this.food < 20 || it.food.effect === 'regeneration';
  }

  eat(ctx) {
    const s = this.inventory.held;
    if (!s) return;
    const it = getItem(s.item);
    if (!it || !it.food) return;
    this.food = Math.min(20, this.food + it.food.hunger);
    this.saturation = Math.min(this.food, this.saturation + it.food.saturation);
    if (it.food.effect === 'regeneration') this.regeneration = 5;
    if (it.food.effect === 'hunger') this.exhaustion += 3;
    if (it.food.effect === 'poison') this.hurt(1, 'poison', ctx);
    this.inventory.consume(this.inventory.selected);
    if (s.item === 'milk_bucket' || s.item === 'mushroom_stew') this.inventory.add(stack('bucket', 1));
    ctx.sound?.('eat', this);
    ctx.message?.(`Vous mangez : ${it.label}`);
  }

  /* ──────────────────────────── Minage ──────────────────────────── */

  /** Bloc visé par le regard, ou null. */
  targetBlock(world) {
    const [dx, dy, dz] = this.lookVector();
    return world.raycast(this.x, this.eyeY, this.z, dx, dy, dz, this.reach);
  }

  /**
   * Fait progresser le cassage du bloc visé.
   * @returns {boolean} true si le bloc vient d'être cassé
   */
  mineTick(dt, ctx) {
    const world = ctx.world;
    const hit = this.targetBlock(world);
    if (!hit) { this.breakTarget = null; this.breakProgress = 0; return false; }

    const key = `${hit.x},${hit.y},${hit.z}`;
    if (!this.breakTarget || this.breakTarget.key !== key) {
      this.breakTarget = { key, x: hit.x, y: hit.y, z: hit.z };
      this.breakProgress = 0;
    }
    const bl = BLOCKS[hit.id];
    if (bl.hardness < 0) return false;

    if (this.mode === 'creative') {
      this.breakBlock(hit.x, hit.y, hit.z, ctx);
      this.breakTarget = null;
      this.breakProgress = 0;
      this.useCooldown = 0.2;
      return true;
    }

    const tool = toolStats(this.inventory.held);
    const time = breakTime(bl, tool);
    let speed = dt / Math.max(0.05, time);
    if (!this.onGround) speed /= 5;
    if (this.headInWater) speed /= 5;
    this.breakProgress += speed;

    // Éclats de matière pendant le minage.
    if (Math.random() < dt * 12) {
      ctx.particles?.block(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, bl.tiles ? bl.tiles[2] : 0, 1, 1);
    }
    if (Math.random() < dt * 4) ctx.sound?.('dig', { x: hit.x, y: hit.y, z: hit.z }, bl.sound);

    if (this.breakProgress >= 1) {
      this.breakBlock(hit.x, hit.y, hit.z, ctx);
      this.breakProgress = 0;
      this.breakTarget = null;
      return true;
    }
    return false;
  }

  /** Casse effectivement un bloc : objets lâchés, usure de l'outil, son. */
  breakBlock(x, y, z, ctx) {
    const world = ctx.world;
    const id = world.getBlock(x, y, z);
    if (!id) return;
    const bl = BLOCKS[id];
    if (bl.hardness < 0) return;
    const data = world.getData(x, y, z);
    const tool = toolStats(this.inventory.held);

    if (this.mode === 'survival') {
      for (const d of blockDrops(bl, tool, Math.random, data)) {
        ctx.dropItem?.(x + 0.5, y + 0.5, z + 0.5, { item: d.item, count: d.count, dmg: 0 });
      }
      if (tool) this.inventory.damageHeld(1);
      this.addExhaustion(0.005);
    }

    // Le contenu d'un coffre tombe avec lui.
    const be = world.getBlockEntity(x, y, z);
    if (be && be.type === 'chest') {
      for (const s of be.slots) if (s) ctx.dropItem?.(x + 0.5, y + 0.5, z + 0.5, s);
    } else if (be && be.type === 'furnace') {
      for (const s of [be.input, be.fuel, be.output]) if (s) ctx.dropItem?.(x + 0.5, y + 0.5, z + 0.5, s);
    }

    world.setBlock(x, y, z, ID.air);
    ctx.particles?.block(x + 0.5, y + 0.5, z + 0.5, bl.tiles ? bl.tiles[2] : 0, 14);
    ctx.sound?.('break', { x, y, z }, bl.sound);
    this.stats.blocksMined++;
    this.swing = 1;
  }

  /* ──────────────────────────── Pose et usage ──────────────────────────── */

  /**
   * Clic droit : utiliser l'objet tenu ou interagir avec le bloc visé.
   * @returns {string|null} action effectuée
   */
  useItem(ctx) {
    const world = ctx.world;
    if (this.useCooldown > 0) return null;
    const hit = this.targetBlock(world);
    const held = this.inventory.held;
    const it = held ? getItem(held.item) : null;

    // Interaction avec le bloc visé (établi, four, coffre, lit, terre à labourer).
    if (hit && !this.sneaking) {
      const targetId = world.getBlock(hit.x, hit.y, hit.z);
      const action = this.interactBlock(hit, targetId, ctx);
      if (action) { this.useCooldown = 0.25; return action; }
    }

    if (!held || !it) return null;

    // Objets à comportement spécial.
    if (it.food && this.canEat(held.item)) { this.eat(ctx); this.useCooldown = 0.4; return 'eat'; }
    if (it.action === 'bow') return 'bow';
    if (it.tool === 'hoe' && hit) return this.till(hit, ctx);
    if (it.action === 'bucket' && this.pickFluid(ctx)) return 'bucket';
    if (it.action === 'place_water' || it.action === 'place_lava') return this.placeFluid(hit, it.action, ctx);
    if (it.armor) return this.equipArmor(ctx);

    // Pose d'un bloc.
    if (it.place !== null && hit) return this.placeBlock(hit, it, ctx);
    return null;
  }

  interactBlock(hit, id, ctx) {
    const world = ctx.world;
    if (id === ID.crafting_table) { ctx.openScreen?.('crafting', hit); return 'craft'; }
    if (id === ID.furnace || id === ID.furnace_lit) { ctx.openScreen?.('furnace', hit); return 'furnace'; }
    if (id === ID.chest) { ctx.openScreen?.('chest', hit); return 'chest'; }
    if (id === ID.bed) { ctx.sleep?.(hit); return 'bed'; }
    if (id === ID.tnt) {
      const held = this.inventory.held;
      if (held && (held.item === 'flint' || held.item === 'torch')) {
        world.setBlock(hit.x, hit.y, hit.z, ID.air);
        ctx.primeTNT?.(hit.x + 0.5, hit.y, hit.z + 0.5);
        return 'tnt';
      }
    }
    return null;
  }

  /** Houe : transforme la terre en terre labourée. */
  till(hit, ctx) {
    const world = ctx.world;
    const id = world.getBlock(hit.x, hit.y, hit.z);
    if ((id === ID.dirt || id === ID.grass_block || id === ID.coarse_dirt) && hit.face === 2
        && !BLOCKS[world.getBlock(hit.x, hit.y + 1, hit.z)].solid) {
      world.setBlock(hit.x, hit.y, hit.z, ID.farmland);
      this.inventory.damageHeld(1);
      ctx.sound?.('dig', hit, 'gravel');
      this.useCooldown = 0.3;
      this.swing = 1;
      return 'till';
    }
    return null;
  }

  pickFluid(ctx) {
    const world = ctx.world;
    const [dx, dy, dz] = this.lookVector();
    const hit = world.raycast(this.x, this.eyeY, this.z, dx, dy, dz, this.reach, true);
    if (!hit) return false;
    const bl = BLOCKS[hit.id];
    if (!bl.fluid || world.getData(hit.x, hit.y, hit.z) !== 0) return false;
    world.setBlock(hit.x, hit.y, hit.z, ID.air);
    this.inventory.consume(this.inventory.selected);
    this.inventory.add(stack(bl.fluid === 'water' ? 'water_bucket' : 'lava_bucket', 1));
    this.useCooldown = 0.3;
    ctx.sound?.('splash', hit);
    return true;
  }

  placeFluid(hit, action, ctx) {
    const world = ctx.world;
    if (!hit) return null;
    const n = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]][hit.face];
    const x = hit.x + n[0], y = hit.y + n[1], z = hit.z + n[2];
    world.setBlock(x, y, z, action === 'place_water' ? ID.water : ID.lava, 0);
    if (this.mode === 'survival') {
      this.inventory.consume(this.inventory.selected);
      this.inventory.add(stack('bucket', 1));
    }
    this.useCooldown = 0.3;
    ctx.sound?.('splash', { x, y, z });
    return 'fluid';
  }

  equipArmor(ctx) {
    const held = this.inventory.held;
    const it = getItem(held.item);
    const slotIdx = { head: 0, chest: 1, legs: 2, feet: 3 }[it.armor.slot];
    const cur = this.inventory.armor[slotIdx];
    this.inventory.armor[slotIdx] = { item: held.item, count: 1, dmg: held.dmg || 0 };
    this.inventory.held = cur;
    this.useCooldown = 0.3;
    ctx.sound?.('equip', this);
    return 'armor';
  }

  /** Pose d'un bloc contre la face visée. */
  placeBlock(hit, it, ctx) {
    const world = ctx.world;
    const n = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]][hit.face];
    let x = hit.x + n[0], y = hit.y + n[1], z = hit.z + n[2];

    // Si la cible est remplaçable (herbe haute, eau), on prend sa place.
    const targetBl = BLOCKS[world.getBlock(hit.x, hit.y, hit.z)];
    if (targetBl.replaceable && targetBl.name !== 'air') { x = hit.x; y = hit.y; z = hit.z; }

    if (y < 0 || y >= WORLD_H) return null;
    const existing = BLOCKS[world.getBlock(x, y, z)];
    if (!existing.replaceable && existing.name !== 'air') return null;

    const placing = BLOCKS[it.place];

    // Pas de bloc dans le joueur.
    if (placing.solid && this.intersectsBlock(x, y, z)) return null;

    // Support obligatoire pour les plantes et les torches.
    if (placing.needsSupport) {
      const under = BLOCKS[world.getBlock(x, y - 1, z)];
      const ok = placing.plantOn ? placing.plantOn.includes(under.name) : under.solid;
      if (!ok) return null;
    }

    // Orientation : le bloc regarde le joueur.
    let data = 0;
    if (placing.facing) {
      const yaw = ((this.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const quad = Math.round(yaw / (Math.PI / 2)) % 4;   // 0=+Z(sud) …
      data = [2, 3, 0, 1][quad];
    }
    if (placing.render === 'flat') data = hit.face;
    if (placing.name === 'wheat') data = 0;

    world.setBlock(x, y, z, it.place, data);
    if (placing.name === 'furnace') world.getBlockEntity(x, y, z, 'furnace');
    if (placing.name === 'chest') world.getBlockEntity(x, y, z, 'chest');

    if (this.mode === 'survival') this.inventory.consume(this.inventory.selected);
    this.useCooldown = 0.22;
    this.swing = 1;
    this.stats.blocksPlaced++;
    ctx.sound?.('place', { x, y, z }, placing.sound);
    return 'place';
  }

  intersectsBlock(x, y, z) {
    const hw = this.width / 2;
    return this.x + hw > x && this.x - hw < x + 1
      && this.z + hw > z && this.z - hw < z + 1
      && this.y + this.height > y && this.y < y + 1;
  }

  /* ──────────────────────────── Attaque ──────────────────────────── */

  attack(entity, ctx) {
    const dmg = attackDamage(this.inventory.held) + (this.sprinting ? 1 : 0);
    entity.hurt(dmg, ctx, this);
    this.swing = 1;
    this.addExhaustion(0.1);
    if (this.mode === 'survival' && this.inventory.held) {
      const it = getItem(this.inventory.held.item);
      if (it && it.durability && it.tool) this.inventory.damageHeld(it.tool === 'sword' ? 1 : 2);
    }
    if (entity.dead) this.stats.mobsKilled++;
  }

  toJSON() {
    return {
      x: this.x, y: this.y, z: this.z, yaw: this.yaw, pitch: this.pitch,
      health: this.health, food: this.food, saturation: this.saturation, air: this.air,
      xp: this.xp, level: this.level, mode: this.mode, spawnPoint: this.spawnPoint,
      inventory: this.inventory.toJSON(), stats: this.stats,
    };
  }

  fromJSON(o) {
    if (!o) return;
    Object.assign(this, {
      x: o.x, y: o.y, z: o.z, yaw: o.yaw || 0, pitch: o.pitch || 0,
      health: o.health ?? 20, food: o.food ?? 20, saturation: o.saturation ?? 5,
      air: o.air ?? 300, xp: o.xp || 0, level: o.level || 0, mode: o.mode || 'survival',
      spawnPoint: o.spawnPoint || null,
    });
    this.inventory.fromJSON(o.inventory);
    if (o.stats) Object.assign(this.stats, o.stats);
  }
}
