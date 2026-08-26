/**
 * Minecraft JS — bruits déterministes.
 *
 * Toute la génération du monde repose sur ces fonctions : à graine égale,
 * deux joueurs obtiennent exactement le même monde, et un tronçon régénéré
 * plus tard est identique à ce qu'il était.
 */

/** PRNG rapide et déterministe (mulberry32). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hachage entier → [0,1[ : sert aux décisions « par colonne » (arbres, minerais). */
export function hash3i(x, y, z, seed) {
  let h = (x * 374761393) ^ (y * 668265263) ^ (z * 2147483647) ^ (seed * 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function hash2i(x, z, seed) {
  return hash3i(x, 0, z, seed);
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

function grad2(h, x, y) {
  switch (h & 3) {
    case 0: return x + y;
    case 1: return -x + y;
    case 2: return x - y;
    default: return -x - y;
  }
}

function grad3(h, x, y, z) {
  switch (h & 15) {
    case 0: case 12: return x + y;
    case 1: case 13: return -x + y;
    case 2: case 14: return x - y;
    case 3: case 15: return -x - y;
    case 4: return x + z;
    case 5: return -x + z;
    case 6: return x - z;
    case 7: return -x - z;
    case 8: return y + z;
    case 9: return -y + z;
    case 10: return y - z;
    default: return -y - z;
  }
}

/** Bruit de Perlin classique, 2D et 3D, avec octaves. */
export class Noise {
  constructor(seed = 0) {
    this.seed = seed | 0;
    const rng = mulberry32(this.seed || 1);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  /** Perlin 2D dans [-1,1]. */
  perlin2(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const P = this.perm;
    const aa = P[P[X] + Y], ab = P[P[X] + Y + 1];
    const ba = P[P[X + 1] + Y], bb = P[P[X + 1] + Y + 1];
    const x1 = lerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u);
    const x2 = lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v) * 0.7071;
  }

  /** Perlin 3D dans [-1,1]. */
  perlin3(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y), zf = z - Math.floor(z);
    const u = fade(xf), v = fade(yf), w = fade(zf);
    const P = this.perm;
    const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z;
    const B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
    const x1 = lerp(grad3(P[AA], xf, yf, zf), grad3(P[BA], xf - 1, yf, zf), u);
    const x2 = lerp(grad3(P[AB], xf, yf - 1, zf), grad3(P[BB], xf - 1, yf - 1, zf), u);
    const y1 = lerp(x1, x2, v);
    const x3 = lerp(grad3(P[AA + 1], xf, yf, zf - 1), grad3(P[BA + 1], xf - 1, yf, zf - 1), u);
    const x4 = lerp(grad3(P[AB + 1], xf, yf - 1, zf - 1), grad3(P[BB + 1], xf - 1, yf - 1, zf - 1), u);
    const y2 = lerp(x3, x4, v);
    return lerp(y1, y2, w) * 0.9;
  }

  /** Somme d'octaves 2D (fractal Brownian motion). */
  fbm2(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.perlin2(x * freq, y * freq);
      norm += amp;
      amp *= gain; freq *= lacunarity;
    }
    return sum / norm;
  }

  fbm3(x, y, z, octaves = 3, lacunarity = 2, gain = 0.5) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.perlin3(x * freq, y * freq, z * freq);
      norm += amp;
      amp *= gain; freq *= lacunarity;
    }
    return sum / norm;
  }

  /** Bruit « en crêtes » : donne des chaînes de montagnes plutôt que des bosses. */
  ridged2(x, y, octaves = 4) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * (1 - Math.abs(this.perlin2(x * freq, y * freq)) * 2);
      norm += amp;
      amp *= 0.5; freq *= 2;
    }
    return sum / norm;
  }
}
