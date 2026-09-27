'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');
const E = require('../scripts/encoder-mascotte.js');
const reglages = require('../contenu/mascotte.json');

test('distance au sujet (échiquier)', () => {
  const a = new Uint8Array(25);
  a[12] = 200; // centre d'un carré 5 × 5
  assert.deepStrictEqual([...E.distanceAuSujet(a, 5)], [
    2, 2, 2, 2, 2,
    2, 1, 1, 1, 2,
    2, 1, 0, 1, 2,
    2, 1, 1, 1, 2,
    2, 2, 2, 2, 2,
  ]);
});

test('résidu alpha : le fond reste nul, à quelques pixels ≤ 3 près', () => {
  const cote = 20;
  const source = new Uint8Array(cote * cote);
  source[0] = 255; // sujet dans un coin ; tout ce qui est à 8 px ou plus est du fond
  const propre = E.residuAlpha(source, source, cote);
  assert.strictEqual(propre.nonNuls, 0);
  assert.ok(propre.propre);
  assert.strictEqual(E.residuAlpha(source, new Uint8Array(cote * cote).fill(1), cote).propre, false, 'voile : refusé');
  const tache = new Uint8Array(source);
  tache[cote * cote - 1] = 40;
  assert.strictEqual(E.residuAlpha(source, tache, cote).propre, false, 'pixel du fond au-dessus du seuil : refusé');
});

test('teinte et luminosité HSL', () => {
  const e = E.hsl(0x0c, 0x2f, 0xda);
  assert.strictEqual(Math.round(e.h * 10) / 10, 229.8);
  assert.strictEqual(Math.round(e.l * 10) / 10, 45.1);
});

// Couleurs réelles des clips livrés : seulement si ffmpeg est installé sur le poste de développement.
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const avecFfmpeg = spawnSync(FFMPEG, ['-version']).status === 0;
test('couleurs de l\'image 0 d\'idle dans la cible, pour chaque variante livrée', { skip: !avecFfmpeg && 'ffmpeg absent' }, () => {
  for (const cote of reglages.variantes) {
    const fichier = path.join(__dirname, '..', 'assets', 'mascotte', reglages.dossier, String(cote), reglages.etats.attente.clip + '.webm');
    const r = spawnSync(FFMPEG, ['-v', 'error', '-c:v', 'libvpx-vp9', '-i', fichier,
      '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { maxBuffer: 1 << 26 });
    const m = E.mesurerCouleurs(r.stdout, cote, cote);
    assert.deepStrictEqual(E.horsCible(m), [], `${cote} : ${JSON.stringify(m)}`);
  }
});
