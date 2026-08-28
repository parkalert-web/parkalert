/**
 * Minecraft JS — petite bibliothèque mathématique (matrices 4×4, vecteurs).
 * Les matrices sont des Float32Array de 16 éléments, en colonne majeure
 * (même convention que WebGL / OpenGL).
 */

export const DEG = Math.PI / 180;

export function mat4() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function identity(out) {
  out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
  out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
  return out;
}

export function multiply(out, a, b) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  for (let i = 0; i < 4; i++) {
    const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
    out[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  }
  return out;
}

export function perspective(out, fovyRad, aspect, near, far) {
  const f = 1 / Math.tan(fovyRad / 2);
  identity(out);
  out[0] = f / aspect; out[5] = f; out[11] = -1; out[15] = 0;
  out[10] = (far + near) / (near - far);
  out[14] = (2 * far * near) / (near - far);
  return out;
}

export function ortho(out, l, r, b, t, n, f) {
  identity(out);
  out[0] = 2 / (r - l); out[5] = 2 / (t - b); out[10] = -2 / (f - n);
  out[12] = -(r + l) / (r - l); out[13] = -(t + b) / (t - b); out[14] = -(f + n) / (f - n);
  return out;
}

export function translate(out, x, y, z) {
  identity(out);
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}

export function scaleM(out, x, y, z) {
  identity(out);
  out[0] = x; out[5] = y; out[10] = z;
  return out;
}

export function rotateX(out, a) {
  const c = Math.cos(a), s = Math.sin(a);
  identity(out);
  out[5] = c; out[6] = s; out[9] = -s; out[10] = c;
  return out;
}

export function rotateY(out, a) {
  const c = Math.cos(a), s = Math.sin(a);
  identity(out);
  out[0] = c; out[2] = -s; out[8] = s; out[10] = c;
  return out;
}

export function rotateZ(out, a) {
  const c = Math.cos(a), s = Math.sin(a);
  identity(out);
  out[0] = c; out[1] = s; out[4] = -s; out[5] = c;
  return out;
}

/**
 * Matrice de vue d'une caméra placée en (x,y,z) et orientée par yaw/pitch.
 *
 * Convention du jeu, identique à celle de Minecraft :
 *   • yaw 0 regarde vers +Z ; l'avant vaut (−sin yaw·cos pitch, sin pitch, cos yaw·cos pitch)
 *     — c'est exactement ce que renvoie Player.lookVector(), donc le viseur
 *     et l'image montrent le même bloc ;
 *   • le repère du monde étant direct avec Y vers le haut, la droite de la
 *     caméra vaut (−cos yaw, 0, −sin yaw) : face au sud, l'ouest est à droite.
 */
export function viewMatrix(out, x, y, z, yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  // Lignes de la rotation : droite, haut, arrière (l'inverse de l'avant).
  out[0] = -cy; out[1] = sy * sp; out[2] = sy * cp; out[3] = 0;
  out[4] = 0; out[5] = cp; out[6] = -sp; out[7] = 0;
  out[8] = -sy; out[9] = -cy * sp; out[10] = -cy * cp; out[11] = 0;
  out[12] = -(out[0] * x + out[4] * y + out[8] * z);
  out[13] = -(out[1] * x + out[5] * y + out[9] * z);
  out[14] = -(out[2] * x + out[6] * y + out[10] * z);
  out[15] = 1;
  return out;
}

/** Composition translation → rotationY → rotationX → échelle (usage : entités). */
export function composeMatrix(out, px, py, pz, ry, rx, sx = 1, sy = 1, sz = 1) {
  const cy = Math.cos(ry), syn = Math.sin(ry);
  const cx = Math.cos(rx), sxn = Math.sin(rx);
  // M = T * Ry * Rx * S
  const m00 = cy, m01 = 0, m02 = syn;
  const m10 = syn * sxn, m11 = cx, m12 = -cy * sxn;
  const m20 = -syn * cx, m21 = sxn, m22 = cy * cx;
  out[0] = m00 * sx; out[1] = m10 * sx; out[2] = m20 * sx; out[3] = 0;
  out[4] = m01 * sy; out[5] = m11 * sy; out[6] = m21 * sy; out[7] = 0;
  out[8] = m02 * sz; out[9] = m12 * sz; out[10] = m22 * sz; out[11] = 0;
  out[12] = px; out[13] = py; out[14] = pz; out[15] = 1;
  return out;
}

export function transformPoint(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

export function invert(out, a) {
  const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4];
  const b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5];
  const b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
  const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12];
  const b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13];
  const b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return identity(out);
  det = 1 / det;
  out[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * det;
  out[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * det;
  out[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * det;
  out[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * det;
  out[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * det;
  out[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * det;
  out[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * det;
  out[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * det;
  out[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * det;
  out[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * det;
  out[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * det;
  out[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * det;
  out[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * det;
  out[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * det;
  out[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * det;
  out[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * det;
  return out;
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);
