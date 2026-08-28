# Minecraft JS

Une recréation de Minecraft qui tourne dans le navigateur, écrite de zéro en
JavaScript : **aucune bibliothèque, aucune image, aucun fichier son**. Le rendu
est du WebGL2 écrit à la main, les textures sont peintes pixel par pixel au
démarrage et les bruitages sont synthétisés par Web Audio.

```
minecraft/
  minecraft.html      LE JEU EN UN SEUL FICHIER (engendré) — 400 Ko
  index.html          version modulaire, pour développer
  style.css           habillage (menus, ATH, inventaires)
  src/                21 modules ES, sans dépendance
  build.mjs           assemble les modules en un fichier unique
  tests/game.test.mjs 29 tests de la logique de jeu
```

## Lancer le jeu

**Le plus simple** : téléchargez `minecraft.html` et ouvrez-le d'un double-clic.
Tout y est — code, style, textures, sons —, rien à installer, aucun serveur.
Les mondes sont sauvegardés dans le navigateur.

**Pour développer**, la version modulaire a besoin d'un serveur HTTP (les
modules ES ne se chargent pas depuis `file://`) :

```bash
npm start                  # puis http://localhost:8080/minecraft/
npm run build:minecraft    # régénère minecraft.html depuis src/
npm run test:minecraft     # les 29 tests de logique
```

Un navigateur récent avec **WebGL2** est nécessaire (Chrome, Firefox, Edge,
Safari 15+).

## Commandes

| Touche | Action |
|---|---|
| ZQSD / WASD | Se déplacer |
| Souris | Regarder · clic gauche : casser ou frapper · clic droit : poser ou utiliser |
| Espace | Sauter — deux fois pour voler en créatif |
| Maj | S'accroupir (empêche de tomber d'un rebord) |
| Ctrl | Courir |
| 1-9, molette | Choisir un objet |
| E | Inventaire · dans l'inventaire : Maj+clic pour transférer, clic droit pour la moitié |
| Q | Jeter l'objet tenu (Ctrl+Q : toute la pile) |
| T puis `/` | Chat et commandes |
| F3 | Informations de débogage · F5 : vue · F11 : plein écran |
| Échap | Pause |

Commandes du chat : `/gamemode`, `/time set jour|nuit|midi|<ticks>`,
`/give <objet> [n]`, `/tp <x> <y> <z>`, `/weather pluie|clair`, `/summon <créature>`,
`/seed`, `/kill`, `/spawn`, `/clear`, `/help`.

## Ce qui est là

**Monde** — infini, découpé en tronçons de 16 × 128 × 16, généré par bruit de
Perlin. Treize biomes : océan, plage, plaines, forêt, forêt de bouleaux, taïga,
désert, montagnes, toundra enneigée, **jungle** (grands acajous et rideaux de
lianes), **savane** (acacias au houppier plat), **marais** (plat, mares d'eau,
chênes drapés de lianes, cannes à sucre) et **badlands** (plateaux de terre
cuite en strates orange, blanches et jaunes sur du sable rouge). S'y ajoutent
grottes et cavernes, filons dont la profondeur suit la rareté, lacs de lave,
arbres à cheval sur les tronçons, fleurs, champignons, cactus, citrouilles.
Une graine (numérique ou textuelle) redonne toujours le même monde.

**Lumière** — deux canaux comme dans le jeu : la lumière du ciel qui tombe
verticalement sans s'affaiblir puis déborde sur les côtés, et celle des blocs
(torche, lave, pierre lumineuse). Poser un bloc projette une ombre, casser un
mur laisse le jour entrer, et l'obscurité conditionne l'apparition des monstres.

**Rendu** — maillage par tronçon avec élagage des faces cachées, occlusion
ambiante et éclairage doux par sommet, teinte de biome sur l'herbe, transparence
de l'eau et du verre, test alpha pour le feuillage et les plantes, brouillard,
cycle jour/nuit complet avec soleil, lune, étoiles et nuages, pluie et neige.
Chaque sommet tient sur 8 octets, ce qui permet de garder des centaines de
tronçons en mémoire vidéo.

**Survie** — 20 points de vie, barre de nourriture avec saturation et épuisement,
régénération, dégâts de chute, noyade avec réserve d'air, lave, feu, cactus,
vide. Armure en cuir, or, fer ou diamant (chaque point retire 4 % de dégâts),
outils avec durabilité et paliers (le diamant seul entame l'obsidienne),
expérience et niveaux, mort avec perte de l'inventaire et réapparition.

**Structures** — villages (maisons aux styles régionaux, puits, champs de blé
irrigués, coffres garnis et villageois qui y vivent), temples du désert avec
chambre au trésor piégée sous la pyramide, tours de guet en ruine, et donjons
moussus perdus sous terre. Chaque type occupe une « région » de tronçons : la
graine décide s'il y a quelque chose et où, si bien qu'un village à cheval sur
six tronçons est dessiné en entier quel que soit l'ordre d'exploration.

**Artisanat** — 79 recettes façonnées et informes, cinq essences de bois
(chêne, bouleau, sapin, acajou, acacia) interchangeables dans toutes les
recettes, grille 2 × 2 portable et 3 × 3
sur l'établi, four avec combustible, jauge de combustion et progression de
cuisson, coffres de 27 emplacements. Outils, armures, arc et flèches, torches,
lit, TNT, blocs compactés, pain, pomme dorée…

**Créatures** — cochon, vache, mouton, poule, zombie, squelette, creeper,
araignée. Elles errent, fuient quand on les frappe, poursuivent le joueur à vue,
sautent les obstacles, évitent les falaises ; le squelette tire des flèches, le
creeper s'amorce et explose en creusant le terrain, l'araignée grimpe aux murs
et n'attaque qu'à la nuit, zombies et squelettes brûlent au soleil. On tond les
moutons, on trait les vaches, la viande tombe cuite si la créature brûlait.

**Monde vivant** — écoulement de l'eau et de la lave avec niveaux et tarissement,
eau + lave qui donnent pierre, pierre taillée ou obsidienne, chute du sable et
du gravier, propagation et mort de l'herbe, décomposition des feuilles loin d'un
tronc, pousse du blé sur terre labourée irriguée, pousses qui deviennent des
arbres, fonte de la glace, météo aléatoire.

**Sauvegarde** — plusieurs mondes, dans IndexedDB (repli sur `localStorage`).
Seules les différences avec le terrain généré sont stockées : un monde exploré
longtemps tient dans quelques dizaines de kilo-octets. Sauvegarde automatique
toutes les 90 secondes et à la fermeture.

## Ce qui n'y est pas

Pas de multijoueur, pas de redstone, pas de Nether ni d'End, pas
d'enchantements ni de potions, pas de villages ni de PNJ, pas de reproduction
d'animaux, pas de dalles ni d'escaliers (le format de sommet ne code que des
cubes pleins, des croix et des panneaux plats).

## Notes techniques

- **Fichier unique** : `build.mjs` recopie les modules dans un seul HTML en
  enfermant chacun dans une fonction, de sorte que les noms internes identiques
  d'un fichier à l'autre (`ID`, `el`, `GRAVITY`…) ne se marchent pas dessus —
  exactement ce que font de vrais modules. L'ordre d'écriture suit les
  dépendances. Le stockage se replie sur `localStorage` puis sur la mémoire
  quand le navigateur refuse IndexedDB, ce qui arrive en `file://`.
- **Empaquetage des sommets** : `x(5) y(8) z(5) u(1) v(1) normale(3) décalage(2)
  occlusion(2)` dans un entier, `couche(8) ciel(4) bloc(4) teinte 5·5·5` dans un
  second. Le nuanceur décode le tout ; un tronçon de terrain typique pèse 75 Ko.
- **Textures** : une `TEXTURE_2D_ARRAY` d'une couche par tuile — pas de bavure
  entre voisines, mipmaps corrects, et l'eau comme la lave sont animées en
  réinjectant une seule couche à chaque image.
- **Chargement progressif** : création → relief → décors → lumière → maillage,
  chaque étape avec son budget par image. Un tronçon n'est décoré que si ses huit
  voisins ont leur relief, et n'est maillé que si ses quatre voisins sont
  éclairés : pas de couture visible ni d'arbre coupé en deux.
- **Repère du monde** : yaw 0 regarde vers +Z, l'avant vaut
  (−sin yaw·cos pitch, sin pitch, cos yaw·cos pitch), et la droite de la caméra
  (−cos yaw, 0, −sin yaw) — face au sud, l'ouest est à droite, comme dans le
  jeu. Le déplacement, le lancer de rayon, l'orientation des créatures et la
  matrice de vue suivent tous cette convention.
- **Lumière** : BFS d'ajout et de retrait, amorcé uniquement le long des parois
  (ailleurs le ciel est déjà à 15) — c'est ce qui fait tenir l'éclairage d'un
  tronçon en quelques millisecondes.

## Tests

```bash
npm run test:minecraft
```

41 tests couvrent la reproductibilité du monde, la répartition des minerais, les
durées de cassage, les paliers d'outils, les recettes, les inventaires, la
propagation et le retrait de la lumière, les collisions, l'écoulement de l'eau,
la gravité du sable, le four, la pousse du blé, l'élagage des faces, la
sauvegarde différentielle, le décor des biomes, les structures et leur butin, l'absence
d'apparitions dans l'eau, et **l'accord entre la caméra et le viseur** — la matrice de vue et le vecteur de visée s'étaient un jour
retrouvés opposés, et le viseur désignait alors un bloc dans le dos du joueur.

---

Projet indépendant, à but pédagogique ; sans lien avec Mojang ni Microsoft.
