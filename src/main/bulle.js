'use strict';
// Bulle de question et installation des mises à jour. Une bulle oubliée ouverte (coach parti,
// ouverture par erreur) se ferme seule après fermeture_bulle_min sans interaction : elle ne
// bloque jamais une installation au-delà.

const FERMETURE_DEFAUT_MIN = 10;
const INACTIVITE_INSTALLATION_S = 300;

function bulleExpiree({ ouverte, derniereInteraction, maintenant, minutes }) {
  const m = Number(minutes) > 0 ? Number(minutes) : FERMETURE_DEFAUT_MIN;
  return !!ouverte && maintenant - derniereInteraction >= m * 60000;
}

function installationPermise({ majPrete, questionOuverte, inactifS }) {
  return !!majPrete && !questionOuverte && inactifS > INACTIVITE_INSTALLATION_S;
}

module.exports = { bulleExpiree, installationPermise, FERMETURE_DEFAUT_MIN };
