/**
 * Minecraft JS — inventaires.
 *
 * Un inventaire est un simple tableau d'emplacements contenant des piles
 * {item, count, dmg}. Le joueur en a 36 (dont 9 dans la barre d'action),
 * plus 4 emplacements d'armure et une grille d'artisanat 2×2.
 */

import { maxStackOf, sameStack, cloneStack, getItem } from './items.js';

export class Inventory {
  constructor(size) {
    this.slots = new Array(size).fill(null);
  }

  get size() { return this.slots.length; }
  get(i) { return this.slots[i]; }
  set(i, s) { this.slots[i] = s && s.count > 0 ? s : null; }

  /**
   * Ajoute une pile ; complète d'abord les piles existantes.
   * @returns {object|null} ce qui n'a pas pu rentrer
   */
  add(stack, order = null) {
    if (!stack) return null;
    const s = cloneStack(stack);
    const max = maxStackOf(s.item);
    const idxs = order || this.slots.map((_, i) => i);
    for (const i of idxs) {
      const cur = this.slots[i];
      if (cur && sameStack(cur, s) && cur.count < max) {
        const room = max - cur.count;
        const moved = Math.min(room, s.count);
        cur.count += moved; s.count -= moved;
        if (s.count <= 0) return null;
      }
    }
    for (const i of idxs) {
      if (!this.slots[i]) {
        const moved = Math.min(max, s.count);
        this.slots[i] = { item: s.item, count: moved, dmg: s.dmg };
        s.count -= moved;
        if (s.count <= 0) return null;
      }
    }
    return s;
  }

  /** Y a-t-il la place pour cette pile ? */
  canFit(stack) {
    if (!stack) return true;
    const max = maxStackOf(stack.item);
    let room = 0;
    for (const s of this.slots) {
      if (!s) room += max;
      else if (sameStack(s, stack)) room += Math.max(0, max - s.count);
      if (room >= stack.count) return true;
    }
    return false;
  }

  count(item) {
    let n = 0;
    for (const s of this.slots) if (s && s.item === item) n += s.count;
    return n;
  }

  /** Retire n exemplaires d'un objet ; retourne le nombre réellement retiré. */
  remove(item, n) {
    let left = n;
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      const s = this.slots[i];
      if (!s || s.item !== item) continue;
      const take = Math.min(s.count, left);
      s.count -= take; left -= take;
      if (s.count <= 0) this.slots[i] = null;
    }
    return n - left;
  }

  /** Enlève un exemplaire de l'emplacement (consommation d'ingrédient). */
  consume(i, n = 1) {
    const s = this.slots[i];
    if (!s) return;
    s.count -= n;
    if (s.count <= 0) this.slots[i] = null;
  }

  clear() { this.slots.fill(null); }

  toJSON() { return this.slots.map((s) => (s ? [s.item, s.count, s.dmg || 0] : null)); }

  fromJSON(a) {
    if (!Array.isArray(a)) return;
    for (let i = 0; i < this.slots.length; i++) {
      const v = a[i];
      this.slots[i] = v ? { item: v[0], count: v[1], dmg: v[2] || 0 } : null;
    }
  }
}

export class PlayerInventory extends Inventory {
  constructor() {
    super(36);
    this.armor = new Array(4).fill(null);   // casque, plastron, jambières, bottes
    this.craft = new Array(4).fill(null);   // grille 2×2 portable
    this.selected = 0;
  }

  /** La barre d'action se remplit en premier, comme dans le jeu. */
  add(stack) {
    const order = [];
    for (let i = 0; i < 9; i++) order.push(i);
    for (let i = 9; i < 36; i++) order.push(i);
    return super.add(stack, order);
  }

  get held() { return this.slots[this.selected]; }
  set held(s) { this.slots[this.selected] = s && s.count > 0 ? s : null; }

  /** Points d'armure totaux (chaque point = 4 % de dégâts en moins). */
  get defense() {
    let d = 0;
    for (const s of this.armor) {
      if (!s) continue;
      const it = getItem(s.item);
      if (it && it.armor) d += it.armor.defense;
    }
    return d;
  }

  /** Use l'objet tenu (durabilité) ; le casse s'il est à bout. */
  damageHeld(amount = 1) {
    const s = this.held;
    if (!s) return false;
    const it = getItem(s.item);
    if (!it || !it.durability) return false;
    s.dmg = (s.dmg || 0) + amount;
    if (s.dmg >= it.durability) { this.held = null; return true; }
    return false;
  }

  damageArmor(amount = 1) {
    for (let i = 0; i < 4; i++) {
      const s = this.armor[i];
      if (!s) continue;
      const it = getItem(s.item);
      if (!it || !it.durability) continue;
      s.dmg = (s.dmg || 0) + amount;
      if (s.dmg >= it.durability) this.armor[i] = null;
    }
  }

  toJSON() {
    return {
      slots: super.toJSON(),
      armor: this.armor.map((s) => (s ? [s.item, s.count, s.dmg || 0] : null)),
      selected: this.selected,
    };
  }

  fromJSON(o) {
    if (!o) return;
    super.fromJSON(o.slots);
    if (Array.isArray(o.armor)) {
      this.armor = o.armor.map((v) => (v ? { item: v[0], count: v[1], dmg: v[2] || 0 } : null));
    }
    this.selected = o.selected || 0;
  }
}
