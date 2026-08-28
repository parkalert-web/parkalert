# CINÉMA TYCOON

*Dix semaines pour sauver une salle de quartier — et, enfin, le droit de s'asseoir dedans.*

Un jeu de gestion en un seul fichier — `cinema.html` — sans dépendance, sans
image ni son téléchargé : tout le dessin est du canevas procédural, tout le son
est synthétisé au Web Audio.

---

## Ce qui vient d'être ajouté

### On peut enfin regarder les films

On dirigeait un cinéma sans jamais voir un film : c'était le grand absent. Depuis
la fiche d'une salle — **« S'ASSEOIR ET REGARDER … »** — ou depuis n'importe
quelle carte du catalogue, on entre dans la salle : rideaux de velours, rangs de
fauteuils, faisceau du projecteur avec sa poussière, grain de pellicule, rayures,
et la marque de changement de bobine toutes les vingt secondes.

Le nombre de silhouettes dans les fauteuils est le **vrai** nombre de spectateurs
présents dans cette salle à cet instant.

### Onze bobines, une par genre

Sans vidéo, un film joue une petite bobine **dessinée à la volée**, différente
pour chacun des onze genres. Aucune n'essaie de raconter quoi que ce soit : elles
essaient d'être reconnaissables en une seconde.

| | |
|---|---|
| **Action** | Une ville qui brûle, deux explosions décalées, un hélicoptère. |
| **Comédie** | Deux bonshommes qui rebondissent, des confettis, une peau de banane. |
| **Animation** | Collines, soleil à rayons, une bestiole qui saute, des papillons. |
| **Horreur** | Un couloir, une porte qui s'entrouvre, une silhouette qui approche, des scintillements. |
| **Science-fiction** | Saut en vitesse, planète à anneau, vaisseau et traînée de réacteur. |
| **Drame** | La pluie sur une vitre, une croisée, quelqu'un de dos qui ne bouge pas. |
| **Thriller** | Un couloir de portes qui fuit, un gyrophare, une silhouette qui court. |
| **Romance** | Un coucher de soleil, deux silhouettes qui se rejoignent, des pétales. |
| **Documentaire** | Savane en travelling lent, girafe, éléphant, oiseaux. |
| **Reprise** | Noir et blanc, chapeau et canne, rayures, et un iris qui se ferme. |
| **Événement** | Projecteurs qui balaient, quelqu'un au micro, une foule bras levés. |

La graine de chaque bobine est l'identifiant du film : **le même film compose
toujours la même ville, la même savane, le même ciel étoilé.**

### On peut projeter sa propre vidéo

En produisant un film maison, on peut lui **attacher un vrai fichier vidéo**. Le
film joue alors CETTE vidéo, peinte sur l'écran de la salle avec le même grain et
le même halo que les bobines dessinées — proportions respectées, bandes noires
comme au cinéma.

Le fichier **ne quitte jamais l'appareil** : il n'est pas téléversé, il est rangé
dans la base locale `IndexedDB` du navigateur et relu de là. Il survit au
rechargement de la page. La durée du film s'aligne automatiquement sur celle de
la vidéo — une séance qui dure autre chose que le film serait un mensonge dans la
grille.

### Les horaires, enfin lisibles

C'était incompréhensible. Trois choses ont changé :

- **Une frise de la journée**, à l'échelle, de l'ouverture à minuit : les films
  en couleur, les vingt-cinq minutes de battement en hachures, les trous en
  gris, et un trait rouge à l'heure qu'il est. Elle répond d'un coup d'œil à
  « pourquoi mon film commence à 15 h 47 ».
- **Chaque séance affiche son début ET sa fin**, sa durée, et le battement qui
  suit. Avant, seule l'heure de début s'affichait, ce qui n'apprenait rien.
- **Un verdict sur l'heure.** Hors de sa fenêtre, un genre perd **45 % de son
  public**. C'était vrai depuis toujours, mais écrit nulle part : un badge vert
  ou rouge le dit maintenant, sur la grille comme au moment de choisir un film —
  où l'on voit aussi à quelle heure il passerait, et s'il tient avant minuit.

Un créneau laissé vide dit désormais ce qu'il coûte (1 h 45 de salle éteinte) et
ce qu'il permet (repousser un film à son heure). Un film trop long pour la fin de
journée est **refusé à voix haute** au lieu de disparaître de la grille.

### Les packs

La boutique vend les améliorations à l'unité, au prix fort, et on choisit
exactement ce qu'on veut. Les **packs** font l'inverse : moins cher au rang, mais
c'est le hasard qui choisit.

| | | |
|---|---|---|
| **POCHETTE** | 60 jetons | 3 cartes, au moins une rare |
| **BOÎTE** | 130 jetons | 7 cartes, au moins une rare |
| **COFFRET** | 260 jetons | 15 cartes, au moins trois rares et un éclat |

Trois raretés : **commune** (1 rang), **rare** (1 rang dans une amélioration
chère), **éclat** (2 rangs d'un coup). Les cartes se retournent une par une, avec
un reflet sur celles qui valent le coup — ou toutes d'un coup pour qui n'a pas la
patience.

C'est un échange, pas un piège :

- **la boutique à l'unité reste ouverte et complète** — rien n'est enfermé
  derrière un tirage ;
- **un pack ne peut jamais donner un rang qu'on possède déjà** ; s'il ne reste
  plus rien à donner, il rend des jetons ;
- **les jetons ne s'achètent qu'en jouant.** Il n'y a aucun achat en argent réel
  dans ce jeu, et les mentions légales le disent en toutes lettres.

### Un code de sauvegarde

Tout ce que le jeu retient vit dans le navigateur : changer de téléphone, ou
vider ses données, et tout est perdu. Le menu propose maintenant un **code** —
environ 900 caractères — qui porte le nom, l'avatar, les jetons, l'expérience,
les succès, les améliorations, les packs ouverts **et la partie en cours**,
jusqu'au titre des films maison.

Il est compressé (`deflate-raw`) et porte une somme de contrôle : **un code
abîmé est refusé, jamais rafistolé** — une carrière à moitié restaurée fait des
dégâts qu'on met des heures à comprendre.

Il n'emporte pas les vidéos importées, et le dit : un fichier vidéo pèse mille
fois ce qu'un code peut porter.

### Le temps passe pendant qu'on regarde

Première version : la projection mettait le cinéma en pause. C'était faux, et la
preuve était à l'écran — **la barre de progression de la séance restait figée**.
On s'assoit dans son cinéma, on n'en sort pas : l'horloge tourne, la séance
avance, la salle se remplit et se vide, et l'en-tête annonce l'heure qu'il est et
ce que fait la salle. Quand la séance se termine, **la suivante s'enchaîne toute
seule** ; et si la journée se termine pendant qu'on regarde, la salle se referme
sur le bilan du soir.

### Agrandir le local, sans limite

Les agréments agrandissent le bail cinq fois, puis plus rien : on finissait par
n'avoir plus un mètre libre alors qu'on avait de quoi payer. On peut désormais
**acheter des mètres** — +4 de large et +3 de long à chaque fois, autant de fois
qu'on veut. Le prix part de 90 000 € et **monte de 60 % à chaque agrandissement** :
il n'y a pas de limite, mais il y a un moment où ça ne vaut plus le coup, ce qui
est une meilleure limite qu'un mur.

La grille du jeu n'était pas prévue pour ça : elle **grandit maintenant avec le
local**, en emportant tout ce qu'elle contenait. Les bâtis ne bougent pas d'un
pouce par rapport aux murs, l'index de chaque case retrouve le bon bâti, et le
tour du local reste étanche.

Un agrandissement ne se fait que **rideau baissé**. Ce n'est pas une pudeur de
décor : pendant la séance le hall est plein de gens qui suivent un chemin calculé
sur l'ancien plan, et les décaler proprement est impossible.

### Gagner, puis continuer si on veut

Atteindre le **douzième agrément**, c'est avoir gagné : la salle n'est plus en
sursis. Un écran le dit, et laisse le choix :

- **s'arrêter là** referme la partie sur la victoire, avec les points de carrière
  et les jetons ;
- **continuer** ouvre la **partie libre** : la dixième semaine n'arrête plus
  rien, le loyer continue de tomber chaque dimanche, et on pousse les murs aussi
  loin que la caisse le permet. Un bouton « s'arrêter là » reste sur le bilan du
  soir : rien n'oblige à jouer jusqu'à la faillite pour encaisser sa victoire.

Forcer la fin aurait été le plus simple. Mais quelqu'un qui vient de rendre son
cinéma imbattable n'a pas envie qu'on lui retire le clavier.

---

## Publicité et données

Le site est prévu pour être éligible au programme Google AdSense.

- **Domaine** : `https://cinetycoon.netlify.app/`. Il n'apparaît qu'à **deux
  endroits**, côte à côte en haut du fichier (`link rel="canonical"` et
  `og:url`), sous un commentaire qui le signale.
- **Consent Mode v2** : tous les signaux publicitaires sur `denied` par défaut,
  `ads_data_redaction` actif, avant tout script publicitaire.
- **CMP certifié IAB TCF v2.2** (Funding Choices) chargé en premier ; le script
  AdSense n'est chargé **qu'après** le verdict, avec un filet de 2,5 s pour les
  régions hors zone TCF.
- **Annonces automatiques uniquement** : aucun bloc `<ins>` dans la page.
- La barre du haut, la barre de construction, le bandeau de préparation, le
  panneau latéral, la salle de projection et l'ouverture des packs portent
  `adsbygoogle-noablate` : sans ça, une annonce d'ancrage viendrait se poser sur
  les commandes et chaque geste du joueur deviendrait un clic publicitaire
  involontaire — ce que Google compte comme du trafic invalide.
- **Mentions légales et confidentialité** accessibles depuis le menu : éditeur,
  hébergeur, propriété, responsabilité, ce que le jeu enregistre, où vont les
  vidéos importées, ce que fait la publicité, et un bouton pour revenir sur son
  consentement.
- `ads.txt` : contenu identique pour tous les sites du compte, à servir à la
  racine de **chaque** domaine séparément.

---

## Vérifications automatisées

| | |
|---|---|
| `video.js` | Le trajet complet d'une vidéo importée : un vrai fichier est **fabriqué dans le navigateur** (MediaRecorder), passé par le code d'import du jeu, la page est **rechargée**, et on relit les pixels au centre de l'écran pour prouver que ce sont bien ceux de la vidéo et pas ceux de la bobine dessinée. Retirer la vidéo l'efface vraiment de la base. **12/12.** |
| `meta.js` | Les packs sur 2 800 cartes tirées : raretés respectées, garanties toujours tenues, jamais un rang au-delà du maximum, jetons rendus quand tout est acquis. Le code de sauvegarde : aller-retour complet, et **six codes abîmés tous refusés sans abîmer la carrière**. **21/21.** |
| `pub.js` | Conformité publicitaire : canonique, consentement refusé par défaut, **délai de chargement du script d'annonces mesuré**, aucun bloc manuel, commandes protégées, pages légales complètes. **18/18.** |
| `partie.js` | Le jeu tourne toujours : une soirée entière jouée en accéléré, des billets vendus, de la recette encaissée — et la projection ouverte **au milieu d'une séance**, où l'on vérifie que l'heure avance et que la barre de progression bouge vraiment. **11/11.** |
| `agrandir.js` | Six agrandissements d'affilée : la grille grandit, les bâtis restent à la même place par rapport aux murs, le tour du local reste étanche, chaque case retrouve le bon bâti, la sauvegarde porte la nouvelle taille — et agrandir est refusé rideau levé ou sans argent, sans rien débiter. **17/17.** |
| `sacre.js` | Le douzième agrément arme la victoire, l'écran s'ouvre après le bilan, continuer ouvre la partie libre où la dixième semaine n'arrête plus rien, s'arrêter referme sur une victoire, et tout survit à la sauvegarde. **12/12.** |
| `sonde.js` · `planche.js` | Les onze bobines rendues et jugées côte à côte sur une planche-contact. |

**91 contrôles**, zéro erreur console du jeu.

### Ce que les tests ont trouvé

- **Le halo du projecteur était peint par-dessus l'image**, pas autour : la ville
  de nuit d'un film d'action devenait orange pâle et la silhouette d'un film
  d'horreur, lavande. La lumière déborde du cadre, elle ne repeint pas ce qu'il
  projette — le rectangle de l'écran est maintenant découpé.
- **L'iris de la bobine « Reprise » se fermait à l'envers** : un arc tracé en
  sens antihoraire sur exactement 2π ne perce pas le trou attendu, et l'image
  était entièrement noire. Remplacé par un dégradé radial, qui ne dépend pas du
  sens de tracé.
- **Le bonhomme des silhouettes faisait des moulinets** : bras et jambes
  recevaient le même balancement au signe près, donc aux extrêmes les quatre
  membres partaient en étoile. Les bras pendent désormais et balancent trois
  fois moins.
- **La carte RARE sortait plus souvent que la COMMUNE** — la garantie de la
  boîte était si généreuse qu'elle inversait les raretés. Visible seulement sur
  2 800 tirages.
- **L'action ne montrait rien entre deux explosions**, l'événement était trop
  sombre pour qu'on voie la scène, le drame avait un bonhomme de neige coupé par
  le cadre, et les animaux du documentaire étaient des points.
- Trois échecs de test étaient des **erreurs du test, pas du jeu** : une salle
  posée en contournant la validation (donc sans passage), un guichet sans
  personne derrière (qui ne vend rien — c'est la règle), et une journée dont on
  attendait la fin sur le mauvais signal.
