/**
 * Minecraft JS — interface : ATH et écrans d'inventaire.
 *
 * L'ATH (cœurs, faim, barre d'action, expérience) et les écrans (inventaire,
 * établi, four, coffre, créatif) sont en HTML : c'est net à toutes les
 * résolutions et cela laisse le canevas entièrement au monde 3D.
 *
 * Les échanges de piles reprennent les gestes du jeu : clic gauche = prendre
 * ou poser la pile, clic droit = moitié ou une unité, Maj+clic = transfert.
 */

import { itemIcon, hudIcon } from './icons.js';
import { getItem, maxStackOf, sameStack, cloneStack, stack, CATEGORIES, ITEM_ORDER } from './items.js';
import { findRecipe } from './crafting.js';
import { BLOCKS } from './blocks.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

export class UI {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('ui');
    this.screen = null;          // écran ouvert
    this.cursor = null;          // pile « à la souris »
    this.debug = false;
    this.messages = [];
    this.buildHUD();
    this.buildOverlay();
  }

  get isOpen() { return this.screen !== null; }

  /* ──────────────────────────────── ATH ──────────────────────────────── */

  buildHUD() {
    const hud = el('div', 'hud');
    hud.innerHTML = `
      <div class="crosshair"></div>
      <div class="hud-bottom">
        <div class="stat-rows">
          <div class="stat-row" id="armor-row"></div>
          <div class="stat-row stat-split">
            <div id="hearts" class="stat-group"></div>
            <div id="food" class="stat-group right"></div>
          </div>
          <div class="stat-row" id="air-row"></div>
        </div>
        <div class="xp-wrap"><div class="xp-bar"><div id="xp-fill"></div></div><div id="xp-level"></div></div>
        <div id="hotbar" class="hotbar"></div>
      </div>
      <div id="item-name" class="item-name"></div>
      <div id="messages" class="messages"></div>
      <div id="debug" class="debug hidden"></div>
      <div id="hint" class="hint"></div>
      <div id="vignette" class="vignette"></div>`;
    this.root.append(hud);
    this.hud = hud;
    this.hotbarEl = hud.querySelector('#hotbar');
    this.heartsEl = hud.querySelector('#hearts');
    this.foodEl = hud.querySelector('#food');
    this.airEl = hud.querySelector('#air-row');
    this.armorEl = hud.querySelector('#armor-row');
    this.xpFill = hud.querySelector('#xp-fill');
    this.xpLevel = hud.querySelector('#xp-level');
    this.itemNameEl = hud.querySelector('#item-name');
    this.messagesEl = hud.querySelector('#messages');
    this.debugEl = hud.querySelector('#debug');
    this.hintEl = hud.querySelector('#hint');
    this.vignette = hud.querySelector('#vignette');

    for (let i = 0; i < 9; i++) {
      const s = el('div', 'slot hotbar-slot');
      s.dataset.index = i;
      s.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.game.player.inventory.selected = i;
        this.showItemName();
      });
      this.hotbarEl.append(s);
    }
    this.hotbarSlots = [...this.hotbarEl.children];
  }

  buildOverlay() {
    this.overlay = el('div', 'overlay hidden');
    this.overlay.addEventListener('mousedown', (e) => {
      if (e.target === this.overlay) this.closeScreen();
    });
    this.root.append(this.overlay);

    this.cursorEl = el('div', 'cursor-stack hidden');
    this.root.append(this.cursorEl);
    document.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX; this.mouseY = e.clientY;
      if (this.cursor) {
        this.cursorEl.style.left = `${e.clientX}px`;
        this.cursorEl.style.top = `${e.clientY}px`;
      }
    });
  }

  /** Rafraîchit tout l'ATH (appelé à chaque image, mais très bon marché). */
  update() {
    const p = this.game.player;
    this.renderHotbar(p);
    this.renderStats(p);
    this.renderMessages();
    if (this.debug) this.renderDebug();
    const flash = Math.max(p.hurtFlash, p.health <= 6 && !p.dead ? 0.25 : 0);
    this.vignette.style.opacity = flash * 0.55;
    this.vignette.style.background = p.headInLava
      ? 'radial-gradient(circle, rgba(255,90,0,.35), rgba(180,40,0,.95))'
      : 'radial-gradient(circle, rgba(255,0,0,0), rgba(180,0,0,.9))';
    if (this.screen) this.refreshScreen();
  }

  renderHotbar(p) {
    for (let i = 0; i < 9; i++) {
      const slot = this.hotbarSlots[i];
      slot.classList.toggle('selected', i === p.inventory.selected);
      this.paintSlot(slot, p.inventory.get(i));
    }
  }

  /** Dessine une pile dans un emplacement (icône, quantité, usure). */
  paintSlot(node, s) {
    const key = s ? `${s.item}:${s.count}:${s.dmg || 0}` : '';
    if (node.dataset.key === key) return;
    node.dataset.key = key;
    node.innerHTML = '';
    if (!s) return;
    const img = el('img', 'slot-icon');
    img.src = itemIcon(s.item);
    img.alt = '';
    node.append(img);
    if (s.count > 1) node.append(el('span', 'slot-count', String(s.count)));
    const it = getItem(s.item);
    if (it && it.durability && s.dmg > 0) {
      const bar = el('div', 'durability');
      const fill = el('div', 'durability-fill');
      const ratio = 1 - s.dmg / it.durability;
      fill.style.width = `${ratio * 100}%`;
      fill.style.background = ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#facc15' : '#ef4444';
      bar.append(fill);
      node.append(bar);
    }
  }

  renderStats(p) {
    if (p.mode === 'creative') {
      this.heartsEl.style.display = 'none';
      this.foodEl.style.display = 'none';
      this.airEl.style.display = 'none';
      this.armorEl.style.display = 'none';
      return;
    }
    this.heartsEl.style.display = '';
    this.foodEl.style.display = '';

    const hearts = Math.ceil(p.health / 2);
    const key = `${hearts}:${Math.ceil(p.food / 2)}:${Math.ceil(p.air / 30)}:${p.inventory.defense}`;
    if (this.statsKey !== key) {
      this.statsKey = key;
      this.heartsEl.innerHTML = '';
      for (let i = 0; i < 10; i++) {
        const img = el('img', 'icon');
        img.src = hudIcon(i < hearts ? 'heart' : 'heart_empty');
        this.heartsEl.append(img);
      }
      this.foodEl.innerHTML = '';
      const food = Math.ceil(p.food / 2);
      for (let i = 0; i < 10; i++) {
        const img = el('img', 'icon');
        img.src = hudIcon(i < food ? 'food' : 'food_empty');
        this.foodEl.append(img);
      }
      this.airEl.innerHTML = '';
      if (p.air < 300) {
        const bubbles = Math.ceil(p.air / 30);
        for (let i = 0; i < bubbles; i++) {
          const img = el('img', 'icon');
          img.src = hudIcon('bubble');
          this.airEl.append(img);
        }
      }
      this.armorEl.innerHTML = '';
      const armor = Math.ceil(p.inventory.defense / 2);
      for (let i = 0; i < armor; i++) {
        const img = el('img', 'icon');
        img.src = hudIcon('armor');
        this.armorEl.append(img);
      }
    }

    const ratio = p.xp / Math.max(1, p.xpToNext());
    this.xpFill.style.width = `${Math.min(100, ratio * 100)}%`;
    this.xpLevel.textContent = p.level > 0 ? String(p.level) : '';
  }

  showItemName() {
    const s = this.game.player.inventory.held;
    if (!s) { this.itemNameEl.classList.remove('show'); return; }
    const it = getItem(s.item);
    this.itemNameEl.textContent = it ? it.label : s.item;
    this.itemNameEl.classList.add('show');
    clearTimeout(this.itemNameTimer);
    this.itemNameTimer = setTimeout(() => this.itemNameEl.classList.remove('show'), 1800);
  }

  message(text, kind = '') {
    this.messages.push({ text, kind, t: performance.now() });
    if (this.messages.length > 8) this.messages.shift();
    this.messagesDirty = true;
  }

  renderMessages() {
    const now = performance.now();
    const before = this.messages.length;
    this.messages = this.messages.filter((m) => now - m.t < 9000);
    if (!this.messagesDirty && this.messages.length === before) return;
    this.messagesDirty = false;
    this.messagesEl.innerHTML = '';
    for (const m of this.messages) {
      const line = el('div', `message ${m.kind}`, m.text);
      line.style.opacity = Math.max(0.25, 1 - (now - m.t) / 9000);
      this.messagesEl.append(line);
    }
  }

  setHint(text) {
    this.hintEl.textContent = text || '';
    this.hintEl.classList.toggle('show', !!text);
  }

  toggleDebug() {
    this.debug = !this.debug;
    this.debugEl.classList.toggle('hidden', !this.debug);
  }

  renderDebug() {
    const g = this.game;
    const p = g.player;
    const w = g.world;
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    const biome = w.biomeAt(bx, bz);
    const facing = ['sud (+Z)', 'ouest (−X)', 'nord (−Z)', 'est (+X)'][Math.round(((p.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 2)) % 4];
    const hh = Math.floor((w.time / 1000 + 6) % 24);
    const mm = Math.floor(((w.time % 1000) / 1000) * 60);
    this.debugEl.innerHTML = `
      <div>Minecraft JS — ${g.fps.toFixed(0)} i/s (${g.frameMs.toFixed(1)} ms)</div>
      <div>XYZ : ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}</div>
      <div>Bloc : ${bx} ${by} ${bz} — tronçon ${bx >> 4} ${bz >> 4}</div>
      <div>Direction : ${facing} (${(p.yaw * 180 / Math.PI).toFixed(0)}°)</div>
      <div>Biome : ${biome.label}</div>
      <div>Lumière : ciel ${w.getSkyLight(bx, by + 1, bz)} · bloc ${w.getBlockLight(bx, by + 1, bz)}</div>
      <div>Heure : ${String(hh).padStart(2, '0')}h${String(mm).padStart(2, '0')} (${w.time | 0}) — ${w.weather === 'rain' ? 'pluie' : 'dégagé'}</div>
      <div>Tronçons : ${w.chunks.size} chargés · ${g.renderer.stats.chunks} affichés</div>
      <div>Faces : ${(g.renderer.stats.quads / 1000).toFixed(1)} k · entités : ${g.entities.length}</div>
      <div>Graine : ${w.seed}</div>`;
  }

  /* ─────────────────────────────── Écrans ─────────────────────────────── */

  openScreen(kind, data = null) {
    this.screen = { kind, data };
    this.overlay.classList.remove('hidden');
    this.overlay.innerHTML = '';
    const panel = el('div', `panel panel-${kind}`);
    this.overlay.append(panel);
    this.panel = panel;
    this.slotNodes = [];

    if (kind === 'inventory') this.buildInventoryScreen(panel);
    else if (kind === 'crafting') this.buildCraftingScreen(panel);
    else if (kind === 'furnace') this.buildFurnaceScreen(panel, data);
    else if (kind === 'chest') this.buildChestScreen(panel, data);
    else if (kind === 'creative') this.buildCreativeScreen(panel);
    this.refreshScreen();
  }

  closeScreen() {
    if (!this.screen) return;
    // Ce qui reste dans la grille d'artisanat et à la souris retombe au sol.
    const p = this.game.player;
    if (this.screen.kind === 'crafting' || this.screen.kind === 'inventory') {
      const grid = this.screen.kind === 'crafting' ? this.screen.grid : p.inventory.craft;
      for (let i = 0; i < grid.length; i++) {
        if (grid[i]) { this.giveOrDrop(grid[i]); grid[i] = null; }
      }
    }
    if (this.cursor) { this.giveOrDrop(this.cursor); this.cursor = null; }
    this.updateCursorEl();
    this.screen = null;
    this.overlay.classList.add('hidden');
    this.overlay.innerHTML = '';
    this.game.requestPointerLock();
  }

  giveOrDrop(s) {
    const p = this.game.player;
    const left = p.inventory.add(s);
    if (left) this.game.dropItem(p.x, p.y + 1.2, p.z, left, true);
  }

  /** Crée un emplacement cliquable. */
  slot(kind, index, opts = {}) {
    const node = el('div', `slot ${opts.cls || ''}`);
    node.dataset.kind = kind;
    node.dataset.index = index;
    node.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.onSlotClick(kind, index, e.button, e.shiftKey);
    });
    node.addEventListener('mouseenter', () => this.showTooltip(node, kind, index));
    node.addEventListener('mouseleave', () => this.hideTooltip());
    this.slotNodes.push({ node, kind, index });
    return node;
  }

  grid(kind, from, count, cols, cls = '') {
    const g = el('div', `slot-grid ${cls}`);
    g.style.gridTemplateColumns = `repeat(${cols}, var(--slot))`;
    for (let i = 0; i < count; i++) g.append(this.slot(kind, from + i));
    return g;
  }

  /** Les 27 emplacements + la barre d'action, communs à tous les écrans. */
  playerGrids(panel) {
    const wrap = el('div', 'player-inv');
    wrap.append(this.grid('inv', 9, 27, 9));
    wrap.append(this.grid('inv', 0, 9, 9, 'hotbar-grid'));
    panel.append(wrap);
  }

  buildInventoryScreen(panel) {
    panel.append(el('h2', 'panel-title', 'Inventaire'));
    const top = el('div', 'inv-top');

    const armorCol = el('div', 'armor-col');
    armorCol.append(el('div', 'small-label', 'Armure'));
    for (let i = 0; i < 4; i++) armorCol.append(this.slot('armor', i, { cls: 'armor-slot' }));
    top.append(armorCol);

    const doll = el('div', 'doll');
    doll.innerHTML = '<div class="doll-figure"></div>';
    top.append(doll);

    const craftBox = el('div', 'craft-box');
    craftBox.append(el('div', 'small-label', 'Fabrication'));
    const row = el('div', 'craft-row');
    row.append(this.grid('craft', 0, 4, 2));
    row.append(el('div', 'arrow', '➜'));
    row.append(this.slot('result', 0, { cls: 'result-slot' }));
    craftBox.append(row);
    top.append(craftBox);

    panel.append(top);
    this.playerGrids(panel);
    panel.append(el('div', 'panel-hint', 'Maj+clic : transfert rapide · Clic droit : moitié · E ou Échap : fermer'));
  }

  buildCraftingScreen(panel) {
    this.screen.grid = new Array(9).fill(null);
    panel.append(el('h2', 'panel-title', 'Établi'));
    const row = el('div', 'craft-row big');
    row.append(this.grid('craft3', 0, 9, 3));
    row.append(el('div', 'arrow', '➜'));
    row.append(this.slot('result', 0, { cls: 'result-slot' }));
    panel.append(row);
    this.playerGrids(panel);
    panel.append(el('div', 'panel-hint', 'Placez les ingrédients selon le motif de la recette.'));
  }

  buildFurnaceScreen(panel, data) {
    panel.append(el('h2', 'panel-title', 'Four'));
    const box = el('div', 'furnace-box');
    const left = el('div', 'furnace-col');
    left.append(this.slot('furnace_in', 0));
    const flame = el('div', 'flame');
    flame.innerHTML = '<div class="flame-fill"></div>';
    left.append(flame);
    left.append(this.slot('furnace_fuel', 0));
    box.append(left);
    const prog = el('div', 'furnace-progress');
    prog.innerHTML = '<div class="progress-fill"></div>';
    box.append(prog);
    box.append(this.slot('furnace_out', 0, { cls: 'result-slot' }));
    panel.append(box);
    this.playerGrids(panel);
    panel.append(el('div', 'panel-hint', 'Combustible en bas (charbon, planches, bâtons), matière à cuire en haut.'));
  }

  buildChestScreen(panel, data) {
    panel.append(el('h2', 'panel-title', 'Coffre'));
    panel.append(this.grid('chest', 0, 27, 9));
    this.playerGrids(panel);
  }

  buildCreativeScreen(panel) {
    panel.append(el('h2', 'panel-title', 'Inventaire créatif'));
    const tabs = el('div', 'tabs');
    this.creativeCat = this.creativeCat || CATEGORIES[0][0];
    for (const [id, label] of CATEGORIES) {
      const t = el('button', `tab${id === this.creativeCat ? ' active' : ''}`, label);
      t.addEventListener('click', () => { this.creativeCat = id; this.openScreen('creative'); });
      tabs.append(t);
    }
    panel.append(tabs);

    const list = el('div', 'creative-list');
    const items = ITEM_ORDER.filter((it) => it.category === this.creativeCat);
    for (const it of items) {
      const node = el('div', 'slot');
      const img = el('img', 'slot-icon');
      img.src = itemIcon(it.name);
      node.append(img);
      node.title = it.label;
      node.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (e.button === 0) this.cursor = stack(it.name, maxStackOf(it.name));
        else this.cursor = stack(it.name, 1);
        this.updateCursorEl();
      });
      node.addEventListener('mouseenter', () => {
        this.tooltipFor(node, it.label, it.name);
      });
      node.addEventListener('mouseleave', () => this.hideTooltip());
      list.append(node);
    }
    panel.append(list);
    this.playerGrids(panel);
    panel.append(el('div', 'panel-hint', 'Clic : pile complète · Clic droit : un seul · Déposez sur la barre d’action.'));
  }

  /* ──────────────────────── Contenu des emplacements ──────────────────────── */

  getSlot(kind, i) {
    const p = this.game.player;
    switch (kind) {
      case 'inv': return p.inventory.get(i);
      case 'armor': return p.inventory.armor[i];
      case 'craft': return p.inventory.craft[i];
      case 'craft3': return this.screen.grid[i];
      case 'chest': return this.chestEntity()?.slots[i] ?? null;
      case 'furnace_in': return this.furnaceEntity()?.input ?? null;
      case 'furnace_fuel': return this.furnaceEntity()?.fuel ?? null;
      case 'furnace_out': return this.furnaceEntity()?.output ?? null;
      case 'result': return this.craftResult();
      default: return null;
    }
  }

  setSlot(kind, i, s) {
    const p = this.game.player;
    const v = s && s.count > 0 ? s : null;
    switch (kind) {
      case 'inv': p.inventory.set(i, v); break;
      case 'armor': p.inventory.armor[i] = v; break;
      case 'craft': p.inventory.craft[i] = v; break;
      case 'craft3': this.screen.grid[i] = v; break;
      case 'chest': { const e = this.chestEntity(); if (e) { e.slots[i] = v; this.markChunkModified(); } break; }
      case 'furnace_in': { const e = this.furnaceEntity(); if (e) { e.input = v; this.markChunkModified(); } break; }
      case 'furnace_fuel': { const e = this.furnaceEntity(); if (e) { e.fuel = v; this.markChunkModified(); } break; }
      case 'furnace_out': { const e = this.furnaceEntity(); if (e) { e.output = v; this.markChunkModified(); } break; }
      default: break;
    }
  }

  markChunkModified() {
    const d = this.screen?.data;
    if (!d) return;
    const c = this.game.world.chunkOf(d.x, d.z);
    if (c) c.modified = true;
  }

  chestEntity() {
    const d = this.screen?.data;
    if (!d) return null;
    return this.game.world.getBlockEntity(d.x, d.y, d.z, 'chest');
  }

  furnaceEntity() {
    const d = this.screen?.data;
    if (!d) return null;
    return this.game.world.getBlockEntity(d.x, d.y, d.z, 'furnace');
  }

  craftGridArray() {
    if (!this.screen) return null;
    if (this.screen.kind === 'crafting') return { grid: this.screen.grid, size: 3, kind: 'craft3' };
    if (this.screen.kind === 'inventory') return { grid: this.game.player.inventory.craft, size: 2, kind: 'craft' };
    return null;
  }

  craftResult() {
    const g = this.craftGridArray();
    if (!g) return null;
    const found = findRecipe(g.grid, g.size);
    return found ? found.result : null;
  }

  /* ──────────────────────────── Gestes de souris ──────────────────────────── */

  onSlotClick(kind, index, button, shift) {
    const audio = this.game.audio;
    if (kind === 'result') { this.takeResult(shift); audio.play('click'); return; }

    if (shift) { this.quickMove(kind, index); audio.play('click'); return; }

    const cur = this.getSlot(kind, index);
    const takeOnly = kind === 'furnace_out';

    if (button === 2) {
      // Clic droit : la moitié, ou une unité.
      if (!this.cursor) {
        if (!cur) return;
        const half = Math.ceil(cur.count / 2);
        this.cursor = { item: cur.item, count: half, dmg: cur.dmg };
        cur.count -= half;
        this.setSlot(kind, index, cur.count > 0 ? cur : null);
      } else if (!takeOnly) {
        if (!cur) {
          if (!this.canPlace(kind, index, this.cursor)) return;
          this.setSlot(kind, index, { item: this.cursor.item, count: 1, dmg: this.cursor.dmg });
          this.cursor.count--;
        } else if (sameStack(cur, this.cursor) && cur.count < maxStackOf(cur.item)) {
          cur.count++;
          this.cursor.count--;
          this.setSlot(kind, index, cur);
        }
        if (this.cursor.count <= 0) this.cursor = null;
      }
    } else {
      if (!this.cursor) {
        if (!cur) return;
        this.cursor = cloneStack(cur);
        this.setSlot(kind, index, null);
      } else if (takeOnly) {
        return;
      } else if (!cur) {
        if (!this.canPlace(kind, index, this.cursor)) return;
        this.setSlot(kind, index, this.cursor);
        this.cursor = null;
      } else if (sameStack(cur, this.cursor)) {
        const max = maxStackOf(cur.item);
        const moved = Math.min(max - cur.count, this.cursor.count);
        cur.count += moved;
        this.cursor.count -= moved;
        this.setSlot(kind, index, cur);
        if (this.cursor.count <= 0) this.cursor = null;
      } else {
        if (!this.canPlace(kind, index, this.cursor)) return;
        this.setSlot(kind, index, this.cursor);
        this.cursor = cur;
      }
    }
    audio.play('click');
    this.updateCursorEl();
  }

  canPlace(kind, index, s) {
    if (kind !== 'armor') return true;
    const it = getItem(s.item);
    if (!it || !it.armor) return false;
    return ['head', 'chest', 'legs', 'feet'][index] === it.armor.slot;
  }

  /** Récupère le résultat d'artisanat et consomme les ingrédients. */
  takeResult(all) {
    const g = this.craftGridArray();
    if (!g) return;
    let made = 0;
    do {
      const found = findRecipe(g.grid, g.size);
      if (!found) break;
      const res = found.result;
      if (this.cursor && (!sameStack(this.cursor, res) || this.cursor.count + res.count > maxStackOf(res.item))) break;
      if (this.cursor) this.cursor.count += res.count;
      else this.cursor = res;
      for (let i = 0; i < g.grid.length; i++) {
        if (!g.grid[i]) continue;
        g.grid[i].count--;
        if (g.grid[i].count <= 0) g.grid[i] = null;
      }
      made++;
      this.game.player.addExhaustion(0.005);
    } while (all && made < 64);
    if (made) this.game.audio.play('craft');
    this.updateCursorEl();
  }

  /** Maj+clic : envoie la pile « de l'autre côté ». */
  quickMove(kind, index) {
    const p = this.game.player;
    const s = this.getSlot(kind, index);
    if (!s) return;

    const intoInventory = (from) => {
      const left = p.inventory.add(from);
      return left;
    };

    if (kind === 'inv') {
      // Vers le conteneur ouvert, sinon entre barre d'action et sacoche.
      if (this.screen.kind === 'chest') {
        const e = this.chestEntity();
        if (e) {
          const left = this.addToArray(e.slots, s);
          this.setSlot(kind, index, left);
          this.markChunkModified();
          return;
        }
      }
      if (this.screen.kind === 'furnace') {
        const e = this.furnaceEntity();
        const canSmelt = this.game.world.smelt(s.item);
        const isFuel = this.game.world.fuelValue(s.item) > 0;
        if (e && (canSmelt || isFuel)) {
          const target = canSmelt ? 'input' : 'fuel';
          if (!e[target]) { e[target] = s; this.setSlot(kind, index, null); }
          else if (sameStack(e[target], s)) {
            const max = maxStackOf(s.item);
            const moved = Math.min(max - e[target].count, s.count);
            e[target].count += moved; s.count -= moved;
            this.setSlot(kind, index, s.count > 0 ? s : null);
          }
          this.markChunkModified();
          return;
        }
      }
      const it = getItem(s.item);
      if (it && it.armor) {
        const slotIdx = ['head', 'chest', 'legs', 'feet'].indexOf(it.armor.slot);
        if (slotIdx >= 0 && !p.inventory.armor[slotIdx]) {
          p.inventory.armor[slotIdx] = s;
          this.setSlot(kind, index, null);
          return;
        }
      }
      // Barre d'action ↔ sacoche
      const order = index < 9
        ? Array.from({ length: 27 }, (_, i) => i + 9)
        : Array.from({ length: 9 }, (_, i) => i);
      this.setSlot(kind, index, null);
      const left = p.inventory.add(s, order);
      if (left) this.setSlot(kind, index, left);
      return;
    }

    // Depuis un conteneur vers l'inventaire.
    this.setSlot(kind, index, null);
    const left = intoInventory(s);
    if (left) this.setSlot(kind, index, left);
  }

  addToArray(arr, s) {
    const max = maxStackOf(s.item);
    for (let i = 0; i < arr.length && s.count > 0; i++) {
      if (arr[i] && sameStack(arr[i], s) && arr[i].count < max) {
        const moved = Math.min(max - arr[i].count, s.count);
        arr[i].count += moved; s.count -= moved;
      }
    }
    for (let i = 0; i < arr.length && s.count > 0; i++) {
      if (!arr[i]) {
        const moved = Math.min(max, s.count);
        arr[i] = { item: s.item, count: moved, dmg: s.dmg };
        s.count -= moved;
      }
    }
    return s.count > 0 ? s : null;
  }

  updateCursorEl() {
    if (!this.cursor) { this.cursorEl.classList.add('hidden'); return; }
    this.cursorEl.classList.remove('hidden');
    this.cursorEl.innerHTML = '';
    const img = el('img', 'slot-icon');
    img.src = itemIcon(this.cursor.item);
    this.cursorEl.append(img);
    if (this.cursor.count > 1) this.cursorEl.append(el('span', 'slot-count', String(this.cursor.count)));
    this.cursorEl.style.left = `${this.mouseX || 0}px`;
    this.cursorEl.style.top = `${this.mouseY || 0}px`;
  }

  showTooltip(node, kind, index) {
    const s = this.getSlot(kind, index);
    if (!s) return;
    const it = getItem(s.item);
    this.tooltipFor(node, it ? it.label : s.item, s.item, s);
  }

  tooltipFor(node, label, itemName, s = null) {
    this.hideTooltip();
    const tip = el('div', 'tooltip');
    tip.append(el('div', 'tip-title', label));
    const it = getItem(itemName);
    if (it) {
      if (it.tool) tip.append(el('div', 'tip-line', `Outil : ${it.tool} · vitesse ×${it.speed}`));
      if (it.damage > 1) tip.append(el('div', 'tip-line', `Dégâts : ${it.damage}`));
      if (it.armor) tip.append(el('div', 'tip-line', `Armure : +${it.armor.defense}`));
      if (it.food) tip.append(el('div', 'tip-line', `Nourriture : +${it.food.hunger}`));
      if (it.fuel) tip.append(el('div', 'tip-line', `Combustible : ${(it.fuel / 200).toFixed(1)} cuissons`));
      if (it.durability && s) tip.append(el('div', 'tip-line', `Durabilité : ${it.durability - (s.dmg || 0)} / ${it.durability}`));
      if (it.place !== null && BLOCKS[it.place] && BLOCKS[it.place].hardness > 0) {
        tip.append(el('div', 'tip-line dim', `Dureté : ${BLOCKS[it.place].hardness}`));
      }
    }
    document.body.append(tip);
    const r = node.getBoundingClientRect();
    tip.style.left = `${Math.min(window.innerWidth - 220, r.right + 8)}px`;
    tip.style.top = `${r.top}px`;
    this.tooltip = tip;
  }

  hideTooltip() {
    if (this.tooltip) { this.tooltip.remove(); this.tooltip = null; }
  }

  /** Redessine le contenu de l'écran ouvert. */
  refreshScreen() {
    if (!this.screen) return;
    for (const { node, kind, index } of this.slotNodes) {
      this.paintSlot(node, this.getSlot(kind, index));
    }
    if (this.screen.kind === 'furnace') {
      const e = this.furnaceEntity();
      const flame = this.panel.querySelector('.flame-fill');
      const prog = this.panel.querySelector('.progress-fill');
      if (e && flame) flame.style.height = `${e.maxBurn ? (e.burn / e.maxBurn) * 100 : 0}%`;
      if (e && prog) prog.style.width = `${(e.cook / 200) * 100}%`;
    }
  }
}
