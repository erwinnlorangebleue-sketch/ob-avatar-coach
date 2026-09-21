# ob-avatar-coach

Assistant de bureau pour les coachs L'Orange Bleue : un avatar posé en bas à droite de
l'écran, qui rappelle de la théorie (cartes) et retrouve l'article officiel du centre
d'aide Magicline. Règles et décisions : voir `CLAUDE.md`.

## Utilisation au poste

- **Ctrl+Espace** (depuis n'importe quelle application) ou **clic sur l'avatar** : bulle de question.
- Échap, la croix ou Ctrl+Espace referment la bulle et rendent le clavier à l'application d'avant.
- Une carte apparaît toutes les ~2 minutes d'activité réelle.

## Enrichir les synonymes (le plus important)

Fichier `contenu/synonymes.json`. Une ligne par concept : à gauche le mot tel qu'il
apparaît dans les **titres** du centre d'aide, à droite ce que tapent les coachs.

```json
"résiliation": ["il veut arrêter", "arrêter son abonnement", "quitter la salle"],
```

Accents, majuscules et petits mots (« le », « qui », « ne »…) ne comptent pas.
Avant de pousser, vérifier l'effet :

```bash
npm run essai-recherche -- "il veut arrêter"
```

Une fois poussé sur `main`, chaque poste relit le fichier dans l'heure : **aucune
réinstallation, aucune nouvelle version**. Les questions restées sans réponse sont
notées sur chaque poste dans `%APPDATA%\OB Coach\questions-sans-reponse.jsonl` : c'est
la liste des synonymes à ajouter.

## Réglages à distance (`contenu/config.json`)

`veille: true` masque l'avatar sur tous les postes ; `cartes_actives` / `recherche_active`
brident une fonction ; `intervalle_cartes_s`, `score_minimum`… Relu toutes les heures.

## Fichiers du poste (`%APPDATA%\OB Coach\`)

| Fichier | Contenu |
|---|---|
| `etat.json` | version installée, dernière synchro contenu / articles, dernière erreur |
| `journal.log` | journal technique |
| `centre-aide-index.json` | index local (métadonnées + mots-clés, pas le texte des articles) |
| `contenu-cache\` | dernière copie valide de `contenu/` |

## Développement

```bash
npm install
```

```bash
npm start
```

```bash
npm test
```

En développement, l'appli lit `contenu/` directement (pas la copie de `main`).
`OB_CONTENU_DISTANT=1` rétablit la lecture distante.

## Publier une version

1. Monter `version` dans `package.json`, committer sur `main`.
2. Pousser le tag correspondant :

```bash
git tag v0.1.1
```

```bash
git push origin v0.1.1
```

Le workflow `.github/workflows/release.yml` construit l'installateur et publie la
Release ; les postes la téléchargent seuls et l'installent dès 5 minutes d'inactivité.
