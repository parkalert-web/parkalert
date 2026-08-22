/**
 * Boucle de jeu : monde, entités, combat, police, missions, cycle jour/nuit,
 * particules, interactions et états (pause, carte, mort, boutiques).
 */
import { Renderer } from './engine/renderer.js';
import { Input, setupTouchControls } from './engine/input.js';
import { AudioEngine } from './engine/audio.js';
import { generateWorld, zoneAt, densityAt } from './world/gen.js';
import { buildWorldGeometry } from './world/build.js';
import { World } from './world/collide.js';
import { Vehicle, MODELS } from './entities/vehicle.js';
import { Ped } from './entities/character.js';
import { Player, CHARACTERS } from './entities/player.js';
import { Camera } from './systems/camera.js';
import { Population } from './systems/traffic.js';
import { PoliceSystem } from './systems/police.js';
import { MissionSystem, MISSIONS } from './systems/missions.js';
import { HUD } from './systems/hud.js';
import { WEAPONS, WEAPON_ORDER, raycastScene, Projectile } from './systems/weapons.js';
import {
  m4, m4compose, clamp, lerp, damp, rng, range, pick, dist2D, color, mixColor, TAU,
} from './engine/math.js';

/* --------------------------------------------------- ambiances horaires */

const SKY_KEYS = [
  { h: 0, top: '#050a18', hor: '#0d1526', fog: '#141e30', sun: '#3a4a70', amb: '#2a3450', gnd: '#3a2c1c', night: 1 },
  { h: 5, top: '#132038', hor: '#3b3350', fog: '#3a3346', sun: '#6a5a70', amb: '#2c3450', gnd: '#362a1c', night: 0.8 },
  { h: 6.5, top: '#2d5a8f', hor: '#e8905a', fog: '#d68f6a', sun: '#ffa564', amb: '#6a5c62', gnd: '#3a2e26', night: 0.15 },
  { h: 9, top: '#2f7ac4', hor: '#a8cbe0', fog: '#b6cddc', sun: '#fff2dc', amb: '#7d92ab', gnd: '#4a4238', night: 0 },
  { h: 13, top: '#2a76c8', hor: '#bcd8ea', fog: '#c3d9e6', sun: '#fff8e8', amb: '#8ba2ba', gnd: '#524838', night: 0 },
  { h: 17, top: '#3070b4', hor: '#dcc39a', fog: '#d3c0a4', sun: '#ffe4b4', amb: '#7c88a0', gnd: '#4a4030', night: 0 },
  { h: 19, top: '#1e3c6e', hor: '#e07840', fog: '#c07a55', sun: '#ff8a48', amb: '#54546a', gnd: '#2a2422', night: 0.35 },
  { h: 21, top: '#0a1228', hor: '#1e2440', fog: '#1e2740', sun: '#38486c', amb: '#28324c', gnd: '#382a1a', night: 0.9 },
  { h: 24, top: '#050a18', hor: '#0d1526', fog: '#141e30', sun: '#3a4a70', amb: '#2a3450', gnd: '#3a2c1c', night: 1 },
];

function envAt(hour) {
  let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (hour >= SKY_KEYS[i].h && hour <= SKY_KEYS[i + 1].h) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
  }
  const t = clamp((hour - a.h) / Math.max(0.001, b.h - a.h), 0, 1);
  const mix = (k) => mixColor(color(a[k]), color(b[k]), t);
  const night = lerp(a.night, b.night, t);
  // course du soleil : lever à l'est (6 h), coucher à l'ouest (18 h)
  const day = clamp((hour - 6) / 12, 0, 1);
  const ang = day * Math.PI;
  let sx = Math.cos(ang), sy = Math.sin(ang) * 0.98 + 0.02, sz = -0.32;
  if (hour < 6 || hour > 18) {                       // lune
    const nAng = ((hour + 6) % 12) / 12 * Math.PI;
    sx = -Math.cos(nAng); sy = Math.sin(nAng) * 0.8 + 0.1; sz = 0.3;
  }
  const l = Math.hypot(sx, sy, sz);
  return {
    sunDir: [sx / l, sy / l, sz / l],
    sunColor: mix('sun'),
    skyTop: mix('top'),
    skyHorizon: mix('hor'),
    fogColor: mix('fog'),
    ambSky: mix('amb'),
    ambGround: mix('gnd'),
    waterDeep: mixColor(color('#0a2233'), color('#123d52'), 1 - night),
    fogDensity: lerp(0.0016, 0.0011, 1 - night),
    emitBoost: night * 1.15,
    night,
    water: true,
    shoreX: -740,
    shadowRange: 95,
  };
}

/* ---------------------------------------------------------------- météo */

const WEATHERS = [
  { kind: 'clear', weight: 5, rain: 0, cloud: 0.25 },
  { kind: 'cloudy', weight: 3, rain: 0, cloud: 0.85 },
  { kind: 'overcast', weight: 2, rain: 0.12, cloud: 1 },
  { kind: 'rain', weight: 2, rain: 1, cloud: 1 },
  { kind: 'storm', weight: 1, rain: 1.4, cloud: 1, thunder: true },
];

/* ------------------------------------------------------------- particules */

class Particles {
  constructor() { this.list = []; }
  spawn(x, y, z, vx, vy, vz, size, life, col, opts = {}) {
    if (this.list.length > 1400) return;
    this.list.push({
      x, y, z, vx, vy, vz, size, life, max: life, col,
      grow: opts.grow || 0, gravity: opts.gravity ?? -1.2, drag: opts.drag ?? 0.6,
      fade: opts.fade ?? 1, glow: opts.glow || 0,
    });
  }
  update(dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life -= dt;
      if (p.life <= 0) { l[i] = l[l.length - 1]; l.pop(); continue; }
      p.vy += p.gravity * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vz *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.05) { p.y = 0.05; p.vy = 0; p.vx *= 0.85; p.vz *= 0.85; }
      p.size += p.grow * dt;
    }
  }
  draw(R) {
    for (const p of this.list) {
      const t = p.life / p.max;
      R.particle(p.x, p.y, p.z, p.size, p.col[0], p.col[1], p.col[2], clamp(t * p.fade, 0, 1));
    }
  }
}

/* -------------------------------------------------------------------- jeu */

export class Game {
  constructor(canvas, root, onProgress) {
    this.canvas = canvas;
    this.root = root;
    this.onProgress = onProgress || (() => {});
    this.state = 'loading';
    this.time = 0;
    this.hour = 9.2;
    this.timeScale = 1;
    this.paused = false;
    this.threatLevel = 0;
    this.cinematic = 0;
    this.fade = 0;
    this.cameraMode = 0;
    this.stats = { kills: 0, deaths: 0, distance: 0, crashes: 0, stolen: 0, missions: 0, spent: 0 };
    this.cheatBuffer = '';
    this.weather = { kind: 'clear', rain: 0, wet: 0, wind: 0.4, timer: 150, flash: 0, nextFlash: 6 };
    this.raindrops = null;
    this.shopOpen = null;
    this.frameCount = 0;
    this.fps = 60;
    this.adaptiveQuality = true;
    this.drawDistance = 420;
  }

  async load() {
    const step = async (label, pct, fn) => {
      this.onProgress(label, pct);
      await new Promise((r) => setTimeout(r, 12));
      return fn();
    };
    this.renderer = await step('Initialisation du moteur', 5, () => new Renderer(this.canvas));
    this.data = await step('Plan de Los Santos', 18, () => generateWorld(20130917));
    this.world = await step('Collisions', 30, () => new World(this.data));
    const chunks = await step('Construction de la ville', 45, () => buildWorldGeometry(this.data));
    await step('Envoi vers la carte graphique', 78, () => this.renderer.setStatic(chunks));
    await step('Habitants et véhicules', 88, () => this.initEntities());
    await step('Prêt', 100, () => {});
  }

  initEntities() {
    this.audio = new AudioEngine();
    this.input = new Input(this.canvas);
    this.camera = new Camera();
    this.player = new Player('franklin');
    this.peds = [];
    this.vehicles = [];
    this.projectiles = [];
    this.particles = new Particles();
    this.tracers = [];
    this.pickups = [];
    this.population = new Population(this);
    this.police = new PoliceSystem(this);
    this.missions = new MissionSystem(this);
    this.hud = new HUD(this, this.root);
    this.rand = rng(999);

    this.player.x = 196;
    this.player.z = 371;
    this.camera.yaw = -Math.PI / 2;

    // véhicule personnel garé le long du trottoir
    const v = new Vehicle('dominator', 184.5, 378, 0, { parked: true });
    v.persistent = true;
    this.vehicles.push(v);

    for (const key of ['pistol']) this.player.giveWeapon(key, 120);
    this.setupPickups();
    this.indexLights();
    setupTouchControls(this.input, this.root, this);
    this.bindKeys();
  }

  /** Grille des sources lumineuses de la ville, pour l'éclairage de nuit. */
  indexLights() {
    this.lampGrid = new Map();
    const cell = 90;
    for (const pr of this.data.props) {
      if (pr.kind !== 'lamp' && pr.kind !== 'billboard') continue;
      const k = `${Math.floor(pr.x / cell)},${Math.floor(pr.z / cell)}`;
      let a = this.lampGrid.get(k);
      if (!a) { a = []; this.lampGrid.set(k, a); }
      if (pr.kind === 'lamp') {
        a.push({ x: pr.x + Math.cos(pr.r) * 1.7, z: pr.z + Math.sin(pr.r) * 1.7, y: 7, kind: 'lamp' });
      } else {
        a.push({ x: pr.x, z: pr.z, y: pr.y + 2.6, kind: 'sign', c: pr.c });
      }
    }
    this.lampCell = cell;
  }

  nearbyLights(x, z, radius) {
    const cell = this.lampCell;
    const out = [];
    const x0 = Math.floor((x - radius) / cell), x1 = Math.floor((x + radius) / cell);
    const z0 = Math.floor((z - radius) / cell), z1 = Math.floor((z + radius) / cell);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const a = this.lampGrid.get(`${cx},${cz}`);
        if (a) for (const l of a) out.push(l);
      }
    }
    return out;
  }

  setupPickups() {
    // gilets et soins répartis dans la ville
    const spots = [
      { kind: 'armor', x: -240, z: 180 }, { kind: 'armor', x: 320, z: -220 },
      { kind: 'health', x: 40, z: 100 }, { kind: 'health', x: -420, z: -60 },
      { kind: 'health', x: 240, z: 300 }, { kind: 'armor', x: 60, z: -330 },
      { kind: 'money', x: -150, z: 260 }, { kind: 'money', x: 430, z: 60 },
    ];
    for (const s of spots) this.pickups.push({ ...s, active: true, t: 0 });
    for (const l of this.data.landmarks) {
      if (!l.entrance) continue;
      if (l.kind === 'ammunation') this.pickups.push({ kind: 'shop-guns', ...l.entrance, active: true, t: 0 });
      if (l.kind === 'hospital') this.pickups.push({ kind: 'shop-health', ...l.entrance, active: true, t: 0 });
      if (l.kind === 'garage') this.garage = { ...l.street };
    }
  }

  bindKeys() {
    addEventListener('keydown', (e) => {
      if (this.state !== 'play') return;
      const k = e.key.toUpperCase();
      if (k.length === 1 && k >= 'A' && k <= 'Z') {
        this.cheatBuffer = (this.cheatBuffer + k).slice(-14);
        this.checkCheats();
      }
    });
  }

  checkCheats() {
    const CHEATS = {
      SANTE: () => { this.player.health = this.player.maxHealth; this.player.armor = 100; this.notify('Triche', 'Santé et gilet au maximum'); },
      ARSENAL: () => { for (const w of WEAPON_ORDER) this.player.giveWeapon(w, 500); this.notify('Triche', 'Arsenal complet'); },
      RECHERCHE: () => { this.police.addWanted(1, 'Triche'); },
      AVOCAT: () => { this.police.clear(); this.notify('Triche', 'Indice de recherche effacé'); },
      FORTUNE: () => { this.player.money += 250000; this.notify('Triche', '+250 000 $'); },
      BOLIDE: () => { this.spawnCheatVehicle('adder'); },
      TANK: () => { this.spawnCheatVehicle('firetruck'); },
      NUIT: () => { this.hour = 22; this.notify('Triche', 'Il fait nuit'); },
      JOUR: () => { this.hour = 12; this.notify('Triche', 'Il fait jour'); },
      RALENTI: () => { this.cheatSlow = !this.cheatSlow; this.notify('Triche', this.cheatSlow ? 'Ralenti activé' : 'Ralenti désactivé'); },
    };
    for (const k of Object.keys(CHEATS)) {
      if (this.cheatBuffer.endsWith(k)) {
        CHEATS[k]();
        this.audio.ui(900, 0.1, 0.15);
        this.cheatBuffer = '';
    this.weather = { kind: 'clear', rain: 0, wet: 0, wind: 0.4, timer: 150, flash: 0, nextFlash: 6 };
    this.raindrops = null;
        return;
      }
    }
  }

  spawnCheatVehicle(key) {
    const p = this.player;
    const yaw = this.camera.yaw;
    const v = new Vehicle(key, p.x + Math.sin(yaw) * 7, p.z + Math.cos(yaw) * 7, yaw + Math.PI / 2, { parked: true });
    v.persistent = true;
    this.vehicles.push(v);
    this.notify('Triche', `${v.model.name} livrée`);
  }

  start() {
    this.state = 'play';
    this.last = performance.now();
    this.hud.setObjective('');
    this.notify('Bienvenue à Los Santos', 'F pour monter dans un véhicule · Échap pour le menu');
    requestAnimationFrame(this.frame);
  }

  /* ------------------------------------------------------------- interactions */

  notify(title, sub) { this.hud.notify(title, sub); }
  showBanner(t, s, c) { this.hud.banner(t, s, c); }

  /** Fait apparaître un piéton à un endroit précis (missions, scripts, tests). */
  spawnPedAt(x, z, opts = {}) {
    const ped = new Ped(x, z, this.rand, opts);
    const p = { x, z };
    this.world.pushCircle(p, 0.45, 2);
    ped.x = p.x; ped.z = p.z;
    if (opts.hostile || opts.cop) ped.combatTarget = this.player;
    this.peds.push(ped);
    return ped;
  }

  nearestVehicle(x, z, maxD = 5.5) {
    let best = null, bd = maxD;
    for (const v of this.vehicles) {
      if (v.dead) continue;
      const d = dist2D(v.x, v.z, x, z) - v.model.len * 0.35;
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  tryEnterVehicle() {
    const p = this.player;
    if (p.enterCooldown > 0) return;
    if (p.vehicle) { p.exitVehicle(this.world); this.audio.ui(300, 0.06, 0.08); return; }
    const v = this.nearestVehicle(p.x, p.z, 6);
    if (!v) return;
    // éjection du conducteur
    const driver = v.driverPed;
    if (driver && !driver.dead) {
      driver.inVehicle = null;
      driver.x = v.x + Math.cos(v.yaw) * 2.2;
      driver.z = v.z - Math.sin(v.yaw) * 2.2;
      driver.state = 'flee';
      driver.panic = 1;
      v.driverPed = null;
      v.occupants = v.occupants.filter((o) => o !== driver);
      this.stats.stolen++;
      this.crime('vol de véhicule', 1, v.x, v.z);
    } else if (v.ai && v.ai.chase) {
      this.crime('vol de véhicule de police', 2, v.x, v.z);
    }
    v.ai = null;
    p.enterVehicle(v, 0);
    this.audio.resume();
    this.audio.ui(420, 0.06, 0.08);
  }

  /** Un délit visible fait monter l'indice de recherche. */
  crime(reason, stars, x, z) {
    let witness = false;
    for (const c of this.peds) {
      if (c.dead) continue;
      if ((c.cop || !c.hostile) && dist2D(c.x, c.z, x, z) < 55 && this.world.visible(c.x, 1.5, c.z, x, 1.2, z)) {
        witness = true;
        if (!c.cop) { c.state = 'flee'; c.panic = 1; }
      }
    }
    for (const v of this.vehicles) {
      if (v.ai && v.ai.chase && dist2D(v.x, v.z, x, z) < 80) witness = true;
    }
    if (witness || this.player.wanted > 0) this.police.addWanted(stars, reason);
    this.threatLevel = 2.5;
  }

  onCrash(v, impact, x, y, z) {
    this.audio.impact(impact, x, z);
    if (v === this.player.vehicle) {
      this.camera.addShake(clamp(impact / 26, 0, 0.7));
      this.stats.crashes++;
    }
    for (let i = 0; i < clamp(impact / 3, 1, 8); i++) {
      this.particles.spawn(x, y, z,
        range(this.rand, -3, 3), range(this.rand, 0.5, 4), range(this.rand, -3, 3),
        0.18, 0.5, [1, 0.8, 0.35], { gravity: -8, drag: 1.4, glow: 1 });
    }
  }

  onPedKilled(ped, byPlayer) {
    this.particles.spawn(ped.x, 1.2, ped.z, 0, 0.6, 0, 0.5, 0.7, [0.5, 0.05, 0.05], { gravity: -2 });
    if (!byPlayer) return;
    this.stats.kills++;
    if (ped.mission || ped.hostile) return;
    if (ped.cop) {
      this.police.addWanted(this.player.wanted < 3 ? 3 - this.player.wanted : 1, 'Policier abattu');
    } else {
      this.crime('homicide', this.player.wanted === 0 ? 2 : 1, ped.x, ped.z);
    }
  }

  onPlayerHurt(v, src) {
    this.camera.addShake(clamp(v / 40, 0, 0.5));
    this.root.querySelector('#damage-flash').classList.add('on');
    clearTimeout(this._dmgTO);
    this._dmgTO = setTimeout(() => this.root.querySelector('#damage-flash').classList.remove('on'), 160);
  }

  onPlayerDied() {
    this.stats.deaths++;
    this.state = 'dead';
    this.deadT = 0;
    this.showBanner('MORT', 'Vous vous réveillez à l’hôpital', '#c0392b');
    this.audio.ui(120, 0.9, 0.2);
    if (this.missions.active) this.missions.fail('Vous êtes mort');
  }

  busted() {
    this.state = 'busted';
    this.deadT = 0;
    this.showBanner('ARRÊTÉ', 'La police vous relâche… sans vos armes lourdes', '#3b6fd0');
    this.audio.ui(200, 0.6, 0.2);
    if (this.missions.active) this.missions.fail('Vous avez été arrêté');
  }

  respawn(atPolice) {
    const p = this.player;
    const lm = this.data.landmarks.find((l) => l.kind === (atPolice ? 'police' : 'hospital'));
    const spot = lm && lm.entrance ? lm.entrance : lm;
    p.dead = false;
    p.deadT = 0;
    p.health = p.maxHealth * 0.6;
    p.armor = 0;
    p.money = Math.max(0, p.money - (atPolice ? 800 : 500));
    p.wanted = 0;
    this.police.clear();
    if (p.vehicle) p.exitVehicle(this.world);
    p.x = (spot ? spot.x : 0) + 6;
    p.z = (spot ? spot.z : 0) - 3;
    p.vx = 0; p.vz = 0;
    if (atPolice) {
      for (const k of ['rifle', 'sniper', 'rpg', 'shotgun', 'smg']) p.owned[k] = false;
      p.weapon = 'pistol';
    }
    this.state = 'play';
    this.fade = 1;
  }

  /* ------------------------------------------------------------------ combat */

  /** Point visé au centre de l'écran. */
  aimTarget() {
    const c = this.camera;
    const [dx, dy, dz] = c.aimRay();
    const hit = raycastScene(this, c.eye[0], c.eye[1], c.eye[2], dx, dy, dz, 320, this.player);
    return [hit.x, hit.y, hit.z, hit];
  }

  playerFire() {
    const p = this.player;
    const w = p.weaponDef;
    if (!p.canFire()) {
      if (!w.melee && p.mags[p.weapon] === 0 && p.ammo[p.weapon] === 0 && p.fireCooldown <= 0) {
        this.audio.ui(160, 0.05, 0.08);
        p.fireCooldown = 0.4;
      }
      return;
    }
    p.consumeAmmo();

    const originY = p.vehicle ? p.vehicle.y + 1.1 : 1.32;
    const yaw = p.vehicle ? this.camera.yaw : p.yaw;
    const ox = p.x + Math.sin(yaw) * 0.5 + Math.cos(yaw) * 0.3;
    const oz = p.z + Math.cos(yaw) * 0.5 - Math.sin(yaw) * 0.3;

    if (w.melee) {
      let hitSomething = false;
      for (const ped of this.peds) {
        if (ped.dead) continue;
        const d = dist2D(ped.x, ped.z, p.x, p.z);
        const a = Math.atan2(ped.x - p.x, ped.z - p.z);
        if (d < w.range && Math.abs(Math.atan2(Math.sin(a - p.yaw), Math.cos(a - p.yaw))) < 1) {
          const killed = ped.damage(w.dmg * (p.character === 'trevor' && p.abilityActive > 0 ? 2 : 1), this, true, false);
          ped.vx = Math.sin(p.yaw) * 4; ped.vz = Math.cos(p.yaw) * 4;
          hitSomething = true;
          this.audio.impact(6, ped.x, ped.z);
          if (!killed) this.crime('agression', p.wanted === 0 ? 1 : 0, ped.x, ped.z);
        }
      }
      const v = this.nearestVehicle(p.x + Math.sin(p.yaw) * 1.6, p.z + Math.cos(p.yaw) * 1.6, 2.4);
      if (v) { v.damage(20); this.audio.impact(5, v.x, v.z); hitSomething = true; }
      if (!hitSomething) this.audio.noise && this.audio.ready && this.audio.noise(0.07, 0.05, 'bandpass', 500, 1, 0);
      this.camera.addShake(0.05);
      return;
    }

    const [tx, ty, tz] = this.aimTarget();
    const pellets = w.pellets || 1;
    const dmgMul = (p.character === 'trevor' && p.abilityActive > 0) ? 2 : 1;
    for (let i = 0; i < pellets; i++) {
      let dx = tx - ox, dy = ty - originY, dz = tz - oz;
      const l = Math.hypot(dx, dy, dz) || 1;
      dx /= l; dy /= l; dz /= l;
      const s = w.spread * (p.aiming ? 0.55 : 1) * (p.vehicle ? 2.2 : 1);
      dx += range(this.rand, -s, s); dy += range(this.rand, -s, s); dz += range(this.rand, -s, s);
      const l2 = Math.hypot(dx, dy, dz);
      dx /= l2; dy /= l2; dz /= l2;

      if (w.projectile) {
        const speed = w.projectile === 'rocket' ? 62 : 22;
        const pr = new Projectile(w.projectile, ox, originY, oz,
          dx * speed, dy * speed + (w.projectile === 'grenade' ? 5 : 0), dz * speed, p);
        this.projectiles.push(pr);
        break;
      }

      const hit = raycastScene(this, ox, originY, oz, dx, dy, dz, w.range, p);
      this.tracers.push({ x1: ox, y1: originY, z1: oz, x2: hit.x, y2: hit.y, z2: hit.z, life: 0.055 });
      this.impactEffect(hit, dx, dy, dz);
      if (hit.type === 'ped') {
        const dead = hit.ent.damage(w.dmg * dmgMul, this, true, hit.head);
        if (!dead && !hit.ent.hostile && !hit.ent.cop) this.crime('agression', p.wanted === 0 ? 1 : 0, hit.ent.x, hit.ent.z);
        if (dead && hit.head) this.notify('Tir à la tête', '');
      } else if (hit.type === 'vehicle') {
        hit.ent.damage(w.dmg * 0.55 * dmgMul);
        if (hit.ent.ai && hit.ent.ai.chase) this.police.addWanted(0, '');
      }
    }
    this.audio.gunshot(p.weapon, p.x, p.z);
    this.camera.addShake(w.slot >= 5 ? 0.4 : w.slot >= 3 ? 0.22 : 0.12);
    this.threatLevel = 3;
    if (w.noise) this.crime('coups de feu', p.wanted === 0 ? 1 : 0, p.x, p.z);
  }

  impactEffect(hit, dx, dy, dz) {
    const col = hit.type === 'ped' || hit.type === 'player' ? [0.55, 0.05, 0.06]
      : hit.type === 'vehicle' ? [1, 0.85, 0.4] : [0.75, 0.72, 0.68];
    const n = hit.type === 'ped' ? 6 : 4;
    for (let i = 0; i < n; i++) {
      this.particles.spawn(hit.x, hit.y, hit.z,
        -dx * range(this.rand, 1, 5) + range(this.rand, -2, 2),
        -dy * 2 + range(this.rand, 0.5, 3.5),
        -dz * range(this.rand, 1, 5) + range(this.rand, -2, 2),
        hit.type === 'ped' ? 0.13 : 0.1, 0.35, col, { gravity: -9, drag: 1.6, glow: hit.type === 'vehicle' ? 1 : 0 });
    }
    if (hit.type === 'world' || hit.type === 'ground') {
      this.particles.spawn(hit.x, hit.y, hit.z, 0, 0.4, 0, 0.35, 0.5, [0.7, 0.68, 0.64], { gravity: 0.2, drag: 2, fade: 0.5, grow: 0.6 });
    }
  }

  /** Tir d'un PNJ vers une cible. */
  npcShoot(ped, target, dist) {
    this.npcShootFrom(ped.x, 1.45, ped.z, target, dist, ped.cop ? 'pistol' : 'smg', ped);
  }

  npcShootFrom(ox, oy, oz, target, dist, weapon, shooter) {
    const tx = target.x + range(this.rand, -0.6, 0.6);
    const ty = (target.vehicle ? target.vehicle.y + 0.9 : 1.2) + range(this.rand, -0.3, 0.4);
    const tz = target.z + range(this.rand, -0.6, 0.6);
    let dx = tx - ox, dy = ty - oy, dz = tz - oz;
    const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l; dy /= l; dz /= l;
    const hit = raycastScene(this, ox, oy, oz, dx, dy, dz, 120, shooter);
    this.tracers.push({ x1: ox, y1: oy, z1: oz, x2: hit.x, y2: hit.y, z2: hit.z, life: 0.05, enemy: true });
    this.audio.gunshot(weapon, ox, oz);
    this.impactEffect(hit, dx, dy, dz);
    const accuracy = clamp(1 - dist / 60, 0.15, 0.8);
    if (hit.type === 'player' && Math.random() < accuracy) {
      this.player.damage(WEAPONS[weapon].dmg * 0.55, this, { x: ox, z: oz });
    } else if (hit.type === 'vehicle' && this.player.vehicle === hit.ent) {
      hit.ent.damage(6);
      if (Math.random() < accuracy * 0.4) this.player.damage(4, this, { x: ox, z: oz });
    } else if (hit.type === 'ped') {
      hit.ent.damage(WEAPONS[weapon].dmg * 0.5, this, false, hit.head);
    }
  }

  explode(x, y, z, radius, sourceVehicle, owner) {
    this.audio.explosion(x, z);
    this.camera.addShake(clamp(1.4 - dist2D(x, z, this.player.x, this.player.z) / 60, 0, 1));
    for (let i = 0; i < 26; i++) {
      const a = this.rand() * TAU, sp = range(this.rand, 2, 16);
      this.particles.spawn(x, y + range(this.rand, 0, 2), z,
        Math.cos(a) * sp, range(this.rand, 3, 13), Math.sin(a) * sp,
        range(this.rand, 0.7, 2.2), range(this.rand, 0.5, 1.3),
        i % 3 === 0 ? [1, 0.55, 0.12] : [1, 0.82, 0.3],
        { gravity: 2.6, drag: 1.1, grow: 2.4, glow: 1 });
    }
    for (let i = 0; i < 18; i++) {
      const a = this.rand() * TAU, sp = range(this.rand, 1, 8);
      this.particles.spawn(x, y + 1, z, Math.cos(a) * sp, range(this.rand, 2, 7), Math.sin(a) * sp,
        range(this.rand, 1.4, 3.4), range(this.rand, 1.6, 3), [0.12, 0.12, 0.13],
        { gravity: 1.2, drag: 0.8, grow: 3.2, fade: 0.55 });
    }
    for (const v of this.vehicles) {
      const d = dist2D(v.x, v.z, x, z);
      if (d < radius * 2.2 && v !== sourceVehicle) {
        const f = 1 - clamp(d / (radius * 2.2), 0, 1);
        v.damage(340 * f);
        const a = Math.atan2(v.x - x, v.z - z);
        v.applyImpulse(Math.sin(a) * f * v.mass * 6, Math.cos(a) * f * v.mass * 6);
      }
    }
    for (const p of this.peds) {
      const d = dist2D(p.x, p.z, x, z);
      if (d < radius * 1.8 && !p.dead) {
        p.damage(180 * (1 - clamp(d / (radius * 1.8), 0, 1)), this, owner === this.player, false);
      }
    }
    const dp = dist2D(this.player.x, this.player.z, x, z);
    if (dp < radius * 1.8 && !this.player.dead) {
      this.player.damage(150 * (1 - clamp(dp / (radius * 1.8), 0, 1)), this, { x, z });
    }
    for (const h of this.police.helis) {
      if (dist2D(h.x, h.z, x, z) < radius * 1.5 && Math.abs(h.y - y) < radius * 1.5) h.damage(200, this);
    }
    if (owner === this.player) this.crime('explosion', this.player.wanted < 3 ? 3 - this.player.wanted : 0, x, z);
  }

  /* ------------------------------------------------------------- boutiques */

  checkPickups(dt) {
    const p = this.player;
    for (const pu of this.pickups) {
      pu.t += dt;
      if (!pu.active) {
        pu.respawn -= dt;
        if (pu.respawn <= 0) pu.active = true;
        continue;
      }
      const d = dist2D(p.x, p.z, pu.x, pu.z);
      if (d > 2.4 || !p.onFoot) continue;
      if (pu.kind === 'armor') {
        if (p.armor >= p.maxArmor) continue;
        p.armor = p.maxArmor; pu.active = false; pu.respawn = 90;
        this.notify('Gilet pare-balles', 'Protection maximale');
      } else if (pu.kind === 'health') {
        if (p.health >= p.maxHealth) continue;
        p.health = p.maxHealth; pu.active = false; pu.respawn = 90;
        this.notify('Trousse de soins', 'Santé rétablie');
      } else if (pu.kind === 'money') {
        p.money += 2500; pu.active = false; pu.respawn = 120;
        this.notify('Liasse trouvée', '+2 500 $');
      } else continue;
      this.audio.pickup(true);
    }

    // garage : réparation et effacement de l'indice de recherche
    if (this.garage && p.vehicle) {
      const d = dist2D(p.vehicle.x, p.vehicle.z, this.garage.x, this.garage.z);
      if (d < 11 && Math.abs(p.vehicle.speed) < 3 && !this.garageCooldown) {
        if (p.money >= 500) {
          p.money -= 500;
          p.vehicle.health = p.vehicle.maxHealth;
          p.vehicle.dead = false;
          p.vehicle.color = color(pick(this.rand, ['#b8352f', '#1f2933', '#e6e6e6', '#2f5fa8', '#2c7a4b', '#d9a02b']));
          this.police.clear();
          this.notify('Los Santos Customs', 'Réparation et nouvelle peinture — 500 $');
          this.audio.pickup(true);
          this.garageCooldown = 8;
        }
      }
    }
    if (this.garageCooldown) this.garageCooldown = Math.max(0, this.garageCooldown - dt);
  }

  openShop(kind) {
    this.shopOpen = kind;
    const el = this.root.querySelector('#shop');
    const p = this.player;
    const items = kind === 'guns' ? [
      { k: 'pistol', label: 'Pistolet + 90 balles', price: 400 },
      { k: 'smg', label: 'Micro-SMG + 180 balles', price: 2600 },
      { k: 'shotgun', label: 'Fusil à pompe + 40 cartouches', price: 3200 },
      { k: 'rifle', label: "Carabine d'assaut + 210 balles", price: 6800 },
      { k: 'sniper', label: 'Fusil de précision + 30 balles', price: 12000 },
      { k: 'rpg', label: 'Lance-roquettes + 8 roquettes', price: 26000 },
      { k: 'grenade', label: '10 grenades', price: 3000 },
      { k: 'bat', label: 'Batte de baseball', price: 200 },
      { k: 'armor', label: 'Gilet pare-balles', price: 1200 },
    ] : [
      { k: 'heal', label: 'Soins complets', price: 200 },
      { k: 'armor', label: 'Gilet pare-balles', price: 1200 },
    ];
    this.shopItems = items;
    el.querySelector('.shop-title').textContent = kind === 'guns' ? 'AMMU-NATION' : 'HÔPITAL DE LOS SANTOS';
    const list = el.querySelector('.shop-list');
    list.innerHTML = '';
    items.forEach((it, i) => {
      const d = document.createElement('div');
      d.className = 'shop-item';
      d.innerHTML = `<span class="si-key">${i + 1}</span><span class="si-label">${it.label}</span>
        <span class="si-price">$${it.price.toLocaleString('fr-FR')}</span>`;
      d.addEventListener('click', () => this.buy(i));
      list.appendChild(d);
    });
    el.classList.add('show');
    this.input.releaseLock();
  }

  buy(i) {
    const it = this.shopItems && this.shopItems[i];
    const p = this.player;
    if (!it) return;
    if (p.money < it.price) { this.audio.ui(160, 0.1, 0.12); this.notify('Fonds insuffisants', ''); return; }
    p.money -= it.price;
    this.stats.spent += it.price;
    if (it.k === 'armor') p.armor = p.maxArmor;
    else if (it.k === 'heal') p.health = p.maxHealth;
    else p.giveWeapon(it.k, WEAPONS[it.k].ammo || 0);
    this.audio.pickup(true);
    this.notify('Achat effectué', it.label);
  }

  closeShop() {
    this.shopOpen = null;
    this.root.querySelector('#shop').classList.remove('show');
    if (!this.paused) this.input.requestLock();
  }

  switchCharacter(key) {
    const p = this.player;
    if (p.character === key) { this.hud.showCharWheel(false); return; }
    if (p.vehicle) p.exitVehicle(this.world);
    p.setCharacter(key);
    const home = CHARACTERS[key].home;
    p.x = home.x + range(this.rand, -8, 8);
    p.z = home.z + 42;
    p.health = p.maxHealth;
    p.wanted = 0;
    this.police.clear();
    this.hud.showCharWheel(false);
    this.cinematic = 1.6;
    this.fade = 1;
    this.notify(CHARACTERS[key].full, CHARACTERS[key].hint);
    this.audio.ui(700, 0.14, 0.15);
  }

  /* ------------------------------------------------------------ boucle */

  frame = (now) => {
    requestAnimationFrame(this.frame);
    const raw = (now - this.last) / 1000;
    this.last = now;
    if (!raw) return;
    // Au-delà de 20 images/s d'écart on préfère ralentir le temps plutôt que
    // de laisser la physique traverser les murs.
    const dt = Math.min(0.05, raw);
    this.fps = lerp(this.fps, 1 / Math.max(raw, 0.001), 0.15);
    this.frameCount++;
    this.autoQuality(raw);

    this.input.begin();
    this.handleGlobalKeys();

    let scale = this.timeScale;
    if (this.paused || this.hud.mapOpen || this.shopOpen) scale = 0;
    const sdt = dt * scale;

    // Une image en erreur ne doit jamais figer les entrées : sans ce filet,
    // les touches restent « enfoncées » et le jeu devient incontrôlable.
    try {
      if (scale > 0) this.update(sdt, dt);
      this.render(dt);
    } catch (err) {
      this.errorCount = (this.errorCount || 0) + 1;
      if (this.errorCount < 6) console.error('Erreur pendant l’image :', err);
    } finally {
      this.input.end();
    }
  };

  /* ------------------------------------------------------------ sauvegarde */

  /**
   * La progression tient dans le navigateur : argent, armes, missions faites,
   * personnage courant, position et heure. Aucun serveur, aucun compte.
   */
  save() {
    const p = this.player;
    try {
      localStorage.setItem('losSantos.save', JSON.stringify({
        v: 1, at: Date.now(),
        money: Math.round(p.money), character: p.character,
        x: Math.round(p.x), z: Math.round(p.z),
        health: Math.round(p.health), armor: Math.round(p.armor),
        owned: p.owned, ammo: p.ammo, weapon: p.weapon,
        missions: [...this.missions.done],
        hour: +this.hour.toFixed(2),
        stats: this.stats,
        station: this.audio.station,
      }));
      this.lastSave = this.time;
      return true;
    } catch (e) {
      this.lastSave = this.time;        // navigation privée, quota plein…
      return false;
    }
  }

  /** Recharge la progression enregistrée. (Le monde, lui, est bâti par `load()`.) */
  loadSave() {
    let raw = null;
    try { raw = localStorage.getItem('losSantos.save'); } catch (e) { return false; }
    if (!raw) return false;
    let d = null;
    try { d = JSON.parse(raw); } catch (e) { return false; }
    if (!d || d.v !== 1) return false;
    const p = this.player;
    if (d.character && CHARACTERS[d.character]) p.setCharacter(d.character);
    if (Number.isFinite(d.money)) p.money = d.money;
    if (Number.isFinite(d.x) && Number.isFinite(d.z)) { p.x = d.x; p.z = d.z; }
    p.health = clamp(Number(d.health) || p.maxHealth, 1, p.maxHealth);
    p.armor = clamp(Number(d.armor) || 0, 0, p.maxArmor);
    if (d.owned) Object.assign(p.owned, d.owned);
    if (d.ammo) Object.assign(p.ammo, d.ammo);
    if (d.weapon && p.owned[d.weapon]) p.weapon = d.weapon;
    for (const id of d.missions || []) this.missions.done.add(id);
    if (Number.isFinite(d.hour)) this.hour = d.hour;
    if (d.stats) Object.assign(this.stats, d.stats);
    if (Number.isFinite(d.station)) this.audio.setStation(d.station);
    // on ne réapparaît jamais coincé dans un mur
    const q = { x: p.x, z: p.z };
    this.world.pushCircle(q, 0.5, 2);
    p.x = q.x; p.z = q.z;
    this.loaded = true;
    return true;
  }

  /** Efface la sauvegarde et repart de zéro. */
  newGame() {
    try { localStorage.removeItem('losSantos.save'); } catch (e) { /* rien à faire */ }
    location.reload();
  }

  /**
   * Qualité adaptative : sous 30 images/s on baisse la résolution de rendu puis
   * les ombres ; au-dessus de 55 on remonte. Évite le ralenti sur machine faible.
   */
  autoQuality(raw) {
    if (!this.adaptiveQuality) return;
    this.qAccum = (this.qAccum || 0) + raw;
    if (this.qAccum < 1.5) return;
    this.qAccum = 0;
    const R = this.renderer;
    if (this.fps < 28) {
      if (R.renderScale > 0.55) R.renderScale = Math.max(0.55, R.renderScale - 0.15);
      else if (R.shadowsOn) R.shadowsOn = false;
      else if (this.drawDistance > 190) this.drawDistance = 190;
    } else if (this.fps > 56) {
      if (!R.shadowsOn && this.userShadows !== false) R.shadowsOn = true;
      else if (R.renderScale < 1) R.renderScale = Math.min(1, R.renderScale + 0.1);
    }
  }

  handleGlobalKeys() {
    const i = this.input;
    if (i.hit('Escape')) {
      if (this.shopOpen) this.closeShop();
      else if (this.hud.mapOpen) this.hud.toggleMap(false);
      else this.togglePause();
    }
    if (this.paused) return;
    if (i.hit('KeyM')) {
      if (this.shopOpen) return;
      const open = this.hud.toggleMap();
      if (open) this.input.releaseLock(); else this.input.requestLock();
    }
    if (this.shopOpen) {
      for (let n = 1; n <= 9; n++) if (i.hit(`Digit${n}`)) this.buy(n - 1);
      if (i.hit('KeyE')) this.closeShop();
      return;
    }
    if (this.hud.mapOpen) return;
    if (this.state !== 'play') return;

    const p = this.player;
    if (i.hit('KeyF')) this.tryEnterVehicle();
    if (i.hit('KeyR')) p.startReload();
    if (i.hit('KeyV')) {
      this.cameraMode = (this.cameraMode + 1) % 3;
      this.notify('Caméra', ['Vue rapprochée', 'Vue large', 'Première personne'][this.cameraMode]);
    }
    if (i.hit('KeyE')) this.tryInteract();
    if (i.hit('Comma')) this.notify('Radio', this.audio.setStation(this.audio.station - 1));
    if (i.hit('Period')) this.notify('Radio', this.audio.setStation(this.audio.station + 1));
    if (i.hit('KeyX') || i.hit('CapsLock')) this.useAbility();
    for (let n = 1; n <= 9; n++) {
      if (i.hit(`Digit${n}`)) {
        const k = WEAPON_ORDER[n - 1];
        if (k && p.switchWeapon(k)) this.audio.ui(520, 0.04, 0.08);
      }
    }
    if (i.wheel) {
      const owned = WEAPON_ORDER.filter((k) => p.owned[k]);
      const idx = owned.indexOf(p.weapon);
      p.switchWeapon(owned[(idx + (i.wheel > 0 ? 1 : -1) + owned.length) % owned.length]);
    }
    // roues
    const wheel = i.down('Tab');
    if (wheel !== this.hud.wheelOpen) {
      this.hud.showWeaponWheel(wheel);
      if (wheel) this.input.releaseLock(); else this.input.requestLock();
    }
    const cw = i.down('KeyG');
    if (cw !== this.hud.charWheelOpen) {
      this.hud.showCharWheel(cw);
      if (cw) this.input.releaseLock(); else this.input.requestLock();
    }
    if (this.hud.charWheelOpen) {
      const keys = Object.keys(CHARACTERS);
      for (let n = 1; n <= 3; n++) if (i.hit(`Digit${n}`)) this.switchCharacter(keys[n - 1]);
    }
  }

  togglePause() {
    this.paused = !this.paused;
    this.root.querySelector('#pause').classList.toggle('show', this.paused);
    if (this.paused) {
      this.input.releaseLock();
      this.fillPauseStats();
      this.save();
    } else this.input.requestLock();
  }

  fillPauseStats() {
    const p = this.player;
    const s = this.stats;
    const el = this.root.querySelector('#pause-stats');
    const h = Math.floor(this.hour), mn = Math.floor((this.hour % 1) * 60);
    el.innerHTML = `
      <div><span>Personnage</span><b>${CHARACTERS[p.character].full}</b></div>
      <div><span>Argent</span><b>$${p.money.toLocaleString('fr-FR')}</b></div>
      <div><span>Quartier</span><b>${zoneAt(p.x, p.z)}</b></div>
      <div><span>Heure</span><b>${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}</b></div>
      <div><span>Missions réussies</span><b>${this.missions.done.size} / ${MISSIONS.length}</b></div>
      <div><span>Véhicules volés</span><b>${s.stolen}</b></div>
      <div><span>Distance parcourue</span><b>${(s.distance / 1000).toFixed(2)} km</b></div>
      <div><span>Éliminations</span><b>${s.kills}</b></div>
      <div><span>Morts</span><b>${s.deaths}</b></div>
      <div><span>Accidents</span><b>${s.crashes}</b></div>`;
  }

  tryInteract() {
    const p = this.player;
    if (!p.onFoot) return;
    for (const pu of this.pickups) {
      if (pu.kind.startsWith('shop-') && dist2D(p.x, p.z, pu.x, pu.z) < 4) {
        this.openShop(pu.kind === 'shop-guns' ? 'guns' : 'health');
        return;
      }
    }
  }

  useAbility() {
    const p = this.player;
    if (p.ability < 0.15 || p.abilityActive > 0) return;
    p.abilityActive = 6;
    this.notify(CHARACTERS[p.character].ability, CHARACTERS[p.character].hint);
    this.audio.ui(560, 0.25, 0.12);
  }

  /* --------------------------------------------------------------- update */

  /** Météo : dérive lente entre grand beau temps et orage. */
  updateWeather(dt) {
    const w = this.weather;
    w.timer -= dt;
    if (w.timer <= 0) {
      const total = WEATHERS.reduce((a, b) => a + b.weight, 0);
      let r = this.rand() * total;
      let next = WEATHERS[0];
      for (const c of WEATHERS) { r -= c.weight; if (r <= 0) { next = c; break; } }
      w.kind = next.kind;
      w.target = next;
      w.timer = range(this.rand, 110, 280);
      if (next.rain > 0.5) this.notify('Météo', 'La pluie arrive sur Los Santos');
    }
    const t = w.target || WEATHERS[0];
    w.rain = damp(w.rain, t.rain, 0.25, dt);
    w.cloud = damp(w.cloud === undefined ? 0.25 : w.cloud, t.cloud, 0.25, dt);
    w.wet = clamp(w.wet + (w.rain > 0.25 ? dt * 0.06 : -dt * 0.03), 0, 1);
    w.wind = damp(w.wind, 0.3 + w.rain * 0.8, 0.5, dt);
    // éclairs
    w.flash = Math.max(0, w.flash - dt * 4.5);
    if (t.thunder && w.rain > 0.6) {
      w.nextFlash -= dt;
      if (w.nextFlash <= 0) {
        w.nextFlash = range(this.rand, 4, 16);
        w.flash = 1;
        this.audio.explosion(this.player.x + range(this.rand, -200, 200), this.player.z + range(this.rand, -200, 200));
      }
    }
  }

  /** Gouttes de pluie autour de la caméra, recyclées en continu. */
  updateRain(dt) {
    const w = this.weather;
    if (w.rain < 0.02) { this.raindrops = null; return; }
    const n = Math.floor(520 * clamp(w.rain, 0, 1.4));
    if (!this.raindrops) this.raindrops = [];
    const cam = this.camera.eye;
    while (this.raindrops.length < n) {
      this.raindrops.push({
        x: cam[0] + range(this.rand, -26, 26),
        y: cam[1] + range(this.rand, 2, 22),
        z: cam[2] + range(this.rand, -26, 26),
      });
    }
    if (this.raindrops.length > n) this.raindrops.length = n;
    const fall = 26 + w.rain * 12;
    const wind = w.wind * 6;
    for (const d of this.raindrops) {
      d.y -= fall * dt;
      d.x += wind * dt;
      if (d.y < 0 || Math.abs(d.x - cam[0]) > 30 || Math.abs(d.z - cam[2]) > 30) {
        d.x = cam[0] + range(this.rand, -26, 26);
        d.y = cam[1] + range(this.rand, 10, 24);
        d.z = cam[2] + range(this.rand, -26, 26);
      }
    }
  }

  update(dt, realDt) {
    const p = this.player;
    this.time += dt;
    this.updateWeather(dt);
    this.hour = (this.hour + dt / 60) % 24;      // une journée = 24 minutes réelles
    this.threatLevel = Math.max(0, this.threatLevel - dt);
    this.fade = Math.max(0, this.fade - realDt * 1.4);
    this.cinematic = Math.max(0, this.cinematic - realDt);

    // ralenti : capacité spéciale ou triche
    let ts = 1;
    if (p.abilityActive > 0) {
      if (p.character === 'michael' && p.onFoot) ts = 0.42;
      if (p.character === 'franklin' && p.vehicle) ts = 0.45;
    }
    if (this.cheatSlow) ts = 0.35;
    this.timeScale = damp(this.timeScale, ts, 8, realDt);

    // caméra
    this.camera.input(this.input.lookDX, this.input.lookDY, 1);
    if (this.state === 'play' && !p.dead) {
      p.aiming = this.input.aim && p.onFoot;
      p.scoped = p.aiming && p.weapon === 'sniper';
      p.crouch = this.input.down('ControlLeft') && p.onFoot;
    }

    const prevX = p.x, prevZ = p.z;

    if (this.state === 'play' && !p.dead) {
      p.update(dt, this);
      if (this.input.fire) this.playerFire();
    } else if (p.dead) {
      p.deadT += realDt;
      if (p.deadT > 2.6) this.respawn(false);
    } else if (this.state === 'busted') {
      this.deadT += realDt;
      if (this.deadT > 2.6) this.respawn(true);
    }
    this.stats.distance += dist2D(prevX, prevZ, p.x, p.z);

    // entités
    for (const v of this.vehicles) {
      if (v === p.vehicle && p.seat === 0) { /* piloté par le joueur */ }
      v.update(dt, this.world, this);
      if (v.dead && !v.smokeT) v.smokeT = 0;
      if (v.dead) {
        v.smokeT += dt;
        if (v.smokeT > 0.06) {
          v.smokeT = 0;
          this.particles.spawn(v.x + range(this.rand, -0.6, 0.6), v.y + 1, v.z + range(this.rand, -0.6, 0.6),
            range(this.rand, -0.4, 0.4), range(this.rand, 1.5, 3.4), range(this.rand, -0.4, 0.4),
            0.9, 1.8, v.burnTime < 3.2 ? [0.15, 0.15, 0.16] : [1, 0.6, 0.2],
            { gravity: 1.4, drag: 0.7, grow: 1.6, fade: 0.6, glow: v.burnTime >= 3.2 ? 1 : 0 });
        }
      } else if (v.health < v.maxHealth * 0.35) {
        if (this.frameCount % 6 === 0) {
          this.particles.spawn(v.x, v.y + 0.9, v.z, 0, 1.6, 0, 0.5, 1.1, [0.2, 0.2, 0.21],
            { gravity: 1, drag: 0.9, grow: 1.1, fade: 0.4 });
        }
      }
      if (v.skid > 0.35 && Math.abs(v.speed) > 6 && this.frameCount % 3 === 0) {
        this.audio.skid(v.x, v.z, v.skid);
        for (const w of v.geo.wheels) {
          if (w.front) continue;
          const s = Math.sin(v.yaw), c = Math.cos(v.yaw);
          this.particles.spawn(v.x + w.x * c + w.z * s, 0.1, v.z - w.x * s + w.z * c,
            0, 0.3, 0, 0.35, 0.8, [0.3, 0.3, 0.3], { gravity: 0.1, drag: 1.4, grow: 0.5, fade: 0.35 });
        }
      }
    }

    // collisions entre véhicules
    this.vehicleCollisions(dt);

    const ctx = { player: p, world: this.world, game: this };
    for (let i = this.peds.length - 1; i >= 0; i--) {
      const ped = this.peds[i];
      if (ped.remove) { this.peds.splice(i, 1); continue; }
      if (ped.inVehicle) {
        const v = ped.inVehicle;
        if (!this.vehicles.includes(v)) { this.peds.splice(i, 1); continue; }
        ped.x = v.x; ped.z = v.z; ped.yaw = v.yaw;
        if (v.dead) { ped.damage(200, this, false); }
        continue;
      }
      ped.update(dt, ctx);
      // renversé par une voiture
      if (!ped.dead) {
        for (const v of this.vehicles) {
          if (Math.abs(v.speed) < 3) continue;
          const s = Math.sin(v.yaw), c = Math.cos(v.yaw);
          const dx = ped.x - v.x, dz = ped.z - v.z;
          const lx = dx * c - dz * s, lz = dx * s + dz * c;
          if (Math.abs(lx) < v.hw + 0.4 && Math.abs(lz) < v.hl + 0.4) {
            const dmg = Math.abs(v.speed) * 9;
            const killed = ped.damage(dmg, this, v === p.vehicle, false);
            ped.x += Math.sin(v.yaw) * 1.5; ped.z += Math.cos(v.yaw) * 1.5;
            this.audio.impact(Math.abs(v.speed), ped.x, ped.z);
            if (v === p.vehicle && !killed) this.crime('délit de fuite', p.wanted === 0 ? 1 : 0, ped.x, ped.z);
          }
        }
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.update(dt, this);
      if (pr.kind === 'rocket') {
        this.particles.spawn(pr.x, pr.y, pr.z, 0, 0.3, 0, 0.5, 0.55, [0.4, 0.4, 0.42],
          { gravity: 0.6, drag: 1.2, grow: 1.6, fade: 0.5 });
      }
      if (pr.dead) this.projectiles.splice(i, 1);
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      this.tracers[i].life -= realDt;
      if (this.tracers[i].life <= 0) this.tracers.splice(i, 1);
    }

    this.particles.update(dt);
    this.updateRain(dt);
    this.population.update(dt);
    this.police.update(dt);
    this.missions.update(dt);
    this.checkPickups(dt);
    this.checkBusted(dt);
    if (this.time - (this.lastSave || 0) > 25) this.save();

    // audio
    this.audio.setListener(this.camera.eye[0], this.camera.eye[1], this.camera.eye[2], this.camera.yaw);
    let engines = 0;
    const audible = new Set();
    for (const v of this.vehicles) {
      const d = dist2D(v.x, v.z, p.x, p.z);
      if (v === p.vehicle || (d < 55 && engines < 6 && Math.abs(v.speed) > 0.5)) {
        this.audio.updateEngine(v, v === p.vehicle, dt);
        audible.add(v.id);
        engines++;
      }
      if (v.model.police && d < 160) { this.audio.updateSiren(v); audible.add(v.id); }
    }
    this.audio.pruneEngines(audible);
    // ambiance : rumeur urbaine selon la densité, ressac selon la distance à la mer
    const seaDist = Math.max(0, p.x + 740);
    this.audio.updateAmbience(dt,
      clamp(densityAt(p.x, p.z) * 0.7 + 0.35, 0, 1) * (p.vehicle ? 0.5 : 1),
      clamp(1 - seaDist / 420, 0, 1) * (p.vehicle ? 0.4 : 1));
    this.audio.setMuffled(!p.vehicle);
    this.audio.tickMusic();
    if (p.onFoot && p.move > 0.4 && !p.dead) {
      this.stepT = (this.stepT || 0) + dt * p.move;
      if (this.stepT > 0.42) { this.stepT = 0; this.audio.footstep(p.x, p.z); }
    }

    this.camera.update(realDt, this);
    this.hud.update(realDt);
  }

  vehicleCollisions(dt) {
    const list = this.vehicles;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const minD = (a.hl + b.hl) * 0.78;
        if (d > minD || d < 0.001) continue;
        const nx = dx / d, nz = dz / d;
        const overlap = minD - d;
        const ma = a.mass, mb = b.mass;
        const total = ma + mb;
        a.x -= nx * overlap * (mb / total); a.z -= nz * overlap * (mb / total);
        b.x += nx * overlap * (ma / total); b.z += nz * overlap * (ma / total);
        const rvx = b.vx - a.vx, rvz = b.vz - a.vz;
        const vn = rvx * nx + rvz * nz;
        if (vn > 0) continue;
        const imp = -(1.35) * vn / (1 / ma + 1 / mb);
        a.vx -= (imp * nx) / ma; a.vz -= (imp * nz) / ma;
        b.vx += (imp * nx) / mb; b.vz += (imp * nz) / mb;
        const force = Math.abs(vn);
        if (force > 3.5) {
          a.damage(force * 4); b.damage(force * 4);
          this.onCrash(a, force, (a.x + b.x) / 2, 0.8, (a.z + b.z) / 2);
          if ((a === this.player.vehicle && b.ai && b.ai.chase) || (b === this.player.vehicle && a.ai && a.ai.chase)) {
            this.crime('refus d’obtempérer', this.player.wanted === 0 ? 2 : 0, a.x, a.z);
          }
        }
      }
    }
  }

  checkBusted(dt) {
    const p = this.player;
    if (p.wanted === 0 || !p.onFoot || p.dead || this.state !== 'play') { this.bustT = 0; return; }
    let close = false;
    for (const c of this.peds) {
      if (c.cop && !c.dead && dist2D(c.x, c.z, p.x, p.z) < 2.6) close = true;
    }
    this.bustT = close ? (this.bustT || 0) + dt : 0;
    if (this.bustT > 1.4) this.busted();
  }

  /* --------------------------------------------------------------- rendu */

  render(dt) {
    const R = this.renderer;
    const env = envAt(this.hour);
    env.time = this.time;
    this.applyWeather(env);
    const p = this.player;

    R.begin({
      eye: this.camera.eye, target: this.camera.target,
      fov: this.camera.fov, focus: this.camera.focus,
    }, env);

    for (const v of this.vehicles) {
      if (dist2D(v.x, v.z, this.camera.eye[0], this.camera.eye[2]) < this.drawDistance) v.draw(R, env, this.time);
    }
    for (const ped of this.peds) {
      if (ped.inVehicle) continue;
      if (dist2D(ped.x, ped.z, this.camera.eye[0], this.camera.eye[2]) < 190) ped.draw(R);
    }
    if (this.state === 'play' || p.dead) p.draw(R, this);
    this.police.drawHelis(R, env);

    // projectiles
    const pm = m4();
    for (const pr of this.projectiles) {
      m4compose(pm, pr.x, pr.y, pr.z, 0, 0.3, 0.3, pr.kind === 'rocket' ? 0.9 : 0.3);
      R.cube(pm, pr.kind === 'rocket' ? [0.5, 0.5, 0.55] : [0.2, 0.35, 0.2], 0.2);
    }

    // marqueurs de mission et de destination
    this.drawMarkers(R, pm);

    // ramassages
    for (const pu of this.pickups) {
      if (!pu.active) continue;
      const c = pu.kind === 'armor' ? [0.35, 0.65, 1] : pu.kind === 'health' ? [1, 0.35, 0.35]
        : pu.kind === 'money' ? [0.35, 1, 0.5] : [1, 0.85, 0.3];
      if (pu.kind.startsWith('shop-')) {
        m4compose(pm, pu.x, 0.05, pu.z, 0, 4, 2.6, 4);
        R.ghost('marker', pm, c, 0.7);
      } else {
        m4compose(pm, pu.x, 0.9 + Math.sin(pu.t * 2) * 0.14, pu.z, pu.t * 1.4, 0.5, 0.5, 0.5);
        R.cube(pm, c, 0.8);
      }
    }

    this.drawLights(R, env);
    this.particles.draw(R);
    if (this.raindrops) {
      const w = this.weather;
      const len = 0.9 + w.rain * 0.7;
      const wind = w.wind * 0.22;
      for (const d of this.raindrops) {
        R.line(d.x, d.y, d.z, d.x + wind * len, d.y - len, d.z, 0.62, 0.72, 0.85, 0.5);
      }
    }
    for (const t of this.tracers) {
      const c = t.enemy ? [1, 0.5, 0.2] : [1, 0.92, 0.6];
      R.line(t.x1, t.y1, t.z1, t.x2, t.y2, t.z2, c[0], c[1], c[2], clamp(t.life * 18, 0, 1));
    }

    R.end();
    this.drawOverlay(dt);
  }

  /** Assombrit et embrume l'ambiance selon la météo, ajoute les éclairs. */
  applyWeather(env) {
    const w = this.weather;
    const cloud = clamp(w.cloud === undefined ? 0.25 : w.cloud, 0, 1);
    const dim = 1 - cloud * 0.62;
    env.sunColor = env.sunColor.map((c) => c * dim);
    env.skyTop = env.skyTop.map((c) => c * (1 - cloud * 0.4));
    env.skyHorizon = env.skyHorizon.map((c, i) => lerp(c, (0.42 + i * 0.02) * (1 - w.rain * 0.3), cloud * 0.75));
    env.fogColor = env.fogColor.map((c, i) => lerp(c, (0.38 + i * 0.02) * (1 - w.rain * 0.35), cloud * 0.8));
    env.ambSky = env.ambSky.map((c) => c * (1 - cloud * 0.2) + cloud * 0.03);
    env.fogDensity *= 1 + w.rain * 1.5 + cloud * 0.35;
    env.emitBoost = Math.max(env.emitBoost, cloud * 0.45 + w.rain * 0.3);
    env.wet = w.wet;
    env.cloudiness = cloud;
    if (w.flash > 0.01) {
      const f = w.flash * w.flash * 2.6;
      env.sunColor = env.sunColor.map((c) => c + f);
      env.ambSky = env.ambSky.map((c) => c + f * 0.5);
      env.skyTop = env.skyTop.map((c) => c + f * 0.8);
    }
  }

  /** Éclairage nocturne : lampadaires, enseignes, phares, gyrophares. */
  drawLights(R, env) {
    const n = clamp(env.emitBoost, 0, 1.15);
    const cx = this.camera.eye[0], cz = this.camera.eye[2];
    if (n > 0.12) {
      for (const l of this.nearbyLights(cx, cz, 110)) {
        const d = dist2D(l.x, l.z, cx, cz);
        if (d > 110) continue;
        const fade = clamp(1 - d / 110, 0, 1) * n;
        if (l.kind === 'lamp') {
          R.glow(l.x, l.y, l.z, 4.2, 1, 0.86, 0.55, 0.55 * fade);
          R.glowGround(l.x, 0.34, l.z, 19, 1, 0.8, 0.46, 0.42 * fade);
        } else {
          const c = color(l.c || '#d94f4f');
          R.glow(l.x, l.y, l.z, 12, c[0] + 0.3, c[1] + 0.3, c[2] + 0.3, 0.28 * fade);
        }
      }
    }
    for (const v of this.vehicles) {
      const d = dist2D(v.x, v.z, cx, cz);
      if (d > 160 || v.dead) continue;
      const fade = clamp(1 - d / 160, 0, 1);
      const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
      const rx = Math.cos(v.yaw), rz = -Math.sin(v.yaw);
      if (n > 0.12) {
        for (const s2 of [-1, 1]) {
          const hx = v.x + fx * v.hl + rx * s2 * v.hw * 0.62;
          const hz = v.z + fz * v.hl + rz * s2 * v.hw * 0.62;
          R.glow(hx, v.geo.floor + 0.35, hz, 1.5, 1, 0.95, 0.8, 0.7 * fade);
        }
        R.glowGround(v.x + fx * (v.hl + 7), 0.4, v.z + fz * (v.hl + 7), 11, 1, 0.93, 0.72, 0.34 * fade * n);
        R.glowGround(v.x - fx * (v.hl + 1.2), 0.4, v.z - fz * (v.hl + 1.2), 4, 1, 0.2, 0.15, 0.3 * fade * n);
      }
      if (v.siren) {
        const blue = Math.sin(v.sirenPhase * 14) > 0;
        R.glow(v.x, v.model.h + 0.5, v.z, 6, blue ? 0.25 : 1, 0.3, blue ? 1 : 0.3, 0.5 * fade);
        R.glowGround(v.x, 0.4, v.z, 16, blue ? 0.3 : 1, 0.35, blue ? 1 : 0.3, 0.22 * fade);
      }
    }
    for (const pr of this.projectiles) {
      if (pr.kind === 'rocket') R.glow(pr.x, pr.y, pr.z, 3.5, 1, 0.7, 0.3, 0.8);
    }
    for (const pt of this.particles.list) {
      if (pt.glow) R.glow(pt.x, pt.y, pt.z, pt.size * 2.4, pt.col[0], pt.col[1], pt.col[2], clamp(pt.life / pt.max, 0, 1) * 0.5);
    }
  }

  drawMarkers(R, pm) {
    const wp = this.missions.waypoint;
    if (wp) {
      m4compose(pm, wp.x, 0.05, wp.z, this.time, wp.r * 2, 3.2, wp.r * 2);
      R.ghost('marker', pm, wp.color || [1, 0.85, 0.2], 0.9);
    }
    if (this.hud.waypoint) {
      const w = this.hud.waypoint;
      m4compose(pm, w.x, 0.05, w.z, -this.time, 5, 2.6, 5);
      R.ghost('marker', pm, [0.9, 0.35, 0.8], 0.9);
    }
    if (!this.missions.active) {
      for (const m of MISSIONS) {
        if (!this.missions.available(m)) continue;
        if (dist2D(m.x, m.z, this.player.x, this.player.z) > 220) continue;
        const c = m.char ? color(CHARACTERS[m.char].color) : [1, 0.85, 0.2];
        m4compose(pm, m.x, 0.05, m.z, 0, 3.4, 2.6, 3.4);
        R.ghost('marker', pm, c, 1);
        // repère flottant, aux couleurs du personnage
        m4compose(pm, m.x, 3.4 + Math.sin(this.time * 1.6) * 0.18, m.z, this.time * 0.9, 0.8, 0.8, 0.8);
        R.cube(pm, c, 0.9);
      }
    }
  }

  drawOverlay(dt) {
    const c = this.overlayCtx || (this.overlayCtx = this.root.querySelector('#overlay').getContext('2d'));
    const cv = c.canvas;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    c.clearRect(0, 0, w, h);
    const p = this.player;

    // réticule
    if (p.aiming && !p.dead && this.state === 'play') {
      const cx = w / 2, cy = h / 2;
      if (p.scoped) {
        c.fillStyle = 'rgba(0,0,0,0.92)';
        c.beginPath();
        c.rect(0, 0, w, h);
        c.arc(cx, cy, Math.min(w, h) * 0.32, 0, TAU, true);
        c.fill('evenodd');
        c.strokeStyle = 'rgba(20,20,20,0.9)';
        c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(cx - w, cy); c.lineTo(cx + w, cy);
        c.moveTo(cx, cy - h); c.lineTo(cx, cy + h); c.stroke();
      }
      const spread = 8 + (WEAPONS[p.weapon].spread || 0) * 900 + Math.hypot(p.vx || 0, p.vz || 0) * 2;
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = 2;
      for (const a of [0, 90, 180, 270]) {
        const r = (a * Math.PI) / 180;
        c.beginPath();
        c.moveTo(cx + Math.cos(r) * spread, cy + Math.sin(r) * spread);
        c.lineTo(cx + Math.cos(r) * (spread + 7), cy + Math.sin(r) * (spread + 7));
        c.stroke();
      }
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.fillRect(cx - 1, cy - 1, 2, 2);
    }

    // fondu
    if (this.fade > 0.001) {
      c.fillStyle = `rgba(0,0,0,${clamp(this.fade, 0, 1)})`;
      c.fillRect(0, 0, w, h);
    }
    if (this.state === 'dead' || this.state === 'busted') {
      c.fillStyle = `rgba(${this.state === 'dead' ? '40,0,0' : '0,10,40'},${clamp(this.deadT || 0, 0, 0.75)})`;
      c.fillRect(0, 0, w, h);
    }
    // bandes cinéma
    if (this.cinematic > 0) {
      const t = clamp(this.cinematic, 0, 1);
      c.fillStyle = '#000';
      c.fillRect(0, 0, w, h * 0.12 * t);
      c.fillRect(0, h - h * 0.12 * t, w, h * 0.12 * t);
    }
  }
}
