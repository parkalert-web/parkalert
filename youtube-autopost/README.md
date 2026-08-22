# Shorts automatiques — un Short par jour, avec un titre qui change

Un robot qui publie **une de vos vidéos par jour** sur votre chaîne YouTube,
avec un **titre différent à chaque fois**, sans que vous ayez à toucher à quoi
que ce soit. Vous déposez vos Shorts d'avance, il s'occupe du reste.

```
   vos vidéos              GitHub Actions              YouTube
  videos/*.mp4   ──────►   tous les jours à   ──────►  Short publié
                            l'heure choisie             titre généré
```

## C'est vraiment gratuit ?

| Brique | Service | Coût |
|---|---|---|
| L'horloge (déclencher tous les jours) | GitHub Actions | gratuit (2 000 min/mois en privé, illimité en public) |
| L'envoi sur YouTube | API YouTube Data v3 | gratuit (10 000 unités/jour = 6 envois) |
| Le stockage des vidéos | le dépôt GitHub, ou Google Drive | gratuit |
| La console de réglage | GitHub Pages | gratuit |

Aucun serveur à louer, aucune carte bancaire, aucune dépendance npm à installer.
Une exécution dure moins d'une minute : environ **30 minutes par mois** sur les
2 000 offertes.

---

## Mise en service (une seule fois, ~20 minutes)

### 1. Créer le projet Google

1. Ouvrez [console.cloud.google.com](https://console.cloud.google.com/) avec le
   **compte Google qui possède la chaîne YouTube**.
2. Créez un projet (nom libre, par exemple « Shorts auto »).
3. *API et services → Bibliothèque* → cherchez **YouTube Data API v3** → **Activer**.

### 2. Régler l'écran de consentement

*API et services → Écran de consentement OAuth*

- Type d'utilisateur : **Externe**.
- Remplissez le minimum (nom de l'application, votre e-mail).
- **Puis cliquez sur « Publier l'application »** pour passer en mode *Production*.

> ⚠ **L'étape la plus importante.** Tant que l'application reste en mode
> « Test », Google **invalide l'autorisation au bout de 7 jours** et le robot
> s'arrête. En mode Production, elle est valable indéfiniment. Vous n'avez
> **pas** besoin d'une validation Google : l'écran « application non validée »
> à la connexion est normal, c'est votre propre application.

### 3. Créer les identifiants

*API et services → Identifiants → Créer des identifiants → ID client OAuth*

- Type d'application : **Application Web**.
- Dans *URI de redirection autorisés*, ajoutez ces deux adresses :
  - `https://developers.google.com/oauthplayground`
  - `http://localhost:8787/`
- Notez l'**ID client** et le **code secret du client**.

### 4. Récupérer le jeton d'autorisation

C'est l'étape qui autorise le robot à publier sur *votre* chaîne. Deux chemins
au choix, le premier ne demande rien d'installé.

#### A. Dans le navigateur (recommandé si vous n'êtes pas à l'aise avec un terminal)

1. Ouvrez [Google OAuth Playground](https://developers.google.com/oauthplayground/).
2. Cliquez sur la **roue dentée ⚙** en haut à droite et réglez :
   - *OAuth flow* : **Server-side**
   - *Access type* : **Offline** ← indispensable, c'est ce qui produit le jeton durable
   - cochez **Use your own OAuth credentials**, puis collez votre ID client et
     votre code secret.
3. Dans le champ de gauche *« Input your own scopes »*, collez exactement :
   `https://www.googleapis.com/auth/youtube.upload`
   puis **Authorize APIs**.
4. Connectez-vous avec le compte Google **de la chaîne**, acceptez (l'écran
   « application non validée » est normal : c'est la vôtre → *Paramètres
   avancés* → *Accéder à …*).
5. De retour sur la page, cliquez **Exchange authorization code for tokens**.
6. Copiez la valeur de **Refresh token** (elle commence par `1//`).

#### B. Depuis votre ordinateur

Il vous faut [Node.js](https://nodejs.org/) 20 ou plus :

```bash
git clone https://github.com/parkalert-web/parkalert.git
cd parkalert
npm run yt:auth
```

Le script demande vos deux identifiants, ouvre la page Google et affiche le
jeton à la fin.

### 5. Donner les clés à GitHub

Sur GitHub : *Settings → Secrets and variables → Actions → New repository secret*.
Créez **trois** secrets, exactement avec ces noms :

| Nom | Valeur |
|---|---|
| `YT_CLIENT_ID` | l'ID client de l'étape 3 |
| `YT_CLIENT_SECRET` | le code secret de l'étape 3 |
| `YT_REFRESH_TOKEN` | le *Refresh token* de l'étape 4 |

Ces valeurs ne sont jamais visibles dans le dépôt, ni dans les journaux d'exécution.

### 6. Déposer les vidéos

Glissez vos fichiers dans [`videos/`](videos/) — sur github.com, bouton
*Add file → Upload files*. Le robot en prend une par jour, dans l'ordre
alphabétique. Voir [videos/README.md](videos/README.md) pour nommer vos fichiers.

### 7. Mettre en route

Fusionnez la branche de travail dans `main` : **une tâche planifiée n'existe
pour GitHub que si le fichier se trouve sur la branche par défaut.**

Puis testez tout de suite, sans attendre demain :
*onglet **Actions** → « Short quotidien » → **Run workflow***.
Cochez « Essai à blanc » pour voir le titre choisi sans rien publier ; relancez
sans la case pour publier pour de vrai.

---

## Au quotidien

| Ce que vous voulez faire | Où |
|---|---|
| Ajouter des vidéos | glisser des fichiers dans `videos/` |
| Changer les titres | `config.json`, ou la [console de réglage](https://parkalert-web.github.io/parkalert/youtube-autopost/) |
| Changer l'heure de publication | ligne `cron` de [`.github/workflows/short-quotidien.yml`](../.github/workflows/short-quotidien.yml) |
| Voir ce qui a été publié | `state.json`, ou l'onglet *Actions* |
| Publier une vidéo tout de suite | *Actions → Short quotidien → Run workflow* |
| Mettre en pause | *Actions → Short quotidien → « … » → Disable workflow* |

**L'heure est en UTC**, pas en heure de Paris : `0 17 * * *` = 19 h l'été,
18 h l'hiver. GitHub peut décaler le départ de quelques minutes en cas de charge.

### En local, avant de publier

```bash
npm run yt:check      # vérifie les accès Google et compte les vidéos en attente
npm run yt:preview    # affiche les 30 prochains titres
npm run yt:dry        # simule la publication du jour (n'envoie rien)
npm run test:yt       # lance les tests
```

---

## Comment les titres varient

Un titre = un **modèle** dont chaque `{variable}` est tirée dans une liste :

```
"{accroche} : {sujet} en {duree} {emoji}"
   ↓            ↓          ↓        ↓
"À tester d'urgence : se garer à Paris en 30 secondes 🔥"
```

- `{sujet}` vient du **nom du fichier vidéo** (`01_se-garer-a-paris.mp4` →
  « se garer a paris »), ou de la fiche `.json` de la vidéo ;
- `{numero}`, `{jour}`, `{date}`, `{mois}` sont automatiques ;
- toutes les autres variables sont les vôtres, dans `titre.variables`.

Le robot **énumère tous les titres possibles** et écarte ceux déjà publiés : un
titre ne peut donc pas revenir tant qu'il en reste un seul d'inédit. La
configuration livrée donne **94 titres**, soit trois mois sans répétition.

> Deux titres qui ne diffèrent que par un emoji ou la ponctuation comptent pour
> **un seul** — c'est ainsi qu'un spectateur les perçoit. Pour gagner en variété,
> ajoutez des accroches, ou un modèle qui **croise deux variables** :
> `{accroche} : {sujet} en {duree}` fabrique à lui seul 7 × 4 = 28 titres.

La [console de réglage](https://parkalert-web.github.io/parkalert/youtube-autopost/)
affiche en direct le nombre de jours sans répétition et les 30 prochains titres.

---

## Réglages (`config.json`)

| Clé | Rôle |
|---|---|
| `source` | `"depot"` (fichiers du dépôt) ou `"drive"` (dossier Google Drive) |
| `dossierVideos` | dossier de la file d'attente |
| `driveDossierId` | identifiant du dossier Drive (dans son URL, après `/folders/`) |
| `publication.confidentialite` | `public`, `unlisted` (non répertoriée) ou `private` |
| `publication.categorieId` | catégorie YouTube (`22` = People & Blogs, `24` = Divertissement) |
| `publication.pourEnfants` | déclaration « contenu conçu pour les enfants » |
| `publication.notifierAbonnes` | prévenir les abonnés à chaque publication |
| `titre.modeles` | les modèles de titres |
| `titre.variables` | les listes de valeurs |
| `titre.sujetParDefaut` | sujet utilisé si le nom du fichier ne dit rien |
| `titre.longueurMax` | 100 au maximum (limite YouTube) |
| `titre.eviterRepetitionJours` | durée pendant laquelle un titre ne peut pas revenir |
| `description.modeles` | descriptions possibles (`{titre}`, `{sujet}` disponibles) |
| `description.signature` | texte ajouté à la fin de chaque description |
| `tags` | mots-clés ajoutés à toutes les vidéos |
| `quandLaFileEstVide` | `"echouer"` (GitHub vous envoie un mail) ou `"ignorer"` |

Pour régler **une** vidéo en particulier (titre imposé, description sur mesure),
posez une fiche `.json` à côté d'elle : voir [videos/README.md](videos/README.md).

### Passer par Google Drive

Pratique si vous montez vos Shorts sur téléphone, ou si vos fichiers dépassent
les 25 Mo autorisés par le site github.com :

1. `"source": "drive"` et `"driveDossierId": "…"` dans `config.json` ;
2. `npm run yt:auth` à nouveau (l'autorisation doit inclure la lecture de Drive).

Le dossier Drive devient la file d'attente ; rien n'y est modifié ni supprimé,
le suivi se fait dans `state.json`.

---

## Ce qu'il faut savoir avant de se lancer

**Vos vidéos risquent d'arriver en « privé ».** YouTube impose que toute vidéo
envoyée par un projet API **non audité** reste privée, quelle que soit la
confidentialité demandée. C'est gratuit à lever : remplissez le
[formulaire d'audit YouTube API](https://support.google.com/youtube/contact/yt_api_form).
Le robot vous prévient dans son journal si la vidéo n'a pas la confidentialité
demandée. En attendant la réponse, deux options : publier en `private` et rendre
public à la main, ou attendre l'audit.

**Ce qui fait un Short**, c'est la vidéo elle-même : format vertical (9:16) et
**moins de 3 minutes**. YouTube le détecte tout seul, il n'y a rien à cocher —
le `#shorts` de la description ne fait qu'aider.

**Six envois par jour au maximum** : chaque envoi coûte 1 600 unités sur les
10 000 gratuites. Une publication par jour ne pose donc aucun problème.

**Ne republiez pas la même vidéo en boucle.** YouTube sanctionne le contenu
réutilisé ; c'est pourquoi le robot **échoue volontairement** quand la file est
vide plutôt que de recycler. Vous recevez alors le mail d'échec de GitHub :
c'est votre rappel de réapprovisionner.

**GitHub met en pause les tâches planifiées** d'un dépôt resté 60 jours sans
activité. Chaque publication produisant un commit, le compteur repart à zéro
tout seul — sauf si la file reste vide très longtemps.

**Le dépôt est public**, donc les vidéos en attente le sont aussi (elles vont de
toute façon sur YouTube). Vos clés, elles, sont dans les Secrets GitHub et ne
sont jamais publiées. Si le dépôt est privé, le quota des 2 000 minutes s'applique.

---

## Dépannage

| Message | Cause et remède |
|---|---|
| `invalid_grant` | Écran de consentement resté en mode « Test » (jeton mort au bout de 7 jours) → passez en Production, puis refaites l'étape 4 pour obtenir un nouveau jeton. |
| `invalid_client` | `YT_CLIENT_ID` ou `YT_CLIENT_SECRET` mal recopié. |
| `Accès refusé par YouTube (403)` | L'API YouTube Data v3 n'est pas activée dans le projet Google Cloud. |
| `youtubeSignupRequired` | Le compte Google n'a pas de chaîne YouTube. |
| `Quota YouTube épuisé` | Plus de 6 envois dans la journée : ça repart demain. |
| `File d'attente vide` | Déposez de nouvelles vidéos dans `videos/`. |
| La tâche ne se déclenche jamais | Le fichier n'est pas sur la branche par défaut, ou la tâche a été mise en pause après 60 jours d'inactivité. |
| Vidéo publiée en privé | Restriction des projets API non audités (voir ci-dessus). |
| `redirect_uri_mismatch` | L'URI de redirection de l'étape 3 n'est pas exactement celle attendue (pas d'espace, pas de `/` en trop). |

---

## Déplacer l'outil dans son propre dépôt

Tout est contenu dans ce dossier, sauf le fichier de la tâche planifiée. Pour un
dépôt dédié, copiez `youtube-autopost/` à la racine du nouveau dépôt et
`.github/workflows/short-quotidien.yml` au même chemin, puis remplacez
`youtube-autopost/` par `.` dans les chemins du workflow. Recréez les trois
secrets et c'est reparti.

## Ce que contient ce dossier

| Fichier | Rôle |
|---|---|
| `src/publish.mjs` | le robot : choisit la vidéo, compose le titre, envoie |
| `src/titles.mjs` | la fabrique de titres (partagée avec la console) |
| `src/queue.mjs` | la file d'attente (dépôt ou Drive) |
| `src/youtube.mjs` | l'envoi à l'API YouTube, avec reprise en cas de coupure |
| `src/google.mjs` | l'authentification Google |
| `src/config.mjs` | lecture et validation de `config.json` |
| `src/authorize.mjs` | l'assistant d'autorisation (`npm run yt:auth`) |
| `index.html` | la console de réglage des titres |
| `config.json` | vos réglages |
| `state.json` | l'historique, écrit par le robot |
| `tests/` | les tests (`npm run test:yt`) |
