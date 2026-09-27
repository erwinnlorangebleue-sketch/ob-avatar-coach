'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const reglages = require('../contenu/mascotte.json');
const R = require('../src/renderer/avatar/regles.js');
const ETATS = ['accueil', 'attente', 'recherche', 'article_trouve', 'carte', 'designer', 'rien_trouve', 'au_revoir'];
const RENDERER = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'renderer.js'), 'utf8');

test('mascotte.json : mode connu, tous les états ont un clip, réglages présents', () => {
  assert.ok(['video', 'silhouette'].includes(reglages.mascotte), reglages.mascotte);
  for (const e of ETATS) assert.ok(reglages.etats[e] && reglages.etats[e].clip, `état sans clip : ${e}`);
  assert.strictEqual(reglages.etats.attente.boucle, true, 'attente doit boucler');
  assert.strictEqual(reglages.etats.carte.boucle, true, 'carte doit boucler');
  assert.strictEqual(reglages.etats.accueil.clip, 'greet');
  assert.strictEqual(reglages.etats.au_revoir.clip, 'wave');
  assert.strictEqual(reglages.taille_px, 160);
  assert.deepStrictEqual(reglages.attente_repos_s, { min_s: 8, max_s: 20 });
  assert.strictEqual(reglages.au_revoir_intervalle_min, 10);
  assert.strictEqual(reglages.recherche_seuil_ms, 300);
});

test('chaque clip existe dans chaque variante, avec repos.png, et assets/ est livré', () => {
  const dossier = path.join(__dirname, '..', 'assets', 'mascotte', reglages.dossier);
  assert.ok(fs.existsSync(path.join(dossier, 'repos.png')), 'repos.png');
  for (const cote of reglages.variantes.map(String)) {
    for (const { clip } of Object.values(reglages.etats)) {
      assert.ok(fs.existsSync(path.join(dossier, cote, clip + '.webm')), `${cote}/${clip}.webm`);
    }
  }
  const pkg = require('../package.json');
  assert.ok(pkg.build.files.some((f) => f.startsWith('assets/')), 'assets/ absent du binaire');
});

test('la page n\'émet que des états définis, et plus ouverture ni salut', () => {
  const appels = [...RENDERER.matchAll(/avatar\.evenement\(([^)]*)\)/g)].map((m) => m[1]);
  const emis = new Set(appels.flatMap((a) => [...a.matchAll(/(?<!=== )'([a-z_]+)'/g)].map((m) => m[1])));
  for (const e of emis) assert.ok(reglages.etats[e], `état émis mais absent du JSON : ${e}`);
  for (const e of ['accueil', 'attente', 'carte', 'designer', 'article_trouve', 'rien_trouve', 'au_revoir', 'recherche']) {
    assert.ok(emis.has(e), `état jamais émis : ${e}`);
  }
  assert.ok(!emis.has('ouverture') && !emis.has('salut'));
});

test('variante : 320 tant que taille × ratio de pixels ≤ 320, sinon 640', () => {
  assert.strictEqual(R.variante(160, 1), 320);
  assert.strictEqual(R.variante(160, 2), 320);
  assert.strictEqual(R.variante(160, 2.5), 640);
  assert.strictEqual(R.variante(320, 1), 320);
  assert.strictEqual(R.variante(321, 1), 640);
  assert.strictEqual(R.variante(160, undefined), 320);
});

test('taille : 160 par défaut, bornée entre 80 et 640', () => {
  assert.strictEqual(R.taille({}), 160);
  assert.strictEqual(R.taille({ taille_px: 'x' }), 160);
  assert.strictEqual(R.taille({ taille_px: 10 }), 80);
  assert.strictEqual(R.taille({ taille_px: 5000 }), 640);
  assert.strictEqual(R.taille(reglages), 160);
});

test('repos d\'idle tiré entre 8 et 20 s', () => {
  assert.strictEqual(R.dureeRepos(reglages, () => 0), 8000);
  assert.strictEqual(R.dureeRepos(reglages, () => 0.999999), 20000);
  for (let i = 0; i < 200; i++) {
    const ms = R.dureeRepos(reglages);
    assert.ok(ms >= 8000 && ms <= 20000, String(ms));
  }
  assert.strictEqual(R.dureeRepos({}, () => 0.5), 0, 'sans réglage : pas de repos');
});

test('think seulement après le seuil de 300 ms', () => {
  assert.strictEqual(R.seuilRecherche(reglages), 300);
  assert.strictEqual(R.seuilRecherche({}), 0);
});

test('wave au plus une fois toutes les 10 minutes', () => {
  let t = 0;
  const permis = R.limiteurAuRevoir(() => t);
  assert.strictEqual(permis(reglages), true);
  t = 9 * 60000;
  assert.strictEqual(permis(reglages), false);
  t = 10 * 60000;
  assert.strictEqual(permis(reglages), true);
  t += 1000;
  assert.strictEqual(permis(reglages), false);
});
