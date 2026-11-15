import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanData, cleanResponse, createAdState, hasAdMarker, isAdItem, buildAdCss, AD_SELECTORS, skipAdStep, createSkipMemo, installJsonHooks, installInitialDataSetters } from '../src/adblock.js';

const video = (id) => ({ videoRenderer: { videoId: id } });

test('Player-Antwort: Werbe-Schlüssel werden entfernt, Rest bleibt', () => {
  const resp = {
    videoDetails: { videoId: 'abc' },
    streamingData: { formats: [{ itag: 18 }] },
    adPlacements: [{ adPlacementRenderer: {} }],
    adSlots: [{ adSlotRenderer: {} }],
    playerAds: [{ playerLegacyDesktopWatchAdsRenderer: {} }],
    adBreakHeartbeatParams: 'x',
    nested: { deep: { adPlacements: [1] } },
  };
  const state = createAdState();
  cleanResponse(resp, state);
  assert.deepEqual(Object.keys(resp).sort(), ['nested', 'streamingData', 'videoDetails']);
  assert.deepEqual(resp.nested, { deep: {} });
  assert.equal(resp.streamingData.formats[0].itag, 18);
  assert.equal(state.adsBlocked, 5);
});

test('Feed-Liste: Werbe-Renderer fliegen raus, auch verschachtelt', () => {
  const data = {
    contents: {
      twoColumnBrowseResultsRenderer: {
        tabs: [
          {
            tabRenderer: {
              content: {
                richGridRenderer: {
                  contents: [
                    { richItemRenderer: { content: video('a') } },
                    { richItemRenderer: { content: { adSlotRenderer: { x: 1 } } } },
                    { adSlotRenderer: { y: 1 } },
                    { richItemRenderer: { content: video('b') } },
                    { richItemRenderer: { content: { promotedSparklesWebRenderer: {} } } },
                  ],
                },
              },
            },
          },
        ],
      },
    },
  };
  const state = createAdState();
  cleanResponse(data, state);
  const list = data.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.richGridRenderer.contents;
  assert.equal(list.length, 2);
  assert.equal(list[0].richItemRenderer.content.videoRenderer.videoId, 'a');
  assert.equal(list[1].richItemRenderer.content.videoRenderer.videoId, 'b');
  assert.equal(state.adsBlocked, 3);
});

test('itemSectionRenderer.contents: Werbung raus, durch Entfernen leer gewordener Abschnitt ebenfalls', () => {
  const data = {
    sectionListRenderer: {
      contents: [
        { itemSectionRenderer: { contents: [video('1'), { compactPromotedVideoRenderer: {} }, { displayAdRenderer: {} }] } },
        { itemSectionRenderer: { contents: [{ mastheadAdRenderer: {} }] } },
        { itemSectionRenderer: { contents: [] } }, // von Anfang an leer: bleibt
        { itemSectionRenderer: { contents: [{ statementBannerRenderer: {} }, { inFeedAdLayoutRenderer: {} }, { bannerPromoRenderer: {} }] } },
      ],
    },
  };
  cleanResponse(data, createAdState());
  const c = data.sectionListRenderer.contents;
  assert.equal(c.length, 2);
  assert.equal(c[0].itemSectionRenderer.contents.length, 1);
  assert.deepEqual(c[1].itemSectionRenderer.contents, []);
});

test('isAdItem erkennt nur Werbung', () => {
  assert.equal(isAdItem({ adSlotRenderer: {} }), true);
  assert.equal(isAdItem({ richItemRenderer: { content: { promotedVideoRenderer: {} } } }), true);
  assert.equal(isAdItem(video('a')), false);
  assert.equal(isAdItem({ richItemRenderer: { content: video('a') } }), false);
  assert.equal(isAdItem(null), false);
  assert.equal(isAdItem('x'), false);
  assert.equal(isAdItem([]), false);
});

test('robust: Zyklen, falsche Typen, eingefrorene Objekte', () => {
  const a = { adPlacements: [1], list: [video('x')] };
  a.self = a;
  a.list.push(a);
  const r = cleanData(a);
  assert.equal(a.adPlacements, undefined);
  assert.ok(r.removed >= 1);

  for (const v of [null, undefined, 5, 'text', true]) assert.equal(cleanResponse(v, createAdState()), v);

  const frozen = Object.freeze({ adPlacements: [1], x: Object.freeze([{ adSlotRenderer: {} }]) });
  assert.doesNotThrow(() => cleanData(frozen));

  const getter = {};
  Object.defineProperty(getter, 'boom', { enumerable: true, get() { throw new Error('x'); } });
  getter.adSlots = [];
  assert.doesNotThrow(() => cleanData(getter));
  assert.equal(getter.adSlots, undefined);
});

test('robust: riesige und sehr tiefe Eingaben werden gebremst', () => {
  const big = { list: [] };
  for (let i = 0; i < 400000; i++) big.list.push({ i });
  big.list.push({ adSlotRenderer: {} });
  const t = Date.now();
  const r = cleanData(big);
  assert.equal(r.truncated, true);
  assert.ok(Date.now() - t < 5000);

  let deep = {};
  const root = deep;
  for (let i = 0; i < 100000; i++) {
    deep.n = {};
    deep = deep.n;
  }
  const r2 = cleanData(root);
  assert.equal(r2.truncated, true);
});

test('Vorprüfung am JSON-Text', () => {
  assert.equal(hasAdMarker('{"videoDetails":{"title":"nichts besonderes"}}'), false);
  assert.equal(hasAdMarker('{"a":1,"adPlacements":[]}'), true);
  assert.equal(hasAdMarker('{"x":{"adSlotRenderer":{}}}'), true);
  assert.equal(hasAdMarker(42), false);
  assert.equal(hasAdMarker(''), false);
});

test('CSS: jede Regel einzeln, Mobil- und Desktop-Selektoren vorhanden', () => {
  const css = buildAdCss();
  assert.equal(css.trim().split('\n').length, AD_SELECTORS.length);
  for (const s of ['ytm-promoted-sparkles-web-renderer', 'ytm-companion-ad-renderer', 'ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer', '#masthead-ad', '.ytp-ad-module', 'ytm-statement-banner-renderer']) {
    assert.ok(css.includes(s + '{display:none !important}'), s);
  }
});

test('Notausgang: stumm, ans Ende spulen, Überspringen drücken, danach zurück', () => {
  let clicked = 0;
  const vid = { muted: false, duration: 30, currentTime: 1 };
  const player = {
    querySelector(sel) {
      if (sel === 'video') return vid;
      if (sel === '.ytp-ad-skip-button') return { click() { clicked++; } };
      return null;
    },
  };
  let showing = true;
  const doc = { querySelector: () => (showing ? player : null) };
  const memo = createSkipMemo();
  assert.equal(skipAdStep(doc, memo), 'new');
  assert.equal(vid.muted, true);
  assert.ok(vid.currentTime > 29);
  assert.equal(clicked, 1);
  assert.equal(skipAdStep(doc, memo), 'active');
  showing = false;
  assert.equal(skipAdStep(doc, memo), 'idle');
  assert.equal(vid.muted, false);
});

test('JSON.parse-Einhängung: nur mit Marker, toString wirkt nativ, Fehler bleiben Fehler', () => {
  const fakeJSON = { parse: JSON.parse.bind(JSON) };
  Object.defineProperty(fakeJSON, 'parse', { value: function parse(t) { return JSON.parse(t); }, writable: true, configurable: true });
  const win = { JSON: fakeJSON };
  const state = createAdState();
  let on = true;
  installJsonHooks(win, () => on, state);
  assert.match(String(fakeJSON.parse), /\[native code\]/);
  assert.deepEqual(fakeJSON.parse('{"a":1,"adPlacements":[1],"b":{"adSlots":[]}}'), { a: 1, b: {} });
  assert.equal(state.adsBlocked, 2);
  assert.deepEqual(fakeJSON.parse('[1,2,3]'), [1, 2, 3]);
  assert.throws(() => fakeJSON.parse('{kaputt'), SyntaxError);
  on = false;
  assert.deepEqual(fakeJSON.parse('{"adPlacements":[1]}'), { adPlacements: [1] });
});

test('Start-Daten-Setter bereinigen beim Setzen', () => {
  const win = {};
  const state = createAdState();
  installInitialDataSetters(win, () => true, state);
  win.ytInitialPlayerResponse = { adPlacements: [1], keep: 1 };
  win.ytInitialData = { list: [video('z'), { adSlotRenderer: {} }] };
  assert.deepEqual(win.ytInitialPlayerResponse, { keep: 1 });
  assert.equal(win.ytInitialData.list.length, 1);
  assert.equal(state.adsBlocked, 2);
});
