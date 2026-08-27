/**
 * Emploi du temps — lecture du texte de l'image (OCR).
 *
 * Le moteur est Tesseract, un logiciel libre d'OCR (le même que celui utilisé
 * pour numériser des livres). Il est chargé depuis un CDN public et s'exécute
 * *dans le navigateur*, en WebAssembly : aucune photo n'est envoyée nulle part,
 * il n'y a aucune clé d'API, aucun quota et aucun coût.
 *
 * Le dictionnaire français est téléchargé une seule fois puis gardé par le
 * navigateur : les lectures suivantes marchent même sans réseau.
 */

import { prepare, thumbnail } from './image.js';
import { readSchedule } from './parse.js';

const VERSION = '5.1.1';
const CDN = {
  script: `https://cdn.jsdelivr.net/npm/tesseract.js@${VERSION}/dist/tesseract.min.js`,
  worker: `https://cdn.jsdelivr.net/npm/tesseract.js@${VERSION}/dist/worker.min.js`,
  core: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/',
  lang: {
    precise: 'https://tessdata.projectnaptha.com/4.0.0',
    fast: 'https://tessdata.projectnaptha.com/4.0.0_fast',
  },
};

/** Poids annoncé à l'utilisateur avant le premier téléchargement. */
export const LANG_SIZE = { precise: '≈ 6 Mo', fast: '≈ 0,6 Mo' };

/** Découpage de la page tenté par Tesseract. */
export const PSM = { block: '6', sparse: '11', auto: '3', column: '4' };

const STATUS_FR = {
  'loading tesseract core': 'Chargement du moteur',
  'initializing tesseract': 'Démarrage du moteur',
  'loading language traineddata': 'Téléchargement du dictionnaire français',
  'loaded language traineddata': 'Dictionnaire prêt',
  'initializing api': 'Préparation',
  'recognizing text': 'Lecture du texte',
};

let scriptPromise = null;

/** Charge la bibliothèque une seule fois. */
export function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = CDN.script;
    el.async = true;
    el.onload = () => (window.Tesseract ? resolve(window.Tesseract) : reject(new Error('Tesseract introuvable')));
    el.onerror = () => { scriptPromise = null; reject(new Error('Le moteur de lecture n’a pas pu être téléchargé (connexion ?)')); };
    document.head.appendChild(el);
  });
  return scriptPromise;
}

const workers = new Map();
let report = () => {};

/** Un ouvrier par qualité de dictionnaire, réutilisé d'une photo à l'autre. */
async function getWorker(quality = 'precise') {
  if (workers.has(quality)) return workers.get(quality);
  const promise = (async () => {
    const T = await loadTesseract();
    return T.createWorker('fra', 1, {
      workerPath: CDN.worker,
      corePath: CDN.core,
      langPath: CDN.lang[quality] || CDN.lang.precise,
      gzip: true,
      logger: (m) => report(STATUS_FR[m.status] || m.status, m.progress ?? 0),
      errorHandler: (e) => console.warn('[edt/ocr]', e),
    });
  })();
  workers.set(quality, promise);
  promise.catch(() => workers.delete(quality));
  return promise;
}

/** Libère la mémoire (utile sur téléphone entre deux séries de photos). */
export async function release() {
  const list = [...workers.values()];
  workers.clear();
  await Promise.all(list.map(async (p) => { try { (await p).terminate(); } catch { /* déjà parti */ } }));
}

const mapWord = (w) => ({
  text: w.text,
  conf: w.confidence,
  x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1,
});

/** Tesseract v5 range les mots dans des blocs ; les versions plus anciennes les donnent à plat. */
export function flattenWords(data) {
  if (!data) return [];
  if (Array.isArray(data.words) && data.words.length) return data.words.map(mapWord);
  const out = [];
  for (const b of data.blocks || []) {
    for (const p of b.paragraphs || []) {
      for (const l of p.lines || []) for (const w of l.words || []) out.push(mapWord(w));
    }
  }
  return out;
}

/** Un passage d'OCR sur un canevas. */
export async function recognize(canvas, { quality = 'precise', psm = PSM.block, onProgress } = {}) {
  report = (label, progress) => onProgress?.(label, progress);
  const worker = await getWorker(quality);
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
  });
  const { data } = await worker.recognize(canvas, {}, { blocks: true, text: true });
  return { words: flattenWords(data), text: data.text || '' };
}

/**
 * Chaîne complète : fichier photo → cours.
 *
 * Une seconde tentative est lancée si la première ne trouve rien : les grilles
 * très colorées se lisent mieux sans seuillage, et en mode « texte épars ».
 */
export async function readTimetable(file, { rotate = 0, quality = 'precise', onProgress } = {}) {
  const step = (label, progress = 0) => onProgress?.(label, progress);

  step('Préparation de l’image', 0.02);
  const img = await prepare(file, { rotate });

  // Un emploi du temps n'est pas un bloc de texte mais des mots éparpillés dans
  // des cases : le mode « texte épars » lit nettement mieux ces grilles, et la
  // position des mots suffit à reconstituer la structure.
  const attempts = [
    { canvas: img.ocrCanvas, psm: PSM.sparse, label: 'Lecture du texte' },
    { canvas: img.canvas, psm: PSM.auto, label: 'Nouvel essai (autre découpage)' },
  ];

  let best = null;
  for (let i = 0; i < attempts.length; i += 1) {
    const a = attempts[i];
    step(a.label, 0.05);
    const { words } = await recognize(a.canvas, {
      quality,
      psm: a.psm,
      onProgress: (label, p) => step(i ? `${label} (2ᵉ essai)` : label, 0.05 + p * 0.9),
    });
    const parsed = readSchedule(words, { rulings: img.rules, rowsForBand: img.rowsForBand });
    const score = parsed.courses.length * 100 + parsed.quality;
    if (!best || score > best.score) best = { ...parsed, score, words, psm: a.psm };
    if (parsed.courses.length >= 3) break;         // inutile d'insister, c'est lu
  }

  step('Terminé', 1);
  return {
    ...best,
    angle: img.angle,
    size: { width: img.width, height: img.height },
    preview: thumbnail(img.canvas),
  };
}
