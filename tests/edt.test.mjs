/**
 * Emploi du temps : lecture d'une grille (à partir de mots d'OCR simulés)
 * et calcul de ce que plusieurs personnes ont en commun.
 *
 * Tout tient dans edt.html : ces tests en extraient le bloc « noyau ».
 *
 *   node --test tests/edt.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Le noyau est extrait de `edt.html` puis exécuté hors navigateur : ce sont
 * donc les lignes réellement livrées qui sont vérifiées, pas une copie.
 */
const FICHIER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../edt.html');
const bloc = /<script id="noyau">([\s\S]*?)<\/script>/.exec(fs.readFileSync(FICHIER, 'utf8'));
if (!bloc) throw new Error('bloc « noyau » introuvable dans edt.html');
// Dans le realm courant, sinon `deepEqual` refuserait des objets « étrangers ».
vm.runInThisContext(bloc[1], { filename: 'edt.html' });

const {
  readSchedule, parseTime, parseRange, dayIndexOf, splitCell, teacherKey,
  subjectKey, fitAxis, mergeAdjacent, fmtTime, fmtDuration,
  compare, mergeIntervals, intersectAll, subtract, commonTeachers,
  commonSubjects, groupTimes, phraseGroups, dayWindow,
} = globalThis.EDT;

/* ─────────────────────────── Briques ─────────────────────────── */

test('lecture des heures, même mal orthographiées par l’OCR', () => {
  assert.equal(parseTime('8h'), 480);
  assert.equal(parseTime('08:00'), 480);
  assert.equal(parseTime('8h30'), 510);
  assert.equal(parseTime('l0h15'), 615);      // « 10 » lu « lO »
  assert.equal(parseTime('O9h05'), 545);
  assert.equal(parseTime('0800'), 480);
  assert.equal(parseTime('12'), null);         // un nombre seul n'est pas une heure…
  assert.equal(parseTime('12', { bare: true }), 720); // …sauf dans la colonne des heures
  assert.equal(parseTime('25h'), null);
  assert.equal(parseTime('salle'), null);
  assert.equal(fmtTime(495), '8h15');
  assert.equal(fmtDuration(95), '1 h 35');
  assert.equal(fmtDuration(45), '45 min');
});

test('créneau écrit dans la cellule', () => {
  assert.deepEqual(parseRange('8h00-10h00 MATHS'), { start: 480, end: 600, matched: '8h00-10h00' });
  assert.deepEqual(parseRange('10 h 15 à 11h10').start, 615);
  assert.equal(parseRange('salle 204'), null);
  assert.equal(parseRange('14h00 - 13h00'), null);   // à l'envers : refusé
});

test('reconnaissance des jours malgré une lettre fausse', () => {
  assert.equal(dayIndexOf('LUNDI'), 0);
  assert.equal(dayIndexOf('Mercredi'), 2);
  assert.equal(dayIndexOf('VENDREOI'), 4);     // D lu O
  assert.equal(dayIndexOf('JEU'), 3);
  assert.equal(dayIndexOf('SALLE'), -1);
  assert.equal(dayIndexOf('MA'), -1);          // trop court : trop risqué
});

test('découpage d’une cellule en matière / prof / salle', () => {
  assert.deepEqual(splitCell([{ text: 'MATHEMATIQUES' }, { text: 'M. DUPONT' }, { text: 'Salle 204' }]),
    { subject: 'Mathematiques', teacher: 'M. Dupont', room: '204' });
  assert.deepEqual(splitCell([{ text: 'EPS' }, { text: 'Mme BERNARD' }, { text: 'GYMNASE' }]),
    { subject: 'EPS', teacher: 'Mme Bernard', room: 'Gymnase' });
  // Sans civilité : la ligne en capitales qui suit la matière est le nom du prof.
  assert.deepEqual(splitCell([{ text: 'ANGLAIS LV1' }, { text: 'MARTIN' }, { text: 'B12' }]),
    { subject: 'Anglais LV1', teacher: 'Martin', room: 'B12' });
});

test('un même prof écrit de plusieurs façons donne une seule clé', () => {
  assert.equal(teacherKey('M. DUPONT'), 'DUPONT');
  assert.equal(teacherKey('Dupont J.'), 'DUPONT');
  assert.equal(teacherKey('Mme Martin'), 'MARTIN');
  assert.equal(teacherKey(''), '');
  assert.equal(subjectKey('MATHS'), subjectKey('Mathématiques'));
  assert.equal(subjectKey('Hist-Géo'), 'HISTOIRE-GEO');
  assert.notEqual(subjectKey('Anglais'), subjectKey('Espagnol'));
});

test('l’axe des heures ignore un repère aberrant', () => {
  const axis = fitAxis([
    { y: 100, minutes: 480 }, { y: 160, minutes: 540 }, { y: 220, minutes: 600 },
    { y: 280, minutes: 660 }, { y: 340, minutes: 180 },  // « 3h » lu à la place de « 13h »
  ]);
  assert.ok(axis, 'axe introuvable');
  assert.ok(Math.abs(axis.toMinutes(400) - 780) < 6, `13h attendu, obtenu ${axis.toMinutes(400)}`);
  assert.equal(fitAxis([{ y: 10, minutes: 480 }]), null);
});

/* ───────────────── Lecture d'une grille complète ───────────────── */

const W = (text, x0, y0, x1, y1, conf = 92) => ({ text, x0, y0, x1, y1, conf });

/** Une ligne de texte dans une cellule, à la position voulue. */
const cellLines = (x, y, texts, { lh = 18, w = 130 } = {}) => texts.flatMap((t, i) => {
  const yy = y + i * lh;
  return [W(t, x, yy, x + Math.min(w, 9 * t.length), yy + 14)];
});

/** Grille type : en-têtes en haut, heures à gauche, une heure = 60 pixels. */
function fakeTimetable() {
  const words = [];
  const cols = { 0: 100, 1: 300, 2: 500, 3: 700, 4: 900 };
  ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'].forEach((d, i) => {
    words.push(W(d, cols[i], 20, cols[i] + 9 * d.length, 40));
  });
  for (let h = 8; h <= 17; h += 1) {
    const y = 100 + (h - 8) * 60;                 // minutes = 1·y + 380
    words.push(W(`${h}h`, 20, y - 8, 55, y + 8));
  }
  return { words, cols };
}

const ROWS = Array.from({ length: 10 }, (_, i) => 100 + i * 60);

test('une grille photographiée devient une liste de cours', () => {
  const { words, cols } = fakeTimetable();

  // Lundi : maths 8h-10h (cellule fusionnée, texte calé en haut), anglais 10h-12h, EPS 14h-16h.
  words.push(...cellLines(cols[0], 106, ['MATHEMATIQUES', 'M. DUPONT', 'Salle 204']));
  words.push(...cellLines(cols[0], 226, ['ANGLAIS', 'Mme MARTIN', 'Salle B12']));
  words.push(...cellLines(cols[0], 466, ['EPS', 'M. BERNARD', 'GYMNASE']));
  // Mardi : le créneau est écrit dans la cellule — c'est alors lui qui fait foi.
  words.push(...cellLines(cols[1], 106, ['9h00-11h00', 'PHYSIQUE-CHIMIE', 'Mme PETIT']));

  // Dans la colonne du lundi, les traits internes des cases fusionnées
  // n'existent pas (9h, 11h, 15h) : c'est ainsi qu'on lit un cours de 2 heures.
  const FUSION = [160, 280, 520];
  const out = readSchedule(words, {
    rowsForBand: (x0) => (x0 < 200 ? ROWS.filter((y) => !FUSION.includes(y)) : ROWS),
  });

  assert.equal(out.warnings.length, 0, out.warnings.join(' / '));
  assert.ok(out.quality > 60, `confiance faible : ${out.quality}`);

  const lundi = out.courses.filter((c) => c.day === 0);
  assert.equal(lundi.length, 3);
  assert.deepEqual(
    lundi.map((c) => [fmtTime(c.start), fmtTime(c.end), c.subject, c.teacher, c.room]),
    [
      ['8h00', '10h00', 'Mathematiques', 'M. Dupont', '204'],
      ['10h00', '12h00', 'Anglais', 'Mme Martin', 'B12'],
      ['14h00', '16h00', 'EPS', 'M. Bernard', 'Gymnase'],
    ],
  );

  const mardi = out.courses.filter((c) => c.day === 1);
  assert.equal(mardi.length, 1);
  assert.equal(mardi[0].source, 'texte');
  assert.deepEqual([fmtTime(mardi[0].start), fmtTime(mardi[0].end)], ['9h00', '11h00']);
  assert.equal(mardi[0].subject, 'Physique-Chimie');
  assert.equal(mardi[0].teacher, 'Mme Petit');
});

test('sans en-tête de jour lisible, on le dit au lieu d’inventer', () => {
  const out = readSchedule([
    W('MATHEMATIQUES', 100, 100, 200, 115), W('M. DUPONT', 100, 120, 190, 135),
    W('ANGLAIS', 100, 200, 180, 215), W('Mme MARTIN', 100, 220, 200, 235),
    W('EPS', 100, 300, 140, 315), W('GYMNASE', 100, 320, 180, 335),
  ]);
  assert.equal(out.courses.length, 0);
  assert.match(out.warnings[0], /jour/i);
  assert.equal(out.quality, 0);
});

test('une case lue en deux morceaux redevient un seul cours', () => {
  // La matière d'un côté, le professeur de l'autre, sur le même créneau.
  const merged = mergeAdjacent([
    { day: 1, start: 540, end: 660, subject: 'Anglais', teacher: '', room: '' },
    { day: 1, start: 540, end: 660, subject: 'Cours', teacher: 'Mme Martin', room: 'B12', incomplete: true },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].subject, 'Anglais');
  assert.equal(merged[0].teacher, 'Mme Martin');
  assert.equal(merged[0].room, 'B12');
});

test('deux cases identiques qui se touchent font un seul cours', () => {
  const merged = mergeAdjacent([
    { day: 0, start: 480, end: 540, subject: 'Maths', teacher: 'M. Dupont' },
    { day: 0, start: 540, end: 600, subject: 'MATHS', teacher: 'DUPONT' },
    { day: 0, start: 600, end: 660, subject: 'Anglais', teacher: 'Mme Martin' },
  ]);
  assert.equal(merged.length, 2);
  assert.deepEqual([merged[0].start, merged[0].end], [480, 600]);
});

/* ─────────────────────────── Comparaison ─────────────────────────── */

const c = (day, start, end, subject, teacher = '', room = '') => ({ day, start, end, subject, teacher, room });
const h = (hh, mm = 0) => hh * 60 + mm;

const LOU = {
  id: 'lou',
  name: 'Lou',
  courses: [
    c(0, h(8), h(10), 'Mathématiques', 'M. Dupont', '204'),
    c(0, h(10), h(12), 'Anglais', 'Mme Martin', 'B12'),
    c(0, h(14), h(16), 'EPS', 'M. Bernard', 'Gymnase'),
    c(1, h(9), h(12), 'Physique-Chimie', 'Mme Petit', '108'),
    c(1, h(13), h(17), 'SVT', 'M. Leroy', '210'),
  ],
};

const SAM = {
  id: 'sam',
  name: 'Sam',
  courses: [
    c(0, h(8), h(9), 'Maths', 'M. Dupont', '204'),
    c(0, h(10), h(12), 'Histoire-Géo', 'Mme Roux', '112'),
    c(0, h(13), h(16), 'SVT', 'M. Leroy', '210'),
    c(1, h(10), h(12), 'Anglais', 'Mme Martin', 'B12'),
    c(1, h(14), h(16), 'Philosophie', 'Mme Petit', '301'),
  ],
};

test('intervalles : fusion, intersection, soustraction', () => {
  assert.deepEqual(mergeIntervals([{ start: 10, end: 20 }, { start: 18, end: 30 }, { start: 40, end: 50 }]),
    [{ start: 10, end: 30 }, { start: 40, end: 50 }]);
  assert.deepEqual(intersectAll([
    [{ start: 0, end: 100 }], [{ start: 50, end: 150 }], [{ start: 60, end: 80 }],
  ]), [{ start: 60, end: 80 }]);
  assert.deepEqual(subtract([{ start: 0, end: 100 }], [{ start: 30, end: 50 }]),
    [{ start: 0, end: 30 }, { start: 50, end: 100 }]);
  assert.deepEqual(dayWindow(LOU, 0), { start: h(8), end: h(16) });
  assert.equal(dayWindow(LOU, 3), null);
});

test('les heures de cours communes, et le même cours ensemble', () => {
  const r = compare([LOU, SAM]);
  const lundi = r.days.find((d) => d.day === 0);

  assert.deepEqual(lundi.together.map((i) => [fmtTime(i.start), fmtTime(i.end)]),
    [['8h00', '9h00'], ['10h00', '12h00'], ['14h00', '16h00']]);

  // 8h-9h : même prof, même salle → ils sont dans le même cours.
  assert.equal(lundi.together[0].sameCourse, true);
  // 10h-12h : chacun le sien.
  assert.equal(lundi.together[1].sameCourse, false);

  // Un seul cours réellement partagé : les maths du lundi matin.
  assert.equal(r.sameClass.length, 1);
  assert.equal(r.sameClass[0].subject, 'Mathématiques');
  assert.deepEqual(r.sameClass[0].people.map((p) => p.name), ['Lou', 'Sam']);
});

test('trous communs, déjeuner commun, début et fin de journée', () => {
  const r = compare([LOU, SAM]);
  const lundi = r.days.find((d) => d.day === 0);

  // Lou est libre 12h-14h ; Sam 9h-10h et 12h-13h → en commun : 12h-13h.
  assert.deepEqual(lundi.free.map((i) => [fmtTime(i.start), fmtTime(i.end)]), [['12h00', '13h00']]);
  assert.deepEqual(lundi.gaps.map((i) => [fmtTime(i.start), fmtTime(i.end)]), [['12h00', '13h00']]);
  assert.deepEqual(lundi.lunch.map((i) => [fmtTime(i.start), fmtTime(i.end)]), [['12h00', '13h00']]);

  assert.equal(lundi.starts.same, true);
  assert.equal(fmtTime(lundi.starts.time), '8h00');
  assert.equal(lundi.ends.same, true);
  assert.equal(fmtTime(lundi.ends.time), '16h00');

  const mardi = r.days.find((d) => d.day === 1);
  assert.equal(mardi.starts.same, false);
  assert.deepEqual(mardi.starts.groups.map((g) => [fmtTime(g.time), g.people.map((p) => p.name)]),
    [['9h00', ['Lou']], ['10h00', ['Sam']]]);
  assert.equal(phraseGroups(mardi.starts), 'Lou commence à 9h00 · Sam commence à 10h00');
  assert.equal(phraseGroups(lundi.ends, { verb: 'finissent', verbOne: 'finit' }), 'Tout le monde finit à 16h00.');

  // Mardi : Lou libre 12h-13h, Sam libre 9h-10h et 12h-14h → 12h-13h en commun.
  assert.deepEqual(mardi.lunch.map((i) => [fmtTime(i.start), fmtTime(i.end)]), [['12h00', '13h00']]);
  assert.equal(r.totals.lunch, 120);         // une heure lundi + une heure mardi
});

test('les profs et les matières que l’on partage', () => {
  const teachers = commonTeachers([LOU, SAM]);
  assert.deepEqual(teachers.map((t) => t.key).sort(), ['DUPONT', 'LEROY', 'MARTIN', 'PETIT']);
  const dupont = teachers.find((t) => t.key === 'DUPONT');
  assert.deepEqual(dupont.people.map((p) => p.name).sort(), ['Lou', 'Sam']);
  assert.deepEqual(dupont.people.find((p) => p.name === 'Lou').subjects, ['Mathématiques']);

  const subjects = commonSubjects([LOU, SAM]).map((s) => s.key);
  assert.ok(subjects.includes('MATHEMATIQUES'), 'MATHS et Mathématiques sont la même matière');
  assert.ok(subjects.includes('SVT') && subjects.includes('ANGLAIS'));
  assert.ok(!subjects.includes('PHILOSOPHIE'));   // Sam est seul en philo
});

test('trois personnes : le commun se réduit à ce que tout le monde partage', () => {
  const MAX = {
    id: 'max',
    name: 'Max',
    courses: [c(0, h(8), h(11), 'NSI', 'M. Faure', '15'), c(0, h(14), h(16), 'EPS', 'M. Bernard', 'Gymnase')],
  };
  const r = compare([LOU, SAM, MAX]);
  const lundi = r.days.find((d) => d.day === 0);

  // 8h-9h : les trois sont en cours ; 10h-11h aussi ; puis 14h-16h.
  assert.deepEqual(lundi.together.map((i) => [fmtTime(i.start), fmtTime(i.end)]),
    [['8h00', '9h00'], ['10h00', '11h00'], ['14h00', '16h00']]);
  // Libre pour les trois : 12h-13h (Max est libre de 11h à 14h).
  assert.deepEqual(lundi.free.map((i) => [fmtTime(i.start), fmtTime(i.end)]), [['12h00', '13h00']]);
  assert.equal(lundi.starts.same, true);
  assert.equal(lundi.ends.same, true);

  // Lou et Max sont ensemble en EPS ; Sam a SVT à ce moment-là.
  const eps = r.sameClass.filter((x) => x.subject === 'EPS');
  assert.equal(eps.length, 1);
  assert.deepEqual(eps[0].people.map((p) => p.name).sort(), ['Lou', 'Max']);
});

test('un jour où une seule personne a cours n’invente pas de temps commun', () => {
  const solo = { id: 'a', name: 'A', courses: [c(3, h(8), h(10), 'Maths')] };
  const rien = { id: 'b', name: 'B', courses: [c(0, h(8), h(10), 'Maths')] };
  const r = compare([solo, rien]);
  assert.equal(r.days.filter((d) => !d.partial).length, 0);
  assert.equal(r.totals.free, 0);
  assert.equal(r.totals.together, 0);
});

test('les créneaux trop courts ne sont pas des trous', () => {
  const a = { id: 'a', name: 'A', courses: [c(0, h(8), h(10), 'X'), c(0, h(10, 10), h(12), 'Y')] };
  const b = { id: 'b', name: 'B', courses: [c(0, h(8), h(10), 'X'), c(0, h(10, 10), h(12), 'Z')] };
  const lundi = compare([a, b]).days[0];
  assert.equal(lundi.free.length, 0, '10 minutes ne font pas un trou');
  assert.equal(groupTimes([{ id: 'a', name: 'A', time: 480 }, { id: 'b', name: 'B', time: 485 }], 10).same, true);
});
