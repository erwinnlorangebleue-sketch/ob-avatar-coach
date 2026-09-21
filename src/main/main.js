'use strict';
// Processus principal : fenêtre transparente traversante, raccourci global, cartes,
// recherche dans le centre d'aide, synchronisations, mise à jour automatique.

const path = require('path');
const { app, BrowserWindow, screen, ipcMain, globalShortcut, powerMonitor, shell, net } = require('electron');

const { creerJournal } = require('./journal');
const { creerContenu } = require('./contenu');
const { creerCentreAide } = require('./centre-aide');
const { construireCartes, creerPioche } = require('./cartes');
const R = require('./recherche');
const fenetreActive = require('./fenetre-active');

const LARGEUR = 400;
const HAUTEUR = 580;
const PAS_MINUTERIE_S = 5;
const DELAI_RESEAU_MS = 20000;
const ORIGINE_CENTRE_AIDE = 'https://support.lorangebleue.fr';

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

const dossierDonnees = app.getPath('userData');
const journal = creerJournal(dossierDonnees, app.getVersion());

let fenetre = null;
let questionOuverte = false;
let fenetrePrecedente = null; // application qui avait le clavier avant la bulle
let raccourciEnregistre = null;
let secondesActives = 0;
let majPrete = false;
let derniereSynchroArticlesEchouee = false;

// ---------- Réseau (pile Chromium : respecte le proxy du poste) ----------

async function telecharger(url) {
  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), DELAI_RESEAU_MS);
  try {
    const rep = await net.fetch(url, { signal: controle.signal, cache: 'no-store' });
    if (!rep.ok) throw new Error(`HTTP ${rep.status}`);
    return await rep.text();
  } finally {
    clearTimeout(minuterie);
  }
}

const contenu = creerContenu({
  dossierLivre: path.join(app.getAppPath(), 'contenu'),
  // Hors installation, pas de cache : les fichiers locaux font foi.
  dossierCache: app.isPackaged || process.env.OB_CONTENU_DISTANT
    ? path.join(dossierDonnees, 'contenu-cache')
    : path.join(dossierDonnees, 'contenu-cache-dev'),
  journal,
  telecharger,
});

const centreAide = creerCentreAide({
  dossier: dossierDonnees,
  journal,
  telechargerJson: async (url) => JSON.parse(await telecharger(url)),
});

// ---------- État dérivé du contenu ----------

let etat = null; // { config, textes, cartes, piocher, regles, motsVides }
let indexArticles = centreAide.lire();

function appliquerContenu() {
  const brut = contenu.charger();
  const { cartes, ecartees } = construireCartes(brut.index, brut.md, brut.config.categories_affichables || []);
  etat = {
    config: brut.config,
    textes: brut.textes,
    cartes,
    piocher: creerPioche(cartes),
    regles: R.preparerSynonymes(brut.synonymes),
    motsVides: R.preparerMotsVides(brut.motsVides),
  };
  journal.info(`contenu chargé : ${cartes.length} cartes affichables, ${ecartees.length} écartées, ${etat.regles.length} synonymes`);
  enregistrerRaccourci();
  appliquerVeille();
  if (fenetre) fenetre.webContents.send('init', donneesInit());
}

function donneesInit() {
  return { textes: etat.textes, version: app.getVersion() };
}

// ---------- Fenêtre ----------

function positionner() {
  const zone = screen.getPrimaryDisplay().workArea;
  fenetre.setBounds({
    x: zone.x + zone.width - LARGEUR,
    y: zone.y + zone.height - HAUTEUR,
    width: LARGEUR,
    height: HAUTEUR,
  });
}

function creerFenetre() {
  fenetre = new BrowserWindow({
    width: LARGEUR,
    height: HAUTEUR,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  // Niveau le plus haut : reste visible au-dessus d'une application en plein écran.
  fenetre.setAlwaysOnTop(true, 'screen-saver');
  // Par défaut, tous les clics traversent. forward:true continue d'envoyer les mouvements
  // de souris à la page, qui détecte le survol de l'avatar et redemande les clics (IPC « survol »).
  fenetre.setIgnoreMouseEvents(true, { forward: true });
  positionner();
  fenetre.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  fenetre.webContents.once('did-finish-load', () => {
    if (!etat.config.veille) fenetre.showInactive();
    journal.info(`fenêtre affichée : ${JSON.stringify(fenetre.getBounds())}, visible=${fenetre.isVisible()}`);
  });
  // Le coach a cliqué ailleurs : on ferme sans lui reprendre le clavier.
  fenetre.on('blur', () => {
    if (!questionOuverte) return;
    questionOuverte = false;
    fenetre.webContents.send('fermer-question');
  });
  fenetre.webContents.on('render-process-gone', (_, d) => {
    journal.erreur('rendu arrêté : ' + d.reason);
    fenetre.reload();
  });
  // Aucune navigation ni nouvelle fenêtre depuis la page.
  fenetre.webContents.on('will-navigate', (e) => e.preventDefault());
  fenetre.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  screen.on('display-metrics-changed', positionner);
  screen.on('display-added', positionner);
  screen.on('display-removed', positionner);
}

function appliquerVeille() {
  if (!fenetre) return;
  if (etat.config.veille) {
    if (fenetre.isVisible()) { fenetre.hide(); journal.info('mise en veille à distance'); }
  } else if (!fenetre.isVisible() && fenetre.webContents.getURL()) {
    fenetre.showInactive();
  }
}

function ouvrirQuestion() {
  if (!fenetre || etat.config.veille) return;
  if (!questionOuverte) memoriserFenetrePrecedente();
  questionOuverte = true;
  fenetre.showInactive();
  fenetre.setAlwaysOnTop(true, 'screen-saver');
  fenetre.moveTop();
  fenetre.focus();
  fenetre.webContents.focus();
  fenetre.webContents.send('ouvrir-question');
}

// Pas de setFocusable() : sous Windows il appelle blur(), qui donne le clavier à la fenêtre
// suivante dans la pile (souvent l'explorateur) et non à celle que le coach utilisait.
// On note donc l'application active dès que la souris approche l'avatar ou que le raccourci
// est pressé, et on lui rend le clavier explicitement.
function memoriserFenetrePrecedente() {
  const h = fenetreActive.memoriser(fenetre);
  if (h) fenetrePrecedente = h;
}

function rendreLeClavier() {
  if (!fenetre || !fenetre.isFocused()) return;
  if (!fenetreActive.restaurer(fenetrePrecedente)) fenetre.blur();
}

function fermerQuestion() {
  const avaitLeClavier = questionOuverte && fenetre && fenetre.isFocused();
  questionOuverte = false;
  if (!fenetre) return;
  if (avaitLeClavier) rendreLeClavier();
}

function enregistrerRaccourci() {
  const voulu = etat.config.raccourci || 'Control+Space';
  if (raccourciEnregistre === voulu) return;
  if (raccourciEnregistre) globalShortcut.unregister(raccourciEnregistre);
  raccourciEnregistre = null;
  const ok = globalShortcut.register(voulu, () => {
    if (questionOuverte && fenetre.isFocused()) fenetre.webContents.send('fermer-question');
    else ouvrirQuestion();
  });
  if (ok) {
    raccourciEnregistre = voulu;
    journal.info('raccourci enregistré : ' + voulu);
  } else {
    journal.erreur(`raccourci ${voulu} indisponible (déjà pris par une autre application ?)`);
  }
}

// ---------- IPC ----------

ipcMain.handle('init', () => donneesInit());

ipcMain.on('survol', (_, actif) => {
  if (!fenetre) return;
  fenetre.setIgnoreMouseEvents(!actif, { forward: true });
  if (questionOuverte) return;
  // La souris arrive sur l'avatar : on note qui a le clavier avant un éventuel clic.
  // Elle repart après un clic sur une carte : on rend le clavier.
  if (actif) memoriserFenetrePrecedente();
  else rendreLeClavier();
});

ipcMain.on('demander-question', () => ouvrirQuestion());
ipcMain.on('question-fermee', () => fermerQuestion());

ipcMain.handle('rechercher', (_, question) => {
  const q = String(question || '').slice(0, 300).trim();
  if (!q) return { etat: 'vide' };
  if (!etat.config.recherche_active) return { etat: 'desactivee' };
  if (!indexArticles) {
    journal.noterQuestion(q);
    return { etat: 'index_absent' };
  }
  const { resultats } = R.rechercher(q, indexArticles.articles, etat.regles, etat.motsVides, {
    max: etat.config.resultats_max,
    scoreMinimum: etat.config.score_minimum,
    couvertureMinimum: etat.config.couverture_minimum,
  });
  const synchro = { date: indexArticles.synchronise_le, horsLigne: derniereSynchroArticlesEchouee };
  if (resultats.length === 0) {
    journal.noterQuestion(q);
    return { etat: 'inconnu', synchro };
  }
  return {
    etat: 'ok',
    synchro,
    resultats: resultats.map(({ titre, url, maj, section }) => ({ titre, url, maj, section })),
  };
});

ipcMain.on('ouvrir-article', (_, url) => {
  try {
    if (new URL(url).origin !== ORIGINE_CENTRE_AIDE) throw new Error('origine refusée');
    // Le navigateur va prendre le clavier : on ne le rend pas à l'application précédente.
    questionOuverte = false;
    shell.openExternal(url);
    if (fenetre) fenetre.webContents.send('fermer-question');
  } catch (e) {
    journal.erreur(`ouverture refusée (${url}) : ${e.message}`);
  }
});

// ---------- Minuteries ----------

// Une carte toutes les ~120 s d'activité réelle : les secondes où le poste est inactif ne comptent pas.
// Certaines applications (plein écran, redémarrage de l'explorateur, outils qui forcent le
// premier plan) font repasser l'avatar derrière elles : on réaffirme le « toujours au-dessus ».
function reaffirmerPremierPlan() {
  if (!fenetre || !fenetre.isVisible()) return;
  fenetre.setAlwaysOnTop(false);
  fenetre.setAlwaysOnTop(true, 'screen-saver');
  fenetre.moveTop();
}

function tickActivite() {
  reaffirmerPremierPlan();
  const c = etat.config;
  if (c.veille || !c.cartes_actives || !fenetre) return;
  if (powerMonitor.getSystemIdleTime() < (c.seuil_inactivite_s || 60)) secondesActives += PAS_MINUTERIE_S;
  if (secondesActives >= (c.intervalle_cartes_s || 120) && !questionOuverte) {
    secondesActives = 0;
    const carte = etat.piocher();
    if (carte) fenetre.webContents.send('carte', { ...carte, dureeS: c.duree_carte_s || 30 });
  }
}

async function synchroniserContenu() {
  // En développement, on travaille sur les fichiers locaux : la copie distante les masquerait.
  if (!app.isPackaged && !process.env.OB_CONTENU_DISTANT) return;
  const { modifies } = await contenu.synchroniser();
  if (modifies > 0) {
    journal.info(`${modifies} fichier(s) de contenu mis à jour à distance`);
    appliquerContenu();
  }
}

async function synchroniserArticles() {
  try {
    indexArticles = await centreAide.synchroniser(etat.motsVides);
    derniereSynchroArticlesEchouee = false;
  } catch (e) {
    derniereSynchroArticlesEchouee = true;
    journal.erreur('synchro centre d\'aide : ' + e.message);
  }
}

function heuresDepuisSynchro() {
  if (!indexArticles) return Infinity;
  return (Date.now() - Date.parse(indexArticles.synchronise_le)) / 3600000;
}

// Vérifiée toutes les 30 min : la nuit à l'heure prévue, ou dès que l'index a plus de 24 h
// (poste éteint la nuit, synchro précédente échouée).
function verifierSynchroArticles() {
  const age = heuresDepuisSynchro();
  const heure = new Date().getHours();
  if (age > 24 || (heure === (etat.config.synchro_articles_heure ?? 3) && age > 12)) synchroniserArticles();
}

// ---------- Mise à jour automatique ----------

function demarrerMisesAJour() {
  if (!app.isPackaged) return;
  const { autoUpdater } = require('electron-updater');
  autoUpdater.logger = {
    info: (m) => journal.info('maj : ' + m),
    warn: (m) => journal.info('maj (avertissement) : ' + m),
    error: (m) => journal.erreur('maj : ' + m),
    debug: () => {},
  };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', (info) => {
    majPrete = true;
    journal.info('mise à jour téléchargée : ' + info.version);
  });
  autoUpdater.on('error', (e) => journal.erreur('maj : ' + (e && e.message)));
  const verifier = () => autoUpdater.checkForUpdates().catch((e) => journal.erreur('maj : ' + e.message));
  verifier();
  setInterval(verifier, (etat.config.verification_maj_h || 4) * 3600000);
  // Les postes ne sont presque jamais redémarrés : on installe dès que personne ne s'en sert.
  setInterval(() => {
    if (majPrete && !questionOuverte && powerMonitor.getSystemIdleTime() > 300) {
      journal.info('installation de la mise à jour (poste inactif)');
      autoUpdater.quitAndInstall(true, true);
    }
  }, 60000);
}

// ---------- Démarrage ----------

app.whenReady().then(() => {
  appliquerContenu();
  journal.majEtat({ demarre_le: new Date().toISOString() });
  if (!fenetreActive.disponible()) journal.erreur('user32 indisponible : retour du clavier approximatif');
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true });
  creerFenetre();

  setInterval(tickActivite, PAS_MINUTERIE_S * 1000);
  synchroniserContenu().finally(() => {
    if (heuresDepuisSynchro() > 20) synchroniserArticles();
  });
  setInterval(synchroniserContenu, (etat.config.relecture_contenu_min || 60) * 60000);
  setInterval(verifierSynchroArticles, 30 * 60000);
  demarrerMisesAJour();
});

app.on('second-instance', () => ouvrirQuestion());
app.on('will-quit', () => globalShortcut.unregisterAll());
process.on('uncaughtException', (e) => journal.erreur('exception : ' + (e && e.stack)));
process.on('unhandledRejection', (e) => journal.erreur('promesse : ' + (e && e.stack)));
