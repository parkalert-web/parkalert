# Brasier

`brasier.html` — un jeu complet dans un seul fichier, sans dépendance, sans
image ni son téléchargé. Tout le décor est engendré, tout le son est synthétisé.

## L'idée

Dans la plupart des jeux, l'adversaire est une créature qu'on abat. Ici c'est un
**système**. Le feu suit le vent, court quatre fois plus vite en montée, meurt
sur une vigne et saute par-dessus une coupure quand il souffle assez fort. On ne
le tue pas — on l'encercle. Tout le reste du jeu découle de cette phrase.

## Le cœur : la propagation

Le massif est une grille de parcelles de cinq mètres de côté. Chacune porte un
combustible, une humidité, une altitude et un état. Une parcelle en flammes
chauffe ses huit voisines ; quand la chaleur accumulée dépasse le seuil
d'inflammation, ça part. Ce qu'elle transmet dépend de quatre choses — et ce
sont exactement les quatre leviers du joueur :

| Facteur | Effet | Ce que le joueur peut en faire |
|---|---|---|
| **Vent** | La chaleur est projetée sous le vent, elle peine à remonter au vent | Choisir de quel côté tenir la ligne |
| **Pente** | Un feu qui monte se chauffe lui-même : jusqu'à ×3 en montée | Ne jamais se laisser prendre au-dessus du front |
| **Humidité** | Une parcelle détrempée ne prend pas | La lance, les largages |
| **Combustible** | Pas de matière, pas de feu | La pelle, le contre-feu |

Trois comportements réels sont modélisés parce qu'ils changent la façon de
jouer :

- **Les sautes de feu.** Au-delà d'un certain vent, le front arrache des
  brandons et les jette jusqu'à cent mètres devant lui. C'est ce qui rend une
  coupure insuffisante — et ce qui surprend le plus quand on découvre le sujet.
- **L'anneau.** Les flammes ne sont hautes qu'au *bord* du front ; l'intérieur
  n'est déjà plus que braises. L'incendie a donc la forme d'un anneau qui
  s'élargit, et c'est ce que le rendu montre.
- **La rosée.** La nuit, l'air se recharge en humidité et le feu mollit — mais
  les avions sont cloués au sol.

La propagation est calibrée pour qu'un front de tête sous vent fort avance
autour de 8 km/h, l'ordre de grandeur d'un vrai feu de pinède.

## Ce qu'on fait sur le terrain

Quatre outils, et aucun ne suffit seul.

- **La lance** mouille et éteint, mais la cuve fait cent litres. On va la
  remplir au camion ou au plan d'eau. Elle sert surtout à *protéger* ce qui n'a
  pas encore pris.
- **La coupure** retire le combustible sous ses pieds. Lente, silencieuse,
  définitive. Une bande nette devant le feu vaut mieux que dix minutes de lance.
- **Le contre-feu** brûle soi-même ce que le front viendra chercher. Il part
  avec le même vent que l'autre : c'est le geste qui peut tout sauver ou tout
  perdre.
- **Le largage** pose une ligne de retardant en travers du vent. Deux à quatre
  par intervention, aucun de nuit.

On surveille trois jauges : la tenue, l'eau, le souffle — et une quatrième,
la chaleur, qui monte bien avant de brûler. Il faut aussi sortir les habitants :
ils fuient d'eux-mêmes quand ça approche, mais ils ne connaissent pas le chemin
du camion.

## L'équipe

Seul, on ne tient pas une ligne : on court d'un flanc à l'autre pendant que le
feu passe derrière. Commander trois hommes change la nature du jeu — on cesse
d'éteindre pour se mettre à **décider où l'on tient**.

Un ordre tient en deux gestes : choisir qui (`Q`), désigner où (`E`). Le reste,
ils le font seuls — y compris reculer quand ça devient intenable, et repartir
faire le plein quand la cuve est vide. `F` rappelle tout le monde.

| Équipier | Ce qu'il fait tout seul |
|---|---|
| **Porte-lance** | Tient la ligne à la lance au point où tu le postes ; va remplir sa cuve et revient |
| **Piocheur** | Ouvre une coupure **en travers du vent** autour de son point, parcelle après parcelle |
| **Guetteur** | Surveille les arrières et signale les départs secondaires sur ton plan |
| **Chef d'agrès** | Un largage de plus, et il prévient quand un homme est en danger |

Personne ne meurt : un homme trop exposé est **évacué**, et il manquera à la
sortie suivante. Ils prennent de l'expérience à chaque intervention.

## La campagne

Un été, douze journées, de la mi-juin à fin août. La **sécheresse monte** de
journée en journée : l'humidité baisse, le vent forcit, et la colline qu'on
tenait sans peine en juin devient intenable en août.

L'été ne s'arrête pas : la journée avance qu'on l'ait gagnée ou perdue. On peut
rejouer n'importe quelle journée déjà faite pour améliorer ses étoiles. Boucler
un été ouvre le suivant, plus sec encore.

Le mode **secteur libre** reste là pour rejouer ce qu'on veut.

## Les douze secteurs

Chacun a son relief, sa végétation et son vice.

| Secteur | Ce qui le caractérise |
|---|---|
| **Les Restanques** | Terrasses et vignes : des coupures naturelles offertes |
| **L'Oliveraie** | Peu de combustible, mais tout se tient par l'herbe entre les rangs |
| **La Pinède** | Le pin d'Alep est de la résine sur pied |
| **Le Vallon** | Forte pente : le feu monte quatre fois plus vite |
| **Les Calanques** | La roche fait les coupures — reste à trouver lesquelles se rejoignent |
| **La Garrigue** | Front très large, presque aucune coupure naturelle |
| **Le Mistral** | Vent violent et instable, sautes de feu permanentes |
| **Le Hameau** | Vingt maisons, une route, des gens partout |
| **Les Gorges** | Pente extrême : le feu monte plus vite que tu ne cours |
| **La Nuit** | Aucun moyen aérien, aucune visibilité — mais l'air est humide |
| **La Réserve** | Cent ans de chênes-lièges, aucun bâti, aucune deuxième chance |
| **La Crête** | Deux fronts, deux versants, un seul homme |

## La reprise

Un feu qui s'éteint tout seul en deux minutes n'est pas une intervention. Sous
les cendres il reste toujours de quoi repartir : si le front meurt trop tôt sans
avoir rien pris, **un foyer reprend sous le vent**. C'est la hantise des équipes
de nuit, et ici c'est ce qui garantit qu'il y a une partie quel que soit le
tirage du terrain.

## Progression

- **Grade** de SAPEUR à CAPITAINE : il monte à chaque intervention, même ratée.
  C'est après une mort rapide qu'on ferme un jeu ; il fallait que cette
  sortie-là compte quand même.
- **Points d'intervention** : hectares préservés, personnes évacuées, bâti
  sauvé. Ils ouvrent les secteurs et achètent le matériel.
- **Huit matériels** : cuve, lance, outils, tenue, appareil respiratoire, radio,
  rangers, lecture du terrain.
- **Étoiles** par secteur : une pour la maîtrise du feu, une pour moins d'un
  quart du massif brûlé, une pour n'avoir rien perdu du tout.
- **Objectifs du jour** et objectif de session, avec compte à rebours.
- L'écran de fin dit toujours **de combien on a manqué la marche suivante**.

## Réglages

Une **allure posée** ralentit la propagation d'un quart, adoucit la chaleur et
raccourcit les sautes de feu — pour apprendre, ou pour jouer tranquille.

## Technique

- Un fichier, aucune dépendance, aucun réseau.
- Le sol est peint une fois sur une toile hors écran en double résolution ;
  seules les parcelles qui changent sont repeintes. Vingt mille parcelles
  tiennent sans y penser.
- La simulation ne parcourt que les parcelles *actives* (en feu ou en train de
  chauffer), jamais la grille entière.
- La lueur du feu est composée en basse résolution avec une **exposition
  automatique** : additionner mille six cents halos donnait un écran blanc,
  alors chaque foyer pèse d'autant moins que le front est large — c'est ce que
  fait l'œil devant un incendie.
- La nuit, la couche d'obscurité est tenue au tiers de la résolution et percée
  avec une pastille pré-calculée : refabriquer deux dégradés radiaux à chaque
  image coûtait à lui seul un tiers du temps d'affichage.
- Clavier et tactile, portrait et paysage.

### Sur les mesures de vitesse

Les chiffres relevés ici viennent d'un Chromium **sans accélération
matérielle** : tout le compositing y est fait par le processeur, et les mesures
varient beaucoup d'une exécution à l'autre selon la charge de la machine. Dans
ces conditions on relève 33 à 53 images par seconde sur les plus grandes cartes
et 39 de nuit. Sur un vrai navigateur avec GPU, le canevas 2D est accéléré et
ces chiffres n'ont rien à voir — il faut les lire comme un plancher, pas comme
une mesure de terrain.
