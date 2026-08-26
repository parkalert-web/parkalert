/**
 * Minecraft JS — registre des objets (tout ce qui tient dans un emplacement
 * d'inventaire) : blocs posables, outils, armures, nourriture, matériaux.
 *
 * Les blocs déclarés dans blocks.js reçoivent automatiquement leur objet.
 */

import { BLOCKS, blockByName } from './blocks.js';
import { T, hasTile } from './textures.js';

export const ITEMS = Object.create(null);
export const ITEM_ORDER = [];

/** Catégories de l'inventaire créatif. */
export const CATEGORIES = [
  ['building', 'Construction'],
  ['nature', 'Nature'],
  ['decoration', 'Décoration'],
  ['tools', 'Outils'],
  ['combat', 'Combat'],
  ['food', 'Nourriture'],
  ['materials', 'Matériaux'],
];

function item(name, o = {}) {
  const it = {
    name,
    label: o.label ?? name,
    tile: o.tile !== undefined ? o.tile : (hasTile(name) ? T(name) : T('white')),
    maxStack: o.maxStack ?? 64,
    place: o.place ?? null,       // id de bloc posé au clic droit
    isBlock: o.isBlock ?? false,
    tool: o.tool ?? null,         // 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'hoe' | 'shears'
    tier: o.tier ?? null,         // 'wood' | 'stone' | 'iron' | 'gold' | 'diamond'
    speed: o.speed ?? 1,
    damage: o.damage ?? 1,        // dégâts en attaque
    durability: o.durability ?? 0,
    armor: o.armor ?? null,       // {slot:'head'|'chest'|'legs'|'feet', defense:n}
    food: o.food ?? null,         // {hunger, saturation, effect}
    fuel: o.fuel ?? 0,            // durée de combustion (ticks) dans un four
    category: o.category ?? 'materials',
    action: o.action ?? null,     // comportement spécial au clic droit
    // Icône : un bloc est dessiné en cube isométrique à partir de ses trois
    // faces visibles ; les textures teintées reçoivent la couleur des plaines.
    iconTiles: o.iconTiles ?? null,
    tintColor: o.tintColor ?? null,
    tintFaces: o.tintFaces ?? null,
  };
  ITEMS[name] = it;
  ITEM_ORDER.push(it);
  return it;
}

export function getItem(name) { return ITEMS[name] || null; }

/* ───────────────────── Objets « bloc » (déduits du registre) ───────────────────── */

const CATEGORY_OF_BLOCK = {
  grass_block: 'nature', dirt: 'nature', coarse_dirt: 'nature', sand: 'nature', gravel: 'nature',
  clay: 'nature', snow_block: 'nature', ice: 'nature', cactus: 'nature', pumpkin: 'nature',
  oak_log: 'nature', birch_log: 'nature', spruce_log: 'nature',
  oak_leaves: 'nature', birch_leaves: 'nature', spruce_leaves: 'nature',
  oak_sapling: 'nature', birch_sapling: 'nature', spruce_sapling: 'nature',
  tall_grass: 'nature', dead_bush: 'nature', dandelion: 'decoration', poppy: 'decoration',
  red_mushroom: 'nature', brown_mushroom: 'nature',
  torch: 'decoration', ladder: 'decoration', bed: 'decoration', bookshelf: 'decoration',
  crafting_table: 'decoration', furnace: 'decoration', chest: 'decoration', tnt: 'decoration',
  coal_ore: 'nature', iron_ore: 'nature', gold_ore: 'nature', diamond_ore: 'nature',
  emerald_ore: 'nature', lapis_ore: 'nature', redstone_ore: 'nature', bedrock: 'nature',
};

for (const bl of BLOCKS) {
  if (!bl.item || bl.name === 'air') continue;
  let tile = bl.tiles ? bl.tiles[2] : T('white');
  const cube = bl.render === 'cube';
  if (bl.render === 'cross' || bl.render === 'flat') tile = bl.tiles ? bl.tiles[0] : tile;
  item(bl.name, {
    label: bl.label,
    tile,
    place: bl.id,
    isBlock: cube,
    fuel: bl.fuel,
    category: CATEGORY_OF_BLOCK[bl.name] ?? 'building',
    // Les blocs à faces différentes ont besoin de leurs trois tuiles pour l'icône 3D.
    iconTiles: bl.tiles ? [bl.tiles[2], bl.tiles[0], bl.tiles[5]] : null,
    // Les textures teintées sont grises : hors du monde, on leur applique la
    // couleur des plaines pour que l'icône ressemble à ce qu'on tient.
    tintColor: bl.tint ? (bl.tint === 'grass' ? [0.57, 0.74, 0.35] : [0.47, 0.68, 0.28]) : null,
    tintFaces: bl.tint ? (bl.tintTopOnly ? 'top' : 'all') : null,
  });
}

/* ─────────────────────────────── Matériaux ─────────────────────────────── */

item('stick', { label: 'Bâton', fuel: 100 });
item('coal', { label: 'Charbon', fuel: 1600 });
item('charcoal', { label: 'Charbon de bois', fuel: 1600 });
item('iron_ingot', { label: 'Lingot de fer' });
item('gold_ingot', { label: 'Lingot d\'or' });
item('diamond', { label: 'Diamant' });
item('emerald', { label: 'Émeraude' });
item('lapis_lazuli', { label: 'Lapis-lazuli' });
item('redstone_dust', { label: 'Poudre de redstone' });
item('flint', { label: 'Silex' });
item('clay_ball', { label: 'Boule d\'argile' });
item('brick_item', { label: 'Brique', tile: T('brick_item') });
item('leather', { label: 'Cuir' });
item('feather', { label: 'Plume' });
item('bone', { label: 'Os' });
item('string', { label: 'Ficelle' });
item('gunpowder', { label: 'Poudre à canon' });
item('rotten_flesh', { label: 'Chair putréfiée', food: { hunger: 4, saturation: 0.8, effect: 'hunger' }, category: 'food' });
item('spider_eye', { label: 'Œil d\'araignée', food: { hunger: 2, saturation: 3.2, effect: 'poison' }, category: 'food' });
item('wheat_item', { label: 'Blé', tile: T('wheat_item') });
item('wheat_seeds', { label: 'Graines de blé', place: blockByName('wheat').id, category: 'nature' });
item('egg', { label: 'Œuf', maxStack: 16 });

/* ─────────────────────────────── Nourriture ─────────────────────────────── */

item('apple', { label: 'Pomme', food: { hunger: 4, saturation: 2.4 }, category: 'food' });
item('golden_apple', { label: 'Pomme dorée', food: { hunger: 4, saturation: 9.6, effect: 'regeneration' }, category: 'food' });
item('bread', { label: 'Pain', food: { hunger: 5, saturation: 6 }, category: 'food' });
item('porkchop', { label: 'Porc cru', food: { hunger: 3, saturation: 1.8 }, category: 'food' });
item('cooked_porkchop', { label: 'Porc cuit', food: { hunger: 8, saturation: 12.8 }, category: 'food' });
item('beef', { label: 'Bœuf cru', food: { hunger: 3, saturation: 1.8 }, category: 'food' });
item('cooked_beef', { label: 'Steak', food: { hunger: 8, saturation: 12.8 }, category: 'food' });
item('chicken', { label: 'Poulet cru', food: { hunger: 2, saturation: 1.2 }, category: 'food' });
item('cooked_chicken', { label: 'Poulet cuit', food: { hunger: 6, saturation: 7.2 }, category: 'food' });
item('mutton', { label: 'Mouton cru', food: { hunger: 2, saturation: 1.2 }, category: 'food' });
item('cooked_mutton', { label: 'Mouton cuit', food: { hunger: 6, saturation: 9.6 }, category: 'food' });

/* ──────────────────────────────── Outils ──────────────────────────────── */

const TIER_STATS = {
  wood: { speed: 2, durability: 59, base: 0 },
  stone: { speed: 4, durability: 131, base: 1 },
  iron: { speed: 6, durability: 250, base: 2 },
  gold: { speed: 12, durability: 32, base: 0 },
  diamond: { speed: 8, durability: 1561, base: 3 },
};

const TIER_LABEL = { wood: 'en bois', stone: 'en pierre', iron: 'en fer', gold: 'en or', diamond: 'en diamant' };
const TOOL_LABEL = { pickaxe: 'Pioche', axe: 'Hache', shovel: 'Pelle', sword: 'Épée', hoe: 'Houe' };
const TOOL_DAMAGE = { pickaxe: 2, axe: 3, shovel: 1.5, sword: 4, hoe: 1 };

for (const [tier, st] of Object.entries(TIER_STATS)) {
  for (const kind of ['pickaxe', 'axe', 'shovel', 'sword', 'hoe']) {
    item(`${tier}_${kind}`, {
      label: `${TOOL_LABEL[kind]} ${TIER_LABEL[tier]}`,
      maxStack: 1,
      tool: kind,
      tier,
      speed: st.speed,
      damage: TOOL_DAMAGE[kind] + st.base,
      durability: kind === 'sword' ? Math.round(st.durability * 1.0) : st.durability,
      fuel: tier === 'wood' ? 200 : 0,
      category: kind === 'sword' ? 'combat' : 'tools',
    });
  }
}

item('shears', { label: 'Cisailles', maxStack: 1, tool: 'shears', tier: 'iron', speed: 5, durability: 238, category: 'tools' });
item('bucket', { label: 'Seau', maxStack: 1, category: 'tools', action: 'bucket' });
item('water_bucket', { label: 'Seau d\'eau', maxStack: 1, category: 'tools', action: 'place_water' });
item('lava_bucket', { label: 'Seau de lave', maxStack: 1, category: 'tools', action: 'place_lava', fuel: 20000 });
item('milk_bucket', { label: 'Seau de lait', maxStack: 1, category: 'food', action: 'milk' });

item('bow', { label: 'Arc', maxStack: 1, durability: 384, damage: 1, category: 'combat', action: 'bow' });
item('arrow', { label: 'Flèche', category: 'combat' });

/* ──────────────────────────────── Armures ──────────────────────────────── */

const ARMOR = {
  leather: { label: 'en cuir', durability: [55, 80, 75, 65], defense: [1, 3, 2, 1] },
  gold: { label: 'en or', durability: [77, 112, 105, 91], defense: [2, 5, 3, 1] },
  iron: { label: 'en fer', durability: [165, 240, 225, 195], defense: [2, 6, 5, 2] },
  diamond: { label: 'en diamant', durability: [363, 528, 495, 429], defense: [3, 8, 6, 3] },
};
const PIECES = [
  ['helmet', 'head', 'Casque'],
  ['chestplate', 'chest', 'Plastron'],
  ['leggings', 'legs', 'Jambières'],
  ['boots', 'feet', 'Bottes'],
];

for (const [tier, a] of Object.entries(ARMOR)) {
  PIECES.forEach(([piece, slot, label], i) => {
    item(`${tier}_${piece}`, {
      label: `${label} ${a.label}`,
      maxStack: 1,
      durability: a.durability[i],
      armor: { slot, defense: a.defense[i] },
      category: 'combat',
    });
  });
}

/* ────────────────────────── Piles d'objets (ItemStack) ────────────────────────── */

/** Crée une pile. `dmg` = usure de l'outil (0 = neuf). */
export function stack(name, count = 1, dmg = 0) {
  if (!name || count <= 0) return null;
  return { item: name, count, dmg };
}

export function cloneStack(s) { return s ? { item: s.item, count: s.count, dmg: s.dmg || 0 } : null; }

/** Deux piles fusionnent-elles ? (même objet, même usure, pas d'outil unique) */
export function sameStack(a, b) {
  if (!a || !b) return false;
  return a.item === b.item && (a.dmg || 0) === (b.dmg || 0);
}

export function maxStackOf(name) {
  const it = ITEMS[name];
  return it ? it.maxStack : 64;
}

/** Statistiques d'outil utilisées par blocks.breakTime / les dégâts d'attaque. */
export function toolStats(s) {
  if (!s) return null;
  const it = ITEMS[s.item];
  if (!it || !it.tool) return null;
  return { tool: it.tool, tier: it.tier, speed: it.speed };
}

export function attackDamage(s) {
  if (!s) return 1;
  const it = ITEMS[s.item];
  return it ? it.damage : 1;
}
