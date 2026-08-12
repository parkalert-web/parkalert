# Supermarché Tycoon

`supermarche.html` — un jeu complet dans un seul fichier, sans dépendance, sans
image ni son téléchargé. Le magasin est peint au canvas, le bip du scanner et
la musique d'ambiance sont synthétisés note par note.

> Ce jeu s'appelait *Tête de Gondole*. Même magasin, même caisse, nouveau nom —
> et, depuis, une journée qui commence rideau baissé, des gondoles qui se
> déplacent, une équipe qu'on forme et qu'on remercie, et une partie qu'on
> retrouve là où on l'avait laissée.

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

| | Grand Huit | Supermarché Tycoon |
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

## La journée en deux temps

C'est le geste qui manquait. Une journée ne démarre plus toute seule : elle
commence **rideau baissé, l'horloge arrêtée sur huit heures**, et rien n'entre
tant que le joueur n'a pas appuyé sur **OUVRIR LE MAGASIN**.

Pendant cette préparation, tout le reste marche : on passe la commande, on
déplace les gondoles, on embauche, on forme, on monte les palettes en rayon, on
ramasse ce qui traîne. Rien ne presse **parce que rien ne tourne** — et le
camion prévu pour l'après-midi attend l'ouverture, pour qu'on ne puisse pas
geler le temps en attendant sa livraison.

Un bandeau dit ce qui ne va pas avant qu'il soit trop tard : rayons vides,
caisses non tenues, réserve pleine d'articles à monter, et surtout **ce qu'il
faudra sortir ce soir**. Quand tout est vert, on ouvre.

Il porte aussi **TOUT MONTER EN RAYON** (`R`), qui remplit la file de tâches du
patron avec tous les rayons qui attendent quelque chose, les plus vides
d'abord. Cliquer quinze gondoles une par une n'est pas une décision, c'est une
corvée.

On peut aussi ne pas ouvrir du tout. **RESTER FERMÉ AUJOURD'HUI** saute la
journée : la paie et les charges tombent quand même, la réputation baisse un
peu, mais on gagne une journée entière de travaux. C'est un vrai coup à jouer
un lundi, jamais un samedi.

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

## Le cours de la centrale

Le prix d'achat était la dernière constante du jeu. On commandait toujours au
même tarif, et commander aujourd'hui plutôt que demain n'avait aucune
conséquence.

Chaque référence a maintenant **un cours qui bouge toutes les nuits**. Trois
mouvements, dans cet ordre :

1. tout revient d'un quart vers son niveau normal, avec un peu de bruit — c'est
   ce qui fait qu'un arrivage s'épuise en trois ou quatre jours au lieu de durer
   toute la partie ;
2. une fois sur deux, **une famille entière** bouge de 14 à 30 %, à la hausse ou
   à la baisse ;
3. puis deux à quatre références isolées prennent un vrai coup — **−22 à −42 %**
   pour un arrivage, +20 à +38 % pour une tension.

Et une raison, toujours : *la récolte a été bonne*, *le gel a touché les
vergers*, *une chambre froide doit être vidée*, *le blé monte*. C'est cette
phrase qui fait qu'on retient « le lait est à −30 % » au lieu de voir passer un
chiffre vert de plus.

**Le prix de vente ne bouge pas.** Ce que le client trouve normal reste ce qu'il
trouve normal : une baisse de la centrale est de la marge pure, pour qui a la
réserve, la trésorerie et la place en rayon pour en profiter. Sur soixante
journées le cours moyen s'établit autour de **0,977** — 16 % des références en
arrivage et 8 % en tension à un instant donné. Le cadeau est minuscule ; ce
qu'on gagne à lire l'ardoise ne l'est pas.

Ça se lit à quatre endroits : **L'ARDOISE DU JOUR** en tête du bon de commande,
un badge de variation sur chaque ligne avec l'ancien prix barré, le panneau
**LE MARCHÉ** depuis la barre d'outils, et le bilan du soir qui chiffre
séparément *acheté au bon moment* et *payé au prix fort*. Le bouton REMPLIR AU
MIEUX charge de lui-même sur les arrivages non périssables.

Le bon de commande se lit aussi de trois façons — **par famille**, **par bonne
affaire** (le cours le plus bas d'abord), **par ce qui a manqué** hier. C'est le
tri qui décide de ce qu'on achète : celui qui range par famille achète par
habitude, celui qui range par affaire achète au bon moment.

## Réagencer le magasin

Poser une gondole au mauvais endroit coûtait le prix d'une démolition — 55 % du
meuble perdus et le stock renvoyé en réserve. C'était la punition la plus bête
du jeu : **un magasin se réagence, il ne se reconstruit pas.**

L'outil **DÉPLACER** prend un meuble et le repose ailleurs. Il garde tout : sa
référence, ses lots et leur date, son prix de vente, son compteur de ventes et
sa recette. Le déplacement est gratuit et se fait à n'importe quel moment, y
compris en pleine journée — les clients qui visaient ce rayon refont
simplement leur chemin.

Les mêmes règles qu'à la pose s'appliquent : il faut une allée devant, on ne
bouche pas le sas d'entrée, et un présentoir reste collé à sa caisse. Le
fantôme montre l'ancienne place en pointillé et la nouvelle en plein, avec la
raison du refus quand il y en a une.

## Ce qu'il y a dans les rayons

Un rayon était un rectangle rempli de petits carrés à la couleur de la famille.
On voyait s'il était plein ; on ne voyait pas ce qu'il y avait dedans, et deux
rayons de la même famille étaient rigoureusement identiques.

Chaque référence a maintenant **une silhouette**. Dix-sept formes — paquet,
boîte, conserve, bouteille, canette, brique, pot, fruit, légume, pain,
barquette, rouleau, flacon, tube, tablette, boîte à œufs, sachet — attribuées
par famille avec une trentaine d'exceptions : la bouteille d'huile n'est pas le
paquet de pâtes, la brique de lait n'est pas le pot de yaourt, le steak n'est
pas la baguette. Trois nuances par référence, pour qu'un linéaire de trente-deux
articles ne soit pas un aplat.

C'est plus lisible **et moins cher à dessiner** : chaque silhouette est peinte
une seule fois dans un petit canevas hors écran, à la taille exacte où on en a
besoin, puis recopiée. Un article coûte un `drawImage` là où il coûtait trois
`fillRect`. Le cache se vide quand le zoom change. Sous une certaine taille de
case, on revient au bloc de couleur — à cette distance, une forme ne se
distingue plus de toute façon.

Au-dessus de chaque meuble, **une réglette de prix** : pastille à la couleur de
la famille, nom de la référence, prix de vente à droite — rouge s'il est passé
sous le prix d'achat, orange si la marge est maigre, vert sinon. Dessous, un
**trait de remplissage** qui va du vert au rouge et qui se lit même dézoomé,
bien après que le texte a disparu. Et un **fanion PROMO** quand le prix est
nettement sous la référence.

Sous 60 % de zoom la réglette disparaît — mais une **pastille à la couleur de
la famille** reste posée sur le coin du meuble, et le trait de remplissage reste
lisible. On retrouve son rayon de crémerie au milieu de quarante meubles sans
avoir à rezoomer.

Les meubles ont aussi gagné un filet sombre et une double ombre portée : sans
contour, un meuble clair posé sur un sol clair transforme le magasin en bouillie
beige dès qu'on prend du recul.

L'étal de fruits, la vitrine du boucher et le fournil, qui avaient chacun leur
dessin bricolé, passent au même système : on y voit maintenant de vraies
pommes, de vraies barquettes et de vraies baguettes.

## L'équipe

Un employé n'est plus une ligne de dépense interchangeable. Chacun a **un
prénom, un métier et un échelon** :

| échelon | efficacité | paie |
|---|---|---|
| DÉBUTANT | × 1 | × 1 |
| CONFIRMÉ | × 1,34 | × 1,22 |
| CHEF DE RAYON | × 1,72 | × 1,48 |
| BRAS DROIT | × 2,15 | × 1,80 |

Ce que l'échelon change dépend du métier, et ce n'est jamais décoratif : l'hôte
fait avancer le tapis plus vite, le rayonniste porte de plus grosses palettes,
l'agent d'entretien nettoie plus fort, le boulanger sort ses fournées plus
souvent et plus grosses, le vigile laisse filer moins de démarque.

L'arbitrage est net : **former quelqu'un coûte une fois et se paie tous les
jours jusqu'à la fin de la partie.** Un chef de rayon vaut mieux que deux
débutants tant qu'on manque de place et de caisses, et moins bien dès qu'on
manque de bras.

Le panneau **PERSONNEL** liste les gens qu'on paie, avec pour chacun ce qu'il
coûte, ce qu'il fait, le prix de sa formation et le bouton pour le remercier —
un départ se solde d'**une journée de paie**, pour que virer quelqu'un le
samedi soir ne soit pas gratuit.

## Quel jour est chargé

Le jeu disait déjà que le samedi est lourd et que le lundi est vide, mais il le
disait dans une table de constantes que personne ne voit. Il le **mesure**
maintenant sur la partie en cours : le panneau **FRÉQUENTATION** donne une barre
par jour de la semaine — moyenne de clients, chiffre d'affaires moyen, ventes
parties en rupture, record sur une journée. Le bilan du soir en montre une
version courte.

C'est le chiffre qui dit quoi commander : on commande le jeudi pour le
vendredi, en regardant la colonne du vendredi, pas celle de la veille.

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

Cliquer un deuxième rayon pendant qu'il en remplit un ne l'interrompt pas : ça
l'**enchaîne**. La file de tâches monte à douze, le bandeau la compte, et le
bouton STOP la vide. C'est ce qui rend le travail manuel jouable sur un magasin
de vingt rayons sans devenir du clic frénétique.

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

Quand il n'y a rien, il l'écrit aussi. La barre du haut porte en permanence le
nombre de **rayons en rupture**, en rouge dès qu'il y en a un, et un clic dessus
amène la vue sur le premier. Un client sur le point de lâcher son caddie porte
un point d'exclamation rouge au-dessus de la tête, qui s'intensifie à mesure
qu'il craque — la perte la plus chère du jeu se voit avant d'arriver.

Le bilan du soir ne dit pas seulement combien de points d'agrément il reste : il
dit **combien de journées ça représente au rythme actuel**, et **ce que le palier
suivant ouvrira**, licences comprises. Il porte aussi un palmarès — *ce qui
rapporte, ce qui dort* — qui classe les références par marge du jour et désigne
celles qui prennent du linéaire sans rien vendre.

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

## Ce qu'on voit sans rien ouvrir

La barre du haut porte maintenant deux blocs de plus :

- une **horloge** : l'heure en gros, la journée en barre de progression, et
  l'état du rideau — `AVANT OUVERTURE`, `OUVERT`, `RIDEAU BAISSÉ` — avec un
  cadre qui change de couleur ;
- **À PAYER CE SOIR** : les charges des meubles plus la masse salariale, et le
  loyer en plus le samedi. Le bloc passe au rouge dès que la caisse ne couvre
  plus la somme. C'est le rappel qui manquait : on ne découvre plus le loyer au
  moment où il tombe.

## La sauvegarde

La partie s'enregistre à l'ouverture de chaque journée, **à chaque geste de
préparation**, quand l'onglet passe en arrière-plan et quand on le ferme. Et on
n'a plus à la réclamer : rouvrir le jeu, c'est **se retrouver dans son
magasin**, au matin du jour qu'on avait laissé, rideau encore baissé, prêt à
reprendre la préparation là où on l'avait interrompue.

Ce qui est enregistré : le plan complet des meubles avec leur marchandise et
son âge, la réserve lot par lot, la saleté du sol case par case, l'équipe avec
les prénoms et les échelons, les livraisons en route, les prix, les licences,
les contrats, la courbe de la campagne et le relevé de fréquentation.

Ce qui ne l'est pas : une journée à moitié jouée. On repart du matin, rideau
baissé — c'est plus honnête que de figer quarante clients au milieu d'une
allée. La reprise automatique se coupe dans les réglages.

## Commandes

- **Clic** pose · **clic droit** ou `Échap` lâche l'outil.
- `Espace` ou `Entrée` **ouvre le magasin** quand le rideau est baissé.
- Outil **DÉPLACER** : clic sur un meuble pour le prendre, clic sur une case
  pour le reposer. La fiche d'un meuble a le même bouton.
- Outil **TRAVAILLER** (`T`) : clic sur un rayon, une caisse, un papier ou le sol
  pour y envoyer le patron ; un clic de plus enchaîne les tâches. Derrière une
  caisse, `Espace` scanne un article.
- Un papier par terre se ramasse d'un clic même sans outil en main.
- `C` ouvre le bureau, `M` le panneau du magasin.
- Le compteur **RUPTURES** de la barre du haut est cliquable : il amène la vue
  sur le premier rayon vide. Le bandeau du patron recentre la vue sur lui.
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
const CAP_RESERVE_BASE=520;
const NIV_MAX=12;                             // douze paliers, cinq journées chacun
xpPour(n) = 520 × (n−1)^1,90
argent de départ : 18 000 €
```

## Ce qui a été vérifié en ajoutant tout ça

Un audit automatique retire un meuble sous les pieds du patron, achète une
licence sans agrément, passe une commande, enregistre, recharge la page et
recompare tout. Deux choses ont dû changer dans l'audit lui-même, et elles
disent quelque chose du jeu :

- il cliquait sur **REPRENDRE** après le rechargement. Ce bouton ne sert plus :
  la partie est déjà là. L'audit vérifie maintenant qu'elle s'est rouverte
  toute seule, au bon jour, rideau baissé ;
- il comparait la **réserve** avant et après le rechargement, et trouvait une
  unité d'écart. Ce n'était pas une fuite : depuis que le magasin vit pendant la
  préparation, le réassort automatique déplace de la marchandise de la réserve
  vers les rayons pendant que la page finit de charger. Ce qui doit être
  identique, c'est la **marchandise totale** — réserve plus rayons — et elle
  l'est.

Une sonde séparée monte un petit magasin, déplace un rayon plein et vérifie
qu'il garde sa référence, son stock et ses ventes, que ses nouvelles cases sont
occupées et les anciennes libérées, qu'un déplacement dans le sas d'entrée est
refusé ; puis elle forme un rayonniste (64 → 95 €/jour, efficacité × 1,72), le
remercie, reste fermée une journée entière, et recharge la page pour retrouver
l'équipe avec ses prénoms et ses échelons.

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
