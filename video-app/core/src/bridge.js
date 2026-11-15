// Brücke zur App: Zustand sammeln und gedrosselt melden.
import { safeCall } from './config.js';
import { findActiveVideo, isPipActive } from './pip.js';

export const THROTTLE_MS = 250;

function queryParam(query, name) {
  const parts = query.split('&');
  for (let i = 0; i < parts.length; i++) {
    const eq = parts[i].indexOf('=');
    const k = eq === -1 ? parts[i] : parts[i].slice(0, eq);
    if (k !== name) continue;
    const raw = eq === -1 ? '' : parts[i].slice(eq + 1).replace(/\+/g, ' ');
    try {
      return decodeURIComponent(raw);
    } catch (e) {
      return raw;
    }
  }
  return '';
}

// Video- und Listenkennung aus der Adresse: /watch?v=, /shorts/<id>, ?list=. Rein, ohne URL-Klasse.
export function parseVideoIds(href) {
  const out = { videoId: '', listId: '' };
  if (typeof href !== 'string') return out;
  let s = href.split('#')[0];
  const q = s.indexOf('?');
  const query = q === -1 ? '' : s.slice(q + 1);
  s = q === -1 ? s : s.slice(0, q);
  const m = s.match(/^(?:[a-z][a-z0-9+.-]*:)?(?:\/\/[^/]*)?(\/.*)?$/i);
  const path = (m && m[1]) || '/';
  const shorts = path.match(/^\/shorts\/([^/]+)/);
  if (shorts) out.videoId = shorts[1];
  else if (path === '/watch' || path === '/watch/') out.videoId = queryParam(query, 'v');
  out.listId = queryParam(query, 'list');
  return out;
}

// Zustand laut Konzept 3.3/3.4 (ohne type). menuButtonFn liefert, ob der Menü-Knopf in der Seite hängt.
export function collectState(win, doc, adState, menuButtonFn) {
  const v = safeCall(() => findActiveVideo(doc, { width: win.innerWidth, height: win.innerHeight }), null);
  let title = '';
  let url = '';
  safeCall(() => {
    title = String(doc.title || '').replace(/\s*-\s*YouTube\s*$/, '');
  });
  safeCall(() => {
    url = String(win.location.href);
  });
  const ids = parseVideoIds(url);
  return {
    hasVideo: !!v,
    playing: !!v && !v.paused && !v.ended,
    pip: isPipActive(doc, v),
    title: title,
    url: url,
    adsBlocked: adState ? adState.adsBlocked : 0,
    menuButton: !!safeCall(() => menuButtonFn && menuButtonFn(), false),
    videoId: ids.videoId,
    listId: ids.listId,
    currentTime: v && typeof v.currentTime === 'number' && isFinite(v.currentTime) ? v.currentTime : 0,
  };
}

// Verzögerung mit Trailing-Aufruf: höchstens ein Aufruf je ms. Zeitfunktionen einspeisbar (Tests).
export function createThrottle(fn, ms, deps) {
  const now = (deps && deps.now) || (() => Date.now());
  const setT = (deps && deps.setTimeout) || ((f, t) => setTimeout(f, t));
  let last = -Infinity;
  let timer = null;
  return function () {
    const t = now();
    const wait = ms - (t - last);
    if (wait <= 0) {
      last = t;
      fn();
    } else if (!timer) {
      timer = setT(function () {
        timer = null;
        last = now();
        fn();
      }, wait);
    }
  };
}

const BRIDGE_EVENTS = [
  'play',
  'pause',
  'playing',
  'ended',
  'emptied',
  'loadedmetadata',
  'enterpictureinpicture',
  'leavepictureinpicture',
  'webkitpresentationmodechanged',
];

// Meldet Änderungen, wenn window.webkit.messageHandlers.flimmerfrei existiert. Gibt notify() zurück.
export function installBridge(win, doc, adState, menuButtonFn) {
  const handlerOf = () => win.webkit?.messageHandlers?.flimmerfrei;
  let lastKey = '';
  const emit = function () {
    try {
      const h = handlerOf();
      if (!h || typeof h.postMessage !== 'function') return;
      const s = collectState(win, doc, adState, menuButtonFn);
      // currentTime allein löst keine Meldung aus
      const key = JSON.stringify(Object.assign({}, s, { currentTime: 0 }));
      if (key === lastKey) return;
      lastKey = key;
      h.postMessage(Object.assign({ type: 'state' }, s));
    } catch (e) {
      /* nie stören */
    }
  };
  const notify = createThrottle(emit, THROTTLE_MS);
  for (const t of BRIDGE_EVENTS) safeCall(() => doc.addEventListener(t, notify, true));
  for (const t of ['yt-navigate-finish', 'yt-page-data-updated']) {
    safeCall(() => doc.addEventListener(t, notify, true));
    safeCall(() => win.addEventListener(t, notify, true));
  }
  for (const t of ['popstate', 'hashchange']) safeCall(() => win.addEventListener(t, notify, true));
  // Langsamer Rückfall, falls ein Ereignis ausbleibt (Titel, Zähler)
  safeCall(() => win.setInterval(notify, 2000));
  if (adState) adState.onChange = notify;
  notify();
  return notify;
}
