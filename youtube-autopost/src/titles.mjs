/**
 * Fabrique de titres — module pur : aucun accès disque, réseau ni DOM.
 * Il tourne donc à l'identique dans Node (le robot qui publie) et dans le
 * navigateur (la console de réglage, youtube-autopost/index.html).
 *
 * Principe : un titre = un modèle « {accroche} {sujet} {suffixe} » dont chaque
 * {variable} est tirée dans une liste. Le tirage est *déterministe* (graine =
 * la date du jour), et on refuse tout titre déjà utilisé récemment : deux jours
 * de suite ne peuvent donc pas donner le même titre.
 */

/* ─────────────────────────── Tirage déterministe ─────────────────────────── */

/** Hachage 32 bits (FNV-1a) : transforme une graine texte en entier. */
export function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
export function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hash32(String(seed));
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (list, rand) => list[Math.floor(rand() * list.length) % list.length];

/* ─────────────────────────── Comparaison de titres ─────────────────────────── */

/**
 * Forme « nue » d'un titre, pour comparer deux titres sans se laisser piéger
 * par la casse, les accents, les emojis ou la ponctuation.
 */
export function normalize(title) {
  return String(title ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();
}

/* ─────────────────────────── Remplissage des modèles ─────────────────────────── */

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** Variables toujours disponibles, en plus de celles écrites dans la config. */
export function builtinVariables({ date = new Date(), index = 1, subject = '' } = {}) {
  const d = date instanceof Date ? date : new Date(date);
  return {
    sujet: subject,
    numero: String(index),
    jour: JOURS[d.getDay()],
    date: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
    mois: d.toLocaleDateString('fr-FR', { month: 'long' }),
  };
}

/** Liste les {variables} citées par un modèle. */
export function placeholdersOf(template) {
  return [...String(template).matchAll(/\{([a-zA-Z0-9_éèêàçùîôû]+)\}/gu)].map((m) => m[1]);
}

/**
 * Remplace chaque {variable} par une valeur tirée au sort.
 * Une variable inconnue est effacée (et signalée dans `missing`).
 *
 * `clean` (vrai pour un titre, faux pour une description multi-lignes) applique
 * en plus le nettoyage typographique de `tidy`.
 */
export function fillTemplate(template, variables, rand, { clean = true } = {}) {
  const missing = [];
  const out = String(template).replace(/\{([a-zA-Z0-9_éèêàçùîôû]+)\}/gu, (_, name) => {
    const value = variables[name];
    if (Array.isArray(value)) return value.length ? String(pick(value, rand)) : '';
    if (value == null || value === '') {
      if (!(name in variables)) missing.push(name);
      return '';
    }
    return String(value);
  });
  return { text: clean ? tidy(out) : out.replace(/[ \t]+\n/g, '\n').trim(), missing };
}

/** Espaces en trop, ponctuation orpheline, caractères interdits dans un titre YouTube. */
export function tidy(text) {
  return String(text)
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.…])/g, '$1')            // pas d'espace avant , . …
    .replace(/([^\s!?])([!?])/g, '$1 $2')          // une espace avant ! et ? (usage français)
    .replace(/^[\s,.!?…:;-]+/, '')
    .trim();
}

/** Coupe proprement à `max` caractères, sur une frontière de mot. */
export function clamp(text, max) {
  const t = String(text);
  if (!max || t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return (space > 0 ? cut.slice(0, space) : cut).trim();
}

/* ─────────────────────────── Titre du jour ─────────────────────────── */

/** Nombre de titres distincts que la configuration peut produire. */
export function countCombinations(titre = {}) {
  const variables = titre.variables || {};
  return (titre.modeles || []).reduce((total, modele) => {
    const n = [...new Set(placeholdersOf(modele))].reduce((p, name) => {
      const v = variables[name];
      return p * (Array.isArray(v) && v.length ? v.length : 1);
    }, 1);
    return total + n;
  }, 0);
}

/** Au-delà, on cesse d'énumérer (inutile : il y a déjà des siècles de titres). */
const PLAFOND = 20000;

/** Produit cartésien de listes : [[a,b],[1,2]] → [[a,1],[a,2],[b,1],[b,2]]. */
function cartesien(listes) {
  return listes.reduce((acc, liste) => acc.flatMap((debut) => liste.map((v) => [...debut, v])), [[]]);
}

/**
 * Énumère TOUS les titres possibles. C'est ce qui permet de garantir qu'aucun
 * titre ne se répète tant qu'une combinaison inédite reste disponible — un
 * simple tirage au sort, lui, retomberait vite sur des titres déjà publiés.
 *
 * Deux niveaux de dédoublonnage, volontairement différents :
 *   • `titres` garde les variantes exactes (l'emoji change, le titre reste) ;
 *   • `distincts` compte les titres réellement différents à l'œil du spectateur
 *     (forme normalisée), c'est-à-dire le nombre de jours sans répétition.
 *
 * @returns {{titres:string[], distincts:number, parTitre:Map<string,string>, manquantes:string[]}|null}
 *          `null` si l'espace des possibles dépasse le plafond d'énumération.
 */
export function enumerateTitles(titre = {}, extra = {}) {
  const modeles = (titre.modeles || []).filter((m) => String(m || '').trim());
  const variables = { ...extra, ...(titre.variables || {}) };
  const max = titre.longueurMax || 100;
  const exacts = new Set();
  const nus = new Set();
  const titres = [];
  const parTitre = new Map();
  const manquantes = new Set();

  for (const modele of modeles) {
    const noms = [...new Set(placeholdersOf(modele))];
    for (const nom of noms) if (!(nom in variables)) manquantes.add(nom);

    const listes = noms.map((nom) => {
      const v = variables[nom];
      if (Array.isArray(v)) return v.length ? v : [''];
      return [v == null ? '' : String(v)];
    });
    if (listes.reduce((p, l) => p * l.length, 1) > PLAFOND) return null;   // trop vaste : voir makeTitle

    for (const combo of cartesien(listes)) {
      const valeurs = Object.fromEntries(noms.map((nom, i) => [nom, combo[i]]));
      const candidat = clamp(fillTemplate(modele, valeurs, () => 0).text, max);
      if (!candidat || exacts.has(candidat)) continue;
      exacts.add(candidat);
      nus.add(normalize(candidat));
      titres.push(candidat);
      parTitre.set(candidat, modele);
    }
  }
  return { titres, distincts: nus.size, parTitre, manquantes: [...manquantes] };
}

/**
 * Nombre de titres réellement différents (donc de jours sans répétition).
 * Deux titres qui ne diffèrent que par un emoji ou la ponctuation comptent
 * pour un seul : c'est ainsi que le spectateur les perçoit.
 */
export function countDistinctTitles(titre = {}, extra = {}) {
  if (countCombinations(titre) > PLAFOND) return countCombinations(titre);
  const tous = enumerateTitles(titre, { sujet: titre.sujetParDefaut || 'sujet', numero: '1', jour: 'lundi', date: '1 janvier', mois: 'janvier', ...extra });
  return tous ? tous.distincts : countCombinations(titre);
}

/**
 * Compose le titre d'une publication.
 *
 * Stratégie : on énumère les titres possibles, on écarte ceux déjà publiés
 * récemment, et on en tire un au sort de façon reproductible (graine = la date).
 * Quand tout a servi, on reprend le plus ancien plutôt que d'échouer.
 *
 * @param {object}   o
 * @param {object}   o.titre     Bloc `titre` de la configuration.
 * @param {string}   o.seed      Graine du tirage (par défaut la date du jour).
 * @param {string}   o.subject   Sujet de la vidéo (nom du fichier ou fiche .json).
 * @param {number}   o.index     Numéro de la publication (variable {numero}).
 * @param {Date}     o.date      Date de publication (variables {jour}, {date}).
 * @param {string[]} o.recent    Titres déjà publiés, du plus ancien au plus récent.
 * @returns {{titre:string, modele:string, repete:boolean, restants:number, manquantes:string[]}}
 */
export function makeTitle({ titre = {}, seed, subject = '', index = 1, date = new Date(), recent = [] } = {}) {
  const modeles = (titre.modeles || []).filter((m) => String(m || '').trim());
  if (!modeles.length) throw new Error('Aucun modèle de titre : renseignez titre.modeles dans config.json.');

  const variables = { ...builtinVariables({ date, index, subject }) };
  if (!subject && titre.sujetParDefaut) variables.sujet = titre.sujetParDefaut;

  const rand = rng(String(seed ?? date.toISOString().slice(0, 10)));
  const tous = enumerateTitles(titre, variables);
  if (!tous) return makeTitleAleatoire({ titre, modeles, variables, rand, recent });

  const rang = new Map(recent.map((t, i) => [normalize(t), i]));   // 0 = le plus ancien
  const libres = tous.titres.filter((t) => !rang.has(normalize(t)));

  if (libres.length) {
    const choisi = libres[Math.floor(rand() * libres.length) % libres.length];
    const restants = new Set(libres.map(normalize)).size - 1;
    return { titre: choisi, modele: tous.parTitre.get(choisi), repete: false, restants, manquantes: tous.manquantes };
  }

  // Tout a servi : on recycle le titre utilisé il y a le plus longtemps.
  const plusAncien = tous.titres.slice().sort((a, b) => rang.get(normalize(a)) - rang.get(normalize(b)))[0];
  return {
    titre: plusAncien || clamp(modeles[0], titre.longueurMax || 100),
    modele: tous.parTitre.get(plusAncien) || modeles[0],
    repete: true, restants: 0, manquantes: tous.manquantes,
  };
}

/** Repli quand les combinaisons sont trop nombreuses pour être énumérées. */
function makeTitleAleatoire({ titre, modeles, variables, rand, recent }) {
  const max = titre.longueurMax || 100;
  const dejaVus = new Set(recent.map(normalize));
  const toutes = { ...variables, ...(titre.variables || {}) };
  let repli = null;
  for (let i = 0; i < 500; i++) {
    const modele = pick(modeles, rand);
    const { text, missing } = fillTemplate(modele, toutes, rand);
    const candidat = clamp(text, max);
    if (!candidat) continue;
    repli ??= { titre: candidat, modele, repete: true, restants: 0, manquantes: missing };
    if (!dejaVus.has(normalize(candidat))) {
      return { titre: candidat, modele, repete: false, restants: Infinity, manquantes: missing };
    }
  }
  return repli;
}

/** Aperçu de N jours de titres (utilisé par la console de réglage et `--preview`). */
export function previewTitles(titre, days = 14, { start = new Date(), subject = '', index = 1 } = {}) {
  const recent = [];
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(start.getTime() + i * 86400000);
    const jour = date.toISOString().slice(0, 10);
    const r = makeTitle({ titre, seed: jour, subject, index: index + i, date, recent });
    recent.push(r.titre);
    out.push({ date: jour, ...r });
  }
  return out;
}
