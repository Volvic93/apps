// Werbeblocker: Antworten und Listen bereinigen, Flächen ausblenden, laufende Werbung überspringen.
import { makeNativeLike, safeCall } from './config.js';

// Schlüssel, die samt Inhalt entfernt werden.
export const AD_KEYS = ['adPlacements', 'adSlots', 'playerAds', 'adBreakHeartbeatParams'];

// Renderer, die Werbung sind; Listeneinträge mit solchem Inhalt fliegen raus.
export const AD_RENDERERS = [
  'adSlotRenderer',
  'promotedSparklesWebRenderer',
  'promotedVideoRenderer',
  'compactPromotedVideoRenderer',
  'displayAdRenderer',
  'inFeedAdLayoutRenderer',
  'statementBannerRenderer',
  'mastheadAdRenderer',
  'bannerPromoRenderer',
];

const AD_KEY_SET = new Set(AD_KEYS);
const AD_RENDERER_SET = new Set(AD_RENDERERS);
// 'adClientParams' kennzeichnet Shorts-Werbung (command.reelWatchEndpoint.adClientParams.isAd)
const AD_MARKERS = AD_KEYS.concat(AD_RENDERERS, ['adClientParams']);

// Bremsen gegen riesige oder verschachtelte Eingaben.
export const CLEAN_LIMITS = Object.freeze({ maxDepth: 64, maxNodes: 250000 });

// Schnelle Vorprüfung am JSON-Text: nur weitermachen, wenn ein Werbe-Name vorkommt.
export function hasAdMarker(text) {
  if (typeof text !== 'string' || text.length < 12) return false;
  for (let i = 0; i < AD_MARKERS.length; i++) {
    if (text.indexOf(AD_MARKERS[i]) !== -1) return true;
  }
  return false;
}

function hasOwn(o, k) {
  return Object.prototype.hasOwnProperty.call(o, k);
}

// Shorts-Werbung: o.command.reelWatchEndpoint.adClientParams.isAd
export function isReelAd(o) {
  if (!o || typeof o !== 'object') return false;
  const cmd = o.command;
  const ep = cmd && typeof cmd === 'object' ? cmd.reelWatchEndpoint : null;
  const p = ep && typeof ep === 'object' ? ep.adClientParams : null;
  return !!(p && typeof p === 'object' && p.isAd);
}

// Eintrag oder einer seiner direkten Renderer-Kinder ist eine Shorts-Werbung
function hasReelAd(o) {
  if (isReelAd(o)) return true;
  const keys = Object.keys(o);
  for (let i = 0; i < keys.length; i++) {
    const c = o[keys[i]];
    if (c && typeof c === 'object' && !Array.isArray(c) && isReelAd(c)) return true;
  }
  return false;
}

// Ist dieser Listeneintrag eine Werbung? (direkt oder in richItemRenderer.content)
export function isAdItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  if (hasReelAd(item)) return true;
  const keys = Object.keys(item);
  for (let i = 0; i < keys.length; i++) {
    if (AD_RENDERER_SET.has(keys[i])) return true;
  }
  const rich = item.richItemRenderer;
  if (rich && typeof rich === 'object') {
    const c = rich.content;
    if (c && typeof c === 'object') {
      const ck = Object.keys(c);
      for (let i = 0; i < ck.length; i++) {
        if (AD_RENDERER_SET.has(ck[i])) return true;
      }
      if (hasReelAd(c)) return true;
    }
  }
  return false;
}

// Bereinigt ein Objekt/Array an Ort und Stelle. Wirft nie. Gibt { removed, truncated } zurück.
export function cleanData(root, limits) {
  const lim = limits || CLEAN_LIMITS;
  const seen = new WeakSet();
  const emptied = new WeakSet();
  let removed = 0;
  let nodes = 0;
  let truncated = false;

  function walk(node, depth) {
    if (!node || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);
    if (++nodes > lim.maxNodes || depth > lim.maxDepth) {
      truncated = true;
      return;
    }
    if (Array.isArray(node)) {
      const before = node.length;
      // 1. Werbe-Einträge herausfiltern
      let w = 0;
      for (let r = 0; r < before; r++) {
        const it = node[r];
        if (isAdItem(it)) {
          removed++;
          continue;
        }
        if (w !== r) node[w] = it;
        w++;
      }
      if (w !== before) {
        node.length = w;
        if (w === 0) emptied.add(node);
      }
      // 2. Kinder bereinigen
      for (let i = 0; i < node.length; i++) walk(node[i], depth + 1);
      // 3. Abschnitte, die nur durch das Entfernen leer wurden, ebenfalls entfernen
      let w2 = 0;
      const n2 = node.length;
      for (let r = 0; r < n2; r++) {
        const it = node[r];
        const sec = it && typeof it === 'object' ? it.itemSectionRenderer : null;
        if (sec && typeof sec === 'object' && Array.isArray(sec.contents) && sec.contents.length === 0 && emptied.has(sec.contents)) {
          removed++;
          continue;
        }
        if (w2 !== r) node[w2] = it;
        w2++;
      }
      if (w2 !== n2) node.length = w2;
    } else {
      for (let i = 0; i < AD_KEYS.length; i++) {
        if (hasOwn(node, AD_KEYS[i]) && Reflect.deleteProperty(node, AD_KEYS[i])) removed++;
      }
      const keys = Object.keys(node);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (AD_RENDERER_SET.has(k)) {
          if (Reflect.deleteProperty(node, k)) removed++;
          continue;
        }
        if (AD_KEY_SET.has(k)) continue;
        let child;
        try {
          child = node[k];
        } catch (e) {
          continue;
        }
        walk(child, depth + 1);
      }
    }
  }

  try {
    walk(root, 0);
  } catch (e) {
    /* im Fehlerfall: was bis hierher entfernt wurde, bleibt; keine Ausnahme nach außen */
  }
  return { removed, truncated };
}

// Zähler für entfernte/übersprungene Werbung.
export function createAdState() {
  return {
    adsBlocked: 0, // Summe für die Schnittstelle
    dataRemoved: 0, // aus Daten entfernt
    adsSkipped: 0, // laufende Werbung übersprungen
    onChange: null,
  };
}

export function addBlocked(state, n, kind) {
  if (!state || !(n > 0)) return;
  state.adsBlocked += n;
  if (kind === 'skip') state.adsSkipped += n;
  else state.dataRemoved += n;
  if (typeof state.onChange === 'function') safeCall(state.onChange);
}

// Bereinigt ein Antwortobjekt (Player-Antwort, Feed, …) und zählt. Gibt dasselbe Objekt zurück.
export function cleanResponse(value, state, limits) {
  if (!value || typeof value !== 'object') return value;
  const r = cleanData(value, limits);
  if (r.removed > 0) addBlocked(state, r.removed);
  return value;
}

// ---- Ausblenden von Werbeflächen ----

export const AD_SELECTORS = [
  'ytm-promoted-sparkles-web-renderer',
  'ytm-promoted-video-renderer',
  'ytm-companion-ad-renderer',
  'ytm-statement-banner-renderer',
  'ytm-banner-promo-renderer',
  'ytd-ad-slot-renderer',
  'ytd-in-feed-ad-layout-renderer',
  'ytd-display-ad-renderer',
  'ytd-promoted-sparkles-web-renderer',
  'ytd-promoted-video-renderer',
  'ytd-banner-promo-renderer',
  'ytd-statement-banner-renderer',
  'ytd-companion-slot-renderer',
  'ytd-player-legacy-desktop-watch-ads-renderer',
  '#masthead-ad',
  '#player-ads',
  '.ytp-ad-module',
  '.ytp-ad-overlay-container',
  '.ytp-ad-image-overlay',
  '.video-ads',
];

// Jede Regel einzeln, damit ein unbekannter Selektor nicht alle anderen entwertet.
export function buildAdCss(selectors) {
  const list = selectors || AD_SELECTORS;
  let css = '';
  for (let i = 0; i < list.length; i++) css += list[i] + '{display:none !important}\n';
  return css;
}

export function installAdStyle(doc, isOn) {
  let style = null;
  const css = buildAdCss();
  const attach = function () {
    if (style) return true;
    const parent = doc.head || doc.documentElement;
    if (!parent) return false;
    style = doc.createElement('style');
    style.setAttribute('data-flimmerfrei', 'ads');
    style.textContent = isOn() ? css : '';
    parent.appendChild(style);
    return true;
  };
  if (!attach()) {
    try {
      doc.addEventListener('readystatechange', attach);
      doc.addEventListener('DOMContentLoaded', attach);
    } catch (e) {
      /* ignorieren */
    }
  }
  return {
    update() {
      if (style) style.textContent = isOn() ? css : '';
    },
  };
}

// ---- Notausgang: laufende Werbung überspringen ----

const SKIP_SELECTORS = [
  '.ytp-ad-skip-button',
  '.ytp-ad-skip-button-modern',
  '.ytp-skip-ad-button',
  '.ytp-ad-skip-button-container button',
];

export function createSkipMemo() {
  return { inAd: false, mutedByUs: false, prevMuted: false, prevRate: 1, video: null };
}

// Ein Schritt des Notausgangs. Rückgabe: 'new' (Werbung beginnt), 'active' (läuft), 'idle'.
export function skipAdStep(doc, memo) {
  const player = doc.querySelector('.html5-video-player.ad-showing, #movie_player.ad-showing');
  if (!player) {
    if (memo.mutedByUs && memo.video) {
      try {
        memo.video.muted = memo.prevMuted;
        memo.video.playbackRate = memo.prevRate;
      } catch (e) {
        /* ignorieren */
      }
    }
    memo.mutedByUs = false;
    memo.inAd = false;
    memo.video = null;
    return 'idle';
  }
  const v = player.querySelector('video');
  let result = 'active';
  if (!memo.inAd) {
    memo.inAd = true;
    result = 'new';
  }
  if (v) {
    if (!memo.mutedByUs) {
      memo.prevMuted = !!v.muted;
      memo.prevRate = typeof v.playbackRate === 'number' && v.playbackRate > 0 ? v.playbackRate : 1;
      memo.mutedByUs = true;
      memo.video = v;
    }
    try {
      v.muted = true;
      v.playbackRate = 16;
      const d = v.duration;
      if (typeof d === 'number' && isFinite(d) && d > 0 && v.currentTime < d - 0.1) v.currentTime = d - 0.05;
    } catch (e) {
      /* ignorieren */
    }
  }
  for (let i = 0; i < SKIP_SELECTORS.length; i++) {
    const btn = player.querySelector(SKIP_SELECTORS[i]);
    if (btn && typeof btn.click === 'function') {
      safeCall(function () {
        btn.click();
      });
      break;
    }
  }
  return result;
}

export function installAdSkipper(win, doc, isOn, state) {
  const memo = createSkipMemo();
  const tick = function () {
    try {
      if (!isOn()) {
        if (memo.inAd || memo.mutedByUs) skipAdStep({ querySelector: () => null }, memo);
        return;
      }
      if (skipAdStep(doc, memo) === 'new') addBlocked(state, 1, 'skip');
    } catch (e) {
      /* ignorieren */
    }
  };
  win.setInterval(tick, 150);
  return tick;
}

// ---- Einhängen in JSON.parse, Response.json und die Start-Daten ----

function replaceMethod(target, name, make) {
  const desc = Object.getOwnPropertyDescriptor(target, name);
  if (!desc || typeof desc.value !== 'function') return false;
  const wrapped = make(desc.value);
  makeNativeLike(wrapped, name);
  Object.defineProperty(target, name, {
    value: wrapped,
    writable: desc.writable !== false,
    configurable: true,
    enumerable: desc.enumerable === true,
  });
  return true;
}

export function installJsonHooks(win, isOn, state) {
  const J = win.JSON || JSON;
  try {
    replaceMethod(J, 'parse', function (orig) {
      return function parse(text, reviver) {
        const res = Reflect.apply(orig, this, arguments);
        try {
          if (res && typeof res === 'object' && isOn() && hasAdMarker(text)) cleanResponse(res, state);
        } catch (e) {
          /* Original zurückgeben */
        }
        return res;
      };
    });
  } catch (e) {
    /* Originalverhalten */
  }
  try {
    const proto = win.Response && win.Response.prototype;
    if (proto) {
      replaceMethod(proto, 'json', function (orig) {
        return function json() {
          const p = Reflect.apply(orig, this, arguments);
          let url = '';
          try {
            url = String(this.url || '');
          } catch (e) {
            /* ignorieren */
          }
          if (!p || typeof p.then !== 'function' || (url && url.indexOf('youtube') === -1)) return p;
          return p.then(function (v) {
            try {
              if (v && typeof v === 'object' && isOn()) cleanResponse(v, state);
            } catch (e) {
              /* ignorieren */
            }
            return v;
          });
        };
      });
    }
  } catch (e) {
    /* Originalverhalten */
  }
}

export function installInitialDataSetters(win, isOn, state) {
  const names = ['ytInitialPlayerResponse', 'ytInitialData'];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    try {
      const existing = Object.getOwnPropertyDescriptor(win, name);
      if (existing && existing.configurable === false) continue;
      let value = existing && 'value' in existing ? existing.value : undefined;
      if (value && typeof value === 'object' && isOn()) cleanResponse(value, state);
      Object.defineProperty(win, name, {
        configurable: true,
        enumerable: true,
        get: function () {
          return value;
        },
        set: function (v) {
          try {
            if (v && typeof v === 'object' && isOn()) cleanResponse(v, state);
          } catch (e) {
            /* Wert unverändert übernehmen */
          }
          value = v;
        },
      });
    } catch (e) {
      /* Originalverhalten */
    }
  }
}
