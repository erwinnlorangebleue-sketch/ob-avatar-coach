# 2026-09-28 (2) — Relevés du 27, repli du dossier de mascotte, v0.1.6

## Relevés (journal.log, etat.json, journal Windows ; heures UTC)
- Démarrage avec la session : **oui**. Fermeture de session 27/09 19:42:30 puis veille ;
  ouverture de session 28/09 05:23:46 (Winlogon 7001) ; appli lancée 05:25:03, sans action.
- v0.1.4 (publiée 27/09 17:09:12) : trouvée 28/09 05:25:04, téléchargée 05:25:32
  (différentiel en échec, complet), installée 06:48:04 (poste inactif), relancée 06:48:22.
- Synchro carte A05 (poussée 17:08:21) : theorie.md écrit 28/09 05:25:05, soit 12 h 17.
  Bascule silhouette (17:08:40) : 05:25:06, 12 h 16. Aucune synchro attendue à 18:06 et
  19:06 le 27 alors que les fichiers distants avaient changé ; aucune trace d'arrêt dans
  les journaux Windows. L'appli ne tournait plus, ou ses minuteries ne se déclenchaient plus,
  après 17:06:34 : cause non établie.
- Intervalle d'une heure : **pas relu à chaud**. setInterval lit la config au lancement
  (main.js) ; synchros 05:25:06 puis 06:25:05 = valeur au lancement. Aucune preuve
  possible dans le journal : une synchro sans changement n'y écrit rien.

## Processeur absent d'etat.json à 15 min : non corrigé, pas une panne
- Moyenne publiée après 300 s cumulées d'attente / 60 s de lecture. Ne comptent ni la
  pause (verrou, veille, fenêtre cachée), ni l'attente avec une bulle ouverte ; un
  changement de mode ou de variante remet à zéro.
- Aujourd'hui : attente v89 publiée 08:02:11, 72 min après le lancement (3,0 % d'un cœur,
  idle max 16,5 %). La valeur lecture affichée date de la 0.1.3 en silhouette : les anciennes
  moyennes restent dans etat.json après une mise à jour.

## Correctif du repli (v0.1.6)
- `src/main/mascotte-dossier.js` : dossier demandé absent ou incomplet dans le binaire →
  dernier dossier vN complet embarqué, ligne `mascotte : dossier X absent du binaire,
  repli sur Y`. Silhouette : réglage explicite ou panne vidéo seulement. 3 tests (46).
- v0.1.6 : tag poussé 08:09:05, publiée 08:10:46. Prochaine vérification du poste vers
  10:49:40 (lancement 06:49:40 + 4 h) ; installation seulement une fois la bulle fermée.

## Incident
- Lancé `electron .` pour vérifier : l'appli de dev partage le verrou d'instance unique de
  l'installée, a quitté sans journal et **a ouvert la bulle de question de l'installée**
  (vue à l'écran). Bulle ouverte = mise à jour bloquée. Mémoire corrigée.
