# FOUDRE

*Tu ne tombes pas, tu bondis.*

Un jeu d'orage au tour par tour. Un seul fichier — `foudre.html` — sans
dépendance, sans image ni son téléchargé : tout le dessin est du canevas
procédural, tout le son est synthétisé au Web Audio.

Ouvrir le fichier dans un navigateur suffit.

---

## Une seule règle

> **Tu es un éclair. Tu ne peux exister que sur ce qui conduit — et tout ce que
> tu quittes se consume.**

Il n'y a rien d'autre à apprendre. Tout le jeu se déduit de cette phrase :

- **Se déplacer, c'est détruire son propre terrain.** La case qu'on quitte
  devient de la cendre, où plus rien ne passera jamais.
- **Perdre, c'est se retrouver sans une seule case où aller.** Pas de barre de
  vie qui descend : on meurt du désert qu'on a fait autour de soi.
- **Une bête est un pont qui marche vers toi.** Elle conduit. La foudroyer, ce
  n'est pas se défendre, c'est prendre appui — et l'ordre dans lequel on s'en
  sert est tout le jeu.

C'est un verbe qu'on ne trouve pas ailleurs : dans presque tous les jeux de
grille, se déplacer est gratuit. Ici, chaque déplacement coûte une case du monde.

## Ce qui conduit, ce qui ne conduit pas

| | |
|---|---|
| **FLAQUE** | Conduit *et propage*. Frapper une flaque emporte **tout l'ensemble connecté** d'un seul coup, et l'on se pose sur la plus éloignée : c'est un transport. |
| **ARBRE** | Conduit, puis prend feu. Le feu se transmet d'arbre en arbre et conduit encore deux tours : un réseau temporaire qui s'éteint tout seul — et qui **tue les bêtes prises dedans**. |
| **FERRAILLE** | Conduit une fois, puis fond. |
| **PARATONNERRE** | La seule case qui ne se consume **jamais**. Il y en a trois. Tout se joue autour d'elles. |
| **LES BÊTES** | Conduisent. Six espèces, six comportements. |
| **TERRE · ROCHE · CENDRE** | Rien n'y passe. La pluie rend la terre et la cendre à l'eau — jamais la roche. |

## Le tour

On bondit (ou l'on attend), **puis** le monde joue : le feu se propage, la pluie
tombe, les bêtes avancent d'une case et frappent si elles nous touchent.

Rien d'aléatoire n'arrive *pendant* le coup du joueur. **On ne perd jamais sur un
dé** — seulement sur un mauvais calcul. C'est la condition pour qu'un jeu de
score se relance sans amertume.

## La tension centrale

La pluie est la seule chose qui reconstruit le monde, et **il pleut de moins en
moins à chaque orage** :

```
orage 1 : ~1,4 goutte par tour        orage 5 : ~0,95        orage 9+ : 0,55
```

Pendant ce temps la plaine se peuple, les orages s'allongent, et la consommation
— une case par bond — ne baisse jamais. Le jeu n'a donc pas de « niveau de
difficulté » : il a une **ressource qui se raréfie**, ce qui est la même chose en
plus honnête.

## Les points

- Une bête vaut ce qu'elle vaut (25 à 260 points). Brûlée vive dans un incendie,
  elle en vaut 60 % : le feu chasse, mais moins bien qu'un coup préparé.
- **Une chaîne d'eau vaut son carré** : deux flaques 16 points, cinq 100, dix
  400, quinze 900.

C'est déraisonnable exprès. Le jeu ne récompense pas la prudence, il récompense
le coup qu'on a mis quatre tours à préparer.

## Les pouvoirs

Chaque orage passé rend une charge et donne **un pouvoir au choix parmi trois**
(quatorze en tout : ARC LONG, RUISSELLEMENT, SILLAGE, BRAISE LENTE, TROISIÈME
FIL, PAS DE CÔTÉ, PORTE-FOUDRE, APPEL DE PLUIE, ARC DE PROXIMITÉ, FERRAILLE
FROIDE, BOIS VERT, AIMANT, ÉCHO, PIED SEC).

Aucun ne frappe plus fort. **Ils donnent tous de la place** — et la place est la
seule chose qui manque. Chaque carte affiche ce qu'elle fait *et* pourquoi la
prendre, parce qu'un choix qu'on ne comprend pas n'est pas un choix.

## Deux modes

- **ORAGE LIBRE** — une partie tirée au hasard, enregistrée à chaque tour. On
  quitte, on revient, on reprend exactement là où on en était.
- **ORAGE DU JOUR** — la date fait la graine. Tout le monde joue **le même orage,
  coup pour coup** : même plaine, même pluie, mêmes bêtes, mêmes pouvoirs
  proposés. C'est la seule façon de comparer deux scores honnêtement. Un bouton
  copie un résumé partageable qui ne dévoile rien de la solution.

## Ce qui reste entre les parties

Six rangs, dix-huit succès, un profil, un journal orage par orage à la fin de
chaque partie.

**Rien qui rende plus fort.** Pas de boutique, pas de déblocage, pas de monnaie.
Une partie neuve part exactement avec les mêmes armes que la centième — sinon le
score du quotidien ne voudrait rien dire.

## Commandes

| | |
|---|---|
| clic / appui | désigner une case |
| ↑ ↓ ← → puis Entrée | viser, puis bondir |
| Espace | attendre |
| P | poser un paratonnerre |
| R | les règles, sans quitter la partie |

Au doigt, un premier appui **montre** ce que le coup ferait (la grappe d'eau
entière s'allume avec son score), un second le joue. On ne frappe jamais au
hasard sur un téléphone.

---

## Notes techniques

Un fichier, 121 Ko, zéro requête réseau.

- **Éclairs procéduraux** par déplacement du point milieu, tracés en quatre
  passes (halo large, couleur, cœur clair, cœur blanc) plus les ramifications.
- **Deux générateurs aléatoires** : celui de la partie est semé (mulberry32) pour
  que le quotidien soit identique partout ; celui de l'ambiance ne l'est pas, de
  sorte qu'une étincelle décorative ne puisse jamais désynchroniser une partie
  semée.
- **Sauvegarde compacte** : le plateau tient dans deux chaînes de 196 caractères,
  relues à l'œil quand quelque chose cloche. Une sauvegarde tronquée ou trafiquée
  est **refusée**, jamais rafistolée.
- **Le menu joue tout seul** : une vraie partie tourne derrière le titre, un coup
  toutes les huit dixièmes de seconde. Elle est muette, n'enregistre rien, ne
  décroche aucun succès et ne compte pas dans la carrière — on montre le verbe du
  jeu au lieu de l'expliquer.
- **Mise en page** : le plateau se recadre pour tenir entier à l'écran, y compris
  sur un téléphone couché où les bandeaux maigrissent et où les messages vont se
  loger dans la colonne laissée vide à côté du damier. Les étiquettes de score
  sont mesurées avant d'être posées et s'empilent sans jamais se chevaucher.

### Vérifications automatisées

| | |
|---|---|
| `audit.js` | 53 contrôles : sauvegarde/reprise après un vrai rechargement, cinq sauvegardes abîmées, invariants relus à chaque tour sur six parties, déterminisme de l'orage du jour, rangs, partage, effacement, et l'innocuité de la démonstration du menu. |
| `clic.js` | 221 contrôles sur trois formats d'écran (bureau, téléphone debout, téléphone couché) : chaque bouton, chaque écran, chaque raccourci clavier, plus la détection de tout débordement horizontal et de tout bouton mort. |
| `bot.js` | Huit parties jouées par une machine gloutonne à un coup d'avance : médiane 3 orages, 77 tours, ~4 800 points, zéro erreur console. Un joueur qui réfléchit passe largement au-delà. |
