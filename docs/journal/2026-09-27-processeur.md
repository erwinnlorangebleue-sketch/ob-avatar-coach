# 2026-09-27 (2) — Processeur au repos, déclencheurs, taille de la mascotte

## Diagnostic (par processus, copie figée du commit précédent)
- Silhouette animée 21,8 % d'un cœur → sans animation 0,36 %. Toute animation qui
  tourne fait recomposer la fenêtre transparente à chaque image (GPU 16,5 + rendu 5,2).
- Sans effet mesurable : box-shadow/filter (23,6), ombre floue figée (21,4), minuterie
  de premier plan (21,7), taille de fenêtre (vidéo 21,0 vs 20,9). Aucun sondage du
  titre de fenêtre active (lu seulement au survol).
- Vidéo figée 0,3 % : seule la lecture coûte.
- GPU coupé : ~7 points de moins en lecture (relecture de la fenêtre transparente).

## Fait
- Silhouette immobile à l'état repos ; animée seulement hors attente.
- idle : un passage puis immobile 8–20 s (`attente_repos_s`).
- Variantes 320 (encodées depuis les masters, commande imposée) et 640 ; 320 si
  taille × devicePixelRatio ≤ 320.
- `taille_px` = 160 ; fenêtre ajustée à ce qu'elle affiche (160 × 160 au repos,
  bulle + ombre portée quand elle est ouverte), IPC `taille`.
- `acceleration_materielle` (config.json, défaut false), lu avant `ready`.
- Déclencheurs : greet démarrage/réveil, rien à l'ouverture, wave ≤ 1 / 10 min,
  think après 300 ms. Règles pures dans `avatar/regles.js`, testées (31 tests).

## Mesures après (60 s, GPU coupé, 160 px)
- Vidéo livrée : 6,57 / 4,62 / 5,22 / 4,67 / 5,01 / 5,22 → 5,22 % : **cible non tenue**.
- Coût d'un clip 320 en lecture continue : 14,0 (think) à 16,7 % (found).
- Silhouette : 0,21 % visible, 0,21 % cachée. Vidéo cachée : 0,34 %.
- Couleurs 320 : ffmpeg #0B2EDB 229,9° / pulpe 32,6° L90,2 ; canvas #0C2FDB 229,9°.

## Pièges
- CSP `style-src 'self'` bloque les <style> injectés : utiliser adoptedStyleSheets.
- Sans GPU, le canvas n'a pas l'image vidéo à `loadeddata` : attendre ~500 ms.
- Bruit fort entre séries (vidéo 640 : 21 à 36 %) : comparer dans une même série.
- VP9 crf 30 en 320 laisse un alpha résiduel ≤ 1/255 dans le fond (invisible).

## Reste
- Décider : tenir 5 % en vidéo demande de changer un réglage (repos plus long,
  moins de passages d'idle) ; c'est un choix produit, pas technique.
