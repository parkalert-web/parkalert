# La file d'attente

Déposez ici vos Shorts, **un fichier vidéo par publication** (`.mp4`, `.mov`,
`.webm`…). Le robot en prend **une par jour**, dans l'**ordre alphabétique**.

Pour maîtriser l'ordre de passage, préfixez les noms :

```
01_astuce-parking-a-paris.mp4
02_ma-plus-grosse-erreur.mp4
2026-09-14_visite-guidee.mp4
```

Le **nom du fichier sert de sujet** dans les titres générés : le préfixe et les
tirets sont retirés, donc `01_astuce-parking-a-paris.mp4` donne le sujet
« astuce parking a paris », qui viendra remplir `{sujet}` dans vos modèles.

## Régler une vidéo en particulier

Posez à côté du fichier une fiche JSON portant le **même nom** — par exemple
`01_astuce-parking-a-paris.json` :

```json
{
  "sujet": "se garer à Paris sans tourner 20 minutes",
  "titre": "",
  "description": "",
  "tags": ["paris", "stationnement"],
  "publication": { "confidentialite": "public" }
}
```

Tous les champs sont facultatifs :

| Champ | Effet |
|---|---|
| `sujet` | Remplace le sujet déduit du nom de fichier. |
| `titre` | Impose **ce** titre exact (aucune génération aléatoire). |
| `description` | Remplace la description générée (la signature reste ajoutée). |
| `tags` | Mots-clés ajoutés à ceux de `config.json`. |
| `publication` | Surcharge ponctuelle, ex. publier celle-ci en `unlisted`. |

## Une fois publiée

Le robot déplace automatiquement le fichier dans `publiees/` et note la
publication dans `state.json` : une vidéo ne peut donc pas partir deux fois.

> **Poids des fichiers.** Via le site github.com, un envoi est limité à 25 Mo par
> fichier (100 Mo en ligne de commande avec `git`). Pour des vidéos plus lourdes,
> passez `"source": "drive"` dans `config.json` : les fichiers restent alors sur
> Google Drive et ne transitent jamais par le dépôt.
