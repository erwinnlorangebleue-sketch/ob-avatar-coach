'use strict';
// Règles de la mascotte, sans DOM : chargées par la page (window.ReglesMascotte) et par les tests.
// Tous les nombres viennent de contenu/mascotte.json ; les valeurs ci-dessous ne servent que
// si le fichier en est dépourvu.

(function (racine) {
  const TAILLE_DEFAUT = 160;
  const TAILLE_MIN = 80;
  const TAILLE_MAX = 640;
  const VARIANTES_DEFAUT = [320, 640];

  // Côté affiché, en pixels CSS, borné pour qu'un réglage erroné ne casse pas l'écran.
  function taille(reglages) {
    const t = Number(reglages && reglages.taille_px);
    return Math.min(TAILLE_MAX, Math.max(TAILLE_MIN, t > 0 ? t : TAILLE_DEFAUT));
  }

  // Variante vidéo : la plus petite qui couvre les pixels réels de l'écran, sinon la plus grande.
  function variante(taillePx, ratioPixels, variantes) {
    const liste = (Array.isArray(variantes) ? variantes : []).map(Number).filter((v) => v > 0).sort((a, b) => a - b);
    if (!liste.length) liste.push(...VARIANTES_DEFAUT);
    const besoin = taillePx * (ratioPixels || 1);
    return liste.find((v) => besoin <= v) || liste[liste.length - 1];
  }

  // Passages d'un fond (état en boucle) avant de s'immobiliser sur la pose de repos.
  // Sans réglage : il tourne tant que l'état dure.
  function passages(etat) {
    const n = Math.floor(Number(etat && etat.passages));
    return n >= 1 ? n : Infinity;
  }

  // Immobilité sur la pose de repos, tirée entre repos_s.min_s et max_s, en ms.
  // null : pas de reprise, le fond reste immobile jusqu'au changement d'état.
  function dureeRepos(etat, aleatoire = Math.random) {
    const r = etat && etat.repos_s;
    if (!r) return null;
    const min = Math.max(0, Number(r.min_s) || 0);
    const max = Math.max(min, Number(r.max_s) || 0);
    return Math.round((min + aleatoire() * (max - min)) * 1000);
  }

  // Fin d'un passage du fond : on le rejoue tant qu'il reste des passages, sinon on reste sur
  // la pose (reposMs, ou null jusqu'au changement d'état). Une vidéo arrêtée ne coûte rien.
  function apresPassage(etat, passagesFaits, aleatoire) {
    if (passagesFaits < passages(etat)) return { rejouer: true };
    return { rejouer: false, reposMs: dureeRepos(etat, aleatoire) };
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

  const R = { taille, variante, passages, dureeRepos, apresPassage, seuilRecherche, limiteurAuRevoir };
  if (typeof module !== 'undefined' && module.exports) module.exports = R;
  else racine.ReglesMascotte = R;
})(this);
