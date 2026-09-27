'use strict';
// Moyenne processeur du poste pour la télémétrie : somme de tous les processus de l'appli
// (principal, rendu, GPU, utilitaires), en % d'un cœur, séparément par phase de la mascotte.
// La page signale sa phase (attente, lecture, autre) ; on relève le temps processeur cumulé à
// chaque changement de phase et à intervalle régulier, et chaque tranche compte pour la phase
// qu'elle a duré. Une moyenne est publiée dès qu'une phase totalise dureeS secondes.
// Seules attente et lecture sont mesurées ; autre et pause (fenêtre cachée, veille) ne comptent pas.

const PHASES_MESUREES = ['attente', 'lecture'];

function creerReleveProcesseur({ lireMetriques, maintenant = Date.now, dureeS = 300, surMoyenne }) {
  let contexte = { phase: null, mode: null, variante: null };
  let dernier = null; // { t, cpu: Map pid → secondes cumulées }
  let cumuls = {}; // phase → { cpuS, dureeS }

  function relever() {
    const cpu = new Map();
    for (const m of lireMetriques()) {
      const s = m && m.cpu && m.cpu.cumulativeCPUUsage;
      if (typeof s === 'number') cpu.set(m.pid, s);
    }
    return { t: maintenant(), cpu };
  }

  // Clôt la tranche en cours et l'attribue à la phase qui l'a occupée.
  function echantillon() {
    const releve = relever();
    const phase = contexte.phase;
    if (dernier && PHASES_MESUREES.includes(phase)) {
      let cpuS = 0;
      for (const [pid, s] of releve.cpu) {
        const avant = dernier.cpu.get(pid); // processus apparu dans la tranche : compté à la suivante
        if (avant !== undefined && s >= avant) cpuS += s - avant;
      }
      const c = cumuls[phase] || (cumuls[phase] = { cpuS: 0, dureeS: 0 });
      c.cpuS += cpuS;
      c.dureeS += (releve.t - dernier.t) / 1000;
      if (c.dureeS >= dureeS) {
        surMoyenne(phase, {
          pourcent_coeur: Math.round((1000 * c.cpuS) / c.dureeS) / 10,
          duree_s: Math.round(c.dureeS),
          mode: contexte.mode,
          variante: contexte.variante,
        });
        delete cumuls[phase];
      }
    }
    dernier = releve;
  }

  return {
    echantillon,
    // Nouvelle phase ou nouvel affichage. Un autre mode ou une autre variante repart de zéro :
    // une moyenne ne mélange jamais deux affichages.
    changer({ phase, mode, variante }) {
      echantillon();
      if (mode !== contexte.mode || variante !== contexte.variante) cumuls = {};
      contexte = { phase, mode, variante };
    },
  };
}

module.exports = { creerReleveProcesseur, PHASES_MESUREES };
