# Zone Morte — couche de survie

`zonemorte.html` est le jeu complet, dans un seul fichier, sans dépendance.
Ce document décrit ce qui a été ajouté au jeu d'origine : une couche de
simulation qui change la façon dont la zone se comporte, et les gestes de
survie qu'elle rend nécessaires.

## L'idée

Le jeu partait d'un principe commode : la horde sait toujours où tu es.
Maintenant elle l'apprend — par l'oreille, par les yeux, ou parce qu'un autre
mort a grogné. Tout le reste découle de là : si le bruit compte, se taire
devient une arme, et il faut une machette, un fumigène et un leurre pour en
jouer.

## Trois modes de simulation

Réglages → **SIMULATION**. Le choix est enregistré avec la progression.

| Mode | Ce qu'il change |
|---|---|
| **ARCADE** | Le jeu d'avant : la horde te repère toujours, les munitions ne s'épuisent pas, la visée est très stable. |
| **SURVIE** (défaut) | Bruit, champ de vision, réserve de munitions, endurance et hémorragies. |
| **HARDCORE** | Tout est actif, les réserves sont maigres, la dispersion plus large et une morsure s'infecte une fois sur deux. |

## Perception et bruit

- Chaque mort a trois états : **il erre**, **il cherche** (`?`), **il te tient** (`!`).
  L'état s'affiche au-dessus de lui dès qu'il n'erre plus.
- La **vue** est un cône de ±66° devant lui, d'une portée propre à l'espèce
  (fiche complète dans le bestiaire, jauge « acuité »). La nuit, la brume et la
  position accroupie la raccourcissent ; courir et braquer ta lampe sur lui
  l'allongent.
- Un mur, un conteneur ou une carcasse coupe la ligne de vue.
- L'**ouïe** couvre 360° : chaque bruit lui donne une direction, avec une erreur
  d'autant plus grande qu'il vient de loin. Il part fouiller l'endroit, patiente,
  puis se remet à errer.
- Celui qui te repère **grogne** et alerte ses voisins : c'est ainsi qu'une rue
  entière se réveille.
- Ce que tu émets, en pixels de portée : machette ~110, pas 22 à 190, course 330,
  mitraillette 520, fusil d'assaut 700, pompe 800, fusil de précision 980,
  explosion 900 + rayon, leurre 640 toutes les 0,7 s, tonnerre 1500.
- Un mort qui erre dérive lentement vers les vivants : il ne sait pas où tu es,
  il sait de quel côté ça sent la vie. Sans ce biais la zone se viderait.

La barre **DISCRÉTION**, sous la vie, dit ce que tu vaux à l'oreille, et compte
ceux qui te traquent en ce moment.

## Balistique

- **Dispersion dynamique** : elle monte à chaque départ de coup et retombe au
  repos. Courir, être essoufflé et arroser l'ouvrent ; s'accroupir et respirer
  la referment. Chaque arme a sa dispersion de base et son recul accumulé.
- **Perte de puissance** au-delà de la portée utile de l'arme : la pompe ne vaut
  plus rien à trente mètres, le fusil de précision garde presque tout.
- **Coups vitaux** : la balle doit passer par la largeur d'un crâne *et* aborder
  le corps de face ou de dos. Comme la tête balance avec la démarche, viser le
  centre ne suffit pas — il faut tirer au bon moment. ×2 dégâts.
  En pratique : ~43 % des touches en tir posé, ~17 % en arrosage.
- Une balle perforante perd un tiers de sa force à chaque corps traversé.
- Une traçante sur trois laisse un sillage : on lit sa trajectoire.

## Munitions

L'arme principale puise dans une **réserve** limitée (240 à 300 cartouches selon
l'arme, 60 % de ça en hardcore). Les armes secondaires gagnées en montant de
niveau restent gratuites : on n'est jamais complètement bloqué.

- **Rechargement tactique** : la balle déjà chambrée ne se perd pas.
- L'esquive **interrompt** le chargeur en cours.
- Les corps lâchent des munitions, des soins et des objets à lancer.

## Endurance, blessures, infection

- **Endurance** : courir (Maj) la vide en ~4 s, l'esquive coûte 20 %. Elle
  revient au repos, plus vite accroupi. À bout de souffle : la visée s'ouvre,
  les bords de l'écran se resserrent, la respiration s'entend.
- **Hémorragie** : jusqu'à trois plaies, 1,15 point de vie par seconde chacune,
  jusqu'au bandage. Elle laisse une traînée de sang derrière toi.
- **Infection** : une morsure sur quatre (une sur deux en hardcore). Elle monte
  seule, décolore le monde, et une fois pleine ronge ta réserve de vie. Le sérum
  la fait retomber des deux tiers.

## Météo

Cinq temps qui s'enchaînent d'eux-mêmes pendant la partie : **ciel dégagé**,
**brume**, **pluie**, **orage**, **vent de cendres**. Chacun change la portée de
vue des morts et la part de ton bruit que le temps avale — la pluie couvre les
pas, le vent de cendres les porte plus loin. L'orage éclaire tout le terrain une
demi-seconde à chaque éclair, et le coup de tonnerre réveille absolument tout le
monde.

## Gestes et objets

| Touche | Geste |
|---|---|
| `Maj` | courir |
| `C` | s'accroupir — deux fois plus lent, presque muet, bien plus précis |
| `V` | frapper au corps à corps — silencieux, rien à recharger |
| `G` / `B` / molette | lancer / changer d'objet |
| `1` `2` `3` `4` | bandage, trousse, sérum, stimulant |
| `R` | recharger |
| `M` | afficher ou masquer le détecteur |

Sur écran tactile, six boutons reprennent ces gestes (appui long sur le bouton
de jet pour changer d'objet).

**Objets à lancer** : grenade (explosion, très bruyante), molotov (nappe de feu),
fumigène (à l'intérieur, plus personne ne te voit), leurre sonore (hurle à ta
place 9 s et vide le quartier).

## Interface

- **Détecteur de mouvement** en haut à droite : il ne montre que ce que tu
  perçois — ce qui te traque, ce que ta lampe éclaire, ce qui est à moins de
  250 px — plus les caisses, le butin, les survivants et l'équipe.
- Jauges d'endurance et de discrétion sous la vie, pastilles d'état
  (hémorragie, infection, accroupi, course, stimulant, météo).
- Sac rapide à gauche, réserve de munitions sous le chargeur.
- Fin de partie : précision, coups vitaux, distance parcourue, discrétion
  moyenne, corps à corps, objets lancés, hémorragies subies.
- Entraînement : trois étapes de plus (bruit et position accroupie, machette,
  objets lancés). L'étape sur le bruit est sautée en mode arcade.

---

# Ce qui donne envie de rester, et de revenir

Le jeu ne manquait pas de systèmes de progression — il en avait treize.
Il leur manquait d'exister **au bon moment** : à la mort, quand on décide de
relancer ou de fermer l'onglet. Rien de neuf n'a été empilé par-dessus ; ce qui
existait a été amené à ce moment-là.

## L'écran de fin

Avant, il énumérait des chiffres dans un pavé de texte. Il fait maintenant trois
choses, dans cet ordre.

1. **« Tu n'étais pas loin »** — les deux marches les plus proches, avec le
   manque exact et une barre : *« prochaine caisse : 1 580 points »*,
   *« ton record de survie : 14 s »*. Au-delà de deux, ce n'est plus un
   encouragement mais une liste de reproches.
2. **Le rang** — une barre qui monte, toujours, même après une sortie ratée à
   quarante secondes (voir plus bas).
3. **Le palmarès** — une ligne par chose qui a bougé, révélées l'une après
   l'autre : étoiles, prime de victoire, contrats validés, succès, rangs
   franchis, objectif du jour, pass, personnage, équipe, multiplicateurs.
   Même information qu'avant, mais on la *voit* arriver.

Le bouton de relance colle au bas de l'écran : la page est longue, et c'est le
seul geste qu'on veut pouvoir faire à tout moment.

## Le rang du survivant

La seule progression qui ne peut jamais reculer. Chaque sortie donne de
l'expérience de rang — le score domine, mais le temps tenu et les morts au sol
comptent aussi, donc **on ne rentre jamais les mains vides**. C'est précisément
après une mort rapide qu'on ferme le jeu ; il fallait que cette sortie-là compte
quand même.

Six titres : `RECRUE` → `SURVIVANT` (6) → `VÉTÉRAN` (12) → `CHASSEUR` (20) →
`SPECTRE` (30) → `LÉGENDE` (45). Le titre et le rang s'affichent sous le pseudo,
avec leur barre. Chaque rang rapporte des pièces, un jeton tous les cinq rangs,
une caisse tous les dix. La montée est rapide au début — la deuxième partie doit
servir à quelque chose — puis de plus en plus lente.

## L'objectif de session

Trois sorties dans la journée : 150, puis 250, puis 400 pièces et un jeton.
La série de connexion récompense le fait de **venir** ; celui-ci récompense le
fait de **rester**. Il s'affiche au menu et sur chaque écran de fin
(*« encore 1 pour le jeton du jour »*).

## Le bandeau « ce qui t'attend »

Placé sous l'identité, avant même le bouton JOUER : tout ce qui est réclamable
tout de suite, au même endroit — caisses à ouvrir, récompense du jour, paliers
de pass, lots de la route, missions finies, équipe vide. Un joueur qui revient
après deux jours voit d'un coup d'œil ce qu'il a laissé derrière lui.

Dessous, l'échéance : *« contrats, défi et série renouvelés dans 2 h 04 »* —
un compte à rebours qui descend sous les yeux.

## Notes

- Les libellés des écrans de fin et du bandeau sont traduits dans les quatre
  langues du jeu. Les textes longs restent en français, comme le reste de la
  prose (annonces, bestiaire, contrats, cinématiques).
- Deux défauts d'origine corrigés au passage : un `\n` littéral traînait dans le
  HTML du HUD et s'affichait à l'écran ; et l'écran de mort portait les libellés
  de l'écran de victoire — « DÉLIVRÉS » au-dessus du niveau, « NIVEAU » au-dessus
  de la meilleure série.

---

## Conformité aux règles AdSense

Le jeu est monétisé par Google AdSense. Les
[règles du programme](https://support.google.com/adsense/answer/48182) ont été
relues ligne à ligne ; six manquements ont été corrigés.

| Ce qui n'allait pas | La règle | Ce qui a été fait |
|---|---|---|
| Le bloc d'annonce de l'écran de mort était **coincé entre « RECOMMENCER » et « RETOUR À L'ACCUEIL »**, là où le joueur tape le plus vite | *Ad placement* — « ads implemented in placements that are intuitively meant for navigation » | Les deux blocs manuels sont supprimés ; Google place lui-même |
| `data-ad-format="auto"` **sans hauteur réservée** : l'annonce poussait les boutons sous le doigt en se chargeant | Clics involontaires | Plus de bloc en flux, donc plus de décalage |
| Aucun libellé, même fond que le jeu | « Format ads so that they become indistinguishable from other content » | Auto ads : Google signale toujours ses annonces |
| **Aucun `push({})` nulle part**, et les blocs vivaient dans des écrans `display:none` | Bloc de taille nulle, impression jamais servie | Blocs supprimés |
| `data-ad-slot="0000000000"` | Identifiants factices | Supprimés |
| Ni `ads.txt`, ni éditeur identifié, ni contact | Inventaire non autorisé ; site jugé « non-content » | `ads.txt` à la racine, écran **MENTIONS LÉGALES** complet |

Ce qui a été ajouté :

- **`ads.txt`** à la racine du domaine, déclarant Google comme seul vendeur
  autorisé. Sans lui, l'inventaire est classé « non autorisé » et cesse d'être
  acheté.
- **Un écran MENTIONS LÉGALES** accessible du menu, des réglages et de la
  politique de confidentialité : éditeur, contact, hébergeur, régie et
  identifiant éditeur, et l'engagement explicite de ne jamais inciter au clic
  ni déguiser une annonce en élément de jeu.
- **`<meta name="google-adsense-account">`** et une **URL canonique absolue**
  (`https://zonemorte.netlify.app/` — elle pointait vers `./index.html`).
- **`adsbygoogle-noablate`** sur les six commandes fixes du jeu (esquive,
  rotation, actions, munitions, kit, sac rapide). Les annonces d'ancrage des
  Auto ads se collent au bas de l'écran, exactement là où se trouve le bouton
  de rotation : sans ce marqueur, chaque esquive serait devenue un clic
  publicitaire involontaire — c'est-à-dire du trafic invalide.

Le consentement était déjà correct et n'a pas été touché : Consent Mode v2 avec
tous les signaux à `denied` par défaut, CMP certifié IAB TCF v2.2 (Funding
Choices), et le script AdSense n'est chargé qu'une fois le verdict rendu.

### Ce qui reste à faire hors du code

1. **Renseigner `ADRESSE_CONTACT`** dans le fichier. Tant qu'elle est vide,
   l'écran affiche en rouge « ADRESSE DE CONTACT À RENSEIGNER » : un site
   publicitaire sans moyen de contact est refusé.
2. **Déposer `ads.txt`** à la racine servie du domaine.
3. **Dans AdSense → Annonces → Auto ads : désactiver les annonces
   interstitielles (vignettes).** Elles s'ouvrent en plein écran sur navigation
   et couvriraient une partie en cours. Les annonces d'ancrage peuvent rester,
   les commandes du jeu sont protégées.
