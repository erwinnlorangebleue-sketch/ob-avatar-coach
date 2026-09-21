'use strict';
// Avatar en mode silhouette CSS. Ce mode ne disparaît jamais : c'est le repli quand le
// modèle 3D ne charge pas, et le mode léger des vieux postes.
// Interface commune à tout avatar : monter(conteneur) puis etat('repos' | 'survol' | 'ecoute' | 'parle').

(function () {
  function monter(conteneur) {
    conteneur.classList.add('silhouette');
    conteneur.innerHTML = `
      <div class="sil-ombre"></div>
      <div class="sil-corps" data-interactif></div>
      <div class="sil-tete" data-interactif>
        <span class="sil-oeil sil-oeil-g"></span>
        <span class="sil-oeil sil-oeil-d"></span>
        <span class="sil-bouche"></span>
      </div>`;
    return {
      etat(nom) {
        conteneur.dataset.etat = nom;
      },
    };
  }

  window.AvatarSilhouette = { monter };
})();
