'use strict';
// Avatar en mode silhouette CSS. Ce mode ne disparaît jamais : c'est le repli quand une vidéo
// de la mascotte ne se lit pas, le réglage « silhouette » de contenu/mascotte.json, et le mode
// léger des vieux postes.
// Interface commune à tout avatar : monter(conteneur) puis etat('repos' | 'survol' | 'ecoute' | 'parle'),
// evenement(nom) (clips de la mascotte, ignorés ici), contient(x, y), pause(b), detruire().

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
      evenement() {},
      contient: () => false, // tête et corps portent data-interactif : pas besoin de masque
      pause(b) {
        conteneur.classList.toggle('en-pause', !!b);
      },
      detruire() {
        conteneur.replaceChildren();
        conteneur.classList.remove('silhouette', 'en-pause');
        delete conteneur.dataset.etat;
      },
    };
  }

  window.AvatarSilhouette = { monter };
})();
