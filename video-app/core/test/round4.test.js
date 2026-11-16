import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { createConfigStore, normalizeConfig, resolveAirplayMode, hideManagedMediaSource, AIRPLAY_KEY } from '../src/config.js';
import { buildReloadUrl } from '../src/bridge.js';
import { prepareVideo } from '../src/pip.js';
import { createAdState, addBlocked, skipAdStep, createSkipMemo } from '../src/adblock.js';
import { buildDiagnostics, createDiagState, recordLoadStart, recordPlaying, formatSeconds, sourceKind } from '../src/diag.js';
import { installLook, LONG_PRESS_MS } from '../src/look.js';
import { el, makeDoc } from './helpers/fakedom.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let inject = '';
before(() => {
  execFileSync(process.execPath, [join(root, 'build.mjs')], { cwd: root, stdio: 'pipe' });
  inject = readFileSync(join(root, 'dist', 'flimmerfrei.inject.js'), 'utf8');
});

// ---- reine Funktionen ----

test('Einstellungen: limited und airplayMode (Standard false), nicht im Betrieb umschaltbar', () => {
  const d = normalizeConfig(undefined);
  assert.equal(d.limited, false);
  assert.equal(d.airplayMode, false);
  assert.equal(normalizeConfig({ limited: true, airplayMode: true }).limited, true);
  const store = createConfigStore({ airplayMode: true, limited: true });
  store.set({ airplayMode: false, limited: false, look: false });
  assert.equal(store.get().airplayMode, true);
  assert.equal(store.get().limited, true);
  assert.equal(store.get().look, false);
});

test('resolveAirplayMode: Hülle oder gemerkter Schalter (nur Userscript)', () => {
  const ls = (v) => ({ localStorage: { getItem: (k) => (k === AIRPLAY_KEY ? v : null) } });
  assert.equal(resolveAirplayMode({ airplayMode: true, host: 'ios' }, {}), true);
  assert.equal(resolveAirplayMode({}, ls('1')), true);
  assert.equal(resolveAirplayMode({ host: 'userscript' }, ls('1')), true);
  assert.equal(resolveAirplayMode({}, ls(null)), false);
  assert.equal(resolveAirplayMode({ host: 'ios' }, ls('1')), false);
  assert.equal(resolveAirplayMode(undefined, { localStorage: { getItem() { throw new Error('x'); } } }), false);
  assert.equal(resolveAirplayMode({}, {}), false);
});

test('hideManagedMediaSource: löscht beide, Rückfall defineProperty', () => {
  const win = { ManagedMediaSource: function () {}, ManagedSourceBuffer: function () {} };
  assert.equal(hideManagedMediaSource(win), true);
  assert.equal('ManagedMediaSource' in win, false);
  assert.equal('ManagedSourceBuffer' in win, false);
  assert.equal(hideManagedMediaSource({}), false);
  // nicht löschbar, aber überschreibbar? (hier: Accessor ohne configurable -> bleibt, wirft nicht)
  const w2 = {};
  Object.defineProperty(w2, 'ManagedMediaSource', { value: 1, configurable: false });
  assert.doesNotThrow(() => hideManagedMediaSource(w2));
});

test('buildReloadUrl: t=<Sekunden>s bei /watch, sonst unverändert', () => {
  assert.equal(buildReloadUrl('https://m.youtube.com/watch?v=abc&list=L', 42.9), 'https://m.youtube.com/watch?v=abc&list=L&t=42s');
  assert.equal(buildReloadUrl('https://m.youtube.com/watch?v=abc&t=5s&list=L#x', 7), 'https://m.youtube.com/watch?v=abc&list=L&t=7s#x');
  assert.equal(buildReloadUrl('https://m.youtube.com/watch?v=abc&t=5s', 0), 'https://m.youtube.com/watch?v=abc');
  assert.equal(buildReloadUrl('https://m.youtube.com/', 10), 'https://m.youtube.com/');
  assert.equal(buildReloadUrl('https://m.youtube.com/shorts/xyz', 10), 'https://m.youtube.com/shorts/xyz');
});

function fakeVideo() {
  const attrs = { disablepictureinpicture: '', disableremoteplayback: '' };
  return {
    attrs,
    hasAttribute: (k) => k in attrs,
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    setAttribute: (k, v) => { attrs[k] = v; },
    removeAttribute: (k) => { delete attrs[k]; },
    disableRemotePlayback: true,
  };
}

test('prepareVideo: Standard fasst disableremoteplayback/x-webkit-airplay NICHT an', () => {
  const v = fakeVideo();
  prepareVideo(v, () => true);
  assert.equal('disablepictureinpicture' in v.attrs, false);
  assert.equal(v.attrs.playsinline, '');
  assert.equal('disableremoteplayback' in v.attrs, true);
  assert.equal(v.disableRemotePlayback, true);
  assert.equal('x-webkit-airplay' in v.attrs, false);
  assert.equal('webkit-playsinline' in v.attrs, false);
});

test('prepareVideo: im AirPlay-Modus altes Verhalten', () => {
  const v = fakeVideo();
  prepareVideo(v, () => true, true);
  assert.equal('disableremoteplayback' in v.attrs, false);
  assert.equal(v.disableRemotePlayback, false);
  assert.equal(v.attrs['x-webkit-airplay'], 'allow');
});

test('Zähler getrennt, Summe bleibt adsBlocked', () => {
  const s = createAdState();
  addBlocked(s, 3);
  addBlocked(s, 2, 'skip');
  assert.deepEqual([s.adsBlocked, s.dataRemoved, s.adsSkipped], [5, 3, 2]);
});

test('Notausgang: playbackRate 16 während Werbung, danach zurück', () => {
  const vid = { muted: false, duration: 30, currentTime: 1, playbackRate: 1.5 };
  const player = { querySelector: (s) => (s === 'video' ? vid : null) };
  let showing = true;
  const doc = { querySelector: () => (showing ? player : null) };
  const memo = createSkipMemo();
  skipAdStep(doc, memo);
  assert.equal(vid.playbackRate, 16);
  assert.equal(vid.muted, true);
  showing = false;
  skipAdStep(doc, memo);
  assert.equal(vid.playbackRate, 1.5);
  assert.equal(vid.muted, false);
});

test('Diagnose: Videostarts (letzte 5, Werbung ausgenommen) und Bericht', () => {
  const d = createDiagState();
  const mk = () => ({});
  const vids = [];
  for (let i = 0; i < 7; i++) {
    const v = mk();
    vids.push(v);
    recordLoadStart(d, v, 1000, false);
    assert.equal(recordPlaying(d, v, 1000 + 400 + i * 100, false), true);
  }
  assert.equal(d.starts.length, 5);
  assert.deepEqual(d.starts, [600, 700, 800, 900, 1000]);
  const ad = mk();
  recordLoadStart(d, ad, 0, true);
  assert.equal(recordPlaying(d, ad, 5000, false), false);
  const ad2 = mk();
  recordLoadStart(d, ad2, 0, false);
  assert.equal(recordPlaying(d, ad2, 5000, true), false);
  assert.equal(recordPlaying(d, mk(), 1, false), false);
  assert.equal(d.starts.length, 5);
  assert.equal(formatSeconds(6200), '6,2 s');
  assert.equal(formatSeconds(400), '0,4 s');
  assert.equal(sourceKind({ currentSrc: 'blob:x' }), 'blob');
  assert.equal(sourceKind({ src: 'https://x' }), 'https');
  assert.equal(sourceKind({}), 'leer');

  const text = buildDiagnostics({
    version: '0.1.4', limited: true, host: 'userscript', dataRemoved: 4, skipped: 2, mms: 'verborgen (AirPlay-Modus)', airplayMode: true,
    background: true, pipFix: false, look: true, starts: [400, 6200, 500], video: { disableRemotePlayback: 'true', source: 'blob' }, path: '/watch',
  });
  for (const line of [
    'Flimmerfrei 0.1.4',
    'Modus: eingeschränkt (Skript-Kontext)',
    'Hülle: userscript',
    'Werbung aus Daten entfernt: 4',
    'Laufende Werbung übersprungen: 2',
    'ManagedMediaSource: verborgen (AirPlay-Modus)',
    'AirPlay-Modus: an',
    'Hintergrund: an · Bild-in-Bild-Hilfe: aus · Aussehen: an',
    'Letzte Videostarts: 0,4 s · 6,2 s · 0,5 s',
    'Video: disableRemotePlayback=true, Quelle: blob',
    'Adresse: /watch',
  ]) assert.ok(text.split('\n').includes(line), line);
  assert.ok(buildDiagnostics({ version: 'x', starts: [], video: null }).includes('Letzte Videostarts: keine'));
});

// ---- Langer Druck ----

function pageWithPlayer() {
  const { doc, root: r } = makeDoc();
  const pbox = el('div', 'player-controls-top', []);
  r.appendChild(el('player-top-controls', '', [pbox]));
  const timers = [];
  const win = {
    innerWidth: 400, innerHeight: 800, location: { href: 'https://m.youtube.com/' },
    HTMLVideoElement: { prototype: { webkitShowPlaybackTargetPicker() {} } },
    setTimeout: (f, ms) => { timers.push({ f, ms, live: true }); return timers.length; },
    clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].live = false; },
    setInterval: () => 0, addEventListener() {},
  };
  return { doc, pbox, win, timers };
}
const fire = (timers) => timers.filter((t) => t.live).forEach((t) => { t.live = false; t.f(); });

test('Langer Druck: >= 700 ms löst eigene Aktion aus, danach kein Klick; kurzer Druck normal', () => {
  const p = pageWithPlayer();
  const calls = [];
  installLook(p.win, p.doc, createConfigStore({ host: 'userscript' }), {
    pip: () => calls.push('pip'), airplay: () => calls.push('air'), diagnostics: () => calls.push('diag'), airplayOff: () => calls.push('off'),
  });
  const [pipBtn, airBtn] = p.pbox.querySelectorAll('.flimmerfrei-player-button');
  assert.equal(LONG_PRESS_MS, 700);

  // kurzer Druck
  pipBtn.dispatch('touchstart'); pipBtn.dispatch('pointerdown');
  assert.equal(p.timers.filter((t) => t.live).length, 1, 'nur ein Zeitgeber trotz zweier Startereignisse');
  assert.equal(p.timers.find((t) => t.live).ms, 700);
  pipBtn.dispatch('touchend'); pipBtn.dispatch('pointerup'); pipBtn.dispatch('click');
  assert.deepEqual(calls, ['pip']);
  assert.equal(p.timers.filter((t) => t.live).length, 0);

  // langer Druck Bild-in-Bild -> Diagnose, kein Klick
  pipBtn.dispatch('touchstart');
  fire(p.timers);
  pipBtn.dispatch('touchend'); pipBtn.dispatch('click');
  assert.deepEqual(calls, ['pip', 'diag']);

  // langer Druck AirPlay -> ausschalten, kein Klick
  airBtn.dispatch('pointerdown');
  fire(p.timers);
  airBtn.dispatch('pointerup'); airBtn.dispatch('click');
  assert.deepEqual(calls, ['pip', 'diag', 'off']);

  // nächster normaler Klick funktioniert wieder
  airBtn.dispatch('click');
  assert.deepEqual(calls, ['pip', 'diag', 'off', 'air']);

  // langer Druck ohne folgenden Klick blockiert den nächsten Druck nicht
  pipBtn.dispatch('pointerdown');
  fire(p.timers);
  pipBtn.dispatch('pointerdown'); pipBtn.dispatch('pointerup'); pipBtn.dispatch('click');
  assert.equal(calls[calls.length - 1], 'pip');
});

// ---- Gebautes Skript im vm ----

function runBuilt(opts) {
  const o = Object.assign({ config: {}, host: 'm.youtube.com', mms: true, storage: {}, video: null, confirmAnswer: true }, opts);
  const log = { seenMmsAtFirstDocAccess: undefined, intervals: [], assigned: [], confirms: [], alerts: [], posted: [] };
  const store = Object.assign({}, o.storage);
  const attrs = {};
  const doc = {
    title: 'T - YouTube',
    readyState: 'loading',
    head: null,
    createElement: () => ({ setAttribute() {}, textContent: '' }),
    querySelector: () => null,
    querySelectorAll: (s) => (s === 'video' && o.video ? [o.video] : []),
    addEventListener() {},
  };
  const sandbox = { document: doc, setTimeout: () => 0, setInterval: (f, ms) => { log.intervals.push(ms); return 0; } };
  const ctx = vm.createContext(sandbox);
  const win = vm.runInContext('globalThis', ctx);
  win.window = win;
  win.innerWidth = 400;
  win.innerHeight = 800;
  win.location = { href: 'https://' + o.host + '/watch?v=abc&t=5s', hostname: o.host, pathname: '/watch', assign: (u) => log.assigned.push(u) };
  win.addEventListener = () => {};
  win.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  win.confirm = (m) => { log.confirms.push(m); return o.confirmAnswer; };
  win.alert = (m) => { log.alerts.push(m); };
  win.__FLIMMERFREI_CONFIG__ = o.config;
  win.webkit = { messageHandlers: { flimmerfrei: { postMessage: (m) => log.posted.push(m) } } };
  if (o.mms) {
    win.ManagedMediaSource = function ManagedMediaSource() {};
    win.ManagedSourceBuffer = function ManagedSourceBuffer() {};
  }
  Object.defineProperty(doc, 'documentElement', {
    configurable: true,
    get() {
      if (log.seenMmsAtFirstDocAccess === undefined) log.seenMmsAtFirstDocAccess = typeof win.ManagedMediaSource;
      return { setAttribute: (k, v) => { attrs[k] = v; }, hasAttribute: (k) => k in attrs, appendChild() {} };
    },
  });
  vm.runInContext(inject, ctx);
  return { ctx, win, log, store };
}

const aVideo = () => ({ paused: false, ended: false, currentSrc: 'blob:x', currentTime: 42.7, disableRemotePlayback: true, getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100 }) });

test('Standard: ManagedMediaSource bleibt, AirPlay-Modus aus, Takt 150 ms', () => {
  const r = runBuilt({});
  assert.equal(typeof r.win.ManagedMediaSource, 'function');
  assert.equal(r.win.__flimmerfrei.state().airplayMode, false);
  assert.ok(r.log.intervals.includes(150));
  assert.equal(r.log.intervals.includes(400), false);
  const d = r.win.__flimmerfrei.diagnostics();
  assert.ok(d.includes('ManagedMediaSource: vorhanden'));
  assert.ok(d.includes('AirPlay-Modus: aus'));
  assert.ok(d.includes('Modus: Seite (voll)'));
  assert.ok(d.includes('Hülle: userscript'));
  assert.ok(d.includes('Adresse: /watch'));
  assert.equal(runBuilt({ mms: false }).win.__flimmerfrei.diagnostics().includes('ManagedMediaSource: nicht vorhanden'), true);
});

test('AirPlay-Modus (Hülle): ManagedMediaSource als ALLERERSTES verborgen, state/diagnostics melden ihn', () => {
  const r = runBuilt({ config: { host: 'ios', airplayMode: true } });
  assert.equal(r.log.seenMmsAtFirstDocAccess, 'undefined');
  assert.equal(typeof r.win.ManagedMediaSource, 'undefined');
  assert.equal(typeof r.win.ManagedSourceBuffer, 'undefined');
  assert.equal(r.win.__flimmerfrei.state().airplayMode, true);
  assert.ok(r.win.__flimmerfrei.diagnostics().includes('ManagedMediaSource: verborgen (AirPlay-Modus)'));
  // im Betrieb nicht abschaltbar
  r.win.__flimmerfrei.setConfig({ airplayMode: false });
  assert.equal(r.win.__flimmerfrei.state().airplayMode, true);
});

test('AirPlay-Modus (Userscript): aus localStorage', () => {
  const r = runBuilt({ storage: { 'flimmerfrei.airplayMode': '1' } });
  assert.equal(typeof r.win.ManagedMediaSource, 'undefined');
  assert.equal(r.win.__flimmerfrei.state().airplayMode, true);
  const ios = runBuilt({ config: { host: 'ios' }, storage: { 'flimmerfrei.airplayMode': '1' } });
  assert.equal(typeof ios.win.ManagedMediaSource, 'function');
});

test('airplay() ohne Modus: iOS meldet needAirplayMode und gibt false', () => {
  const r = runBuilt({ config: { host: 'ios' }, video: aVideo() });
  assert.equal(r.win.__flimmerfrei.airplay(), false);
  assert.ok(r.log.posted.some((m) => m.type === 'needAirplayMode'));
  assert.equal(r.log.confirms.length, 0);
});

test('airplay() ohne Modus: Userscript fragt, merkt Schalter und lädt an der Stelle neu', () => {
  const r = runBuilt({ video: aVideo() });
  assert.equal(r.win.__flimmerfrei.airplay(), false);
  assert.equal(r.log.confirms.length, 1);
  assert.ok(r.log.confirms[0].startsWith('AirPlay braucht den AirPlay-Modus'));
  assert.equal(r.store['flimmerfrei.airplayMode'], '1');
  assert.deepEqual(r.log.assigned, ['https://m.youtube.com/watch?v=abc&t=42s']);
  assert.equal(r.log.posted.some((m) => m.type === 'needAirplayMode'), false);

  const no = runBuilt({ video: aVideo(), confirmAnswer: false });
  no.win.__flimmerfrei.airplay();
  assert.equal(no.log.assigned.length, 0);
  assert.equal('flimmerfrei.airplayMode' in no.store, false);
});

test('airplay() mit Modus: Auswahl wird geöffnet', () => {
  let opened = 0;
  const v = Object.assign(aVideo(), { webkitShowPlaybackTargetPicker() { opened++; } });
  const r = runBuilt({ config: { host: 'ios', airplayMode: true }, video: v });
  assert.equal(r.win.__flimmerfrei.airplay(), true);
  assert.equal(opened, 1);
  assert.equal(r.log.posted.some((m) => m.type === 'needAirplayMode'), false);
});

test('Diagnose zeigt Video-Zeile; limited aus Konfiguration', () => {
  const r = runBuilt({ video: aVideo(), config: { limited: true } });
  const d = r.win.__flimmerfrei.diagnostics();
  assert.ok(d.includes('Video: disableRemotePlayback=true, Quelle: blob'));
  assert.ok(d.includes('Modus: eingeschränkt (Skript-Kontext)'));
});
