# ACHÉRON

*Chaque piège veut que tu attendes le bon moment. Les spectres, eux, n'attendent jamais.*

Un jeu de plateformes en 120 niveaux. Un seul fichier — `acheron.html` — sans
dépendance, sans image ni son téléchargé : tout le dessin est du canevas
procédural, tout le son est synthétisé au Web Audio.

Ouvrir le fichier dans un navigateur suffit.

---

## Le frottement central

Un piège se franchit en attendant sa fenêtre : la scie repasse toutes les
1,15 s, la presse laisse 1,7 s de répit, le mur en phase s'ouvre une fois sur
deux, la plateforme met son temps à revenir. Attendre est **toujours** la
solution sûre.

Attendre est aussi exactement ce qui te fait rattraper.

Les spectres traversent la pierre, vont droit sur toi et ne s'arrêtent jamais.
Ils sont **plus lents que toi** — 3,5 à 6,4 tuiles/s contre 8,4 — donc on les
contourne, on leur tourne autour, on les sème. Ce qu'on ne peut pas, c'est les
faire patienter. À chaque machine, tu choisis entre la fenêtre suivante et celle
d'après, et cette décision se paie trois machines plus loin.

C'est tout le jeu. Il n'y a rien d'autre à comprendre.

## La grammaire

Deux chiffres, et les 120 niveaux sont écrits contre eux :

> **On grimpe deux tuiles, jamais trois. On franchit quatre tuiles de vide sans
> y penser, cinq en s'appliquant.**

Si quelque chose a l'air d'être à portée, ça l'est. Le saut est à hauteur
variable (relâcher coupe l'élan), avec les quatre marges qui font tout le
confort d'un jeu de plateformes : sursis de 0,10 s après le vide, saut mémorisé
0,12 s avant d'être possible, pesanteur adoucie au sommet de la courbe, et les
coins qu'on repousse au lieu de s'y cogner.

## Les cinq territoires

| | |
|---|---|
| **La Cave** (1–24) | Pics, dalles friables, blocs qui se détachent du plafond. |
| **La Scierie** (25–48) | Scies sur rail, presses, tapis roulants — dont certains te tirent en arrière. |
| **Les Égouts** (49–72) | Acide, jets de vapeur, plateformes mobiles : les seules machines sur lesquelles on monte. |
| **La Forge** (73–96) | Fonte, lames pendulaires, lance-flammes. |
| **Le Sanctuaire** (97–120) | Rayons, murs qui n'existent qu'une fois sur deux, piques qui sortent du sol. |

Chaque territoire ajoute ses pièges **et un spectre de plus**. C'est le seul axe
de difficulté du jeu : on n'augmente pas des points de vie, on ajoute des façons
de mourir — et le joueur peut les nommer.

## Les quatre spectres

| | |
|---|---|
| **RÔDEUR** | Il va droit sur toi, à travers la pierre, sans jamais s'arrêter. |
| **TRAQUEUR** | Plus rapide — mais il ne bouge que quand tu **cours**. S'arrêter le fige. |
| **HURLEUR** | Lent, puis il vise et se rue en ligne droite. Il trace sa ligne avant de partir. |
| **ÉCHO** | Il refait ton propre trajet avec 2,6 s de retard. Revenir sur tes pas, c'est aller à sa rencontre. |

Le spectre neuf d'un territoire arrive **seul** sur ses premiers niveaux : on ne
comprend un comportement que si on l'a vu isolé une fois.

## Rien ne tue sans prévenir

C'est la règle que le jeu s'impose, et elle est vérifiée automatiquement :

- le **rayon** trace en pointillé exactement ce qu'il va couper ;
- le **jet** montre sa portée avant de cracher ;
- la **presse** tremble et s'allume en rouge ;
- le **bloc** projette son ombre au sol bien avant de tomber ;
- le **mur en phase** clignote avant de réapparaître — et s'il réapparaît sur
  toi, il te **dégage** au lieu de t'écraser ;
- un **spectre hors champ** est signalé par une flèche de sa couleur au bord de
  l'écran, et la barre du haut monte quand le plus proche approche.

Dans un jeu où l'on meurt en une touche, un piège qui ne prévient pas n'est pas
difficile, il est simplement injuste.

Une **dalle friable** ne cède pas quand on la touche, mais quand on reste
dessus : un pont entier se traverse intact si l'on ne s'arrête jamais. C'est la
leçon du jeu en miniature.

## Les médailles

| | |
|---|---|
| Franchi | tu es sorti. |
| • Sans faute | sorti sans mourir une seule fois depuis que tu es entré. |
| ★ Or | sans faute **et** sous le temps de référence du niveau. |

Rien de tout cela ne rend plus fort. Pas de boutique, pas d'amélioration, pas de
monnaie : le niveau 63 est identique au premier essai et au centième — sinon un
temps ne voudrait rien dire.

**Le temps de référence n'est pas inventé.** Ses coefficients sont ajustés par
moindres carrés sur les 120 temps que le solveur automatique a réellement
obtenus, puis relevés d'un tiers. Ce qui coûte du temps se lit dans les
coefficients : une plateforme mobile vaut huit machines mortelles, parce qu'une
plateforme, ça s'attend.

## Si tu bloques

On peut prendre **deux niveaux d'avance** dans un territoire, et il suffit d'en
franchir **18 sur 24** pour ouvrir le suivant. Un seul niveau ne doit jamais
fermer les soixante qui restent.

## Commandes

| | |
|---|---|
| ← → | avancer, reculer (ou Q/D, ou A/D) |
| Espace ↑ Z W | sauter — plus tu gardes appuyé, plus tu montes |
| R | recommencer tout de suite |
| Échap | pause |
| Au doigt | deux touches à gauche, le saut à droite |

Après une mort, le niveau se relance tout seul en moins d'une seconde, et
n'importe quel appui va plus vite. Recommencer doit être le geste le plus facile
du jeu.

---

## Notes techniques

Un fichier, 139 Ko, zéro requête réseau, aucune donnée ne quitte l'appareil.

### Les niveaux ne sont pas dessinés au hasard

Un niveau est **assemblé** à partir de 46 morceaux de couloir écrits à la main,
chacun de 12 × 16 tuiles. Aux colonnes de bord, tout morceau présente le même
profil — trois tuiles d'air au-dessus du sol — donc **n'importe quel morceau se
colle à n'importe quel autre**, et l'assemblage ne peut pas produire un niveau
infranchissable.

La phase des machines d'un morceau ne dépend que de leur case **dans le
morceau**, jamais de l'endroit où le morceau est posé. Un morceau se comporte
donc partout de la même façon, ce qui rend sa difficulté mesurable une bonne
fois pour toutes — et c'est précisément ce qu'on mesure.

### Les machines sont des fonctions du temps

Huit des neuf familles de machines n'ont **aucun état** : à l'instant *t* leur
position ne dépend que de *t* et de leur phase. Rien ne peut dériver, et deux
parties du même niveau se déroulent exactement pareil. La neuvième — le bloc qui
tombe — est la seule qui garde une mémoire, parce que c'est la seule qui réagit
au joueur.

La simulation avance par pas fixes de 1/60 s et ne connaît ni l'écran, ni le
son, ni le profil : `unPas()` ne fait que constater la fin, la boucle
d'affichage s'occupe de ses conséquences. C'est ce qui permet de faire jouer le
jeu par une machine, sans rien simuler d'autre que le jeu lui-même.

### Vérifications automatisées

| | |
|---|---|
| `morceaux-test.js` | Chaque morceau monté **seul**, entre un départ et une sortie, et joué à **six instants de départ différents** — parce que le joueur ne choisit pas à quel moment il entre dans un couloir. **46/46 morceaux franchissables aux six décalages.** |
| `bot.js` | Un solveur par escalade joue les 120 niveaux avec le code du jeu. **120/120 franchissables**, **120/120 tenus sous la poursuite.** Dans le Sanctuaire, les marges finales tombent à 0,6 · 1,8 · 3,5 tuiles. |
| `audit.js` | 41 contrôles : déterminisme, phase indépendante de l'emplacement, annonce et fenêtre sûre de chaque machine, cycle du bloc qui tombe, dalles, dégagement des murs en phase, composition des spectres, vitesse toujours inférieure à celle du joueur, bornes du niveau, plafond de la trace, règles d'ouverture, logique des médailles, survie à un vrai rechargement, et **huit sauvegardes abîmées dont aucune ne produit un profil invalide**. |
| `clic.js` | 195 contrôles sur trois formats (bureau, téléphone debout, téléphone couché) : chaque bouton cliqué et sa conséquence vérifiée, taille des cibles tactiles, absence de débordement horizontal, mort et relance, écran de fin, carte. |

Zéro erreur console sur l'ensemble.

### Ce que les tests ont trouvé

- **Aucun niveau n'avait de porte** : le caractère `E` était accepté par le
  validateur des morceaux mais absent de la table des tuiles. Les 120 niveaux
  étaient ingagnables.
- **Le solveur ne savait pas attendre.** Un tirage uniforme ne produira jamais
  35 blocs d'immobilité d'affilée, or c'est la solution de toute machine à
  cycle. Deux mutations qui manipulent le temps — *insérer une attente*,
  *supprimer une attente* — ont fait passer les morceaux fiables de 27/46 à
  41/46. Sans cette correction, j'aurais déclaré infranchissables des couloirs
  dont la solution était simplement « patiente ».
- **Cinq morceaux étaient réellement fautifs** : un ascenseur planté loin
  devant son mur, qui obligeait à revenir en arrière — le seul endroit du jeu à
  l'exiger, alors que reculer est ce que l'ÉCHO punit ; un pic collé au bord
  d'une fosse, imposant un saut au maximum de la portée ; une scie qui balayait
  exactement la tuile d'atterrissage d'une presse ; un bassin de huit tuiles
  imposant 5,3 s d'attente ; et, après une correction de ma part, des
  stalactites qui créaient un tunnel de 0,53 tuile de haut.
- **Le temps de référence était inventé** et la machine le battait de 28 % : la
  médaille d'or était donnée. Il est désormais ajusté sur les mesures.
- **Le décor jouable ne se distinguait pas du fond** : dans les Égouts, le sol et
  le vide avaient presque la même valeur. Toutes les palettes ont été reprises,
  et un mur de fond a été ajouté — sans lui, un plafond de morceau collé à un
  morceau sans plafond donnait une dalle de pierre suspendue en l'air.
- **La règle « un piège doit se lire avant de tuer » n'était appliquée qu'au
  laser** : une buse de lance-flammes au repos n'était qu'un carré gris.
- Le menu était calé à gauche (un `margin:auto 0` en ligne écrasait le
  centrage), et « le ÉCHO » manquait son élision.
