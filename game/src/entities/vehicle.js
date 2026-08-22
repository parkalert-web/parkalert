/**
 * Véhicules : catalogue, carrosserie procédurale, physique arcade
 * (modèle bicyclette + dérive latérale), dégâts et destruction.
 */
import { m4, m4compose, m4mul, color, shade, clamp, lerp, damp, rng, range, pick, wrapAngle } from '../engine/math.js';

const PAINT = ['#b8352f', '#1f2933', '#e6e6e6', '#2f5fa8', '#2c7a4b', '#d9a02b', '#7a2f8f',
  '#8a8f95', '#c96a1e', '#1d6f7a', '#5a5f66', '#efe4d0', '#3a3f45', '#94261f'];

/** Catalogue : la « classe » pilote la silhouette et le comportement. */
export const MODELS = {
  asterope: { name: 'Asterope', cls: 'sedan', len: 4.7, wid: 1.9, h: 1.45, mass: 1500, power: 12.5, top: 52, grip: 7.6, brake: 24, steer: 0.60, seats: 4 },
  ingot: { name: 'Ingot', cls: 'sedan', len: 4.5, wid: 1.86, h: 1.5, mass: 1450, power: 11, top: 46, grip: 7.4, brake: 22, steer: 0.62, seats: 4 },
  comete: { name: 'Comète', cls: 'sports', len: 4.4, wid: 1.95, h: 1.22, mass: 1300, power: 19, top: 78, grip: 9.2, brake: 32, steer: 0.58, seats: 2 },
  adder: { name: 'Adder', cls: 'super', len: 4.6, wid: 2.05, h: 1.15, mass: 1350, power: 26, top: 95, grip: 10.4, brake: 38, steer: 0.55, seats: 2 },
  dominator: { name: 'Dominator', cls: 'muscle', len: 4.9, wid: 2.0, h: 1.38, mass: 1650, power: 17, top: 70, grip: 7.0, brake: 26, steer: 0.60, seats: 2 },
  granger: { name: 'Granger', cls: 'suv', len: 5.1, wid: 2.1, h: 1.95, mass: 2300, power: 12, top: 48, grip: 6.9, brake: 22, steer: 0.58, seats: 4 },
  bison: { name: 'Bison', cls: 'pickup', len: 5.3, wid: 2.05, h: 1.85, mass: 2200, power: 12.5, top: 47, grip: 6.8, brake: 21, steer: 0.57, seats: 2 },
  burrito: { name: 'Burrito', cls: 'van', len: 5.2, wid: 2.05, h: 2.15, mass: 2400, power: 10.5, top: 43, grip: 6.4, brake: 20, steer: 0.55, seats: 4 },
  taxi: { name: 'Taxi', cls: 'sedan', len: 4.7, wid: 1.92, h: 1.5, mass: 1550, power: 11, top: 45, grip: 7.2, brake: 22, steer: 0.60, seats: 4, fixed: '#e2b307', taxi: true },
  police: { name: 'Police Cruiser', cls: 'police', len: 5.0, wid: 2.0, h: 1.5, mass: 1750, power: 16.5, top: 62, grip: 8.4, brake: 30, steer: 0.62, seats: 4, fixed: '#1a1d21', police: true },
  police2: { name: 'Police Buffalo', cls: 'police', len: 4.9, wid: 2.0, h: 1.42, mass: 1700, power: 19, top: 72, grip: 8.8, brake: 32, steer: 0.60, seats: 4, fixed: '#20242a', police: true },
  ambulance: { name: 'Ambulance', cls: 'van', len: 5.6, wid: 2.15, h: 2.4, mass: 2800, power: 11, top: 42, grip: 6.6, brake: 22, seats: 2, fixed: '#eef1f3', emergency: 'med' },
  firetruck: { name: 'Camion de pompiers', cls: 'truck', len: 7.6, wid: 2.4, h: 2.9, mass: 6500, power: 9.5, top: 36, grip: 6.2, brake: 20, seats: 2, fixed: '#b4231d', emergency: 'fire' },
  benson: { name: 'Benson', cls: 'truck', len: 7.4, wid: 2.35, h: 2.9, mass: 5200, power: 8.5, top: 34, grip: 5.9, brake: 18, seats: 2 },
  bus: { name: 'Bus', cls: 'bus', len: 10.5, wid: 2.5, h: 3.1, mass: 9000, power: 7.5, top: 32, grip: 5.6, brake: 17, seats: 8, fixed: '#d8b23a' },
};

export const CIVILIAN_MODELS = ['asterope', 'ingot', 'comete', 'dominator', 'granger', 'bison', 'burrito', 'taxi', 'asterope', 'ingot'];

const partCache = new Map();

/** Construit la carrosserie (dans le repère local : X droite, Y haut, Z avant). */
function buildParts(key) {
  if (partCache.has(key)) return partCache.get(key);
  const m = MODELS[key];
  const L = m.len, W = m.wid, H = m.h;
  const p = [];
  const wheelR = m.cls === 'truck' || m.cls === 'bus' ? 0.55 : m.cls === 'suv' || m.cls === 'pickup' || m.cls === 'van' ? 0.42 : 0.36;
  const floor = wheelR * (m.cls === 'sports' || m.cls === 'super' ? 0.52 : m.cls === 'truck' || m.cls === 'bus' ? 0.95 : 0.66);
  const bodyH = H - floor;

  const glass = 'glass', paint = 'paint', dark = 'dark';
  const add = (x, y, z, sx, sy, sz, c, extra) => p.push({ x, y, z, sx, sy, sz, c, ...extra });

  if (m.cls === 'bus' || m.cls === 'truck' || m.cls === 'van') {
    const cabZ = m.cls === 'bus' ? 0 : L * 0.28;
    if (m.cls === 'bus') {
      add(0, floor + bodyH * 0.5, 0, W, bodyH, L, paint);
      add(0, floor + bodyH * 0.72, 0, W + 0.04, bodyH * 0.42, L * 0.92, glass);
      add(0, floor + bodyH * 1.0, 0, W * 0.96, 0.12, L * 0.96, dark);
    } else if (m.cls === 'truck') {
      add(0, floor + bodyH * 0.45, cabZ, W, bodyH * 0.9, L * 0.34, paint);
      add(0, floor + bodyH * 0.68, cabZ + L * 0.06, W + 0.03, bodyH * 0.4, L * 0.2, glass);
      add(0, floor + bodyH * 0.55, -L * 0.16, W * 0.98, bodyH * 1.05, L * 0.62, m.emergency === 'fire' ? paint : 'cargo');
      if (m.emergency === 'fire') {
        add(0, floor + bodyH * 1.15, -L * 0.16, W * 0.5, 0.4, L * 0.5, 'metal');
        add(0, floor + bodyH * 1.0, L * 0.05, W * 0.9, 0.3, 0.6, 'metal');
      }
    } else {
      add(0, floor + bodyH * 0.5, -L * 0.06, W, bodyH, L * 0.86, paint);
      add(0, floor + bodyH * 0.62, L * 0.34, W * 0.98, bodyH * 0.72, L * 0.16, paint);
      add(0, floor + bodyH * 0.7, L * 0.4, W * 0.96, bodyH * 0.42, 0.12, glass);
      add(0, floor + bodyH * 0.72, L * 0.1, W + 0.03, bodyH * 0.34, L * 0.36, glass);
    }
  } else if (m.cls === 'pickup') {
    add(0, floor + bodyH * 0.42, 0, W, bodyH * 0.85, L, paint);
    add(0, floor + bodyH * 0.82, L * 0.12, W * 0.92, bodyH * 0.55, L * 0.36, paint);
    add(0, floor + bodyH * 0.86, L * 0.12, W * 0.94, bodyH * 0.4, L * 0.34, glass);
    add(0, floor + bodyH * 0.72, -L * 0.28, W * 0.94, bodyH * 0.34, L * 0.42, dark);
  } else {
    // berlines, sportives, SUV : caisse basse, pavillon vitré, toit
    const lowH = bodyH * (m.cls === 'sports' || m.cls === 'super' ? 0.66 : m.cls === 'suv' ? 0.54 : 0.58);
    const cabH = bodyH - lowH;
    const cabZ = m.cls === 'sports' || m.cls === 'super' ? -L * 0.08 : L * 0.01;
    const cabL = m.cls === 'super' ? L * 0.38 : m.cls === 'sports' ? L * 0.44 : L * 0.52;
    add(0, floor + lowH * 0.5, 0, W, lowH, L, paint);
    add(0, floor + lowH * 0.28, 0, W + 0.05, lowH * 0.46, L * 0.97, 'skirt');
    add(0, floor + lowH * 0.86, L * 0.3, W * 0.97, lowH * 0.3, L * 0.34, paint);          // capot
    add(0, floor + lowH + cabH * 0.5, cabZ, W * 0.88, cabH, cabL, paint);
    add(0, floor + lowH + cabH * 0.42, cabZ, W * 0.9, cabH * 0.5, cabL * 0.99, glass);
    add(0, floor + lowH + cabH * 0.92, cabZ, W * 0.82, cabH * 0.18, cabL * 0.9, paint);   // toit
    if (m.cls === 'muscle') add(0, floor + lowH + 0.06, L * 0.3, W * 0.34, 0.14, L * 0.16, dark);
    if (m.cls === 'super' || m.cls === 'sports') add(0, floor + lowH + cabH * 0.6, -L * 0.44, W * 0.86, 0.1, 0.42, dark);
  }

  // pare-chocs, phares, feux
  const noseZ = L / 2 - 0.12, tailZ = -L / 2 + 0.12;
  add(0, floor + bodyH * 0.28, noseZ, W * 0.98, bodyH * 0.3, 0.22, dark);
  add(0, floor + bodyH * 0.28, tailZ, W * 0.98, bodyH * 0.3, 0.22, dark);
  for (const s of [-1, 1]) {
    add(s * W * 0.33, floor + bodyH * 0.52, noseZ + 0.02, W * 0.26, bodyH * 0.2, 0.14, 'head');
    add(s * W * 0.34, floor + bodyH * 0.55, tailZ - 0.02, W * 0.24, bodyH * 0.18, 0.12, 'tail');
  }
  if (m.taxi) {
    add(0, floor + bodyH * 1.28, L * 0.02, 0.9, 0.32, 0.42, 'sign');
  }
  if (m.police) {
    add(0, floor + bodyH * 1.3, L * 0.02, W * 0.7, 0.22, 0.34, 'lightbarL');
    add(0, floor + bodyH * 1.3, L * 0.02, W * 0.7, 0.22, 0.34, 'lightbarR');
    add(0, floor + bodyH * 0.42, noseZ + 0.16, W * 0.9, bodyH * 0.34, 0.16, 'metal');
    for (const s of [-1, 1]) add(s * (W / 2 + 0.02), floor + bodyH * 0.5, -L * 0.05, 0.06, bodyH * 0.34, L * 0.42, 'livery');
  }
  if (m.emergency === 'med' || m.emergency === 'fire') {
    add(0, (m.h - floor) + floor + 0.1, L * 0.1, W * 0.62, 0.2, 0.3, 'lightbarL');
    add(0, (m.h - floor) + floor + 0.1, L * 0.1, W * 0.62, 0.2, 0.3, 'lightbarR');
  }

  const wheels = [];
  const wx = W / 2 - 0.06, wz = L * 0.33;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    wheels.push({ x: sx * wx, y: wheelR, z: sz * wz, r: wheelR, w: m.cls === 'truck' || m.cls === 'bus' ? 0.34 : 0.26, front: sz > 0 });
  }
  const out = { parts: p, wheels, wheelR, floor, bodyH };
  partCache.set(key, out);
  return out;
}

let nextId = 1;

export class Vehicle {
  constructor(key, x, z, yaw = 0, opts = {}) {
    const m = MODELS[key] || MODELS.asterope;
    this.id = nextId++;
    this.key = key;
    this.model = m;
    this.geo = buildParts(key in MODELS ? key : 'asterope');
    this.x = x; this.y = 0; this.z = z;
    this.yaw = yaw;
    this.vx = 0; this.vz = 0;
    this.speed = 0;
    this.steer = 0;
    this.throttle = 0;
    this.steerInput = 0;
    this.handbrake = false;
    this.wheelSpin = 0;
    this.roll = 0; this.pitch = 0;
    this.health = 1000;
    this.maxHealth = 1000;
    this.dead = false;
    this.burnTime = 0;
    this.color = color(m.fixed || opts.color || pick(rng(Math.floor(x * 31 + z * 7) + this.id), PAINT));
    this.driver = null;
    this.occupants = [];
    this.lights = false;
    this.siren = false;
    this.sirenPhase = 0;
    this.horn = 0;
    this.skid = 0;
    this.parked = !!opts.parked;
    this.ai = null;
    this.mat = m4();
    this.tmp = m4();
    this.out = m4();
    this.hw = m.wid / 2;
    this.hl = m.len / 2;
    this.mass = m.mass;
    this.locked = false;
    this.mission = opts.mission || null;
  }

  get forward() { return [Math.sin(this.yaw), Math.cos(this.yaw)]; }

  /** Vitesse en km/h, pour le compteur. */
  get kmh() { return Math.abs(this.speed) * 3.6; }

  applyImpulse(ix, iz) {
    this.vx += ix / this.mass;
    this.vz += iz / this.mass;
  }

  damage(amount, srcX, srcZ) {
    if (this.dead) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.burnTime = 0;
      this.exploded = false;
    }
  }

  update(dt, world, game) {
    const m = this.model;
    if (this.dead) {
      this.burnTime += dt;
      this.throttle = 0; this.steerInput = 0;
    }

    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let vf = this.vx * fx + this.vz * fz;
    let vr = this.vx * rx + this.vz * rz;

    // direction : braquage réduit à haute vitesse
    const speedFactor = clamp(Math.abs(vf) / 40, 0, 1);
    const maxSteer = m.steer * (1 - speedFactor * 0.62);
    const target = this.steerInput * maxSteer;
    this.steer = damp(this.steer, target, 9, dt);

    const t = this.dead ? 0 : this.throttle;
    if (t > 0) {
      if (vf < -0.5) vf += m.brake * dt * t;                      // freinage en marche arrière
      else vf += m.power * t * (1 - clamp(vf / m.top, 0, 1)) * dt;
    } else if (t < 0) {
      if (vf > 0.5) vf -= m.brake * dt * -t;
      else vf += m.power * 0.45 * t * (1 - clamp(-vf / (m.top * 0.35), 0, 1)) * dt;
    } else {
      vf -= vf * 0.55 * dt;                                        // frein moteur
    }
    if (this.handbrake) {
      vf -= vf * 2.4 * dt;
      this.skid = Math.min(1, this.skid + dt * 4);
    }
    vf -= vf * Math.abs(vf) * 0.0022 * dt * 60 / 60;               // traînée
    vf -= Math.sign(vf) * 0.35 * dt;
    if (Math.abs(vf) < 0.06 && t === 0) vf = 0;

    // adhérence latérale : la dérive naît de l'écart entre cap et vitesse
    const gripBase = this.handbrake ? 1.5 : m.grip;
    // chaussée mouillée : jusqu'à 22 % d'adhérence en moins
    const wet = game && game.weather ? 1 - game.weather.wet * 0.22 : 1;
    const grip = gripBase * wet * (this.dead ? 0.6 : 1);
    const slip = Math.abs(vr);
    vr *= Math.exp(-grip * dt);
    this.skid = clamp(this.skid + (slip > 5.5 ? dt * 3 : -dt * 2.2), 0, 1);

    // rotation (modèle bicyclette), bornée par l'adhérence disponible :
    // sans cette limite la voiture tourne comme sur des rails à 100 km/h.
    const wheelbase = m.len * 0.62;
    let omega = (vf / wheelbase) * Math.tan(this.steer);
    if (Math.abs(vf) < 0.6) omega *= Math.abs(vf) / 0.6;
    const maxLat = m.grip * 1.45 * (this.handbrake ? 1.5 : 1) * (this.dead ? 0.6 : 1);
    const maxOmega = Math.abs(vf) > 1 ? maxLat / Math.abs(vf) : 3.2;
    omega = clamp(omega, -maxOmega, maxOmega);
    this.yaw += omega * dt;

    const nfx = Math.sin(this.yaw), nfz = Math.cos(this.yaw);
    const nrx = Math.cos(this.yaw), nrz = -Math.sin(this.yaw);
    this.vx = nfx * vf + nrx * vr;
    this.vz = nfz * vf + nrz * vr;
    this.speed = vf;

    const px = this.x, pz = this.z;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // collisions avec le décor : on teste les quatre coins
    let hit = null;
    const cs = Math.sin(this.yaw), cc = Math.cos(this.yaw);
    for (const [ox, oz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const cx = this.x + ox * this.hw * cc + oz * this.hl * cs;
      const cz = this.z - ox * this.hw * cs + oz * this.hl * cc;
      const p = { x: cx, z: cz };
      const r = world.pushCircle(p, 0.35, this.model.h);
      if (r) {
        this.x += (p.x - cx) * 0.85;
        this.z += (p.z - cz) * 0.85;
        if (!hit || r.depth > hit.depth) hit = r;
      }
    }
    if (hit) {
      const vn = this.vx * hit.nx + this.vz * hit.nz;
      if (vn < 0) {
        this.vx -= hit.nx * vn * 1.4;
        this.vz -= hit.nz * vn * 1.4;
        const impact = Math.abs(vn);
        if (impact > 4) {
          this.damage(impact * 7);
          if (game) game.onCrash(this, impact, this.x, this.y + 0.6, this.z);
        }
        this.vx *= 0.75; this.vz *= 0.75;
      }
    }

    // à l'eau : le moteur noie et l'épave s'enfonce
    if (this.x < -740) {
      this.inWater = true;
      this.y = damp(this.y, -1.6, 0.7, dt);
      this.vx *= Math.exp(-2.2 * dt);
      this.vz *= Math.exp(-2.2 * dt);
      this.throttle = 0;
      if (!this.drowned) { this.drowned = true; this.damage(260); }
      if (this.y < -1.2 && !this.dead) this.damage(400 * dt);
    } else if (this.y < 0) {
      this.y = Math.min(0, this.y + dt * 2);
    }

    // limites du monde
    const B = 1080;
    if (this.x < -B) { this.x = -B; this.vx *= -0.3; }
    if (this.x > B) { this.x = B; this.vx *= -0.3; }
    if (this.z < -B) { this.z = -B; this.vz *= -0.3; }
    if (this.z > B) { this.z = B; this.vz *= -0.3; }

    // assiette : roulis et tangage suivent les accélérations
    const latAcc = -omega * vf;
    this.roll = damp(this.roll, clamp(latAcc * 0.012, -0.13, 0.13), 8, dt);
    const acc = (vf - (this._lastVf || 0)) / Math.max(dt, 1e-3);
    this._lastVf = vf;
    this.pitch = damp(this.pitch, clamp(-acc * 0.004, -0.09, 0.09), 7, dt);
    this.wheelSpin += (vf / (this.geo.wheelR || 0.35)) * dt;
    this.sirenPhase += dt;
    if (this.horn > 0) this.horn -= dt;

    // épave en feu
    if (this.dead && !this.exploded && this.burnTime > 3.2 && game) {
      this.exploded = true;
      game.explode(this.x, this.y + 0.8, this.z, 9, this);
    }
  }

  /** Position d'un siège (0 = conducteur). */
  seatPos(i = 0) {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const lx = i % 2 === 0 ? -this.model.wid * 0.26 : this.model.wid * 0.26;
    const lz = i < 2 ? this.model.len * 0.06 : -this.model.len * 0.22;
    return [this.x + lx * c + lz * s, this.y + this.geo.floor + this.geo.bodyH * 0.55, this.z - lx * s + lz * c];
  }

  /** Point de sortie sur le côté gauche, dégagé si possible. */
  exitPos(world) {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    for (const side of [-1, 1]) {
      const lx = side * (this.model.wid / 2 + 0.9);
      const x = this.x + lx * c, z = this.z - lx * s;
      const p = { x, z };
      if (!world.pushCircle(p, 0.4, 2)) return [x, z];
    }
    return [this.x, this.z];
  }

  draw(R, env, time) {
    const g = this.geo;
    const paint = this.dead ? [0.09, 0.08, 0.08] : this.color;
    const burn = this.dead ? clamp(this.burnTime / 2, 0, 1) : 0;
    const body = burn ? shade(paint, 1 - burn * 0.5) : paint;
    m4compose(this.mat, this.x, this.y, this.z, this.yaw, 1, 1, 1, this.pitch, this.roll);
    const braking = this.throttle < -0.1 || this.handbrake;
    const night = env.emitBoost > 0.25;
    const lightsOn = this.lights || night;

    for (const p of this.geo.parts) {
      let c = body, emit = 0;
      switch (p.c) {
        case 'paint': c = body; break;
        case 'glass': c = [0.06, 0.09, 0.12]; emit = 0.05; break;
        case 'dark': c = [0.07, 0.07, 0.08]; break;
        case 'skirt': c = shade(body, 0.72); break;
        case 'metal': c = [0.55, 0.57, 0.6]; break;
        case 'cargo': c = shade(body, 0.85); break;
        case 'livery': c = [0.92, 0.92, 0.94]; break;
        case 'head': c = lightsOn ? [1, 0.97, 0.85] : [0.75, 0.75, 0.72]; emit = lightsOn ? 1 : 0; break;
        case 'tail': c = [0.8, 0.1, 0.08]; emit = braking ? 1 : (lightsOn ? 0.45 : 0.08); break;
        case 'sign': c = [1, 0.85, 0.2]; emit = 0.9; break;
        case 'lightbarL': case 'lightbarR': {
          const blink = this.siren ? (Math.sin(this.sirenPhase * 14 + (p.c === 'lightbarL' ? 0 : Math.PI)) > 0 ? 1 : 0.05) : 0.06;
          c = p.c === 'lightbarL' ? [0.2, 0.35, 1] : [1, 0.15, 0.12];
          emit = blink;
          break;
        }
        default: c = typeof p.c === 'string' ? color(p.c) : p.c;
      }
      const half = p.c === 'lightbarL' ? -1 : p.c === 'lightbarR' ? 1 : 0;
      m4compose(this.tmp, p.x + half * p.sx * 0.26, p.y, p.z,
        p.ry || 0, half ? p.sx * 0.48 : p.sx, p.sy, p.sz);
      m4mul(this.out, this.mat, this.tmp);
      R.cube(this.out, c, emit);
    }

    // occupants : buste et tête visibles derrière le pare-brise
    for (let i = 0; i < this.occupants.length; i++) {
      const o = this.occupants[i];
      const look = o.look || o;
      const seatX = (i % 2 === 0 ? -1 : 1) * this.model.wid * 0.24;
      const seatZ = i < 2 ? this.model.len * 0.04 : -this.model.len * 0.2;
      const baseY = g.floor + g.bodyH * 0.52;
      m4compose(this.tmp, seatX, baseY + 0.18, seatZ, 0, 0.4, 0.42, 0.24);
      m4mul(this.out, this.mat, this.tmp);
      R.cube(this.out, look.shirt || [0.5, 0.5, 0.55]);
      m4compose(this.tmp, seatX, baseY + 0.54, seatZ, 0, 0.23, 0.26, 0.24);
      m4mul(this.out, this.mat, this.tmp);
      R.cube(this.out, look.skin || [0.85, 0.7, 0.55]);
      m4compose(this.tmp, seatX, baseY + 0.66, seatZ - 0.01, 0, 0.25, 0.09, 0.26);
      m4mul(this.out, this.mat, this.tmp);
      R.cube(this.out, look.hair || [0.15, 0.11, 0.08]);
    }

    // roues
    for (const w of g.wheels) {
      const st = w.front ? this.steer : 0;
      m4compose(this.tmp, w.x, w.y, w.z, st, w.r * 2, w.w, w.r * 2, this.wheelSpin, Math.PI / 2);
      m4mul(this.out, this.mat, this.tmp);
      R.cyl(this.out, [0.06, 0.06, 0.07]);
      m4compose(this.tmp, w.x * 1.02, w.y, w.z, st, w.r * 0.92, w.w * 1.06, w.r * 0.92, this.wheelSpin, Math.PI / 2);
      m4mul(this.out, this.mat, this.tmp);
      R.cyl(this.out, [0.42, 0.44, 0.47]);
    }
  }
}

export function randomCivilianModel(rand) {
  return pick(rand, CIVILIAN_MODELS);
}
