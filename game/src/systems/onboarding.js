/**
 * Prise en main.
 *
 * Un bac à sable où rien n'est expliqué n'est pas un jeu difficile, c'est un
 * jeu qu'on ferme. Trois choses ici :
 *
 *   — la **barre de commandes**, en bas, qui montre en permanence ce qu'on
 *     peut faire *maintenant* et avec quelle touche ;
 *   — le **tutoriel** du premier lancement, huit gestes à faire dans l'ordre,
 *     chacun validé dès qu'on l'a fait ;
 *   — le **panneau d'aide** (H), le rappel complet, à portée de main.
 */

/** Touches affichées selon la situation. La première est la plus utile. */
export function contextKeys(game) {
  const p = game.player;
  if (game.state !== 'play' || p.dead) return [];
  if (game.inside) {
    return [
      ['E', game.hud.actionLabel || 'Agir'],
      ['ZQSD', 'Se déplacer'],
      ['Souris', 'Regarder'],
      ['Alt', 'Curseur'],
      ['H', 'Aide'],
    ];
  }
  if (p.vehicle) {
    return [
      ['Z / S', 'Accélérer, freiner'],
      ['Q / D', 'Tourner'],
      ['Espace', 'Frein à main'],
      ['F', 'Descendre'],
      ['H', 'Klaxon'],
      ['M', 'Carte'],
    ];
  }
  const keys = [['ZQSD', 'Marcher'], ['Souris', 'Regarder'], ['Maj', 'Courir']];
  if (game.hud.actionLabel) keys.unshift(['E', game.hud.actionLabel]);
  if (game.nearestVehicle && game.nearestVehicle(p.x, p.z, 6)) keys.push(['F', 'Monter']);
  if (!p.weaponDef.melee) keys.push(['Clic', 'Tirer']);
  keys.push(['M', 'Carte'], ['H', 'Aide']);
  return keys.slice(0, 7);
}

/**
 * Les huit gestes du tutoriel. `done(game)` dit si c'est fait ; `why` explique
 * à quoi ça sert, parce qu'une consigne sans raison ne se retient pas.
 */
export const TUTORIAL_STEPS = [
  {
    id: 'look',
    goal: 'Bouge la <b>souris</b> pour regarder autour de toi',
    why: 'La souris oriente la caméra, sans rien tenir. Maintiens <b>Alt</b> pour récupérer le curseur et cliquer les boutons de droite.',
    // Un quart de tour suffit, ou une seconde de mouvement : on valide au geste,
    // pas à l'endurance.
    done: (g) => g.tuto.turned > 1.4 || g.tuto.looked > 1,
  },
  {
    id: 'walk',
    goal: 'Avance avec <b>Z Q S D</b>',
    why: 'Les flèches marchent aussi. <b>Maj</b> pour courir.',
    done: (g) => g.tuto.walked > 8,
  },
  {
    id: 'car',
    goal: 'Approche d’une voiture et appuie sur <b>F</b>',
    why: 'N’importe quelle voiture de la rue fait l’affaire — c’est un GTA, après tout.',
    done: (g) => !!g.player.vehicle,
  },
  {
    id: 'drive',
    goal: 'Roule une soixantaine de mètres',
    why: '<b>Z</b> accélère, <b>S</b> freine et fait marche arrière, <b>Espace</b> est le frein à main.',
    done: (g) => g.tuto.driven > 60,
  },
  {
    id: 'out',
    goal: 'Ressors du véhicule avec <b>F</b>',
    why: 'On peut descendre en roulant, mais ça fait mal.',
    done: (g) => g.tuto.reachedCar && !g.player.vehicle,
  },
  {
    id: 'map',
    goal: 'Ouvre la carte avec <b>M</b>',
    why: 'Elle liste les dix missions et explique chaque point quand on clique dessus.',
    done: (g) => g.tuto.openedMap,
  },
  {
    id: 'inv',
    goal: 'Ouvre ton inventaire avec <b>I</b>',
    why: 'Tes armes et tes munitions. Les chiffres <b>1</b> à <b>9</b> les changent aussi.',
    done: (g) => g.tuto.openedInv,
  },
  {
    id: 'talk',
    goal: 'Approche un passant et appuie sur <b>E</b>',
    why: '<b>E</b> sert à tout : parler, entrer quelque part, acheter, lancer une mission.',
    done: (g) => g.tuto.talked,
  },
];

/** Contenu du panneau d'aide, par thème. */
export const HELP_SECTIONS = [
  {
    title: 'Se déplacer',
    rows: [
      ['Z Q S D', 'Marcher, conduire'],
      ['Souris', 'Orienter la caméra'],
      ['Maj', 'Courir'],
      ['Espace', 'Sauter · frein à main en voiture'],
      ['F', 'Monter dans un véhicule, en descendre'],
      ['V', 'Changer de vue : épaule, large, première personne'],
    ],
  },
  {
    title: 'Agir',
    rows: [
      ['E', 'Parler à un passant, entrer dans un bâtiment, acheter, lancer une mission'],
      ['Clic gauche', 'Tirer ou frapper'],
      ['Clic droit', 'Viser précisément'],
      ['R', 'Recharger'],
      ['1 – 9', 'Changer d’arme'],
      ['X', 'Capacité spéciale du personnage'],
    ],
  },
  {
    title: 'Écrans',
    rows: [
      ['M', 'Carte : missions, lieux, destination'],
      ['I', 'Inventaire des armes'],
      ['H', 'Cette aide'],
      ['Échap', 'Menu, réglages, retour au menu principal'],
      ['Alt', 'Rendre le curseur pour cliquer les boutons (maintenir)'],
      ['G', 'Changer de personnage (maintenir)'],
    ],
  },
  {
    title: 'Bon à savoir',
    rows: [
      ['Étoiles', 'La police monte avec vos délits — et vos infractions au code de la route'],
      ['Los Santos Customs', 'Réparer la voiture efface aussi l’indice de recherche'],
      ['Appartement', 'Le lit enregistre la partie'],
      ['Ruiné', 'Plus un dollar en poche et la partie s’arrête'],
    ],
  },
];

/** Suit l'avancement du tutoriel et met la barre de commandes à jour. */
export class Onboarding {
  constructor(game) {
    this.game = game;
    this.step = 0;
    this.finished = false;
    this.lastKeys = '';
    game.tuto = {
      looked: 0, turned: 0, walked: 0, driven: 0,
      reachedCar: false, openedMap: false, openedInv: false, talked: false,
    };
    // On mesure le mouvement de la caméra, pas les deltas de la souris : ceux-ci
    // sont déjà remis à zéro quand on arrive ici.
    this.lastYaw = game.camera.yaw;
    this.lastPitch = game.camera.pitch;
  }

  skip() {
    this.finished = true;
    this.step = TUTORIAL_STEPS.length;
  }

  /** Avance d'une étape si le geste demandé a été fait. */
  update(dt) {
    const g = this.game;
    const p = g.player;
    // compteurs
    const bouge = Math.abs(g.camera.yaw - this.lastYaw) + Math.abs(g.camera.pitch - this.lastPitch);
    this.lastYaw = g.camera.yaw;
    this.lastPitch = g.camera.pitch;
    if (bouge > 0.004) { g.tuto.looked += dt; g.tuto.turned += bouge; }
    if (!p.vehicle && p.move > 0.1) g.tuto.walked += p.move * 3 * dt;
    if (p.vehicle) { g.tuto.reachedCar = true; g.tuto.driven += Math.abs(p.vehicle.speed) * dt; }
    if (g.hud.mapOpen) g.tuto.openedMap = true;
    if (g.hud.invOpen) g.tuto.openedInv = true;
    if (g.peds.some((q) => q.line && q.talkT > 0)) g.tuto.talked = true;

    if (this.finished) return null;
    const s = TUTORIAL_STEPS[this.step];
    if (!s) { this.finished = true; return 'fin'; }
    if (s.done(g)) {
      this.step++;
      return this.step >= TUTORIAL_STEPS.length ? 'fin' : 'suivant';
    }
    return null;
  }

  get current() {
    return this.finished ? null : TUTORIAL_STEPS[this.step] || null;
  }
}
