/**
 * Los Santos Online — petite bibliothèque mathématique.
 * Tout est en Float32Array / tableaux simples : aucune dépendance, utilisable
 * aussi bien dans le navigateur que dans Node (tests).
 */

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const sign = Math.sign;

/** Interpolation indépendante du framerate : rapproche `a` de `b`. */
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));

/** Ramène un angle dans ]-PI, PI]. */
export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/** Plus court chemin angulaire de `a` vers `b`. */
export const angleDelta = (a, b) => wrapAngle(b - a);

export function dampAngle(a, b, rate, dt) {
  return a + angleDelta(a, b) * (1 - Math.exp(-rate * dt));
}

/* ------------------------------------------------------------------ aléatoire */

/** Générateur déterministe (mulberry32) : même graine, même ville. */
export function rng(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (rand, arr) => arr[Math.floor(rand() * arr.length) % arr.length];
export const range = (rand, a, b) => a + rand() * (b - a);
export const irange = (rand, a, b) => Math.floor(a + rand() * (b - a + 1));

/* ---------------------------------------------------------------------- vec3 */

export const v3 = (x = 0, y = 0, z = 0) => new Float32Array([x, y, z]);
export const v3set = (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; };
export const v3copy = (o, a) => { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; return o; };
export const v3add = (o, a, b) => { o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; };
export const v3sub = (o, a, b) => { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; };
export const v3scale = (o, a, s) => { o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; };
export const v3dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const v3len = (a) => Math.hypot(a[0], a[1], a[2]);
export function v3norm(o, a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  o[0] = a[0] / l; o[1] = a[1] / l; o[2] = a[2] / l; return o;
}
export function v3cross(o, a, b) {
  const x = a[1] * b[2] - a[2] * b[1];
  const y = a[2] * b[0] - a[0] * b[2];
  const z = a[0] * b[1] - a[1] * b[0];
  o[0] = x; o[1] = y; o[2] = z; return o;
}

export const dist2D = (ax, az, bx, bz) => Math.hypot(bx - ax, bz - az);
export const dist2Dsq = (ax, az, bx, bz) => (bx - ax) * (bx - ax) + (bz - az) * (bz - az);

/* ---------------------------------------------------------------------- mat4 */
/* Convention colonne-major, identique à WebGL. */

export const m4 = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export function m4identity(o) {
  o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o;
}

export function m4mul(o, a, b) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  for (let i = 0; i < 4; i++) {
    const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
    o[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  }
  return o;
}

export function m4perspective(o, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  o.fill(0);
  o[0] = f / aspect; o[5] = f; o[11] = -1;
  o[10] = (far + near) / (near - far);
  o[14] = (2 * far * near) / (near - far);
  return o;
}

export function m4ortho(o, l, r, b, t, n, f) {
  o.fill(0);
  o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n); o[15] = 1;
  o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n);
  return o;
}

export function m4lookAt(o, eye, center, up) {
  let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
  let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
  o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
  o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
  o[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  o[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  o[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  o[15] = 1;
  return o;
}

/** Matrice de transformation d'un objet : translation, rotations Y/X/Z puis échelle. */
export function m4compose(o, px, py, pz, ry, sx, sy, sz, rx = 0, rz = 0) {
  const cy = Math.cos(ry), sy_ = Math.sin(ry);
  const cx = Math.cos(rx), sx_ = Math.sin(rx);
  const cz = Math.cos(rz), sz_ = Math.sin(rz);
  // R = Ry * Rx * Rz
  const m00 = cy * cz + sy_ * sx_ * sz_, m01 = cx * sz_, m02 = -sy_ * cz + cy * sx_ * sz_;
  const m10 = -cy * sz_ + sy_ * sx_ * cz, m11 = cx * cz, m12 = sy_ * sz_ + cy * sx_ * cz;
  const m20 = sy_ * cx, m21 = -sx_, m22 = cy * cx;
  o[0] = m00 * sx; o[1] = m01 * sx; o[2] = m02 * sx; o[3] = 0;
  o[4] = m10 * sy; o[5] = m11 * sy; o[6] = m12 * sy; o[7] = 0;
  o[8] = m20 * sz; o[9] = m21 * sz; o[10] = m22 * sz; o[11] = 0;
  o[12] = px; o[13] = py; o[14] = pz; o[15] = 1;
  return o;
}

/** Applique une matrice à un point (w = 1). */
export function m4xform(o, m, p) {
  const x = p[0], y = p[1], z = p[2];
  o[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
  o[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  o[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  return o;
}

/** Extrait les 6 plans du frustum d'une matrice view-projection. */
export function frustumFromVP(vp, out) {
  const p = out || new Float32Array(24);
  for (let i = 0; i < 3; i++) {
    const s = i * 8;
    // plan négatif puis positif pour chaque axe
    for (let k = 0; k < 4; k++) {
      p[s + k] = vp[k * 4 + 3] + vp[k * 4 + i];
      p[s + 4 + k] = vp[k * 4 + 3] - vp[k * 4 + i];
    }
  }
  for (let i = 0; i < 6; i++) {
    const s = i * 4;
    const l = Math.hypot(p[s], p[s + 1], p[s + 2]) || 1;
    p[s] /= l; p[s + 1] /= l; p[s + 2] /= l; p[s + 3] /= l;
  }
  return p;
}

/** Test boîte englobante (centre + demi-dimensions) contre un frustum. */
export function aabbInFrustum(planes, cx, cy, cz, ex, ey, ez) {
  for (let i = 0; i < 6; i++) {
    const s = i * 4;
    const nx = planes[s], ny = planes[s + 1], nz = planes[s + 2], d = planes[s + 3];
    const r = ex * Math.abs(nx) + ey * Math.abs(ny) + ez * Math.abs(nz);
    if (nx * cx + ny * cy + nz * cz + d + r < 0) return false;
  }
  return true;
}

/* --------------------------------------------------------------------- couleur */

/**
 * "#rrggbb" ou entier 0xrrggbb -> couleur linéaire [r,g,b].
 * Les teintes sont écrites en sRGB (comme en CSS) ; le rendu travaille en
 * linéaire, d'où la conversion — sans elle tout le jeu paraît délavé.
 */
const srgbToLinear = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));

export function color(c) {
  let n = typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : c;
  return [
    srgbToLinear(((n >> 16) & 255) / 255),
    srgbToLinear(((n >> 8) & 255) / 255),
    srgbToLinear((n & 255) / 255),
  ];
}

export function shade(c, f) {
  return [clamp(c[0] * f, 0, 1), clamp(c[1] * f, 0, 1), clamp(c[2] * f, 0, 1)];
}

export function mixColor(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
