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
  const avatar = window.AvatarSilhouette.monter(document.getElementById('avatar'));
  avatar.etat('repos');

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
  const interactifSous = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return !!(el && el.closest('[data-interactif]'));
  };
  document.addEventListener('mousemove', (e) => majSurvol(interactifSous(e.clientX, e.clientY)));
  // Quand la fenêtre redevient cliquable, Chromium émet un mouseleave parasite alors que le
  // curseur est toujours sur l'avatar : on ne relâche que si le point quitté n'est pas interactif.
  document.addEventListener('mouseleave', (e) => {
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
  function recevoirInit(d) {
    textes = d.textes || {};
    appliquerTextes();
    majVeilleuse(d.veilleuse);
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
    elCarte.hidden = true;
    elChoixVeilleuse.hidden = true;
    clearInterval(minuterieCarte);
    if (elQuestion.hidden) avatar.etat('repos');
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
    restantCarte = c.dureeS;
    clearInterval(minuterieCarte);
    minuterieCarte = setInterval(() => {
      if (!carteSurvolee && --restantCarte <= 0) fermerCarte();
    }, 1000);
  });
  elCarte.addEventListener('mouseenter', () => { carteSurvolee = true; });
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
  document.querySelectorAll('.sil-tete, .sil-corps').forEach((el) => {
    el.addEventListener('click', () => {
      if (elQuestion.hidden) ob.demanderQuestion();
      else fermerQuestion();
    });
  });

  ob.surOuvrirQuestion(() => {
    elQuestion.hidden = false; // avant fermerCarte(), sinon le survol serait relâché
    fermerCarte();
    avatar.etat('ecoute');
    elChamp.focus();
    elChamp.select();
  });

  function fermerQuestion() {
    if (elQuestion.hidden) return;
    elQuestion.hidden = true;
    elReponse.replaceChildren();
    elChamp.value = '';
    avatar.etat('repos');
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
    const r = await ob.rechercher(q);
    const noeuds = [];
    if (r.etat === 'ok') {
      noeuds.push(paragraphe('reponse-intro', t('resultats_intro')));
      for (const res of r.resultats) {
        const ligne = document.createElement('div');
        ligne.className = 'resultat';
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
