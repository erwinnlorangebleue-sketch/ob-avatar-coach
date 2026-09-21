'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { expurger } = require('../src/main/journal');
const { creerContenu } = require('../src/main/contenu');

const CONTENU = path.join(__dirname, '..', 'contenu');

test('tous les fichiers JSON de contenu/ sont valides', () => {
  for (const f of fs.readdirSync(CONTENU).filter((n) => n.endsWith('.json'))) {
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(CONTENU, f), 'utf8')), f);
  }
});

test('les textes utilisés par la page existent dans interface.json', () => {
  const textes = require('../contenu/interface.json');
  const sources = ['index.html', 'renderer.js'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', f), 'utf8')).join('\n');
  const cles = new Set([
    ...[...sources.matchAll(/data-(?:texte|placeholder|titre)="([a-z_]+)"/g)].map((m) => m[1]),
    ...[...sources.matchAll(/\bt\('([a-z_]+)'\)/g)].map((m) => m[1]),
  ]);
  assert.ok(cles.size > 5);
  for (const c of cles) assert.ok(typeof textes[c] === 'string' && textes[c], `texte manquant : ${c}`);
});

test('expurgation : ni téléphone, ni e-mail, ni numéro de membre, ni IBAN', () => {
  const q = expurger('adhérent 0612345678 jean.dupont@mail.fr membre 48213 FR76 3000 6000 0112 3456 7890 189 veut arrêter');
  assert.ok(!/\d{3}/.test(q), q);
  assert.ok(!q.includes('@'), q);
  assert.match(q, /veut arrêter/);
});

test('un fichier distant invalide ne remplace jamais le cache', async () => {
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'ob-cache-'));
  const journal = { info() {}, erreur() {}, majEtat() {} };
  const telecharger = async (url) => (url.endsWith('index.json') ? '{ cassé' : fs.readFileSync(path.join(CONTENU, decodeURIComponent(url.split('/').pop())), 'utf8'));
  const c = creerContenu({ dossierLivre: CONTENU, dossierCache: cache, journal, telecharger });
  const { erreurs } = await c.synchroniser();
  assert.strictEqual(erreurs, 1);
  assert.ok(!fs.existsSync(path.join(cache, 'index.json')));
  assert.ok(c.charger().index.length > 0, 'repli sur la copie livrée');
});
