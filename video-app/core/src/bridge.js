// Brücke zur App: Zustand sammeln und gedrosselt melden.
import { safeCall } from './config.js';
import { findActiveVideo, isPipActive } from './pip.js';

export const THROTTLE_MS = 250;

// Zustand laut Konzept 3.3/3.4 (ohne type).
export function collectState(win, doc, adState) {
  const v = safeCall(() => findActiveVideo(doc, { width: win.innerWidth, height: win.innerHeight }), null);
  let title = '';
  let url = '';
  safeCall(() => {
    title = String(doc.title || '').replace(/\s*-\s*YouTube\s*$/, '');
  });
  safeCall(() => {
    url = String(win.location.href);
  });
  return {
    hasVideo: !!v,
    playing: !!v && !v.paused && !v.ended,
    pip: isPipActive(doc, v),
    title: title,
    url: url,
    adsBlocked: adState ? adState.adsBlocked : 0,
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
export function installBridge(win, doc, adState) {
  const handlerOf = () => win.webkit?.messageHandlers?.flimmerfrei;
  let lastKey = '';
  const emit = function () {
    try {
      const h = handlerOf();
      if (!h || typeof h.postMessage !== 'function') return;
      const s = collectState(win, doc, adState);
      const key = JSON.stringify(s);
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
