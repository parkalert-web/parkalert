# Sous la ville

`souslaville.html` — un jeu complet dans un seul fichier, sans dépendance, sans
image ni son téléchargé. Les créatures sont peintes au canvas, la goutte qui
tombe dans le noir et le bourdon des galeries sont synthétisés.

## L'idée

Sous les pavés, les galeries. Tu descends avec **dix cartes et une lampe**, et
tu as trois étages à traverser : les égouts hauts, les ossuaires, la nappe.
Chaque salle ajoute, retire ou améliore quelque chose dans ton deck ; le deck
décide du combat suivant ; et un deck qui grossit trop finit par mal piocher.

C'est le cinquième jeu du dépôt et **le premier qui ne simule rien en temps
réel**. Tout est au tour par tour, et surtout : **tout est annoncé**. Au-dessus
de chaque créature, une pastille dit ce qu'elle fera à la fin de ton tour,
avant que tu joues ta première carte — et le chiffre affiché est le chiffre
encaissé, force, faiblesse, boue et vulnérabilité déjà comprises. Un coup pris
est toujours un coup qu'on a choisi de prendre.

Le jeu n'est jamais une question de réflexes. C'est une question
d'arithmétique et d'ordre.

## Ce que ce jeu n'est pas

Les quatre jeux précédents partageaient une chose : une boucle temps réel qu'on
regarde tourner. Celui-ci l'abandonne entièrement.

| | Les quatre autres | Sous la ville |
|---|---|---|
| Le temps | il coule, et il presse | il **n'existe pas** : rien ne bouge tant que tu ne joues pas |
| L'échec | on n'a pas réagi assez vite | on a **mal compté** |
| La progression dans une partie | des bâtiments, du stock, des niveaux | **des cartes**, et surtout des cartes en moins |
| Ce qu'on relance | la même carte, mieux jouée | **une autre main**, avec un autre personnage |
| Ce qui reste après | rien, ou un score | un **profil**, un carnet de route, une boutique |
| Palette | soleil, néon, flammes | **pierre humide, os, bougie** |

## La boucle

```
descendre une salle → un combat, un marché, un feu ou une trouvaille
  → ce qu'on y gagne entre dans le deck
    → le deck décide du combat suivant
      → et un deck qui grossit trop finit par mal piocher
```

Autour, ce qui survit à la mort du personnage : un profil avec des rangs, des
**écus** remontés à la surface, une boutique d'acquis définitifs, vingt-cinq
succès, trois contrats du jour et un **carnet de route saisonnier à deux
voies**.

Les deux monnaies ne se croisent jamais :

- **les pièces 🪙** se ramassent en bas, s'échangent au marché, et **meurent
  avec le personnage** ;
- **les écus ⚜** se rapportent à la surface et **ne redescendent pas** : ils
  achètent la boutique et la voie de prestige du carnet.

## Le tour

Cinq cartes en main, **trois points d'énergie**. Chaque carte en coûte. Quand
tu n'as plus rien à jouer, tu finis ton tour : ta main part à la défausse et ce
qui est en face frappe — **ton armure te protège pendant ce coup-là**, puis elle
retombe à zéro au début de ton tour suivant. Quand la pioche est vide, la
défausse est remélangée dedans.

L'ordre exact, parce que c'est lui qui rend le tour calculable :

| | ce qui se passe |
|---|---|
| début de ton tour | armure remise à zéro (sauf **parade**) · saignement et régénération · pouvoirs · énergie · pioche |
| ton tour | tu joues tant que tu as l'énergie |
| fin de ton tour | ta main part · tes états d'un tour baissent |
| leur tour | chacun exécute l'intention **affichée**, l'un après l'autre, puis annonce la suivante |

Les cartes ne connaissent que six verbes — `degats`, `armure`, `etat`,
`soigner`, `piocher`, `gagnerEnergie` — et les reliques n'en connaissent pas
d'autres. C'est ce qui garantit qu'une carte améliorée, une relique et un état
se combinent toujours de la même façon.

## Les onze états

Onze, et pas un de plus. Chacun se lit sur une pastille, aucun n'a d'effet
caché.

| | effet |
|---|---|
| 💪 **FORCE** | +n dégâts sur chaque attaque |
| 🥀 **FAIBLESSE** | attaques réduites d'un quart, −1 par tour |
| 🎯 **VULNÉRABLE** | reçoit la moitié de dégâts en plus, −1 par tour |
| 🩸 **SAIGNEMENT** | perd n points de vie au début de son tour, puis n−1 |
| 🌵 **ÉPINES** | renvoie n dégâts à qui frappe |
| 🍃 **RÉGÉNÉRATION** | récupère n points de vie au début du tour, puis n−1 |
| 🛡️ **PARADE** | l'armure n'est plus effacée, pendant n tours |
| 🌫️ **BRUME** | les n prochaines attaques reçues sont esquivées, armure comprise |
| 📍 **REPÈRE** | certaines cartes frappent bien plus fort une cible repérée |
| 🕯️ **CIERGE** | lumière accumulée, dépensée d'un coup par certaines cartes |
| 🪣 **BOUE** | chaque attaque de la créature perd n dégâts, −1 par tour |

Les trois derniers appartiennent chacun à un personnage : c'est ce qui fait que
les trois decks ne se jouent pas du tout pareil.

## Les trois personnages

| | | ce qu'il fait |
|---|---|---|
| 🪣 **L'ÉGOUTIER** | 72 pv, 60 🪙 | **BOUE** — il salit tout ce qui bouge : chaque tas de boue retire un dégât à *toutes* les attaques de la cible. Il encaisse et il use. Ouvert d'emblée. |
| 📐 **LA CARTOGRAPHE** | 62 pv, 80 🪙 | **REPÈRE** — elle pose des repères, et ses cartes de précision frappent une cible repérée deux fois plus fort. Elle pioche beaucoup. Palier **6** du carnet. |
| 🕯️ **LE THAUMATURGE** | 56 pv, 100 🪙 | **CIERGE** — la lumière s'accumule de tour en tour et part d'un seul coup : FLAMBÉE inflige 5 dégâts *par cierge*. Fragile, explosif. Palier **14** du carnet. |

Chacun a dix cartes de départ et un réservoir de cartes qui n'apparaissent que
pour lui — **une soixantaine de cartes** en tout, en quatre familles (attaque,
défense, ruse, pouvoir) et quatre raretés.

## La carte de la descente

Trois étages, chacun une carte de salles à embranchements de onze à treize
lignes. On ne visite jamais tout : **choisir un chemin, c'est renoncer à
l'autre**, et c'est le seul vrai levier de difficulté du jeu.

| | |
|---|---|
| ⚔️ **COMBAT** | les deux premières salles d'un étage tirent dans un lot plus doux |
| 💀 **ÉLITE** | plus dure, mais elle donne une relique |
| 🔥 **BIVOUAC** | dormir, aiguiser une carte, **en brûler une**, ou fouiller |
| 🪙 **MARCHÉ** | des cartes, une relique, un brûloir payant, des fioles |
| ❓ **TROUVAILLE** | huit textes, trois choix chacun, et un prix à chaque fois |
| 📦 **COFFRE** | des pièces, et six fois sur dix une relique |
| 👁️ **GARDIEN** | la dernière ligne. LA POMPE, LE SACRISTAIN, CE QUI DORT |

La carte est **engendrée par la graine de la descente**, avec son propre
générateur : elle n'est pas sauvegardée, elle est recalculée à l'identique
quand on reprend la partie. Le mélange du deck, lui, a un hasard séparé — sinon
quitter puis rouvrir au bon moment donnerait une meilleure main.

## Ce qui vit en dessous

Vingt-deux créatures, réparties en trois bestiaires. Chacune a un **plan** :
soit un cycle fixe qu'on peut apprendre par cœur — c'est ce qui rend un ennemi
lisible — soit une décision qui regarde l'état du combat, réservée aux élites
et aux gardiens.

| étage | ce qu'on y croise | l'élite | le gardien |
|---|---|---|---|
| **LES ÉGOUTS HAUTS** | rat, limace de fange, veilleur de pierre, petite ombre, crapaud blême | TROIS-CROCS, LE GARDE-BOUE | **LA POMPE** (90 pv) |
| **LES OSSUAIRES** | tibia monté, moine sans tête, nuée basse, gardien du puisard, vermine grasse | LE CHARNIER, LE PORTE-CIERGE | **LE SACRISTAIN** (158 pv) |
| **LA NAPPE** | le noyé, statue descellée, larve blanche, l'œil de la nappe | LE PUISATIER, LA CLOCHE FÊLÉE | **CE QUI DORT** (260 pv) |

Aucune n'est un carré gris : chaque forme est peinte au canvas à partir de
trois ou quatre primitives, avec une respiration de 4 % et une couleur propre.
Les créatures à moins de 35 % de leur vie pâlissent en rouge.

La difficulté ne touche **que les points de vie** des créatures, jamais leurs
dégâts : un combat plus dur doit être plus long à résoudre, pas plus injuste à
lire.

## Vingt-cinq reliques

Ramassées sur les élites, les gardiens, dans les coffres et au marché. Une
relique ne se joue pas : elle s'accroche à un moment de la partie (le début
d'un combat, le début d'un tour, la mort d'un ennemi) et le combat vient la
chercher à ce moment-là. Trois d'entre elles ne tombent que sur un gardien, et
deux se paient cher : **LA CLÉ DE LA GRILLE** donne 3 force à chaque combat
contre 10 points de vie maximum, **L'ANNEAU DE FER** échange une carte de main
contre un point d'énergie.

## Ce qui survit à la mort du personnage

### Le profil

Un nom, une marque parmi douze, un rang qui monte de RAT DE CAVE à CE QUI
REMONTE, et les compteurs de tout ce qu'on a fait. L'expérience de profil vient
des descentes et des contrats.

```
xpProfil(n) = 180 × n^1.42
```

### Le carnet de route

Une **saison de quatre semaines**, trente paliers, deux voies. La voie libre
donne de quoi jouer : **les deux autres personnages** (paliers 6 et 14), des
cartes qui entrent dans le réservoir de butin, des marques de profil. La voie
de prestige s'achète **une fois pour la saison, 250 ⚜** — avec les écus qu'on a
remontés, jamais avec de l'argent réel : il n'y en a pas ici. Un palier coûte
520 points d'expérience de carnet, et la saison redémarre à zéro toute seule.

### La boutique

Dix acquis définitifs, payés en écus, chacun plus cher au niveau suivant pour
qu'on ne puisse pas tout empiler sur une seule ligne : points de vie de départ,
bourse, trousse de fioles, porte-bonheur, plan à jour, réputation au marché,
œil du chineur (quatre cartes par butin), **dernier souffle** (une fois par
descente, un coup fatal te laisse à 1), carnet de notes, main sûre.

### Les contrats du jour

Trois, tirés d'après la date — tout le monde a les mêmes, et ils changent à
minuit, sans recharger la page. Ils paient en écus, en expérience de profil et
en avancement de carnet.

### Les succès

Vingt-cinq, de PREMIÈRE DESCENTE à DECK DE RASOIR (battre un gardien avec dix
cartes ou moins). Chacun paie une fois.

## La sauvegarde

On ne sauvegarde ni la carte ni les butins : la graine les rejoue. On
sauvegarde ce que le joueur a fait — son deck, ses reliques, sa position, sa
vie. **Jamais au milieu d'un combat** : la salle en cours est rejouée depuis
son début, ce qui est plus honnête que de figer une main de cartes à moitié
posée.

## Sous le capot

Un fichier, aucune dépendance, aucune requête réseau.

| | |
|---|---|
| Taille | ~180 Ko, un seul fichier |
| Hasard | `mulberry32` à graine, plus un mélange de paquet séparé |
| Dessin | canvas ; voûtes peintes une fois hors écran, poussière et lueur redessinées |
| Interface | DOM ; **aucun écran ne se met à jour à l'image**, seuls les portraits sont animés |
| Son | Web Audio, tout synthétisé — bourdon, goutte, os, lame, cloche |
| Stockage | `localStorage`, avec repli en mémoire si l'accès est refusé |
| Écrit en | français, jusqu'aux noms de variables |

### Le texte des cartes est calculé

Une carte porte ses valeurs dans deux objets (`v` avant amélioration, `v2`
après) et une fonction qui écrit sa description à partir de l'un des deux :

```js
faille:{nom:'FAILLE', cout:1, type:'att', cible:1, per:'carto', rare:'rare',
  v:{deg:9}, v2:{deg:13},
  d:v=>'Inflige <b>'+v.deg+'</b> dégâts. <b>Consomme</b> tous les repères : '
      +'+4 dégâts par repère.',
  ef:(v,x)=>{ const m=x.cible.etats.marque||0;
    degats(x.src,x.cible,v.deg+m*4); if(m) x.cible.etats.marque=0; }}
```

Une carte améliorée affiche donc ses vrais chiffres, jamais « +3 dégâts »
accroché en bas de la carte.

## Commandes

`clic` sur une carte pour la jouer · `clic` sur un ennemi pour cibler ·
`clic droit` ou `Échap` annule · `1`…`9` jouent la carte correspondante ·
`E` ou `Espace` finit le tour · `D` ouvre le deck.

Réglages dans **RÈGLES** : son, volume, **vitesse des animations**, difficulté
(TRANQUILLE / NORMALE / ÉPROUVANTE), et tout effacer.

## Comment il a été réglé

Comme les précédents : en le faisant jouer. Un bot pilote le jeu par ses
propres fonctions — il choisit son chemin comme un joueur raisonnable (l'élite
seulement s'il est encore entier, le bivouac dès qu'il descend sous 45 % de
vie), bloque quand ce qui est annoncé dépasse son armure, et achève la cible la
plus basse. On lit ensuite le relevé salle par salle.

Le premier relevé a montré une faute nette : **un combat ordinaire du premier
étage coûtait 70 % de la barre de vie**. Deux limaces valaient 45 points de vie
à abattre pendant qu'elles rendaient 16 dégâts par tour, contre 12 dégâts et 5
d'armure produits par un deck de départ. La correction n'a pas porté sur un
seul chiffre mais sur trois : les points de vie de départ (+8 par personnage),
les dégâts du premier étage (−25 %), et surtout **l'armure adverse** — c'est
elle, plus que les points de vie, qui étirait les combats à huit tours.

Le deuxième relevé a montré une faute de conception, pas d'équilibrage :
**brûler une carte au bivouac était derrière un achat de boutique à 220 écus**.
C'est le geste fondamental du genre — sans lui, le deck ne fait que gonfler et
la production de dégâts reste plate. Il est devenu une option de bivouac comme
les autres, et l'acquisition de boutique a été remplacée par l'ŒIL DU CHINEUR.

Le troisième relevé a montré un bug, pas un réglage : la ligne de bivouac qui
précède chaque gardien est posée par construction, mais une règle censée
empêcher une ligne entièrement en bivouac s'appliquait aussi à elle. **Le repos
garanti avant le boss se transformait en combat une fois sur deux.** Une salle
mal typée valait plus que toutes les tables de dégâts réunies : après
correction, le bot est passé d'« mort à l'étage 1 » à « étage 2 » dans huit
descentes sur dix.

Le quatrième relevé a porté sur la fin du jeu, testée séparément : on pose une
descente directement au troisième étage avec un deck de fin de partie et on va
au gardien. Elle mourait quand même — et le calcul disait pourquoi. Avec trois
énergies, un deck abouti produit **environ vingt dégâts OU vingt d'armure par
tour, jamais les deux** ; le troisième étage en rendait vingt-six à trente-six.
Le joueur perdait de la vie chaque tour même en bloquant tout, quoi qu'il
joue : ce n'est pas difficile, c'est arithmétiquement perdu. Deux rencontres
sortaient complètement de la courbe (trois nuées à trente-six dégâts par tour,
deux yeux à quarante-deux) et ont été remplacées ; le reste de l'étage a été
ramené autour de vingt-quatre. La même passe a remonté les cartes de fin de
partie. CE QUI DORT tombe maintenant — à deux points de vie près.
