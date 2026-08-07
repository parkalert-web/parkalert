# Quinze Nuits

`quinzenuits.html` — un jeu complet dans un seul fichier, sans dépendance, sans
image ni son téléchargé. Tout le décor est engendré au canvas, tout le son est
synthétisé par Web Audio.

## L'idée

Un immeuble éventré, quatre survivants, quinze nuits avant qu'une colonne
militaire passe dans le quartier. Le jeu n'est pas une longue partie : c'est
**deux jeux qui alternent**, et le lien entre les deux est toute la tension.

- **Le jour, on décide.** Aucun geste d'adresse. Qui sort fouiller et à quelle
  adresse, qui renforce la barricade, qui soigne, qui dort, qui montera la
  garde. Puis on lit le rapport du soir et on découvre ce que la journée a
  coûté.
- **La nuit, on tient.** Vue de côté, **position fixe** à la fenêtre du premier
  étage. La rue est devant, la horde la remonte. On ne se déplace pas : on vise,
  on tire, on recharge, on repousse à la crosse, on rafistole les planches.

Ce que la journée n'a pas ramené manquera dans la nuit — et ce que la nuit a
cassé se paiera le lendemain. C'est la seule boucle du jeu ; tout le reste sert
à la rendre lisible.

## En quoi ce n'est pas les deux autres jeux du dépôt

C'était la contrainte explicite : ne pas refaire *Zone Morte* ni *Brasier* avec
un décor différent. Trois choses ont été changées à la racine.

| | Zone Morte / Brasier | Quinze Nuits |
|---|---|---|
| **Caméra** | vue de dessus | **vue de côté**, plan fixe |
| **Déplacement** | on parcourt la carte | **on ne bouge pas** — l'adversaire vient à nous |
| **Structure** | une session continue | **alternance jour / nuit**, deux modes de jeu séparés |
| **Décision** | pendant l'action | **avant** l'action, sur un écran sans temps réel |
| **Objectif d'une manche** | nettoyer / encercler | **survivre jusqu'à l'aube** — le compteur, pas le quota |

Un point compte plus que les autres : **on ne gagne pas une nuit en tuant tout
le monde**. La nuit dure un temps fixe. On peut la finir avec quarante morts
encore debout dans la rue, du moment que les planches ont tenu. Ça change ce
qu'on fait de chaque balle.

## La nuit

### La fenêtre

Le tireur est à poste. Le rayon part du canon vers le curseur et traverse la
rue ; la boîte de chaque silhouette est testée par la méthode des dalles, et
**c'est la hauteur du point d'impact qui décide de tout** :

| Zone | Fraction de la silhouette | Effet |
|---|---|---|
| Tête | 24 % du haut | dégâts ×3 — un marcheur tombe d'une balle |
| Corps | le milieu | dégâts normaux |
| Jambes | 30 % du bas | dégâts ×0,62, mais il tombe et **rampe** |

Estropier coûte plus de munitions que tuer, et fait gagner beaucoup de temps :
un rampant met trois fois plus longtemps à atteindre la barricade. C'est le
premier vrai arbitrage de la nuit.

### Les quatre armes

Une seule réserve de cartouches pour tout l'immeuble — les gardes des étages
puisent dedans aussi.

| Arme | Chargeur | Cadence | Dégâts | Particularité |
|---|---|---|---|---|
| Revolver | 6 | 0,30 s | 38 | de départ, précis, économe |
| Fusil à pompe | 5 | 0,78 s | 15 × 7 plombs | dévastateur à bout portant, nul au loin |
| Carabine | 8 | 0,62 s | 76 | traverse deux corps |
| Pistolet-mitrailleur | 30 | 0,085 s | 16 | vide la réserve à vue d'œil |

Les trois dernières se trouvent en fouillant, et restent débloquées au menu
d'une partie à l'autre.

### La crosse

Le clic droit (ou `E`, ou le bouton **CROSSE** au doigt) frappe tout ce qui est
sur les planches : dégâts modestes, mais **gros recul et étourdissement**, et
ça ne coûte pas une cartouche. C'est limité par une jauge de **souffle** qui se
vide en trois coups et se remplit lentement.

Cette mécanique existe pour une raison mesurée en test : sans elle, une réserve
à zéro rendait la fin de partie muette — on regardait la barricade tomber sans
rien pouvoir faire. Avec elle, une réserve vide est une situation *jouable* et
tendue plutôt qu'une défaite déjà écrite. Elle ne remplace pas une arme : en
soutenu, elle fait à peu près 17 points de dégâts par seconde, très en dessous
d'une horde de nuit 10.

### Ce qui remonte la rue

Sept types, dont la proportion change de nuit en nuit. Le colosse ne vient que
les nuits 5, 10 et 15, chaque fois plus dur.

| | Arrive | Ce qu'il change |
|---|---|---|
| Marcheur | nuit 1 | le fond de la horde |
| Coureur | nuit 3 | rapide, peu de points de vie — il faut le prendre tôt |
| Rampant | nuit 5 | bas sur pattes, la tête est difficile |
| Gros | nuit 6 | 210 pv, frappe fort la barricade |
| Cracheur | nuit 7 | s'arrête à mi-rue et vise la fenêtre |
| Hurleur | nuit 8 | appelle du monde et accélère ses voisins |
| Colosse | 5 / 10 / 15 | le seul avec une jauge |

### La barricade

Elle a des points de vie et un maximum qui monte quand on la renforce le jour.
`Espace` (ou le bouton **RÉPARER**) la remonte sous le feu en consommant des
matériaux. À zéro, ils entrent et attrapent les gens à l'intérieur : la partie
se perd quand il ne reste plus personne.

## Le jour

Chaque survivant reçoit une tâche et une seule.

- **Fouiller** — le seul revenu. Huit adresses, chacune avec son risque et son
  stock qui s'épuise. La supérette est sûre et ne rend que des conserves ;
  l'armurerie et le commissariat portent l'essentiel des munitions et tuent
  régulièrement quelqu'un. Une sortie ratée blesse, infecte, ou ne revient pas.
- **Barricade** — consomme des matériaux, remonte les points *et* le plafond.
- **Soigner** — consomme des médicaments, peut faire reculer une infection.
- **Dormir** — ne rapporte rien, fait tomber la fatigue de 56.
- **Monter la garde** — repos léger, et cette nuit-là il tire depuis l'étage.

Puis vient le repas : une part par personne. S'il en manque, tout le monde perd
de la santé et beaucoup de moral. C'est là qu'on comprend pourquoi il fallait
sortir.

Les gains montent de 5,5 % par nuit écoulée — on pousse plus loin dans le
quartier à mesure qu'il se vide. Sans cette progression, la quinzième nuit est
arithmétiquement intenable : c'est sorti d'un passage de mesure, pas d'une
intuition.

### Les gardes ne gaspillent pas

Un survivant de garde tire depuis sa fenêtre, dans la même réserve que le
joueur. Trois règles l'empêchent de la vider :

1. il n'engage qu'à portée utile (47 % de la largeur de la rue) ;
2. il a un quota de cartouches pour la nuit, fonction de son adresse ;
3. il s'arrête net quand la réserve tombe sous huit — on laisse toujours de quoi
   recharger à la fenêtre.

Sans ces règles, deux gardes vidaient 56 cartouches en trois nuits et le joueur
n'avait plus rien à tirer dès la nuit 4. C'était le premier défaut trouvé par le
robot de test.

## Le rendu

Tout est peint à la main dans un canvas. La rue est en trois plans de bâtiments
dont le plus proche monte presque en haut du cadre : dans une rue on ne voit pas
le ciel, on voit des murs. Ces trois plans ne bougent jamais, ils sont donc
peints **une seule fois dans deux calques** — un de nuit, un de petit matin — et
l'aube est un fondu de l'un à l'autre.

Les silhouettes sont tracées **deux fois** : une fois décalée de 1,4 px vers la
droite dans une couleur claire, une fois par-dessus en noir. Ce qui dépasse fait
la lumière du bidon et du lampadaire, tous deux à droite. Un contour tracé à la
main finit toujours par se décoller du corps quand la pose bouge ; celui-ci ne
peut pas.

La posture porte l'identité de chaque type : inclinaison du buste, largeur
d'épaules, taille du crâne, portée des bras. On doit reconnaître un coureur d'un
gros à la silhouette seule, sans couleur et sans étiquette.

## Ce qui fait revenir

- **Quinze nuits, et ce qui est perdu l'est.** Un mort ne revient pas. La partie
  ne se sauvegarde pas en cours de route.
- **Un record de tenue** au menu, plus le total d'abattus et le nombre de
  parties menées jusqu'au bout.
- **Les armes trouvées restent débloquées** entre les parties — le menu les
  affiche.
- **Trois difficultés** qui changent l'effectif des hordes, le risque des
  sorties et la ration quotidienne.
- **Un mur des morts** en fin de partie, avec le métier de chacun et la manière
  dont il est tombé.

## Confort

- Souris + clavier ou tactile intégral (viser au doigt, boutons d'armes, CROSSE
  et RÉPARER).
- Visée assistée activable — élargit la zone touchée, recommandée au doigt.
- Portrait et paysage. L'échelle des silhouettes, la vitesse de la horde et son
  effectif suivent la largeur visible : sur un téléphone en portrait on voit
  trois fois moins de rue, il fallait que ça reste le même jeu et pas une
  version où ils sont sur la barricade avant qu'on ait visé.
- Pause à `Échap`, volume réglable, son coupable, tout effaçable.

## Réglages du fichier

Les constantes qui déplacent vraiment l'équilibre :

```js
const NUITS=15;
function dureeNuit(n){ return 54+n*3.2; }              // secondes
function nombreNuit(n){ ... 8+n*3.6+n*n*.34 ... }      // effectif de la horde
const RESERVE_FENETRE=8;                               // ce que les gardes laissent
const COUT_CROSSE=.34, REGEN_SOUFFLE=.235;             // rythme du corps à corps
SC.ech   = clamp(Math.min(VH/430, VW/540), .82, 2.05); // taille des silhouettes
SC.larg  = clamp(VW/1200, .42, 1.35);                  // combien de rue on voit
```

## Comment ça a été vérifié

Un robot joue les quinze nuits dans un Chromium sans interface : il vise la tête
de la cible la plus proche, tire, recharge, passe à la crosse quand ils sont sur
les planches, répartit les tâches du jour et enchaîne. Il sort une ligne par
nuit — images par seconde, coups tirés, précision, morts, état de la barricade,
stocks, santé et moral de l'équipe. C'est ce relevé qui a mis en évidence la
dépense des gardes, la pénurie de munitions et le silence de la fin de partie
quand la réserve était vide.

Les images par seconde sont mesurées dans un rendu **logiciel** — sans carte
graphique. Elles donnent un plancher, pas une mesure : une vraie machine fera
mieux.
