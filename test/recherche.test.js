'use strict';
const test = require('node:test');
const assert = require('node:assert');
const R = require('../src/main/recherche');

// Articles fictifs (même forme que l'API) : les tests ne dépendent pas du réseau.
const ARTICLES = [
  { id: 1, title: 'Résilier un membre', html_url: 'https://support.lorangebleue.fr/hc/fr/articles/1', updated_at: '2026-02-03T10:00:00Z', section_id: 10, label_names: [], body: '<p>Pour résilier le contrat du membre, ouvrez son dossier.</p>' },
  { id: 2, title: 'Carte de remplacement', html_url: 'https://support.lorangebleue.fr/hc/fr/articles/2', updated_at: '2025-02-05T10:00:00Z', section_id: 10, label_names: [], body: '<p>Vendre une nouvelle carte au membre.</p>' },
  { id: 3, title: 'Clôture de la caisse', html_url: 'https://support.lorangebleue.fr/hc/fr/articles/3', updated_at: '2026-01-01T10:00:00Z', section_id: 20, label_names: [], body: '<p>En fin de journée, clôturer la caisse.</p>' },
  { id: 4, title: 'Brouillon', html_url: 'x', updated_at: '2026-01-01T10:00:00Z', section_id: 20, label_names: [], body: '', draft: true },
];
const SECTIONS = [{ id: 10, name: "Le coin de l'adhérent" }, { id: 20, name: 'Caisse' }];
const motsVides = R.preparerMotsVides({ mots: ['il', 'veut', 'son', 'la', 'le', 'de', 'un', 'a', 'comment', 'qui', 'ne', 'pas'] });
const regles = R.preparerSynonymes({
  _mode_d_emploi: 'ignoré',
  'résiliation': ['il veut arrêter'],
  'carte de remplacement': ['badge perdu', 'badge ne marche pas'],
});
const index = R.construireIndex(ARTICLES, SECTIONS, motsVides);
const chercher = (q) => R.rechercher(q, index, regles, motsVides, { max: 3, scoreMinimum: 5 }).resultats;

test('normalisation : accents, majuscules, apostrophes', () => {
  assert.strictEqual(R.normaliser("L'Adhérent RÉSILIÉ"), 'l adherent resilie');
});

test('racines : résilier et résiliation se rejoignent', () => {
  assert.strictEqual(R.racine('resilier'), R.racine('resiliation'));
});

test('les brouillons ne sont pas indexés', () => {
  assert.ok(!index.some((a) => a.id === 4));
});

test("l'index ne garde pas le texte des articles", () => {
  const brut = JSON.stringify(index);
  assert.ok(!brut.includes('ouvrez son dossier'));
});

test('« il veut arrêter » trouve « Résilier un membre » grâce aux synonymes', () => {
  const r = chercher('il veut arrêter');
  assert.strictEqual(r[0].titre, 'Résilier un membre');
});

test('sans le synonyme, « il veut arrêter » ne trouve rien', () => {
  const r = R.rechercher('il veut arrêter', index, [], motsVides, { scoreMinimum: 5 }).resultats;
  assert.strictEqual(r.length, 0);
});

test('les petits mots ne cassent pas une expression', () => {
  assert.strictEqual(chercher('le badge qui ne marche pas')[0].titre, 'Carte de remplacement');
});

test('une question hors sujet ne renvoie rien (jamais de réponse inventée)', () => {
  assert.deepStrictEqual(chercher('recette de la tarte aux pommes'), []);
  assert.deepStrictEqual(chercher(''), []);
});

test('un résultat porte titre, date de mise à jour et lien officiel', () => {
  const [r] = chercher('clôture caisse');
  assert.strictEqual(r.titre, 'Clôture de la caisse');
  assert.strictEqual(r.maj, '2026-01-01T10:00:00Z');
  assert.match(r.url, /^https:\/\/support\.lorangebleue\.fr\//);
});

test('le fichier contenu/synonymes.json est valide', () => {
  const fichier = require('../contenu/synonymes.json');
  for (const [cle, valeurs] of Object.entries(fichier)) {
    if (cle.startsWith('_')) continue;
    assert.ok(Array.isArray(valeurs) && valeurs.every((v) => typeof v === 'string' && v.trim()), `synonyme mal formé : ${cle}`);
  }
});
