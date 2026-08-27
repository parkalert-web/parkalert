# ParkAlert

Application collaborative de **transmission de places de stationnement** entre conducteurs.

> J'aide les autres → je gagne des points → je suis prioritaire quand j'ai besoin d'une place.

ParkAlert n'est pas un simple signalement de places : quand une place est réservée, celui qui
part **attend** le conducteur sélectionné, et la transmission est **confirmée des deux côtés**.

**En ligne :** https://parkalert-web.github.io/parkalert/

---

## Hébergement : entièrement gratuit

| Brique | Service | Coût |
|---|---|---|
| Site (HTML/CSS/JS statiques) | GitHub Pages | gratuit |
| Comptes et synchronisation temps réel | Firebase Auth + Realtime Database (plan Spark) | gratuit |
| Fond de carte | tuiles OpenStreetMap | gratuit |
| Recherche d'adresse | Nominatim (OpenStreetMap) | gratuit |

Il n'y a **aucun serveur applicatif à héberger** : la mise en relation est déroulée par le
téléphone du conducteur qui donne sa place, puisque c'est lui qui la possède et qu'il est
forcément présent au moment de la transmission.

L'application est une **PWA** : depuis le navigateur mobile, « Ajouter à l'écran d'accueil »
l'installe comme une application, avec son icône et son écran de démarrage.

---

## Mise en ligne

Le site est déjà publié par GitHub Pages depuis la branche `main`, à la racine du dépôt.
Pour publier une nouvelle version, il suffit donc de **fusionner la branche de travail dans
`main`** : Pages redéploie tout seul en une à deux minutes.

Rien d'autre à faire : pas de build, pas de dépendance à installer, pas de clé secrète.

### Réglages Firebase à vérifier une fois

Dans la [console Firebase](https://console.firebase.google.com/project/parking-98737) :

1. **Authentication → Sign-in method** : activer *E-mail/Mot de passe* (obligatoire),
   *Google* et *Anonyme* (pour le bouton « Essayer en invité »).
2. **Authentication → Settings → Authorized domains** : ajouter `parkalert-web.github.io`,
   sinon la connexion Google échouera depuis le site publié.
3. **Realtime Database → Règles** : y coller le contenu de [`database.rules.json`](database.rules.json).

> ⚠️ **À faire en priorité, et c'est gratuit** — voir [`DEPLOIEMENT.md`](DEPLOIEMENT.md).
> Tant que ce n'est pas fait, la base est ouverte en lecture et en écriture à
> tout Internet, et Firebase envoie des e-mails d'alerte. Les règles fournies exigent un compte, limitent chaque utilisateur à ses
> propres données et réservent une réservation à ses deux participants.
>
> Ces règles n'ont pas pu être déployées depuis ce dépôt (cela demande un accès administrateur
> au projet Firebase), mais elles sont **testées** : `npm run test:rules` rejoue 13 scénarios
> contre une vraie base locale, en vérifiant à la fois ce qui doit être bloqué et le fait que
> le parcours complet des deux conducteurs marche toujours.

### Mise en relation : téléphone ou serveur

L'application fonctionne dans **deux modes**, et bascule toute seule de l'un à l'autre :

| | Sans serveur déployé | Avec le serveur |
|---|---|---|
| Qui cherche les conducteurs | le téléphone de celui qui part | les fonctions Firebase |
| Faut-il garder l'application ouverte | oui, des deux côtés | non |
| Notification place fermée | non | oui |

Le serveur se signale lui-même en écrivant `config/serverMatching` à `true` au premier
événement traité ; l'application lit ce drapeau et lui laisse la main. Tant qu'il n'est pas
déployé, rien ne change — voir [`DEPLOIEMENT.md`](DEPLOIEMENT.md).

### Limite assumée du plan gratuit

Sans Cloud Functions (qui exigent le plan Blaze), les points et la fiabilité sont calculés
côté client. Les règles bornent les dégâts possibles, mais un utilisateur déterminé peut
encore manipuler son score. Les garde-fous du §30 (proximité GPS obligatoire, double
confirmation, 30 minutes entre deux récompenses, 24 heures entre deux récompenses avec le
même partenaire) rendent la triche coûteuse plutôt qu'impossible. Le passage d'une partie
du calcul côté serveur est le premier chantier à ouvrir si l'application est déployée à
grande échelle.

---

## Architecture

```
index.html            coquille de l'application (aucune logique)
confidentialite.html  politique de confidentialité et mentions légales
styles.css            feuille de style unique
manifest.webmanifest  déclaration PWA
sw.js                 service worker (démarrage rapide, installation)
database.rules.json   règles de sécurité de la base temps réel

src/
  config.js     toutes les constantes de calibration (§7 : à ajuster pendant les tests)
  ui.js         briques d'interface : feuilles modales, sélecteurs, notifications
  vehicles.js   base automobile (210 modèles, cotes constructeur) + identification assistée
  core.js       logique pure : compatibilité, priorités, points, fiabilité — testée
  backend.js    accès Firebase (authentification, base temps réel)
  state.js      état partagé et suivi GPS
  session.js    cycle de vie d'une réservation, partage de position temporaire
  give.js       parcours de celui qui donne sa place
  seek.js       parcours de celui qui cherche une place
  profile.js    profil, véhicules, réglages
  panel.js      rendu du panneau d'action
  mapview.js    carte, marqueurs, géocodage
  app.js        amorçage
  push.js       abonnement aux notifications, même application fermée

functions/      serveur (voir DEPLOIEMENT.md)
  index.js      déclencheurs Firebase — aucune règle métier
  matching.js   choix du conducteur, réponses, nettoyage — testé
  push.js       envoi des notifications (clés VAPID fabriquées toutes seules)
  shared/       copie de src/core.js et src/config.js, synchronisée
```

### Le principe de la mise en relation

1. Le donneur annonce son départ : sa place est écrite dans `spots/{uid}`.
2. Son téléphone lit les chercheurs actifs (`seekers`), applique les **quatre critères
   obligatoires** du §12, puis ordonne les candidats (points, ou temps d'arrivée en cas
   d'urgence).
3. Il « réserve » l'attention du premier candidat via une transaction sur `offers/{uid}` :
   un conducteur ne reçoit jamais deux propositions en même temps.
4. Sans réponse dans le délai imparti, la proposition passe au suivant.
5. Après double accord, une `sessions/{id}` est créée : c'est le contrat entre les deux
   conducteurs, et le seul endroit où leurs positions sont partagées — temporairement.

---

## Ce que couvre l'application

Le MVP décrit au §37 du cahier des charges est intégralement implémenté.

| § | Fonction | Où |
|---|---|---|
| 3 | Pseudonyme, points d'entraide, indice de fiabilité | `profile.js`, `core.js` |
| 4 | Identification du véhicule assistée, dimensions issues d'une base réelle | `vehicles.js` |
| 5 | Place nécessaire déduite des dimensions du véhicule | `core.js`, `config.js` |
| 6 | Qualification de la place, maintenant ou plus tard | `give.js` |
| 7 | Croisement des deux estimations, calibration centralisée | `core.js`, `config.js` |
| 8-9 | Recherche autour d'une destination, rayon intelligent | `seek.js`, `core.js` |
| 10-11 | « Je pars dans X minutes », rappel avant de monter en voiture | `give.js` |
| 12-14 | Critères obligatoires, priorité aux points, exception « Maintenant » | `core.js` |
| — | À points égaux, la place va au plus grand véhicule qui y rentre | `core.js` |
| 15-17 | Proposition, acceptation, reconnaissance par modèle et couleur | `give.js`, `seek.js` |
| 18-19 | Géolocalisation temporaire réciproque, position approximative avant le départ | `session.js` |
| 20-22 | « Je suis prêt », ne pas bloquer la rue, détection de proximité | `give.js`, `seek.js` |
| 23-24 | Tolérance de 2 minutes, prolongation, réattribution urgente | `give.js` |
| — | Rappel « continuer d'attendre ou partir ? » toutes les minutes | `give.js` |
| — | Correction de l'heure d'arrivée par celui qui roule | `seek.js` |
| 25-27 | Annulations graduées, « je ne peux pas me garer », reproposition ciblée | `seek.js`, `give.js` |
| 28-30 | Double confirmation, attribution des points, anti-triche | `give.js`, `core.js` |
| — | Une seule récompense par binôme, définitivement | `core.js`, `give.js` |
| 31 | Fiabilité : seule la répétition est sanctionnée | `core.js` |
| 32-33 | Signalement de place libre, départ sans attendre | `give.js` |
| 34 | Gros boutons, très peu de saisie, une décision par écran | `styles.css`, `panel.js` |

### Choix explicites, à calibrer pendant les tests

Le cahier des charges laisse volontairement plusieurs valeurs ouvertes (§7, §15, §22, §29).
Elles sont toutes regroupées dans [`src/config.js`](src/config.js) :

| Réglage | Valeur retenue | Référence |
|---|---|---|
| Place nécessaire pour se garer | longueur + 15 %, minimum +45 cm | §5 |
| Longueur de place estimée | véhicule du donneur + Serré/Normal/Large | §6-7 |
| Délai de réponse à une proposition | 45 s | §15 |
| Rayon de confirmation d'arrivée | 40 m | §22 |
| Tolérance de retard | 2 min | §23 |
| Points par transmission validée | +10 | §29 |
| Anti-triche | 30 min entre deux récompenses · une seule par binôme | §30 |
| Délai de décision du donneur | 120 s, puis 2 tentatives | — |
| Rappel au conducteur qui attend | 60 s | — |
| Reports d'arrivée autorisés | 2 | — |
| Estimation de trajet | 20 km/h, détour ×1,35, +1 min de manœuvre | §38 |

### Deux écarts assumés par rapport au cahier des charges

**La taille de place ne se choisit plus (§5).** Le cahier des charges laissait le conducteur
qui cherche choisir « Serré / Normal / À l'aise ». À l'usage, cela permettait à une petite
voiture de réclamer une grande place « pour être à l'aise », et de bloquer un créneau dont
une autre voiture avait réellement besoin. La place nécessaire est donc maintenant **déduite
des dimensions du véhicule** : longueur + 15 %, avec un minimum de 45 cm — un créneau se
prend en biais, et plus la voiture est longue, plus il lui faut de débattement.

| Véhicule | Longueur | Place nécessaire |
|---|---|---|
| Citroën Ami | 2,41 m | 2,86 m |
| Fiat 500 | 3,57 m | 4,11 m |
| Peugeot 208 | 4,06 m | 4,67 m |
| Renault Captur | 4,23 m | 4,86 m |
| Tesla Model Y | 4,75 m | 5,46 m |

Le conducteur n'a donc plus aucune question à se poser, et une petite voiture ne peut plus
occuper la place d'une grande. Le ratio et le minimum vivent dans `TUNING.manoeuvre`.

En revanche, **celui qui donne décrit toujours sa place** (§6) : là il ne s'agit pas d'une
préférence mais d'une observation — l'espace réellement libre autour de sa voiture — et elle
reste indispensable pour estimer la longueur du créneau.

**Une seule récompense par binôme, pour toujours (durcissement du §30).** Le cahier des charges
prévoyait 24 heures entre deux récompenses avec le même partenaire. C'était trop faible : deux
amis pouvaient se passer la même place tous les jours. Désormais **la première transmission avec
une personne donnée est la seule qui rapporte des points**, définitivement. La marque est écrite
des deux côtés, donc le binôme ne rapporte qu'une fois quel que soit celui qui donne sa place.

Contrepartie assumée : deux voisins qui s'entraident réellement toutes les semaines ne seront
récompensés qu'une fois. Le réglage vit dans `TUNING.antiFraud.rewardOncePerPartner`.

**À points égaux, la grande voiture passe devant (ajout au §13).** Une grande voiture trouve
beaucoup plus rarement un créneau à sa taille ; une petite se contentera d'une place où la
grande n'entrerait pas. Envoyer une petite voiture sur une grande place gâche donc la seule
place utilisable par la grande. Ce critère **n'arbitre qu'une égalité** : un seul point d'écart
suffit pour que les points l'emportent, conformément au principe du §13. Il s'applique aussi en
mode urgent, après le temps d'arrivée et les points.

**L'interface est en casse normale, sans références au cahier des charges.** Les libellés
tout en capitales et les renvois « (§29) » ont été retirés des écrans : ils restent dans les
commentaires du code, où ils servent à retrouver la règle d'origine.

### Deux garde-fous de temps, côté conducteurs

**Celui qui attend n'attend jamais en aveugle.** Une fois le moment du départ venu — départ
« Maintenant », ou délai annoncé écoulé — l'application redonne la main toutes les minutes :
*continuer d'attendre, ou partir*. Tant que le délai annoncé court, elle ne dérange pas : le
conducteur vaque encore à ses occupations, il n'attend pas dans sa voiture.

**Celui qui roule peut corriger son heure.** Un embouteillage, un feu, ou au contraire une route
dégagée : le temps d'arrivée annoncé se rectifie en deux appuis, et celui qui attend est prévenu
tout de suite — y compris application fermée. Repousser son arrivée reste limité à deux fois :
sans cela, on pourrait faire attendre quelqu'un indéfiniment en décalant l'heure à chaque fois.

### Parti pris d'interface

- police du système, pour un rendu natif sur chaque téléphone ;
- une seule couleur d'accent, aucun dégradé, aucune lueur ;
- thème clair et thème sombre, choisis d'après le réglage du téléphone ;
- un écran répond à une seule question : l'information utile est en gros, le reste tient
  en une phrase, et il n'y a jamais plus d'une action principale ;
- la légende de la carte et les compteurs ne sont plus affichés en permanence.

### Ce qui reste côté conformité

- la politique de confidentialité attend l'identité réelle de l'éditeur ;
- les points et la fiabilité sont encore calculés côté client. Les règles empêchent un tiers
  d'effacer la marque « déjà récompensé avec cette personne », mais **le propriétaire du compte
  peut encore effacer la sienne** : seule une écriture réservée au serveur ferme définitivement
  la porte. C'est le chantier qui suit la mise en service du serveur.

### Reste à faire (§38)

Calcul routier tenant compte des sens uniques et du trafic ; détection automatique du
stationnement ; base automobile plus complète ; notifications *push* quand l'application est
fermée ; réglage fin des seuils à partir des retours réels.

---

## Second outil : « En commun » — comparer des emplois du temps

**En ligne :** https://parkalert-web.github.io/parkalert/edt/ — [`edt/index.html`](edt/index.html)

On importe la photo de l'emploi du temps de chacun, on corrige ce que la lecture a raté,
et l'outil dit ce que les personnes ont **en commun** : les heures de cours simultanées, les
trous partagés, les déjeuners possibles ensemble, les journées qui commencent ou finissent à
la même heure, les professeurs et les matières partagés, et les cours où l'on est visiblement
assis dans la même salle.

### Lire une photo sans IA et sans serveur

| Étape | Moyen | Coût |
|---|---|---|
| Redressement, contraste, ombres | canevas HTML, seuillage local (image intégrale) | gratuit |
| Reconnaissance du texte | [Tesseract](https://tesseract-ocr.github.io/) en WebAssembly, dans le navigateur | gratuit |
| Dictionnaire français | `tessdata` officiel, téléchargé une fois puis gardé par le navigateur | gratuit |
| Reconstruction de la grille | géométrie et expressions régulières ([`src/edt/parse.js`](src/edt/parse.js)) | gratuit |

Aucun service d'intelligence artificielle n'est appelé : **ni clé d'API, ni quota, ni facture**.
Les photos ne quittent jamais l'appareil, il n'y a pas de compte, et tout est enregistré dans
le navigateur (`localStorage`). Le bouton « Exporter » produit un fichier que l'on peut
s'échanger : l'autre le réimporte et compare, sans avoir à refaire de photo.

### Comment la grille est reconstituée

1. La photo est mise à l'échelle, redressée (l'angle est mesuré sur la densité des lignes de
   texte) puis binarisée par seuillage **local**, ce qui rattrape une feuille à moitié dans l'ombre.
2. Tesseract est lancé en mode « texte épars » : un emploi du temps n'est pas un bloc de texte
   mais des mots éparpillés dans des cases. Ce mode s'est révélé nettement plus fidèle
   (21 libellés sur 21 contre 19 en mode « bloc » sur la grille de test).
3. Les colonnes sont repérées sur les mots *Lundi*, *Mardi*… — avec une tolérance d'une lettre
   fausse, `VENDREOI` est reconnu.
4. L'axe des heures est ajusté sur la colonne de gauche par consensus (une heure mal lue est
   écartée au lieu de fausser toute la grille).
5. La durée d'un cours vient, dans l'ordre : du créneau écrit dans la case (`8h00-10h00`), sinon
   des traits du tableau **relevés colonne par colonne** — une case fusionnée n'a pas de trait
   au milieu, et c'est précisément ce qui indique un cours de deux heures — sinon de la position
   du texte, et l'outil signale alors que c'est une estimation.
6. Le contenu de la case est découpé en matière / professeur / salle.

### Ce que ça ne fait pas

La reconnaissance de caractères se trompe : un mot trop petit, une photo floue ou de travers, et
il manque une matière. C'est pour cela que **le tableau est modifiable** — c'est lui qui sert au
calcul, pas la photo — et qu'une capture d'écran (Pronote, ADE, EcoleDirecte) donne toujours un
meilleur résultat qu'une photo de papier. La saisie entièrement manuelle est possible aussi.

---

## Tests

```bash
npm test          # logique métier ParkAlert + lecture et comparaison des emplois du temps
npm run test:server   # mise en relation serveur, contre une vraie base locale
npm run test:rules    # règles de sécurité : ce qui est bloqué, ce qui marche encore
```

20 tests rejouent les exemples chiffrés du cahier des charges — dont le tableau du §13
(A/520 pts, B/300 pts, C/80 pts), l'exception « Maintenant » du §14, et le fait qu'une
petite voiture ne peut jamais réclamer la place d'une grande, ni la lui prendre à points égaux.

```bash
npm install --no-save playwright undici
npm run test:e2e  # trois scénarios sur plusieurs « téléphones » simulés
```

Les scénarios bout en bout pilotent la vraie application contre le vrai Firebase :

- `transfer.e2e.mjs` rejoue le scénario complet du §36, de l'annonce du départ jusqu'à
  l'attribution des points, et vérifie que « je ne peux pas me garer » est bien refusé
  tant que le GPS ne confirme pas l'arrivée ;
- `priority.e2e.mjs` vérifie sur trois téléphones que « Maintenant » privilégie le plus
  rapide même face à un conducteur bien mieux doté en points, et qu'un refus fait passer
  la proposition au candidat suivant ;
- `wait-eta.e2e.mjs` vérifie que le conducteur qui attend reprend la main tout seul, et que
  la correction d'heure d'arrivée remonte bien jusqu'à celui qui attend.

```bash
npm run test:edt  # « En commun » de bout en bout, avec la vraie OCR
```

`edt.e2e.mjs` **dessine** un emploi du temps dans une page (une grille comme celles que l'on
photographie), l'exporte en PNG et l'importe dans l'outil comme le ferait un utilisateur : la
chaîne réelle — préparation de l'image, Tesseract, reconstruction de la grille — doit retrouver
les neuf cours avec leurs horaires, leurs professeurs et leurs salles, sans couper le cours de
quatre heures du vendredi, puis la comparaison doit annoncer le bon trou commun et le bon
déjeuner. Aucune capture de référence n'est comparée : ce sont les cours lus qui sont vérifiés.

Les comptes de test sont supprimés à la fin de chaque scénario.

`npm run test:server` lance l'émulateur Firebase en local — aucun compte, aucune facturation,
aucun accès réseau — et rejoue 11 scénarios de mise en relation contre une vraie base de
données : choix du conducteur, unicité de la sollicitation, passage au suivant après un refus,
le fait que le serveur ne réserve jamais à la place du conducteur qui part, et le déblocage
d'une place dont le donneur ne répond plus.

---

## Développement local

```bash
npm start   # http://localhost:8080
```

Un simple serveur de fichiers suffit — l'application n'a pas d'étape de compilation.
La géolocalisation exige un contexte sécurisé : `localhost` et `https://` conviennent.

Si votre réseau bloque les WebSockets, ajoutez `?transport=longpolling` à l'URL pour
basculer la base temps réel sur son mode de secours.
