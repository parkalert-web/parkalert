# Témoir

Tes vraies informations, saisies **une seule fois**, écrites **automatiquement**
dans n'importe quel formulaire, sur ton PC Windows.

Tu cliques dans un champ, tu fais `Ctrl+Alt+Espace`, tu tapes `code postal`,
tu appuies sur Entrée : ta vraie valeur s'écrit dans le champ. Même valeur à
chaque fois, sur tous les questionnaires.

---

## Ce que ça fait

- **Un profil local** avec tes informations réelles : identité, contact, foyer,
  vie quotidienne, véhicule, numérique. Une trentaine de champs sont déjà
  préparés (vides), tu ajoutes les tiens quand tu veux.
- **Recherche rapide par raccourci global** : elle s'ouvre par-dessus n'importe
  quelle application, écrit dans la fenêtre où tu étais, puis disparaît.
- **Valeurs recalculées, jamais contradictoires** : ton âge, ton année de
  naissance et ta tranche d'âge sont déduits de ta date de naissance. Tu ne peux
  pas répondre 34 ans un jour et 36 le lendemain — c'est calculé, pas stocké.
- **Vérification de cohérence** : doublons, date impossible, âge saisi à la main
  qui contredit ta date de naissance, champs encore vides.
- **Mémoire des réponses nouvelles** : une question inédite ? Tu tapes ta réponse
  une fois dans la recherche rapide, elle est enregistrée et réutilisée à
  l'identique ensuite.
- **100 % local** : un fichier JSON sur ton disque, aucune connexion réseau,
  aucun compte, aucun envoi.

Ce que ça ne fait **pas** : lire les questions à ta place ni valider un
formulaire tout seul. Tu lis, tu décides, Témoir écrit ce que tu as déjà répondu.

---

## Installation sur ton PC

### Option A — le plus simple (Python)

1. Installe Python depuis <https://www.python.org/downloads/windows/>
   en cochant **« Add python.exe to PATH »** pendant l'installation.
2. Copie le dossier `temoir` où tu veux.
3. Double-clique sur **`Lancer_Temoir.bat`**.

### Option B — un vrai `.exe` (aucun Python ensuite)

1. Fais l'option A une fois.
2. Double-clique sur **`Construire_exe.bat`**.
3. Récupère **`dist\Temoir.exe`** : tu peux le copier sur le bureau, une clé
   USB, un autre PC Windows.

Pour le lancer à chaque démarrage : `Win+R`, tape `shell:startup`, et glisse un
raccourci de `Temoir.exe` (ou de `Lancer_Temoir.bat`) dans le dossier qui s'ouvre.

---

## Utilisation

**La première fois**

Double-clique sur une ligne, tape ta vraie réponse, enregistre. Commence par la
**date de naissance** au format `JJ/MM/AAAA` : elle débloque l'âge, l'année et la
tranche d'âge automatiques.

**Ensuite, tous les jours**

1. Laisse Témoir ouvert (tu peux réduire la fenêtre, ou même la fermer : il
   continue en arrière-plan tant que le raccourci est actif).
2. Devant un formulaire, **clique dans le champ** à remplir.
3. `Ctrl+Alt+Espace`.
4. Tape un mot-clé (`ville`, `mail`, `age`, `banque`...), flèches pour choisir.
5. **Entrée** → la valeur s'écrit dans le champ.
   **Ctrl+Entrée** → elle est seulement copiée (Ctrl+V pour coller).
   **Échap** → on ferme, rien n'est écrit.

**Une question dont tu n'as pas encore la réponse ?**
Tape-la dans la recherche rapide (ex. `opérateur box internet`), choisis
« + Ajouter », saisis ta réponse : elle est écrite dans le champ **et** gardée
pour la prochaine fois.

---

## Réglages (menu Outils → Réglages)

| Réglage | À quoi ça sert |
|---|---|
| Raccourci global | `ctrl+alt+space` par défaut. Change-le s'il est déjà pris (`ctrl+shift+k`, `alt+f9`...). |
| Frappe / Collage | La **frappe** simule le clavier. Si une application l'ignore (émulateur Android, jeu, bureau à distance), bascule sur **collage Ctrl+V**. |
| Tab après remplissage | Passe automatiquement au champ suivant du formulaire. |
| Délai avant la frappe | Augmente-le (300–500 ms) si la fenêtre met du temps à revenir au premier plan. |

---

## Où sont mes données

`C:\Users\<toi>\AppData\Roaming\Temoir\profil.json`
(menu **Fichier → Ouvrir le dossier de mes données**)

Une sauvegarde `.bak` est gardée à chaque enregistrement. **Fichier → Exporter**
crée une copie que tu peux mettre sur une clé USB et réimporter sur un autre PC.

C'est un fichier en clair, sur ton disque : il contient tes informations
personnelles, ne le laisse pas traîner sur un ordinateur partagé.

---

## En cas de souci

| Problème | Solution |
|---|---|
| « raccourci inactif » en bas de la fenêtre | Un autre logiciel utilise déjà cette combinaison : choisis-en une autre dans les Réglages. |
| Rien ne s'écrit dans le champ | Passe en mode **collage Ctrl+V** et augmente le délai à 400 ms. |
| Le texte arrive dans la mauvaise fenêtre | Clique bien dans le champ **avant** d'appuyer sur le raccourci. |
| Les accents ne passent pas | Mode **collage Ctrl+V** (il ne dépend pas de la disposition clavier). |
| Fenêtre principale fermée par erreur | `Ctrl+Alt+Espace`, puis bouton « Ouvrir Témoir ». |

---

## Pour vérifier que tout va bien

```
python test_core.py
```

25 tests : dates, calcul de l'âge, recherche, sauvegarde, cohérence,
import/export, lecture des raccourcis.

---

## Contenu du dossier

| Fichier | Rôle |
|---|---|
| `temoir.py` | L'application (fenêtre principale + recherche rapide) |
| `core.py` | Le profil : stockage, recherche, valeurs calculées, cohérence |
| `winput.py` | Windows : raccourci global, frappe clavier, presse-papier (ctypes) |
| `test_core.py` | Les tests |
| `Lancer_Temoir.bat` | Lance l'application |
| `Construire_exe.bat` | Fabrique `dist\Temoir.exe` |

Aucune bibliothèque à installer : tout vient de la bibliothèque standard de
Python (`tkinter` + `ctypes`). PyInstaller n'est nécessaire que pour l'option B.
