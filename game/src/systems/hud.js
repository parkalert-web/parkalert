/**
 * Interface : radar, barres de vie et de gilet, étoiles de recherche, argent,
 * arme, objectifs, bandeaux, roue des armes, sélecteur de personnage,
 * carte plein écran et menu pause.
 */
import { clamp, lerp, dist2D } from '../engine/math.js';
import { MISSIONS } from './missions.js';
import { WEAPONS, WEAPON_ORDER } from './weapons.js';
import { CHARACTERS } from '../entities/player.js';
import { STREET, GRID, CITY_MAX, SHORE_X, OCEAN_X, ZONES, zoneAt } from '../world/gen.js';

const BLIP_COLORS = {
  mission: '#f5d442', garage: '#4fb0e8', ammunation: '#e08a2a', hospital: '#e05a5a',
  police: '#4f7fe8', waypoint: '#e055c8', cop: '#3f6fe0', player: '#ffffff', enemy: '#e04030',
};

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
    if (this.waypoint && dist2D(this.waypoint.x, this.waypoint.z, x, z) < 30 / this.mapZoom) {
      this.waypoint = null;
    } else {
      this.waypoint = { x, z };
    }
    this.game.audio.ui(620, 0.05, 0.1);
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
    el.querySelector('.n-sub').textContent = n.sub || '';
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
      const gear = veh.speed < -0.5 ? 'R' : Math.min(6, Math.max(1, Math.floor(Math.abs(veh.speed) / (veh.model.top / 5)) + 1));
      this.el('#gear').textContent = gear;
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

    this.drawRadar(dt);
    if (this.mapOpen) this.drawMap();
  }

  /* ------------------------------------------------------------------ radar */

  blips() {
    const g = this.game;
    const list = [];
    for (const m of MISSIONS) {
      if (!g.missions.available(m)) continue;
      list.push({
        x: m.x, z: m.z, letter: m.letter, size: 7,
        color: m.char ? CHARACTERS[m.char].color : BLIP_COLORS.mission,
      });
    }
    for (const l of g.data.landmarks) {
      if (l.kind === 'garage') list.push({ x: l.x, z: l.z, color: BLIP_COLORS.garage, letter: '🔧', size: 6 });
      if (l.kind === 'ammunation') list.push({ x: l.x, z: l.z, color: BLIP_COLORS.ammunation, letter: '🔫', size: 6 });
      if (l.kind === 'hospital') list.push({ x: l.x, z: l.z, color: BLIP_COLORS.hospital, letter: '✚', size: 6 });
      if (l.kind === 'police') list.push({ x: l.x, z: l.z, color: BLIP_COLORS.police, letter: '★', size: 6 });
    }
    const wp = g.missions.waypoint;
    if (wp) list.push({ x: wp.x, z: wp.z, color: '#f5d442', letter: '', size: 8, ring: true });
    if (this.waypoint) list.push({ x: this.waypoint.x, z: this.waypoint.z, color: BLIP_COLORS.waypoint, letter: '', size: 8, ring: true });
    for (const v of g.vehicles) {
      if (v.ai && v.ai.chase && !v.dead) list.push({ x: v.x, z: v.z, color: BLIP_COLORS.cop, size: 5 });
    }
    for (const p of g.peds) {
      if (p.cop && !p.dead) list.push({ x: p.x, z: p.z, color: BLIP_COLORS.cop, size: 4 });
      if (p.hostile && !p.dead) list.push({ x: p.x, z: p.z, color: BLIP_COLORS.enemy, size: 4 });
    }
    for (const h of g.police.helis) list.push({ x: h.x, z: h.z, color: BLIP_COLORS.cop, size: 6, heli: true });
    return list;
  }

  drawRadar(dt) {
    const g = this.game;
    const p = g.player;
    const c = this.rctx;
    const W = this.radar.width, H = this.radar.height;
    const scale = p.vehicle ? 0.30 : 0.42;
    const ang = -g.camera.yaw;
    c.save();
    c.clearRect(0, 0, W, H);
    c.beginPath();
    c.roundRect ? c.roundRect(0, 0, W, H, 10) : c.rect(0, 0, W, H);
    c.clip();
    c.fillStyle = '#222d38';
    c.fillRect(0, 0, W, H);

    c.translate(W / 2, H / 2);
    c.rotate(ang);
    c.scale(scale, scale);
    c.translate(-p.x, -p.z);

    const R = Math.max(W, H) / scale;
    // mer
    c.fillStyle = '#17394f';
    c.fillRect(-2000, -2000, 2000 + OCEAN_X, 4000);
    // sable
    c.fillStyle = '#c9b58a';
    c.fillRect(OCEAN_X, -2000, SHORE_X - OCEAN_X + 40, 4000);
    // parcs
    c.fillStyle = '#3e5c33';
    for (const b of g.data.blocks) {
      if (b.ground === 'grass') c.fillRect(b.x - b.half, b.z - b.half, b.half * 2, b.half * 2);
    }
    // routes
    c.strokeStyle = '#6e7d8b';
    for (const r of g.data.roads) {
      c.lineWidth = r.horiz ? r.d : r.w;
      c.beginPath();
      if (r.horiz) { c.moveTo(r.x - r.w / 2, r.z); c.lineTo(r.x + r.w / 2, r.z); }
      else { c.moveTo(r.x, r.z - r.d / 2); c.lineTo(r.x, r.z + r.d / 2); }
      c.stroke();
    }
    // pointillés des grands axes
    c.strokeStyle = '#93a2b0';
    c.lineWidth = 1.2;
    for (const r of g.data.roads) {
      if (!r.boulevard) continue;
      c.beginPath();
      if (r.horiz) { c.moveTo(r.x - r.w / 2, r.z); c.lineTo(r.x + r.w / 2, r.z); }
      else { c.moveTo(r.x, r.z - r.d / 2); c.lineTo(r.x, r.z + r.d / 2); }
      c.stroke();
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

    // blips
    for (const b of this.blips()) {
      const dx = b.x - p.x, dz = b.z - p.z;
      const d = Math.hypot(dx, dz);
      const maxD = (Math.min(W, H) / 2 - 10) / scale;
      let bx = b.x, bz = b.z;
      if (d > maxD) { bx = p.x + (dx / d) * maxD; bz = p.z + (dz / d) * maxD; }
      c.save();
      c.translate(bx, bz);
      c.rotate(-ang);
      c.fillStyle = b.color;
      const s = (b.size || 5) / scale * 0.55;
      if (b.ring) {
        c.strokeStyle = b.color; c.lineWidth = 2.4 / scale;
        c.beginPath(); c.arc(0, 0, s, 0, 6.29); c.stroke();
        c.beginPath(); c.arc(0, 0, s * 0.35, 0, 6.29); c.fill();
      } else {
        c.beginPath();
        c.arc(0, 0, s, 0, 6.29);
        c.fill();
        if (b.letter && b.letter.length === 1) {
          c.fillStyle = '#101418';
          c.font = `bold ${s * 1.35}px Arial`;
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(b.letter, 0, s * 0.06);
        }
      }
      c.restore();
    }

    // joueur
    c.save();
    c.translate(p.x, p.z);
    c.rotate(p.vehicle ? p.vehicle.yaw : p.yaw);
    c.fillStyle = '#ffffff';
    const s = 7 / scale;
    c.beginPath();
    c.moveTo(0, s); c.lineTo(-s * 0.62, -s * 0.72); c.lineTo(0, -s * 0.36); c.lineTo(s * 0.62, -s * 0.72);
    c.closePath(); c.fill();
    c.restore();
    c.restore();

    // cadre + cône de vue
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

    // blips
    for (const b of this.blips()) {
      const sx = (b.x - this.mapCenter.x) * z + w / 2;
      const sy = (b.z - this.mapCenter.z) * z + h / 2;
      c.fillStyle = b.color;
      c.beginPath(); c.arc(sx, sy, (b.size || 5) * 1.15, 0, 6.29); c.fill();
      if (b.letter && b.letter.length === 1) {
        c.fillStyle = '#101418';
        c.font = 'bold 10px Arial';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(b.letter, sx, sy + 0.5);
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
      this.drawMap();
    }
    return this.mapOpen;
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
