'use strict';
// Mascotte L'Orange Bleue en vidéos WebM VP9 transparentes, affichées en taille_px × taille_px.
// Deux variantes livrées : 320 et 640 px ; on prend la plus petite qui reste nette à l'écran.
// Une balise <video> par clip, préchargée, muette, superposées : une seule est visible.
// On ne change jamais la source d'une balise (aucune image vide au changement de clip).
// Tous les clips commencent et finissent sur la même pose de repos : on enchaîne sans fondu.
// Au repos, idle joue un passage puis reste figé sur la pose un temps tiré au hasard :
// une vidéo arrêtée ne coûte rien au processeur.
// Interface commune à tout avatar : etat() (vocabulaire de la silhouette, ignoré ici),
// evenement(nom) (états de contenu/mascotte.json), contient(x, y), pause(b), detruire().

(function () {
  const TYPE = 'video/webm; codecs="vp9"';
  const COTE_MASQUE = 640; // repos.png
  const SEUIL_OPACITE = 128; // alpha de repos.png à partir duquel un pixel capte la souris
  const DELAI_CHARGEMENT_MS = 20000;

  const R = window.ReglesMascotte;

  function monter(conteneur, { dossier, reglages, surErreur }) {
    const etats = reglages.etats || {};
    // Invisible tant que le premier clip n'a pas son image : ni carré vide, ni image noire.
    conteneur.classList.add('mascotte', 'en-chargement');
    const ombre = document.createElement('div');
    ombre.className = 'mascotte-ombre';
    conteneur.append(ombre);
    const cote = R.variante(R.taille(reglages), window.devicePixelRatio);
    const dossierClips = `${dossier}/${cote}`;
    conteneur.dataset.variante = cote;

    const videos = {};
    let courant = null;
    let fond = null; // clip en boucle sur lequel on revient : idle, ou talk tant qu'une carte est ouverte
    let enPause = true;
    let minuterieRepos = null; // idle figé sur la pose, en attente du prochain passage
    let masque = null;
    let echoue = false;
    let minuterieChargement = null;

    function echec(message) {
      if (echoue) return;
      echoue = true;
      clearTimeout(minuterieChargement);
      clearTimeout(minuterieRepos);
      surErreur(message);
    }

    const clipAttente = etats.attente && etats.attente.clip;
    const clips = [...new Set(Object.values(etats).map((e) => e && e.clip).filter(Boolean))];
    if (!clipAttente) {
      setTimeout(() => echec('aucun clip pour l\'état « attente »'));
    } else if (!document.createElement('video').canPlayType(TYPE)) {
      setTimeout(() => echec('lecture WebM VP9 impossible sur ce poste'));
    }

    function finDeClip(nom) {
      if (courant !== nom) return;
      // Fin d'un passage d'idle : on reste sur la dernière image (la pose de repos).
      if (nom === fond && nom === clipAttente) {
        const ms = R.dureeRepos(reglages);
        if (ms > 0) {
          minuterieRepos = setTimeout(() => { minuterieRepos = null; jouer(fond); }, ms);
          return;
        }
      }
      jouer(fond); // clip joué une fois → fond ; talk → il repart
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
      v.addEventListener('ended', () => finDeClip(nom));
      v.addEventListener('loadeddata', () => {
        if (courant === nom) conteneur.classList.remove('en-chargement');
      });
      v.src = `${dossierClips}/${nom}.webm`;
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
        c.width = c.height = COTE_MASQUE;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(repos, 0, 0, COTE_MASQUE, COTE_MASQUE);
        const px = ctx.getImageData(0, 0, COTE_MASQUE, COTE_MASQUE).data;
        masque = new Uint8Array(COTE_MASQUE * COTE_MASQUE);
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
      clearTimeout(minuterieRepos);
      minuterieRepos = null;
      const ancien = courant && videos[courant];
      courant = nom;
      conteneur.dataset.clip = nom;
      if (v.currentTime !== 0) v.currentTime = 0;
      // Montrer le nouveau avant de cacher l'ancien, dans la même tâche : jamais zéro clip visible.
      v.classList.add('visible');
      if (v.readyState >= 2) conteneur.classList.remove('en-chargement');
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
        // Déjà en cours : on ne le relance pas. idle figé sur la pose compte comme en cours.
        if (courant === e.clip) return;
        jouer(e.clip);
      },
      contient(x, y) {
        if (!masque) return false;
        const r = conteneur.getBoundingClientRect();
        const ix = Math.floor(((x - r.left) / r.width) * COTE_MASQUE);
        const iy = Math.floor(((y - r.top) / r.height) * COTE_MASQUE);
        if (ix < 0 || iy < 0 || ix >= COTE_MASQUE || iy >= COTE_MASQUE) return false;
        return masque[iy * COTE_MASQUE + ix] === 1;
      },
      pause(b) {
        enPause = !!b;
        const v = courant && videos[courant];
        if (!v || minuterieRepos) return; // idle figé : rien ne tourne, le repos suit son cours
        if (enPause) v.pause();
        else lancer(v);
      },
      detruire() {
        echoue = true;
        clearTimeout(minuterieChargement);
        clearTimeout(minuterieRepos);
        // Démontage (passage en silhouette) : on libère les décodeurs, rien n'est plus affiché.
        for (const v of Object.values(videos)) {
          v.pause();
          v.removeAttribute('src');
          v.load();
        }
        conteneur.replaceChildren();
        conteneur.classList.remove('mascotte', 'en-chargement');
        delete conteneur.dataset.clip;
        delete conteneur.dataset.variante;
      },
    };
  }

  window.AvatarMascotte = { monter };
})();
