/**
 * Missions : machine à étapes générique + le contenu scénarisé
 * (braquage, reprise de véhicule, carnage, course, livraisons).
 */
import { Vehicle } from '../entities/vehicle.js';
import { Ped } from '../entities/character.js';
import { dist2D, clamp, rng, range, pick } from '../engine/math.js';

export const MISSIONS = [
  {
    id: 'repo', char: 'franklin', name: 'Reprise de véhicule', letter: 'F',
    x: 205, z: 372, reward: 9000,
    brief: "Simeon veut cette Comète. Récupère-la et ramène-la au garage sans la démolir.",
    steps: [
      { type: 'spawnVehicle', key: 'comete', x: -318, z: -230, yaw: 1.57, id: 'target', locked: true },
      { type: 'goto', x: -318, z: -230, r: 9, text: 'Trouve la Comète dans Del Perro' },
      { type: 'steal', vehicleId: 'target', text: 'Monte dans la Comète', wanted: 2 },
      { type: 'deliver', x: 130, z: 220, r: 12, vehicleId: 'target', text: 'Livre la voiture au garage de Los Santos Customs', clearWanted: true },
    ],
  },
  {
    id: 'jewel', char: 'michael', name: 'Le casse de la bijouterie', letter: 'M',
    x: -145, z: -415, reward: 240000,
    brief: "Lester a tout préparé. On entre, on prend les pierres, on ressort avant les flics.",
    steps: [
      { type: 'goto', x: -55, z: -60, r: 10, text: 'Rejoins la bijouterie de Pillbox Hill' },
      {
        type: 'killAll', text: 'Neutralise les vigiles', wanted: 0,
        enemies: [
          { x: -62, z: -68, shirt: [0.15, 0.16, 0.2] }, { x: -46, z: -70, shirt: [0.15, 0.16, 0.2] },
          { x: -66, z: -50, shirt: [0.15, 0.16, 0.2] }, { x: -42, z: -52, shirt: [0.15, 0.16, 0.2] },
        ],
      },
      { type: 'wait', time: 7, x: -55, z: -60, r: 9, text: 'Rafle les vitrines' },
      { type: 'goto', x: 130, z: 220, r: 13, text: 'Sème la police et rejoins le point de chute', wanted: 3 },
    ],
  },
  {
    id: 'rampage', char: 'trevor', name: 'Carnage au port', letter: 'T',
    x: -478, z: 118, reward: 45000,
    brief: "Les gars du port ont parlé de travers. Trevor n'a pas apprécié.",
    steps: [
      { type: 'goto', x: 520, z: 470, r: 14, text: 'Rejoins le port de Los Santos' },
      {
        type: 'killAll', timer: 180, text: 'Élimine les hommes de main', wanted: 0, arm: true,
        count: 14, area: { x: 540, z: 520, r: 90 },
      },
    ],
  },
  {
    id: 'race', char: null, name: 'Course de rue', letter: 'C',
    x: -470, z: -40, reward: 18000,
    brief: 'Un tour du bord de mer. Premier arrivé, premier payé.',
    steps: [
      { type: 'needVehicle', text: 'Monte dans une voiture' },
      {
        type: 'race', timer: 115, text: 'Franchis tous les points de passage',
        points: [
          [-540, -180], [-540, -400], [-330, -450], [-140, -450], [-140, -180],
          [-330, -90], [-330, 180], [-540, 180], [-540, 40], [-470, -40],
        ],
      },
    ],
  },
  {
    id: 'taxi', char: null, name: 'Courses de taxi', letter: 'D',
    x: 380, z: 152, reward: 12000,
    brief: 'Trois clients, trois destinations. Le compteur tourne.',
    steps: [
      { type: 'needVehicle', text: 'Prends le volant' },
      { type: 'goto', x: -100, z: 330, r: 12, text: 'Récupère le premier client', vehicle: true },
      { type: 'goto', x: 425, z: -300, r: 12, text: 'Dépose-le à Mirror Park', vehicle: true, timer: 90 },
      { type: 'goto', x: 200, z: 380, r: 12, text: 'Récupère le client suivant', vehicle: true },
      { type: 'goto', x: -455, z: 105, r: 12, text: 'Direction Vespucci', vehicle: true, timer: 95 },
      { type: 'goto', x: 40, z: -140, r: 12, text: 'Dernier client', vehicle: true },
      { type: 'goto', x: -250, z: 660, r: 16, text: "Dépose-le à l'aéroport", vehicle: true, timer: 120 },
    ],
  },
];

export class MissionSystem {
  constructor(game) {
    this.game = game;
    this.active = null;
    this.step = 0;
    this.stepData = null;
    this.entities = [];
    this.done = new Set();
    this.timer = 0;
    this.objective = '';
    this.marker = null;
    this.rand = rng(31337);
    this.raceIndex = 0;
    this.cooldown = 0;
  }

  available(m) {
    if (this.done.has(m.id)) return false;
    if (m.char && this.game.player.character !== m.char) return false;
    return true;
  }

  start(m) {
    if (this.active) return;
    this.active = m;
    this.step = -1;
    this.entities = [];
    this.refs = {};
    this.raceIndex = 0;
    this.game.notify(m.name, m.brief);
    this.game.audio.ui(660, 0.12, 0.14);
    this.nextStep();
  }

  nextStep() {
    this.step++;
    const m = this.active;
    if (!m) return;
    if (this.step >= m.steps.length) return this.complete();
    const s = m.steps[this.step];
    this.stepData = s;
    this.timer = s.timer || 0;
    this.objective = s.text || '';
    this.marker = null;
    const g = this.game;

    switch (s.type) {
      case 'spawnVehicle': {
        const v = new Vehicle(s.key, s.x, s.z, s.yaw || 0, { mission: true });
        v.mission = true;
        v.persistent = true;
        g.vehicles.push(v);
        this.refs[s.id] = v;
        this.entities.push(v);
        this.nextStep();
        return;
      }
      case 'goto': case 'deliver': case 'wait':
        this.marker = { x: s.x, z: s.z, r: s.r || 10, color: [1, 0.85, 0.2] };
        break;
      case 'killAll': {
        const list = [];
        if (s.enemies) {
          for (const e of s.enemies) {
            const p = new Ped(e.x, e.z, this.rand, { hostile: true, shirt: e.shirt, mission: true });
            p.combatTarget = g.player;
            g.peds.push(p); list.push(p); this.entities.push(p);
          }
        } else {
          for (let i = 0; i < (s.count || 8); i++) {
            const a = this.rand() * 6.28, r = range(this.rand, 12, s.area.r);
            const p = new Ped(s.area.x + Math.cos(a) * r, s.area.z + Math.sin(a) * r, this.rand,
              { hostile: true, mission: true });
            p.combatTarget = g.player;
            g.peds.push(p); list.push(p); this.entities.push(p);
          }
        }
        this.enemies = list;
        break;
      }
      case 'race':
        this.raceIndex = 0;
        this.marker = { x: s.points[0][0], z: s.points[0][1], r: 11, color: [1, 0.75, 0.15] };
        break;
      case 'steal':
        this.marker = null;
        break;
      default: break;
    }
    if (s.wanted) this.game.police.addWanted(s.wanted, 'Mission');
    this.game.hud.setObjective(this.objective);
  }

  fail(reason) {
    if (!this.active) return;
    this.game.showBanner('MISSION ÉCHOUÉE', reason, '#c0392b');
    this.game.audio.ui(180, 0.5, 0.18);
    this.cleanup();
  }

  complete() {
    const m = this.active;
    if (!m) return;
    this.done.add(m.id);
    this.game.player.money += m.reward;
    this.game.showBanner('MISSION ACCOMPLIE', `${m.name} — $${m.reward.toLocaleString('fr-FR')}`, '#2ecc71');
    this.game.audio.ui(880, 0.3, 0.18);
    this.cleanup(true);
  }

  cleanup(keepVehicles = false) {
    const g = this.game;
    for (const e of this.entities) {
      if (e instanceof Vehicle) {
        if (!keepVehicles && e !== g.player.vehicle) {
          const i = g.vehicles.indexOf(e); if (i >= 0) g.vehicles.splice(i, 1);
        } else { e.mission = false; e.persistent = false; }
      } else {
        e.mission = null;
        if (!e.dead) { const i = g.peds.indexOf(e); if (i >= 0) g.peds.splice(i, 1); }
      }
    }
    this.entities = [];
    this.enemies = null;
    this.active = null;
    this.marker = null;
    this.objective = '';
    this.stepData = null;
    this.cooldown = 2;
    g.hud.setObjective('');
  }

  update(dt) {
    const g = this.game;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.active) {
      // déclencheurs sur la carte
      if (this.cooldown === 0 && g.player.onFoot && !g.player.dead) {
        for (const m of MISSIONS) {
          if (!this.available(m)) continue;
          if (dist2D(g.player.x, g.player.z, m.x, m.z) < 3.2) { this.start(m); break; }
        }
      }
      return;
    }

    const s = this.stepData;
    const p = g.player;
    if (p.dead) return this.fail('Vous êtes mort');

    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) return this.fail('Temps écoulé');
    }

    switch (s.type) {
      case 'goto': {
        const inVeh = s.vehicle ? !!p.vehicle : true;
        if (inVeh && dist2D(p.x, p.z, s.x, s.z) < (s.r || 10)) { this.nextStep(); }
        break;
      }
      case 'steal': {
        const v = this.refs[s.vehicleId];
        if (p.vehicle === v) this.nextStep();
        break;
      }
      case 'deliver': {
        const v = this.refs[s.vehicleId];
        if (v && v.dead) return this.fail('Le véhicule est détruit');
        if (p.vehicle === v && dist2D(v.x, v.z, s.x, s.z) < (s.r || 12) && Math.abs(v.speed) < 4) {
          if (s.clearWanted) g.police.clear();
          this.nextStep();
        }
        break;
      }
      case 'wait': {
        if (dist2D(p.x, p.z, s.x, s.z) > (s.r || 9) + 4) { this.waitT = 0; break; }
        this.waitT = (this.waitT || 0) + dt;
        g.hud.setObjective(`${s.text} (${Math.max(0, s.time - this.waitT).toFixed(1)} s)`);
        if (this.waitT >= s.time) { this.waitT = 0; this.nextStep(); }
        break;
      }
      case 'killAll': {
        const alive = this.enemies.filter((e) => !e.dead).length;
        g.hud.setObjective(`${s.text} — ${alive} restant${alive > 1 ? 's' : ''}`);
        if (alive === 0) this.nextStep();
        break;
      }
      case 'needVehicle':
        if (p.vehicle) this.nextStep();
        break;
      case 'race': {
        const pts = s.points;
        const cur = pts[this.raceIndex];
        this.marker = { x: cur[0], z: cur[1], r: 11, color: [1, 0.75, 0.15] };
        if (p.vehicle && dist2D(p.x, p.z, cur[0], cur[1]) < 12) {
          this.raceIndex++;
          g.audio.ui(760, 0.09, 0.15);
          g.player.money += 250;
          if (this.raceIndex >= pts.length) { this.nextStep(); return; }
        }
        g.hud.setObjective(`${s.text} — ${this.raceIndex}/${pts.length}`);
        break;
      }
      default: break;
    }
  }

  /** Cible actuelle pour la boussole et le radar. */
  get waypoint() {
    if (this.marker) return this.marker;
    if (this.active && this.stepData && this.stepData.type === 'steal') {
      const v = this.refs[this.stepData.vehicleId];
      if (v) return { x: v.x, z: v.z, r: 4, color: [0.4, 0.8, 1] };
    }
    return null;
  }
}
