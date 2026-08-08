# Grand Huit

`grandhuit.html` — un jeu complet dans un seul fichier, sans dépendance, sans
image ni son téléchargé. Le décor est peint au canvas, l'orgue de foire est
synthétisé note par note.

## L'idée

La mairie loue un pré derrière la nationale. Il y a quatre étés de huit jours
pour en faire un parc d'attractions, et un loyer à payer à la fin de chacun —
un loyer qui triple presque à chaque fois. On trace les allées, on monte les
manèges, on fixe les prix, on embauche, et on regarde.

Le jeu n'a qu'une boucle, et tout le reste sert à la nourrir :

> **un visiteur décide → il repart content ou fâché → sa satisfaction fait la
> réputation → la réputation décide de combien de monde se présente demain.**

## En quoi ce n'est pas les trois autres jeux du dépôt

*Zone Morte*, *Brasier* et *Quinze Nuits* sont trois jeux d'action : un
personnage, une main, une menace. Celui-ci n'a rien de tout ça.

| | Les trois autres | Grand Huit |
|---|---|---|
| Ce qu'on contrôle | un personnage | **rien de vivant** — un curseur et des prix |
| Ce qu'on fait | viser, éteindre, tenir | **construire, tarifer, embaucher** |
| L'adversaire | des morts, un feu | **l'arithmétique** : un loyer qui monte |
| Le temps | continu, subi | **réglable** : pause, ×1, ×2, ×4 |
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

**Huit attractions**, du manège à 1 800 € au Grand Huit à 17 000 €. Chacune a sa
capacité, sa durée de tour, son frisson, sa nausée, sa fiabilité — et son propre
prix, réglable de la gratuité au prix indécent. Les plus grosses demandent de la
réputation avant d'être proposées.

**Six services** : buvette, friterie, glacier, souvenirs, toilettes, banc. Un
banc n'est pas un décor ici : c'est un lieu qui se choisit exactement comme une
buvette, avec sa file et son envie. C'est ce qui rend une allée trop longue
coûteuse.

**Quatre décors** — arbre, parterre, poubelle, fontaine. La beauté autour d'une
case remonte l'humeur de qui passe ; une poubelle proche divise par trois ce qui
finit par terre.

**Trois métiers** — le balayeur nettoie autour de lui, le mécanicien répare et
révise, l'animateur fait paraître les files deux fois plus courtes.

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
change qu'à la pose : il est peint une fois dans un calque au double de la
résolution et redessiné d'un seul appel.

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
const GX=44, GY=30, TUILE=26;                 // le terrain
const ETES=4, JOURS=8;                        // la campagne
const LOYERS=[3800,10000,19000,31000];        // ce que la mairie prend
const SECONDES_JOUR=60;                       // une journée à vitesse 1
const VIT_BASE=64;                            // un visiteur, en pixels/seconde
const MONTEE={frisson:.34, faim:.20, soif:.26, vessie:.16, fatigue:.145};
const PRIX_ALLEE=14;
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

Le relevé de la partie de référence, en difficulté normale, trente-deux
journées jouées d'affilée sans une erreur :

| | Été 1 | Été 2 | Été 3 | Été 4 |
|---|---|---|---|---|
| Visiteurs le meilleur jour | 157 | 215 | 227 | 221 |
| Tours vendus ce jour-là | 142 | 200 | 214 | 209 |
| Recette du meilleur jour | 3 805 € | 6 849 € | 7 760 € | 7 805 € |
| Attractions en fin d'été | 5 | 9 | 12 | 13 |
| Étoiles | 4 | 3 | 3 | 4 |
| Loyer payé | 3 800 € | 10 000 € | 19 000 € | 31 000 € |
| En caisse après le loyer | 3 986 € | 7 147 € | 13 127 € | **14 038 €** |

Le nombre de tours suit le nombre d'entrées tout du long — c'est le signe que
la boucle tourne. Le motif qui revient chaque été est celui qu'on veut voir dans
un jeu de gestion : les jours de grand soleil remplissent le parc, la
satisfaction tombe à 60 % avec « les files sont interminables » et « pas une
buvette, en plein soleil », la réputation baisse d'une étoile, l'affluence se
corrige d'elle-même le lendemain. Le parc se régule ; c'est au joueur de casser
cette limite en doublant ce qui sature.

Le coût du rendu, mesuré à part, avec le pire cas fabriqué à la main —
soixante-quatorze bâtiments, quatre cent seize visiteurs dans la journée,
en 1280 × 800 :

| Images/s | Pire image | Images > 20 ms |
|---|---|---|
| 59 | 33 ms | 1 |

Comme pour les autres jeux du dépôt, c'est du rendu **logiciel**, sans carte
graphique : un plancher, pas une mesure.
