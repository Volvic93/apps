// Hintergrundwiedergabe: der Seite Sichtbarkeit vorspielen und ungewolltes Pausieren rückgängig machen.
import { makeNativeLike, safeCall } from './config.js';

const VISIBILITY_FAKE = {
  hidden: false,
  visibilityState: 'visible',
  webkitHidden: false,
  webkitVisibilityState: 'visible',
};

const VISIBILITY_PROPS = Object.keys(VISIBILITY_FAKE);

// Prototyp, auf dem die Sichtbarkeits-Eigenschaften liegen (nie Object.prototype anfassen).
export function getDocumentProto(win, doc) {
  const p = (win && win.Document && win.Document.prototype) || Object.getPrototypeOf(doc);
  return p && p !== Object.prototype ? p : null;
}

// Die echten Getter merken, BEVOR sie überschrieben werden.
export function captureRealVisibility(proto, doc) {
  const getters = {};
  if (proto) {
    for (const p of VISIBILITY_PROPS) {
      const d = safeCall(() => Object.getOwnPropertyDescriptor(proto, p), null);
      if (d && typeof d.get === 'function') getters[p] = d.get;
    }
  }
  return {
    isHidden() {
      try {
        if (getters.hidden) return !!getters.hidden.call(doc);
        if (getters.webkitHidden) return !!getters.webkitHidden.call(doc);
        if (getters.visibilityState) return getters.visibilityState.call(doc) === 'hidden';
        if (getters.webkitVisibilityState) return getters.webkitVisibilityState.call(doc) === 'hidden';
      } catch (e) {
        /* ignorieren */
      }
      return false;
    },
  };
}

// Überschreibt hidden/visibilityState/hasFocus; bei ausgeschalteter Funktion gilt der echte Wert.
export function installVisibilityFake(proto, isOn) {
  if (!proto) return;
  for (const p of VISIBILITY_PROPS) {
    try {
      const d = Object.getOwnPropertyDescriptor(proto, p);
      if (!d || typeof d.get !== 'function' || d.configurable === false) continue;
      const orig = d.get;
      const fake = VISIBILITY_FAKE[p];
      const getter = makeNativeLike(function () {
        return isOn() ? fake : orig.call(this);
      }, 'get ' + p);
      Object.defineProperty(proto, p, { get: getter, set: d.set, configurable: true, enumerable: d.enumerable });
    } catch (e) {
      /* Originalverhalten */
    }
  }
  try {
    const d = Object.getOwnPropertyDescriptor(proto, 'hasFocus');
    if (d && typeof d.value === 'function' && d.configurable !== false) {
      const orig = d.value;
      const fn = makeNativeLike(function hasFocus() {
        return isOn() ? true : Reflect.apply(orig, this, arguments);
      }, 'hasFocus');
      Object.defineProperty(proto, 'hasFocus', { value: fn, writable: true, configurable: true, enumerable: d.enumerable });
    }
  } catch (e) {
    /* Originalverhalten */
  }
}

// Sichtbarkeits-Ereignisse in der Fangphase stoppen, solange die Funktion aktiv ist.
export function installVisibilityEventBlock(win, doc, isOn) {
  const forDoc = function (e) {
    if (isOn() && e && e.target === doc) e.stopImmediatePropagation();
  };
  const forWin = function (e) {
    if (isOn() && e && e.target === win) e.stopImmediatePropagation();
  };
  for (const t of ['visibilitychange', 'webkitvisibilitychange']) {
    safeCall(() => doc.addEventListener(t, forDoc, true));
    safeCall(() => win.addEventListener(t, forDoc, true));
  }
  for (const t of ['blur', 'pagehide']) {
    safeCall(() => win.addEventListener(t, forWin, true));
  }
}

// Entscheidet, ob eine Pause rückgängig gemacht wird. Rein, mit eingespeisten Abhängigkeiten.
export function createResumeGuard(deps) {
  const maxTries = deps.maxTries || 3;
  const userWindowMs = deps.userWindowMs || 1500;
  const stableMs = deps.stableMs || 5000;
  let tries = 0;
  let playingSince = null;
  return {
    onPlaying() {
      playingSince = deps.now();
    },
    // Gibt den Grund zurück: 'resume' = Wiederaufnahme geplant, sonst Begründung für Verzicht.
    onPause(video) {
      if (!deps.isEnabled()) return 'off';
      if (!deps.isRealHidden()) return 'visible';
      if (video.ended) return 'ended';
      if (deps.sinceUser() < userWindowMs) return 'user';
      if (playingSince !== null && deps.now() - playingSince > stableMs) tries = 0;
      if (tries >= maxTries) return 'limit';
      tries++;
      deps.schedule(function () {
        if (video.paused && !video.ended && deps.isEnabled() && deps.isRealHidden()) deps.play(video);
      });
      return 'resume';
    },
    get tries() {
      return tries;
    },
  };
}

// Media-Session-Handler einwickeln, damit Sperrbildschirm-Aktionen als Nutzeraktion zählen.
export function installMediaSessionWatch(win, activity) {
  const proto = win.MediaSession && win.MediaSession.prototype;
  if (!proto) return;
  const d = Object.getOwnPropertyDescriptor(proto, 'setActionHandler');
  if (!d || typeof d.value !== 'function') return;
  const orig = d.value;
  const fn = makeNativeLike(function setActionHandler(action, handler) {
    let h = handler;
    if (typeof handler === 'function') {
      h = function () {
        activity.noteUser();
        return Reflect.apply(handler, this, arguments);
      };
    }
    return Reflect.apply(orig, this, [action, h]);
  }, 'setActionHandler');
  Object.defineProperty(proto, 'setActionHandler', { value: fn, writable: true, configurable: true, enumerable: d.enumerable });
}

export function installBackground(win, doc, isOn, activity) {
  const proto = getDocumentProto(win, doc);
  const real = captureRealVisibility(proto, doc);
  safeCall(() => installVisibilityFake(proto, isOn));
  safeCall(() => installVisibilityEventBlock(win, doc, isOn));
  safeCall(() => installMediaSessionWatch(win, activity));

  const guard = createResumeGuard({
    now: () => Date.now(),
    isEnabled: isOn,
    isRealHidden: () => real.isHidden(),
    sinceUser: () => activity.sinceUser(),
    schedule: (fn) => win.setTimeout(fn, 100 + Math.floor(Math.random() * 200)),
    play: (v) => {
      const p = safeCall(() => v.play());
      if (p && typeof p.catch === 'function') p.catch(function () {});
    },
  });
  const isVideo = (e) => e && e.target && String(e.target.tagName).toUpperCase() === 'VIDEO';
  safeCall(() =>
    doc.addEventListener('pause', (e) => {
      if (isVideo(e)) safeCall(() => guard.onPause(e.target));
    }, true)
  );
  safeCall(() =>
    doc.addEventListener('playing', (e) => {
      if (isVideo(e)) guard.onPlaying();
    }, true)
  );
  return { real, guard };
}
