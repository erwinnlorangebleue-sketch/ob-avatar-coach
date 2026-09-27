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
    surMoyenne: (phase, m) => b.moyennes.push({ phase, ...m }),
  });
  b.avancer = (s, cpu1, cpu2 = 0) => { b.t += s * 1000; b.cpu[1] += cpu1; b.cpu[2] += cpu2; };
  return b;
}

test('attente : moyenne sur 5 min, somme des processus, en % d\'un cœur', () => {
  const b = banc();
  b.releve.changer({ phase: 'attente', mode: 'video', variante: 320 });
  for (let i = 0; i < 10; i++) { b.avancer(30, 0.6, 0.3); b.releve.echantillon(); }
  assert.deepStrictEqual(b.moyennes, [
    { phase: 'attente', pourcent_coeur: 3, duree_s: 300, max_par_clip: {}, mode: 'video', variante: 320 },
  ]);
});

test('lecture : moyenne publiée dès 60 s de lecture cumulée', () => {
  const b = banc();
  const video = { mode: 'video', variante: 320 };
  for (let i = 0; i < 5; i++) {
    b.releve.changer({ phase: 'lecture', ...video, clip: 'wave' });
    b.avancer(10, 1.2); // 12 %
    b.releve.changer({ phase: 'autre', ...video });
    b.avancer(50, 5);
  }
  assert.strictEqual(b.moyennes.length, 0, '50 s de lecture ne suffisent pas');
  b.releve.changer({ phase: 'lecture', ...video, clip: 'wave' });
  b.avancer(10, 1.2);
  b.releve.echantillon();
  assert.deepStrictEqual(b.moyennes.map((m) => [m.phase, m.pourcent_coeur, m.duree_s]), [['lecture', 12, 60]]);
});

test('attente et lecture séparées ; autre et pause non comptées', () => {
  const b = banc();
  const video = { mode: 'video', variante: 320 };
  for (let i = 0; i < 15; i++) {
    b.releve.changer({ phase: 'attente', ...video });
    b.avancer(20, 0.4); // 2 %
    b.releve.changer({ phase: 'lecture', ...video, clip: 'think' });
    b.avancer(10, 1.2); // 12 %
    b.releve.changer({ phase: 'autre', ...video });
    b.avancer(5, 5);
    b.releve.changer({ phase: 'pause', ...video });
    b.avancer(5, 5);
  }
  b.releve.changer({ phase: 'autre', ...video });
  assert.deepStrictEqual(b.moyennes.map((m) => [m.phase, m.pourcent_coeur, m.duree_s]), [
    ['lecture', 12, 60], // 6 cycles de 10 s
    ['lecture', 12, 60], // 12 cycles
    ['attente', 2, 300], // 15 cycles de 20 s
  ]);
});

test('maximum par clip : un passage = un clip sans interruption, au moins 1 s', () => {
  const b = banc();
  const video = { mode: 'video', variante: 320 };
  const passage = (phase, clip, s, cpu) => { b.releve.changer({ phase, ...video, clip }); b.avancer(s, cpu); };
  passage('attente', 'idle', 3, 0.3); // 10 %
  passage('attente', null, 30, 0.3); // figé, pas un passage
  passage('lecture', 'wave', 3, 0.45); // 15 %
  passage('lecture', 'think', 3, 0.36); // 12 %
  passage('lecture', 'wave', 3, 0.54); // 18 % : nouveau maximum de wave
  passage('lecture', 'wave2', 0.5, 0.5); // 100 % sur 0,5 s : trop court, ignoré
  passage('lecture', 'wave', 3, 0.3); // 10 % : ne baisse pas le maximum
  // Un passage relevé en plusieurs tranches (minuterie de 30 s) reste un seul passage.
  b.releve.changer({ phase: 'lecture', ...video, clip: 'talk' });
  b.avancer(20, 2); b.releve.echantillon(); // 10 %
  b.avancer(20, 6); // 30 % sur cette tranche, 20 % sur le passage
  b.releve.changer({ phase: 'autre', ...video }); // 52,5 s de lecture : pas encore de moyenne
  assert.strictEqual(b.moyennes.length, 0);
  passage('lecture', 'idle', 8, 0.4); // 5 %, en lecture cette fois
  b.releve.changer({ phase: 'autre', ...video });
  assert.deepStrictEqual(b.moyennes.map((m) => [m.phase, m.duree_s]), [['lecture', 61]]);
  assert.deepStrictEqual(b.moyennes[0].max_par_clip, { wave: 18, think: 12, talk: 20, idle: 5 });
});

test('maximum par clip : remis à zéro après chaque moyenne', () => {
  const b = banc();
  const video = { mode: 'video', variante: 320 };
  b.releve.changer({ phase: 'lecture', ...video, clip: 'found' });
  b.avancer(5, 1); // 20 %
  b.releve.changer({ phase: 'lecture', ...video, clip: 'wave' });
  b.avancer(55, 5.5); b.releve.echantillon(); // moyenne publiée, passage wave à cheval
  b.avancer(5, 0.5);
  b.releve.changer({ phase: 'lecture', ...video, clip: 'think' });
  b.avancer(55, 5.5); b.releve.echantillon();
  // wave à cheval : 55 s dans la première moyenne, 5 s dans la seconde.
  assert.deepStrictEqual(b.moyennes.map((m) => m.max_par_clip), [{ found: 20, wave: 10 }, { wave: 10, think: 10 }]);
});

test('autre mode ou autre variante : on repart de zéro ; processus nouveau compté à la tranche suivante', () => {
  const b = banc();
  b.releve.changer({ phase: 'attente', mode: 'video', variante: 640 });
  b.avancer(200, 10);
  b.releve.changer({ phase: 'attente', mode: 'video', variante: 320 });
  b.avancer(200, 2);
  b.releve.echantillon();
  assert.strictEqual(b.moyennes.length, 0, '200 s en 640 ne complètent pas la moyenne en 320');
  b.cpu[3] = 50; // un utilitaire démarre avec 50 s déjà cumulées
  b.avancer(100, 1);
  b.releve.echantillon();
  assert.deepStrictEqual(b.moyennes, [
    { phase: 'attente', pourcent_coeur: 1, duree_s: 300, max_par_clip: {}, mode: 'video', variante: 320 },
  ]);
});
