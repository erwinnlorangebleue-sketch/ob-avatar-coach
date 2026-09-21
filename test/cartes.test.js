'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { construireCartes, creerPioche } = require('../src/main/cartes');
const { FAMILLES } = require('../src/main/contenu');

const CONTENU = path.join(__dirname, '..', 'contenu');
const index = require('../contenu/index.json');
const config = require('../contenu/config.json');
const md = Object.fromEntries(FAMILLES.map((f) => [f, fs.readFileSync(path.join(CONTENU, f + '.md'), 'utf8')]));

test('aucune carte À VÉRIFIER ne devient affichable (vrai contenu)', () => {
  const { cartes } = construireCartes(index, md, config.categories_affichables);
  assert.ok(cartes.length > 0);
  assert.ok(!cartes.some((c) => c.categorie === 'À VÉRIFIER'));
  const aVerifier = index.filter((e) => e.categorie === 'À VÉRIFIER').map((e) => e.id);
  assert.ok(aVerifier.length > 0, 'le test doit porter sur de vraies cartes À VÉRIFIER');
  for (const id of aVerifier) assert.ok(!cartes.some((c) => c.id === id), id);
});

test('config : À VÉRIFIER ne figure jamais dans les catégories affichables', () => {
  assert.ok(!config.categories_affichables.includes('À VÉRIFIER'));
});

test('chaque carte autorisée de l\'index retrouve son texte', () => {
  const { ecartees } = construireCartes(index, md, config.categories_affichables);
  const inattendues = ecartees.filter((e) => !e.motif.startsWith('catégorie'));
  assert.deepStrictEqual(inattendues, []);
});

test('fermé par défaut : catégorie inconnue, texte absent, désaccord Markdown', () => {
  const faux = {
    theorie: '## A\n\n### X01 — Titre [DÉBATTU]\n\nTexte.\n\n### Y\n\nAutre.',
  };
  const idx = [
    { id: 'a', famille: 'theorie', titre: 'Titre', categorie: 'ÉTABLI' }, // désaccord
    { id: 'b', famille: 'theorie', titre: 'Inexistant', categorie: 'ÉTABLI' }, // texte absent
    { id: 'c', famille: 'theorie', titre: 'Y', categorie: 'NOUVELLE' }, // catégorie inconnue
    { id: 'd', famille: 'theorie', titre: 'Y', categorie: 'CONSENSUS' }, // valide
  ];
  const { cartes } = construireCartes(idx, faux, config.categories_affichables);
  assert.deepStrictEqual(cartes.map((c) => c.id), ['d']);
});

test('la pioche épuise le paquet avant de répéter', () => {
  const piocher = creerPioche([{ id: 1 }, { id: 2 }, { id: 3 }]);
  const tirage = new Set([piocher().id, piocher().id, piocher().id]);
  assert.strictEqual(tirage.size, 3);
});
