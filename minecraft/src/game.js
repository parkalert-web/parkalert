/**
 * Minecraft JS — assemblage : boucle de jeu, entrées, rendu des entités,
 * apparition des créatures, chat et commandes, sauvegarde automatique.
 *
 * Le temps est découpé comme dans le jeu : 20 « ticks » par seconde pour la
 * logique (pousse, fluides, IA), et autant d'images que l'écran en accepte.
 */

import { World, TICK_MS, DAY_TICKS } from './world.js';
import { buildChunkMesh } from './mesher.js';
import { Renderer } from './renderer.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import {
  Entity, ItemEntity, XPOrb, Arrow, PrimedTNT, Mob, MOBS, Particles, spawnCycle, explode,
} from './entities.js';
import { BLOCKS, blockDrops, idByName } from './blocks.js';
import { getItem, maxStackOf, stack, toolStats } from './items.js';
import { smeltResult } from './crafting.js';
import { rayHitsEntity } from './physics.js';
import { T } from './textures.js';
import { mat4, multiply, composeMatrix, translate, rotateX, scaleM, identity } from './math.js';
import { saveGame, seedFromString } from './save.js';
import { WORLD_H, SEA_LEVEL } from './chunk.js';

const KEY_BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sneak: ['ShiftLeft', 'ShiftRight'],
  sprint: ['ControlLeft', 'ControlRight'],
};

export class Game {
  constructor(canvas, meta, savedChunks, settings) {
    this.canvas = canvas;
    this.meta = meta;
    this.settings = settings;
    this.audio = new Audio();
    this.renderer = new Renderer(canvas);
    this.renderer.maxDpr = settings.dpr ?? 1.5;

    this.world = new World({
      seed: meta.seed,
      time: meta.time ?? 1000,
      renderDistance: settings.renderDistance ?? 8,
      savedChunks,
      onChunkUnload: (c) => this.renderer.freeChunk(c),
    });
    this.world.weather = meta.weather || 'clear';
    this.world.rainTicks = meta.rainTicks || 0;
    this.world.smeltFn = smeltResult;
    this.world.fuelFn = (name) => { const it = getItem(name); return it ? it.fuel : 0; };
    this.world.onNaturalBreak = (x, y, z, bl, data) => this.dropBlock(x + 0.5, y + 0.5, z + 0.5, bl, data);
    this.world.onLeafDecay = (x, y, z, bl) => {
      this.dropBlock(x + 0.5, y + 0.5, z + 0.5, bl, 0);
      this.particles.block(x + 0.5, y + 0.5, z + 0.5, bl.tiles[0], 6);
    };
    this.world.onFluidMix = (x, y, z) => this.audio.play('fizz', { x, y, z });
    this.world.onSmelt = () => {};

    this.worldSpawn = this.world.gen.findSpawn();
    this.player = new Player({ ...this.worldSpawn, mode: meta.mode });
    if (meta.player) this.player.fromJSON(meta.player);
    else if (meta.mode === 'creative') this.giveStarterKit();

    this.entities = [];
    this.particles = new Particles();
    this.ui = new UI(this);
    this.input = {
      forward: false, back: false, left: false, right: false, jump: false, sneak: false, sprint: false,
      mouseLeft: false, mouseRight: false,
    };

    this.paused = false;
    this.running = false;
    this.accumulator = 0;
    this.fps = 0;
    this.frameMs = 0;
    this.frames = 0;
    this.fpsTime = 0;
    this.lastTime = 0;
    this.thirdPerson = 0;
    this.spawnTimer = 0;
    this.autosaveTimer = 0;
    this.chatOpen = false;
    this.sleepUntil = 0;

    this.bindEvents();
    this.ctx = this.makeContext();
  }

  giveStarterKit() {
    const inv = this.player.inventory;
    // Une pile pleine de chaque, en respectant la taille maximale : un seau
    // ne s'empile pas, en donner 64 remplirait tout l'inventaire.
    for (const n of ['grass_block', 'stone', 'oak_planks', 'glass', 'torch', 'oak_log', 'sand', 'wool_red', 'water_bucket']) {
      inv.add(stack(n, maxStackOf(n)));
    }
  }

  /** Contexte partagé, passé aux entités et au joueur. */
  makeContext() {
    return {
      world: this.world,
      player: this.player,
      entities: this.entities,
      particles: this.particles,
      input: this.input,
      worldSpawn: this.worldSpawn,
      tick: 0,
      maxStack: (n) => maxStackOf(n),
      spawn: (e) => this.entities.push(e),
      sound: (name, pos, mat) => this.audio.play(name, pos, mat),
      dropItem: (x, y, z, s, scatter) => this.dropItem(x, y, z, s, scatter),
      dropBlock: (x, y, z, bl, data) => this.dropBlock(x, y, z, bl, data),
      spawnXP: (x, y, z, n) => this.entities.push(new XPOrb(x, y, z, n)),
      primeTNT: (x, y, z) => this.entities.push(new PrimedTNT(x, y, z)),
      openScreen: (kind, data) => this.openScreen(kind, data),
      sleep: (hit) => this.trySleep(hit),
      message: (m) => this.ui.message(m),
    };
  }

  /* ──────────────────────────── Entrées ──────────────────────────── */

  bindEvents() {
    const canvas = this.canvas;
    this.onKeyDown = (e) => this.handleKey(e, true);
    this.onKeyUp = (e) => this.handleKey(e, false);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    canvas.addEventListener('mousedown', (e) => {
      if (this.ui.isOpen || this.paused) return;
      if (document.pointerLockElement !== canvas) { this.setClickToPlay(false); canvas.requestPointerLock?.(); this.audio.resume(); return; }
      if (e.button === 0) { this.input.mouseLeft = true; this.onLeftClick(); }
      if (e.button === 2) { this.input.mouseRight = true; this.onRightClick(); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) { this.input.mouseLeft = false; this.player.breakProgress = 0; this.player.breakTarget = null; this.releaseBow(); }
      if (e.button === 2) this.input.mouseRight = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    this.onMouseMove = (e) => {
      if (document.pointerLockElement !== canvas) return;
      const s = (this.settings.sensitivity ?? 1) * 0.0022;
      this.player.yaw += e.movementX * s;
      this.player.pitch -= e.movementY * s;
      const lim = Math.PI / 2 - 0.001;
      this.player.pitch = Math.max(-lim, Math.min(lim, this.player.pitch));
      this.player.yaw = ((this.player.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    };
    document.addEventListener('mousemove', this.onMouseMove);

    canvas.addEventListener('wheel', (e) => {
      if (this.ui.isOpen) return;
      e.preventDefault();
      const inv = this.player.inventory;
      inv.selected = (inv.selected + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
      this.ui.showItemName();
    }, { passive: false });

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas;
      if (locked) { this.hadPointerLock = true; this.setClickToPlay(false); return; }
      // On ne met en pause que si le joueur avait vraiment la main sur la souris.
      if (this.hadPointerLock && !this.ui.isOpen && !this.chatOpen && this.running && !this.paused) {
        this.hadPointerLock = false;
        this.setPaused(true);
      }
    });

    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('beforeunload', () => { if (this.running) this.save(); });
  }

  handleKey(e, down) {
    if (this.chatOpen) {
      if (!down) return;
      if (e.code === 'Escape') { this.closeChat(false); e.preventDefault(); }
      if (e.code === 'Enter') { this.closeChat(true); e.preventDefault(); }
      return;
    }

    for (const [action, codes] of Object.entries(KEY_BINDINGS)) {
      if (codes.includes(e.code)) this.input[action] = down;
    }
    if (!down) {
      if (e.code === 'ShiftLeft') this.player.sneaking = false;
      return;
    }

    const p = this.player;
    switch (e.code) {
      case 'Escape':
        if (this.ui.isOpen) this.ui.closeScreen();
        else this.setPaused(!this.paused);
        e.preventDefault();
        break;
      case 'KeyE':
        if (this.ui.isOpen) this.ui.closeScreen();
        else this.openScreen(p.mode === 'creative' ? 'creative' : 'inventory');
        break;
      case 'KeyQ':
        if (!this.ui.isOpen) this.dropHeld(e.ctrlKey);
        break;
      case 'KeyT':
      case 'Slash':
        if (!this.ui.isOpen) { this.openChat(e.code === 'Slash' ? '/' : ''); e.preventDefault(); }
        break;
      case 'F3':
        this.ui.toggleDebug();
        e.preventDefault();
        break;
      case 'F5':
        this.thirdPerson = (this.thirdPerson + 1) % 3;
        break;
      case 'F11':
        this.toggleFullscreen();
        e.preventDefault();
        break;
      case 'ShiftLeft':
        p.sneaking = true;
        break;
      case 'Space': {
        // Double appui sur Espace : vol en créatif.
        const now = performance.now();
        if (p.mode === 'creative' && this.lastSpace && now - this.lastSpace < 320) {
          p.flying = !p.flying;
          p.vy = 0;
          this.ui.message(p.flying ? 'Vol activé' : 'Vol désactivé');
        }
        this.lastSpace = now;
        break;
      }
      case 'ControlLeft':
        if (this.input.forward) p.sprinting = true;
        break;
      case 'KeyR':
        if (p.dead) this.respawn();
        break;
      default:
        if (/^Digit[1-9]$/.test(e.code)) {
          p.inventory.selected = parseInt(e.code.slice(5), 10) - 1;
          this.ui.showItemName();
        }
        break;
    }
  }

  requestPointerLock() {
    if (this.ui.isOpen || this.paused || this.chatOpen) return;
    const r = this.canvas.requestPointerLock?.();
    // Certains navigateurs exigent un geste de l'utilisateur : on l'invite à cliquer.
    if (r && typeof r.catch === 'function') r.catch(() => this.setClickToPlay(true));
    setTimeout(() => {
      if (document.pointerLockElement !== this.canvas && !this.paused && !this.ui.isOpen) {
        this.setClickToPlay(true);
      }
    }, 260);
  }

  /** Bandeau « cliquez pour jouer » quand la souris n'est pas capturée. */
  setClickToPlay(show) {
    if (show) {
      if (this.clickHint) return;
      const div = document.createElement('div');
      div.className = 'click-to-play';
      div.innerHTML = '<div class="ctp-box">Cliquez pour jouer<span>La souris pilote la caméra · Échap pour la libérer</span></div>';
      div.addEventListener('mousedown', () => { this.setClickToPlay(false); this.canvas.requestPointerLock?.(); this.audio.resume(); });
      document.getElementById('ui').append(div);
      this.clickHint = div;
    } else if (this.clickHint) {
      this.clickHint.remove();
      this.clickHint = null;
    }
  }

  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }

  /* ──────────────────────────── Actions ──────────────────────────── */

  onLeftClick() {
    const p = this.player;
    if (p.dead) return;
    p.swing = 1;
    // Une créature dans la ligne de mire est frappée en priorité.
    const target = this.entityUnderCursor();
    if (target) {
      p.attack(target, this.ctx);
      this.audio.play('hurt', target);
      return;
    }
  }

  onRightClick() {
    const p = this.player;
    if (p.dead) return;
    const target = this.entityUnderCursor();
    if (target && this.interactWithMob(target)) return;
    const action = p.useItem(this.ctx);
    if (action === 'bow' && p.bowCharge < 0) p.bowCharge = 0;
  }

  /** Tonte des moutons, traite des vaches, nourrissage. */
  interactWithMob(mob) {
    const p = this.player;
    const held = p.inventory.held;
    if (!held) return false;
    if (held.item === 'shears' && mob.type === 'sheep' && !mob.sheared) {
      mob.sheared = true;
      this.dropItem(mob.x, mob.y + 0.6, mob.z, stack('wool_white', 1 + Math.floor(Math.random() * 2)));
      p.inventory.damageHeld(1);
      this.audio.play('equip', mob);
      return true;
    }
    if (held.item === 'bucket' && mob.type === 'cow') {
      p.inventory.consume(p.inventory.selected);
      p.inventory.add(stack('milk_bucket', 1));
      this.audio.play('splash', mob);
      return true;
    }
    if (held.item === 'wheat_item' && !mob.def.hostile) {
      p.inventory.consume(p.inventory.selected);
      mob.state = 'idle';
      mob.hp = Math.min(mob.maxHp, mob.hp + 2);
      this.particles.damage(mob.x, mob.y + mob.height * 0.7, mob.z);
      return true;
    }
    return false;
  }

  releaseBow() {
    const p = this.player;
    if (p.bowCharge < 0) return;
    const charge = Math.min(1, p.bowCharge);
    p.bowCharge = -1;
    if (charge < 0.15) return;
    if (p.mode === 'survival' && p.inventory.count('arrow') === 0) return;
    if (p.mode === 'survival') p.inventory.remove('arrow', 1);
    const [dx, dy, dz] = p.lookVector();
    const speed = 18 + charge * 32;
    const a = new Arrow(p.x + dx * 0.6, p.eyeY - 0.1 + dy * 0.6, p.z + dz * 0.6,
      dx * speed, dy * speed, dz * speed, p, Math.round(2 + charge * 5));
    this.entities.push(a);
    p.inventory.damageHeld(1);
    this.audio.play('bow', p);
  }

  entityUnderCursor() {
    const p = this.player;
    const [dx, dy, dz] = p.lookVector();
    const hit = this.world.raycast(p.x, p.eyeY, p.z, dx, dy, dz, p.reach);
    const maxDist = hit ? hit.dist : p.reach;
    let best = null, bestT = maxDist;
    for (const e of this.entities) {
      if (e.dead || !(e instanceof Mob)) continue;
      const t = rayHitsEntity(p.x, p.eyeY, p.z, dx, dy, dz, e, bestT);
      if (t !== null && t < bestT) { bestT = t; best = e; }
    }
    return best;
  }

  dropHeld(all) {
    const p = this.player;
    const s = p.inventory.held;
    if (!s) return;
    const n = all ? s.count : 1;
    const drop = { item: s.item, count: n, dmg: s.dmg };
    s.count -= n;
    if (s.count <= 0) p.inventory.held = null;
    const [dx, dy, dz] = p.lookVector();
    const e = new ItemEntity(p.x + dx * 0.4, p.eyeY - 0.3, p.z + dz * 0.4, drop);
    e.vx = dx * 6; e.vy = dy * 6 + 1.5; e.vz = dz * 6;
    e.pickupDelay = 1;
    this.entities.push(e);
  }

  dropItem(x, y, z, s, scatter = false) {
    if (!s || s.count <= 0) return;
    const e = new ItemEntity(x, y, z, { item: s.item, count: s.count, dmg: s.dmg || 0 });
    const k = scatter ? 3 : 1.4;
    e.vx = (Math.random() - 0.5) * k;
    e.vy = 1.6 + Math.random() * (scatter ? 2 : 0.6);
    e.vz = (Math.random() - 0.5) * k;
    this.entities.push(e);
  }

  dropBlock(x, y, z, bl, data) {
    for (const d of blockDrops(bl, null, Math.random, data)) {
      this.dropItem(x, y, z, { item: d.item, count: d.count, dmg: 0 });
    }
  }

  openScreen(kind, data) {
    document.exitPointerLock?.();
    this.ui.openScreen(kind, data);
    this.audio.play('door');
  }

  trySleep(hit) {
    if (this.world.isDay()) { this.ui.message("Vous ne pouvez dormir que la nuit."); return; }
    const hostile = this.entities.some((e) => e instanceof Mob && e.def.hostile && e.distanceTo(this.player) < 12);
    if (hostile) { this.ui.message('Impossible de dormir : des monstres rôdent.'); return; }
    this.player.sleeping = true;
    this.player.spawnPoint = { x: hit.x + 0.5, y: hit.y + 1, z: hit.z + 0.5 };
    this.ui.message('Vous dormez… le point d’apparition est fixé ici.');
    this.sleepUntil = performance.now() + 1400;
  }

  respawn() {
    this.player.respawn(this.ctx);
    this.ui.message('Vous réapparaissez.');
    this.deathScreen?.remove();
    this.deathScreen = null;
    this.requestPointerLock();
  }

  setPaused(v) {
    this.paused = v;
    if (v) {
      document.exitPointerLock?.();
      this.showPauseMenu();
    } else {
      this.pauseMenu?.remove();
      this.pauseMenu = null;
      this.requestPointerLock();
    }
  }

  showPauseMenu() {
    if (this.pauseMenu) return;
    const div = document.createElement('div');
    div.className = 'overlay pause';
    div.innerHTML = `
      <div class="panel panel-menu">
        <h2 class="panel-title">Jeu en pause</h2>
        <button class="btn" data-a="resume">Reprendre</button>
        <button class="btn" data-a="save">Sauvegarder</button>
        <button class="btn" data-a="controls">Commandes</button>
        <button class="btn" data-a="quit">Sauvegarder et quitter</button>
        <div class="pause-info"></div>
      </div>`;
    div.querySelector('.pause-info').textContent = `${this.meta.name} — graine ${this.world.seed}`;
    div.addEventListener('click', async (e) => {
      const a = e.target.dataset?.a;
      if (!a) return;
      if (a === 'resume') this.setPaused(false);
      if (a === 'save') { await this.save(); this.ui.message('Partie sauvegardée.'); }
      if (a === 'controls') this.showControls();
      if (a === 'quit') { await this.save(); this.stop(); this.onQuit?.(); }
    });
    document.getElementById('ui').append(div);
    this.pauseMenu = div;
  }

  showControls() {
    const rows = [
      ['ZQSD / WASD', 'Se déplacer'], ['Espace', 'Sauter (×2 : voler en créatif)'],
      ['Maj', 'S’accroupir'], ['Ctrl', 'Courir'], ['Souris', 'Regarder'],
      ['Clic gauche', 'Casser / frapper'], ['Clic droit', 'Poser / utiliser'],
      ['1-9, molette', 'Choisir un objet'], ['E', 'Inventaire'], ['Q', 'Jeter'],
      ['T', 'Chat et commandes'], ['F3', 'Informations'], ['F5', 'Vue'], ['F11', 'Plein écran'],
      ['Échap', 'Pause'],
    ];
    const div = document.createElement('div');
    div.className = 'overlay';
    div.innerHTML = `<div class="panel panel-menu"><h2 class="panel-title">Commandes</h2>
      <table class="keys">${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
      <button class="btn" data-a="close">Fermer</button></div>`;
    div.addEventListener('click', (e) => { if (e.target.dataset?.a === 'close' || e.target === div) div.remove(); });
    document.getElementById('ui').append(div);
  }

  /* ──────────────────────────── Chat ──────────────────────────── */

  openChat(prefill = '') {
    this.chatOpen = true;
    document.exitPointerLock?.();
    const box = document.createElement('div');
    box.className = 'chat-box';
    box.innerHTML = '<input class="chat-input" type="text" autocomplete="off" spellcheck="false"/>';
    document.getElementById('ui').append(box);
    this.chatBox = box;
    const input = box.querySelector('input');
    input.value = prefill;
    setTimeout(() => input.focus(), 0);
  }

  closeChat(send) {
    const input = this.chatBox?.querySelector('input');
    const text = input ? input.value.trim() : '';
    this.chatBox?.remove();
    this.chatBox = null;
    this.chatOpen = false;
    if (send && text) {
      if (text.startsWith('/')) this.runCommand(text.slice(1));
      else this.ui.message(`<Joueur> ${text}`);
    }
    this.requestPointerLock();
  }

  runCommand(cmd) {
    const parts = cmd.split(/\s+/);
    const name = parts[0].toLowerCase();
    const args = parts.slice(1);
    const say = (m) => this.ui.message(m, 'system');
    const p = this.player;

    switch (name) {
      case 'help':
        say('/gamemode survie|creatif · /time set jour|nuit|<n> · /give <objet> [n]');
        say('/tp <x> <y> <z> · /weather pluie|clair · /seed · /kill · /spawn · /clear');
        break;
      case 'gamemode': {
        const m = (args[0] || '').toLowerCase();
        if (m.startsWith('c')) { p.mode = 'creative'; p.health = 20; }
        else { p.mode = 'survival'; p.flying = false; }
        this.meta.mode = p.mode;
        say(`Mode de jeu : ${p.mode === 'creative' ? 'créatif' : 'survie'}`);
        break;
      }
      case 'time': {
        const v = (args[1] ?? args[0] ?? '').toLowerCase();
        if (v === 'jour' || v === 'day') this.world.time = 1000;
        else if (v === 'nuit' || v === 'night') this.world.time = 14000;
        else if (v === 'midi') this.world.time = 6000;
        else if (/^\d+$/.test(v)) this.world.time = parseInt(v, 10) % DAY_TICKS;
        else { say('Usage : /time set jour|nuit|midi|<ticks>'); break; }
        say(`Heure réglée sur ${this.world.time}.`);
        break;
      }
      case 'give': {
        const itemName = args[0];
        const n = parseInt(args[1] || '1', 10);
        if (!getItem(itemName)) { say(`Objet inconnu : ${itemName}`); break; }
        let left = n;
        while (left > 0) {
          const c = Math.min(maxStackOf(itemName), left);
          p.inventory.add(stack(itemName, c));
          left -= c;
        }
        say(`Reçu : ${n} × ${getItem(itemName).label}`);
        break;
      }
      case 'tp': {
        const [x, y, z] = args.map(Number);
        if ([x, y, z].some((v) => !Number.isFinite(v))) { say('Usage : /tp <x> <y> <z>'); break; }
        p.x = x; p.y = y; p.z = z; p.vx = p.vy = p.vz = 0;
        say(`Téléporté en ${x} ${y} ${z}.`);
        break;
      }
      case 'weather': {
        const w = (args[0] || '').toLowerCase();
        this.world.setWeather(w.startsWith('p') || w.startsWith('r') ? 'rain' : 'clear');
        say(`Météo : ${this.world.weather === 'rain' ? 'pluie' : 'dégagé'}`);
        break;
      }
      case 'seed': say(`Graine du monde : ${this.world.seed}`); break;
      case 'kill': p.hurt(1000, 'commande', this.ctx); break;
      case 'spawn':
        p.x = this.worldSpawn.x; p.y = this.worldSpawn.y; p.z = this.worldSpawn.z;
        say('Retour au point d’apparition.');
        break;
      case 'clear': p.inventory.clear(); say('Inventaire vidé.'); break;
      case 'summon': {
        const type = args[0];
        if (!MOBS[type]) { say(`Créature inconnue : ${Object.keys(MOBS).join(', ')}`); break; }
        const [dx, , dz] = p.lookVector();
        this.entities.push(new Mob(type, p.x + dx * 3, p.y + 1, p.z + dz * 3));
        say(`${MOBS[type].label} invoqué.`);
        break;
      }
      default: say(`Commande inconnue : ${name}. Essayez /help`);
    }
  }

  /* ──────────────────────────── Boucle ──────────────────────────── */

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    this.ui.root.innerHTML = '';
  }

  loop(now) {
    if (!this.running) return;
    // Le premier horodatage de requestAnimationFrame peut précéder le démarrage :
    // sans le plancher à zéro, la première image aurait un temps négatif.
    const dt = Math.max(0, Math.min(0.1, (now - this.lastTime) / 1000));
    this.lastTime = now;
    const t0 = performance.now();

    if (!this.paused) this.update(dt);
    this.render(dt);

    this.frameMs = performance.now() - t0;
    this.frames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.fps = this.frames / this.fpsTime;
      this.frames = 0; this.fpsTime = 0;
    }
    requestAnimationFrame(this.loop);
  }

  update(dt) {
    const p = this.player;
    const world = this.world;
    this.ctx.tick = world.tickCount;

    // Réveil après une nuit passée au lit.
    if (p.sleeping && performance.now() > this.sleepUntil) {
      p.sleeping = false;
      world.time = 1000;
      p.health = Math.min(20, p.health + 2);
    }

    if (!this.ui.isOpen && !this.chatOpen && !p.dead) {
      p.update(dt, this.ctx);
      if (this.input.mouseLeft && p.mode !== 'spectator') {
        if (!this.entityUnderCursor()) p.mineTick(dt, this.ctx);
      }
      if (this.input.mouseRight) {
        if (p.bowCharge >= 0) p.bowCharge += dt;
        else if (p.useCooldown <= 0) {
          const held = p.inventory.held;
          const it = held ? getItem(held.item) : null;
          if (it && (it.food || it.place !== null)) p.useItem(this.ctx);
        }
      }
    } else if (p.dead && !this.deathScreen) {
      this.showDeathScreen();
    }

    // Ticks du monde (20 par seconde).
    this.accumulator += dt * 1000;
    let ticks = 0;
    while (this.accumulator >= TICK_MS && ticks < 6) {
      this.accumulator -= TICK_MS;
      world.tick(p);
      ticks++;
    }

    // Chargement et maillage progressifs.
    world.updateChunks(Math.floor(p.x), Math.floor(p.z), {
      gen: this.settings.chunkBudget ?? 2,
      populate: this.settings.chunkBudget ?? 2,
      light: 16000,
    });
    this.meshChunks();

    this.updateEntities(dt);
    this.particles.update(dt, world);
    this.weatherParticles(dt);

    this.audio.listener = { x: p.x, y: p.y, z: p.z };

    // Apparition des créatures toutes les 2 secondes.
    this.spawnTimer += dt;
    if (this.spawnTimer > 2) {
      this.spawnTimer = 0;
      if (this.settings.mobs !== false) spawnCycle(this.ctx);
    }

    // Sauvegarde automatique toutes les 90 secondes.
    this.autosaveTimer += dt;
    if (this.autosaveTimer > 90) { this.autosaveTimer = 0; this.save(); }

    this.ui.update();
    this.updateHint();
  }

  updateHint() {
    const p = this.player;
    if (this.ui.isOpen || p.dead) { this.ui.setHint(''); return; }
    const hit = p.targetBlock(this.world);
    if (!hit) { this.ui.setHint(''); return; }
    const bl = BLOCKS[hit.id];
    const hints = {
      crafting_table: 'Clic droit : ouvrir l’établi',
      furnace: 'Clic droit : ouvrir le four',
      furnace_lit: 'Clic droit : ouvrir le four',
      chest: 'Clic droit : ouvrir le coffre',
      bed: 'Clic droit : dormir',
    };
    this.ui.setHint(hints[bl.name] || '');
  }

  /** Reconstruit les maillages sales, les plus proches d'abord. */
  meshChunks() {
    const p = this.player;
    const budget = this.settings.meshBudget ?? 2;
    const candidates = [];
    for (const [, chunk] of this.world.chunks) {
      if (!chunk.dirty || !this.world.isMeshable(chunk)) continue;
      const dx = chunk.cx * 16 + 8 - p.x, dz = chunk.cz * 16 + 8 - p.z;
      candidates.push({ chunk, d: dx * dx + dz * dz });
    }
    candidates.sort((a, b) => a.d - b.d);
    for (let i = 0; i < Math.min(budget, candidates.length); i++) {
      const chunk = candidates[i].chunk;
      const mesh = buildChunkMesh(this.world, chunk);
      this.renderer.uploadMesh(chunk, mesh);
      chunk.dirty = false;
    }
  }

  updateEntities(dt) {
    const p = this.player;
    const alive = [];
    for (const e of this.entities) {
      if (e.dead) continue;
      e.update(dt, this.ctx);
      if (e.dead) continue;

      // Ramassage des objets et de l'expérience.
      if (e instanceof ItemEntity && e.pickupDelay <= 0 && !p.dead) {
        const d = Math.hypot(e.x - p.x, e.y - (p.y + 0.9), e.z - p.z);
        if (d < 1.6) {
          if (p.inventory.canFit(e.stack)) {
            const left = p.inventory.add(e.stack);
            if (!left) {
              e.dead = true;
              this.audio.play('pop', p);
              const it = getItem(e.stack.item);
              this.ui.message(`+${e.stack.count} ${it ? it.label : e.stack.item}`);
              continue;
            }
            e.stack = left;
          }
        } else if (d < 3.2) {
          // Aimantation légère.
          const k = 6 * dt;
          e.vx += (p.x - e.x) * k; e.vy += (p.y + 0.6 - e.y) * k; e.vz += (p.z - e.z) * k;
        }
      }
      if (e instanceof XPOrb && !p.dead && e.distanceTo(p) < 1.2) {
        p.addXP(e.amount);
        e.dead = true;
        this.audio.play('xp', p);
        continue;
      }
      alive.push(e);
    }
    this.entities.length = 0;
    this.entities.push(...alive);
    this.ctx.entities = this.entities;
    if (this.entities.length > 400) this.entities.splice(0, this.entities.length - 400);
  }

  weatherParticles(dt) {
    if (this.world.weather !== 'rain') return;
    const p = this.player;
    const n = Math.min(40, Math.ceil(dt * 220));
    for (let i = 0; i < n; i++) {
      const x = p.x + (Math.random() - 0.5) * 24;
      const z = p.z + (Math.random() - 0.5) * 24;
      const top = Math.max(this.world.topSolidY(Math.floor(x), Math.floor(z)) + 8, p.y + 9);
      if (this.world.getSkyLight(Math.floor(x), Math.floor(top), Math.floor(z)) < 12) continue;
      const cold = this.world.biomeAt(Math.floor(x), Math.floor(z)).snow;
      this.particles.add({
        x, y: top, z,
        vx: 0, vy: cold ? -1.6 : -14, vz: 0,
        life: 1.4, size: cold ? 0.12 : 0.5, layer: T(cold ? 'snowflake' : 'rain'),
        gravity: 0, light: 0.85, uvScale: 1, uvOffX: 0, uvOffY: 0,
      });
    }
  }

  showDeathScreen() {
    const causes = {
      fall: 'Vous êtes tombé de trop haut.', lava: 'Vous avez brûlé dans la lave.',
      drown: 'Vous vous êtes noyé.', mob: 'Vous avez été tué par une créature.',
      explosion: 'Vous avez explosé.', starve: 'Vous êtes mort de faim.',
      cactus: 'Vous vous êtes piqué à mort.', fire: 'Vous avez brûlé.',
      arrow: 'Vous avez été abattu.', void: 'Vous êtes tombé dans le vide.',
      commande: 'Adieu.', poison: 'Le poison vous a eu.',
    };
    const div = document.createElement('div');
    div.className = 'overlay death';
    div.innerHTML = `<div class="panel panel-menu">
      <h2 class="panel-title death-title">Vous êtes mort !</h2>
      <p class="death-cause">${causes[this.player.lastDamageCause] || 'Fin de partie.'}</p>
      <p class="death-score">Niveau perdu : ${this.player.level} · blocs minés : ${this.player.stats.blocksMined}</p>
      <button class="btn" data-a="respawn">Réapparaître</button>
      <button class="btn" data-a="quit">Retour au menu</button></div>`;
    div.addEventListener('click', async (e) => {
      const a = e.target.dataset?.a;
      if (a === 'respawn') this.respawn();
      if (a === 'quit') { await this.save(); this.stop(); this.onQuit?.(); }
    });
    document.getElementById('ui').append(div);
    this.deathScreen = div;
    document.exitPointerLock?.();
  }

  async save() {
    try {
      await saveGame(this);
    } catch (err) {
      console.warn('Sauvegarde impossible :', err);
      this.ui.message('Sauvegarde impossible (stockage plein ?)');
    }
  }

  /* ──────────────────────────── Rendu ──────────────────────────── */

  render(dt) {
    const r = this.renderer;
    const p = this.player;
    const world = this.world;
    const aspect = r.resize();
    r.updateAnimations(dt);

    // Caméra : première personne, ou recul en vue extérieure.
    const bob = Math.sin(p.bobbing * 3.2) * 0.045 * (p.onGround ? 1 : 0.2);
    const cam = {
      x: p.x, y: p.eyeY + bob * 0.5, z: p.z,
      yaw: p.yaw, pitch: p.pitch,
      fov: (this.settings.fov ?? 70) * (p.sprinting ? 1.12 : 1) * (p.flying ? 1.05 : 1),
    };
    if (this.thirdPerson > 0) {
      const back = this.thirdPerson === 1 ? 4.2 : -4.2;
      const [dx, dy, dz] = p.lookVector();
      const hit = world.raycast(cam.x, cam.y, cam.z, -dx * Math.sign(back), -dy * Math.sign(back), -dz * Math.sign(back), Math.abs(back));
      const d = hit ? Math.max(0.4, hit.dist - 0.3) : Math.abs(back);
      cam.x -= dx * d * Math.sign(back);
      cam.y -= dy * d * Math.sign(back);
      cam.z -= dz * d * Math.sign(back);
      if (this.thirdPerson === 2) { cam.yaw += Math.PI; cam.pitch = -cam.pitch; }
    }
    r.setCamera(cam, aspect);

    const camBlock = BLOCKS[world.getBlock(Math.floor(cam.x), Math.floor(cam.y), Math.floor(cam.z))];
    const inWater = camBlock.fluid === 'water';
    const inLava = camBlock.fluid === 'lava';

    const sky = r.drawSky(world, inWater || inLava);
    const day = Math.max(0.05, world.skyBrightness());
    const far = this.settings.renderDistance * 16;
    const fog = {
      day,
      fogColor: inWater ? [0.06, 0.24, 0.44] : inLava ? [0.5, 0.12, 0.02] : sky.horizon,
      fogNear: inWater ? 2 : inLava ? 0.4 : far * 0.55,
      fogFar: inWater ? 18 : inLava ? 2.5 : far * 0.92,
    };

    if (!inWater && !inLava) {
      r.drawCelestial(world);
      r.beginSimple(fog);
      if (this.settings.clouds !== false) r.drawClouds(world, world.tickCount * 0.05 + dt);
    }

    r.drawChunks(world, fog);

    r.beginSimple(fog);
    this.renderEntities(fog);
    r.drawParticles(this.particles.list, cam.yaw);

    // Contour et fissures du bloc visé.
    if (!this.ui.isOpen && !p.dead) {
      const hit = p.targetBlock(world);
      if (hit) {
        r.beginSimple(fog);
        r.drawOutline(hit.x, hit.y, hit.z);
        if (p.breakProgress > 0 && p.breakTarget) {
          r.drawBreak(p.breakTarget.x, p.breakTarget.y, p.breakTarget.z, p.breakProgress);
        }
      }
    }

    r.drawWater(fog);

    // Objet tenu en main.
    if (this.thirdPerson === 0 && !p.dead) {
      r.drawHeldItem(() => this.renderHeldItem(), aspect);
    }

    if (inWater) r.drawOverlayColor([0.1, 0.35, 0.6, 0.42]);
    if (inLava) r.drawOverlayColor([0.75, 0.22, 0.02, 0.75]);
    if (p.sleeping) r.drawOverlayColor([0, 0, 0, 0.85]);
  }

  /** Lumière perçue à une position, avec la même courbe que le terrain. */
  lightAt(x, y, z) {
    const w = this.world;
    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    const sky = w.getSkyLight(bx, by, bz) * w.skyBrightness();
    const blk = w.getBlockLight(bx, by, bz);
    const lv = Math.max(sky, blk);
    return Math.max(0.09, 0.86 ** (15 - lv));
  }

  renderEntities(fog) {
    const r = this.renderer;
    const m = mat4(), local = mat4(), tmp = mat4(), tmp2 = mat4();

    for (const e of this.entities) {
      if (e.dead) continue;
      const light = this.lightAt(e.x, e.y + 0.5, e.z);

      if (e instanceof Mob) {
        const def = e.def;
        composeMatrix(m, e.x, e.y, e.z, e.yaw, 0);
        const swing = Math.sin(e.limbSwing * 2.4);
        const hurt = e.hurtTime > 0 ? 1 : 0;
        const flash = e.type === 'creeper' && e.fuse > 0 ? (Math.sin(e.fuse * 22) * 0.5 + 0.5) : 0;
        for (const part of def.parts) {
          let angle = 0;
          if (part.anim && part.anim.startsWith('leg')) {
            const phase = parseInt(part.anim.slice(3), 10);
            angle = swing * 0.7 * (phase % 2 === 0 ? 1 : -1) * (phase < 2 ? 1 : -1);
          } else if (part.anim && part.anim.startsWith('arm')) {
            const phase = parseInt(part.anim.slice(3), 10);
            angle = swing * 0.55 * (phase === 0 ? 1 : -1);
            if (e.state === 'chase') angle = -1.5 + Math.sin(e.age * 6) * 0.15;
          } else if (part.anim === 'head') {
            angle = -e.pitch * 0.6;
          }
          if (part.anim === 'wool' && e.sheared) continue;

          const [px, py, pz] = part.pos;
          const [sx, sy, sz] = part.size;
          const pivotY = part.anim && (part.anim.startsWith('leg') || part.anim.startsWith('arm'))
            ? py + sy / 2 : (part.anim === 'head' ? py - sy / 2 : py);
          translate(local, px, pivotY, pz);
          rotateX(tmp, angle);
          multiply(tmp2, local, tmp);
          translate(tmp, 0, py - pivotY, 0);
          multiply(local, tmp2, tmp);
          scaleM(tmp, sx, sy, sz);
          multiply(tmp2, local, tmp);
          multiply(local, m, tmp2);

          let color = hexToRGBA(part.color);
          if (hurt) color = [Math.min(1, color[0] + 0.55), color[1] * 0.45, color[2] * 0.45, 1];
          if (flash > 0.5) color = [1, 1, 1, 1];
          r.drawBoxMatrix(local, color, -1, light);
        }
        continue;
      }

      if (e instanceof ItemEntity) {
        const it = getItem(e.stack.item);
        const bob = Math.sin(e.age * 2.4) * 0.06;
        const layer = it ? it.tile : 0;
        const size = it && it.isBlock ? 0.3 : 0.34;
        const depth = it && it.isBlock ? size : 0.05;
        composeMatrix(m, e.x, e.y + 0.2 + bob, e.z, e.spin, 0, size, size, depth);
        r.drawBoxMatrix(m, it && it.tintColor ? [...it.tintColor, 1] : [1, 1, 1, 1], layer, light);
        continue;
      }

      if (e instanceof XPOrb) {
        const bob = Math.sin(e.age * 5) * 0.05;
        composeMatrix(m, e.x, e.y + 0.15 + bob, e.z, e.age * 2, 0, 0.18, 0.18, 0.18);
        r.drawBoxMatrix(m, [0.55, 1, 0.35, 1], -1, 1);
        continue;
      }

      if (e instanceof Arrow) {
        composeMatrix(m, e.x, e.y, e.z, e.yaw, -e.pitch, 0.08, 0.08, 0.7);
        r.drawBoxMatrix(m, [0.85, 0.85, 0.85, 1], -1, light);
        continue;
      }

      if (e instanceof PrimedTNT) {
        const blink = Math.sin(e.age * 18) > 0 ? 1 : 0.4;
        composeMatrix(m, e.x, e.y + 0.45, e.z, 0, 0, 0.95, 0.95, 0.95);
        r.drawBoxMatrix(m, [1, blink, blink, 1], T('tnt_side'), 1);
      }
    }
  }

  /** L'objet tenu, dessiné devant la caméra avec l'animation de coup. */
  renderHeldItem() {
    const r = this.renderer;
    const p = this.player;
    const s = p.inventory.held;
    const m = mat4();
    const swing = p.swing > 0 ? Math.sin((1 - p.swing) * Math.PI) : 0;
    const charge = p.bowCharge >= 0 ? Math.min(1, p.bowCharge) : 0;

    const light = this.lightAt(p.x, p.eyeY, p.z);
    if (!s) {
      // La main nue.
      composeMatrix(m, 0.34 - swing * 0.08, -0.34 + swing * 0.13, -0.55,
        -0.35, -0.75 + swing * 1.1, 0.075, 0.2, 0.075);
      r.drawBoxMatrix(m, [0.86, 0.66, 0.5, 1], -1, light);
      return;
    }
    const it = getItem(s.item);
    const isBlock = it && it.isBlock;
    const size = isBlock ? 0.17 : 0.21;
    const depth = isBlock ? size : 0.025;
    composeMatrix(m,
      0.42 - swing * 0.1 - charge * 0.12,
      -0.36 + swing * 0.15 + charge * 0.05,
      -0.66 + swing * 0.08 + charge * 0.08,
      isBlock ? -0.7 : -0.9,
      isBlock ? 0.35 - swing * 1.2 : 0.5 - swing * 1.4,
      size, size, depth);
    const tint = it && it.tintColor ? [...it.tintColor, 1] : [1, 1, 1, 1];
    r.drawBoxMatrix(m, tint, it ? it.tile : 0, light);
  }
}

function hexToRGBA(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
}
