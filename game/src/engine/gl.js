/**
 * Couche WebGL2 : compilation des programmes, construction et envoi des maillages.
 * Format de sommet unique pour tout le jeu :
 *   position(3) + normale(3) + couleur(3) + émissif(1) = 10 flottants.
 */

export function createContext(canvas) {
  const gl = canvas.getContext('webgl2', {
    antialias: true, alpha: false, depth: true, stencil: false,
    powerPreference: 'high-performance', preserveDrawingBuffer: false,
  });
  if (!gl) throw new Error('WebGL2 indisponible');
  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');
  return gl;
}

export function compile(gl, vsSrc, fsSrc, name = 'program') {
  const mk = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      console.error(`[${name}] ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'}\n${log}`);
      throw new Error(`Shader ${name}: ${log}`);
    }
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`Link ${name}: ${gl.getProgramInfoLog(p)}`);
  }
  const u = new Proxy({}, {
    get(cache, key) {
      if (!(key in cache)) cache[key] = gl.getUniformLocation(p, key);
      return cache[key];
    },
  });
  return { program: p, u, use: () => gl.useProgram(p) };
}

export const VERTEX_FLOATS = 10;

/** Accumulateur de géométrie : on empile des primitives, puis on téléverse. */
export class Geo {
  constructor() {
    this.v = [];
    this.i = [];
    this.count = 0;
    this.min = [1e9, 1e9, 1e9];
    this.max = [-1e9, -1e9, -1e9];
  }

  vert(x, y, z, nx, ny, nz, c, e = 0) {
    this.v.push(x, y, z, nx, ny, nz, c[0], c[1], c[2], e);
    if (x < this.min[0]) this.min[0] = x; if (x > this.max[0]) this.max[0] = x;
    if (y < this.min[1]) this.min[1] = y; if (y > this.max[1]) this.max[1] = y;
    if (z < this.min[2]) this.min[2] = z; if (z > this.max[2]) this.max[2] = z;
    return this.count++;
  }

  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }

  /** Quadrilatère libre défini par 4 points (sens antihoraire vu de la normale). */
  face(p0, p1, p2, p3, c, e = 0) {
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const a = this.vert(p0[0], p0[1], p0[2], nx, ny, nz, c, e);
    const b = this.vert(p1[0], p1[1], p1[2], nx, ny, nz, c, e);
    const d = this.vert(p2[0], p2[1], p2[2], nx, ny, nz, c, e);
    const f = this.vert(p3[0], p3[1], p3[2], nx, ny, nz, c, e);
    this.quad(a, b, d, f);
  }

  /**
   * Boîte centrée en (x,y,z), dimensions (sx,sy,sz), tournée de ry autour de Y.
   * opts : { top, side, emit, emitTop, noBottom }
   */
  box(x, y, z, sx, sy, sz, c, ry = 0, opts = {}) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const co = Math.cos(ry), si = Math.sin(ry);
    const P = (lx, ly, lz) => [x + lx * co + lz * si, y + ly, z - lx * si + lz * co];
    const N = (nx, nz) => [nx * co + nz * si, -nx * si + nz * co];
    const top = opts.top || c;
    const side = opts.side || c;
    const emit = opts.emit || 0;
    const a = P(-hx, -hy, -hz), b = P(hx, -hy, -hz), d = P(hx, hy, -hz), e = P(-hx, hy, -hz);
    const f = P(-hx, -hy, hz), g = P(hx, -hy, hz), h = P(hx, hy, hz), i = P(-hx, hy, hz);
    const push = (p0, p1, p2, p3, nx, ny, nz, col, em) => {
      const i0 = this.vert(p0[0], p0[1], p0[2], nx, ny, nz, col, em);
      const i1 = this.vert(p1[0], p1[1], p1[2], nx, ny, nz, col, em);
      const i2 = this.vert(p2[0], p2[1], p2[2], nx, ny, nz, col, em);
      const i3 = this.vert(p3[0], p3[1], p3[2], nx, ny, nz, col, em);
      this.quad(i0, i1, i2, i3);
    };
    let n = N(0, -1); push(b, a, e, d, n[0], 0, n[1], side, emit);      // -Z
    n = N(0, 1); push(f, g, h, i, n[0], 0, n[1], side, emit);           // +Z
    n = N(-1, 0); push(a, f, i, e, n[0], 0, n[1], side, emit);          // -X
    n = N(1, 0); push(g, b, d, h, n[0], 0, n[1], side, emit);           // +X
    push(e, i, h, d, 0, 1, 0, top, opts.emitTop !== undefined ? opts.emitTop : 0); // haut
    if (!opts.noBottom) push(a, b, g, f, 0, -1, 0, opts.bottom || side, 0);        // bas
  }

  /** Dalle horizontale (route, trottoir, marquage). */
  slab(x, z, w, d, y, c, ry = 0, e = 0) {
    const hx = w / 2, hz = d / 2;
    const co = Math.cos(ry), si = Math.sin(ry);
    const P = (lx, lz) => [x + lx * co + lz * si, y, z - lx * si + lz * co];
    const a = this.vert(...P(-hx, -hz), 0, 1, 0, c, e);
    const b = this.vert(...P(hx, -hz), 0, 1, 0, c, e);
    const cc = this.vert(...P(hx, hz), 0, 1, 0, c, e);
    const d2 = this.vert(...P(-hx, hz), 0, 1, 0, c, e);
    this.quad(a, d2, cc, b);
  }

  /** Cylindre vertical (poteau, tronc, roue si tourné). */
  cyl(x, y, z, r, h, c, seg = 8, rTop = r, emit = 0) {
    const base = this.count;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const nx = Math.cos(a), nz = Math.sin(a);
      this.vert(x + nx * r, y, z + nz * r, nx, 0, nz, c, emit);
      this.vert(x + nx * rTop, y + h, z + nz * rTop, nx, 0, nz, c, emit);
    }
    for (let i = 0; i < seg; i++) {
      const a = base + i * 2, b = base + ((i + 1) % seg) * 2;
      this.quad(a, a + 1, b + 1, b);
    }
    const capC = this.vert(x, y + h, z, 0, 1, 0, c, emit);
    const capStart = this.count;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      this.vert(x + Math.cos(a) * rTop, y + h, z + Math.sin(a) * rTop, 0, 1, 0, c, emit);
    }
    for (let i = 0; i < seg; i++) this.tri(capC, capStart + ((i + 1) % seg), capStart + i);
  }

  /** Cône / pyramide (montagnes, toits, sapins). */
  cone(x, y, z, r, h, c, seg = 6, emit = 0) {
    const tip = this.vert(x, y + h, z, 0, 1, 0, c, emit);
    const base = this.count;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const nx = Math.cos(a), nz = Math.sin(a);
      this.vert(x + nx * r, y, z + nz * r, nx * 0.7, 0.5, nz * 0.7, c, emit);
    }
    for (let i = 0; i < seg; i++) this.tri(tip, base + ((i + 1) % seg), base + i);
  }

  /** Sphère basse résolution (dômes, têtes, explosions). */
  sphere(x, y, z, r, c, seg = 8, rings = 5, emit = 0) {
    const base = this.count;
    for (let j = 0; j <= rings; j++) {
      const phi = (j / rings) * Math.PI;
      for (let i = 0; i <= seg; i++) {
        const th = (i / seg) * Math.PI * 2;
        const nx = Math.sin(phi) * Math.cos(th), ny = Math.cos(phi), nz = Math.sin(phi) * Math.sin(th);
        this.vert(x + nx * r, y + ny * r, z + nz * r, nx, ny, nz, c, emit);
      }
    }
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < seg; i++) {
        const a = base + j * (seg + 1) + i;
        this.quad(a, a + 1, a + seg + 2, a + seg + 1);
      }
    }
  }

  /** Prisme triangulaire (toit à deux pans), faîte le long de X. */
  roof(x, y, z, sx, sy, sz, c, ry = 0) {
    const hx = sx / 2, hz = sz / 2;
    const co = Math.cos(ry), si = Math.sin(ry);
    const P = (lx, ly, lz) => [x + lx * co + lz * si, y + ly, z - lx * si + lz * co];
    const a = P(-hx, 0, -hz), b = P(hx, 0, -hz), c2 = P(hx, 0, hz), d = P(-hx, 0, hz);
    const e = P(-hx, sy, 0), f = P(hx, sy, 0);
    this.face(a, b, f, e, c);
    this.face(c2, d, e, f, c);
    const t1 = this.vert(a[0], a[1], a[2], -co, 0, si, c);
    const t2 = this.vert(d[0], d[1], d[2], -co, 0, si, c);
    const t3 = this.vert(e[0], e[1], e[2], -co, 0, si, c);
    this.tri(t1, t2, t3);
    const u1 = this.vert(b[0], b[1], b[2], co, 0, -si, c);
    const u2 = this.vert(f[0], f[1], f[2], co, 0, -si, c);
    const u3 = this.vert(c2[0], c2[1], c2[2], co, 0, -si, c);
    this.tri(u1, u2, u3);
  }

  merge(other, dx = 0, dy = 0, dz = 0) {
    const base = this.count;
    const src = other.v;
    for (let i = 0; i < src.length; i += VERTEX_FLOATS) {
      const x = src[i] + dx, y = src[i + 1] + dy, z = src[i + 2] + dz;
      this.v.push(x, y, z);
      for (let k = 3; k < VERTEX_FLOATS; k++) this.v.push(src[i + k]);
      if (x < this.min[0]) this.min[0] = x; if (x > this.max[0]) this.max[0] = x;
      if (y < this.min[1]) this.min[1] = y; if (y > this.max[1]) this.max[1] = y;
      if (z < this.min[2]) this.min[2] = z; if (z > this.max[2]) this.max[2] = z;
    }
    for (const idx of other.i) this.i.push(idx + base);
    this.count += other.count;
  }

  get empty() { return this.i.length === 0; }
}

/** Téléverse une Geo en VAO prêt à dessiner. */
export function upload(gl, geo, instanced = false) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.v), gl.STATIC_DRAW);
  const stride = VERTEX_FLOATS * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 24);
  const ebo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
  const big = geo.count > 65535;
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
    big ? new Uint32Array(geo.i) : new Uint16Array(geo.i), gl.STATIC_DRAW);
  let instBuf = null;
  if (instanced) {
    // 3..6 : matrice modèle (4 vec4) ; 7 : couleur + émissif
    instBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    const istride = 20 * 4;
    for (let k = 0; k < 4; k++) {
      gl.enableVertexAttribArray(3 + k);
      gl.vertexAttribPointer(3 + k, 4, gl.FLOAT, false, istride, k * 16);
      gl.vertexAttribDivisor(3 + k, 1);
    }
    gl.enableVertexAttribArray(7);
    gl.vertexAttribPointer(7, 4, gl.FLOAT, false, istride, 64);
    gl.vertexAttribDivisor(7, 1);
  }
  gl.bindVertexArray(null);
  return {
    vao, vbo, ebo, instBuf,
    count: geo.i.length,
    type: big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
    min: geo.min.slice(), max: geo.max.slice(),
  };
}

export function destroyMesh(gl, m) {
  if (!m) return;
  gl.deleteVertexArray(m.vao);
  gl.deleteBuffer(m.vbo);
  gl.deleteBuffer(m.ebo);
  if (m.instBuf) gl.deleteBuffer(m.instBuf);
}
