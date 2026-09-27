# 2026-09-27 (3) — Processeur au repos : cible tenue (branche mascotte-v88)

## Fait
- idle : 1 passage puis pose 20–40 s ; talk : 2 passages (6 s) puis pose tant que la carte
  est ouverte. Par état dans mascotte.json : `passages`, `repos_s` (absent = jusqu'au changement).
- `variantes` dans mascotte.json : plus petite qui couvre taille × densité, sinon la plus grande.
- `scripts/encoder-mascotte.js` : masters → assets/mascotte/<version>/<taille>/ + repos.png,
  alpha < 3 → 0, contrôle fond et couleur, rien remplacé si échec, sortie bit-exacte.
- Télémétrie `processeur` dans etat.json : moyenne 5 min en attente / en lecture, mode,
  variante, cœurs. Relevé par getAppMetrics (cumulativeCPUUsage), tranches par phase.

## Mesures (taille 160, GPU coupé, somme electron.exe du dépôt, lancement neuf)
- Lecture continue 160 vs 320, série ABBA : 8,65 vs 12,00 % → gain 27,9 % (série 1 : 24,8 %).
  Sous 30 % : **variante 160 retirée**, variantes = [320, 640].
- Attente, 6 × 60 s en 320 : 0,65 / 1,91 / 1,91 / 1,27 / 2,80 / 1,59 → moy. 1,69, max 2,80.
- Télémétrie de l'appli sur la même période : 1,9 % sur 327 s. Concorde.
- Repos idle observés : 23,5 à 39,2 s (10). talk : fin du 2e passage à 5,96 s, puis figé.

## Couleurs (image 0 d'idle ; cible écorce 226–234°, pulpe 32 ± 4° / L 91 ± 5)
- 160 ffmpeg #0B2DDA 230,1° / pulpe #FDE8CF 32,6° L90,2 ; canvas #0C2FDA 229,8° / 32,0° L90,8.
- 320 canvas #0C2FDA 229,8° / pulpe 32,6° L90,6. Master : 229,8° (35 244 px, comme la livraison).

## Alpha
- Sans nettoyage, quasi tout le fond décodé vaut 1. Après : fond (≥ 8 px) à 0 sauf ≤ 1 px
  sur 50 000, valeur ≤ 3, là où un geste est passé (prédiction VP9, options sans effet).
- Bords à 160 : anticrénelage conservé (858 px intermédiaires, identique à l'œil ×8).

## Rejeu du script sur v88
- Sortie = fichiers de l'app, octet pour octet (25 puis 17 fichiers après retrait de la 160).
- Le flux VP9 réencodé est identique à celui livré ; seuls les UID Matroska variaient.

## Pièges
- Measure-Object -Sum refuse TimeSpan : relevé vide, série jetée. Additionner TotalSeconds.
- Canvas sans GPU : lire, pause, currentTime = 0, requestVideoFrameCallback, puis dessiner.
- Python sous Windows écrit en CRLF : newline='' ou '\n'.
- Un clic sur la mascotte pendant une mesure la fausse (wave) : journaliser les clips joués.

## Reste
- Lecture 320 ≈ 12 % d'un cœur ici : à revoir sur un poste de club via la télémétrie.
