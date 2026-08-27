/**
 * Emploi du temps — mémoire locale.
 *
 * Tout reste dans le navigateur : ni compte, ni serveur, ni envoi de photo.
 * Le partage se fait par un fichier que l'on s'échange comme on veut.
 */

const KEY = 'edt.v1';

export const COLORS = ['#0b5fd0', '#c0332b', '#0f7a45', '#9a5b00', '#6b3fa0', '#0d7f8c'];

export const DEFAULT_OPTIONS = {
  quality: 'precise',    // dictionnaire Tesseract : 'precise' (6 Mo) ou 'fast' (0,6 Mo)
  minCommon: 15,         // durée minimale d'un créneau commun, en minutes
  minLunch: 30,
  tolerance: 0,          // « en même temps » à ± n minutes
};

export const newId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const empty = () => ({ schedules: [], options: { ...DEFAULT_OPTIONS } });

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw);
    return {
      schedules: Array.isArray(data.schedules) ? data.schedules : [],
      options: { ...DEFAULT_OPTIONS, ...(data.options || {}) },
    };
  } catch { return empty(); }
}

export function save(state) {
  const payload = { ...state, savedAt: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
    return true;
  } catch {
    // Plus de place : on sacrifie les vignettes, jamais les cours.
    try {
      const light = { ...payload, schedules: payload.schedules.map((s) => ({ ...s, preview: null })) };
      localStorage.setItem(KEY, JSON.stringify(light));
      return true;
    } catch { return false; }
  }
}

export function nextColor(schedules) {
  const used = new Set(schedules.map((s) => s.color));
  return COLORS.find((c) => !used.has(c)) || COLORS[schedules.length % COLORS.length];
}

/** Fichier d'échange : lisible, réimportable, sans photo. */
export function toFile(state) {
  const data = {
    format: 'emploi-du-temps-en-commun',
    version: 1,
    exportedAt: new Date().toISOString(),
    schedules: state.schedules.map(({ id, name, color, courses, source }) => ({ id, name, color, source, courses })),
  };
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

export async function fromFile(file) {
  const data = JSON.parse(await file.text());
  const list = Array.isArray(data) ? data : data.schedules;
  if (!Array.isArray(list)) throw new Error('Fichier non reconnu');
  return list
    .filter((s) => s && Array.isArray(s.courses))
    .map((s) => ({
      id: newId(),
      name: String(s.name || 'Sans nom').slice(0, 30),
      color: s.color || COLORS[0],
      source: s.source || 'fichier',
      courses: s.courses
        .filter((c) => Number.isFinite(c.day) && Number.isFinite(c.start) && Number.isFinite(c.end))
        .map((c) => ({
          day: Math.max(0, Math.min(6, Math.round(c.day))),
          start: Math.round(c.start),
          end: Math.round(c.end),
          subject: String(c.subject || '').slice(0, 60),
          teacher: String(c.teacher || '').slice(0, 40),
          room: String(c.room || '').slice(0, 20),
          kind: c.kind === 'pause' ? 'pause' : 'cours',
        })),
    }));
}
