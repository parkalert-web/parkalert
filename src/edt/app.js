/**
 * Emploi du temps — interface.
 *
 * Trois temps : on importe des photos, on vérifie ce qui a été lu, on regarde
 * ce que l'on a en commun. Rien ne sort du navigateur.
 */

import { readTimetable, release, LANG_SIZE } from './ocr.js';
import { DAYS, fmtTime, fmtDuration } from './parse.js';
import { compare, phraseGroups, phraseSlot } from './compare.js';
import { load, save, newId, nextColor, toFile, fromFile } from './store.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}`;
const fromHhmm = (v) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const names = (list) => (list.length <= 1 ? (list[0] || '') : `${list.slice(0, -1).join(', ')} et ${list[list.length - 1]}`);

let state = load();
const previews = new Map();      // id → vignette (hors localStorage si trop lourd)
const files = new Map();         // id → fichier d'origine, pour pouvoir relire
const jobs = new Map();          // id → { label, value }
let running = false;

let quotaSignale = false;
function persist() {
  if (save(state) || quotaSignale) return;
  quotaSignale = true;
  toast('La mémoire du navigateur est pleine : exportez vos emplois du temps dans un fichier.');
}
const byId = (id) => state.schedules.find((s) => s.id === id);
const usable = () => state.schedules.filter((s) => (s.courses || []).length);

/* ══════════════════════════ Import ══════════════════════════ */

function addFiles(list) {
  const images = [...list].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name || ''));
  if (!images.length) { toast('Choisissez des images (photo ou capture d’écran).'); return; }

  for (const file of images) {
    const id = newId();
    files.set(id, file);
    state.schedules.push({
      id,
      name: `Emploi du temps ${state.schedules.length + 1}`,
      color: nextColor(state.schedules),
      source: 'photo',
      rotate: 0,
      courses: [],
      warnings: [],
      quality: null,
      fileName: file.name || 'photo',
    });
    jobs.set(id, { label: 'En attente…', value: 0 });
  }
  persist();
  render();
  runQueue();
}

async function runQueue() {
  if (running) return;
  running = true;
  try {
    while (jobs.size) {
      const id = [...jobs.keys()][0];
      const sched = byId(id);
      const file = files.get(id);
      if (!sched || !file) { jobs.delete(id); continue; }
      await readOne(sched, file);        // retire la tâche en fin de lecture
    }
  } finally {
    running = false;
    jobs.clear();
    renderPeople();
    release();                       // on rend la mémoire au téléphone
  }
}

async function readOne(sched, file) {
  const setJob = (label, value) => { jobs.set(sched.id, { label, value }); renderPeople(); };
  setJob('Préparation…', 0.02);
  try {
    const out = await readTimetable(file, {
      rotate: sched.rotate || 0,
      quality: state.options.quality,
      onProgress: (label, value) => setJob(label, value),
    });
    sched.courses = out.courses;
    sched.warnings = out.warnings;
    sched.quality = out.quality;
    sched.angle = out.angle;
    previews.set(sched.id, out.preview);
    sched.preview = out.preview;
  } catch (err) {
    console.error(err);
    sched.warnings = [err.message || 'La lecture a échoué.'];
    sched.quality = 0;
  }
  jobs.delete(sched.id);
  persist();
  render();
}

/* ══════════════════════════ Rendu : les personnes ══════════════════════════ */

function renderPeople() {
  const host = $('#people');
  if (!state.schedules.length) {
    host.innerHTML = '';
    $('#empty').hidden = false;
    return;
  }
  $('#empty').hidden = true;

  host.innerHTML = state.schedules.map((s) => {
    const job = jobs.get(s.id);
    const preview = previews.get(s.id) || s.preview;
    const nb = (s.courses || []).length;
    const days = new Set((s.courses || []).map((c) => c.day));

    const status = job
      ? `<div class="bar"><span style="width:${Math.round((job.value || 0) * 100)}%"></span></div>
         <div class="p-status">${esc(job.label)}</div>`
      : nb
        ? `<div class="p-status"><b>${nb} cours</b> sur ${days.size} jour${days.size > 1 ? 's' : ''}
             ${s.quality != null ? `· lecture ${qualityWord(s.quality)}` : ''}</div>`
        : `<div class="p-status muted">${s.source === 'photo' ? 'Rien n’a pu être lu' : 'Aucun cours pour l’instant'}</div>`;

    const warn = (s.warnings || []).length
      ? `<div class="p-warn">${s.warnings.map((w) => esc(w)).join('<br>')}</div>` : '';

    return `<article class="person" data-id="${s.id}" style="--c:${esc(s.color)}">
      <div class="p-head">
        <span class="dot"></span>
        <input class="p-name" value="${esc(s.name)}" data-act="rename" maxlength="24" aria-label="Nom"/>
        <button class="icon" data-act="del" title="Supprimer" aria-label="Supprimer">×</button>
      </div>
      <div class="p-body">
        ${preview ? `<img class="p-thumb" src="${esc(preview)}" alt="Aperçu de la photo" data-act="zoom"/>` : ''}
        <div class="p-info">
          ${status}
          ${warn}
          ${nb ? miniWeek(s) : ''}
        </div>
      </div>
      <div class="p-actions">
        <button class="btn small" data-act="edit">Vérifier / corriger</button>
        ${s.source === 'photo' ? `
          <button class="btn ghost small" data-act="rotate" title="Si la photo est de travers">Pivoter</button>
          <button class="btn ghost small" data-act="reread" ${files.has(s.id) ? '' : 'disabled title="Photo non conservée : réimportez-la"'}>Relire</button>` : ''}
      </div>
    </article>`;
  }).join('');
}

const qualityWord = (q) => (q >= 80 ? 'sûre' : q >= 55 ? 'correcte' : q > 0 ? 'incertaine — à vérifier' : 'ratée');

/** Aperçu très compact de la semaine d'une personne. */
function miniWeek(sched) {
  const cours = (sched.courses || []).filter((c) => c.end > c.start);
  if (!cours.length) return '';
  const t0 = Math.min(...cours.map((c) => c.start));
  const t1 = Math.max(...cours.map((c) => c.end));
  const span = Math.max(60, t1 - t0);
  const days = [...new Set(cours.map((c) => c.day))].sort((a, b) => a - b);
  return `<div class="mini">${days.map((d) => `
    <div class="mini-day" title="${esc(DAYS[d])}">
      <span class="mini-l">${DAYS[d].slice(0, 1)}</span>
      <div class="mini-track">${cours.filter((c) => c.day === d).map((c) => `
        <i style="top:${((c.start - t0) / span) * 100}%;height:${((c.end - c.start) / span) * 100}%"></i>`).join('')}
      </div>
    </div>`).join('')}</div>`;
}

/* ══════════════════════════ Rendu : le commun ══════════════════════════ */

function renderResults() {
  const list = usable();
  const host = $('#results');
  if (list.length < 2) {
    host.hidden = true;
    return;
  }
  host.hidden = false;

  const r = compare(list, state.options);
  $('#summary').innerHTML = tiles(r);
  $('#week').innerHTML = weekGrid(list, r);
  $('#details').innerHTML = dayCards(r) + teacherCard(r) + subjectCard(r) + sameClassCard(r);
}

function tiles(r) {
  const best = r.best.free;
  return [
    ['Libres ensemble', fmtDuration(r.totals.free), 'sur la semaine, journée commencée'],
    ['Trous en commun', fmtDuration(r.totals.gaps), 'libres au même moment, entre deux cours'],
    ['Déjeuners ensemble', fmtDuration(r.totals.lunch), 'temps libre commun entre 11h et 14h30'],
    ['Meilleur moment', best ? `${DAYS[best.day]} ${fmtTime(best.start)}` : '—', best ? `${fmtDuration(best.end - best.start)} devant vous` : 'aucun créneau commun'],
  ].map(([label, value, sub]) => `<div class="tile"><div class="t-l">${label}</div><div class="t-v">${esc(value)}</div><div class="t-s">${esc(sub)}</div></div>`).join('');
}

/** La semaine des uns par-dessus celle des autres, avec le libre commun en fond. */
function weekGrid(list, r) {
  const all = list.flatMap((s) => s.courses || []);
  if (!all.length) return '';
  const t0 = Math.floor(Math.min(...all.map((c) => c.start)) / 60) * 60;
  const t1 = Math.ceil(Math.max(...all.map((c) => c.end)) / 60) * 60;
  const span = Math.max(60, t1 - t0);
  const pct = (min) => ((min - t0) / span) * 100;
  const days = [...new Set(all.map((c) => c.day))].sort((a, b) => a - b);

  const hours = [];
  for (let h = t0; h <= t1; h += 60) hours.push(`<span style="top:${pct(h)}%">${fmtTime(h)}</span>`);

  const columns = days.map((d) => {
    const info = r.days.find((x) => x.day === d);
    const free = (info && !info.partial ? info.free : []).map((i) => `<div class="band free" style="top:${pct(i.start)}%;height:${((i.end - i.start) / span) * 100}%"></div>`).join('');
    const cols = list.map((s) => {
      const blocks = (s.courses || []).filter((c) => c.day === d).map((c) => `
        <div class="blk${c.kind === 'pause' ? ' pause' : ''}" style="top:${pct(c.start)}%;height:${Math.max(1.5, ((c.end - c.start) / span) * 100)}%"
             title="${esc(`${s.name} · ${DAYS[d]} ${fmtTime(c.start)}–${fmtTime(c.end)} · ${c.subject}${c.teacher ? ` · ${c.teacher}` : ''}${c.room ? ` · salle ${c.room}` : ''}`)}">
          <b>${esc(c.subject)}</b><i>${esc(c.teacher || c.room || '')}</i>
        </div>`).join('');
      return `<div class="col" style="--c:${esc(s.color)}">${blocks}</div>`;
    }).join('');
    return `<div class="day">
      <div class="d-head">${DAYS[d]}</div>
      <div class="track">${free}<div class="cols">${cols}</div></div>
    </div>`;
  }).join('');

  return `<div class="week-legend">
      ${list.map((s) => `<span class="lg" style="--c:${esc(s.color)}"><i></i>${esc(s.name)}</span>`).join('')}
      <span class="lg free"><i></i>libres ensemble</span>
    </div>
    <div class="week" style="--rows:${(span / 60) * 62}px;--hour:62px">
      <div class="hours"><div class="d-head"></div><div class="h-track">${hours.join('')}</div></div>
      ${columns}
    </div>`;
}

function dayCards(r) {
  const days = r.days.filter((d) => !d.partial);
  if (!days.length) return '<div class="card note">Aucun jour où vous avez cours tous les deux (ou tous ensemble).</div>';

  return days.map((d) => {
    const rows = [];
    rows.push(['Vous commencez', phraseGroups(d.starts, { verb: 'commencent', verbOne: 'commence' })
      + (d.starts.same ? '' : ` — ${fmtDuration(d.starts.spread)} d’écart`)]);
    rows.push(['Vous finissez', phraseGroups(d.ends, { verb: 'finissent', verbOne: 'finit' })
      + (d.ends.same ? '' : ` — ${fmtDuration(d.ends.spread)} d’écart`)]);
    if (d.lunch.length) rows.push(['Vous mangez ensemble', d.lunch.map(phraseSlot).join(' · ')]);
    else rows.push(['Vous mangez ensemble', '<span class="no">aucune pause commune au milieu de la journée</span>']);
    rows.push(['Trous en commun', d.gaps.length ? d.gaps.map(phraseSlot).join(' · ') : '<span class="no">aucun</span>']);
    const other = d.free.filter((f) => !d.gaps.some((g) => g.start === f.start && g.end === f.end));
    if (other.length) rows.push(['Libres ensemble', other.map(phraseSlot).join(' · ')]);
    rows.push(['En cours en même temps', d.together.length
      ? d.together.map((t) => `${phraseSlot(t)}${t.sameCourse ? ' <span class="tag">même cours</span>' : ''}`).join(' · ')
      : '<span class="no">jamais</span>']);

    return `<div class="card day-card">
      <h3>${DAYS[d.day]}</h3>
      ${rows.map(([k, v]) => `<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
    </div>`;
  }).join('');
}

function teacherCard(r) {
  if (!r.teachers.length) {
    return `<div class="card"><h3>Profs en commun</h3>
      <p class="note">Aucun professeur commun repéré. Si les noms n’ont pas été lus sur les photos, ajoutez-les dans « Vérifier / corriger ».</p></div>`;
  }
  return `<div class="card"><h3>Profs en commun</h3>
    <ul class="plain">${r.teachers.map((t) => `<li>
      <b>${esc(t.label)}</b>
      <span class="muted small">— ${esc(names(t.people.map((p) => `${p.name} (${p.subjects.map((x) => x).join(', ')})`)))}</span>
    </li>`).join('')}</ul></div>`;
}

function subjectCard(r) {
  if (!r.subjects.length) return '';
  return `<div class="card"><h3>Matières en commun</h3>
    <ul class="plain">${r.subjects.map((s) => `<li><b>${esc(s.label)}</b>
      <span class="muted small">— ${esc(names(s.people.map((p) => `${p.name} : ${fmtDuration(p.hours * 60)}/semaine`)))}</span></li>`).join('')}</ul></div>`;
}

function sameClassCard(r) {
  if (!r.sameClass.length) return '';
  return `<div class="card"><h3>Cours suivis ensemble</h3>
    <p class="note">Même créneau, même prof, même salle : vous êtes très probablement dans le même cours.</p>
    <ul class="plain">${r.sameClass.map((x) => `<li>
      <b>${DAYS[x.day]} ${fmtTime(x.start)}–${fmtTime(x.end)}</b> · ${esc(x.subject)}
      ${x.teacher ? `· ${esc(x.teacher)}` : ''}${x.room ? ` · salle ${esc(x.room)}` : ''}
      <span class="muted small">— ${esc(names(x.people.map((p) => p.name)))}</span></li>`).join('')}</ul></div>`;
}

/* ══════════════════════════ Éditeur ══════════════════════════ */

let editing = null;

function openEditor(id) {
  editing = id;
  const s = byId(id);
  if (!s) return;
  const preview = previews.get(id) || s.preview;

  $('#sheet-title').textContent = s.name;
  $('#sheet-body').innerHTML = `
    ${preview ? `<img class="sheet-thumb" src="${esc(preview)}" alt="La photo importée"/>` : ''}
    <p class="note">Corrigez ce qui a été mal lu : c’est ce tableau qui sert au calcul, pas la photo.</p>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Jour</th><th>Début</th><th>Fin</th><th>Matière</th><th>Professeur</th><th>Salle</th><th></th></tr></thead>
      <tbody>${(s.courses || []).map((c, i) => courseRow(c, i)).join('')}</tbody>
    </table></div>
    <div class="sheet-actions">
      <button class="btn ghost" data-act="add-course">+ Ajouter un cours</button>
      <button class="btn ghost danger" data-act="clear-courses">Tout effacer</button>
    </div>`;
  $('#sheet').hidden = false;
  document.body.classList.add('locked');
}

function courseRow(c, i) {
  return `<tr data-i="${i}">
    <td><select data-f="day">${DAYS.slice(0, 6).map((d, k) => `<option value="${k}"${k === c.day ? ' selected' : ''}>${d}</option>`).join('')}</select></td>
    <td><input type="time" step="300" data-f="start" value="${hhmm(c.start)}"/></td>
    <td><input type="time" step="300" data-f="end" value="${hhmm(c.end)}"/></td>
    <td><input type="text" data-f="subject" value="${esc(c.subject)}" placeholder="Matière"/></td>
    <td><input type="text" data-f="teacher" value="${esc(c.teacher || '')}" placeholder="Prof"/></td>
    <td><input type="text" data-f="room" value="${esc(c.room || '')}" placeholder="Salle"/></td>
    <td><button class="icon" data-act="del-course" title="Supprimer la ligne" aria-label="Supprimer la ligne">×</button></td>
  </tr>`;
}

function closeEditor() {
  editing = null;
  $('#sheet').hidden = true;
  document.body.classList.remove('locked');
  render();
}

/* ══════════════════════════ Événements ══════════════════════════ */

function render() { renderPeople(); renderResults(); }

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;

  // — dans la liste des personnes
  const card = btn.closest('.person');
  if (card) {
    const id = card.dataset.id;
    const s = byId(id);
    if (!s) return;
    if (act === 'del') {
      if (!confirm(`Supprimer « ${s.name} » ?`)) return;
      state.schedules = state.schedules.filter((x) => x.id !== id);
      files.delete(id); previews.delete(id); jobs.delete(id);
      persist(); render();
    } else if (act === 'edit') openEditor(id);
    else if (act === 'zoom') {
      const src = previews.get(id) || s.preview;
      if (src) {
        $('#lightbox').innerHTML = `<img src="${esc(src)}" alt="${esc(s.name)}"/>`;
        $('#lightbox').hidden = false;
      }
    } else if (act === 'rotate') {
      s.rotate = ((s.rotate || 0) + 90) % 360;
      persist();
      const f = files.get(id);
      if (f) { jobs.set(id, { label: 'Rotation…', value: 0 }); renderPeople(); runQueue(); }
      else toast('Réimportez la photo pour la faire pivoter.');
    } else if (act === 'reread') {
      const f = files.get(id);
      if (!f) { toast('La photo n’est plus en mémoire : réimportez-la.'); return; }
      jobs.set(id, { label: 'En attente…', value: 0 }); renderPeople(); runQueue();
    }
    return;
  }

  // — dans l'éditeur
  if (act === 'del-course') {
    const tr = btn.closest('tr');
    const s = byId(editing);
    s.courses.splice(Number(tr.dataset.i), 1);
    persist(); openEditor(editing);
    return;
  }
  if (act === 'add-course') {
    const s = byId(editing);
    const last = s.courses[s.courses.length - 1];
    s.courses.push({ day: last ? last.day : 0, start: last ? last.end : 480, end: last ? last.end + 60 : 540, subject: '', teacher: '', room: '', kind: 'cours' });
    persist(); openEditor(editing);
    return;
  }
  if (act === 'clear-courses') {
    const s = byId(editing);
    if (!confirm('Effacer tous les cours de cet emploi du temps ?')) return;
    s.courses = [];
    persist(); openEditor(editing);
    return;
  }
  if (act === 'close-sheet') { closeEditor(); return; }
  if (btn.id === 'lightbox') { btn.hidden = true; return; }

  // — barre d'outils
  if (act === 'pick') $('#file').click();
  else if (act === 'manual') {
    const id = newId();
    state.schedules.push({ id, name: `Personne ${state.schedules.length + 1}`, color: nextColor(state.schedules), source: 'manuel', courses: [], warnings: [] });
    persist(); render(); openEditor(id);
  } else if (act === 'export') {
    const url = URL.createObjectURL(toFile(state));
    const a = document.createElement('a');
    a.href = url; a.download = 'emplois-du-temps.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } else if (act === 'import') $('#file-json').click();
  else if (act === 'help') { $('#help').hidden = false; document.body.classList.add('locked'); }
  else if (act === 'close-help') { $('#help').hidden = true; document.body.classList.remove('locked'); }
  else if (act === 'print') window.print();
  else if (act === 'reset') {
    if (!confirm('Tout effacer et repartir de zéro ?')) return;
    state = { schedules: [], options: state.options };
    files.clear(); previews.clear(); jobs.clear();
    persist(); render();
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;

  if (el.dataset.act === 'rename') {
    const s = byId(el.closest('.person').dataset.id);
    if (s) { s.name = el.value.trim() || 'Sans nom'; persist(); renderResults(); }
    return;
  }

  if (el.dataset.f && editing) {
    const s = byId(editing);
    const i = Number(el.closest('tr').dataset.i);
    const c = s.courses[i];
    if (!c) return;
    const f = el.dataset.f;
    if (f === 'day') c.day = Number(el.value);
    else if (f === 'start' || f === 'end') {
      const v = fromHhmm(el.value);
      if (v != null) c[f] = v;
      if (c.end <= c.start) c.end = c.start + 60;
      $$('input[data-f="end"]', el.closest('tr')).forEach((x) => { x.value = hhmm(c.end); });
    } else c[f] = el.value.slice(0, 60);
    c.kind = /^(pause|récré|recre|déjeuner|dejeuner|repas|midi)/i.test(c.subject || '') ? 'pause' : 'cours';
    persist();
    return;
  }

  if (el.id === 'file') { addFiles(el.files); el.value = ''; }
  else if (el.id === 'file-json') {
    const f = el.files[0];
    el.value = '';
    if (f) {
      fromFile(f)
        .then((list) => {
          state.schedules.push(...list);
          persist(); render();
          toast(`${list.length} emploi${list.length > 1 ? 's' : ''} du temps importé${list.length > 1 ? 's' : ''}.`);
        })
        .catch(() => toast('Fichier illisible.'));
    }
  } else if (el.id === 'opt-quality') { state.options.quality = el.value; persist(); }
  else if (el.id === 'opt-min') { state.options.minCommon = Number(el.value); persist(); renderResults(); }
});

/* Glisser-déposer et copier-coller : deux façons naturelles d'ajouter une photo. */
const drop = () => $('#drop');
['dragenter', 'dragover'].forEach((ev) => document.addEventListener(ev, (e) => {
  e.preventDefault(); drop()?.classList.add('over');
}));
['dragleave', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => {
  e.preventDefault(); if (ev === 'dragleave' && e.relatedTarget) return; drop()?.classList.remove('over');
}));
document.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); });
document.addEventListener('paste', (e) => {
  const items = [...(e.clipboardData?.files || [])];
  if (items.length) addFiles(items);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('#lightbox').hidden) $('#lightbox').hidden = true;
  else if (!$('#sheet').hidden) closeEditor();
  else if (!$('#help').hidden) { $('#help').hidden = true; document.body.classList.remove('locked'); }
});

/* ══════════════════════════ Démarrage ══════════════════════════ */

$('#opt-quality').value = state.options.quality;
$('#opt-quality').title = `Dictionnaire téléchargé une seule fois : ${LANG_SIZE.precise} en précis, ${LANG_SIZE.fast} en rapide.`;
$('#opt-min').value = String(state.options.minCommon);
for (const s of state.schedules) if (s.preview) previews.set(s.id, s.preview);
render();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js').catch(() => {});
