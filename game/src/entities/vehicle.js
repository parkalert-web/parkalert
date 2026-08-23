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
  ambulance: { name: 'Ambulance', cls: 'van', len: 5.6, wid: 2.15, h: 2.4, mass: 2800, power: 11, top: 42, grip: 6.6, brake: 22, steer: 0.50, seats: 2, fixed: '#eef1f3', emergency: 'med' },
  firetruck: { name: 'Camion de pompiers', cls: 'truck', len: 7.6, wid: 2.4, h: 2.9, mass: 6500, power: 9.5, top: 36, grip: 6.2, brake: 20, steer: 0.42, seats: 2, fixed: '#b4231d', emergency: 'fire' },
  benson: { name: 'Benson', cls: 'truck', len: 7.4, wid: 2.35, h: 2.9, mass: 5200, power: 8.5, top: 34, grip: 5.9, brake: 18, steer: 0.44, seats: 2 },
  maverick: {
    name: 'Maverick', cls: 'heli', len: 12, wid: 3.2, h: 3.4, mass: 2600, power: 26, top: 62,
    grip: 4, brake: 10, steer: 0.5, seats: 4, fixed: '#1d2733', fly: true,
  },
  bus: { name: 'Bus', cls: 'bus', len: 10.5, wid: 2.5, h: 3.1, mass: 9000, power: 7.5, top: 32, grip: 5.6, brake: 17, steer: 0.40, seats: 8, fixed: '#d8b23a' },
};

export const CIVILIAN_MODELS = ['asterope', 'ingot', 'comete', 'dominator', 'granger', 'bison', 'burrito', 'taxi', 'asterope', 'ingot'];

const partCache = new Map();

/** Rayon de roue selon la catégorie. */
function wheelRadiusFor(m) {
  if (m.cls === 'truck' || m.cls === 'bus') return 0.55;
  if (m.cls === 'suv' || m.cls === 'pickup' || m.cls === 'van') return 0.42;
  return 0.36;
}

/** Construit la carrosserie (dans le repère local : X droite, Y haut, Z avant). */
function buildParts(key) {
  if (partCache.has(key)) return partCache.get(key);
  const m = { ...MODELS[key], key };
  const L = m.len, W = m.wid, H = m.h;
  const p = [];
  const wheelR = wheelRadiusFor(m);
  const floor = wheelR * (m.cls === 'sports' || m.cls === 'super' ? 0.52 : m.cls === 'truck' || m.cls === 'bus' ? 0.95 : 0.66);
  const bodyH = H - floor;

  const glass = 'glass', paint = 'paint', dark = 'dark';
  /** Ajoute une pièce. `extra` accepte shape ('cyl'|'ball') et rx / ry / rz. */
  const add = (x, y, z, sx, sy, sz, c, extra) => p.push({ x, y, z, sx, sy, sz, c, ...extra });

  if (m.cls === 'heli') {
    const y0 = 1.5;
    add(0, y0 + 0.1, 0.6, W * 0.62, 1.8, L * 0.36, paint);              // cabine
    add(0, y0 + 0.3, 2.1, W * 0.55, 1.2, 1.1, glass);                   // bulle avant
    add(0, y0 + 0.15, -1.9, 0.9, 0.9, L * 0.42, paint);                 // poutre de queue
    add(0, y0 + 1.0, -5.4, 0.35, 1.7, 0.9, paint);                      // dérive
    add(0, y0 + 1.15, 0.4, 0.5, 0.7, 0.6, 'metal');                     // mât
    for (const sd of [-1, 1]) {
      add(sd * 1.35, y0 - 1.1, 0.3, 0.2, 0.55, L * 0.34, 'metal');      // patins
      add(sd * 1.35, y0 - 1.45, 0.3, 0.22, 0.22, L * 0.4, 'dark');
    }
    add(0, y0 + 1.55, 0.4, 13, 0.12, 0.55, 'rotor');                    // rotor principal
    add(0, y0 + 1.55, 0.4, 0.55, 0.12, 13, 'rotor');
    add(0.6, y0 + 1.0, -5.4, 0.16, 2.8, 0.3, 'tailrotor');
    add(0.6, y0 + 1.0, -5.4, 0.16, 0.3, 2.8, 'tailrotor');
    for (const sd of [-1, 1]) add(sd * W * 0.3, y0 + 0.1, 2.35, 0.3, 0.3, 0.2, 'head');
    add(0, y0 - 0.5, -5.2, 0.3, 0.3, 0.3, 'tail');
    return finish(p, m, [], 0, y0);
  }

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
    // berlines, sportives, SUV : caisse basse, pavillon vitré galbé
    const lowH = bodyH * (m.cls === 'sports' || m.cls === 'super' ? 0.58 : m.cls === 'suv' ? 0.5 : 0.54);
    const cabH = bodyH - lowH;
    const cabZ = m.cls === 'sports' || m.cls === 'super' ? -L * 0.08 : L * 0.01;
    const cabL = m.cls === 'super' ? L * 0.38 : m.cls === 'sports' ? L * 0.44 : L * 0.52;
    const beltY = floor + lowH;
    add(0, floor + lowH * 0.5, 0, W, lowH, L, paint);
    add(0, floor + lowH * 0.28, 0, W + 0.05, lowH * 0.46, L * 0.97, 'skirt');
    add(0, floor + lowH * 0.86, L * 0.3, W * 0.97, lowH * 0.3, L * 0.34, paint);          // capot
    add(0, beltY + cabH * 0.48, cabZ, W * 0.9, cabH * 0.96, cabL, paint);            // habitacle
    add(0, beltY + cabH * 0.38, cabZ, W * 0.915, cabH * 0.44, cabL * 0.99, glass);    // vitres
    // pavillon galbé : un tube couché dans l'axe de la voiture
    add(0, beltY + cabH * 0.76, cabZ, W * 0.95, cabL * 0.96, cabH * 0.66, paint,
      { shape: 'cyl', rx: Math.PI / 2 });
    // pare-brise et lunette arrière inclinés
    add(0, beltY + cabH * 0.46, cabZ + cabL * 0.5, W * 0.86, cabH * 1.0, 0.1, glass, { rx: -0.5 });
    add(0, beltY + cabH * 0.46, cabZ - cabL * 0.5, W * 0.86, cabH * 0.95, 0.1, glass, { rx: 0.55 });
    for (const sd of [-1, 1]) {                                                          // rétroviseurs
      add(sd * (W * 0.53), beltY + cabH * 0.26, cabZ + cabL * 0.4, 0.17, 0.09, 0.08, 'skirt');
    }
    if (m.cls === 'muscle') add(0, floor + lowH + 0.06, L * 0.3, W * 0.34, 0.14, L * 0.16, dark);
    if (m.cls === 'super' || m.cls === 'sports') {
      add(0, beltY + cabH * 0.62, -L * 0.45, W * 0.86, 0.09, 0.42, dark);
      for (const sd of [-1, 1]) add(sd * W * 0.36, beltY + cabH * 0.42, -L * 0.45, 0.09, 0.28, 0.28, dark);
    }
  }

  // pare-chocs, phares ronds, feux
  const noseZ = L / 2 - 0.12, tailZ = -L / 2 + 0.12;
  add(0, floor + bodyH * 0.28, noseZ, W * 0.98, bodyH * 0.3, 0.22, dark);
  add(0, floor + bodyH * 0.28, tailZ, W * 0.98, bodyH * 0.3, 0.22, dark);
  add(0, floor + bodyH * 0.34, noseZ - 0.03, bodyH * 0.44, W * 0.95, bodyH * 0.44, 'skirt',
    { shape: 'cyl', rz: Math.PI / 2 });                                    // nez adouci
  add(0, floor + bodyH * 0.34, tailZ + 0.03, bodyH * 0.42, W * 0.95, bodyH * 0.42, 'skirt',
    { shape: 'cyl', rz: Math.PI / 2 });                                    // poupe adoucie
  for (const s of [-1, 1]) {
    add(s * W * 0.31, floor + bodyH * 0.52, noseZ + 0.03, bodyH * 0.19, bodyH * 0.19, bodyH * 0.19,
      'head', { shape: 'ball' });
    add(s * W * 0.34, floor + bodyH * 0.55, tailZ - 0.03, W * 0.22, bodyH * 0.16, 0.1, 'tail');
  }
  // ailes : un tube en travers, juste au-dessus de chaque roue
  for (const [sx2, sz2] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    add(sx2 * (W / 2 + 0.05), wheelR * 0.98, sz2 * L * 0.33, wheelR * 2.25, 0.14, wheelR * 2.25,
      'skirt', { shape: 'cyl', rz: Math.PI / 2 });
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
  const wx = W / 2 - 0.05, wz = L * 0.33;      // la roue affleure l'aile : c'est ce qui donne l'assise
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    wheels.push({ x: sx * wx, y: wheelR, z: sz * wz, r: wheelR, w: m.cls === 'truck' || m.cls === 'bus' ? 0.34 : 0.26, front: sz > 0 });
  }
  return finish(p, m, wheels, wheelR, floor, bodyH);
}

function finish(parts, m, wheels, wheelR, floor, bodyH) {
  const out = { parts, wheels, wheelR, floor, bodyH: bodyH === undefined ? m.h - floor : bodyH };
  partCache.set(m.key, out);
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
  get kmh() { return (this.model.fly ? Math.hypot(this.vx, this.vz) : Math.abs(this.speed)) * 3.6; }

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
      // une épave n'a plus à être protégée : sans cela les voitures de police
      // détruites s'accumulaient indéfiniment sur la carte.
      this.persistent = false;
      this.parked = false;
    }
  }

  update(dt, world, game) {
    const m = this.model;
    if (m.fly) return this.updateFlight(dt, world, game);
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

    // Anti-tunnel : à pleine vitesse la voiture avance de plus d'un mètre par
    // image et pouvait franchir un mur avant qu'on ne teste ses coins.
    const pas = Math.hypot(this.x - px, this.z - pz);
    if (pas > 0.9) {
      const inv = 1 / pas;
      const t = world.raycast(px, this.y + 0.7, pz, (this.x - px) * inv, 0, (this.z - pz) * inv, pas + this.hl);
      if (t < pas + this.hl) {
        const recul = Math.max(0, t - this.hl);
        this.x = px + (this.x - px) * inv * recul;
        this.z = pz + (this.z - pz) * inv * recul;
      }
    }

    // collisions avec le décor : quatre coins et le milieu des flancs
    let hit = null;
    const cs = Math.sin(this.yaw), cc = Math.cos(this.yaw);
    for (const [ox, oz] of [[-1, 1], [1, 1], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, 1], [0, -1]]) {
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
    if (this.x < -700) {
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

  /**
   * Vol d'hélicoptère, façon arcade : le collectif donne la portance, le
   * tangage penche l'appareil vers l'avant (ce qui le fait avancer), le lacet
   * fait pivoter. Sans commande, l'appareil tient son altitude tout seul.
   */
  updateFlight(dt, world, game) {
    const m = this.model;
    this.rotorSpin = (this.rotorSpin || 0) + dt * (this.dead ? 6 : 26) * (this.engineOn ? 1 : 0.25);
    this.engineOn = !this.dead && (this.driver || this.occupants.length > 0 || this.y > 0.6);

    if (this.dead) {
      this.vy -= 16 * dt;
      this.pitch += dt * 1.2;
      this.yaw += dt * 3;
    } else {
      const col = clamp(this.collective || 0, -1, 1);
      const targetPitch = clamp(-(this.pitchInput || 0) * 0.42, -0.42, 0.42);
      const targetRoll = clamp(-(this.yawInput || 0) * 0.35, -0.35, 0.35);
      this.pitch = damp(this.pitch, targetPitch, 2.6, dt);
      this.roll = damp(this.roll, targetRoll, 2.6, dt);
      this.yaw += (this.yawInput || 0) * 1.15 * dt;

      // portance : 9,81 pour tenir en vol stationnaire, plus ou moins selon le collectif
      const lift = 9.81 + col * 12 - (this.y < 0.4 && col <= 0 ? 9.81 : 0);
      this.vy = (this.vy || 0) + (lift - 9.81) * dt;
      this.vy -= this.vy * 0.9 * dt;
      if (col === 0) this.vy = damp(this.vy, 0, 1.4, dt);

      // l'assiette pousse l'appareil
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      const accF = -Math.sin(this.pitch) * 30;
      const accR = Math.sin(this.roll) * 18;
      this.vx += (fx * accF + rx * accR) * dt;
      this.vz += (fz * accF + rz * accR) * dt;
      const drag = Math.exp(-0.55 * dt);
      this.vx *= drag; this.vz *= drag;
      const sp = Math.hypot(this.vx, this.vz);
      if (sp > m.top) { this.vx = (this.vx / sp) * m.top; this.vz = (this.vz / sp) * m.top; }
      this.speed = this.vx * fx + this.vz * fz;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;

    // sol
    if (this.y <= 0) {
      const impact = -this.vy;
      this.y = 0;
      if (impact > 6) { this.damage(impact * 22); if (game) game.onCrash(this, impact, this.x, 1, this.z); }
      this.vy = 0;
      this.vx *= Math.exp(-4 * dt);
      this.vz *= Math.exp(-4 * dt);
      this.pitch = damp(this.pitch, 0, 4, dt);
      this.roll = damp(this.roll, 0, 4, dt);
      if (this.dead && !this.exploded && game) { this.exploded = true; game.explode(this.x, 1.5, this.z, 16, this); }
    }

    // immeubles : le rotor n'aime pas le béton
    const p = { x: this.x, z: this.z };
    const hit = world.pushCircle(p, 3.2, Math.max(2, this.y + 2));
    if (hit && this.y < 220) {
      this.x = p.x; this.z = p.z;
      const vn = this.vx * hit.nx + this.vz * hit.nz;
      if (vn < 0) {
        this.vx -= hit.nx * vn * 1.2;
        this.vz -= hit.nz * vn * 1.2;
        const force = Math.abs(vn);
        if (force > 3) { this.damage(force * 26); if (game) game.onCrash(this, force, this.x, this.y, this.z); }
      }
    }
    const B = 1080;
    this.x = clamp(this.x, -B, B);
    this.z = clamp(this.z, -B, B);
    this.y = Math.min(this.y, 340);
    this.sirenPhase += dt;
    if (this.horn > 0) this.horn -= dt;
    if (this.dead) this.burnTime += dt;
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
        case 'head': c = lightsOn ? [1, 0.97, 0.85] : [0.5, 0.52, 0.5]; emit = lightsOn ? 1 : 0; break;
        case 'tail': c = [0.8, 0.1, 0.08]; emit = braking ? 1 : (lightsOn ? 0.45 : 0.08); break;
        case 'sign': c = [1, 0.85, 0.2]; emit = 0.9; break;
        case 'rotor': case 'tailrotor': c = [0.16, 0.16, 0.18]; break;
        case 'lightbarL': case 'lightbarR': {
          const blink = this.siren ? (Math.sin(this.sirenPhase * 14 + (p.c === 'lightbarL' ? 0 : Math.PI)) > 0 ? 1 : 0.05) : 0.06;
          c = p.c === 'lightbarL' ? [0.2, 0.35, 1] : [1, 0.15, 0.12];
          emit = blink;
          break;
        }
        default: c = typeof p.c === 'string' ? color(p.c) : p.c;
      }
      const half = p.c === 'lightbarL' ? -1 : p.c === 'lightbarR' ? 1 : 0;
      let ry = p.ry || 0;
      let rz = p.rz || 0;
      if (p.c === 'rotor') ry = this.rotorSpin || 0;
      if (p.c === 'tailrotor') rz = (this.rotorSpin || 0) * 1.7;
      m4compose(this.tmp, p.x + half * p.sx * 0.26, p.y, p.z,
        ry, half ? p.sx * 0.48 : p.sx, p.sy, p.sz, p.rx || 0, rz);
      m4mul(this.out, this.mat, this.tmp);
      if (p.shape === 'cyl') R.cyl(this.out, c, emit);
      else if (p.shape === 'ball') R.sphere(this.out, c, emit);
      else R.cube(this.out, c, emit);
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
      m4compose(this.tmp, w.x * 1.02, w.y, w.z, st, w.r * 0.62, w.w * 1.03, w.r * 0.62, this.wheelSpin, Math.PI / 2);
      m4mul(this.out, this.mat, this.tmp);
      R.cyl(this.out, [0.58, 0.60, 0.64]);
      // écrou central : il rend la rotation lisible
      m4compose(this.tmp, w.x * 1.03, w.y, w.z, st, w.r * 0.19, w.w * 1.07, w.r * 0.19, this.wheelSpin, Math.PI / 2);
      m4mul(this.out, this.mat, this.tmp);
      R.cyl(this.out, [0.3, 0.31, 0.33]);
    }
  }
}

export function randomCivilianModel(rand) {
  return pick(rand, CIVILIAN_MODELS);
}
