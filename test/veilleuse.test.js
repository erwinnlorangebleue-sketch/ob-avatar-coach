'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { calculerFin, estActive } = require('../src/main/veilleuse');

const config = { veilleuse_duree_min: 60, veilleuse_reprise_heure: 6 };

test('veilleuse courte : durée de la config', () => {
  const maintenant = new Date(2026, 8, 22, 14, 20);
  assert.strictEqual(calculerFin('courte', maintenant, config).getTime(), new Date(2026, 8, 22, 15, 20).getTime());
});

test('veilleuse jusqu\'à demain : reprise le lendemain à l\'heure prévue, y compris en fin de mois', () => {
  assert.strictEqual(calculerFin('demain', new Date(2026, 8, 22, 21, 5), config).getTime(), new Date(2026, 8, 23, 6).getTime());
  assert.strictEqual(calculerFin('demain', new Date(2026, 8, 30, 10), config).getTime(), new Date(2026, 9, 1, 6).getTime());
});

test('mode inconnu : pas de veilleuse', () => {
  assert.strictEqual(calculerFin('toujours', new Date(), config), null);
});

test('active seulement avant l\'échéance, et jamais au-delà de 48 h', () => {
  const maintenant = new Date(2026, 8, 22, 14);
  assert.ok(estActive(new Date(2026, 8, 22, 15).toISOString(), maintenant));
  assert.ok(!estActive(new Date(2026, 8, 22, 13).toISOString(), maintenant));
  assert.ok(!estActive(new Date(2026, 8, 30).toISOString(), maintenant));
  assert.ok(!estActive(null, maintenant));
  assert.ok(!estActive('n\'importe quoi', maintenant));
});
