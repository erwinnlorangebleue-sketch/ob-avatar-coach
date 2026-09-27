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
  assert.deepStrictEqual(reglages.variantes, [160, 320, 640]);
  assert.strictEqual(reglages.etats.attente.passages, 1);
  assert.deepStrictEqual(reglages.etats.attente.repos_s, { min_s: 20, max_s: 40 });
  assert.strictEqual(reglages.etats.carte.passages, 2);
  assert.strictEqual(reglages.etats.carte.repos_s, undefined, 'talk ne repart pas tant que la carte est ouverte');
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

test('variante : la plus petite qui couvre taille × ratio de pixels, sinon la plus grande', () => {
  const v = reglages.variantes;
  assert.strictEqual(R.variante(160, 1, v), 160);
  assert.strictEqual(R.variante(160, 1.25, v), 320);
  assert.strictEqual(R.variante(160, 2, v), 320);
  assert.strictEqual(R.variante(160, 2.5, v), 640);
  assert.strictEqual(R.variante(320, 1, v), 320);
  assert.strictEqual(R.variante(321, 1, v), 640);
  assert.strictEqual(R.variante(640, 2, v), 640);
  assert.strictEqual(R.variante(160, undefined, v), 160);
  assert.strictEqual(R.variante(160, 1, [640, '320']), 320, 'ordre et type indifférents');
  assert.strictEqual(R.variante(160, 1, undefined), 320, 'sans liste : 320 et 640');
});

test('taille : 160 par défaut, bornée entre 80 et 640', () => {
  assert.strictEqual(R.taille({}), 160);
  assert.strictEqual(R.taille({ taille_px: 'x' }), 160);
  assert.strictEqual(R.taille({ taille_px: 10 }), 80);
  assert.strictEqual(R.taille({ taille_px: 5000 }), 640);
  assert.strictEqual(R.taille(reglages), 160);
});

test('idle : un passage puis immobile 20 à 40 s, puis il repart', () => {
  const idle = reglages.etats.attente;
  assert.deepStrictEqual(R.apresPassage(idle, 1, () => 0), { rejouer: false, reposMs: 20000 });
  assert.deepStrictEqual(R.apresPassage(idle, 1, () => 0.999999), { rejouer: false, reposMs: 40000 });
  for (let i = 0; i < 200; i++) {
    const { reposMs } = R.apresPassage(idle, 1);
    assert.ok(reposMs >= 20000 && reposMs <= 40000, String(reposMs));
  }
});

test('talk : deux passages puis immobile jusqu\'à la fermeture de la carte', () => {
  const talk = reglages.etats.carte;
  assert.deepStrictEqual(R.apresPassage(talk, 1), { rejouer: true });
  assert.deepStrictEqual(R.apresPassage(talk, 2), { rejouer: false, reposMs: null });
  assert.deepStrictEqual(R.apresPassage(talk, 3), { rejouer: false, reposMs: null });
});

test('fond sans passages : il tourne tant que l\'état dure ; réglages erronés bornés', () => {
  assert.strictEqual(R.passages({ clip: 'x', boucle: true }), Infinity);
  assert.deepStrictEqual(R.apresPassage({ clip: 'x', boucle: true }, 1000), { rejouer: true });
  assert.strictEqual(R.passages({ passages: 0 }), Infinity);
  assert.strictEqual(R.passages({ passages: '2' }), 2);
  assert.strictEqual(R.dureeRepos({ repos_s: { min_s: 30, max_s: 10 } }, () => 0.5), 30000, 'max < min');
  assert.strictEqual(R.dureeRepos({ repos_s: {} }, () => 0.5), 0);
  assert.strictEqual(R.dureeRepos({}), null);
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
