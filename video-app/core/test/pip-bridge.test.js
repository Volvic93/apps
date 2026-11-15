import test from 'node:test';
import assert from 'node:assert/strict';
import { findActiveVideo, shouldBlockPipExit, togglePip, showAirplay, prepareVideo, createPipState, isPipActive } from '../src/pip.js';
import { collectState, createThrottle, installBridge } from '../src/bridge.js';
import { createAdState } from '../src/adblock.js';

function fakeVideo(o) {
  const attrs = Object.assign({}, o.attrs);
  o = Object.assign({}, o, { attrs });
  return Object.assign(
    {
      paused: true,
      ended: false,
      currentSrc: 'blob:x',
      rect: { left: 0, top: 0, right: 100, bottom: 100 },
      getBoundingClientRect() { return this.rect; },
      hasAttribute: (k) => k in attrs,
      getAttribute: (k) => (k in attrs ? attrs[k] : null),
      setAttribute: (k, v) => { attrs[k] = v; },
      removeAttribute: (k) => { delete attrs[k]; },
      attrs,
    },
    o
  );
}
const docOf = (videos, extra) => Object.assign({ title: 'Titel - YouTube', querySelectorAll: () => videos }, extra);

test('aktives Video: sichtbares, größtes mit Quelle', () => {
  const small = fakeVideo({ rect: { left: 0, top: 0, right: 50, bottom: 50 } });
  const big = fakeVideo({ rect: { left: 0, top: 0, right: 300, bottom: 200 } });
  const offscreen = fakeVideo({ rect: { left: 0, top: 2000, right: 400, bottom: 2400 } });
  const noSrc = fakeVideo({ currentSrc: '', rect: { left: 0, top: 0, right: 900, bottom: 900 } });
  const v = findActiveVideo(docOf([small, big, offscreen, noSrc]), { width: 400, height: 800 });
  assert.equal(v, big);
  assert.equal(findActiveVideo(docOf([]), {}), null);
  // Rückfall: nichts sichtbar -> laufendes Video
  const hid = fakeVideo({ rect: { left: 0, top: 0, right: 0, bottom: 0 }, paused: false });
  assert.equal(findActiveVideo(docOf([fakeVideo({ rect: { left: 0, top: 0, right: 0, bottom: 0 } }), hid]), {}), hid);
});

test('Shorts: von mehreren gestapelten Videos zählt das im Fenster', () => {
  const prev = fakeVideo({ rect: { left: 0, top: -800, right: 400, bottom: 0 } });
  const cur = fakeVideo({ rect: { left: 0, top: 0, right: 400, bottom: 800 } });
  assert.equal(findActiveVideo(docOf([prev, cur]), { width: 400, height: 800 }), cur);
});

test('Bild-in-Bild-Sperre: nur kurz nach Start und ohne Nutzeraktion', () => {
  const base = { isOn: true, internal: false, pipSince: 1000, now: 1300, sinceUser: 5000 };
  assert.equal(shouldBlockPipExit(base), true);
  assert.equal(shouldBlockPipExit({ ...base, now: 2500 }), false);
  assert.equal(shouldBlockPipExit({ ...base, sinceUser: 200 }), false);
  assert.equal(shouldBlockPipExit({ ...base, internal: true }), false);
  assert.equal(shouldBlockPipExit({ ...base, isOn: false }), false);
  assert.equal(shouldBlockPipExit({ ...base, pipSince: 0 }), false);
});

test('pip(): webkitSetPresentationMode umschalten, Rückfall requestPictureInPicture, false ohne Video', () => {
  const win = { innerWidth: 400, innerHeight: 800, setTimeout: () => 0 };
  const calls = [];
  const v = fakeVideo({ webkitPresentationMode: 'inline', webkitSetPresentationMode(m) { calls.push(m); this.webkitPresentationMode = m; } });
  const doc = docOf([v]);
  assert.equal(togglePip(win, doc, createPipState()), true);
  assert.equal(togglePip(win, doc, createPipState()), true);
  assert.deepEqual(calls, ['picture-in-picture', 'inline']);

  let req = 0;
  const v2 = fakeVideo({ requestPictureInPicture() { req++; return Promise.resolve(); } });
  assert.equal(togglePip(win, docOf([v2]), createPipState()), true);
  assert.equal(req, 1);

  assert.equal(togglePip(win, docOf([]), createPipState()), false);
});

test('airplay(): Auswahl öffnen oder false', () => {
  const win = { innerWidth: 400, innerHeight: 800 };
  let n = 0;
  assert.equal(showAirplay(win, docOf([fakeVideo({ webkitShowPlaybackTargetPicker() { n++; } })])), true);
  assert.equal(n, 1);
  assert.equal(showAirplay(win, docOf([fakeVideo({})])), false);
  assert.equal(showAirplay(win, docOf([])), false);
});

test('prepareVideo: Bild-in-Bild-Sperre weg, playsinline gesetzt, Fernwiedergabe unberührt; aus = nichts tun', () => {
  const v = fakeVideo({ attrs: { disablepictureinpicture: '', disableremoteplayback: '' } });
  prepareVideo(v, () => true);
  assert.equal('disablepictureinpicture' in v.attrs, false);
  assert.equal('disableremoteplayback' in v.attrs, true);
  assert.equal(v.attrs.playsinline, '');
  assert.equal('x-webkit-airplay' in v.attrs, false);
  const w = fakeVideo({ attrs: { disablepictureinpicture: '' } });
  prepareVideo(w, () => false);
  assert.equal('disablepictureinpicture' in w.attrs, true);
});

test('Zustand: Titel ohne Suffix, Zähler, pip', () => {
  const v = fakeVideo({ paused: false, webkitPresentationMode: 'picture-in-picture' });
  const adState = createAdState();
  adState.adsBlocked = 4;
  const s = collectState({ innerWidth: 400, innerHeight: 800, location: { href: 'https://m.youtube.com/watch?v=1' } }, docOf([v]), adState);
  assert.deepEqual(s, { hasVideo: true, playing: true, pip: true, title: 'Titel', url: 'https://m.youtube.com/watch?v=1', adsBlocked: 4, menuButton: false, airplayMode: false, videoId: '1', listId: '', currentTime: 0 });
  assert.equal(isPipActive({}, null), false);
  const none = collectState({ location: { href: 'u' } }, docOf([]), null);
  assert.equal(none.hasVideo, false);
  assert.equal(none.playing, false);
});

test('Drosselung: höchstens ein Aufruf je 250 ms, am Ende kommt der letzte nach', () => {
  let t = 1000;
  const timers = [];
  let n = 0;
  const th = createThrottle(() => n++, 250, { now: () => t, setTimeout: (f, w) => (timers.push({ f, w }), timers.length) });
  th();
  assert.equal(n, 1);
  t += 50;
  th();
  th();
  assert.equal(n, 1);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].w, 200);
  t += 200;
  timers[0].f();
  assert.equal(n, 2);
  t += 300;
  th();
  assert.equal(n, 3);
});

test('Brücke: meldet nur mit Handler und nur bei Änderung', () => {
  const posted = [];
  const lis = {};
  const win = {
    innerWidth: 400,
    innerHeight: 800,
    location: { href: 'u' },
    addEventListener: (t, f) => ((lis[t] ||= []).push(f)),
    setInterval: () => 0,
  };
  const doc = docOf([], { addEventListener: (t, f) => ((lis[t] ||= []).push(f)) });
  // ohne Handler: nichts, kein Fehler
  assert.doesNotThrow(() => installBridge(win, doc, createAdState()));
  assert.equal(posted.length, 0);

  win.webkit = { messageHandlers: { flimmerfrei: { postMessage: (m) => posted.push(m) } } };
  const win2 = { ...win, addEventListener: win.addEventListener };
  const notify = installBridge(win2, doc, createAdState());
  assert.equal(posted.length, 1);
  assert.equal(posted[0].type, 'state');
  notify(); // gleicher Zustand -> keine neue Meldung
  assert.equal(posted.length, 1);
  assert.ok(lis['yt-navigate-finish'].length >= 1);
});
