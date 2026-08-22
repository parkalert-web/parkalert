/**
 * Lecture et validation de config.json + state.json.
 *
 * Aucun secret ne vit dans ces fichiers : les identifiants Google sont lus
 * dans les variables d'environnement (Secrets GitHub en production, fichier
 * .env en local). config.json et state.json peuvent donc rester publics.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
export const CONFIG_PATH = path.join(ROOT, 'config.json');
export const STATE_PATH = path.join(ROOT, 'state.json');

const DEFAULTS = {
  source: 'depot',
  dossierVideos: 'videos',
  driveDossierId: '',
  publication: {
    confidentialite: 'public',
    categorieId: '22',
    langue: 'fr',
    pourEnfants: false,
    notifierAbonnes: true,
  },
  titre: { modeles: [], variables: {}, sujetParDefaut: '', longueurMax: 100, eviterRepetitionJours: 90 },
  description: { modeles: [''], variables: {}, signature: '' },
  tags: [],
  quandLaFileEstVide: 'echouer',   // 'echouer' (mail d'alerte GitHub) | 'ignorer'
};

const CONFIDENTIALITES = ['public', 'unlisted', 'private'];

/** Fusion profonde limitée aux objets simples (les tableaux sont remplacés). */
function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(base[k] || {}, v) : v;
  }
  return out;
}

export async function loadConfig(file = CONFIG_PATH) {
  let brut;
  try {
    brut = JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    throw new Error(`config.json illisible (${file}) : ${err.message}`);
  }
  const config = merge(DEFAULTS, brut);
  const problemes = validateConfig(config);
  if (problemes.length) throw new Error(`config.json invalide :\n- ${problemes.join('\n- ')}`);
  config.dossierVideosAbsolu = path.resolve(ROOT, config.dossierVideos);
  return config;
}

/** Retourne la liste (vide si tout va bien) des erreurs de configuration. */
export function validateConfig(config) {
  const pb = [];
  if (!['depot', 'drive'].includes(config.source)) pb.push('source doit valoir "depot" ou "drive"');
  if (config.source === 'drive' && !(config.driveDossierId || process.env.YT_DRIVE_FOLDER_ID)) {
    pb.push('source "drive" : renseignez driveDossierId (ou le secret YT_DRIVE_FOLDER_ID)');
  }
  if (!CONFIDENTIALITES.includes(config.publication.confidentialite)) {
    pb.push(`publication.confidentialite doit valoir ${CONFIDENTIALITES.join(', ')}`);
  }
  const modeles = (config.titre.modeles || []).filter((m) => String(m || '').trim());
  if (!modeles.length) pb.push('titre.modeles est vide : il faut au moins un modèle de titre');
  for (const m of modeles) {
    if (String(m).length > 300) pb.push(`modèle de titre trop long : « ${String(m).slice(0, 40)}… »`);
  }
  if (config.titre.longueurMax > 100) pb.push('titre.longueurMax ne peut pas dépasser 100 (limite YouTube)');
  if (!['echouer', 'ignorer'].includes(config.quandLaFileEstVide)) {
    pb.push('quandLaFileEstVide doit valoir "echouer" ou "ignorer"');
  }
  return pb;
}

/* ─────────────────────────── Mémoire des publications ─────────────────────────── */

const STATE_VIDE = { version: 1, publications: [] };

export async function loadState(file = STATE_PATH) {
  if (!existsSync(file)) return { ...STATE_VIDE };
  try {
    const s = JSON.parse(await readFile(file, 'utf8'));
    return { ...STATE_VIDE, ...s, publications: Array.isArray(s.publications) ? s.publications : [] };
  } catch {
    return { ...STATE_VIDE };
  }
}

export async function saveState(state, file = STATE_PATH) {
  await writeFile(file, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

/** Titres publiés dans les N derniers jours — ceux qu'on s'interdit de répéter. */
export function recentTitles(state, jours = 90) {
  const limite = Date.now() - jours * 86400000;
  return state.publications
    .filter((p) => !p.date || Date.parse(p.date) >= limite)
    .map((p) => p.titre)
    .filter(Boolean);
}

/** Un fichier déjà publié ne doit jamais repartir en ligne. */
export function alreadyPosted(state, cle) {
  return state.publications.some((p) => p.fichier === cle);
}
