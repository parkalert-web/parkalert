# Tête de Gondole

`gondole.html` — un jeu complet dans un seul fichier, sans dépendance, sans
image ni son téléchargé. Le magasin est peint au canvas, le bip du scanner et
la musique d'ambiance sont synthétisés note par note.

## L'idée

Un local nu en zone commerciale, dix-huit mille euros, et **dix semaines de six
jours** — soixante journées — pour en faire un supermarché qui tient. Un loyer
commercial tombe chaque samedi soir, et il passe de mille huit cents à
vingt-six mille euros. On monte les rayons, on choisit ce qu'on met dedans, on
commande le stock, on fixe les prix, on ouvre des caisses.

**Une journée dure douze minutes**, de huit heures à vingt heures, avec deux
coups de feu — la fin de matinée et la sortie du travail. La vitesse monte à
**×2 et pas plus** : une journée se joue, elle ne se saute pas. C'est un choix,
pas une limite technique — à ×10 on ne voit plus la file se former, on ne voit
plus le rayon se vider, et le jeu se réduit à un tableur.

On commence avec **quatre références** — pâtes, riz, farine, conserves — et une
seule licence. On finit, si tout va bien, avec **cinquante-sept références et
onze licences**.

## Ce que ce jeu n'est pas

C'est le deuxième jeu de gestion du dépôt, après *Grand Huit*, et il aurait été
facile d'en faire le même avec des caddies. La boucle est volontairement
différente au point d'inverser le sens du jeu.

| | Grand Huit | Tête de Gondole |
|---|---|---|
| Ce que fait le visiteur | il **choisit** la plus belle chose à faire | il **exécute une liste** de courses |
| Ce que vend le joueur | une expérience, en stock infini | de la **marchandise**, qui s'épuise |
| Quand on décide | pendant la journée : construire, tarifer | **au bureau, en pleine journée**, devant le bon de commande |
| Le goulot | la file de chaque attraction | la **file unique des caisses**, à la sortie |
| On perd de l'argent en | payant le loyer | **rupture**, **casse** et **caddies abandonnés** |
| Ce qui se voit à l'écran | des manèges qui tournent | des **rayons qui se vident** |
| Palette | plein soleil, pelouse | **lino, néon, bitume** |

Le décalage entre la décision et son effet est le ressort du jeu. On commande
quand on veut, mais **le camion met deux heures et demie**, et passé dix-sept
heures trente il ne passera plus avant le lendemain matin. Voir sa rupture à
midi et la voir à la fermeture ne coûte pas la même chose.

## La boucle

```
licence achetée → commande passée au bureau → camion deux heures et demie plus
tard → réserve → mise en rayon par un employé → le client prend → passage en
caisse → marge → réputation → combien de monde se présente demain
```

Et trois fuites, qu'il faut tenir toutes les trois :

- **la rupture** — le rayon est vide, la vente n'a pas lieu, et le client le dit
  en sortant. C'est la fuite invisible : elle ne coûte rien, elle ne rapporte
  simplement pas, et rien dans les comptes ne la montre. Le bilan du soir la
  chiffre explicitement, en euros de chiffre d'affaires perdu ;
- **la casse** — le périssable commandé en trop finit à la benne, payé et jamais
  vendu. C'est la punition symétrique : commander large protège de la rupture et
  fabrique de la casse ;
- **la file** — un client qui attend trop devant deux caisses ouvertes un samedi
  **repose son caddie plein et s'en va**. Toute la marchandise retourne en rayon,
  la vente est annulée, et la réputation encaisse.

Et une quatrième, qui n'en est pas une : **le temps du patron**. Chaque minute
passée derrière une caisse est une minute qu'on ne passe pas à monter des
palettes, et réciproquement. C'est la seule ressource du jeu qui ne s'achète
pas — sauf en embauchant.

## Le client

Il entre avec un caddie ou un panier, un budget, une patience, et une **liste de
deux à douze familles** tirée selon le jour et le temps qu'il fait. Il fait le
tour, ligne après ligne, en allant toujours au rayon le plus proche qui porte ce
qu'il cherche. Sur chaque ligne, trois questions :

| Question | Si c'est non |
|---|---|
| **Le rayon a-t-il du stock ?** | rupture — la vente est perdue et il s'en souviendra |
| **Le prix est-il acceptable ?** | il repose ; à 80 % au-dessus du prix de référence, plus personne ne prend |
| **La date est-elle correcte ?** | il repose, et c'est pire qu'un prix trop cher |

Si le magasin ne fait pas du tout la famille qu'il cherchait, c'est un reproche
différent — un manque de **choix** — et le bilan du soir les distingue.

Puis il va à la caisse la moins pénible : la distance, plus la file, plus une
pénalité pour l'automatique. S'il a moins de douze articles, la caisse rapide
lui est ouverte.

En chemin, il passe devant les **têtes de gondole** et les **présentoirs de
caisse**. Là, il ne décide rien : il tend la main. C'est l'achat d'impulsion, et
c'est le seul endroit du jeu où le joueur vend quelque chose que personne
n'était venu chercher.

## Le stock, référence par référence

Un meuble porte **une seule référence**, choisie par le joueur. C'est la règle
qui tient tout le reste : elle rend le magasin lisible d'un coup d'œil — on voit
quel rayon se vide — et elle fait de l'implantation une vraie décision, puisque
chaque mètre donné aux pâtes est un mètre retiré au fromage.

Une unité de marchandise a un **âge**. Les lots sont suivis par âge et servis
dans l'ordre où ils sont arrivés, exactement comme dans un magasin : le plus
vieux part en premier, ce qui limite la casse. Quand un lot atteint la
durée de conservation de son produit, il part à la benne — payé, jamais vendu.

| Famille | Licence | Agrément | Références | Meuble |
|---|---|---|---|---|
| 🍝 Épicerie sèche | offerte | 1 | 7 | gondole |
| 🧼 Entretien | 800 € | 1 | 5 | gondole |
| 🥤 Boissons | 1 200 € | 2 | 5 | casier |
| 🍫 Petit-déjeuner | 1 700 € | 3 | 6 | gondole, tête de gondole |
| 🧀 Crémerie | 2 700 € | 4 | 6 | bac réfrigéré |
| 🍎 Fruits et légumes | 2 300 € | 5 | 6 | étal |
| 🧴 Hygiène | 2 100 € | 6 | 5 | gondole |
| 🧊 Surgelés | 4 400 € | 7 | 4 | armoire |
| 🥖 Boulangerie | 4 200 € | 8 | 4 | fournil + boulanger |
| 🔋 Bazar | 2 700 € | 9 | 5 | gondole, présentoir |
| 🥩 Boucherie | 6 500 € | 10 | 4 | vitrine + boucher |

Une licence ne suffit pas : **chaque référence a en plus son propre agrément**.
La licence Crémerie s'achète au niveau 4 et donne lait, œufs et yaourts ; le
beurre attend le 5, le fromage le 6, la crème le 7. C'est ce qui fait qu'un
rayon acheté tôt continue de s'enrichir longtemps après.

Et une durée de conservation par référence : la baguette périme en **un jour**,
la salade en trois, le steak en trois, le lait en six, le beurre en douze, et
tout ce qui est sec ou surgelé ne périme jamais.

Le **fournil** est à part : il ne consomme pas de réserve, il fabrique sur place
tant que le boulanger est là — au prix de la matière première. C'est la
contrepartie de la baguette qui périme en une journée.

La marchandise livrée dort dans la **réserve**, dont la capacité dépend des racks
posés. Ce qui ne rentre pas au déchargement est refusé. Un **rayonniste** fait la
navette entre le rack et le rayon le plus vide ; sans lui, le patron s'en occupe,
mais à la vitesse où un rayon se vide un lundi.

## Le bureau

On y va quand on veut, en pleine journée, depuis la barre du bas. Le magasin se
met en pause pendant ce temps : c'est la tablette du gérant, pas une machine à
remonter le temps.

Il porte deux choses. En haut, **les licences** — les onze familles, ce qu'elles
coûtent, l'agrément qu'elles réclament, et combien de leurs références sont déjà
ouvertes. C'est le vrai arbre de progression du jeu, et il est entièrement
visible dès la première minute : on sait tout de suite ce qu'on pourra vendre et
dans quel ordre.

En dessous, **le bon de commande**. Pour chaque référence :

- **vendu** hier — la demande réelle ;
- **manqué** hier — les ventes qu'on n'a *pas* faites faute de stock, en rouge.
  C'est le chiffre qui n'existe dans aucun tableau de bord classique et qui dit
  exactement quoi commander ;
- **reste** — réserve plus rayon ;
- **place** — ce que le linéaire peut absorber, ou *aucun rayon ne le porte* ;
- ce qui est **déjà en route** et pas encore déchargé ;
- la **durée de conservation**, le **prix d'achat** et le **prix de vente**.

Le bandeau du bas tient le total, le volume, la place restante en réserve et
prévient quand la caisse ne suit pas. Un bouton **REMPLIR AU MIEUX** propose une
commande raisonnable — la fin de la journée en cours plus la suivante, corrigée
du jour de la semaine, au plus juste pour le frais — et la rogne tant qu'elle ne
rentre ni dans la caisse ni dans la réserve.

**La commande est payée à la commande**, pas à la livraison. C'est ce qui fait
qu'un gérant peut se retrouver à sec un vendredi soir avec un camion en route.

## Le patron travaille

Un jeu de gestion où l'on passe une commande puis où l'on regarde n'est pas un
jeu, c'est un tableur avec une animation. Le patron est donc **un personnage
présent dans les allées**, et c'est le joueur qui l'envoie travailler. L'outil
**TRAVAILLER** transforme le clic :

| Ce qu'on clique | Ce qu'il fait |
|---|---|
| un **rayon** | il descend en réserve, charge une palette et remonte, autant de fois qu'il faut pour le remplir |
| une **caisse sans hôte** | il se met derrière et **tu scannes** : `Espace` ou le bouton, un article par coup |
| un **papier par terre** | il va le ramasser (et ceux qu'il croise en chemin partent tout seuls) |
| **le sol** | il s'y rend, tout simplement |

C'est le vrai départ d'un petit commerce : tant qu'on ne peut pas payer un hôte
de caisse à 70 € la journée, on tient la caisse soi-même. Et l'arbitrage est
chiffré — **une caisse laissée à elle-même avance deux fois moins vite qu'avec
un hôte, mais chaque coup de scanner du joueur reprend l'avance d'un article
entier.** Un patron attentif encaisse plus vite qu'un salarié ; un patron
distrait encaisse moins vite. Le salaire achète de l'attention, pas de la
vitesse.

Le travail manuel rapporte de l'expérience : environ deux points par palette
montée, un demi-point par article scanné, deux points par déchet ramassé. Sur
une journée pleine, un patron actif avance d'un bon tiers plus vite qu'un
patron assis — ce qui est exactement le rapport qu'on veut entre jouer et
regarder.

Deux bandeaux suivent tout ça : en bas à gauche **ce que fait le patron en ce
moment**, au centre **la caisse qu'il tient**, avec le client en cours, ce qu'il
y a à encaisser et combien attendent derrière.

## Ce que le jeu dit tout seul

Un jeu de gestion doit dire ce qui cloche, pas laisser deviner. Le panneau du
magasin ouvre sur une liste **À RÉGLER** qui n'affiche que ce qui coûte
réellement de l'argent en ce moment :

- aucune caisse, ou aucune caisse ouverte faute d'hôte ;
- les rayons en rupture, nommés ;
- la marchandise qui dort en réserve faute de rayonniste ;
- les meubles devenus inaccessibles ;
- la réserve pleine — la prochaine livraison sera refusée ;
- le magasin sale.

Quand il n'y a rien, il l'écrit aussi. Et le bilan du soir ne dit pas seulement
combien de points d'agrément il reste : il dit **combien de journées ça
représente au rythme actuel**, et **ce que le palier suivant ouvrira**.

## La semaine

Six journées, et elles ne se ressemblent pas. C'est ce qui remplace la météo
d'un parc d'attractions : un magasin réglé pour le lundi se fait démolir le
samedi.

| Jour | Affluence | Ce qui change |
|---|---|---|
| Lundi | 70 % | personne. On range, on nettoie |
| Mardi | 80 % | le rythme de croisière |
| Mercredi | 98 % | les enfants sont là : goûter et bonbons ×1,7 |
| Jeudi | 90 % | une journée sans caractère |
| Vendredi | 128 % | courses du week-end, gros paniers, boissons ×1,4 |
| Samedi | 162 % | la journée qui paie le loyer, et celle où les caisses cassent |

Par-dessus, le temps qu'il fait dehors : la **canicule** multiplie les boissons
par 2,4 et les surgelés par 1,9 mais fait fuir la boucherie ; le **grand froid**
fait vendre du surgelé et de l'épicerie ; la **pluie** vide le parking.

## Les caisses

Une caisse ne s'ouvre **que si quelqu'un est derrière**. C'est le vrai coût : la
caisse se paie une fois, l'hôte se paie tous les jours. L'automatique se passe
d'hôte mais scanne près de deux fois moins vite et les clients pressés la
boudent.

| | Cadence | Hôte |
|---|---|---|
| Caisse | 0,20 s par article | oui |
| Caisse rapide | 0,12 s par article, douze articles maximum | oui |
| Caisse automatique | 0,33 s par article | non |

## Comment ils trouvent leur chemin

Le magasin est un graphe. Pour **chaque** meuble, à chaque modification de
l'implantation, on calcule un parcours en largeur qui donne, depuis n'importe
quelle case, le nombre de pas qui l'en sépare. Un client ne cherche donc jamais
son chemin : il descend la pente du champ de son rayon.

Deux avantages, et c'est pour ça que c'est fait comme ça :

1. trois cents clients coûtent trois cents lectures de tableau par image, pas
   trois cents recherches de chemin ;
2. la **distance à pied** dont la décision a besoin est déjà là, gratuite — celle
   qui contourne la gondole, pas la distance à vol d'oiseau.

Le même champ range la file des caisses le long de l'allée, et sert au
rayonniste pour trouver son rack.

Le **sas** — les deux cases devant la porte, sur deux rangs — n'est pas
constructible. C'est le minimum qui garantit qu'on ne peut pas murer sa propre
entrée. Au-delà, on laisse faire : un rayon isolé porte son étiquette
INACCESSIBLE, ce qui est un reproche lisible et pas un piège.

## Le bail qui pousse

Le local fait toute la grille ; le bail n'en occupe qu'un rectangle, posé en bas
au milieu, porte au centre. Les murs ne se posent pas : ils sont **déduits** du
rectangle. Un agrandissement, c'est un rectangle plus grand — les murs se
déplacent tout seuls et l'ancien mur devient du sol.

| Agrément | Surface |
|---|---|
| 1 | 21 × 14 |
| 3 | 26 × 17 |
| 5 | 32 × 21 |
| 8 | 40 × 26 |
| 11 | 50 × 33 |

## L'agrément commercial — les niveaux

Douze paliers, et ils se méritent : **environ cinq journées pleines par palier**,
du premier au dernier. Soixante journées de campagne pour douze niveaux — c'est
volontaire, un magasin qui ouvre tout son catalogue en une semaine n'a plus rien
à raconter ensuite.

```js
xpPour(n) = 520 × (n − 1)^1,90
```

L'expérience vient **uniquement de ce qui passe en caisse** : les tickets, les
articles, la satisfaction des clients, la marge dégagée. Ni la construction ni
l'argent dépensé n'en donnent — on ne monte pas de niveau en achetant des
meubles, on en monte en vendant. Chaque palier ouvre des licences, des
références, du matériel, des métiers, et cinq d'entre eux agrandissent le bail.

## Le soir

Le magasin ferme, on compte. Encaissé, livraison payée, casse, démarque
inconnue, charges, salaires, résultat, et la **marge brute** comme indicateur à
part — parce que la trésorerie et la marge ne disent pas la même chose : la
commande se paie le matin, les ventes rentrent toute la journée.

Puis deux cartes qui n'existent que là :

- **Ce qui a manqué** — le classement des ruptures, référence par référence, avec
  le chiffre d'affaires perdu en euros. Ce n'est pas une statistique inventée :
  c'est le compte exact des articles que des clients ont voulu prendre dans un
  rayon vide. C'est littéralement la liste des courses du lendemain. En dessous,
  les familles que le magasin ne fait pas du tout, et les reproches dominants ;
- **Ce qu'ils en ont dit** — cinq phrases, tirées dans la cause dominante de
  chaque client. Un mécontent qui se plaint au hasard n'apprend rien au joueur.

Deux jours avant le samedi, une carte de plus s'ouvre : le loyer, la date, et
combien il manque encore.

## La carrière — ce qui survit à la partie

Soixante journées de douze minutes, et une faillite possible au dernier
samedi. Tout ce qui suit existe pour que ce ne soit jamais une soirée pour rien.

**Le profil** : un nom d'enseigne, un portrait parmi six, et six rangs qui montent
avec les points de carrière — une fraction des points d'agrément gagnés en
partie, plus une prime de victoire.

| Rang | À partir de |
|---|---|
| 🛒 COMMIS | 0 |
| 🥫 CHEF DE RAYON | 2 500 |
| 🧾 GÉRANT | 9 000 |
| 👔 DIRECTEUR | 24 000 |
| 🏬 PATRON DE CENTRALE | 55 000 |
| 👑 EMPIRE | 110 000 |

**La centrale d'achat** : les jetons viennent des succès et de la fin de chaque
partie — **y compris perdue**. Treize améliorations définitives, valables pour
toutes les parties suivantes : trésorerie de départ, négoce (−5 % sur les prix
d'achat), bail négocié, enseigne connue, bonne entente, entrepôt, logistique,
formation caisse, merchandising, sécurité, confort d'achat, école de commerce,
carnet d'adresses.

**Vingt-trois succès**, dont plusieurs qui n'ont de sens que dans un supermarché :
finir une journée sans une seule rupture, une journée avec du frais et zéro
casse, une journée sans un seul caddie abandonné, acheter les onze licences,
tenir cinquante références en rayon.

**Les contrats** : deux par semaine (trois avec le carnet), tirés parmi huit
types et recalibrés chaque semaine. Deux d'entre eux portent directement
sur les fuites — *au plus tant de ventes ratées*, *moins de tant d'euros de
casse* —, ce qui en fait le meilleur tutoriel du jeu.

**La publicité** : prospectus, radio locale, panneau 4×3, spot régional. C'est le
seul levier court sur l'affluence, et il se retourne contre celui qui le tire au
mauvais moment — le monde qu'un prospectus amène le samedi tombe dans une file
de caisse et repart en le racontant.

**La partie se reprend** : un instantané est pris chaque matin à l'ouverture du
rideau, le seul moment où le magasin se décrit entièrement — personne dans les
allées, aucune file, aucun caddie en cours. Le plan du local ne se sauvegarde
même pas : il se déduit du niveau d'agrément et de la liste des meubles.

**La courbe de la campagne** : une barre par journée pour le résultat, la caisse
en courbe dorée, les fins de semaine en traits verticaux.

## Le rendu

Vue de dessus, lumière de néon, lino et bitume. Le sol ne change qu'à la pose :
il est découpé en morceaux de vingt cases de côté, un morceau n'est repeint que
si quelque chose a changé dedans, et seuls les morceaux visibles sont dessinés.

Le parti pris qui compte : **on voit le stock**. Un rayon plein est une grille de
blocs colorés pleine, un rayon à moitié vide est à moitié vide, un rayon en
rupture est un squelette gris avec son étiquette de prix. Le joueur n'a pas à
ouvrir un tableau pour savoir où ça coince : il regarde son magasin. Les cagettes
de l'étal se vident fruit par fruit, la vitrine du boucher pièce par pièce, le
fournil rougeoie quand le boulanger est là, et la lampe au-dessus de chaque
caisse est verte ou rouge selon qu'un hôte est derrière.

Les vignettes du catalogue ne sont pas dessinées à part : ce sont les vrais
meubles, peints en miniature par le même code. Ce qu'on voit dans le menu est
exactement ce qu'on posera.

Le menu lui-même n'est pas une image : c'est un supermarché complet — soixante
meubles, dix caisses, cent cinquante clients qui font leurs courses — qui tourne
derrière le titre.

## Commandes

- **Clic** pose · **clic droit** ou `Échap` lâche l'outil.
- Outil **TRAVAILLER** : clic sur un rayon, une caisse, un papier ou le sol pour
  y envoyer le patron. Derrière une caisse, `Espace` scanne un article.
- Un papier par terre se ramasse d'un clic même sans outil en main.
- Sans outil, **glisser** déplace la vue et **clic** ouvre la fiche de ce qu'on a
  sous le curseur.
- **Molette** ou `+` `−` zoome · `Espace` met en pause (ou scanne si le patron
  tient une caisse) · `1` `2` règlent la vitesse.
- Au doigt : un doigt déplace, deux doigts zooment, appui pose. Portrait et
  paysage.

## Réglages du fichier

```js
const GX=58, GY=42, TUILE=26;                 // le local, 2 436 parcelles
const SEMAINES=10, JOURS=6;                   // la campagne, soixante journées
const LOYERS=[1800,2600,3800,5200,7000,       // ce que le bailleur prend,
              9200,12000,15500,20000,26000];  //   chaque samedi soir
const OUVERTURE=8, FERMETURE=20;
const SECONDES_JOUR=720;                      // une journée à vitesse 1
const DELAI_LIVRAISON=2.5;                    // heures entre la commande et le camion
const VIT_BASE=16;                            // un client, en pixels/seconde
const CADENCE_BASE=.19;                       // secondes par article en caisse
const CAP_RESERVE_BASE=340;
const NIV_MAX=12;                             // douze paliers, cinq journées chacun
xpPour(n) = 520 × (n−1)^1,90
argent de départ : 18 000 €
```

## Comment ça a été vérifié

Un robot gérant joue les dix semaines dans un Chromium sans interface. Il achète
chaque matin la licence la moins chère qu'il peut s'offrir en gardant de quoi
acheter le meuble et la marchandise qui vont avec, ouvre ses caisses avant tout
le reste, pose un rayon pour la référence ouverte la plus demandée qui n'en a
pas, double le rayon le plus en rupture de la veille, embauche un rayonniste
tous les six rayons — et **passe deux commandes par jour**, une à l'ouverture et
une vers quatorze heures, comme un vrai gérant qui voit son rayon se vider. Il sort une ligne par journée : clients, tickets, articles,
chiffre d'affaires, achats, casse, charges, résultat, caisse, étoiles,
satisfaction, ruptures, caddies abandonnés, et les deux reproches dominants.
