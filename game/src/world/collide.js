/**
 * Collisions du monde statique : grille de hachage spatiale de boîtes alignées
 * (immeubles, conteneurs, mobilier). Sert aux véhicules, aux piétons et aux tirs.
 */

const CELL = 48;

export class World {
  constructor(data) {
    this.data = data;
    this.grid = new Map();
    this.items = data.colliders;
    for (let i = 0; i < this.items.length; i++) this.insert(i);
  }

  key(cx, cz) { return cx * 4096 + cz; }

  insert(i) {
    const c = this.items[i];
    const x0 = Math.floor((c.x - c.hw) / CELL), x1 = Math.floor((c.x + c.hw) / CELL);
    const z0 = Math.floor((c.z - c.hd) / CELL), z1 = Math.floor((c.z + c.hd) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = this.key(cx, cz);
        let a = this.grid.get(k);
        if (!a) { a = []; this.grid.set(k, a); }
        a.push(i);
      }
    }
  }

  /** Boîtes proches d'un point (rayon r). */
  near(x, z, r, out = []) {
    out.length = 0;
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const a = this.grid.get(this.key(cx, cz));
        if (!a) continue;
        for (const i of a) if (!out.includes(i)) out.push(i);
      }
    }
    return out;
  }

  /**
   * Repousse un disque hors des bâtiments.
   * @returns {null|{nx,nz,depth}} normale et profondeur du contact le plus profond
   */
  pushCircle(p, r, maxY = 2) {
    const idx = this.near(p.x, p.z, r + 2, this._tmp || (this._tmp = []));
    let best = null;
    for (const i of idx) {
      const c = this.items[i];
      if (c.h < maxY * 0.35) continue;
      const dx = p.x - c.x, dz = p.z - c.z;
      const px = c.hw + r - Math.abs(dx);
      const pz = c.hd + r - Math.abs(dz);
      if (px <= 0 || pz <= 0) continue;
      if (px < pz) {
        const d = px, nx = Math.sign(dx) || 1;
        if (!best || d > best.depth) best = { nx, nz: 0, depth: d };
      } else {
        const d = pz, nz = Math.sign(dz) || 1;
        if (!best || d > best.depth) best = { nx: 0, nz, depth: d };
      }
    }
    if (best) { p.x += best.nx * best.depth; p.z += best.nz * best.depth; }
    return best;
  }

  /** Test d'un point (utilisé par les tirs et l'IA). */
  solidAt(x, y, z) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    const a = this.grid.get(this.key(cx, cz));
    if (!a) return false;
    for (const i of a) {
      const c = this.items[i];
      if (y <= c.h && Math.abs(x - c.x) <= c.hw && Math.abs(z - c.z) <= c.hd) return true;
    }
    return false;
  }

  /** Lancer de rayon contre les bâtiments. Retourne la distance ou Infinity. */
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let t = 0;
    const step = 0.8;
    let prev = 0;
    while (t < maxDist) {
      t += step;
      if (this.solidAt(ox + dx * t, oy + dy * t, oz + dz * t)) {
        let lo = prev, hi = t;
        for (let k = 0; k < 6; k++) {
          const m = (lo + hi) / 2;
          if (this.solidAt(ox + dx * m, oy + dy * m, oz + dz * m)) hi = m; else lo = m;
        }
        return hi;
      }
      prev = t;
    }
    return Infinity;
  }

  /** Ligne de vue dégagée entre deux points ? */
  visible(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const d = Math.hypot(dx, dy, dz);
    if (d < 0.001) return true;
    return this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d - 0.5) === Infinity;
  }

  /** Hauteur du sol (le monde est plat, sauf la jetée et les trottoirs). */
  groundY(x, z) {
    return 0;
  }
}
