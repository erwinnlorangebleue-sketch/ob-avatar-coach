'use strict';
// Journaux locaux du poste : log technique, état (télémétrie locale), questions sans réponse.
// Aucune donnée d'adhérent : les questions sont expurgées avant écriture.

const fs = require('fs');
const path = require('path');

const TAILLE_MAX_LOG = 1024 * 1024;

function creerJournal(dossier, version) {
  fs.mkdirSync(dossier, { recursive: true });
  const fichierLog = path.join(dossier, 'journal.log');
  const fichierEtat = path.join(dossier, 'etat.json');
  const fichierQuestions = path.join(dossier, 'questions-sans-reponse.jsonl');

  function ecrire(niveau, message) {
    const ligne = `${new Date().toISOString()} [${niveau}] ${message}\n`;
    try {
      if (fs.existsSync(fichierLog) && fs.statSync(fichierLog).size > TAILLE_MAX_LOG) {
        fs.renameSync(fichierLog, fichierLog + '.1');
      }
      fs.appendFileSync(fichierLog, ligne);
    } catch (_) { /* un log qui échoue ne doit jamais faire tomber l'appli */ }
    if (niveau !== 'debug') console.log(ligne.trim());
  }

  function lireEtat() {
    try { return JSON.parse(fs.readFileSync(fichierEtat, 'utf8')); } catch (_) { return {}; }
  }

  function majEtat(champs) {
    const etat = { ...lireEtat(), ...champs, version, mis_a_jour: new Date().toISOString() };
    try { fs.writeFileSync(fichierEtat, JSON.stringify(etat, null, 2)); } catch (_) {}
    return etat;
  }

  return {
    info: (m) => ecrire('info', m),
    erreur(m) {
      ecrire('erreur', m);
      majEtat({ derniere_erreur: { date: new Date().toISOString(), message: String(m).slice(0, 500) } });
    },
    lireEtat,
    majEtat,
    noterQuestion(question) {
      const ligne = JSON.stringify({ date: new Date().toISOString(), version, question: expurger(question) });
      try { fs.appendFileSync(fichierQuestions, ligne + '\n'); } catch (e) { ecrire('erreur', 'questions : ' + e.message); }
    },
    fichierQuestions,
  };
}

// Retire ce qui ressemble à un identifiant : e-mails, suites de chiffres (téléphone, n° de membre, IBAN).
function expurger(texte) {
  return String(texte || '')
    .slice(0, 300)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[e-mail]')
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9 ]{10,30}\b/gi, '[numéro]')
    .replace(/\d[\d .-]{2,}\d|\d{3,}/g, '[numéro]')
    .trim();
}

module.exports = { creerJournal, expurger };
