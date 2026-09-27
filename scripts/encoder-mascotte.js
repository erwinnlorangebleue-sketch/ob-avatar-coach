'use strict';
// Encode une version de la mascotte depuis ses PNG masters, contrôle le résultat, puis le range
// dans assets/mascotte/<version>/<taille>/ (et repos.png). Outil de poste de développement :
// il n'est pas livré dans le binaire.
//
//   node scripts/encoder-mascotte.js "<dossier des PNG masters>" v89 [--sortie <dossier>]
//
// Le dossier des masters contient un sous-dossier par clip (idle, talk…), images 0000.png…
// Clips et tailles viennent de contenu/mascotte.json (etats, variantes). La version active reste
// choisie dans ce même fichier (dossier) : ce script ne le modifie pas.
// Rien n'est remplacé si un contrôle échoue. Sortie identique octet pour octet d'un passage à
// l'autre (-fflags +bitexact) : un rejeu se vérifie par comparaison de fichiers.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const IMAGES_PAR_S = 30;
const SEUIL_ALPHA = 3; // alpha < 3 ramené à 0 avant encodage : sans lui, tout le fond décodé vaut 1
// Fond = pixels à FOND_PX ou plus de la mascotte. La prédiction entre images du VP9 y laisse
// quelques pixels isolés à 1–3 là où un geste est passé (mesuré en v88 : ≤ 1 sur 50 000,
// options de l'encodeur sans effet). Toléré tant que c'est rare et sous le seuil de nettoyage.
const FOND_PX = 8;
const FOND_PART_MAX = 1e-4;
// Commande des clips livrés en v88 (chantier, 49_recette_c5.py), plus le nettoyage de l'alpha.
const VP9 = ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '30', '-row-mt', '1',
  '-colorspace', 'smpte170m', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-color_range', 'tv'];

// Cibles de couleur validées (porte 6 bis) : image 0 du clip d'attente, médianes RGB.
const CIBLES = {
  ecorce: { teinte: [226, 234] },
  pulpe: { teinte: [28, 36], luminosite: [86, 96] },
};

// ---------- Couleur ----------

function hsl(r, g, b) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (d) {
    if (max === R) h = 60 * (((G - B) / d) % 6);
    else if (max === G) h = 60 * ((B - R) / d + 2);
    else h = 60 * ((R - G) / d + 4);
  }
  if (h < 0) h += 360;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return { h, s, l: l * 100 };
}

function mediane(valeurs) {
  const v = Float64Array.from(valeurs).sort();
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function resume(pixels) {
  if (!pixels.length) return null;
  const [r, g, b] = [0, 1, 2].map((c) => Math.round(mediane(pixels.map((p) => p[c]))));
  const { h, l } = hsl(r, g, b);
  const hex = '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  return { hex, teinte: +h.toFixed(1), luminosite: +l.toFixed(1), pixels: pixels.length };
}

// Écorce : plus grande composante 4-connexe de pixels bleus (B > 1,5 R et B > 1,5 G), pédoncule
// exclu (haut de l'image, y < 68/640) — segmentation de la livraison v88.
// Pulpe : pixels orange pâle (teinte 15–50°, luminosité ≥ 75) entourés d'écorce dans les quatre
// directions ; les membres, hors du disque, n'y sont pas.
function mesurerCouleurs(rgba, largeur, hauteur) {
  const n = largeur * hauteur;
  const yMin = Math.round((68 / 640) * hauteur);
  const bleu = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2], a = rgba[i * 4 + 3];
    if (a > 0 && b > 1.5 * r && b > 1.5 * g && i / largeur >= yMin) bleu[i] = 1;
  }
  const composante = new Int32Array(n).fill(-1);
  let meilleure = -1, tailleMeilleure = 0;
  for (let depart = 0, id = 0; depart < n; depart++) {
    if (!bleu[depart] || composante[depart] >= 0) continue;
    const pile = [depart];
    composante[depart] = id;
    let taille = 0;
    while (pile.length) {
      const i = pile.pop();
      taille++;
      const x = i % largeur;
      for (const j of [i - largeur, i + largeur, x > 0 ? i - 1 : -1, x < largeur - 1 ? i + 1 : -1]) {
        if (j >= 0 && j < n && bleu[j] && composante[j] < 0) { composante[j] = id; pile.push(j); }
      }
    }
    if (taille > tailleMeilleure) { tailleMeilleure = taille; meilleure = id; }
    id++;
  }
  const ligne = Array.from({ length: hauteur }, () => [Infinity, -Infinity]);
  const colonne = Array.from({ length: largeur }, () => [Infinity, -Infinity]);
  const ecorce = [];
  for (let i = 0; i < n; i++) {
    if (composante[i] !== meilleure || meilleure < 0) continue;
    const x = i % largeur, y = (i / largeur) | 0;
    ecorce.push([rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]]);
    ligne[y][0] = Math.min(ligne[y][0], x); ligne[y][1] = Math.max(ligne[y][1], x);
    colonne[x][0] = Math.min(colonne[x][0], y); colonne[x][1] = Math.max(colonne[x][1], y);
  }
  const pulpe = [];
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    if (rgba[i * 4 + 3] < 255) continue;
    const x = i % largeur, y = (i / largeur) | 0;
    if (!(x > ligne[y][0] && x < ligne[y][1] && y > colonne[x][0] && y < colonne[x][1])) continue;
    const c = hsl(r, g, b);
    if (c.h >= 15 && c.h <= 50 && c.l >= 75 && c.s > 0.2) pulpe.push([r, g, b]);
  }
  return { ecorce: resume(ecorce), pulpe: resume(pulpe) };
}

function dans(v, [min, max]) { return v >= min && v <= max; }

function horsCible(mesure) {
  const e = [];
  if (!mesure.ecorce || !dans(mesure.ecorce.teinte, CIBLES.ecorce.teinte)) e.push('écorce');
  if (!mesure.pulpe || !dans(mesure.pulpe.teinte, CIBLES.pulpe.teinte)
    || !dans(mesure.pulpe.luminosite, CIBLES.pulpe.luminosite)) e.push('pulpe');
  return e;
}

// ---------- Alpha ----------

// Distance (échiquier) de chaque pixel au plus proche pixel non transparent, en deux passes.
function distanceAuSujet(alpha, cote) {
  const INF = 1 << 14;
  const d = new Uint16Array(cote * cote);
  for (let i = 0; i < d.length; i++) d[i] = alpha[i] > 0 ? 0 : INF;
  for (let y = 0; y < cote; y++) {
    for (let x = 0; x < cote; x++) {
      const i = y * cote + x;
      if (!d[i]) continue;
      let m = d[i];
      if (x > 0) m = Math.min(m, d[i - 1] + 1);
      if (y > 0) {
        m = Math.min(m, d[i - cote] + 1);
        if (x > 0) m = Math.min(m, d[i - cote - 1] + 1);
        if (x < cote - 1) m = Math.min(m, d[i - cote + 1] + 1);
      }
      d[i] = m;
    }
  }
  for (let y = cote - 1; y >= 0; y--) {
    for (let x = cote - 1; x >= 0; x--) {
      const i = y * cote + x;
      if (!d[i]) continue;
      let m = d[i];
      if (x < cote - 1) m = Math.min(m, d[i + 1] + 1);
      if (y < cote - 1) {
        m = Math.min(m, d[i + cote] + 1);
        if (x < cote - 1) m = Math.min(m, d[i + cote + 1] + 1);
        if (x > 0) m = Math.min(m, d[i + cote - 1] + 1);
      }
      d[i] = m;
    }
  }
  return d;
}

// Compare l'alpha décodé à l'alpha source nettoyé, image par image : combien de pixels du fond
// restent non nuls, et jusqu'à quelle valeur. propre = rare et sous le seuil de nettoyage.
function residuAlpha(source, decode, cote) {
  const n = cote * cote;
  let pixels = 0, nonNuls = 0, max = 0;
  for (let o = 0; o + n <= source.length; o += n) {
    const d = distanceAuSujet(source.subarray(o, o + n), cote);
    for (let i = 0; i < n; i++) {
      if (d[i] < FOND_PX) continue;
      pixels++;
      const a = decode[o + i];
      if (a > 0) { nonNuls++; max = Math.max(max, a); }
    }
  }
  const part = pixels ? nonNuls / pixels : 0;
  return { images: source.length / n, pixels, nonNuls, part, max, propre: part <= FOND_PART_MAX && max <= SEUIL_ALPHA };
}

// ---------- ffmpeg ----------

function ffmpeg(args, binaire = false) {
  const r = spawnSync(FFMPEG, ['-v', 'error', ...args], { maxBuffer: 1 << 30, encoding: binaire ? 'buffer' : 'utf8' });
  if (r.error) throw new Error(`ffmpeg introuvable (${r.error.message}) : l'installer ou régler FFMPEG`);
  if (r.status !== 0) throw new Error('ffmpeg : ' + String(r.stderr).trim().slice(0, 500));
  return r.stdout;
}

const filtre = (cote) => `scale=${cote}:${cote}:flags=lanczos,lutrgb=a='if(lt(val,${SEUIL_ALPHA}),0,val)'`;
const motif = (dossier) => path.join(dossier, '%04d.png');

function encoder(dossierClip, cote, fichier) {
  ffmpeg(['-y', '-fflags', '+bitexact', '-framerate', String(IMAGES_PAR_S), '-i', motif(dossierClip),
    '-vf', filtre(cote), ...VP9, '-fflags', '+bitexact', '-flags:v', '+bitexact', fichier]);
}

function alphaSource(dossierClip, cote) {
  return ffmpeg(['-framerate', String(IMAGES_PAR_S), '-i', motif(dossierClip), '-vf', filtre(cote) + ',format=rgba,alphaextract',
    '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], true);
}

function alphaDecode(fichier) {
  return ffmpeg(['-c:v', 'libvpx-vp9', '-i', fichier, '-vf', 'alphaextract', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], true);
}

function premiereImage(fichier) {
  return ffmpeg(['-c:v', 'libvpx-vp9', '-i', fichier, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], true);
}

// ---------- Programme ----------

function lireReglages() {
  const r = JSON.parse(fs.readFileSync(path.join(RACINE, 'contenu', 'mascotte.json'), 'utf8'));
  const clips = [...new Set(Object.values(r.etats || {}).map((e) => e && e.clip).filter(Boolean))];
  const attente = r.etats && r.etats.attente && r.etats.attente.clip;
  const variantes = (r.variantes || []).map(Number).filter((v) => v > 0);
  if (!attente || !clips.length || !variantes.length) throw new Error('mascotte.json : etats.attente, etats ou variantes manquants');
  return { clips, attente, variantes, active: r.dossier };
}

function principal(argv) {
  const libres = [];
  let sortie = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--sortie') sortie = argv[++i];
    else libres.push(argv[i]);
  }
  const [masters, version] = libres;
  if (!masters || !/^v\d+$/.test(version || '')) {
    throw new Error('usage : node scripts/encoder-mascotte.js "<dossier des PNG masters>" v89 [--sortie <dossier>]');
  }
  const { clips, attente, variantes, active } = lireReglages();
  for (const clip of clips) {
    if (!fs.existsSync(path.join(masters, clip, '0000.png'))) throw new Error(`master absent : ${clip}/0000.png`);
  }
  const destination = path.resolve(sortie || path.join(RACINE, 'assets', 'mascotte', version));
  const travail = fs.mkdtempSync(path.join(os.tmpdir(), `mascotte-${version}-`));
  const erreurs = [];
  try {
    for (const cote of variantes) {
      fs.mkdirSync(path.join(travail, String(cote)));
      for (const clip of clips) {
        const fichier = path.join(travail, String(cote), clip + '.webm');
        encoder(path.join(masters, clip), cote, fichier);
        const r = residuAlpha(alphaSource(path.join(masters, clip), cote), alphaDecode(fichier), cote);
        const fond = `${r.nonNuls} px non nuls sur ${r.pixels} (max ${r.max})`;
        if (!r.propre) erreurs.push(`${cote}/${clip} : fond ${fond}`);
        console.log(`${cote}/${clip}.webm  ${r.images} images  ${fs.statSync(fichier).size} o  fond ${r.propre ? 'propre' : 'KO'} : ${fond}`);
      }
      const couleurs = mesurerCouleurs(premiereImage(path.join(travail, String(cote), attente + '.webm')), cote, cote);
      const ko = horsCible(couleurs);
      if (ko.length) erreurs.push(`${cote} : couleur hors cible (${ko.join(', ')})`);
      const c = (z) => (z ? `${z.hex} ${z.teinte}° L${z.luminosite}` : 'introuvable');
      console.log(`${cote} couleur ${attente} image 0 : écorce ${c(couleurs.ecorce)} · pulpe ${c(couleurs.pulpe)}  ${ko.length ? 'HORS CIBLE' : 'dans la cible'}`);
    }
    if (erreurs.length) throw new Error('contrôles en échec, rien n\'est remplacé :\n- ' + erreurs.join('\n- '));
    fs.mkdirSync(destination, { recursive: true });
    for (const cote of variantes) {
      const dossier = path.join(destination, String(cote));
      fs.rmSync(dossier, { recursive: true, force: true });
      fs.cpSync(path.join(travail, String(cote)), dossier, { recursive: true });
    }
    // Masque de survol : la pose de repos, image 0 du clip d'attente, à la résolution du master.
    fs.copyFileSync(path.join(masters, attente, '0000.png'), path.join(destination, 'repos.png'));
  } finally {
    fs.rmSync(travail, { recursive: true, force: true });
  }
  console.log(`\n${clips.length} clips × ${variantes.join('/')} rangés dans ${destination}`);
  if (active !== version) console.log(`Version active : ${active}. Pour passer à ${version} : "dossier": "${version}" dans contenu/mascotte.json.`);
}

if (require.main === module) {
  try {
    principal(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

module.exports = { mesurerCouleurs, horsCible, distanceAuSujet, residuAlpha, hsl, CIBLES };
