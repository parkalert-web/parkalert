/**
 * Minecraft JS — un tronçon (chunk) de monde : 16 × 128 × 16 voxels.
 *
 * Trois tableaux parallèles :
 *   blocks — l'identifiant du bloc
 *   data   — 4 bits d'état (orientation d'un four, croissance du blé…)
 *   light  — 4 bits de lumière du ciel + 4 bits de lumière de bloc
 */

export const CX = 16;
export const CZ = 16;
export const WORLD_H = 128;
export const SEA_LEVEL = 48;
export const CHUNK_VOLUME = CX * CZ * WORLD_H;

/** Index linéaire d'un voxel local. L'axe Y a le plus grand pas : les colonnes sont contiguës en X/Z. */
export const idx = (x, y, z) => x + (z << 4) + (y << 8);

/** Clé numérique d'un tronçon : une seule valeur entière, sans allocation. */
export function chunkKey(cx, cz) { return (cx + 32768) * 65536 + (cz + 32768); }

/** Clé textuelle, uniquement pour la sauvegarde. */
export function chunkKeyStr(cx, cz) { return `${cx},${cz}`; }

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_VOLUME);
    this.data = null;                  // alloué à la demande
    this.light = new Uint8Array(CHUNK_VOLUME);
    this.height = new Uint8Array(CX * CZ);   // hauteur du plus haut bloc opaque + 1
    this.biome = new Uint8Array(CX * CZ);
    this.blockEntities = new Map();    // index → { type, … } (four, coffre)
    this.generated = false;
    this.populated = false;
    this.lit = false;
    this.dirty = true;                 // maillage à refaire
    this.modified = false;             // à sauvegarder
    this.mesh = null;
    this.lastUse = 0;
  }

  get(x, y, z) {
    if (y < 0 || y >= WORLD_H) return 0;
    return this.blocks[idx(x, y, z)];
  }

  set(x, y, z, id) {
    if (y < 0 || y >= WORLD_H) return;
    this.blocks[idx(x, y, z)] = id;
  }

  getData(x, y, z) {
    if (!this.data || y < 0 || y >= WORLD_H) return 0;
    return this.data[idx(x, y, z)];
  }

  setData(x, y, z, v) {
    if (y < 0 || y >= WORLD_H) return;
    if (!this.data) this.data = new Uint8Array(CHUNK_VOLUME);
    this.data[idx(x, y, z)] = v & 15;
  }

  getSky(x, y, z) {
    if (y < 0) return 0;
    if (y >= WORLD_H) return 15;
    return this.light[idx(x, y, z)] >> 4;
  }

  setSky(x, y, z, v) {
    if (y < 0 || y >= WORLD_H) return;
    const i = idx(x, y, z);
    this.light[i] = (this.light[i] & 0x0f) | (v << 4);
  }

  getBlockLight(x, y, z) {
    if (y < 0 || y >= WORLD_H) return 0;
    return this.light[idx(x, y, z)] & 15;
  }

  setBlockLight(x, y, z, v) {
    if (y < 0 || y >= WORLD_H) return;
    const i = idx(x, y, z);
    this.light[i] = (this.light[i] & 0xf0) | (v & 15);
  }

  getHeight(x, z) { return this.height[x + z * CX]; }

  /** Recalcule la hauteur de la colonne (premier bloc qui arrête la lumière). */
  recomputeHeight(x, z, isOpaqueFn) {
    let h = 0;
    for (let y = WORLD_H - 1; y >= 0; y--) {
      if (isOpaqueFn(this.blocks[idx(x, y, z)])) { h = y + 1; break; }
    }
    this.height[x + z * CX] = h;
    return h;
  }

  getBiome(x, z) { return this.biome[x + z * CX]; }

  /** Entité de bloc (four, coffre) à une position locale. */
  getEntity(x, y, z) { return this.blockEntities.get(idx(x, y, z)) || null; }
  setEntity(x, y, z, e) {
    if (e) this.blockEntities.set(idx(x, y, z), e);
    else this.blockEntities.delete(idx(x, y, z));
  }
}
