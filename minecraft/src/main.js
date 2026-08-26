/**
 * Minecraft JS — écran d'accueil, liste des mondes, options.
 *
 * C'est le point d'entrée : il choisit un monde (nouveau ou sauvegardé),
 * précharge les tronçons autour du point d'apparition, puis lance la partie.
 */

import { Game } from './game.js';
import { listWorlds, loadWorldMeta, deleteWorld, newWorldMeta, saveWorldMeta, loadChunks, seedFromString, initStorage } from './save.js';

const SETTINGS_KEY = 'mcjs:settings';

const DEFAULT_SETTINGS = {
  renderDistance: 7,
  fov: 70,
  sensitivity: 1,
  volume: 0.7,
  clouds: true,
  mobs: true,
  dpr: 1.5,
  chunkBudget: 2,
  meshBudget: 2,
};

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* stockage indisponible */ }
}

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};

export class Menu {
  constructor() {
    this.root = document.getElementById('menu');
    this.settings = loadSettings();
    this.game = null;
  }

  async start() {
    await initStorage();
    this.showTitle();
  }

  show(node) {
    this.root.innerHTML = '';
    this.root.classList.remove('hidden');
    this.root.append(node);
  }

  hide() { this.root.classList.add('hidden'); this.root.innerHTML = ''; }

  /* ─────────────────────────── Écran d'accueil ─────────────────────────── */

  showTitle() {
    const box = el('div', 'menu-screen', `
      <div class="logo">
        <span class="logo-main">MINECRAFT</span>
        <span class="logo-sub">recréé en JavaScript</span>
      </div>
      <div class="menu-buttons">
        <button class="btn big" data-a="play">Jouer</button>
        <button class="btn big" data-a="new">Nouveau monde</button>
        <button class="btn" data-a="options">Options</button>
        <button class="btn" data-a="about">À propos</button>
      </div>
      <div class="splash">Fait maison, sans moteur de jeu !</div>`);
    box.addEventListener('click', (e) => {
      const a = e.target.dataset?.a;
      if (a === 'play') this.showWorlds();
      if (a === 'new') this.showCreate();
      if (a === 'options') this.showOptions();
      if (a === 'about') this.showAbout();
    });
    const splashes = [
      'Fait maison, sans moteur de jeu !', 'Que des voxels et du WebGL2',
      'Attention aux creepers', 'Les textures sont calculées, pas dessinées',
      'Essayez la graine « bonjour »', '100 % artisanal',
      'Pensez à poser des torches', 'La nuit tombe vite…',
    ];
    box.querySelector('.splash').textContent = splashes[Math.floor(Math.random() * splashes.length)];
    this.show(box);
  }

  /* ─────────────────────────── Liste des mondes ─────────────────────────── */

  async showWorlds() {
    const worlds = await listWorlds();
    const box = el('div', 'menu-screen', `
      <h1 class="menu-title">Sélection du monde</h1>
      <div class="world-list"></div>
      <div class="menu-buttons row">
        <button class="btn" data-a="new">Nouveau monde</button>
        <button class="btn" data-a="back">Retour</button>
      </div>`);
    const list = box.querySelector('.world-list');
    if (!worlds.length) {
      list.append(el('div', 'empty', 'Aucun monde sauvegardé. Créez-en un !'));
    }
    for (const w of worlds) {
      const row = el('div', 'world-row', `
        <div class="world-info">
          <div class="world-name">${escapeHtml(w.name)}</div>
          <div class="world-meta">${w.mode === 'creative' ? 'Créatif' : 'Survie'} · graine ${w.seed} · ${new Date(w.lastPlayed).toLocaleString('fr-FR')}</div>
        </div>
        <div class="world-actions">
          <button class="btn small" data-play="${w.id}">Jouer</button>
          <button class="btn small danger" data-del="${w.id}">Supprimer</button>
        </div>`);
      list.append(row);
    }
    box.addEventListener('click', async (e) => {
      const t = e.target;
      if (t.dataset.play) this.launch(await loadWorldMeta(t.dataset.play));
      if (t.dataset.del) {
        if (confirm('Supprimer définitivement ce monde ?')) {
          await deleteWorld(t.dataset.del);
          this.showWorlds();
        }
      }
      if (t.dataset.a === 'back') this.showTitle();
      if (t.dataset.a === 'new') this.showCreate();
    });
    this.show(box);
  }

  /* ─────────────────────────── Création de monde ─────────────────────────── */

  showCreate() {
    const box = el('div', 'menu-screen', `
      <h1 class="menu-title">Créer un monde</h1>
      <div class="form">
        <label>Nom du monde<input class="field" id="w-name" maxlength="32" value="Monde ${new Date().toLocaleDateString('fr-FR')}"/></label>
        <label>Graine (vide = aléatoire)<input class="field" id="w-seed" placeholder="ex. 12345 ou « bonjour »"/></label>
        <label>Mode de jeu
          <select class="field" id="w-mode">
            <option value="survival">Survie — santé, faim, monstres</option>
            <option value="creative">Créatif — vol, ressources infinies</option>
          </select>
        </label>
      </div>
      <div class="menu-buttons row">
        <button class="btn big" data-a="create">Créer le monde</button>
        <button class="btn" data-a="back">Retour</button>
      </div>`);
    box.addEventListener('click', async (e) => {
      const a = e.target.dataset?.a;
      if (a === 'back') this.showTitle();
      if (a === 'create') {
        const name = box.querySelector('#w-name').value.trim() || 'Nouveau monde';
        const seed = seedFromString(box.querySelector('#w-seed').value);
        const mode = box.querySelector('#w-mode').value;
        const meta = newWorldMeta({ name, seed, mode });
        await saveWorldMeta(meta);
        this.launch(meta);
      }
    });
    this.show(box);
  }

  /* ─────────────────────────────── Options ─────────────────────────────── */

  showOptions() {
    const s = this.settings;
    const box = el('div', 'menu-screen', `
      <h1 class="menu-title">Options</h1>
      <div class="form">
        <label>Distance d'affichage : <b id="v-rd">${s.renderDistance}</b> tronçons
          <input type="range" id="o-rd" min="3" max="14" value="${s.renderDistance}"/></label>
        <label>Champ de vision : <b id="v-fov">${s.fov}</b>°
          <input type="range" id="o-fov" min="50" max="110" value="${s.fov}"/></label>
        <label>Sensibilité : <b id="v-sens">${s.sensitivity.toFixed(1)}</b>
          <input type="range" id="o-sens" min="0.2" max="3" step="0.1" value="${s.sensitivity}"/></label>
        <label>Volume : <b id="v-vol">${Math.round(s.volume * 100)}</b> %
          <input type="range" id="o-vol" min="0" max="100" value="${Math.round(s.volume * 100)}"/></label>
        <label>Résolution : <b id="v-dpr">${s.dpr.toFixed(1)}</b>×
          <input type="range" id="o-dpr" min="0.5" max="2" step="0.1" value="${s.dpr}"/></label>
        <label class="check"><input type="checkbox" id="o-clouds" ${s.clouds ? 'checked' : ''}/> Nuages</label>
        <label class="check"><input type="checkbox" id="o-mobs" ${s.mobs ? 'checked' : ''}/> Créatures</label>
      </div>
      <div class="menu-buttons row">
        <button class="btn big" data-a="back">Terminé</button>
      </div>`);
    const bind = (id, key, fmt, transform = (v) => v) => {
      const input = box.querySelector(`#o-${id}`);
      const out = box.querySelector(`#v-${id}`);
      if (!input) return;
      input.addEventListener('input', () => {
        const v = transform(parseFloat(input.value));
        this.settings[key] = v;
        if (out) out.textContent = fmt(v);
        saveSettings(this.settings);
      });
    };
    bind('rd', 'renderDistance', (v) => v);
    bind('fov', 'fov', (v) => v);
    bind('sens', 'sensitivity', (v) => v.toFixed(1));
    bind('vol', 'volume', (v) => Math.round(v * 100), (v) => v / 100);
    bind('dpr', 'dpr', (v) => v.toFixed(1));
    for (const [id, key] of [['clouds', 'clouds'], ['mobs', 'mobs']]) {
      box.querySelector(`#o-${id}`).addEventListener('change', (e) => {
        this.settings[key] = e.target.checked;
        saveSettings(this.settings);
      });
    }
    box.addEventListener('click', (e) => {
      if (e.target.dataset?.a === 'back') this.showTitle();
    });
    this.show(box);
  }

  showAbout() {
    const box = el('div', 'menu-screen', `
      <h1 class="menu-title">À propos</h1>
      <div class="about">
        <p>Un Minecraft recréé de zéro pour le navigateur : monde infini par tronçons,
        génération procédurale par bruit de Perlin, lumière du ciel et des torches,
        artisanat, fours, coffres, créatures, survie complète.</p>
        <p>Aucune bibliothèque, aucune image, aucun son externe : le rendu est du
        WebGL2 écrit à la main, les textures sont peintes pixel par pixel au
        démarrage et les bruitages sont synthétisés par Web Audio.</p>
        <p class="dim">Projet indépendant, sans lien avec Mojang ni Microsoft.</p>
      </div>
      <div class="menu-buttons row"><button class="btn" data-a="back">Retour</button></div>`);
    box.addEventListener('click', (e) => { if (e.target.dataset?.a === 'back') this.showTitle(); });
    this.show(box);
  }

  /* ─────────────────────────── Lancement d'une partie ─────────────────────────── */

  async launch(meta) {
    if (!meta) return;
    this.show(el('div', 'menu-screen loading', `
      <h1 class="menu-title">Construction du monde…</h1>
      <div class="progress"><div class="progress-fill" id="load-fill"></div></div>
      <div class="loading-tip" id="load-tip">Génération du relief</div>`));
    const fill = document.getElementById('load-fill');
    const tip = document.getElementById('load-tip');

    const savedChunks = meta.chunkKeys && meta.chunkKeys.length
      ? await loadChunks(meta.id, meta.chunkKeys)
      : null;

    const canvas = document.getElementById('game');
    let game;
    try {
      game = new Game(canvas, meta, savedChunks, this.settings);
    } catch (err) {
      this.show(el('div', 'menu-screen', `
        <h1 class="menu-title">Impossible de démarrer</h1>
        <div class="about"><p>${escapeHtml(err.message)}</p>
        <p class="dim">Ce jeu a besoin de WebGL2. Essayez un navigateur récent, ou activez l'accélération matérielle.</p></div>
        <div class="menu-buttons row"><button class="btn" data-a="back">Retour</button></div>`));
      this.root.addEventListener('click', (e) => { if (e.target.dataset?.a === 'back') this.showTitle(); });
      return;
    }
    game.audio.setVolume(this.settings.volume);
    this.game = game;
    game.onQuit = () => { this.game = null; this.showTitle(); };

    // Préchargement : on attend d'avoir du sol sous les pieds.
    const px = Math.floor(game.player.x), pz = Math.floor(game.player.z);
    const target = 60;
    for (let step = 0; step < target; step++) {
      game.world.updateChunks(px, pz, { gen: 3, populate: 3, light: 60000 });
      if (step % 6 === 0) {
        fill.style.width = `${(step / target) * 100}%`;
        tip.textContent = ['Génération du relief', 'Creusement des grottes', 'Plantation des arbres',
          'Propagation de la lumière', 'Assemblage des faces'][Math.floor(step / 13) % 5];
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    for (let i = 0; i < 24; i++) game.meshChunks();
    fill.style.width = '100%';

    // Position sûre : on remonte le joueur au-dessus du sol.
    if (!meta.player) {
      const y = game.world.topSolidY(px, pz);
      game.player.y = Math.max(y, game.player.y);
      game.player.spawnPoint = { x: game.player.x, y: game.player.y, z: game.player.z };
      game.worldSpawn = { x: game.player.x, y: game.player.y, z: game.player.z };
      game.ctx.worldSpawn = game.worldSpawn;
    }

    this.hide();
    game.start();
    game.audio.resume();
    canvas.focus();
    game.setPaused(false);
    game.requestPointerLock();
    game.ui.message(`Bienvenue dans « ${meta.name} » — appuyez sur T pour le chat, F3 pour les infos.`);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const menu = new Menu();
menu.start();
window.mcMenu = menu;
