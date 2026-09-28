'use strict';
// Identité de l'appli de développement (electron . depuis le dépôt) : nom, dossier de données
// et donc verrou d'instance unique distincts de l'appli installée. Sans elle, lancer l'appli de
// dev sur un poste où l'installée tourne ouvrait la bulle de l'installée (second-instance).
// À appliquer avant requestSingleInstanceLock, qui dépend du dossier de données.

const path = require('path');

const NOM_DEV = 'OB Coach (dev)';

function identiteDev(dossierAppData) {
  return { nom: NOM_DEV, userData: path.join(dossierAppData, NOM_DEV) };
}

module.exports = { identiteDev, NOM_DEV };
