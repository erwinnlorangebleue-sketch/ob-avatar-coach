'use strict';
// Pont minimal entre la page et le processus principal.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ob', {
  init: () => ipcRenderer.invoke('init'),
  survol: (actif) => ipcRenderer.send('survol', !!actif),
  demanderQuestion: () => ipcRenderer.send('demander-question'),
  taille: (largeur, hauteur) => ipcRenderer.send('taille', Number(largeur), Number(hauteur)),
  questionFermee: () => ipcRenderer.send('question-fermee'),
  rechercher: (q) => ipcRenderer.invoke('rechercher', String(q)),
  ouvrirArticle: (url) => ipcRenderer.send('ouvrir-article', String(url)),
  veilleuse: (mode) => ipcRenderer.send('veilleuse', String(mode)),
  mascotte: (mode, erreur) => ipcRenderer.send('mascotte', { mode: String(mode), erreur: erreur ? String(erreur) : null }),
  phase: (p) => ipcRenderer.send('phase', {
    phase: String(p.phase), mode: String(p.mode), variante: Number(p.variante) || null,
  }),
  surInit: (f) => ipcRenderer.on('init', (_, d) => f(d)),
  surOuvrirQuestion: (f) => ipcRenderer.on('ouvrir-question', () => f()),
  surFermerQuestion: (f) => ipcRenderer.on('fermer-question', () => f()),
  surCarte: (f) => ipcRenderer.on('carte', (_, c) => f(c)),
  surVeilleuse: (f) => ipcRenderer.on('veilleuse', (_, jusqua) => f(jusqua)),
  surPause: (f) => ipcRenderer.on('pause', (_, enPause) => f(!!enPause)),
  surReveil: (f) => ipcRenderer.on('reveil', () => f()),
});
