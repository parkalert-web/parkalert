/**
 * Minecraft JS — le monde : tronçons chargés, accès aux blocs, mises à jour.
 *
 * Le chargement se fait par étapes, chacune avec son budget par image pour
 * ne jamais bloquer l'affichage :
 *   création → relief → décors (arbres) → lumière → maillage.
 * Un tronçon n'est décoré que si ses huit voisins ont leur relief, et n'est
 * maillé que si ses quatre voisins sont éclairés : pas de couture visible.
 */

import { Chunk, chunkKey, chunkKeyStr, CX, CZ, WORLD_H, SEA_LEVEL, idx } from './chunk.js';
import { BLOCKS, block, idByName, isReplaceable } from './blocks.js';
import { WorldGen, BIOMES } from './worldgen.js';
import { LightEngine } from './lighting.js';
import { mulberry32 } from './noise.js';

const AIR = 0;
const ID = {};
for (const n of ['water', 'lava', 'stone', 'cobblestone', 'obsidian', 'dirt', 'grass_block', 'farmland',
  'wheat', 'sand', 'gravel', 'torch', 'furnace', 'furnace_lit', 'chest', 'ice', 'snow_block',
  'oak_sapling', 'birch_sapling', 'spruce_sapling', 'tall_grass', 'coarse_dirt']) ID[n] = idByName(n);

/** Durée d'un tick de jeu, comme dans Minecraft : 20 par seconde. */
export const TICK_MS = 50;
export const DAY_TICKS = 24000;

export class World {
  constructor(opts = {}) {
    this.seed = opts.seed ?? ((Math.random() * 2 ** 31) | 0);
    this.gen = new WorldGen(this.seed);
    this.light = new LightEngine(this);
    this.chunks = new Map();
    this.time = opts.time ?? 1000;        // ticks depuis l'aube
    this.rainTicks = 0;
    this.weather = 'clear';
    this.renderDistance = opts.renderDistance ?? 8;
    this.scheduled = new Map();           // clé → {x,y,z,at}
    this.tickCount = 0;
    this.rng = mulberry32(this.seed ^ 0x9e3779b9);
    this.onChunkUnload = opts.onChunkUnload ?? null;
    this.savedChunks = opts.savedChunks ?? null; // Map clé → données sauvegardées
    this.generating = [];
    this.stats = { generated: 0, meshed: 0 };
  }

  /* ────────────────────────── Accès aux tronçons ────────────────────────── */

  chunkAt(cx, cz) {
    // Cache d'une entrée : les parcours de lumière et de maillage restent
    // presque toujours dans le même tronçon.
    if (cx === this._lcx && cz === this._lcz && this._lc) return this._lc;
    const c = this.chunks.get(chunkKey(cx, cz)) || null;
    this._lcx = cx; this._lcz = cz; this._lc = c;
    return c;
  }

  chunkOf(x, z) { return this.chunkAt(x >> 4, z >> 4); }

  ensureChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    let c = this.chunks.get(key);
    if (!c) { c = new Chunk(cx, cz); this.chunks.set(key, c); }
    return c;
  }

  isLoaded(x, z) {
    const c = this.chunkOf(x, z);
    return !!(c && c.generated);
  }

  /* ──────────────────────────── Accès aux blocs ──────────────────────────── */

  getBlock(x, y, z) {
    if (y < 0 || y >= WORLD_H) return AIR;
    const c = this.chunkOf(x, z);
    if (!c || !c.generated) return AIR;
    return c.blocks[idx(x & 15, y, z & 15)];
  }

  getBlockDef(x, y, z) { return BLOCKS[this.getBlock(x, y, z)]; }

  getData(x, y, z) {
    const c = this.chunkOf(x, z);
    if (!c || !c.data) return 0;
    return c.data[idx(x & 15, y, z & 15)];
  }

  setData(x, y, z, v) {
    const c = this.chunkOf(x, z);
    if (!c) return;
    c.setData(x & 15, y, z & 15, v);
    c.modified = true;
    this.markDirty(x, y, z);
  }

  getSkyLight(x, y, z) {
    if (y >= WORLD_H) return 15;
    if (y < 0) return 0;
    const c = this.chunkOf(x, z);
    if (!c) return 15;
    return c.light[idx(x & 15, y, z & 15)] >> 4;
  }

  setSkyLight(x, y, z, v) {
    if (y < 0 || y >= WORLD_H) return;
    const c = this.chunkOf(x, z);
    if (!c) return;
    const i = idx(x & 15, y, z & 15);
    c.light[i] = (c.light[i] & 0x0f) | (Math.max(0, Math.min(15, v)) << 4);
  }

  getBlockLight(x, y, z) {
    if (y < 0 || y >= WORLD_H) return 0;
    const c = this.chunkOf(x, z);
    if (!c) return 0;
    return c.light[idx(x & 15, y, z & 15)] & 15;
  }

  setBlockLight(x, y, z, v) {
    if (y < 0 || y >= WORLD_H) return;
    const c = this.chunkOf(x, z);
    if (!c) return;
    const i = idx(x & 15, y, z & 15);
    c.light[i] = (c.light[i] & 0xf0) | (Math.max(0, Math.min(15, v)) & 15);
  }

  opacityOf(id) { return BLOCKS[id].opacity; }
  lightOf(id) { return BLOCKS[id].light; }

  /** Niveau de lumière perçu (le maximum des deux canaux, ciel atténué la nuit). */
  lightAt(x, y, z) {
    return Math.max(this.getBlockLight(x, y, z), Math.round(this.getSkyLight(x, y, z) * this.skyBrightness()));
  }

  biomeAt(x, z) {
    const c = this.chunkOf(x, z);
    if (!c || !c.generated) return BIOMES[2];
    return BIOMES[c.biome[(x & 15) + (z & 15) * CX]];
  }

  /* ────────────────────────── Modification de blocs ────────────────────────── */

  /**
   * Pose ou casse un bloc et déclenche tout ce qui en découle :
   * lumière, maillage, mises à jour des voisins, fluides.
   */
  setBlock(x, y, z, id, data = 0, opts = {}) {
    if (y < 0 || y >= WORLD_H) return false;
    const c = this.chunkOf(x, z);
    if (!c || !c.generated) return false;
    const lx = x & 15, lz = z & 15;
    const i = idx(lx, y, lz);
    const old = c.blocks[i];
    if (old === id && c.getData(lx, y, lz) === data) return false;

    c.blocks[i] = id;
    if (data || c.data) c.setData(lx, y, lz, data);
    c.modified = true;
    if (old !== id) c.setEntity(lx, y, lz, null);

    // Hauteur de colonne (utile à la lumière du ciel et à l'apparition des monstres).
    const h = c.getHeight(lx, lz);
    if (BLOCKS[id].opacity >= 15 && y + 1 > h) c.height[lx + lz * CX] = y + 1;
    else if (BLOCKS[old].opacity >= 15 && y + 1 === h) c.recomputeHeight(lx, lz, (b) => BLOCKS[b].opacity >= 15);

    if (!opts.noLight) this.light.onBlockChange(x, y, z, old, id);
    this.markDirty(x, y, z);

    if (!opts.noUpdate) {
      this.notifyNeighbors(x, y, z);
      this.scheduleUpdate(x, y, z, 1);
    }
    return true;
  }

  /** Marque le tronçon (et ses voisins si on est sur un bord) à re-mailler. */
  markDirty(x, y, z) {
    const cx = x >> 4, cz = z >> 4;
    const c = this.chunkAt(cx, cz);
    if (c) c.dirty = true;
    const lx = x & 15, lz = z & 15;
    const edge = (ox, oz) => { const n = this.chunkAt(cx + ox, cz + oz); if (n) n.dirty = true; };
    if (lx === 0) edge(-1, 0);
    if (lx === 15) edge(1, 0);
    if (lz === 0) edge(0, -1);
    if (lz === 15) edge(0, 1);
  }

  markLightDirty(x, y, z) { this.markDirty(x, y, z); }

  /** Prévient les six voisins qu'un bloc a changé (support des plantes, fluides, gravité). */
  notifyNeighbors(x, y, z) {
    const d = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (const [dx, dy, dz] of d) this.scheduleUpdate(x + dx, y + dy, z + dz, 1);
  }

  scheduleUpdate(x, y, z, delayTicks = 1) {
    if (y < 0 || y >= WORLD_H) return;
    const key = `${x},${y},${z}`;
    const at = this.tickCount + delayTicks;
    const cur = this.scheduled.get(key);
    if (cur && cur.at <= at) return;
    this.scheduled.set(key, { x, y, z, at });
  }

  /* ─────────────────────────── Entités de bloc ─────────────────────────── */

  getBlockEntity(x, y, z, createType = null) {
    const c = this.chunkOf(x, z);
    if (!c) return null;
    let e = c.getEntity(x & 15, y, z & 15);
    if (!e && createType) {
      e = createBlockEntity(createType);
      c.setEntity(x & 15, y, z & 15, e);
      c.modified = true;
    }
    return e;
  }

  /* ──────────────────────── Chargement / déchargement ──────────────────────── */

  /**
   * Fait avancer le chargement autour d'un point.
   * @returns {number} nombre de tronçons devenus prêts
   */
  updateChunks(centerX, centerZ, budget = { gen: 2, populate: 2, light: 12000 }) {
    const ccx = centerX >> 4, ccz = centerZ >> 4;
    const R = this.renderDistance;
    let gen = budget.gen, pop = budget.populate;

    // Liste des tronçons manquants, du plus proche au plus lointain.
    const wanted = [];
    for (let dz = -R - 1; dz <= R + 1; dz++) {
      for (let dx = -R - 1; dx <= R + 1; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > (R + 1) * (R + 1)) continue;
        wanted.push([d2, ccx + dx, ccz + dz]);
      }
    }
    wanted.sort((a, b) => a[0] - b[0]);

    for (const [, cx, cz] of wanted) {
      if (gen <= 0) break;
      const c = this.ensureChunk(cx, cz);
      if (c.generated) continue;
      this.gen.generate(c);
      this.loadSaved(c);
      this.stats.generated++;
      gen--;
    }

    for (const [, cx, cz] of wanted) {
      if (pop <= 0) break;
      const c = this.chunkAt(cx, cz);
      if (!c || !c.generated || c.populated) continue;
      let ready = true;
      for (let dz = -1; dz <= 1 && ready; dz++) {
        for (let dx = -1; dx <= 1 && ready; dx++) {
          const n = this.chunkAt(cx + dx, cz + dz);
          if (!n || !n.generated) ready = false;
        }
      }
      if (!ready) continue;
      if (!c.fromSave) this.gen.populate(this, c);
      else c.populated = true;
      this.light.initSky(c);
      this.light.initBlockLights(c);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = this.chunkAt(cx + dx, cz + dz);
        if (n && n.lit) this.light.stitch(c, n);
      }
      c.dirty = true;
      pop--;
    }

    this.light.update(budget.light);
    this.unloadFar(ccx, ccz);
    return budget.gen - gen;
  }

  /** Un tronçon est prêt à être maillé quand lui et ses quatre voisins sont éclairés. */
  isMeshable(c) {
    if (!c || !c.populated || !c.lit) return false;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = this.chunkAt(c.cx + dx, c.cz + dz);
      if (!n || !n.populated || !n.lit) return false;
    }
    return true;
  }

  unloadFar(ccx, ccz) {
    const limit = this.renderDistance + 3;
    for (const [key, c] of this.chunks) {
      const d = Math.max(Math.abs(c.cx - ccx), Math.abs(c.cz - ccz));
      if (d <= limit) continue;
      if (this.onChunkUnload) this.onChunkUnload(c);
      this.chunks.delete(key);
      if (this._lc === c) { this._lc = null; this._lcx = this._lcz = NaN; }
    }
  }

  /** Réapplique les modifications sauvegardées sur un tronçon fraîchement généré. */
  loadSaved(c) {
    if (!this.savedChunks) return;
    const saved = this.savedChunks.get(chunkKeyStr(c.cx, c.cz));
    if (!saved) return;
    for (const [i, id, data] of saved.edits) {
      c.blocks[i] = id;
      if (data) c.setData(i & 15, i >> 8, (i >> 4) & 15, data);
    }
    for (const [i, e] of saved.entities || []) c.blockEntities.set(i, e);
    for (let z = 0; z < CZ; z++) {
      for (let x = 0; x < CX; x++) c.recomputeHeight(x, z, (b) => BLOCKS[b].opacity >= 15);
    }
    c.fromSave = true;
    c.populated = true;
    c.modified = true;
  }

  /* ──────────────────────────── Boucle de jeu ──────────────────────────── */

  /** Un tick de monde (20 par seconde) : temps, fluides, croissance, fours. */
  tick(playerPos) {
    this.tickCount++;
    this.time = (this.time + 1) % DAY_TICKS;
    this.tickWeather();

    // Mises à jour programmées (fluides, gravité, support des plantes).
    if (this.scheduled.size) {
      const due = [];
      for (const [key, u] of this.scheduled) {
        if (u.at <= this.tickCount) { due.push(u); this.scheduled.delete(key); }
      }
      for (const u of due) this.blockUpdate(u.x, u.y, u.z);
    }

    // Ticks aléatoires : 3 voxels par section de 16³ dans les tronçons proches.
    const ccx = Math.floor(playerPos.x) >> 4, ccz = Math.floor(playerPos.z) >> 4;
    for (let dz = -4; dz <= 4; dz++) {
      for (let dx = -4; dx <= 4; dx++) {
        const c = this.chunkAt(ccx + dx, ccz + dz);
        if (!c || !c.populated) continue;
        for (let s = 0; s < 8; s++) {
          for (let k = 0; k < 3; k++) {
            const x = (this.rng() * 16) | 0, z = (this.rng() * 16) | 0, y = s * 16 + ((this.rng() * 16) | 0);
            this.randomTick(c, x, y, z);
          }
        }
        this.tickBlockEntities(c);
      }
    }
  }

  tickWeather() {
    if (this.rainTicks > 0) {
      this.rainTicks--;
      if (this.rainTicks === 0) this.weather = 'clear';
    } else if (this.rng() < 0.00004) {
      this.weather = 'rain';
      this.rainTicks = 3000 + Math.floor(this.rng() * 9000);
    }
  }

  setWeather(w, ticks = 6000) {
    this.weather = w;
    this.rainTicks = w === 'clear' ? 0 : ticks;
  }

  /** Comportements « lents » : pousse du blé, propagation de l'herbe, dégel… */
  randomTick(c, lx, y, lz) {
    const id = c.blocks[idx(lx, y, lz)];
    if (!id) return;
    const x = c.cx * 16 + lx, z = c.cz * 16 + lz;
    const bl = BLOCKS[id];

    if (id === ID.grass_block) {
      // L'herbe meurt sous un bloc opaque, et gagne la terre nue voisine.
      const above = this.getBlock(x, y + 1, z);
      if (BLOCKS[above].opacity >= 15) { this.setBlock(x, y, z, ID.dirt); return; }
      if (this.lightAt(x, y + 1, z) >= 9) {
        const tx = x + ((this.rng() * 3) | 0) - 1;
        const ty = y + ((this.rng() * 3) | 0) - 1;
        const tz = z + ((this.rng() * 3) | 0) - 1;
        if (this.getBlock(tx, ty, tz) === ID.dirt && BLOCKS[this.getBlock(tx, ty + 1, tz)].opacity < 15
            && this.getSkyLight(tx, ty + 1, tz) >= 4) {
          this.setBlock(tx, ty, tz, ID.grass_block);
        }
      }
      return;
    }

    if (id === ID.wheat) {
      const stage = this.getData(x, y, z);
      if (stage < 7 && this.lightAt(x, y, z) >= 9 && this.rng() < 0.35) {
        const wet = this.getData(x, y - 1, z) > 0;
        if (wet || this.rng() < 0.4) this.setData(x, y, z, stage + 1);
      }
      return;
    }

    if (id === ID.farmland) {
      // La terre labourée s'humidifie près de l'eau, sèche sinon.
      let water = false;
      for (let dx = -4; dx <= 4 && !water; dx++) {
        for (let dz = -4; dz <= 4 && !water; dz++) {
          for (let dy = 0; dy <= 1 && !water; dy++) {
            if (this.getBlock(x + dx, y + dy, z + dz) === ID.water) water = true;
          }
        }
      }
      const wet = this.getData(x, y, z) > 0;
      if (water && !wet) this.setData(x, y, z, 7);
      else if (!water && wet) this.setData(x, y, z, 0);
      else if (!water && !wet && this.getBlock(x, y + 1, z) !== ID.wheat && this.rng() < 0.2) {
        this.setBlock(x, y, z, ID.dirt);
      }
      return;
    }

    if (bl.name.endsWith('_sapling')) {
      if (this.lightAt(x, y, z) >= 9 && this.rng() < 0.25) this.growTree(x, y, z, bl.name.replace('_sapling', ''));
      return;
    }

    if (bl.name.endsWith('_leaves')) {
      // Les feuilles se décomposent loin d'un tronc.
      if (this.rng() > 0.25) return;
      if (!this.hasLogNear(x, y, z, 4)) {
        this.setBlock(x, y, z, AIR);
        this.onLeafDecay && this.onLeafDecay(x, y, z, bl);
      }
      return;
    }

    if (id === ID.ice && this.lightAt(x, y, z) >= 12 && this.weather !== 'snow') {
      if (this.rng() < 0.05) this.setBlock(x, y, z, ID.water);
    }
  }

  hasLogNear(x, y, z, r) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dz = -r; dz <= r; dz++) {
          const id = this.getBlock(x + dx, y + dy, z + dz);
          if (id && BLOCKS[id].name.endsWith('_log')) return true;
        }
      }
    }
    return false;
  }

  growTree(x, y, z, kind) {
    const put = (wx, wy, wz, id, force) => {
      const cur = this.getBlock(wx, wy, wz);
      if (!force && cur !== AIR && !BLOCKS[cur].replaceable) return;
      this.setBlock(wx, wy, wz, id, 0, { noUpdate: true });
    };
    this.setBlock(x, y, z, AIR, 0, { noUpdate: true });
    this.gen.tree(put, x, y, z, kind, this.rng);
  }

  /* ────────────────────────── Mises à jour de blocs ────────────────────────── */

  blockUpdate(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (!id) return;
    const bl = BLOCKS[id];

    // Gravité : le sable et le gravier tombent.
    if (bl.gravity) {
      const below = this.getBlock(x, y - 1, z);
      if (below === AIR || BLOCKS[below].replaceable) {
        const data = this.getData(x, y, z);
        this.setBlock(x, y, z, AIR);
        this.setBlock(x, y - 1, z, id, data);
        this.scheduleUpdate(x, y - 1, z, 1);
        return;
      }
    }

    // Support : une plante posée sur rien tombe.
    if (bl.needsSupport) {
      const under = this.getBlock(x, y - 1, z);
      const ok = bl.plantOn
        ? bl.plantOn.includes(BLOCKS[under].name)
        : (BLOCKS[under].solid || BLOCKS[under].name === 'torch');
      const wallOk = bl.name === 'torch' && (BLOCKS[under].solid);
      if (!ok && !wallOk) {
        this.breakNaturally(x, y, z);
        return;
      }
    }

    if (bl.fluid) this.fluidUpdate(x, y, z, bl);

    // Un fluide voisin peut couler ici.
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]]) {
      const nb = this.getBlockDef(x + dx, y + dy, z + dz);
      if (nb.fluid) this.scheduleUpdate(x + dx, y + dy, z + dz, nb.fluid === 'water' ? 5 : 20);
    }
  }

  /** Casse un bloc en lâchant son contenu (utilisé par les mises à jour, pas par le joueur). */
  breakNaturally(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (!id) return;
    this.setBlock(x, y, z, AIR);
    if (this.onNaturalBreak) this.onNaturalBreak(x, y, z, BLOCKS[id], this.getData(x, y, z));
  }

  /**
   * Écoulement d'un fluide.
   * Niveau 0 = source, 1..7 = coulée qui s'éloigne, bit 8 = chute libre.
   */
  fluidUpdate(x, y, z, bl) {
    const isWater = bl.fluid === 'water';
    const maxSpread = isWater ? 7 : 3;
    const step = isWater ? 1 : 2;
    const delay = isWater ? 5 : 20;
    const data = this.getData(x, y, z);
    const level = data & 7;
    const falling = (data & 8) !== 0;

    // Une coulée qui n'est plus alimentée disparaît.
    if (level > 0 || falling) {
      let best = 8;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nid = this.getBlock(x + dx, y, z + dz);
        if (nid === this.getBlock(x, y, z)) {
          const nd = this.getData(x + dx, y, z + dz);
          if ((nd & 8) === 0) best = Math.min(best, nd & 7);
        }
      }
      const above = this.getBlock(x, y + 1, z);
      const fedFromAbove = above === this.getBlock(x, y, z);
      if (!fedFromAbove && best + step > maxSpread) {
        this.setBlock(x, y, z, AIR);
        return;
      }
      const want = fedFromAbove ? 1 : best + step;
      if (!fedFromAbove && want !== level) {
        this.setData(x, y, z, want);
        this.scheduleUpdate(x, y, z, delay);
        return;
      }
    }

    const id = this.getBlock(x, y, z);
    const flowInto = (nx, ny, nz, newData) => {
      const tid = this.getBlock(nx, ny, nz);
      const tb = BLOCKS[tid];
      if (tid === id) {
        const cur = this.getData(nx, ny, nz);
        if ((cur & 7) > (newData & 7) && (cur & 8) === 0) {
          this.setData(nx, ny, nz, newData);
          this.scheduleUpdate(nx, ny, nz, delay);
        }
        return false;
      }
      if (tb.fluid && tb.fluid !== bl.fluid) { this.mixFluids(x, y, z, nx, ny, nz, isWater); return false; }
      if (tid !== AIR && !tb.replaceable) return false;
      if (tid !== AIR && this.onNaturalBreak) this.onNaturalBreak(nx, ny, nz, tb, 0);
      this.setBlock(nx, ny, nz, id, newData);
      this.scheduleUpdate(nx, ny, nz, delay);
      return true;
    };

    // D'abord vers le bas, ensuite sur les côtés.
    const belowId = this.getBlock(x, y - 1, z);
    const belowDef = BLOCKS[belowId];
    if (y > 0 && (belowId === AIR || belowDef.replaceable || belowId === id)) {
      if (belowDef.fluid && belowDef.fluid !== bl.fluid) this.mixFluids(x, y, z, x, y - 1, z, isWater);
      else flowInto(x, y - 1, z, 8 | 1);
      if (!isWater) return;
      return;
    }
    if (level >= maxSpread && !falling) return;
    const next = falling ? 1 : level + step;
    if (next > maxSpread) return;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      flowInto(x + dx, y, z + dz, next);
    }
  }

  /** Eau + lave : de la pierre, de la pierre taillée ou de l'obsidienne. */
  mixFluids(x, y, z, nx, ny, nz, isWater) {
    const lavaAt = isWater ? [nx, ny, nz] : [x, y, z];
    const waterAt = isWater ? [x, y, z] : [nx, ny, nz];
    const lavaData = this.getData(lavaAt[0], lavaAt[1], lavaAt[2]) & 7;
    const result = lavaData === 0 ? ID.obsidian : (waterAt[1] > lavaAt[1] ? ID.cobblestone : ID.stone);
    this.setBlock(lavaAt[0], lavaAt[1], lavaAt[2], result);
    if (this.onFluidMix) this.onFluidMix(lavaAt[0], lavaAt[1], lavaAt[2]);
  }

  /* ──────────────────────────── Fours et coffres ──────────────────────────── */

  tickBlockEntities(c) {
    if (!c.blockEntities.size) return;
    for (const [i, e] of c.blockEntities) {
      if (e.type !== 'furnace') continue;
      const x = c.cx * 16 + (i & 15), z = c.cz * 16 + ((i >> 4) & 15), y = i >> 8;
      this.tickFurnace(e, x, y, z);
    }
  }

  tickFurnace(e, x, y, z) {
    const wasBurning = e.burn > 0;
    if (e.burn > 0) e.burn--;
    const result = e.input ? this.smelt(e.input.item) : null;
    const canOutput = result && (!e.output || (e.output.item === result.item && e.output.count < 64));

    if (e.burn <= 0 && canOutput && e.fuel) {
      const fuelValue = this.fuelValue(e.fuel.item);
      if (fuelValue > 0) {
        e.burn = fuelValue;
        e.maxBurn = fuelValue;
        e.fuel.count--;
        if (e.fuel.item === 'lava_bucket') e.fuel = { item: 'bucket', count: 1, dmg: 0 };
        else if (e.fuel.count <= 0) e.fuel = null;
      }
    }

    if (e.burn > 0 && canOutput) {
      e.cook++;
      if (e.cook >= 200) {
        e.cook = 0;
        if (e.output) e.output.count++;
        else e.output = { item: result.item, count: 1, dmg: 0 };
        e.input.count--;
        if (e.input.count <= 0) e.input = null;
        if (this.onSmelt) this.onSmelt(x, y, z, result.item);
      }
    } else {
      e.cook = Math.max(0, e.cook - 2);
    }

    const burning = e.burn > 0;
    if (burning !== wasBurning) {
      const facing = this.getData(x, y, z);
      this.setBlock(x, y, z, burning ? ID.furnace_lit : ID.furnace, facing, { noUpdate: true });
      const c = this.chunkOf(x, z);
      if (c) c.setEntity(x & 15, y, z & 15, e);
    }
  }

  smelt(name) { return this.smeltFn ? this.smeltFn(name) : null; }
  fuelValue(name) { return this.fuelFn ? this.fuelFn(name) : 0; }

  /* ──────────────────────────── Ciel et temps ──────────────────────────── */

  /** 0 = nuit noire, 1 = plein jour. */
  skyBrightness() {
    const ang = this.sunAngle();
    let b = Math.sin(ang) * 1.6 + 0.4;
    b = Math.max(0, Math.min(1, b));
    if (this.weather === 'rain') b *= 0.7;
    return b;
  }

  isDay() { return this.time > 1000 && this.time < 13000; }
  isNight() { return !this.isDay(); }

  /**
   * Angle du soleil : 0 au lever (time 0), π/2 à midi (time 6000),
   * π au coucher, 3π/2 à minuit. Le soleil se lève donc à l'est (−X).
   */
  sunAngle() { return (this.time / DAY_TICKS) * Math.PI * 2; }

  /** Direction du soleil dans le monde. */
  sunDir() {
    const a = this.sunAngle();
    return [-Math.cos(a), Math.sin(a), 0];
  }

  /* ──────────────────────────── Lancer de rayon ──────────────────────────── */

  /**
   * Trouve le premier bloc touché par un rayon (algorithme d'Amanatides & Woo).
   * @returns {{x,y,z,face,id,px,py,pz}|null}
   */
  raycast(ox, oy, oz, dx, dy, dz, maxDist = 6, includeFluids = false) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const stepX = Math.sign(dx), stepY = Math.sign(dy), stepZ = Math.sign(dz);
    const tDeltaX = stepX ? Math.abs(1 / dx) : Infinity;
    const tDeltaY = stepY ? Math.abs(1 / dy) : Infinity;
    const tDeltaZ = stepZ ? Math.abs(1 / dz) : Infinity;
    let tMaxX = stepX ? ((stepX > 0 ? x + 1 - ox : ox - x) * tDeltaX) : Infinity;
    let tMaxY = stepY ? ((stepY > 0 ? y + 1 - oy : oy - y) * tDeltaY) : Infinity;
    let tMaxZ = stepZ ? ((stepZ > 0 ? z + 1 - oz : oz - z) * tDeltaZ) : Infinity;
    let face = -1;
    let t = 0;

    while (t <= maxDist) {
      const id = this.getBlock(x, y, z);
      if (id !== AIR) {
        const bl = BLOCKS[id];
        const targetable = includeFluids ? true : !bl.fluid;
        if (targetable) {
          return { x, y, z, face, id, dist: t, px: ox + dx * t, py: oy + dy * t, pz: oz + dz * t };
        }
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX; face = stepX > 0 ? 1 : 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY; face = stepY > 0 ? 3 : 2;
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = stepZ > 0 ? 5 : 4;
      }
    }
    return null;
  }

  /** Hauteur du sol à une colonne (pour l'apparition des créatures et le respawn). */
  topSolidY(x, z) {
    const c = this.chunkOf(x, z);
    if (!c || !c.generated) return SEA_LEVEL + 1;
    for (let y = WORLD_H - 1; y > 0; y--) {
      const id = c.blocks[idx(x & 15, y, z & 15)];
      if (id && BLOCKS[id].solid) return y + 1;
    }
    return 1;
  }
}

export function createBlockEntity(type) {
  if (type === 'furnace') return { type, input: null, fuel: null, output: null, burn: 0, maxBurn: 0, cook: 0 };
  if (type === 'chest') return { type, slots: new Array(27).fill(null) };
  return { type };
}
