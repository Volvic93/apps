import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { createAdState, installTimeoutHook, shouldShortenTimeout } from '../src/adblock.js';
import { captionsStep, createCaptionsState, installCaptions, isCaptionsControl, CAPTIONS_KEY } from '../src/captions.js';
import { createPlaybackMemory, decideResume } from '../src/background.js';
import { buildDiagnostics } from '../src/diag.js';
import { createConfigStore, normalizeConfig } from '../src/config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let inject = '';
before(() => {
  execFileSync(process.execPath, [join(root, 'build.mjs')], { cwd: root, stdio: 'pipe' });
  inject = readFileSync(join(root, 'dist', 'flimmerfrei.inject.js'), 'utf8');
});

// ---- 1. Wartezeit ----

function timeoutWin() {
  const calls = [];
  const win = {
    setTimeout: function (cb, delay, ...rest) {
      calls.push({ cb, delay, rest, self: this });
      return 77;
    },
  };
  return { win, calls };
}

test('Wartezeit: 17000 ms mit nativem Rückruf wird verkürzt', () => {
  const { win, calls } = timeoutWin();
  const st = createAdState();
  assert.equal(installTimeoutHook(win, () => true, st), true);
  assert.equal(win.setTimeout(Math.max, 17000), 77);
  assert.equal(calls[0].delay, 17);
  assert.equal(st.delaysShortened, 1);
});

test('Wartezeit: 17000 mit normalem Rückruf, 5000 mit nativem Rückruf: unverändert', () => {
  const { win, calls } = timeoutWin();
  const st = createAdState();
  installTimeoutHook(win, () => true, st);
  win.setTimeout(function () { return 1; }, 17000);
  win.setTimeout(() => 2, 17000);
  win.setTimeout(Math.max, 5000);
  win.setTimeout('text', 17000);
  assert.deepEqual(calls.map((c) => c.delay), [17000, 17000, 5000, 17000]);
  assert.equal(st.delaysShortened, 0);
});

test('Wartezeit: Rückruf mit resolve(1) wird verkürzt (mindestens 1 ms), sonst unverändert', () => {
  const { win, calls } = timeoutWin();
  const st = createAdState();
  installTimeoutHook(win, () => true, st);
  let resolve = () => {};
  win.setTimeout(() => { resolve(1); }, 3000);
  win.setTimeout(function () { resolve(1); }, 1);
  win.setTimeout(() => { resolve(2); }, 3000);
  win.setTimeout(() => { resolve(1); }, 0);
  assert.deepEqual(calls.map((c) => c.delay), [3, 1, 3000, 0]);
  assert.equal(st.delaysShortened, 1);
  assert.equal(shouldShortenTimeout(() => { resolve(1); }, 1500), true);
  assert.equal(shouldShortenTimeout(() => { resolve(1); }, undefined), false);
});

test('Wartezeit: this, weitere Argumente und Rückgabewert bleiben; aus = nichts; nativ aussehend', () => {
  const { win, calls } = timeoutWin();
  let on = true;
  installTimeoutHook(win, () => on, createAdState());
  const r = win.setTimeout(Math.max, 17000, 'a', 'b');
  assert.equal(r, 77);
  assert.deepEqual(calls[0].rest, ['a', 'b']);
  assert.equal(calls[0].self, win);
  assert.match(String(win.setTimeout), /\[native code\]/);
  on = false;
  win.setTimeout(Math.max, 17000);
  assert.equal(calls[1].delay, 17000);
});

test('Wartezeit: wirft die Prüfung, wird unverändert durchgereicht', () => {
  const { win, calls } = timeoutWin();
  const st = createAdState();
  installTimeoutHook(win, () => { throw new Error('kaputt'); }, st);
  assert.equal(win.setTimeout(Math.max, 17000), 77);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].delay, 17000);
  assert.equal(st.delaysShortened, 0);
  assert.equal(installTimeoutHook({}, () => true, st), false);
});

test('Gebautes Skript enthält resolve(1) nicht im Klartext (eigene Zeitgeber nie betroffen)', () => {
  assert.equal(inject.includes('resolve(1)'), false);
});

// ---- 2. Untertitel ----

function fakePlayer(on) {
  const p = { on, toggles: 0, isSubtitlesOn() { return this.on; }, toggleSubtitles() { this.on = !this.on; this.toggles++; } };
  return p;
}

test('captionsStep: einmal je Video ausschalten, keine Methode = nichts', () => {
  const st = createCaptionsState();
  const p = fakePlayer(true);
  assert.equal(captionsStep(p, st, 'a'), 'turned-off');
  assert.equal(p.on, false);
  assert.equal(captionsStep(p, st, 'a'), 'done');
  p.on = true; // YouTube schaltet nach dem Laden wieder ein: selbes Video, nicht noch einmal
  assert.equal(captionsStep(p, st, 'a'), 'done');
  assert.equal(p.toggles, 1);
  assert.equal(captionsStep(p, st, 'b'), 'turned-off');
  assert.equal(st.turnedOff, 2);
  assert.equal(captionsStep(fakePlayer(false), st, 'c'), 'already-off');
  assert.equal(captionsStep({}, st, 'd'), 'none');
  assert.equal(captionsStep(null, st, 'd'), 'none');
  assert.equal(captionsStep(p, st, ''), 'no-video');
  st.wanted = true;
  assert.equal(captionsStep(p, st, 'e'), 'wanted');
});

test('isCaptionsControl', () => {
  const node = (o, parent) => Object.assign({ tagName: 'DIV', className: '', parentNode: parent || null, getAttribute: () => null, textContent: '' }, o);
  assert.equal(isCaptionsControl(node({ tagName: 'YT-CLOSED-CAPTIONS-TOGGLE-BUTTON' })), true);
  assert.equal(isCaptionsControl(node({ className: 'x ytp-subtitles-button y' })), true);
  assert.equal(isCaptionsControl(node({}, node({ className: 'ytp-subtitles-button' }))), true);
  assert.equal(isCaptionsControl(node({ tagName: 'BUTTON', textContent: 'Untertitel' })), true);
  assert.equal(isCaptionsControl(node({ tagName: 'DIV', textContent: 'Untertitel', getAttribute: () => 'menuitem' })), true);
  assert.equal(isCaptionsControl(node({ tagName: 'BUTTON', textContent: 'Teilen' })), false);
  assert.equal(isCaptionsControl(node({ tagName: 'P', textContent: 'Untertitel' })), false);
  assert.equal(isCaptionsControl(null), false);
});

function captionsEnv(opts) {
  const o = Object.assign({ on: true, enabled: true, stored: null }, opts);
  const player = fakePlayer(o.on);
  const listeners = {};
  const doc = { querySelector: (s) => (s === '#movie_player' ? player : null), addEventListener: (t, f) => { (listeners[t] ||= []).push(f); } };
  const timers = [];
  const store = {};
  if (o.stored) store[CAPTIONS_KEY] = o.stored;
  const win = {
    location: { href: 'https://m.youtube.com/watch?v=a' },
    sessionStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    setTimeout: (f) => timers.push(f),
    setInterval: () => 0,
  };
  const st = createCaptionsState();
  const id = () => (/v=([^&]*)/.exec(win.location.href) || [])[1] || '';
  const h = installCaptions(win, doc, () => o.enabled, st, id);
  return { player, listeners, win, st, h, timers, store, setEnabled: (v) => { o.enabled = v; } };
}

test('Untertitel: je Video einmal aus; neues Video wieder; Nutzer schaltet von Hand ein -> Ruhe', () => {
  const e = captionsEnv({});
  e.h.tick();
  assert.equal(e.player.on, false);
  assert.equal(e.st.turnedOff, 1);
  e.player.on = true; // Seite schaltet wieder ein (gleiches Video): bleibt
  e.h.tick();
  assert.equal(e.player.toggles, 1);
  e.win.location.href = 'https://m.youtube.com/watch?v=b';
  e.h.tick();
  assert.equal(e.player.on, false);
  assert.equal(e.st.turnedOff, 2);

  // echter Klick auf die Untertitel-Taste, danach sind Untertitel an
  const target = { tagName: 'BUTTON', className: 'ytp-subtitles-button', parentNode: null, getAttribute: () => null };
  e.player.on = true;
  e.listeners.click.forEach((f) => f({ target, isTrusted: true }));
  e.timers.forEach((f) => f());
  assert.equal(e.st.wanted, true);
  assert.equal(e.store[CAPTIONS_KEY], '1');
  e.win.location.href = 'https://m.youtube.com/watch?v=c';
  e.h.tick();
  assert.equal(e.player.on, true, 'Automatik hält still');
  assert.equal(e.st.turnedOff, 2);
});

test('Untertitel: unechter Klick zählt nicht; Klick ohne eingeschaltete Untertitel auch nicht; aus; Sitzungsmerker', () => {
  const e = captionsEnv({});
  const target = { tagName: 'BUTTON', className: 'ytp-subtitles-button', parentNode: null, getAttribute: () => null };
  e.listeners.click.forEach((f) => f({ target, isTrusted: false }));
  assert.equal(e.timers.length, 0);
  e.player.on = false;
  e.listeners.click.forEach((f) => f({ target, isTrusted: true }));
  e.timers.forEach((f) => f());
  assert.equal(e.st.wanted, false);

  const off = captionsEnv({ enabled: false });
  off.h.tick();
  assert.equal(off.player.toggles, 0);
  off.setEnabled(true);
  off.h.tick();
  assert.equal(off.player.toggles, 1, 'per Einstellung im Betrieb schaltbar');

  const remembered = captionsEnv({ stored: '1' });
  remembered.h.tick();
  assert.equal(remembered.player.toggles, 0);
});

test('Untertitel: Fenster endet nach 3 s; Einstellung captionsOff (Standard an, schaltbar)', () => {
  assert.equal(normalizeConfig(undefined).captionsOff, true);
  const store = createConfigStore({});
  store.set({ captionsOff: false });
  assert.equal(store.get().captionsOff, false);
  const e = captionsEnv({ on: false });
  e.h.tick();
  assert.equal(e.player.toggles, 0);
  e.st.until = Date.now() - 1; // Fenster abgelaufen
  e.player.on = true;
  e.h.tick();
  assert.equal(e.player.toggles, 0);
});

// ---- 3. Fortsetzen im Hintergrund ----

function memEnv(over) {
  const s = Object.assign({ t: 100000, enabled: true, hidden: true, user: 99999 }, over);
  const mem = createPlaybackMemory({ now: () => s.t, isEnabled: () => s.enabled, isRealHidden: () => s.hidden, sinceUser: () => s.user });
  const played = [];
  const video = { paused: false, ended: false, isConnected: true };
  return { s, mem, video, play: (v) => played.push(v), played };
}

test('resumeAfterBackground: alle Zweige', () => {
  let e = memEnv();
  assert.equal(e.mem.resume(e.play), 'no-video');

  e = memEnv();
  e.mem.onPlaying(e.video);
  assert.equal(e.mem.resume(e.play), 'not-paused');

  e = memEnv();
  e.mem.onPlaying(e.video);
  e.s.t += 2000;
  e.video.paused = true;
  e.mem.onPause(e.video);
  assert.equal(e.mem.resume(e.play), 'resumed');
  assert.deepEqual(e.played, [e.video]);
  assert.equal(e.mem.resume(e.play), 'resumed', 'mehrfach kurz hintereinander erlaubt');

  e = memEnv();
  e.mem.onPlaying(e.video);
  e.video.paused = true;
  e.video.ended = true;
  assert.equal(e.mem.resume(e.play), 'ended');

  e = memEnv({ user: 300 });
  e.mem.onPlaying(e.video);
  e.video.paused = true;
  e.mem.onPause(e.video);
  assert.equal(e.mem.resume(e.play), 'user-pause');
  assert.equal(e.played.length, 0);

  e = memEnv();
  e.mem.onPlaying(e.video);
  e.s.t += 10001;
  e.video.paused = true;
  assert.equal(e.mem.resume(e.play), 'stale');

  e = memEnv({ enabled: false });
  e.mem.onPlaying(e.video);
  e.video.paused = true;
  assert.equal(e.mem.resume(e.play), 'off');

  e = memEnv();
  e.mem.onPlaying(e.video);
  e.video.paused = true;
  e.video.isConnected = false;
  assert.equal(e.mem.resume(e.play), 'no-video');
});

test('Wiedergabe-Gedächtnis: timeupdate gedrosselt, Zähler, Pausen im Hintergrund', () => {
  const e = memEnv();
  e.mem.onTimeUpdate(e.video); // setzt das Video, wenn noch keines gemerkt ist
  e.s.t += 500;
  e.mem.onTimeUpdate(e.video);
  e.s.t += 600;
  e.mem.onTimeUpdate(e.video);
  e.s.t += 9000; // seit letztem timeupdate 9 s
  e.video.paused = true;
  e.mem.onPause(e.video); // ohne Nutzer, Seite verborgen
  assert.equal(e.mem.stats().hiddenPauses, 1);
  assert.equal(e.mem.resume(e.play), 'resumed');
  const st = e.mem.stats();
  assert.deepEqual([st.attempts, st.last], [1, 'resumed']);
  assert.equal(decideResume({ enabled: true, video: null }), 'no-video');
  // Nutzer-Pause zählt nicht als Pause ohne Nutzeraktion
  const u = memEnv({ user: 10 });
  u.mem.onPlaying(u.video);
  u.video.paused = true;
  u.mem.onPause(u.video);
  assert.equal(u.mem.stats().hiddenPauses, 0);
  // fremdes Video wird ignoriert
  u.mem.onPause({});
  assert.equal(u.mem.stats().hiddenPauses, 0);
});

// ---- 4. Diagnose ----

test('Diagnose: neue Zeilen', () => {
  const text = buildDiagnostics({ version: 'x', starts: [], video: null, delaysShortened: 3, captionsAuto: true, captionsTurnedOff: 2, resumeAttempts: 4, resumeLast: 'resumed', hiddenPauses: 5 }).split('\n');
  for (const l of ['Wartezeiten verkürzt: 3', 'Untertitel-Automatik: an (2-mal ausgeschaltet)', 'Fortsetzen im Hintergrund: 4 Versuche, zuletzt: resumed', 'Pausen ohne Nutzeraktion (verborgen): 5']) assert.ok(text.includes(l), l);
  const d = buildDiagnostics({ version: 'x', starts: [], video: null }).split('\n');
  assert.ok(d.includes('Untertitel-Automatik: aus (0-mal ausgeschaltet)'));
  assert.ok(d.includes('Fortsetzen im Hintergrund: 0 Versuche, zuletzt: –'));
});

// ---- Gebautes Skript ----

function runBuilt(config) {
  const log = { delays: [] };
  const doc = { title: '', readyState: 'loading', head: null, documentElement: { setAttribute() {}, hasAttribute: () => false, appendChild() {} }, createElement: () => ({ setAttribute() {}, textContent: '' }), querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  const ctx = vm.createContext({ document: doc, setTimeout: (f, ms) => { log.delays.push(ms); return 1; }, setInterval: () => 0 });
  const win = vm.runInContext('globalThis', ctx);
  win.window = win;
  win.innerWidth = 400;
  win.innerHeight = 800;
  win.location = { href: 'https://m.youtube.com/', hostname: 'm.youtube.com', pathname: '/' };
  win.addEventListener = () => {};
  win.__FLIMMERFREI_CONFIG__ = config || {};
  vm.runInContext(inject, ctx);
  return { win, ctx, log };
}

test('Gebaut: setTimeout-Einhängung wirkt, Diagnose zählt, resumeAfterBackground ohne Video', () => {
  const r = runBuilt({ host: 'ios' });
  const before = r.log.delays.length;
  r.win.setTimeout(vm.runInContext('Math.max', r.ctx), 17000);
  assert.equal(r.log.delays[before], 17);
  r.win.setTimeout(vm.runInContext('Math.max', r.ctx), 5000);
  assert.equal(r.log.delays[before + 1], 5000);
  assert.equal(r.win.__flimmerfrei.resumeAfterBackground(), 'no-video');
  assert.equal(r.win.__flimmerfrei.resumeAfterBackground(), 'no-video');
  const d = r.win.__flimmerfrei.diagnostics().split('\n');
  assert.ok(d.includes('Wartezeiten verkürzt: 1'));
  assert.ok(d.includes('Fortsetzen im Hintergrund: 2 Versuche, zuletzt: no-video'));
  assert.ok(d.includes('Untertitel-Automatik: an (0-mal ausgeschaltet)'));
  assert.ok(d.includes('Pausen ohne Nutzeraktion (verborgen): 0'));
  r.win.__flimmerfrei.setConfig({ background: false });
  assert.equal(r.win.__flimmerfrei.resumeAfterBackground(), 'off');
  r.win.__flimmerfrei.setConfig({ adblock: false, captionsOff: false });
  r.win.setTimeout(vm.runInContext('Math.max', r.ctx), 17000);
  assert.equal(r.log.delays[r.log.delays.length - 1], 17000);
});

test('Gebaut: adblock aus (Konfiguration) -> keine Verkürzung; captionsOff aus -> Automatik aus', () => {
  const r = runBuilt({ adblock: false, captionsOff: false });
  r.win.setTimeout(vm.runInContext('Math.max', r.ctx), 17000);
  assert.equal(r.log.delays[r.log.delays.length - 1], 17000);
  assert.ok(r.win.__flimmerfrei.diagnostics().split('\n').includes('Untertitel-Automatik: aus (0-mal ausgeschaltet)'));
});
