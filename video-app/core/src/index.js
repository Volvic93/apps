// Einstieg: Module einhängen und window.__flimmerfrei bereitstellen.
import { VERSION, isYouTubeHost, resolveAirplayMode, hideManagedMediaSource, AIRPLAY_KEY, createConfigStore, createUserActivity, installActivityTracking, safeCall } from './config.js';
import { createAdState, installAdSkipper, installAdStyle, installInitialDataSetters, installJsonHooks } from './adblock.js';
import { installBackground } from './background.js';
import { createPipState, installPipGuards, installVideoObserver, pauseActive, scanVideos, showAirplay, togglePip } from './pip.js';
import { buildReloadUrl, collectState, installBridge } from './bridge.js';
import { installLook, postToApp } from './look.js';
import { buildDiagnostics, createDiagState, installVideoTiming, sourceKind } from './diag.js';
import { findActiveVideo } from './pip.js';
import { installCast } from './castui.js';

// Marke im Dokument (für den Lader des Userscripts): zeigt, dass der Kern gestartet ist.
function setPresenceMark(doc) {
  const set = function () {
    try {
      if (doc.documentElement) {
        doc.documentElement.setAttribute('data-flimmerfrei', VERSION);
        return true;
      }
    } catch (e) {
      /* ignorieren */
    }
    return false;
  };
  if (set()) return;
  const retry = function () {
    set();
  };
  safeCall(() => doc.addEventListener('readystatechange', retry));
  safeCall(() => doc.addEventListener('DOMContentLoaded', retry));
}

export function runFlimmerfrei(win, doc) {
  if (!win || !doc) return null;
  // Allererste Prüfung: nur auf YouTube-Hosts, sonst nichts einhängen (auch kein window.__flimmerfrei)
  if (!isYouTubeHost(safeCall(() => win.location.hostname, ''))) return null;
  if (win.__flimmerfrei) return win.__flimmerfrei; // schon geladen (nur dieser Kontext; die Marke allein verhindert nichts)

  // ALLERERSTES: im AirPlay-Modus ManagedMediaSource verbergen, bevor YouTubes Player es erkennt
  const rawConfig = win.__FLIMMERFREI_CONFIG__ && typeof win.__FLIMMERFREI_CONFIG__ === 'object' ? win.__FLIMMERFREI_CONFIG__ : {};
  const airplayMode = safeCall(() => resolveAirplayMode(rawConfig, win), false);
  const mmsPresent = safeCall(() => typeof win.ManagedMediaSource !== 'undefined', false);
  let mmsHidden = false;
  if (airplayMode) mmsHidden = safeCall(() => hideManagedMediaSource(win), false);

  setPresenceMark(doc);

  const store = createConfigStore(Object.assign({}, rawConfig, { airplayMode: airplayMode }));
  const diag = createDiagState();
  const adState = createAdState();
  const activity = createUserActivity(() => Date.now());
  const pipState = createPipState();
  const adOn = () => store.get().adblock;
  const bgOn = () => store.get().background;
  const pipOn = () => store.get().pipFix;

  let notify = null;
  let look = null;
  let cast = null; // nur im Userscript (host 'userscript')

  // Userscript: AirPlay-Modus ein-/ausschalten (merkt sich den Schalter, lädt an der aktuellen Stelle neu)
  const askAirplayMode = function (enable) {
    const msg = enable
      ? 'AirPlay braucht den AirPlay-Modus (andere Übertragungsart des Videos, eventuell geringere Auflösung). Jetzt einschalten? Die Seite wird neu geladen.'
      : 'AirPlay-Modus wieder ausschalten? Die Seite wird neu geladen.';
    if (!win.confirm(msg)) return false;
    try {
      if (enable) win.localStorage.setItem(AIRPLAY_KEY, '1');
      else win.localStorage.removeItem(AIRPLAY_KEY);
    } catch (e) {
      return false;
    }
    const v = findActiveVideo(doc, { width: win.innerWidth, height: win.innerHeight });
    const url = buildReloadUrl(String(win.location.href), v && typeof v.currentTime === 'number' ? v.currentTime : 0);
    win.location.assign(url);
    return true;
  };
  const airplayOff = function () {
    if (store.get().host === 'userscript' && airplayMode) askAirplayMode(false);
  };
  const makeDiagnostics = function () {
    const c = store.get();
    const v = findActiveVideo(doc, { width: win.innerWidth, height: win.innerHeight });
    return buildDiagnostics({
      version: VERSION,
      limited: c.limited,
      host: c.host,
      dataRemoved: adState.dataRemoved,
      skipped: adState.adsSkipped,
      mms: mmsHidden ? 'verborgen (AirPlay-Modus)' : mmsPresent ? 'vorhanden' : 'nicht vorhanden',
      airplayMode: airplayMode,
      cast: cast ? cast.status() : c.host === 'ios' ? 'über die App' : 'nicht verbunden',
      background: c.background,
      pipFix: c.pipFix,
      look: c.look,
      starts: diag.starts.slice(),
      video: v ? { disableRemotePlayback: typeof v.disableRemotePlayback === 'boolean' ? String(v.disableRemotePlayback) : 'unbekannt', source: sourceKind(v) } : null,
      path: safeCall(() => String(win.location.pathname || ''), ''),
    });
  };
  const api = {
    version: VERSION,
    pip() {
      return safeCall(() => togglePip(win, doc, pipState), false);
    },
    airplay() {
      if (airplayMode) return safeCall(() => showAirplay(win, doc), false);
      // Ohne AirPlay-Modus kein AirPlay (Konzept: ManagedMediaSource)
      if (store.get().host === 'ios') {
        postToApp(win, { type: 'needAirplayMode' });
        return false;
      }
      safeCall(() => askAirplayMode(true));
      return false;
    },
    diagnostics() {
      return safeCall(() => makeDiagnostics(), 'Diagnose nicht verfügbar');
    },
    state() {
      return collectState(win, doc, adState, () => !!look && look.menuButtonPresent(), () => airplayMode);
    },
    pause() {
      return safeCall(() => pauseActive(win, doc, activity), false);
    },
    setConfig(part) {
      const cfg = safeCall(() => store.set(part), Object.assign({}, store.get()));
      if (notify) notify();
      return cfg;
    },
  };
  try {
    Object.defineProperty(win, '__flimmerfrei', { value: api, configurable: true, enumerable: false, writable: false });
  } catch (e) {
    win.__flimmerfrei = api;
  }

  // Jede Einhängung für sich: scheitert eine, bleibt das Originalverhalten.
  safeCall(() => installActivityTracking(doc, activity));
  safeCall(() => installJsonHooks(win, adOn, adState));
  safeCall(() => installInitialDataSetters(win, adOn, adState));
  const style = safeCall(() => installAdStyle(doc, adOn), null);
  safeCall(() => installAdSkipper(win, doc, adOn, adState));
  safeCall(() => installBackground(win, doc, bgOn, activity));
  look = safeCall(() => installLook(win, doc, store, { pip: () => api.pip(), airplay: () => api.airplay(), onChange: () => notify && notify(), diagnostics: () => win.alert(api.diagnostics()), airplayOff: airplayOff, castOpen: store.get().host === 'userscript' ? () => cast && cast.open() : undefined, castConnected: () => !!cast && cast.lounge.isConnected() }), null);
  safeCall(() => installVideoTiming(doc, diag));
  if (store.get().host === 'userscript') {
    cast = safeCall(() => installCast(win, doc, { getState: () => api.state(), pause: () => api.pause(), onChange: () => look && look.refresh() }), null);
    if (look) safeCall(look.refresh);
  }
  safeCall(() => installPipGuards(win, doc, pipOn, activity, pipState));
  safeCall(() => installVideoObserver(win, doc, pipOn, airplayMode));
  notify = safeCall(() => installBridge(win, doc, adState, () => !!look && look.menuButtonPresent(), () => airplayMode), null);

  // Einstellungen im Betrieb: Einhängungen bleiben, prüfen aber die aktuelle Einstellung.
  store.subscribe(function () {
    if (style) style.update();
    scanVideos(doc, pipOn, airplayMode);
  });
  return api;
}

// Automatischer Start nur in einer echten Seite (nicht beim Import in Node).
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  try {
    runFlimmerfrei(window, document);
  } catch (e) {
    /* Seite nie brechen */
  }
}
