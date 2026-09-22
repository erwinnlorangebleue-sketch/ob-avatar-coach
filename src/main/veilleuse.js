'use strict';
// Veilleuse des cartes spontanées, décidée par le coach sur son poste.
// Toujours limitée dans le temps : un poste ne doit jamais rester muet sans que personne ne le sache.

const MODES = ['courte', 'demain'];
const DUREE_MAX_H = 48; // garde-fou : une échéance plus lointaine (horloge déréglée) est ignorée

function calculerFin(mode, maintenant, config) {
  if (mode === 'courte') {
    return new Date(maintenant.getTime() + (config.veilleuse_duree_min || 60) * 60000);
  }
  if (mode === 'demain') {
    const fin = new Date(maintenant);
    fin.setDate(fin.getDate() + 1);
    fin.setHours(config.veilleuse_reprise_heure ?? 6, 0, 0, 0);
    return fin;
  }
  return null;
}

function estActive(jusqua, maintenant) {
  const fin = Date.parse(jusqua);
  if (!Number.isFinite(fin)) return false;
  const restant = fin - maintenant.getTime();
  return restant > 0 && restant <= DUREE_MAX_H * 3600000;
}

module.exports = { MODES, calculerFin, estActive };
