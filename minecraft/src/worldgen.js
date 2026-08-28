/**
 * Minecraft JS — génération du monde.
 *
 * Tout est fonction de la graine : reliefs, biomes, grottes, filons, arbres.
 * Les arbres d'un tronçon sont calculés à partir des tronçons voisins aussi,
 * pour qu'un chêne à cheval sur deux tronçons soit dessiné en entier quel que
 * soit l'ordre de génération.
 */

import { Noise, mulberry32, hash2i, hash3i } from './noise.js';
import { CX, CZ, WORLD_H, SEA_LEVEL, idx } from './chunk.js';
import { idByName } from './blocks.js';

const ID = {};
for (const n of ['air', 'stone', 'dirt', 'grass_block', 'sand', 'sandstone', 'gravel', 'clay', 'water', 'lava',
  'bedrock', 'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'emerald_ore', 'lapis_ore', 'redstone_ore',
  'granite', 'diorite', 'andesite', 'snow_block', 'ice', 'cactus', 'dead_bush', 'tall_grass', 'dandelion',
  'poppy', 'oak_log', 'oak_leaves', 'birch_log', 'birch_leaves', 'spruce_log', 'spruce_leaves',
  'red_mushroom', 'brown_mushroom', 'pumpkin', 'coarse_dirt',
  'jungle_log', 'jungle_leaves', 'acacia_log', 'acacia_leaves', 'vine', 'sugar_cane',
  'red_sand', 'red_sandstone', 'terracotta', 'terracotta_orange', 'terracotta_white',
  'terracotta_yellow', 'podzol']) ID[n] = idByName(n);

/* ──────────────────────────────── Biomes ──────────────────────────────── */

/** Les quatre côtés d'un bloc : décalage x, décalage z, indice de face. */
const DIRS4 = [[1, 0, 0], [-1, 0, 1], [0, 1, 4], [0, -1, 5]];

export const BIOMES = [
  { name: 'ocean', label: 'Océan', top: ID.gravel, filler: ID.gravel, grass: [0x5a, 0x9e, 0x6a], foliage: [0x4f, 0x8e, 0x44], trees: 0, plants: 0 },
  { name: 'beach', cane: true, label: 'Plage', top: ID.sand, filler: ID.sand, grass: [0x8f, 0xc4, 0x6a], foliage: [0x6f, 0xa8, 0x4a], trees: 0, plants: 0.01 },
  { name: 'plains', cane: true, label: 'Plaines', top: ID.grass_block, filler: ID.dirt, grass: [0x91, 0xbd, 0x59], foliage: [0x77, 0xab, 0x2f], trees: 0.004, plants: 0.22, tree: 'oak', flowers: true },
  { name: 'forest', cane: true, label: 'Forêt', top: ID.grass_block, filler: ID.dirt, grass: [0x79, 0xc0, 0x5a], foliage: [0x59, 0xae, 0x30], trees: 0.055, plants: 0.28, tree: 'oak', flowers: true },
  { name: 'birch_forest', label: 'Forêt de bouleaux', top: ID.grass_block, filler: ID.dirt, grass: [0x88, 0xbb, 0x67], foliage: [0x6b, 0xa9, 0x41], trees: 0.05, plants: 0.24, tree: 'birch' },
  { name: 'taiga', label: 'Taïga', top: ID.grass_block, filler: ID.dirt, grass: [0x86, 0xb7, 0x83], foliage: [0x68, 0xa4, 0x64], trees: 0.06, plants: 0.14, tree: 'spruce', mushrooms: true },
  { name: 'desert', cane: true, label: 'Désert', top: ID.sand, filler: ID.sandstone, grass: [0xbf, 0xb7, 0x55], foliage: [0xae, 0xa4, 0x2a], trees: 0.002, plants: 0.02, tree: 'cactus', dead: true },
  { name: 'mountains', label: 'Montagnes', top: ID.grass_block, filler: ID.dirt, grass: [0x8a, 0xb6, 0x89], foliage: [0x6d, 0xa4, 0x6a], trees: 0.006, plants: 0.1, tree: 'spruce' },
  { name: 'snowy', label: 'Toundra enneigée', top: ID.snow_block, filler: ID.dirt, grass: [0x80, 0xb4, 0x97], foliage: [0x60, 0xa1, 0x7b], trees: 0.008, plants: 0.03, tree: 'spruce', snow: true },
  { name: 'jungle', label: 'Jungle', top: ID.grass_block, filler: ID.dirt, grass: [0x59, 0xc9, 0x3c], foliage: [0x30, 0xbb, 0x0b], trees: 0.065, plants: 0.45, tree: 'jungle', vines: true, mushrooms: true, cane: true },
  { name: 'savanna', cane: true, label: 'Savane', top: ID.grass_block, filler: ID.dirt, grass: [0xbf, 0xb7, 0x55], foliage: [0xae, 0xa4, 0x2a], trees: 0.014, plants: 0.3, tree: 'acacia' },
  { name: 'swamp', label: 'Marais', top: ID.grass_block, filler: ID.dirt, grass: [0x6a, 0x70, 0x39], foliage: [0x6a, 0x70, 0x39], trees: 0.03, plants: 0.35, tree: 'oak', vines: true, mushrooms: true, cane: true, swamp: true },
  { name: 'badlands', label: 'Badlands', top: ID.red_sand, filler: ID.terracotta, grass: [0x90, 0x81, 0x4d], foliage: [0x9e, 0x81, 0x4d], trees: 0.004, plants: 0.06, tree: 'cactus', dead: true, mesa: true },
];

/** Couleur de la strate de terre cuite à une altitude donnée (badlands). */
function mesaLayer(y) {
  const m = ((y % 23) + 23) % 23;
  if (m === 3 || m === 4 || m === 14) return ID.terracotta_orange;
  if (m === 8 || m === 17 || m === 18) return ID.terracotta_white;
  if (m === 11 || m === 21) return ID.terracotta_yellow;
  return ID.terracotta;
}

export const BIOME_ID = {};
BIOMES.forEach((b, i) => { BIOME_ID[b.name] = i; });

export class WorldGen {
  constructor(seed) {
    this.seed = seed | 0;
    this.nContinent = new Noise(seed + 1);
    this.nHills = new Noise(seed + 2);
    this.nMountain = new Noise(seed + 3);
    this.nTemp = new Noise(seed + 4);
    this.nHum = new Noise(seed + 5);
    this.nCave = new Noise(seed + 6);
    this.nCave2 = new Noise(seed + 7);
    this.nCavern = new Noise(seed + 8);
    this.nDirt = new Noise(seed + 9);
    this.nStoneType = new Noise(seed + 10);
  }

  /** Altitude du sol et biome d'une colonne du monde. */
  column(wx, wz) {
    const cont = this.nContinent.fbm2(wx / 900, wz / 900, 4);
    const hills = this.nHills.fbm2(wx / 190, wz / 190, 4);
    const ridge = this.nMountain.ridged2(wx / 420, wz / 420, 4);
    const temp = this.nTemp.fbm2(wx / 1100 + 30, wz / 1100 - 12, 3);
    const hum = this.nHum.fbm2(wx / 850 - 40, wz / 850 + 25, 3);

    let h = SEA_LEVEL + cont * 26 + hills * 7;
    const mountainMask = Math.max(0, Math.min(1, (ridge - 0.15) / 0.6)) * Math.max(0, Math.min(1, (cont + 0.1) * 3));
    h += mountainMask * 46;
    h = Math.round(h);

    let biome;
    if (h < SEA_LEVEL - 2) biome = BIOME_ID.ocean;
    else if (h <= SEA_LEVEL + 1) biome = BIOME_ID.beach;
    else if (h > SEA_LEVEL + 30) biome = BIOME_ID.mountains;
    else if (temp < -0.16) biome = hum > -0.05 ? BIOME_ID.taiga : BIOME_ID.snowy;
    else if (temp > 0.26 && hum < -0.02) biome = BIOME_ID.badlands;
    else if (temp > 0.16 && hum < 0.06) biome = BIOME_ID.desert;
    else if (temp > 0.04 && hum > 0.19) biome = BIOME_ID.jungle;
    else if (temp > 0.05 && hum >= 0.05 && hum <= 0.17) biome = BIOME_ID.savanna;
    else if (hum > 0.11 && h < SEA_LEVEL + 7) biome = BIOME_ID.swamp;
    else if (hum > 0.14) biome = temp > 0.02 ? BIOME_ID.forest : BIOME_ID.birch_forest;
    else if (hum > 0.02) biome = BIOME_ID.forest;
    else biome = BIOME_ID.plains;

    // Le marais est plat et gorgé d'eau ; les badlands montent en plateaux.
    if (biome === BIOME_ID.swamp) {
      // Terrain plat, criblé de mares : sans elles, un marais n'en est pas un.
      const plat = SEA_LEVEL + Math.round((h - SEA_LEVEL) * 0.25);
      const mare = this.nDirt.perlin2(wx / 27 + 90, wz / 27 - 40);
      h = plat + (mare > 0.1 ? -2 : 0);
    }
    else if (biome === BIOME_ID.badlands) h = SEA_LEVEL + 4 + Math.round((h - SEA_LEVEL) * 1.15);

    return { h, biome, temp, hum, mountainMask };
  }

  /** Densité de grotte : true = on creuse. */
  isCave(wx, y, wz, surface) {
    if (y < 2 || y > surface - 2) return false;
    const t1 = this.nCave.perlin3(wx / 46, y / 26, wz / 46);
    const t2 = this.nCave2.perlin3((wx + 1200) / 46, y / 26, (wz - 800) / 46);
    if (t1 * t1 + t2 * t2 < 0.0035) return true;
    if (y < 40) {
      const cav = this.nCavern.perlin3(wx / 60, y / 36, wz / 60);
      if (cav > 0.46) return true;
    }
    return false;
  }

  /** Remplit les blocs d'un tronçon (relief, grottes, filons, eau). */
  generate(chunk) {
    const { blocks, height, biome: biomeArr } = chunk;
    const baseX = chunk.cx * CX, baseZ = chunk.cz * CZ;
    const surfaces = new Int16Array(CX * CZ);

    for (let z = 0; z < CZ; z++) {
      for (let x = 0; x < CX; x++) {
        const wx = baseX + x, wz = baseZ + z;
        const col = this.column(wx, wz);
        const b = BIOMES[col.biome];
        biomeArr[x + z * CX] = col.biome;
        surfaces[x + z * CX] = col.h;

        const dirtDepth = 3 + Math.round(this.nDirt.perlin2(wx / 24, wz / 24) * 2);
        let stoneVar = 0;
        for (let y = 0; y <= Math.max(col.h, SEA_LEVEL); y++) {
          let id = 0;
          if (y === 0) id = ID.bedrock;
          else if (y <= 2 && hash3i(wx, y, wz, this.seed) < 0.6 - y * 0.2) id = ID.bedrock;
          else if (y > col.h) id = y <= SEA_LEVEL ? ID.water : 0;
          else if (y === col.h) id = col.h <= SEA_LEVEL + 1 && b.name !== 'desert' ? (col.h < SEA_LEVEL - 1 ? ID.gravel : ID.sand) : b.top;
          else if (b.mesa && y > col.h - 26) id = mesaLayer(y);
          else if (y > col.h - dirtDepth) id = b.filler;
          else {
            id = ID.stone;
            if ((y & 3) === 0) stoneVar = this.nStoneType.perlin3(wx / 30, y / 30, wz / 30);
            if (stoneVar > 0.42) id = ID.granite;
            else if (stoneVar < -0.44) id = ID.diorite;
            else if (stoneVar > 0.28 && stoneVar < 0.36) id = ID.andesite;
          }

          if (id && id !== ID.water && id !== ID.bedrock && this.isCave(wx, y, wz, col.h)) {
            id = y < 11 && hash3i(wx, y, wz, this.seed + 77) < 0.28 ? ID.lava : 0;
          }
          if (id) blocks[idx(x, y, z)] = id;
        }

        // Sable rouge en surface des badlands bas, terre cuite sur les hauteurs.
        if (b.mesa && col.h > SEA_LEVEL + 12) blocks[idx(x, col.h, z)] = mesaLayer(col.h);
        // Montagnes enneigées au-dessus de 88.
        if (col.h > 88 && b.top === ID.grass_block) blocks[idx(x, col.h, z)] = ID.snow_block;
        // Surface gelée dans la toundra.
        if (b.name === 'snowy' && col.h < SEA_LEVEL && blocks[idx(x, SEA_LEVEL, z)] === ID.water) {
          blocks[idx(x, SEA_LEVEL, z)] = ID.ice;
        }
        height[x + z * CX] = Math.max(col.h + 1, SEA_LEVEL + 1);
      }
    }

    this.ores(chunk);
    chunk.surfaces = surfaces;
    chunk.generated = true;
  }

  /** Filons de minerai : quelques amas par tronçon, profondeur et rareté à la Minecraft. */
  ores(chunk) {
    const rng = mulberry32((chunk.cx * 341873128 + chunk.cz * 132897987 + this.seed) >>> 0);
    const veins = [
      { id: ID.coal_ore, tries: 20, size: 12, min: 5, max: 110 },
      { id: ID.iron_ore, tries: 16, size: 8, min: 3, max: 68 },
      { id: ID.gold_ore, tries: 3, size: 7, min: 3, max: 34 },
      { id: ID.redstone_ore, tries: 5, size: 7, min: 2, max: 18 },
      { id: ID.diamond_ore, tries: 2, size: 6, min: 2, max: 16 },
      { id: ID.lapis_ore, tries: 2, size: 6, min: 3, max: 32 },
      { id: ID.emerald_ore, tries: 4, size: 2, min: 6, max: 96, mountainOnly: true },
      { id: ID.gravel, tries: 4, size: 24, min: 20, max: 70 },
      { id: ID.granite, tries: 3, size: 30, min: 5, max: 78 },
      { id: ID.andesite, tries: 3, size: 30, min: 5, max: 78 },
      { id: ID.diorite, tries: 3, size: 30, min: 5, max: 78 },
      { id: ID.dirt, tries: 4, size: 26, min: 10, max: 90 },
    ];
    for (const v of veins) {
      for (let t = 0; t < v.tries; t++) {
        const x0 = rng() * CX, z0 = rng() * CZ;
        const y0 = v.min + rng() * (v.max - v.min);
        if (v.mountainOnly) {
          const b = chunk.biome[(Math.min(15, x0 | 0)) + (Math.min(15, z0 | 0)) * CX];
          if (BIOMES[b].name !== 'mountains') continue;
        }
        const size = 2 + rng() * v.size;
        const rad = Math.cbrt(size) * 0.9;
        for (let dx = -rad; dx <= rad; dx++) {
          for (let dy = -rad; dy <= rad; dy++) {
            for (let dz = -rad; dz <= rad; dz++) {
              if (dx * dx + dy * dy + dz * dz > rad * rad) continue;
              const x = (x0 + dx) | 0, y = (y0 + dy) | 0, z = (z0 + dz) | 0;
              if (x < 0 || x >= CX || z < 0 || z >= CZ || y < 1 || y >= WORLD_H) continue;
              const i = idx(x, y, z);
              const cur = chunk.blocks[i];
              if (cur === ID.stone || cur === ID.granite || cur === ID.diorite || cur === ID.andesite) {
                chunk.blocks[i] = v.id;
              }
            }
          }
        }
      }
    }
  }

  /**
   * Décoration : arbres, fleurs, cactus, citrouilles.
   * Appelée quand le tronçon et ses voisins existent, pour que les arbres
   * débordent proprement d'un tronçon à l'autre.
   */
  populate(world, chunk) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        this.featuresOf(world, chunk.cx + dx, chunk.cz + dz, chunk);
      }
    }
    chunk.populated = true;
  }

  /** Calcule les décors « appartenant » au tronçon (fcx,fcz) et n'écrit que dans `target`. */
  featuresOf(world, fcx, fcz, target) {
    const rng = mulberry32((fcx * 1013904223 + fcz * 1664525 + this.seed * 7919) >>> 0);
    const baseX = fcx * CX, baseZ = fcz * CZ;
    const put = (wx, wy, wz, id, force = false, data = 0) => {
      const lx = wx - target.cx * CX, lz = wz - target.cz * CZ;
      if (lx < 0 || lx >= CX || lz < 0 || lz >= CZ || wy < 0 || wy >= WORLD_H) return;
      const i = idx(lx, wy, lz);
      const cur = target.blocks[i];
      if (!force && cur !== 0 && cur !== ID.water) return;
      target.blocks[i] = id;
      if (data) target.setData(lx, wy, lz, data);
    };
    const groundAt = (wx, wz) => this.column(wx, wz);

    // Arbres
    for (let i = 0; i < 24; i++) {
      const wx = baseX + Math.floor(rng() * CX);
      const wz = baseZ + Math.floor(rng() * CZ);
      const col = groundAt(wx, wz);
      const b = BIOMES[col.biome];
      // `trees` est une probabilité par colonne : 24 tentatives sur 256 colonnes.
      if (!b.tree || rng() > b.trees * 10.7) continue;
      if (col.h <= SEA_LEVEL) continue;
      if (b.tree === 'cactus') this.cactus(put, wx, col.h + 1, wz, rng);
      else this.tree(put, wx, col.h + 1, wz, b.tree, rng, b.vines);
    }

    // Herbes, fleurs, champignons, citrouilles
    for (let i = 0; i < 40; i++) {
      const wx = baseX + Math.floor(rng() * CX);
      const wz = baseZ + Math.floor(rng() * CZ);
      const col = groundAt(wx, wz);
      const b = BIOMES[col.biome];
      if (col.h <= SEA_LEVEL) continue;
      const r = rng();
      if (r > b.plants * 3) continue;
      const y = col.h + 1;
      if (b.dead) { if (rng() < 0.5) put(wx, y, wz, ID.dead_bush); continue; }
      if (b.snow) { if (rng() < 0.3) put(wx, y, wz, ID.tall_grass); continue; }
      // Canne à sucre : uniquement les pieds dans l'eau, comme dans le jeu.
      if (b.cane && rng() < 0.35) {
        const bordDeau = [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .some(([ox, oz]) => groundAt(wx + ox, wz + oz).h < SEA_LEVEL);
        if (bordDeau) {
          const h = 2 + Math.floor(rng() * 3);
          for (let k = 0; k < h; k++) put(wx, y + k, wz, ID.sugar_cane);
          continue;
        }
      }
      const q = rng();
      if (b.flowers && q < 0.12) put(wx, y, wz, ID.dandelion);
      else if (b.flowers && q < 0.2) put(wx, y, wz, ID.poppy);
      else if (b.mushrooms && q < 0.26) put(wx, y, wz, q < 0.23 ? ID.red_mushroom : ID.brown_mushroom);
      else if (q < 0.03) put(wx, y, wz, ID.pumpkin);
      else put(wx, y, wz, ID.tall_grass);
    }
  }

  /** Un arbre : tronc + houppier, forme dépendante de l'essence. */
  tree(put, x, y, z, kind, rng, vines = false) {
    const LOGS = { oak: ID.oak_log, birch: ID.birch_log, spruce: ID.spruce_log, jungle: ID.jungle_log, acacia: ID.acacia_log };
    const LEAVES = { oak: ID.oak_leaves, birch: ID.birch_leaves, spruce: ID.spruce_leaves, jungle: ID.jungle_leaves, acacia: ID.acacia_leaves };
    const logId = LOGS[kind] ?? ID.oak_log;
    const leafId = LEAVES[kind] ?? ID.oak_leaves;
    const feuilles = [];
    const poseFeuille = (fx, fy, fz) => { put(fx, fy, fz, leafId); feuilles.push([fx, fy, fz]); };

    if (kind === 'spruce') {
      const h = 7 + Math.floor(rng() * 5);
      for (let i = 0; i < h; i++) put(x, y + i, z, logId, true);
      for (let i = h - 1; i >= 2; i--) {
        const couche = h - 1 - i;
        const r = couche % 2 === 0 ? Math.min(3, 1 + Math.floor(couche / 2)) : Math.max(1, Math.floor(couche / 2));
        for (let dx = -r; dx <= r; dx++) {
          for (let dz = -r; dz <= r; dz++) {
            if (Math.abs(dx) + Math.abs(dz) > r + 1) continue;
            if (dx === 0 && dz === 0 && i < h) continue;
            poseFeuille(x + dx, y + i, z + dz);
          }
        }
      }
      poseFeuille(x, y + h, z);
      return;
    }

    if (kind === 'acacia') {
      // Tronc droit puis penché, houppier plat : la silhouette de la savane.
      const tronc = 4 + Math.floor(rng() * 2);
      for (let i = 0; i < tronc; i++) put(x, y + i, z, logId, true);
      const dx = rng() < 0.5 ? 1 : -1;
      const dz = rng() < 0.5 ? 1 : -1;
      const penche = rng() < 0.5;
      let cx = x, cz = z, cy = y + tronc;
      for (let i = 0; i < 3; i++) {
        if (penche) cx += dx; else cz += dz;
        put(cx, cy, cz, logId, true);
        cy++;
      }
      for (let ry = 0; ry < 2; ry++) {
        const r = ry === 0 ? 3 : 2;
        for (let ox = -r; ox <= r; ox++) {
          for (let oz = -r; oz <= r; oz++) {
            if (Math.abs(ox) + Math.abs(oz) > r + 1) continue;
            poseFeuille(cx + ox, cy - 1 + ry, cz + oz);
          }
        }
      }
      return;
    }

    if (kind === 'jungle') {
      // Grand fût nu et couronne haute, d'où pendent les lianes.
      const h = 9 + Math.floor(rng() * 6);
      for (let i = 0; i < h; i++) put(x, y + i, z, logId, true);
      for (let dy = h - 2; dy <= h + 1; dy++) {
        const r = dy >= h ? 2 : 3;
        for (let dx = -r; dx <= r; dx++) {
          for (let dz = -r; dz <= r; dz++) {
            if (dx * dx + dz * dz > r * r + 1) continue;
            if (dx === 0 && dz === 0 && dy < h) continue;
            if (Math.abs(dx) === r && Math.abs(dz) === r && rng() < 0.6) continue;
            poseFeuille(x + dx, y + dy, z + dz);
          }
        }
      }
      // Quelques lianes le long du tronc.
      for (let i = 3; i < h - 2; i++) {
        if (rng() < 0.35) {
          const [ox, oz, face] = DIRS4[(rng() * 4) | 0];
          put(x + ox, y + i, z + oz, ID.vine, false, face ^ 1);
        }
      }
      this.vines(put, feuilles, rng);
      return;
    }

    const h = (kind === 'birch' ? 6 : 5) + Math.floor(rng() * 3);
    for (let i = 0; i < h; i++) put(x, y + i, z, logId, true);
    for (let dy = h - 3; dy <= h; dy++) {
      const r = dy >= h - 1 ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx === 0 && dz === 0 && dy < h) continue;
          if (Math.abs(dx) === r && Math.abs(dz) === r && (rng() < 0.5 || dy >= h - 1)) continue;
          poseFeuille(x + dx, y + dy, z + dz);
        }
      }
    }
    if (vines) this.vines(put, feuilles, rng);
  }

  /** Rideaux de lianes accrochés sous le houppier. */
  vines(put, feuilles, rng) {
    for (const [fx, fy, fz] of feuilles) {
      if (rng() > 0.22) continue;
      const [ox, oz, face] = DIRS4[(rng() * 4) | 0];
      const longueur = 1 + Math.floor(rng() * 5);
      for (let k = 0; k < longueur; k++) put(fx + ox, fy - k, fz + oz, ID.vine, false, face ^ 1);
    }
  }

  cactus(put, x, y, z, rng) {
    const h = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < h; i++) put(x, y + i, z, ID.cactus, true);
  }

  /** Point d'apparition : première colonne solide et sèche autour de l'origine. */
  findSpawn() {
    for (let r = 0; r < 90; r++) {
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        const x = Math.round(Math.cos(ang) * r * 6);
        const z = Math.round(Math.sin(ang) * r * 6);
        const col = this.column(x, z);
        if (col.h > SEA_LEVEL + 1 && col.h < 90) return { x: x + 0.5, y: col.h + 2, z: z + 0.5 };
      }
    }
    return { x: 0.5, y: 80, z: 0.5 };
  }
}
