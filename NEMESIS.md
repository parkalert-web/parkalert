# NÉMÉSIS

*Ton pire ennemi, c'est toi d'il y a dix secondes.*

Un jeu d'arcade. Un seul fichier — `nemesis.html` — sans dépendance, sans image
ni son téléchargé : tout le dessin est du canevas procédural, tout le son est
synthétisé au Web Audio.

Ouvrir le fichier dans un navigateur suffit.

---

## L'idée

Une arène. Des fragments à ramasser. Vingt-deux secondes.

Sauf que **tout ce que tu fais est enregistré**. À la vague suivante, ton
parcours précédent rejoue à l'identique sous la forme d'un fantôme, et le
toucher te tue. Une vague de plus, un fantôme de plus. À la neuvième, il y a
neuf toi dans l'arène.

D'où la seule règle qui compte :

> **Le meilleur chemin ne sert qu'une fois.** Celui que tu viens de prendre sera
> occupé par toi-même la prochaine fois.

On ne joue donc pas contre un adversaire qu'on découvre, mais contre un
adversaire qu'on a soi-même écrit — et qu'on connaît par cœur. Ce qui rend
chaque mort strictement impardonnable.

## Ce qui n'est pas un piège

Un fantôme est **parfaitement prévisible**. Le jeu le montre en permanence :

- **sa trace** derrière lui — d'où il vient ;
- **son pointillé** devant lui, une demi-seconde à l'avance — où il va ;
- **son numéro de vague**, pour savoir lequel de soi on esquive ;
- **sa couleur**, une par vague, du rouge au rose.

Se faire prendre est toujours une faute, jamais une surprise. C'est toute la
différence entre un jeu exigeant et un jeu injuste.

## Le vrai levier

Un fantôme ne vit que **le temps qu'a duré la vague où on l'a enregistré**.

Boucler une vague en huit secondes fabrique un fantôme de huit secondes ;
traîner vingt secondes en fabrique un qui collera vingt secondes, à chaque
vague, jusqu'à ce qu'il sorte du plafond de neuf.

Aller vite ne rapporte donc pas que des points : **ça vide les vagues
suivantes**. C'est la seule prise durable sur la difficulté, et elle est
entièrement entre les mains du joueur.

## La ruée

Trois fois la vitesse pendant deux dixièmes de seconde, et **on traverse les
fantômes** le temps de la ruée. Deux secondes et demie de recharge, affichée en
anneau autour de soi — jamais besoin de regarder ailleurs qu'à l'endroit où l'on
va mourir.

C'est le seul secours, et il est court.

## Deux modes, et rien à débloquer

- **COURSE LIBRE** — une arène tirée au sort.
- **ARÈNE DU JOUR** — la date fait la graine : même arène, mêmes obstacles,
  mêmes fragments dans le même ordre, pour tout le monde.

Six rangs, dix-huit succès, un résumé partageable. **Pas de boutique, pas
d'amélioration** : une course neuve part avec exactement la même vitesse et la
même ruée que la centième. Dans un jeu où l'adversaire est une copie de soi,
donner un avantage au joueur reviendrait à le donner aussi aux fantômes.

## Commandes

| | |
|---|---|
| ↑ ↓ ← → · ZQSD · WASD | diriger |
| Espace | la ruée |
| Échap | quitter |

À la souris ou au doigt : **maintiens l'appui**, tu vas vers le point que tu
désignes. La ruée a son bouton en bas à gauche.

---

## Notes techniques

Un fichier, 68 Ko, zéro requête réseau.

- **Le pas de simulation est fixe** (1/60 s) et l'accumulateur est borné. Sur
  une machine lente, le jeu ralentit plutôt que de sauter des pas : sauter un
  pas ferait dériver le rejeu des fantômes, et un fantôme qui ne repasse pas où
  l'on est passé rendrait le jeu entier faux.
- **L'enregistrement** tient dans un `Float32Array` de deux nombres par pas.
  Une vague de vingt-deux secondes fait 1 326 positions, soit 10 Ko ; neuf
  fantômes tiennent dans moins de cent kilo-octets.
- **Mesuré, pas supposé** : l'écart entre un fantôme et le trajet qu'il rejoue
  est de **0,0000046 unité d'arène** — la précision du stockage en simple
  précision. Le rejeu est exact.
- **Neuf fantômes au plafond.** Au-delà, l'arène n'est plus un espace, c'est un
  mur : le jeu cesserait d'être jouable au lieu de devenir difficile. Le plus
  ancien s'efface — le plus vieux souvenir est celui qui pèse le moins.
- **Le temps est dessiné sur les bords de l'arène**, pas écrit en chiffres : on
  n'a pas une demi-seconde à donner à un compteur quand neuf fantômes
  convergent.
- **Le son porte deux informations** : la hauteur du bourdon dit combien de
  fragments restent, l'ouverture de son filtre dit combien de temps il reste.
  Aucun coup d'œil à donner.

### Vérifications automatisées

| | |
|---|---|
| `audit.js` | 23 contrôles, dont **la fidélité du rejeu mesurée au millionième d'unité**, la propriété « vague courte → fantôme court » vérifiée sur deux vagues témoins, le plafond de neuf, le déterminisme de l'arène du jour jusqu'à la vague 5, les records comparés à ce qui existait avant, six sauvegardes abîmées, et huit courses complètes sans rompre un invariant. |
| `bot.js` | Douze courses jouées par un pilote qui vise le fragment le plus proche, s'écarte des fantômes *et de là où ils vont*, se rue quand il est acculé. Médiane **vague 10**, maximum 19. Aucune mort au chronomètre : ce sont bien les fantômes qui arrêtent, jamais la montre. |
| `clic.js` | 135 contrôles sur trois formats d'écran : chaque bouton, chaque écran, le clavier, la souris qui attire, la ruée et sa recharge, le bilan de fin, plus la détection de tout débordement et de tout bouton mort. |

Zéro erreur console sur l'ensemble.
