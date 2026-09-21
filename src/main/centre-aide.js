'use strict';
// Synchronisation nocturne du centre d'aide : API publique, sans authentification.
// On garde les métadonnées + un sac de mots-clés par article, jamais le texte de l'article.

const fs = require('fs');
const path = require('path');
const { construireIndex } = require('./recherche');

const API = 'https://support.lorangebleue.fr/api/v2/help_center/';
const PAGES_MAX = 20;

function creerCentreAide({ dossier, journal, telechargerJson }) {
  const fichier = path.join(dossier, 'centre-aide-index.json');

  function lire() {
    try {
      const donnees = JSON.parse(fs.readFileSync(fichier, 'utf8'));
      if (Array.isArray(donnees.articles) && donnees.articles.length > 0) return donnees;
    } catch (_) {}
    return null;
  }

  async function toutesLesPages(url, cle) {
    const elements = [];
    let suivante = url;
    for (let i = 0; suivante && i < PAGES_MAX; i++) {
      const page = await telechargerJson(suivante);
      elements.push(...(page[cle] || []));
      suivante = page.next_page;
    }
    return elements;
  }

  async function synchroniser(motsVides) {
    const articles = await toutesLesPages(API + 'fr/articles.json?per_page=100', 'articles');
    const sections = await toutesLesPages(API + 'fr/sections.json?per_page=100', 'sections');
    // Garde-fou : une réponse vide ou tronquée n'écrase jamais un index qui fonctionne.
    const ancien = lire();
    if (articles.length === 0 || (ancien && articles.length < ancien.articles.length * 0.5)) {
      throw new Error(`réponse suspecte (${articles.length} articles), index précédent conservé`);
    }
    const donnees = {
      synchronise_le: new Date().toISOString(),
      nombre: articles.length,
      articles: construireIndex(articles, sections, motsVides),
    };
    fs.writeFileSync(fichier + '.tmp', JSON.stringify(donnees));
    fs.renameSync(fichier + '.tmp', fichier);
    journal.majEtat({ derniere_synchro_articles: donnees.synchronise_le, articles: donnees.nombre });
    journal.info(`centre d'aide synchronisé : ${donnees.nombre} articles`);
    return donnees;
  }

  return { lire, synchroniser, fichier };
}

module.exports = { creerCentreAide };
