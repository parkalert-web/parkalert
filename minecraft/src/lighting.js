/**
 * Minecraft JS — propagation de la lumière.
 *
 * Deux canaux indépendants, comme dans le jeu :
 *   • la lumière du ciel, qui tombe verticalement sans s'affaiblir puis
 *     déborde latéralement en perdant un niveau par bloc ;
 *   • la lumière des blocs (torche, lave, pierre lumineuse), qui rayonne
 *     depuis sa source.
 *
 * L'algorithme est le classique « BFS d'ajout / BFS de retrait » : poser un
 * bloc opaque efface la lumière alentour puis la laisse revenir depuis les
 * bords, ce qui donne des ombres correctes sans tout recalculer.
 */

import { WORLD_H } from './chunk.js';

const DIRS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

/** File plate (x,y,z[,niveau]) — évite d'allouer un objet par voxel. */
class Queue {
  constructor(stride) { this.a = []; this.i = 0; this.stride = stride; }
  push(...v) { for (const x of v) this.a.push(x); }
  get empty() { return this.i >= this.a.length; }
  shift() { const s = this.stride, out = this.a.slice(this.i, this.i + s); this.i += s; return out; }
  reset() { this.a.length = 0; this.i = 0; }
  get size() { return (this.a.length - this.i) / this.stride; }
}

export class LightEngine {
  constructor(world) {
    this.world = world;
    this.blockAdd = new Queue(3);
    this.blockRemove = new Queue(4);
    this.skyAdd = new Queue(3);
    this.skyRemove = new Queue(4);
  }

  get pending() {
    return this.blockAdd.size + this.blockRemove.size + this.skyAdd.size + this.skyRemove.size;
  }

  /**
   * Lumière du ciel initiale d'un tronçon : colonne verticale à 15 jusqu'au
   * premier bloc qui arrête la lumière, puis débordement latéral.
   */
  initSky(chunk) {
    const w = this.world;
    const bx = chunk.cx * 16, bz = chunk.cz * 16;
    const tops = chunk.height; // hauteur du premier bloc opaque + 1

    // Passe 1 — descente verticale, colonne par colonne.
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        let level = 15;
        let top = 0;
        for (let y = WORLD_H - 1; y >= 0; y--) {
          const i = x + (z << 4) + (y << 8);
          const op = w.opacityOf(chunk.blocks[i]);
          if (op >= 15) { top = y + 1; break; }
          if (op > 0) level = Math.max(0, level - op);
          chunk.light[i] = (chunk.light[i] & 0x0f) | (level << 4);
          // Sous un bloc qui filtre (eau, feuilles), la lumière doit aussi
          // repartir sur les côtés.
          if (level > 0 && level < 15) this.skyAdd.push(bx + x, y, bz + z);
          if (level === 0) { top = y + 1; break; }
        }
        for (let y = top - 1; y >= 0; y--) {
          const i = x + (z << 4) + (y << 8);
          chunk.light[i] = chunk.light[i] & 0x0f;
        }
        tops[x + z * 16] = top;
      }
    }

    // Passe 2 — n'amorcer que les voxels utiles : ceux qui longent une paroi
    // plus haute. Ailleurs, tout le ciel est déjà à 15, rien à propager.
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const h = tops[x + z * 16];
        let hMax = h;
        if (x > 0) hMax = Math.max(hMax, tops[x - 1 + z * 16]);
        if (x < 15) hMax = Math.max(hMax, tops[x + 1 + z * 16]);
        if (z > 0) hMax = Math.max(hMax, tops[x + (z - 1) * 16]);
        if (z < 15) hMax = Math.max(hMax, tops[x + (z + 1) * 16]);
        for (let y = h; y < hMax; y++) this.skyAdd.push(bx + x, y, bz + z);
      }
    }
    chunk.lit = true;
  }

  /** Sources de lumière (torches, lave…) présentes dans un tronçon fraîchement chargé. */
  initBlockLights(chunk) {
    const bx = chunk.cx * 16, bz = chunk.cz * 16;
    for (let y = 0; y < WORLD_H; y++) {
      for (let z = 0; z < 16; z++) {
        for (let x = 0; x < 16; x++) {
          const id = chunk.blocks[x + (z << 4) + (y << 8)];
          if (!id) continue;
          const em = this.world.lightOf(id);
          if (em > 0) {
            chunk.setBlockLight(x, y, z, em);
            this.blockAdd.push(bx + x, y, bz + z);
          }
        }
      }
    }
  }

  /** Relance la lumière à la frontière de deux tronçons voisins. */
  stitch(chunk, other) {
    const dx = other.cx - chunk.cx, dz = other.cz - chunk.cz;
    const aBase = { x: chunk.cx * 16, z: chunk.cz * 16 };
    const bBase = { x: other.cx * 16, z: other.cz * 16 };
    for (let y = 0; y < WORLD_H; y++) {
      for (let i = 0; i < 16; i++) {
        let ax, az, bx2, bz2;
        if (dx !== 0) {
          ax = dx > 0 ? 15 : 0; az = i; bx2 = dx > 0 ? 0 : 15; bz2 = i;
        } else {
          ax = i; az = dz > 0 ? 15 : 0; bx2 = i; bz2 = dz > 0 ? 0 : 15;
        }
        const ia = ax + (az << 4) + (y << 8);
        const ib = bx2 + (bz2 << 4) + (y << 8);
        const la = chunk.light[ia], lb = other.light[ib];
        const skyA = la >> 4, skyB = lb >> 4, blkA = la & 15, blkB = lb & 15;
        if (skyA > skyB + 1 || blkA > blkB + 1) {
          if (skyA > 1) this.skyAdd.push(aBase.x + ax, y, aBase.z + az);
          if (blkA > 1) this.blockAdd.push(aBase.x + ax, y, aBase.z + az);
        }
        if (skyB > skyA + 1 || blkB > blkA + 1) {
          if (skyB > 1) this.skyAdd.push(bBase.x + bx2, y, bBase.z + bz2);
          if (blkB > 1) this.blockAdd.push(bBase.x + bx2, y, bBase.z + bz2);
        }
      }
    }
  }

  /** Un bloc a changé : on efface puis on laisse la lumière revenir. */
  onBlockChange(x, y, z, oldId, newId) {
    const w = this.world;
    const oldEmit = w.lightOf(oldId);
    const newEmit = w.lightOf(newId);

    // Lumière de bloc
    if (oldEmit > 0) {
      const cur = w.getBlockLight(x, y, z);
      w.setBlockLight(x, y, z, 0);
      this.blockRemove.push(x, y, z, cur);
    } else if (w.opacityOf(newId) >= 15 || w.opacityOf(newId) > w.opacityOf(oldId)) {
      const cur = w.getBlockLight(x, y, z);
      if (cur > 0) { w.setBlockLight(x, y, z, 0); this.blockRemove.push(x, y, z, cur); }
    }
    if (newEmit > 0) {
      w.setBlockLight(x, y, z, newEmit);
      this.blockAdd.push(x, y, z);
    } else {
      for (const [dx, dy, dz] of DIRS) {
        if (w.getBlockLight(x + dx, y + dy, z + dz) > 0) this.blockAdd.push(x + dx, y + dy, z + dz);
      }
    }

    // Lumière du ciel : la colonne sous le bloc modifié est entièrement revue.
    const curSky = w.getSkyLight(x, y, z);
    if (curSky > 0) {
      w.setSkyLight(x, y, z, 0);
      this.skyRemove.push(x, y, z, curSky);
    }
    if (w.opacityOf(newId) < 15) {
      // La lumière peut de nouveau descendre : on réamorce depuis le dessus et les côtés.
      for (const [dx, dy, dz] of DIRS) {
        if (w.getSkyLight(x + dx, y + dy, z + dz) > 0) this.skyAdd.push(x + dx, y + dy, z + dz);
      }
      const above = w.getSkyLight(x, y + 1, z);
      const op = w.opacityOf(newId);
      const lvl = above === 15 && op === 0 ? 15 : Math.max(0, above - Math.max(1, op));
      if (lvl > 0) { w.setSkyLight(x, y, z, lvl); this.skyAdd.push(x, y, z); }
    }
  }

  /**
   * Traite les files en attente.
   * @param {number} budget nombre maximum de voxels traités (0 = tout)
   */
  update(budget = 0) {
    const w = this.world;
    let n = 0;
    const limit = budget || Infinity;

    while (!this.blockRemove.empty && n < limit) {
      const [x, y, z, level] = this.blockRemove.shift(); n++;
      for (const [dx, dy, dz] of DIRS) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (ny < 0 || ny >= WORLD_H) continue;
        const nl = w.getBlockLight(nx, ny, nz);
        if (nl !== 0 && nl < level) {
          w.setBlockLight(nx, ny, nz, 0);
          w.markLightDirty(nx, ny, nz);
          this.blockRemove.push(nx, ny, nz, nl);
        } else if (nl >= level) {
          this.blockAdd.push(nx, ny, nz);
        }
      }
    }

    while (!this.blockAdd.empty && n < limit) {
      const [x, y, z] = this.blockAdd.shift(); n++;
      const level = w.getBlockLight(x, y, z);
      if (level <= 1) continue;
      for (const [dx, dy, dz] of DIRS) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (ny < 0 || ny >= WORLD_H) continue;
        const op = Math.max(1, w.opacityOf(w.getBlock(nx, ny, nz)));
        const target = level - op;
        if (target <= 0) continue;
        if (w.getBlockLight(nx, ny, nz) < target) {
          w.setBlockLight(nx, ny, nz, target);
          w.markLightDirty(nx, ny, nz);
          this.blockAdd.push(nx, ny, nz);
        }
      }
    }

    while (!this.skyRemove.empty && n < limit) {
      const [x, y, z, level] = this.skyRemove.shift(); n++;
      for (const [dx, dy, dz] of DIRS) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (ny < 0 || ny >= WORLD_H) continue;
        const nl = w.getSkyLight(nx, ny, nz);
        const straightDown = dy === -1 && level === 15;
        if (nl !== 0 && (nl < level || straightDown)) {
          w.setSkyLight(nx, ny, nz, 0);
          w.markLightDirty(nx, ny, nz);
          this.skyRemove.push(nx, ny, nz, nl);
        } else if (nl >= level) {
          this.skyAdd.push(nx, ny, nz);
        }
      }
    }

    while (!this.skyAdd.empty && n < limit) {
      const [x, y, z] = this.skyAdd.shift(); n++;
      const level = w.getSkyLight(x, y, z);
      if (level <= 0) continue;
      for (const [dx, dy, dz] of DIRS) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (ny < 0 || ny >= WORLD_H) continue;
        const op = w.opacityOf(w.getBlock(nx, ny, nz));
        if (op >= 15) continue;
        // Vers le bas, la lumière maximale traverse sans perte.
        const target = (dy === -1 && level === 15 && op === 0) ? 15 : level - Math.max(1, op);
        if (target <= 0) continue;
        if (w.getSkyLight(nx, ny, nz) < target) {
          w.setSkyLight(nx, ny, nz, target);
          w.markLightDirty(nx, ny, nz);
          this.skyAdd.push(nx, ny, nz);
        }
      }
    }

    // Recyclage des files vidées, pour ne pas les laisser grossir indéfiniment.
    for (const q of [this.blockAdd, this.blockRemove, this.skyAdd, this.skyRemove]) {
      if (q.empty && q.a.length > 4096) q.reset();
    }
    return n;
  }
}
