# Los Santos — un GTA V jouable dans le navigateur

Un bac à sable en monde ouvert inspiré de **Grand Theft Auto V**, écrit
entièrement à la main : **WebGL 2, JavaScript natif, aucune dépendance, aucun
fichier d'image ni de son**. Tout — la ville, les voitures, les passants, la
musique des radios — est généré par le code au chargement.

## Trois façons d'y jouer

**1. Le fichier unique (le plus simple).** Téléchargez
[`game/losantos.html`](losantos.html) — 305 Ko, tout est dedans — et
double-cliquez dessus. Aucun serveur, aucune installation, aucune connexion :
il s'ouvre dans votre navigateur et le jeu démarre.

**2. En ligne.** <https://parkalert-web.github.io/parkalert/game/>

**3. Depuis les sources.** `game/index.html` charge des modules JavaScript, et
les navigateurs les refusent en `file://`. Il faut donc un petit serveur local :

```bash
cd parkalert && python3 -m http.server 8080
# puis http://localhost:8080/game/
```

Pour refabriquer le fichier unique après une modification des sources :

```bash
npm run build:game
```

---

## Ce qu'il y a dedans

### La ville

Los Santos est générée à partir d'une graine : 2,2 km de côté, une trame de
13 × 13 rues doublée d'une rocade, **926 bâtiments**, 3 100 accessoires, et des
quartiers qui ont chacun leur allure.

| Quartier | Ce qu'on y trouve |
|---|---|
| Downtown Los Santos | gratte-ciels de 60 à 205 m, façades vitrées, antennes |
| Pillbox Hill | immeubles de rapport, commerces en rez-de-chaussée |
| Vespucci Beach / Del Perro | plage de sable, palmiers, jetée et grande roue |
| Vinewood Hills | villas avec piscine, panneau **VINEWOOD** sur la montagne |
| Rockford Hills, Mirror Park, Strawberry, Davis | pavillons, entrepôts, parcs |
| LS International | piste de 700 m, terminal, hangars, tour de contrôle |
| Port of Los Santos | grues portuaires et conteneurs empilés |

S'y ajoutent l'hôpital (réapparition), le commissariat, **Ammu-Nation**
(armurerie), **Los Santos Customs** (réparation + peinture + effacement de
l'indice de recherche), un stade, un chantier avec sa grue, des parcs et un
parking.

### La conduite

16 véhicules — berlines, sportives, muscle cars, SUV, pick-up, van, taxi, bus,
ambulance, camion de pompiers, deux voitures de police et un hélicoptère.
Chacun a sa masse, sa puissance, son adhérence, et une carrosserie construite
à partir de sa fiche technique.

La physique est arcade mais honnête : modèle bicyclette pour la direction,
**dérive latérale** quand le cap s'écarte de la trajectoire, frein à main qui
casse l'adhérence, accélération latérale bornée par la tenue de route (pas de
virage à 90° à 150 km/h), transfert de masse visible au roulis et au tangage,
tôle froissée, fumée, incendie puis explosion.

### Voler

Deux **Maverick** attendent, l'un sur le tarmac de l'aéroport, l'autre sur le
parking de Strawberry. `Espace` monte, `Ctrl` descend, `Z`/`S` piquent ou
cabrent, `Q`/`D` font pivoter — l'appareil tient son altitude tout seul quand
on lâche le collectif. Le pare-brise se remplit de Los Santos vue d'en haut,
et le compteur affiche l'altitude. Poser trop vite abîme la machine ; sauter
en marche fait mal.

### À pied

Marche, course, saut, accroupi, visée par-dessus l'épaule, tir à la hanche,
corps à corps. Neuf armes : poings, batte, pistolet, micro-SMG, fusil à pompe,
carabine d'assaut, fusil de précision (avec lunette), lance-roquettes et
grenades. Les tirs sont résolus par lancer de rayon contre le décor, les
piétons (avec **tirs à la tête**) et les véhicules.

### La ville vivante

La circulation suit un vrai graphe routier : les voitures tiennent leur file,
ralentissent derrière un obstacle, **s'arrêtent aux feux tricolores**,
choisissent leur direction aux carrefours et klaxonnent quand ça bloque. Elles
cèdent le passage à un piéton — mais pas éternellement : au bout de trois
secondes elles klaxonnent et avancent au pas, sinon un badaud planté sur la
chaussée figerait toute une file.

Les piétons longent les trottoirs, s'arrêtent, traversent la rue, courent pour
certains, **sautent sur le côté quand une voiture leur fonce dessus**,
paniquent aux coups de feu et s'enfuient. Tout apparaît et disparaît autour du
joueur.

### La police

Cinq étoiles, comme il se doit. Un homicide, un vol de voiture sous les yeux
d'un témoin ou une explosion font monter l'indice — et depuis peu le **code de
la route** aussi : feu rouge grillé, contresens, excès de vitesse, accident et
délit de fuite. Comme dans la vraie vie, il faut qu'une patrouille le voie :
griller un feu sur un carrefour désert ne coûte rien.

Une patrouille ne fonce plus sur un suspect à pied : elle **freine à une
vingtaine de mètres et les agents descendent**, arme au poing. Et dès deux
étoiles, le passager **tire par la vitre** pendant la poursuite. Des voitures de patrouille
convergent, les policiers descendent de voiture quand vous êtes à pied, un
hélicoptère décolle à trois étoiles. Rester hors de vue assez longtemps fait
clignoter les étoiles puis les efface — ou passez chez Los Santos Customs.
Se faire rattraper à pied signifie **ARRÊTÉ**, mourir signifie **MORT** et un
réveil à l'hôpital.

### Les missions

Cinq missions scénarisées, déclenchées par les lettres au sol :

Dix missions, et surtout dix **genres différents** — pas dix fois « va chercher,
va déposer ». Le genre est annoncé au lancement et sur la carte.

- **F — Reprise de véhicule** *(Vol, Franklin)* : voler une Comète et la livrer au garage, deux étoiles aux trousses ;
- **F — Rattrape-le** *(Poursuite, Franklin)* : un fuyard file à pleine vitesse et grille les feux ; il faut le percuter jusqu'à ce que sa voiture rende l'âme ;
- **M — Le casse de la bijouterie** *(Braquage, Michael)* : neutraliser les vigiles, rafler les vitrines, s'échapper avec trois étoiles — 240 000 $ ;
- **M — Le témoin** *(Escorte, Michael)* : conduire un témoin au palais de justice ; sa vie tient à l'état de votre voiture, et deux embuscades vous attendent en route ;
- **T — Carnage à l'aéroport** *(Assaut, Trevor)* : quatorze hommes de main, trois minutes ;
- **T — Casse au port** *(Sabotage, Trevor)* : détruire cinq camions, puis semer la police ;
- **C — Course de rue** *(Course)* : dix points de passage le long du bord de mer, chrono serré ;
- **S — La planque éventrée** *(Récupération)* : quatre sacs éparpillés sur la corniche, puis retour à la planque ;
- **G — Guet-apens à Grove** *(Survie)* : tenir la position près de deux minutes pendant que les vagues d'assaillants arrivent ;
- **D — Courses de taxi** *(Livraison)* : trois clients, trois destinations.

### Les trois personnages

**Michael**, **Franklin** et **Trevor** — on bascule de l'un à l'autre en
maintenant `G`. Chacun a son quartier, sa garde-robe et sa capacité spéciale :
temps ralenti à pied, temps ralenti au volant, dégâts doublés.

### Le ciel et le temps qu'il fait

Cycle jour/nuit complet — une journée dure 24 minutes — avec course du soleil,
lever et coucher colorés, étoiles, lune, nuages procéduraux et éclairage urbain
qui s'allume à la tombée du jour : lampadaires, enseignes, phares, fenêtres
allumées étage par étage.

La météo dérive toute seule entre grand beau temps, ciel couvert, pluie et
orage. Sous l'averse le ciel s'assombrit, les gouttes strient l'écran, les
éclairs illuminent la ville et **la chaussée mouillée fait perdre de
l'adhérence**.

### Hors de la ville

Une rocade fait le tour de l'agglomération et donne un grand circuit
praticable. Au-delà commencent l'arrière-pays et ses bosquets, ses rochers et
ses éoliennes, la chaîne de montagnes du nord, l'aéroport au sud et le port à
l'est. À l'ouest, on peut entrer dans l'eau : le joueur **nage**, et les
véhicules calent puis coulent.

### Comprendre le jeu sans manuel

Un bac à sable où rien n'est expliqué n'est pas un jeu difficile, c'est un jeu
qu'on ferme. Trois choses répondent à ça :

- un **tutoriel** au premier lancement — huit gestes dans l'ordre, chacun validé
  dès qu'on l'a fait, avec la raison à côté de la consigne. Passable d'un clic ;
- une **barre de commandes** en bas de l'écran, qui montre en permanence ce
  qu'on peut faire *maintenant* : elle change quand on monte en voiture, quand
  on entre quelque part, quand quelqu'un est à portée de parole ;
- un **panneau d'aide** (**H**), le rappel complet en quatre thèmes.

Et les quatre boutons de droite portent leur touche : **V**, **I**, **M**, **Éch**.

### À l'écran, sans rien connaître

Quatre boutons cliquables en haut à droite — **Vue**, **Armes**, **Carte**,
**Menu** — parce qu'une commande qui n'existe qu'au clavier n'est jamais
trouvée. Le viseur est **toujours affiché** dès qu'on a une arme en main, et une
**visée assistée** accroche la cible la plus proche de l'axe : un cadre s'affiche
autour d'elle, rouge pour une menace, avec sa distance. Tirer envoie la balle
sur la personne encadrée, pas sur le mur derrière.

La souris est **capturée pendant le jeu** : on tourne la tête sans rien tenir,
comme dans n'importe quel jeu — c'est la seule façon de ne pas buter contre le
bord de l'écran. Revers de la médaille, le curseur appartient alors au canevas
et aucun bouton n'est cliquable ; **maintenir Alt** le rend le temps qu'il faut,
et le relâcher reprend la main. Ceux qui préfèrent jouer au curseur libre
décochent « Capturer la souris » dans le menu : la vue se pilote alors en gardant
un bouton enfoncé.

### Entrer quelque part

Quatre intérieurs se visitent : **Ammu-Nation**, l'**hôpital**, l'**atelier
Los Santos Customs** et **votre appartement**, où le lit enregistre la partie.
On entre par le parvis avec **E**, on ressort par le seuil. Les pièces sont
bâties à l'écart de la ville — le procédé des GTA de l'époque — et franchir la
porte téléporte le joueur : de l'intérieur on ne voit que la pièce, et depuis la
rue on ne les aperçoit jamais.

### Parler aux gens

**E** devant un passant engage la conversation : il se tourne, s'arrête et
répond, avec une bulle au-dessus de la tête. Douze répliques de comptoir, et
d'autres, moins aimables, quand il est paniqué.

### Choisir sa mission

Elles ne se déclenchent plus toutes seules quand on marche sur un marqueur : on
appuie sur **E**, ou on la choisit sur la carte. La carte plein écran liste les
dix missions avec leur genre, leur distance et leur prime ; cliquer un point
ouvre sa fiche — ce que c'est, ce qu'on y trouve, à quelle distance — avec deux
boutons : *lancer* si on est à moins de soixante mètres, *marquer la
destination* sinon.

### Être ruiné

C'est la seule vraie défaite du jeu : plus un dollar en poche et la partie
s'arrête sur un écran **RUINÉ**, puis retour au menu principal, qui affiche
votre argent, vos missions réussies et votre personnage. On reprend là où on
était — un ami vous dépanne de 500 $ — ou on repart de zéro.

### Le reste

Cinq stations de radio composées en direct par le synthétiseur du navigateur,
plus une nappe d'ambiance (rumeur urbaine, ressac). Trois vues de caméra dont
la **première personne**. Radar rotatif avec zone de recherche de la police,
carte plein écran avec points de destination, roue des armes, sélecteur de
personnage, boutiques, statistiques, codes de triche — et une **sauvegarde
locale** (argent, armes, missions réussies, personnage, heure) qui reprend la
partie où vous l'aviez laissée.

---

### Ce que ce n'est pas

Grand Theft Auto V, c'est une centaine de gigaoctets, des milliers d'acteurs,
de modèles et d'heures de dialogue. Ici il n'y a **ni texture, ni son
enregistré, ni scénario filmé** : tout tient dans 8 000 lignes de JavaScript
qui se chargent en quelques secondes. C'est un hommage, pas une copie — on
retrouve les piliers du jeu (la ville ouverte, la conduite, la police, les
missions, les trois personnages, le cycle jour/nuit), dans un style
géométrique assumé.

Aucun contenu de Rockstar Games n'est utilisé : les noms de quartiers évoquent
Los Angeles, les véhicules et les stations de radio sont inventés.

## Commandes

| | |
|---|---|
| `Z` `Q` `S` `D` / flèches | se déplacer, conduire |
| Souris | regarder · clic droit viser · clic gauche tirer |
| `Maj` | courir |
| `Espace` | sauter · frein à main |
| `F` | monter dans un véhicule / en descendre |
| `E` | interagir (Ammu-Nation, hôpital) |
| `R` | recharger |
| `Tab` *(maintenu)* | roue des armes |
| `G` *(maintenu)* | changer de personnage |
| `X` | capacité spéciale |
| `1`–`9` | armes |
| `M` | carte · clic pour poser une destination |
| `V` | vue caméra (rapprochée, large, première personne) · `C` caméra libre en voiture |
| `Espace` / `Ctrl` | hélicoptère : monter / descendre |
| `H` | klaxon · `,` `.` station de radio |
| `Échap` | pause, réglages et statistiques |

Manette (Xbox/PlayStation) et écran tactile sont également gérés.

**Codes de triche** — à taper pendant la partie : `SANTE`, `ARSENAL`,
`FORTUNE`, `AVOCAT`, `RECHERCHE`, `BOLIDE`, `TANK`, `HELICO`, `NUIT`, `JOUR`,
`RALENTI`.

---

## Sous le capot

```
game/
  index.html            interface (HUD, carte, menus, boutique)
  style.css
  src/
    main.js             chargement, écran d'accueil, réglages
    game.js             boucle de jeu, combat, cycle jour/nuit, particules
    engine/
      math.js           vecteurs, matrices, frustum, couleurs, aléatoire semé
      gl.js             contexte WebGL 2, construction et envoi des maillages
      renderer.js       ciel, ombres portées, brouillard, instanciation, océan
      input.js          clavier, souris, manette, tactile
      audio.js          moteurs, armes, sirènes et cinq radios synthétisées
    world/
      gen.js            plan de la ville (pur, testable hors navigateur)
      build.js          plan -> géométrie 3D, découpée en tuiles
      collide.js        grille spatiale, poussée hors des murs, lancer de rayon
    entities/
      vehicle.js        catalogue, carrosseries, physique, dégâts
      character.js      silhouette articulée, piétons, panique
      player.js         joueur, armes, santé, personnages
    systems/
      camera.js  traffic.js  police.js  missions.js  weapons.js  hud.js
```

**Rendu.** Une seule passe de géométrie : le décor statique est découpé en 161
tuiles triées par frustum, les objets mobiles sont dessinés par instanciation
(un appel de dessin pour tous les cubes, un pour tous les cylindres). S'y
ajoutent une carte d'ombres directionnelle 2048², un ciel procédural avec
nuages, un océan animé par les sommets, des halos lumineux additifs et un
étalonnage ACES. La ville pèse 943 000 sommets (593 000 triangles) et se
dessine en ~75 appels par image.

**Qualité adaptative.** Sous 28 images par seconde, la résolution de rendu
baisse puis les ombres se coupent ; au-dessus de 56, tout remonte. On peut
aussi forcer les réglages par l'URL : `?scale=60&shadows=0&quality=fixed`.

**Le fichier unique.** `game/build.mjs` réunit les 19 modules, la feuille de
style et l'interface dans une seule page : chaque module devient une fonction
isolée enregistrée dans une petite table, et les `import` deviennent des
lectures dans cette table. Aucun outil externe, aucune étape d'installation.

## Tests

```bash
node --test tests/game.test.mjs
```

50 tests couvrent les mathématiques, l'orientation des faces (un enroulement
inversé rend la géométrie invisible), la reproductibilité de la ville, la
connexité du réseau routier, l'absence d'obstacle sur la chaussée et de
marqueur de mission dans un mur, les collisions, la physique des véhicules
(accélération, freinage, rayon de braquage réaliste, dérive, destruction) et
la cohérence des armes et des missions. L'un d'eux fait tourner une minute de
circulation sans navigateur et vérifie que les voitures avancent, restent sur
la chaussée et ne s'encastrent nulle part — c'est lui qui a mis au jour un
embouteillage permanent, puis un second : un piéton immobile bloquait
définitivement toute une file. Un autre lance une voiture à 260 km/h contre un
immeuble pour s'assurer qu'elle ne le traverse pas, un autre encore fait vivre
soixante piétons pendant quarante-cinq secondes et vérifie qu'aucun ne finit
dans un mur.

Un test **joue chaque nouvelle quête jusqu'au bout** sans navigateur : c'est
lui qui a fait tomber un bug bien plus vieux — quatre véhicules (ambulance,
camion de pompiers, Benson, bus) n'avaient pas de valeur de braquage. Un
`undefined` dans la physique, et leur position devenait NaN dès la première
image. Un garde-fou fait désormais rouler chaque modèle du catalogue à l'arrêt,
à fond et en virage serré, en exigeant que tout reste fini.

D'autres couvrent la visée assistée (la bonne cible, jamais dans le dos, jamais
un mort), la projection à l'écran, les dialogues des passants, l'aller-retour
dans chaque intérieur, et la ruine.

À côté, une campagne dans Chromium joue vraiment : 28 vérifications sur la
conduite, le tir, la police, les missions, la sauvegarde ; et 20 de plus sur les
boutons d'écran, l'inventaire, la carte, les intérieurs et le menu. C'est cette
seconde campagne qui a montré qu'aucun bouton n'était cliquable tant que la
souris était capturée par le canevas.

Un autre vérifie que `losantos.html` n'a pas pris de retard sur les sources.

Deux d'entre eux sont des garde-fous nés de bugs réels : l'un vérifie qu'aucune
classe ne déclare deux fois la même méthode — une méthode `load()` de sauvegarde
avait un jour remplacé le chargement du monde, et le jeu démarrait sur une ville
vide — l'autre que chaque module s'importe sans effet de bord.

Le jeu se teste aussi dans un vrai navigateur (Playwright + Chromium) : conduite,
tir, police, missions de bout en bout, écrans et sauvegarde.
