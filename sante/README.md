# Ma Famille en Forme

Suivi de poids familial + 54 recettes équilibrées + planning de la semaine + liste de courses automatique.
Site statique : **aucun serveur, aucune base de données, aucune dépendance externe**. Tout fonctionne hors ligne
une fois la page chargée, et les données restent dans le navigateur (`localStorage`).

## Contenu

```
sante/
├── index.html          page unique, 5 onglets
├── style.css           thème clair + thème sombre automatique + feuille d'impression
├── js/app.js           logique (calculs santé, filtres, planificateur, courses)
└── data/recettes.js    les 54 recettes + rayons + sources
```

## Les cinq onglets

| Onglet | Ce qu'il fait |
|---|---|
| **Progression** | Un profil par personne (Christelle, Fabien, Nathan, Mathis) : date de naissance, taille, sexe, niveau d'activité, objectif de poids. Pesées horodatées, courbe SVG avec ligne d'objectif, IMC, métabolisme de base, dépense quotidienne et apport calorique conseillé. |
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

Pour le servir à la racine du domaine, déplacer le contenu de `sante/` à la racine du dépôt
(attention : `index.html` à la racine est actuellement occupé par ParkAlert).

### Netlify / Vercel / OVH / autre hébergeur
Déposer le dossier `sante/` tel quel. Il n'y a rien à compiler ni à installer.

### En local
```bash
cd sante && python3 -m http.server 8000
# puis http://localhost:8000
```
Ouvrir `index.html` par double-clic fonctionne aussi.

## Données personnelles

Rien n'est envoyé nulle part : tout est écrit dans le `localStorage` du navigateur, sur l'appareil utilisé.
Conséquences pratiques : les données ne sont pas partagées entre le téléphone et l'ordinateur, et vider les
données du site les efface. L'export JSON (onglet Réglages) sert de sauvegarde et permet de basculer d'un
appareil à l'autre.

## Ajouter une recette

Dans `data/recettes.js`, copier un bloc existant et adapter :

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
  allergenes: ['gluten'],       // voir ALLERGENES dans js/app.js
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
