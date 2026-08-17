# Deux Maisons

Calendrier de **garde alternée** pour parents séparés. Un seul fichier `index.html`,
aucune dépendance, aucun serveur, aucun compte : tout est calculé dans le navigateur.

Ouvrir `index.html` suffit — y compris depuis le disque, en `file://`, sans connexion.

## Ce que ça fait

- **Rythmes** : 1 semaine / 1 semaine, quinzaine, 2-2-3, 2-2-5-5, 3-4-4-3,
  week-ends alternés, ou un cycle personnalisé (`2,2,3`). L'unité de calcul est la **nuit**.
- **Vacances et périodes particulières** : moitié / moitié ou période entière, avec
  inversion automatique une année sur deux (années paires / impaires).
- **Échanges ponctuels** : un clic sur une case force la nuit chez l'un ou l'autre.
- **Vues** : mois, année complète sur une page, liste des séjours, bilan d'équilibre
  (nuits, nuits de week-end, nuits de vacances, plus longue absence, nombre de trajets).
- **Export `.ics`** vers Google Agenda, Apple Calendrier ou Outlook, avec rappel avant échange.
- **Partage sans serveur** : toute la configuration est encodée dans l'adresse du lien
  (`#p=…`, ~450 caractères). L'autre parent ouvre le lien et voit le même calendrier.
- **Vue enfant** : les sept prochaines nuits en grand, « où je dors ce soir ».
- **Impression** : l'année tient sur une page A4, lisible en noir et blanc
  (la seconde maison est hachurée, pas seulement colorée).
- Jours fériés français calculés localement, comput de Pâques inclus — aucune donnée téléchargée.

## Données

Le planning est stocké dans le `localStorage` du navigateur, plus une sauvegarde
JSON exportable. Rien ne sort de l'appareil.

## Développement

Il n'y a rien à installer ni à compiler. Le moteur de calcul (dates, cycles, vacances,
statistiques, génération `.ics`) est isolé en fonctions pures dans le `<script>`, entre
`var DAYMS` et le bloc `── couleurs ──`, ce qui permet de l'extraire et de le tester sous Node.

## Portée

Cet outil sert à organiser et à vérifier un planning. Il ne remplace pas une convention
parentale ni une décision de justice, seules opposables.
