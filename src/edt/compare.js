/**
 * Emploi du temps — ce qu'on a en commun.
 *
 * Logique pure : elle prend N emplois du temps déjà lus (ou saisis à la main)
 * et répond aux questions qui comptent — quand est-ce qu'on est en cours en
 * même temps, quels trous a-t-on ensemble, qui commence et finit en même
 * temps, quand peut-on manger ensemble, quels profs a-t-on en commun.
 *
 * Aucune dépendance : testable hors navigateur (tests/edt.test.mjs).
 * Toutes les heures sont des minutes depuis minuit.
 */

import { DAYS, teacherKey, subjectKey, fmtTime, fmtDuration } from './parse.js';

export { DAYS, fmtTime, fmtDuration };

export const DEFAULTS = {
  minCommon: 15,          // on ignore les créneaux communs plus courts (min)
  minLunch: 30,           // durée minimale pour appeler ça un déjeuner
  lunch: { start: 11 * 60, end: 14 * 60 + 30 },
  tolerance: 0,           // « en même temps » à ± n minutes
};

/* ─────────────────────────── Intervalles ─────────────────────────── */

export function mergeIntervals(list) {
  const sorted = list.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ start: i.start, end: i.end });
  }
  return out;
}

export function intersectPair(a, b) {
  const out = [];
  let i = 0; let j = 0;
  while (i < a.length && j < b.length) {
    const start = Math.max(a[i].start, b[j].start);
    const end = Math.min(a[i].end, b[j].end);
    if (end > start) out.push({ start, end });
    if (a[i].end < b[j].end) i += 1; else j += 1;
  }
  return out;
}

export function intersectAll(lists) {
  if (!lists.length) return [];
  return lists.map(mergeIntervals).reduce((acc, l) => intersectPair(acc, l));
}

/** base moins holes. */
export function subtract(base, holes) {
  let out = mergeIntervals(base);
  for (const h of mergeIntervals(holes)) {
    const next = [];
    for (const i of out) {
      if (h.end <= i.start || h.start >= i.end) { next.push(i); continue; }
      if (h.start > i.start) next.push({ start: i.start, end: h.start });
      if (h.end < i.end) next.push({ start: h.end, end: i.end });
    }
    out = next;
  }
  return out;
}

export const clip = (list, win) => list
  .map((i) => ({ ...i, start: Math.max(i.start, win.start), end: Math.min(i.end, win.end) }))
  .filter((i) => i.end > i.start);

export const totalMinutes = (list) => list.reduce((s, i) => s + (i.end - i.start), 0);

/* ─────────────────────────── Une journée ─────────────────────────── */

/** Les cours d'une personne un jour donné (les pauses ne sont pas du cours). */
export const coursesOf = (sched, day) => (sched.courses || [])
  .filter((c) => c.day === day && c.kind !== 'pause' && c.end > c.start)
  .sort((a, b) => a.start - b.start);

export const busyOf = (sched, day) => mergeIntervals(coursesOf(sched, day).map((c) => ({ start: c.start, end: c.end })));

/** Amplitude de la journée : du premier cours au dernier. */
export function dayWindow(sched, day) {
  const list = coursesOf(sched, day);
  if (!list.length) return null;
  return { start: list[0].start, end: Math.max(...list.map((c) => c.end)) };
}

/** Le cours en train d'avoir lieu à un instant donné. */
const courseAt = (sched, day, min) => coursesOf(sched, day).find((c) => c.start <= min && c.end > min) || null;

/** Deux cours au même moment, même prof, même salle : c'est le même cours. */
export function sameCourse(a, b) {
  if (!a || !b) return false;
  // Les deux emplois du temps ne sont pas au pixel près : on accepte un
  // décalage de quelques minutes, mais il faut un vrai recouvrement.
  const shared = Math.min(a.end, b.end) - Math.max(a.start, b.start);
  const shorter = Math.min(a.end - a.start, b.end - b.start);
  const sameSlot = shared >= Math.min(30, shorter) && Math.abs(a.start - b.start) <= 15;
  if (!sameSlot) return false;
  const tA = teacherKey(a.teacher); const tB = teacherKey(b.teacher);
  const rA = String(a.room || '').toUpperCase(); const rB = String(b.room || '').toUpperCase();
  const sameTeacher = !!tA && tA === tB;
  const sameRoom = !!rA && rA === rB;
  const sameSubject = !!subjectKey(a.subject) && subjectKey(a.subject) === subjectKey(b.subject);
  return (sameTeacher && (sameRoom || sameSubject)) || (sameRoom && sameSubject);
}

/**
 * Comparaison complète.
 *
 * @param {Array} schedules  [{ id, name, courses: [...] }]
 * @param {Object} options   voir DEFAULTS
 */
export function compare(schedules, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const list = (schedules || []).filter((s) => s && Array.isArray(s.courses));
  const result = {
    people: list.map((s) => ({ id: s.id, name: s.name })),
    days: [],
    teachers: [],
    subjects: [],
    sameClass: [],
    totals: { together: 0, gaps: 0, free: 0, lunch: 0 },
    best: { free: null, gap: null, lunch: null },
  };
  if (list.length < 2) return result;

  for (let day = 0; day < 7; day += 1) {
    const present = list.filter((s) => coursesOf(s, day).length);
    if (present.length < 2) {
      // Une seule personne (ou aucune) a cours : rien à mettre en commun ce jour-là.
      if (present.length === 1) {
        result.days.push({
          day, name: DAYS[day], present: present.map((s) => s.id), partial: true,
          together: [], gaps: [], free: [], lunch: [], starts: null, ends: null,
        });
      }
      continue;
    }

    const windows = present.map((s) => dayWindow(s, day));
    const win = { start: Math.min(...windows.map((w) => w.start)), end: Math.max(...windows.map((w) => w.end)) };

    // Toutes les personnes comptent, même celles qui n'ont pas cours ce jour-là :
    // elles sont alors libres sur toute l'amplitude commune.
    const busyLists = list.map((s) => clip(busyOf(s, day), win));
    const freeLists = busyLists.map((b) => subtract([win], b));

    // 1. En cours en même temps.
    const together = intersectAll(busyLists)
      .filter((i) => i.end - i.start >= cfg.minCommon)
      .map((i) => {
        const who = list.map((s) => ({ id: s.id, name: s.name, course: courseAt(s, day, i.start + 1) }));
        const withCourse = who.filter((w) => w.course);
        const identical = withCourse.length === list.length
          && withCourse.every((w) => sameCourse(w.course, withCourse[0].course));
        return { ...i, who: withCourse, sameCourse: identical };
      });

    // 2. Libres en même temps, à l'intérieur de la journée du groupe.
    const free = intersectAll(freeLists).filter((i) => i.end - i.start >= cfg.minCommon);

    // 3. Trous : du temps libre commun coincé entre deux cours pour au moins un.
    const gaps = free.filter((i) => present.some((s) => {
      const w = dayWindow(s, day);
      return w && i.start >= w.start && i.end <= w.end;
    }));

    // 4. Déjeuner : le temps libre commun qui tombe sur la pause du midi.
    const lunch = clip(free, cfg.lunch).filter((i) => i.end - i.start >= cfg.minLunch);

    // 5. Débuts et fins de journée.
    const starts = groupTimes(present.map((s) => ({ id: s.id, name: s.name, time: dayWindow(s, day).start })), cfg.tolerance);
    const ends = groupTimes(present.map((s) => ({ id: s.id, name: s.name, time: dayWindow(s, day).end })), cfg.tolerance);

    result.days.push({
      day, name: DAYS[day], present: present.map((s) => s.id), partial: present.length < list.length,
      window: win, together, free, gaps, lunch, starts, ends,
    });

    result.totals.together += totalMinutes(together);
    result.totals.free += totalMinutes(free);
    result.totals.gaps += totalMinutes(gaps);
    result.totals.lunch += totalMinutes(lunch);
    result.best.free = longest(result.best.free, free, day);
    result.best.gap = longest(result.best.gap, gaps, day);
    result.best.lunch = longest(result.best.lunch, lunch, day);
  }

  result.teachers = commonTeachers(list);
  result.subjects = commonSubjects(list);
  result.sameClass = sameClassCourses(list);
  return result;
}

/** Regroupe des horaires identiques : « Lou et Sam commencent à 8h, Max à 9h ». */
export function groupTimes(entries, tolerance = 0) {
  const groups = [];
  for (const e of [...entries].sort((a, b) => a.time - b.time)) {
    const g = groups.find((x) => Math.abs(x.time - e.time) <= tolerance);
    if (g) g.people.push({ id: e.id, name: e.name });
    else groups.push({ time: e.time, people: [{ id: e.id, name: e.name }] });
  }
  return {
    groups,
    same: groups.length === 1,
    time: groups.length === 1 ? groups[0].time : null,
    spread: groups.length ? groups[groups.length - 1].time - groups[0].time : 0,
  };
}

function longest(current, intervals, day) {
  let best = current;
  for (const i of intervals) {
    const len = i.end - i.start;
    if (!best || len > best.end - best.start) best = { ...i, day };
  }
  return best;
}

/* ─────────────────────────── Profs, matières, classes ─────────────────────────── */

/** Professeurs partagés par au moins deux personnes. */
export function commonTeachers(schedules) {
  const byKey = new Map();
  for (const s of schedules) {
    for (const c of s.courses || []) {
      const key = teacherKey(c.teacher);
      if (!key || key.length < 2) continue;
      if (!byKey.has(key)) byKey.set(key, { key, label: c.teacher, people: new Map() });
      const entry = byKey.get(key);
      if (String(c.teacher).length > String(entry.label).length) entry.label = c.teacher;
      if (!entry.people.has(s.id)) entry.people.set(s.id, { id: s.id, name: s.name, subjects: new Set(), hours: 0, slots: [] });
      const p = entry.people.get(s.id);
      p.subjects.add(c.subject || '—');
      p.hours += (c.end - c.start) / 60;
      p.slots.push({ day: c.day, start: c.start, end: c.end, room: c.room });
    }
  }
  return [...byKey.values()]
    .map((e) => ({
      key: e.key,
      label: e.label,
      people: [...e.people.values()].map((p) => ({ ...p, subjects: [...p.subjects] })),
    }))
    .filter((e) => e.people.length >= 2)
    .sort((a, b) => b.people.length - a.people.length || a.label.localeCompare(b.label, 'fr'));
}

/** Matières suivies par tout le monde (et par qui, si ce n'est pas tout le monde). */
export function commonSubjects(schedules) {
  const byKey = new Map();
  for (const s of schedules) {
    for (const c of s.courses || []) {
      if (c.kind === 'pause') continue;
      const key = subjectKey(c.subject);
      if (!key || key.length < 2) continue;
      if (!byKey.has(key)) byKey.set(key, { key, label: c.subject, people: new Map() });
      const e = byKey.get(key);
      if (!e.people.has(s.id)) e.people.set(s.id, { id: s.id, name: s.name, hours: 0 });
      e.people.get(s.id).hours += (c.end - c.start) / 60;
    }
  }
  return [...byKey.values()]
    .map((e) => ({ key: e.key, label: e.label, people: [...e.people.values()] }))
    .filter((e) => e.people.length >= 2)
    .sort((a, b) => b.people.length - a.people.length || a.label.localeCompare(b.label, 'fr'));
}

/** Cours où l'on est visiblement assis dans la même salle, avec le même prof. */
export function sameClassCourses(schedules) {
  const out = [];
  for (let i = 0; i < schedules.length; i += 1) {
    for (let j = i + 1; j < schedules.length; j += 1) {
      for (const a of schedules[i].courses || []) {
        for (const b of schedules[j].courses || []) {
          if (a.day !== b.day || !sameCourse(a, b)) continue;
          out.push({
            day: a.day,
            start: a.start,
            end: a.end,
            subject: a.subject || b.subject,
            teacher: a.teacher || b.teacher,
            room: a.room || b.room,
            people: [
              { id: schedules[i].id, name: schedules[i].name },
              { id: schedules[j].id, name: schedules[j].name },
            ],
          });
        }
      }
    }
  }
  // Trois personnes dans le même cours donnent trois paires : on les regroupe.
  const grouped = new Map();
  for (const x of out) {
    const key = `${x.day}|${Math.round(x.start / 15)}|${teacherKey(x.teacher)}|${subjectKey(x.subject)}`;
    const cur = grouped.get(key);
    if (!cur) { grouped.set(key, x); continue; }
    cur.start = Math.min(cur.start, x.start);
    cur.end = Math.max(cur.end, x.end);
    for (const p of x.people) if (!cur.people.some((q) => q.id === p.id)) cur.people.push(p);
  }
  return [...grouped.values()].sort((a, b) => a.day - b.day || a.start - b.start);
}

/* ─────────────────────────── Mise en phrases ─────────────────────────── */

const liste = (noms) => (noms.length <= 1 ? (noms[0] || '') : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`);

/** Une phrase française pour un groupe d'horaires (début ou fin de journée). */
export function phraseGroups(g, { verb = 'commencent', verbOne = 'commence' } = {}) {
  if (!g || !g.groups.length) return '';
  if (g.same) return `Tout le monde ${verbOne} à ${fmtTime(g.time)}.`;
  return g.groups
    .map((x) => `${liste(x.people.map((p) => p.name))} ${x.people.length > 1 ? verb : verbOne} à ${fmtTime(x.time)}`)
    .join(' · ');
}

export const phraseSlot = (i) => `${fmtTime(i.start)} → ${fmtTime(i.end)} (${fmtDuration(i.end - i.start)})`;
