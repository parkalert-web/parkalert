/**
 * Missions : machine à étapes générique + le contenu scénarisé
 * (braquage, reprise de véhicule, carnage, course, livraisons).
 */
import { Vehicle } from '../entities/vehicle.js';
import { Ped } from '../entities/character.js';
import { dist2D, clamp, rng, range, pick } from '../engine/math.js';

/**
 * Les coordonnées sont posées sur la trame : les points accessibles en voiture
 * tombent sur un carrefour (multiple de 90) et les points à pied sur un
 * trottoir ou un parvis dégagé. Le fichier de tests le vérifie.
 */
export const MISSIONS = [
  {
    id: 'repo', char: 'franklin', name: 'Reprise de véhicule', letter: 'F',
    x: 196, z: 371, reward: 9000,
    brief: "Simeon veut cette Comète. Récupère-la et ramène-la au garage sans la démolir.",
    steps: [
      { type: 'spawnVehicle', key: 'comete', x: -264, z: -225, yaw: 0, id: 'target' },
      { type: 'goto', x: -264, z: -225, r: 9, text: 'Trouve la Comète dans Del Perro' },
      { type: 'steal', vehicleId: 'target', text: 'Monte dans la Comète', wanted: 2 },
      { type: 'deliver', x: 135, z: 186, r: 13, vehicleId: 'target', clearWanted: true,
        text: 'Livre la voiture à Los Santos Customs' },
    ],
  },
  {
    id: 'jewel', char: 'michael', name: 'Le casse de la bijouterie', letter: 'M',
    x: -135, z: -440, reward: 240000,
    brief: "Lester a tout préparé. On entre, on prend les pierres, on ressort avant les flics.",
    steps: [
      { type: 'goto', x: -45, z: -62, r: 9, text: 'Rejoins la bijouterie Vangelico' },
      {
        type: 'killAll', text: 'Neutralise les vigiles',
        enemies: [
          { x: -58, z: -66 }, { x: -32, z: -66 }, { x: -64, z: -74 }, { x: -26, z: -74 },
        ],
      },
      { type: 'wait', time: 7, x: -45, z: -62, r: 9, text: 'Rafle les vitrines' },
      { type: 'goto', x: -315, z: 315, r: 14, wanted: 3, vehicle: true,
        text: 'Sème la police et rejoins le point de chute' },
    ],
  },
  {
    id: 'rampage', char: 'trevor', name: 'Carnage à l’aéroport', letter: 'T',
    x: -495, z: 99, reward: 45000,
    brief: "Les gars de la piste ont parlé de travers. Trevor n'a pas apprécié.",
    steps: [
      { type: 'goto', x: -230, z: 800, r: 18, text: 'Rejoins la piste de LS International' },
      {
        type: 'killAll', timer: 180, text: 'Élimine les hommes de main',
        count: 14, area: { x: -230, z: 800, r: 90 },
      },
    ],
  },
  {
    id: 'race', char: null, name: 'Course de rue', letter: 'C',
    x: -450, z: -86, reward: 18000,
    brief: 'Un tour du bord de mer. Premier arrivé, premier payé.',
    steps: [
      { type: 'needVehicle', text: 'Monte dans une voiture' },
      {
        type: 'race', timer: 130, text: 'Franchis tous les points de passage',
        points: [
          [-450, -180], [-450, -360], [-270, -450], [-90, -450], [-90, -270],
          [-270, -180], [-270, 90], [-450, 180], [-540, 90], [-450, -90],
        ],
      },
    ],
  },
  {
    id: 'taxi', char: null, name: 'Courses de taxi', letter: 'D',
    x: 356, z: 141, reward: 12000,
    brief: 'Trois clients, trois destinations. Le compteur tourne.',
    steps: [
      { type: 'needVehicle', text: 'Prends le volant' },
      { type: 'goto', x: -90, z: 270, r: 12, vehicle: true, text: 'Récupère le premier client' },
      { type: 'goto', x: 450, z: -270, r: 12, vehicle: true, timer: 100, text: 'Dépose-le à Mirror Park' },
      { type: 'goto', x: 180, z: 360, r: 12, vehicle: true, text: 'Récupère le client suivant' },
      { type: 'goto', x: -450, z: 90, r: 12, vehicle: true, timer: 105, text: 'Direction Vespucci' },
      { type: 'goto', x: 0, z: -90, r: 12, vehicle: true, text: 'Dernier client' },
      { type: 'goto', x: -270, z: 630, r: 16, vehicle: true, timer: 130, text: "Dépose-le à l'aéroport" },
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
            const p = new Ped(e.x, e.z, this.rand, { hostile: true, shirt: e.shirt || [0.16, 0.17, 0.2], mission: true });
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

    // On peut renoncer : s'éloigner longtemps de l'objectif met fin à la mission,
    // sinon elle resterait active pour toujours et bloquerait les autres.
    const goal = this.waypoint;
    if (goal) {
      // seuil large : certaines étapes envoient légitimement à 800 m
      const far = dist2D(p.x, p.z, goal.x, goal.z) > 1100;
      this.strayT = far ? (this.strayT || 0) + dt : 0;
      if (this.strayT > 40) return this.fail('Vous avez abandonné la mission');
    } else this.strayT = 0;

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
