'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { dossiersEmbarques, resoudreDossier } = require('../src/main/mascotte-dossier');

const REGLAGES = { mascotte: 'video', dossier: 'v89', variantes: [320, 640], etats: { attente: { clip: 'idle' }, carte: { clip: 'talk' } } };

// Faux assets/mascotte : dossiers complets ou non, selon la liste de fichiers donnée.
function racineAvec(dossiers) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'mascotte-'));
  for (const [nom, fichiers] of Object.entries(dossiers)) {
    for (const f of fichiers) {
      fs.mkdirSync(path.dirname(path.join(racine, nom, f)), { recursive: true });
      fs.writeFileSync(path.join(racine, nom, f), '');
    }
  }
  return racine;
}
const COMPLET = ['repos.png', '320/idle.webm', '320/talk.webm', '640/idle.webm', '640/talk.webm'];

test('dossier publié avant le binaire qui le contient : repli sur le dernier dossier vidéo embarqué', () => {
  const racine = racineAvec({ v87: COMPLET, v88: COMPLET, v90: ['repos.png', '320/idle.webm'] });
  const embarques = dossiersEmbarques(racine, REGLAGES);
  assert.deepStrictEqual(embarques, ['v88', 'v87'], 'v90 incomplet écarté, plus récent d\'abord');
  const r = resoudreDossier(REGLAGES, embarques);
  assert.strictEqual(r.reglages.mascotte, 'video', 'pas de silhouette');
  assert.strictEqual(r.reglages.dossier, 'v88');
  assert.deepStrictEqual(r.repli, { demande: 'v89', retenu: 'v88' });
  assert.strictEqual(REGLAGES.dossier, 'v89', 'réglages lus non modifiés');
});

test('dossier embarqué, silhouette choisie ou aucun dossier : pas de repli', () => {
  assert.deepStrictEqual(resoudreDossier(REGLAGES, ['v89', 'v88']), { reglages: REGLAGES, repli: null });
  const silhouette = { ...REGLAGES, mascotte: 'silhouette', dossier: 'v99' };
  assert.deepStrictEqual(resoudreDossier(silhouette, ['v88']), { reglages: silhouette, repli: null });
  assert.deepStrictEqual(resoudreDossier(REGLAGES, []), { reglages: REGLAGES, repli: null }, 'la page constatera la panne');
});

test('le binaire embarque le dossier actif de mascotte.json', () => {
  const reglages = require('../contenu/mascotte.json');
  const embarques = dossiersEmbarques(path.join(__dirname, '..', 'assets', 'mascotte'), reglages);
  assert.ok(embarques.includes(reglages.dossier), `${reglages.dossier} absent de ${embarques}`);
});
