import test from 'node:test';
import assert from 'node:assert/strict';
import { el, makeDoc } from './helpers/fakedom.js';
import { createConfigStore, createUserActivity } from '../src/config.js';
import { installLook, buildLookCss, LOOK_HIDE_SELECTORS, ensureTopbarButtons, buildIcon } from '../src/look.js';
import { parseVideoIds, collectState, installBridge } from '../src/bridge.js';
import { pauseActive } from '../src/pip.js';
import { createAdState, cleanResponse, isAdItem, hasAdMarker } from '../src/adblock.js';

const noop = { pip() {}, airplay() {} };

function page() {
  const { doc, root } = makeDoc();
  const search = el('button', 'icon-button topbar-button-search-button');
  const header = el('div', 'mobile-topbar-header-content', [el('div', 'logo'), search]);
  root.appendChild(el('ytm-mobile-topbar-renderer', '', [header]));
  const pbox = el('div', 'player-controls-top', [el('button', 'native')]);
  root.appendChild(el('player-top-controls', '', [pbox]));
  return { doc, root, header, search, pbox };
}
function makeWin(posted) {
  const win = {
    innerWidth: 400,
    innerHeight: 800,
    location: { href: 'https://m.youtube.com/' },
    HTMLVideoElement: { prototype: { webkitShowPlaybackTargetPicker() {} } },
    setTimeout: () => 0,
    setInterval: () => 0,
    addEventListener() {},
  };
  if (posted) win.webkit = { messageHandlers: { flimmerfrei: { postMessage: (m) => posted.push(m) } } };
  return win;
}
const labels = (nodes) => nodes.map((b) => b.getAttribute('aria-label'));

test('Leisten-Knöpfe (iOS): vor dem Such-Knopf, nicht doppelt, nach Entfernen wieder', () => {
  const { doc, header, search } = page();
  const look = installLook(makeWin([]), doc, createConfigStore({ host: 'ios' }), noop);
  const kids = header.childNodes;
  assert.equal(kids[0].className, 'logo');
  assert.equal(kids[1].getAttribute('aria-label'), 'Auf Fernseher übertragen');
  assert.equal(kids[2].getAttribute('aria-label'), 'Flimmerfrei-Menü');
  assert.equal(kids[3], search);
  assert.equal(look.menuButtonPresent(), true);
  look.refresh();
  look.refresh();
  assert.equal(header.querySelectorAll('.flimmerfrei-topbar-button').length, 2);
  assert.ok(header.querySelector('button.icon-button.flimmerfrei-menu-button'));

  header.querySelectorAll('.flimmerfrei-topbar-button').forEach((b) => b.remove());
  assert.equal(look.menuButtonPresent(), false);
  look.refresh();
  assert.equal(header.querySelectorAll('.flimmerfrei-topbar-button').length, 2);
});

test('Leisten-Knöpfe: Meldungen menu/cast ungedrosselt, Ereignisse stoppen', () => {
  const p = page();
  const posted = [];
  installLook(makeWin(posted), p.doc, createConfigStore({ host: 'ios' }), noop);
  const [cast, menu] = p.header.querySelectorAll('.flimmerfrei-topbar-button');
  menu.dispatch('click');
  menu.dispatch('click');
  cast.dispatch('click');
  assert.deepEqual(posted, [{ type: 'menu' }, { type: 'menu' }, { type: 'cast' }]);
  assert.equal(cast.dispatch('touchstart').stopped, 1);
  assert.equal(posted.length, 3);
});

test('Symbole: eigene SVG mit currentColor, 24 px', () => {
  const { doc } = makeDoc();
  for (const k of ['cast', 'menu', 'pip', 'airplay']) {
    const s = buildIcon(doc, k);
    assert.equal(s.getAttribute('width'), '24');
    assert.equal(s.getAttribute('stroke'), 'currentColor');
    assert.ok(s.childNodes.length >= 2);
  }
});

test('setConfig: menuButton/playerButtons blenden aus und ein', () => {
  const { doc, header, pbox } = page();
  const store = createConfigStore({ host: 'ios' });
  const look = installLook(makeWin([]), doc, store, noop);
  assert.equal(pbox.querySelectorAll('.flimmerfrei-player-button').length, 3);
  store.set({ menuButton: false });
  assert.equal(header.querySelectorAll('.flimmerfrei-topbar-button').length, 0);
  assert.equal(look.menuButtonPresent(), false);
  store.set({ playerButtons: false });
  assert.equal(pbox.querySelectorAll('.flimmerfrei-player-button').length, 0);
  store.set({ menuButton: true, playerButtons: true });
  assert.equal(header.querySelectorAll('.flimmerfrei-topbar-button').length, 2);
  assert.equal(pbox.querySelectorAll('.flimmerfrei-player-button').length, 3);
});

test('Player-Knöpfe: Aktionen, stopPropagation, AirPlay nur wenn unterstützt', () => {
  const p = page();
  const posted = [];
  let pip = 0;
  let air = 0;
  installLook(makeWin(posted), p.doc, createConfigStore({ host: 'ios' }), { pip: () => pip++, airplay: () => air++ });
  const btns = p.pbox.querySelectorAll('.flimmerfrei-player-button');
  assert.deepEqual(labels(btns), ['Auf Fernseher übertragen', 'Bild-in-Bild', 'AirPlay']);
  for (const b of btns) for (const t of ['touchstart', 'touchend', 'pointerdown', 'pointerup']) assert.equal(b.dispatch(t).stopped, 1);
  assert.equal(pip + air + posted.length, 0);
  btns.forEach((b) => b.dispatch('click'));
  assert.equal(pip, 1);
  assert.equal(air, 1);
  assert.deepEqual(posted, [{ type: 'cast' }]);

  const p2 = page();
  const win2 = makeWin([]);
  delete win2.HTMLVideoElement.prototype.webkitShowPlaybackTargetPicker;
  installLook(win2, p2.doc, createConfigStore({ host: 'ios' }), noop);
  assert.deepEqual(labels(p2.pbox.querySelectorAll('.flimmerfrei-player-button')), ['Auf Fernseher übertragen', 'Bild-in-Bild']);
});

test('Userscript-Modus: keine Leisten-Knöpfe, kein Übertragen-Knopf', () => {
  const p = page();
  const look = installLook(makeWin([]), p.doc, createConfigStore({ host: 'userscript' }), noop);
  assert.equal(p.header.querySelectorAll('.flimmerfrei-topbar-button').length, 0);
  assert.equal(look.menuButtonPresent(), false);
  assert.deepEqual(labels(p.pbox.querySelectorAll('.flimmerfrei-player-button')), ['Bild-in-Bild', 'AirPlay']);
});

test('Ankerstellen fehlen: nichts passiert, menuButton bleibt false', () => {
  const { doc } = makeDoc();
  const look = installLook(makeWin([]), doc, createConfigStore({ host: 'ios' }), noop);
  assert.equal(look.menuButtonPresent(), false);
  assert.equal(ensureTopbarButtons({}, doc), false);
  const p = makeDoc();
  p.root.appendChild(el('div', 'player-controls-top'));
  installLook(makeWin([]), p.doc, createConfigStore({ host: 'ios' }), noop);
  assert.equal(p.doc.querySelectorAll('.flimmerfrei-player-button').length, 3);
});

test('Ohne Such-Knopf: als erstes Kind; Stil: Regeln einzeln', () => {
  const { doc, root } = makeDoc();
  const header = el('div', 'mobile-topbar-header-content', [el('div', 'x')]);
  root.appendChild(el('ytm-mobile-topbar-renderer', '', [header]));
  installLook(makeWin([]), doc, createConfigStore({ host: 'ios' }), noop);
  assert.ok(header.firstChild.className.includes('flimmerfrei-topbar-button'));

  const css = buildLookCss();
  for (const s of LOOK_HIDE_SELECTORS) assert.ok(css.includes(s + '{display:none !important}'));
  assert.ok(css.includes('-webkit-tap-highlight-color'));
  assert.ok(css.includes('-webkit-touch-callout'));
});

test('Stil folgt der Einstellung look', () => {
  const { doc, root } = makeDoc();
  const store = createConfigStore({});
  installLook(makeWin([]), doc, store, noop);
  const s = root.childNodes.find((c) => c.tagName === 'style');
  assert.ok(s.textContent.includes('open_app'));
  store.set({ look: false });
  assert.equal(s.textContent, '');
  store.set({ look: true });
  assert.ok(s.textContent.length > 0);
});

test('parseVideoIds', () => {
  const t = (u, v, l) => assert.deepEqual(parseVideoIds(u), { videoId: v, listId: l }, String(u));
  t('https://m.youtube.com/watch?v=abc&list=PL1', 'abc', 'PL1');
  t('https://m.youtube.com/shorts/xyz', 'xyz', '');
  t('https://m.youtube.com/shorts/xyz?feature=share#t', 'xyz', '');
  t('https://m.youtube.com/', '', '');
  t('https://m.youtube.com/results?search_query=v%3Dnein', '', '');
  t('https://m.youtube.com/watch?feature=x&v=a%20b', 'a b', '');
  t('https://m.youtube.com/playlist?list=PL9', '', 'PL9');
  t('', '', '');
  t(null, '', '');
});

test('Zustand: neue Felder; currentTime allein löst keine Meldung aus, videoId/menuButton schon', async () => {
  const v = { paused: false, ended: false, currentSrc: 'b', currentTime: 12.5, getBoundingClientRect: () => ({ left: 0, top: 0, right: 10, bottom: 10 }) };
  const doc = { title: 'T - YouTube', querySelectorAll: () => [v], addEventListener() {} };
  const posted = [];
  const win = { innerWidth: 400, innerHeight: 800, location: { href: 'https://m.youtube.com/watch?v=a&list=L' }, addEventListener() {}, setInterval: () => 0, webkit: { messageHandlers: { flimmerfrei: { postMessage: (m) => posted.push(m) } } } };
  let menu = false;
  const s = collectState(win, doc, createAdState(), () => menu);
  assert.deepEqual([s.menuButton, s.videoId, s.listId, s.currentTime], [false, 'a', 'L', 12.5]);
  const notify = installBridge(win, doc, createAdState(), () => menu);
  assert.equal(posted.length, 1);
  assert.equal(posted[0].currentTime, 12.5);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  v.currentTime = 40;
  await wait(300);
  notify();
  assert.equal(posted.length, 1, 'currentTime allein: keine Meldung');
  menu = true;
  await wait(300);
  notify();
  assert.equal(posted.length, 2);
  assert.equal(posted[1].menuButton, true);
  win.location.href = 'https://m.youtube.com/watch?v=b';
  await wait(300);
  notify();
  assert.equal(posted.length, 3);
  assert.equal(posted[2].videoId, 'b');
});

test('pause(): hält an, zählt als Nutzeraktion, false ohne Video', () => {
  let paused = 0;
  const v = { paused: false, currentSrc: 'b', pause() { paused++; }, getBoundingClientRect: () => ({ left: 0, top: 0, right: 10, bottom: 10 }) };
  const act = createUserActivity(() => 5000);
  assert.equal(act.sinceUser(), Infinity);
  assert.equal(pauseActive({ innerWidth: 9, innerHeight: 9 }, { querySelectorAll: () => [v] }, act), true);
  assert.equal(paused, 1);
  assert.equal(act.sinceUser(), 0);
  assert.equal(pauseActive({}, { querySelectorAll: () => [] }, act), false);
});

test('Shorts-Werbung: Einträge mit adClientParams.isAd fliegen raus', () => {
  const ad = { command: { reelWatchEndpoint: { videoId: 'x', adClientParams: { isAd: true } } } };
  const ok = { command: { reelWatchEndpoint: { videoId: 'y', adClientParams: { isAd: false } } } };
  const data = { contents: [{ reelItemRenderer: ad }, { reelItemRenderer: ok }, { richItemRenderer: { content: { reelItemRenderer: ad } } }, ad, { videoRenderer: {} }] };
  assert.equal(hasAdMarker(JSON.stringify(data)), true);
  const st = createAdState();
  cleanResponse(data, st);
  assert.equal(data.contents.length, 2);
  assert.equal(data.contents[0].reelItemRenderer, ok);
  assert.equal(st.adsBlocked, 3);
  assert.equal(isAdItem({ command: { reelWatchEndpoint: {} } }), false);
});

test('Smart-Banner-Meta wird bei look entfernt, sonst nicht', () => {
  const metas = [];
  const mk = () => ({ gone: false, remove() { this.gone = true; } });
  const m1 = mk();
  const { doc } = makeDoc();
  const orig = doc.querySelectorAll;
  doc.querySelectorAll = (s) => (s === 'meta[name="apple-itunes-app"]' ? [m1] : orig(s));
  void metas;
  const store = createConfigStore({ look: false });
  const look = installLook(makeWin([]), doc, store, noop);
  assert.equal(m1.gone, false);
  store.set({ look: true });
  assert.equal(m1.gone, true);
  look.refresh();
});
