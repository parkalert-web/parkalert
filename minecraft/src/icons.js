/**
 * Minecraft JS — icônes d'inventaire.
 *
 * Les objets « plats » (outils, aliments) reprennent simplement leur tuile ;
 * les blocs sont dessinés en cube isométrique à partir de leurs trois faces
 * visibles, comme dans l'inventaire du jeu.
 */

import { tilePixels, TILE, tileNames } from './textures.js';
import { getItem } from './items.js';

const cache = new Map();
const SIZE = 64;

function pixelAt(data, x, y) {
  const i = (y * TILE + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

/** Dessine une tuile déformée sur un parallélogramme (A→B en u, A→D en v). */
function drawFace(ctx, data, A, B, D, shade, tint = null) {
  const ux = (B[0] - A[0]) / TILE, uy = (B[1] - A[1]) / TILE;
  const vx = (D[0] - A[0]) / TILE, vy = (D[1] - A[1]) / TILE;
  for (let v = 0; v < TILE; v++) {
    for (let u = 0; u < TILE; u++) {
      const [r, g, b, a] = pixelAt(data, u, v);
      if (a < 8) continue;
      const x0 = A[0] + ux * u + vx * v;
      const y0 = A[1] + uy * u + vy * v;
      const tr = tint ? tint[0] : 1, tg = tint ? tint[1] : 1, tb = tint ? tint[2] : 1;
      ctx.fillStyle = `rgba(${Math.round(r * shade * tr)},${Math.round(g * shade * tg)},${Math.round(b * shade * tb)},${a / 255})`;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + ux, y0 + uy);
      ctx.lineTo(x0 + ux + vx, y0 + uy + vy);
      ctx.lineTo(x0 + vx, y0 + vy);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** URL de données d'une icône d'objet, mise en cache. */
export function itemIcon(name) {
  if (cache.has(name)) return cache.get(name);
  const it = getItem(name);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  if (it && it.isBlock && it.iconTiles) {
    const names = tileNames();
    const [topT, sideT, backT] = it.iconTiles;
    const top = tilePixels(names[topT]);
    const right = tilePixels(names[sideT]);
    const left = tilePixels(names[backT]);
    const s = SIZE;
    const P = (x, y) => [x * s, y * s];
    // Cube isométrique : dessus, face droite, face gauche.
    const tint = it.tintColor;
    const sideTint = it.tintFaces === 'all' ? tint : null;
    drawFace(ctx, top, P(0.5, 0.06), P(0.97, 0.31), P(0.03, 0.31), 1.0, tint);
    drawFace(ctx, left, P(0.03, 0.31), P(0.5, 0.57), P(0.03, 0.75), 0.66, sideTint);
    drawFace(ctx, right, P(0.5, 0.57), P(0.97, 0.31), P(0.5, 1.0), 0.82, sideTint);
  } else {
    const names = tileNames();
    const layer = it ? it.tile : 0;
    const data = tilePixels(names[layer]);
    const img = ctx.createImageData(TILE, TILE);
    if (it && it.tintColor) {
      const t = it.tintColor;
      for (let i = 0; i < data.length; i += 4) {
        data[i] *= t[0]; data[i + 1] *= t[1]; data[i + 2] *= t[2];
      }
    }
    img.data.set(data);
    const tmp = document.createElement('canvas');
    tmp.width = TILE; tmp.height = TILE;
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.drawImage(tmp, 2, 2, SIZE - 4, SIZE - 4);
  }

  const url = canvas.toDataURL();
  cache.set(name, url);
  return url;
}

/** Icônes de l'interface (cœur, cuisse de poulet, bulle, armure) dessinées en pixels. */
export function hudIcon(kind) {
  const key = `hud:${kind}`;
  if (cache.has(key)) return cache.get(key);
  const S = 36;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d');
  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x * 4, y * 4, 4, 4); };
  const art = {
    heart: ['..##.##..', '.#######.', '.#######.', '.#######.', '..#####..', '...###...', '....#....'],
    heart_empty: ['..##.##..', '.#.....#.', '#.......#', '#.......#', '.#.....#.', '..#...#..', '...#.#...'],
    food: ['...####..', '..######.', '.########', '.########', '..######.', '...####..', '....##...'],
    food_empty: ['...####..', '..#....#.', '.#......#', '.#......#', '..#....#.', '...#..#..', '....##...'],
    bubble: ['...###...', '..#...#..', '.#..#..#.', '#...#...#', '#.......#', '.#.....#.', '..#####..'],
    armor: ['....#....', '...###...', '..#####..', '.#######.', '#########', '.#.###.#.', '..#...#..'],
  };
  const colors = {
    heart: '#e03434', heart_empty: '#3a1010', food: '#c88a3a', food_empty: '#3a2a10',
    bubble: '#9fd8ff', armor: '#cfd8e8',
  };
  const rows = art[kind] || art.heart;
  const color = colors[kind] || '#fff';
  const dark = kind.endsWith('_empty') ? color : '#00000055';
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      if (rows[y][x] !== '#') continue;
      px(x, y + 1, color);
    }
  }
  // Petit reflet
  if (kind === 'heart') { px(2, 2, '#ff8080'); px(3, 2, '#ff8080'); }
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}
