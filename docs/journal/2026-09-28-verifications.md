# 2026-09-28 (3) — Vérifications horaires, bulle oubliée, v0.1.7

## v0.1.6 sur le poste réel (sans relance ; heures UTC)
- Bulle ouverte par erreur à 08:07, fermée ensuite par l'utilisateur.
- 10:49:42 la 0.1.5 trouve la 0.1.6 (vérification 06:49:40 + 4 h) ; téléchargée 10:49:47 ;
  installée 10:50:42 (poste inactif) ; relancée 10:50:59, mascotte vidéo.
- Repli du dossier : aucune ligne, attendu (v89 est dans le binaire). Non observable sur
  le poste sans publier un dossier absent.

## Cause du silence du 27 (17:06 → 19:42) : non établie
- Pas le renderer : les minuteries de synchro sont dans le processus principal ; le 28,
  elles tournent (synchros 07:49, 08:49, 09:49 avec fenêtre visible).
- Pas une veille : aucun événement Kernel-Power entre 17:06 et 19:42 (veille à 19:42:32).
- Pas une exception JS : uncaughtException et unhandledRejection sont journalisés ; rien.
- Pas un arrêt par la session Claude : aucun Stop-Process après 16:18 dans les transcripts.
- Aucune trace WER ni journal Application. Reste : processus figé ou arrêté hors de l'appli.
  etat.json inchangé de 17:06:34 à 17:21:52 (relevé du 27). Sans ligne par vérification,
  impossible de dater l'arrêt : c'est ce que corrige b.

## v0.1.7 (tests 46 → 54)
- a. `verification.js` : contenu et binaire au démarrage, à la sortie de veille, puis
  `relecture_contenu_min` / `verification_maj_min` (60) relus à chaque cycle ; minuterie
  en retard > 60 s rattrapée par la minuterie d'activité.
- b. Ligne `vérification <cible> (<raison>) : <résultat>` à chaque passage.
- c. `bulle.js` : fermeture après `fermeture_bulle_min` (10) sans frappe ni clic.
- d. etat.json : `processeur` effacé si la version change, ligne de journal.
- e. `identite.js` : dev = « OB Coach (dev) », userData propre, avant le verrou. Vérifié :
  dev lancé 10:14, son propre journal, installée intacte (écran, journal).
- Tag poussé 10:49:46 dès « Found version 0.1.6 », publiée 10:51:31 : 30 s trop tard
  pour la vérification de démarrage de la 0.1.6 (10:51:01). Arrivée attendue à la
  vérification suivante de la 0.1.6, vers 14:51 (4 h, minuterie de l'ancien binaire).

## Pièges
- Une correction de minuterie n'agit qu'une fois installée : la version qui la remplace
  garde son ancien intervalle. Publier la suivante avant la vérification de démarrage.
- `git credential fill` peut bloquer en arrière-plan : l'API publique suffit en lecture.
