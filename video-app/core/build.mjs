// Baut dist/flimmerfrei.inject.js (ein IIFE) und dist/flimmerfrei.user.js. Keine Abhängigkeiten.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));

// Feste Reihenfolge: Abhängigkeiten zuerst.
export const MODULES = ['config', 'adblock', 'background', 'pip', 'bridge', 'look', 'diag', 'captions', 'cast', 'castui', 'index'];

export const UPDATE_URL = 'https://volvic93.github.io/apps/video-app/flimmerfrei.user.js';

export function userscriptHeader(version) {
  return [
    '// ==UserScript==',
    '// @name         Flimmerfrei',
    '// @namespace    https://volvic93.github.io/apps/video-app/',
    '// @version      ' + version,
    '// @description  Werbeblocker, Hintergrundwiedergabe, Bild-in-Bild und AirPlay fuer youtube.com',
    '// @match        https://*.youtube.com/*',
    '// @run-at       document-start',
    '// @grant        none',
    '// @inject-into  content',
    '// @noframes',
    '// @downloadURL  ' + UPDATE_URL,
    '// @updateURL    ' + UPDATE_URL,
    '// ==/UserScript==',
    '',
  ].join('\n');
}

const IMPORT_RE = /^import\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"];?[ \t]*$/gm;
const DECL_RE = /^(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;

// Module zu einem Skript zusammenfügen (ohne IIFE-Hülle).
export function bundleModules(sources, version) {
  const declared = new Map();
  const imported = [];
  const parts = [];
  for (const name of MODULES) {
    let src = sources[name];
    if (typeof src !== 'string') throw new Error('Modul fehlt: ' + name);
    src = src.replace(IMPORT_RE, (m, names) => {
      for (const n of names.split(',').map((s) => s.trim()).filter(Boolean)) imported.push({ name: n.split(/\s+as\s+/)[0], from: name });
      return '';
    });
    if (/^import\s/m.test(src)) throw new Error('Nicht unterstützte import-Zeile in ' + name);
    if (/^export\s+default\b/m.test(src)) throw new Error('export default nicht unterstützt in ' + name);
    src = src.replace(/^export\s*\{[^}]*\};?[ \t]*$/gm, '');
    src = src.replace(/^export\s+(?=(?:async\s+)?(?:function|const|let|var|class)\b)/gm, '');
    if (/^export\b/m.test(src)) throw new Error('Nicht unterstütztes export in ' + name);
    let m;
    DECL_RE.lastIndex = 0;
    while ((m = DECL_RE.exec(src))) {
      if (declared.has(m[1])) throw new Error('Doppelter Name "' + m[1] + '" in ' + name + ' und ' + declared.get(m[1]));
      declared.set(m[1], name);
    }
    parts.push('// ---- ' + name + ' ----\n' + src.trim() + '\n');
  }
  for (const imp of imported) {
    if (!declared.has(imp.name)) throw new Error('Import "' + imp.name + '" in ' + imp.from + ' wird nirgends deklariert');
  }
  let body = parts.join('\n');
  // Versionsnummer aus package.json einsetzen
  body = body.replace(/const VERSION = '[^']*';/, "const VERSION = '" + version + "';");
  return body;
}

export function wrapIife(body) {
  return "(function () {\n'use strict';\n" + body + '\n})();\n';
}

// Lader des Userscripts. Läuft im Userscript-Kontext vor dem Kern: Er bringt CORE per <script> in die Seite
// (mit Nonce und Trusted-Types-Richtlinie); gelingt das nicht, läuft CORE im Kontext des Userscripts.
export const LOADER_SRC = String.raw`
var MARK = 'data-flimmerfrei';
var policy = null;
var done = false;
var observer = null;

function isYtHost(hostname) {
  if (typeof hostname !== 'string') return false;
  var h = hostname.replace(/^\s+|\s+$/g, '').toLowerCase().replace(/\.$/, '');
  if (!h || h === 'accounts.youtube.com' || h === 'consent.youtube.com') return false;
  var domains = ['youtube.com', 'youtube-nocookie.com'];
  for (var i = 0; i < domains.length; i++) {
    var d = domains[i];
    if (h === d) return true;
    if (h.length > d.length && h.slice(-(d.length + 1)) === '.' + d) return true;
  }
  return false;
}

function markSet() {
  try {
    return !!document.documentElement && document.documentElement.hasAttribute(MARK);
  } catch (e) {
    return false;
  }
}

function toPayload(code) {
  try {
    var tt = window.trustedTypes;
    if (tt && typeof tt.createPolicy === 'function') {
      if (!policy) policy = tt.createPolicy('flimmerfrei-loader', { createScript: function (x) { return x; } });
      return policy.createScript(code);
    }
  } catch (e) {
    /* ohne Richtlinie: Zeichenkette versuchen */
  }
  return code;
}

function tryPage(nonce) {
  try {
    var code = '(' + CORE.toString() + ')();';
    var s = document.createElement('script');
    if (nonce) {
      s.nonce = nonce;
      s.setAttribute('nonce', nonce);
    }
    s.textContent = toPayload(code);
    var parent = document.head || document.documentElement;
    parent.appendChild(s);
    if (s.parentNode) s.parentNode.removeChild(s);
  } catch (e) {
    /* Marke entscheidet */
  }
  return markSet();
}

function findNonce() {
  try {
    var el = document.querySelector('script[nonce]');
    if (el) return el.nonce || el.getAttribute('nonce') || '';
  } catch (e) {
    /* ignorieren */
  }
  return '';
}

function attempt(nonce) {
  if (done) return;
  done = true;
  try {
    if (observer) observer.disconnect();
  } catch (e) {
    /* ignorieren */
  }
  if (!tryPage(nonce)) {
    // Rückfall: eingeschränkter Modus im Kontext des Userscripts
    try {
      window.__FLIMMERFREI_CONFIG__ = { limited: true };
      CORE();
    } catch (e) {
      /* Seite nie brechen */
    }
  }
}

function start() {
  if (!isYtHost(window.location && window.location.hostname)) return;
  var nonce = findNonce();
  if (nonce || document.readyState === 'interactive' || document.readyState === 'complete') {
    attempt(nonce);
    return;
  }
  // Noch kein Skript mit Nonce da: auf das erste warten, spätestens bis DOMContentLoaded
  try {
    if (typeof MutationObserver === 'function') {
      observer = new MutationObserver(function () {
        var n = findNonce();
        if (n) attempt(n);
      });
      observer.observe(document, { childList: true, subtree: true });
    }
  } catch (e) {
    /* nur DOMContentLoaded */
  }
  document.addEventListener('DOMContentLoaded', function () {
    attempt(findNonce());
  });
}

try {
  start();
} catch (e) {
  /* Seite nie brechen */
}
`;

// Userscript-Rumpf: Kern als Funktion CORE plus Lader.
export function wrapUserscript(body) {
  return "(function () {\n'use strict';\nvar CORE = function () {\n'use strict';\n" + body + '\n};\n' + LOADER_SRC + '\n})();\n';
}

export function build() {
  const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
  const version = pkg.version;
  const sources = {};
  for (const name of MODULES) sources[name] = readFileSync(join(here, 'src', name + '.js'), 'utf8');
  const body = bundleModules(sources, version);
  const inject = wrapIife(body);
  const userBody = wrapUserscript(body);
  // Syntaxprüfung (ohne Ausführen)
  new vm.Script(inject, { filename: 'flimmerfrei.inject.js' });
  if (/^\s*(import|export)\s/m.test(inject)) throw new Error('import/export im Ergebnis');
  const user = userscriptHeader(version) + '\n' + userBody;
  new vm.Script(user, { filename: 'flimmerfrei.user.js' });
  const dist = join(here, 'dist');
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, 'flimmerfrei.inject.js'), inject, 'utf8');
  writeFileSync(join(dist, 'flimmerfrei.user.js'), user, 'utf8');
  return { version, injectBytes: Buffer.byteLength(inject), userBytes: Buffer.byteLength(user) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const r = build();
    console.log('Gebaut: Version ' + r.version + ', inject ' + r.injectBytes + ' Bytes, user ' + r.userBytes + ' Bytes');
  } catch (e) {
    console.error('Bau fehlgeschlagen: ' + (e && e.message ? e.message : e));
    process.exit(1);
  }
}
