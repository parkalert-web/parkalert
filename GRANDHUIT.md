# Grand Huit

`grandhuit.html` — un jeu complet dans un seul fichier, sans dépendance, sans
image ni son téléchargé. Le décor est peint au canvas, l'orgue de foire est
synthétisé note par note.

## L'idée

La mairie loue un pré de **quatre-vingt-huit sur soixante** derrière la
nationale. Il y a quatre étés de huit jours pour en faire un parc
d'attractions, et un loyer à payer à la fin de chacun — un loyer qui double à
chaque fois. On trace les allées, on monte les manèges, on fixe les prix, on
embauche, et on regarde.

**Une journée dure douze minutes.** C'est long, et c'est voulu : on a le temps
de voir une file se former, de comprendre pourquoi, d'aller poser une deuxième
buvette et de regarder l'effet. Les commandes de vitesse montent jusqu'à ×10
pour ceux qui veulent avancer.

Le jeu a deux boucles. La première, rapide, est la réputation :

> **un visiteur décide → il repart content ou fâché → sa satisfaction fait la
> réputation → la réputation décide de combien de monde se présente demain.**

La seconde, plus lente, est la **licence d'exploitation** : vingt niveaux qui
se gagnent en faisant tourner le parc — chaque visiteur accueilli, chaque tour
vendu, chaque article servi, la satisfaction du jour et le bénéfice. Chaque
palier ouvre du matériel neuf et vient avec une subvention de la mairie. C'est
elle qui donne les nouveautés ; la réputation, elle, ne donne que du monde.

La troisième, la plus lente de toutes, ne s'arrête jamais avec la partie : la
**carrière**. Un nom, un portrait, un rang, des jetons, des succès, et une
boutique d'améliorations définitives. C'est elle qui fait qu'une faillite au
troisième été n'est pas une soirée perdue.

## En quoi ce n'est pas les trois autres jeux du dépôt

*Zone Morte*, *Brasier* et *Quinze Nuits* sont trois jeux d'action : un
personnage, une main, une menace. Celui-ci n'a rien de tout ça.

| | Les trois autres | Grand Huit |
|---|---|---|
| Ce qu'on contrôle | un personnage | **rien de vivant** — un curseur et des prix |
| Ce qu'on fait | viser, éteindre, tenir | **construire, tarifer, embaucher** |
| L'adversaire | des morts, un feu | **l'arithmétique** : un loyer qui monte |
| Le temps | continu, subi | **réglable** : pause, ×1, ×3, ×10 |
| Perdre | on meurt | **on ne peut plus payer** |
| Palette | nuit, sang, cendre | **plein soleil** |

## Le cœur : la décision d'un visiteur

Un visiteur porte cinq besoins qui montent tout seuls — frisson, faim, soif,
vessie, fatigue — un porte-monnaie qui descend, et une patience. Chaque fois
qu'il termine quelque chose, il repèse tout ce que le parc lui propose :

```
score(lieu) =  envie × nouveauté × (1 + attrait)
             − distance à pied × (0,0065 + fatigue × 0,011)
             − attente estimée / patience
             − prix / ce qu'il lui reste
```

Le meilleur score l'emporte s'il dépasse le seuil de l'ennui. Sinon il flâne,
et s'il flâne trop il rentre chez lui.

Chaque terme est un levier de jeu, et un seul :

| Terme | Ce que le joueur peut en faire |
|---|---|
| **envie** | choisir des attractions qui font peur, varier pour la nouveauté |
| **distance** | dessiner des allées courtes, grouper, ne pas s'étaler |
| **fatigue** | poser des bancs — ils rétrécissent le rayon d'action de tout le monde |
| **attente** | doubler une attraction populaire, monter son prix, embaucher un animateur |
| **prix** | l'entrée, chaque manège, chaque boutique, réglables un par un |

### Le piège du billet d'entrée

Le dernier terme est le plus vicieux, et il a fallu une campagne complète pour
le voir. Le prix qu'un visiteur accepte à l'entrée monte avec la taille du parc
— seize attractions valent bien trente-six euros. Mais un porte-monnaie ne
montait pas, lui. Résultat mesuré : à trente-six euros le billet, la moitié des
visiteurs entraient avec seize euros en poche, un tiers avec moins de six, et
certains **en négatif**. Ils ne pouvaient plus rien s'offrir, alors ils
repartaient en disant « on n'a rien fait » — et le jeu accusait le parc au lieu
d'accuser la caisse. Sur la partie de référence, quatre journées consécutives
se sont soldées par **zéro tour de manège avec treize attractions ouvertes**.

Deux règles ont réparé ça :

- **on vient avec de quoi passer la journée** : la bourse suit le nombre
  d'attractions raccordées, comme le prix acceptable ;
- **personne ne paie son dernier euro pour une affiche** : si le billet ne laisse
  pas de quoi monter deux fois, on fait demi-tour au portail.

La deuxième est la plus importante pour le joueur : le compteur de demi-tours
grimpe visiblement au lieu de remplir le parc de gens sans un sou. Et le
panneau du parc annonce désormais, sous le curseur du prix, ce qu'il leur
restera à dépenser dedans.

Le coefficient de distance a été mesuré, pas choisi. À deux centièmes par case,
un visiteur refusait tout ce qui se trouvait à plus de vingt cases : un parc qui
grandissait devenait un parc où plus personne ne montait, et le reproche
numéro un restait « on n'a rien fait » avec dix attractions ouvertes.

Un dernier terme, invisible mais indispensable : **le goût**. Chaque visiteur
porte un tirage stable qui module son envie de ±22 % selon le bâtiment. Sans
lui, deux attractions comparables ne se départagent jamais — tout le monde
calcule le même score, tout le monde va au même endroit. Mesuré sur quatre
manèges côte à côte : 1 / 31 / 0 / 0 avant, 2 / 9 / 13 / 12 après, et le nombre
de tours par visiteur passe de 0,8 à 1,3.

### La saturation, ou pourquoi la vingt-huitième attraction ne sert à rien

Le piège symétrique du précédent, et il a fallu une campagne complète pour le
voir lui aussi. L'affluence montait avec le nombre d'attractions, et le prix
acceptable à l'entrée montait avec le nombre d'attractions : la recette montait
donc au *carré*. La partie de référence finissait avec vingt-huit manèges, un
billet à cinquante-huit euros, trente-sept mille euros de recette par jour et
**cent quatre-vingt-douze mille euros en caisse** — le loyer était devenu une
formalité dès le troisième été.

Le bassin de population d'un parc est fini. Les deux formules passent
maintenant par la même saturation :

```js
attractionsUtiles = 15 × (1 − e^(−n / 7))
```

Sept manèges en valent neuf, quatorze en valent douze, vingt-huit en valent
quatorze. Au-delà, c'est la **réputation** qui porte la croissance — et la
réputation se gagne en raccourcissant les files, pas en alignant des baraques.

## La carrière — ce qui survit à la partie

Une campagne dure quatre étés de huit journées de douze minutes. C'est long, et
elle peut se perdre au dernier loyer. Sans rien autour, ça fait une soirée pour
rien. Tout ce qui suit existe pour que ce ne soit jamais le cas.

### Le profil

Un nom sur l'enseigne, un portrait à choisir parmi six, et un **rang** qui monte
avec les points de carrière — une fraction des points de licence gagnés en
partie, plus une prime de victoire :

| Rang | À partir de |
|---|---|
| 🎪 FORAIN | 0 |
| 🎠 CHEF DE PISTE | 2 500 |
| 🎟 GÉRANT | 9 000 |
| 🎩 DIRECTEUR | 24 000 |
| 💼 MAGNAT | 55 000 |
| 👑 LÉGENDE | 110 000 |

La fiche tient aussi les compteurs de toute une vie : parties jouées, parcs
sauvés, meilleure saison, niveau maximum, visiteurs accueillis, tours vendus,
recette de carrière, plus grosse caisse, succès décrochés.

### La boutique

Les **jetons de fête foraine** viennent des succès et de la fin de chaque partie
— **y compris perdue**. Ils s'échangent contre huit améliorations définitives,
qui valent pour toutes les parties suivantes :

| | Effet par rang | Rangs |
|---|---|---|
| 💰 **Pactole de départ** | +4 000 € au démarrage | 4 |
| 🏛 **Mairie conciliante** | −8 % sur tous les loyers | 3 |
| 📣 **Renommée** | +7 % d'affluence | 3 |
| 🤝 **Bonne entente** | −12 % sur les salaires | 3 |
| 🔧 **Atelier mécanique** | −20 % de pannes | 3 |
| 🌾 **Terrain défriché** | moins de mares, de rochers et de bosquets | 2 |
| 🎓 **École de forains** | +10 % d'expérience gagnée | 3 |
| 📓 **Carnet d'adresses** | +1 contrat par été | 2 |

Le catalogue complet coûte 645 jetons ; les vingt et un succès en rapportent 294.
C'est volontaire : la boutique ne se vide pas en trois parties.

### Les succès

Vingt et un, du premier tour de manège vendu à *SANS FILET* — gagner en
difficulté la plus dure, 60 jetons. Ils se vérifient à la pose d'un bâtiment, à
l'achat d'une révision ou d'une campagne, et à la fermeture du soir ; le succès
décroché s'affiche dans le bilan de la journée avec sa prime.

### Les contrats

Deux par été (trois avec le carnet d'adresses), tirés parmi huit types et
recalibrés sur l'été en cours : accueillir tant de monde en une journée, dégager
tant de bénéfice, vendre tant de tours, finir à tant de satisfaction, atteindre
tant d'étoiles, tenir le parc propre avec du monde dedans, servir tant
d'articles, avoir tant d'attractions ouvertes.

Un contrat se solde **à la fermeture, sur la journée écoulée**. Il paie une
prime et des points de licence, une seule fois, puis il est rangé. Ce qui n'a
pas été rempli expire avec l'été, et le tirage suivant est plus exigeant et
mieux payé.

C'est le seul système du jeu qui donne un **objectif court**. Le loyer est à
huit journées ; un contrat est à aujourd'hui, et il oriente la construction du
matin : on ne pose pas la même chose selon qu'on court après la satisfaction ou
après le volume.

Un onglet leur est réservé dans la barre de construction, avec une pastille qui
compte ce qui reste à remplir, et une barre d'avancement par contrat qui se
lit en pleine journée.

### La saison reprend où on l'a laissée

Trente-deux journées de douze minutes ne se jouent pas d'une traite. Un
instantané est pris **chaque matin, à l'ouverture des grilles** — le seul moment
où le parc se décrit entièrement : pas un visiteur en chemin, pas une file, pas
une particule. Le menu propose alors *REPRENDRE · ÉTÉ 2 · JOUR 5*, et les
réglages offrent un retour au menu qui ne perd rien.

Ce qui est écrit : le sol et la saleté en chiffres collés — cinq mille cases
font cinq kilo-octets au lieu de vingt en JSON —, la liste des bâtiments avec
leur prix, leur usure et leurs pannes, les employés, les contrats, l'historique
et les compteurs. Ce qui est **reconstruit** au chargement : les champs de
distance, les morceaux de sol, le champ de beauté. Vérifié par rechargement
complet du navigateur : caisse, bâtiments, employés, niveau, expérience et cases
d'allée identiques au jeton près.

### La courbe de la campagne

Le bilan du soir et l'écran de fin portent un graphique de toute la campagne :
une barre par journée pour le bénéfice — verte au-dessus de zéro, rouge en
dessous —, la caisse en courbe dorée par-dessus, et les fins d'été en traits
verticaux. Trente-deux lignes de chiffres ne racontent rien ; la même chose en
courbe montre d'un coup d'œil l'été qui a décroché et la journée de pluie qui a
coûté deux mille euros.

## Comment ils trouvent leur chemin

Le réseau d'allées est un graphe. Pour **chaque** bâtiment, à chaque
modification du tracé, on calcule un parcours en largeur qui donne, depuis
n'importe quelle case, le nombre de pas qui l'en sépare. Un visiteur ne cherche
donc jamais son chemin : il descend la pente du champ de sa cible.

Deux avantages, et c'est pour ça que c'est fait comme ça :

1. trois cents visiteurs coûtent trois cents lectures de tableau par image,
   pas trois cents recherches de chemin ;
2. la **distance à pied** dont la décision a besoin est déjà là, gratuite, et
   c'est la vraie distance — celle qui contourne la mare.

Le même champ sert à ranger la file : les cases d'allée les plus proches de la
porte, dans l'ordre, quatre personnes par case. C'est ce qui fait qu'une file
s'allonge visiblement le long de l'allée au lieu de s'empiler sur la porte.

## Ce qu'on peut poser

**Quatorze attractions**, du manège à 1 800 € au Looping à 29 000 €. Chacune a
sa capacité, sa durée de tour, son frisson, sa nausée, sa fiabilité — et son
propre prix, réglable de la gratuité au prix indécent.

| Niveau | Ce qui s'ouvre |
|---|---|
| 1 | manège, tasses folles, buvette, friterie, toilettes, banc, arbre, parterre, poubelle, balayeur |
| 2 | glacier, haie |
| 3 | chaises volantes, lampadaire, mécanicien |
| 4 | train fantôme, barbe à papa, fontaine |
| 5 | auto-tamponneuses, souvenirs, animateur |
| 6 | la pieuvre, statue |
| 7 | tour de chute, pizzeria, jardinier |
| 8 | bateau pirate, bassin |
| 9 | grande roue, photo souvenir |
| 10 | toboggan géant, infirmerie |
| 11 | **la navette** |
| 12 | rivière sauvage |
| 13 | **le grand huit** |
| 16 | **le looping** |

### La courbe des paliers

```js
xpPour(n) = 43 × (n − 1)^2,43
```

L'exposant a été redressé de 2,05 à 2,43, ce qui rend le vingtième palier
**2,2 fois plus cher** qu'avant. La raison est mesurée : avec l'ancienne courbe,
la partie de référence atteignait le niveau maximum au vingtième jour sur
trente-deux, et la seconde moitié de la campagne n'ouvrait plus rien du tout.
Maintenant le Grand Huit se mérite, le Looping arrive tard, et le niveau 20
n'est pas garanti par une partie simplement correcte.

La **navette** est à part : ce n'est pas un manège, c'est un moyen de transport.
Posées par deux, deux gares font passer les visiteurs de l'une à l'autre sans
traverser le parc à pied. Sur un terrain de cette taille, c'est la réponse au
problème que pose la distance.

**Dix services** : buvette, friterie, glacier, barbe à papa, pizzeria,
souvenirs, photo souvenir, toilettes, infirmerie, banc. Un banc n'est pas un
décor ici : c'est un lieu qui se choisit exactement comme une buvette, avec sa
file et son envie. C'est ce qui rend une allée trop longue coûteuse.

**Huit décors** — arbre, parterre, haie, poubelle, lampadaire, fontaine, statue,
bassin. La beauté autour d'une case remonte l'humeur de qui passe ; une poubelle
proche divise par trois ce qui finit par terre ; un lampadaire éclaire pour de
bon en fin de journée.

**Quatre métiers** — le balayeur nettoie autour de lui, le mécanicien répare et
révise, l'animateur fait paraître les files deux fois plus courtes, le jardinier
fait rendre quarante pour cent de plus à tout le décor du parc.

## Deux leviers qui ne se posent pas

Poser un bâtiment était la seule action du jeu. Ces deux-là sont des décisions
de gestion, pas de construction, et elles répondent à deux impasses réelles.

### La publicité

L'affluence ne dépendait que de la réputation, qui met des journées à bouger. Une
campagne s'achète le matin et se voit le lendemain :

| | Prix | Durée | Effet | Niveau |
|---|---|---|---|---|
| 📄 Affiches en ville | 900 € | 2 jours | +22 % d'affluence | 1 |
| 📻 Radio locale | 2 600 € | 3 jours | +38 % | 4 |
| 📰 Pleine page | 5 600 € | 4 jours | +56 % | 8 |
| 📺 Spot à la télé | 13 000 € | 5 jours | +88 % | 12 |

Elle coûte cher exprès, et elle se retourne contre celui qui la lance au mauvais
moment : le monde qu'elle amène s'entasse dans les files d'un parc qui ne peut
pas l'absorber, la satisfaction tombe, et la réputation paie l'addition pendant
que la campagne dure encore. Mesuré : un spot télé fait passer l'attente prévue
de 66 à 124 visiteurs pour la journée du lendemain.

### La révision d'une attraction

Une file trop longue n'avait qu'une réponse — en poser une deuxième — et sur un
terrain où la place manque, ce n'est pas toujours possible. Chaque attraction
accepte **trois révisions**, de plus en plus chères (42 % puis 72 % puis 102 %
du prix d'achat) :

- **+22 % de places par tour**, arrondi à une place au minimum ;
- **+9 % d'attrait**, donc plus d'envie dans la décision du visiteur ;
- **−22 % de pannes**, cumulables avec l'atelier mécanique de la boutique ;
- l'état repart à neuf, et la révision rapporte des points de licence.

Mesuré sur le manège : huit places et 0,55 d'attrait au départ, quatorze places
et 0,70 d'attrait à fond, pour un tiers de pannes en moins.

## Le soir

Le parc ferme, on compte. Recettes ligne par ligne, entretien, salaires,
bénéfice. Puis deux choses qui n'existent que là :

- **Ce qui a manqué** — le classement des reproches réellement formulés. Pas une
  statistique inventée : chaque mécontent a une cause dominante calculée sur sa
  journée à lui (vessie à 90 %, une file subie trop longtemps, une panne, de la
  saleté, un prix trop élevé), et le soir on compte les causes. « IL MANQUE DE
  QUOI BOIRE — 30 personnes en ont parlé en sortant » est la liste des courses
  du lendemain.
- **Ce qu'ils en ont dit** — cinq phrases, tirées de la même cause. Un mécontent
  qui se plaint au hasard n'apprend rien au joueur.

Trois jours avant la fin de l'été, une carte de plus s'ouvre : le loyer, la date,
et combien il manque encore. Le jeu ne perd jamais quelqu'un par surprise.

## La météo

Six ciels, tirés chaque matin dans une urne qui se dégrade avec l'été. Le grand
soleil remplit le parc et vide les buvettes ; la canicule multiplie la soif par
2,6 ; la pluie coupe l'affluence de moitié ; l'orage ferme les attractions à
sensations. L'orage n'arrive jamais avant le sixième jour — deux orages précoces
suffisaient à couler un parc qui n'avait rien fait de mal.

## Le rendu

Vue de dessus, plein soleil, palette saturée — l'exact opposé des trois autres
jeux du dépôt.

Le sol — herbe, mares, berges de sable, rochers, allées avec leurs bordures — ne
change qu'à la pose. Sur cinq mille parcelles, un calque unique tiendrait
soixante mégaoctets et se repeindrait entièrement au moindre bout d'allée : il
est donc **découpé en douze morceaux de vingt-deux cases de côté**, un morceau
n'est repeint que si quelque chose a changé dedans, et seuls les morceaux
visibles sont dessinés.

Deux autres choses ne passaient plus à cette échelle. La **beauté du décor**
était resommée sur tous les massifs de fleurs pour chacun des trois cents
visiteurs à chaque image : elle est maintenant calculée une fois par
modification du tracé, dans un champ. Et le **recalcul des chemins** se
déclenchait à chaque case d'allée posée pendant un glissé : il est espacé d'un
quart de seconde, ce qui ne se voit pas et divise le coût par dix pendant les
travaux.

Les attractions ne sont pas des icônes. Le manège tourne avec ses chevaux, les
tasses tournent sur un plateau qui tourne, les chaises volantes s'écartent quand
la machine prend de la vitesse, la tour de chute se lit à la taille de sa nacelle
et à la longueur de son ombre, le train du Grand Huit court sur une lemniscate
avec trois wagons et une ombre qui grandit dans les montées. Un parc où rien ne
bouge n'est qu'un tableur avec des couleurs.

Les vignettes du catalogue ne sont pas dessinées à part : ce sont les vraies
attractions, peintes en miniature par le même code, dans un canvas de trente
pixels. Ce qu'on voit dans le menu est exactement ce qu'on posera.

Le menu lui-même n'est pas une image : c'est un parc complet — huit attractions,
cinq boutiques, quatre-vingts visiteurs, des files qui s'allongent — qui tourne
derrière le titre.

## Commandes

- **Clic** pose · **glisser** trace une allée · **clic droit** ou `Échap` lâche
  l'outil.
- Sans outil, **glisser** déplace la vue et **clic** ouvre la fiche de ce qu'on
  a sous le curseur.
- **Molette** ou `+` `−` zoome · `Espace` met en pause · `1` `2` `3` règlent la
  vitesse.
- Au doigt : un doigt déplace, deux doigts zooment, appui pose. Portrait et
  paysage.

## Réglages du fichier

```js
const GX=88, GY=60, TUILE=26;                 // le terrain, 5 280 parcelles
const CH=22;                                  // côté d'un morceau de sol
const ETES=4, JOURS=8;                        // la campagne
const LOYERS=[5000,13000,24000,40000];        // ce que la mairie prend
const SECONDES_JOUR=720;                      // une journée à vitesse 1
const VIT_BASE=15;                            // un visiteur, en pixels/seconde
const NIV_MAX=20;                             // la licence d'exploitation
const MONTEE={frisson:.42, faim:.20, soif:.26, vessie:.16, fatigue:.145};
const PRIX_ALLEE=10;
xpPour(n) = 43 × (n−1)^2,43                   // les paliers de licence
RANGS = [0, 2500, 9000, 24000, 55000, 110000] // les rangs de carrière
```

## Comment ça a été vérifié

Un robot gestionnaire joue les quatre étés dans un Chromium sans interface. Il
trace ses allées, lit chaque matin le classement des reproches de la veille et
investit là-dessus, garde de côté de quoi payer le loyer, et ajuste ses prix sur
sa réputation. Il sort une ligne par journée : entrées, demi-tours au portail,
tours vendus, recette, dépenses, caisse, étoiles, satisfaction, et les deux
reproches dominants.

C'est ce relevé qui a mis en évidence, dans l'ordre :

- des **manèges qui tournaient à vide** — les visiteurs marchaient trop lentement
  pour en atteindre plus d'un dans la journée ;
- un **rayon d'action trop court**, qui rendait tout parc étalé injouable ;
- une **réputation bloquée à trois étoiles** du premier au dernier été, faute
  d'échelle correcte ;
- une **saleté ingérable** — un balayeur qui traitait une case à la fois puis
  retraversait le parc ne tenait pas deux cents visiteurs ;
- des **orages précoces** qui coulaient un parc sans faute de jeu ;
- et, tout à la fin, le **piège du billet d'entrée** décrit plus haut : quatre
  journées d'affilée à zéro tour de manège, sans une panne ni une fermeture,
  simplement parce que les visiteurs entraient sans un sou.

La couche méta est vérifiée à part, par une seconde sonde qui joue l'interface
plutôt que le parc : elle nomme le profil, change de portrait, achète une
amélioration, contrôle que les jetons sont débités et le rang enregistré, lance
une partie, vérifie que le pactole de départ s'applique (22 000 → 26 000 €),
ouvre l'onglet des contrats, joue une journée entière, puis **recharge
complètement le navigateur** et reprend la saison. Caisse, bâtiments, employés,
niveau, expérience, cases d'allée, révisions et campagne en cours reviennent
identiques.

Le relevé de la partie de référence, en difficulté normale, trente-deux
journées jouées d'affilée sans une erreur — un robot qui ne touche ni à la
publicité, ni aux révisions, ni à la boutique, pour que la mesure porte sur
l'économie de base :

| | Été 1 | Été 2 | Été 3 | Été 4 |
|---|---|---|---|---|
| Visiteurs le meilleur jour | 277 | 341 | 337 | 424 |
| Tours vendus ce jour-là | 312 | 461 | 548 | 525 |
| Recette du meilleur jour | 10 771 € | 15 997 € | 16 862 € | 21 180 € |
| Attractions en fin d'été | 8 | 16 | 24 | 28 |
| Niveau de licence | 8 | 13 | 16 | **18** |
| Étoiles | 4 | 4 | 4 | 5 |
| Loyer payé | 5 000 € | 13 000 € | 24 000 € | 40 000 € |
| En caisse avant le loyer | 17 928 € | 30 045 € | 49 121 € | **61 588 €** |

**La courbe redressée fait exactement ce qu'on lui demandait.** Le Grand Huit,
qui exige le niveau 13, est posé au **dix-neuvième jour** sur trente-deux ; le
Looping, niveau 16, au **vingt-sixième** ; et la partie se termine au **niveau
18** — le maximum n'est pas atteint. Avec l'ancienne courbe, la même partie
plafonnait au niveau 20 dès le vingtième jour et la seconde moitié de la
campagne n'ouvrait plus rien du tout.

Le nombre de tours suit le nombre d'entrées tout du long — c'est le signe que
la boucle tourne. La recette plafonne autour de vingt mille euros par jour au
lieu de grimper indéfiniment, et le billet d'entrée se stabilise à trente-neuf
euros : c'est la saturation qui fait son travail. Le motif qui revient chaque
été est celui qu'on veut voir dans un jeu de gestion : les canicules remplissent
le parc, la satisfaction tombe avec « j'ai eu soif toute la journée », la
réputation bouge, l'affluence se corrige d'elle-même le lendemain. Le parc se
régule ; c'est au joueur de casser cette limite en doublant ce qui sature.

Le coût du rendu, mesuré à part, avec le pire cas fabriqué à la main sur le
grand terrain — **deux cent soixante-trois bâtiments, cinq cent vingt cases
d'allée, huit cent quatre-vingt-dix-sept visiteurs et neuf cent soixante-dix-
huit tours dans la journée**, en 1280 × 800 :

| Images/s | Pire image | Images > 20 ms |
|---|---|---|
| 60 | 67 ms | 3 |

C'est ce chiffre-là qui justifie le sol en morceaux et le champ de beauté : sans
eux, la même scène passait sous les vingt images par seconde.

Comme pour les autres jeux du dépôt, c'est du rendu **logiciel**, sans carte
graphique : un plancher, pas une mesure.
