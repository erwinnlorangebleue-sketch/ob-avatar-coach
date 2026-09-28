'use strict';
// Vérification périodique (contenu distant, binaire) dans le processus principal : au démarrage,
// à la sortie de veille, puis à intervalle régulier. L'intervalle est relu à chaque cycle
// (réglage distant pris à chaud). Chaque vérification écrit une ligne de journal, même sans
// changement : un poste dont les vérifications s'arrêtent se voit à l'absence de ces lignes.
// Une minuterie en retard (horloge avancée, veille non signalée) est rattrapée par rattraper(),
// appelé par la minuterie d'activité.

const RETARD_TOLERE_MS = 60000;

function creerVerification({ cible, action, intervalleMs, journal, maintenant = Date.now, programmer = setTimeout, annuler = clearTimeout }) {
  let minuterie = null;
  let prevue = null; // heure prévue de la prochaine vérification
  let enCours = false;

  function planifier() {
    annuler(minuterie);
    const ms = Math.max(60000, Number(intervalleMs()) || 3600000);
    prevue = maintenant() + ms;
    minuterie = programmer(() => lancer('horaire'), ms);
  }

  async function lancer(raison) {
    if (enCours) return;
    enCours = true;
    annuler(minuterie);
    prevue = null;
    try {
      journal.info(`vérification ${cible} (${raison}) : ${await action()}`);
    } catch (e) {
      journal.erreur(`vérification ${cible} (${raison}) : échec, ${e && e.message}`);
    } finally {
      enCours = false;
      planifier();
    }
  }

  function rattraper() {
    if (prevue !== null && !enCours && maintenant() - prevue > RETARD_TOLERE_MS) lancer('rattrapage');
  }

  return { lancer, rattraper, prochaine: () => prevue };
}

module.exports = { creerVerification, RETARD_TOLERE_MS };
