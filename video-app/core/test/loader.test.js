import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let userCode = '';

before(() => {
  execFileSync(process.execPath, [join(root, 'build.mjs')], { cwd: root, stdio: 'pipe' });
  userCode = readFileSync(join(root, 'dist', 'flimmerfrei.user.js'), 'utf8');
});

// Nachgebaute Umgebung: ein gemeinsames document, zwei Kontexte (Userscript-Welt und Seiten-Welt).
// mode: 'ok' (Skripte laufen), 'throwOnString' (Trusted Types verlangen Objekt), 'ignore' (nichts läuft)
function setup(o) {
  const opts = Object.assign({ host: 'm.youtube.com', mode: 'ok', nonce: true, tt: false, readyState: 'loading', mo: true }, o);
  const log = { styles: [], scripts: [], listeners: {}, policies: [], observers: [] };
  const attrs = {};
  let pageCtx = null;

  class FakeScript {
    constructor() {
      this.tagName = 'SCRIPT';
      this.attrs = {};
      this.nonce = '';
      this.parentNode = null;
      this._text = undefined;
    }
    setAttribute(k, v) { this.attrs[k] = v; }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    set textContent(v) {
      if (opts.mode === 'throwOnString' && typeof v === 'string') throw new TypeError("requires 'TrustedScript' assignment");
      this._text = v;
    }
    get textContent() { return this._text; }
  }
  const nonceScript = { tagName: 'SCRIPT', nonce: 'abc123', getAttribute: () => '' };
  const state = { nonceScript: opts.nonce ? nonceScript : null };
  const head = {
    appendChild(n) {
      if (n instanceof FakeScript) {
        n.parentNode = head;
        log.scripts.push(n);
        if (opts.mode === 'ok') vm.runInContext(String(n._text), pageCtx);
      } else {
        log.styles.push(n);
      }
      return n;
    },
    removeChild(n) { n.parentNode = null; },
  };
  const doc = {
    title: 'Start - YouTube',
    readyState: opts.readyState,
    head,
    documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, hasAttribute: (k) => k in attrs, appendChild: head.appendChild },
    createElement: (t) => (t === 'script' ? new FakeScript() : { setAttribute() {}, textContent: '' }),
    querySelector: (s) => (s === 'script[nonce]' ? state.nonceScript : null),
    querySelectorAll: () => [],
    addEventListener: (t, f) => { (log.listeners[t] ||= []).push(f); },
  };

  function makeCtx(isLoader) {
    const sandbox = { document: doc, setTimeout: () => 0, setInterval: () => 0 };
    const ctx = vm.createContext(sandbox);
    const win = vm.runInContext('globalThis', ctx);
    win.window = win;
    win.innerWidth = 400;
    win.innerHeight = 800;
    win.location = { href: 'https://' + opts.host + '/', hostname: opts.host };
    win.addEventListener = () => {};
    if (isLoader && opts.mo) {
      win.MutationObserver = class {
        constructor(cb) { this.cb = cb; this.disconnected = false; log.observers.push(this); }
        observe() {}
        disconnect() { this.disconnected = true; }
      };
    }
    if (isLoader && opts.tt) {
      win.trustedTypes = {
        createPolicy(name, p) {
          log.policies.push(name);
          return { createScript: (x) => ({ __tt: true, toString: () => p.createScript(x) }) };
        },
      };
    }
    return { ctx, win };
  }
  const page = makeCtx(false);
  pageCtx = page.ctx;
  const loader = makeCtx(true);
  return { doc, attrs, log, state, page: page.win, loader: loader.win, run: () => vm.runInContext(userCode, loader.ctx), nonceScript };
}

test('Kopf: inject-into content', () => {
  assert.match(userCode, /^\/\/ @inject-into {2}content$/m);
  assert.match(userCode, /^\/\/ @version {6}0\.1\.1$/m);
});

test('Fall A: Seite lässt Skripte zu -> Kern läuft in der Seiten-Welt, genau einmal', () => {
  const e = setup({});
  e.run();
  assert.equal(e.log.scripts.length, 1);
  assert.equal(e.log.scripts[0].nonce, 'abc123');
  assert.equal(e.log.scripts[0].attrs.nonce, 'abc123');
  assert.equal(e.log.scripts[0].parentNode, null, 'Skript wieder entfernt');
  assert.equal(e.attrs['data-flimmerfrei'], '0.1.1');
  assert.ok(e.page.__flimmerfrei);
  assert.equal(e.loader.__flimmerfrei, undefined, 'kein zweiter Start im Userscript-Kontext');
  assert.equal(e.log.styles.length, 2, 'Stil-Elemente (Werbung, Aussehen) nur einmal');
  assert.equal(typeof e.log.scripts[0].textContent, 'string');
  assert.ok(e.log.scripts[0].textContent.startsWith('(function () {'));
  assert.ok(e.log.scripts[0].textContent.endsWith(')();'));
});

test('Fall B: blockiert (Zeichenkette wirft) -> Rückfall im Userscript-Kontext', () => {
  const e = setup({ mode: 'throwOnString' });
  e.run();
  assert.equal(e.page.__flimmerfrei, undefined);
  assert.ok(e.loader.__flimmerfrei);
  assert.equal(e.loader.__flimmerfrei.version, '0.1.1');
  assert.equal(e.log.styles.length, 2);
});

test('Fall B2: Skript wird eingefügt, aber nicht ausgeführt -> Rückfall', () => {
  const e = setup({ mode: 'ignore' });
  e.run();
  assert.equal(e.page.__flimmerfrei, undefined);
  assert.ok(e.loader.__flimmerfrei);
  assert.equal(e.log.scripts.length, 1);
});

test('Fall C: trustedTypes vorhanden -> Richtlinie wird einmal angelegt, ihr Ergebnis zugewiesen', () => {
  const e = setup({ tt: true, mode: 'throwOnString' });
  e.run();
  assert.deepEqual(e.log.policies, ['flimmerfrei-loader']);
  assert.equal(typeof e.log.scripts[0]._text, 'object');
  assert.equal(e.log.scripts[0]._text.__tt, true);
  assert.ok(String(e.log.scripts[0]._text).includes('data-flimmerfrei') || String(e.log.scripts[0]._text).length > 1000);
  // Objekt wurde angenommen -> zwar nicht ausgeführt (mode != ok), also Rückfall; Hauptsache nie die rohe Zeichenkette
  assert.ok(e.loader.__flimmerfrei);

  const ok = setup({ tt: true });
  ok.run();
  assert.equal(typeof ok.log.scripts[0]._text, 'object');
  assert.ok(ok.page.__flimmerfrei);
  assert.equal(ok.loader.__flimmerfrei, undefined);
});

test('Fall D: kein Skript mit Nonce beim Start -> wartet auf MutationObserver', () => {
  const e = setup({ nonce: false });
  e.run();
  assert.equal(e.log.scripts.length, 0);
  assert.equal(e.log.observers.length, 1);
  assert.equal(e.page.__flimmerfrei, undefined);
  e.log.observers[0].cb([]); // noch kein Nonce
  assert.equal(e.log.scripts.length, 0);
  e.state.nonceScript = e.nonceScript;
  e.log.observers[0].cb([]);
  assert.equal(e.log.scripts.length, 1);
  assert.equal(e.log.scripts[0].nonce, 'abc123');
  assert.ok(e.page.__flimmerfrei);
  assert.equal(e.log.observers[0].disconnected, true);
  // später nochmal ausgelöst: kein zweiter Versuch
  e.log.observers[0].cb([]);
  (e.log.listeners.DOMContentLoaded || []).forEach((f) => f());
  assert.equal(e.log.scripts.length, 1);
});

test('Fall D2: spätestens bei DOMContentLoaded ohne Nonce, genau ein Versuch', () => {
  const e = setup({ nonce: false, mo: false, mode: 'ignore' });
  e.run();
  assert.equal(e.log.scripts.length, 0);
  assert.equal(e.log.listeners.DOMContentLoaded.length, 1);
  e.log.listeners.DOMContentLoaded[0]();
  e.log.listeners.DOMContentLoaded[0]();
  assert.equal(e.log.scripts.length, 1);
  assert.equal(e.log.scripts[0].attrs.nonce, undefined);
  assert.ok(e.loader.__flimmerfrei, 'Rückfall nach dem Versuch');
});

test('Fall D3: Dokument schon geladen, kein Nonce -> sofort ein Versuch', () => {
  const e = setup({ nonce: false, readyState: 'interactive' });
  e.run();
  assert.equal(e.log.scripts.length, 1);
  assert.ok(e.page.__flimmerfrei);
});

test('Fall E: fremder Host -> der Lader tut nichts', () => {
  for (const host of ['accounts.google.com', 'accounts.youtube.com', 'youtube.com.evil.example', 'notyoutube.com', '']) {
    const e = setup({ host });
    e.run();
    assert.equal(e.log.scripts.length, 0, host);
    assert.equal(e.log.observers.length, 0, host);
    assert.equal(e.log.styles.length, 0, host);
    assert.equal(Object.keys(e.log.listeners).length, 0, host);
    assert.equal(e.loader.__flimmerfrei, undefined, host);
    assert.equal(e.page.__flimmerfrei, undefined, host);
    assert.equal('data-flimmerfrei' in e.attrs, false, host);
  }
});

test('Marke wird vom Kern gesetzt (auch ohne Lader)', () => {
  const inject = readFileSync(join(root, 'dist', 'flimmerfrei.inject.js'), 'utf8');
  const e = setup({});
  const ctx = vm.createContext({ document: e.doc, setTimeout: () => 0, setInterval: () => 0 });
  const win = vm.runInContext('globalThis', ctx);
  win.window = win;
  win.location = { href: 'https://www.youtube.com/', hostname: 'www.youtube.com' };
  win.addEventListener = () => {};
  vm.runInContext(inject, ctx);
  assert.equal(e.attrs['data-flimmerfrei'], '0.1.1');
  assert.ok(win.__flimmerfrei);
});

test('Marke: fehlt documentElement noch, wird sie nachgeholt', () => {
  const inject = readFileSync(join(root, 'dist', 'flimmerfrei.inject.js'), 'utf8');
  const attrs = {};
  const listeners = {};
  const doc = {
    documentElement: null,
    head: null,
    title: '',
    createElement: () => ({ setAttribute() {}, textContent: '' }),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (t, f) => { (listeners[t] ||= []).push(f); },
  };
  const ctx = vm.createContext({ document: doc, setTimeout: () => 0, setInterval: () => 0 });
  const win = vm.runInContext('globalThis', ctx);
  win.window = win;
  win.location = { href: 'https://www.youtube.com/', hostname: 'www.youtube.com' };
  win.addEventListener = () => {};
  vm.runInContext(inject, ctx);
  assert.equal('data-flimmerfrei' in attrs, false);
  doc.documentElement = { setAttribute: (k, v) => { attrs[k] = v; }, appendChild() {} };
  listeners.DOMContentLoaded.forEach((f) => f());
  assert.equal(attrs['data-flimmerfrei'], '0.1.1');
});
