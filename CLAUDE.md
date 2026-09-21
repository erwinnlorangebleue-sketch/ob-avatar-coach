# ob-avatar-coach

Assistant de bureau pour les coachs des 4 clubs L'Orange Bleue (Cesson, Janzé, +2).
Un avatar 3D posé en permanence sur l'écran du poste de club. Deux fonctions :
rappeler de la théorie de base, et répondre aux questions Magicline en puisant
dans le centre d'aide officiel du réseau.

Ce n'est PAS un composant du dashboard Team OB. C'est un logiciel séparé qui
vit par-dessus toutes les applications.

## Décisions arrêtées — ne pas rediscuter

**1. Electron.** Pas Tauri, pas une PWA, pas une extension de navigateur.
Motif : Electron embarque son propre Chromium, donc le rendu est identique
entre le PC de test et les 4 postes de club. On ne peut pas se déplacer pour
corriger une différence de moteur de rendu.

**2. Aucun serveur.** L'application appelle directement :
- l'API du centre d'aide : `https://support.lorangebleue.fr/api/v2/help_center/`
  — ouverte, sans authentification, 182 articles, 20 sections.
  Liste : `fr/articles.json` · Recherche : `articles/search.json?query=…&locale=fr`
- ses fichiers de contenu, lus depuis ce dépôt.

Pas de Google Apps Script, pas de base de données, pas d'hébergement tiers.
Note : une page web ne peut pas appeler cette API (blocage CORS). Une
application de bureau, si. C'est une des raisons du choix Electron.

**3. Tout ce qui peut changer vit hors du binaire.** Textes, cartes, synonymes,
config des clubs : fichiers Markdown et JSON dans ce dépôt. Une chaîne de
caractères affichable écrite en dur dans le code est un bug, pas un raccourci.
Motif : chaque correction impossible à distance coûte un aller-retour en club.

**4. Mise à jour automatique obligatoire**, via GitHub Releases
(`electron-updater`). Règle d'installation : ne jamais quitter un club avant
d'avoir vu une mise à jour automatique y atterrir pour de vrai.

**5. Budget zéro.** Aucune brique payante. Pas de certificat de signature de
code : l'avertissement Windows SmartScreen au premier lancement est assumé et
cliqué une fois par poste, sur place.

## Contraintes de conception

- **Deux entrées, toujours les deux.** Clic sur l'avatar (découvrable, pour le
  nouveau) et raccourci clavier global **Ctrl+Espace** (rapide, depuis
  n'importe quelle application, pour l'habitué). Le raccourci est l'usage réel.
- **Fenêtre transparente traversante** partout sauf sur l'avatar lui-même
  (`setIgnoreMouseEvents(true, {forward:true})`, basculé au survol). Sans ça,
  la fenêtre bloque les clics sur ce qu'il y a derrière.
- **Mode démo sans modèle 3D** : silhouette CSS. Il ne disparaît jamais du
  code — c'est à la fois le repli quand le GLB ne charge pas et le mode léger
  des vieux postes.
- **Hors ligne** : cache local de l'index et des cartes. L'appli reste utile
  réseau coupé.
- **Contexte par titre de la fenêtre active.** Fonctionne que Magicline soit
  ouvert en navigateur ou en logiciel installé — on n'a pas besoin de le savoir.
- **Démarrage automatique** avec la session Windows.
- **Télémétrie par poste** : version installée, dernière synchro, dernière
  erreur. Sans ça, un club tombe en panne en silence.
- **Configuration à distance** : l'appli doit pouvoir être bridée ou mise en
  veille depuis les fichiers du dépôt, sans réinstallation.

## Règles de réponse — non négociables

- L'avatar **ne génère jamais** de contenu Magicline. Il cherche, classe, et
  ouvre l'article officiel. Rien trouvé → « je ne sais pas, je note la
  question ». Une réponse inventée sur un menu qui n'existe pas détruit la
  confiance des coachs en une semaine et le produit est mort.
- Chaque réponse affiche **sa source et sa date**.
- **Aucune donnée d'adhérent** n'est lue, affichée, stockée ou envoyée.
  L'avatar parle process, jamais dossiers.
- On n'archive pas les articles du franchiseur : on indexe les métadonnées et
  on ouvre l'original. Pas de copie qui se périme en silence.

## Deux registres de contenu, à ne pas mélanger

- Cartes **`ÉTABLI`** (anatomie, insertions, os, innervation) : elles affirment.
  Pas de source à surveiller, pas de date de péremption.
- Cartes **`CONSENSUS` / `DÉBATTU`** (méthodes d'entraînement, compléments) :
  elles nuancent, portent leur source et sa date.
- Cartes **`PRATIQUE MÉTIER`** : savoir-faire assumé, pas une affirmation
  scientifique. Ne jamais l'afficher comme un débat.
- Cartes À VÉRIFIER : une information manque pour trancher (typiquement une étiquette produit). Ne jamais afficher tant qu'elle n'est pas levée.

Ces registres n'ont pas la même apparence à l'écran.

## Discipline du dépôt

- **Ce fichier ≤ 8 500 caractères.** Au-delà : retirer avant d'ajouter.
- Un journal par jour dans `docs/journal/`, fichier neuf à chaque fois,
  jamais d'ajout à un existant, 40 lignes maximum.
- Une session par sujet (`/clear` au changement).
- Ne jamais ouvrir un fichier de référence en entier pour le comparer :
  script, sortie résumée uniquement.

## Pas encore décidé

- Moteur de réponse : recherche par mots-clés seule, ou Gemini (palier
  gratuit) par-dessus pour comprendre les questions mal formulées. **À mesurer
  sur usage réel avant de trancher**, pas à supposer. La v1 part sans IA.
- Identifiants des 4 clubs : à récupérer dans l'onglet `App_data` du classeur
  « Synthèse & Pilotage clubs ».
- Modèle 3D de Yann SERVANT : pas encore produit. Il arrive en dernier, par
  mise à jour automatique. Ne jamais bloquer une livraison en l'attendant.
