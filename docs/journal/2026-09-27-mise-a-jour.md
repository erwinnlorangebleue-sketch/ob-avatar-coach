# 2026-09-27 (4) — Mise à jour automatique sur vraie installation (en cours)

## Fait
- Télémétrie : moyenne lecture publiée dès 60 s (attente : 300 s), `max_par_clip` par phase
  (passage = clip sans interruption, ≥ 1 s). Clip transmis page → principal, vérifié en dev.
- mascotte-v88 fusionnée dans main (avance rapide), 43 tests.
- v0.1.3 : tag → workflow, publiée 16:00:44 UTC. Installeur téléchargé de la release
  (sha512 = latest.yml), marque Internet ZoneId=3, lancé par l'Explorateur à 16:07:48.
  **SmartScreen bloque** ; clic utilisateur 17:05:57 ; installée et lancée 17:06:34 (heures UTC).
- Vérifié : clé Run `electron.app.OB Coach` → exe installé ; fenêtre 160 × 160 px à 96 dpi ;
  `mascotte: video`, `version: 0.1.3` dans le vrai etat.json ; appli hors conteneur MSIX.
- v0.1.4 (version en bas de la bulle de question) : tag 17:07:42, publiée 17:09:12 UTC.
- Contenu seul, poussé 17:08:21 UTC : carte A05 « omoplate (scapula) ».
- Interrupteur : `mascotte: silhouette` poussé 17:08:40 UTC. **Encore en place sur main.**

## Mise à jour : cause du délai (connue avant les 30 min)
- Vérification au démarrage (17:06:30 UTC) puis toutes les `verification_maj_h` = 4 h :
  prochaine vers 21:06 UTC. Le setInterval lit la config une fois : une valeur distante
  n'agit qu'au redémarrage. Installation ensuite après 5 min d'inactivité, bulle fermée.
- Contenu : synchro au démarrage puis toutes les 60 min : attendue vers 18:06 UTC.

## Miroir (branche locale `miroir`, non publiée)
- Zone de clic : décalage optimal 0 px ; désaccord 45 / 6 400 points (43 sans miroir).
- Processeur, lecture continue, ABBA, 60 s : conteneur retourné 13,24 / 13,36 contre
  12,45 / 12,36 (+0,9 pt) ; par élément 11,99 / 13,01 contre 12,11 / 11,71 (+0,6, bruité).
  Repos : 0,10 / 0,10 contre 0,08 / 0,00. **Coût en lecture : non conforme.**
- Piste : retourner à l'encodage (option du script) pour v89, coût nul par construction.

## Pièges
- Vrai AppData lisible par `//localhost/c$/…` ; installeur hors conteneur via explorer.exe.
- PowerShell écrit 3,141 (virgule) : InvariantCulture pour les relevés.
- Relancer l'appli de dev trop vite : verrou d'instance pas libéré, mesure à 0 processus.

## Reste
- Relever dans le vrai journal.log : synchro 18:06 (carte, bascule silhouette), maj 21:06
  (téléchargement, installation, redémarrage), version 0.1.4 dans etat.json.
- Remettre `mascotte: video` sur main une fois la bascule constatée.
- Télémétrie processeur absente d'etat.json 15 min après le lancement : à comprendre.
- Démarrage avec la session : clé présente, pas éprouvé par une vraie ouverture de session.
