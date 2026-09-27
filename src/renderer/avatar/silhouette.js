'use strict';
// Avatar en mode silhouette CSS. Ce mode ne disparaît jamais : c'est le repli quand une vidéo
// de la mascotte ne se lit pas, le réglage « silhouette » de contenu/mascotte.json, et le mode
// léger des vieux postes.
// Interface commune à tout avatar : monter(conteneur) puis etat('repos' | 'survol' | 'ecoute' | 'parle'),
// evenement(nom) (clips de la mascotte, ignorés ici), contient(x, y), pause(b), activite(),
// variante, detruire(). surChangement() est appelé quand activite() peut avoir changé.
// Immobile à l'état repos (voir silhouette.css) : elle ne s'anime qu'hors attente.

(function () {
  function monter(conteneur, { surChangement = () => {} } = {}) {
    let etat = 'repos';
    let enPause = false;
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
        etat = nom;
        conteneur.dataset.etat = nom;
        surChangement();
      },
      evenement() {},
      contient: () => false, // tête et corps portent data-interactif : pas besoin de masque
      pause(b) {
        enPause = !!b;
        conteneur.classList.toggle('en-pause', enPause);
        surChangement();
      },
      activite() {
        return { attente: etat === 'repos', lecture: etat !== 'repos' && !enPause };
      },
      variante: null,
      detruire() {
        conteneur.replaceChildren();
        conteneur.classList.remove('silhouette', 'en-pause');
        delete conteneur.dataset.etat;
      },
    };
  }

  window.AvatarSilhouette = { monter };
})();
