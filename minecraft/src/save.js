/**
 * Minecraft JS — sauvegarde des mondes.
 *
 * Chaque monde garde sa graine et ses réglages ; seuls les tronçons modifiés
 * par le joueur sont stockés, sous forme de liste de différences par rapport
 * au terrain généré. Un monde exploré longuement tient donc dans quelques
 * dizaines de kilo-octets.
 *
 * IndexedDB est utilisé quand il est disponible, avec repli sur localStorage.
 */

import { CX, CZ, WORLD_H, idx, chunkKeyStr } from './chunk.js';
import { Chunk } from './chunk.js';
import { WorldGen } from './worldgen.js';

const DB_NAME = 'minecraft-js';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('IndexedDB indisponible')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('worlds')) db.createObjectStore('worlds', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

class LocalFallback {
  constructor() { this.prefix = 'mcjs:'; }
  async get(store, key) {
    const v = localStorage.getItem(`${this.prefix}${store}:${key}`);
    return v ? JSON.parse(v) : undefined;
  }
  async put(store, key, value) {
    localStorage.setItem(`${this.prefix}${store}:${key}`, JSON.stringify(value));
  }
  async del(store, key) { localStorage.removeItem(`${this.prefix}${store}:${key}`); }
  async keys(store) {
    const out = [];
    const p = `${this.prefix}${store}:`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(p)) out.push(k.slice(p.length));
    }
    return out;
  }
}

class IDB {
  constructor(db) { this.db = db; }
  tx(store, mode) { return this.db.transaction(store, mode).objectStore(store); }
  req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  get(store, key) { return this.req(this.tx(store, 'readonly').get(key)); }
  put(store, key, value) {
    const s = this.tx(store, 'readwrite');
    return this.req(store === 'worlds' ? s.put(value) : s.put(value, key));
  }
  del(store, key) { return this.req(this.tx(store, 'readwrite').delete(key)); }
  keys(store) { return this.req(this.tx(store, 'readonly').getAllKeys()); }
  all(store) { return this.req(this.tx(store, 'readonly').getAll()); }
}

let backend = null;

export async function initStorage() {
  if (backend) return backend;
  try {
    backend = new IDB(await openDB());
  } catch {
    backend = new LocalFallback();
  }
  return backend;
}

/* ────────────────────────── Liste des mondes ────────────────────────── */

export async function listWorlds() {
  const db = await initStorage();
  if (db instanceof IDB) {
    const all = await db.all('worlds');
    return all.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
  }
  const keys = await db.keys('worlds');
  const out = [];
  for (const k of keys) out.push(await db.get('worlds', k));
  return out.filter(Boolean).sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
}

export async function saveWorldMeta(meta) {
  const db = await initStorage();
  meta.lastPlayed = Date.now();
  await db.put('worlds', meta.id, meta);
  return meta;
}

export async function loadWorldMeta(id) {
  const db = await initStorage();
  return db.get('worlds', id);
}

export async function deleteWorld(id) {
  const db = await initStorage();
  const meta = await db.get('worlds', id);
  await db.del('worlds', id);
  if (meta && meta.chunkKeys) {
    for (const k of meta.chunkKeys) await db.del('chunks', `${id}/${k}`);
  }
}

/* ─────────────────────── Tronçons modifiés ─────────────────────── */

/**
 * Différence entre le tronçon actuel et ce que la génération produirait.
 * @returns {{edits:Array, entities:Array}|null} null si rien n'a changé
 */
export function chunkDiff(chunk, gen) {
  const ref = new Chunk(chunk.cx, chunk.cz);
  gen.generate(ref);
  gen.populate(null, ref);
  const edits = [];
  for (let i = 0; i < chunk.blocks.length; i++) {
    const a = chunk.blocks[i], b = ref.blocks[i];
    const da = chunk.data ? chunk.data[i] : 0;
    const dbv = ref.data ? ref.data[i] : 0;
    if (a !== b || da !== dbv) edits.push([i, a, da]);
  }
  const entities = [...chunk.blockEntities.entries()];
  if (!edits.length && !entities.length) return null;
  return { edits, entities };
}

/** Compression simple : les suites d'indices contigus sont regroupées. */
function packEdits(edits) {
  const out = [];
  let i = 0;
  while (i < edits.length) {
    const [start, id, data] = edits[i];
    let n = 1;
    while (i + n < edits.length && edits[i + n][0] === start + n && edits[i + n][1] === id && edits[i + n][2] === data) n++;
    out.push(n > 1 ? [start, id, data, n] : [start, id, data]);
    i += n;
  }
  return out;
}

function unpackEdits(packed) {
  const out = [];
  for (const e of packed) {
    if (e.length === 4) {
      for (let k = 0; k < e[3]; k++) out.push([e[0] + k, e[1], e[2]]);
    } else out.push(e);
  }
  return out;
}

export async function saveChunk(worldId, chunk, gen) {
  const db = await initStorage();
  const diff = chunkDiff(chunk, gen);
  const key = `${worldId}/${chunkKeyStr(chunk.cx, chunk.cz)}`;
  if (!diff) { await db.del('chunks', key); return false; }
  await db.put('chunks', key, { edits: packEdits(diff.edits), entities: diff.entities });
  return true;
}

export async function loadChunks(worldId, keys) {
  const db = await initStorage();
  const map = new Map();
  for (const k of keys) {
    const v = await db.get('chunks', `${worldId}/${k}`);
    if (v) map.set(k, { edits: unpackEdits(v.edits), entities: v.entities || [] });
  }
  return map;
}

/* ────────────────────────── Sauvegarde complète ────────────────────────── */

/**
 * Enregistre l'état complet d'une partie.
 * @param {object} game
 */
export async function saveGame(game) {
  const { world, player, meta } = game;
  const gen = world.gen;
  const keys = new Set(meta.chunkKeys || []);
  for (const [, chunk] of world.chunks) {
    if (!chunk.modified || !chunk.generated) continue;
    const wrote = await saveChunk(meta.id, chunk, gen);
    const k = chunkKeyStr(chunk.cx, chunk.cz);
    if (wrote) keys.add(k); else keys.delete(k);
    chunk.modified = false;
  }
  meta.chunkKeys = [...keys];
  meta.player = player.toJSON();
  meta.time = world.time;
  meta.weather = world.weather;
  meta.rainTicks = world.rainTicks;
  meta.seed = world.seed;
  await saveWorldMeta(meta);
  return meta;
}

export function newWorldMeta({ name, seed, mode }) {
  return {
    id: `w${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    name: name || 'Nouveau monde',
    seed: seed | 0,
    mode: mode || 'survival',
    created: Date.now(),
    lastPlayed: Date.now(),
    time: 1000,
    chunkKeys: [],
    player: null,
  };
}

/** Transforme un texte en graine numérique, comme la saisie de graine du jeu. */
export function seedFromString(s) {
  if (!s) return (Math.random() * 2 ** 31) | 0;
  const t = s.trim();
  if (/^-?\d+$/.test(t)) return parseInt(t, 10) | 0;
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (Math.imul(31, h) + t.charCodeAt(i)) | 0;
  return h;
}
