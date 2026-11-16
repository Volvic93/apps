import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { formEncode, normalizeTvCode, buildBindUrl, buildCommandUrl, buildCommandForm, buildBindForm, parseBindResponse, createLounge, createCastController, CAST_STORAGE_KEY, castErrorText } from '../src/cast.js';
import { createCastSheet } from '../src/castui.js';
import { buildDiagnostics } from '../src/diag.js';
import { createConfigStore } from '../src/config.js';
import { installLook } from '../src/look.js';
import { el, makeDoc } from './helpers/fakedom.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let inject = '';
before(() => {
  execFileSync(process.execPath, [join(root, 'build.mjs')], { cwd: root, stdio: 'pipe' });
  inject = readFileSync(join(root, 'dist', 'flimmerfrei.inject.js'), 'utf8');
});

const TOKEN = 'TOKEN-geheim-123';
const BIND_TEXT = '[[0,["c","SID42","HOST",8]],[1,["S","GS7"]]]';

function makeFetch(responder) {
  const calls = [];
  const fn = async (url, init) => {
    const call = { url, init, body: init.body, token: init.headers['X-YouTube-LoungeId-Token'] };
    calls.push(call);
    const r = await responder(call, calls.length);
    return { status: r.status, text: async () => r.text || '' };
  };
  return { fn, calls };
}
function memStorage(init) {
  const m = Object.assign({}, init);
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m };
}
const happy = (call) => {
  if (call.url.endsWith('/pairing/get_screen')) return { status: 200, text: JSON.stringify({ screen: { screenId: 'SCR1', loungeToken: TOKEN, name: 'Philips TV' } }) };
  if (call.url.endsWith('/pairing/get_lounge_token_batch')) return { status: 200, text: JSON.stringify({ screens: [{ screenId: 'SCR1', loungeToken: 'NEU-' + TOKEN }] }) };
  if (call.url.includes('RID=1&')) return { status: 200, text: BIND_TEXT };
  return { status: 200, text: '' };
};

test('Kodierung, TV-Code, Adressen, Formulare, Antwort lesen', () => {
  assert.equal(formEncode([['a b', "x&y=z!'()*"], ['k', 'ü']]), 'a%20b=x%26y%3Dz%21%27%28%29%2A&k=%C3%BC');
  assert.equal(normalizeTvCode('1234 5678 9012'), '123456789012');
  assert.equal(normalizeTvCode('123-456-789-012'), '123456789012');
  assert.equal(normalizeTvCode('123456'), '123456');
  assert.equal(normalizeTvCode('1234567890123456'), '1234567890123456');
  for (const bad of ['12345', '12345678901234567', 'abc123456', '', '12 34 x6 78', null, undefined]) assert.equal(normalizeTvCode(bad), '', String(bad));
  assert.equal(buildBindUrl('/api/lounge', 1), '/api/lounge/bc/bind?RID=1&VER=8&CVER=1');
  assert.equal(buildCommandUrl('/api/lounge', 'S/1', 'G', 3), '/api/lounge/bc/bind?SID=S%2F1&gsessionid=G&RID=3&VER=8&CVER=1');
  assert.equal(buildCommandUrl('/x', 'S', '', 2), '/x/bc/bind?SID=S&RID=2&VER=8&CVER=1');
  const bf = buildBindForm('cid');
  for (const part of ['device=REMOTE_CONTROL', 'id=cid', 'name=Flimmerfrei', 'mdx-version=3', 'pairing_type=cast', 'app=android-phone-13.14.55']) assert.ok(bf.includes(part), part);
  assert.equal(buildCommandForm(0, 'pause', {}), 'count=1&ofs=0&req0__sc=pause');
  assert.equal(buildCommandForm(2, 'setPlaylist', { _videoId: 'v', _currentTime: '5', _audioOnly: 'false', _currentIndex: '-1', _listId: '' }), 'count=1&ofs=2&req0__sc=setPlaylist&req0__audioOnly=false&req0__currentIndex=-1&req0__currentTime=5&req0__listId=&req0__videoId=v');
  assert.deepEqual(parseBindResponse(BIND_TEXT), { sid: 'SID42', gsessionid: 'GS7' });
  assert.deepEqual(parseBindResponse('kaputt'), { sid: '', gsessionid: '' });
});

test('pair: Erfolg (Anfrage-Form, ohne Cookies, Gerät gemerkt ohne Token)', async () => {
  const f = makeFetch(happy);
  const st = memStorage();
  const lounge = createLounge(f.fn, st, null);
  const r = await lounge.pair('1234 5678 9012');
  assert.equal(r.ok, true);
  assert.equal(r.screen.name, 'Philips TV');
  const c = f.calls[0];
  assert.equal(c.url, '/api/lounge/pairing/get_screen');
  assert.equal(c.init.method, 'POST');
  assert.equal(c.init.credentials, 'omit');
  assert.equal(c.init.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(c.body, 'pairing_code=123456789012');
  assert.equal(c.token, undefined);
  const saved = JSON.parse(st.m[CAST_STORAGE_KEY]);
  assert.deepEqual(saved, { screenId: 'SCR1', name: 'Philips TV', connected: false });
  assert.equal(st.m[CAST_STORAGE_KEY].includes(TOKEN), false, 'Token wird nicht gespeichert');
});

test('pair: 404, ungültiger Code, Netzwerkfehler mit einmaligem absoluten Versuch', async () => {
  const f = makeFetch(() => ({ status: 404 }));
  const l = createLounge(f.fn, memStorage(), null);
  const r = await l.pair('123456789012');
  assert.deepEqual([r.ok, r.error, r.text], [false, 'invalid', 'Code ungültig oder abgelaufen']);
  assert.equal(f.calls.length, 1);
  assert.equal((await l.pair('12')).error, 'invalid');
  assert.equal(f.calls.length, 1, 'kein Netz bei ungültiger Eingabe');
  assert.equal(createLounge(makeFetch(() => ({ status: 200, text: '{"screen":{}}' })).fn, memStorage(), null).pair('123456789012') instanceof Promise, true);

  let n = 0;
  const g = makeFetch(() => { n++; throw new TypeError('Failed to fetch'); });
  const l2 = createLounge(g.fn, memStorage(), null);
  const r2 = await l2.pair('123456789012');
  assert.deepEqual([r2.error, r2.text], ['network', 'Fernseher nicht erreichbar']);
  assert.equal(n, 2);
  assert.equal(g.calls[1].url, 'https://www.youtube.com/api/lounge/pairing/get_screen');
  assert.equal(l2.lastError(), 'Fernseher nicht erreichbar');
});

test('Fallback auf absolute Adresse bleibt bestehen, wenn sie klappt', async () => {
  const f = makeFetch((c) => {
    if (!c.url.startsWith('https://')) throw new TypeError('CORS');
    return happy(c);
  });
  const l = createLounge(f.fn, memStorage(), null);
  assert.equal((await l.pair('123456789012')).ok, true);
  await l.connect();
  const last = f.calls[f.calls.length - 1];
  assert.ok(last.url.startsWith('https://www.youtube.com/api/lounge/bc/bind'));
  assert.equal(f.calls.filter((c) => !c.url.startsWith('https://')).length, 1, 'relativ nur einmal versucht');
});

test('connect: bind liest SID/gsessionid; Befehlszähler RID/ofs; Token nur als Kopfzeile', async () => {
  const f = makeFetch(happy);
  const st = memStorage();
  const lounge = createLounge(f.fn, st, null);
  await lounge.pair('123456789012');
  assert.equal((await lounge.connect()).ok, true);
  const bind = f.calls[1];
  assert.equal(bind.url, '/api/lounge/bc/bind?RID=1&VER=8&CVER=1');
  assert.equal(bind.token, TOKEN);
  assert.ok(bind.body.includes('device=REMOTE_CONTROL'));
  assert.equal(lounge.isConnected(), true);
  assert.equal(JSON.parse(st.m[CAST_STORAGE_KEY]).connected, true);

  assert.equal(await lounge.send('pause', {}), true);
  assert.equal(await lounge.send('seekTo', { _newTime: '30' }), true);
  const a = f.calls[2];
  const b = f.calls[3];
  assert.equal(a.url, '/api/lounge/bc/bind?SID=SID42&gsessionid=GS7&RID=2&VER=8&CVER=1');
  assert.equal(a.body, 'count=1&ofs=0&req0__sc=pause');
  assert.equal(a.token, TOKEN);
  assert.equal(b.url, '/api/lounge/bc/bind?SID=SID42&gsessionid=GS7&RID=3&VER=8&CVER=1');
  assert.equal(b.body, 'count=1&ofs=1&req0__sc=seekTo&req0__newTime=30');
  for (const c of f.calls) assert.equal(c.url.includes(TOKEN), false);
});

test('connect ohne Token (gemerktes Gerät): Token frisch holen, dann binden; Fehlertexte', async () => {
  const f = makeFetch(happy);
  const st = memStorage({ [CAST_STORAGE_KEY]: JSON.stringify({ screenId: 'SCR1', name: 'Philips TV', connected: true }) });
  const lounge = createLounge(f.fn, st, null);
  assert.equal(lounge.savedDevice().name, 'Philips TV');
  lounge.restore();
  assert.equal((await lounge.connect()).ok, true);
  assert.equal(f.calls[0].url, '/api/lounge/pairing/get_lounge_token_batch');
  assert.equal(f.calls[0].body, 'screen_ids=SCR1');
  assert.equal(f.calls[1].token, 'NEU-' + TOKEN);

  const bad = createLounge(makeFetch((c) => (c.url.includes('bc/bind') ? { status: 400 } : happy(c))).fn, memStorage(), null);
  await bad.pair('123456789012');
  const r = await bad.connect();
  assert.deepEqual([r.ok, r.error, r.text], [false, 'bind', 'Verbindung fehlgeschlagen']);
  assert.equal(bad.isConnected(), false);
  assert.equal(castErrorText('x'), 'Verbindung fehlgeschlagen');
});

test('Befehl: bei 404 einmal neu binden und wiederholen, nicht öfter', async () => {
  let cmdCount = 0;
  const f = makeFetch((c) => {
    if (c.url.includes('SID=')) {
      cmdCount++;
      return { status: cmdCount === 1 ? 404 : 200 };
    }
    return happy(c);
  });
  const l = createLounge(f.fn, memStorage(), null);
  await l.pair('123456789012');
  await l.connect();
  const before = f.calls.length;
  assert.equal(await l.send('play', {}), true);
  const seq = f.calls.slice(before).map((c) => (c.url.includes('SID=') ? 'cmd' : c.url.includes('token_batch') ? 'token' : 'bind'));
  assert.deepEqual(seq, ['cmd', 'token', 'bind', 'cmd']);
  assert.equal(f.calls[f.calls.length - 1].token, 'NEU-' + TOKEN);
  assert.ok(f.calls[f.calls.length - 1].body.includes('ofs=0'), 'Zähler nach Neu-Binden zurückgesetzt');

  const g = makeFetch((c) => (c.url.includes('SID=') ? { status: 410 } : happy(c)));
  const l2 = createLounge(g.fn, memStorage(), null);
  await l2.pair('123456789012');
  await l2.connect();
  assert.equal(await l2.send('play', {}), false);
  assert.equal(g.calls.filter((c) => c.url.includes('SID=')).length, 2, 'genau ein Wiederholungsversuch');
});

test('disconnect: stopVideo, Fehler egal, Gerät bleibt gemerkt', async () => {
  const f = makeFetch((c) => (c.body.includes('stopVideo') ? { status: 500 } : happy(c)));
  const st = memStorage();
  const l = createLounge(f.fn, st, null);
  await l.pair('123456789012');
  await l.connect();
  await l.disconnect();
  assert.ok(f.calls.some((c) => c.body.includes('req0__sc=stopVideo')));
  assert.equal(l.isConnected(), false);
  assert.deepEqual(JSON.parse(st.m[CAST_STORAGE_KEY]), { screenId: 'SCR1', name: 'Philips TV', connected: false });
});

test('Zeitlimit: Abbruch über AbortController nach 15 s', async () => {
  let delay = null;
  let aborted = 0;
  class AC { constructor() { this.signal = {}; } abort() { aborted++; } }
  const f = makeFetch(() => ({ status: 200 }));
  const l = createLounge(f.fn, memStorage(), null, { setTimeout: (fn, ms) => { delay = ms; fn(); return 1; }, clearTimeout() {}, AbortController: AC });
  await l.pair('123456789012');
  assert.equal(delay, 15000);
  assert.equal(aborted, 1);
});

function ctlSetup(connected) {
  const sent = [];
  let paused = 0;
  const s = { hasVideo: true, playing: true, videoId: 'v1', listId: 'PL', currentTime: 12.9 };
  const lounge = { isConnected: () => connected.v, send: async (c, p) => { sent.push([c, p]); return true; }, lastError: () => '' };
  const ctl = createCastController({ lounge, getState: () => s, pause: () => { paused++; } });
  return { ctl, sent, s, pausedCount: () => paused };
}

test('Steuerung: aktuelles Video senden, lokal anhalten; automatisch nur wenn verbunden', async () => {
  const c = { v: false };
  const t = ctlSetup(c);
  assert.equal(await t.ctl.tick(), false);
  assert.equal(t.sent.length, 0);
  c.v = true;
  assert.equal(await t.ctl.tick(), true);
  assert.deepEqual(t.sent[0], ['setPlaylist', { _videoId: 'v1', _currentTime: '12', _currentIndex: '-1', _audioOnly: 'false', _listId: 'PL' }]);
  assert.equal(t.pausedCount(), 1);
  assert.equal(await t.ctl.tick(), false, 'gleiches Video nicht noch einmal');
  t.s.videoId = 'v2';
  t.s.currentTime = 0;
  t.s.playing = false;
  assert.equal(await t.ctl.tick(), false, 'nur wenn es läuft');
  t.s.playing = true;
  assert.equal(await t.ctl.tick(), true);
  assert.equal(t.sent.length, 2);
  assert.equal(t.sent[1][1]._videoId, 'v2');
  c.v = false;
  t.s.videoId = 'v3';
  assert.equal(await t.ctl.tick(), false);
  assert.equal(t.sent.length, 2);
});

test('Steuerung: onConnected sendet nur bei vorhandenem Video; markSeen verhindert Wiederholung', async () => {
  const c = { v: true };
  const t = ctlSetup(c);
  t.s.videoId = '';
  assert.deepEqual(await t.ctl.onConnected(), { ok: true });
  assert.equal(t.sent.length, 0);
  assert.equal((await t.ctl.sendCurrent()).error, 'novideo');
  t.s.videoId = 'v9';
  assert.equal((await t.ctl.onConnected()).ok, true);
  assert.equal(t.sent.length, 1);
  const t2 = ctlSetup(c);
  t2.ctl.markSeen();
  assert.equal(await t2.ctl.tick(), false);
});

// ---- Blatt ----

function sheetEnv(loungeOver) {
  const { doc, root: r } = makeDoc();
  doc.body = r;
  const docL = {};
  doc.addEventListener = (t, f) => { (docL[t] ||= []).push(f); };
  doc.removeEventListener = (t, f) => { docL[t] = (docL[t] || []).filter((x) => x !== f); };
  const calls = [];
  const lounge = Object.assign({
    connected: false,
    isConnected() { return this.connected; },
    deviceName: () => 'Philips TV',
    savedDevice: () => null,
    lastError: () => '',
    pair: async (code) => { calls.push(['pair', code]); return { ok: false, error: 'invalid', text: 'Code ungültig oder abgelaufen' }; },
    connect: async () => ({ ok: true }),
    send: async (c) => { calls.push(['send', c]); return true; },
    disconnect: async function () { this.connected = false; calls.push(['disconnect']); },
  }, loungeOver);
  const controller = { sendCurrent: async () => { calls.push(['sendCurrent']); return { ok: true }; }, onConnected: async () => ({ ok: true }) };
  let changes = 0;
  const sheet = createCastSheet({}, doc, { lounge, controller, onChange: () => changes++ });
  return { doc, root: r, docL, sheet, lounge, calls, changes: () => changes };
}
const texts = (n, out = []) => { if (n.textContent) out.push(n.textContent); for (const c of n.childNodes) texts(c, out); return out; };
const wait = () => new Promise((r) => setTimeout(r, 0));
const buttonsOf = (root) => root.querySelectorAll('button');
const byText = (root, t) => buttonsOf(root).find((b) => b.textContent === t);

test('Blatt: nicht verbunden -> Hinweis, Eingabefeld, Verbinden; Schließen entfernt es wieder', async () => {
  const e = sheetEnv();
  e.sheet.open();
  assert.equal(e.sheet.isOpen(), true);
  assert.equal(e.root.childNodes.length, 2);
  const all = texts(e.root);
  assert.ok(all.some((t) => t.includes('Einstellungen → Mit TV-Code verknüpfen')));
  const input = e.root.querySelector('input');
  assert.equal(input.getAttribute('inputmode'), 'numeric');
  assert.ok(byText(e.root, 'Verbinden'));
  assert.equal(byText(e.root, 'Pause'), undefined);

  // ungültige Eingabe -> Fehlertext ohne Netz
  input.value = '12';
  byText(e.root, 'Verbinden').dispatch('click');
  assert.ok(texts(e.root).includes('Code ungültig oder abgelaufen'));
  assert.equal(e.calls.length, 0);

  // Code wird normalisiert, Fehler der Sitzung erscheint
  e.root.querySelector('input').value = '1234-5678-9012';
  byText(e.root, 'Verbinden').dispatch('click');
  await wait();
  assert.deepEqual(e.calls[0], ['pair', '123456789012']);
  assert.ok(texts(e.root).includes('Code ungültig oder abgelaufen'));
  assert.ok(e.changes() >= 1);

  byText(e.root, 'Schließen').dispatch('click');
  assert.equal(e.sheet.isOpen(), false);
  assert.equal(e.root.childNodes.length, 0);
});

test('Blatt: gemerktes Gerät -> "Erneut verbinden mit <Name>"; Verbinden-Ablauf', async () => {
  const e = sheetEnv({ savedDevice: () => ({ screenId: 'S', name: 'Philips TV', connected: false }), pair: async () => ({ ok: true }), connect: async function () { this.connected = true; return { ok: true }; } });
  e.sheet.open();
  const b = byText(e.root, 'Erneut verbinden mit Philips TV');
  assert.ok(b);
  b.dispatch('click');
  await wait();
  assert.ok(texts(e.root).includes('Verbunden mit Philips TV'));
  for (const l of ['Pause', 'Weiter', 'Aktuelles Video senden', 'Trennen']) assert.ok(byText(e.root, l), l);
  byText(e.root, 'Pause').dispatch('click');
  await wait();
  byText(e.root, 'Weiter').dispatch('click');
  await wait();
  byText(e.root, 'Aktuelles Video senden').dispatch('click');
  await wait();
  assert.deepEqual(e.calls, [['send', 'pause'], ['send', 'play'], ['sendCurrent']]);
  byText(e.root, 'Trennen').dispatch('click');
  await wait();
  assert.ok(byText(e.root, 'Verbinden'));
});

test('Blatt: Abdunklung schließt; Ereignisse und Tasten schlagen nicht zur Seite durch', () => {
  const e = sheetEnv();
  e.sheet.open();
  const [backdrop, sheetEl] = e.root.childNodes;
  for (const t of ['click', 'touchstart', 'touchend', 'pointerdown', 'pointerup', 'keydown']) assert.equal(sheetEl.dispatch(t).stopped, 1, t);
  const input = e.root.querySelector('input');
  let stopped = 0;
  e.docL.keydown.forEach((f) => f({ target: input, stopImmediatePropagation: () => stopped++ }));
  assert.equal(stopped, 1);
  e.docL.keydown.forEach((f) => f({ target: el('div'), stopImmediatePropagation: () => stopped++ }));
  assert.equal(stopped, 1, 'fremdes Ziel bleibt unberührt');
  backdrop.dispatch('click');
  assert.equal(e.sheet.isOpen(), false);
  assert.equal(e.root.childNodes.length, 0);
  assert.equal((e.docL.keydown || []).length, 0, 'Tastenfänger entfernt');
});

test('Blatt: baut nur mit createElement (kein innerHTML)', () => {
  const src = readFileSync(join(root, 'src', 'castui.js'), 'utf8');
  assert.equal(/innerHTML|outerHTML|insertAdjacentHTML/.test(src), false);
});

// ---- Player-Knopf und Diagnose ----

test('Player-Knopf Userscript: Übertragen öffnet Blatt, hervorgehoben wenn verbunden; kein Leisten-Knopf', () => {
  const { doc, root: r } = makeDoc();
  const pbox = el('div', 'player-controls-top', []);
  r.appendChild(el('player-top-controls', '', [pbox]));
  r.appendChild(el('ytm-mobile-topbar-renderer', '', [el('div', 'mobile-topbar-header-content', [el('button', 'topbar-button-search-button')])]));
  let opened = 0;
  let connected = false;
  const win = { innerWidth: 400, innerHeight: 800, location: { href: 'https://m.youtube.com/' }, HTMLVideoElement: { prototype: {} }, setTimeout: () => 0, setInterval: () => 0, addEventListener() {} };
  const look = installLook(win, doc, createConfigStore({ host: 'userscript' }), { pip() {}, airplay() {}, castOpen: () => opened++, castConnected: () => connected });
  const btn = pbox.querySelector('.flimmerfrei-cast-player');
  assert.equal(btn.getAttribute('aria-label'), 'Auf Fernseher übertragen');
  assert.equal(btn.getAttribute('aria-pressed') || 'false', 'false');
  btn.dispatch('click');
  assert.equal(opened, 1);
  connected = true;
  look.refresh();
  assert.equal(btn.getAttribute('aria-pressed'), 'true');
  assert.ok(btn.getAttribute('style').includes('#2DD4BF'));
  assert.equal(r.querySelectorAll('.flimmerfrei-topbar-button').length, 0);
});

test('Diagnose: Zeile Übertragen', () => {
  const t = (cast) => buildDiagnostics({ version: 'x', starts: [], video: null, cast }).split('\n');
  assert.ok(t('verbunden mit Philips TV').includes('Übertragen: verbunden mit Philips TV'));
  assert.ok(t(undefined).includes('Übertragen: nicht verbunden'));
  assert.ok(t('nicht verbunden (letzter Fehler: Fernseher nicht erreichbar)').includes('Übertragen: nicht verbunden (letzter Fehler: Fernseher nicht erreichbar)'));
});

// ---- Gebautes Skript ----

function runBuilt(o) {
  const log = { fetches: [], intervals: [], store: Object.assign({}, o.storage) };
  const doc = { title: '', readyState: 'loading', head: null, documentElement: { setAttribute() {}, hasAttribute: () => false, appendChild() {} }, createElement: () => ({ setAttribute() {}, textContent: '' }), querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  const ctx = vm.createContext({ document: doc, setTimeout: () => 0, setInterval: (f, ms) => { log.intervals.push(ms); return 0; } });
  const win = vm.runInContext('globalThis', ctx);
  win.window = win;
  win.innerWidth = 400;
  win.innerHeight = 800;
  win.location = { href: 'https://m.youtube.com/', hostname: 'm.youtube.com', pathname: '/' };
  win.addEventListener = () => {};
  win.localStorage = { getItem: (k) => (k in log.store ? log.store[k] : null), setItem: (k, v) => { log.store[k] = String(v); }, removeItem() {} };
  win.fetch = async (url, init) => { log.fetches.push({ url, init }); return { status: 200, text: async () => '{"screens":[{"loungeToken":"T"}]}' }; };
  win.__FLIMMERFREI_CONFIG__ = o.config || {};
  vm.runInContext(inject, ctx);
  return { win, log };
}

test('Gebaut, Userscript: Diagnose "nicht verbunden"; gemerktes verbundenes Gerät wird wieder angebunden', async () => {
  const a = runBuilt({});
  assert.ok(a.win.__flimmerfrei.diagnostics().split('\n').includes('Übertragen: nicht verbunden'));
  assert.ok(a.log.intervals.includes(1000));
  assert.equal(a.log.fetches.length, 0);

  const b = runBuilt({ storage: { [CAST_STORAGE_KEY]: JSON.stringify({ screenId: 'S1', name: 'Philips TV', connected: true }) } });
  await wait();
  await wait();
  assert.equal(b.log.fetches[0].url, '/api/lounge/pairing/get_lounge_token_batch');
  assert.equal(b.log.fetches[0].init.credentials, 'omit');
});

test('Gebaut, Host ios: nichts davon (kein Netz, kein Speicher, kein Takt, Diagnose "über die App")', async () => {
  const r = runBuilt({ config: { host: 'ios' }, storage: { [CAST_STORAGE_KEY]: JSON.stringify({ screenId: 'S1', name: 'x', connected: true }) } });
  await wait();
  assert.equal(r.log.fetches.length, 0);
  assert.equal(r.log.intervals.includes(1000), false);
  assert.ok(r.win.__flimmerfrei.diagnostics().split('\n').includes('Übertragen: über die App'));
});
