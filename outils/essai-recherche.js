'use strict';
// Essai de la recherche sur les vrais articles du centre d'aide (téléchargés à la volée, en mémoire).
// Usage : npm run essai-recherche                 -> jeu de questions de référence
//         npm run essai-recherche -- "ma question" -> une question libre
// Sert à vérifier l'effet d'un ajout dans contenu/synonymes.json avant de le pousser.

const path = require('path');
const R = require('../src/main/recherche');

const API = 'https://support.lorangebleue.fr/api/v2/help_center/';
const CONTENU = path.join(__dirname, '..', 'contenu');

// [question du coach, fragment attendu dans le titre du 1er résultat, ou null si « je ne sais pas » attendu]
const REFERENCE = [
  ['il veut arrêter', 'Résilier un membre'],
  ['comment résilier un adhérent', 'Résilier un membre'],
  ['il a perdu son badge', 'Carte de remplacement'],
  ['prélèvement rejeté', 'impayé'],
  ['rembourser un adhérent', 'remboursement'],
  ['fermer la caisse le soir', 'Clôture de la caisse'],
  ['créer un nouveau coach', 'Créer un employé'],
  ['séance découverte pour un prospect', "séance d'essai"],
  ['inscrire un mineur', 'représentant légal'],
  ['vendre une boisson', 'produit additionnel'],
  ['code promo', 'code promo'],
  ['badge qui ne marche pas', 'lecteur'],
  ['arrêter un cours', 'cours'],
  ['clôture de caisse', 'Clôture'],
  ['quel temps fait-il à Rennes', null],
  ['recette de la tarte aux pommes', null],
  ['comment gagner au loto', null],
  ['horaires de la piscine municipale', null],
  ['programme télé ce soir', null],
];

async function toutes(url, cle) {
  const out = [];
  for (let u = url, i = 0; u && i < 20; i++) {
    const p = await (await fetch(u)).json();
    out.push(...(p[cle] || []));
    u = p.next_page;
  }
  return out;
}

async function main() {
  const motsVides = R.preparerMotsVides(require(path.join(CONTENU, 'mots-vides.json')));
  const regles = R.preparerSynonymes(require(path.join(CONTENU, 'synonymes.json')));
  const config = require(path.join(CONTENU, 'config.json'));
  const articles = await toutes(API + 'fr/articles.json?per_page=100', 'articles');
  const sections = await toutes(API + 'fr/sections.json?per_page=100', 'sections');
  const index = R.construireIndex(articles, sections, motsVides);
  const opts = { max: config.resultats_max, scoreMinimum: config.score_minimum, couvertureMinimum: config.couverture_minimum };
  console.log(`${index.length} articles indexés, seuil ${opts.scoreMinimum}\n`);

  const libre = process.argv.slice(2).join(' ');
  const jeu = libre ? [[libre, undefined]] : REFERENCE;
  let ok = 0;
  for (const [q, attendu] of jeu) {
    const { resultats, synonymesUtilises } = R.rechercher(q, index, regles, motsVides, opts);
    const premier = resultats[0];
    let verdict = '';
    if (attendu !== undefined) {
      const bon = attendu === null
        ? resultats.length === 0
        : premier && R.normaliser(premier.titre).includes(R.normaliser(attendu));
      if (bon) ok++;
      verdict = bon ? 'OK  ' : 'RATÉ';
    }
    console.log(`${verdict} « ${q} »${synonymesUtilises.length ? '  [synonymes : ' + synonymesUtilises.join(', ') + ']' : ''}`);
    if (resultats.length === 0) console.log('       -> je ne sais pas');
    for (const r of resultats) console.log(`       ${String(r.score).padStart(6)}  ${r.titre}`);
  }
  if (!libre) {
    console.log(`\n${ok}/${jeu.length} conformes`);
    process.exitCode = ok === jeu.length ? 0 : 1;
  }
}

main().catch((e) => { console.error(e); process.exitCode = 2; });
