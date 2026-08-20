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

> ⚠️ **À faire en priorité.** La base est actuellement ouverte en lecture et en écriture à
> tout Internet. Les règles fournies exigent un compte, limitent chaque utilisateur à ses
> propres données et réservent une réservation à ses deux participants.
>
> Ces règles n'ont pas pu être déployées depuis ce dépôt (cela demande un accès administrateur
> au projet Firebase). Avant de les publier, passez-les au « Rules Playground » de la console
> sur deux ou trois chemins typiques — `spots/<votre uid>`, `offers/<autre uid>`,
> `sessions/<id>` — puis rejouez le scénario complet à deux téléphones.

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
styles.css            feuille de style unique
manifest.webmanifest  déclaration PWA
sw.js                 service worker (démarrage rapide, installation)
database.rules.json   règles de sécurité de la base temps réel

src/
  config.js     toutes les constantes de calibration (§7 : à ajuster pendant les tests)
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
| 5 | Marge Serré / Normal / À l'aise / Personnalisé, mémorisée par véhicule | `core.js`, `pickers.js` |
| 6 | Qualification de la place, maintenant ou plus tard | `give.js` |
| 7 | Croisement des deux estimations, calibration centralisée | `core.js`, `config.js` |
| 8-9 | Recherche autour d'une destination, rayon intelligent | `seek.js`, `core.js` |
| 10-11 | « Je pars dans X minutes », rappel avant de monter en voiture | `give.js` |
| 12-14 | Critères obligatoires, priorité aux points, exception « Maintenant » | `core.js` |
| 15-17 | Proposition, acceptation, reconnaissance par modèle et couleur | `give.js`, `seek.js` |
| 18-19 | Géolocalisation temporaire réciproque, position approximative avant le départ | `session.js` |
| 20-22 | « Je suis prêt », ne pas bloquer la rue, détection de proximité | `give.js`, `seek.js` |
| 23-24 | Tolérance de 2 minutes, prolongation, réattribution urgente | `give.js` |
| 25-27 | Annulations graduées, « je ne peux pas me garer », reproposition ciblée | `seek.js`, `give.js` |
| 28-30 | Double confirmation, attribution des points, anti-triche | `give.js`, `core.js` |
| 31 | Fiabilité : seule la répétition est sanctionnée | `core.js` |
| 32-33 | Signalement de place libre, départ sans attendre | `give.js` |
| 34 | Gros boutons, très peu de saisie, une décision par écran | `styles.css`, `panel.js` |

### Choix explicites, à calibrer pendant les tests

Le cahier des charges laisse volontairement plusieurs valeurs ouvertes (§7, §15, §22, §29).
Elles sont toutes regroupées dans [`src/config.js`](src/config.js) :

| Réglage | Valeur retenue | Référence |
|---|---|---|
| Marges Serré / Normal / À l'aise | +30 / +50 / +100 cm | §5 |
| Longueur de place estimée | véhicule du donneur + même barème | §6-7 |
| Délai de réponse à une proposition | 45 s | §15 |
| Rayon de confirmation d'arrivée | 40 m | §22 |
| Tolérance de retard | 2 min | §23 |
| Points par transmission validée | +10 | §29 |
| Anti-triche | 30 min / 24 h | §30 |
| Estimation de trajet | 20 km/h, détour ×1,35, +1 min de manœuvre | §38 |

### Reste à faire (§38)

Calcul routier tenant compte des sens uniques et du trafic ; détection automatique du
stationnement ; base automobile plus complète ; notifications *push* quand l'application est
fermée ; réglage fin des seuils à partir des retours réels.

---

## Tests

```bash
npm test          # logique métier : compatibilité, priorités, points, fiabilité
```

18 tests rejouent les exemples chiffrés du cahier des charges — dont le tableau du §13
(A/520 pts, B/300 pts, C/80 pts) et l'exception « Maintenant » du §14.

```bash
npm install --no-save playwright undici
npm run test:e2e  # deux scénarios sur plusieurs « téléphones » simulés
```

Les scénarios bout en bout pilotent la vraie application contre le vrai Firebase :

- `transfer.e2e.mjs` rejoue le scénario complet du §36, de l'annonce du départ jusqu'à
  l'attribution des points, et vérifie que « je ne peux pas me garer » est bien refusé
  tant que le GPS ne confirme pas l'arrivée ;
- `priority.e2e.mjs` vérifie sur trois téléphones que « Maintenant » privilégie le plus
  rapide même face à un conducteur bien mieux doté en points, et qu'un refus fait passer
  la proposition au candidat suivant.

Les comptes de test sont supprimés à la fin de chaque scénario.

---

## Développement local

```bash
npm start   # http://localhost:8080
```

Un simple serveur de fichiers suffit — l'application n'a pas d'étape de compilation.
La géolocalisation exige un contexte sécurisé : `localhost` et `https://` conviennent.

Si votre réseau bloque les WebSockets, ajoutez `?transport=longpolling` à l'URL pour
basculer la base temps réel sur son mode de secours.
