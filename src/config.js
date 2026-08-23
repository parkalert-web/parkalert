/**
 * ParkAlert — configuration & paramètres de calibration.
 *
 * Le cahier des charges (§7) précise que les conversions
 * « Serré / Normal / À l'aise » -> longueur devront être calibrées
 * pendant les tests : toutes les constantes sensibles sont donc
 * regroupées ici et modifiables sans toucher au reste du code.
 */

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDib5u-o-6WTmkyyCeM0WjOrgQxpdLSmUU',
  authDomain: 'parking-98737.firebaseapp.com',
  databaseURL: 'https://parking-98737-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'parking-98737',
  storageBucket: 'parking-98737.firebasestorage.app',
  messagingSenderId: '302972513258',
  appId: '1:302972513258:web:10f9a170ad8ca956be2093',
};

export const TUNING = {
  /**
   * Place nécessaire pour se garer : elle dépend de la VOITURE, pas d'une envie.
   * Un créneau se prend en biais : plus la voiture est longue, plus il faut de
   * débattement. On ajoute donc un pourcentage de la longueur, avec un minimum
   * absolu pour les toutes petites voitures.
   */
  manoeuvre: { ratioPct: 15, minCm: 45 },

  /** §6/§7 — longueur estimée d'une place à partir du gabarit du donneur (cm ajoutés). */
  spotBonus: { serre: 30, normal: 50, aise: 100 },

  /** Sous cet écart, la place est annoncée comme « juste » (compatible mais serrée). */
  marginalGapCm: 20,

  /** §15 — délai de réponse à une proposition avant passage au candidat suivant. */
  offerTimeoutS: 45,

  /**
   * Délai laissé au conducteur qui part pour accepter le candidat qu'on lui
   * présente. Passé ce délai, le candidat est libéré et la place repart en
   * recherche : elle ne doit jamais rester bloquée parce qu'un téléphone est
   * resté au fond d'une poche.
   */
  donorConfirmS: 120,
  /** Au bout de N décisions non prises, l'annonce est abandonnée. */
  donorConfirmMisses: 2,

  /**
   * Attendre dans sa voiture que quelqu'un veuille la place peut être long.
   * Toutes les N secondes sans candidat, on redonne la main au conducteur :
   * continuer d'attendre, ou partir.
   */
  waitPromptS: 60,

  /** Nombre de fois où celui qui arrive peut repousser son heure d'arrivée. */
  etaPushbacksMax: 2,

  /** §22 — rayon de confirmation d'arrivée par GPS (30 à 50 m dans le cahier des charges). */
  proximityM: 40,

  /** §23 — tolérance de retard accordée au conducteur qui arrive. */
  lateToleranceS: 120,
  /** §23 — alerte envoyée au retardataire ce nombre de secondes avant la fin de la tolérance. */
  lateWarnBeforeS: 120,

  /** §20 — rappel « rejoignez votre voiture » N secondes avant l'arrivée estimée. */
  readyReminderS: 180,

  /** Estimation de trajet (§38 : un calcul routier précis viendra après le prototype). */
  urbanSpeedKmh: 20,
  detourFactor: 1.35,
  fixedApproachS: 60,

  /** §35 — deux temps d'arrivée séparés de moins de N minutes sont considérés « très proches ». */
  etaTieMin: 1,

  /** §9 — rayon de recherche intelligent. */
  radiusExtendFactor: 1.6,
  radiusExtendMaxM: 400,

  /** §32 — durée de vie d'un simple signalement de place libre. */
  signalTtlS: 420,

  /** §29 — points gagnés par le donneur pour une transmission validée des deux côtés. */
  points: { transfer: 10 },

  /**
   * §30 — anti-triche.
   * `donorCooldownS` : délai minimal entre deux récompenses, quel que soit le partenaire.
   * `rewardOncePerPartner` : une transmission avec une personne donnée ne rapporte
   *   des points QUE la première fois. Deux amis qui se passeraient la même place en
   *   boucle ne gagnent donc rien au-delà de la première fois.
   */
  antiFraud: { donorCooldownS: 1800, rewardOncePerPartner: true },

  /** §11 — rappel d'annonce de départ pour un utilisateur stationné (désactivable). */
  parkedReminderS: 2700,

  /** §19 — position volontairement approximative tant que le donneur n'a pas rejoint sa voiture. */
  coarseDecimals: 3,

  /** Purge des annonces obsolètes. */
  seekerTtlS: 1800,
  spotTtlS: 5400,

  /** Rafraîchissement de la position partagée pendant une réservation. */
  liveShareIntervalS: 8,
};

/** §6 — comment le donneur décrit l'espace réellement libre autour de sa voiture. */
/**
 * Raccourci de développement : sur une machine locale ou sur le banc d'essai,
 * « ?waitPromptS=3 » permet de rejouer en quelques secondes un scénario qui
 * prend une minute en usage réel.
 *
 * Volontairement inopérant en production : sans ce garde-fou, n'importe qui
 * pourrait allonger un délai depuis la barre d'adresse et bloquer un
 * conducteur — par exemple en lui envoyant une proposition qui n'expire jamais.
 */
const HOTES_DE_TEST = /^(localhost|127\.0\.0\.1|\[::1\])$|\.test$/;

if (typeof location !== 'undefined' && location.search && HOTES_DE_TEST.test(location.hostname)) {
  const params = new URLSearchParams(location.search);
  for (const cle of ['waitPromptS', 'offerTimeoutS', 'donorConfirmS']) {
    const valeur = Number(params.get(cle));
    if (Number.isFinite(valeur) && valeur > 0) TUNING[cle] = valeur;
  }
}

export const COMFORT = [
  { id: 'serre', label: 'Serré', hint: 'Presque pare-chocs contre pare-chocs' },
  { id: 'normal', label: 'Normal', hint: 'Un espace normal devant et derrière' },
  { id: 'aise', label: 'Large', hint: 'Beaucoup de place autour' },
  { id: 'perso', label: 'Je mesure', hint: 'J’indique l’espace en cm' },
];

/** §10 — la seule question de temps posée au donneur. */
export const DEPARTURE_CHOICES = [
  { id: 'now', label: 'Maintenant', minutes: 0 },
  { id: 'm5', label: '5 min', minutes: 5 },
  { id: 'm10', label: '10 min', minutes: 10 },
  { id: 'm15', label: '15 min', minutes: 15 },
  { id: 'm20', label: '20 min', minutes: 20 },
  { id: 'm30', label: '30 min', minutes: 30 },
  { id: 'custom', label: 'Personnalisé', minutes: null },
];

export const COLORS = [
  'blanc', 'noir', 'gris', 'gris clair', 'gris foncé', 'argent', 'rouge', 'bordeaux',
  'bleu', 'bleu clair', 'bleu foncé', 'bleu marine', 'vert', 'vert foncé', 'jaune',
  'orange', 'marron', 'beige', 'violet', 'rose', 'or', 'bronze',
];
