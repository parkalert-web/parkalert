/**
 * Minecraft JS — tests de la logique de jeu (sans navigateur).
 *   node --test minecraft/tests/game.test.mjs
 *
 * On y vérifie ce qui doit rester vrai quelles que soient les retouches
 * d'affichage : reproductibilité du monde, règles d'artisanat, minage,
 * lumière, collisions, écoulement des fluides et cuisson.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Noise, mulberry32 } from '../src/noise.js';
import { WorldGen, BIOMES } from '../src/worldgen.js';
import { Chunk, idx, WORLD_H, SEA_LEVEL } from '../src/chunk.js';
import { World } from '../src/world.js';
import { BLOCKS, blockByName, idByName, breakTime, canHarvest, blockDrops } from '../src/blocks.js';
import { getItem, stack, maxStackOf, toolStats, ITEMS } from '../src/items.js';
import { findRecipe, smeltResult, RECIPES } from '../src/crafting.js';
import { Inventory, PlayerInventory } from '../src/inventory.js';
import { move, inFluid } from '../src/physics.js';
import { buildChunkMesh } from '../src/mesher.js';
import { buildAtlas, tileNames, T } from '../src/textures.js';
import { chunkDiff, seedFromString } from '../src/save.js';
import { mat4, viewMatrix } from '../src/math.js';
import { spawnCycle } from '../src/entities.js';

/** Monde de test : tronçons générés et éclairés autour de l'origine. */
function makeWorld(seed = 4242, radius = 2) {
  const w = new World({ seed, renderDistance: radius });
  for (let i = 0; i < 60; i++) w.updateChunks(0, 0, { gen: 6, populate: 6, light: 400000 });
  return w;
}

/* ─────────────────────────── Génération ─────────────────────────── */

test('le monde est reproductible à graine égale', () => {
  const a = new Chunk(3, -2);
  const b = new Chunk(3, -2);
  new WorldGen(777).generate(a);
  new WorldGen(777).generate(b);
  assert.deepEqual([...a.blocks], [...b.blocks], 'deux générations avec la même graine diffèrent');

  const c = new Chunk(3, -2);
  new WorldGen(778).generate(c);
  assert.notDeepEqual([...a.blocks], [...c.blocks], 'deux graines différentes donnent le même monde');
});

test('le relief contient de la roche, de la terre et une surface cohérente', () => {
  const g = new WorldGen(12345);
  const c = new Chunk(0, 0);
  g.generate(c);
  const counts = {};
  for (const id of c.blocks) if (id) counts[BLOCKS[id].name] = (counts[BLOCKS[id].name] || 0) + 1;
  assert.ok(counts.stone > 5000, 'pas assez de pierre');
  assert.ok(counts.bedrock > 200, 'pas de socle indestructible');
  // Sous chaque colonne de surface il y a du solide, jamais du vide flottant.
  for (let x = 0; x < 16; x += 5) {
    for (let z = 0; z < 16; z += 5) {
      const col = g.column(x, z);
      if (col.h <= SEA_LEVEL) continue;
      assert.ok(BLOCKS[c.blocks[idx(x, col.h, z)]].solid, 'la surface n’est pas solide');
      assert.equal(c.blocks[idx(x, col.h + 1, z)], 0, 'un bloc flotte au-dessus de la surface');
    }
  }
});

test('tous les biomes apparaissent sur une grande carte', () => {
  const g = new WorldGen(12345);
  const vus = new Set();
  for (let x = -3000; x < 3000; x += 47) {
    for (let z = -3000; z < 3000; z += 47) vus.add(BIOMES[g.column(x, z).biome].name);
  }
  for (const b of BIOMES) assert.ok(vus.has(b.name), `biome absent : ${b.name}`);
});

test('les minerais sont plus profonds quand ils sont plus rares', () => {
  const g = new WorldGen(31337);
  const prof = { coal_ore: [], iron_ore: [], diamond_ore: [] };
  for (let cx = 0; cx < 6; cx++) {
    for (let cz = 0; cz < 6; cz++) {
      const c = new Chunk(cx, cz);
      g.generate(c);
      for (let i = 0; i < c.blocks.length; i++) {
        const n = BLOCKS[c.blocks[i]].name;
        if (prof[n]) prof[n].push(i >> 8);
      }
    }
  }
  const moy = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  assert.ok(prof.diamond_ore.length > 0, 'aucun diamant généré');
  assert.ok(moy(prof.diamond_ore) < moy(prof.iron_ore), 'le diamant n’est pas plus profond que le fer');
  assert.ok(moy(prof.iron_ore) < moy(prof.coal_ore), 'le fer n’est pas plus profond que le charbon');
  assert.ok(prof.coal_ore.length > prof.diamond_ore.length * 5, 'le diamant n’est pas assez rare');
});

/* ─────────────────────────── Minage ─────────────────────────── */

test('les durées de cassage suivent la formule du jeu', () => {
  const pierre = blockByName('stone');
  const bois = { tool: 'pickaxe', tier: 'wood', speed: 2 };
  const diamant = { tool: 'pickaxe', tier: 'diamond', speed: 8 };
  assert.ok(Math.abs(breakTime(pierre, null) - 7.5) < 0.1, 'pierre à la main ≈ 7,5 s');
  assert.ok(Math.abs(breakTime(pierre, bois) - 1.15) < 0.1, 'pierre à la pioche en bois ≈ 1,15 s');
  assert.ok(Math.abs(breakTime(pierre, diamant) - 0.3) < 0.06, 'pierre à la pioche en diamant ≈ 0,3 s');
  assert.equal(breakTime(blockByName('bedrock'), diamant), Infinity, 'le socle doit être incassable');
});

test('le palier d’outil décide de ce que le bloc lâche', () => {
  const diamant = blockByName('diamond_ore');
  assert.equal(canHarvest(diamant, { tool: 'pickaxe', tier: 'stone', speed: 4 }), false);
  assert.equal(canHarvest(diamant, { tool: 'pickaxe', tier: 'iron', speed: 6 }), true);
  assert.deepEqual(blockDrops(diamant, { tool: 'pickaxe', tier: 'iron', speed: 6 }), [{ item: 'diamond', count: 1 }]);
  assert.deepEqual(blockDrops(diamant, null), [], 'à la main, le minerai ne doit rien lâcher');
  assert.deepEqual(blockDrops(blockByName('grass_block'), null), [{ item: 'dirt', count: 1 }]);
});

test('le blé ne donne du grain qu’une fois mûr', () => {
  const ble = blockByName('wheat');
  const jeune = blockDrops(ble, null, () => 0.5, 2);
  const mur = blockDrops(ble, null, () => 0.5, 7);
  assert.ok(!jeune.some((d) => d.item === 'wheat_item'), 'du blé récolté trop tôt');
  assert.ok(mur.some((d) => d.item === 'wheat_item'), 'le blé mûr ne donne pas de grain');
});

/* ─────────────────────────── Artisanat ─────────────────────────── */

test('les recettes façonnées respectent la disposition', () => {
  const g = new Array(9).fill(null);
  g[0] = stack('cobblestone'); g[1] = stack('cobblestone'); g[2] = stack('cobblestone');
  g[4] = stack('stick'); g[7] = stack('stick');
  assert.equal(findRecipe(g, 3).result.item, 'stone_pickaxe');

  // Motif décalé vers le bas : toujours valide (comme dans le jeu).
  const g2 = new Array(9).fill(null);
  g2[3] = stack('cobblestone'); g2[4] = stack('cobblestone'); g2[5] = stack('cobblestone');
  g2[7] = stack('stick');
  assert.equal(findRecipe(g2, 3), null, 'une pioche incomplète a été acceptée');

  // Motif faux : rien ne sort.
  const g3 = new Array(9).fill(null);
  g3[0] = stack('stick'); g3[1] = stack('cobblestone');
  assert.equal(findRecipe(g3, 3), null);
});

test('les recettes informes acceptent n’importe quelle case', () => {
  for (const bois of ['oak_log', 'birch_log', 'spruce_log']) {
    const g = [null, null, stack(bois), null];
    const r = findRecipe(g, 2);
    assert.equal(r.result.item, `${bois.replace('_log', '')}_planks`);
    assert.equal(r.result.count, 4);
  }
});

test('les recettes clés du jeu existent toutes', () => {
  const attendus = ['crafting_table', 'furnace', 'chest', 'torch', 'stick', 'bread', 'bed',
    'wood_pickaxe', 'stone_axe', 'iron_shovel', 'diamond_sword', 'gold_hoe',
    'iron_helmet', 'diamond_chestplate', 'leather_boots', 'bow', 'arrow', 'shears', 'bucket', 'tnt'];
  for (const a of attendus) {
    assert.ok(RECIPES.some((r) => r.result === a), `recette manquante : ${a}`);
  }
});

test('la cuisson transforme les bonnes matières', () => {
  assert.equal(smeltResult('iron_ore').item, 'iron_ingot');
  assert.equal(smeltResult('sand').item, 'glass');
  assert.equal(smeltResult('porkchop').item, 'cooked_porkchop');
  assert.equal(smeltResult('oak_log').item, 'charcoal');
  assert.equal(smeltResult('diamond'), null);
});

/* ─────────────────────────── Inventaire ─────────────────────────── */

test('les piles se complètent avant d’occuper un nouvel emplacement', () => {
  const inv = new Inventory(5);
  inv.add(stack('stone', 60));
  inv.add(stack('stone', 10));
  assert.equal(inv.get(0).count, 64);
  assert.equal(inv.get(1).count, 6);
  assert.equal(inv.count('stone'), 70);

  const reste = new Inventory(1).add(stack('dirt', 100));
  assert.equal(reste.count, 36, 'le surplus doit être rendu');
});

test('les outils ne s’empilent pas et s’usent', () => {
  const inv = new PlayerInventory();
  inv.add(stack('iron_pickaxe'));
  inv.add(stack('iron_pickaxe'));
  assert.equal(inv.get(0).count, 1);
  assert.equal(inv.get(1).count, 1);
  inv.selected = 0;
  const durabilite = getItem('iron_pickaxe').durability;
  for (let i = 0; i < durabilite - 1; i++) inv.damageHeld(1);
  assert.ok(inv.held, 'la pioche a cassé trop tôt');
  inv.damageHeld(1);
  assert.equal(inv.held, null, 'la pioche aurait dû casser');
});

test('l’armure protège selon ses points', () => {
  const inv = new PlayerInventory();
  assert.equal(inv.defense, 0);
  inv.armor[0] = stack('diamond_helmet');
  inv.armor[1] = stack('diamond_chestplate');
  inv.armor[2] = stack('diamond_leggings');
  inv.armor[3] = stack('diamond_boots');
  assert.equal(inv.defense, 20, 'une panoplie de diamant vaut 20 points');
});

/* ─────────────────────────── Lumière ─────────────────────────── */

test('la lumière du ciel descend jusqu’au sol et s’arrête dessous', () => {
  const w = makeWorld(4242, 2);
  const y = w.topSolidY(0, 0);
  assert.equal(w.getSkyLight(0, y, 0), 15, 'le ciel n’éclaire pas la surface');
  assert.equal(w.getSkyLight(0, y - 4, 0), 0, 'la lumière traverse la roche');
});

test('une torche éclaire son voisinage en décroissant', () => {
  const w = makeWorld(4242, 2);
  const y = w.topSolidY(3, 3);
  w.setBlock(3, y, 3, idByName('torch'));
  w.light.update(0);
  assert.equal(w.getBlockLight(3, y, 3), 14);
  assert.equal(w.getBlockLight(6, y, 3), 11, 'la lumière ne décroît pas d’un niveau par bloc');
  assert.equal(w.getBlockLight(20, y, 3), 0, 'la lumière porte trop loin');

  // En retirant la torche, l'obscurité revient.
  w.setBlock(3, y, 3, 0);
  w.light.update(0);
  assert.equal(w.getBlockLight(6, y, 3), 0, 'la lumière persiste après le retrait de la torche');
});

test('poser un bloc opaque projette une ombre sous lui', () => {
  const w = makeWorld(4242, 2);
  const y = w.topSolidY(6, 6);
  for (let k = 0; k < 3; k++) w.setBlock(6, y + k, 6, 0);
  w.light.update(0);
  assert.equal(w.getSkyLight(6, y, 6), 15);
  w.setBlock(6, y + 2, 6, idByName('stone'));
  w.light.update(0);
  assert.ok(w.getSkyLight(6, y, 6) < 15, 'aucune ombre sous le bloc posé');
});

/* ─────────────────────────── Physique ─────────────────────────── */

test('un corps tombe, atterrit et ne traverse pas le sol', () => {
  const w = makeWorld(4242, 2);
  const stone = idByName('stone');
  for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) {
    w.setBlock(x, 70, z, stone);
    for (let k = 1; k < 6; k++) w.setBlock(x, 70 + k, z, 0);
  }
  const e = { x: 3.5, y: 95, z: 3.5, width: 0.6, height: 1.8 };
  let vy = 0, pose = false;
  for (let i = 0; i < 400; i++) {
    vy = Math.max(-40, vy - 28 / 60);
    if (move(w, e, 0, vy / 60, 0).ground) { pose = true; break; }
  }
  assert.ok(pose, 'le corps a traversé le sol');
  assert.ok(Math.abs(e.y - 71) < 0.01, `atterrissage à ${e.y} au lieu de 71`);
});

test('un mur arrête le déplacement mais laisse glisser le long', () => {
  const w = makeWorld(4242, 2);
  const stone = idByName('stone');
  for (let x = 0; x < 12; x++) for (let z = 0; z < 12; z++) {
    w.setBlock(x, 70, z, stone);
    for (let k = 1; k < 5; k++) w.setBlock(x, 70 + k, z, 0);
  }
  for (let k = 1; k < 4; k++) for (let z = 0; z < 12; z++) w.setBlock(8, 70 + k, z, stone);
  const e = { x: 5.5, y: 71, z: 5.5, width: 0.6, height: 1.8 };
  for (let i = 0; i < 30; i++) move(w, e, 0.3, 0, 0);
  assert.ok(Math.abs(e.x - 7.7) < 0.02, `arrêté à x=${e.x} au lieu de 7,7`);
  const z0 = e.z;
  move(w, e, 0.3, 0, 0.4);
  assert.ok(e.z > z0 + 0.3, 'le glissement le long du mur est bloqué');
});

/* ─────────────────────────── Monde vivant ─────────────────────────── */

test('l’eau s’écoule puis se tarit quand la source disparaît', () => {
  const w = makeWorld(4242, 2);
  const stone = idByName('stone'), water = idByName('water');
  for (let x = 0; x < 12; x++) for (let z = 0; z < 12; z++) {
    w.setBlock(x, 70, z, stone);
    for (let k = 1; k < 5; k++) w.setBlock(x, 70 + k, z, 0);
  }
  w.setBlock(5, 71, 5, water, 0);
  const joueur = { x: 5, y: 71, z: 5 };
  for (let i = 0; i < 200; i++) w.tick(joueur);
  let n = 0;
  for (let x = 0; x < 12; x++) for (let z = 0; z < 12; z++) if (w.getBlock(x, 71, z) === water) n++;
  assert.ok(n > 8, `l’eau ne s’est pas répandue (${n} blocs)`);

  w.setBlock(5, 71, 5, 0);
  for (let i = 0; i < 400; i++) w.tick(joueur);
  let reste = 0;
  for (let x = 0; x < 12; x++) for (let z = 0; z < 12; z++) if (w.getBlock(x, 71, z) === water) reste++;
  assert.equal(reste, 0, `${reste} blocs d’eau subsistent sans source`);
});

test('le sable tombe quand on retire son support', () => {
  const w = makeWorld(4242, 2);
  const sand = idByName('sand'), stone = idByName('stone');
  for (let k = 0; k < 6; k++) w.setBlock(4, 70 + k, 4, 0);
  w.setBlock(4, 70, 4, stone);
  w.setBlock(4, 74, 4, sand);
  const joueur = { x: 4, y: 71, z: 4 };
  for (let i = 0; i < 30; i++) w.tick(joueur);
  assert.equal(w.getBlock(4, 74, 4), 0, 'le sable est resté en l’air');
  assert.equal(w.getBlock(4, 71, 4), sand, 'le sable n’est pas tombé sur la pierre');
});

test('le four consomme du combustible et produit un lingot', () => {
  const w = makeWorld(4242, 2);
  w.smeltFn = smeltResult;
  w.fuelFn = (n) => (getItem(n) ? getItem(n).fuel : 0);
  const y = w.topSolidY(2, 2);
  w.setBlock(2, y, 2, idByName('furnace'), 0);
  const e = w.getBlockEntity(2, y, 2, 'furnace');
  e.input = stack('iron_ore', 3);
  e.fuel = stack('coal', 1);
  for (let i = 0; i < 210; i++) w.tickFurnace(e, 2, y, 2);
  assert.equal(e.output.item, 'iron_ingot');
  assert.equal(e.output.count, 1);
  assert.equal(e.input.count, 2);
  assert.equal(e.fuel, null, 'le charbon n’a pas été consommé');
  assert.ok(e.burn > 0, 'le four devrait encore brûler');
});

test('le blé pousse sur de la terre labourée éclairée', () => {
  const w = makeWorld(4242, 2);
  const y = w.topSolidY(5, 7);
  w.setBlock(5, y - 1, 7, idByName('farmland'), 7);
  w.setBlock(5, y, 7, idByName('wheat'), 0);
  w.light.update(0);
  const c = w.chunkOf(5, 7);
  for (let i = 0; i < 4000 && w.getData(5, y, 7) < 7; i++) w.randomTick(c, 5, y, 7);
  assert.equal(w.getData(5, y, 7), 7, 'le blé n’a jamais mûri');
});

/* ─────────────────────────── Rendu (données) ─────────────────────────── */

test('l’atlas contient toutes les tuiles utilisées par les blocs et objets', () => {
  const atlas = buildAtlas();
  assert.ok(atlas.layers >= 150, 'atlas trop petit');
  assert.ok(atlas.layers <= 256, 'un tableau de textures dépasse 256 couches');
  assert.equal(atlas.data.length, atlas.layers * 16 * 16 * 4);
  assert.equal(atlas.anims.length, 2, 'l’eau et la lave doivent être animées');
  for (const bl of BLOCKS) {
    if (!bl.tiles) continue;
    for (const t of bl.tiles) assert.ok(t >= 0 && t < atlas.layers, `tuile invalide pour ${bl.name}`);
  }
});

test('le maillage ne garde que les faces visibles', () => {
  const w = makeWorld(4242, 2);
  const c = w.chunkAt(0, 0);
  const m = buildChunkMesh(w, c);
  assert.ok(m.opaque && m.opaque.count > 0, 'aucun quadrilatère produit');
  const quads = m.opaque.count / 6;
  // 16×16×128 = 32 768 voxels : sans élagage il y aurait ~200 000 faces.
  assert.ok(quads < 20000, `trop de faces émises (${quads})`);
  assert.equal(m.opaque.p0.length % 4, 0, 'les sommets ne forment pas des quadrilatères');

  // Une caisse pleine de pierre entourée de pierre n'émet rien à l'intérieur.
  const vide = new Chunk(50, 50);
  const stone = idByName('stone');
  vide.blocks.fill(stone);
  vide.generated = vide.populated = vide.lit = true;
  const w2 = new World({ seed: 1 });
  w2.chunks.set(0, vide);
  const m2 = buildChunkMesh(w2, vide);
  const q2 = m2.opaque ? m2.opaque.count / 6 : 0;
  assert.ok(q2 <= 16 * 16 * 2 + 128 * 16 * 4, `faces internes émises (${q2})`);
});

/* ─────────────────────────── Sauvegarde ─────────────────────────── */

test('la sauvegarde ne retient que les différences', () => {
  const gen = new WorldGen(555);
  const c = new Chunk(1, 1);
  gen.generate(c);
  gen.populate(null, c);
  assert.equal(chunkDiff(c, gen), null, 'un tronçon intact ne devrait rien coûter');

  c.blocks[idx(3, 70, 3)] = idByName('diamond_block');
  const diff = chunkDiff(c, gen);
  assert.ok(diff && diff.edits.length >= 1, 'la modification n’est pas détectée');
  assert.ok(diff.edits.length < 50, 'trop de différences pour un seul bloc changé');
});

test('une graine textuelle donne toujours le même nombre', () => {
  assert.equal(seedFromString('bonjour'), seedFromString('bonjour'));
  assert.equal(seedFromString('12345'), 12345);
  assert.notEqual(seedFromString('a'), seedFromString('b'));
});

/* ─────────────────────────── Cohérence du contenu ─────────────────────────── */

test('chaque bloc posable a son objet, et chaque objet une tuile valide', () => {
  const noms = new Set(tileNames());
  for (const bl of BLOCKS) {
    if (!bl.item || bl.name === 'air') continue;
    assert.ok(getItem(bl.name), `objet manquant pour le bloc ${bl.name}`);
  }
  for (const it of Object.values(ITEMS)) {
    assert.ok(it.tile >= 0 && it.tile < noms.size, `tuile invalide pour ${it.name}`);
    assert.ok(it.maxStack >= 1 && it.maxStack <= 64);
  }
});

test('les recettes ne fabriquent que des objets existants', () => {
  for (const r of RECIPES) {
    assert.ok(getItem(r.result), `recette vers un objet inconnu : ${r.result}`);
    const ingredients = r.type === 'shaped' ? r.cells.filter(Boolean) : r.ingredients;
    for (const spec of ingredients) {
      for (const n of [].concat(spec)) assert.ok(getItem(n), `ingrédient inconnu : ${n}`);
    }
  }
});

/* ─────────────────── Caméra, commandes et nage ─────────────────── */

test('la caméra regarde exactement où vise le joueur', () => {
  // Ce test garde le bug le plus coûteux du projet : la matrice de vue et le
  // vecteur de visée s'étaient retrouvés opposés, si bien que le viseur
  // désignait un bloc dans le dos du joueur — impossible de casser ni de poser.
  const m = mat4();
  for (const yaw of [0, 0.7, Math.PI / 2, Math.PI, 4.2, 6.0]) {
    for (const pitch of [-1.2, -0.3, 0, 0.4, 1.2]) {
      viewMatrix(m, 0, 0, 0, yaw, pitch);
      // L'avant de la caméra est l'opposé de sa troisième ligne.
      const cam = [-m[2], -m[6], -m[10]];
      const cp = Math.cos(pitch);
      const visee = [-Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
      for (let i = 0; i < 3; i++) {
        assert.ok(Math.abs(cam[i] - visee[i]) < 1e-6,
          `yaw ${yaw} pitch ${pitch} : la caméra regarde ${cam.map((v) => v.toFixed(2))} `
          + `alors que le viseur pointe ${visee.map((v) => v.toFixed(2))}`);
      }
    }
  }
});

test('la matrice de vue reste directe (image non miroir)', () => {
  const m = viewMatrix(mat4(), 3, 4, 5, 1.1, 0.3);
  const r = [m[0], m[4], m[8]];   // droite
  const u = [m[1], m[5], m[9]];   // haut
  const b = [m[2], m[6], m[10]];  // arrière
  const cross = [r[1] * u[2] - r[2] * u[1], r[2] * u[0] - r[0] * u[2], r[0] * u[1] - r[1] * u[0]];
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(cross[i] - b[i]) < 1e-6, 'droite × haut doit valoir l’arrière');
  }
});

test('les pieds dans l’eau comptent comme « dans l’eau »', () => {
  const w = makeWorld(4242, 2);
  const stone = idByName('stone'), water = idByName('water');
  for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) {
    for (let k = -3; k < 6; k++) w.setBlock(x, 70 + k, z, k < 0 ? stone : 0);
  }
  for (let x = 2; x < 6; x++) for (let z = 2; z < 6; z++) w.setBlock(x, 70, z, water);
  const e = { x: 3.5, y: 70, z: 3.5, width: 0.6, height: 1.8 };
  assert.equal(inFluid(w, e, 'water'), true, 'un joueur les pieds dans l’eau doit nager');
  e.x = 0.5; e.z = 0.5;
  assert.equal(inFluid(w, e, 'water'), false, 'hors de l’eau, on ne nage pas');
});

/* ─────────────────── Biomes et blocs ajoutés ─────────────────── */

test('les treize biomes existent et ont chacun leur couleur d’herbe', () => {
  assert.equal(BIOMES.length, 13);
  for (const b of BIOMES) {
    assert.ok(Array.isArray(b.grass) && b.grass.length === 3, `${b.name} : teinte d’herbe manquante`);
    assert.ok(b.label && b.label.length > 2, `${b.name} : libellé manquant`);
  }
  for (const n of ['jungle', 'savanna', 'swamp', 'badlands']) {
    assert.ok(BIOMES.some((b) => b.name === n), `biome manquant : ${n}`);
  }
});

test('la jungle, la savane, le marais et les badlands produisent leur décor', () => {
  const g = new WorldGen(12345);
  const attendus = {
    jungle: ['jungle_log', 'jungle_leaves', 'vine'],
    savanna: ['acacia_log', 'acacia_leaves'],
    swamp: ['water', 'oak_log'],
    badlands: ['terracotta', 'red_sand'],
  };
  // Un tronçon représentatif de chaque biome, cherché autour de l'origine.
  const trouves = {};
  for (let cx = -75; cx < 75 && Object.keys(trouves).length < 4; cx += 2) {
    for (let cz = -75; cz < 75; cz += 2) {
      const nom = BIOMES[g.column(cx * 16 + 8, cz * 16 + 8).biome].name;
      if (attendus[nom] && !trouves[nom]) trouves[nom] = [cx, cz];
    }
  }
  for (const [nom, blocs] of Object.entries(attendus)) {
    assert.ok(trouves[nom], `aucun tronçon de ${nom} trouvé`);
    // Trois tronçons sur trois : un marais peut être noyé, une savane clairsemée.
    const presents = new Set();
    const [cx0, cz0] = trouves[nom];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const c = new Chunk(cx0 + dx, cz0 + dz);
        g.generate(c);
        g.populate(null, c);
        for (const id of c.blocks) if (id) presents.add(BLOCKS[id].name);
      }
    }
    for (const b of blocs) assert.ok(presents.has(b), `${nom} : ${b} absent`);
  }
});

test('les cinq essences de bois se travaillent toutes', () => {
  for (const bois of ['oak', 'birch', 'spruce', 'jungle', 'acacia']) {
    const planches = findRecipe([stack(`${bois}_log`), null, null, null], 2);
    assert.equal(planches.result.item, `${bois}_planks`);
    const g = new Array(9).fill(null);
    g[0] = stack(`${bois}_planks`); g[1] = stack(`${bois}_planks`); g[2] = stack(`${bois}_planks`);
    g[4] = stack('stick'); g[7] = stack('stick');
    assert.equal(findRecipe(g, 3).result.item, 'wood_pickaxe', `${bois} : pioche impossible`);
  }
});

test('les lianes et la canne à sucre se comportent comme des plantes', () => {
  const liane = blockByName('vine');
  assert.equal(liane.solid, false, 'on traverse les lianes');
  assert.equal(liane.climbable, true, 'on grimpe aux lianes');
  assert.deepEqual(blockDrops(liane, { tool: 'shears', tier: 'iron', speed: 5 }), [{ item: 'vine', count: 1 }]);
  assert.deepEqual(blockDrops(liane, null), [], 'sans cisailles, la liane ne lâche rien');

  const canne = blockByName('sugar_cane');
  assert.equal(canne.render, 'cross');
  assert.equal(canne.solid, false);
  assert.ok(canne.plantOn.includes('sand'), 'la canne doit pousser sur le sable');
});

/* ─────────────────────────── Structures ─────────────────────────── */

test('villages, temples, tours et donjons apparaissent dans le monde', () => {
  const g = new WorldGen(12345);
  const compte = { village: 0, temple: 0, tour: 0, donjon: 0 };
  const vus = new Set();
  for (let cx = -40; cx < 40; cx += 1) {
    for (let cz = -40; cz < 40; cz += 1) {
      for (const type of Object.keys(compte)) {
        for (const o of g.origines(type, cx, cz)) {
          const cle = `${type}:${o.cx},${o.cz}`;
          if (vus.has(cle)) continue;
          vus.add(cle);
          compte[type]++;
        }
      }
    }
  }
  for (const [type, n] of Object.entries(compte)) {
    assert.ok(n > 0, `aucune origine de ${type} sur 80×80 tronçons`);
  }
  // Un donjon est fréquent, un village rare : c'est ce qui rend la trouvaille bonne.
  assert.ok(compte.donjon > compte.village * 4, 'les villages devraient être bien plus rares que les donjons');
});

test('un village contient maisons, champs, coffres garnis et habitants', () => {
  const g = new WorldGen(12345);
  // Le village connu de cette graine, à l'ouest.
  const [CX, CZ] = [-36, 25];
  const noms = new Set();
  let coffres = 0, villageois = 0, objets = 0;
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      const c = new Chunk(CX + dx, CZ + dz);
      g.generate(c);
      g.populate(null, c);
      for (const id of c.blocks) if (id) noms.add(BLOCKS[id].name);
      for (const [, e] of c.blockEntities) {
        if (e.type !== 'chest') continue;
        coffres++;
        objets += e.slots.filter(Boolean).length;
      }
      villageois += (c.mobs || []).length;
    }
  }
  for (const attendu of ['oak_planks', 'cobblestone', 'farmland', 'wheat', 'glass', 'torch']) {
    assert.ok(noms.has(attendu), `village : ${attendu} absent`);
  }
  assert.ok(coffres >= 1, 'aucun coffre dans le village');
  assert.ok(objets >= coffres, 'les coffres du village sont vides');
  assert.ok(villageois >= 3, `village presque désert (${villageois} habitants)`);
});

test('une structure à cheval sur deux tronçons est dessinée en entier', () => {
  // Le tronçon doit sortir identique qu'on le génère seul ou après ses voisins :
  // c'est la garantie qu'une maison n'est jamais tronquée.
  const g = new WorldGen(12345);
  const seul = new Chunk(-36, 25);
  g.generate(seul);
  g.populate(null, seul);

  const g2 = new WorldGen(12345);
  for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const voisin = new Chunk(-36 + dx, 25 + dz);
    g2.generate(voisin);
    g2.populate(null, voisin);
  }
  const apres = new Chunk(-36, 25);
  g2.generate(apres);
  g2.populate(null, apres);
  assert.deepEqual([...seul.blocks], [...apres.blocks], 'le tronçon dépend de l’ordre de génération');
});

test('le butin des coffres est tiré une fois pour toutes', () => {
  const contenu = (graine) => {
    const g = new WorldGen(graine);
    const c = new Chunk(-36, 25);
    g.generate(c);
    g.populate(null, c);
    return [...c.blockEntities.values()]
      .filter((e) => e.type === 'chest')
      .map((e) => e.slots.map((s) => (s ? `${s.count}×${s.item}` : '.')).join('|'));
  };
  assert.deepEqual(contenu(12345), contenu(12345), 'deux visites donnent des coffres différents');
});

test('aucune créature n’apparaît dans l’eau', () => {
  const w = makeWorld(99, 4);
  w.time = 16000;
  // Bassin large et profond, à la place du terrain.
  const water = idByName('water'), stone = idByName('stone');
  for (let x = -20; x < 20; x++) {
    for (let z = -20; z < 20; z++) {
      for (let y = 60; y < 76; y++) w.setBlock(x, y, z, 0, 0, { noLight: true });
      w.setBlock(x, 59, z, stone, 0, { noLight: true });
      for (let y = 60; y < 68; y++) w.setBlock(x, y, z, water, 0, { noLight: true });
    }
  }
  w.light.update(0);
  const joueur = { x: 0.5, y: 68, z: 0.5, width: 0.6, height: 1.8, dead: false, mode: 'survival' };
  const entities = [];
  const ctx = { world: w, player: joueur, entities, spawn: (e) => entities.push(e) };
  for (let i = 0; i < 300; i++) spawnCycle(ctx);
  let mouillees = 0;
  for (const e of entities) {
    const sous = BLOCKS[w.getBlock(Math.floor(e.x), Math.floor(e.y) - 1, Math.floor(e.z))];
    const dedans = BLOCKS[w.getBlock(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z))];
    if (sous.fluid || dedans.fluid) mouillees++;
  }
  assert.equal(mouillees, 0, `${mouillees} créatures apparues dans l’eau`);
});
