import test from 'node:test';
import assert from 'node:assert/strict';
import { captureRealVisibility, installVisibilityFake, installVisibilityEventBlock, createResumeGuard, getDocumentProto } from '../src/background.js';

// Nachgebautes Document mit echten Getter auf dem Prototyp
class FakeDocument {
  constructor() {
    this._hidden = true;
    this.focus = false;
  }
  get hidden() { return this._hidden; }
  get visibilityState() { return this._hidden ? 'hidden' : 'visible'; }
  get webkitHidden() { return this._hidden; }
  get webkitVisibilityState() { return this._hidden ? 'hidden' : 'visible'; }
  hasFocus() { return this.focus; }
}

test('Sichtbarkeit: Seite sieht "sichtbar", echter Wert bleibt über den alten Getter lesbar', () => {
  const doc = new FakeDocument();
  const win = { Document: FakeDocument };
  const proto = getDocumentProto(win, doc);
  const real = captureRealVisibility(proto, doc);
  let on = true;
  installVisibilityFake(proto, () => on);

  assert.equal(doc.hidden, false);
  assert.equal(doc.visibilityState, 'visible');
  assert.equal(doc.webkitHidden, false);
  assert.equal(doc.webkitVisibilityState, 'visible');
  assert.equal(doc.hasFocus(), true);
  assert.equal(real.isHidden(), true);
  assert.match(String(Object.getOwnPropertyDescriptor(proto, 'hidden').get), /native code/);

  // ausgeschaltet: echter Wert
  on = false;
  assert.equal(doc.hidden, true);
  assert.equal(doc.visibilityState, 'hidden');
  assert.equal(doc.hasFocus(), false);

  // echte Änderung sichtbar
  doc._hidden = false;
  assert.equal(real.isHidden(), false);
});

test('getDocumentProto fasst Object.prototype nie an', () => {
  assert.equal(getDocumentProto({}, {}), null);
});

test('Ereignisse: visibilitychange/blur/pagehide werden gestoppt, solange aktiv', () => {
  const docL = {};
  const winL = {};
  const doc = { addEventListener: (t, f, c) => ((docL[t] ||= []).push({ f, c })) };
  const win = { addEventListener: (t, f, c) => ((winL[t] ||= []).push({ f, c })) };
  let on = true;
  installVisibilityEventBlock(win, doc, () => on);
  const mk = (target) => {
    const e = { target, stopped: 0, stopImmediatePropagation() { this.stopped++; } };
    return e;
  };
  const run = (reg, type, e) => (reg[type] || []).forEach((l) => { assert.equal(l.c, true); l.f(e); });
  let e = mk(doc);
  run(docL, 'visibilitychange', e);
  assert.ok(e.stopped >= 1);
  e = mk(win);
  run(winL, 'blur', e);
  assert.equal(e.stopped, 1);
  // blur eines Eingabefelds (Ziel != window) bleibt unberührt
  e = mk({});
  run(winL, 'blur', e);
  assert.equal(e.stopped, 0);
  on = false;
  e = mk(doc);
  run(docL, 'visibilitychange', e);
  assert.equal(e.stopped, 0);
});

function makeGuard(over) {
  const s = { t: 10000, hidden: true, user: 99999, on: true, plays: 0, queue: [] };
  const guard = createResumeGuard(
    Object.assign(
      {
        now: () => s.t,
        isEnabled: () => s.on,
        isRealHidden: () => s.hidden,
        sinceUser: () => s.user,
        schedule: (fn) => s.queue.push(fn),
        play: () => { s.plays++; },
      },
      over
    )
  );
  return { s, guard };
}

test('Wiederaufnahme: unbeabsichtigte Pause im Hintergrund wird rückgängig gemacht', () => {
  const { s, guard } = makeGuard();
  const v = { paused: true, ended: false };
  assert.equal(guard.onPause(v), 'resume');
  s.queue.shift()();
  assert.equal(s.plays, 1);
});

test('Wiederaufnahme: keine bei Nutzer-Pause, sichtbarer Seite, Ende, aus', () => {
  const v = { paused: true, ended: false };
  let g = makeGuard();
  g.s.user = 500;
  assert.equal(g.guard.onPause(v), 'user');
  g = makeGuard();
  g.s.hidden = false;
  assert.equal(g.guard.onPause(v), 'visible');
  g = makeGuard();
  assert.equal(g.guard.onPause({ paused: true, ended: true }), 'ended');
  g = makeGuard();
  g.s.on = false;
  assert.equal(g.guard.onPause(v), 'off');
  assert.equal(g.s.queue.length, 0);
});

test('Wiederaufnahme: höchstens 3 Versuche je Pause', () => {
  const { s, guard } = makeGuard();
  const v = { paused: true, ended: false };
  const r = [];
  for (let i = 0; i < 5; i++) {
    s.t += 100;
    r.push(guard.onPause(v));
  }
  assert.deepEqual(r, ['resume', 'resume', 'resume', 'limit', 'limit']);
  // nach 5 s stabiler Wiedergabe beginnt es von vorn
  guard.onPlaying();
  s.t += 6000;
  assert.equal(guard.onPause(v), 'resume');
});

test('Wiederaufnahme: abgebrochen, wenn inzwischen wieder gespielt wird', () => {
  const { s, guard } = makeGuard();
  const v = { paused: true, ended: false };
  guard.onPause(v);
  v.paused = false;
  s.queue.shift()();
  assert.equal(s.plays, 0);
});
