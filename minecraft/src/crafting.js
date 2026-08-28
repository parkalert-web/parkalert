/**
 * Minecraft JS — recettes d'artisanat et de cuisson.
 *
 * Une recette « façonnée » (shaped) impose la disposition des ingrédients dans
 * la grille ; une recette « informe » (shapeless) se contente des quantités.
 * Le motif est comparé à toutes les positions possibles de la grille, comme
 * dans le jeu original : une table 3×3 accepte donc une recette 2×2 n'importe où.
 */

import { stack } from './items.js';

export const RECIPES = [];

const WOODS = ['oak', 'birch', 'spruce', 'jungle', 'acacia'];
const ANY_PLANKS = WOODS.map((w) => `${w}_planks`);
const ANY_LOG = WOODS.map((w) => `${w}_log`);

/**
 * @param {string} result nom de l'objet produit
 * @param {number} count quantité produite
 * @param {string[]} pattern lignes du motif ('#' etc., ' ' = vide)
 * @param {Object<string,string|string[]>} key correspondance caractère → ingrédient
 */
function shaped(result, count, pattern, key) {
  const rows = pattern.length;
  const cols = Math.max(...pattern.map((r) => r.length));
  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ch = pattern[y][x] ?? ' ';
      cells.push(ch === ' ' ? null : key[ch]);
    }
  }
  RECIPES.push({ type: 'shaped', result, count, rows, cols, cells });
}

function shapeless(result, count, ingredients) {
  RECIPES.push({ type: 'shapeless', result, count, ingredients });
}

const accepts = (spec, name) => (Array.isArray(spec) ? spec.includes(name) : spec === name);

/* ────────────────────────────── Bois et base ────────────────────────────── */

for (const w of WOODS) {
  shapeless(`${w}_planks`, 4, [`${w}_log`]);
}
shaped('stick', 4, ['#', '#'], { '#': ANY_PLANKS });
shaped('crafting_table', 1, ['##', '##'], { '#': ANY_PLANKS });
shaped('chest', 1, ['###', '# #', '###'], { '#': ANY_PLANKS });
shaped('furnace', 1, ['###', '# #', '###'], { '#': ['cobblestone', 'stone'] });
shaped('torch', 4, ['C', 'S'], { C: ['coal', 'charcoal'], S: 'stick' });
shaped('ladder', 3, ['# #', '###', '# #'], { '#': 'stick' });
shaped('bookshelf', 1, ['###', 'LLL', '###'], { '#': ANY_PLANKS, L: 'leather' });
shaped('bed', 1, ['WWW', 'PPP'], { W: ['wool_white', 'wool_red', 'wool_blue', 'wool_yellow', 'wool_green', 'wool_black', 'wool_orange', 'wool_pink'], P: ANY_PLANKS });
shaped('tnt', 1, ['GSG', 'SGS', 'GSG'], { G: 'gunpowder', S: 'sand' });
shaped('wool_white', 1, ['##', '##'], { '#': 'string' });

/* ─────────────────────────── Blocs compactés ─────────────────────────── */

const COMPACT = [
  ['iron_ingot', 'iron_block'], ['gold_ingot', 'gold_block'], ['diamond', 'diamond_block'],
  ['emerald', 'emerald_block'], ['lapis_lazuli', 'lapis_block'], ['coal', 'coal_block'],
];
for (const [mat, blockName] of COMPACT) {
  shaped(blockName, 1, ['###', '###', '###'], { '#': mat });
  shapeless(mat, 9, [blockName]);
}

shaped('stone_bricks', 4, ['##', '##'], { '#': 'stone' });
shaped('sandstone', 1, ['##', '##'], { '#': 'sand' });
shaped('red_sandstone', 1, ['##', '##'], { '#': 'red_sand' });
shaped('brick', 1, ['##', '##'], { '#': 'brick_item' });
shaped('glowstone', 1, ['##', '##'], { '#': 'gold_ingot' });

/* ──────────────────────────────── Outils ──────────────────────────────── */

const TOOL_MATERIALS = {
  wood: ANY_PLANKS,
  stone: ['cobblestone', 'stone'],
  iron: 'iron_ingot',
  gold: 'gold_ingot',
  diamond: 'diamond',
};

for (const [tier, mat] of Object.entries(TOOL_MATERIALS)) {
  const key = { '#': mat, S: 'stick' };
  shaped(`${tier}_pickaxe`, 1, ['###', ' S ', ' S '], key);
  shaped(`${tier}_axe`, 1, ['##', '#S', ' S'], key);
  shaped(`${tier}_shovel`, 1, ['#', 'S', 'S'], key);
  shaped(`${tier}_sword`, 1, ['#', '#', 'S'], key);
  shaped(`${tier}_hoe`, 1, ['##', ' S', ' S'], key);
}

const ARMOR_MATERIALS = { leather: 'leather', iron: 'iron_ingot', gold: 'gold_ingot', diamond: 'diamond' };
for (const [tier, mat] of Object.entries(ARMOR_MATERIALS)) {
  const key = { '#': mat };
  shaped(`${tier}_helmet`, 1, ['###', '# #'], key);
  shaped(`${tier}_chestplate`, 1, ['# #', '###', '###'], key);
  shaped(`${tier}_leggings`, 1, ['###', '# #', '# #'], key);
  shaped(`${tier}_boots`, 1, ['# #', '# #'], key);
}

shaped('shears', 1, [' #', '# '], { '#': 'iron_ingot' });
shaped('bucket', 1, ['# #', ' # '], { '#': 'iron_ingot' });
shaped('bow', 1, [' #S', '# S', ' #S'], { '#': 'stick', S: 'string' });
shaped('arrow', 4, ['F', 'S', 'P'], { F: 'flint', S: 'stick', P: 'feather' });

/* ────────────────────────────── Nourriture ────────────────────────────── */

shaped('bread', 1, ['###'], { '#': 'wheat_item' });
shaped('golden_apple', 1, ['###', '#A#', '###'], { '#': 'gold_ingot', A: 'apple' });

/* ─────────────────────────── Recherche de recette ─────────────────────────── */

/**
 * Cherche la recette correspondant au contenu d'une grille d'artisanat.
 * @param {(object|null)[]} grid piles, ligne par ligne
 * @param {number} size côté de la grille (2 ou 3)
 * @returns {{result:object, recipe:object}|null}
 */
export function findRecipe(grid, size) {
  const names = grid.map((s) => (s ? s.item : null));
  for (const r of RECIPES) {
    if (r.type === 'shaped') {
      if (r.rows > size || r.cols > size) continue;
      for (let oy = 0; oy + r.rows <= size; oy++) {
        for (let ox = 0; ox + r.cols <= size; ox++) {
          if (matchAt(names, size, r, ox, oy)) {
            return { result: stack(r.result, r.count), recipe: r };
          }
        }
      }
    } else {
      const need = [...r.ingredients];
      const have = names.filter(Boolean);
      if (have.length !== need.length) continue;
      const pool = [...have];
      let ok = true;
      for (const spec of need) {
        const i = pool.findIndex((n) => accepts(spec, n));
        if (i < 0) { ok = false; break; }
        pool.splice(i, 1);
      }
      if (ok) return { result: stack(r.result, r.count), recipe: r };
    }
  }
  return null;
}

function matchAt(names, size, r, ox, oy) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inside = x >= ox && x < ox + r.cols && y >= oy && y < oy + r.rows;
      const spec = inside ? r.cells[(y - oy) * r.cols + (x - ox)] : null;
      const got = names[y * size + x];
      if (!spec) { if (got) return false; continue; }
      if (!got || !accepts(spec, got)) return false;
    }
  }
  return true;
}

/* ─────────────────────────────── Fourneau ─────────────────────────────── */

export const SMELTING = {
  iron_ore: 'iron_ingot',
  gold_ore: 'gold_ingot',
  sand: 'glass',
  cobblestone: 'stone',
  stone: 'stone_bricks',
  clay_ball: 'brick_item',
  clay: 'brick_item',
  porkchop: 'cooked_porkchop',
  beef: 'cooked_beef',
  chicken: 'cooked_chicken',
  mutton: 'cooked_mutton',
  oak_log: 'charcoal',
  birch_log: 'charcoal',
  spruce_log: 'charcoal',
  wheat_seeds: null,
};

export function smeltResult(name) {
  const out = SMELTING[name];
  return out ? stack(out, 1) : null;
}

/** Toutes les recettes produisant un objet donné (pour le livre des recettes). */
export function recipesFor(name) {
  return RECIPES.filter((r) => r.result === name);
}
