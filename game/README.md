# Los Santos — un GTA V jouable dans le navigateur

Un bac à sable en monde ouvert inspiré de **Grand Theft Auto V**, écrit
entièrement à la main : **WebGL 2, JavaScript natif, aucune dépendance, aucun
fichier d'image ni de son**. Tout — la ville, les voitures, les passants, la
musique des radios — est généré par le code au chargement.

**Jouer :** ouvrez `game/index.html` (ou <https://parkalert-web.github.io/parkalert/game/>).

---

## Ce qu'il y a dedans

### La ville

Los Santos est générée à partir d'une graine : 2,2 km de côté, une trame de
13 × 13 rues doublée d'une rocade, **926 bâtiments**, 3 000 accessoires, et des
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
ralentissent derrière un obstacle, choisissent leur direction aux carrefours et
klaxonnent quand ça bloque. Les piétons longent les îlots, paniquent aux coups
de feu et s'enfuient. Tout apparaît et disparaît autour du joueur.

### La police

Cinq étoiles, comme il se doit. Un homicide, un vol de voiture sous les yeux
d'un témoin ou une explosion font monter l'indice. Des voitures de patrouille
convergent, les policiers descendent de voiture quand vous êtes à pied, un
hélicoptère décolle à trois étoiles. Rester hors de vue assez longtemps fait
clignoter les étoiles puis les efface — ou passez chez Los Santos Customs.
Se faire rattraper à pied signifie **ARRÊTÉ**, mourir signifie **MORT** et un
réveil à l'hôpital.

### Les missions

Cinq missions scénarisées, déclenchées par les lettres au sol :

- **F — Reprise de véhicule** *(Franklin)* : voler une Comète et la livrer au garage, deux étoiles aux trousses ;
- **M — Le casse de la bijouterie** *(Michael)* : neutraliser les vigiles, rafler les vitrines, s'échapper avec trois étoiles — 240 000 $ ;
- **T — Carnage au port** *(Trevor)* : quatorze hommes de main, trois minutes ;
- **C — Course de rue** : dix points de passage le long du bord de mer, chrono serré ;
- **D — Courses de taxi** : trois clients, trois destinations.

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

### Le reste

Cinq stations de radio composées en direct par le synthétiseur du navigateur,
plus une nappe d'ambiance (rumeur urbaine, ressac). Trois vues de caméra dont
la **première personne**. Radar rotatif avec zone de recherche de la police,
carte plein écran avec points de destination, roue des armes, sélecteur de
personnage, boutiques, statistiques, codes de triche — et une **sauvegarde
locale** (argent, armes, missions réussies, personnage, heure) qui reprend la
partie où vous l'aviez laissée.

---

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
étalonnage ACES. La ville pèse 916 000 sommets (575 000 triangles) et se
dessine en ~75 appels par image.

**Qualité adaptative.** Sous 28 images par seconde, la résolution de rendu
baisse puis les ombres se coupent ; au-dessus de 56, tout remonte. On peut
aussi forcer les réglages par l'URL : `?scale=60&shadows=0&quality=fixed`.

## Tests

```bash
node --test tests/game.test.mjs
```

28 tests couvrent les mathématiques, l'orientation des faces (un enroulement
inversé rend la géométrie invisible), la reproductibilité de la ville, la
connexité du réseau routier, l'absence d'obstacle sur la chaussée et de
marqueur de mission dans un mur, les collisions, la physique des véhicules
(accélération, freinage, rayon de braquage réaliste, dérive, destruction) et
la cohérence des armes et des missions. L'un d'eux fait tourner trente secondes
de circulation sans navigateur et vérifie que les voitures avancent, restent sur
la chaussée et ne s'encastrent nulle part — c'est lui qui a mis au jour un
embouteillage permanent.

Deux d'entre eux sont des garde-fous nés de bugs réels : l'un vérifie qu'aucune
classe ne déclare deux fois la même méthode — une méthode `load()` de sauvegarde
avait un jour remplacé le chargement du monde, et le jeu démarrait sur une ville
vide — l'autre que chaque module s'importe sans effet de bord.

Le jeu se teste aussi dans un vrai navigateur (Playwright + Chromium) : conduite,
tir, police, missions de bout en bout, écrans et sauvegarde.
