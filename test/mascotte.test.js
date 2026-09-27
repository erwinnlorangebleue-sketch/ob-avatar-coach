'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const reglages = require('../contenu/mascotte.json');
const ETATS = ['ouverture', 'attente', 'recherche', 'article_trouve', 'carte', 'designer', 'rien_trouve', 'salut'];

test('mascotte.json : mode connu et tous les états de l\'appli ont un clip', () => {
  assert.ok(['video', 'silhouette'].includes(reglages.mascotte), reglages.mascotte);
  for (const e of ETATS) assert.ok(reglages.etats[e] && reglages.etats[e].clip, `état sans clip : ${e}`);
  assert.strictEqual(reglages.etats.attente.boucle, true, 'attente doit boucler');
});

test('chaque clip de mascotte.json est livré dans le binaire, avec repos.png', () => {
  const dossier = path.join(__dirname, '..', 'assets', 'mascotte', reglages.dossier);
  assert.ok(fs.existsSync(path.join(dossier, 'repos.png')), 'repos.png');
  for (const { clip } of Object.values(reglages.etats)) {
    assert.ok(fs.existsSync(path.join(dossier, clip + '.webm')), clip + '.webm');
  }
  const pkg = require('../package.json');
  assert.ok(pkg.build.files.some((f) => f.startsWith('assets/')), 'assets/ absent du binaire');
});
