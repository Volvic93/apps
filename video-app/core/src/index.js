// Einstieg: Module einhängen und window.__flimmerfrei bereitstellen.
import { VERSION, isYouTubeHost, createConfigStore, createUserActivity, installActivityTracking, safeCall } from './config.js';
import { createAdState, installAdSkipper, installAdStyle, installInitialDataSetters, installJsonHooks } from './adblock.js';
import { installBackground } from './background.js';
import { createPipState, installPipGuards, installVideoObserver, pauseActive, scanVideos, showAirplay, togglePip } from './pip.js';
import { collectState, installBridge } from './bridge.js';
import { installLook } from './look.js';

export function runFlimmerfrei(win, doc) {
  if (!win || !doc) return null;
  // Allererste Prüfung: nur auf YouTube-Hosts, sonst nichts einhängen (auch kein window.__flimmerfrei)
  if (!isYouTubeHost(safeCall(() => win.location.hostname, ''))) return null;
  if (win.__flimmerfrei) return win.__flimmerfrei; // schon geladen

  const store = createConfigStore(win.__FLIMMERFREI_CONFIG__);
  const adState = createAdState();
  const activity = createUserActivity(() => Date.now());
  const pipState = createPipState();
  const adOn = () => store.get().adblock;
  const bgOn = () => store.get().background;
  const pipOn = () => store.get().pipFix;

  let notify = null;
  let look = null;
  const api = {
    version: VERSION,
    pip() {
      return safeCall(() => togglePip(win, doc, pipState), false);
    },
    airplay() {
      return safeCall(() => showAirplay(win, doc), false);
    },
    state() {
      return collectState(win, doc, adState, () => !!look && look.menuButtonPresent());
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
  look = safeCall(() => installLook(win, doc, store, { pip: () => api.pip(), airplay: () => api.airplay(), onChange: () => notify && notify() }), null);
  safeCall(() => installPipGuards(win, doc, pipOn, activity, pipState));
  safeCall(() => installVideoObserver(win, doc, pipOn));
  notify = safeCall(() => installBridge(win, doc, adState, () => !!look && look.menuButtonPresent()), null);

  // Einstellungen im Betrieb: Einhängungen bleiben, prüfen aber die aktuelle Einstellung.
  store.subscribe(function () {
    if (style) style.update();
    scanVideos(doc, pipOn);
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
