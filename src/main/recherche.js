'use strict';
// Recherche locale par mots-clés dans l'index du centre d'aide.
// Aucune IA : normalisation, synonymes, racines tronquées, pondération titre > section > corps.
// Module pur (pas d'Electron) pour être testé avec node:test.

const LONGUEUR_RACINE = 6;

function normaliser(texte) {
  return String(texte || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Racine volontairement grossière et prévisible : pluriel retiré, puis 6 premières lettres.
// « résilier » et « résiliation » donnent « resili » ; « abonnés » et « abonnement » « abonne ».
function racine(mot) {
  let m = mot;
  if (m.length > 3 && /[sx]$/.test(m)) m = m.slice(0, -1);
  return m.slice(0, LONGUEUR_RACINE);
}

function racines(texte, motsVides) {
  return normaliser(texte)
    .split(' ')
    .filter((m) => m.length > 1 && !motsVides.has(m))
    .map(racine);
}

function preparerMotsVides(fichier) {
  const liste = Array.isArray(fichier) ? fichier : (fichier && fichier.mots) || [];
  return new Set(liste.map(normaliser));
}

// { "mot officiel": ["ce que tape le coach", ...] } -> [{ officiel, expressions normalisées }]
function preparerSynonymes(fichier) {
  const regles = [];
  for (const [officiel, expressions] of Object.entries(fichier || {})) {
    if (officiel.startsWith('_') || !Array.isArray(expressions)) continue;
    regles.push({
      officiel,
      expressions: expressions.map(normaliser).filter(Boolean),
    });
  }
  return regles;
}

function sansMotsVides(texteNormalise, motsVides) {
  return texteNormalise.split(' ').filter((m) => m && !motsVides.has(m)).join(' ');
}

function contient(texte, expression) {
  return (' ' + texte + ' ').includes(' ' + expression + ' ');
}

// L'expression est reconnue telle quelle, ou (si elle garde au moins deux mots utiles)
// une fois les petits mots retirés des deux côtés : « badge qui ne marche pas » = « badge ne marche pas ».
function contientExpression(q, qUtile, expression, motsVides) {
  if (contient(q, expression)) return true;
  const utile = sansMotsVides(expression, motsVides);
  return utile.split(' ').length >= 2 && contient(qUtile, utile);
}

function texteDepuisHtml(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, ' ');
}

// Construit l'index local à partir de la réponse de l'API.
// On ne garde du corps qu'un sac de racines avec leur fréquence : un index, pas une copie de l'article.
function construireIndex(articles, sections, motsVides) {
  const nomsSections = new Map((sections || []).map((s) => [s.id, s.name]));
  return articles
    .filter((a) => !a.draft)
    .map((a) => {
      const corps = {};
      for (const r of racines(texteDepuisHtml(a.body), motsVides)) corps[r] = (corps[r] || 0) + 1;
      const section = nomsSections.get(a.section_id) || '';
      return {
        id: a.id,
        titre: a.title,
        url: a.html_url,
        maj: a.updated_at,
        section,
        r_titre: [...new Set(racines(a.title, motsVides))],
        r_section: [...new Set(racines(section, motsVides))],
        r_etiquettes: [...new Set((a.label_names || []).flatMap((l) => racines(l, motsVides)))],
        r_corps: corps,
      };
    });
}

// Racines de la requête, avec leur poids. Les synonymes reconnus ajoutent le vocabulaire officiel.
function analyserRequete(question, regles, motsVides) {
  const q = normaliser(question);
  const poids = new Map();
  const ajouter = (r, p) => poids.set(r, Math.max(poids.get(r) || 0, p));
  const propres = [...new Set(racines(q, motsVides))];
  for (const r of propres) ajouter(r, 1);
  const qUtile = sansMotsVides(q, motsVides);
  const synonymesUtilises = [];
  for (const regle of regles) {
    if (regle.expressions.some((e) => contientExpression(q, qUtile, e, motsVides))) {
      synonymesUtilises.push(regle.officiel);
      for (const r of racines(regle.officiel, motsVides)) ajouter(r, 1.5);
    }
  }
  return { poids, propres, synonymesUtilises };
}

function rechercher(question, index, regles, motsVides, options = {}) {
  const max = options.max || 3;
  const minimum = options.scoreMinimum != null ? options.scoreMinimum : 5;
  const couvertureMin = options.couvertureMinimum != null ? options.couvertureMinimum : 0.5;
  const { poids, propres, synonymesUtilises } = analyserRequete(question, regles, motsVides);
  if (poids.size === 0 || !index || index.length === 0) return { resultats: [], synonymesUtilises };

  const n = index.length;
  const idf = new Map();
  for (const r of poids.keys()) {
    const df = index.filter((a) => a.r_titre.includes(r) || a.r_corps[r]).length;
    idf.set(r, Math.log((n + 1) / (df + 1)) + 1);
  }

  const notes = index.map((a) => {
    let score = 0;
    let dansTitre = 0;
    const trouvees = new Set();
    for (const [r, p] of poids) {
      let s = 0;
      if (a.r_titre.includes(r)) { s += 3; dansTitre++; }
      if (a.r_etiquettes.includes(r)) s += 1.5;
      if (a.r_section.includes(r)) s += 0.75;
      if (a.r_corps[r]) s += Math.min(1.2, 0.4 * Math.log(1 + a.r_corps[r]));
      if (s > 0) trouvees.add(r);
      score += s * p * idf.get(r);
    }
    // Sans synonyme reconnu, un seul mot courant ne suffit pas : il faut qu'au moins la moitié
    // des mots utiles de la question se retrouvent dans l'article.
    if (synonymesUtilises.length === 0 && propres.length > 1) {
      const couverture = propres.filter((r) => trouvees.has(r)).length / propres.length;
      if (couverture < couvertureMin) score = 0;
    }
    // Petit bonus quand tout le vocabulaire utile de la question est dans le titre.
    if (dansTitre > 0 && dansTitre === poids.size) score *= 1.25;
    return { article: a, score };
  });

  const resultats = notes
    .filter((x) => x.score >= minimum)
    .sort((x, y) => y.score - x.score)
    .slice(0, max)
    .map(({ article, score }) => ({
      id: article.id,
      titre: article.titre,
      url: article.url,
      maj: article.maj,
      section: article.section,
      score: Math.round(score * 100) / 100,
    }));
  return { resultats, synonymesUtilises };
}

module.exports = {
  normaliser,
  racine,
  racines,
  preparerMotsVides,
  preparerSynonymes,
  construireIndex,
  analyserRequete,
  rechercher,
};
