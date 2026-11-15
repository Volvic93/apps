// Baut dist/flimmerfrei.inject.js (ein IIFE) und dist/flimmerfrei.user.js. Keine Abhängigkeiten.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));

// Feste Reihenfolge: Abhängigkeiten zuerst.
export const MODULES = ['config', 'adblock', 'background', 'pip', 'bridge', 'look', 'index'];

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
    '// @inject-into  page',
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

export function build() {
  const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
  const version = pkg.version;
  const sources = {};
  for (const name of MODULES) sources[name] = readFileSync(join(here, 'src', name + '.js'), 'utf8');
  const inject = wrapIife(bundleModules(sources, version));
  // Syntaxprüfung (ohne Ausführen)
  new vm.Script(inject, { filename: 'flimmerfrei.inject.js' });
  if (/^\s*(import|export)\s/m.test(inject)) throw new Error('import/export im Ergebnis');
  const user = userscriptHeader(version) + '\n' + inject;
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
