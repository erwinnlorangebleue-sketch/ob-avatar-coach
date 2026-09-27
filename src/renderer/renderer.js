'use strict';
// Page de l'avatar. Aucun texte affichable ici : tout vient de contenu/interface.json.

(function () {
  const ob = window.ob;
  let textes = {};
  const t = (cle) => (textes[cle] != null ? textes[cle] : '');

  const elCarte = document.getElementById('carte');
  const elQuestion = document.getElementById('question');
  const elForm = document.getElementById('question-form');
  const elChamp = document.getElementById('question-champ');
  const elReponse = document.getElementById('question-reponse');

  // ---------- Avatar : mascotte vidéo, ou silhouette CSS (réglage distant, ou repli sur panne) ----------
  const elAvatar = document.getElementById('avatar');
  const DOSSIER_MASCOTTE = '../../assets/mascotte/';
  const SANS_AVATAR = {
    etat() {}, evenement() {}, contient: () => false, pause() {}, activite: () => ({}), variante: null, detruire() {},
  };
  let avatar = SANS_AVATAR;
  let modeAvatar = null;
  let panneVideo = null; // message de la panne qui a imposé la silhouette, jusqu'au redémarrage
  let enPause = true;
  let reglagesMascotte = {};
  let modeAffiche = null; // video ou silhouette, une fois monté
  let phaseSignalee = '';

  function monterAvatar(reglages) {
    const voulu = reglages.mascotte === 'silhouette' || panneVideo ? 'silhouette' : 'video';
    // Remonté aussi quand la correspondance états → clips change à distance.
    const cle = voulu === 'video'
      ? 'video ' + JSON.stringify([reglages.dossier, reglages.variantes, reglages.etats, reglages.taille_px])
      : voulu;
    if (cle === modeAvatar) return;
    modeAffiche = null; // pas de phase signalée pendant le remontage
    avatar.detruire();
    modeAvatar = cle;
    document.body.classList.toggle('avatar-silhouette', voulu === 'silhouette');
    document.documentElement.style.setProperty('--taille-mascotte', ReglesMascotte.taille(reglages) + 'px');
    avatar = voulu === 'video'
      ? window.AvatarMascotte.monter(elAvatar, {
        dossier: DOSSIER_MASCOTTE + reglages.dossier,
        reglages,
        surErreur(message) {
          panneVideo = message;
          monterAvatar(reglages);
        },
        surChangement: signalerPhase,
      })
      : window.AvatarSilhouette.monter(elAvatar, { surChangement: signalerPhase });
    modeAffiche = voulu;
    avatar.pause(enPause);
    avatar.etat(!elQuestion.hidden ? 'ecoute' : !elCarte.hidden ? 'parle' : 'repos');
    if (!elCarte.hidden) avatar.evenement('carte');
    ob.mascotte(voulu, voulu === 'silhouette' ? panneVideo : null);
    signalerPhase();
  }

  // ---------- Phase, pour la mesure du processeur (processus principal) ----------
  // attente : aucune bulle, mascotte dans son cycle d'attente ; lecture : une animation tourne
  // hors attente ; autre : ni l'un ni l'autre (bulle ouverte, mascotte immobile), non mesuré.
  function signalerPhase() {
    if (!modeAffiche) return;
    const a = avatar.activite();
    const phase = elQuestion.hidden && elCarte.hidden && a.attente ? 'attente' : a.lecture ? 'lecture' : 'autre';
    const p = { phase, mode: modeAffiche, variante: avatar.variante, clip: a.clip || null };
    const cle = JSON.stringify(p);
    if (cle === phaseSignalee) return;
    phaseSignalee = cle;
    ob.phase(p);
  }
  // Une bulle qui s'ouvre ou se ferme change la phase, même sans changer de clip.
  const observateurBulles = new MutationObserver(() => signalerPhase());
  for (const el of [elCarte, elQuestion]) observateurBulles.observe(el, { attributes: true, attributeFilter: ['hidden'] });

  // ---------- Taille de la fenêtre : jamais plus grande que ce qu'elle affiche ----------
  // Tout est ancré en bas à droite : la page mesure l'étendue des éléments visibles (bulles
  // comprises quand elles sont ouvertes) et le processus principal redimensionne la fenêtre
  // en gardant ce coin fixe. Rien d'invisible ne reste posé sur les autres applications.
  const MARGE_OMBRE_BULLE = 24;
  let tailleDemandee = '';
  function ajusterFenetre() {
    let gauche = window.innerWidth;
    let haut = window.innerHeight;
    // Positions de mise en page (offset*) : l'animation d'entrée des bulles ne compte pas.
    // Les bulles gardent la place de leur ombre portée (box-shadow de .bulle).
    for (const el of [elAvatar, elCarte, elQuestion]) {
      if (el.hidden || !el.offsetWidth || !el.offsetHeight) continue;
      const marge = el === elAvatar ? 0 : MARGE_OMBRE_BULLE;
      gauche = Math.min(gauche, el.offsetLeft - marge);
      haut = Math.min(haut, el.offsetTop - marge);
    }
    const largeur = Math.ceil(window.innerWidth - gauche);
    const hauteur = Math.ceil(window.innerHeight - haut);
    const cle = largeur + 'x' + hauteur;
    if (cle === tailleDemandee || largeur <= 0 || hauteur <= 0) return;
    tailleDemandee = cle;
    ob.taille(largeur, hauteur);
  }
  const observateur = new ResizeObserver(() => ajusterFenetre());
  for (const el of [elAvatar, elCarte, elQuestion]) observateur.observe(el);

  ob.surPause((b) => {
    enPause = b;
    avatar.pause(b);
  });
  ob.surReveil(() => avatar.evenement('accueil')); // sortie de veille

  // ---------- Traversée des clics ----------
  // La fenêtre ignore les clics par défaut ; la page reçoit quand même les mouvements
  // (forward:true). Au-dessus d'un élément [data-interactif], on redemande les clics.
  let survolActif = false;
  function majSurvol(actif) {
    if (actif === survolActif) return;
    survolActif = actif;
    ob.survol(actif);
    if (!elQuestion.hidden) return;
    avatar.etat(actif ? 'survol' : 'repos');
  }
  // Sur la mascotte vidéo, seuls ses pixels opaques comptent, pas son carré.
  const interactifSous = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return !!(el && el.closest('[data-interactif]')) || avatar.contient(x, y);
  };
  document.addEventListener('mousemove', (e) => {
    document.body.classList.toggle('sur-mascotte', avatar.contient(e.clientX, e.clientY));
    majSurvol(interactifSous(e.clientX, e.clientY));
  });
  // Quand la fenêtre redevient cliquable, Chromium émet un mouseleave parasite alors que le
  // curseur est toujours sur l'avatar : on ne relâche que si le point quitté n'est pas interactif.
  document.addEventListener('mouseleave', (e) => {
    document.body.classList.remove('sur-mascotte');
    if (!interactifSous(e.clientX, e.clientY)) majSurvol(false);
  });
  // Un élément qui disparaît sous le curseur ne déclenche pas de mousemove : on relâche.
  function relacherSiMasque() {
    if (survolActif && elQuestion.hidden && elCarte.hidden) majSurvol(false);
  }

  // ---------- Textes ----------
  function appliquerTextes() {
    document.querySelectorAll('[data-texte]').forEach((el) => { el.textContent = t(el.dataset.texte); });
    document.querySelectorAll('[data-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.placeholder); });
    document.querySelectorAll('[data-titre]').forEach((el) => { el.title = t(el.dataset.titre); });
  }
  let premierInit = true;
  function recevoirInit(d) {
    textes = d.textes || {};
    appliquerTextes();
    majVeilleuse(d.veilleuse);
    if (typeof d.pause === 'boolean') enPause = d.pause;
    reglagesMascotte = d.mascotte || {};
    monterAvatar(reglagesMascotte);
    avatar.pause(enPause);
    if (premierInit) avatar.evenement('accueil'); // démarrage
    premierInit = false;
  }
  ob.init().then(recevoirInit);
  ob.surInit(recevoirInit);

  // ---------- Petit rendu Markdown (sûr : tout est échappé d'abord) ----------
  function echapper(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function enLigne(s) {
    return echapper(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }
  function markdown(md) {
    return String(md).split(/\n\s*\n/).map((bloc) => {
      const lignes = bloc.split('\n');
      if (lignes.every((l) => /^\s*[-*] /.test(l))) {
        return '<ul>' + lignes.map((l) => '<li>' + enLigne(l.replace(/^\s*[-*] /, '')) + '</li>').join('') + '</ul>';
      }
      if (lignes.every((l) => /^\s*>/.test(l))) {
        return '<blockquote>' + enLigne(lignes.map((l) => l.replace(/^\s*>\s?/, '')).join(' ')) + '</blockquote>';
      }
      return '<p>' + enLigne(lignes.join(' ')) + '</p>';
    }).join('');
  }

  function dateLisible(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ---------- Cartes spontanées ----------
  let minuterieCarte = null;
  let carteSurvolee = false;
  let restantCarte = 0;

  function fermerCarte() {
    const etaitOuverte = !elCarte.hidden;
    elCarte.hidden = true;
    elChoixVeilleuse.hidden = true;
    clearInterval(minuterieCarte);
    if (elQuestion.hidden) avatar.etat('repos');
    if (etaitOuverte) avatar.evenement('attente');
    relacherSiMasque();
  }

  ob.surCarte((c) => {
    if (!elQuestion.hidden) return;
    elCarte.dataset.registre = c.categorie;
    elCarte.querySelector('.carte-famille').textContent = (textes.familles || {})[c.famille] || '';
    elCarte.querySelector('.carte-registre').textContent = (textes.registres || {})[c.categorie] || '';
    elCarte.querySelector('.carte-titre').textContent = c.titre;
    elCarte.querySelector('.carte-corps').innerHTML = markdown(c.corps);
    // Source et date : pour les registres qui nuancent. ÉTABLI affirme, PRATIQUE MÉTIER n'est pas un débat.
    const avecSource = c.categorie === 'CONSENSUS' || c.categorie === 'DÉBATTU';
    elCarte.querySelector('.carte-source').textContent = avecSource
      ? `${t('carte_source')} ${c.source} · ${t('carte_date')} ${dateLisible(c.date)}`
      : '';
    elCarte.hidden = false;
    elCarte.scrollTop = 0;
    avatar.etat('parle');
    avatar.evenement('carte');
    restantCarte = c.dureeS;
    clearInterval(minuterieCarte);
    minuterieCarte = setInterval(() => {
      if (!carteSurvolee && --restantCarte <= 0) fermerCarte();
    }, 1000);
  });
  elCarte.addEventListener('mouseenter', () => {
    carteSurvolee = true;
    avatar.evenement('designer');
  });
  elCarte.addEventListener('mouseleave', () => { carteSurvolee = false; });
  elCarte.querySelector('.bulle-fermer').addEventListener('click', fermerCarte);

  // ---------- Veilleuse des cartes (choisie par le coach, toujours limitée dans le temps) ----------
  const elChoixVeilleuse = elCarte.querySelector('.carte-veilleuse');
  const elEtatVeilleuse = document.getElementById('veilleuse-etat');

  elCarte.querySelector('.carte-cloche').addEventListener('click', () => {
    elChoixVeilleuse.hidden = !elChoixVeilleuse.hidden;
  });
  elChoixVeilleuse.querySelectorAll('[data-veilleuse]').forEach((bouton) => {
    bouton.addEventListener('click', () => {
      ob.veilleuse(bouton.dataset.veilleuse);
      fermerCarte();
    });
  });
  elEtatVeilleuse.querySelector('button').addEventListener('click', () => ob.veilleuse('aucune'));

  function echeanceLisible(iso) {
    const d = new Date(iso);
    const memeJour = d.toDateString() === new Date().toDateString();
    return d.toLocaleString('fr-FR', memeJour
      ? { hour: '2-digit', minute: '2-digit' }
      : { weekday: 'long', hour: '2-digit', minute: '2-digit' });
  }
  function majVeilleuse(jusqua) {
    elEtatVeilleuse.hidden = !jusqua;
    if (jusqua) document.getElementById('veilleuse-texte').textContent = `${t('veilleuse_active')} ${echeanceLisible(jusqua)}`;
  }
  ob.surVeilleuse(majVeilleuse);

  // ---------- Question ----------
  elAvatar.addEventListener('click', (e) => {
    if (!e.target.closest('[data-interactif]') && !avatar.contient(e.clientX, e.clientY)) return;
    if (elQuestion.hidden) ob.demanderQuestion();
    else fermerQuestion();
  });

  ob.surOuvrirQuestion(() => {
    elQuestion.hidden = false; // avant fermerCarte(), sinon le survol serait relâché
    fermerCarte();
    avatar.etat('ecoute');
    elChamp.focus();
    elChamp.select();
  });

  // wave à la fermeture de la bulle, au plus une fois par au_revoir_intervalle_min.
  const auRevoirPermis = ReglesMascotte.limiteurAuRevoir();
  function direAuRevoir() {
    if (auRevoirPermis(reglagesMascotte)) avatar.evenement('au_revoir');
  }

  function fermerQuestion() {
    if (elQuestion.hidden) return;
    elQuestion.hidden = true;
    elReponse.replaceChildren();
    elChamp.value = '';
    avatar.etat('repos');
    direAuRevoir();
    ob.questionFermee();
    relacherSiMasque();
  }
  ob.surFermerQuestion(fermerQuestion);
  elQuestion.querySelector('.bulle-fermer').addEventListener('click', fermerQuestion);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fermerQuestion();
  });

  function paragraphe(classe, texte) {
    const p = document.createElement('p');
    p.className = classe;
    p.textContent = texte;
    return p;
  }

  function ligneSource(synchro) {
    if (!synchro || !synchro.date) return paragraphe('reponse-source', t('source_centre_aide'));
    const horsLigne = synchro.horsLigne ? ` (${t('hors_ligne')})` : '';
    return paragraphe('reponse-source', `${t('source_centre_aide')} · ${t('synchro_du')} ${dateLisible(synchro.date)}${horsLigne}`);
  }

  elForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = elChamp.value.trim();
    if (!q) return;
    elReponse.replaceChildren(paragraphe('reponse-intro', t('recherche_en_cours')));
    // think seulement si la réponse tarde : une recherche locale répond en quelques ms.
    const minuterieThink = setTimeout(() => avatar.evenement('recherche'), ReglesMascotte.seuilRecherche(reglagesMascotte));
    const r = await ob.rechercher(q);
    clearTimeout(minuterieThink);
    avatar.evenement(r.etat === 'ok' ? 'article_trouve' : 'rien_trouve');
    const noeuds = [];
    if (r.etat === 'ok') {
      noeuds.push(paragraphe('reponse-intro', t('resultats_intro')));
      for (const res of r.resultats) {
        const ligne = document.createElement('div');
        ligne.className = 'resultat';
        ligne.addEventListener('mouseenter', () => avatar.evenement('designer'));
        const texte = document.createElement('div');
        texte.className = 'resultat-texte';
        const titre = document.createElement('div');
        titre.className = 'resultat-titre';
        titre.textContent = res.titre;
        const date = document.createElement('div');
        date.className = 'resultat-date';
        date.textContent = `${t('resultat_maj')} ${dateLisible(res.maj)}${res.section ? ' · ' + res.section : ''}`;
        texte.append(titre, date);
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.textContent = t('resultat_ouvrir');
        bouton.addEventListener('click', () => ob.ouvrirArticle(res.url));
        ligne.append(texte, bouton);
        noeuds.push(ligne);
      }
      noeuds.push(ligneSource(r.synchro));
    } else if (r.etat === 'inconnu') {
      noeuds.push(paragraphe('reponse-inconnu', t('inconnu')), ligneSource(r.synchro));
    } else if (r.etat === 'index_absent') {
      noeuds.push(paragraphe('reponse-inconnu', t('inconnu')), paragraphe('reponse-source', t('index_absent')));
    } else if (r.etat === 'desactivee') {
      noeuds.push(paragraphe('reponse-inconnu', t('recherche_desactivee')));
    }
    elReponse.replaceChildren(...noeuds);
  });
})();
