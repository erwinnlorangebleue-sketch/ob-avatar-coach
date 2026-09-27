'use strict';
// Moyenne processeur du poste pour la télémétrie : somme de tous les processus de l'appli
// (principal, rendu, GPU, utilitaires), en % d'un cœur, séparément par phase de la mascotte.
// La page signale sa phase (attente, lecture, autre) et le clip qui tourne ; on relève le temps
// processeur cumulé à chaque changement et à intervalle régulier, et chaque tranche compte pour
// la phase qu'elle a duré. Une moyenne est publiée dès qu'une phase totalise sa durée (durees).
// Seules attente et lecture sont mesurées ; autre et pause (fenêtre cachée, veille) ne comptent pas.
// Avec la moyenne : le maximum observé par clip, un passage (clip tournant sans interruption)
// comptant pour une valeur s'il a duré au moins passageMinS secondes.

const PHASES_MESUREES = ['attente', 'lecture'];
const DUREES_S = { attente: 300, lecture: 60 };

const pourcent = (cpuS, dureeS) => Math.round((1000 * cpuS) / dureeS) / 10;

function creerReleveProcesseur({ lireMetriques, maintenant = Date.now, durees = DUREES_S, passageMinS = 1, surMoyenne }) {
  let contexte = { phase: null, mode: null, variante: null, clip: null };
  let dernier = null; // { t, cpu: Map pid → secondes cumulées }
  let cumuls = {}; // phase → { cpuS, dureeS, maxParClip: { clip → % } }
  let passage = null; // { phase, clip, cpuS, dureeS } : clip en cours, pas encore clos

  function relever() {
    const cpu = new Map();
    for (const m of lireMetriques()) {
      const s = m && m.cpu && m.cpu.cumulativeCPUUsage;
      if (typeof s === 'number') cpu.set(m.pid, s);
    }
    return { t: maintenant(), cpu };
  }

  // Un passage clos compte pour le maximum de son clip dans la moyenne de sa phase.
  function clorePassage() {
    const p = passage;
    passage = null;
    if (!p || p.dureeS < passageMinS || !cumuls[p.phase]) return;
    const max = cumuls[p.phase].maxParClip;
    const v = pourcent(p.cpuS, p.dureeS);
    if (!(max[p.clip] >= v)) max[p.clip] = v;
  }

  // Clôt la tranche en cours et l'attribue à la phase qui l'a occupée.
  function echantillon() {
    const releve = relever();
    const { phase, clip } = contexte;
    if (dernier && PHASES_MESUREES.includes(phase)) {
      let cpuS = 0;
      for (const [pid, s] of releve.cpu) {
        const avant = dernier.cpu.get(pid); // processus apparu dans la tranche : compté à la suivante
        if (avant !== undefined && s >= avant) cpuS += s - avant;
      }
      const dureeTranche = (releve.t - dernier.t) / 1000;
      const c = cumuls[phase] || (cumuls[phase] = { cpuS: 0, dureeS: 0, maxParClip: {} });
      c.cpuS += cpuS;
      c.dureeS += dureeTranche;
      if (clip) {
        if (!passage) passage = { phase, clip, cpuS: 0, dureeS: 0 };
        passage.cpuS += cpuS;
        passage.dureeS += dureeTranche;
      }
      if (c.dureeS >= (durees[phase] || DUREES_S[phase])) {
        // Passage à cheval : sa partie écoulée compte ici, la suite dans la moyenne suivante.
        const suite = passage && passage.phase === phase ? passage.clip : null;
        clorePassage();
        if (suite) passage = { phase, clip: suite, cpuS: 0, dureeS: 0 };
        surMoyenne(phase, {
          pourcent_coeur: pourcent(c.cpuS, c.dureeS),
          duree_s: Math.round(c.dureeS),
          max_par_clip: c.maxParClip,
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
    // Nouvelle phase, nouveau clip ou nouvel affichage. Un autre mode ou une autre variante repart
    // de zéro : une moyenne ne mélange jamais deux affichages.
    changer({ phase, mode, variante, clip = null }) {
      echantillon();
      if (phase !== contexte.phase || clip !== contexte.clip) clorePassage();
      if (mode !== contexte.mode || variante !== contexte.variante) {
        cumuls = {};
        passage = null;
      }
      contexte = { phase, mode, variante, clip: clip || null };
    },
  };
}

module.exports = { creerReleveProcesseur, PHASES_MESUREES, DUREES_S };
