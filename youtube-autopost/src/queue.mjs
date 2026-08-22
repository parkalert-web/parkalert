/**
 * La file d'attente : où le robot va chercher la prochaine vidéo à publier.
 *
 * Deux sources possibles, choisies par `source` dans config.json :
 *   • "depot" — les fichiers déposés dans youtube-autopost/videos/ (le plus
 *     simple : glisser-déposer sur github.com, aucune permission Google en plus) ;
 *   • "drive" — un dossier Google Drive (pratique depuis le téléphone, et sans
 *     limite de taille de fichier côté GitHub).
 *
 * Dans les deux cas l'ordre est alphabétique : préfixez vos fichiers par
 * 01-, 02-… ou par une date pour maîtriser l'ordre de passage.
 */

import { readdir, readFile, mkdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { apiJson, apiFetch } from './google.mjs';
import { alreadyPosted } from './config.mjs';

export const EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi'];

const MIMES = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime',
  '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
};

export const mimeOf = (nom) => MIMES[path.extname(nom).toLowerCase()] || 'video/mp4';
export const isVideo = (nom) => EXTENSIONS.includes(path.extname(nom).toLowerCase());

/**
 * Sujet déduit du nom de fichier : « 03_astuce-parking-a-paris.mp4 »
 * devient « astuce parking à paris » — utilisable comme {sujet} dans un titre.
 */
export function subjectFromName(nom) {
  return path.basename(nom, path.extname(nom))
    .replace(/^\d{2,4}([-_.]\d{2}){0,2}[-_.\s]+/, '')   // préfixe 01_ ou 2026-08-21_
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    // Les exports vidéo traînent souvent leurs hashtags en fin de nom
    // (« Jour 62 ! #shorts #photography ») : c'est de l'étiquetage, pas le sujet.
    .replace(/(\s*#[\p{Letter}\p{Number}_]+)+\s*$/gu, '')
    .replace(/#/g, '')                        // un # isolé ailleurs : simple décoration
    .replace(/[\s!?.,;:–—-]+$/u, '')          // ponctuation de fin
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tri « humain » : 2 avant 10. */
const parNom = (a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true, sensitivity: 'base' });

/* ─────────────────────────── Source « depot » ─────────────────────────── */

async function listRepo(config) {
  let entrees;
  try {
    entrees = await readdir(config.dossierVideosAbsolu, { withFileTypes: true });
  } catch {
    return [];
  }
  const videos = [];
  for (const e of entrees) {
    if (!e.isFile() || !isVideo(e.name)) continue;
    const chemin = path.join(config.dossierVideosAbsolu, e.name);
    const { size } = await stat(chemin);
    videos.push({ source: 'depot', cle: e.name, nom: e.name, chemin, taille: size, mime: mimeOf(e.name) });
  }
  return videos.sort(parNom);
}

/** Fiche facultative « mavideo.json » posée à côté de « mavideo.mp4 ». */
async function sidecar(chemin) {
  const fiche = chemin.replace(/\.[^.]+$/, '.json');
  try {
    return JSON.parse(await readFile(fiche, 'utf8'));
  } catch {
    return {};
  }
}

/* ─────────────────────────── Source « drive » ─────────────────────────── */

async function listDrive(config, token) {
  const dossier = config.driveDossierId || process.env.YT_DRIVE_FOLDER_ID;
  const q = `'${dossier}' in parents and trashed = false and mimeType contains 'video/'`;
  const url = 'https://www.googleapis.com/drive/v3/files'
    + `?q=${encodeURIComponent(q)}&orderBy=name_natural`
    + '&fields=files(id,name,size,mimeType,createdTime)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true';
  const data = await apiJson(url, { headers: { Authorization: `Bearer ${token}` } });
  return (data.files || []).map((f) => ({
    source: 'drive', cle: f.id, nom: f.name, driveId: f.id,
    taille: Number(f.size || 0), mime: f.mimeType || mimeOf(f.name),
  }));
}

/* ─────────────────────────── API commune ─────────────────────────── */

/** Toutes les vidéos en attente, la plus prioritaire en tête. */
export async function pending(config, state, token) {
  const toutes = config.source === 'drive' ? await listDrive(config, token) : await listRepo(config);
  return toutes.filter((v) => !alreadyPosted(state, v.cle));
}

/** La prochaine vidéo à publier, enrichie de sa fiche et de son sujet. */
export async function nextVideo(config, state, token) {
  const [video] = await pending(config, state, token);
  if (!video) return null;
  const fiche = video.chemin ? await sidecar(video.chemin) : {};
  return { ...video, fiche, sujet: fiche.sujet || subjectFromName(video.nom) };
}

/** Charge le contenu du fichier en mémoire (un Short pèse quelques Mo). */
export async function readVideo(video, token) {
  if (video.source === 'drive') {
    const res = await apiFetch(`https://www.googleapis.com/drive/v3/files/${video.driveId}?alt=media&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Téléchargement Drive impossible (HTTP ${res.status}).`);
    return Buffer.from(await res.arrayBuffer());
  }
  return readFile(video.chemin);
}

/**
 * Range la vidéo publiée dans videos/publiees/ pour qu'elle sorte de la file.
 * (En source Drive, rien n'est déplacé : le suivi se fait par state.json.)
 */
export async function archive(video, config) {
  if (video.source !== 'depot') return null;
  const dossier = path.join(config.dossierVideosAbsolu, 'publiees');
  await mkdir(dossier, { recursive: true });
  const cible = path.join(dossier, video.nom);
  await rename(video.chemin, cible);
  return path.relative(config.dossierVideosAbsolu, cible);
}
