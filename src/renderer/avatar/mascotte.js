'use strict';
// Mascotte L'Orange Bleue en vidéos WebM VP9 transparentes (640 × 640, affichées en 320 × 320).
// Une balise <video> par clip, préchargée, muette, superposées : une seule est visible.
// On ne change jamais la source d'une balise (aucune image vide au changement de clip).
// Tous les clips commencent et finissent sur la même pose de repos : on enchaîne sans fondu.
// Interface commune à tout avatar : etat() (vocabulaire de la silhouette, ignoré ici),
// evenement(nom) (états de contenu/mascotte.json), contient(x, y), pause(b), detruire().

(function () {
  const TYPE = 'video/webm; codecs="vp9"';
  const COTE_SOURCE = 640;
  const SEUIL_OPACITE = 128; // alpha de repos.png à partir duquel un pixel capte la souris
  const DELAI_CHARGEMENT_MS = 20000;

  function monter(conteneur, { dossier, etats, surErreur }) {
    conteneur.classList.add('mascotte');
    const ombre = document.createElement('div');
    ombre.className = 'mascotte-ombre';
    conteneur.append(ombre);

    const videos = {};
    let courant = null;
    let fond = null; // clip en boucle sur lequel on revient : idle, ou talk tant qu'une carte est ouverte
    let enPause = true;
    let masque = null;
    let echoue = false;
    let minuterieChargement = null;

    function echec(message) {
      if (echoue) return;
      echoue = true;
      clearTimeout(minuterieChargement);
      surErreur(message);
    }

    const clipAttente = etats.attente && etats.attente.clip;
    const clips = [...new Set(Object.values(etats).map((e) => e && e.clip).filter(Boolean))];
    if (!clipAttente) {
      setTimeout(() => echec('aucun clip pour l\'état « attente »'));
    } else if (!document.createElement('video').canPlayType(TYPE)) {
      setTimeout(() => echec('lecture WebM VP9 impossible sur ce poste'));
    }

    for (const nom of clips) {
      const v = document.createElement('video');
      v.className = 'mascotte-clip';
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.dataset.clip = nom;
      v.addEventListener('error', () => {
        const e = v.error;
        echec(`${nom}.webm illisible (${e ? `code ${e.code}${e.message ? ' : ' + e.message : ''}` : 'erreur'})`);
      });
      // Clip joué une fois : retour sur le fond. Clip de fond : il repart de zéro.
      v.addEventListener('ended', () => { if (courant === nom) jouer(fond); });
      v.src = `${dossier}/${nom}.webm`;
      conteneur.append(v);
      videos[nom] = v;
    }

    minuterieChargement = setTimeout(() => {
      const lents = clips.filter((n) => videos[n].readyState < 2);
      if (lents.length) echec(`clips non chargés après ${DELAI_CHARGEMENT_MS / 1000} s : ${lents.join(', ')}`);
    }, DELAI_CHARGEMENT_MS);

    // Masque d'opacité calculé une fois sur l'image de repos : seule la mascotte capte la souris.
    const repos = new Image();
    repos.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = COTE_SOURCE;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(repos, 0, 0, COTE_SOURCE, COTE_SOURCE);
        const px = ctx.getImageData(0, 0, COTE_SOURCE, COTE_SOURCE).data;
        masque = new Uint8Array(COTE_SOURCE * COTE_SOURCE);
        for (let i = 0; i < masque.length; i++) masque[i] = px[i * 4 + 3] >= SEUIL_OPACITE ? 1 : 0;
      } catch (e) {
        echec('masque de repos.png : ' + e.message);
      }
    };
    repos.onerror = () => echec('repos.png illisible');
    repos.src = `${dossier}/repos.png`;

    function lancer(v) {
      v.play().catch((e) => {
        // AbortError : une pause (changement de clip, fenêtre cachée) a interrompu la lecture. Normal.
        if (e && e.name !== 'AbortError') echec(`${v.dataset.clip}.webm : lecture impossible (${e.name})`);
      });
    }

    function jouer(nom) {
      const v = videos[nom];
      if (!v || echoue) return;
      const ancien = courant && videos[courant];
      courant = nom;
      conteneur.dataset.clip = nom;
      if (v.currentTime !== 0) v.currentTime = 0;
      // Montrer le nouveau avant de cacher l'ancien, dans la même tâche : jamais zéro clip visible.
      v.classList.add('visible');
      if (ancien && ancien !== v) {
        ancien.classList.remove('visible');
        ancien.pause();
        ancien.currentTime = 0; // prêt, caché, pour son prochain départ
      }
      if (!enPause) lancer(v);
    }

    fond = clipAttente;
    jouer(fond);

    return {
      etat() {},
      evenement(nom) {
        const e = etats[nom];
        if (!e || !videos[e.clip]) return;
        if (e.boucle) fond = e.clip;
        if (courant === e.clip) return; // déjà en cours : on ne le relance pas
        jouer(e.clip);
      },
      contient(x, y) {
        if (!masque) return false;
        const r = conteneur.getBoundingClientRect();
        const ix = Math.floor(((x - r.left) / r.width) * COTE_SOURCE);
        const iy = Math.floor(((y - r.top) / r.height) * COTE_SOURCE);
        if (ix < 0 || iy < 0 || ix >= COTE_SOURCE || iy >= COTE_SOURCE) return false;
        return masque[iy * COTE_SOURCE + ix] === 1;
      },
      pause(b) {
        enPause = !!b;
        const v = courant && videos[courant];
        if (!v) return;
        if (enPause) v.pause();
        else lancer(v);
      },
      detruire() {
        echoue = true;
        clearTimeout(minuterieChargement);
        for (const v of Object.values(videos)) v.pause();
        conteneur.replaceChildren();
        conteneur.classList.remove('mascotte');
        delete conteneur.dataset.clip;
      },
    };
  }

  window.AvatarMascotte = { monter };
})();
