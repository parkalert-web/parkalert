/**
 * Minecraft JS — rendu WebGL2.
 *
 * Trois programmes seulement :
 *   • terrain — décode les sommets compactés des tronçons, applique lumière,
 *     occlusion ambiante, teinte de biome et brouillard ;
 *   • simple  — cubes des créatures, objets au sol, particules, nuages, pluie,
 *     contour du bloc visé, objet tenu en main ;
 *   • ciel    — dégradé du jour à la nuit, étoiles, calculé par pixel.
 */

import { mat4, perspective, viewMatrix, multiply, composeMatrix, identity, translate, invert } from './math.js';
import { buildAtlas, TILE, T } from './textures.js';
import { CX, CZ, WORLD_H } from './chunk.js';

/* ─────────────────────────────── Nuanceurs ─────────────────────────────── */

const TERRAIN_VS = `#version 300 es
precision highp float;
precision highp int;
in uint aP0;
in uint aP1;
uniform mat4 uViewProj;
uniform vec3 uOrigin;
uniform float uDay;
uniform vec3 uCam;
uniform float uFogNear;
uniform float uFogFar;
out vec3 vUV;
out vec3 vLight;
out float vFog;

const vec3 NORMALS[6] = vec3[6](
  vec3(1.,0.,0.), vec3(-1.,0.,0.), vec3(0.,1.,0.),
  vec3(0.,-1.,0.), vec3(0.,0.,1.), vec3(0.,0.,-1.));
// Les faces n'ont pas toutes la même clarté : c'est ce qui donne du relief.
const float SHADE[6] = float[6](0.82, 0.82, 1.0, 0.62, 0.72, 0.72);

void main() {
  float x = float(aP0 & 31u);
  float y = float((aP0 >> 5) & 255u);
  float z = float((aP0 >> 13) & 31u);
  float u = float((aP0 >> 18) & 1u);
  float v = float((aP0 >> 19) & 1u);
  uint face = (aP0 >> 20u) & 7u;
  uint off = (aP0 >> 23u) & 3u;
  float ao = float((aP0 >> 25u) & 3u);

  float layer = float(aP1 & 255u);
  float sky = float((aP1 >> 8u) & 15u);
  float blk = float((aP1 >> 12u) & 15u);
  vec3 tint = vec3(float((aP1 >> 16u) & 31u), float((aP1 >> 21u) & 31u), float((aP1 >> 26u) & 31u)) / 31.0;

  vec3 pos = uOrigin + vec3(x, y, z);
  if (off == 1u) pos.y -= 0.115;
  else if (off == 2u) pos -= NORMALS[face] * 0.0625;

  // Courbe de lumière de Minecraft : chaque niveau perdu retire ~15 %.
  float skyTerm = pow(0.86, 15.0 - sky) * uDay;
  float blkTerm = pow(0.86, 15.0 - blk);
  vec3 lightCol = vec3(0.93, 0.96, 1.0) * skyTerm + vec3(1.0, 0.76, 0.48) * blkTerm * 1.05;
  float aoF = 0.64 + 0.12 * ao;
  vLight = min(lightCol, vec3(1.25)) * SHADE[face] * aoF + 0.04;
  vLight *= tint;

  vUV = vec3(u, v, layer);
  float d = distance(pos, uCam);
  vFog = clamp((uFogFar - d) / max(1.0, uFogFar - uFogNear), 0.0, 1.0);
  gl_Position = uViewProj * vec4(pos, 1.0);
}`;

const TERRAIN_FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
in vec3 vUV;
in vec3 vLight;
in float vFog;
uniform sampler2DArray uAtlas;
uniform vec3 uFogColor;
uniform int uCutout;
uniform float uAlpha;
out vec4 fragColor;
void main() {
  vec4 t = texture(uAtlas, vUV);
  if (uCutout == 1 && t.a < 0.4) discard;
  vec3 c = t.rgb * vLight;
  fragColor = vec4(mix(uFogColor, c, vFog), t.a * uAlpha);
}`;

const SIMPLE_VS = `#version 300 es
precision highp float;
in vec3 aPos;
in vec2 aUV;
in float aShade;
uniform mat4 uViewProj;
uniform mat4 uModel;
uniform vec3 uCam;
uniform float uFogNear;
uniform float uFogFar;
out vec2 vUV;
out float vShade;
out float vFog;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vUV = aUV;
  vShade = aShade;
  float d = distance(world.xyz, uCam);
  vFog = clamp((uFogFar - d) / max(1.0, uFogFar - uFogNear), 0.0, 1.0);
  gl_Position = uViewProj * world;
}`;

const SIMPLE_FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
in vec2 vUV;
in float vShade;
in float vFog;
uniform sampler2DArray uAtlas;
uniform float uLayer;
uniform vec4 uColor;
uniform float uLight;
uniform int uTextured;
uniform vec3 uFogColor;
uniform int uFogged;
out vec4 fragColor;
void main() {
  vec4 c = uColor;
  if (uTextured == 1) {
    vec4 t = texture(uAtlas, vec3(vUV, uLayer));
    if (t.a < 0.35) discard;
    c *= t;
  }
  c.rgb *= vShade * uLight;
  if (uFogged == 1) c.rgb = mix(uFogColor, c.rgb, vFog);
  if (c.a < 0.02) discard;
  fragColor = c;
}`;

const SKY_VS = `#version 300 es
precision highp float;
in vec2 aPos;
uniform mat4 uInvVP;
uniform vec3 uCam;
out vec3 vDir;
void main() {
  vec4 far = uInvVP * vec4(aPos, 1.0, 1.0);
  vDir = normalize(far.xyz / far.w - uCam);
  gl_Position = vec4(aPos, 0.9999, 1.0);
}`;

const SKY_FS = `#version 300 es
precision highp float;
in vec3 vDir;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform float uNight;
out vec4 fragColor;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y * 1.6 + 0.12, 0.0, 1.0);
  vec3 col = mix(uHorizon, uTop, pow(h, 0.62));

  // Lueur chaude autour du soleil, plus large quand il rase l'horizon.
  float sun = max(0.0, dot(d, uSunDir));
  col += vec3(1.0, 0.62, 0.28) * pow(sun, 8.0) * 0.55 * (1.0 - uNight * 0.6);
  col += vec3(1.0, 0.85, 0.65) * pow(sun, 220.0) * 1.2;

  // Étoiles : une grille hachée, visible seulement la nuit.
  if (uNight > 0.02 && d.y > -0.05) {
    vec3 g = floor(d * 190.0);
    float s = hash(g);
    if (s > 0.9965) {
      float tw = 0.55 + 0.45 * fract(s * 91.7);
      col += vec3(0.9, 0.93, 1.0) * (s - 0.9965) * 260.0 * uNight * tw;
    }
  }
  fragColor = vec4(col, 1.0);
}`;

/* ─────────────────────────── Utilitaires WebGL ─────────────────────────── */

function compile(gl, type, src, name) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`Nuanceur ${name} : ${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
}

function program(gl, vs, fs, name) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs, `${name} (sommets)`));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs, `${name} (fragments)`));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`Édition de liens ${name} : ${gl.getProgramInfoLog(p)}`);
  }
  const uniforms = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    uniforms[info.name] = gl.getUniformLocation(p, info.name);
  }
  const attribs = {};
  const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < na; i++) {
    const info = gl.getActiveAttrib(p, i);
    attribs[info.name] = gl.getAttribLocation(p, info.name);
  }
  return { p, u: uniforms, a: attribs };
}

/* Géométrie d'un cube unitaire (position, uv, ombrage de face) pour le
   programme « simple » : créatures, objets, particules, objet en main. */
function unitCube() {
  const F = [
    { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 0.78 },
    { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 0.78 },
    { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0 },
    { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.55 },
    { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.66 },
    { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.66 },
  ];
  const UV = [[0, 1], [1, 1], [1, 0], [0, 0]];
  const verts = [];
  const idxs = [];
  let base = 0;
  for (const f of F) {
    for (let i = 0; i < 4; i++) {
      verts.push(f.c[i][0] - 0.5, f.c[i][1] - 0.5, f.c[i][2] - 0.5, UV[i][0], UV[i][1], f.s);
    }
    idxs.push(base, base + 1, base + 2, base, base + 2, base + 3);
    base += 4;
  }
  return { verts: new Float32Array(verts), idxs: new Uint16Array(idxs) };
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, depth: true, stencil: false,
      powerPreference: 'high-performance', preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("WebGL2 n'est pas disponible sur cet appareil.");
    this.gl = gl;

    this.terrain = program(gl, TERRAIN_VS, TERRAIN_FS, 'terrain');
    this.simple = program(gl, SIMPLE_VS, SIMPLE_FS, 'simple');
    this.sky = program(gl, SKY_VS, SKY_FS, 'ciel');

    this.proj = mat4();
    this.view = mat4();
    this.viewProj = mat4();
    this.invVP = mat4();
    this.model = mat4();
    this.tmp = mat4();

    this.initAtlas();
    this.initGeometry();

    this.meshes = new Map();     // tronçon → objets GPU
    this.frustum = new Float32Array(24);
    this.renderDistance = 8;
    this.fov = 70;
    this.stats = { chunks: 0, quads: 0, draws: 0 };
    this.animTime = 0;

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0.5, 0.7, 1, 1);
  }

  /* ──────────────────────────── Initialisation ──────────────────────────── */

  initAtlas() {
    const gl = this.gl;
    const atlas = buildAtlas();
    this.atlasInfo = atlas;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, TILE, TILE, atlas.layers, 0, gl.RGBA, gl.UNSIGNED_BYTE, atlas.data);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    this.atlas = tex;
  }

  /** Fait défiler les images de l'eau et de la lave dans l'atlas. */
  updateAnimations(dt) {
    this.animTime += dt;
    const step = Math.max(0, Math.floor(this.animTime * 8));
    if (step === this.lastAnimStep) return;
    this.lastAnimStep = step;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlas);
    for (const anim of this.atlasInfo.anims) {
      const frame = anim.frames[step % anim.frames.length];
      if (!frame) continue;
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, anim.layer, TILE, TILE, 1, gl.RGBA, gl.UNSIGNED_BYTE, frame);
    }
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  }

  initGeometry() {
    const gl = this.gl;

    // Cube unitaire partagé.
    const cube = unitCube();
    this.cubeVAO = gl.createVertexArray();
    gl.bindVertexArray(this.cubeVAO);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, cube.verts, gl.STATIC_DRAW);
    const a = this.simple.a;
    gl.enableVertexAttribArray(a.aPos);
    gl.vertexAttribPointer(a.aPos, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(a.aUV);
    gl.vertexAttribPointer(a.aUV, 2, gl.FLOAT, false, 24, 12);
    gl.enableVertexAttribArray(a.aShade);
    gl.vertexAttribPointer(a.aShade, 1, gl.FLOAT, false, 24, 20);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cube.idxs, gl.STATIC_DRAW);
    this.cubeCount = cube.idxs.length;

    // Quadrilatère plein écran (ciel).
    this.quadVAO = gl.createVertexArray();
    gl.bindVertexArray(this.quadVAO);
    const qb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.sky.a.aPos);
    gl.vertexAttribPointer(this.sky.a.aPos, 2, gl.FLOAT, false, 0, 0);

    // Arêtes d'un cube (contour du bloc visé).
    const e = [];
    const c = [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1], [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]];
    const pairs = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (const [i, j] of pairs) {
      e.push(c[i][0] - 0.5, c[i][1] - 0.5, c[i][2] - 0.5, 0, 0, 1);
      e.push(c[j][0] - 0.5, c[j][1] - 0.5, c[j][2] - 0.5, 0, 0, 1);
    }
    this.lineVAO = gl.createVertexArray();
    gl.bindVertexArray(this.lineVAO);
    const lb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, lb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(e), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(a.aPos);
    gl.vertexAttribPointer(a.aPos, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(a.aUV);
    gl.vertexAttribPointer(a.aUV, 2, gl.FLOAT, false, 24, 12);
    gl.enableVertexAttribArray(a.aShade);
    gl.vertexAttribPointer(a.aShade, 1, gl.FLOAT, false, 24, 20);
    this.lineCount = pairs.length * 2;

    // Tampon dynamique pour les particules et les billboards.
    this.dynVAO = gl.createVertexArray();
    gl.bindVertexArray(this.dynVAO);
    this.dynBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf);
    gl.bufferData(gl.ARRAY_BUFFER, 6 * 4 * 4096, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(a.aPos);
    gl.vertexAttribPointer(a.aPos, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(a.aUV);
    gl.vertexAttribPointer(a.aUV, 2, gl.FLOAT, false, 24, 12);
    gl.enableVertexAttribArray(a.aShade);
    gl.vertexAttribPointer(a.aShade, 1, gl.FLOAT, false, 24, 20);
    this.dynData = new Float32Array(6 * 4096);

    gl.bindVertexArray(null);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr || 2);
    const w = Math.floor(this.canvas.clientWidth * dpr);
    const h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = Math.max(1, w);
      this.canvas.height = Math.max(1, h);
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    return this.canvas.width / Math.max(1, this.canvas.height);
  }

  /* ─────────────────────── Maillages des tronçons ─────────────────────── */

  uploadMesh(chunk, mesh) {
    const gl = this.gl;
    let entry = this.meshes.get(chunk);
    if (!entry) { entry = { parts: {} }; this.meshes.set(chunk, entry); }

    for (const kind of ['opaque', 'cutout', 'water']) {
      const data = mesh[kind];
      let part = entry.parts[kind];
      if (!data) {
        if (part) { this.deletePart(part); delete entry.parts[kind]; }
        continue;
      }
      if (!part) {
        part = {
          vao: gl.createVertexArray(), b0: gl.createBuffer(), b1: gl.createBuffer(), ib: gl.createBuffer(),
        };
        gl.bindVertexArray(part.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, part.b0);
        gl.enableVertexAttribArray(this.terrain.a.aP0);
        gl.vertexAttribIPointer(this.terrain.a.aP0, 1, gl.UNSIGNED_INT, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, part.b1);
        gl.enableVertexAttribArray(this.terrain.a.aP1);
        gl.vertexAttribIPointer(this.terrain.a.aP1, 1, gl.UNSIGNED_INT, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, part.ib);
        entry.parts[kind] = part;
      }
      gl.bindVertexArray(part.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, part.b0);
      gl.bufferData(gl.ARRAY_BUFFER, data.p0, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, part.b1);
      gl.bufferData(gl.ARRAY_BUFFER, data.p1, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, part.ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.index, gl.STATIC_DRAW);
      part.count = data.count;
      part.type = data.index instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    }
    entry.origin = mesh.origin;
    gl.bindVertexArray(null);
  }

  deletePart(part) {
    const gl = this.gl;
    gl.deleteVertexArray(part.vao);
    gl.deleteBuffer(part.b0);
    gl.deleteBuffer(part.b1);
    gl.deleteBuffer(part.ib);
  }

  freeChunk(chunk) {
    const entry = this.meshes.get(chunk);
    if (!entry) return;
    for (const part of Object.values(entry.parts)) this.deletePart(part);
    this.meshes.delete(chunk);
  }

  /* ──────────────────────────── Caméra et frustum ──────────────────────────── */

  setCamera(cam, aspect) {
    perspective(this.proj, cam.fov * Math.PI / 180, aspect, 0.06, 1200);
    viewMatrix(this.view, cam.x, cam.y, cam.z, cam.yaw, cam.pitch);
    multiply(this.viewProj, this.proj, this.view);
    invert(this.invVP, this.viewProj);
    this.extractFrustum();
    this.cam = cam;
  }

  extractFrustum() {
    const m = this.viewProj, f = this.frustum;
    // gauche, droite, bas, haut, proche, lointain
    const rows = [
      [m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]],
      [m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]],
      [m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]],
      [m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]],
      [m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]],
      [m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]],
    ];
    for (let i = 0; i < 6; i++) {
      const [a, b, c, d] = rows[i];
      const len = Math.hypot(a, b, c) || 1;
      f[i * 4] = a / len; f[i * 4 + 1] = b / len; f[i * 4 + 2] = c / len; f[i * 4 + 3] = d / len;
    }
  }

  boxVisible(x0, y0, z0, x1, y1, z1) {
    const f = this.frustum;
    for (let i = 0; i < 6; i++) {
      const a = f[i * 4], b = f[i * 4 + 1], c = f[i * 4 + 2], d = f[i * 4 + 3];
      const px = a > 0 ? x1 : x0, py = b > 0 ? y1 : y0, pz = c > 0 ? z1 : z0;
      if (a * px + b * py + c * pz + d < 0) return false;
    }
    return true;
  }

  /* ──────────────────────────────── Rendu ──────────────────────────────── */

  /** Couleurs du ciel selon l'heure et la météo. */
  skyColors(world) {
    const b = world.skyBrightness();
    const rain = world.weather === 'rain' ? 1 : 0;
    const day = [0.42, 0.62, 0.98];
    const night = [0.02, 0.03, 0.09];
    const dusk = [0.55, 0.36, 0.30];
    const sun = Math.sin(world.sunAngle());
    const duskAmt = Math.max(0, 1 - Math.abs(sun) * 3.2);
    const mix = (a, c, t) => a.map((v, i) => v + (c[i] - v) * t);
    let top = mix(night, day, Math.min(1, b * 1.15));
    top = mix(top, dusk, duskAmt * 0.55);
    let horizon = top.map((v, i) => Math.min(1, v * 1.12 + [0.10, 0.10, 0.06][i] * b));
    horizon = mix(horizon, [0.98, 0.62, 0.36], duskAmt * 0.6);
    if (rain) {
      top = mix(top, [0.30, 0.33, 0.38], 0.75);
      horizon = mix(horizon, [0.38, 0.40, 0.45], 0.75);
    }
    return { top, horizon, brightness: b, night: 1 - Math.min(1, b * 1.6) };
  }

  drawSky(world, camInWater) {
    const gl = this.gl;
    const c = this.skyColors(world);
    const fog = camInWater ? [0.06, 0.24, 0.44] : c.horizon;
    gl.clearColor(fog[0], fog[1], fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (camInWater) return c;

    gl.useProgram(this.sky.p);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.quadVAO);
    gl.uniformMatrix4fv(this.sky.u.uInvVP, false, this.invVP);
    gl.uniform3f(this.sky.u.uCam, this.cam.x, this.cam.y, this.cam.z);
    gl.uniform3fv(this.sky.u.uTop, c.top);
    gl.uniform3fv(this.sky.u.uHorizon, c.horizon);
    const sd = world.sunDir();
    gl.uniform3fv(this.sky.u.uSunDir, sd);
    gl.uniform1f(this.sky.u.uNight, c.night);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    return c;
  }

  /** Soleil et lune, deux quadrilatères posés très loin dans le ciel. */
  drawCelestial(world) {
    const gl = this.gl;
    const sd = world.sunDir();
    gl.useProgram(this.simple.p);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.cubeVAO);
    gl.uniformMatrix4fv(this.simple.u.uViewProj, false, this.viewProj);
    gl.uniform3f(this.simple.u.uCam, this.cam.x, this.cam.y, this.cam.z);
    gl.uniform1i(this.simple.u.uFogged, 0);
    gl.uniform1i(this.simple.u.uTextured, 1);
    gl.uniform1f(this.simple.u.uLight, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlas);
    gl.uniform1i(this.simple.u.uAtlas, 0);

    for (const body of [{ dir: sd, layer: T('sun'), size: 60, color: [1, 1, 1, 1] },
      { dir: sd.map((v) => -v), layer: T('moon'), size: 42, color: [1, 1, 1, 1] }]) {
      const d = 420;
      composeMatrix(this.model, this.cam.x + body.dir[0] * d, this.cam.y + body.dir[1] * d, this.cam.z + body.dir[2] * d,
        0, 0, body.size, body.size, body.size);
      gl.uniformMatrix4fv(this.simple.u.uModel, false, this.model);
      gl.uniform1f(this.simple.u.uLayer, body.layer);
      gl.uniform4fv(this.simple.u.uColor, body.color);
      gl.drawElements(gl.TRIANGLES, this.cubeCount, gl.UNSIGNED_SHORT, 0);
    }
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
  }

  /**
   * Dessine tous les tronçons visibles.
   * @param {object} world monde
   * @param {object} opts {camInWater, fogColor, day}
   */
  drawChunks(world, opts) {
    const gl = this.gl;
    const t = this.terrain;
    gl.useProgram(t.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlas);
    gl.uniform1i(t.u.uAtlas, 0);
    gl.uniformMatrix4fv(t.u.uViewProj, false, this.viewProj);
    gl.uniform3f(t.u.uCam, this.cam.x, this.cam.y, this.cam.z);
    gl.uniform1f(t.u.uDay, opts.day);
    gl.uniform3fv(t.u.uFogColor, opts.fogColor);
    gl.uniform1f(t.u.uFogNear, opts.fogNear);
    gl.uniform1f(t.u.uFogFar, opts.fogFar);
    gl.uniform1f(t.u.uAlpha, 1);

    // Tronçons visibles, triés du plus proche au plus lointain.
    const visible = [];
    for (const [chunk, entry] of this.meshes) {
      const x0 = chunk.cx * CX, z0 = chunk.cz * CZ;
      if (!this.boxVisible(x0, 0, z0, x0 + CX, WORLD_H, z0 + CZ)) continue;
      const dx = x0 + 8 - this.cam.x, dz = z0 + 8 - this.cam.z;
      visible.push({ entry, d: dx * dx + dz * dz });
    }
    visible.sort((a, b) => a.d - b.d);

    this.stats.chunks = visible.length;
    this.stats.quads = 0;
    let draws = 0;

    gl.uniform1i(t.u.uCutout, 0);
    for (const v of visible) {
      const part = v.entry.parts.opaque;
      if (!part || !part.count) continue;
      gl.uniform3fv(t.u.uOrigin, v.entry.origin);
      gl.bindVertexArray(part.vao);
      gl.drawElements(gl.TRIANGLES, part.count, part.type, 0);
      this.stats.quads += part.count / 6; draws++;
    }

    // Feuillages, plantes, verre : test alpha, pas de face arrière supprimée.
    gl.uniform1i(t.u.uCutout, 1);
    gl.disable(gl.CULL_FACE);
    for (const v of visible) {
      const part = v.entry.parts.cutout;
      if (!part || !part.count) continue;
      gl.uniform3fv(t.u.uOrigin, v.entry.origin);
      gl.bindVertexArray(part.vao);
      gl.drawElements(gl.TRIANGLES, part.count, part.type, 0);
      this.stats.quads += part.count / 6; draws++;
    }
    gl.enable(gl.CULL_FACE);
    this.stats.draws = draws;
    this.visibleChunks = visible;
  }

  /** L'eau passe en dernier, du plus lointain au plus proche, en transparence. */
  drawWater(opts) {
    const gl = this.gl;
    const t = this.terrain;
    if (!this.visibleChunks) return;
    gl.useProgram(t.p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    gl.uniform1i(t.u.uCutout, 0);
    gl.uniform1f(t.u.uAlpha, 1);
    const list = [...this.visibleChunks].sort((a, b) => b.d - a.d);
    for (const v of list) {
      const part = v.entry.parts.water;
      if (!part || !part.count) continue;
      gl.uniform3fv(t.u.uOrigin, v.entry.origin);
      gl.bindVertexArray(part.vao);
      gl.drawElements(gl.TRIANGLES, part.count, part.type, 0);
    }
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
  }

  /* ─────────────────────── Cubes, entités, particules ─────────────────────── */

  beginSimple(opts) {
    const gl = this.gl;
    gl.useProgram(this.simple.p);
    gl.uniformMatrix4fv(this.simple.u.uViewProj, false, this.viewProj);
    gl.uniform3f(this.simple.u.uCam, this.cam.x, this.cam.y, this.cam.z);
    gl.uniform3fv(this.simple.u.uFogColor, opts.fogColor);
    gl.uniform1f(this.simple.u.uFogNear, opts.fogNear);
    gl.uniform1f(this.simple.u.uFogFar, opts.fogFar);
    gl.uniform1i(this.simple.u.uFogged, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlas);
    gl.uniform1i(this.simple.u.uAtlas, 0);
  }

  /** Un pavé texturé ou uni, orienté par yaw/pitch. */
  drawBox(px, py, pz, sx, sy, sz, yaw, pitch, color, layer, light) {
    const gl = this.gl;
    composeMatrix(this.model, px, py, pz, yaw, pitch, sx, sy, sz);
    gl.bindVertexArray(this.cubeVAO);
    gl.uniformMatrix4fv(this.simple.u.uModel, false, this.model);
    gl.uniform4fv(this.simple.u.uColor, color);
    gl.uniform1f(this.simple.u.uLight, light);
    gl.uniform1i(this.simple.u.uTextured, layer >= 0 ? 1 : 0);
    if (layer >= 0) gl.uniform1f(this.simple.u.uLayer, layer);
    gl.drawElements(gl.TRIANGLES, this.cubeCount, gl.UNSIGNED_SHORT, 0);
  }

  /** Matrice déjà composée (parties de créature attachées à un corps). */
  drawBoxMatrix(m, color, layer, light) {
    const gl = this.gl;
    gl.bindVertexArray(this.cubeVAO);
    gl.uniformMatrix4fv(this.simple.u.uModel, false, m);
    gl.uniform4fv(this.simple.u.uColor, color);
    gl.uniform1f(this.simple.u.uLight, light);
    gl.uniform1i(this.simple.u.uTextured, layer >= 0 ? 1 : 0);
    if (layer >= 0) gl.uniform1f(this.simple.u.uLayer, layer);
    gl.drawElements(gl.TRIANGLES, this.cubeCount, gl.UNSIGNED_SHORT, 0);
  }

  /** Contour blanc du bloc visé. */
  drawOutline(x, y, z) {
    const gl = this.gl;
    gl.bindVertexArray(this.lineVAO);
    composeMatrix(this.model, x + 0.5, y + 0.5, z + 0.5, 0, 0, 1.002, 1.002, 1.002);
    gl.uniformMatrix4fv(this.simple.u.uModel, false, this.model);
    gl.uniform4f(this.simple.u.uColor, 0, 0, 0, 0.55);
    gl.uniform1i(this.simple.u.uTextured, 0);
    gl.uniform1f(this.simple.u.uLight, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.LINES, 0, this.lineCount);
    gl.disable(gl.BLEND);
  }

  /** Fissures progressives sur le bloc en cours de cassage. */
  drawBreak(x, y, z, progress) {
    const gl = this.gl;
    const stage = Math.min(9, Math.max(0, Math.floor(progress * 10)));
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthFunc(gl.LEQUAL);
    this.drawBox(x + 0.5, y + 0.5, z + 0.5, 1.004, 1.004, 1.004, 0, 0, [1, 1, 1, 1], T(`destroy_${stage}`), 1);
    gl.disable(gl.BLEND);
  }

  /** Particules : petits quadrilatères face caméra, dessinés en un seul appel. */
  drawParticles(list, yaw) {
    if (!list.length) return;
    const gl = this.gl;
    const cy = Math.cos(-yaw), sy = Math.sin(-yaw);
    let n = 0;
    const d = this.dynData;
    for (const p of list) {
      if (n + 6 > 4096) break;
      const s = p.size * 0.5;
      const corners = [[-s, -s], [s, -s], [s, s], [-s, -s], [s, s], [-s, s]];
      const uv = [[0, 1], [1, 1], [1, 0], [0, 1], [1, 0], [0, 0]];
      for (let i = 0; i < 6; i++) {
        const [ox, oy] = corners[i];
        const wx = p.x + ox * cy, wz = p.z - ox * sy;
        const o = n * 6;
        d[o] = wx; d[o + 1] = p.y + oy; d[o + 2] = wz;
        d[o + 3] = uv[i][0] * (p.uvScale ?? 1) + (p.uvOffX ?? 0);
        d[o + 4] = uv[i][1] * (p.uvScale ?? 1) + (p.uvOffY ?? 0);
        d[o + 5] = p.light ?? 1;
        n++;
      }
    }
    gl.bindVertexArray(this.dynVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d.subarray(0, n * 6));
    identity(this.model);
    gl.uniformMatrix4fv(this.simple.u.uModel, false, this.model);
    gl.uniform1i(this.simple.u.uTextured, 1);
    gl.uniform1f(this.simple.u.uLight, 1);
    gl.uniform4f(this.simple.u.uColor, 1, 1, 1, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    // Une couche par particule : on regroupe par texture.
    let start = 0;
    let curLayer = list.length ? list[0].layer : 0;
    const flush = (from, to, layer) => {
      if (to <= from) return;
      gl.uniform1f(this.simple.u.uLayer, layer);
      gl.drawArrays(gl.TRIANGLES, from * 6, (to - from) * 6);
    };
    let i = 0;
    for (; i < Math.floor(n / 6); i++) {
      const layer = list[i].layer;
      if (layer !== curLayer) { flush(start, i, curLayer); start = i; curLayer = layer; }
    }
    flush(start, i, curLayer);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
  }

  /** Nuages : une nappe texturée qui dérive au-dessus du monde. */
  drawClouds(world, time) {
    const gl = this.gl;
    const y = 118;
    const size = 400;
    const drift = time * 0.6;
    const cx = Math.round(this.cam.x / 64) * 64;
    const cz = Math.round(this.cam.z / 64) * 64;
    const d = this.dynData;
    const tiles = 26;
    const step = (size * 2) / tiles;
    let n = 0;
    for (let i = 0; i < tiles; i++) {
      for (let j = 0; j < tiles; j++) {
        if (n + 6 > 4096) break;
        // Une case sur trois est vide : les nuages forment des amas irréguliers.
        const h = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
        if ((h - Math.floor(h)) < 0.42) continue;
        const x0 = cx - size + i * step, z0 = cz - size + j * step;
        const quad = [[x0, z0, 0, 0], [x0 + step, z0, 1, 0], [x0 + step, z0 + step, 1, 1],
          [x0, z0, 0, 0], [x0 + step, z0 + step, 1, 1], [x0, z0 + step, 0, 1]];
        for (const [qx, qz, qu, qv] of quad) {
          const o = n * 6;
          d[o] = qx + drift; d[o + 1] = y; d[o + 2] = qz;
          d[o + 3] = qu; d[o + 4] = qv; d[o + 5] = 1;
          n++;
        }
      }
    }
    gl.bindVertexArray(this.dynVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d.subarray(0, n * 6));
    identity(this.model);
    gl.uniformMatrix4fv(this.simple.u.uModel, false, this.model);
    gl.uniform1i(this.simple.u.uTextured, 1);
    gl.uniform1f(this.simple.u.uLayer, T('cloud'));
    const b = world.skyBrightness();
    gl.uniform4f(this.simple.u.uColor, 1, 1, 1, 0.72);
    gl.uniform1f(this.simple.u.uLight, 0.35 + b * 0.65);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES, 0, n);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
  }

  /** Vue « à la première personne » : l'objet tenu, dessiné par-dessus la scène. */
  drawHeldItem(draw, aspect) {
    const gl = this.gl;
    gl.clear(gl.DEPTH_BUFFER_BIT);
    const saveProj = this.proj, saveVP = this.viewProj, saveView = this.view;
    this.proj = perspective(mat4(), 70 * Math.PI / 180, aspect, 0.01, 10);
    this.view = identity(mat4());
    this.viewProj = multiply(mat4(), this.proj, this.view);
    gl.useProgram(this.simple.p);
    gl.uniformMatrix4fv(this.simple.u.uViewProj, false, this.viewProj);
    gl.uniform3f(this.simple.u.uCam, 0, 0, 0);
    gl.uniform1i(this.simple.u.uFogged, 0);
    draw();
    this.proj = saveProj; this.view = saveView; this.viewProj = saveVP;
  }

  /** Voile de couleur plein écran (sous l'eau, dans la lave, écran rouge de dégâts). */
  drawOverlayColor(color) {
    const gl = this.gl;
    gl.useProgram(this.simple.p);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.dynVAO);
    const d = this.dynData;
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
    for (let i = 0; i < 6; i++) {
      const o = i * 6;
      d[o] = pts[i][0]; d[o + 1] = pts[i][1]; d[o + 2] = 0;
      d[o + 3] = 0; d[o + 4] = 0; d[o + 5] = 1;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d.subarray(0, 36));
    identity(this.model);
    gl.uniformMatrix4fv(this.simple.u.uModel, false, this.model);
    const vp = identity(mat4());
    gl.uniformMatrix4fv(this.simple.u.uViewProj, false, vp);
    gl.uniform1i(this.simple.u.uTextured, 0);
    gl.uniform1i(this.simple.u.uFogged, 0);
    gl.uniform1f(this.simple.u.uLight, 1);
    gl.uniform4fv(this.simple.u.uColor, color);
    gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }
}
