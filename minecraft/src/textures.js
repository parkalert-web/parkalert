/**
 * Minecraft JS — atlas de textures entièrement procédural.
 *
 * Aucun fichier image n'est chargé : chaque tuile de 16×16 est peinte en
 * pixel-art déterministe au démarrage, puis envoyée au GPU dans une
 * TEXTURE_2D_ARRAY (une couche par tuile — pas de bavure entre voisines,
 * mipmaps corrects, animation d'une seule couche possible).
 */

import { mulberry32 } from './noise.js';

export const TILE = 16;

/* ───────────────────────────── Peinture ───────────────────────────── */

function parseHex(h) {
  if (Array.isArray(h)) return h;
  let s = h.replace('#', '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s.slice(0, 6), 16);
  const a = s.length >= 8 ? parseInt(s.slice(6, 8), 16) : 255;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

/** Petite toile 16×16 en RGBA, avec un aléatoire reproductible. */
class Paint {
  constructor(seed) {
    this.d = new Uint8ClampedArray(TILE * TILE * 4);
    this.rng = mulberry32(seed);
  }

  px(x, y, color, alpha = 1) {
    if (x < 0 || y < 0 || x >= TILE || y >= TILE) return this;
    const c = parseHex(color);
    const i = (y * TILE + x) * 4;
    const a = (c[3] / 255) * alpha;
    if (a >= 1) {
      this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255;
    } else {
      const inv = 1 - a;
      this.d[i] = c[0] * a + this.d[i] * inv;
      this.d[i + 1] = c[1] * a + this.d[i + 1] * inv;
      this.d[i + 2] = c[2] * a + this.d[i + 2] * inv;
      this.d[i + 3] = Math.max(this.d[i + 3], c[3] * alpha);
    }
    return this;
  }

  fill(color) {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) this.px(x, y, color);
    return this;
  }

  rect(x, y, w, h, color) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, color);
    return this;
  }

  frame(x, y, w, h, color) {
    for (let i = x; i < x + w; i++) { this.px(i, y, color); this.px(i, y + h - 1, color); }
    for (let j = y; j < y + h; j++) { this.px(x, j, color); this.px(x + w - 1, j, color); }
    return this;
  }

  /** Fait varier chaque pixel : c'est ce qui donne le grain « minéral ». */
  grain(amount, only = null) {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const i = (y * TILE + x) * 4;
        if (this.d[i + 3] === 0) continue;
        if (only && !only(x, y)) continue;
        const k = (this.rng() * 2 - 1) * amount;
        this.d[i] += k; this.d[i + 1] += k; this.d[i + 2] += k;
      }
    }
    return this;
  }

  speckle(color, count, alpha = 1) {
    for (let i = 0; i < count; i++) {
      this.px((this.rng() * TILE) | 0, (this.rng() * TILE) | 0, color, alpha);
    }
    return this;
  }

  /** Assombrit (f<1) ou éclaircit (f>1) un pixel déjà posé. */
  shade(x, y, f) {
    const i = (y * TILE + x) * 4;
    this.d[i] *= f; this.d[i + 1] *= f; this.d[i + 2] *= f;
    return this;
  }

  /** Dessine un motif ASCII : chaque caractère est une couleur de la palette. */
  art(rows, palette) {
    for (let y = 0; y < rows.length && y < TILE; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length && x < TILE; x++) {
        const c = palette[row[x]];
        if (c) this.px(x, y, c);
      }
    }
    return this;
  }

  copy() {
    const p = new Paint(1);
    p.d.set(this.d);
    return p;
  }
}

/* ───────────────────────────── Registre ───────────────────────────── */

const order = [];
const index = Object.create(null);

/**
 * Enregistre une tuile.
 * @param {string} name nom logique (utilisé par les blocs et les objets)
 * @param {(p:Paint)=>void} draw fonction de dessin
 * @param {{frames?:number, drawFrame?:(p:Paint,f:number)=>void}} [opts]
 */
function tex(name, draw, opts = {}) {
  index[name] = order.length;
  order.push({ name, draw, ...opts });
}

/** Index de couche pour un nom de tuile. */
export function T(name) {
  const i = index[name];
  if (i === undefined) throw new Error(`Texture inconnue : ${name}`);
  return i;
}

export function hasTile(name) { return index[name] !== undefined; }
export function tileCount() { return order.length; }
export function tileNames() { return order.map((t) => t.name); }

function seedOf(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Pixels d'une tuile (RGBA 16×16) — utilisé pour fabriquer les icônes d'inventaire. */
export function tilePixels(name) {
  const t = order[T(name)];
  const p = new Paint(seedOf(name));
  t.draw(p);
  return p.d;
}

/**
 * Construit l'atlas complet.
 * @returns {{layers:number, data:Uint8Array, anims:Array}}
 */
export function buildAtlas() {
  const layers = order.length;
  const data = new Uint8Array(layers * TILE * TILE * 4);
  const anims = [];
  for (let i = 0; i < layers; i++) {
    const t = order[i];
    const p = new Paint(seedOf(t.name));
    t.draw(p);
    data.set(p.d, i * TILE * TILE * 4);
    if (t.frames) {
      const frames = [];
      for (let f = 0; f < t.frames; f++) {
        const q = new Paint(seedOf(t.name));
        t.drawFrame(q, f / t.frames);
        frames.push(new Uint8Array(q.d.buffer.slice(0)));
      }
      anims.push({ layer: i, frames });
    }
  }
  return { layers, data, anims };
}

/* ─────────────────────────── Motifs partagés ─────────────────────────── */

const OREBLOBS = [
  '................',
  '...##...........',
  '..####.....##...',
  '..####....####..',
  '...##.....####..',
  '..............#.',
  '.....##.........',
  '....####........',
  '...######.......',
  '....####........',
  '.....##.........',
  '.............##.',
  '...##.......###.',
  '..####......##..',
  '..###...........',
  '................',
];

function stoneBase(p) {
  p.fill('#7d7d7d').grain(16);
  p.speckle('#6b6b6b', 26).speckle('#8f8f8f', 20);
}

function ore(p, main, light, dark) {
  stoneBase(p);
  p.art(OREBLOBS, { '#': main });
  // Un liseré clair en haut de chaque pépite et un liseré sombre en bas.
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      if (OREBLOBS[y][x] !== '#') continue;
      if (y > 0 && OREBLOBS[y - 1][x] === '.') p.px(x, y, light);
      if (y < TILE - 1 && OREBLOBS[y + 1][x] === '.') p.px(x, y, dark);
    }
  }
  p.grain(6, (x, y) => OREBLOBS[y][x] === '#');
}

function planks(p, base, dark, light) {
  p.fill(base).grain(10);
  for (let y = 0; y < TILE; y++) {
    if (y % 4 === 3) p.rect(0, y, TILE, 1, dark);
    if (y % 4 === 0) p.rect(0, y, TILE, 1, light);
  }
  // Joints verticaux décalés d'une rangée de planches à l'autre.
  const joints = [[0, 5], [4, 12], [8, 3], [12, 9]];
  for (const [y0, x] of joints) p.rect(x, y0, 1, 3, dark);
  p.grain(6);
}

function logSide(p, bark, barkDark, barkLight) {
  p.fill(bark).grain(12);
  for (let x = 0; x < TILE; x++) {
    if (x % 5 === 0) p.rect(x, 0, 1, TILE, barkDark);
    if (x % 7 === 3) p.rect(x, 0, 1, TILE, barkLight);
  }
  p.speckle(barkDark, 24).speckle(barkLight, 12);
}

function logTop(p, wood, ring, bark) {
  p.fill(wood).grain(8);
  p.frame(0, 0, 16, 16, bark);
  p.frame(1, 1, 14, 14, bark);
  p.frame(3, 3, 10, 10, ring);
  p.frame(5, 5, 6, 6, ring);
  p.rect(7, 7, 2, 2, ring);
  p.grain(6);
}

function leaves(p, base, dark, light) {
  p.fill(base).grain(20);
  p.speckle(dark, 40).speckle(light, 26);
  // Quelques trous donnent le feuillage « aéré » du jeu, sans le rendre gruyère.
  for (let i = 0; i < 12; i++) {
    const x = (p.rng() * TILE) | 0, y = (p.rng() * TILE) | 0;
    const j = (y * TILE + x) * 4;
    p.d[j + 3] = 0;
  }
  return p;
}

function wool(p, base) {
  p.fill(base).grain(10);
  for (let i = 0; i < 40; i++) {
    const x = (p.rng() * TILE) | 0, y = (p.rng() * TILE) | 0;
    p.shade(x, y, 0.92 + p.rng() * 0.16);
  }
}

/* ──────────────────────────── Tuiles : blocs ──────────────────────────── */

tex('white', (p) => p.fill('#ffffff'));

tex('stone', (p) => stoneBase(p));
tex('granite', (p) => { p.fill('#9a6b5b').grain(18).speckle('#8a5a4a', 30).speckle('#b08276', 20); });
tex('diorite', (p) => { p.fill('#cfcfcf').grain(20).speckle('#a8a8a8', 34).speckle('#efefef', 20); });
tex('andesite', (p) => { p.fill('#8a8a8d').grain(16).speckle('#77777a', 30).speckle('#9d9da0', 20); });

tex('cobblestone', (p) => {
  p.fill('#6f6f6f');
  const stones = [[0, 0, 6, 5], [7, 0, 5, 4], [13, 0, 3, 6], [0, 6, 4, 4], [5, 5, 7, 5],
    [13, 7, 3, 4], [0, 11, 6, 5], [7, 11, 4, 5], [12, 12, 4, 4], [12, 4, 1, 3]];
  for (const [x, y, w, h] of stones) {
    const g = 110 + Math.floor(p.rng() * 50);
    p.rect(x, y, w, h, `#${g.toString(16).padStart(2, '0').repeat(3)}`);
    p.rect(x, y, w, 1, '#a8a8a8');
    p.rect(x, y + h - 1, w, 1, '#4c4c4c');
  }
  p.grain(14);
});

tex('mossy_cobblestone', (p) => {
  const q = new Paint(seedOf('cobblestone'));
  order[T('cobblestone')].draw(q);
  p.d.set(q.d);
  for (let i = 0; i < 90; i++) {
    const x = (p.rng() * TILE) | 0, y = (p.rng() * TILE) | 0;
    p.px(x, y, '#5c7a3c', 0.75);
  }
});

tex('bedrock', (p) => {
  p.fill('#4d4d4d').grain(26);
  p.speckle('#2b2b2b', 60).speckle('#6f6f6f', 40).speckle('#111111', 20);
});

tex('dirt', (p) => { p.fill('#8a6543').grain(18).speckle('#6f4f33', 30).speckle('#9c7550', 24); });
tex('coarse_dirt', (p) => { p.fill('#7d5b3d').grain(22).speckle('#5f4429', 40).speckle('#946b47', 24); });

// Texture grise : c'est la teinte du biome qui lui donne sa couleur (comme dans le jeu).
tex('grass_top', (p) => { p.fill('#d8d8d8').grain(18).speckle('#c2c2c2', 40).speckle('#efefef', 30); });

tex('grass_side', (p) => {
  p.fill('#8a6543').grain(18).speckle('#6f4f33', 26);
  const edge = [3, 4, 3, 5, 4, 3, 2, 4, 5, 3, 4, 2, 3, 5, 4, 3];
  for (let x = 0; x < TILE; x++) {
    for (let y = 0; y < edge[x]; y++) p.px(x, y, y === edge[x] - 1 ? '#6aae4c' : '#79c05a');
  }
  p.grain(8, (x, y) => y < 6);
});

tex('sand', (p) => { p.fill('#e0d8a0').grain(12).speckle('#d2c88c', 30).speckle('#efe8bb', 22); });
tex('sandstone_top', (p) => { p.fill('#e2d9a8').grain(8).speckle('#d0c692', 20); });
tex('sandstone_side', (p) => {
  p.fill('#e2d9a8').grain(8);
  p.rect(0, 3, 16, 1, '#c8bd88'); p.rect(0, 11, 16, 1, '#c8bd88');
  p.rect(0, 4, 16, 1, '#efe7bd'); p.rect(0, 12, 16, 1, '#efe7bd');
  p.speckle('#d0c692', 24);
});
tex('sandstone_bottom', (p) => { p.fill('#d9cf9a').grain(10).speckle('#c4ba85', 24); });

tex('gravel', (p) => {
  p.fill('#8a8580').grain(20);
  for (let i = 0; i < 20; i++) {
    const x = (p.rng() * 14) | 0, y = (p.rng() * 14) | 0;
    const w = 2 + ((p.rng() * 2) | 0), h = 2 + ((p.rng() * 2) | 0);
    const g = 90 + Math.floor(p.rng() * 80);
    p.rect(x, y, w, h, `#${g.toString(16).padStart(2, '0').repeat(3)}`);
  }
  p.grain(12);
});

tex('clay', (p) => { p.fill('#a0a6b0').grain(10).speckle('#9096a2', 22); });

tex('snow', (p) => { p.fill('#f4fbfb').grain(6).speckle('#e2eef2', 20); });
tex('ice', (p) => {
  p.fill('#93c9f5e0').grain(10);
  for (let i = 0; i < 6; i++) {
    let x = (p.rng() * TILE) | 0, y = (p.rng() * TILE) | 0;
    for (let k = 0; k < 6; k++) { p.px(x, y, '#b9dcf8e0'); x += (p.rng() * 3 | 0) - 1; y += (p.rng() * 3 | 0) - 1; }
  }
});

tex('obsidian', (p) => {
  p.fill('#140b1f').grain(8);
  p.speckle('#2c1c46', 34).speckle('#3d2a5c', 14).speckle('#0a0512', 20);
});

tex('glowstone', (p) => {
  p.fill('#8a6a34').grain(14);
  for (let i = 0; i < 18; i++) {
    const x = (p.rng() * 14) | 0, y = (p.rng() * 14) | 0;
    p.rect(x, y, 2, 2, '#ffd98a');
    p.px(x, y, '#fff3c4');
  }
  p.speckle('#ffe9a8', 20);
});

tex('glass', (p) => {
  p.frame(0, 0, 16, 16, '#d7f0ff70');
  p.rect(2, 2, 5, 1, '#ffffff60');
  p.rect(2, 3, 1, 4, '#ffffff45');
  p.rect(10, 9, 4, 1, '#ffffff35');
  p.rect(1, 1, 14, 14, '#bfe4ff12');
  p.frame(0, 0, 16, 16, '#e8f7ff88');
});

tex('coal_ore', (p) => ore(p, '#1d1d1d', '#3a3a3a', '#0d0d0d'));
tex('iron_ore', (p) => ore(p, '#c8a184', '#e0bda3', '#9c7a5e'));
tex('gold_ore', (p) => ore(p, '#f0cf4a', '#ffe98a', '#c4a326'));
tex('diamond_ore', (p) => ore(p, '#4fe0d8', '#a6f6f2', '#2aa39c'));
tex('emerald_ore', (p) => ore(p, '#31d64a', '#8ef79c', '#1a9130'));
tex('lapis_ore', (p) => ore(p, '#1f47b5', '#4f78e0', '#122f7d'));
tex('redstone_ore', (p) => ore(p, '#c81b1b', '#ff5a5a', '#8a0d0d'));

function metalBlock(p, base, light, dark) {
  p.fill(base).grain(8);
  p.frame(0, 0, 16, 16, dark);
  p.rect(1, 1, 14, 1, light);
  p.rect(1, 1, 1, 14, light);
  for (let i = 0; i < 8; i++) p.px((p.rng() * 14 | 0) + 1, (p.rng() * 14 | 0) + 1, light, 0.5);
}
tex('iron_block', (p) => metalBlock(p, '#d8d8d8', '#f2f2f2', '#a8a8a8'));
tex('gold_block', (p) => metalBlock(p, '#f6d43a', '#fff08a', '#c9a419'));
tex('diamond_block', (p) => metalBlock(p, '#54e6dd', '#b4f8f4', '#26a49c'));
tex('emerald_block', (p) => metalBlock(p, '#38d94f', '#9df3a8', '#1d9130'));
tex('lapis_block', (p) => metalBlock(p, '#2a52c4', '#5f83e8', '#173584'));
tex('coal_block', (p) => { p.fill('#1a1a1a').grain(10).speckle('#2e2e2e', 30).speckle('#0a0a0a', 20); });

tex('oak_log_side', (p) => logSide(p, '#6b5232', '#54401f', '#7d6341'));
tex('oak_log_top', (p) => logTop(p, '#b08a4e', '#8d6c39', '#6b5232'));
tex('oak_planks', (p) => planks(p, '#b18b52', '#8d6b3a', '#c39c62'));
tex('oak_leaves', (p) => leaves(p, '#4f9e34', '#3d7d28', '#63b845'));

tex('birch_log_side', (p) => {
  p.fill('#dcd9d0').grain(8);
  for (let i = 0; i < 7; i++) {
    const y = (p.rng() * 14) | 0, x = (p.rng() * 12) | 0;
    p.rect(x, y, 2 + ((p.rng() * 3) | 0), 1, '#3a3830');
  }
  p.speckle('#b8b4a8', 20);
});
tex('birch_log_top', (p) => logTop(p, '#d3c8a8', '#b6a985', '#dcd9d0'));
tex('birch_planks', (p) => planks(p, '#d7cb9a', '#b6a97a', '#e8dcae'));
tex('birch_leaves', (p) => leaves(p, '#79a860', '#5f8c48', '#93bd77'));

tex('spruce_log_side', (p) => logSide(p, '#4a3520', '#33240f', '#5a4229'));
tex('spruce_log_top', (p) => logTop(p, '#8a6a40', '#6b5030', '#4a3520'));
tex('spruce_planks', (p) => planks(p, '#7a5a35', '#5e4526', '#8d6c44'));
tex('spruce_leaves', (p) => leaves(p, '#2f5f36', '#204526', '#3f7746'));

tex('cactus_side', (p) => {
  p.fill('#3f7a34').grain(12);
  p.rect(0, 0, 1, 16, '#2c5a24'); p.rect(15, 0, 1, 16, '#2c5a24');
  for (let y = 1; y < 16; y += 4) { p.px(4, y, '#dfe8c0'); p.px(11, y + 2, '#dfe8c0'); }
  p.speckle('#4f8f42', 20);
});
tex('cactus_top', (p) => { p.fill('#4f8f42').grain(10); p.frame(0, 0, 16, 16, '#2c5a24'); p.rect(6, 6, 4, 4, '#63a555'); });

tex('pumpkin_side', (p) => {
  p.fill('#d97b18').grain(10);
  for (let x = 0; x < 16; x += 4) p.rect(x, 0, 1, 16, '#b25f0c');
  p.rect(0, 0, 16, 1, '#a85a0a');
});
tex('pumpkin_top', (p) => { p.fill('#c96f14').grain(8); p.rect(6, 5, 4, 6, '#7d6033'); p.rect(5, 6, 6, 4, '#7d6033'); });
tex('pumpkin_face', (p) => {
  order[T('pumpkin_side')].draw(p);
  p.art([
    '................',
    '................',
    '..###......###..',
    '..####....####..',
    '...####..####...',
    '....########....',
    '................',
    '.....#....#.....',
    '..############..',
    '..#.#.#..#.#.#..',
    '..############..',
    '...##########...',
    '................',
    '................',
    '................',
    '................',
  ], { '#': '#3a2408' });
});

tex('brick', (p) => {
  p.fill('#a8a8a8');
  const mortar = '#c9c0b4';
  p.fill(mortar);
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    const off = row % 2 ? -4 : 0;
    for (let x = off; x < 16; x += 8) p.rect(x + 1, y + 1, 6, 3, '#96412f');
  }
  p.grain(10);
});

tex('stone_bricks', (p) => {
  p.fill('#7a7a7a').grain(12);
  const mortar = '#606060';
  p.rect(0, 7, 16, 1, mortar); p.rect(0, 15, 16, 1, mortar);
  p.rect(7, 0, 1, 8, mortar); p.rect(3, 8, 1, 8, mortar); p.rect(11, 8, 1, 8, mortar);
  p.grain(8);
  p.speckle('#8d8d8d', 18);
});

tex('bookshelf', (p) => {
  planks(p, '#b18b52', '#8d6b3a', '#c39c62');
  p.rect(0, 3, 16, 10, '#6b5232');
  const colors = ['#a03a2f', '#2f6aa0', '#3f9e4f', '#b1932f', '#7a3f9e', '#a05a2f'];
  let x = 0;
  while (x < 16) {
    const w = 1 + ((p.rng() * 2) | 0);
    const c = colors[(p.rng() * colors.length) | 0];
    p.rect(x, 4, w, 4, c);
    p.rect(x, 9, w, 4, colors[(p.rng() * colors.length) | 0]);
    x += w + 1;
  }
});

tex('crafting_table_top', (p) => {
  planks(p, '#a0783f', '#7d5a2c', '#b98d4f');
  p.frame(0, 0, 16, 16, '#5e4526');
  p.rect(5, 0, 1, 16, '#5e4526'); p.rect(10, 0, 1, 16, '#5e4526');
  p.rect(0, 5, 16, 1, '#5e4526'); p.rect(0, 10, 16, 1, '#5e4526');
});
tex('crafting_table_side', (p) => {
  planks(p, '#a0783f', '#7d5a2c', '#b98d4f');
  p.rect(0, 0, 16, 4, '#8d6b3a');
  p.art([
    '................',
    '................',
    '................',
    '................',
    '..##.......##...',
    '.####.....####..',
    '..##.......##...',
    '................',
    '.....######.....',
    '.....#....#.....',
    '.....######.....',
    '................',
    '................',
    '................',
    '................',
    '................',
  ], { '#': '#5e4526' });
});

tex('furnace_side', (p) => { p.fill('#6f6f6f').grain(14).speckle('#5c5c5c', 26).speckle('#828282', 20); });
tex('furnace_top', (p) => { p.fill('#7a7a7a').grain(12); p.frame(0, 0, 16, 16, '#5c5c5c'); p.rect(6, 6, 4, 4, '#5c5c5c'); });
tex('furnace_front', (p) => {
  order[T('furnace_side')].draw(p);
  p.rect(3, 5, 10, 8, '#3a3a3a');
  p.rect(4, 6, 8, 6, '#232323');
  p.rect(3, 4, 10, 1, '#8f8f8f');
});
tex('furnace_front_lit', (p) => {
  order[T('furnace_side')].draw(p);
  p.rect(3, 5, 10, 8, '#3a3a3a');
  p.rect(4, 6, 8, 6, '#231208');
  p.art([
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....#..##......',
    '....###.###.....',
    '...####.####....',
    '...##########...',
    '...##########...',
    '................',
    '................',
    '................',
    '................',
  ], { '#': '#ff9c2a' });
  p.rect(4, 11, 8, 1, '#ffd88a');
  p.rect(3, 4, 10, 1, '#8f8f8f');
});

tex('chest_side', (p) => {
  p.fill('#9c6c34').grain(10);
  p.rect(0, 0, 16, 1, '#5e4526'); p.rect(0, 4, 16, 1, '#5e4526');
  p.rect(0, 5, 16, 1, '#7d5626'); p.rect(0, 15, 16, 1, '#5e4526');
  p.rect(0, 0, 1, 16, '#5e4526'); p.rect(15, 0, 1, 16, '#5e4526');
});
tex('chest_top', (p) => { p.fill('#9c6c34').grain(10); p.frame(0, 0, 16, 16, '#5e4526'); p.rect(0, 8, 16, 1, '#7d5626'); });
tex('chest_front', (p) => {
  order[T('chest_side')].draw(p);
  p.rect(6, 5, 4, 5, '#3a3a3a');
  p.rect(7, 6, 2, 3, '#d8c86a');
  p.px(7, 7, '#8d7c2a'); p.px(8, 7, '#8d7c2a');
});

tex('tnt_side', (p) => {
  p.fill('#c33a2a').grain(10);
  p.rect(0, 5, 16, 6, '#efefef');
  p.art([
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..#.#..#..#..#..',
    '..#.#..##.#..#..',
    '..###..#.##..#..',
    '..#.#..#..#..#..',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ], { '#': '#1a1a1a' });
  p.rect(0, 0, 16, 1, '#8f2a1c'); p.rect(0, 15, 16, 1, '#8f2a1c');
});
tex('tnt_top', (p) => { p.fill('#c33a2a').grain(10); p.frame(0, 0, 16, 16, '#8f2a1c'); p.rect(5, 5, 6, 6, '#1a1a1a'); p.rect(6, 6, 4, 4, '#efefef'); });
tex('tnt_bottom', (p) => { p.fill('#8f2a1c').grain(10); });

tex('farmland', (p) => {
  p.fill('#7a5836').grain(14);
  for (let y = 2; y < 16; y += 5) p.rect(0, y, 16, 2, '#63452a');
  p.speckle('#8d6a44', 20);
});
tex('farmland_wet', (p) => {
  p.fill('#4f3620').grain(12);
  for (let y = 2; y < 16; y += 5) p.rect(0, y, 16, 2, '#3a2717');
  p.speckle('#5f4229', 20);
});

tex('ladder', (p) => {
  p.rect(3, 0, 2, 16, '#8d6b3a');
  p.rect(11, 0, 2, 16, '#8d6b3a');
  for (let y = 2; y < 16; y += 5) p.rect(4, y, 8, 2, '#a0783f');
});

tex('torch', (p) => {
  p.rect(7, 8, 2, 8, '#7d5a2c');
  p.rect(7, 8, 1, 8, '#6b4a22');
  p.rect(6, 6, 4, 3, '#ffdd88');
  p.rect(7, 5, 2, 2, '#fff4c4');
  p.px(6, 6, '#ffb43a'); p.px(9, 6, '#ffb43a');
  p.px(7, 9, '#ff9c2a'); p.px(8, 9, '#ff9c2a');
});

function plant(p, rows, palette) { p.art(rows, palette); }

tex('tall_grass', (p) => plant(p, [
  '................',
  '................',
  '................',
  '..#.........#...',
  '..#....#....#...',
  '..#....#..#.#...',
  '.#.#...#..#.#...',
  '.#.#..#.#.#..#..',
  '.#..#.#.#.#..#..',
  '.#..#.#.#.#..#..',
  '#...#.#.#..#.#..',
  '#...#.#..#.#.#..',
  '#...#.#..#.#.#..',
  '#...##...#..##..',
  '.#..#.....#.#...',
  '..###......##...',
], { '#': '#cfcfcf' }));

tex('dead_bush', (p) => plant(p, [
  '................',
  '................',
  '....#...........',
  '....#....#......',
  '..#.#....#......',
  '..#.#..#.#......',
  '...##..#.#......',
  '....####.#......',
  '.......###......',
  '........#.......',
  '......###.......',
  '.....#..#..#....',
  '....#...#..#....',
  '........#.##....',
  '........##......',
  '.........#......',
], { '#': '#8a6a3a' }));

tex('dandelion', (p) => plant(p, [
  '................',
  '................',
  '................',
  '.......##.......',
  '......####......',
  '......####......',
  '.......##.......',
  '.......#........',
  '.......#........',
  '.....#.#........',
  '.....#.#.#......',
  '......###.......',
  '.......#........',
  '.......#........',
  '.......#........',
  '................',
], { '#': '#f2d43a', ' ': null }));

tex('poppy', (p) => {
  plant(p, [
    '................',
    '................',
    '................',
    '......###.......',
    '.....#####......',
    '.....##a##......',
    '......###.......',
    '.......#........',
    '.......#........',
    '.....#.#........',
    '.....#.#.#......',
    '......###.......',
    '.......#........',
    '.......#........',
    '.......#........',
    '................',
  ], { '#': '#d63a2a', a: '#3a1a10' });
  for (let y = 7; y < 16; y++) p.px(7, y, '#3f7a2f');
  p.px(5, 9, '#3f7a2f'); p.px(5, 10, '#3f7a2f'); p.px(9, 10, '#3f7a2f'); p.px(6, 11, '#3f7a2f'); p.px(8, 11, '#3f7a2f');
});

for (const [name, color] of [['oak_sapling', '#4f9e34'], ['birch_sapling', '#79a860'], ['spruce_sapling', '#2f5f36']]) {
  tex(name, (p) => {
    plant(p, [
      '................',
      '................',
      '................',
      '......###.......',
      '.....##.##......',
      '....##...##.....',
      '....#..#..#.....',
      '.....#.#.#......',
      '......###.......',
      '.......#........',
      '.......#........',
      '.......#........',
      '.......#........',
      '......###.......',
      '................',
      '................',
    ], { '#': color });
    for (let y = 9; y < 14; y++) p.px(7, y, '#6b4a22');
  });
}

tex('red_mushroom', (p) => plant(p, [
  '................',
  '................',
  '................',
  '................',
  '.....#####......',
  '....#######.....',
  '...##a###a##....',
  '...#########....',
  '....##...##.....',
  '......###.......',
  '......#.#.......',
  '......###.......',
  '......###.......',
  '.....#####......',
  '................',
  '................',
], { '#': '#cf3a2a', a: '#efefef' }));

tex('brown_mushroom', (p) => plant(p, [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....#####......',
  '....#######.....',
  '....#######.....',
  '.....#####......',
  '......###.......',
  '......#.#.......',
  '......###.......',
  '......###.......',
  '.....#####......',
  '................',
  '................',
], { '#': '#9c6a44' }));

for (let stage = 0; stage < 4; stage++) {
  tex(`wheat_${stage}`, (p) => {
    const h = [4, 8, 12, 15][stage];
    const colors = ['#4f8f3a', '#5f9e3a', '#8da83a', '#d9c05a'];
    const c = colors[stage];
    for (const x of [2, 6, 10, 14]) {
      for (let y = 16 - h; y < 16; y++) p.px(x, y, c);
      if (stage >= 2) {
        p.px(x - 1, 16 - h + 1, c); p.px(x + 1, 16 - h + 1, c);
        p.px(x - 1, 16 - h + 4, c); p.px(x + 1, 16 - h + 4, c);
      }
      if (stage === 3) {
        p.px(x - 1, 16 - h, '#e8d888'); p.px(x + 1, 16 - h, '#e8d888'); p.px(x, 16 - h - 1, '#e8d888');
      }
    }
  });
}

for (const [name, color] of [
  ['wool_white', '#e9ecec'], ['wool_red', '#a12722'], ['wool_blue', '#35399d'],
  ['wool_yellow', '#f0af15'], ['wool_green', '#5d7c15'], ['wool_black', '#1d1c21'],
  ['wool_orange', '#f07613'], ['wool_pink', '#ee8dac'],
]) tex(name, (p) => wool(p, color));

tex('bed_top', (p) => { wool(p, '#a12722'); p.rect(0, 0, 16, 2, '#efefef'); p.frame(0, 0, 16, 16, '#7d1c18'); });
tex('bed_side', (p) => { p.rect(0, 0, 16, 6, '#a12722'); p.rect(0, 6, 16, 4, '#efefef'); p.rect(0, 10, 16, 6, '#8d6b3a'); p.grain(8); });

/* Eau et lave : plusieurs images successives, réinjectées dans l'atlas au fil du temps. */
tex('water', (p) => waterFrame(p, 0), {
  frames: 16,
  drawFrame: (p, t) => waterFrame(p, t),
});
function waterFrame(p, t) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const w = Math.sin((x / 16 + t) * Math.PI * 2) * 0.5 + Math.sin((y / 16 - t * 1.4) * Math.PI * 4) * 0.5;
      const b = 150 + w * 22;
      const g = 100 + w * 20;
      p.px(x, y, [30, g | 0, b | 0, 190]);
    }
  }
  p.grain(6);
}

tex('lava', (p) => lavaFrame(p, 0), {
  frames: 16,
  drawFrame: (p, t) => lavaFrame(p, t),
});
function lavaFrame(p, t) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const w = Math.sin((x / 16 + t) * Math.PI * 2) * 0.5 + Math.sin((y / 16 + t * 2) * Math.PI * 6) * 0.5
        + Math.sin(((x + y) / 16 - t * 3) * Math.PI * 2) * 0.4;
      const r = 210 + w * 45;
      const g = 70 + w * 60;
      p.px(x, y, [Math.min(255, r) | 0, Math.max(0, g) | 0, 12, 255]);
    }
  }
  p.grain(10);
}

/* Fissures de minage : dix étapes, superposées au bloc en cours de cassage. */
for (let s = 0; s < 10; s++) {
  tex(`destroy_${s}`, (p) => {
    const cracks = s + 1;
    const rng = mulberry32(1234);
    for (let c = 0; c < cracks * 2; c++) {
      let x = (rng() * TILE) | 0, y = (rng() * TILE) | 0;
      const len = 3 + ((rng() * (2 + s * 1.5)) | 0);
      for (let k = 0; k < len; k++) {
        p.px(x, y, '#000000cc');
        p.px(x + 1, y, '#00000055');
        x += ((rng() * 3) | 0) - 1;
        y += ((rng() * 3) | 0) - 1;
        if (x < 0 || x > 15 || y < 0 || y > 15) break;
      }
    }
  });
}

tex('cloud', (p) => {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      const a = d < 6 ? 255 : d < 7.4 ? 160 : 0;
      if (a) p.px(x, y, [255, 255, 255, a]);
    }
  }
});

tex('sun', (p) => { p.fill('#fff6c8'); p.frame(0, 0, 16, 16, '#ffe98a'); });
tex('moon', (p) => {
  p.fill('#e8eef5');
  p.speckle('#c8d2de', 26);
  p.rect(2, 3, 3, 3, '#c8d2de'); p.rect(9, 8, 4, 3, '#c8d2de');
});

tex('rain', (p) => { p.rect(6, 0, 2, 16, '#9fc8ee88'); p.rect(7, 0, 1, 16, '#cfe6ffaa'); });
tex('snowflake', (p) => { p.rect(5, 5, 5, 5, '#ffffffcc'); p.rect(6, 4, 3, 7, '#ffffffcc'); p.rect(4, 6, 7, 3, '#ffffffcc'); });

/* ──────────────────────────── Tuiles : objets ──────────────────────────── */

const TOOL_PALETTE = (main, light, dark) => ({
  '#': main, '+': light, '=': dark, S: '#9c7a4a', s: '#6b5232',
});

const PICKAXE = [
  '................',
  '....++++++++....',
  '...+########+...',
  '..+##========+..',
  '..+#=......=+...',
  '..=.....SS......',
  '.......SS.......',
  '......SS........',
  '.....SS.........',
  '....SS..........',
  '...SS...........',
  '..SS............',
  '..S.............',
  '................',
  '................',
  '................',
];

const AXE = [
  '................',
  '....++++........',
  '...+####+.......',
  '..+######+......',
  '..+######+......',
  '..=####=SS......',
  '..=##=.SS.......',
  '..===.SS........',
  '.....SS.........',
  '....SS..........',
  '...SS...........',
  '..SS............',
  '..S.............',
  '................',
  '................',
  '................',
];

const SHOVEL = [
  '................',
  '.......++.......',
  '......+##+......',
  '......+##+......',
  '......=##=......',
  '.......SS.......',
  '.......SS.......',
  '......SS........',
  '.....SS.........',
  '....SS..........',
  '...SS...........',
  '..SS............',
  '..S.............',
  '................',
  '................',
  '................',
];

const SWORD = [
  '................',
  '............++..',
  '...........+##+.',
  '..........+###+.',
  '.........+###+..',
  '........+###+...',
  '.......+###+....',
  '..s...+###+.....',
  '..ss.+###+......',
  '...ss###+.......',
  '..S.ss+.........',
  '.SsS.ss.........',
  '.SS...s.........',
  '..S.............',
  '................',
  '................',
];

const HOE = [
  '................',
  '....++++++......',
  '...+######+.....',
  '...+##====+.....',
  '...=#=..SS......',
  '.......SS.......',
  '......SS........',
  '.....SS.........',
  '....SS..........',
  '...SS...........',
  '..SS............',
  '..S.............',
  '................',
  '................',
  '................',
  '................',
];

const TIERS = {
  wood: ['#a0783f', '#c39c62', '#7d5a2c'],
  stone: ['#8a8a8a', '#b0b0b0', '#5f5f5f'],
  iron: ['#d8d8d8', '#f4f4f4', '#a0a0a0'],
  gold: ['#f6d43a', '#fff08a', '#c09018'],
  diamond: ['#54e6dd', '#b4f8f4', '#26a49c'],
};

for (const [tier, [m, l, d]] of Object.entries(TIERS)) {
  tex(`${tier}_pickaxe`, (p) => p.art(PICKAXE, TOOL_PALETTE(m, l, d)));
  tex(`${tier}_axe`, (p) => p.art(AXE, TOOL_PALETTE(m, l, d)));
  tex(`${tier}_shovel`, (p) => p.art(SHOVEL, TOOL_PALETTE(m, l, d)));
  tex(`${tier}_sword`, (p) => p.art(SWORD, TOOL_PALETTE(m, l, d)));
  tex(`${tier}_hoe`, (p) => p.art(HOE, TOOL_PALETTE(m, l, d)));
}

const HELMET = [
  '................',
  '................',
  '...++++++++++...',
  '..+##########+..',
  '..+##########+..',
  '..+##########+..',
  '..+##+....+##+..',
  '..+##+....+##+..',
  '..=##=....=##=..',
  '..===......===..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];
const CHESTPLATE = [
  '................',
  '..++.......++...',
  '.+##+.....+##+..',
  '+####+++++####+.',
  '+############+..',
  '+############+..',
  '.+##########+...',
  '.+##########+...',
  '.+##########+...',
  '.+##########+...',
  '.=##########=...',
  '.=####==####=...',
  '.====....====...',
  '................',
  '................',
  '................',
];
const LEGGINGS = [
  '................',
  '................',
  '..++++++++++....',
  '..+########+....',
  '..+########+....',
  '..+########+....',
  '..+###++###+....',
  '..+##+..+##+....',
  '..+##+..+##+....',
  '..+##+..+##+....',
  '..=##=..=##=....',
  '..=##=..=##=....',
  '..===....===....',
  '................',
  '................',
  '................',
];
const BOOTS = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..++++..++++....',
  '..+##+..+##+....',
  '..+##+..+##+....',
  '.+####++####+...',
  '.+##########+...',
  '.+##########+...',
  '.=##########=...',
  '.============...',
  '................',
  '................',
];

const ARMOR_TIERS = {
  leather: ['#8a5a30', '#a87447', '#5f3c1c'],
  iron: ['#d8d8d8', '#f4f4f4', '#a0a0a0'],
  gold: ['#f6d43a', '#fff08a', '#c09018'],
  diamond: ['#54e6dd', '#b4f8f4', '#26a49c'],
};
for (const [tier, [m, l, d]] of Object.entries(ARMOR_TIERS)) {
  const pal = { '#': m, '+': l, '=': d };
  tex(`${tier}_helmet`, (p) => p.art(HELMET, pal));
  tex(`${tier}_chestplate`, (p) => p.art(CHESTPLATE, pal));
  tex(`${tier}_leggings`, (p) => p.art(LEGGINGS, pal));
  tex(`${tier}_boots`, (p) => p.art(BOOTS, pal));
}

tex('stick', (p) => p.art([
  '................',
  '................',
  '...........##...',
  '..........##....',
  '.........##.....',
  '........##......',
  '.......##.......',
  '......##........',
  '.....##.........',
  '....##..........',
  '...##...........',
  '..##............',
  '..#.............',
  '................',
  '................',
  '................',
], { '#': '#9c7a4a' }));

function nugget(p, main, light, dark) {
  p.art([
    '................',
    '................',
    '................',
    '....########....',
    '...+########+...',
    '..+##########+..',
    '..+##########+..',
    '..+##########+..',
    '..+##########+..',
    '..=##########=..',
    '...=########=...',
    '....========....',
    '................',
    '................',
    '................',
    '................',
  ], { '#': main, '+': light, '=': dark });
}
tex('iron_ingot', (p) => nugget(p, '#d8d8d8', '#f4f4f4', '#a0a0a0'));
tex('gold_ingot', (p) => nugget(p, '#f6d43a', '#fff08a', '#c09018'));

function gem(p, main, light, dark) {
  p.art([
    '................',
    '................',
    '.....++++++.....',
    '....+######+....',
    '...+########+...',
    '..+##########+..',
    '..+####++####+..',
    '..=####++####=..',
    '..=##########=..',
    '...=########=...',
    '....=######=....',
    '.....=####=.....',
    '......=##=......',
    '.......==.......',
    '................',
    '................',
  ], { '#': main, '+': light, '=': dark });
}
tex('diamond', (p) => gem(p, '#54e6dd', '#b4f8f4', '#26a49c'));
tex('emerald', (p) => gem(p, '#38d94f', '#9df3a8', '#1d9130'));
tex('lapis_lazuli', (p) => gem(p, '#2a52c4', '#5f83e8', '#173584'));

function dust(p, color, light) {
  for (let i = 0; i < 60; i++) {
    const x = 3 + ((p.rng() * 10) | 0), y = 3 + ((p.rng() * 10) | 0);
    p.px(x, y, p.rng() < 0.3 ? light : color);
  }
}
tex('coal', (p) => { p.art([
  '................',
  '................',
  '.....####.......',
  '....######......',
  '...########.....',
  '...########.....',
  '..##########....',
  '..##########....',
  '..#########.....',
  '...#######......',
  '....#####.......',
  '................',
  '................',
  '................',
  '................',
  '................',
], { '#': '#1a1a1a' }); p.speckle('#3a3a3a', 12); });
tex('charcoal', (p) => { order[T('coal')].draw(p); p.speckle('#4a3a2a', 20); });
tex('redstone_dust', (p) => dust(p, '#c81b1b', '#ff5a5a'));
tex('gunpowder', (p) => dust(p, '#5a5a5a', '#8a8a8a'));
tex('flint', (p) => p.art([
  '................',
  '................',
  '................',
  '......###.......',
  '.....#####......',
  '....#######.....',
  '...#########....',
  '..###########...',
  '..###########...',
  '...#########....',
  '.....#####......',
  '................',
  '................',
  '................',
  '................',
  '................',
], { '#': '#3a3a44' }));
tex('clay_ball', (p) => nugget(p, '#a0a6b0', '#c0c6d0', '#7f858f'));
tex('brick_item', (p) => nugget(p, '#96412f', '#b8583f', '#6f2f22'));

tex('apple', (p) => p.art([
  '................',
  '.......##.......',
  '......##........',
  '....#####.......',
  '...#######......',
  '..#########.....',
  '..####+#####....',
  '..####+#####....',
  '..##########....',
  '..##########....',
  '...########.....',
  '....######......',
  '.....#..#.......',
  '................',
  '................',
  '................',
], { '#': '#d63a2a', '+': '#ff8a7a' }));

tex('golden_apple', (p) => p.art([
  '................',
  '.......##.......',
  '......##........',
  '....#####.......',
  '...#######......',
  '..#########.....',
  '..####+#####....',
  '..####+#####....',
  '..##########....',
  '..##########....',
  '...########.....',
  '....######......',
  '.....#..#.......',
  '................',
  '................',
  '................',
], { '#': '#f6d43a', '+': '#fff08a' }));

tex('bread', (p) => p.art([
  '................',
  '................',
  '....######......',
  '...########.....',
  '..##########....',
  '..#+##+##+##....',
  '..##########....',
  '..#+##+##+##....',
  '..##########....',
  '...########.....',
  '....######......',
  '................',
  '................',
  '................',
  '................',
  '................',
], { '#': '#c08a3a', '+': '#e8b25a' }));

tex('wheat_item', (p) => p.art([
  '................',
  '.......#........',
  '......###.......',
  '.....#.#.#......',
  '......###.......',
  '.....#.#.#......',
  '......###.......',
  '.....#.#.#......',
  '......###.......',
  '.......#........',
  '.......#........',
  '.......#........',
  '.......#........',
  '................',
  '................',
  '................',
], { '#': '#d9c05a' }));

tex('wheat_seeds', (p) => { for (let i = 0; i < 24; i++) p.px(4 + ((p.rng() * 8) | 0), 5 + ((p.rng() * 7) | 0), '#7a8d3a'); });

function meat(p, main, light, bone) {
  p.art([
    '................',
    '................',
    '....######......',
    '...########.....',
    '..##########+...',
    '..###########+..',
    '..###########+..',
    '..###########+..',
    '...#########+...',
    '....#######.....',
    '.....bbbb.......',
    '......bb........',
    '................',
    '................',
    '................',
    '................',
  ], { '#': main, '+': light, b: bone });
}
tex('porkchop', (p) => meat(p, '#f0a0a0', '#ffc0c0', '#efe8d0'));
tex('cooked_porkchop', (p) => meat(p, '#c07a4a', '#dfa070', '#efe8d0'));
tex('beef', (p) => meat(p, '#d05a5a', '#ef8080', '#efe8d0'));
tex('cooked_beef', (p) => meat(p, '#8a5a30', '#b07a4a', '#efe8d0'));
tex('chicken', (p) => meat(p, '#f0c0a0', '#ffd8c0', '#efe8d0'));
tex('cooked_chicken', (p) => meat(p, '#c09a5a', '#dfba80', '#efe8d0'));
tex('mutton', (p) => meat(p, '#e08a8a', '#ffb0b0', '#efe8d0'));
tex('cooked_mutton', (p) => meat(p, '#a06a3a', '#c08a5a', '#efe8d0'));

tex('leather', (p) => p.art([
  '................',
  '................',
  '..##########....',
  '..#++++++++#....',
  '..#+######+#....',
  '..#+######+#....',
  '..#+######+#....',
  '..#+######+#....',
  '..#+######+#....',
  '..#++++++++#....',
  '..##########....',
  '................',
  '................',
  '................',
  '................',
  '................',
], { '#': '#7d5230', '+': '#a87447' }));

tex('feather', (p) => p.art([
  '................',
  '..........###...',
  '.........#####..',
  '........######..',
  '.......######...',
  '......######....',
  '.....######.....',
  '....######......',
  '...#####........',
  '...####.........',
  '..s##...........',
  '..s.............',
  '.s..............',
  '................',
  '................',
  '................',
], { '#': '#f2f2f2', s: '#c8c8c8' }));

tex('bone', (p) => p.art([
  '................',
  '...##.......##..',
  '..#..#.....#..#.',
  '..#..######..#..',
  '..#..######..#..',
  '...##......##...',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
], { '#': '#efe8d0' }));

tex('string', (p) => p.art([
  '................',
  '....#...........',
  '...#.#..........',
  '...#..#.........',
  '....#..#........',
  '.....#..#.......',
  '......#..#......',
  '.......#..#.....',
  '........#..#....',
  '.........#.#....',
  '..........#.#...',
  '..........#.#...',
  '...........#....',
  '................',
  '................',
  '................',
], { '#': '#e8e8e8' }));

tex('arrow', (p) => p.art([
  '................',
  '.............##.',
  '............##..',
  '...........##...',
  '..........##....',
  '.........##.....',
  '........##......',
  '.......##.......',
  '......##........',
  '..f..##.........',
  '.fff##..........',
  '.ffff...........',
  '.fff............',
  '.f..............',
  '................',
  '................',
], { '#': '#9c7a4a', f: '#efefef' }));

tex('bow', (p) => p.art([
  '................',
  '.........###....',
  '........#...#...',
  '.......#.....#..',
  '......s.......#.',
  '.....s........#.',
  '....s.........#.',
  '...s..........#.',
  '....s.........#.',
  '.....s........#.',
  '......s.......#.',
  '.......#.....#..',
  '........#...#...',
  '.........###....',
  '................',
  '................',
], { '#': '#9c7a4a', s: '#efefef' }));

tex('shears', (p) => p.art([
  '................',
  '..##........##..',
  '.#..#......#..#.',
  '.#..#......#..#.',
  '..##........##..',
  '...#........#...',
  '....#......#....',
  '.....#....#.....',
  '......####......',
  '.....##..##.....',
  '....##....##....',
  '...##......##...',
  '..##........##..',
  '..#..........#..',
  '................',
  '................',
], { '#': '#d8d8d8' }));

tex('bucket', (p) => p.art([
  '................',
  '................',
  '...#.......#....',
  '..#.#.....#.#...',
  '..#..#####..#...',
  '..############..',
  '..#..........#..',
  '..#..........#..',
  '..#..........#..',
  '...#........#...',
  '...#........#...',
  '....########....',
  '................',
  '................',
  '................',
  '................',
], { '#': '#c8c8c8' }));

tex('water_bucket', (p) => { order[T('bucket')].draw(p); p.rect(4, 6, 8, 5, '#2a64c8'); });
tex('lava_bucket', (p) => { order[T('bucket')].draw(p); p.rect(4, 6, 8, 5, '#e06a12'); });
tex('milk_bucket', (p) => { order[T('bucket')].draw(p); p.rect(4, 6, 8, 5, '#f4f4f4'); });

tex('egg', (p) => p.art([
  '................',
  '................',
  '.......##.......',
  '......####......',
  '.....######.....',
  '....########....',
  '....########....',
  '....########....',
  '....########....',
  '.....######.....',
  '......####......',
  '................',
  '................',
  '................',
  '................',
  '................',
], { '#': '#e8dcc8' }));

tex('rotten_flesh', (p) => meat(p, '#7a6a4a', '#9a8a6a', '#5a4a30'));
tex('spider_eye', (p) => p.art([
  '................',
  '................',
  '................',
  '.....#####......',
  '....#######.....',
  '...####a####....',
  '...###aaa###....',
  '...####a####....',
  '....#######.....',
  '.....#####......',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
], { '#': '#8a2a2a', a: '#f0d000' }));

export { Paint };

/* ─────────────────── Tuiles ajoutées : jungle, savane, marais, badlands ───────────────────
   Elles sont déclarées après coup pour que les couches déjà utilisées gardent
   leur numéro : les mondes sauvegardés continuent d'afficher les bons blocs. */

tex('jungle_log_side', (p) => logSide(p, '#5a4426', '#3f2f16', '#6b5433'));
tex('jungle_log_top', (p) => logTop(p, '#c8a05a', '#a07a3a', '#5a4426'));
tex('jungle_planks', (p) => planks(p, '#a87f52', '#86633c', '#bd9464'));
tex('jungle_leaves', (p) => leaves(p, '#2f8f2a', '#1f6b1c', '#43a83a'));
tex('jungle_sapling', (p) => {
  p.art([
    '................',
    '................',
    '.....#....#.....',
    '....###..###....',
    '...##########...',
    '....########....',
    '.....######.....',
    '......####......',
    '.......##.......',
    '.......#........',
    '.......#........',
    '.......#........',
    '......###.......',
    '................',
    '................',
    '................',
  ], { '#': '#2f8f2a' });
  for (let y = 9; y < 13; y++) p.px(7, y, '#5a4426');
});

tex('acacia_log_side', (p) => logSide(p, '#6b5a4a', '#4a3c30', '#8a7562'));
tex('acacia_log_top', (p) => logTop(p, '#b06a3a', '#8a5028', '#6b5a4a'));
tex('acacia_planks', (p) => planks(p, '#b06336', '#8d4c26', '#c47a4c'));
tex('acacia_leaves', (p) => leaves(p, '#6f9e2f', '#547a20', '#89b845'));
tex('acacia_sapling', (p) => {
  p.art([
    '................',
    '................',
    '................',
    '...##########...',
    '..############..',
    '...####..####...',
    '................',
    '.......#........',
    '.......#........',
    '.......#........',
    '.......#........',
    '......###.......',
    '................',
    '................',
    '................',
    '................',
  ], { '#': '#6f9e2f' });
  for (let y = 7; y < 12; y++) p.px(7, y, '#6b5a4a');
});

tex('red_sand', (p) => { p.fill('#bf6c33').grain(14).speckle('#a85c28', 30).speckle('#d2814a', 22); });
tex('red_sandstone_top', (p) => { p.fill('#bd6a32').grain(8).speckle('#a85c28', 20); });
tex('red_sandstone_side', (p) => {
  p.fill('#bd6a32').grain(8);
  p.rect(0, 3, 16, 1, '#9c5222'); p.rect(0, 11, 16, 1, '#9c5222');
  p.rect(0, 4, 16, 1, '#d18048'); p.rect(0, 12, 16, 1, '#d18048');
  p.speckle('#a85c28', 24);
});
tex('red_sandstone_bottom', (p) => { p.fill('#a85c28').grain(10).speckle('#8f4c1e', 24); });

function terracotta(p, base, light, dark) {
  p.fill(base).grain(12);
  p.speckle(dark, 26).speckle(light, 18);
  for (let i = 0; i < 5; i++) {
    const y = (p.rng() * 16) | 0;
    p.rect(0, y, 16, 1, p.rng() < 0.5 ? dark : light);
  }
  p.grain(6);
}
tex('terracotta', (p) => terracotta(p, '#985e43', '#a97052', '#7d4a33'));
tex('terracotta_orange', (p) => terracotta(p, '#a05324', '#bd6a34', '#82401a'));
tex('terracotta_white', (p) => terracotta(p, '#d1b1a1', '#e2c6b8', '#b5928a'));
tex('terracotta_yellow', (p) => terracotta(p, '#ba8523', '#d19c38', '#96691a'));

tex('podzol_top', (p) => { p.fill('#5a3f22').grain(16).speckle('#43301a', 34).speckle('#7a5a34', 24); });
tex('podzol_side', (p) => {
  p.fill('#8a6543').grain(18).speckle('#6f4f33', 26);
  p.rect(0, 0, 16, 3, '#5a3f22');
  const edge = [3, 4, 3, 4, 4, 3, 2, 4, 4, 3, 4, 2, 3, 4, 4, 3];
  for (let x = 0; x < 16; x++) p.px(x, edge[x] - 1, '#43301a');
});

tex('vine', (p) => {
  const rng = p.rng;
  for (let x = 1; x < 16; x += 4) {
    let cx = x;
    const h = 10 + ((rng() * 6) | 0);
    for (let y = 0; y < h; y++) {
      p.px(cx, y, '#3f7a2a');
      p.px(cx + 1, y, '#356a22');
      if (rng() < 0.2) cx += rng() < 0.5 ? 1 : -1;
      if (rng() < 0.18) { p.px(cx - 1, y, '#4f8f36'); p.px(cx + 2, y, '#4f8f36'); }
    }
  }
});

tex('sugar_cane', (p) => {
  for (const x of [4, 11]) {
    for (let y = 0; y < 16; y++) {
      p.px(x, y, '#8fbf5a');
      p.px(x + 1, y, '#7aa848');
      if (y % 5 === 0) { p.px(x, y, '#a8cf72'); p.px(x + 1, y, '#a8cf72'); }
    }
  }
  p.px(3, 4, '#8fbf5a'); p.px(12, 9, '#8fbf5a');
});
