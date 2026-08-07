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

## Les huit secteurs

Chacun a son relief, sa végétation et son vice.

| Secteur | Ce qui le caractérise |
|---|---|
| **Les Restanques** | Terrasses et vignes : des coupures naturelles offertes |
| **La Pinède** | Le pin d'Alep est de la résine sur pied |
| **Le Vallon** | Forte pente : le feu monte quatre fois plus vite |
| **Le Mistral** | Vent violent et instable, sautes de feu permanentes |
| **La Garrigue** | Front très large, presque aucune coupure naturelle |
| **Le Hameau** | Vingt maisons, une route, des gens partout |
| **La Nuit** | Aucun moyen aérien, aucune visibilité — mais l'air est humide |
| **La Crête** | Deux fronts, deux versants, un seul homme |

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
- 60 images par seconde sur les plus grandes cartes, 51 de nuit (passe
  d'éclairage supplémentaire).
- Clavier et tactile, portrait et paysage.
