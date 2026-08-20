/**
 * ParkAlert — briques d'interface : sélecteurs, toasts, feuilles modales,
 * notifications. Conçu pour un usage au volant (§34) : gros boutons,
 * une ou deux actions par écran, très peu de saisie.
 */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Échappe le texte utilisateur avant toute insertion en HTML. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ─────────────────────────── Notifications ─────────────────────────── */

let toastTimer;
export function toast(title, message, color = '#4ade80', ms = 6000) {
  const box = $('#toast');
  if (!box) return;
  $('#toast-title').textContent = title;
  $('#toast-title').style.color = color;
  $('#toast-msg').textContent = message || '';
  box.style.borderColor = color;
  box.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('show'), ms);
}

export function vibrate(pattern = [40, 60, 40]) {
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch { /* ignoré */ } }
}

export async function askNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try { return (await Notification.requestPermission()) === 'granted'; } catch { return false; }
}

/** Notification système (utile quand l'écran est éteint) + toast dans l'app. */
export function notify(title, message, color) {
  toast(title, message, color);
  vibrate();
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    try { new Notification(title, { body: message, icon: 'icons/icon-192.png', tag: 'parkalert' }); } catch { /* ignoré */ }
  }
}

/* ─────────────────────────── Feuille modale ─────────────────────────── */

let modalResolve = null;

export function closeModal(value) {
  const back = $('#modal-back');
  if (!back) return;
  back.classList.remove('show');
  $('#modal-body').innerHTML = '';
  $('#modal-actions').innerHTML = '';
  const r = modalResolve; modalResolve = null;
  if (r) r(value);
}

/**
 * Affiche une feuille en bas d'écran.
 * @param {{title:string, subtitle?:string, body?:Node|string,
 *          actions?:Array<{label:string, value:any, variant?:string, keep?:boolean, onClick?:Function}>,
 *          dismissible?:boolean}} opts
 * @returns {Promise<any>} valeur de l'action choisie (null si fermé)
 */
export function openModal(opts) {
  const back = $('#modal-back');
  $('#modal-title').textContent = opts.title || '';
  const sub = $('#modal-sub');
  sub.textContent = opts.subtitle || '';
  sub.style.display = opts.subtitle ? 'block' : 'none';

  const body = $('#modal-body');
  body.innerHTML = '';
  if (opts.body instanceof Node) body.append(opts.body);
  else if (typeof opts.body === 'string') body.innerHTML = opts.body;

  const actions = $('#modal-actions');
  actions.innerHTML = '';
  for (const a of opts.actions || []) {
    actions.append(el('button', {
      class: `btn ${a.variant || 'btn-ghost'}`,
      onclick: async () => {
        if (a.onClick) { const r = await a.onClick(); if (a.keep) return; closeModal(r === undefined ? a.value : r); return; }
        closeModal(a.value);
      },
    }, a.label));
  }

  const dismissible = opts.dismissible !== false;
  $('#modal-close').style.display = dismissible ? 'block' : 'none';
  back.dataset.dismissible = dismissible ? '1' : '0';
  back.classList.add('show');

  if (modalResolve) { const r = modalResolve; modalResolve = null; r(null); }
  return new Promise((resolve) => { modalResolve = resolve; });
}

export function isModalOpen() { return $('#modal-back')?.classList.contains('show'); }

/** Liste de gros choix tactiles ; renvoie l'id choisi. */
export function chooser(options, { value, columns = 2 } = {}) {
  const wrap = el('div', { class: `chooser cols-${columns}` });
  let current = value;
  const buttons = options.map((o) => {
    const b = el('button', {
      class: `choice ${o.id === current ? 'sel' : ''}`,
      type: 'button',
      onclick: () => {
        current = o.id;
        buttons.forEach((x) => x.classList.toggle('sel', x.dataset.id === current));
        wrap.dispatchEvent(new CustomEvent('choose', { detail: current }));
      },
      dataset: { id: o.id },
    }, el('span', { class: 'choice-label', text: o.label }), o.hint ? el('span', { class: 'choice-hint', text: o.hint }) : null);
    return b;
  });
  wrap.append(...buttons);
  Object.defineProperty(wrap, 'value', { get: () => current, set: (v) => { current = v; buttons.forEach((x) => x.classList.toggle('sel', x.dataset.id === current)); } });
  return wrap;
}

/* ─────────────────────────── Divers ─────────────────────────── */

export function showScreen(id) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}

export function showView(name) {
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
}

export function setText(sel, value) { const n = $(sel); if (n) n.textContent = value; }

export const LS = {
  get(k, fallback = null) { try { const v = localStorage.getItem(`pa.${k}`); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(`pa.${k}`, JSON.stringify(v)); } catch { /* quota */ } },
  del(k) { try { localStorage.removeItem(`pa.${k}`); } catch { /* ignoré */ } },
};
