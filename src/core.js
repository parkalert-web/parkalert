/**
 * ParkAlert — logique métier pure (aucune dépendance DOM ni réseau).
 * Tout ce qui décide « qui est compatible » et « qui est prioritaire » vit ici,
 * pour rester testable (voir tests/core.test.mjs).
 */

import { TUNING } from './config.js';

/* ─────────────────────────── Géométrie ─────────────────────────── */

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

/** Distance orthodromique en mètres. */
export function distanceM(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return Infinity;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Estimation du temps d'arrivée en ville.
 * §38 : un vrai calcul routier (sens uniques, trafic) est prévu après le prototype ;
 * ici on applique un facteur de détour à la distance à vol d'oiseau.
 */
export function travelEstimate(distM, tuning = TUNING) {
  if (!Number.isFinite(distM)) return { distM: Infinity, seconds: Infinity, minutes: Infinity };
  const roadM = distM * tuning.detourFactor;
  const seconds = (roadM / ((tuning.urbanSpeedKmh * 1000) / 3600)) + tuning.fixedApproachS;
  return { distM: Math.round(distM), roadM: Math.round(roadM), seconds: Math.round(seconds), minutes: Math.max(1, Math.round(seconds / 60)) };
}

/** Longueur en mètres, écrite à la française : 4,23 m. */
export function fmtMetres(cm) {
  if (!cm) return '—';
  return `${(cm / 100).toFixed(2).replace('.', ',')} m`;
}

/** §19 — position volontairement approximative tant que le partage précis n'est pas justifié. */
export function coarsen(pos, decimals = TUNING.coarseDecimals) {
  if (!pos) return null;
  const f = 10 ** decimals;
  return { lat: Math.round(pos.lat * f) / f, lng: Math.round(pos.lng * f) / f, approx: true };
}

/* ─────────────────── Compatibilité de taille (§6 §7) ─────────────────── */

/**
 * Longueur de place nécessaire à un véhicule donné.
 *
 * Ce n'est PAS une préférence de confort : c'est la place que prend réellement
 * la voiture pour entrer dans un créneau. Une petite voiture n'a donc jamais
 * besoin d'une grande place, et une grande voiture n'est jamais envoyée sur un
 * créneau où elle ne rentrerait pas.
 */
export function neededLengthCm(vehicleLengthCm, tuning = TUNING) {
  const len = Number(vehicleLengthCm) || 0;
  if (!len) return 0;
  const { ratioPct, minCm } = tuning.manoeuvre;
  return Math.round(len + Math.max(minCm, (len * ratioPct) / 100));
}

/**
 * Longueur estimée de la place libérée, à partir du véhicule du donneur
 * et de sa qualification « Serré / Normal / À l'aise / Personnalisé ».
 * Le donneur ne mesure jamais rien (§6).
 */
export function estimatedSpotCm(donorLengthCm, qual, customCm, tuning = TUNING) {
  const bonus = qual === 'perso'
    ? Math.max(0, Number(customCm) || 0)
    : (tuning.spotBonus[qual] ?? tuning.spotBonus.normal);
  return Math.round((Number(donorLengthCm) || 0) + bonus);
}

/**
 * @returns {{ok:boolean, marginal:boolean, gapCm:number}}
 *   `marginal` = ça rentre, mais c'est juste : on prévient le conducteur.
 */
export function sizeFit(spotCm, neededCm, tuning = TUNING) {
  const gapCm = Math.round(spotCm - neededCm);
  return { ok: gapCm >= 0, marginal: gapCm >= 0 && gapCm < tuning.marginalGapCm, gapCm };
}

/* ─────────────────── Sélection des candidats (§12 §13 §14 §24) ─────────────────── */

/**
 * Filtre les chercheurs selon les 4 critères OBLIGATOIRES du §12.
 * Les points n'interviennent jamais ici : ils ne rendent pas
 * un véhicule incompatible compatible.
 *
 * @param {object} p
 * @param {{lat,lng}} p.spot               position de la place
 * @param {number} p.spotCm                longueur estimée de la place
 * @param {number} p.readyInMin            délai annoncé par le donneur (0 = « Maintenant »)
 * @param {Array}  p.seekers               chercheurs actifs
 * @param {string[]} [p.exclude]           uid à écarter (refus, retard, incompatible)
 * @param {number} [p.blockedAboveCm]      §27 : après un « je ne peux pas me garer »,
 *                                         on n'repropose pas à un besoin >= à celui qui a échoué
 * @param {boolean} [p.allowExtendedRadius] §9 : autoriser légèrement hors rayon
 */
export function selectCandidates(p, tuning = TUNING) {
  const {
    spot, spotCm, readyInMin, seekers = [],
    exclude = [], blockedAboveCm = null, allowExtendedRadius = false,
  } = p;
  const excluded = new Set(exclude);
  const out = [];

  for (const s of seekers) {
    if (!s || excluded.has(s.uid)) continue;
    if (s.state && s.state !== 'searching') continue;

    // 1. Taille compatible
    const fit = sizeFit(spotCm, s.neededCm, tuning);
    if (!fit.ok) continue;
    if (blockedAboveCm != null && s.neededCm >= blockedAboveCm) continue;

    // 2. Destination compatible
    const destM = distanceM(spot, { lat: s.destLat, lng: s.destLng });
    const radius = Number(s.radiusM) || 400;
    const extended = Math.min(radius * tuning.radiusExtendFactor, radius + tuning.radiusExtendMaxM);
    const inRadius = destM <= radius;
    if (!inRadius && !(allowExtendedRadius && destM <= extended)) continue;

    // 3. Temps compatible
    const trip = travelEstimate(distanceM({ lat: s.lat, lng: s.lng }, spot), tuning);
    if (!Number.isFinite(trip.minutes)) continue;
    if (readyInMin > 0 && trip.minutes > readyInMin) continue;

    // 4. Place disponible : garanti par l'appelant (une place réservée n'est plus proposée)
    out.push({
      ...s,
      etaMin: trip.minutes,
      etaS: trip.seconds,
      approachM: trip.distM,
      destM: Math.round(destM),
      outOfRadius: !inRadius,
      fit,
    });
  }
  return out;
}

/**
 * Ordre de priorité (§13 §14 §24 §35).
 * @param {'points'|'fastest'} mode
 *   'points'  : départ annoncé dans X minutes -> les plus de points d'abord
 *   'fastest' : « Maintenant » ou réattribution urgente -> le plus rapide d'abord,
 *               puis les points, puis la fiabilité si les temps sont très proches
 *
 * Dans les deux modes, une égalité de points est tranchée en faveur du plus
 * grand véhicule qui rentre : c'est lui qui a le plus de mal à se garer.
 */
export function rankCandidates(list, mode, tuning = TUNING) {
  const arr = [...list];

  /**
   * À nombre de points égal, la place revient au plus grand véhicule parmi ceux
   * qui y rentrent. Une grande voiture trouve beaucoup plus rarement un créneau
   * à sa taille ; la petite, elle, se contentera d'une place où la grande
   * n'entrerait pas. Envoyer une petite voiture sur une grande place gâche la
   * seule place utilisable par la grande.
   *
   * Ce critère n'arbitre qu'une égalité : plus de points l'emporte toujours.
   */
  const byRarity = (a, b) => (b.neededCm || 0) - (a.neededCm || 0);

  if (mode === 'points') {
    arr.sort((a, b) => (b.points - a.points)
      || byRarity(a, b)
      || (a.etaMin - b.etaMin)
      || (b.reliability - a.reliability));
  } else {
    arr.sort((a, b) => {
      const d = a.etaMin - b.etaMin;
      if (Math.abs(d) >= tuning.etaTieMin) return d;
      return (b.points - a.points) || byRarity(a, b) || (b.reliability - a.reliability) || d;
    });
  }
  // À qualité égale, une place dans le rayon demandé passe avant une place « élargie » (§9).
  arr.sort((a, b) => Number(a.outOfRadius) - Number(b.outOfRadius) || 0);
  return arr;
}

/**
 * Chaîne complète : filtrer puis ordonner.
 * Le rayon élargi (§9) n'est tenté que si personne n'est compatible
 * dans le rayon demandé — inutile d'alerter plus loin quand il y a
 * déjà des candidats proches.
 */
export function buildQueue(p, mode, tuning = TUNING) {
  let candidates = selectCandidates({ ...p, allowExtendedRadius: false }, tuning);
  if (!candidates.length) {
    candidates = selectCandidates({ ...p, allowExtendedRadius: true }, tuning);
  }
  return rankCandidates(candidates, mode, tuning);
}

/* ─────────────────── Points, fiabilité, anti-triche (§29 §30 §31) ─────────────────── */

/**
 * §30 — un donneur ne peut pas être récompensé deux fois en moins de 30 minutes,
 * ni deux fois avec le même partenaire en moins de 24 h.
 * Il peut continuer à aider, simplement sans nouvelle récompense.
 */
export function rewardEligibility(profile, partnerUid, now = Date.now(), tuning = TUNING) {
  const last = Number(profile?.lastRewardAt) || 0;
  if (now - last < tuning.antiFraud.donorCooldownS * 1000) {
    const waitS = Math.ceil((tuning.antiFraud.donorCooldownS * 1000 - (now - last)) / 1000);
    return { eligible: false, reason: 'cooldown', waitS };
  }
  const pair = Number(profile?.pairCooldowns?.[partnerUid]) || 0;
  if (now - pair < tuning.antiFraud.pairCooldownS * 1000) {
    const waitS = Math.ceil((tuning.antiFraud.pairCooldownS * 1000 - (now - pair)) / 1000);
    return { eligible: false, reason: 'pair', waitS };
  }
  return { eligible: true, points: tuning.points.transfer };
}

/**
 * §28 §30 — la transmission n'est validée que si les deux confirmations
 * sont présentes ET que les deux téléphones sont réellement près de la place.
 */
export function transferValid(session, tuning = TUNING) {
  if (!session) return { valid: false, reason: 'no-session' };
  if (!session.confirmDonor || !session.confirmSeeker) return { valid: false, reason: 'double-confirm' };
  const spot = { lat: session.spotLat, lng: session.spotLng };
  const dDonor = distanceM(spot, session.donorPos);
  const dSeeker = distanceM(spot, session.seekerPos);
  if (!(dDonor <= tuning.proximityM * 3) || !(dSeeker <= tuning.proximityM)) {
    return { valid: false, reason: 'gps', dDonor, dSeeker };
  }
  return { valid: true };
}

/**
 * §31 — la fiabilité sanctionne les comportements RÉPÉTÉS, pas l'erreur ponctuelle.
 * Chaque type d'incident bénéficie d'une première occurrence gratuite.
 */
export const RELIABILITY_WEIGHTS = {
  late: 3,          // retard constaté
  lateCancel: 8,    // annulation tardive
  noShow: 15,       // absence sans prévenir
  falseReport: 10,  // faux signalement
  badSpot: 5,       // place régulièrement mal décrite
};

export function reliabilityFrom(counters = {}) {
  let penalty = 0;
  for (const [key, weight] of Object.entries(RELIABILITY_WEIGHTS)) {
    const n = Math.max(0, Number(counters[key]) || 0);
    if (n > 1) penalty += (n - 1) * weight; // la 1re fois ne compte pas
  }
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function reliabilityLabel(score) {
  if (score >= 85) return { label: 'Fiable', color: '#4ade80' };
  if (score >= 60) return { label: 'Correct', color: '#f59e0b' };
  return { label: 'Peu fiable', color: '#ef4444' };
}

/**
 * §25 — conséquence d'une annulation, graduée selon le moment.
 * `elapsedRatio` = part du trajet déjà écoulée (0 = juste réservé, 1 = heure d'arrivée).
 */
export function cancelImpact(elapsedRatio, arrived = false) {
  if (arrived) return { counter: null, label: 'Aucun impact', severity: 'none' };
  if (elapsedRatio < 0.2) return { counter: null, label: 'Aucun impact', severity: 'none' };
  if (elapsedRatio < 0.6) return { counter: null, label: 'Impact faible', severity: 'low' };
  return { counter: 'lateCancel', label: 'Annulation tardive — malus', severity: 'high' };
}

/* ─────────────────────────── Formatage ─────────────────────────── */

export function fmtDistance(m) {
  if (!Number.isFinite(m)) return '—';
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function fmtDuration(sec) {
  if (!Number.isFinite(sec)) return '—';
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export function fmtClock(ts) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
