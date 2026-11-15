// Bild-in-Bild und AirPlay: Sperren der Seite aufheben, Video finden, umschalten.
import { makeNativeLike, safeCall } from './config.js';

const PIP_ATTRS = ['disablepictureinpicture'];
const BLOCK_ATTRS = ['disablepictureinpicture', 'disableremoteplayback'];

export function hasSource(v) {
  return !!(v && (v.currentSrc || v.src || v.srcObject));
}

// Das aktive Video: sichtbar, größte Überschneidung mit dem Fenster, mit Quelle (Shorts zählen mit).
export function findActiveVideo(doc, viewport) {
  const list = Array.from(doc.querySelectorAll('video')).filter(hasSource);
  if (!list.length) return null;
  const vw = viewport && viewport.width > 0 ? viewport.width : Infinity;
  const vh = viewport && viewport.height > 0 ? viewport.height : Infinity;
  let best = null;
  let bestScore = 0;
  for (const v of list) {
    const r = safeCall(() => v.getBoundingClientRect(), null);
    if (!r) continue;
    const w = Math.min(r.right, vw) - Math.max(r.left, 0);
    const h = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    const score = w > 0 && h > 0 ? w * h : 0;
    if (score > bestScore || (score > 0 && score === bestScore && best && best.paused && !v.paused)) {
      best = v;
      bestScore = score;
    }
  }
  if (best) return best;
  // Rückfall (z. B. Seite verborgen): ein laufendes Video, sonst das erste
  return list.find((v) => !v.paused) || list[0];
}

export function isPipActive(doc, v) {
  if (!v) return false;
  return v.webkitPresentationMode === 'picture-in-picture' || doc.pictureInPictureElement === v;
}

export function createPipState() {
  return { pipSince: 0, internal: false };
}

// Soll ein Beenden von Bild-in-Bild durch die Seite unterbunden werden?
export function shouldBlockPipExit(o) {
  return !!(o.isOn && !o.internal && o.pipSince > 0 && o.now - o.pipSince < 1000 && o.sinceUser > 1000);
}

// Bild-in-Bild für das aktive Video umschalten. true = ausgeführt, false = kein Video.
export function togglePip(win, doc, pipState) {
  const v = findActiveVideo(doc, { width: win.innerWidth, height: win.innerHeight });
  if (!v) return false;
  pipState.internal = true;
  try {
    if (typeof v.webkitSetPresentationMode === 'function') {
      v.webkitSetPresentationMode(v.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
    } else if (doc.pictureInPictureElement === v && typeof doc.exitPictureInPicture === 'function') {
      swallow(doc.exitPictureInPicture());
    } else if (typeof v.requestPictureInPicture === 'function') {
      swallow(v.requestPictureInPicture());
    } else {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  } finally {
    win.setTimeout(function () {
      pipState.internal = false;
    }, 1200);
  }
}

function swallow(p) {
  if (p && typeof p.catch === 'function') p.catch(function () {});
}

// AirPlay-Auswahl öffnen. true = angefordert, false = nicht möglich.
export function showAirplay(win, doc) {
  const v = findActiveVideo(doc, { width: win.innerWidth, height: win.innerHeight });
  if (!v || typeof v.webkitShowPlaybackTargetPicker !== 'function') return false;
  try {
    v.webkitShowPlaybackTargetPicker();
    return true;
  } catch (e) {
    return false;
  }
}

// Standard: nur Bild-in-Bild freigeben und playsinline setzen. disableremoteplayback bleibt unberührt
// (WebKit verlangt es für ManagedMediaSource). Im AirPlay-Modus zusätzlich Fernwiedergabe/AirPlay erlauben.
export function prepareVideo(v, isOn, airplayMode) {
  try {
    if (!isOn() || !v || typeof v.setAttribute !== 'function') return;
    const attrs = airplayMode ? BLOCK_ATTRS : PIP_ATTRS;
    for (const a of attrs) {
      if (v.hasAttribute(a)) v.removeAttribute(a);
    }
    safeCall(() => {
      v.disablePictureInPicture = false;
    });
    if (v.getAttribute('playsinline') === null) v.setAttribute('playsinline', '');
    if (airplayMode) {
      safeCall(() => {
        v.disableRemotePlayback = false;
      });
      if (v.getAttribute('x-webkit-airplay') !== 'allow') v.setAttribute('x-webkit-airplay', 'allow');
    }
  } catch (e) {
    /* ignorieren */
  }
}

export function scanVideos(doc, isOn, airplayMode) {
  safeCall(() => {
    for (const v of Array.from(doc.querySelectorAll('video'))) prepareVideo(v, isOn, airplayMode);
  });
}

// Neue <video>-Elemente per MutationObserver (und Wiedergabe-Ereignissen) vorbereiten.
export function installVideoObserver(win, doc, isOn, airplayMode) {
  let scheduled = false;
  const scan = function () {
    scheduled = false;
    scanVideos(doc, isOn, airplayMode);
  };
  const MO = win.MutationObserver;
  if (typeof MO === 'function') {
    const mo = new MO(function (muts) {
      for (const m of muts) {
        if (m.type === 'attributes') {
          prepareVideo(m.target, isOn, airplayMode);
        } else if (!scheduled) {
          scheduled = true;
          win.setTimeout(scan, 200);
        }
      }
    });
    mo.observe(doc, { childList: true, subtree: true, attributes: true, attributeFilter: airplayMode ? BLOCK_ATTRS : PIP_ATTRS });
  }
  const onMedia = function (e) {
    if (e && e.target && String(e.target.tagName).toUpperCase() === 'VIDEO') prepareVideo(e.target, isOn, airplayMode);
  };
  for (const t of ['loadstart', 'loadedmetadata', 'play']) safeCall(() => doc.addEventListener(t, onMedia, true));
  scanVideos(doc, isOn, airplayMode);
  return scan;
}

// Sperren der Seite gegen Bild-in-Bild aufheben (Eigenschaft, vorzeitiges Beenden).
export function installPipGuards(win, doc, isOn, activity, pipState) {
  // disablePictureInPicture soll immer false bleiben
  safeCall(() => {
    const proto = win.HTMLVideoElement && win.HTMLVideoElement.prototype;
    const d = proto && Object.getOwnPropertyDescriptor(proto, 'disablePictureInPicture');
    if (d && d.configurable && d.get) {
      Object.defineProperty(proto, 'disablePictureInPicture', {
        configurable: true,
        enumerable: d.enumerable,
        get: makeNativeLike(function () {
          return isOn() ? false : d.get.call(this);
        }, 'get disablePictureInPicture'),
        set: makeNativeLike(function (v) {
          if (!isOn() && d.set) d.set.call(this, v);
        }, 'set disablePictureInPicture'),
      });
    }
  });

  const block = () =>
    shouldBlockPipExit({
      isOn: isOn(),
      internal: pipState.internal,
      pipSince: pipState.pipSince,
      now: Date.now(),
      sinceUser: activity.sinceUser(),
    });

  // Eintritt/Austritt merken
  const onMode = function (e) {
    const v = e && e.target;
    if (!v) return;
    const inPip = v.webkitPresentationMode === 'picture-in-picture' || (doc.pictureInPictureElement && doc.pictureInPictureElement === v);
    pipState.pipSince = inPip ? Date.now() : 0;
  };
  for (const t of ['webkitpresentationmodechanged', 'enterpictureinpicture', 'leavepictureinpicture']) {
    safeCall(() => doc.addEventListener(t, onMode, true));
  }

  // Die Seite darf Bild-in-Bild nicht sofort wieder beenden.
  safeCall(() => {
    const proto = win.HTMLVideoElement && win.HTMLVideoElement.prototype;
    const d = proto && Object.getOwnPropertyDescriptor(proto, 'webkitSetPresentationMode');
    if (d && typeof d.value === 'function') {
      const orig = d.value;
      Object.defineProperty(proto, 'webkitSetPresentationMode', {
        value: makeNativeLike(function webkitSetPresentationMode(mode) {
          if (mode === 'inline' && this.webkitPresentationMode === 'picture-in-picture' && block()) return undefined;
          return Reflect.apply(orig, this, arguments);
        }, 'webkitSetPresentationMode'),
        writable: true,
        configurable: true,
        enumerable: d.enumerable,
      });
    }
  });
  safeCall(() => {
    const proto = win.Document && win.Document.prototype;
    const d = proto && Object.getOwnPropertyDescriptor(proto, 'exitPictureInPicture');
    if (d && typeof d.value === 'function') {
      const orig = d.value;
      Object.defineProperty(proto, 'exitPictureInPicture', {
        value: makeNativeLike(function exitPictureInPicture() {
          if (block()) return Promise.resolve();
          return Reflect.apply(orig, this, arguments);
        }, 'exitPictureInPicture'),
        writable: true,
        configurable: true,
        enumerable: d.enumerable,
      });
    }
  });
}

// Aktives Video anhalten; zählt als Nutzeraktion, damit die Wiederaufnahme es nicht neu startet.
export function pauseActive(win, doc, activity) {
  const v = findActiveVideo(doc, { width: win.innerWidth, height: win.innerHeight });
  if (!v) return false;
  if (activity) activity.noteUser();
  try {
    v.pause();
    return true;
  } catch (e) {
    return false;
  }
}
