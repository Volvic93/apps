import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeConfig, createConfigStore, VERSION, DEFAULT_CONFIG } from '../src/config.js';
import { userscriptHeader, UPDATE_URL, bundleModules, MODULES } from '../build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

test('package.json: Version, Modultyp, Skripte, keine Abhängigkeiten', () => {
  assert.equal(pkg.version, '0.1.3');
  assert.equal(pkg.type, 'module');
  assert.ok(pkg.scripts.build && pkg.scripts.test);
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
  assert.equal(VERSION, pkg.version);
});

test('Einstellungen: Standard, Teilangaben, falsche Typen', () => {
  assert.deepEqual(normalizeConfig(undefined), { adblock: true, background: true, pipFix: true, look: true, playerButtons: true, menuButton: true, limited: false, airplayMode: false, host: 'userscript' });
  assert.deepEqual(normalizeConfig({ background: false, host: 'ios' }), { ...DEFAULT_CONFIG, background: false, host: 'ios' });
  assert.deepEqual(normalizeConfig({ adblock: 'nein', host: 5 }), { ...DEFAULT_CONFIG });
  assert.deepEqual(normalizeConfig('x'), { ...DEFAULT_CONFIG });
});

test('setConfig im Betrieb: Teiländerung, Beobachter', () => {
  const store = createConfigStore({ host: 'ios' });
  let seen = 0;
  store.subscribe(() => seen++);
  const r = store.set({ background: false });
  assert.equal(r.background, false);
  assert.equal(store.get().background, false);
  assert.equal(store.get().adblock, true);
  assert.equal(store.get().host, 'ios');
  store.set({ background: true });
  assert.equal(store.get().background, true);
  assert.equal(seen, 2);
  store.subscribe(() => { throw new Error('x'); });
  assert.doesNotThrow(() => store.set({}));
});

test('Userscript-Kopf laut Konzept 3.1', () => {
  const h = userscriptHeader('0.1.3');
  assert.ok(h.startsWith('// ==UserScript==\n'));
  assert.ok(h.trimEnd().endsWith('// ==/UserScript=='));
  const get = (k) => (h.match(new RegExp('^// @' + k + '\\s+(.*)$', 'm')) || [])[1];
  assert.equal(get('name'), 'Flimmerfrei');
  assert.equal(get('version'), '0.1.3');
  assert.equal(get('match'), 'https://*.youtube.com/*');
  assert.equal(get('run-at'), 'document-start');
  assert.equal(get('grant'), 'none');
  assert.equal(get('inject-into'), 'content');
  assert.equal(get('downloadURL'), 'https://volvic93.github.io/apps/video-app/flimmerfrei.user.js');
  assert.equal(get('updateURL'), UPDATE_URL);
});

test('Bündelung: doppelte Namen und fehlende Importe werden erkannt', () => {
  const src = {};
  for (const m of MODULES) src[m] = readFileSync(join(root, 'src', m + '.js'), 'utf8');
  assert.doesNotThrow(() => bundleModules(src, '0.1.3'));
  assert.throws(() => bundleModules({ ...src, pip: src.pip + '\nfunction hasSource() {}\n' }, '0.1.3'), /Doppelter Name/);
  assert.throws(() => bundleModules({ ...src, bridge: "import { gibtEsNicht } from './x.js';\n" + src.bridge }, '0.1.3'), /nirgends/);
});

// ---- Regeldatei ----

const rules = JSON.parse(readFileSync(join(root, 'rules', 'content-blocker.json'), 'utf8'));

test('Regeldatei: gültige Struktur, höchstens 200 Regeln', () => {
  assert.ok(Array.isArray(rules));
  assert.ok(rules.length > 0 && rules.length <= 200);
  for (const r of rules) {
    assert.equal(typeof r.trigger['url-filter'], 'string');
    assert.ok(['block', 'css-display-none'].includes(r.action.type));
    if (r.action.type === 'css-display-none') assert.equal(typeof r.action.selector, 'string');
  }
});

test('Regeldatei: nur ASCII, keine verbotenen Muster in url-filter', () => {
  const text = readFileSync(join(root, 'rules', 'content-blocker.json'), 'utf8');
  assert.ok(/^[\x00-\x7f]*$/.test(text), 'Nicht-ASCII-Zeichen');
  assert.equal(text.includes('|'), false, 'kein senkrechter Strich irgendwo');
  for (const r of rules) {
    const f = r.trigger['url-filter'];
    assert.equal(/\{\d*,?\d*\}/.test(f), false, 'keine {n}: ' + f);
    assert.equal(/\\[dwsDWSb]/.test(f), false, 'keine Kürzel: ' + f);
    assert.equal(f.includes('|'), false);
  }
});

test('Regeldatei: sperrt Werbung, lässt Wiedergabe/Anmeldung/Bilder frei', () => {
  const blocks = rules.filter((r) => r.action.type === 'block').map((r) => new RegExp(r.trigger['url-filter'], 'i'));
  const blocked = (u) => blocks.some((re) => re.test(u));
  for (const u of [
    'https://googleads.g.doubleclick.net/pagead/id',
    'https://pagead2.googlesyndication.com/x.js',
    'https://www.googleadservices.com/pagead/conversion',
    'https://m.youtube.com/pagead/adview?x=1',
    'https://www.youtube.com/api/stats/ads?ver=2',
    'https://www.youtube.com/ptracking?x=1',
    'https://www.youtube.com/get_midroll_info?x=1',
  ]) assert.equal(blocked(u), true, u);
  for (const u of [
    'https://rr3---sn-abc.googlevideo.com/videoplayback?x=1',
    'https://i.ytimg.com/vi/abc/hqdefault.jpg',
    'https://accounts.google.com/ServiceLogin',
    'https://m.youtube.com/youtubei/v1/player?key=1',
    'https://m.youtube.com/watch?v=abc',
    'https://www.youtube.com/s/player/base.js',
    'https://yt3.ggpht.com/a.jpg',
    'https://www.gstatic.com/x.js',
  ]) assert.equal(blocked(u), false, u);
  // Ausblend-Regel nur für YouTube
  const hide = rules.find((r) => r.action.type === 'css-display-none');
  assert.deepEqual(hide.trigger['if-domain'], ['*youtube.com']);
});

// ---- Host-Prüfung und Anmeldung (Konzept 5a) ----

import { isYouTubeHost } from '../src/config.js';

test('isYouTubeHost: nur youtube.com/youtube-nocookie.com samt Unterdomänen', () => {
  for (const h of ['m.youtube.com', 'www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'YouTube.com', 'm.youtube.com.']) {
    assert.equal(isYouTubeHost(h), true, h);
  }
  for (const h of ['accounts.google.com', 'accounts.youtube.com.evil.example', 'notyoutube.com', 'youtube.com.evil.example', 'evil-youtube.com', 'accounts.youtube.com', 'consent.youtube.com', 'google.com', '', null, undefined, 5]) {
    assert.equal(isYouTubeHost(h), false, String(h));
  }
});

const LOGIN_URLS = [
  'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fm.youtube.com%2F',
  'https://accounts.google.com/v3/signin/identifier?continue=x',
  'https://accounts.google.de/signin/v2/challenge/pwd',
  'https://accounts.youtube.com/accounts/CheckCookie?continue=x',
  'https://accounts.youtube.com/accounts/SetSID?ssdc=1',
  'https://myaccount.google.com/',
  'https://consent.google.com/m?continue=x',
  'https://consent.youtube.com/m?continue=x',
  'https://www.gstatic.com/_/mss/boq-identity/x.js',
  'https://ssl.gstatic.com/accounts/ui/avatar_2x.png',
  'https://lh3.googleusercontent.com/a/abc=s96-c',
  'https://www.google.com/accounts/SetSID?x=1',
  'https://m.youtube.com/signin?action_handle_signin=true',
  'https://www.youtube.com/signin',
  'https://m.youtube.com/youtubei/v1/account/account_menu',
];
const PLAYBACK_URLS = [
  'https://rr3---sn-abc.googlevideo.com/videoplayback?expire=1&ei=2',
  'https://i.ytimg.com/vi/x/hqdefault.jpg',
  'https://m.youtube.com/youtubei/v1/player?prettyPrint=false',
  'https://m.youtube.com/youtubei/v1/browse?prettyPrint=false',
  'https://www.youtube.com/s/player/abc/player_ias.vflset/de_DE/base.js',
  'https://yt3.ggpht.com/a.jpg',
];
const AD_URLS = [
  'https://googleads.g.doubleclick.net/pagead/id',
  'https://static.doubleclick.net/instream/ad_status.js',
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
  'https://tpc.googlesyndication.com/simgad/1',
  'https://www.googleadservices.com/pagead/conversion/1/',
  'https://www.googletagservices.com/tag/js/gpt.js',
  'https://s0.2mdn.net/ads/x.js',
  'https://adservice.google.com/adsid/google/ui',
  'https://www.youtube.com/pagead/adview?ai=1',
  'https://m.youtube.com/api/stats/ads?ver=2&ad_cpn=x',
  'https://www.youtube.com/ptracking?pltype=adhost',
  'https://www.youtube.com/get_midroll_info?video_id=x',
];

test('Regeldatei: keine Regel trifft Anmelde- oder Wiedergabe-Adressen', () => {
  const res = rules.map((r) => [r, new RegExp(r.trigger['url-filter'], 'i')]);
  for (const u of LOGIN_URLS.concat(PLAYBACK_URLS)) {
    for (const [r, re] of res) {
      if (r.action.type !== 'block') continue; // Ausblend-Regel betrifft nur Seitenelemente auf YouTube
      assert.equal(re.test(u), false, re.source + ' trifft ' + u);
    }
  }
});

test('Regeldatei: jede echte Werbe-Adresse wird von mindestens einer Sperr-Regel getroffen', () => {
  const blocks = rules.filter((r) => r.action.type === 'block').map((r) => new RegExp(r.trigger['url-filter'], 'i'));
  for (const u of AD_URLS) assert.equal(blocks.some((re) => re.test(u)), true, u);
});

test('Regeldatei: Ausblend-Regel nur für YouTube-Domains, kein Anmelde-Host', () => {
  for (const r of rules) {
    const d = r.trigger['if-domain'];
    if (!d) continue;
    for (const x of d) assert.match(x, /youtube\.com$/);
    assert.equal(d.some((x) => /accounts/.test(x)), false);
  }
});
