'use strict';
// Vérifications périodiques, bulle oubliée, télémétrie à la mise à jour, appli de dev isolée.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { creerVerification } = require('../src/main/verification');
const { bulleExpiree, installationPermise } = require('../src/main/bulle');
const { creerJournal } = require('../src/main/journal');
const { identiteDev } = require('../src/main/identite');

const MAIN = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'main.js'), 'utf8');

// Horloge et minuteries manuelles : programmer() note la minuterie, avancer() la déclenche.
function banc({ intervalleMin = 60, action = async () => 'aucun changement' } = {}) {
  const b = { t: 0, lignes: [], minuterie: null, intervalleMin };
  b.journal = { info: (m) => b.lignes.push(m), erreur: (m) => b.lignes.push('ERREUR ' + m) };
  b.v = creerVerification({
    cible: 'contenu',
    action,
    intervalleMs: () => b.intervalleMin * 60000,
    journal: b.journal,
    maintenant: () => b.t,
    programmer: (f, ms) => (b.minuterie = { f, echeance: b.t + ms }),
    annuler: (m) => { if (m && b.minuterie === m) b.minuterie = null; },
  });
  b.avancer = async (min) => {
    b.t += min * 60000;
    if (b.minuterie && b.minuterie.echeance <= b.t) { const { f } = b.minuterie; b.minuterie = null; await f(); }
  };
  return b;
}

test('a/b : vérification au démarrage puis toutes les heures, une ligne à chaque fois', async () => {
  const b = banc();
  await b.v.lancer('démarrage');
  await b.avancer(60);
  await b.avancer(60);
  assert.deepStrictEqual(b.lignes, [
    'vérification contenu (démarrage) : aucun changement',
    'vérification contenu (horaire) : aucun changement',
    'vérification contenu (horaire) : aucun changement',
  ]);
});

test('a : intervalle relu à chaud à chaque cycle', async () => {
  const b = banc();
  await b.v.lancer('démarrage');
  b.intervalleMin = 15; // réglage distant changé : pris au cycle suivant
  await b.avancer(60);
  assert.strictEqual(b.minuterie.echeance, b.t + 15 * 60000);
  await b.avancer(15);
  assert.strictEqual(b.lignes.length, 3);
});

test('a : sortie de veille et minuterie en retard déclenchent une vérification', async () => {
  const b = banc();
  await b.v.lancer('démarrage');
  await b.v.lancer('sortie de veille');
  assert.strictEqual(b.minuterie.echeance, b.t + 60 * 60000, 'replanifiée après la vérification');
  b.t += 90 * 60000; // la minuterie n'a pas été déclenchée à l'heure
  b.v.rattraper();
  await new Promise((r) => setImmediate(r));
  assert.deepStrictEqual(b.lignes.slice(1).map((l) => l.split(' : ')[0]), [
    'vérification contenu (sortie de veille)',
    'vérification contenu (rattrapage)',
  ]);
});

test('b : un échec est journalisé et la vérification suivante reste planifiée', async () => {
  const b = banc({ action: async () => { throw new Error('réseau coupé'); } });
  await b.v.lancer('démarrage');
  assert.deepStrictEqual(b.lignes, ['ERREUR vérification contenu (démarrage) : échec, réseau coupé']);
  assert.ok(b.minuterie, 'encore planifiée');
});

test('b : contenu et binaire ont chacun leur vérification, au démarrage et à la sortie de veille', () => {
  assert.match(MAIN, /cible: 'contenu'/);
  assert.match(MAIN, /cible: 'binaire'/);
  assert.match(MAIN, /lancer\('sortie de veille'\)/);
  assert.doesNotMatch(MAIN, /setInterval\(synchroniserContenu|verification_maj_h/, 'plus de minuterie figée au lancement');
});

test('c : bulle fermée après 10 min sans interaction, et ne bloque plus l\'installation', () => {
  const ouverte = { ouverte: true, derniereInteraction: 0, minutes: 10 };
  assert.strictEqual(bulleExpiree({ ...ouverte, maintenant: 9 * 60000 }), false);
  assert.strictEqual(bulleExpiree({ ...ouverte, maintenant: 10 * 60000 }), true);
  assert.strictEqual(bulleExpiree({ ...ouverte, minutes: undefined, maintenant: 10 * 60000 }), true, '10 min par défaut');
  assert.strictEqual(bulleExpiree({ ...ouverte, ouverte: false, maintenant: 60 * 60000 }), false);
  assert.strictEqual(installationPermise({ majPrete: true, questionOuverte: true, inactifS: 3600 }), false);
  assert.strictEqual(installationPermise({ majPrete: true, questionOuverte: false, inactifS: 3600 }), true);
  assert.match(MAIN, /fermerBulleOubliee\(\);/, 'vérifiée par la minuterie d\'activité');
});

test('d : moyennes processeur effacées au changement de version, gardées sinon', () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'etat-'));
  const etat = (v) => ({ version: v, processeur: { attente: { pourcent_coeur: 3 } }, mascotte: 'video' });
  fs.writeFileSync(path.join(dossier, 'etat.json'), JSON.stringify(etat('0.1.6')));
  const j = creerJournal(dossier, '0.1.7');
  assert.strictEqual(j.versionPrecedente, '0.1.6');
  assert.strictEqual(j.lireEtat().processeur, undefined);
  assert.strictEqual(j.lireEtat().mascotte, 'video', 'le reste est conservé');

  fs.writeFileSync(path.join(dossier, 'etat.json'), JSON.stringify(etat('0.1.7')));
  const j2 = creerJournal(dossier, '0.1.7');
  assert.strictEqual(j2.versionPrecedente, null);
  assert.ok(j2.lireEtat().processeur);
});

test('e : appli de dev isolée (nom, données, verrou) avant le verrou d\'instance unique', () => {
  const produit = require('../package.json').build.productName;
  const dev = identiteDev('C:\\AppData\\Roaming');
  assert.notStrictEqual(dev.nom, produit);
  assert.notStrictEqual(dev.userData, path.join('C:\\AppData\\Roaming', produit));
  const isolement = MAIN.indexOf("app.setPath('userData', dev.userData)");
  assert.ok(isolement > 0 && isolement < MAIN.indexOf('requestSingleInstanceLock'), 'dossier changé avant le verrou');
});
