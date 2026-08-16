'use strict';
/* ── LA CHASSE ────────────────────────────────────────────────────────────────
   Modèle multi-agents de la traque au stationnement.

   Deux villes strictement identiques : même graine, mêmes véhicules, mêmes
   destinations, mêmes durées de stationnement, minute par minute.
   Une seule variable les sépare : la part de conducteurs équipés d'un réseau
   de partage de places.

   Un conducteur non équipé ne voit une place qu'en passant devant, et ne
   prévient personne quand il part. Un conducteur équipé annonce son départ
   à l'avance et se fait affecter une place réservée. Les deux populations
   se disputent le même bitume — un non-équipé peut très bien prendre une
   place réservée : il ne sait pas qu'elle l'est.
   ────────────────────────────────────────────────────────────────────────── */

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const CFG = {
  GW: 7, GH: 7,          // intersections
  K: 4,                  // places par tronçon
  EDGE_LEN: 110,         // m
  SPEED: 250,            // m/min ≈ 15 km/h en recherche
  PARK_MIN: 5,           // min
  PARK_MEAN: 28,         // min
  ANNOUNCE: 3,           // min de préavis de départ sur le réseau
  MAX_WAIT: 5,           // min d'attente devant une place réservée
  RETRY: 0.5,            // min entre deux tentatives d'affectation
  PATIENCE: 6,           // min avant d'élargir le rayon de marche accepté
  MAX_HOPS: 3,           // rayon de marche maximal (en tronçons)
  SIGMA: 1.6,            // concentration de la demande autour du centre
  FLOOR: 0.12,           // part de demande uniformément répartie
  CO2: 130,              // g de CO2 par km
};

const PHI = 0.6180339887498949;

function buildGraph(cfg) {
  const { GW, GH, K } = cfg;
  const nodes = [];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) nodes.push({ x, y });
  const id = (x, y) => y * GW + x;
  const edges = [];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    if (x < GW - 1) edges.push({ a: id(x, y), b: id(x + 1, y) });
    if (y < GH - 1) edges.push({ a: id(x, y), b: id(x, y + 1) });
  }
  edges.forEach((e, i) => {
    e.i = i;
    e.spots = [];
    for (let k = 0; k < K; k++) e.spots.push({ e: i, k, t: (k + 0.5) / K, occ: null, res: null, ann: false });
  });
  const adj = nodes.map(() => []);
  edges.forEach(e => { adj[e.a].push({ e: e.i, o: e.b }); adj[e.b].push({ e: e.i, o: e.a }); });

  const N = nodes.length;
  const dist = [];
  for (let s = 0; s < N; s++) {
    const d = new Int16Array(N).fill(-1);
    d[s] = 0; const q = [s]; let h = 0;
    while (h < q.length) { const n = q[h++]; for (const { o } of adj[n]) if (d[o] < 0) { d[o] = d[n] + 1; q.push(o); } }
    dist.push(d);
  }

  const cx = (GW - 1) / 2, cy = (GH - 1) / 2;
  const w = nodes.map(n => {
    const dx = n.x - cx, dy = n.y - cy;
    return cfg.FLOOR + Math.exp(-(dx * dx + dy * dy) / (2 * cfg.SIGMA * cfg.SIGMA));
  });
  const tot = w.reduce((a, b) => a + b, 0);
  const cdf = []; let acc = 0;
  for (const v of w) { acc += v / tot; cdf.push(acc); }

  const edgeWalk = edges.map(e => {
    const d = new Int16Array(N);
    for (let n = 0; n < N; n++) d[n] = Math.min(dist[e.a][n], dist[e.b][n]);
    return d;
  });

  return { nodes, edges, adj, dist, cdf, attract: w, edgeWalk, nSpots: edges.length * K, N };
}

class Series {
  constructor(cap) { this.cap = cap || 90; this.a = []; }
  push(v) { this.a.push(v); if (this.a.length > this.cap) this.a.shift(); }
  get mean() { return this.a.length ? this.a.reduce((x, y) => x + y, 0) / this.a.length : 0; }
  get n() { return this.a.length; }
  clear() { this.a = []; }
}

class World {
  constructor(seed, adoption, cfg) {
    this.cfg = Object.assign({}, CFG, cfg || {});
    this.seed = seed >>> 0;
    this.g = buildGraph(this.cfg);
    this.nav = mulberry32((this.seed ^ 0x51ed270b) >>> 0);
    this.adoption = adoption;
    this.reset();
  }

  reset() {
    this.t = 0;
    this.cars = [];
    this.m = {
      sub: { T: new Series(), D: new Series(), W: new Series(), done: 0 },
      non: { T: new Series(), D: new Series(), W: new Series(), done: 0 },
    };
    // Les Series ci-dessus sont glissantes : elles servent à l'affichage temps réel.
    // Pour une mesure sur un intervalle complet, on cumule séparément.
    this.resetAcc();
    this.cruiseMeters = 0;
    this.stolen = 0;      // places réservées soufflées par un non-équipé
  }

  resetAcc() {
    const z = () => ({ T: 0, D: 0, W: 0, n: 0 });
    this.acc = { sub: z(), non: z() };
  }

  /* Ensemble d'abonnés monotone : augmenter l'adoption n'enlève jamais
     d'abonné, elle en ajoute. Suite à faible discrépance sur l'identifiant. */
  rankOf(id) { const v = (id + 1) * PHI; return v - Math.floor(v); }
  isSub(c) { return c.rank < this.adoption; }

  other(e, n) { const E = this.g.edges[e]; return n === E.a ? E.b : E.a; }
  uOf(e, from, t) { return this.g.edges[e].a === from ? t : 1 - t; }
  walkHops(s, dest) { return this.g.edgeWalk[s.e][dest]; }

  makeCar(id) {
    return {
      id, rank: this.rankOf(id),
      rng: mulberry32((this.seed ^ Math.imul(id + 1, 2654435761)) >>> 0),
      st: 'CRUISE',
      e: 0, from: 0, u: 0,
      timer: 0, spot: null, dest: 0,
      t0: 0, dist: 0,
      tgt: null, path: [], wait: 0, retry: 0, waiting: false,
      px: 0, py: 0,
    };
  }

  drawDest(c) {
    const x = c.rng(), cdf = this.g.cdf;
    let lo = 0, hi = cdf.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < x) lo = m + 1; else hi = m; }
    return lo;
  }

  drawDur(c) {
    const m = this.cfg.PARK_MEAN - this.cfg.PARK_MIN;
    return this.cfg.PARK_MIN - m * Math.log(1 - c.rng() * 0.999);
  }

  init(V) {
    this.g.edges.forEach(E => E.spots.forEach(s => { s.occ = null; s.res = null; s.ann = false; }));
    this.reset();
    const order = [];
    this.g.edges.forEach(E => E.spots.forEach(s => order.push(s)));
    const sh = mulberry32(this.seed);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(sh() * (i + 1));
      const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    this.order = order;
    for (let i = 0; i < V; i++) this.addCar(i, true);
  }

  addCar(id, atInit) {
    const c = this.makeCar(id);
    this.cars.push(c);
    if (atInit && id < this.order.length) {
      c.dest = this.drawDest(c);
      this.parkAt(c, this.order[id], this.drawDur(c) * c.rng());
    } else {
      const n = (Math.imul(id + 7, 2246822519) >>> 0) % this.g.N;
      c.e = this.g.adj[n][0].e; c.from = n; c.u = 0;
      this.startSearch(c);
    }
    return c;
  }

  parkAt(c, s, dur) {
    if (s.res !== null && s.res !== c.id) {          // place soufflée à un abonné
      const v = this.cars[s.res];
      if (v && v.tgt === s) { v.tgt = null; v.path = []; v.waiting = false; v.wait = 0; v.retry = 0; }
      this.stolen++;
    }
    s.occ = c.id; s.ann = false; s.res = null;
    c.st = 'PARKED'; c.spot = s; c.timer = dur;
    c.tgt = null; c.path = []; c.waiting = false; c.wait = 0;
  }

  startSearch(c) {
    c.st = 'CRUISE'; c.t0 = this.t; c.dist = 0;
    c.dest = this.drawDest(c);
    c.tgt = null; c.path = []; c.waiting = false; c.wait = 0; c.retry = 0;
    if (this.isSub(c)) this.assign(c);
  }

  radius(c) {
    return Math.min(1 + Math.floor((this.t - c.t0) / this.cfg.PATIENCE), this.cfg.MAX_HOPS);
  }

  finishSearch(c, s) {
    const sub = this.isSub(c);
    const g = sub ? this.m.sub : this.m.non;
    const dt = this.t - c.t0, dw = this.walkHops(s, c.dest) * this.cfg.EDGE_LEN;
    g.T.push(dt); g.D.push(c.dist); g.W.push(dw);
    g.done++;
    const a = sub ? this.acc.sub : this.acc.non;
    a.T += dt; a.D += c.dist; a.W += dw; a.n++;
    this.parkAt(c, s, this.drawDur(c));
  }

  release(c) {
    if (c.tgt && c.tgt.res === c.id) c.tgt.res = null;
    c.tgt = null; c.path = []; c.waiting = false; c.wait = 0;
  }

  avail(s) { return s.res === null && (s.occ === null || s.ann); }

  /* Une seule BFS : place disponible acceptable la plus proche en conduite,
     et l'itinéraire pour s'y rendre. */
  assign(c) {
    const g = this.g, R = this.radius(c);
    const start = this.other(c.e, c.from);
    const prevE = new Int32Array(g.N).fill(-1);
    const prevN = new Int32Array(g.N).fill(-1);
    const seen = new Uint8Array(g.N);
    const q = [start]; seen[start] = 1; let h = 0;
    while (h < q.length) {
      const n = q[h++];
      for (const { e, o } of g.adj[n]) {
        if (g.edgeWalk[e][c.dest] <= R) {
          for (const s of g.edges[e].spots) {
            if (this.avail(s)) {
              s.res = c.id; c.tgt = s;
              const path = []; let cur = n;
              while (cur !== start) { path.push(prevE[cur]); cur = prevN[cur]; }
              path.reverse(); path.push(e);
              if (path[0] === c.e) path.shift();
              c.path = path;
              return true;
            }
          }
        }
        if (!seen[o]) { seen[o] = 1; prevE[o] = e; prevN[o] = n; q.push(o); }
      }
    }
    c.retry = this.cfg.RETRY;
    return false;
  }

  pathTo(from, targetEdge) {
    const g = this.g, E = g.edges[targetEdge];
    if (E.a === from || E.b === from) return [targetEdge];
    const prevE = new Int32Array(g.N).fill(-1);
    const prevN = new Int32Array(g.N).fill(-1);
    const seen = new Uint8Array(g.N);
    const q = [from]; seen[from] = 1; let h = 0;
    while (h < q.length) {
      const n = q[h++];
      for (const { e, o } of g.adj[n]) {
        if (seen[o]) continue;
        seen[o] = 1; prevE[o] = e; prevN[o] = n; q.push(o);
        if (o === E.a || o === E.b) {
          const path = []; let cur = o;
          while (cur !== from) { path.push(prevE[cur]); cur = prevN[cur]; }
          path.reverse(); path.push(targetEdge);
          return path;
        }
      }
    }
    return [];
  }

  /* Rejoindre la zone de destination, puis y tourner en rond. */
  prowl(c, node) {
    const g = this.g, R = this.radius(c);
    const opts = g.adj[node];
    if (g.dist[node][c.dest] > R) {
      let best = null, bd = 1e9;
      for (const o of opts) {
        const d = g.dist[o.o][c.dest];
        if (d < bd || (d === bd && this.nav() < 0.5)) { bd = d; best = o; }
      }
      if (best) return best.e;
    }
    const noU = opts.filter(o => o.e !== c.e);
    const inZone = noU.filter(o => g.dist[o.o][c.dest] <= R);
    const pool = inZone.length ? inZone : (noU.length ? noU : opts);
    return pool[Math.floor(this.nav() * pool.length)].e;
  }

  nextEdge(c, node) {
    if (c.tgt) {
      if (c.path.length) return c.path.shift();
      c.path = this.pathTo(node, c.tgt.e);
      if (c.path.length) return c.path.shift();
    }
    return this.prowl(c, node);
  }

  step(dt) {
    const cfg = this.cfg;
    this.t += dt;
    for (const c of this.cars) {
      if (c.st === 'PARKED') {
        c.timer -= dt;
        // seul un abonné annonce son départ à l'avance
        if (c.spot && this.isSub(c) && c.timer <= cfg.ANNOUNCE) c.spot.ann = true;
        if (c.timer <= 0) {
          const s = c.spot;
          s.occ = null; s.ann = false;
          c.spot = null; c.e = s.e;
          const E = this.g.edges[s.e];
          c.from = c.rng() < 0.5 ? E.a : E.b;
          c.u = this.uOf(s.e, c.from, s.t);
          this.startSearch(c);
        }
        continue;
      }
      this.drive(c, dt);
    }
  }

  drive(c, dt) {
    const cfg = this.cfg, g = this.g;
    const sub = this.isSub(c);

    // réservation perdue (place soufflée, ou désabonnement)
    if (c.tgt && (c.tgt.res !== c.id || !sub)) { c.tgt = null; c.path = []; c.waiting = false; }

    if (c.waiting) {
      const s = c.tgt;
      if (!s) { c.waiting = false; if (sub) this.assign(c); return; }
      if (s.occ === null) { c.waiting = false; this.finishSearch(c, s); return; }
      c.wait += dt;
      if (c.wait > cfg.MAX_WAIT) { c.waiting = false; this.release(c); this.assign(c); }
      return;
    }

    if (sub && !c.tgt) { c.retry -= dt; if (c.retry <= 0) this.assign(c); }

    let rem = cfg.SPEED * dt, guard = 0;
    while (rem > 1e-9 && c.st === 'CRUISE' && guard++ < 40) {
      const E = g.edges[c.e];
      const uEnd = Math.min(1, c.u + rem / cfg.EDGE_LEN);
      const inRange = g.edgeWalk[c.e][c.dest] <= this.radius(c);

      const crossed = [];
      for (const s of E.spots) {
        const us = this.uOf(c.e, c.from, s.t);
        if (us > c.u && us <= uEnd) crossed.push({ s, us });
      }
      crossed.sort((p, q2) => p.us - q2.us);

      let stopped = false;
      for (const { s, us } of crossed) {
        const adv = (us - c.u) * cfg.EDGE_LEN;
        const take = () => { c.dist += adv; this.cruiseMeters += adv; c.u = us; };
        if (s === c.tgt) {
          take();
          if (s.occ === null) this.finishSearch(c, s);
          else { c.waiting = true; c.wait = 0; }
          stopped = true; break;
        }
        if (s.occ === null && inRange) {
          // un abonné respecte les réservations, un non-équipé les ignore : il ne les voit pas
          if (sub && s.res !== null) continue;
          take(); this.release(c); this.finishSearch(c, s);
          stopped = true; break;
        }
      }
      if (stopped) return;

      const adv = (uEnd - c.u) * cfg.EDGE_LEN;
      c.dist += adv; this.cruiseMeters += adv;
      rem -= adv; c.u = uEnd;

      if (c.u >= 1 - 1e-9) {
        const node = this.other(c.e, c.from);
        c.e = this.nextEdge(c, node); c.from = node; c.u = 0;
      } else break;
    }
  }

  stats() {
    let cruising = 0, waiting = 0, occ = 0, cruSub = 0, cruNon = 0, nSub = 0;
    for (const c of this.cars) {
      const s = this.isSub(c);
      if (s) nSub++;
      if (c.st === 'CRUISE') { cruising++; if (s) cruSub++; else cruNon++; if (c.waiting) waiting++; }
    }
    for (const E of this.g.edges) for (const s of E.spots) if (s.occ !== null) occ++;
    const m = this.m;
    return {
      cruising, waiting, cruSub, cruNon, nSub,
      occ: occ / this.g.nSpots,
      km: this.cruiseMeters / 1000,
      co2: this.cruiseMeters / 1000 * this.cfg.CO2 / 1000,   // kg
      sub: { T: m.sub.T.mean, D: m.sub.D.mean, W: m.sub.W.mean, n: m.sub.T.n, done: m.sub.done },
      non: { T: m.non.T.mean, D: m.non.D.mean, W: m.non.W.mean, n: m.non.T.n, done: m.non.done },
      all: {
        T: (m.sub.T.mean * m.sub.T.n + m.non.T.mean * m.non.T.n) / Math.max(1, m.sub.T.n + m.non.T.n),
        D: (m.sub.D.mean * m.sub.D.n + m.non.D.mean * m.non.D.n) / Math.max(1, m.sub.D.n + m.non.D.n),
        n: m.sub.T.n + m.non.T.n,
      },
      stolen: this.stolen,
      cum: this.cumulative(),
    };
  }

  /* Moyennes sur tout l'intervalle depuis le dernier resetAcc(). */
  cumulative() {
    const a = this.acc.sub, b = this.acc.non, n = a.n + b.n;
    const q = (x, k) => x.n ? x[k] / x.n : NaN;
    return {
      sub: { T: q(a, 'T'), D: q(a, 'D'), W: q(a, 'W'), n: a.n },
      non: { T: q(b, 'T'), D: q(b, 'D'), W: q(b, 'W'), n: b.n },
      all: { T: n ? (a.T + b.T) / n : NaN, D: n ? (a.D + b.D) / n : NaN, n },
    };
  }

  setV(V) {
    while (this.cars.length < V) this.addCar(this.cars.length, false);
    while (this.cars.length > V) {
      const c = this.cars.pop();
      if (c.spot) { c.spot.occ = null; c.spot.ann = false; }
      if (c.tgt && c.tgt.res === c.id) c.tgt.res = null;
    }
  }

  setAdoption(a) {
    this.adoption = a;
    for (const c of this.cars) {
      if (!this.isSub(c)) { if (c.tgt) this.release(c); if (c.spot) c.spot.ann = false; }
      else if (c.st === 'CRUISE' && !c.tgt && !c.waiting) this.assign(c);
    }
  }
}

if (typeof module !== 'undefined') module.exports = { World, CFG, buildGraph, mulberry32 };
