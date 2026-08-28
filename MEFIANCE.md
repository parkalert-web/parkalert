# MÉFIANCE

*Tout ce que tu vois n'est pas là.*

Cent cinquante petits labyrinthes. Un seul fichier — `mefiance.html` — sans
dépendance, sans image ni son téléchargé : tout le dessin est du canevas
procédural, tout le son est synthétisé au Web Audio.

Ouvrir le fichier dans un navigateur suffit.

---

## Le problème du genre, et la réponse

Les jeux à pièges invisibles ont un défaut connu : mourir sur quelque chose
qu'on ne pouvait pas voir n'apprend rien et n'amuse personne. Deux règles y
répondent, et tout le jeu est bâti dessus.

**1. Un piège découvert reste marqué. Pour toujours.** Sur ce niveau, même si
tu fermes le jeu et que tu reviens dans un mois. Chaque mort achète une
information définitive : on ne refait jamais deux fois la même erreur par
ignorance.

**2. La mort ne coûte que deux secondes.** Pas d'écran de défaite, pas de vies,
pas de retour en arrière. On repart du départ immédiatement, en sachant une
chose de plus.

Ce n'est donc pas un jeu d'adresse, c'est un jeu de **cartographie**. On paie
en morts ce qu'on gagne en connaissance du terrain. Le compteur de morts n'est
pas une punition affichée : c'est un compteur de progrès.

## Les dix familles

Un chapitre en ajoute une et ne la retire jamais. Cinq sont invisibles.

| | | |
|---|---|---|
| **PIQUE** | ch. 1 | *Invisible.* On marche dessus, on meurt. |
| **FAUX MUR** | ch. 2 | *Invisible, et bénéfique.* Se dessine comme un mur, n'en est pas un. Pousse contre les murs. |
| **DALLE FENDUE** | ch. 3 | On la traverse une fois ; en la quittant, elle tombe. |
| **FLÉCHETTE** | ch. 4 | *Invisible.* Un mur percé qui tire une fois sur trois. Le couloir n'est pas condamné, il est cadencé. |
| **FAUSSE SORTIE** | ch. 5 | *Invisible.* Verte, carrée, engageante. Il n'y en a qu'une vraie. |
| **GLACE** | ch. 6 | On glisse jusqu'à ce que quelque chose arrête. |
| **SCIE** | ch. 7 | Elle fait sa ronde — **et ne bouge que quand tu bouges**. |
| **CLEF ET PORTE** | ch. 8 | La clef est toujours du mauvais côté. |
| **MINE** | ch. 9 | *Invisible.* Trois pas après l'avoir amorcée, elle éclate. |
| **PORTAIL** | ch. 10 | Deux anneaux reliés, et pas toujours là où on croyait. |

## Les trois étoiles

- **Sortir** — la première fois, en tâtonnant autant qu'il faut.
- **Au plus court** — sous 1,4 fois le meilleur chemin possible.
- **Sans mourir** — d'un trait, du départ à la sortie.

Les deux dernières se décrochent en **revenant**, une fois la carte faite.
C'est fait exprès : la première visite sert à apprendre le terrain, la seconde
à le maîtriser. 450 étoiles en tout, six rangs, dix-huit succès.

## Les niveaux ne sont pas dessinés à la main

Cent cinquante labyrinthes ne s'écrivent pas un par un. **Le numéro du niveau
est la graine** : le 87 est le même labyrinthe, avec les mêmes pièges aux mêmes
cases, pour tout le monde et pour toujours. On peut donc en parler avec
quelqu'un d'autre.

Le danger de la génération, c'est le niveau impossible — et dans un jeu où l'on
meurt sans arrêt, le joueur ne saurait *jamais* si le niveau est infaisable ou
s'il est simplement mauvais. **Chaque niveau est donc démontré franchissable par
un parcours en largeur avant d'être servi**, en connaissant tous les pièges. Et
ce parcours appelle exactement la même fonction de déplacement que le jeu : il
n'y a pas deux règles du mouvement, il n'y en a qu'une.

Quatre exigences, pas une seule :

1. **il se finit** (prouvé) ;
2. **il n'est pas trop court** — un faux mur ou un portail peut ouvrir un
   raccourci si franc que le labyrinthe disparaît ; en dessous des deux tiers du
   chemin d'origine, on jette et on recommence ;
3. **il n'est pas trop long** — au-delà de soixante pas, ce n'est pas plus
   difficile, c'est plus fatigant ;
4. **il cache au moins deux choses**.

Si soixante-dix sous-graines n'y suffisent pas, les exigences de confort se
relâchent — jamais celle de la preuve.

## Commandes

| | |
|---|---|
| ↑ ↓ ← → · ZQSD · WASD | avancer d'une case |
| R | repartir du départ |
| Échap | retour |

Au doigt : glisse dans une direction (un glissement continu enchaîne les pas),
touche une case voisine, ou sers-toi de la croix en bas à gauche.

---

## Notes techniques

Un fichier, 97 Ko, zéro requête réseau.

- **Une seule fonction de déplacement**, `simulerPas`, appelée par le jeu *et*
  par le solveur. Une divergence entre les deux rendrait la preuve fausse sans
  que rien ne le signale.
- **Le monde ne bouge que quand le joueur bouge.** Scies et fléchettes ont des
  cycles de 12 et 3 pas, tous diviseurs l'un de l'autre : le solveur tient donc
  le temps dans un seul petit entier, et son espace d'états reste minuscule
  (case × clef × phase).
- **Les dalles fendues comptent comme des trous pendant la preuve.**
  Volontairement pessimiste, et c'est la seule façon d'être sûr : rien n'empêche
  un joueur d'en faire tomber trois puis de se retrouver enfermé, sans bouton
  pour annuler. En exigeant que le niveau se finisse *sans aucune dalle*, on
  garantit qu'aucune suite de gestes ne peut condamner la partie — et les dalles
  deviennent ce qu'elles doivent être : un raccourci qu'on prend à ses risques.
  Sur six niveaux, elles battent l'optimum prouvé.
- **Le contraste dit où sont les murs.** Le mur est un bloc clair biseauté, le
  sol est presque noir. Avec deux gris-bleu voisins, le labyrinthe était
  littéralement invisible — c'était le pire défaut du jeu.
- **Les pièges démasqués sont tracés à la craie**, en rouge sur fond sombre :
  c'est le joueur qui les a marqués, pas le jeu qui les affiche.
- **Les scies annoncent leur prochaine case** par un trait pointillé. Sans ça
  elles seraient un piège caché de plus, alors qu'elles sont censées être le
  seul danger parfaitement visible.

### Vérifications automatisées

| | |
|---|---|
| `gen-test.js` | Fabrique les 150 niveaux hors du navigateur et re-prouve chacun après coup. Pas optimaux 8 à 60 (médiane 22), 2 à 23 pièges cachés par niveau, aucun filet de secours utilisé, 2 secondes pour l'ensemble. |
| `bot.js` | **Joue les 150 niveaux jusqu'à la sortie avec le vrai code du jeu** — chaque pas passe par `bouger()`. 150/150. C'est ce test, et pas la preuve du générateur, qui garantit que le jeu et le solveur disent la même chose. |
| `audit.js` | 33 contrôles : déterminisme des niveaux, mémoire des pièges à travers un vrai rechargement, « oublier ce niveau », seuils des trois étoiles, déverrouillage, six sauvegardes abîmées, et 12 000 pas au hasard sur 30 niveaux sans casser un invariant. |
| `clic.js` | 159 contrôles sur trois formats d'écran : chaque bouton, chaque écran, la croix directionnelle, le clavier, le verrouillage des niveaux et des chapitres, le bilan de sortie, plus la détection de tout débordement et de tout bouton mort. |

Zéro erreur console sur l'ensemble.
