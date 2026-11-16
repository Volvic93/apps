import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const injectPath = join(root, 'dist', 'flimmerfrei.inject.js');
const userPath = join(root, 'dist', 'flimmerfrei.user.js');

before(() => {
  execFileSync(process.execPath, [join(root, 'build.mjs')], { cwd: root, stdio: 'pipe' });
});

test('Bau: syntaktisch gültig (node --check), ohne import/export, ein IIFE', () => {
  execFileSync(process.execPath, ['--check', injectPath]);
  execFileSync(process.execPath, ['--check', userPath]);
  const code = readFileSync(injectPath, 'utf8');
  assert.ok(code.startsWith('(function () {'));
  assert.equal(/^\s*(import|export)\s/m.test(code), false);
  assert.ok(code.includes("const VERSION = '0.1.3';"));
});

test('Userscript: Kopf plus identischer Kern', () => {
  const user = readFileSync(userPath, 'utf8');
  const inject = readFileSync(injectPath, 'utf8');
  assert.ok(user.startsWith('// ==UserScript=='));
  // Der Kern steckt unverändert als Funktion CORE im Userscript
  const body = inject.slice("(function () {\n'use strict';\n".length, inject.length - '\n})();\n'.length);
  assert.ok(user.includes(body));
  assert.ok(user.includes('var CORE = function () {'));
  assert.ok(user.indexOf('// ==/UserScript==') < user.indexOf('(function () {'));
  assert.ok(user.indexOf('var CORE') < user.indexOf('function tryPage'));
});

// Minimal nachgebaute Seite
function makeContext(config) {
  const listeners = [];
  const appended = [];
  const sandbox = {
    setTimeout: () => 0,
    setInterval: () => 0,
    console,
  };
  const ctx = vm.createContext(sandbox);
  const win = vm.runInContext('globalThis', ctx);
  win.window = win;
  win.innerWidth = 400;
  win.innerHeight = 800;
  win.location = { href: 'https://m.youtube.com/', hostname: 'm.youtube.com' };
  win.addEventListener = (t, f) => listeners.push(['win', t, f]);
  if (config) win.__FLIMMERFREI_CONFIG__ = config;
  win.document = {
    title: 'Start - YouTube',
    readyState: 'loading',
    head: null,
    documentElement: { appendChild: (n) => appended.push(n) },
    addEventListener: (t, f) => listeners.push(['doc', t, f]),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => { const a = {}; return { setAttribute(k, v) { a[k] = v; }, attrs: a, textContent: '' }; },
  };
  return { ctx, win, listeners, appended };
}

test('gebautes Skript: Objekt vorhanden, Hooks wirken, doppeltes Laden schadet nicht', () => {
  const code = readFileSync(injectPath, 'utf8');
  const { ctx, win, appended } = makeContext({ host: 'ios' });
  vm.runInContext(code, ctx);

  const api = win.__flimmerfrei;
  assert.ok(api);
  assert.equal(api.version, '0.1.3');
  for (const k of ['pip', 'airplay', 'state', 'setConfig', 'pause', 'diagnostics']) assert.equal(typeof api[k], 'function', k);

  const s = api.state();
  assert.deepEqual(Object.keys(s).sort(), ['adsBlocked', 'airplayMode', 'currentTime', 'hasVideo', 'listId', 'menuButton', 'pip', 'playing', 'title', 'url', 'videoId']);
  assert.equal(s.hasVideo, false);
  assert.equal(s.title, 'Start');
  assert.equal(api.pip(), false);
  assert.equal(api.airplay(), false);

  // JSON.parse bereinigt
  const out = vm.runInContext(`JSON.stringify(JSON.parse('{"a":1,"adPlacements":[1,2]}'))`, ctx);
  assert.equal(out, '{"a":1}');
  assert.equal(api.state().adsBlocked, 1);
  assert.match(vm.runInContext('String(JSON.parse)', ctx), /native code/);

  // Start-Daten-Setter
  vm.runInContext(`window.ytInitialPlayerResponse = { adSlots: [1], ok: 1 };`, ctx);
  assert.equal(vm.runInContext('JSON.stringify(window.ytInitialPlayerResponse)', ctx), '{"ok":1}');

  // Werbe-Stil eingehängt
  const adStyle = appended.find((n) => n.attrs['data-flimmerfrei'] === 'ads');
  const lookStyle = appended.find((n) => n.attrs['data-flimmerfrei'] === 'look');
  assert.ok(adStyle && lookStyle);
  assert.equal(appended.length, 2);
  assert.ok(adStyle.textContent.includes('ytd-ad-slot-renderer'));

  // Einstellungen im Betrieb
  api.setConfig({ adblock: false });
  assert.equal(adStyle.textContent, '');
  assert.equal(vm.runInContext(`JSON.stringify(JSON.parse('{"adPlacements":[1]}'))`, ctx), '{"adPlacements":[1]}');
  api.setConfig({ adblock: true });
  assert.ok(adStyle.textContent.length > 0);
  api.setConfig({ look: false });
  assert.equal(lookStyle.textContent, '');
  assert.equal(api.pause(), false);

  // doppeltes Ausführen
  const parseBefore = vm.runInContext('JSON.parse', ctx);
  const nodesBefore = appended.length;
  vm.runInContext(code, ctx);
  assert.equal(win.__flimmerfrei, api);
  assert.equal(vm.runInContext('JSON.parse', ctx), parseBefore);
  assert.equal(appended.length, nodesBefore);
  assert.equal(vm.runInContext(`JSON.stringify(JSON.parse('{"adPlacements":[1],"b":2}'))`, ctx), '{"b":2}');
});

test('gebautes Skript: bricht auch in einer kaputten Umgebung nichts (kein document-Zubehör)', () => {
  const code = readFileSync(injectPath, 'utf8');
  const sandbox = {};
  const ctx = vm.createContext(sandbox);
  const win = vm.runInContext('globalThis', ctx);
  win.window = win;
  win.location = { hostname: 'www.youtube.com', href: 'https://www.youtube.com/' };
  win.document = {};
  assert.doesNotThrow(() => vm.runInContext(code, ctx));
  assert.ok(win.__flimmerfrei);
  assert.equal(win.__flimmerfrei.version, '0.1.3');
  // Nutzung ohne Fehler
  assert.doesNotThrow(() => win.__flimmerfrei.state());
  assert.equal(win.__flimmerfrei.pip(), false);
});

test('gebautes Skript: ohne window/document (Node) passiert nichts', () => {
  const code = readFileSync(injectPath, 'utf8');
  const ctx = vm.createContext({});
  assert.doesNotThrow(() => vm.runInContext(code, ctx));
});

test('gebautes Skript: auf Google-Anmeldeseiten wird nichts eingehängt', () => {
  const code = readFileSync(injectPath, 'utf8');
  for (const host of ['accounts.google.com', 'accounts.youtube.com', 'consent.google.com', 'myaccount.google.com', 'youtube.com.evil.example', '']) {
    const { ctx, win } = makeContext();
    win.location.hostname = host;
    const parseBefore = vm.runInContext('JSON.parse', ctx);
    vm.runInContext(code, ctx);
    assert.equal(win.__flimmerfrei, undefined, host);
    assert.equal(vm.runInContext('JSON.parse', ctx), parseBefore, host);
    assert.equal('ytInitialData' in win, false, host);
  }
});
