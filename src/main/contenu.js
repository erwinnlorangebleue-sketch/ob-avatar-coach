'use strict';
// Fichiers de contenu : livrés avec l'appli, puis relus depuis la branche main du dépôt
// et mis en cache. Ordre de lecture : cache validé > copie livrée. Un fichier distant
// invalide n'écrase jamais une version qui fonctionne.

const fs = require('fs');
const path = require('path');

const BASE_DISTANTE = 'https://raw.githubusercontent.com/erwinnlorangebleue-sketch/ob-avatar-coach/main/contenu/';

const FICHIERS_JSON = ['config.json', 'interface.json', 'index.json', 'synonymes.json', 'mots-vides.json'];
const FAMILLES = ['theorie', 'methodes', 'a-ecarter', 'complements'];
const FICHIERS_MD = FAMILLES.map((f) => f + '.md');

function valide(nom, texte) {
  if (nom.endsWith('.md')) return /^#{2,3} /m.test(texte);
  try {
    const v = JSON.parse(texte);
    if (nom === 'index.json') return Array.isArray(v) && v.length > 0;
    return v && typeof v === 'object';
  } catch (_) {
    return false;
  }
}

function creerContenu({ dossierLivre, dossierCache, journal, telecharger }) {
  fs.mkdirSync(dossierCache, { recursive: true });

  function lireFichier(nom) {
    for (const dossier of [dossierCache, dossierLivre]) {
      try {
        const texte = fs.readFileSync(path.join(dossier, nom), 'utf8');
        if (valide(nom, texte)) return texte;
        journal.erreur(`contenu invalide ignoré : ${dossier === dossierCache ? 'cache' : 'livré'}/${nom}`);
      } catch (_) { /* absent : on passe au suivant */ }
    }
    return null;
  }

  function charger() {
    const json = {};
    for (const nom of FICHIERS_JSON) {
      const t = lireFichier(nom);
      json[nom] = t ? JSON.parse(t) : null;
    }
    const md = {};
    for (const famille of FAMILLES) md[famille] = lireFichier(famille + '.md') || '';
    return {
      config: json['config.json'] || {},
      textes: json['interface.json'] || {},
      index: json['index.json'] || [],
      synonymes: json['synonymes.json'] || {},
      motsVides: json['mots-vides.json'] || { mots: [] },
      md,
    };
  }

  // Relit tous les fichiers depuis GitHub. Retourne le nombre de fichiers modifiés.
  async function synchroniser() {
    let modifies = 0;
    let erreurs = 0;
    for (const nom of [...FICHIERS_JSON, ...FICHIERS_MD]) {
      try {
        const texte = await telecharger(BASE_DISTANTE + encodeURIComponent(nom));
        if (!valide(nom, texte)) {
          erreurs++;
          journal.erreur(`contenu distant invalide, conservé l'ancien : ${nom}`);
          continue;
        }
        const cible = path.join(dossierCache, nom);
        let actuel = null;
        try { actuel = fs.readFileSync(cible, 'utf8'); } catch (_) {}
        if (actuel !== texte) {
          fs.writeFileSync(cible + '.tmp', texte);
          fs.renameSync(cible + '.tmp', cible);
          modifies++;
        }
      } catch (e) {
        erreurs++;
        journal.info(`contenu distant indisponible (${nom}) : ${e.message}`);
      }
    }
    if (erreurs === 0) journal.majEtat({ derniere_synchro_contenu: new Date().toISOString() });
    return { modifies, erreurs };
  }

  return { charger, synchroniser };
}

module.exports = { creerContenu, FAMILLES };
