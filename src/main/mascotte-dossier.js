'use strict';
// Dossier vidéo de la mascotte réellement utilisable par ce binaire. mascotte.json est lu à
// distance, les clips sont livrés dans le binaire : un poste peut lire un « dossier » publié
// avant d'avoir reçu la version qui le contient. Il garde alors le dernier dossier vidéo
// embarqué complet, au lieu de tomber en silhouette. La silhouette reste réservée au réglage
// explicite et à la panne vidéo.

const fs = require('fs');
const path = require('path');

function clipsAttendus(reglages) {
  return [...new Set(Object.values((reglages && reglages.etats) || {}).map((e) => e && e.clip).filter(Boolean))];
}

// Un dossier est complet s'il a repos.png et chaque clip dans chaque variante.
function complet(racine, dossier, reglages) {
  const base = path.join(racine, dossier);
  if (!fs.existsSync(path.join(base, 'repos.png'))) return false;
  const variantes = ((reglages && reglages.variantes) || []).map(Number).filter((v) => v > 0);
  const clips = clipsAttendus(reglages);
  return variantes.every((v) => clips.every((c) => fs.existsSync(path.join(base, String(v), c + '.webm'))));
}

// Dossiers vN complets livrés dans assets/mascotte, du plus récent au plus ancien.
function dossiersEmbarques(racine, reglages) {
  let noms = [];
  try { noms = fs.readdirSync(racine); } catch (_) { return []; }
  return noms
    .filter((n) => /^v\d+$/.test(n) && complet(racine, n, reglages))
    .sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)));
}

// Retourne les réglages à transmettre à la page et, s'il y a eu repli, { demande, retenu }.
// Aucun dossier embarqué complet : on laisse la demande telle quelle, la page constatera la
// panne vidéo et passera en silhouette.
function resoudreDossier(reglages, embarques) {
  if (!reglages || reglages.mascotte === 'silhouette') return { reglages, repli: null };
  if (embarques.includes(reglages.dossier) || !embarques.length) return { reglages, repli: null };
  const retenu = embarques[0];
  return { reglages: { ...reglages, dossier: retenu }, repli: { demande: reglages.dossier, retenu } };
}

module.exports = { dossiersEmbarques, resoudreDossier };
