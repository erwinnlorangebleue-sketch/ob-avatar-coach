'use strict';
// Cartes de contenu : le texte vient des fichiers Markdown, la catégorie vient de index.json.
// Règle fermée par défaut : une carte ne s'affiche que si index.json lui donne une catégorie
// autorisée ET qu'on retrouve son texte. À VÉRIFIER, catégorie inconnue, désaccord entre
// l'index et le titre Markdown, texte introuvable : la carte n'existe pas pour l'écran.

const { normaliser } = require('./recherche');

const CATEGORIE_EN_TITRE = /\s*\[([^\]]+)\]\s*$/;
const CODE_EN_TETE = /^[A-Z]\d{2}\s*[—–-]\s*/;
const SUFFIXE_INDEX = /\s*\(sans allégation\)\s*$/i;

function cleTitre(titre) {
  return normaliser(titre.replace(CATEGORIE_EN_TITRE, '').replace(CODE_EN_TETE, '').replace(SUFFIXE_INDEX, ''));
}

// Découpe un fichier Markdown en sections { niveau, titre, categorie, corps }.
function sectionsMarkdown(md) {
  const lignes = String(md).split(/\r?\n/);
  const sections = [];
  let courante = null;
  for (const ligne of lignes) {
    const t = /^(#{1,6})\s+(.*)$/.exec(ligne);
    if (t) {
      const brut = t[2].trim();
      const cat = CATEGORIE_EN_TITRE.exec(brut);
      courante = { niveau: t[1].length, titre: brut, categorie: cat ? cat[1].trim() : null, lignes: [] };
      sections.push(courante);
    } else if (/^\s*---\s*$/.test(ligne)) {
      courante = null; // un séparateur clôt la section en cours
    } else if (courante) {
      courante.lignes.push(ligne);
    }
  }
  return sections.map((s) => ({
    niveau: s.niveau,
    titre: s.titre,
    categorie: s.categorie,
    corps: s.lignes.join('\n').trim(),
  }));
}

// fichiersMd : { famille: contenuMarkdown }. Retourne { cartes, ecartees: [{id, motif}] }.
function construireCartes(index, fichiersMd, categoriesAffichables) {
  const autorisees = new Set(categoriesAffichables);
  const parFamille = {};
  for (const [famille, md] of Object.entries(fichiersMd)) {
    parFamille[famille] = sectionsMarkdown(md).filter((s) => s.niveau >= 2);
  }
  const cartes = [];
  const ecartees = [];
  for (const entree of Array.isArray(index) ? index : []) {
    if (!autorisees.has(entree.categorie)) {
      ecartees.push({ id: entree.id, motif: 'catégorie ' + entree.categorie });
      continue;
    }
    const sections = parFamille[entree.famille] || [];
    const cle = cleTitre(entree.titre || '');
    const section = sections.find((s) => cleTitre(s.titre) === cle);
    if (!section || !section.corps) {
      ecartees.push({ id: entree.id, motif: 'texte introuvable' });
      continue;
    }
    if (section.categorie && section.categorie !== entree.categorie) {
      ecartees.push({ id: entree.id, motif: 'catégorie en désaccord avec le Markdown' });
      continue;
    }
    cartes.push({
      id: entree.id,
      famille: entree.famille,
      titre: entree.titre,
      categorie: entree.categorie,
      source: entree.source || '',
      date: entree.date || '',
      corps: section.corps,
    });
  }
  return { cartes, ecartees };
}

// Pioche sans répétition : on épuise le paquet mélangé avant de le remélanger.
function creerPioche(cartes, aleatoire = Math.random) {
  let paquet = [];
  return function piocher() {
    if (cartes.length === 0) return null;
    if (paquet.length === 0) {
      paquet = cartes.slice();
      for (let i = paquet.length - 1; i > 0; i--) {
        const j = Math.floor(aleatoire() * (i + 1));
        [paquet[i], paquet[j]] = [paquet[j], paquet[i]];
      }
    }
    return paquet.pop();
  };
}

module.exports = { sectionsMarkdown, construireCartes, creerPioche, cleTitre };
