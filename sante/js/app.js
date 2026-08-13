/* ============================================================
   Ma Famille en Forme — logique de l'application
   Vanilla JS, aucune dépendance, stockage local.
   ============================================================ */
'use strict';

/* ── Raccourcis ─────────────────────────────────────────── */
const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ── Référentiels ───────────────────────────────────────── */
const ALLERGENES = [
  { id: 'gluten',   nom: 'Gluten' },
  { id: 'lait',     nom: 'Lait / lactose' },
  { id: 'oeuf',     nom: 'Œuf' },
  { id: 'poisson',  nom: 'Poisson' },
  { id: 'crustace', nom: 'Crustacés' },
  { id: 'coque',    nom: 'Fruits à coque' },
  { id: 'arachide', nom: 'Arachide' },
  { id: 'soja',     nom: 'Soja' },
  { id: 'sesame',   nom: 'Sésame' },
  { id: 'moutarde', nom: 'Moutarde' },
  { id: 'celeri',   nom: 'Céleri' },
  { id: 'sulfite',  nom: 'Sulfites' },
  { id: 'porc',     nom: 'Porc' }
];
const ALG_NOM = Object.fromEntries(ALLERGENES.map(a => [a.id, a.nom]));

const JOURS = [
  { k: 'lun', n: 'Lundi' }, { k: 'mar', n: 'Mardi' }, { k: 'mer', n: 'Mercredi' },
  { k: 'jeu', n: 'Jeudi' }, { k: 'ven', n: 'Vendredi' }, { k: 'sam', n: 'Samedi' }, { k: 'dim', n: 'Dimanche' }
];
const REPAS = [{ k: 'midi', n: 'Midi' }, { k: 'soir', n: 'Soir' }];
const WEEKEND = ['sam', 'dim'];

const EMOJI = {
  'Végétarien': '🥬', 'Poisson': '🐟', 'Volaille': '🍗',
  'Viande rouge': '🥩', 'Porc': '🥓', 'Œufs': '🥚'
};
const ORDRE_RAYONS = ['lg', 'bo', 'po', 'cr', 'fe', 'ep', 'bl', 'sg', 'pl'];
RAYONS.pl = 'Placard — à vérifier avant de partir';

/** Épices et condiments : on les regroupe à part, on en a souvent déjà. */
const PLACARD = /^(huile|vinaigre|sauce soja|sauce nuoc|miel|moutarde|maïzena|levure|pâte de curry|pâte de miso|bouquet garni|feuille de laurier)/i;
const rayonEffectif = (nom, rayon) => (rayon === 'es' || PLACARD.test(nom)) ? 'pl' : rayon;

const ACTIVITES = [
  { v: 1.2,   n: 'Sédentaire — bureau, peu de marche' },
  { v: 1.375, n: 'Légèrement actif — 1 à 3 séances/semaine' },
  { v: 1.55,  n: 'Modérément actif — 3 à 5 séances/semaine' },
  { v: 1.725, n: 'Très actif — 6 à 7 séances/semaine' },
  { v: 1.9,   n: 'Extrêmement actif — sport intensif ou métier physique' }
];

/* ── État ───────────────────────────────────────────────── */
const CLE = 'famille-en-forme-v1';

function lundiCourant() {
  const d = new Date();
  const j = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - j);
  return d.toISOString().slice(0, 10);
}
const aujourdhui = () => new Date().toISOString().slice(0, 10);

function etatParDefaut() {
  return {
    v: 1,
    premiereVisite: true,
    foyer: { nbPersonnes: 4, repasPlanifies: 'both' },
    personnes: [
      { id: 'christelle', nom: 'Christelle', sexe: 'F', naissance: '1982-05-14', taille: 166, objectif: 62, activite: 1.375, couleur: '#c0503f', allergenes: [], pesees: [{ d: aujourdhui(), p: 70 }] },
      { id: 'fabien',     nom: 'Fabien',     sexe: 'H', naissance: '1980-09-22', taille: 178, objectif: 78, activite: 1.375, couleur: '#3b7ea1', allergenes: [], pesees: [{ d: aujourdhui(), p: 88 }] },
      { id: 'nathan',     nom: 'Nathan',     sexe: 'H', naissance: '2008-03-11', taille: 176, objectif: 70, activite: 1.55,  couleur: '#2f8f66', allergenes: [], pesees: [{ d: aujourdhui(), p: 72 }] },
      { id: 'mathis',     nom: 'Mathis',     sexe: 'H', naissance: '2013-06-30', taille: 152, objectif: 44, activite: 1.55,  couleur: '#7a5ea8', allergenes: [], pesees: [{ d: aujourdhui(), p: 45 }] }
    ],
    aversions: [],
    selection: [],
    planning: { debut: lundiCourant(), repas: {} },
    options: { useFav: false, onlySeason: false },
    courses: { coches: [], extra: [] }
  };
}

let state = charger();

function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return etatParDefaut();
    const s = JSON.parse(brut);
    const d = etatParDefaut();
    // fusion défensive : une version antérieure ne doit jamais casser l'app
    return {
      ...d, ...s,
      foyer: { ...d.foyer, ...(s.foyer || {}) },
      planning: { ...d.planning, ...(s.planning || {}), repas: (s.planning && s.planning.repas) || {} },
      options: { ...d.options, ...(s.options || {}) },
      courses: { ...d.courses, ...(s.courses || {}) },
      personnes: (s.personnes && s.personnes.length ? s.personnes : d.personnes).map((p, i) => ({ ...d.personnes[i % 4], ...p, pesees: p.pesees || [] }))
    };
  } catch (e) {
    console.warn('Données illisibles, réinitialisation.', e);
    return etatParDefaut();
  }
}

function sauver() {
  try { localStorage.setItem(CLE, JSON.stringify(state)); }
  catch (e) { toast('Impossible d\'enregistrer (stockage plein ?)'); }
}

/* ── Toast ──────────────────────────────────────────────── */
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), 2400);
}

/* ============================================================
   CALCULS SANTÉ
   ============================================================ */
function age(p) {
  if (!p.naissance) return null;
  const n = new Date(p.naissance), h = new Date();
  let a = h.getFullYear() - n.getFullYear();
  const m = h.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < n.getDate())) a--;
  return a >= 0 && a < 120 ? a : null;
}
const mineur = p => { const a = age(p); return a !== null && a < 18; };

function pesees(p) { return [...(p.pesees || [])].sort((a, b) => a.d.localeCompare(b.d)); }
function poidsActuel(p) { const l = pesees(p); return l.length ? l[l.length - 1].p : null; }
function poidsDepart(p) { const l = pesees(p); return l.length ? l[0].p : null; }

function imc(poids, taille) { return taille ? poids / Math.pow(taille / 100, 2) : null; }

function imcInfo(v) {
  if (v === null) return { txt: '—', cls: '' };
  if (v < 18.5) return { txt: 'Insuffisance pondérale', cls: 'warn' };
  if (v < 25)   return { txt: 'Corpulence normale', cls: 'ok' };
  if (v < 30)   return { txt: 'Surpoids', cls: 'warn' };
  return { txt: 'Obésité', cls: 'bad' };
}

/** Métabolisme de base — Mifflin-St Jeor (1990). */
function metabolismeBase(p, poids) {
  const a = age(p);
  if (!poids || !p.taille || a === null) return null;
  const base = 10 * poids + 6.25 * p.taille - 5 * a;
  return Math.round(base + (p.sexe === 'H' ? 5 : -161));
}
function depenseTotale(p, poids) {
  const mb = metabolismeBase(p, poids);
  return mb ? Math.round(mb * (p.activite || 1.375)) : null;
}

/** Objectif calorique quotidien indicatif, plancher = métabolisme de base. */
function objectifCalorique(p, poids) {
  const dt = depenseTotale(p, poids), mb = metabolismeBase(p, poids);
  if (!dt) return null;
  if (mineur(p)) return { kcal: dt, mode: 'Croissance en cours — maintien' };
  const ecart = poids - (p.objectif || poids);
  if (ecart > 1)  return { kcal: Math.max(Math.round(dt * 0.85), mb, p.sexe === 'H' ? 1500 : 1200), mode: 'Déficit modéré (−15 %)' };
  if (ecart < -1) return { kcal: Math.round(dt * 1.10), mode: 'Surplus léger (+10 %)' };
  return { kcal: dt, mode: 'Maintien' };
}

/** Fourchette de poids correspondant à un IMC de 18,5 à 25. */
function poidsSante(taille) {
  if (!taille) return null;
  const m = taille / 100;
  return [Math.round(18.5 * m * m), Math.round(25 * m * m)];
}

/* ============================================================
   COMPATIBILITÉ DES RECETTES
   ============================================================ */
function allergiesFoyer() {
  const m = {};
  state.personnes.forEach(p => (p.allergenes || []).forEach(a => {
    (m[a] = m[a] || []).push(p.nom);
  }));
  return m;
}

/** Retourne les problèmes d'une recette : allergènes du foyer + aversions. */
function problemes(r) {
  const foyer = allergiesFoyer();
  const alg = (r.allergenes || []).filter(a => foyer[a]).map(a => ({ id: a, qui: foyer[a] }));
  const av = (state.aversions || []).filter(mot => {
    const n = norm(mot).trim();
    if (!n) return false;
    return r.ingredients.some(i => norm(i[0]).includes(n)) || norm(r.nom).includes(n);
  });
  return { alg, av, ok: alg.length === 0 && av.length === 0 };
}

function saisonCourante() {
  const m = new Date().getMonth();
  if (m <= 1 || m === 11) return 'hiver';
  if (m <= 4) return 'printemps';
  if (m <= 7) return 'ete';
  return 'automne';
}
const deSaison = r => (r.saisons || []).includes(saisonCourante());

/* ============================================================
   NAVIGATION
   ============================================================ */
$$('#nav button').forEach(b => b.addEventListener('click', () => ouvrirOnglet(b.dataset.tab)));

function ouvrirOnglet(nom) {
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === nom));
  $$('.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + nom));
  if (nom === 'progression') rendrePersonnes();
  if (nom === 'recettes') rendreRecettes();
  if (nom === 'semaine') { rendreSemaine(); rendreEquilibre(); }
  if (nom === 'courses') rendreCourses();
  if (nom === 'reglages') rendreReglages();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

/* ============================================================
   ONGLET PROGRESSION
   ============================================================ */
function rendrePersonnes() {
  $('#first-run').hidden = !state.premiereVisite;
  const box = $('#people');
  box.innerHTML = state.personnes.map(personneHTML).join('');

  // Les graphiques ont besoin de la largeur réelle : on les dessine après insertion.
  state.personnes.forEach(p => {
    const holder = $(`[data-chart="${p.id}"]`);
    if (holder) holder.innerHTML = graphique(p, holder.clientWidth || 300);
  });
}

function personneHTML(p) {
  const poids = poidsActuel(p);
  const dep = poidsDepart(p);
  const a = age(p);
  const v = poids ? imc(poids, p.taille) : null;
  const info = imcInfo(mineur(p) ? null : v);
  const dt = depenseTotale(p, poids);
  const obj = objectifCalorique(p, poids);
  const zone = poidsSante(p.taille);
  const cible = p.objectif;

  let progression = 0, restant = null;
  if (poids !== null && dep !== null && cible) {
    restant = +(poids - cible).toFixed(1);
    const total = dep - cible;
    progression = Math.abs(total) < 0.05 ? 100 : clamp(((dep - poids) / total) * 100, 0, 100);
  }

  const liste = pesees(p).slice().reverse();
  const hist = liste.map((x, i) => {
    const prec = liste[i + 1];
    const d = prec ? +(x.p - prec.p).toFixed(1) : null;
    return `<div class="hist-row">
      <span class="d">${dateCourte(x.d)}</span>
      <span class="p">${x.p.toFixed(1)} kg</span>
      <span class="delta ${d === null ? '' : d < 0 ? 'down' : d > 0 ? 'up' : ''}">${d === null ? '—' : (d > 0 ? '+' : '') + d}</span>
      <button class="btn sm ghost" data-del-pesee="${p.id}|${x.d}" title="Supprimer">✕</button>
    </div>`;
  }).join('') || '<p class="muted" style="padding:10px 0">Aucune pesée enregistrée.</p>';

  return `
  <div class="card person" style="--pc:${p.couleur}">
    <div class="p-top">
      <div class="avatar">${esc(p.nom[0])}</div>
      <div>
        <div class="p-name">${esc(p.nom)}</div>
        <div class="p-sub">${a !== null ? a + ' ans' : 'âge à renseigner'} · ${p.taille} cm · ${p.sexe === 'H' ? 'homme' : 'femme'}${mineur(p) ? ' · mineur' : ''}</div>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat"><div class="v">${poids !== null ? poids.toFixed(1) + '<small> kg</small>' : '—'}</div><div class="k">Poids</div></div>
      <div class="stat"><div class="v ${info.cls}">${mineur(p) ? '—' : (v ? v.toFixed(1) : '—')}</div><div class="k">IMC</div></div>
      <div class="stat"><div class="v">${dt ? dt + '<small> kcal</small>' : '—'}</div><div class="k">Dépense/j</div></div>
    </div>

    ${mineur(p)
      ? `<p class="muted" style="margin-bottom:10px">👦 Moins de 18 ans : l'IMC adulte ne s'applique pas. On suit la courbe de poids
           et on vise le maintien d'une alimentation équilibrée, pas une perte de poids.</p>`
      : `<p class="muted" style="margin-bottom:10px">${info.txt}${zone ? ` · zone de référence : <b>${zone[0]}–${zone[1]} kg</b>` : ''}</p>`}

    ${cible && !mineur(p) ? `
    <div class="prog-wrap">
      <div class="prog-lab"><span>Objectif ${cible} kg</span><span>${restant !== null ? (Math.abs(restant) < 0.2 ? 'Atteint 🎉' : (restant > 0 ? restant + ' kg à perdre' : Math.abs(restant) + ' kg à prendre')) : ''}</span></div>
      <div class="prog-bar"><i style="width:${progression.toFixed(0)}%"></i></div>
    </div>` : ''}

    <div data-chart="${p.id}"></div>

    <div class="weigh-in">
      <input type="date" value="${aujourdhui()}" data-date="${p.id}" max="${aujourdhui()}">
      <input type="number" step="0.1" min="20" max="300" placeholder="kg" data-poids="${p.id}">
      <button class="btn primary sm" data-add-pesee="${p.id}">Peser</button>
    </div>

    ${obj ? `<p class="muted" style="margin-top:10px">🎯 Apport indicatif : <b>${obj.kcal} kcal/jour</b> — ${obj.mode}.</p>` : ''}

    <div class="hist">${hist}</div>

    <details class="edit-p">
      <summary>Modifier le profil</summary>
      <div class="grid2" style="margin-top:12px">
        <div class="field"><label class="f">Prénom</label><input type="text" data-p="${p.id}" data-champ="nom" value="${esc(p.nom)}"></div>
        <div class="field"><label class="f">Date de naissance</label><input type="date" data-p="${p.id}" data-champ="naissance" value="${p.naissance || ''}"></div>
        <div class="field"><label class="f">Taille (cm)</label><input type="number" min="80" max="230" data-p="${p.id}" data-champ="taille" value="${p.taille}"></div>
        <div class="field"><label class="f">Sexe</label><select data-p="${p.id}" data-champ="sexe">
          <option value="F" ${p.sexe === 'F' ? 'selected' : ''}>Femme</option>
          <option value="H" ${p.sexe === 'H' ? 'selected' : ''}>Homme</option></select></div>
        <div class="field"><label class="f">Objectif (kg)</label><input type="number" step="0.5" min="20" max="250" data-p="${p.id}" data-champ="objectif" value="${p.objectif || ''}"></div>
        <div class="field"><label class="f">Couleur</label><input type="color" data-p="${p.id}" data-champ="couleur" value="${p.couleur}" style="padding:2px;height:38px"></div>
      </div>
      <div class="field"><label class="f">Niveau d'activité</label><select data-p="${p.id}" data-champ="activite">
        ${ACTIVITES.map(x => `<option value="${x.v}" ${Number(p.activite) === x.v ? 'selected' : ''}>${x.n}</option>`).join('')}
      </select></div>
    </details>
  </div>`;
}

function dateCourte(d) {
  const [y, m, j] = d.split('-');
  return `${j}/${m}/${y.slice(2)}`;
}

/** Courbe de poids en SVG, avec ligne d'objectif. */
function graphique(p, largeur) {
  const pts = pesees(p);
  const L = Math.max(largeur, 240), H = 132, mg = { t: 12, r: 40, b: 18, l: 8 };
  if (pts.length === 0) {
    return `<p class="muted" style="height:132px;display:grid;place-items:center">Ajoutez une première pesée pour voir la courbe.</p>`;
  }
  const objectif = mineur(p) ? null : p.objectif;
  const valeurs = pts.map(x => x.p).concat(objectif ? [objectif] : []);
  let min = Math.min(...valeurs), max = Math.max(...valeurs);
  if (max - min < 2) { const c = (max + min) / 2; min = c - 1.5; max = c + 1.5; }
  const pad = (max - min) * 0.15; min -= pad; max += pad;

  const t0 = new Date(pts[0].d).getTime();
  const t1 = new Date(pts[pts.length - 1].d).getTime();
  const X = t => mg.l + (t1 === t0 ? (L - mg.l - mg.r) / 2 : ((t - t0) / (t1 - t0)) * (L - mg.l - mg.r));
  const Y = v => mg.t + (1 - (v - min) / (max - min)) * (H - mg.t - mg.b);

  const coords = pts.map(x => [X(new Date(x.d).getTime()), Y(x.p)]);
  const ligne = coords.map((c, i) => (i ? 'L' : 'M') + c[0].toFixed(1) + ' ' + c[1].toFixed(1)).join(' ');
  const aire = `${ligne} L${coords[coords.length - 1][0].toFixed(1)} ${H - mg.b} L${coords[0][0].toFixed(1)} ${H - mg.b} Z`;

  return `<svg class="chart" viewBox="0 0 ${L} ${H}" width="100%" height="${H}" role="img" aria-label="Courbe de poids de ${esc(p.nom)}">
    <line class="grid-l" x1="${mg.l}" y1="${H - mg.b}" x2="${L - mg.r}" y2="${H - mg.b}"/>
    ${objectif ? `<line class="goal-l" x1="${mg.l}" y1="${Y(objectif).toFixed(1)}" x2="${L - mg.r}" y2="${Y(objectif).toFixed(1)}"/>
      <text x="${L - mg.r + 4}" y="${(Y(objectif) + 3).toFixed(1)}" fill="var(--warm)">${objectif} kg</text>` : ''}
    <path class="area" d="${aire}"/>
    <path class="line" d="${ligne}"/>
    ${coords.map(c => `<circle class="dot" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="3.4"/>`).join('')}
    <text x="${mg.l}" y="${H - 5}">${dateCourte(pts[0].d)}</text>
    ${pts.length > 1 ? `<text x="${(L - mg.r).toFixed(0)}" y="${H - 5}" text-anchor="end">${dateCourte(pts[pts.length - 1].d)}</text>` : ''}
    <text x="${L - mg.r + 4}" y="${(Y(pts[pts.length - 1].p) + 3).toFixed(1)}" font-weight="700" fill="${p.couleur}">${pts[pts.length - 1].p.toFixed(1)}</text>
  </svg>`;
}

/* Actions de l'onglet progression (délégation) */
$('#people').addEventListener('click', e => {
  const add = e.target.closest('[data-add-pesee]');
  if (add) {
    const id = add.dataset.addPesee;
    const p = state.personnes.find(x => x.id === id);
    const d = $(`[data-date="${id}"]`).value || aujourdhui();
    const val = parseFloat($(`[data-poids="${id}"]`).value);
    if (!val || val < 20 || val > 300) { toast('Entrez un poids valide (20 à 300 kg)'); return; }
    p.pesees = (p.pesees || []).filter(x => x.d !== d).concat([{ d, p: +val.toFixed(1) }]);
    state.premiereVisite = false;
    sauver(); rendrePersonnes();
    toast(`Pesée enregistrée pour ${p.nom}`);
    return;
  }
  const del = e.target.closest('[data-del-pesee]');
  if (del) {
    const [id, d] = del.dataset.delPesee.split('|');
    const p = state.personnes.find(x => x.id === id);
    p.pesees = p.pesees.filter(x => x.d !== d);
    sauver(); rendrePersonnes();
    return;
  }
});

$('#people').addEventListener('change', e => {
  const el = e.target.closest('[data-champ]');
  if (!el) return;
  const p = state.personnes.find(x => x.id === el.dataset.p);
  const champ = el.dataset.champ;
  let v = el.value;
  if (['taille', 'objectif', 'activite'].includes(champ)) v = parseFloat(v) || null;
  if (champ === 'nom' && !String(v).trim()) return;
  p[champ] = v;
  state.premiereVisite = false;
  sauver(); rendrePersonnes(); rendreReglages();
});

$('#dismiss-first').addEventListener('click', () => {
  state.premiereVisite = false; sauver(); $('#first-run').hidden = true;
});

let resizeT;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { if ($('#tab-progression').classList.contains('on')) rendrePersonnes(); }, 250);
});

/* ============================================================
   ONGLET RECETTES
   ============================================================ */
const filtres = { q: '', cat: '', temps: '', saison: '', pills: new Set(['compat']) };

function recettesFiltrees() {
  const q = norm(filtres.q).trim();
  return RECETTES.filter(r => {
    if (filtres.cat && r.cat !== filtres.cat) return false;
    if (filtres.temps && r.temps > +filtres.temps) return false;
    if (filtres.saison && !(r.saisons || []).includes(filtres.saison)) return false;
    if (q) {
      const dans = norm(r.nom).includes(q)
        || r.ingredients.some(i => norm(i[0]).includes(q))
        || (r.tags || []).some(t => norm(t).includes(q))
        || norm(r.cat).includes(q);
      if (!dans) return false;
    }
    const P = filtres.pills;
    if (P.has('fav') && !state.selection.includes(r.id)) return false;
    if (P.has('plaisir') && !r.plaisir) return false;
    if (P.has('legumineuse') && !r.legumineuse) return false;
    if (P.has('poissonGras') && !r.poissonGras) return false;
    if (P.has('rapide') && r.temps > 30) return false;
    if (P.has('batch') && !(r.tags || []).includes('batch cooking')) return false;
    if (P.has('compat') && !problemes(r).ok) return false;
    return true;
  });
}

function rendreRecettes() {
  $('#nb-pers-label').textContent = state.foyer.nbPersonnes + ' personne' + (state.foyer.nbPersonnes > 1 ? 's' : '');
  const liste = recettesFiltrees();
  $('#n-recettes').textContent = liste.length;
  const box = $('#recipes');
  if (!liste.length) {
    box.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="big">🔍</div>
      Aucun plat ne correspond. Élargissez les filtres, ou décochez « Compatible avec nos allergies ».</div>`;
    return;
  }
  box.innerHTML = liste.map(carteHTML).join('');
}

function carteHTML(r) {
  const pb = problemes(r);
  const fav = state.selection.includes(r.id);
  return `<article class="card r-card ${pb.ok ? '' : 'excluded'}" data-r="${r.id}">
    <span class="r-emo">${r.plaisir ? '🎉' : EMOJI[r.cat] || '🍽️'}</span>
    <h3>${esc(r.nom)}</h3>
    <div class="r-meta">
      <span class="chip ${r.plaisir ? 'w' : 'g'}">${r.cat}</span>
      <span class="chip">⏱ ${r.temps} min</span>
      ${r.legumineuse ? '<span class="chip b">🫘 légumineuses</span>' : ''}
      ${r.poissonGras ? '<span class="chip b">oméga-3</span>' : ''}
      ${(r.tags || []).filter(t => t !== 'oméga-3').slice(0, 1).map(t => `<span class="chip">${esc(t)}</span>`).join('')}
    </div>
    ${!pb.ok ? `<div class="r-warn">⚠ ${[
      ...pb.alg.map(a => `${ALG_NOM[a.id]} (${a.qui.join(', ')})`),
      ...pb.av.map(a => `contient : ${esc(a)}`)
    ].join(' · ')}</div>` : ''}
    <div class="r-nutri">
      <span><b>${r.kcal}</b> kcal</span><span><b>${r.prot}</b>g prot.</span>
      <span><b>${r.fibres}</b>g fibres</span>
      <button class="fav-btn" data-fav="${r.id}" title="${fav ? 'Retirer de ma sélection' : 'Ajouter à ma sélection'}"
        style="margin-left:auto">${fav ? '★' : '☆'}</button>
    </div>
  </article>`;
}

$('#recipes').addEventListener('click', e => {
  const f = e.target.closest('[data-fav]');
  if (f) {
    e.stopPropagation();
    basculerFavori(f.dataset.fav);
    return;
  }
  const c = e.target.closest('[data-r]');
  if (c) ouvrirRecette(c.dataset.r);
});

function basculerFavori(id) {
  const i = state.selection.indexOf(id);
  if (i >= 0) { state.selection.splice(i, 1); toast('Retiré de la sélection'); }
  else { state.selection.push(id); toast('Ajouté à ma sélection ★'); }
  sauver(); rendreRecettes();
  const m = $('#modal-recipe');
  if ($('#ov-recipe').classList.contains('on') && m.dataset.r === id) ouvrirRecette(id);
}

$('#q').addEventListener('input', e => { filtres.q = e.target.value; rendreRecettes(); });
['cat', 'temps', 'saison'].forEach(k => $('#f-' + k).addEventListener('change', e => { filtres[k] = e.target.value; rendreRecettes(); }));
$('#clear-f').addEventListener('click', () => {
  filtres.q = filtres.cat = filtres.temps = filtres.saison = '';
  filtres.pills = new Set(['compat']);
  $('#q').value = ''; $('#f-cat').value = ''; $('#f-temps').value = ''; $('#f-saison').value = '';
  $$('#pills .pill').forEach(b => b.classList.toggle('on', b.dataset.p === 'compat'));
  rendreRecettes();
});
$$('#pills .pill').forEach(b => b.addEventListener('click', () => {
  const p = b.dataset.p;
  if (filtres.pills.has(p)) filtres.pills.delete(p); else filtres.pills.add(p);
  b.classList.toggle('on');
  rendreRecettes();
}));

/* ── Modale recette ─────────────────────────────────────── */
function facteur() { return state.foyer.nbPersonnes / 4; }

const UNITES_DENOMBRABLES = ['pièce', 'tranche', 'gousse', 'brin', 'botte', 'pincée'];

function fmtQte(q, u) {
  const f = +q;
  if (u === 'g' && f >= 1000)  return fmtNb(f / 1000) + ' kg';
  if (u === 'ml' && f >= 1000) return fmtNb(f / 1000) + ' l';

  let n;
  if (UNITES_DENOMBRABLES.includes(u)) n = Math.max(0.5, Math.round(f * 2) / 2);
  else if (f >= 20) n = Math.round(f);
  else n = Math.round(f * 10) / 10;

  if (u === 'pièce') return '×' + fmtNb(n);
  const pluriel = n > 1 && UNITES_DENOMBRABLES.includes(u) ? u + 's' : u;
  return fmtNb(n) + ' ' + pluriel;
}
function fmtNb(n) {
  const arrondi = Math.round(n * 100) / 100;
  return String(arrondi).replace('.', ',');
}

function ouvrirRecette(id) {
  const r = RECETTES.find(x => x.id === id);
  if (!r) return;
  const pb = problemes(r);
  const f = facteur();
  const fav = state.selection.includes(r.id);
  const src = SOURCES[r.src[0]];
  const avSet = new Set(state.aversions.map(a => norm(a).trim()).filter(Boolean));

  $('#modal-recipe').dataset.r = id;
  $('#modal-recipe').innerHTML = `
    <button class="close" data-close>✕</button>
    <h2>${r.plaisir ? '🎉 ' : ''}${esc(r.nom)}</h2>
    <div class="r-meta">
      <span class="chip ${r.plaisir ? 'w' : 'g'}">${r.cat}</span>
      <span class="chip">⏱ ${r.temps} min</span>
      <span class="chip">${r.diff}</span>
      ${(r.tags || []).map(t => `<span class="chip">${esc(t)}</span>`).join('')}
    </div>

    ${!pb.ok ? `<div class="notice" style="margin-top:14px">⚠️<span>${[
      ...pb.alg.map(a => `<b>${ALG_NOM[a.id]}</b> — allergie déclarée pour ${a.qui.join(', ')}`),
      ...pb.av.map(a => `contient « ${esc(a)} », dans vos aversions`)
    ].join('<br>')}</span></div>` : ''}

    <div class="nutri-grid">
      <div><div class="v">${r.kcal}</div><div class="k">kcal/pers</div></div>
      <div><div class="v">${r.prot}g</div><div class="k">Protéines</div></div>
      <div><div class="v">${r.gluc}g</div><div class="k">Glucides</div></div>
      <div><div class="v">${r.lip}g</div><div class="k">Lipides</div></div>
      <div><div class="v">${r.fibres}g</div><div class="k">Fibres</div></div>
    </div>

    <div class="m-cols">
      <div>
        <h4>Ingrédients — ${state.foyer.nbPersonnes} pers.</h4>
        <ul class="ing-list">
          ${r.ingredients.map(i => {
            const mauvais = [...avSet].some(a => norm(i[0]).includes(a));
            return `<li class="${mauvais ? 'bad' : ''}"><span>${esc(i[0])}</span><b>${fmtQte(i[1] * f, i[2])}</b></li>`;
          }).join('')}
        </ul>
      </div>
      <div>
        <h4>Préparation</h4>
        <ol class="steps">${r.etapes.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
        ${r.astuce ? `<div class="tip">💡 <b>Le petit plus :</b> ${esc(r.astuce)}</div>` : ''}
      </div>
    </div>

    <div class="m-foot">
      <button class="btn ${fav ? '' : 'primary'}" data-fav="${r.id}">${fav ? '★ Dans ma sélection' : '☆ Ajouter à ma sélection'}</button>
      <button class="btn" data-plan="${r.id}">🗓️ Placer dans la semaine</button>
      <a class="btn ghost" href="${src.url}${encodeURIComponent(r.src[1])}" target="_blank" rel="noopener">Voir des variantes sur ${src.nom} ↗</a>
    </div>`;
  $('#ov-recipe').classList.add('on');
}

/* ============================================================
   ONGLET SEMAINE
   ============================================================ */
function creneauxActifs() {
  const mode = state.foyer.repasPlanifies;
  const repas = mode === 'both' ? REPAS : REPAS.filter(r => r.k === mode);
  const out = [];
  JOURS.forEach(j => repas.forEach(r => out.push({ key: `${j.k}-${r.k}`, jour: j, repas: r })));
  return out;
}

function dateDuJour(indexJour) {
  const d = new Date(state.planning.debut + 'T12:00:00');
  d.setDate(d.getDate() + indexJour);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function rendreSemaine() {
  const mode = state.foyer.repasPlanifies;
  const repas = mode === 'both' ? REPAS : REPAS.filter(r => r.k === mode);
  $('#use-fav').checked = !!state.options.useFav;
  $('#only-season').checked = !!state.options.onlySeason;

  $('#week').innerHTML = JOURS.map((j, i) => `
    <div class="day ${WEEKEND.includes(j.k) ? 'we' : ''}">
      <div class="day-h">${j.n}<span>${dateDuJour(i)}</span></div>
      ${repas.map(rp => creneauHTML(j, rp)).join('')}
    </div>`).join('');

  const n = Object.values(state.planning.repas).filter(Boolean).length;
  $('#n-semaine').textContent = n;
}

function creneauHTML(j, rp) {
  const key = `${j.k}-${rp.k}`;
  const id = state.planning.repas[key];
  const r = id && RECETTES.find(x => x.id === id);
  if (!r) {
    return `<div class="slot empty" data-slot="${key}">
      <span class="lab">${rp.n}</span><span class="plus">＋</span></div>`;
  }
  return `<div class="slot" data-slot="${key}">
    <button class="x" data-clear="${key}" title="Retirer">✕</button>
    <span class="lab">${rp.n}</span>
    <span class="nm">${r.plaisir ? '🎉 ' : ''}${esc(r.nom)}</span>
    <span class="mt"><span class="dotc" style="background:${couleurCat(r)}"></span>${r.temps} min · ${r.kcal} kcal</span>
  </div>`;
}

function couleurCat(r) {
  if (r.plaisir) return 'var(--warm)';
  return { 'Végétarien': 'var(--accent)', 'Poisson': 'var(--blue)', 'Volaille': '#b8963e', 'Viande rouge': 'var(--red)', 'Porc': 'var(--red)', 'Œufs': 'var(--purple)' }[r.cat] || 'var(--accent)';
}

$('#week').addEventListener('click', e => {
  const c = e.target.closest('[data-clear]');
  if (c) {
    delete state.planning.repas[c.dataset.clear];
    sauver(); rendreSemaine(); rendreEquilibre(); majBadges();
    return;
  }
  const s = e.target.closest('[data-slot]');
  if (s) ouvrirChoixPlat(s.dataset.slot);
});

/* ── Sélecteur de plat pour un créneau ──────────────────── */
function ouvrirChoixPlat(slotKey) {
  const [jk, rk] = slotKey.split('-');
  const jour = JOURS.find(j => j.k === jk).n, repas = REPAS.find(r => r.k === rk).n;
  const dispo = RECETTES.filter(r => problemes(r).ok);
  const dejaUtilises = new Set(Object.values(state.planning.repas));

  $('#modal-pick').innerHTML = `
    <button class="close" data-close>✕</button>
    <h2>${jour} — ${repas}</h2>
    <p class="muted">Choisissez un plat. Ceux déjà placés cette semaine sont grisés.</p>
    <input type="search" id="pick-q" placeholder="Filtrer…" style="margin-top:12px">
    <div class="picker-list" id="pick-list">
      ${dispo.map(r => ligneChoix(r, dejaUtilises.has(r.id), slotKey)).join('')}
    </div>`;
  $('#ov-pick').classList.add('on');
  const q = $('#pick-q');
  q.addEventListener('input', () => {
    const v = norm(q.value);
    $('#pick-list').innerHTML = dispo.filter(r => norm(r.nom).includes(v) || norm(r.cat).includes(v) || r.ingredients.some(i => norm(i[0]).includes(v)))
      .map(r => ligneChoix(r, dejaUtilises.has(r.id), slotKey)).join('');
  });
  setTimeout(() => q.focus(), 60);
}

function ligneChoix(r, deja, slotKey) {
  return `<button class="picker-item" data-pick="${r.id}" data-target="${slotKey}" style="${deja ? 'opacity:.45' : ''}">
    <span class="em">${r.plaisir ? '🎉' : EMOJI[r.cat] || '🍽️'}</span>
    <span>
      <span class="nm">${esc(r.nom)}${state.selection.includes(r.id) ? ' ★' : ''}</span>
      <span class="sub">${r.cat} · ${r.temps} min · ${r.kcal} kcal${deja ? ' · déjà au menu' : ''}</span>
    </span>
  </button>`;
}

/* ── Placement depuis la fiche recette ──────────────────── */
function ouvrirChoixCreneau(recetteId) {
  const r = RECETTES.find(x => x.id === recetteId);
  $('#modal-pick').innerHTML = `
    <button class="close" data-close>✕</button>
    <h2>Placer « ${esc(r.nom)} »</h2>
    <p class="muted">Sur quel repas de la semaine ?</p>
    <div class="picker-list">
      ${creneauxActifs().map(c => {
        const occ = state.planning.repas[c.key];
        const occR = occ && RECETTES.find(x => x.id === occ);
        return `<button class="picker-item" data-place="${c.key}" data-recette="${recetteId}">
          <span class="em">${WEEKEND.includes(c.jour.k) ? '🌟' : '📅'}</span>
          <span><span class="nm">${c.jour.n} — ${c.repas.n}</span>
          <span class="sub">${occR ? 'occupé par : ' + esc(occR.nom) : 'libre'}</span></span></button>`;
      }).join('')}
    </div>`;
  $('#ov-pick').classList.add('on');
}

/* ── Planificateur automatique ──────────────────────────── */
function melanger(a) {
  const t = [...a];
  for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
  return t;
}

function planifier(seulementVides) {
  const creneaux = creneauxActifs();
  const cibles = seulementVides ? creneaux.filter(c => !state.planning.repas[c.key]) : creneaux;
  if (!cibles.length) { toast('Toutes les cases sont déjà remplies'); return; }

  let pool = RECETTES.filter(r => problemes(r).ok);
  if (state.options.onlySeason) {
    const s = pool.filter(deSaison);
    if (s.length >= cibles.length + 4) pool = s;
    else toast('Peu de plats de saison : la contrainte a été assouplie');
  }
  if (pool.length < cibles.length) {
    pool = RECETTES.filter(r => problemes(r).alg.length === 0);
    toast('Peu de plats compatibles : les aversions ont été assouplies');
  }
  if (!pool.length) { toast('Aucun plat compatible — vérifiez les allergies déclarées'); return; }

  const utilises = new Set(seulementVides ? Object.values(state.planning.repas) : []);
  const N = cibles.length;

  // Quotas hebdomadaires inspirés des repères PNNS
  const besoins = [];
  const nPoisson = Math.max(2, Math.round(N * 0.18));
  const nLegum   = Math.max(2, Math.round(N * 0.28));
  const nPlaisir = N >= 10 ? 2 : 1;
  const nRouge   = N >= 6 ? 1 : 0;
  besoins.push('poissonGras');
  for (let i = 1; i < nPoisson; i++) besoins.push('poisson');
  for (let i = 0; i < nLegum; i++) besoins.push('legumineuse');
  for (let i = 0; i < nPlaisir; i++) besoins.push('plaisir');
  for (let i = 0; i < nRouge; i++) besoins.push('viandeRouge');
  while (besoins.length < N) besoins.push('libre');
  besoins.length = N;

  // Les plats plaisir vont sur le week-end (ou vendredi soir) en priorité
  const idxPlaisir = besoins.map((b, i) => b === 'plaisir' ? i : -1).filter(i => i >= 0);
  const ordre = melanger(cibles.map((c, i) => i));
  const attribution = new Array(N);
  const restants = besoins.filter(b => b !== 'plaisir');

  const creneauxFete = ordre.filter(i => WEEKEND.includes(cibles[i].jour.k) || (cibles[i].jour.k === 'ven' && cibles[i].repas.k === 'soir'));
  const posFete = melanger(creneauxFete).slice(0, idxPlaisir.length);
  posFete.forEach(i => attribution[i] = 'plaisir');

  let k = 0;
  const melangeRestants = melanger(restants);
  for (const i of ordre) if (!attribution[i]) attribution[i] = melangeRestants[k++] || 'libre';

  // Remplissage créneau par créneau
  let precedente = null, nonRemplis = 0;
  cibles.forEach((c, i) => {
    const besoin = attribution[i];
    const semaine = !WEEKEND.includes(c.jour.k);
    const rapideSouhaite = semaine && c.repas.k === 'midi';

    const candidats = pool.filter(r => {
      if (utilises.has(r.id)) return false;
      if (besoin === 'plaisir') return r.plaisir;
      if (r.plaisir) return false;
      if (besoin === 'poissonGras') return r.poissonGras;
      if (besoin === 'poisson') return r.cat === 'Poisson';
      if (besoin === 'legumineuse') return r.legumineuse;
      if (besoin === 'viandeRouge') return r.viandeRouge;
      return !r.viandeRouge;
    });

    const liste = candidats.length ? candidats : pool.filter(r => !utilises.has(r.id));
    if (!liste.length) { nonRemplis++; return; }

    const note = r => {
      let s = Math.random() * 2;
      if (state.options.useFav && state.selection.includes(r.id)) s += 6;
      if (deSaison(r)) s += 2.5;
      if (rapideSouhaite) s += r.temps <= 30 ? 2.5 : r.temps > 50 ? -3 : 0;
      if (semaine && r.temps > 60) s -= 2.5;
      if (precedente && r.cat === precedente.cat) s -= 3;
      if (precedente && r.legumineuse && precedente.legumineuse) s -= 1.5;
      return s;
    };
    const choix = liste.reduce((a, b) => note(b) > note(a) ? b : a);
    state.planning.repas[c.key] = choix.id;
    utilises.add(choix.id);
    precedente = choix;
  });

  sauver(); rendreSemaine(); rendreEquilibre(); majBadges();
  if (nonRemplis) {
    toast(`${nonRemplis} case${nonRemplis > 1 ? 's' : ''} non remplie${nonRemplis > 1 ? 's' : ''} : seulement ${pool.length} plats compatibles`);
  } else {
    toast(seulementVides ? 'Cases vides complétées' : 'Semaine composée ✨');
  }
}

$('#auto').addEventListener('click', () => planifier(false));
$('#auto-empty').addEventListener('click', () => planifier(true));
$('#clear-week').addEventListener('click', () => {
  if (!confirm('Effacer tous les plats de la semaine ?')) return;
  state.planning.repas = {};
  sauver(); rendreSemaine(); rendreEquilibre(); majBadges();
});
$('#use-fav').addEventListener('change', e => { state.options.useFav = e.target.checked; sauver(); });
$('#only-season').addEventListener('change', e => { state.options.onlySeason = e.target.checked; sauver(); });

/* ── Équilibre de la semaine ────────────────────────────── */
function platsPlanifies() {
  return Object.values(state.planning.repas).map(id => RECETTES.find(r => r.id === id)).filter(Boolean);
}

function rendreEquilibre() {
  const plats = platsPlanifies();
  const box = $('#balance');
  if (!plats.length) {
    box.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="big">🗓️</div>
      Composez la semaine pour voir son équilibre nutritionnel.</div>`;
    $('#bal-advice').innerHTML = '';
    return;
  }
  const n = plats.length;
  const nb = f => plats.filter(f).length;
  const poisson = nb(r => r.cat === 'Poisson');
  const gras = nb(r => r.poissonGras);
  const legum = nb(r => r.legumineuse);
  const rouge = nb(r => r.viandeRouge);
  const vege = nb(r => r.cat === 'Végétarien' || r.cat === 'Œufs');
  const plaisir = nb(r => r.plaisir);
  const kcal = Math.round(plats.reduce((s, r) => s + r.kcal, 0) / n);
  const fibres = Math.round(plats.reduce((s, r) => s + r.fibres, 0) / n);
  const temps = Math.round(plats.reduce((s, r) => s + r.temps, 0) / n);

  const st = (ok, warn) => ok ? 'ok' : warn ? 'warn' : 'bad';
  const cases = [
    { v: poisson, k: 'repas de poisson', st: st(poisson >= 2, poisson >= 1), t: poisson >= 2 ? 'Repère atteint (2/sem.)' : 'Visez 2 par semaine' },
    { v: gras, k: 'poisson gras', st: st(gras >= 1, false), t: gras >= 1 ? 'Oméga-3 assurés' : 'Ajoutez saumon, maquereau ou sardines' },
    { v: legum, k: 'plats de légumineuses', st: st(legum >= 3, legum >= 2), t: legum >= 3 ? 'Excellent' : 'Repère : 2 à 3 par semaine' },
    { v: rouge, k: 'viande rouge', st: st(rouge <= 1, rouge <= 2), t: rouge <= 1 ? 'Dans les clous (≤ 1/sem.)' : 'Trop : limitez à 1 par semaine' },
    { v: vege, k: 'repas végétariens', st: st(vege >= 2, vege >= 1), t: vege >= 2 ? 'Belle place au végétal' : 'Essayez d\'en ajouter un' },
    { v: plaisir, k: 'plats plaisir 🎉', st: st(plaisir >= 1 && plaisir <= 3, plaisir <= 4), t: plaisir === 0 ? 'Osez un plat plaisir !' : plaisir <= 3 ? 'Bon équilibre' : 'Un peu beaucoup' },
    { v: kcal, k: 'kcal moyen / repas', st: 'ok', t: 'Hors petit-déjeuner et goûter' },
    { v: fibres + ' g', k: 'fibres / repas', st: st(fibres >= 8, fibres >= 6), t: fibres >= 8 ? 'Très bien' : 'Plus de légumes secs et de complet' },
    { v: temps + ' min', k: 'temps moyen', st: 'ok', t: 'Préparation par repas' }
  ];
  box.innerHTML = cases.map(c => `<div class="card bal">
    <div class="v ${c.st}">${c.v}</div><div class="k">${c.k}</div><div class="st ${c.st}">${c.t}</div></div>`).join('');

  // Confrontation aux besoins caloriques de chacun
  const parJour = {};
  Object.entries(state.planning.repas).forEach(([k, id]) => {
    const r = RECETTES.find(x => x.id === id); if (!r) return;
    const j = k.split('-')[0];
    parJour[j] = (parJour[j] || 0) + r.kcal;
  });
  const jours = Object.values(parJour);
  const moyJour = jours.length ? Math.round(jours.reduce((a, b) => a + b, 0) / jours.length) : 0;
  const complement = 550; // petit-déjeuner + goûter, estimation basse

  $('#bal-advice').innerHTML = `<div class="card set-card">
    <h3>Ce que ça donne pour chacun</h3>
    <p>Les repas planifiés représentent en moyenne <b>${moyJour} kcal par jour et par personne</b>.
       En ajoutant un petit-déjeuner et un goûter (environ ${complement} kcal), on arrive à
       <b>${moyJour + complement} kcal</b> — à comparer à l'objectif de chacun.</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${state.personnes.map(p => {
        const w = poidsActuel(p), o = objectifCalorique(p, w);
        if (!o) return `<span class="chip">${esc(p.nom)} : profil incomplet</span>`;
        const total = moyJour + complement;
        const ecart = total - o.kcal;
        const cls = Math.abs(ecart) <= 200 ? 'g' : ecart > 0 ? 'w' : 'b';
        return `<span class="chip ${cls}">${esc(p.nom)} : objectif ${o.kcal} kcal · ${ecart > 0 ? '+' : ''}${ecart} kcal</span>`;
      }).join('')}
    </div>
    <p style="margin-top:12px;font-size:12.5px">Les portions se règlent surtout sur les féculents : servez-en davantage aux
       grands appétits et aux ados en croissance, un peu moins aux profils en déficit. Le reste de l'assiette — légumes et
       protéines — reste identique pour tout le monde.</p>
  </div>`;
}

/* ============================================================
   ONGLET COURSES
   ============================================================ */
function listeCourses() {
  const f = facteur();
  const map = new Map();
  platsPlanifies().forEach(r => {
    r.ingredients.forEach(([nom, q, u, rayon]) => {
      const cle = norm(nom) + '|' + u;
      if (!map.has(cle)) map.set(cle, { nom, u, rayon: rayonEffectif(nom, rayon), q: 0, plats: new Set() });
      const e = map.get(cle);
      e.q += q * f;
      e.plats.add(r.nom);
    });
  });
  const parRayon = {};
  [...map.entries()].forEach(([cle, e]) => {
    (parRayon[e.rayon] = parRayon[e.rayon] || []).push({ ...e, cle });
  });
  Object.values(parRayon).forEach(l => l.sort((a, b) => a.nom.localeCompare(b.nom, 'fr')));
  return parRayon;
}

function rendreCourses() {
  const parRayon = listeCourses();
  const box = $('#courses');
  const rayons = ORDRE_RAYONS.filter(r => parRayon[r]);
  const extra = state.courses.extra || [];

  if (!rayons.length && !extra.length) {
    box.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="big">🛒</div>
      La liste se remplit toute seule dès que des plats sont placés dans la semaine.</div>`;
    majBadges();
    return;
  }

  box.innerHTML = rayons.map(r => {
    const items = parRayon[r];
    const restants = items.filter(i => !state.courses.coches.includes(i.cle)).length;
    return `<div class="card rayon">
      <h3>${RAYONS[r]} <span class="n">${restants}/${items.length}</span></h3>
      ${items.map(i => {
        const done = state.courses.coches.includes(i.cle);
        return `<div class="item ${done ? 'done' : ''}">
          <input type="checkbox" id="c-${i.cle.replace(/[^a-z0-9]/gi, '')}" data-check="${i.cle}" ${done ? 'checked' : ''}>
          <label for="c-${i.cle.replace(/[^a-z0-9]/gi, '')}">${esc(i.nom)}
            <span class="src">${[...i.plats].slice(0, 2).map(esc).join(', ')}${i.plats.size > 2 ? ` +${i.plats.size - 2}` : ''}</span>
          </label>
          <span class="q">${fmtQte(i.q, i.u)}</span>
        </div>`;
      }).join('')}
    </div>`;
  }).join('') + (extra.length ? `<div class="card rayon">
      <h3>Divers <span class="n">${extra.length}</span></h3>
      ${extra.map((t, idx) => {
        const cle = 'x|' + idx;
        const done = state.courses.coches.includes(cle);
        return `<div class="item ${done ? 'done' : ''}">
          <input type="checkbox" id="cx-${idx}" data-check="${cle}" ${done ? 'checked' : ''}>
          <label for="cx-${idx}">${esc(t)}</label>
          <button class="btn sm ghost" data-del-extra="${idx}">✕</button>
        </div>`;
      }).join('')}
    </div>` : '');
  majBadges();
}

$('#courses').addEventListener('change', e => {
  const c = e.target.closest('[data-check]');
  if (!c) return;
  const cle = c.dataset.check;
  const i = state.courses.coches.indexOf(cle);
  if (c.checked && i < 0) state.courses.coches.push(cle);
  if (!c.checked && i >= 0) state.courses.coches.splice(i, 1);
  sauver(); rendreCourses();
});
$('#courses').addEventListener('click', e => {
  const d = e.target.closest('[data-del-extra]');
  if (!d) return;
  state.courses.extra.splice(+d.dataset.delExtra, 1);
  state.courses.coches = state.courses.coches.filter(c => !c.startsWith('x|'));
  sauver(); rendreCourses();
});
$('#extra-add').addEventListener('click', ajouterExtra);
$('#extra-in').addEventListener('keydown', e => { if (e.key === 'Enter') ajouterExtra(); });
function ajouterExtra() {
  const v = $('#extra-in').value.trim();
  if (!v) return;
  state.courses.extra.push(v);
  $('#extra-in').value = '';
  sauver(); rendreCourses();
}
$('#uncheck-all').addEventListener('click', () => { state.courses.coches = []; sauver(); rendreCourses(); });

$('#copy-list').addEventListener('click', async () => {
  const parRayon = listeCourses();
  let txt = `Liste de courses — semaine du ${dateCourte(state.planning.debut)} (${state.foyer.nbPersonnes} pers.)\n\n`;
  ORDRE_RAYONS.filter(r => parRayon[r]).forEach(r => {
    txt += `— ${RAYONS[r].toUpperCase()} —\n`;
    parRayon[r].forEach(i => { txt += `[ ] ${i.nom} : ${fmtQte(i.q, i.u)}\n`; });
    txt += '\n';
  });
  if (state.courses.extra.length) txt += `— DIVERS —\n${state.courses.extra.map(t => `[ ] ${t}`).join('\n')}\n`;
  try {
    await navigator.clipboard.writeText(txt);
    toast('Liste copiée dans le presse-papier');
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
    toast('Liste copiée');
  }
});
$('#print-list').addEventListener('click', () => window.print());

/* ============================================================
   ONGLET RÉGLAGES
   ============================================================ */
function rendreReglages() {
  $('#nb-pers').value = state.foyer.nbPersonnes;
  $('#week-start').value = state.planning.debut;
  $('#repas-planif').value = state.foyer.repasPlanifies;

  $('#allergies').innerHTML = state.personnes.map(p => `
    <div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
        <span class="avatar" style="width:24px;height:24px;border-radius:8px;font-size:12px;background:${p.couleur}">${esc(p.nom[0])}</span>
        <b style="font-size:13.5px">${esc(p.nom)}</b>
        <span class="muted">${(p.allergenes || []).length ? (p.allergenes.length + ' déclarée' + (p.allergenes.length > 1 ? 's' : '')) : 'aucune'}</span>
      </div>
      <div class="alg-grid">
        ${ALLERGENES.map(a => `<span class="alg ${(p.allergenes || []).includes(a.id) ? 'on' : ''}"
           data-alg="${a.id}" data-pers="${p.id}">${a.nom}</span>`).join('')}
      </div>
    </div>`).join('');

  $('#av-list').innerHTML = (state.aversions || []).map((t, i) =>
    `<span class="t">${esc(t)}<button data-del-av="${i}" title="Retirer">✕</button></span>`).join('')
    || '<span class="muted">Aucune aversion enregistrée.</span>';
}

$('#allergies').addEventListener('click', e => {
  const a = e.target.closest('[data-alg]');
  if (!a) return;
  const p = state.personnes.find(x => x.id === a.dataset.pers);
  p.allergenes = p.allergenes || [];
  const i = p.allergenes.indexOf(a.dataset.alg);
  if (i >= 0) p.allergenes.splice(i, 1); else p.allergenes.push(a.dataset.alg);
  sauver(); rendreReglages(); rendreRecettes();
});

$('#av-add').addEventListener('click', ajouterAversion);
$('#av-in').addEventListener('keydown', e => { if (e.key === 'Enter') ajouterAversion(); });
function ajouterAversion() {
  const v = $('#av-in').value.trim();
  if (!v) return;
  if (!state.aversions.includes(v)) state.aversions.push(v);
  $('#av-in').value = '';
  sauver(); rendreReglages(); rendreRecettes();
  toast(`« ${v} » sera évité`);
}
$('#av-list').addEventListener('click', e => {
  const d = e.target.closest('[data-del-av]');
  if (!d) return;
  state.aversions.splice(+d.dataset.delAv, 1);
  sauver(); rendreReglages(); rendreRecettes();
});

$('#nb-pers').addEventListener('change', e => {
  state.foyer.nbPersonnes = clamp(parseInt(e.target.value) || 4, 1, 12);
  e.target.value = state.foyer.nbPersonnes;
  sauver(); toast('Quantités recalculées');
});
$('#week-start').addEventListener('change', e => {
  state.planning.debut = e.target.value || lundiCourant();
  sauver();
});
$('#repas-planif').addEventListener('change', e => {
  state.foyer.repasPlanifies = e.target.value;
  // les créneaux devenus inactifs sont libérés
  const actifs = new Set(creneauxActifs().map(c => c.key));
  Object.keys(state.planning.repas).forEach(k => { if (!actifs.has(k)) delete state.planning.repas[k]; });
  sauver(); majBadges();
});

$('#export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `famille-en-forme-${aujourdhui()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$('#import-btn').addEventListener('click', () => $('#import').click());
$('#import').addEventListener('change', e => {
  const f = e.target.files[0];
  if (!f) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result);
      if (!d.personnes) throw new Error('format');
      state = { ...etatParDefaut(), ...d };
      sauver(); tout();
      toast('Données importées');
    } catch (err) { toast('Fichier illisible'); }
  };
  fr.readAsText(f);
});
$('#reset').addEventListener('click', () => {
  if (!confirm('Effacer toutes les données (profils, pesées, planning, courses) ?')) return;
  localStorage.removeItem(CLE);
  state = etatParDefaut();
  sauver(); tout();
  toast('Tout a été réinitialisé');
});

/* ============================================================
   MODALES — fermeture et actions déléguées
   ============================================================ */
document.addEventListener('click', e => {
  if (e.target.closest('[data-close]') || e.target.classList.contains('overlay')) {
    $$('.overlay').forEach(o => o.classList.remove('on'));
  }
  const f = e.target.closest('.modal [data-fav]');
  if (f) basculerFavori(f.dataset.fav);

  const p = e.target.closest('[data-plan]');
  if (p) { $('#ov-recipe').classList.remove('on'); ouvrirChoixCreneau(p.dataset.plan); }

  const pick = e.target.closest('[data-pick]');
  if (pick) {
    state.planning.repas[pick.dataset.target] = pick.dataset.pick;
    sauver(); $('#ov-pick').classList.remove('on');
    rendreSemaine(); rendreEquilibre(); majBadges();
    toast('Plat ajouté au planning');
  }
  const place = e.target.closest('[data-place]');
  if (place) {
    state.planning.repas[place.dataset.place] = place.dataset.recette;
    sauver(); $('#ov-pick').classList.remove('on');
    rendreSemaine(); rendreEquilibre(); majBadges();
    toast('Plat placé dans la semaine');
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') $$('.overlay').forEach(o => o.classList.remove('on'));
});

/* ============================================================
   DÉMARRAGE
   ============================================================ */
function majBadges() {
  $('#n-semaine').textContent = Object.values(state.planning.repas).filter(Boolean).length;
  const parRayon = listeCourses();
  const total = Object.values(parRayon).reduce((s, l) => s + l.length, 0) + (state.courses.extra || []).length;
  const restants = total - state.courses.coches.length;
  $('#n-courses').textContent = Math.max(0, restants);
}

function tout() {
  rendrePersonnes(); rendreRecettes(); rendreSemaine(); rendreEquilibre(); rendreCourses(); rendreReglages(); majBadges();
}

tout();
