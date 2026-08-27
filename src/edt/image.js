/**
 * Emploi du temps — préparation de la photo avant lecture.
 *
 * Une photo d'emploi du temps prise au téléphone est rarement propre :
 * éclairage inégal, léger travers, ombre du portable. On corrige tout ça ici,
 * avec des traitements classiques (niveaux de gris, seuillage local, détection
 * des traits du tableau) — rien qui demande un service en ligne.
 *
 * Tout se passe dans le navigateur : l'image ne quitte jamais l'appareil.
 */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Décode un fichier image en respectant l'orientation EXIF du téléphone. */
export async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* repli */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'sync';
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = () => ko(new Error('image illisible')); img.src = url; });
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 10000); }
}

/** Dessine l'image à la bonne taille et à la bonne rotation (quarts de tour). */
export function render(source, { rotate = 0, maxSide = 2000, minSide = 900 } = {}) {
  const sw = source.width || source.naturalWidth;
  const sh = source.height || source.naturalHeight;
  const quarter = ((Math.round(rotate / 90) % 4) + 4) % 4;
  const swapped = quarter % 2 === 1;
  const w0 = swapped ? sh : sw;
  const h0 = swapped ? sw : sh;

  let scale = Math.min(1, maxSide / Math.max(w0, h0));
  if (Math.max(w0, h0) * scale < minSide) scale = Math.min(2, minSide / Math.max(w0, h0));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w0 * scale));
  canvas.height = Math.max(1, Math.round(h0 * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((quarter * Math.PI) / 2);
  ctx.drawImage(source, -(sw * scale) / 2, -(sh * scale) / 2, sw * scale, sh * scale);
  ctx.restore();
  return canvas;
}

/** Niveaux de gris (luminance perçue). */
export function toGray(canvas) {
  const { width, height } = canvas;
  const data = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data;
  const gray = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = (data[i] * 77 + data[i + 1] * 151 + data[i + 2] * 28) >> 8;
  }
  return gray;
}

/**
 * Seuillage local : chaque pixel est comparé à la moyenne de son voisinage.
 * C'est ce qui permet de lire une feuille à moitié dans l'ombre.
 * Renvoie 1 pour l'encre, 0 pour le papier.
 */
export function threshold(gray, width, height, { window: winOpt, bias = 10 } = {}) {
  const win = Math.max(15, (winOpt ?? Math.round(width / 22)) | 1);
  const half = win >> 1;

  // Image intégrale : la moyenne d'un rectangle coûte alors quatre lectures.
  const sum = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let row = 0;
    for (let x = 0; x < width; x += 1) {
      row += gray[y * width + x];
      sum[(y + 1) * (width + 1) + x + 1] = sum[y * (width + 1) + x + 1] + row;
    }
  }
  const mean = (x0, y0, x1, y1) => {
    const a = sum[y0 * (width + 1) + x0];
    const b = sum[y0 * (width + 1) + x1];
    const c = sum[y1 * (width + 1) + x0];
    const d = sum[y1 * (width + 1) + x1];
    return (d - b - c + a) / Math.max(1, (x1 - x0) * (y1 - y0));
  };

  const ink = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const y0 = clamp(y - half, 0, height - 1);
    const y1 = clamp(y + half + 1, 1, height);
    for (let x = 0; x < width; x += 1) {
      const x0 = clamp(x - half, 0, width - 1);
      const x1 = clamp(x + half + 1, 1, width);
      ink[y * width + x] = gray[y * width + x] < mean(x0, y0, x1, y1) - bias ? 1 : 0;
    }
  }
  return ink;
}

/** Enlève les pixels isolés (grain du capteur, trame du papier). */
export function denoise(ink, width, height) {
  const out = new Uint8Array(ink);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      if (!ink[i]) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) n += ink[i + dy * width + dx];
      if (n <= 1) out[i] = 0;
    }
  }
  return out;
}

/**
 * Travers de la photo : on cherche l'angle qui aligne le mieux les lignes de
 * texte (celui pour lequel l'encre se concentre dans le moins de rangées).
 * Renvoie un angle en degrés, entre -4 et 4.
 */
export function estimateSkew(ink, width, height, { max = 4, step = 0.4 } = {}) {
  const scale = Math.min(1, 480 / width);
  const w = Math.max(2, Math.round(width * scale));
  const h = Math.max(2, Math.round(height * scale));
  const small = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const sy = Math.min(height - 1, Math.round(y / scale));
    for (let x = 0; x < w; x += 1) small[y * w + x] = ink[sy * width + Math.min(width - 1, Math.round(x / scale))];
  }

  const scoreOf = (a) => {
    const tan = Math.tan((a * Math.PI) / 180);
    const rows = new Float64Array(h + 2);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (!small[y * w + x]) continue;
        const yy = Math.round(y + (x - w / 2) * tan);
        if (yy >= 0 && yy < h) rows[yy] += 1;
      }
    }
    let score = 0;
    for (let y = 1; y < h; y += 1) score += (rows[y] - rows[y - 1]) ** 2;   // contraste entre rangées
    return score;
  };

  const flat = scoreOf(0);
  let best = { angle: 0, score: flat };
  for (let a = -max; a <= max + 1e-9; a += step) {
    if (Math.abs(a) < 1e-9) continue;
    const score = scoreOf(a);
    if (score > best.score) best = { angle: a, score };
  }
  // Dans le doute, on ne touche pas à la photo : redresser à tort abîme le texte.
  if (Math.abs(best.angle) < 0.2 || best.score < flat * 1.04) return 0;
  return best.angle;
}

/** Redresse le canevas d'un petit angle (fond blanc, pas de bord noir). */
export function deskew(canvas, angle) {
  if (!angle) return canvas;
  const out = document.createElement('canvas');
  out.width = canvas.width; out.height = canvas.height;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2, out.height / 2);
  // `estimateSkew` renvoie déjà l'angle qui remet les lignes à plat.
  ctx.rotate((angle * Math.PI) / 180);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}

/** Canevas noir sur blanc, tel qu'il sera donné à l'OCR. */
export function inkToCanvas(ink, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.createImageData(width, height);
  for (let i = 0, p = 0; i < ink.length; i += 1, p += 4) {
    const v = ink[i] ? 0 : 255;
    img.data[p] = v; img.data[p + 1] = v; img.data[p + 2] = v; img.data[p + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Vignette légère : c'est elle qu'on garde en mémoire, pas la photo entière. */
export function thumbnail(canvas, maxSide = 380) {
  const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(canvas.width * scale));
  out.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = out.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out.toDataURL('image/jpeg', 0.7);
}

/* ─────────────────── Traits du tableau ─────────────────── */

/**
 * Rangées de traits horizontaux à l'intérieur d'une colonne.
 * On regarde colonne par colonne : une case fusionnée (un cours de deux heures)
 * n'a pas de trait au milieu, et c'est exactement ce qui nous dit qu'elle dure
 * deux heures.
 */
export function horizontalRules(ink, width, height, x0 = 0, x1 = width, { ratio = 0.62 } = {}) {
  const left = clamp(Math.round(x0), 0, width - 1);
  const right = clamp(Math.round(x1), left + 1, width);
  const span = right - left;
  if (span < 20) return [];

  const counts = new Float64Array(height);
  for (let y = 0; y < height; y += 1) {
    let n = 0;
    for (let x = left; x < right; x += 1) n += ink[y * width + x];
    counts[y] = n / span;
  }
  // Un trait légèrement de travers déborde sur deux rangées : on lisse.
  const smooth = new Float64Array(height);
  for (let y = 0; y < height; y += 1) {
    smooth[y] = Math.max(counts[y], (counts[y - 1] || 0) * 0.9, (counts[y + 1] || 0) * 0.9);
  }

  const edges = [];
  let run = null;
  for (let y = 0; y < height; y += 1) {
    if (smooth[y] >= ratio) { run = run || { y0: y }; run.y1 = y; }
    else if (run) { edges.push((run.y0 + run.y1) / 2); run = null; }
  }
  if (run) edges.push((run.y0 + run.y1) / 2);

  // Deux traits collés (bordure double) n'en font qu'un.
  const merged = [];
  for (const e of edges) {
    if (merged.length && e - merged[merged.length - 1] < Math.max(3, height * 0.006)) merged[merged.length - 1] = (merged[merged.length - 1] + e) / 2;
    else merged.push(e);
  }
  return merged;
}

/** Traits verticaux (colonnes du tableau), même principe. */
export function verticalRules(ink, width, height, { ratio = 0.62 } = {}) {
  const counts = new Float64Array(width);
  for (let x = 0; x < width; x += 1) {
    let n = 0;
    for (let y = 0; y < height; y += 1) n += ink[y * width + x];
    counts[x] = n / height;
  }
  const edges = [];
  let run = null;
  for (let x = 0; x < width; x += 1) {
    if (counts[x] >= ratio) { run = run || { x0: x }; run.x1 = x; }
    else if (run) { edges.push((run.x0 + run.x1) / 2); run = null; }
  }
  if (run) edges.push((run.x0 + run.x1) / 2);
  return edges;
}

/**
 * Chaîne complète : fichier → image prête pour l'OCR + traits du tableau.
 * @returns {{ canvas, ocrCanvas, ink, width, height, angle, rules }}
 */
export async function prepare(file, { rotate = 0, maxSide = 2000, binarize = true } = {}) {
  const source = await decode(file);
  let canvas = render(source, { rotate, maxSide });

  let gray = toGray(canvas);
  let ink = denoise(threshold(gray, canvas.width, canvas.height), canvas.width, canvas.height);

  const angle = estimateSkew(ink, canvas.width, canvas.height);
  if (angle) {
    canvas = deskew(canvas, angle);
    gray = toGray(canvas);
    ink = denoise(threshold(gray, canvas.width, canvas.height), canvas.width, canvas.height);
  }

  const { width, height } = canvas;
  return {
    canvas,
    ocrCanvas: binarize ? inkToCanvas(ink, width, height) : canvas,
    ink,
    width,
    height,
    angle,
    rules: {
      rows: horizontalRules(ink, width, height),
      cols: verticalRules(ink, width, height),
    },
    rowsForBand: (x0, x1) => horizontalRules(ink, width, height, x0, x1),
  };
}
