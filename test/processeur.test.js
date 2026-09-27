'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { creerReleveProcesseur } = require('../src/main/processeur');

// Faux poste : des processus dont on règle le temps processeur cumulé, horloge manuelle.
function banc() {
  const b = { t: 0, cpu: { 1: 0, 2: 0 }, moyennes: [] };
  b.releve = creerReleveProcesseur({
    lireMetriques: () => Object.entries(b.cpu).map(([pid, s]) => ({ pid: Number(pid), cpu: { cumulativeCPUUsage: s } })),
    maintenant: () => b.t,
    dureeS: 300,
    surMoyenne: (phase, m) => b.moyennes.push({ phase, ...m }),
  });
  b.avancer = (s, cpu1, cpu2 = 0) => { b.t += s * 1000; b.cpu[1] += cpu1; b.cpu[2] += cpu2; };
  return b;
}

test('moyenne sur 5 min, somme des processus, en % d\'un cœur', () => {
  const b = banc();
  b.releve.changer({ phase: 'attente', mode: 'video', variante: 160 });
  for (let i = 0; i < 10; i++) { b.avancer(30, 0.6, 0.3); b.releve.echantillon(); }
  assert.deepStrictEqual(b.moyennes, [{ phase: 'attente', pourcent_coeur: 3, duree_s: 300, mode: 'video', variante: 160 }]);
});

test('attente et lecture séparées ; autre et pause non comptées', () => {
  const b = banc();
  const video = { mode: 'video', variante: 160 };
  for (let i = 0; i < 30; i++) {
    b.releve.changer({ phase: 'attente', ...video });
    b.avancer(20, 0.4); // 2 %
    b.releve.changer({ phase: 'lecture', ...video });
    b.avancer(10, 1.2); // 12 %
    b.releve.changer({ phase: 'autre', ...video });
    b.avancer(5, 5);
    b.releve.changer({ phase: 'pause', ...video });
    b.avancer(5, 5);
  }
  b.releve.changer({ phase: 'autre', ...video });
  assert.deepStrictEqual(b.moyennes.map((m) => [m.phase, m.pourcent_coeur, m.duree_s]), [
    ['attente', 2, 300], // 15 cycles de 20 s
    ['attente', 2, 300], // 30 cycles
    ['lecture', 12, 300], // 30 cycles de 10 s
  ]);
});

test('autre mode ou autre variante : on repart de zéro ; processus nouveau compté à la tranche suivante', () => {
  const b = banc();
  b.releve.changer({ phase: 'attente', mode: 'video', variante: 320 });
  b.avancer(200, 10);
  b.releve.changer({ phase: 'attente', mode: 'video', variante: 160 });
  b.avancer(200, 2);
  b.releve.echantillon();
  assert.strictEqual(b.moyennes.length, 0, '200 s en 320 ne complètent pas la moyenne en 160');
  b.cpu[3] = 50; // un utilitaire démarre avec 50 s déjà cumulées
  b.avancer(100, 1);
  b.releve.echantillon();
  assert.deepStrictEqual(b.moyennes, [{ phase: 'attente', pourcent_coeur: 1, duree_s: 300, mode: 'video', variante: 160 }]);
});
