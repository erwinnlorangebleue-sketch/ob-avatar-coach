'use strict';
// Règles de la mascotte, sans DOM : chargées par la page (window.ReglesMascotte) et par les tests.
// Tous les nombres viennent de contenu/mascotte.json ; les valeurs ci-dessous ne servent que
// si le fichier en est dépourvu.

(function (racine) {
  const TAILLE_DEFAUT = 160;
  const TAILLE_MIN = 80;
  const TAILLE_MAX = 640;

  // Côté affiché, en pixels CSS, borné pour qu'un réglage erroné ne casse pas l'écran.
  function taille(reglages) {
    const t = Number(reglages && reglages.taille_px);
    return Math.min(TAILLE_MAX, Math.max(TAILLE_MIN, t > 0 ? t : TAILLE_DEFAUT));
  }

  // Variante vidéo : 320 si elle couvre les pixels réels de l'écran, sinon 640.
  function variante(taillePx, ratioPixels) {
    return taillePx * (ratioPixels || 1) <= 320 ? 320 : 640;
  }

  // Immobilité d'idle sur la pose de repos, tirée entre min_s et max_s, en ms.
  function dureeRepos(reglages, aleatoire = Math.random) {
    const r = (reglages && reglages.attente_repos_s) || {};
    const min = Math.max(0, Number(r.min_s) || 0);
    const max = Math.max(min, Number(r.max_s) || 0);
    return Math.round((min + aleatoire() * (max - min)) * 1000);
  }

  // think seulement si la recherche dure plus que ce seuil (ms).
  function seuilRecherche(reglages) {
    return Math.max(0, Number(reglages && reglages.recherche_seuil_ms) || 0);
  }

  // wave à la fermeture de la bulle, au plus une fois par intervalle. Retourne une fonction
  // qui dit si l'au revoir est permis maintenant (et le note s'il l'est).
  function limiteurAuRevoir(maintenant = Date.now) {
    let dernier = -Infinity;
    return function permis(reglages) {
      const intervalle = Math.max(0, Number(reglages && reglages.au_revoir_intervalle_min) || 0) * 60000;
      const t = maintenant();
      if (t - dernier < intervalle) return false;
      dernier = t;
      return true;
    };
  }

  const R = { taille, variante, dureeRepos, seuilRecherche, limiteurAuRevoir };
  if (typeof module !== 'undefined' && module.exports) module.exports = R;
  else racine.ReglesMascotte = R;
})(this);
