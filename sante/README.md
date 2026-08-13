# Ma Famille en Forme

Suivi de poids familial + 54 recettes équilibrées + planning de la semaine + liste de courses automatique.
**Un seul fichier**, `index.html` : HTML, CSS, JavaScript et les 54 recettes sont tous dedans. Aucun serveur,
aucune base de données, aucune dépendance externe, rien à compiler. Il fonctionne hors ligne, et même par simple
double-clic depuis l'explorateur de fichiers. Les données restent dans le navigateur (`localStorage`).

## Repères dans le fichier

`index.html` s'ouvre dans n'importe quel éditeur de texte et se lit de haut en bas :

| Section | Contenu |
|---|---|
| `<style>` | thème clair, thème sombre automatique, mise en page responsive, feuille d'impression |
| `<body>` | les 5 onglets et les deux fenêtres modales |
| 1er `<script>` | `RAYONS`, `SOURCES` et le tableau `RECETTES` — les 54 plats |
| 2e `<script>` | l'application : calculs santé, filtres, planificateur, liste de courses |

## Les cinq onglets

| Onglet | Ce qu'il fait |
|---|---|
| **Progression** | Un profil par personne (Christelle, Fabien, Nathan, Mathis), **vide au départ** : date de naissance, taille, sexe, niveau d'activité et objectif de poids sont à saisir. Tant qu'il manque une donnée, la fiche le dit et n'affiche aucun chiffre inventé. Ensuite : pesées horodatées, courbe SVG avec ligne d'objectif, IMC, métabolisme de base, dépense quotidienne et apport calorique conseillé. |
| **Recettes** | 54 plats, quantités pour le nombre de convives réglé. Recherche, filtres (catégorie, temps, saison, légumineuses, poisson gras, batch cooking, jours sympa), fiche détaillée avec ingrédients, étapes, valeurs nutritionnelles et lien vers le site source. |
| **Semaine** | Grille 7 jours × 2 repas. Remplissage manuel ou automatique. Le planificateur évite les répétitions, alterne les catégories, place les plats plaisir le week-end et respecte les repères PNNS. Bilan d'équilibre en bas de page. |
| **Courses** | Liste générée depuis le planning : quantités additionnées, converties (g → kg), ajustées au nombre de convives et rangées par rayon. Cases à cocher, ajout d'articles libres, copie dans le presse-papier, impression. |
| **Réglages** | Allergies par personne (13 allergènes), aversions alimentaires en texte libre, nombre de convives, repas à planifier, export / import JSON, réinitialisation. |

## Bases de calcul

- **IMC** : poids / taille². Zone de référence adulte 18,5–25. Non affiché avant 18 ans (les courbes de corpulence
  par âge s'appliquent alors), remplacé par un message explicite.
- **Métabolisme de base** : équation de Mifflin-St Jeor (1990).
- **Dépense totale** : métabolisme × facteur d'activité (1,2 à 1,9).
- **Objectif calorique** : −15 % pour une perte, jamais sous le métabolisme de base, plancher 1500 kcal (homme) /
  1200 kcal (femme). Maintien pour les mineurs.
- **Équilibre hebdomadaire** (repères PNNS 4 / ANSES) : poisson 2×/semaine dont 1 gras, légumineuses 2 à 3×,
  viande rouge ≤ 1×, féculents complets, moitié de l'assiette en légumes.

## Mettre le site en ligne

### GitHub Pages
1. Dépôt → *Settings* → *Pages* → *Source : Deploy from a branch* → branche `main`, dossier `/ (root)`.
2. Le site est publié sur `https://<utilisateur>.github.io/<dépôt>/sante/`.

Pour le servir à la racine du domaine, déplacer `sante/index.html` à la racine du dépôt
(attention : `index.html` à la racine est actuellement occupé par ParkAlert).

### Netlify / Vercel / OVH / autre hébergeur
Téléverser `index.html`. C'est tout : un seul fichier à déposer, rien à compiler ni à installer.

### En local
Double-cliquer sur `index.html`. Pour passer par un serveur :
```bash
cd sante && python3 -m http.server 8000   # puis http://localhost:8000
```

## Ce qui est conservé

Tout est enregistré au fil de l'eau, sans bouton « sauvegarder » : profils, pesées, allergies, aversions, sélection
de recettes, planning de la semaine, cases cochées de la liste de courses, réglages du foyer, et jusqu'à l'onglet
ouvert — on retrouve l'application exactement là où on l'avait laissée.

Les écrans se mettent à jour de façon ciblée : valider une pesée ou cocher un article ne reconstruit pas la page,
donc le panneau ouvert reste ouvert et la position de défilement ne bouge pas.

## Données personnelles

Rien n'est envoyé nulle part : tout est écrit dans le `localStorage` du navigateur, sur l'appareil utilisé.
Conséquences pratiques : les données ne sont pas partagées entre le téléphone et l'ordinateur, et vider les
données du site les efface. L'export JSON (onglet Réglages) sert de sauvegarde et permet de basculer d'un
appareil à l'autre.

## Ajouter une recette

Dans `index.html`, chercher `const RECETTES = [`, puis copier un bloc existant et l'adapter :

```js
{
  id: 'identifiant-unique',
  nom: 'Nom du plat',
  cat: 'Végétarien',            // Végétarien | Poisson | Volaille | Viande rouge | Porc | Œufs
  legumineuse: true,            // marqueurs d'équilibre, facultatifs :
  poissonGras: false,           //   poissonGras, viandeRouge
  plaisir: false,               // true = plat « jour sympa », placé le week-end
  temps: 35, diff: 'Facile',
  kcal: 520, prot: 21, gluc: 66, lip: 17, fibres: 13,   // par personne
  saisons: ['automne', 'hiver'],
  tags: ['one pot', 'batch cooking'],
  allergenes: ['gluten'],       // voir la liste ALLERGENES dans le 2e <script>
  ingredients: [
    // [nom, quantité pour 4 personnes, unité, rayon]
    // unités : g, ml, pièce, gousse, tranche, brin, botte, pincée, c.à.s, c.à.c
    // rayons : lg légumes · bo boucherie · po poissonnerie · cr crèmerie
    //          fe féculents · ep épicerie · es épices · bl boulangerie · sg surgelés
    ['Lentilles corail', 300, 'g', 'fe']
  ],
  etapes: ['Première étape.', 'Deuxième étape.'],
  astuce: 'Un conseil de cuisson ou de conservation.',
  src: ['marmiton', 'requête de recherche']   // marmiton | g750 | ricardo | amandine | hellofresh
}
```

Les quantités sont **toujours saisies pour 4 personnes** : l'application les recalcule selon le réglage du foyer.
Utiliser `g`/`ml` plutôt que `kg`/`l`, sinon l'agrégation de la liste de courses créera deux lignes distinctes
pour le même ingrédient.

## Avertissement

Les repères affichés sont généraux et indicatifs. Ils ne remplacent pas l'avis d'un médecin ou d'un diététicien,
en particulier pour les enfants et les adolescents, chez qui aucun objectif de perte de poids ne devrait être
fixé sans suivi médical.
