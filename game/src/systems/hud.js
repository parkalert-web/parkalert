/**
 * Interface : radar, barres de vie et de gilet, étoiles de recherche, argent,
 * arme, objectifs, bandeaux, roue des armes, sélecteur de personnage,
 * carte plein écran et menu pause.
 */
import { clamp, lerp, dist2D } from '../engine/math.js';
import { MISSIONS } from './missions.js';
import { WEAPONS, WEAPON_ORDER } from './weapons.js';
import { contextKeys, HELP_SECTIONS, TUTORIAL_STEPS } from './onboarding.js';
import { CHARACTERS } from '../entities/player.js';
import { STREET, GRID, CITY_MAX, SHORE_X, OCEAN_X, ZONES, zoneAt } from '../world/gen.js';

const BLIP_COLORS = {
  mission: '#f5d442', garage: '#4fb0e8', ammunation: '#e08a2a', hospital: '#e05a5a',
  police: '#4f7fe8', waypoint: '#e055c8', cop: '#3f6fe0', player: '#ffffff', enemy: '#e04030',
};

/**
 * Chaque type de repère a sa forme, pas seulement sa couleur : sur un radar
 * de 230 pixels, une pastille ronde de plus ne dit rien à personne.
 *   pin      losange sur pointe, comme une punaise — les missions
 *   disque   rond plein — les commerces
 *   ecusson  pentagone — les postes de police
 *   fleche   triangle — les ennemis
 *   anneau   cercle vide — la destination choisie
 *   croix    rond barré — les hélicoptères
 */
/** Ce qu'on trouve à chaque type de lieu, écrit noir sur blanc. */
export const MAP_DESCRIPTIONS = {
  'Los Santos Customs': 'Réparation complète et nouvelle peinture pour 500 $. Efface aussi l’indice de recherche : la police ne reconnaît plus la voiture.',
  'Ammu-Nation': 'Armes, munitions et gilets pare-balles. Entrez à pied et appuyez sur E.',
  'Hôpital': 'C’est ici que vous vous réveillez après un mauvais quart d’heure. On y récupère de la santé.',
  Commissariat: 'À éviter quand les étoiles clignotent.',
  Objectif: 'L’étape en cours de votre mission.',
  Destination: 'Le point que vous avez posé sur la carte.',
};

export const BLIP_LEGEND = [
  { kind: 'mission', shape: 'pin', color: '#f5d442', glyph: 'F', label: 'Mission à lancer' },
  { kind: 'garage', shape: 'disque', color: '#4fb0e8', glyph: '⚒', label: 'Los Santos Customs — réparation' },
  { kind: 'ammunation', shape: 'disque', color: '#e08a2a', glyph: '⌖', label: 'Ammu-Nation — armes' },
  { kind: 'hospital', shape: 'disque', color: '#e05a5a', glyph: '✚', label: 'Hôpital' },
  { kind: 'station', shape: 'ecusson', color: '#4f7fe8', glyph: '', label: 'Commissariat' },
  { kind: 'waypoint', shape: 'anneau', color: '#e055c8', glyph: '', label: 'Votre destination' },
  { kind: 'objectif', shape: 'anneau', color: '#f5d442', glyph: '', label: 'Objectif de mission' },
  { kind: 'cop', shape: 'losange', color: '#3f6fe0', glyph: '', label: 'Police à vos trousses' },
  { kind: 'heli', shape: 'croix', color: '#3f6fe0', glyph: '', label: 'Hélicoptère de police' },
  { kind: 'enemy', shape: 'fleche', color: '#e04030', glyph: '', label: 'Ennemi' },
];

/** Dessine un repère de rayon `r` centré en (x, y). */
export function drawBlip(c, x, y, b, r) {
  const shape = b.shape || 'disque';
  c.save();
  c.translate(x, y);
  c.lineJoin = 'round';
  c.strokeStyle = 'rgba(8,11,15,.85)';
  c.lineWidth = Math.max(1.4, r * 0.34);
  c.fillStyle = b.color;
  c.beginPath();
  if (shape === 'pin') {
    c.moveTo(0, r * 1.25); c.lineTo(-r, 0); c.lineTo(0, -r * 1.05); c.lineTo(r, 0);
    c.closePath();
  } else if (shape === 'losange') {
    c.moveTo(0, -r); c.lineTo(r * 0.8, 0); c.lineTo(0, r); c.lineTo(-r * 0.8, 0);
    c.closePath();
  } else if (shape === 'ecusson') {
    c.moveTo(0, -r * 1.1); c.lineTo(r, -r * 0.4); c.lineTo(r * 0.62, r * 1.05);
    c.lineTo(-r * 0.62, r * 1.05); c.lineTo(-r, -r * 0.4);
    c.closePath();
  } else if (shape === 'fleche') {
    c.moveTo(0, -r * 1.1); c.lineTo(r * 0.95, r * 0.85); c.lineTo(-r * 0.95, r * 0.85);
    c.closePath();
  } else {
    c.arc(0, 0, r, 0, 6.29);
  }
  if (shape === 'anneau') {
    c.stroke();
    c.lineWidth = Math.max(1.6, r * 0.42);
    c.strokeStyle = b.color;
    c.stroke();
    c.beginPath(); c.arc(0, 0, r * 0.3, 0, 6.29); c.fill();
    c.restore();
    return;
  }
  c.stroke(); c.fill();
  if (shape === 'croix') {
    c.strokeStyle = 'rgba(8,11,15,.9)';
    c.lineWidth = Math.max(1.2, r * 0.3);
    c.beginPath();
    c.moveTo(-r, -r); c.lineTo(r, r); c.moveTo(r, -r); c.lineTo(-r, r);
    c.stroke();
  }
  if (b.glyph) {
    c.fillStyle = '#0d1116';
    c.font = `bold ${Math.round(r * 1.45)}px "Arial Narrow", Arial, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(b.glyph, 0, r * 0.06);
  }
  c.restore();
}

/** Petite flèche au bord du radar pour ce qui est hors de portée. */
export function drawEdgeArrow(c, x, y, angle, color, r) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.fillStyle = color;
  c.strokeStyle = 'rgba(8,11,15,.85)';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(0, -r); c.lineTo(r * 0.78, r * 0.7); c.lineTo(-r * 0.78, r * 0.7);
  c.closePath();
  c.stroke(); c.fill();
  c.restore();
}

export class HUD {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.el = (id) => root.querySelector(id);
    this.radar = this.el('#radar');
    this.rctx = this.radar.getContext('2d');
    this.mapCanvas = this.el('#map-canvas');
    this.mctx = this.mapCanvas.getContext('2d');
    this.objective = '';
    this.notifQueue = [];
    this.notifT = 0;
    this.bannerT = 0;
    this.mapOpen = false;
    this.mapZoom = 0.24;
    this.mapCenter = { x: 0, z: 0 };
    this.waypoint = null;
    this.wheelOpen = false;
    this.charWheelOpen = false;
    this.radarAngle = 0;
    this.lastMoney = game.player.money;
    this.moneyFlash = 0;
    this.el('#money').textContent = `$${game.player.money.toLocaleString('fr-FR')}`;
    this.setupMapInteraction();
  }

  setupMapInteraction() {
    const c = this.mapCanvas;
    const fermer = this.el('#map-info-close');
    if (fermer) fermer.addEventListener('click', () => this.hideMapInfo());
    let drag = null;
    c.addEventListener('mousedown', (e) => {
      drag = { x: e.clientX, y: e.clientY, moved: false, cx: this.mapCenter.x, cz: this.mapCenter.z };
    });
    addEventListener('mousemove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      this.mapCenter.x = drag.cx - dx / this.mapZoom;
      this.mapCenter.z = drag.cz - dy / this.mapZoom;
    });
    addEventListener('mouseup', (e) => {
      if (drag && !drag.moved && this.mapOpen) {
        const r = c.getBoundingClientRect();
        const mx = (e.clientX - r.left - c.width / 2) / this.mapZoom + this.mapCenter.x;
        const mz = (e.clientY - r.top - c.height / 2) / this.mapZoom + this.mapCenter.z;
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          this.setWaypoint(mx, mz);
        }
      }
      drag = null;
    });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.mapZoom = clamp(this.mapZoom * (e.deltaY > 0 ? 0.88 : 1.14), 0.08, 1.6);
    }, { passive: false });
  }

  setWaypoint(x, z) {
    // Un clic près d'un repère ouvre sa fiche : c'est la question « c'est quoi,
    // ce point ? » qui revenait sans arrêt. Ailleurs, il pose une destination.
    const repere = this.blipAt(x, z);
    if (repere) { this.showMapInfo(repere); return; }
    this.hideMapInfo();
    if (this.waypoint && dist2D(this.waypoint.x, this.waypoint.z, x, z) < 30 / this.mapZoom) {
      this.waypoint = null;
    } else {
      this.waypoint = { x, z };
    }
    this.game.audio.ui(620, 0.05, 0.1);
  }

  /** Repère fixe sous le curseur, s'il y en a un. */
  blipAt(x, z) {
    const rayon = 22 / this.mapZoom;
    let best = null; let bd = rayon;
    for (const b of this.blips()) {
      if (b.vivant || !b.name) continue;
      const d = dist2D(b.x, b.z, x, z);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  hideMapInfo() {
    const el = this.el('#map-info');
    if (el) el.hidden = true;
  }

  /** Fiche d'un point de la carte, avec ce qu'on peut en faire. */
  showMapInfo(b) {
    const g = this.game;
    const el = this.el('#map-info');
    if (!el) return;
    const p = g.player;
    const d = Math.round(dist2D(b.x, b.z, p.x, p.z));
    const mission = MISSIONS.find((m) => m.x === b.x && m.z === b.z);
    el.querySelector('b').textContent = mission ? mission.name : b.name;
    el.querySelector('.map-info-sub').textContent = mission
      ? `${mission.kind} · ${d} m · ${mission.reward.toLocaleString('fr-FR')} $`
      : `${d} m`;
    el.querySelector('p').textContent = mission ? mission.brief : MAP_DESCRIPTIONS[b.name] || '';
    const actions = el.querySelector('.map-info-actions');
    actions.innerHTML = '';
    if (mission) {
      const lancer = document.createElement('button');
      lancer.className = 'primaire';
      lancer.textContent = d < 60 ? 'Lancer la mission' : 'S’y rendre';
      lancer.addEventListener('click', () => { g.chooseMission(mission); this.hideMapInfo(); });
      actions.append(lancer);
    }
    const dest = document.createElement('button');
    dest.textContent = 'Marquer la destination';
    dest.addEventListener('click', () => {
      this.waypoint = { x: b.x, z: b.z };
      g.audio.ui(620, 0.05, 0.1);
      this.hideMapInfo();
    });
    actions.append(dest);
    el.hidden = false;
    g.audio.ui(700, 0.04, 0.09);
  }

  /**
   * Liste des missions : on choisit la sienne au lieu de la déclencher par
   * hasard en marchant sur un marqueur.
   */
  buildMissionList() {
    const g = this.game;
    const liste = this.el('.mission-list');
    if (!liste) return;
    liste.innerHTML = '';
    for (const m of MISSIONS) {
      const faite = g.missions.done.has(m.id);
      const bonPerso = !m.char || g.player.character === m.char;
      const b = document.createElement('button');
      b.className = faite ? 'faite' : '';
      b.disabled = faite || !!g.missions.active;
      const etat = faite ? '<em>Réussie</em>'
        : !bonPerso ? `<em>Avec ${CHARACTERS[m.char].name}</em>`
          : `<em>${m.reward.toLocaleString('fr-FR')} $</em>`;
      b.innerHTML = `<b>${m.name}</b><small>${m.kind} · ${Math.round(dist2D(m.x, m.z, g.player.x, g.player.z))} m</small>${etat}`;
      b.addEventListener('click', () => { g.chooseMission(m); this.hideMapInfo(); });
      liste.append(b);
    }
  }

  /** Petite invite contextuelle : « F — Monter dans la Comète ». */
  setHint(t) {
    if (t === this._hint) return;
    this._hint = t;
    const el = this.el('#hint');
    el.innerHTML = t || '';
    el.classList.toggle('show', !!t);
  }

  setObjective(t) {
    this.objective = t;
    const el = this.el('#objective');
    el.textContent = t || '';
    el.style.opacity = t ? '1' : '0';
  }

  notify(title, sub) {
    this.notifQueue.push({ title, sub });
    if (this.notifQueue.length === 1) this.showNotif();
  }

  showNotif() {
    const n = this.notifQueue[0];
    if (!n) return;
    const el = this.el('#notification');
    el.querySelector('.n-title').textContent = n.title;
    el.querySelector('.n-sub').innerHTML = n.sub || '';   // les touches sont mises en valeur
    el.classList.add('show');
    this.notifT = n.sub ? 4.5 : 3;
  }

  banner(title, sub, color) {
    const el = this.el('#banner');
    el.querySelector('.b-title').textContent = title;
    el.querySelector('.b-sub').textContent = sub || '';
    el.querySelector('.b-title').style.color = color || '#fff';
    el.classList.add('show');
    this.bannerT = 4;
  }

  update(dt) {
    const g = this.game;
    const p = g.player;

    if (this.notifT > 0) {
      this.notifT -= dt;
      if (this.notifT <= 0) {
        this.el('#notification').classList.remove('show');
        this.notifQueue.shift();
        if (this.notifQueue.length) setTimeout(() => this.showNotif(), 350);
      }
    }
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.el('#banner').classList.remove('show');
    }

    // argent
    if (p.money !== this.lastMoney) {
      const diff = p.money - this.lastMoney;
      this.lastMoney = p.money;
      this.moneyFlash = 1.2;
      this.el('#money').textContent = `$${p.money.toLocaleString('fr-FR')}`;
      if (Math.abs(diff) > 1) {
        const d = this.el('#money-delta');
        d.textContent = `${diff > 0 ? '+' : '-'}$${Math.abs(diff).toLocaleString('fr-FR')}`;
        d.style.color = diff > 0 ? '#7ee08a' : '#e07a7a';
        d.classList.add('show');
        clearTimeout(this._moneyTO);
        this._moneyTO = setTimeout(() => d.classList.remove('show'), 1800);
      }
    }
    this.moneyFlash = Math.max(0, this.moneyFlash - dt);
    this.el('#money').style.transform = `scale(${1 + this.moneyFlash * 0.06})`;

    // étoiles
    const stars = this.el('#stars');
    const flash = g.police.flash;
    if (stars.childElementCount !== 5) {
      stars.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        const s = document.createElement('span');
        s.textContent = '★';
        stars.appendChild(s);
      }
    }
    for (let i = 0; i < 5; i++) {
      const on = i < p.wanted;
      const blink = on && flash > 0 && (Math.floor(g.time * 4) % 2 === 0);
      stars.children[i].className = on ? (blink ? 'star off' : 'star on') : 'star off';
    }

    // arme
    const w = WEAPONS[p.weapon];
    this.el('#weapon-name').textContent = w.name;
    this.el('#weapon-ammo').textContent = w.melee ? '—' : `${p.mags[p.weapon]} / ${p.ammo[p.weapon]}`;
    this.el('#weapon-icon').textContent = w.icon;

    // barres
    this.el('#hp-bar').style.width = `${clamp(p.health / p.maxHealth, 0, 1) * 100}%`;
    this.el('#armor-bar').style.width = `${clamp(p.armor / p.maxArmor, 0, 1) * 100}%`;
    this.el('#ability-bar').style.width = `${clamp(p.ability, 0, 1) * 100}%`;
    this.el('#ability-wrap').style.borderColor = CHARACTERS[p.character].color;
    this.el('#ability-bar').style.background = CHARACTERS[p.character].color;

    // véhicule
    const veh = p.vehicle;
    const sp = this.el('#speedo');
    if (veh) {
      sp.classList.add('show');
      this.el('#speed-value').textContent = Math.round(veh.kmh);
      this.el('#vehicle-name').textContent = veh.model.name;
      this.el('#veh-health').style.width = `${clamp(veh.health / veh.maxHealth, 0, 1) * 100}%`;
      this.el('#gear').textContent = veh.model.fly
        ? `${Math.round(veh.y)} m`
        : (veh.speed < -0.5 ? 'R'
          : Math.min(6, Math.max(1, Math.floor(Math.abs(veh.speed) / (veh.model.top / 5)) + 1)));
    } else sp.classList.remove('show');

    // radio
    this.el('#radio').textContent = veh ? g.audio.stationNames[g.audio.station] : '';
    this.el('#radio').style.opacity = veh ? '1' : '0';

    // quartier
    const zone = zoneAt(p.x, p.z);
    if (zone !== this._zone) {
      this._zone = zone;
      const z = this.el('#zone');
      z.textContent = zone;
      z.classList.remove('show');
      void z.offsetWidth;
      z.classList.add('show');
    }

    this.updateKeyBar();
    this.drawRadar();

    // Le point d'intérêt le plus proche, écrit en toutes lettres : c'est ce
    // qui manquait pour comprendre les pastilles du radar.
    const proche = this.nearestBlip(this._blips || []);
    const near = this.el('#radar-near');
    if (proche) {
      near.innerHTML = `<i style="background:${proche.color}"></i>${proche.name} · ${Math.round(proche.dist)} m`;
      near.style.opacity = '1';
    } else {
      near.style.opacity = '0';
    }

    if (this.mapOpen) this.drawMap();
  }

  /* ------------------------------------------------------------------ radar */

  blips() {
    const g = this.game;
    const list = [];
    for (const m of MISSIONS) {
      if (!g.missions.available(m)) continue;
      list.push({
        x: m.x, z: m.z, glyph: m.letter, size: 7, shape: 'pin', name: `${m.kind} · ${m.name}`,
        color: m.char ? CHARACTERS[m.char].color : BLIP_COLORS.mission,
      });
    }
    const boutiques = {
      garage: { glyph: '⚒', name: 'Los Santos Customs' },
      ammunation: { glyph: '⌖', name: 'Ammu-Nation' },
      hospital: { glyph: '✚', name: 'Hôpital' },
    };
    for (const l of g.data.landmarks) {
      const b = boutiques[l.kind];
      if (b) list.push({ x: l.x, z: l.z, color: BLIP_COLORS[l.kind], glyph: b.glyph, size: 6, shape: 'disque', name: b.name });
      if (l.kind === 'police') list.push({ x: l.x, z: l.z, color: BLIP_COLORS.police, size: 6, shape: 'ecusson', name: 'Commissariat' });
    }
    const wp = g.missions.waypoint;
    if (wp) list.push({ x: wp.x, z: wp.z, color: '#f5d442', size: 9, shape: 'anneau', name: 'Objectif' });
    if (this.waypoint) list.push({ x: this.waypoint.x, z: this.waypoint.z, color: BLIP_COLORS.waypoint, size: 9, shape: 'anneau', name: 'Destination' });
    for (const v of g.vehicles) {
      if (v.ai && v.ai.chase && !v.dead) list.push({ x: v.x, z: v.z, color: BLIP_COLORS.cop, size: 5, shape: 'losange', vivant: true });
    }
    for (const p of g.peds) {
      if (p.cop && !p.dead) list.push({ x: p.x, z: p.z, color: BLIP_COLORS.cop, size: 4, shape: 'losange', vivant: true });
      if (p.hostile && !p.dead) list.push({ x: p.x, z: p.z, color: BLIP_COLORS.enemy, size: 4, shape: 'fleche', vivant: true });
    }
    for (const h of g.police.helis) list.push({ x: h.x, z: h.z, color: BLIP_COLORS.cop, size: 6, shape: 'croix', vivant: true });
    return list;
  }

  /**
   * Le repère fixe le plus proche, pour l'afficher en toutes lettres sous le
   * radar : une pastille de couleur ne dit à personne ce qu'elle désigne.
   */
  nearestBlip(liste) {
    const p = this.game.player;
    let best = null; let bd = 260;
    for (const b of liste) {
      if (b.vivant || !b.name) continue;
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d < bd) { bd = d; best = { name: b.name, dist: d, color: b.color }; }
    }
    return best;
  }

  drawRadar() {
    const g = this.game;
    const p = g.player;
    const c = this.rctx;
    const W = this.radar.width, H = this.radar.height;
    const scale = p.vehicle ? 0.30 : 0.42;
    const yaw = g.camera.yaw;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);

    /**
     * Le cap du joueur pointe vers le haut et la gauche du radar est la gauche
     * de l'écran. L'avant du monde vaut (sin, cos) et la droite de l'écran
     * (-cos, sin) : d'où cette matrice, qui n'est pas un simple pivot.
     */
    const toRadar = (wx, wz) => [
      (-(wx - p.x) * cy + (wz - p.z) * sy) * scale + W / 2,
      (-(wx - p.x) * sy - (wz - p.z) * cy) * scale + H / 2,
    ];

    c.save();
    c.clearRect(0, 0, W, H);
    c.beginPath();
    if (c.roundRect) c.roundRect(0, 0, W, H, 10); else c.rect(0, 0, W, H);
    c.clip();
    c.fillStyle = '#222d38';
    c.fillRect(0, 0, W, H);

    // À l'intérieur d'un bâtiment, le plan de la ville n'a plus de sens : on
    // affiche le nom du lieu plutôt qu'une carte vide au milieu de nulle part.
    if (g.inside) {
      c.fillStyle = '#1a222c';
      c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(245,212,66,.9)';
      c.font = '600 13px "Arial Narrow", Arial, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('INTÉRIEUR', W / 2, H / 2 - 11);
      c.fillStyle = 'rgba(236,240,244,.85)';
      c.font = '500 12px Arial, sans-serif';
      c.fillText(g.inside.name, W / 2, H / 2 + 8, W - 16);
      c.restore();
      c.save();
      c.strokeStyle = 'rgba(0,0,0,0.85)';
      c.lineWidth = 3;
      c.beginPath();
      if (c.roundRect) c.roundRect(1.5, 1.5, W - 3, H - 3, 10); else c.rect(1.5, 1.5, W - 3, H - 3);
      c.stroke();
      c.restore();
      this._blips = [];
      return;
    }

    c.translate(W / 2, H / 2);
    c.transform(-cy * scale, -sy * scale, sy * scale, -cy * scale, 0, 0);
    c.translate(-p.x, -p.z);

    // mer, sable, parcs
    c.fillStyle = '#17394f';
    c.fillRect(-2000, -2000, 2000 + OCEAN_X, 4000);
    c.fillStyle = '#c9b58a';
    c.fillRect(OCEAN_X, -2000, SHORE_X - OCEAN_X + 40, 4000);
    c.fillStyle = '#3e5c33';
    for (const b of g.data.blocks) {
      if (b.ground === 'grass') c.fillRect(b.x - b.half, b.z - b.half, b.half * 2, b.half * 2);
    }
    // routes
    for (const pass of [0, 1]) {
      c.strokeStyle = pass ? '#93a2b0' : '#6e7d8b';
      for (const r of g.data.roads) {
        if (pass && !r.boulevard) continue;
        c.lineWidth = pass ? 1.6 : (r.horiz ? r.d : r.w);
        c.beginPath();
        if (r.horiz) { c.moveTo(r.x - r.w / 2, r.z); c.lineTo(r.x + r.w / 2, r.z); }
        else { c.moveTo(r.x, r.z - r.d / 2); c.lineTo(r.x, r.z + r.d / 2); }
        c.stroke();
      }
    }
    c.restore();

    // Repères et joueur : dessinés à plat, pour rester lisibles.
    c.save();
    c.beginPath();
    if (c.roundRect) c.roundRect(0, 0, W, H, 10); else c.rect(0, 0, W, H);
    c.clip();

    if (p.wanted > 0 && g.police.flash > 0 && g.police.lastSeen) {
      const [sx, sz] = toRadar(g.police.lastSeen.x, g.police.lastSeen.z);
      const r = (55 + p.wanted * 45) * scale;
      c.strokeStyle = Math.floor(g.time * 3) % 2 ? 'rgba(90,140,240,.95)' : 'rgba(240,80,80,.95)';
      c.fillStyle = 'rgba(60,100,200,.16)';
      c.lineWidth = 2;
      c.beginPath(); c.arc(sx, sz, r, 0, 6.29); c.fill(); c.stroke();
    }

    const limit = Math.min(W, H) / 2 - 10;
    const liste = this.blips();
    this._blips = liste;
    for (const b of liste) {
      const [sx, sz] = toRadar(b.x, b.z);
      const dx = sx - W / 2, dz = sz - H / 2;
      const d = Math.hypot(dx, dz);
      const r = (b.size || 5) * 0.95;
      if (d > limit) {
        // hors de portée : une flèche au bord, qui montre la direction
        drawEdgeArrow(c, W / 2 + (dx / d) * limit, H / 2 + (dz / d) * limit,
          Math.atan2(dx, -dz), b.color, r * 0.8);
      } else {
        drawBlip(c, sx, sz, b, r);
      }
    }

    // le joueur, toujours au centre et pointé vers le haut
    c.translate(W / 2, H / 2);
    c.fillStyle = '#ffffff';
    c.strokeStyle = 'rgba(0,0,0,.6)';
    c.lineWidth = 1.5;
    const a = 7;
    c.beginPath();
    c.moveTo(0, -a); c.lineTo(a * 0.62, a * 0.72); c.lineTo(0, a * 0.36); c.lineTo(-a * 0.62, a * 0.72);
    c.closePath(); c.fill(); c.stroke();
    c.restore();

    // cadre
    c.save();
    c.strokeStyle = 'rgba(0,0,0,0.85)';
    c.lineWidth = 3;
    c.beginPath();
    if (c.roundRect) c.roundRect(1.5, 1.5, W - 3, H - 3, 10); else c.rect(1.5, 1.5, W - 3, H - 3);
    c.stroke();
    c.restore();
  }

  /* ------------------------------------------------------------- grande carte */

  drawMap() {
    const g = this.game;
    const c = this.mctx;
    const cv = this.mapCanvas;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const z = this.mapZoom;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#101a22';
    c.fillRect(0, 0, w, h);
    c.save();
    c.translate(w / 2, h / 2);
    c.scale(z, z);
    c.translate(-this.mapCenter.x, -this.mapCenter.z);

    c.fillStyle = '#16323f';
    c.fillRect(-2200, -2200, 2200 + OCEAN_X, 4400);
    c.fillStyle = '#d3c096';
    c.fillRect(OCEAN_X, -2200, SHORE_X - OCEAN_X + 40, 4400);
    c.fillStyle = '#26303a';
    c.fillRect(SHORE_X + 40, -1200, 2400, 2400);
    c.fillStyle = '#2f4a2c';
    for (const b of g.data.blocks) {
      if (b.ground === 'grass') c.fillRect(b.x - b.half, b.z - b.half, b.half * 2, b.half * 2);
    }
    c.fillStyle = '#39424c';
    for (const b of g.data.blocks) {
      if (b.ground !== 'grass') c.fillRect(b.x - b.half, b.z - b.half, b.half * 2, b.half * 2);
    }
    c.strokeStyle = '#7d8c99';
    for (const r of g.data.roads) {
      c.lineWidth = (r.horiz ? r.d : r.w) * 0.8;
      c.beginPath();
      if (r.horiz) { c.moveTo(r.x - r.w / 2, r.z); c.lineTo(r.x + r.w / 2, r.z); }
      else { c.moveTo(r.x, r.z - r.d / 2); c.lineTo(r.x, r.z + r.d / 2); }
      c.stroke();
    }
    // aéroport et port
    c.fillStyle = '#333c44';
    c.fillRect(g.data.airport.x - 360, g.data.airport.z - 40, 720, 80);
    c.restore();

    // noms de quartiers (non déformés)
    c.save();
    c.textAlign = 'center';
    c.fillStyle = 'rgba(232,236,240,0.55)';
    for (const zo of ZONES) {
      const sx = (zo.x - this.mapCenter.x) * z + w / 2;
      const sy = (zo.z - this.mapCenter.z) * z + h / 2;
      if (sx < -60 || sx > w + 60 || sy < -20 || sy > h + 20) continue;
      c.font = `600 ${clamp(13 * Math.sqrt(z / 0.24), 9, 20)}px "Arial Narrow", Arial, sans-serif`;
      c.fillText(zo.name.toUpperCase(), sx, sy);
    }
    // zone de recherche : cercle clignotant quand la police vous a perdu
    if (g.player.wanted > 0 && g.police.flash > 0 && g.police.lastSeen) {
      const r = 55 + g.player.wanted * 45;
      c.save();
      c.strokeStyle = Math.floor(g.time * 3) % 2 ? 'rgba(90,140,240,0.95)' : 'rgba(240,80,80,0.95)';
      c.fillStyle = 'rgba(60,100,200,0.16)';
      c.lineWidth = 3 / scale;
      c.beginPath();
      c.arc(g.police.lastSeen.x, g.police.lastSeen.z, r, 0, 6.29);
      c.fill(); c.stroke();
      c.restore();
    }

    // repères, avec leur nom en clair dès qu'on est un peu zoomé
    const blips = this.blips();
    for (const b of blips) {
      const sx = (b.x - this.mapCenter.x) * z + w / 2;
      const sy = (b.z - this.mapCenter.z) * z + h / 2;
      if (sx < -30 || sx > w + 30 || sy < -30 || sy > h + 30) continue;
      const r = (b.size || 5) * 1.25;
      drawBlip(c, sx, sy, b, r);
      if (b.name && z > 0.3) {
        c.font = '600 11px "Arial Narrow", Arial, sans-serif';
        c.textAlign = 'center'; c.textBaseline = 'top';
        c.lineWidth = 3; c.strokeStyle = 'rgba(6,9,13,.9)';
        c.strokeText(b.name, sx, sy + r + 3);
        c.fillStyle = 'rgba(236,240,244,.92)';
        c.fillText(b.name, sx, sy + r + 3);
      }
    }
    // joueur
    const p = g.player;
    const px = (p.x - this.mapCenter.x) * z + w / 2;
    const pz = (p.z - this.mapCenter.z) * z + h / 2;
    c.save();
    c.translate(px, pz);
    c.rotate(p.vehicle ? p.vehicle.yaw : p.yaw);
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(0, 9); c.lineTo(-6, -7); c.lineTo(0, -3); c.lineTo(6, -7);
    c.closePath(); c.fill();
    c.restore();
    c.restore();
  }

  toggleMap(on) {
    this.mapOpen = on !== undefined ? on : !this.mapOpen;
    this.el('#map-screen').classList.toggle('show', this.mapOpen);
    if (this.mapOpen) {
      this.mapCenter = { x: this.game.player.x, z: this.game.player.z };
      this.buildMapKey();
      this.buildMissionList();
      this.hideMapInfo();
      this.drawMap();
    }
    return this.mapOpen;
  }

  /**
   * Légende de la carte : chaque forme est redessinée en vrai sur un petit
   * canevas, pour qu'on reconnaisse exactement ce qu'on voit sur le radar.
   */
  buildMapKey() {
    const el = this.el('#map-key');
    if (!el || el.dataset.pret) return;
    el.dataset.pret = '1';
    el.innerHTML = '<h4>Légende</h4>';
    for (const e of BLIP_LEGEND) {
      const ligne = document.createElement('div');
      const cv = document.createElement('canvas');
      cv.width = 44; cv.height = 44;               // dessiné en double, affiché en 22
      const cx = cv.getContext('2d');
      drawBlip(cx, 22, 22, e, 13);
      const txt = document.createElement('span');
      txt.textContent = e.label;
      ligne.append(cv, txt);
      el.append(ligne);
    }
  }

  /* ------------------------------------------- barre de commandes et aide */

  /** Ce qu'on peut faire là, maintenant, avec quelle touche. */
  updateKeyBar() {
    const el = this.el('#keybar');
    if (!el) return;
    const keys = contextKeys(this.game);
    const clef = keys.map((k) => k.join('\u0000')).join('|');
    if (clef === this._keybar) return;            // on ne redessine que si ça change
    this._keybar = clef;
    el.innerHTML = keys.map(([k, t]) => `<span><i>${k}</i>${t}</span>`).join('');
  }

  toggleHelp(on) {
    this.helpOpen = on !== undefined ? on : !this.helpOpen;
    const el = this.el('#help');
    if (!el) return this.helpOpen;
    el.classList.toggle('show', this.helpOpen);
    if (this.helpOpen && !el.dataset.pret) {
      el.dataset.pret = '1';
      el.querySelector('.help-body').innerHTML = HELP_SECTIONS.map((sec) => `<h5>${sec.title}</h5>`
        + sec.rows.map(([k, t]) => `<div class="row"><u><b>${k}</b></u><span>${t}</span></div>`).join('')).join('');
      const fermer = this.el('#help-close');
      if (fermer) fermer.addEventListener('click', () => this.game.toggleHelp(false));
    }
    return this.helpOpen;
  }

  /** Encart du tutoriel : l'étape en cours, ou rien une fois fini. */
  updateTutorial(onb, dt = 1 / 60) {
    const el = this.el('#tutorial');
    if (!el) return;
    const s = onb.current;
    if (!s) {
      if (this.tutoFin === undefined) this.tutoFin = 3.5;   // on laisse le mot de la fin
      this.tutoFin -= dt;
      if (this.tutoFin > 0) {
        el.hidden = false;
        el.classList.add('done');
        this.el('#tuto-goal').innerHTML = 'Vous savez tout. <b>H</b> rappelle les commandes.';
        this.el('#tuto-why').textContent = 'La ville est à vous.';
        this.el('#tuto-count').textContent = `${TUTORIAL_STEPS.length} / ${TUTORIAL_STEPS.length}`;
      } else el.hidden = true;
      return;
    }
    el.hidden = false;
    el.classList.remove('done');
    if (this._tutoStep !== s.id) {
      this._tutoStep = s.id;
      this.el('#tuto-goal').innerHTML = s.goal;
      this.el('#tuto-why').innerHTML = s.why;
      this.el('#tuto-count').textContent = `${onb.step + 1} / ${TUTORIAL_STEPS.length}`;
    }
  }

  /* ------------------------------------------------------------- inventaire */

  /**
   * Inventaire : la roue des armes suppose de maintenir Tab, ce que personne
   * ne devine. Ici on voit tout d'un coup et on clique.
   */
  toggleInventory(on) {
    this.invOpen = on !== undefined ? on : !this.invOpen;
    this.el('#inventory').classList.toggle('show', this.invOpen);
    if (this.invOpen) this.buildInventory();
    return this.invOpen;
  }

  buildInventory() {
    const g = this.game;
    const p = g.player;
    this.el('#inv-money').textContent = `$${p.money.toLocaleString('fr-FR')}`;
    const grille = this.el('.inv-grid');
    grille.innerHTML = '';
    WEAPON_ORDER.forEach((cle, i) => {
      const w = WEAPONS[cle];
      const possede = !!p.owned[cle];
      const b = document.createElement('button');
      b.className = 'inv-item' + (p.weapon === cle ? ' on' : '');
      b.disabled = !possede;
      const munitions = w.melee ? 'à la main'
        : possede ? `${p.mags[cle] || 0} / ${p.ammo[cle] || 0}`
          : 'non possédée';
      b.innerHTML = `<i>${w.icon}</i><u>${w.name}<small>${munitions}</small></u><kbd>${i + 1}</kbd>`;
      b.addEventListener('click', () => {
        if (!possede) return;
        p.switchWeapon(cle);
        g.audio.ui(520, 0.04, 0.08);
        this.buildInventory();
      });
      grille.append(b);
    });
  }

  /* --------------------------------------------------------- roues de sélection */

  showWeaponWheel(on) {
    this.wheelOpen = on;
    const el = this.el('#weapon-wheel');
    el.classList.toggle('show', on);
    if (!on) return;
    const p = this.game.player;
    el.innerHTML = '';
    const owned = WEAPON_ORDER.filter((k) => p.owned[k]);
    const n = owned.length;
    owned.forEach((k, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const d = document.createElement('div');
      d.className = `wheel-item${k === p.weapon ? ' sel' : ''}`;
      d.style.left = `${50 + Math.cos(a) * 34}%`;
      d.style.top = `${50 + Math.sin(a) * 34}%`;
      d.innerHTML = `<div class="wi-icon">${WEAPONS[k].icon}</div><div class="wi-name">${WEAPONS[k].name}</div>`;
      d.addEventListener('mouseenter', () => {
        p.switchWeapon(k);
        this.showWeaponWheel(true);
      });
      el.appendChild(d);
    });
  }

  showCharWheel(on) {
    this.charWheelOpen = on;
    const el = this.el('#char-wheel');
    el.classList.toggle('show', on);
    if (!on) return;
    el.innerHTML = '';
    const keys = Object.keys(CHARACTERS);
    keys.forEach((k, i) => {
      const c = CHARACTERS[k];
      const d = document.createElement('div');
      d.className = `char-item${k === this.game.player.character ? ' sel' : ''}`;
      d.style.borderColor = c.color;
      d.innerHTML = `<div class="ci-name" style="color:${c.color}">${c.name}</div>
        <div class="ci-ability">${c.ability}</div><div class="ci-hint">${c.hint}</div>
        <div class="ci-key">${i + 1}</div>`;
      d.addEventListener('click', () => this.game.switchCharacter(k));
      el.appendChild(d);
    });
  }
}
