# TENIR

*Est-ce que ça tient ?*

Un jeu de physique. Un seul fichier — `tenir.html` — sans dépendance, sans image
ni son téléchargé : tout le dessin est du canevas procédural, tout le son est
synthétisé au Web Audio.

Ouvrir le fichier dans un navigateur suffit.

---

## Une seule question

Tu relies les deux bords d'un gouffre, tu appuies sur **GO**, et un camion
traverse. C'est tout le jeu.

Les poutres **jaunissent**, puis **orangissent**, puis **rougissent**, puis
**cassent**. Elles cassent presque toujours — et c'est ça qui est bien : un pont
qui s'effondre est plus drôle qu'un pont qui tient, et on le refait tout de
suite.

## Ce qui rend la couleur honnête

Le point technique dont tout dépend. Les poutres sont des distances à maintenir,
corrigées quatorze fois par pas de simulation (Verlet + relaxation de
contraintes). La tentation est de colorer la poutre selon l'erreur qui reste
après ces quatorze passes.

**Ça ne marche pas.** Après quatorze passes le solveur a pratiquement tout
corrigé, et une poutre écrasée affiche la même erreur qu'une poutre au repos.
Mesuré ainsi, un pont chargé à bloc lit *0,3 %* de sa limite.

Ce qu'on mesure à la place, c'est le **travail** qu'il a fallu pour la corriger :
la somme des corrections appliquées pendant le pas. C'est l'impulsion de la
contrainte, donc la force interne, donc exactement ce qu'un ingénieur appelle
l'effort dans la barre. La couleur devient alors une vraie lecture de la
structure : une route nue lit 0,83 et casse, un treillis en bois lit 0,60, le
même en acier lit 0,11.

## Les quatre matériaux

| | | |
|---|---|---|
| **BOIS** | 11 €/m | Pas cher, souple, et il casse tôt. On construit avec, on ne compte pas dessus. |
| **ACIER** | 36 €/m | Trois fois le prix du bois, et il ne plie presque pas. C'est ce qui tient vraiment. |
| **CÂBLE** | 8 €/m | Il tire, il ne pousse **jamais**. Suspends la route, ne la soutiens pas. |
| **ROUTE** | 21 €/m | La seule sur laquelle le camion roule — et la plus lourde. Elle doit être portée. |

Six mètres au maximum par poutre. Le reste s'assemble.

## Les trois règles qu'on oublie

1. **Le triangle ne se déforme pas.** Un carré de poutres s'écrase comme un
   accordéon. Tout pont qui tient est un assemblage de triangles.
2. **Un câble ne pousse pas.** Il ne travaille qu'en traction.
3. **La masse compte autant que la résistance.** Contre-intuitif et central :
   sur une grande portée, ajouter des barres pour renforcer **affaiblit** la
   structure, parce qu'elle finit par se porter elle-même plus qu'elle ne porte
   le camion. Un treillis à deux étages sur trente-quatre mètres est *pire*
   qu'un treillis à un étage — mesuré, pas supposé.

## Les trois marches

Chaque chantier a trois médailles :

- **Traverser.** Le camion atteint le drapeau.
- **Sous le budget serré.** Environ 75 % du budget.
- **Sans une rougeur.** Aucune poutre au-delà de 70 % de sa limite.

La troisième est la vraie. Un pont qui passe de justesse passe une fois ; un pont
dont rien n'a rougi passerait cent camions. Et les deux dernières se disputent :
l'acier donne l'or, le bois donne l'argent, et il faut choisir.

## Trois façons de jouer

- **CHANTIERS** — vingt gouffres, de huit à trente-six mètres. Le suivant s'ouvre
  dès que le précédent est franchi une fois : les médailles sont pour ceux qui
  reviennent, pas pour barrer la route.
- **PONT DU JOUR** — la date fait la graine. Le même gouffre pour tout le monde,
  au mètre près, budget compris.
- **BAC À SABLE** — budget illimité, aucune médaille. Pour voir.

Chaque écran de fin donne un **code de pont** : collé dans « CHARGER UN PONT », il
rejoue exactement la même structure sur le même chantier. C'est le partage du
jeu, et il tient dans un message.

## Commandes

| | |
|---|---|
| glisser | poser une poutre |
| appuyer sur une poutre | l'effacer |
| 1 2 3 4 | changer de matériau |
| Espace | lancer / arrêter |
| Z | annuler · Échap | retour |

Deux gestes, identiques à la souris et au doigt. Le pont se sauvegarde tout seul,
chantier par chantier.

---

## Notes techniques

Un fichier, 109 Ko, zéro requête réseau.

- **Pas de simulation fixe** (1/120 s, quatorze relaxations). Un pas variable
  ferait qu'un pont tiendrait sur une machine et pas sur une autre — inacceptable
  dans un jeu où l'on compare des scores. Trois essais du même pont donnent trois
  fois le même verdict, c'est vérifié.
- **Les roues encaissent et rendent.** Une roue qui appuie sur le tablier reçoit
  une poussée, et le tablier reçoit l'opposée, répartie sur les deux nœuds au
  prorata du point de contact. Sans ça le camion flotterait au-dessus d'un pont
  qui ne saurait pas qu'il le porte.
- **Ancrage exact.** « Ce nœud est-il sur la roche ? » ne se décide pas en
  regardant s'il y a de la pierre dessous : un point tombant pile sur l'arête
  d'une falaise donne une réponse au hasard selon de quel côté l'algorithme du
  polygone se réveille. On demande l'inverse — ce point est-il posé sur une arête
  du terrain ? — ce qui est exact, et rend au passage les parois verticales
  accrochables.
- **Les vues ne sont pas écrites à la main.** Chaque chantier déduit son cadrage
  de son terrain : une bande utile autour de la chaussée, et la chute continue
  hors cadre. Cadrer un gouffre de trente mètres de fond en entier réduisait la
  zone de construction à un dixième de l'écran.
- **Le contraste dit où est le sol.** La roche est franchement plus claire que le
  vide. Avec un ciel qui s'éclaircissait vers le bas, le gouffre passait pour de
  la pierre et la pierre pour du gouffre.

### Vérifications automatisées

| | |
|---|---|
| `bot.js` | Un constructeur automatique pose un treillis générique — une maille, une profondeur, un matériau — sur chacun des vingt chantiers, en essayant les variantes à un et deux étages, avec et sans appui intermédiaire, plus une variante haubanée. **20/20 franchis.** C'est la preuve que chaque chantier est faisable, et l'écart entre son coût et le budget dit si celui-ci est serré. |
| `audit.js` | 52 contrôles : règles de pose (longueur, budget, roche, zones interdites, doublons), annuler/vider, sauvegarde du pont à travers un vrai rechargement, six sauvegardes abîmées, aller-retour des codes de partage, dix codes hostiles, logique des médailles, déterminisme du pont du jour, invariants de la simulation, reproductibilité. |
| `clic.js` | 198 contrôles sur trois formats d'écran (bureau, téléphone debout, téléphone couché) : chaque bouton, chaque écran, chaque raccourci, la pose au glissé et l'effacement à l'appui, le verrouillage des chantiers, plus la détection de tout débordement horizontal et de tout bouton mort. |

Zéro erreur console sur l'ensemble.
