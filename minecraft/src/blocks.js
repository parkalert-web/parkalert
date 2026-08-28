/**
 * Minecraft JS — registre des blocs.
 *
 * Un bloc = un identifiant numérique stocké dans le tableau de voxels, plus une
 * fiche décrivant son apparence (quelles tuiles sur quelles faces), sa physique
 * (solide ? liquide ? gravité ?), sa lumière et la façon de le casser.
 *
 * Ordre des faces partout dans le moteur :
 *   0 = +X (est) · 1 = −X (ouest) · 2 = +Y (haut) · 3 = −Y (bas) · 4 = +Z (sud) · 5 = −Z (nord)
 */

import { T } from './textures.js';

export const FACES = [
  { n: [1, 0, 0], name: 'est' },
  { n: [-1, 0, 0], name: 'ouest' },
  { n: [0, 1, 0], name: 'haut' },
  { n: [0, -1, 0], name: 'bas' },
  { n: [0, 0, 1], name: 'sud' },
  { n: [0, 0, -1], name: 'nord' },
];

/** Face regardée par un bloc orienté (0=nord, 1=est, 2=sud, 3=ouest). */
export const FACING_TO_FACE = [5, 0, 4, 1];

export const BLOCKS = [];
export const B = Object.create(null);
const byName = Object.create(null);

function resolveTiles(tex) {
  if (typeof tex === 'string') { const t = T(tex); return [t, t, t, t, t, t]; }
  const side = tex.side ?? tex.all;
  const top = tex.top ?? side;
  const bottom = tex.bottom ?? side;
  return [
    T(tex.px ?? side), T(tex.nx ?? side), T(tex.py ?? top),
    T(tex.ny ?? bottom), T(tex.pz ?? side), T(tex.nz ?? side),
  ];
}

/**
 * Déclare un bloc.
 * Les valeurs par défaut décrivent un cube plein, opaque, cassable à la main.
 */
function def(name, o = {}) {
  const id = BLOCKS.length;
  const render = o.render ?? (o.tex ? 'cube' : 'none');
  const opaque = o.opaque ?? (render === 'cube');
  const block = {
    id,
    name,
    label: o.label ?? name,
    render,
    opaque,
    solid: o.solid ?? (render === 'cube'),
    fluid: o.fluid ?? null,
    light: o.light ?? 0,
    // Lumière absorbée en traversant le bloc (15 = opaque total).
    opacity: o.opacity ?? (opaque ? 15 : 0),
    hardness: o.hardness ?? 0,
    tool: o.tool ?? null,
    tier: o.tier ?? 0,
    drop: o.drop === undefined ? name : o.drop,
    tint: o.tint ?? null,
    tintTopOnly: o.tintTopOnly ?? false,
    replaceable: o.replaceable ?? false,
    gravity: o.gravity ?? false,
    sound: o.sound ?? 'stone',
    item: o.item ?? true,
    fuel: o.fuel ?? 0,
    facing: o.facing ?? false,
    climbable: o.climbable ?? false,
    hurt: o.hurt ?? 0,
    needsSupport: o.needsSupport ?? false,
    plantOn: o.plantOn ?? null,
    growable: o.growable ?? false,
    tiles: o.tex ? resolveTiles(o.tex) : null,
    tileFn: o.tileFn ?? null,
    label_en: o.en ?? name,
  };
  BLOCKS.push(block);
  B[name.toUpperCase()] = id;
  byName[name] = block;
  return id;
}

export function blockByName(name) { return byName[name]; }
export function idByName(name) { return byName[name] ? byName[name].id : 0; }
export function block(id) { return BLOCKS[id] || BLOCKS[0]; }

/** Tuile (couche d'atlas) d'une face donnée, en tenant compte de l'orientation. */
export function blockTile(bl, face, data = 0) {
  if (bl.tileFn) return bl.tileFn(face, data);
  return bl.tiles ? bl.tiles[face] : 0;
}

/* ─────────────────────────────── Les blocs ─────────────────────────────── */

def('air', { label: 'Air', render: 'none', opaque: false, solid: false, replaceable: true, item: false, drop: null });

def('stone', { label: 'Pierre', tex: 'stone', hardness: 1.5, tool: 'pickaxe', tier: 1, drop: 'cobblestone' });
def('granite', { label: 'Granite', tex: 'granite', hardness: 1.5, tool: 'pickaxe', tier: 1 });
def('diorite', { label: 'Diorite', tex: 'diorite', hardness: 1.5, tool: 'pickaxe', tier: 1 });
def('andesite', { label: 'Andésite', tex: 'andesite', hardness: 1.5, tool: 'pickaxe', tier: 1 });
def('cobblestone', { label: 'Pierre taillée', tex: 'cobblestone', hardness: 2, tool: 'pickaxe', tier: 1 });
def('mossy_cobblestone', { label: 'Pierre moussue', tex: 'mossy_cobblestone', hardness: 2, tool: 'pickaxe', tier: 1 });
def('stone_bricks', { label: 'Pierre taillée lisse', tex: 'stone_bricks', hardness: 1.5, tool: 'pickaxe', tier: 1 });
def('brick', { label: 'Briques', tex: 'brick', hardness: 2, tool: 'pickaxe', tier: 1 });
def('bedrock', { label: 'Bedrock', tex: 'bedrock', hardness: -1, drop: null });

def('dirt', { label: 'Terre', tex: 'dirt', hardness: 0.5, tool: 'shovel', sound: 'gravel' });
def('coarse_dirt', { label: 'Terre stérile', tex: 'coarse_dirt', hardness: 0.5, tool: 'shovel', sound: 'gravel' });
def('grass_block', {
  label: 'Bloc d\'herbe', hardness: 0.6, tool: 'shovel', sound: 'grass', drop: 'dirt',
  // Seule la face du dessus prend la couleur du biome ; les côtés gardent
  // leur liseré vert et leur terre, comme la texture d'origine.
  tint: 'grass', tintTopOnly: true,
  tex: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' },
});
def('farmland', {
  label: 'Terre labourée', hardness: 0.6, tool: 'shovel', sound: 'gravel', drop: 'dirt',
  tex: { top: 'farmland', bottom: 'dirt', side: 'dirt' },
  tileFn: (face, data) => (face === 2 ? T(data > 0 ? 'farmland_wet' : 'farmland') : face === 3 ? T('dirt') : T('dirt')),
});
def('sand', { label: 'Sable', tex: 'sand', hardness: 0.5, tool: 'shovel', sound: 'sand', gravity: true });
def('gravel', { label: 'Gravier', tex: 'gravel', hardness: 0.6, tool: 'shovel', sound: 'gravel', gravity: true });
def('clay', { label: 'Argile', tex: 'clay', hardness: 0.6, tool: 'shovel', sound: 'gravel', drop: 'clay_ball' });
def('sandstone', {
  label: 'Grès', hardness: 0.8, tool: 'pickaxe', tier: 1,
  tex: { top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone_side' },
});
def('snow_block', { label: 'Bloc de neige', tex: 'snow', hardness: 0.2, tool: 'shovel', sound: 'snow' });
def('ice', { label: 'Glace', tex: 'ice', hardness: 0.5, tool: 'pickaxe', opaque: false, opacity: 3, drop: null, sound: 'glass' });

def('water', {
  label: 'Eau', tex: 'water', render: 'liquid', opaque: false, solid: false, fluid: 'water',
  opacity: 2, hardness: -1, drop: null, replaceable: true, item: false,
});
def('lava', {
  label: 'Lave', tex: 'lava', render: 'liquid', opaque: false, solid: false, fluid: 'lava',
  light: 15, opacity: 0, hardness: -1, drop: null, replaceable: true, item: false, hurt: 4,
});

def('coal_ore', { label: 'Minerai de charbon', tex: 'coal_ore', hardness: 3, tool: 'pickaxe', tier: 1, drop: 'coal' });
def('iron_ore', { label: 'Minerai de fer', tex: 'iron_ore', hardness: 3, tool: 'pickaxe', tier: 2 });
def('gold_ore', { label: 'Minerai d\'or', tex: 'gold_ore', hardness: 3, tool: 'pickaxe', tier: 3 });
def('diamond_ore', { label: 'Minerai de diamant', tex: 'diamond_ore', hardness: 3, tool: 'pickaxe', tier: 3, drop: 'diamond' });
def('emerald_ore', { label: 'Minerai d\'émeraude', tex: 'emerald_ore', hardness: 3, tool: 'pickaxe', tier: 3, drop: 'emerald' });
def('lapis_ore', { label: 'Minerai de lapis', tex: 'lapis_ore', hardness: 3, tool: 'pickaxe', tier: 2, drop: { item: 'lapis_lazuli', min: 4, max: 8 } });
def('redstone_ore', { label: 'Minerai de redstone', tex: 'redstone_ore', hardness: 3, tool: 'pickaxe', tier: 3, drop: { item: 'redstone_dust', min: 4, max: 5 } });

def('iron_block', { label: 'Bloc de fer', tex: 'iron_block', hardness: 5, tool: 'pickaxe', tier: 2 });
def('gold_block', { label: 'Bloc d\'or', tex: 'gold_block', hardness: 3, tool: 'pickaxe', tier: 3 });
def('diamond_block', { label: 'Bloc de diamant', tex: 'diamond_block', hardness: 5, tool: 'pickaxe', tier: 3 });
def('emerald_block', { label: 'Bloc d\'émeraude', tex: 'emerald_block', hardness: 5, tool: 'pickaxe', tier: 3 });
def('lapis_block', { label: 'Bloc de lapis', tex: 'lapis_block', hardness: 3, tool: 'pickaxe', tier: 2 });
def('coal_block', { label: 'Bloc de charbon', tex: 'coal_block', hardness: 5, tool: 'pickaxe', tier: 1, fuel: 800 });

def('obsidian', { label: 'Obsidienne', tex: 'obsidian', hardness: 50, tool: 'pickaxe', tier: 4 });
def('glowstone', { label: 'Pierre lumineuse', tex: 'glowstone', hardness: 0.3, light: 15, sound: 'glass' });
def('glass', { label: 'Verre', tex: 'glass', hardness: 0.3, opaque: false, opacity: 0, drop: null, sound: 'glass' });

for (const [n, label] of [['oak', 'chêne'], ['birch', 'bouleau'], ['spruce', 'sapin']]) {
  def(`${n}_log`, {
    label: `Tronc de ${label}`, hardness: 2, tool: 'axe', sound: 'wood', fuel: 300,
    tex: { top: `${n}_log_top`, bottom: `${n}_log_top`, side: `${n}_log_side` },
  });
  def(`${n}_planks`, { label: `Planches de ${label}`, tex: `${n}_planks`, hardness: 2, tool: 'axe', sound: 'wood', fuel: 300 });
  def(`${n}_leaves`, {
    label: `Feuilles de ${label}`, tex: `${n}_leaves`, hardness: 0.2, sound: 'grass',
    opaque: false, opacity: 1, render: 'cube', solid: true,
    drop: null,
  });
  def(`${n}_sapling`, {
    label: `Pousse de ${label}`, tex: `${n}_sapling`, render: 'cross', opaque: false, solid: false,
    hardness: 0, sound: 'grass', needsSupport: true, plantOn: ['grass_block', 'dirt', 'coarse_dirt', 'farmland'],
  });
}

def('cactus', {
  label: 'Cactus', hardness: 0.4, sound: 'wool', hurt: 1, needsSupport: true, plantOn: ['sand', 'cactus'],
  tex: { top: 'cactus_top', bottom: 'cactus_top', side: 'cactus_side' },
});
def('pumpkin', {
  label: 'Citrouille', hardness: 1, tool: 'axe', sound: 'wood', facing: true,
  tex: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side' },
  tileFn: (face, data) => {
    if (face === 2 || face === 3) return T('pumpkin_top');
    return face === FACING_TO_FACE[data & 3] ? T('pumpkin_face') : T('pumpkin_side');
  },
});

def('bookshelf', {
  label: 'Bibliothèque', hardness: 1.5, tool: 'axe', sound: 'wood', fuel: 300,
  tex: { top: 'oak_planks', bottom: 'oak_planks', side: 'bookshelf' },
});
def('crafting_table', {
  label: 'Établi', hardness: 2.5, tool: 'axe', sound: 'wood', fuel: 300,
  tex: { top: 'crafting_table_top', bottom: 'oak_planks', side: 'crafting_table_side' },
});
def('furnace', {
  label: 'Four', hardness: 3.5, tool: 'pickaxe', tier: 1, facing: true,
  tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side' },
  tileFn: (face, data) => {
    if (face === 2 || face === 3) return T('furnace_top');
    return face === FACING_TO_FACE[data & 3] ? T('furnace_front') : T('furnace_side');
  },
});
def('furnace_lit', {
  label: 'Four allumé', hardness: 3.5, tool: 'pickaxe', tier: 1, facing: true, light: 13, drop: 'furnace', item: false,
  tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side' },
  tileFn: (face, data) => {
    if (face === 2 || face === 3) return T('furnace_top');
    return face === FACING_TO_FACE[data & 3] ? T('furnace_front_lit') : T('furnace_side');
  },
});
def('chest', {
  label: 'Coffre', hardness: 2.5, tool: 'axe', sound: 'wood', fuel: 300, facing: true,
  tex: { top: 'chest_top', bottom: 'chest_top', side: 'chest_side' },
  tileFn: (face, data) => {
    if (face === 2 || face === 3) return T('chest_top');
    return face === FACING_TO_FACE[data & 3] ? T('chest_front') : T('chest_side');
  },
});
def('tnt', {
  label: 'TNT', hardness: 0, sound: 'grass',
  tex: { top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side' },
});

def('torch', {
  label: 'Torche', tex: 'torch', render: 'cross', opaque: false, solid: false, light: 14,
  hardness: 0, sound: 'wood', needsSupport: true,
});
def('ladder', {
  label: 'Échelle', tex: 'ladder', render: 'flat', opaque: false, solid: false, climbable: true,
  hardness: 0.4, tool: 'axe', sound: 'wood', facing: true, fuel: 300,
});

def('tall_grass', {
  label: 'Herbe', tex: 'tall_grass', render: 'cross', opaque: false, solid: false, replaceable: true,
  hardness: 0, sound: 'grass', tint: 'grass', needsSupport: true,
  plantOn: ['grass_block', 'dirt', 'coarse_dirt', 'farmland'],
  drop: { item: 'wheat_seeds', chance: 0.15 },
});
def('dead_bush', {
  label: 'Buisson mort', tex: 'dead_bush', render: 'cross', opaque: false, solid: false, replaceable: true,
  hardness: 0, sound: 'grass', needsSupport: true, plantOn: ['sand', 'dirt', 'coarse_dirt'], drop: { item: 'stick', min: 0, max: 2 },
});
def('dandelion', {
  label: 'Pissenlit', tex: 'dandelion', render: 'cross', opaque: false, solid: false,
  hardness: 0, sound: 'grass', needsSupport: true, plantOn: ['grass_block', 'dirt', 'coarse_dirt', 'farmland'],
});
def('poppy', {
  label: 'Coquelicot', tex: 'poppy', render: 'cross', opaque: false, solid: false,
  hardness: 0, sound: 'grass', needsSupport: true, plantOn: ['grass_block', 'dirt', 'coarse_dirt', 'farmland'],
});
def('red_mushroom', {
  label: 'Champignon rouge', tex: 'red_mushroom', render: 'cross', opaque: false, solid: false,
  hardness: 0, sound: 'grass', needsSupport: true, plantOn: ['grass_block', 'dirt', 'coarse_dirt', 'stone', 'podzol'],
});
def('brown_mushroom', {
  label: 'Champignon brun', tex: 'brown_mushroom', render: 'cross', opaque: false, solid: false,
  hardness: 0, sound: 'grass', needsSupport: true, plantOn: ['grass_block', 'dirt', 'coarse_dirt', 'stone', 'podzol'],
});
def('wheat', {
  label: 'Blé', render: 'cross', opaque: false, solid: false, hardness: 0, sound: 'grass',
  needsSupport: true, plantOn: ['farmland'], growable: true, item: false,
  tex: 'wheat_0',
  tileFn: (face, data) => T(`wheat_${Math.min(3, data >> 1)}`),
  drop: null,
});

for (const [n, label] of [['white', 'blanche'], ['red', 'rouge'], ['blue', 'bleue'], ['yellow', 'jaune'],
  ['green', 'verte'], ['black', 'noire'], ['orange', 'orange'], ['pink', 'rose']]) {
  def(`wool_${n}`, { label: `Laine ${label}`, tex: `wool_${n}`, hardness: 0.8, tool: 'shears', sound: 'wool', fuel: 100 });
}

def('bed', {
  label: 'Lit', hardness: 0.2, sound: 'wool', facing: true, solid: true, opaque: false, opacity: 0,
  tex: { top: 'bed_top', bottom: 'oak_planks', side: 'bed_side' },
});

/* ─────────────── Blocs des biomes ajoutés (jungle, savane, marais, badlands) ───────────────
   Déclarés à la fin pour que les identifiants existants ne bougent pas : un
   monde sauvegardé avant leur arrivée continue d'afficher les bons blocs. */

for (const [n, label] of [['jungle', 'acajou'], ['acacia', 'acacia']]) {
  def(`${n}_log`, {
    label: `Tronc d'${label}`, hardness: 2, tool: 'axe', sound: 'wood', fuel: 300,
    tex: { top: `${n}_log_top`, bottom: `${n}_log_top`, side: `${n}_log_side` },
  });
  def(`${n}_planks`, { label: `Planches d'${label}`, tex: `${n}_planks`, hardness: 2, tool: 'axe', sound: 'wood', fuel: 300 });
  def(`${n}_leaves`, {
    label: `Feuilles d'${label}`, tex: `${n}_leaves`, hardness: 0.2, sound: 'grass',
    opaque: false, opacity: 1, render: 'cube', solid: true, drop: null,
  });
  def(`${n}_sapling`, {
    label: `Pousse d'${label}`, tex: `${n}_sapling`, render: 'cross', opaque: false, solid: false,
    hardness: 0, sound: 'grass', needsSupport: true, plantOn: ['grass_block', 'dirt', 'coarse_dirt', 'farmland', 'podzol'],
  });
}

def('red_sand', { label: 'Sable rouge', tex: 'red_sand', hardness: 0.5, tool: 'shovel', sound: 'sand', gravity: true });
def('red_sandstone', {
  label: 'Grès rouge', hardness: 0.8, tool: 'pickaxe', tier: 1,
  tex: { top: 'red_sandstone_top', bottom: 'red_sandstone_bottom', side: 'red_sandstone_side' },
});
def('terracotta', { label: 'Terre cuite', tex: 'terracotta', hardness: 1.25, tool: 'pickaxe', tier: 1 });
def('terracotta_orange', { label: 'Terre cuite orange', tex: 'terracotta_orange', hardness: 1.25, tool: 'pickaxe', tier: 1 });
def('terracotta_white', { label: 'Terre cuite blanche', tex: 'terracotta_white', hardness: 1.25, tool: 'pickaxe', tier: 1 });
def('terracotta_yellow', { label: 'Terre cuite jaune', tex: 'terracotta_yellow', hardness: 1.25, tool: 'pickaxe', tier: 1 });

def('podzol', {
  label: 'Podzol', hardness: 0.5, tool: 'shovel', sound: 'gravel', drop: 'dirt',
  tex: { top: 'podzol_top', bottom: 'dirt', side: 'podzol_side' },
});

def('vine', {
  label: 'Liane', tex: 'vine', render: 'flat', opaque: false, solid: false, climbable: true,
  hardness: 0.2, tool: 'shears', sound: 'grass', tint: 'foliage', facing: true,
  drop: null, replaceable: true,
});

def('sugar_cane', {
  label: 'Canne à sucre', tex: 'sugar_cane', render: 'cross', opaque: false, solid: false,
  hardness: 0, sound: 'grass', needsSupport: true, growable: true,
  plantOn: ['sand', 'red_sand', 'dirt', 'grass_block', 'podzol'],
});

/* ─────────────────────────── Aides de gameplay ─────────────────────────── */

export const TIER_OF = { none: 0, wood: 1, gold: 1, stone: 2, iron: 3, diamond: 4 };

/**
 * Durée de cassage d'un bloc, en secondes (formule de Minecraft).
 * @param {object} bl bloc visé
 * @param {{tool:string|null, tier:string|null, speed:number}|null} tool outil en main
 */
export function breakTime(bl, tool) {
  if (bl.hardness < 0) return Infinity;
  if (bl.hardness === 0) return 0;
  const good = !!tool && tool.tool === bl.tool;
  const speed = good ? tool.speed : 1;
  const can = canHarvest(bl, tool);
  const damage = (speed / bl.hardness) / (can ? 30 : 100);
  return Math.max(0.05, 1 / Math.max(0.0001, damage) / 20);
}

/** Le bloc lâche-t-il quelque chose avec cet outil ? */
export function canHarvest(bl, tool) {
  if (!bl.tool || bl.tier === 0) return true;
  if (!tool || tool.tool !== bl.tool) return false;
  return (TIER_OF[tool.tier] ?? 0) >= bl.tier;
}

/**
 * Objets lâchés par un bloc cassé.
 * @returns {Array<{item:string,count:number}>}
 */
export function blockDrops(bl, tool, rng = Math.random, data = 0) {
  if (!canHarvest(bl, tool)) return [];
  const out = [];
  const push = (item, count = 1) => { if (item && count > 0) out.push({ item, count }); };
  let spec = bl.drop;
  if (bl.name === 'wheat') {
    const mature = data >= 7;
    push('wheat_seeds', mature ? 1 + Math.floor(rng() * 3) : 1);
    if (mature) push('wheat_item', 1);
    return out;
  }
  if (bl.name === 'vine') {
    if (tool && tool.tool === 'shears') push('vine', 1);
    return out;
  }
  if (bl.name.endsWith('_leaves')) {
    const kind = bl.name.replace('_leaves', '');
    if (tool && tool.tool === 'shears') { push(bl.name, 1); return out; }
    if (rng() < 0.05) push(`${kind}_sapling`, 1);
    if (kind === 'oak' && rng() < 0.005) push('apple', 1);
    return out;
  }
  if (bl.name === 'gravel') {
    if (rng() < 0.1) push('flint', 1); else push('gravel', 1);
    return out;
  }
  if (bl.name === 'clay') { push('clay_ball', 4); return out; }
  if (bl.name === 'snow_block') { push('snow_block', 1); return out; }
  if (spec === null || spec === undefined) return out;
  if (typeof spec === 'string') { push(spec, 1); return out; }
  if (Array.isArray(spec)) { for (const s of spec) push(s.item, s.count ?? 1); return out; }
  if (typeof spec === 'object') {
    if (spec.chance !== undefined && rng() > spec.chance) return out;
    const min = spec.min ?? 1, max = spec.max ?? min;
    push(spec.item, min + Math.floor(rng() * (max - min + 1)));
  }
  return out;
}

/** Blocs pouvant être remplacés par une pose (herbe, eau, air…). */
export function isReplaceable(id) { return BLOCKS[id].replaceable; }
export function isOpaque(id) { return BLOCKS[id].opaque; }
export function isSolid(id) { return BLOCKS[id].solid; }
export function isFluid(id) { return BLOCKS[id].fluid !== null; }

export const AIR = 0;
export const WATER = idByName('water');
export const LAVA = idByName('lava');
