// Gemeinsame Grundlagen: Einstellungen, Nutzeraktivität, kleine Hilfen.

export const VERSION = '0.1.2';

export const DEFAULT_CONFIG = Object.freeze({
  adblock: true,
  background: true,
  pipFix: true,
  look: true,
  playerButtons: true,
  menuButton: true,
  limited: false, // vom Lader gesetzt: Kern läuft im Kontext des Userscripts
  airplayMode: false, // wirkt nur beim Start der Seite
  host: 'userscript',
});

const BOOL_KEYS = ['adblock', 'background', 'pipFix', 'look', 'playerButtons', 'menuButton', 'limited', 'airplayMode'];

// Rohwerte (von der Hülle gesetzt) mit dem Standard zusammenführen; unbekannte/falsche Typen fallen auf die Basis zurück.
export function normalizeConfig(raw, base = DEFAULT_CONFIG) {
  const out = { host: base.host };
  for (const k of BOOL_KEYS) out[k] = base[k];
  if (raw && typeof raw === 'object') {
    for (const k of BOOL_KEYS) {
      if (typeof raw[k] === 'boolean') out[k] = raw[k];
    }
    if (raw.host === 'ios' || raw.host === 'userscript') out.host = raw.host;
  }
  return out;
}

// Einstellungsspeicher; Einhängungen fragen get() bei jedem Aufruf neu ab.
export function createConfigStore(raw) {
  let cfg = normalizeConfig(raw);
  const listeners = [];
  return {
    get() {
      return cfg;
    },
    set(part) {
      // airplayMode und limited gelten nur beim Start, nicht im Betrieb
      let p = part;
      if (p && typeof p === 'object') {
        p = Object.assign({}, p);
        delete p.airplayMode;
        delete p.limited;
      }
      cfg = normalizeConfig(p, cfg);
      for (const fn of listeners.slice()) {
        try {
          fn(cfg);
        } catch (e) {
          /* Beobachter dürfen nie stören */
        }
      }
      return Object.assign({}, cfg);
    },
    subscribe(fn) {
      listeners.push(fn);
    },
  };
}

// Ersetzte Funktion soll bei toString wie nativ aussehen.
export function makeNativeLike(fn, name) {
  try {
    const text = 'function ' + name + '() { [native code] }';
    Object.defineProperty(fn, 'toString', {
      value: function toString() {
        return text;
      },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(fn, 'name', { value: name, configurable: true });
  } catch (e) {
    /* ignorieren */
  }
  return fn;
}

// Führt fn aus und gibt im Fehlerfall den Rückfallwert zurück.
export function safeCall(fn, fallback) {
  try {
    return fn();
  } catch (e) {
    return fallback;
  }
}

// Merkt, wann zuletzt der Nutzer etwas getan hat (Berührung, Taste, Media-Session-Aktion).
export function createUserActivity(now) {
  let last = -Infinity;
  return {
    noteUser() {
      last = now();
    },
    sinceUser() {
      return now() - last;
    },
  };
}

const ACTIVITY_EVENTS = ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'keydown', 'click'];

export function installActivityTracking(doc, activity) {
  const handler = function (e) {
    if (e && e.isTrusted === false) return;
    activity.noteUser();
  };
  for (const t of ACTIVITY_EVENTS) {
    try {
      doc.addEventListener(t, handler, { capture: true, passive: true });
    } catch (e) {
      /* ignorieren */
    }
  }
}

// Nur auf YouTube-Seiten einhängen; Google-Anmeldeseiten bleiben unberührt (Konzept 5a).
const EXCLUDED_HOSTS = ['accounts.youtube.com', 'consent.youtube.com'];
const ALLOWED_DOMAINS = ['youtube.com', 'youtube-nocookie.com'];

export function isYouTubeHost(hostname) {
  if (typeof hostname !== 'string') return false;
  const h = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (!h) return false;
  if (EXCLUDED_HOSTS.indexOf(h) !== -1) return false;
  for (const d of ALLOWED_DOMAINS) {
    if (h === d) return true;
    if (h.length > d.length && h.slice(-(d.length + 1)) === '.' + d) return true;
  }
  return false;
}

export const AIRPLAY_KEY = 'flimmerfrei.airplayMode';

// AirPlay-Modus beim Start: Einstellung der Hülle, im Userscript zusätzlich der gemerkte Schalter.
export function resolveAirplayMode(raw, win) {
  if (raw && typeof raw === 'object' && raw.airplayMode === true) return true;
  const host = raw && typeof raw === 'object' && raw.host === 'ios' ? 'ios' : 'userscript';
  if (host === 'userscript') {
    try {
      return win.localStorage.getItem(AIRPLAY_KEY) === '1';
    } catch (e) {
      /* kein Speicher: aus */
    }
  }
  return false;
}

// ManagedMediaSource vor der Seite verbergen, damit YouTube auf die AirPlay-fähige Übertragung ausweicht.
export function hideManagedMediaSource(win) {
  const names = ['ManagedMediaSource', 'ManagedSourceBuffer'];
  let hidden = false;
  for (const n of names) {
    try {
      if (!(n in win) || win[n] === undefined) continue;
      try {
        delete win[n];
      } catch (e) {
        /* weiter mit defineProperty */
      }
      if (n in win && win[n] !== undefined) {
        Object.defineProperty(win, n, { value: undefined, configurable: true, writable: true });
      }
      hidden = true;
    } catch (e) {
      /* Original bleibt */
    }
  }
  return hidden;
}
