import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeTitle, previewTitles, countCombinations, countDistinctTitles, enumerateTitles,
  normalize, tidy, clamp, fillTemplate, placeholdersOf, rng,
} from '../src/titles.mjs';
import { validateConfig, recentTitles, alreadyPosted } from '../src/config.mjs';
import { subjectFromName, mimeOf, isVideo } from '../src/queue.mjs';
import { compose } from '../src/publish.mjs';
import { videoResource } from '../src/youtube.mjs';

const TITRE = {
  modeles: ['{accroche} {sujet} {emoji}', '{sujet} : {promesse}', '{question} {sujet} ?'],
  variables: {
    accroche: ['Incroyable', 'Tu ne vas pas y croire', 'Personne ne fait ça'],
    promesse: ['la méthode simple', 'ce que personne ne dit'],
    question: ['Tu connaissais', 'Qui savait pour'],
    emoji: ['🔥', '👀', ''],
  },
  sujetParDefaut: 'cette astuce',
  longueurMax: 100,
  eviterRepetitionJours: 90,
};

/* ─────────────────────────── Nettoyage ─────────────────────────── */

test('typographie française et caractères interdits', () => {
  assert.equal(tidy('Incroyable   ceci !'), 'Incroyable ceci !');
  assert.equal(tidy('vraiment ,  oui'), 'vraiment, oui');
  assert.equal(tidy('a<b>c'), 'abc');                       // < et > refusés par YouTube
  assert.equal(tidy('  , juste ça'), 'juste ça');
  assert.equal(tidy('ceci!? bon'), 'ceci !? bon');
});

test('une description multi-lignes garde ses retours à la ligne et ses URL', () => {
  const { text } = fillTemplate('Salut {qui}\n\nAbonne-toi : https://exemple.fr', { qui: 'toi' }, Math.random, { clean: false });
  assert.equal(text, 'Salut toi\n\nAbonne-toi : https://exemple.fr');
});

test('comparaison de titres insensible à la casse, aux accents et aux emojis', () => {
  assert.equal(normalize('Ça, c’est ÉNORME ! 🔥'), normalize('ca c est enorme'));
  assert.notEqual(normalize('astuce A'), normalize('astuce B'));
});

test('coupe sur une frontière de mot', () => {
  assert.equal(clamp('un titre vraiment très long', 14), 'un titre');
  assert.equal(clamp('court', 100), 'court');
});

/* ─────────────────────────── Génération ─────────────────────────── */

test('même graine, même titre — le tirage est reproductible', () => {
  const a = makeTitle({ titre: TITRE, seed: '2026-01-01' });
  const b = makeTitle({ titre: TITRE, seed: '2026-01-01' });
  assert.equal(a.titre, b.titre);

  // Et deux graines différentes doivent balayer l'éventail des possibles.
  const varies = new Set(Array.from({ length: 20 }, (_, i) => makeTitle({ titre: TITRE, seed: `g${i}` }).titre));
  assert.ok(varies.size >= 4, `seulement ${varies.size} titres pour 20 graines`);
});

test('tous les titres possibles passent avant la moindre répétition', () => {
  const possibles = countDistinctTitles(TITRE);
  const jours = previewTitles(TITRE, 30, { start: new Date('2026-03-01T12:00:00Z') });
  const uniques = new Set(jours.map((j) => normalize(j.titre)));
  assert.equal(uniques.size, possibles, 'des titres possibles n’ont jamais été utilisés');
  assert.ok(jours.slice(0, possibles).every((j) => !j.repete), 'répétition avant épuisement');
  assert.ok(jours.slice(possibles).every((j) => j.repete), 'répétition non signalée');
});

test('deux titres qui ne diffèrent que par l’emoji comptent pour un seul', () => {
  const t = { modeles: ['{sujet} {emoji}'], variables: { emoji: ['🔥', '👀', ''] }, sujetParDefaut: 'ok', longueurMax: 100 };
  assert.equal(countCombinations(t), 3);           // trois variantes écrites…
  assert.equal(countDistinctTitles(t), 1);         // …mais un seul titre aux yeux du spectateur
  assert.equal(enumerateTitles(t, { sujet: 'ok' }).titres.length, 3);
});

test('titre imposé par un titre déjà publié : on en cherche un autre', () => {
  const deja = previewTitles(TITRE, 5).map((j) => j.titre);
  const suivant = makeTitle({ titre: TITRE, seed: '2026-05-05', recent: deja });
  assert.ok(!deja.map(normalize).includes(normalize(suivant.titre)));
});

test('à court de combinaisons, on republie en le signalant plutôt que d’échouer', () => {
  const pauvre = { modeles: ['{a} test'], variables: { a: ['un'] }, longueurMax: 100 };
  assert.equal(countDistinctTitles(pauvre), 1);
  const r = makeTitle({ titre: pauvre, seed: 'x', recent: ['un test'] });
  assert.equal(r.titre, 'un test');
  assert.equal(r.repete, true);
});

test('la limite de 100 caractères de YouTube est respectée', () => {
  const long = { modeles: [`{a} ${'très '.repeat(40)}long`], variables: { a: ['Titre'] }, longueurMax: 100 };
  for (const j of previewTitles(long, 5)) assert.ok(j.titre.length <= 100, `${j.titre.length} caractères`);
});

test('variables inconnues signalées, jamais laissées telles quelles', () => {
  const r = makeTitle({ titre: { modeles: ['Voici {inconnue} !'], variables: {}, longueurMax: 100 }, seed: 'z' });
  assert.ok(!r.titre.includes('{'));
  assert.deepEqual(r.manquantes, ['inconnue']);
});

test('variables intégrées : {sujet}, {numero}, {jour}', () => {
  assert.deepEqual(placeholdersOf('{a} et {b}'), ['a', 'b']);
  const r = makeTitle({
    titre: { modeles: ['{sujet} — {jour} n°{numero}'], variables: {}, longueurMax: 100 },
    seed: 'k', subject: 'mon sujet', index: 7, date: new Date('2026-08-21T12:00:00Z'),
  });
  assert.equal(r.titre, 'mon sujet — vendredi n°7');
});

test('modèles sans aucune variable : pas de boucle infinie', () => {
  const r = makeTitle({ titre: { modeles: ['Titre fixe'], variables: {}, longueurMax: 100 }, seed: 'a' });
  assert.equal(r.titre, 'Titre fixe');
});

test('aucun modèle : erreur explicite', () => {
  assert.throws(() => makeTitle({ titre: { modeles: [] } }), /modèle de titre/);
});

test('comptage des combinaisons', () => {
  assert.equal(countCombinations(TITRE), 3 * 3 + 2 + 2);   // 9 variantes + 2 + 2
  assert.equal(countDistinctTitles(TITRE), 3 + 2 + 2);     // l’emoji ne crée pas un titre neuf
  assert.equal(rng('graine')(), rng('graine')());
});

/* ─────────────────────────── File d’attente ─────────────────────────── */

test('le sujet est déduit du nom de fichier', () => {
  assert.equal(subjectFromName('01_astuce-parking-a-paris.mp4'), 'astuce parking a paris');
  assert.equal(subjectFromName('2026-08-21_visite guidee.MOV'), 'visite guidee');
  assert.equal(subjectFromName('simple.webm'), 'simple');
});

test('les hashtags du nom de fichier ne se retrouvent pas dans le titre', () => {
  // Nom tel que le sortent les applis de montage.
  assert.equal(subjectFromName('01_Jour-62-!-#shorts-#photography.mp4'), 'Jour 62');
  assert.equal(subjectFromName('#photo_du_jour.mp4'), 'photo du jour');
  assert.equal(subjectFromName('02_Mon-sujet_#a_#b.mov'), 'Mon sujet');
});

test('extensions et types MIME reconnus', () => {
  assert.ok(isVideo('a.MP4') && isVideo('b.mov') && !isVideo('c.txt') && !isVideo('d.json'));
  assert.equal(mimeOf('a.mov'), 'video/quicktime');
  assert.equal(mimeOf('a.inconnu'), 'video/mp4');
});

test('une vidéo déjà publiée ne repart pas', () => {
  const state = { publications: [{ fichier: 'a.mp4', titre: 'T', date: new Date().toISOString() }] };
  assert.ok(alreadyPosted(state, 'a.mp4'));
  assert.ok(!alreadyPosted(state, 'b.mp4'));
});

test('les titres trop anciens ne bloquent plus la réutilisation', () => {
  const vieux = new Date(Date.now() - 200 * 86400000).toISOString();
  const state = { publications: [{ titre: 'ancien', date: vieux }, { titre: 'récent', date: new Date().toISOString() }] };
  assert.deepEqual(recentTitles(state, 90), ['récent']);
  assert.equal(recentTitles(state, 365).length, 2);
});

/* ─────────────────────────── Configuration ─────────────────────────── */

test('la validation attrape les erreurs de config courantes', () => {
  const base = {
    source: 'depot', publication: { confidentialite: 'public' },
    titre: { modeles: ['ok'], longueurMax: 100 }, quandLaFileEstVide: 'echouer',
  };
  assert.deepEqual(validateConfig(base), []);
  assert.match(validateConfig({ ...base, source: 'drive', driveDossierId: '' })[0], /driveDossierId/);
  assert.match(validateConfig({ ...base, publication: { confidentialite: 'publique' } })[0], /confidentialite/);
  assert.match(validateConfig({ ...base, titre: { modeles: ['  '] } })[0], /titre\.modeles/);
  assert.match(validateConfig({ ...base, titre: { modeles: ['ok'], longueurMax: 120 } })[0], /100/);
});

/* ─────────────────────────── Composition complète ─────────────────────────── */

const CONFIG = {
  titre: TITRE,
  description: { modeles: ['{sujet} 👇'], variables: {}, signature: '#shorts' },
  tags: ['shorts', 'astuce'],
  publication: { confidentialite: 'public', categorieId: '22', langue: 'fr', pourEnfants: false },
};

test('compose : titre généré, description signée, mots-clés fusionnés', () => {
  const video = { nom: '01_mon-sujet.mp4', fiche: {}, sujet: 'mon sujet' };
  const r = compose(CONFIG, { publications: [] }, video, new Date('2026-08-21T10:00:00Z'));
  assert.ok(r.titre.includes('mon sujet'));
  assert.equal(r.description, 'mon sujet 👇\n\n#shorts');
  assert.deepEqual(r.tags, ['shorts', 'astuce']);
  assert.equal(r.numero, 1);
});

test('compose : la fiche de la vidéo l’emporte sur la génération', () => {
  const video = { nom: 'x.mp4', sujet: 'x', fiche: { titre: 'Titre imposé', description: 'Ma description', tags: ['perso'] } };
  const r = compose(CONFIG, { publications: [] }, video, new Date('2026-08-21T10:00:00Z'));
  assert.equal(r.titre, 'Titre imposé');
  assert.equal(r.description, 'Ma description\n\n#shorts');
  assert.deepEqual(r.tags, ['shorts', 'astuce', 'perso']);
});

test('la ressource envoyée à YouTube respecte les limites de l’API', () => {
  const r = videoResource({
    titre: 'T'.repeat(150), description: 'D'.repeat(6000),
    tags: Array.from({ length: 80 }, (_, i) => `tag${i}`), publication: CONFIG.publication,
  });
  assert.equal(r.snippet.title.length, 100);
  assert.ok(r.snippet.description.length <= 4900);
  assert.equal(r.snippet.tags.length, 60);
  assert.equal(r.status.privacyStatus, 'public');
  assert.equal(r.status.selfDeclaredMadeForKids, false);
});

test('90 jours d’affilée : chaque titre possible sort avant qu’un seul revienne', () => {
  const riche = {
    ...TITRE,
    variables: { ...TITRE.variables, accroche: [...TITRE.variables.accroche, 'Regarde ça', 'Enfin', 'Sérieusement'] },
    eviterRepetitionJours: 365,
  };
  const config = { ...CONFIG, titre: riche };
  const possibles = countDistinctTitles(riche, { sujet: 'sujet du jour' });
  const state = { publications: [] };
  const vus = new Set();

  for (let i = 0; i < 90; i++) {
    const jour = new Date(Date.now() - (90 - i) * 86400000);   // les 90 derniers jours
    const r = compose(config, state, { nom: `${i}_sujet-du-jour.mp4`, sujet: 'sujet du jour', fiche: {} }, jour);
    state.publications.push({ titre: r.titre, date: jour.toISOString() });
    vus.add(normalize(r.titre));
  }
  assert.equal(vus.size, possibles, `${vus.size} titres distincts pour ${possibles} possibles`);

  // Et sur les premiers jours — le seul cas qui compte vraiment — aucun doublon.
  const debut = state.publications.slice(0, Math.min(30, possibles)).map((p) => normalize(p.titre));
  assert.equal(new Set(debut).size, debut.length, 'doublon dans le premier mois');
});
