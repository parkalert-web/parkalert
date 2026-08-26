/**
 * Minecraft JS — construction du maillage d'un tronçon.
 *
 * Seules les faces visibles sont émises. Chaque sommet tient sur 8 octets
 * (deux entiers 32 bits décodés dans le nuanceur), ce qui permet de garder
 * des centaines de tronçons en mémoire vidéo :
 *
 *   p0 : x(5) y(8) z(5) u(1) v(1) normale(3) décalage(2) occlusion(2)
 *   p1 : couche d'atlas(8) ciel(4) bloc(4) teinte r(5) g(5) b(5)
 *
 * L'éclairage est « doux » : chaque coin moyenne la lumière des quatre voxels
 * qui le touchent, et l'occlusion ambiante assombrit les angles rentrants,
 * exactement comme le rendu « fancy » du jeu.
 */

import { BLOCKS, blockTile } from './blocks.js';
import { CX, CZ, WORLD_H, idx } from './chunk.js';
import { BIOMES } from './worldgen.js';

/* Coins des six faces, dans le sens trigonométrique vu de l'extérieur. */
const FACE_CORNERS = [
  [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], // +X
  [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], // −X
  [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], // +Y
  [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], // −Y
  [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], // +Z
  [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], // −Z
];

const FACE_UV = [
  [[0, 1], [1, 1], [1, 0], [0, 0]],
  [[0, 1], [1, 1], [1, 0], [0, 0]],
  [[0, 1], [1, 1], [1, 0], [0, 0]],
  [[0, 0], [1, 0], [1, 1], [0, 1]],
  [[1, 1], [0, 1], [0, 0], [1, 0]],
  [[1, 1], [0, 1], [0, 0], [1, 0]],
];

const FACE_NORMAL = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

/**
 * Pour chaque face et chaque coin : les trois voxels voisins qui décident
 * de l'occlusion ambiante et de la lumière du coin.
 */
const AO_OFFSETS = FACE_CORNERS.map((corners, f) => {
  const n = FACE_NORMAL[f];
  const axes = [0, 1, 2].filter((a) => n[a] === 0);
  return corners.map((c) => {
    const s = axes.map((a) => (c[a] === 1 ? 1 : -1));
    const e = (a, k) => { const v = [0, 0, 0]; v[a] = k; return v; };
    const add = (...vs) => vs.reduce((acc, v) => [acc[0] + v[0], acc[1] + v[1], acc[2] + v[2]], [0, 0, 0]);
    const s1 = e(axes[0], s[0]), s2 = e(axes[1], s[1]);
    return { side1: add(n, s1), side2: add(n, s2), corner: add(n, s1, s2), front: n };
  });
});

/** Tampon de sommets qui grandit tout seul. */
class Builder {
  constructor() {
    this.cap = 4096;
    this.p0 = new Uint32Array(this.cap);
    this.p1 = new Uint32Array(this.cap);
    this.n = 0;
    this.quads = 0;
    this.flips = [];
  }

  grow() {
    this.cap *= 2;
    const a = new Uint32Array(this.cap); a.set(this.p0); this.p0 = a;
    const b = new Uint32Array(this.cap); b.set(this.p1); this.p1 = b;
  }

  vert(p0, p1) {
    if (this.n >= this.cap) this.grow();
    this.p0[this.n] = p0;
    this.p1[this.n] = p1;
    this.n++;
  }

  /** Construit les indices : deux triangles par quadrilatère, diagonale choisie
   *  selon l'occlusion pour éviter les artefacts en « escalier ». */
  indices() {
    const idxArr = this.n > 65535 ? new Uint32Array(this.quads * 6) : new Uint16Array(this.quads * 6);
    for (let q = 0; q < this.quads; q++) {
      const b = q * 4, o = q * 6;
      if (this.flips[q]) {
        idxArr[o] = b + 1; idxArr[o + 1] = b + 2; idxArr[o + 2] = b + 3;
        idxArr[o + 3] = b + 1; idxArr[o + 4] = b + 3; idxArr[o + 5] = b;
      } else {
        idxArr[o] = b; idxArr[o + 1] = b + 1; idxArr[o + 2] = b + 2;
        idxArr[o + 3] = b; idxArr[o + 4] = b + 2; idxArr[o + 5] = b + 3;
      }
    }
    return idxArr;
  }

  result() {
    if (!this.quads) return null;
    return {
      p0: this.p0.subarray(0, this.n),
      p1: this.p1.subarray(0, this.n),
      index: this.indices(),
      count: this.quads * 6,
    };
  }
}

const pack0 = (x, y, z, u, v, n, off, ao) =>
  (x & 31) | ((y & 255) << 5) | ((z & 31) << 13) | (u << 18) | (v << 19) | (n << 20) | (off << 23) | (ao << 25);

const pack1 = (layer, sky, blk, r, g, b) =>
  (layer & 255) | ((sky & 15) << 8) | ((blk & 15) << 12) | ((r & 31) << 16) | ((g & 31) << 21) | ((b & 31) << 26);

/**
 * Construit les trois maillages d'un tronçon.
 * @returns {{opaque:object|null, cutout:object|null, water:object|null}}
 */
export function buildChunkMesh(world, chunk) {
  const solid = new Builder();
  const cutout = new Builder();
  const water = new Builder();

  const blocks = chunk.blocks;
  const baseX = chunk.cx * CX, baseZ = chunk.cz * CZ;

  // Hauteur utile : inutile de parcourir le ciel vide.
  let maxY = 0;
  for (let i = blocks.length - 1; i >= 0; i--) { if (blocks[i]) { maxY = (i >> 8) + 1; break; } }

  // Voisins directs, pour éviter une recherche de tronçon par voxel.
  const nc = {
    px: world.chunkAt(chunk.cx + 1, chunk.cz), nx: world.chunkAt(chunk.cx - 1, chunk.cz),
    pz: world.chunkAt(chunk.cx, chunk.cz + 1), nz: world.chunkAt(chunk.cx, chunk.cz - 1),
    pxpz: world.chunkAt(chunk.cx + 1, chunk.cz + 1), pxnz: world.chunkAt(chunk.cx + 1, chunk.cz - 1),
    nxpz: world.chunkAt(chunk.cx - 1, chunk.cz + 1), nxnz: world.chunkAt(chunk.cx - 1, chunk.cz - 1),
  };

  /** Tronçon contenant une position locale éventuellement hors bornes. */
  const chunkFor = (x, z) => {
    if (x < 0) return z < 0 ? nc.nxnz : z > 15 ? nc.nxpz : nc.nx;
    if (x > 15) return z < 0 ? nc.pxnz : z > 15 ? nc.pxpz : nc.px;
    if (z < 0) return nc.nz;
    if (z > 15) return nc.pz;
    return chunk;
  };

  const getId = (x, y, z) => {
    if (y < 0 || y >= WORLD_H) return 0;
    if (x >= 0 && x < 16 && z >= 0 && z < 16) return blocks[idx(x, y, z)];
    const c = chunkFor(x, z);
    return c ? c.blocks[idx(x & 15, y, z & 15)] : 0;
  };

  const getLight = (x, y, z) => {
    if (y < 0) return 0;
    if (y >= WORLD_H) return 0xf0;
    if (x >= 0 && x < 16 && z >= 0 && z < 16) return chunk.light[idx(x, y, z)];
    const c = chunkFor(x, z);
    return c ? c.light[idx(x & 15, y, z & 15)] : 0xf0;
  };

  // Teintes de biome, lissées sur 3×3 colonnes pour éviter les frontières nettes.
  const tintCache = new Int32Array(CX * CZ * 2).fill(-1);
  const biomeTint = (lx, lz, kind) => {
    const ci = (lx + lz * CX) * 2 + (kind === 'grass' ? 0 : 1);
    if (tintCache[ci] >= 0) return tintCache[ci];
    let r = 0, g = 0, b = 0, n = 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const c = chunkFor(lx + dx, lz + dz);
        if (!c) continue;
        const bi = c.biome[((lx + dx) & 15) + (((lz + dz) & 15) * CX)];
        const col = kind === 'grass' ? BIOMES[bi].grass : BIOMES[bi].foliage;
        r += col[0]; g += col[1]; b += col[2]; n++;
      }
    }
    if (!n) { r = g = b = 255; n = 1; }
    const packed = (((r / n) >> 3) & 31) | ((((g / n) >> 3) & 31) << 5) | ((((b / n) >> 3) & 31) << 10);
    tintCache[ci] = packed;
    return packed;
  };

  const emitFace = (build, lx, y, lz, face, layer, tint, offMode, bl) => {
    const corners = FACE_CORNERS[face];
    const uvs = FACE_UV[face];
    const ao = AO_OFFSETS[face];
    const r = tint & 31, g = (tint >> 5) & 31, b = (tint >> 10) & 31;
    const aos = [0, 0, 0, 0];
    const skies = [0, 0, 0, 0];
    const blks = [0, 0, 0, 0];

    for (let i = 0; i < 4; i++) {
      const o = ao[i];
      const s1 = BLOCKS[getId(lx + o.side1[0], y + o.side1[1], lz + o.side1[2])].opaque ? 1 : 0;
      const s2 = BLOCKS[getId(lx + o.side2[0], y + o.side2[1], lz + o.side2[2])].opaque ? 1 : 0;
      const co = BLOCKS[getId(lx + o.corner[0], y + o.corner[1], lz + o.corner[2])].opaque ? 1 : 0;
      aos[i] = (s1 && s2) ? 0 : 3 - (s1 + s2 + co);

      // Lumière lissée : moyenne des voxels transparents qui touchent le coin.
      let sky = 0, blkL = 0, n = 0;
      for (const p of [o.front, o.side1, o.side2, o.corner]) {
        const id = getId(lx + p[0], y + p[1], lz + p[2]);
        if (BLOCKS[id].opaque) continue;
        const l = getLight(lx + p[0], y + p[1], lz + p[2]);
        sky += l >> 4; blkL += l & 15; n++;
      }
      if (!n) { const l = getLight(lx + o.front[0], y + o.front[1], lz + o.front[2]); sky = l >> 4; blkL = l & 15; n = 1; }
      skies[i] = Math.round(sky / n);
      blks[i] = Math.round(blkL / n);
    }

    // Diagonale du quadrilatère : on la bascule quand l'occlusion l'exige.
    const flip = aos[0] + aos[2] < aos[1] + aos[3];
    for (let i = 0; i < 4; i++) {
      const c = corners[i];
      let off = offMode;
      // L'eau de surface est légèrement rabaissée : seuls les sommets hauts bougent.
      if (offMode === 1 && c[1] === 0) off = 0;
      build.vert(
        pack0(lx + c[0], y + c[1], lz + c[2], uvs[i][0], uvs[i][1], face, off, aos[i]),
        pack1(layer, skies[i], blks[i], r, g, b),
      );
    }
    build.flips[build.quads] = flip;
    build.quads++;
  };

  const WHITE = 31 | (31 << 5) | (31 << 10);

  for (let y = 0; y < maxY; y++) {
    for (let z = 0; z < CZ; z++) {
      for (let x = 0; x < CX; x++) {
        const id = blocks[idx(x, y, z)];
        if (!id) continue;
        const bl = BLOCKS[id];
        if (bl.render === 'none') continue;
        const data = chunk.data ? chunk.data[idx(x, y, z)] : 0;
        const tint = bl.tint ? biomeTint(x, z, bl.tint) : WHITE;

        if (bl.render === 'cross') {
          // Deux quadrilatères en croix, visibles des deux côtés.
          const layer = blockTile(bl, 0, data);
          const l = getLight(x, y, z);
          const sky = l >> 4, blk = l & 15;
          const quads = [
            [[0, 0, 0], [1, 0, 1], [1, 1, 1], [0, 1, 0]],
            [[1, 0, 0], [0, 0, 1], [0, 1, 1], [1, 1, 0]],
          ];
          for (const q of quads) {
            for (const dir of [0, 1]) {
              const order = dir ? [3, 2, 1, 0] : [0, 1, 2, 3];
              const uv = [[0, 1], [1, 1], [1, 0], [0, 0]];
              for (let k = 0; k < 4; k++) {
                const i = order[k];
                const c = q[i];
                cutout.vert(
                  pack0(x + c[0], y + c[1], z + c[2], uv[k][0], uv[k][1], 2, 0, 3),
                  pack1(layer, sky, blk, tint & 31, (tint >> 5) & 31, (tint >> 10) & 31),
                );
              }
              cutout.flips[cutout.quads] = false;
              cutout.quads++;
            }
          }
          continue;
        }

        const isWater = bl.fluid === 'water';
        const build = isWater ? water : (bl.opaque ? solid : cutout);

        for (let f = 0; f < 6; f++) {
          const n = FACE_NORMAL[f];
          const nx = x + n[0], ny = y + n[1], nz = z + n[2];
          const nid = getId(nx, ny, nz);
          const nb = BLOCKS[nid];
          if (nb.opaque) continue;
          if (f === 3 && y === 0) continue; // fond du monde : jamais visible
          if (nid === id && bl.render !== 'cross') continue;
          if (bl.fluid && nb.fluid) continue;
          if (bl.render === 'flat' && f !== (data & 7)) continue;

          let offMode = 0;
          if (isWater) {
            const above = getId(x, y + 1, z);
            if (BLOCKS[above].fluid !== 'water' && f !== 3) offMode = 1;
          } else if (bl.render === 'flat') offMode = 2;

          const faceTint = (bl.tintTopOnly && f !== 2) ? WHITE : tint;
          emitFace(build, x, y, z, f, blockTile(bl, f, data), faceTint, offMode, bl);
        }
      }
    }
  }

  return { opaque: solid.result(), cutout: cutout.result(), water: water.result(), origin: [baseX, 0, baseZ] };
}
