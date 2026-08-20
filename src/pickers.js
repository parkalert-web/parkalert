/**
 * ParkAlert — sélecteurs réutilisés côté donneur et côté chercheur.
 * Objectif §34 : aucune saisie au clavier pour les actions courantes.
 */

import { COMFORT, DEPARTURE_CHOICES, TUNING } from './config.js';
import { openModal, chooser, el, esc } from './ui.js';

/**
 * Choix « Serré / Normal / À l'aise / Personnalisé » (§5 et §6).
 * @returns {Promise<{qual:string, customCm:number|null}|'later'|null>}
 */
export async function askComfort({
  title, subtitle, value = 'normal', customCm = 60, allowLater = false, laterLabel = 'PLUS TARD', explain = null,
} = {}) {
  const opts = COMFORT.map((c) => ({ id: c.id, label: c.label.toUpperCase(), hint: c.hint }));
  const picker = chooser(opts, { value, columns: 2 });

  const custom = el('div', { class: 'custom-row', style: { display: value === 'perso' ? 'flex' : 'none' } },
    el('label', { text: 'Marge souhaitée' }),
    el('input', { type: 'number', id: 'custom-cm', min: '0', max: '300', step: '5', value: String(customCm) }),
    el('span', { text: 'cm' }));

  picker.addEventListener('choose', (e) => {
    custom.style.display = e.detail === 'perso' ? 'flex' : 'none';
  });

  const body = el('div', {},
    explain ? el('div', { class: 'note', html: explain }) : null,
    picker,
    custom);

  const actions = [
    { label: 'VALIDER', value: 'ok', variant: 'btn-green' },
    ...(allowLater ? [{ label: laterLabel, value: 'later' }] : []),
  ];

  const res = await openModal({ title, subtitle, body, actions });
  if (res === 'later') return 'later';
  if (res !== 'ok') return null;
  const qual = picker.value;
  const cm = Number(custom.querySelector('#custom-cm')?.value) || 0;
  return { qual, customCm: qual === 'perso' ? cm : null };
}

/**
 * §10 — l'unique question de temps posée au donneur.
 * @returns {Promise<{minutes:number, mode:'now'|'timed'}|null>}
 */
export async function askDeparture() {
  const picker = chooser(DEPARTURE_CHOICES.map((d) => ({ id: d.id, label: d.label })), { value: 'm10', columns: 2 });
  const custom = el('div', { class: 'custom-row', style: { display: 'none' } },
    el('label', { text: 'Je pars dans' }),
    el('input', { type: 'number', id: 'custom-min', min: '1', max: '120', step: '1', value: '25' }),
    el('span', { text: 'min' }));
  picker.addEventListener('choose', (e) => { custom.style.display = e.detail === 'custom' ? 'flex' : 'none'; });

  const body = el('div', {},
    el('div', { class: 'note', html: 'Ce délai comprend le temps de rejoindre votre voiture <b>et</b> le temps que vous acceptez d’attendre le conducteur.' }),
    picker, custom);

  const res = await openModal({
    title: 'Dans combien de temps maximum êtes-vous prêt à libérer votre place ?',
    body,
    actions: [{ label: 'CONTINUER', value: 'ok', variant: 'btn-green' }],
  });
  if (res !== 'ok') return null;
  const choice = DEPARTURE_CHOICES.find((d) => d.id === picker.value);
  const minutes = choice.minutes != null ? choice.minutes : Math.max(1, Number(custom.querySelector('#custom-min').value) || 15);
  return { minutes, mode: minutes === 0 ? 'now' : 'timed' };
}

/** §23 — durée d'attente supplémentaire accordée à un conducteur en retard. */
export async function askExtraWait() {
  const options = [
    { id: '2', label: '+2 MIN' }, { id: '5', label: '+5 MIN' },
    { id: '10', label: '+10 MIN' }, { id: 'custom', label: 'PERSONNALISÉ' },
  ];
  const picker = chooser(options, { value: '2', columns: 2 });
  const custom = el('div', { class: 'custom-row', style: { display: 'none' } },
    el('label', { text: 'J’attends encore' }),
    el('input', { type: 'number', id: 'extra-min', min: '1', max: '60', value: '15' }),
    el('span', { text: 'min' }));
  picker.addEventListener('choose', (e) => { custom.style.display = e.detail === 'custom' ? 'flex' : 'none'; });

  const res = await openModal({
    title: 'Combien de temps attendez-vous encore ?',
    body: el('div', {}, picker, custom),
    actions: [{ label: 'VALIDER', value: 'ok', variant: 'btn-green' }],
    dismissible: false,
  });
  if (res !== 'ok') return null;
  const minutes = picker.value === 'custom'
    ? Math.max(1, Number(custom.querySelector('#extra-min').value) || 5)
    : Number(picker.value);
  return minutes;
}

/** §26 — motif d'échec, sans jamais demander de mesure précise. */
export async function askNoFitReason() {
  const picker = chooser([
    { id: 'short', label: 'PLACE TROP COURTE' },
    { id: 'access', label: 'ACCÈS IMPOSSIBLE' },
    { id: 'other', label: 'AUTRE PROBLÈME' },
  ], { value: 'short', columns: 1 });

  const degree = chooser([
    { id: 'little', label: 'UN PEU TROP GRANDE' },
    { id: 'much', label: 'BEAUCOUP TROP GRANDE' },
    { id: 'unknown', label: 'JE NE SAIS PAS' },
  ], { value: 'unknown', columns: 1 });
  const degreeWrap = el('div', {}, el('div', { class: 'sublabel', text: 'VOTRE VOITURE EST…' }), degree);
  picker.addEventListener('choose', (e) => { degreeWrap.style.display = e.detail === 'short' ? 'block' : 'none'; });

  const res = await openModal({
    title: 'Pourquoi ne pouvez-vous pas vous garer ?',
    subtitle: 'Aucun malus : vous êtes bien sur place.',
    body: el('div', {}, picker, degreeWrap),
    actions: [{ label: 'ENVOYER', value: 'ok', variant: 'btn-orange' }],
  });
  if (res !== 'ok') return null;
  return { reason: picker.value, degree: picker.value === 'short' ? degree.value : null };
}

/** Confirmation générique avec deux gros boutons. */
export function confirmSheet(title, subtitle, yes = 'OUI', no = 'NON', variant = 'btn-green', html = null) {
  return openModal({
    title,
    subtitle,
    body: html ? el('div', { class: 'note', html }) : null,
    actions: [
      { label: yes, value: true, variant },
      { label: no, value: false },
    ],
  });
}

export function infoSheet(title, html, label = 'J’AI COMPRIS') {
  return openModal({ title, body: el('div', { class: 'note', html }), actions: [{ label, value: true, variant: 'btn-green' }] });
}

/** Récapitulatif de compatibilité affiché à l'utilisateur (jamais de centimètres imposés). */
export function fitBadge(fit) {
  if (!fit) return '';
  if (!fit.ok) return `<span class="badge badge-red">Trop juste</span>`;
  if (fit.marginal) return `<span class="badge badge-orange">Ça passe, mais c’est serré</span>`;
  return `<span class="badge badge-green">Taille compatible</span>`;
}

export const OFFER_TIMEOUT_MS = TUNING.offerTimeoutS * 1000;
export { esc };
