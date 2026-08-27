/**
 * Emploi du temps — de la photo au tableau de cours.
 *
 * Ce module ne contient QUE de la géométrie et des expressions régulières :
 * il reçoit les mots repérés par l'OCR (chacun avec sa boîte dans l'image) et
 * en déduit la grille — quel jour, quel créneau, quelle matière, quel prof.
 *
 * Aucune dépendance au DOM ni au réseau : tout est rejouable hors navigateur
 * (voir tests/edt.test.mjs). Aucun service d'intelligence artificielle n'est
 * appelé, ni ici ni ailleurs : la lecture de l'image est faite par Tesseract,
 * moteur OCR libre, qui tourne entièrement dans le téléphone.
 */

export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/** Noms de jours acceptés, du plus long au plus court (jamais moins de 3 lettres). */
const DAY_KEYS = [
  ['LUNDI', 'LUN'],
  ['MARDI', 'MAR'],
  ['MERCREDI', 'MERCRE', 'MERC', 'MER'],
  ['JEUDI', 'JEU'],
  ['VENDREDI', 'VENDRE', 'VEND', 'VEN'],
  ['SAMEDI', 'SAM'],
  ['DIMANCHE', 'DIM'],
];

/* ─────────────────────────── Texte ─────────────────────────── */

export const stripAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Majuscules, sans accent : la seule forme sur laquelle on compare. */
export const norm = (s) => stripAccents(s).toUpperCase().replace(/\s+/g, ' ').trim();

/** Distance de Levenshtein, bornée : sert à absorber une lettre mal lue. */
export function levenshtein(a, b) {
  const m = a.length; const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    const cur = [i];
    for (let j = 1; j <= n; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** Indice du jour (0 = lundi) pour un mot, ou -1. Tolère une faute de lecture. */
export function dayIndexOf(token) {
  const t = norm(token).replace(/[^A-Z]/g, '');
  if (t.length < 3) return -1;
  for (let i = 0; i < DAY_KEYS.length; i += 1) {
    for (const key of DAY_KEYS[i]) {
      if (t === key) return i;
      if (key.length >= 5 && Math.abs(t.length - key.length) <= 1 && levenshtein(t, key) <= 1) return i;
    }
  }
  return -1;
}

/* ─────────────────────────── Heures ─────────────────────────── */

/** Confusions courantes de l'OCR, appliquées seulement à un jeton horaire. */
const digitFix = (s) => s.replace(/[OoQ°]/g, '0').replace(/[lI|!]/g, '1').replace(/[ \s]/g, '');

/**
 * « 8h », « 8h30 », « 08:00 », « 8.30 », « 8 H 15 » → minutes depuis minuit.
 * `bare` autorise un nombre seul (« 8 »), utile dans la colonne des heures.
 */
export function parseTime(raw, { bare = false } = {}) {
  const t = digitFix(String(raw ?? '').trim());
  if (!t) return null;
  let m = /^(\d{1,2})[Hh:.,](\d{2})$/.exec(t)
    || /^(\d{1,2})[Hh:.,](\d)$/.exec(t)
    || /^(\d{1,2})[Hh]$/.exec(t)
    || /^(\d{1,2})[Hh:.,]$/.exec(t);
  if (!m && /^\d{4}$/.test(t)) m = [t, t.slice(0, 2), t.slice(2)];
  if (!m && bare && /^\d{1,2}$/.test(t)) m = [t, t, '0'];
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] == null || m[2] === '' ? 0 : Number(m[2].length === 1 ? `${m[2]}0` : m[2]);
  if (!(h >= 0 && h <= 23) || !(min >= 0 && min <= 59)) return null;
  return h * 60 + min;
}

/** Cherche « 8h00 - 10h00 » dans un texte de cellule. */
export function parseRange(text) {
  const t = String(text ?? '').replace(/[ ]/g, ' ');
  const re = /(\d{1,2}\s*[HhOo:.,]\s*\d{0,2})\s*(?:-|–|—|\/|à|a|au)\s*(\d{1,2}\s*[HhOo:.,]?\s*\d{0,2})/;
  const m = re.exec(t);
  if (!m) return null;
  const start = parseTime(m[1]);
  const end = parseTime(m[2]) ?? parseTime(m[2], { bare: true });
  if (start == null || end == null || end <= start || end - start > 8 * 60) return null;
  return { start, end, matched: m[0] };
}

/** 495 → « 8h15 ». */
export function fmtTime(min) {
  if (min == null || !Number.isFinite(min)) return '—';
  const h = Math.floor(min / 60); const m = Math.round(min % 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}

/** 95 → « 1 h 35 ». */
export function fmtDuration(min) {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  if (!h) return `${m} min`;
  return m % 60 ? `${h} h ${String(m % 60).padStart(2, '0')}` : `${h} h`;
}

export const snapTo = (min, step = 5) => Math.round(min / step) * step;

/* ─────────────── Axe des heures : y (pixels) → minutes ─────────────── */

function leastSquares(points) {
  const n = points.length;
  let sx = 0; let sy = 0; let sxx = 0; let sxy = 0;
  for (const p of points) { sx += p.y; sy += p.minutes; sxx += p.y * p.y; sxy += p.y * p.minutes; }
  const den = n * sxx - sx * sx;
  if (!den) return null;
  const a = (n * sxy - sx * sy) / den;
  const b = (sy - a * sx) / n;
  return { a, b };
}

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((x, y) => x - y);
  const h = Math.floor(s.length / 2);
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};

/**
 * Droite « minutes = a·y + b » ajustée sur les repères horaires trouvés,
 * en écartant les points aberrants (un « 8h » lu à la place d'un « 3h »).
 */
export function fitAxis(samples) {
  const pts = samples.filter((p) => Number.isFinite(p.y) && Number.isFinite(p.minutes));
  if (pts.length < 2) return null;

  const plausible = (a) => a > 0.008 && a <= 12;
  const finish = (inliers) => {
    const fit = leastSquares(inliers);
    if (!fit || !Number.isFinite(fit.a) || !plausible(fit.a)) return null;
    const rmse = Math.sqrt(inliers.reduce((s, p) => s + (fit.a * p.y + fit.b - p.minutes) ** 2, 0) / inliers.length);
    return {
      a: fit.a,
      b: fit.b,
      n: inliers.length,
      rmse,
      toMinutes: (y) => fit.a * y + fit.b,
      toY: (min) => (min - fit.b) / fit.a,
    };
  };

  if (pts.length === 2) return finish(pts);

  // Une seule heure mal lue suffit à faire basculer une régression : on cherche
  // donc la droite qui met le plus de repères d'accord (le reste est écarté).
  let best = null;
  for (let i = 0; i < pts.length; i += 1) {
    for (let j = i + 1; j < pts.length; j += 1) {
      const dy = pts[j].y - pts[i].y;
      if (Math.abs(dy) < 1e-6) continue;
      const a = (pts[j].minutes - pts[i].minutes) / dy;
      if (!plausible(a)) continue;
      const b = pts[i].minutes - a * pts[i].y;
      const inliers = pts.filter((p) => Math.abs(a * p.y + b - p.minutes) <= 10);
      const err = inliers.reduce((s, p) => s + Math.abs(a * p.y + b - p.minutes), 0);
      if (!best || inliers.length > best.inliers.length
        || (inliers.length === best.inliers.length && err < best.err)) best = { inliers, err };
    }
  }
  if (!best || best.inliers.length < 2) return null;
  return finish(best.inliers);
}

/* ─────────────────────────── Mots et lignes ─────────────────────────── */

const cx = (w) => (w.x0 + w.x1) / 2;
const cy = (w) => (w.y0 + w.y1) / 2;
const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** Normalise ce que renvoie l'OCR et jette le bruit (points, traits, ratés). */
export function cleanWords(raw, { minConf = 30 } = {}) {
  return (raw || [])
    .map((w) => ({
      text: String(w.text ?? '').replace(/\s+/g, ' ').trim(),
      conf: Number.isFinite(w.conf) ? w.conf : 100,
      x0: Math.min(w.x0, w.x1),
      x1: Math.max(w.x0, w.x1),
      y0: Math.min(w.y0, w.y1),
      y1: Math.max(w.y0, w.y1),
    }))
    .filter((w) => w.text && w.x1 > w.x0 && w.y1 > w.y0)
    .filter((w) => w.conf >= minConf || /\d/.test(w.text))
    .filter((w) => !/^[^\p{L}\p{N}]+$/u.test(w.text));
}

/** Regroupe des mots en lignes de texte (ils se chevauchent verticalement). */
export function groupLines(words) {
  const sorted = [...words].sort((a, b) => cy(a) - cy(b) || a.x0 - b.x0);
  const lines = [];
  for (const w of sorted) {
    const h = w.y1 - w.y0;
    const line = lines.find((L) => overlap(L.y0, L.y1, w.y0, w.y1) > 0.45 * Math.min(L.y1 - L.y0, h));
    if (line) {
      line.words.push(w);
      line.y0 = Math.min(line.y0, w.y0); line.y1 = Math.max(line.y1, w.y1);
      line.x0 = Math.min(line.x0, w.x0); line.x1 = Math.max(line.x1, w.x1);
    } else {
      lines.push({ words: [w], x0: w.x0, x1: w.x1, y0: w.y0, y1: w.y1 });
    }
  }
  for (const L of lines) {
    L.words.sort((a, b) => a.x0 - b.x0);
    L.text = L.words.map((w) => w.text).join(' ');
  }
  return lines.sort((a, b) => a.y0 - b.y0);
}

/* ─────────────────────────── Colonnes des jours ─────────────────────────── */

/** Repère les en-têtes « LUNDI », « MARDI »… parmi les mots. */
export function findDayHeaders(words) {
  const found = [];
  for (const w of words) {
    const d = dayIndexOf(w.text);
    if (d >= 0) found.push({ day: d, ...w });
  }
  // Un même jour peut être lu deux fois : on garde l'occurrence la plus haute.
  const best = new Map();
  for (const f of found) {
    const cur = best.get(f.day);
    if (!cur || f.y0 < cur.y0) best.set(f.day, f);
  }
  return [...best.values()].sort((a, b) => cx(a) - cx(b));
}

/** Bandes verticales : une par jour, frontières à mi-chemin entre deux en-têtes. */
export function bandsFromHeaders(headers, bounds) {
  const sorted = [...headers].sort((a, b) => cx(a) - cx(b));
  const centers = sorted.map(cx);
  const widths = [];
  for (let i = 1; i < centers.length; i += 1) widths.push(centers[i] - centers[i - 1]);
  const step = widths.length ? median(widths) : (bounds.x1 - bounds.x0) / Math.max(1, sorted.length);

  return sorted.map((h, i) => {
    const left = i === 0 ? centers[0] - step / 2 : (centers[i - 1] + centers[i]) / 2;
    const right = i === sorted.length - 1 ? centers[i] + step / 2 : (centers[i] + centers[i + 1]) / 2;
    return { day: h.day, x0: Math.max(bounds.x0, left), x1: Math.min(bounds.x1, right), header: h };
  });
}

/* ─────────────────────────── Contenu d'une cellule ─────────────────────────── */

const ROOM_WORDS = /^(CDI|GYMNASE|GYM|AMPHI|LABO|ATELIER|PERM|EXT|DISTANCIEL|STADE|PISCINE)$/;
const CIVILITY = /^(M|MR|MME|MLLE|MLE|MADAME|MONSIEUR|PROF|PR)\.?$/;
const PAUSE_RE = /^(PAUSE|RECRE|RECREATION|DEJEUNER|DEJ|REPAS|MIDI|CANTINE|INTERCLASSE|LIBRE)\b/;

/** « MATHEMATIQUES » → « Mathématiques » n'est pas possible sans dictionnaire :
 *  on se contente d'une casse lisible, en gardant les sigles courts. */
export function prettyCase(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/(^|[\s'’\-/(])([\p{L}])/gu, (_, p, c) => p + c.toUpperCase())
    .replace(/\b(Svt|Eps|Ses|Llce|Hlp|Hggsp|Nsi|Sti2d|Stmg|Pc|Es|Vf|Td|Tp|Cdi|Ue|Lv1|Lv2|Lva|Lvb|Tp1|Tp2|Amc|Dnl|Ap)\b/g, (m) => m.toUpperCase());
}

/** Sépare le contenu d'une cellule en matière / professeur / salle. */
export function splitCell(lines) {
  const raw = lines.map((L) => L.text.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const rest = [];
  let teacher = '';
  let room = '';

  for (const line of raw) {
    let text = line;

    // Salle : « Salle 204 », « S. B12 », « Gymnase »…
    const mRoom = /\b(?:SALLES?|SLL?|S)\s*\.?\s*:?\s*([A-Z]{0,3}\s?-?\s?\d{1,3}[A-Z]?)\b/i.exec(stripAccents(text));
    if (!room && mRoom) {
      room = mRoom[1].replace(/\s+/g, '');
      text = text.replace(new RegExp(`\\S*${mRoom[0].trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\S*`, 'i'), ' ');
    }
    if (!room) {
      const tokens = text.split(/[\s,;]+/).filter(Boolean);
      const solo = tokens.find((tk, i) => ROOM_WORDS.test(norm(tk))
        || ((raw.indexOf(line) > 0 || (i === tokens.length - 1 && tokens.length > 1))
          && /^[A-Z]{0,2}-?\d{2,3}[A-Z]?$/.test(norm(tk))));
      if (solo) { room = ROOM_WORDS.test(norm(solo)) ? prettyCase(solo) : norm(solo); text = text.replace(solo, ' '); }
    }

    // Professeur : civilité explicite, puis nom.
    const mTeacher = /\b(M|MR|MME|MLLE|MLE)\.?\s+([\p{L}][\p{L}'’\-]{1,}(?:\s+[\p{L}][\p{L}'’\-]+)?)/iu.exec(text);
    if (!teacher && mTeacher) {
      const civ = { M: 'M.', MR: 'M.', MME: 'Mme', MLLE: 'Mlle', MLE: 'Mlle' }[mTeacher[1].toUpperCase()] || 'M.';
      teacher = `${civ} ${prettyCase(mTeacher[2])}`.trim();
      text = text.replace(mTeacher[0], ' ');
    }

    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned) rest.push(cleaned);
  }

  // Sans civilité : une ligne courte, sans chiffre, autre que la première, fait un nom.
  if (!teacher && rest.length > 1) {
    for (let i = rest.length - 1; i >= 1; i -= 1) {
      const tokens = rest[i].split(/\s+/).filter(Boolean);
      const looksName = tokens.length <= 3
        && !/\d/.test(rest[i])
        && rest[i].length >= 3
        && tokens.every((tk) => !CIVILITY.test(norm(tk)))
        && norm(rest[i]) === rest[i].toUpperCase().replace(/\s+/g, ' ').trim();
      if (looksName) { teacher = prettyCase(rest[i]); rest.splice(i, 1); break; }
    }
  }

  const subject = prettyCase(rest.join(' ').replace(/\s+/g, ' ').trim());
  return { subject, teacher, room };
}

/** Clé de comparaison d'un professeur : le nom de famille, sans civilité ni accent. */
export function teacherKey(name) {
  const t = norm(name).replace(/[^A-Z\s'’\-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const tokens = t.split(' ').filter((tk) => !CIVILITY.test(tk.replace('.', '')));
  if (!tokens.length) return '';
  // « DUPONT J. » ou « J. DUPONT » : le nom de famille est le jeton le plus long.
  return tokens.reduce((a, b) => (b.length > a.length ? b : a), '');
}

/** Clé de comparaison d'une matière (les abréviations d'un lycée à l'autre). */
const SUBJECT_ALIASES = [
  [/^(MATHS?|MATHEMATIQUES?|MATH)\b/, 'MATHEMATIQUES'],
  [/^(FRANC|FRANCAIS|FR)\b/, 'FRANCAIS'],
  [/^(HIST|HISTOIRE|HG|HIST[- ]?GEO|HISTOIRE[- ]?GEOGRAPHIE)\b/, 'HISTOIRE-GEO'],
  [/^(ANG|ANGLAIS|LV1 ANGLAIS|LVA)\b/, 'ANGLAIS'],
  [/^(ESP|ESPAGNOL|LV2 ESPAGNOL|LVB)\b/, 'ESPAGNOL'],
  [/^(ALL|ALLEMAND)\b/, 'ALLEMAND'],
  [/^(PHYS|PHYSIQUE|PHYSIQUE[- ]?CHIMIE|PC)\b/, 'PHYSIQUE-CHIMIE'],
  [/^(SVT|BIO|BIOLOGIE)\b/, 'SVT'],
  [/^(EPS|SPORT)\b/, 'EPS'],
  [/^(SES|ECO|ECONOMIE)\b/, 'SES'],
  [/^(PHILO|PHILOSOPHIE)\b/, 'PHILOSOPHIE'],
  [/^(NSI|INFO|INFORMATIQUE)\b/, 'NSI'],
];

export function subjectKey(subject) {
  const s = norm(subject).replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [re, key] of SUBJECT_ALIASES) if (re.test(s)) return key;
  return s;
}

/* ─────────────────────────── Lecture complète ─────────────────────────── */

const DEFAULTS = {
  minConf: 30,
  defaultDuration: 60,
  minDuration: 20,
  maxDuration: 5 * 60,
  snap: 5,
};

/** Échange x et y : permet de traiter à l'identique une grille couchée. */
const transposeWord = (w) => ({ ...w, x0: w.y0, x1: w.y1, y0: w.x0, y1: w.x1 });

/**
 * Lecture principale.
 *
 * @param {Array} rawWords  mots de l'OCR : { text, conf, x0, y0, x1, y1 }
 * @param {Object} opts     { rulings: { rows: number[] }, ...réglages }
 * @returns {{ courses: Array, warnings: string[], quality: number, layout: Object }}
 */
export function readSchedule(rawWords, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const warnings = [];
  let words = cleanWords(rawWords, cfg);
  if (words.length < 6) {
    return { courses: [], warnings: ['Presque rien n’a pu être lu sur cette image.'], quality: 0, layout: {} };
  }

  // Grille couchée (jours en lignes) : on pivote tout, le reste est identique.
  let headers = findDayHeaders(words);
  let rowEdges = (cfg.rulings?.rows || []).slice().sort((a, b) => a - b);
  let transposed = false;
  if (headers.length >= 2) {
    const spreadX = Math.max(...headers.map(cx)) - Math.min(...headers.map(cx));
    const spreadY = Math.max(...headers.map(cy)) - Math.min(...headers.map(cy));
    if (spreadY > spreadX * 1.6) {
      transposed = true;
      words = words.map(transposeWord);
      headers = findDayHeaders(words);
      rowEdges = (cfg.rulings?.cols || []).slice().sort((a, b) => a - b);
    }
  }

  const bounds = {
    x0: Math.min(...words.map((w) => w.x0)),
    x1: Math.max(...words.map((w) => w.x1)),
    y0: Math.min(...words.map((w) => w.y0)),
    y1: Math.max(...words.map((w) => w.y1)),
  };

  if (headers.length < 2) {
    return {
      courses: [],
      warnings: ['Aucune colonne de jour reconnue (Lundi, Mardi…). Vérifiez que la photo est bien droite et que les titres des jours sont nets.'],
      quality: 0,
      layout: { transposed },
    };
  }
  if (headers.length < 4) warnings.push(`Seulement ${headers.length} jours reconnus : les autres colonnes seront ignorées.`);

  const bands = bandsFromHeaders(headers, bounds);
  const headerBottom = Math.max(...headers.map((h) => h.y1));

  // 1. Colonne des heures : à gauche du premier jour, sous les en-têtes.
  const gutter = [];
  for (const w of words) {
    if (cy(w) <= headerBottom || cx(w) >= headers[0].x0) continue;
    const min = parseTime(w.text) ?? parseTime(w.text, { bare: true });
    if (min != null && min >= 5 * 60 && min <= 22 * 60) gutter.push({ w, min });
  }
  // Cette colonne ne fait pas partie du lundi : on recale le bord de la grille.
  if (gutter.length >= 2) {
    const edge = Math.max(...gutter.map((g) => g.w.x1)) + 2;
    if (edge > bands[0].x0 && edge < cx(bands[0].header)) bands[0].x0 = edge;
  }
  const gridLeft = Math.min(...bands.map((b) => b.x0));
  const samples = gutter.map((g) => ({ y: cy(g.w), minutes: g.min, from: 'gutter' }));

  // 2. Repères supplémentaires : les créneaux écrits dans les cellules elles-mêmes.
  const inGrid = words.filter((w) => cy(w) > headerBottom && cx(w) >= gridLeft);
  const gridLines = groupLines(inGrid);
  for (const L of gridLines) {
    const r = parseRange(L.text);
    if (r) samples.push({ y: cy(L), minutes: (r.start + r.end) / 2, from: 'cell' });
  }

  let axis = fitAxis(samples);
  if (!axis) {
    // Dernier recours : la grille est supposée aller de 8h à 18h de haut en bas.
    const top = headerBottom + 2;
    const bottom = Math.max(bounds.y1, top + 10);
    axis = fitAxis([{ y: top, minutes: 8 * 60 }, { y: bottom, minutes: 18 * 60 }]);
    warnings.push('Aucune heure lisible sur le côté : les horaires sont estimés (8h–18h) et sont sûrement à corriger.');
  }

  // 3. Découpage en cellules, colonne par colonne.
  const medianH = median(gridLines.map((L) => L.y1 - L.y0)) || 12;
  const courses = [];

  for (const band of bands) {
    const mine = inGrid.filter((w) => overlap(band.x0, band.x1, w.x0, w.x1) > 0.5 * (w.x1 - w.x0));
    if (!mine.length) continue;
    const lines = groupLines(mine);

    const bandRows = (!transposed && typeof cfg.rowsForBand === 'function'
      ? (cfg.rowsForBand(band.x0, band.x1) || []).slice().sort((a, b) => a - b)
      : rowEdges);

    const cells = [];
    for (const L of lines) {
      const cur = cells[cells.length - 1];
      const gap = cur ? L.y0 - cur.y1 : Infinity;
      const crossesRule = cur ? bandRows.some((y) => y > cur.y1 - 1 && y < L.y0 + 1) : false;
      if (!cur || gap > 0.85 * medianH || crossesRule) {
        cells.push({ lines: [L], x0: L.x0, x1: L.x1, y0: L.y0, y1: L.y1 });
      } else {
        cur.lines.push(L);
        cur.y1 = Math.max(cur.y1, L.y1); cur.x0 = Math.min(cur.x0, L.x0); cur.x1 = Math.max(cur.x1, L.x1);
      }
    }

    for (const cell of cells) {
      const text = cell.lines.map((L) => L.text).join(' ');
      if (!/[\p{L}]{2}/u.test(text)) continue;             // une cellule sans lettre n'est pas un cours

      // a) créneau écrit dans la cellule : c'est la source la plus sûre.
      const explicit = parseRange(text);
      let start; let end; let source;
      if (explicit) {
        ({ start, end } = explicit);
        source = 'texte';
      } else if (bandRows.length >= 2) {
        // b) le cours occupe les lignes du tableau que son texte recouvre.
        const rows = [];
        for (let i = 1; i < bandRows.length; i += 1) {
          const top = bandRows[i - 1]; const bot = bandRows[i];
          if (bot - top < 4) continue;
          // Le texte est dans la case s'il la recouvre franchement, ou si son
          // milieu y tombe — un cours de quatre heures n'a que trois lignes.
          const middle = (cell.y0 + cell.y1) / 2;
          const inside = middle >= top && middle < bot;
          if (inside || overlap(top, bot, cell.y0, cell.y1) > 0.25 * (bot - top)) rows.push([top, bot]);
        }
        if (rows.length) {
          start = axis.toMinutes(rows[0][0]);
          end = axis.toMinutes(rows[rows.length - 1][1]);
          source = 'grille';
        }
      }
      if (start == null) {
        // c) à défaut, la position verticale du texte, marge comprise.
        start = axis.toMinutes(cell.y0 - 0.35 * medianH);
        end = axis.toMinutes(cell.y1 + 0.35 * medianH);
        source = 'position';
      }

      start = snapTo(start, cfg.snap);
      end = snapTo(end, cfg.snap);
      if (end - start < cfg.minDuration) end = start + cfg.defaultDuration;
      if (end - start > cfg.maxDuration) end = start + cfg.maxDuration;

      const fields = splitCell(cell.lines);
      const cleanSubject = explicit
        ? prettyCase(norm(text).replace(norm(explicit.matched), ' ').replace(/\s+/g, ' ').trim())
        : fields.subject;
      const found = explicit ? splitCell([{ text: cleanSubject }]).subject : fields.subject;
      const subject = found || 'Cours';

      courses.push({
        day: band.day,
        start,
        end,
        subject,
        teacher: explicit ? (fields.teacher || splitCell([{ text: cleanSubject }]).teacher) : fields.teacher,
        room: fields.room,
        kind: PAUSE_RE.test(norm(subject)) ? 'pause' : 'cours',
        incomplete: !found || undefined,
        source,
        conf: Math.round(median(cell.lines.flatMap((L) => L.words.map((w) => w.conf)))),
      });
    }
  }

  const merged = mergeAdjacent(courses.sort((a, b) => a.day - b.day || a.start - b.start));
  const sansMatiere = merged.filter((c) => c.incomplete).length;
  if (sansMatiere) {
    warnings.push(`${sansMatiere} cours ${sansMatiere > 1 ? 'sont' : 'est'} sans matière lisible : à compléter.`);
  }
  const quality = qualityScore(merged, axis, warnings);
  if (!merged.length) warnings.push('Aucun cours n’a pu être isolé : la photo est peut-être trop floue ou trop inclinée.');

  return {
    courses: merged,
    warnings,
    quality,
    layout: { transposed, days: bands.map((b) => b.day), axis: { a: axis.a, b: axis.b, n: axis.n }, samples: samples.length },
  };
}

/** Deux cellules identiques qui se touchent sont un seul cours de deux heures. */
export function mergeAdjacent(courses, tolerance = 6) {
  const out = [];
  for (const c of courses) {
    const prev = out[out.length - 1];
    const same = prev && prev.day === c.day
      && subjectKey(prev.subject) === subjectKey(c.subject)
      && teacherKey(prev.teacher) === teacherKey(c.teacher)
      && c.start - prev.end <= tolerance && c.start - prev.end >= -tolerance;
    if (same) prev.end = Math.max(prev.end, c.end);
    else out.push({ ...c });
  }
  return out;
}

/** Note de confiance grossière, affichée à l'utilisateur pour l'inciter à vérifier. */
function qualityScore(courses, axis, warnings) {
  if (!courses.length) return 0;
  let score = 55;
  if (axis?.n >= 4) score += 15; else if (axis?.n >= 2) score += 5;
  if (axis && axis.rmse < 8) score += 10;
  const named = courses.filter((c) => c.teacher).length / courses.length;
  score += Math.round(named * 12);
  const solid = courses.filter((c) => c.source !== 'position').length / courses.length;
  score += Math.round(solid * 12);
  score -= warnings.length * 8;
  score -= Math.max(0, 6 - courses.length) * 4;
  return Math.max(5, Math.min(97, score));
}
