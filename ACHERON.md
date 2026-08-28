# ACHÉRON

*Chaque machine a une fenêtre, et te la montre avant de frapper.*

Un jeu de plateformes en 120 niveaux. Un seul fichier — `acheron.html` — sans
dépendance, sans image ni son téléchargé : tout le dessin est du canevas
procédural, tout le son est synthétisé au Web Audio.

Ouvrir le fichier dans un navigateur suffit.

---

## Le jeu

Tu cours vers la porte. Entre toi et elle, des machines qui tuent en une touche.

La scie repasse toutes les 1,2 s. La presse laisse 1,7 s de répit. Le mur en
phase s'ouvre une fois sur deux. **Rien n'est jamais fermé pour de bon : il n'y a
que des moments.** Le jeu consiste à lire ces moments sans t'arrêter — parce que
t'arrêter ne te tue pas, mais te coûte la médaille.

## La grammaire

Deux chiffres, et les 120 niveaux sont écrits contre eux :

> **On grimpe deux tuiles, jamais trois. On franchit quatre tuiles de vide sans
> y penser, cinq en s'appliquant.**

Si quelque chose a l'air d'être à portée, ça l'est. Le saut est à hauteur
variable (relâcher coupe l'élan), avec les quatre marges qui font tout le
confort d'un jeu de plateformes : sursis de 0,10 s après le vide, saut mémorisé
0,12 s avant d'être possible, pesanteur adoucie au sommet de la courbe, et les
coins qu'on repousse au lieu de s'y cogner.

Après une mort, le niveau repart tout seul en moins d'une seconde, et n'importe
quel appui va plus vite. Recommencer doit être le geste le plus facile du jeu.

## Les cinq territoires

| | |
|---|---|
| **La Cave** (1–24) | Pics, dalles friables, blocs qui se détachent du plafond. |
| **La Scierie** (25–48) | Scies sur rail, presses, tapis roulants — dont certains te tirent en arrière. |
| **Les Égouts** (49–72) | Acide, jets de vapeur, plateformes mobiles : les seules machines sur lesquelles on monte. |
| **La Forge** (73–96) | Fonte, lames pendulaires, lance-flammes. |
| **Le Sanctuaire** (97–120) | Rayons, murs qui n'existent qu'une fois sur deux, piques qui sortent du sol. |

La difficulté monte sur trois axes, et **aucun** n'est un point de vie :

1. **Les machines changent complètement** d'un territoire à l'autre.
2. **Elles battent de plus en plus vite** : les fenêtres de passage se resserrent
   d'un quart entre le premier couloir et le dernier (100 % → 125 %).
3. **Les couloirs s'allongent** : trois tronçons au niveau 1, huit au niveau 120.

## Rien ne tue sans prévenir

C'est la règle que le jeu s'impose, et elle est vérifiée automatiquement :

- le **rayon** trace en pointillé exactement ce qu'il va couper ;
- le **jet** montre sa portée avant de cracher ;
- la **presse** tremble et s'allume en rouge ;
- le **bloc** projette son ombre au sol bien avant de tomber ;
- la **scie** et la **plateforme** montrent leur rail en entier ;
- les **piques** font rougir le sol d'où elles vont sortir ;
- le **mur en phase** clignote avant de réapparaître — et s'il réapparaît sur
  toi, il te **dégage** au lieu de t'écraser.

Dans un jeu où l'on meurt en une touche, un piège qui ne prévient pas n'est pas
difficile, il est seulement injuste.

Une **dalle friable** ne cède pas quand on la touche, mais quand on reste
dessus : un pont entier se traverse intact si l'on ne s'arrête jamais.

## Les médailles

La barre en haut de l'écran se remplit jusqu'au temps de référence du niveau,
puis passe au rouge. **Elle ne coûte jamais une vie** — c'est la seule pression
du jeu, et elle ne porte que sur les médailles.

| | |
|---|---|
| Franchi | tu es sorti. |
| • Sans faute | sorti sans mourir une seule fois depuis que tu es entré. |
| ★ Or | sans faute **et** sous le temps de référence. |

Rien de tout cela ne rend plus fort. Pas de boutique, pas d'amélioration, pas de
monnaie : le niveau 63 est identique au premier essai et au centième — sinon un
temps ne voudrait rien dire.

**Le temps de référence n'est pas inventé.** Ses coefficients sont ajustés par
moindres carrés sur les 120 temps que le solveur automatique a réellement
obtenus, puis relevés de 30 % — une machine qui recommence mille fois n'a pas
besoin de la marge qu'un humain mérite. Résultat : le solveur passe sous la
référence sur 116 niveaux sur 120, avec 24 % de marge médiane.

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

---

## Publicité et données

Le site est prévu pour être éligible au programme Google AdSense.

- **Domaine** : `https://acherongame.netlify.app/`. Il n'apparaît qu'à **deux
  endroits**, côte à côte en haut du fichier (`link rel="canonical"` et
  `og:url`), sous un commentaire qui le signale. Changer de domaine = changer
  ces deux lignes.
- **Consent Mode v2** : tous les signaux publicitaires sont sur `denied` par
  défaut, `ads_data_redaction` actif, avant tout script publicitaire.
- **CMP certifié IAB TCF v2.2** (Google Funding Choices) chargé en premier ; le
  script AdSense n'est chargé **qu'après** le verdict du consentement, avec un
  filet de 2,5 s pour les régions hors zone TCF où aucune fenêtre ne s'affiche.
- **Annonces automatiques uniquement** : aucun bloc `<ins>` n'est écrit dans la
  page.
- Les commandes tactiles, le bouton pause et le bandeau portent
  `adsbygoogle-noablate` : sans ça une annonce d'ancrage viendrait se poser
  exactement sur le bouton de saut, et chaque saut deviendrait un clic
  publicitaire involontaire — ce que Google compte comme du trafic invalide.
- **Mentions légales** (éditeur, hébergeur, propriété intellectuelle,
  responsabilité) et **page Confidentialité et cookies** (ce qui est enregistré,
  ce que fait la publicité, comment revenir sur son choix), toutes deux
  accessibles depuis le menu, avec adresse de contact.
- `ads.txt` : contenu identique pour tous les sites du compte, à servir à la
  racine de **chaque** domaine séparément — `netlify.app` est sur la Public
  Suffix List, donc chaque sous-domaine est un domaine racine.

Le jeu lui-même ne collecte rien : la progression est écrite dans le
`localStorage` du navigateur et n'est envoyée nulle part.

---

## Notes techniques

Un fichier, 138 Ko. En dehors des scripts publicitaires, aucune requête réseau.

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
au joueur. Le rythme d'un territoire est **un seul multiplicateur** appliqué au
temps : un chiffre, et toutes les fenêtres se resserrent d'un coup.

La simulation avance par pas fixes de 1/60 s et ne connaît ni l'écran, ni le
son, ni le profil : `unPas()` ne fait que constater la fin, la boucle
d'affichage s'occupe de ses conséquences. C'est ce qui permet de faire jouer le
jeu par une machine, sans rien simuler d'autre que le jeu lui-même.

### Vérifications automatisées

| | |
|---|---|
| `morceaux-test.js` | Chaque morceau monté **seul**, entre un départ et une sortie, joué à **six instants de départ différents** — le joueur ne choisit pas à quel moment il entre dans un couloir — et **au rythme où il existe réellement** (le sien s'il appartient à un territoire, les cinq s'il est neutre). **46/46 morceaux franchissables.** |
| `bot.js` | Un solveur par escalade joue les 120 niveaux avec le code du jeu. **120/120 franchissables.** Ses temps servent à régler le temps de référence des médailles. |
| `audit.js` | 52 contrôles : déterminisme, phase indépendante de l'emplacement, rythme croissant et vérifié en comptant les coups de presse, annonce et fenêtre sûre de chaque machine, cycle du bloc qui tombe, dalles, dégagement des murs en phase, bornes du niveau, règles d'ouverture, logique des médailles, survie à un vrai rechargement, **huit sauvegardes abîmées dont aucune ne produit un profil invalide**, et toute la conformité publicitaire (canonique, consentement par défaut refusé, chargement différé du script d'annonces, absence de bloc manuel, protection des commandes tactiles, pages légales). |
| `clic.js` | 231 contrôles sur trois formats (bureau, téléphone debout, téléphone couché) : chaque bouton cliqué et sa conséquence vérifiée, taille des cibles tactiles, absence de débordement horizontal, mort et relance, écran de fin, carte, pages légales et bouton de consentement. |

Zéro erreur console du jeu sur l'ensemble.

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
- **Six morceaux étaient réellement fautifs** : un ascenseur planté loin devant
  son mur, qui obligeait à revenir en arrière ; un pic collé au bord d'une
  fosse, imposant un saut au maximum de la portée ; **deux morceaux qui
  empilaient deux machines sur la même tuile d'atterrissage** (s8 puis s6) ; un
  bassin de huit tuiles imposant 5,3 s d'attente ; et, après une correction de
  ma part, des stalactites qui créaient un tunnel de 0,53 tuile de haut.
- **Le temps de référence était inventé** et la machine le battait de 28 % : la
  médaille d'or était donnée. Il est désormais ajusté sur les mesures.
- **Le décor jouable ne se distinguait pas du fond** : dans les Égouts, le sol et
  le vide avaient presque la même valeur. Palettes reprises, et un mur de fond
  ajouté — sans lui, un plafond de morceau collé à un morceau sans plafond
  donnait une dalle de pierre suspendue en l'air.
- **La règle « un piège doit se lire avant de tuer » n'était appliquée qu'au
  laser** : une buse de lance-flammes au repos n'était qu'un carré gris.
- Sur téléphone debout, l'écran montrait **trente tuiles de haut pour un monde
  qui en fait seize** : le jeu tient maintenant dans une bande de la bonne
  hauteur, ce qui libère en prime la place des commandes tactiles.
- Le menu était calé à gauche (un `margin:auto 0` en ligne écrasait le
  centrage), et le lien des mentions légales ne faisait que 11 px de haut.
- Deux tests d'audit se trompaient eux-mêmes : l'un exigeait qu'une presse ait
  une fenêtre « inactive » alors qu'elle tue au contact en permanence (sa
  fenêtre est une *position*), l'autre comparait des positions de machine pour
  prouver un changement de rythme alors qu'elle passe la moitié de son cycle
  immobile — il fallait compter les **coups**.
