# Tête de Gondole

`gondole.html` — un jeu complet dans un seul fichier, sans dépendance, sans
image ni son téléchargé. Le magasin est peint au canvas, le bip du scanner et
la musique d'ambiance sont synthétisés note par note.

## L'idée

Un local nu en zone commerciale, un découvert autorisé, et **quatre semaines de
six jours** pour en faire un supermarché qui tient. Un loyer commercial tombe
chaque samedi soir, et il augmente. On monte les rayons, on choisit ce qu'on met
dedans, on commande le stock, on fixe les prix, on ouvre des caisses.

**Une journée dure douze minutes**, de huit heures à vingt heures, avec deux
coups de feu — la fin de matinée et la sortie du travail. Les commandes de
vitesse montent jusqu'à ×10.

## Ce que ce jeu n'est pas

C'est le deuxième jeu de gestion du dépôt, après *Grand Huit*, et il aurait été
facile d'en faire le même avec des caddies. La boucle est volontairement
différente au point d'inverser le sens du jeu.

| | Grand Huit | Tête de Gondole |
|---|---|---|
| Ce que fait le visiteur | il **choisit** la plus belle chose à faire | il **exécute une liste** de courses |
| Ce que vend le joueur | une expérience, en stock infini | de la **marchandise**, qui s'épuise |
| Quand on décide | pendant la journée : construire, tarifer | **la veille au soir**, devant le bon de commande |
| Le goulot | la file de chaque attraction | la **file unique des caisses**, à la sortie |
| On perd de l'argent en | payant le loyer | **rupture**, **casse** et **caddies abandonnés** |
| Ce qui se voit à l'écran | des manèges qui tournent | des **rayons qui se vident** |
| Palette | plein soleil, pelouse | **lino, néon, bitume** |

Le décalage d'une journée entre la décision et son effet est le ressort du jeu.
Quand le samedi arrive et que le rayon est vide, il est déjà trop tard : c'est
jeudi soir qu'il fallait commander.

## La boucle

```
commande du soir → livraison du matin → mise en rayon par un employé →
le client prend → passage en caisse → marge → réputation →
combien de monde se présente demain
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

## Le client

Il entre avec un caddie ou un panier, un budget, une patience, et une **liste de
trois à dix familles** tirée selon le jour et le temps qu'il fait. Il fait le
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

| Famille | Meuble | Conservation |
|---|---|---|
| 🥫 Épicerie | gondole, gondole longue | ne périme pas |
| 🧀 Crémerie | bac réfrigéré | 6 à 12 jours |
| 🍎 Fruits et légumes | étal | 3 à 5 jours |
| 🥩 Boucherie | vitrine (il faut un boucher) | 3 à 5 jours |
| 🥖 Boulangerie | fournil (il faut un boulanger) | **1 jour** |
| 🥤 Boissons | casier, gondole | ne périme pas |
| 🧊 Surgelés | armoire | ne périme pas |
| 🧼 Entretien | gondole | ne périme pas |
| 🍫 Caisse et goûter | tête de gondole, présentoir | ne périme pas |

Le **fournil** est à part : il ne consomme pas de réserve, il fabrique sur place
tant que le boulanger est là — au prix de la matière première. C'est la
contrepartie de la baguette qui périme en une journée.

La marchandise livrée dort dans la **réserve**, dont la capacité dépend des racks
posés. Ce qui ne rentre pas au déchargement est refusé. Un **rayonniste** fait la
navette entre le rack et le rayon le plus vide ; sans lui, le patron s'en occupe,
mais à la vitesse où un rayon se vide un lundi.

## Le bon de commande

Le seul écran du jeu où l'on décide vraiment. Pour chaque référence :

- **vendu** hier — la demande réelle ;
- **manqué** hier — les ventes qu'on n'a *pas* faites faute de stock, en rouge.
  C'est le chiffre qui n'existe dans aucun tableau de bord classique et qui dit
  exactement quoi commander ;
- **reste** — réserve plus rayon ;
- **place** — ce que le linéaire peut absorber ;
- la **durée de conservation** et le **prix d'achat**.

Le bandeau du bas tient le total, le volume, la place restante en réserve et
prévient quand la caisse ne suit pas. Un bouton **REMPLIR AU MIEUX** propose une
commande raisonnable — couverture d'environ une journée et demie pour le sec,
au plus juste pour le frais — et la rogne tant qu'elle ne rentre ni dans la
caisse ni dans la réserve.

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
| 4 | 27 × 18 |
| 8 | 35 × 22 |
| 13 | 44 × 28 |
| 18 | 54 × 36 |

## L'agrément commercial — les niveaux

Vingt paliers, gagnés en faisant tourner le magasin : les clients encaissés, les
articles qui passent en caisse, la satisfaction, la marge.

```js
xpPour(n) = 43 × (n − 1)^2,43
```

La même courbe que *Grand Huit* après son redressement : le vingtième palier
n'est pas garanti par une partie simplement correcte. Chaque palier ouvre des
références, du matériel, des métiers, et quatre d'entre eux agrandissent le bail.

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

Vingt-quatre journées de douze minutes, et une faillite possible au dernier
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

**Vingt-deux succès**, dont plusieurs qui n'ont de sens que dans un supermarché :
finir une journée sans une seule rupture, une journée avec du frais et zéro
casse, une journée sans un seul caddie abandonné, référencer les trente-cinq
produits.

**Les contrats** : deux par semaine (trois avec le carnet), tirés parmi huit
types et calibrés sur la semaine en cours. Deux d'entre eux portent directement
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
- Sans outil, **glisser** déplace la vue et **clic** ouvre la fiche de ce qu'on a
  sous le curseur.
- **Molette** ou `+` `−` zoome · `Espace` met en pause · `1` `2` `3` règlent la
  vitesse.
- Au doigt : un doigt déplace, deux doigts zooment, appui pose. Portrait et
  paysage.

## Réglages du fichier

```js
const GX=58, GY=42, TUILE=26;                 // le local, 2 436 parcelles
const SEMAINES=4, JOURS=6;                    // la campagne, vingt-quatre journées
const LOYERS=[3600,9600,19000,32000];         // ce que le bailleur prend
const OUVERTURE=8, FERMETURE=20;
const SECONDES_JOUR=720;                      // une journée à vitesse 1
const VIT_BASE=16;                            // un client, en pixels/seconde
const CADENCE_BASE=.19;                       // secondes par article en caisse
const CAP_RESERVE_BASE=380;
const NIV_MAX=20;
xpPour(n) = 43 × (n−1)^2,43
```

## Comment ça a été vérifié

Un robot gérant joue les quatre semaines dans un Chromium sans interface. Il
ouvre ses caisses avant tout le reste, ajoute une référence par famille dans
l'ordre où l'agrément les débloque, double le rayon le plus en rupture de la
veille, embauche un rayonniste tous les six rayons, et valide chaque soir la
commande proposée. Il sort une ligne par journée : clients, tickets, articles,
chiffre d'affaires, achats, casse, charges, résultat, caisse, étoiles,
satisfaction, ruptures, caddies abandonnés, et les deux reproches dominants.
