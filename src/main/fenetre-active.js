'use strict';
// Fenêtre active de Windows (user32.dll via koffi, sans compilation).
// Sert à rendre le clavier à l'application exacte que le coach utilisait avant d'ouvrir la bulle.
// Si la bibliothèque ne se charge pas, l'appli fonctionne quand même (repli sur blur()).

let api = null;
try {
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  api = {
    koffi,
    GetForegroundWindow: user32.func('void * __stdcall GetForegroundWindow()'),
    SetForegroundWindow: user32.func('bool __stdcall SetForegroundWindow(void *hWnd)'),
    IsWindow: user32.func('bool __stdcall IsWindow(void *hWnd)'),
  };
} catch (_) {
  api = null;
}

const disponible = () => api !== null;

// Poignée native d'un BrowserWindow (Buffer) -> adresse numérique comparable.
function adresseFenetre(browserWindow) {
  const b = browserWindow.getNativeWindowHandle();
  return b.length >= 8 ? b.readBigUInt64LE(0) : BigInt(b.readUInt32LE(0));
}

function memoriser(sauf) {
  if (!api) return null;
  const h = api.GetForegroundWindow();
  if (!h) return null;
  if (sauf && api.koffi.address(h) === adresseFenetre(sauf)) return null;
  return h;
}

function restaurer(h) {
  if (!api || !h || !api.IsWindow(h)) return false;
  return api.SetForegroundWindow(h);
}

module.exports = { disponible, memoriser, restaurer };
