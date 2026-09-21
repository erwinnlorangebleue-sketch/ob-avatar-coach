# 2026-09-21 — Publication v0.1.0 puis v0.1.1 (recette mise à jour)

## Fait
- v0.1.0 publiée, installée sur le PC de test depuis GitHub (empreinte sha512 = latest.yml).
- Démarrage avec la session : clé Run « electron.app.OB Coach » créée.
- v0.1.1 publiée par le workflow ; la v0.1.0 installée l'a trouvée, téléchargée, puis
  installée seule après 5 min d'inactivité et relancée : OB Coach.exe = 0.1.1.0.

## Pièges rencontrés
- GitHub renvoie des 504 intermittents sur les fichiers de Release (outils NSIS,
  installateur) : le workflow réessaie le build 3 fois (2 échecs, 3e essai OK pour v0.1.1).
- electron-builder crée deux Releases quand elle n'existe pas (envois parallèles) :
  le workflow crée d'abord un brouillon, puis le publie une fois complet.
- `npm ci` échouait sur le runner : `--ignore-scripts` (aucun script n'est nécessaire).
- v0.1.0 a dû être publiée depuis le PC de test (les 504 bloquaient le runner).
- Test depuis l'app Claude (MSIX) : les écritures dans AppData\Roaming sont redirigées
  vers Packages\Claude_…\LocalCache. L'instance relancée après mise à jour écrit, elle,
  dans le vrai dossier. Artefact de l'environnement de test, pas du produit.

## Reste à vérifier sur place
- Ctrl+Espace depuis Chrome et depuis une application plein écran.
- Échap au clavier réel.
- etat.json du vrai %APPDATA%\OB Coach après la mise à jour (version 0.1.1).
