/**
 * ParkAlert — profil, véhicules et réglages.
 * §3 pseudonyme / points / fiabilité · §4 enregistrement d'un véhicule
 * §5 préférence de stationnement mémorisée · §31 fiabilité
 */

import { COLORS } from './config.js';
import { reliabilityFrom, reliabilityLabel, RELIABILITY_WEIGHTS, neededLengthCm, fmtMetres } from './core.js';
import { identify, TEMPLATES, vehicleLabel } from './vehicles.js';
import * as db from './backend.js';
import { S, emit } from './state.js';
import { el, $, toast, openModal, closeModal, chooser, askNotificationPermission, LS } from './ui.js';
import { confirmSheet, infoSheet } from './pickers.js';
import * as push from './push.js';

const metres = fmtMetres;

/* ─────────────────────── §4 — enregistrer un véhicule ─────────────────────── */

export async function addVehicleFlow(first = false) {
  const input = el('input', { class: 'field', id: 'veh-q', type: 'text', placeholder: 'Ex. : Renault Captur 2023 rouge', autocomplete: 'off' });
  const results = el('div', { class: 'results' });
  const hint = el('div', { class: 'muted', text: 'Écrivez simplement la marque, le modèle, l’année et la couleur.' });
  let selected = null;
  let detected = { year: null, color: null };

  const pick = (v) => {
    selected = v;
    results.querySelectorAll('.result').forEach((r) => r.classList.toggle('sel', r.dataset.id === v.id));
  };

  const run = () => {
    const q = input.value.trim();
    results.innerHTML = '';
    selected = null;
    if (q.length < 2) { hint.textContent = 'Écrivez simplement la marque, le modèle, l’année et la couleur.'; return; }
    const res = identify(q);
    detected = { year: res.year, color: res.color };
    if (!res.matches.length) {
      hint.innerHTML = 'Véhicule non reconnu. <b>Nous n’inventons pas les dimensions</b> : choisissez un gabarit ou saisissez vos cotes ci-dessous.';
      return;
    }
    hint.innerHTML = 'Confirmez le véhicule proposé — les dimensions viennent de la base automobile, pas d’une estimation.';
    for (const m of res.matches) {
      results.append(el('button', {
        class: 'result', type: 'button', dataset: { id: m.id }, onclick: () => pick(m),
      },
      el('b', { text: `${m.brand} ${m.model}` }),
      el('span', { text: `${m.yearFrom}–${m.yearTo} · ${metres(m.lengthCm)} × ${metres(m.widthCm)}` })));
    }
    if (res.matches.length) pick(res.matches[0]);
  };

  let deb;
  input.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(run, 300); });

  const manual = el('details', { class: 'manual' },
    el('summary', { text: 'Mon véhicule n’est pas dans la liste' }),
    el('div', { class: 'sublabel', text: 'Gabarit approchant (estimation)' }),
    (() => {
      const c = chooser(TEMPLATES.map((t) => ({ id: t.id, label: t.label })), { value: null, columns: 1 });
      c.id = 'tpl-picker';
      return c;
    })(),
    el('div', { class: 'sublabel', text: 'Ou dimensions exactes de votre carte grise' }),
    el('div', { class: 'custom-row' },
      el('label', { text: 'Longueur' }), el('input', { type: 'number', id: 'man-len', min: '200', max: '900', step: '1', placeholder: 'cm' }), el('span', { text: 'cm' })),
    el('div', { class: 'custom-row' },
      el('label', { text: 'Largeur' }), el('input', { type: 'number', id: 'man-wid', min: '100', max: '300', step: '1', placeholder: 'cm' }), el('span', { text: 'cm' })),
  );

  const colorField = el('input', { class: 'field', id: 'veh-color', type: 'text', placeholder: 'Couleur (ex. rouge)', list: 'color-list', autocomplete: 'off' });
  const yearField = el('input', { class: 'field', id: 'veh-year', type: 'number', min: '1990', max: '2030', placeholder: 'Année' });

  const body = el('div', {},
    el('div', { class: 'sublabel', text: 'Décrivez votre véhicule' }),
    input, hint, results, manual,
    el('div', { class: 'sublabel', text: 'Couleur et année (pour être reconnu sur place)' }),
    el('div', { class: 'btn-row' }, colorField, yearField),
    el('datalist', { id: 'color-list' }, ...COLORS.map((c) => el('option', { value: c }))),
  );

  input.addEventListener('input', () => {
    const res = identify(input.value);
    if (res.color && !colorField.value) colorField.value = res.color;
    if (res.year && !yearField.value) yearField.value = String(res.year);
  });

  const res = await openModal({
    title: first ? 'Enregistrez votre véhicule' : 'Ajouter un véhicule',
    subtitle: 'L’IA aide à identifier le modèle ; les dimensions viennent d’une base automobile.',
    body,
    actions: [{
      label: 'Confirmer ce véhicule', value: 'ok', variant: 'btn-primary', keep: true,
      onClick: () => {
        const tpl = manual.querySelector('#tpl-picker')?.value;
        const manLen = Number(manual.querySelector('#man-len').value) || 0;
        if (!selected && !tpl && !manLen) {
          toast('Véhicule non défini', 'Choisissez une proposition, un gabarit, ou saisissez vos dimensions.', '#ef4444');
          return;
        }
        closeModal('ok');
      },
    }],
    dismissible: !first,
  });
  if (res !== 'ok') return null;

  const tplId = manual.querySelector('#tpl-picker')?.value;
  const manLen = Number(manual.querySelector('#man-len').value) || 0;
  const manWid = Number(manual.querySelector('#man-wid').value) || 0;

  let vehicle;
  if (manLen) {
    vehicle = { brand: input.value.trim() || 'Mon véhicule', model: '', lengthCm: manLen, widthCm: manWid || 180, source: 'manuel' };
  } else if (selected) {
    vehicle = { brand: selected.brand, model: selected.model, lengthCm: selected.lengthCm, widthCm: selected.widthCm, source: 'base' };
  } else {
    const t = TEMPLATES.find((x) => x.id === tplId);
    vehicle = { brand: input.value.trim() || t.label, model: '', lengthCm: t.lengthCm, widthCm: t.widthCm, source: 'gabarit' };
  }

  vehicle.color = colorField.value.trim() || detected.color || '';
  vehicle.year = Number(yearField.value) || detected.year || null;

  const id = db.pushKey(`users/${S.uid}/vehicles`);
  vehicle.id = id;
  vehicle.createdAt = db.now();
  await db.write(`users/${S.uid}/vehicles/${id}`, vehicle);
  if (!S.defaultVehicleId) {
    S.defaultVehicleId = id;
    await db.patch(`users/${S.uid}`, { defaultVehicle: id });
  }
  // Pas d'ajout local : l'abonnement à `users/{uid}` rafraîchit déjà la liste,
  // et un ajout optimiste créerait un doublon selon l'ordre d'arrivée.
  emit();

  if (vehicle.source === 'gabarit') {
    await infoSheet('Dimensions estimées',
      'Votre véhicule n’étant pas dans la base, ParkAlert utilise un gabarit approchant. '
      + 'Pour une mise en relation plus fiable, saisissez la longueur exacte figurant sur votre carte grise (repère 5.1).');
  }
  return vehicle;
}

export async function removeVehicle(id) {
  const ok = await confirmSheet('Supprimer ce véhicule ?', '', 'Supprimer', 'Annuler', 'btn-red');
  if (!ok) return;
  await db.del(`users/${S.uid}/vehicles/${id}`);
  if (S.defaultVehicleId === id) {
    S.defaultVehicleId = S.vehicles.find((v) => v.id !== id)?.id || null;
    await db.patch(`users/${S.uid}`, { defaultVehicle: S.defaultVehicleId });
  }
  emit();
}

export async function setDefaultVehicle(id) {
  S.defaultVehicleId = id;
  await db.patch(`users/${S.uid}`, { defaultVehicle: id });
  emit();
}

/* ─────────────────────── Vue Profil ─────────────────────── */

export function renderProfile() {
  const root = $('#view-profile');
  if (!root) return;
  const rel = S.reliability ?? 100;
  const { label, color } = reliabilityLabel(rel);
  const stats = S.profile?.stats || {};

  root.innerHTML = '';
  root.append(
    el('div', { class: 'card' },
      el('div', { class: 'profile-name', text: S.profile?.pseudo || 'Conducteur' }),
      el('div', { class: 'muted small', text: S.user?.isAnonymous ? 'Compte invité — données non conservées' : (S.user?.email || '') }),
      el('div', { class: 'twin' },
        el('div', {}, el('div', { class: 'sublabel', text: 'Points d’entraide' }), el('div', { class: 'big', text: String(S.profile?.points || 0) })),
        el('div', {}, el('div', { class: 'sublabel', text: 'Fiabilité' }), el('div', { class: 'big', style: { color }, text: String(rel) }), el('div', { class: 'muted small', text: label })),
      ),
      el('div', { class: 'note', html: 'Les points récompensent les transmissions réussies et vous rendent <b>prioritaire</b> quand vous cherchez. La fiabilité, elle, reflète le respect de vos réservations.' }),
    ),

    el('div', { class: 'card' },
      el('div', { class: 'sublabel', text: 'Statistiques' }),
      el('div', { class: 'kv', html: '<span>Places transmises</span><b>' + (stats.given || 0) + '</b>' }),
      el('div', { class: 'kv', html: '<span>Places obtenues</span><b>' + (stats.taken || 0) + '</b>' }),
      el('div', { class: 'kv', html: '<span>Signalements</span><b>' + (stats.signals || 0) + '</b>' }),
    ),

    el('div', { class: 'card' },
      el('div', { class: 'sublabel', text: 'Mes véhicules' }),
      ...(S.vehicles.length ? S.vehicles.map(vehicleRow) : [el('div', { class: 'muted', text: 'Aucun véhicule enregistré.' })]),
      el('button', { class: 'btn btn-ghost small', onclick: () => addVehicleFlow() }, 'Ajouter un véhicule'),
    ),

    el('div', { class: 'card' },
      el('div', { class: 'sublabel', text: 'Réglages' }),
      toggleRow('Rappels avant départ', !!S.profile?.prefs?.reminders, async (v) => {
        await db.patch(`users/${S.uid}/prefs`, { reminders: v });
        S.profile.prefs = { ...(S.profile.prefs || {}), reminders: v };
      }),
      toggleRow('Notifications', typeof Notification !== 'undefined' && Notification.permission === 'granted', async (v, input) => {
        if (!v) {
          await push.unsubscribe(S.uid);
          toast('Notifications coupées', 'Pour les réactiver totalement, passez aussi par les réglages de votre navigateur.', '#64748b');
          return;
        }
        const ok = await askNotificationPermission();
        input.checked = ok;
        if (ok) {
          const res = await push.subscribeIfPossible(S.uid);
          if (res === 'ok') toast('Notifications activées', 'Vous serez prévenu même application fermée.', '#0f7a45');
        }
      }),
      el('div', { class: 'note', html: 'Sans notifications, il faut garder l’application ouverte pour être prévenu qu’une place se libère.' }),
      el('div', { class: 'note', html: 'Le partage de position ne démarre qu’après une réservation et s’arrête automatiquement à la fin.' }),
      el('button', { class: 'btn btn-ghost small', onclick: () => showReliabilityDetail() }, 'Comment est calculée ma fiabilité ?'),
      el('a', { class: 'btn btn-quiet small', href: 'confidentialite.html' }, 'Confidentialité et mentions légales'),
      el('button', { class: 'btn btn-quiet small', onclick: () => import('./app.js').then((m) => m.doLogout()) }, 'Se déconnecter'),
      el('button', { class: 'btn btn-red small', onclick: () => deleteAccount() }, 'Supprimer mon compte'),
    ),
  );
}

function vehicleRow(v) {
  const isDefault = v.id === S.defaultVehicleId;
  return el('div', { class: `veh ${isDefault ? 'default' : ''}` },
    el('div', { class: 'veh-main' },
      el('b', { text: vehicleLabel(v) }),
      el('span', { class: 'muted', text: `${metres(v.lengthCm)}${v.color ? ` · ${v.color}` : ''} · ${sourceLabel(v.source)}` }),
      el('span', { class: 'muted', text: `Place nécessaire : ${metres(neededLengthCm(v.lengthCm))}` }),
    ),
    el('div', { class: 'veh-actions' },
      isDefault ? el('span', { class: 'badge badge-green', text: 'Par défaut' })
        : el('button', { class: 'chip', onclick: () => setDefaultVehicle(v.id) }, 'Utiliser'),
      el('button', { class: 'chip danger', onclick: () => removeVehicle(v.id) }, 'Supprimer'),
    ));
}

function sourceLabel(src) {
  if (src === 'base') return 'dimensions constructeur';
  if (src === 'manuel') return 'dimensions saisies';
  return 'gabarit estimé';
}

function toggleRow(label, checked, onChange) {
  const input = el('input', { type: 'checkbox', checked: checked || false });
  input.addEventListener('change', () => onChange(input.checked, input));
  return el('label', { class: 'toggle' }, el('span', { text: label }), input);
}

function showReliabilityDetail() {
  const c = S.profile?.counters || {};
  const rows = Object.entries(RELIABILITY_WEIGHTS).map(([k, w]) => {
    const names = {
      late: 'Retards constatés', lateCancel: 'Annulations tardives', noShow: 'Absences sans prévenir',
      falseReport: 'Faux signalements', badSpot: 'Places mal décrites',
    };
    const n = Number(c[k]) || 0;
    return `<div class="kv"><span>${names[k]}</span><b>${n}${n > 1 ? ` (−${(n - 1) * w})` : ''}</b></div>`;
  }).join('');
  infoSheet('Indice de fiabilité',
    'Une erreur occasionnelle n’est <b>jamais</b> sanctionnée : la première occurrence de chaque type d’incident est neutre. '
    + 'Seule la répétition fait baisser l’indice.<br><br>' + rows);
}

/* ─────────────────────── Vue Historique ─────────────────────── */

export function renderHistory(entries) {
  const root = $('#view-history');
  if (!root) return;
  root.innerHTML = '';
  root.append(el('div', { class: 'sublabel', text: 'Historique de vos actions' }));
  if (!entries.length) {
    root.append(el('div', { class: 'empty', text: 'Aucune action pour l’instant.' }));
    return;
  }
  for (const h of entries) {
    root.append(el('div', { class: 'card compact' },
      el('div', { class: 'muted small', text: new Date(h.ts).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }),
      el('div', { text: h.action }),
      h.detail ? el('div', { class: 'muted small', text: h.detail }) : null,
      h.delta ? el('div', {
        class: `badge ${h.delta > 0 ? 'badge-green' : 'badge-red'}`,
        text: `${h.delta > 0 ? '+' : '−'}${Math.abs(h.delta)} points`,
      }) : null,
    ));
  }
}

/**
 * Suppression définitive du compte et de toutes ses données.
 * Obligatoire pour publier sur l'App Store et Google Play, et de toute façon
 * dû à l'utilisateur : on efface vraiment, on ne se contente pas de masquer.
 */
export async function deleteAccount() {
  const ok = await confirmSheet(
    'Supprimer votre compte ?',
    'Cette action est définitive.',
    'Supprimer définitivement', 'Annuler', 'btn-red',
    'Vos véhicules, vos points, votre historique et votre position seront effacés. '
    + 'Aucune copie n’est conservée.',
  );
  if (!ok) return;

  const uid = S.uid;
  try {
    await push.unsubscribe(uid);
    // On retire d'abord ce qui est visible des autres conducteurs.
    await Promise.all([
      db.del(`seekers/${uid}`),
      db.del(`spots/${uid}`),
      db.del(`offers/${uid}`),
    ]);
    await db.del(`users/${uid}`);
    await db.deleteAccount();
    toast('Compte supprimé', 'Toutes vos données ont été effacées.', '#0f7a45');
  } catch (err) {
    console.error('[parkalert] suppression du compte', err);
    await infoSheet('Reconnexion nécessaire',
      'Par sécurité, la suppression demande une connexion récente. '
      + 'Déconnectez-vous, reconnectez-vous, puis réessayez.');
  }
}

/* ─────────────────────── Première configuration ─────────────────────── */

export async function onboarding() {
  if (!S.profile?.pseudo || S.profile.pseudo === 'Conducteur') {
    const input = el('input', { class: 'field', type: 'text', placeholder: 'Votre pseudonyme', maxlength: '24', value: S.profile?.pseudo === 'Conducteur' ? '' : (S.profile?.pseudo || '') });
    const res = await openModal({
      title: 'Bienvenue sur ParkAlert',
      subtitle: 'Comment souhaitez-vous être appelé ?',
      body: el('div', {}, el('div', { class: 'note', html: 'Un pseudonyme suffit : les autres conducteurs ne voient jamais votre nom complet, votre téléphone ni votre plaque.' }), input),
      actions: [{ label: 'Continuer', value: 'ok', variant: 'btn-primary' }],
      dismissible: false,
    });
    const pseudo = input.value.trim() || 'Conducteur';
    if (res === 'ok') {
      await db.patch(`users/${S.uid}`, { pseudo });
      S.profile.pseudo = pseudo;
    }
  }
  if (!S.vehicles.length) await addVehicleFlow(true);
  if (!LS.get('notifAsked')) { LS.set('notifAsked', true); await askNotificationPermission(); }
  emit();
}

export function computeReliability(profile) {
  return reliabilityFrom(profile?.counters || {});
}
