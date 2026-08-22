/**
 * Rendu : ciel procédural, ombres portées directionnelles, brouillard,
 * géométrie statique découpée en tuiles, objets dynamiques instanciés,
 * océan animé, particules et traceurs.
 */
import { compile, Geo, upload } from './gl.js';
import { m4, m4mul, m4perspective, m4ortho, m4lookAt, frustumFromVP, aabbInFrustum } from './math.js';

const COMMON_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNorm;
layout(location=2) in vec4 aCol;
layout(location=3) in vec4 iM0;
layout(location=4) in vec4 iM1;
layout(location=5) in vec4 iM2;
layout(location=6) in vec4 iM3;
layout(location=7) in vec4 iCol;
`;

const SCENE_VS = COMMON_VS + `
uniform mat4 uVP;
uniform mat4 uLightVP;
out vec3 vNorm;
out vec4 vCol;
out vec3 vWorld;
out vec4 vLight;
void main() {
  mat4 M = mat4(iM0, iM1, iM2, iM3);
  vec4 wp = M * vec4(aPos, 1.0);
  vWorld = wp.xyz;
  vNorm = normalize(mat3(M) * aNorm);
  vCol = vec4(aCol.rgb * iCol.rgb, aCol.a * iCol.a);
  vLight = uLightVP * wp;
  gl_Position = uVP * wp;
}`;

const SCENE_FS = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vNorm;
in vec4 vCol;
in vec3 vWorld;
in vec4 vLight;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uFogColor;
uniform vec3 uEye;
uniform float uFogDensity;
uniform float uSpec;
uniform float uEmit;
uniform float uShadowTexel;
uniform float uAlpha;
uniform sampler2DShadow uShadow;
out vec4 fragColor;

vec3 tonemap(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

float shadowAt() {
  vec3 p = vLight.xyz / vLight.w;
  p = p * 0.5 + 0.5;                    // repère de la carte d'ombres
  if (p.z > 1.0 || p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return 1.0;
  float ndl = max(dot(vNorm, uSunDir), 0.0);
  float bias = 0.0016 + 0.004 * (1.0 - ndl);
  float s = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y)) * uShadowTexel;
      s += texture(uShadow, vec3(p.xy + o, p.z - bias));
    }
  }
  return s / 9.0;
}

void main() {
  vec3 n = normalize(vNorm);
  vec3 base = vCol.rgb;
  float sh = shadowAt();
  float ndl = max(dot(n, uSunDir), 0.0);
  vec3 amb = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
  // lumière rasante de rebond : les façades à l'ombre ne virent pas au noir
  float bounce = max(dot(n, normalize(vec3(-uSunDir.x, 0.35, -uSunDir.z))), 0.0) * 0.22;
  vec3 col = base * (amb + uSunColor * (ndl * sh + bounce * 0.5));
  vec3 viewDir = normalize(uEye - vWorld);
  if (uSpec > 0.0) {
    vec3 h = normalize(uSunDir + viewDir);
    float s = pow(max(dot(n, h), 0.0), 48.0) * uSpec * sh;
    col += uSunColor * s;
    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 4.0) * uSpec * 0.6;
    col += uSkyColor * fres;
  }
  // Émission : alpha positif = la surface rayonne sa propre teinte (feux,
  // néons) ; alpha négatif = fenêtre allumée, lumière chaude d'intérieur.
  float e = vCol.a;
  vec3 emis = e >= 0.0 ? base : vec3(1.0, 0.80, 0.48);
  col += emis * abs(e) * (0.28 + uEmit * 1.6);
  float d = length(vWorld - uEye);
  float f = 1.0 - exp(-pow(d * uFogDensity, 2.0));
  col = mix(col, uFogColor, clamp(f, 0.0, 1.0));
  // étalonnage « soleil de Los Santos » : ACES simplifié, saturation légère
  col = tonemap(col * 1.28);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, 1.14);
  fragColor = vec4(pow(max(col, 0.0), vec3(0.4545)), vCol.a * 0.0 + uAlpha);
}`;

const DEPTH_VS = COMMON_VS + `
uniform mat4 uVP;
void main() {
  mat4 M = mat4(iM0, iM1, iM2, iM3);
  gl_Position = uVP * (M * vec4(aPos, 1.0));
}`;

const DEPTH_FS = `#version 300 es
precision highp float;
void main() {}`;

const SKY_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
uniform mat4 uInvVP;
uniform vec3 uEye;
out vec3 vDir;
void main() {
  vec4 p = uInvVP * vec4(aPos, 1.0, 1.0);
  vDir = p.xyz / p.w - uEye;
  gl_Position = vec4(aPos, 1.0, 1.0);
}`;

const SKY_FS = `#version 300 es
precision highp float;
in vec3 vDir;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uFogColor;
uniform float uTime;
uniform float uNight;
out vec4 fragColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
vec3 tonemap(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}


void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -1.0, 1.0);
  vec3 sky = mix(uSkyHorizon, uSkyTop, pow(max(h, 0.0), 0.55));
  sky = mix(uFogColor, sky, smoothstep(-0.06, 0.22, h));
  float sun = max(dot(d, uSunDir), 0.0);
  sky += uSunColor * pow(sun, 220.0) * 12.0;             // disque
  sky += uSunColor * pow(sun, 6.0) * 0.35;               // halo
  float starMask = smoothstep(0.35, 0.85, uNight);
  if (starMask > 0.01 && h > 0.0) {                       // étoiles
    vec2 sp = d.xz / max(d.y + 0.25, 0.05) * 9.0;
    float st = pow(hash(floor(sp * 3.0)), 120.0);
    sky += vec3(0.85, 0.9, 1.0) * st * starMask * 3.0 * smoothstep(0.0, 0.25, h);
    sky += vec3(0.92, 0.94, 1.0) * pow(sun, 1400.0) * 26.0 * starMask;   // lune
    sky += vec3(0.55, 0.62, 0.85) * pow(sun, 12.0) * 0.16 * starMask;
  }
  if (h > 0.008) {                                        // nuages
    vec2 uv = d.xz / d.y * 0.05 + vec2(uTime * 0.0035, uTime * 0.0016);
    float c = fbm(uv * 1.6);
    c = smoothstep(0.48, 0.92, c) * smoothstep(0.01, 0.2, h);
    vec3 cloudCol = mix(vec3(0.30, 0.33, 0.42), vec3(1.05, 1.0, 0.97), 1.0 - uNight * 0.85);
    cloudCol += uSunColor * pow(sun, 4.0) * 0.5;
    sky = mix(sky, cloudCol, c * 0.85);
  }
  sky = tonemap(sky * 1.18);
  fragColor = vec4(pow(max(sky, 0.0), vec3(0.4545)), 1.0);
}`;

const WATER_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
uniform mat4 uVP;
uniform float uTime;
uniform vec2 uCenter;
uniform float uShore;
out vec3 vWorld;
out vec3 vNorm;
void main() {
  vec3 p = aPos;
  p.x += uCenter.x; p.z += uCenter.y;
  p.y -= 0.35;                       // le plan d'eau passe sous la plage
  float w1 = sin(p.x * 0.055 + uTime * 1.1) * 0.34;
  float w2 = sin(p.z * 0.085 - uTime * 0.85) * 0.24;
  float w3 = sin((p.x + p.z) * 0.03 + uTime * 0.6) * 0.42;
  p.y += w1 + w2 + w3;
  float dx = cos(p.x * 0.055 + uTime * 1.1) * 0.34 * 0.055 + cos((p.x + p.z) * 0.03 + uTime * 0.6) * 0.42 * 0.03;
  float dz = cos(p.z * 0.085 - uTime * 0.85) * 0.24 * 0.085 + cos((p.x + p.z) * 0.03 + uTime * 0.6) * 0.42 * 0.03;
  vNorm = normalize(vec3(-dx, 1.0, -dz));
  if (p.x > uShore) p.y -= 60.0;     // pas de mer sous la ville
  vWorld = p;
  gl_Position = uVP * vec4(p, 1.0);
}`;

const WATER_FS = `#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vNorm;
uniform vec3 uEye;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uFogColor;
uniform vec3 uDeep;
uniform float uFogDensity;
out vec4 fragColor;

vec3 tonemap(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec3 n = normalize(vNorm);
  vec3 v = normalize(uEye - vWorld);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 col = mix(uDeep, uSkyColor * 1.15, clamp(fres * 1.6, 0.0, 1.0));
  vec3 h = normalize(uSunDir + v);
  col += uSunColor * pow(max(dot(n, h), 0.0), 220.0) * 2.6;
  col += uSunColor * pow(max(dot(n, h), 0.0), 18.0) * 0.16;
  float d = length(vWorld - uEye);
  col = mix(col, uFogColor, clamp(1.0 - exp(-pow(d * uFogDensity, 2.0)), 0.0, 1.0));
  col = tonemap(col * 1.28);
  fragColor = vec4(pow(max(col, 0.0), vec3(0.4545)), 1.0);
}`;

const PART_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aQuad;
layout(location=1) in vec4 iPos;   // xyz + taille
layout(location=2) in vec4 iCol;   // rgba
uniform mat4 uVP;
uniform vec3 uRight;
uniform vec3 uUp;
out vec2 vUv;
out vec4 vCol;
void main() {
  // taille négative : le quad est posé à plat sur le sol (flaque de lumière)
  vec3 wp = iPos.w < 0.0
    ? iPos.xyz + vec3(aQuad.x * -iPos.w, 0.0, aQuad.y * -iPos.w)
    : iPos.xyz + (uRight * aQuad.x + uUp * aQuad.y) * iPos.w;
  vUv = aQuad;
  vCol = iCol;
  gl_Position = uVP * vec4(wp, 1.0);
}`;

const PART_FS = `#version 300 es
precision highp float;
in vec2 vUv;
in vec4 vCol;
out vec4 fragColor;
void main() {
  float d = length(vUv) * 2.0;
  float a = smoothstep(1.0, 0.15, d) * vCol.a;
  if (a < 0.01) discard;
  fragColor = vec4(vCol.rgb, a);
}`;

const LINE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec4 aCol;
uniform mat4 uVP;
out vec4 vCol;
void main() { vCol = aCol; gl_Position = uVP * vec4(aPos, 1.0); }`;

const LINE_FS = `#version 300 es
precision highp float;
in vec4 vCol;
out vec4 fragColor;
void main() { fragColor = vCol; }`;

const SHADOW_SIZE = 2048;
const MAX_INSTANCES = 6000;
const MAX_PARTICLES = 3000;
const MAX_LINES = 2000;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      antialias: true, alpha: false, depth: true, powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 indisponible');
    this.gl = gl;
    this.scene = compile(gl, SCENE_VS, SCENE_FS, 'scene');
    this.depth = compile(gl, DEPTH_VS, DEPTH_FS, 'depth');
    this.sky = compile(gl, SKY_VS, SKY_FS, 'sky');
    this.water = compile(gl, WATER_VS, WATER_FS, 'water');
    this.part = compile(gl, PART_VS, PART_FS, 'particles');
    this.lineP = compile(gl, LINE_VS, LINE_FS, 'lines');

    this.view = m4(); this.proj = m4(); this.vp = m4(); this.invVP = m4();
    this.lightVP = m4(); this.tmp = m4();
    this.planes = new Float32Array(24);
    this.lightPlanes = new Float32Array(24);
    this.eye = [0, 0, 0];
    this.renderScale = 1;
    this.shadowsOn = true;
    this.drawCalls = 0;
    this.trisDrawn = 0;

    this.chunks = [];
    this.buildPrimitives();
    this.buildSky();
    this.buildWater();
    this.buildShadowMap();
    this.buildParticles();
    this.buildLines();

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0.6, 0.75, 0.9, 1);
  }

  /* ------------------------------------------------------- initialisation GPU */

  buildPrimitives() {
    const gl = this.gl;
    const white = [1, 1, 1];
    const cube = new Geo(); cube.box(0, 0, 0, 1, 1, 1, white, 0, { emit: 1, emitTop: 1 });
    const cyl = new Geo(); cyl.cyl(0, -0.5, 0, 0.5, 1, white, 12, 0.5, 1);
    const sph = new Geo(); sph.sphere(0, 0, 0, 0.5, white, 10, 6, 1);
    const cone = new Geo(); cone.cone(0, -0.5, 0, 0.5, 1, white, 10, 1);
    const ring = new Geo(); ring.cyl(0, 0, 0, 0.5, 1, white, 18, 0.5, 1);
    this.prims = {
      cube: upload(gl, cube, true),
      cyl: upload(gl, cyl, true),
      sphere: upload(gl, sph, true),
      cone: upload(gl, cone, true),
      marker: upload(gl, ring, true),
    };
    this.instData = {};
    this.instBufs = {};
    for (const k of Object.keys(this.prims)) {
      this.instData[k] = { opaque: new Float32Array(MAX_INSTANCES * 20), n: 0, alpha: new Float32Array(1200 * 20), na: 0 };
    }
  }

  buildSky() {
    const gl = this.gl;
    this.skyVao = gl.createVertexArray();
    gl.bindVertexArray(this.skyVao);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  buildWater() {
    const gl = this.gl;
    const N = 96, S = 42; // 96 x 96 quads de 42 m : ~4 km de mer autour du joueur
    const verts = [], idx = [];
    for (let z = 0; z <= N; z++) {
      for (let x = 0; x <= N; x++) {
        verts.push((x - N / 2) * S, 0, (z - N / 2) * S);
      }
    }
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        const a = z * (N + 1) + x;
        idx.push(a, a + N + 1, a + 1, a + 1, a + N + 1, a + N + 2);
      }
    }
    this.waterVao = gl.createVertexArray();
    gl.bindVertexArray(this.waterVao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.waterCount = idx.length;
  }

  buildShadowMap() {
    const gl = this.gl;
    this.shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SHADOW_SIZE, SHADOW_SIZE, 0,
      gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.shadowFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  buildParticles() {
    const gl = this.gl;
    this.partVao = gl.createVertexArray();
    gl.bindVertexArray(this.partVao);
    const q = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, q);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.partBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_PARTICLES * 32, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
    this.partData = new Float32Array(MAX_PARTICLES * 8);
    this.partN = 0;

    // deuxième lot, additif : halos des lampadaires, phares et néons
    this.glowVao = gl.createVertexArray();
    gl.bindVertexArray(this.glowVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, q);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.glowBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowBuf);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_PARTICLES * 32, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
    this.glowData = new Float32Array(MAX_PARTICLES * 8);
    this.glowN = 0;
  }

  buildLines() {
    const gl = this.gl;
    this.lineVao = gl.createVertexArray();
    gl.bindVertexArray(this.lineVao);
    this.lineBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_LINES * 2 * 28, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
    gl.bindVertexArray(null);
    this.lineData = new Float32Array(MAX_LINES * 14);
    this.lineN = 0;
  }

  /** Enregistre la géométrie statique du monde (liste de {geo, key}). */
  setStatic(chunks) {
    const gl = this.gl;
    for (const c of this.chunks) {
      gl.deleteVertexArray(c.mesh.vao);
      gl.deleteBuffer(c.mesh.vbo);
      gl.deleteBuffer(c.mesh.ebo);
    }
    this.chunks = chunks.filter((c) => !c.geo.empty).map((c) => {
      const mesh = upload(gl, c.geo, false);
      const cx = (mesh.min[0] + mesh.max[0]) / 2, cy = (mesh.min[1] + mesh.max[1]) / 2, cz = (mesh.min[2] + mesh.max[2]) / 2;
      return {
        mesh,
        cx, cy, cz,
        ex: (mesh.max[0] - mesh.min[0]) / 2 + 0.5,
        ey: (mesh.max[1] - mesh.min[1]) / 2 + 0.5,
        ez: (mesh.max[2] - mesh.min[2]) / 2 + 0.5,
        spec: c.spec || 0,
      };
    });
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.renderScale;
    const w = Math.max(320, Math.floor(this.canvas.clientWidth * dpr));
    const h = Math.max(240, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
    }
    this.aspect = w / h;
  }

  /* -------------------------------------------------------------- collecte */

  begin(cam, env) {
    this.resize();
    this.env = env;
    this.eye = cam.eye;
    m4perspective(this.proj, cam.fov, this.aspect, 0.45, 2400);
    m4lookAt(this.view, cam.eye, cam.target, [0, 1, 0]);
    m4mul(this.vp, this.proj, this.view);
    frustumFromVP(this.vp, this.planes);
    invert(this.invVP, this.vp);
    for (const k of Object.keys(this.instData)) { this.instData[k].n = 0; this.instData[k].na = 0; }
    this.partN = 0;
    this.glowN = 0;
    this.lineN = 0;
    this.drawCalls = 0;
    this.trisDrawn = 0;
    // Repère de la lumière, centré devant le joueur
    const s = this.env.shadowRange || 90;
    const d = env.sunDir;
    const fx = cam.focus ? cam.focus[0] : cam.target[0];
    const fy = cam.focus ? cam.focus[1] : cam.target[1];
    const fz = cam.focus ? cam.focus[2] : cam.target[2];
    const lv = m4(), lp = m4();
    m4lookAt(lv, [fx + d[0] * 300, fy + d[1] * 300, fz + d[2] * 300], [fx, fy, fz], [0, 1, 0]);
    m4ortho(lp, -s, s, -s, s, 1, 620);
    m4mul(this.lightVP, lp, lv);
    frustumFromVP(this.lightVP, this.lightPlanes);
    this.shadowCenter = [fx, fy, fz];
    this.shadowRange = s;
  }

  push(kind, m, r, g, b, emit = 0, alpha = 1) {
    const d = this.instData[kind];
    if (!d) return;
    const arr = alpha < 1 ? d.alpha : d.opaque;
    const n = alpha < 1 ? d.na : d.n;
    const cap = alpha < 1 ? 1200 : MAX_INSTANCES;
    if (n >= cap) return;
    const o = n * 20;
    arr.set(m, o);
    arr[o + 16] = r; arr[o + 17] = g; arr[o + 18] = b; arr[o + 19] = emit;
    if (alpha < 1) d.na++; else d.n++;
  }

  cube(m, c, emit = 0) { this.push('cube', m, c[0], c[1], c[2], emit); }
  cyl(m, c, emit = 0) { this.push('cyl', m, c[0], c[1], c[2], emit); }
  sphere(m, c, emit = 0) { this.push('sphere', m, c[0], c[1], c[2], emit); }
  cone(m, c, emit = 0) { this.push('cone', m, c[0], c[1], c[2], emit); }
  ghost(kind, m, c, emit = 0) { this.push(kind, m, c[0], c[1], c[2], emit, 0.5); }

  particle(x, y, z, size, r, g, b, a) {
    if (this.partN >= MAX_PARTICLES) return;
    const o = this.partN * 8;
    const d = this.partData;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = size;
    d[o + 4] = r; d[o + 5] = g; d[o + 6] = b; d[o + 7] = a;
    this.partN++;
  }

  /** Halo lumineux additif, orienté face à la caméra. */
  glow(x, y, z, size, r, g, b, a) {
    if (this.glowN >= MAX_PARTICLES) return;
    const o = this.glowN * 8;
    const d = this.glowData;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = size;
    d[o + 4] = r; d[o + 5] = g; d[o + 6] = b; d[o + 7] = a;
    this.glowN++;
  }

  /** Flaque de lumière posée au sol. */
  glowGround(x, y, z, size, r, g, b, a) { this.glow(x, y, z, -size, r, g, b, a); }

  line(x1, y1, z1, x2, y2, z2, r, g, b, a) {
    if (this.lineN >= MAX_LINES) return;
    const o = this.lineN * 14;
    const d = this.lineData;
    d[o] = x1; d[o + 1] = y1; d[o + 2] = z1; d[o + 3] = r; d[o + 4] = g; d[o + 5] = b; d[o + 6] = a;
    d[o + 7] = x2; d[o + 8] = y2; d[o + 9] = z2; d[o + 10] = r; d[o + 11] = g; d[o + 12] = b; d[o + 13] = a;
    this.lineN++;
  }

  /* ----------------------------------------------------------------- rendu */

  setSceneUniforms(p, spec, emitBoost, alpha = 1) {
    const gl = this.gl, e = this.env;
    gl.uniformMatrix4fv(p.u.uVP, false, this.vp);
    gl.uniformMatrix4fv(p.u.uLightVP, false, this.lightVP);
    gl.uniform3fv(p.u.uSunDir, e.sunDir);
    gl.uniform3fv(p.u.uSunColor, e.sunColor);
    gl.uniform3fv(p.u.uSkyColor, e.ambSky);
    gl.uniform3fv(p.u.uGroundColor, e.ambGround);
    gl.uniform3fv(p.u.uFogColor, e.fogColor);
    gl.uniform3fv(p.u.uEye, this.eye);
    gl.uniform1f(p.u.uFogDensity, e.fogDensity);
    gl.uniform1f(p.u.uSpec, spec);
    gl.uniform1f(p.u.uEmit, emitBoost);
    gl.uniform1f(p.u.uAlpha, alpha);
    gl.uniform1f(p.u.uShadowTexel, 1 / SHADOW_SIZE);
    gl.uniform1i(p.u.uShadow, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
  }

  identityAttribs() {
    const gl = this.gl;
    gl.vertexAttrib4f(3, 1, 0, 0, 0);
    gl.vertexAttrib4f(4, 0, 1, 0, 0);
    gl.vertexAttrib4f(5, 0, 0, 1, 0);
    gl.vertexAttrib4f(6, 0, 0, 0, 1);
    gl.vertexAttrib4f(7, 1, 1, 1, 1);
  }

  uploadInstances() {
    const gl = this.gl;
    for (const k of Object.keys(this.prims)) {
      const d = this.instData[k];
      if (d.n) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.prims[k].instBuf);
        gl.bufferData(gl.ARRAY_BUFFER, d.opaque.subarray(0, d.n * 20), gl.DYNAMIC_DRAW);
      }
    }
  }

  drawInstanced(prog, alphaPass = false) {
    const gl = this.gl;
    for (const k of Object.keys(this.prims)) {
      const d = this.instData[k];
      const n = alphaPass ? d.na : d.n;
      if (!n) continue;
      const p = this.prims[k];
      gl.bindVertexArray(p.vao);
      if (alphaPass) {
        gl.bindBuffer(gl.ARRAY_BUFFER, p.instBuf);
        gl.bufferData(gl.ARRAY_BUFFER, d.alpha.subarray(0, n * 20), gl.DYNAMIC_DRAW);
      }
      gl.drawElementsInstanced(gl.TRIANGLES, p.count, p.type, 0, n);
      this.drawCalls++;
      this.trisDrawn += (p.count / 3) * n;
    }
    gl.bindVertexArray(null);
  }

  shadowPass() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.cullFace(gl.FRONT);
    this.depth.use();
    gl.uniformMatrix4fv(this.depth.u.uVP, false, this.lightVP);
    this.identityAttribs();
    const c = this.shadowCenter, r = this.shadowRange * 1.6;
    for (const ch of this.chunks) {
      if (Math.abs(ch.cx - c[0]) - ch.ex > r || Math.abs(ch.cz - c[2]) - ch.ez > r) continue;
      gl.bindVertexArray(ch.mesh.vao);
      gl.drawElements(gl.TRIANGLES, ch.mesh.count, ch.mesh.type, 0);
      this.drawCalls++;
    }
    this.uploadInstances();
    this.drawInstanced(this.depth, false);
    gl.cullFace(gl.BACK);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  end() {
    const gl = this.gl;
    const e = this.env;
    if (this.shadowsOn) this.shadowPass(); else this.uploadInstances();

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Ciel
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);
    this.sky.use();
    gl.uniformMatrix4fv(this.sky.u.uInvVP, false, this.invVP);
    gl.uniform3fv(this.sky.u.uEye, this.eye);
    gl.uniform3fv(this.sky.u.uSunDir, e.sunDir);
    gl.uniform3fv(this.sky.u.uSunColor, e.sunColor);
    gl.uniform3fv(this.sky.u.uSkyTop, e.skyTop);
    gl.uniform3fv(this.sky.u.uSkyHorizon, e.skyHorizon);
    gl.uniform3fv(this.sky.u.uFogColor, e.fogColor);
    gl.uniform1f(this.sky.u.uTime, e.time);
    gl.uniform1f(this.sky.u.uNight, e.night);
    gl.bindVertexArray(this.skyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);

    // Monde statique
    this.scene.use();
    this.setSceneUniforms(this.scene, 0.06, e.emitBoost);
    this.identityAttribs();
    const p = this.planes;
    for (const ch of this.chunks) {
      if (!aabbInFrustum(p, ch.cx, ch.cy, ch.cz, ch.ex, ch.ey, ch.ez)) continue;
      gl.bindVertexArray(ch.mesh.vao);
      gl.drawElements(gl.TRIANGLES, ch.mesh.count, ch.mesh.type, 0);
      this.drawCalls++;
      this.trisDrawn += ch.mesh.count / 3;
    }

    // Objets dynamiques (véhicules, piétons, accessoires)
    gl.uniform1f(this.scene.u.uSpec, 0.5);
    this.drawInstanced(this.scene, false);

    // Océan
    if (e.water) {
      this.water.use();
      gl.uniformMatrix4fv(this.water.u.uVP, false, this.vp);
      gl.uniform1f(this.water.u.uTime, e.time);
      gl.uniform2f(this.water.u.uCenter, Math.round(this.eye[0] / 42) * 42, Math.round(this.eye[2] / 42) * 42);
      gl.uniform1f(this.water.u.uShore, e.shoreX !== undefined ? e.shoreX : -740);
      gl.uniform3fv(this.water.u.uEye, this.eye);
      gl.uniform3fv(this.water.u.uSunDir, e.sunDir);
      gl.uniform3fv(this.water.u.uSunColor, e.sunColor);
      gl.uniform3fv(this.water.u.uSkyColor, e.ambSky);
      gl.uniform3fv(this.water.u.uFogColor, e.fogColor);
      gl.uniform3fv(this.water.u.uDeep, e.waterDeep);
      gl.uniform1f(this.water.u.uFogDensity, e.fogDensity);
      gl.bindVertexArray(this.waterVao);
      gl.drawElements(gl.TRIANGLES, this.waterCount, gl.UNSIGNED_INT, 0);
      this.drawCalls++;
    }

    // Transparences : marqueurs de mission
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    this.scene.use();
    this.setSceneUniforms(this.scene, 0, e.emitBoost, 0.42);
    gl.disable(gl.CULL_FACE);
    this.drawInstanced(this.scene, true);
    gl.enable(gl.CULL_FACE);

    // Traceurs de balles
    if (this.lineN) {
      this.lineP.use();
      gl.uniformMatrix4fv(this.lineP.u.uVP, false, this.vp);
      gl.bindVertexArray(this.lineVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.lineData.subarray(0, this.lineN * 14));
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.drawArrays(gl.LINES, 0, this.lineN * 2);
      this.drawCalls++;
    }

    // Halos lumineux (additifs) : d'abord, pour rester sous les impacts
    if (this.glowN) {
      this.part.use();
      gl.uniformMatrix4fv(this.part.u.uVP, false, this.vp);
      const v = this.view;
      gl.uniform3f(this.part.u.uRight, v[0], v[4], v[8]);
      gl.uniform3f(this.part.u.uUp, v[1], v[5], v[9]);
      gl.bindVertexArray(this.glowVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.glowBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.glowData.subarray(0, this.glowN * 8));
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.glowN);
      this.drawCalls++;
    }

    // Particules
    if (this.partN) {
      this.part.use();
      gl.uniformMatrix4fv(this.part.u.uVP, false, this.vp);
      const v = this.view;
      gl.uniform3f(this.part.u.uRight, v[0], v[4], v[8]);
      gl.uniform3f(this.part.u.uUp, v[1], v[5], v[9]);
      gl.bindVertexArray(this.partVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.partData.subarray(0, this.partN * 8));
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.partN);
      this.drawCalls++;
    }

    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }
}

/** Inversion de matrice 4x4 (pour le rayon du ciel). */
export function invert(o, m) {
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return o;
  det = 1 / det;
  o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return o;
}
