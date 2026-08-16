# La Chasse à la place

Un simulateur multi-agents de la traque au stationnement, construit autour d'une
seule question : **qu'est-ce que change, dans un quartier, le fait que les
conducteurs se disent où sont les places ?**

Deux villes tournent côte à côte. Même graine aléatoire, mêmes véhicules, mêmes
destinations, mêmes durées de stationnement, minute par minute. Une seule
variable les sépare : la part de conducteurs équipés d'un réseau de partage.
À 0 % d'équipement les deux plaques sont identiques image par image — c'est le
contrôle de l'expérience.

`la-chasse.html` est un fichier autonome : aucune dépendance, aucun appel réseau,
fontes embarquées. Il s'ouvre directement dans un navigateur.

## Ce qui en sort

Mesuré à 95 % de pression automobile, 4 graines, 1 500 minutes simulées par point :

| Équipement | Équipés | Non‑équipés | Ville entière | Km roulés à vide |
|-----------:|--------:|------------:|--------------:|-----------------:|
|      0 %   |     —   |    3,60 min |      3,60 min |           13 618 |
|     10 %   | 2,04 min|    3,64 min |      3,47 min |           13 110 |
|     50 %   | 2,22 min|    4,35 min |      3,25 min |           11 377 |
|     90 %   | 2,45 min|    6,24 min |      2,79 min |            8 360 |
|    100 %   | 2,52 min|         —   |      2,52 min |            7 048 |

Trois choses, qu'aucune règle du modèle n'impose et qui en émergent :

1. **Le bénéfice privé est immédiat.** Dès 10 % d'équipement, un abonné cherche
   1,8 fois moins longtemps et roule 2 fois moins que son voisin.
2. **Le bénéfice collectif est lent.** Le temps moyen de la ville ne baisse
   vraiment qu'à taux d'équipement élevé : le réseau ne crée aucune place, il
   réattribue plus vite celles qui existent.
3. **Le non‑équipé paie l'addition.** Plus les autres s'équipent, plus il tourne —
   de 3,60 min à 6,24 min. Les places changent de mains avant qu'il puisse les voir.

La conséquence de conception, pour un service comme ParkAlert : si l'avantage de
l'abonné se paie en minutes prises à celui qui n'a pas l'application, alors
l'annonce de départ a intérêt à rester gratuite, publique et facile.

## Le modèle

Ce qu'il fait :

- 49 intersections, 84 tronçons de 110 m, 4 places au trottoir par tronçon (336 places).
- La demande est concentrée au centre (loi gaussienne). C'est cette concentration,
  et elle seule, qui fabrique la chasse.
- Chaque conducteur a une destination et n'accepte qu'une place à distance de
  marche acceptable ; sa patience s'élargit d'un pâté de maisons toutes les 6 min.
- Durée de stationnement exponentielle, moyenne 28 min, minimum 5.
- Un équipé annonce son départ 3 min à l'avance et se voit réserver la place libre
  acceptable la plus proche, avec l'itinéraire (BFS sur le graphe des rues).
- Un non‑équipé ne voit une place qu'en passant devant, et peut prendre une place
  réservée sans le savoir.

Ce qu'il ne fait pas, et qu'il faut garder en tête :

- **Aucun embouteillage** : la vitesse ne baisse pas quand les chasseurs
  s'accumulent. C'est l'omission la plus lourde, et elle joue contre le réseau —
  le modèle *sous-estime* son effet.
- Ni parkings souterrains, ni stationnement payant, ni livraisons, ni horodateurs.
- Personne ne ment sur son heure de départ, personne ne réserve deux places.
- Une grille en damier n'est pas une ville.

Les chiffres décrivent cette ville-jouet. Ils illustrent un mécanisme ; ils ne
mesurent aucune ville réelle.

## Développement

```sh
cd labo/src
node verify.js      # invariants du modèle + résultats de référence
node build.js       # réassemble ../la-chasse.html
```

`verify.js` contrôle quatre invariants (déterminisme, conservation des places,
monotonie de l'ensemble des équipés, absence de réservation dans la ville témoin)
puis vérifie que chaque résultat annoncé sur la page tient toujours. Il sort en
code 1 si l'un d'eux tombe.

`build.js` inline `sim.js` et les trois fontes dans `page.html` pour produire le
fichier autonome. Le moteur (`sim.js`) tourne tel quel sous Node et dans le
navigateur.

Fontes : Bebas Neue et DM Mono, sous-ensemble latin, licence SIL Open Font 1.1.
