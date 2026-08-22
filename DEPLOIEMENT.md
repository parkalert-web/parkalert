# Mettre le serveur en service

Le code du serveur est écrit et testé. Il reste **deux choses que je ne peux pas faire à votre
place** — elles demandent votre carte bancaire et votre compte Google.

Tant que ces deux étapes ne sont pas faites, **l'application continue de fonctionner exactement
comme aujourd'hui**. Rien ne casse : le téléphone du conducteur qui part continue de chercher
lui-même, comme avant. Le serveur prend la main tout seul le jour où il est déployé.

---

## Ce que le serveur change

| | Aujourd'hui | Avec le serveur |
|---|---|---|
| Qui cherche les conducteurs | le téléphone de celui qui part | le serveur |
| Faut-il garder l'application ouverte | **oui, des deux côtés** | non |
| Être prévenu qu'une place se libère | seulement si l'application est ouverte | **notification, même téléphone verrouillé** |
| Publiable sur un magasin d'applications | non | oui |

C'est le verrou qui empêchait ParkAlert d'être une vraie application. Il saute ici.

---

## Étape 1 — Activer le plan « Blaze » sur Firebase

Les fonctions serveur ne sont pas disponibles sur le plan gratuit. Il faut passer au plan
**Blaze**, qui demande une carte bancaire mais **facture à l'usage, avec un palier gratuit très
large** : deux millions d'appels de fonctions par mois sont offerts. À l'échelle de ParkAlert
aujourd'hui, la facture sera de zéro.

1. Ouvrez <https://console.firebase.google.com/project/parking-98737/usage/details>
2. Cliquez sur **Modifier le forfait** puis choisissez **Blaze**
3. Suivez les étapes (carte bancaire, pays de facturation)
4. **Important** : sur la même page, définissez une **alerte de budget** à 5 € par mois.
   Vous serez prévenu par e-mail bien avant toute dépense réelle.

> Si vous préférez ne pas donner de carte bancaire pour l'instant, ne faites rien :
> l'application reste en ligne et fonctionne comme aujourd'hui.

---

## Étape 2 — Déployer

### La méthode simple, à faire une fois

Sur votre ordinateur, dans un terminal, placez-vous dans le dossier du projet et lancez :

```bash
npx firebase login          # ouvre votre navigateur, connectez-vous avec votre compte Google
npx firebase deploy --only functions,database
```

C'est tout. Le déploiement prend deux à trois minutes. Vous verrez défiler le nom des quatre
fonctions, puis un message de réussite.

La deuxième commande envoie aussi les **règles de sécurité** de la base : c'est ce qui referme
la base, comme discuté. Vous n'avez donc plus besoin de les copier à la main dans la console.

### Vérifier que ça a marché

Ouvrez <https://console.firebase.google.com/project/parking-98737/database/parking-98737-default-rtdb/data>
et cherchez, après avoir annoncé un départ depuis l'application, une clé `config` contenant
`serverMatching: true`. C'est le serveur qui l'a écrite lui-même : c'est le signe qu'il tourne.

Les notifications, elles, se mettent en place toutes seules : le serveur fabrique ses propres
clés au premier envoi. **Il n'y a aucune clé à recopier d'une console à l'autre.**

### Redéployer plus tard

Après toute modification du serveur, la même commande suffit :

```bash
npx firebase deploy --only functions
```

---

## Ce qui a été vérifié, et ce qui ne l'a pas été

**Vérifié**, contre une vraie base de données lancée en local (`npm run test:server`) :

- le bon conducteur est choisi, dans le bon ordre de priorité ;
- un seul conducteur est sollicité à la fois ;
- un refus fait passer au suivant, et celui qui a refusé n'est pas resollicité ;
- le serveur ne réserve **jamais** à la place du conducteur qui part : il lui présente le candidat ;
- une proposition restée sans réponse libère la place ;
- une recherche périmée et une voiture qui ne rentre pas sont écartées ;
- les deux moments clés d'une réservation déclenchent bien une notification.

**Non vérifié ici**, parce que cela demande un projet Firebase payant :

- le branchement des déclencheurs Firebase eux-mêmes (la partie déclarative, standard) ;
- l'envoi réel d'une notification jusqu'à un téléphone.

Ces deux points se vérifient en cinq minutes après le premier déploiement : annoncez un départ
depuis un téléphone, avec un autre téléphone en recherche à proximité, et regardez si la
notification arrive sur le second alors que son application est fermée.

---

## Si quelque chose se passe mal

Le serveur peut être **arrêté à tout moment sans rien casser** :

```bash
npx firebase functions:delete onSpotChanged onOfferAnswered sweep onSessionChanged
```

Puis, dans la base, passez `config/serverMatching` à `false`. L'application reprend
immédiatement son ancien fonctionnement.

---

## Le chantier suivant

Les points et la fiabilité sont encore calculés sur le téléphone. Les garde-fous du cahier des
charges (proximité GPS obligatoire, double confirmation, 30 minutes entre deux récompenses,
24 heures avec le même partenaire) rendent la triche coûteuse, mais un utilisateur déterminé
peut encore manipuler son score.

Les déplacer côté serveur est le chantier suivant : il demande de refermer l'écriture des points
dans les règles de sécurité, ce qui ne peut se faire qu'une fois le serveur en service. C'est
pour cela que ça vient après, et pas avant.
