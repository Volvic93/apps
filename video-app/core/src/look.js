// Erscheinungsbild wie die YouTube-App: Hinweise ausblenden, Knöpfe in YouTubes eigene Leisten setzen.
import { safeCall } from './config.js';
import { createThrottle } from './bridge.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Jede Regel einzeln, damit ein unbekannter Selektor die anderen nicht entwertet.
export const LOOK_HIDE_SELECTORS = [
  '.mobile-topbar-header-sign-in-button:has(a[href*="open_app"])',
  'a[href^="intent://"]',
  'a[href^="vnd.youtube"]',
  'a[href*="redirect_app_store_ios"]',
  'a[href*="itc_campaign=mweb"]',
  'ytm-mealbar-promo-renderer',
  'ytm-open-app-banner-renderer',
];

export function buildLookCss() {
  let css = '';
  for (const s of LOOK_HIDE_SELECTORS) css += s + '{display:none !important}\n';
  css += '*{-webkit-tap-highlight-color:transparent}\n';
  css += 'a,img,button{-webkit-touch-callout:none}\n';
  return css;
}

export function installLookStyle(doc, isOn) {
  let style = null;
  const css = buildLookCss();
  const attach = function () {
    if (style) return true;
    const parent = doc.head || doc.documentElement;
    if (!parent) return false;
    style = doc.createElement('style');
    style.setAttribute('data-flimmerfrei', 'look');
    style.textContent = isOn() ? css : '';
    parent.appendChild(style);
    return true;
  };
  if (!attach()) {
    safeCall(() => doc.addEventListener('readystatechange', attach));
    safeCall(() => doc.addEventListener('DOMContentLoaded', attach));
  }
  return {
    update() {
      if (style) style.textContent = isOn() ? css : '';
    },
  };
}

// Symbole: einfache Linien, selbst gezeichnet. kind: cast | menu | pip | airplay
const ICONS = {
  cast: [
    ['path', { d: 'M3 8V5h18v14h-7' }],
    ['path', { d: 'M3 13a8 8 0 0 1 8 8' }],
    ['path', { d: 'M3 18a3 3 0 0 1 3 3' }],
  ],
  menu: [
    ['path', { d: 'M4 6h16M4 12h16M4 18h16' }],
    ['circle', { cx: '9', cy: '6', r: '2.2', fill: 'currentColor' }],
    ['circle', { cx: '15', cy: '12', r: '2.2', fill: 'currentColor' }],
    ['circle', { cx: '8', cy: '18', r: '2.2', fill: 'currentColor' }],
  ],
  pip: [
    ['path', { d: 'M3 5h18v14H3z' }],
    ['rect', { x: '12', y: '11', width: '7', height: '6', fill: 'currentColor', stroke: 'none' }],
  ],
  airplay: [
    ['path', { d: 'M6 17H3V5h18v12h-3' }],
    ['path', { d: 'M12 14l5 6H7z', fill: 'currentColor', stroke: 'none' }],
  ],
};

// Nur createElementNS/setAttribute (YouTube nutzt Trusted Types: kein innerHTML).
export function buildIcon(doc, kind) {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  const attrs = { viewBox: '0 0 24 24', width: '24', height: '24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' };
  for (const k of Object.keys(attrs)) svg.setAttribute(k, attrs[k]);
  for (const [tag, a] of ICONS[kind] || []) {
    const el = doc.createElementNS(SVG_NS, tag);
    for (const k of Object.keys(a)) el.setAttribute(k, a[k]);
    svg.appendChild(el);
  }
  return svg;
}

const TOPBAR_STYLE = 'width:48px;height:48px;padding:0;margin:0;border:0;background:none;color:var(--yt-spec-text-primary,currentColor);display:inline-flex;align-items:center;justify-content:center;flex:none;cursor:pointer;';
const PLAYER_STYLE = 'width:44px;height:44px;padding:0;margin:0;border:0;background:none;color:#fff;display:inline-flex;align-items:center;justify-content:center;flex:none;cursor:pointer;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6));';

// Sofort (ungedrosselt) an die App melden.
export function postToApp(win, msg) {
  try {
    const h = win.webkit?.messageHandlers?.flimmerfrei;
    if (h && typeof h.postMessage === 'function') {
      h.postMessage(msg);
      return true;
    }
  } catch (e) {
    /* nie stören */
  }
  return false;
}

function makeButton(doc, o) {
  const b = doc.createElement('button');
  b.className = o.className;
  b.setAttribute('type', 'button');
  b.setAttribute('aria-label', o.label);
  b.setAttribute('style', o.style);
  b.appendChild(buildIcon(doc, o.icon));
  for (const t of ['click', 'touchstart', 'touchend', 'pointerdown', 'pointerup']) {
    b.addEventListener(t, function (e) {
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      if (t === 'click') safeCall(o.action);
    });
  }
  return b;
}

function removeAll(doc, cls) {
  safeCall(() => {
    for (const el of Array.from(doc.querySelectorAll('.' + cls))) el.remove();
  });
}

// Obere Leiste: zwei Knöpfe vor dem Such-Knopf. true = Knöpfe hängen im Dokument.
export function ensureTopbarButtons(win, doc) {
  const header = doc.querySelector('ytm-mobile-topbar-renderer .mobile-topbar-header-content');
  if (!header) return false;
  if (header.querySelector('.flimmerfrei-topbar-button')) return true;
  const search = header.querySelector('button.topbar-button-search-button');
  const parent = search && search.parentNode ? search.parentNode : header;
  const ref = search && search.parentNode ? search : header.firstChild || null;
  const cast = makeButton(doc, {
    className: 'icon-button flimmerfrei-topbar-button flimmerfrei-cast-button',
    label: 'Auf Fernseher übertragen',
    icon: 'cast',
    style: TOPBAR_STYLE,
    action: () => postToApp(win, { type: 'cast' }),
  });
  const menu = makeButton(doc, {
    className: 'icon-button flimmerfrei-topbar-button flimmerfrei-menu-button',
    label: 'Flimmerfrei-Menü',
    icon: 'menu',
    style: TOPBAR_STYLE,
    action: () => postToApp(win, { type: 'menu' }),
  });
  if (ref) {
    parent.insertBefore(cast, ref);
    parent.insertBefore(menu, ref);
  } else {
    parent.appendChild(cast);
    parent.appendChild(menu);
  }
  return true;
}

export function removeTopbarButtons(doc) {
  removeAll(doc, 'flimmerfrei-topbar-button');
}

export function hasAirplaySupport(win) {
  const p = win.HTMLVideoElement && win.HTMLVideoElement.prototype;
  return !!(p && 'webkitShowPlaybackTargetPicker' in p);
}

// Player-Leiste: Übertragen (nur iOS-Hülle), Bild-in-Bild, AirPlay (wenn der Browser es kennt).
export function ensurePlayerButtons(win, doc, o) {
  const box = doc.querySelector('player-top-controls .player-controls-top') || doc.querySelector('.player-controls-top');
  if (!box) return false;
  if (box.querySelector('.flimmerfrei-player-button')) return true;
  const cls = 'flimmerfrei-player-button';
  const list = [];
  if (o.host === 'ios') list.push({ className: cls, label: 'Auf Fernseher übertragen', icon: 'cast', action: () => postToApp(win, { type: 'cast' }) });
  list.push({ className: cls, label: 'Bild-in-Bild', icon: 'pip', action: o.pip });
  if (hasAirplaySupport(win)) list.push({ className: cls, label: 'AirPlay', icon: 'airplay', action: o.airplay });
  const first = box.firstChild || null;
  for (const spec of list) {
    const b = makeButton(doc, Object.assign({ style: PLAYER_STYLE }, spec));
    if (first) box.insertBefore(b, first);
    else box.appendChild(b);
  }
  return true;
}

export function removePlayerButtons(doc) {
  removeAll(doc, 'flimmerfrei-player-button');
}

// Safari zeigt wegen dieses Meta-Eintrags das Banner "In der App öffnen".
export function removeSmartBanner(doc) {
  safeCall(() => {
    for (const m of Array.from(doc.querySelectorAll('meta[name="apple-itunes-app"]'))) m.remove();
  });
}

export function isMenuButtonPresent(doc) {
  return !!safeCall(() => doc.querySelector('.flimmerfrei-menu-button'), null);
}

// Alles einhängen. actions: { pip, airplay, onChange }. Gibt { refresh, menuButtonPresent } zurück.
export function installLook(win, doc, store, actions) {
  const style = installLookStyle(doc, () => store.get().look);
  let lastMenu = false;
  const refresh = function () {
    const cfg = store.get();
    if (cfg.look) removeSmartBanner(doc);
    safeCall(() => {
      if (cfg.host === 'ios' && cfg.menuButton) ensureTopbarButtons(win, doc);
      else removeTopbarButtons(doc);
    });
    safeCall(() => {
      if (cfg.playerButtons) ensurePlayerButtons(win, doc, { host: cfg.host, pip: actions.pip, airplay: actions.airplay });
      else removePlayerButtons(doc);
    });
    const now = isMenuButtonPresent(doc);
    if (now !== lastMenu) {
      lastMenu = now;
      if (actions.onChange) safeCall(actions.onChange);
    }
  };
  const throttled = createThrottle(refresh, 250, { now: () => Date.now(), setTimeout: (f, t) => win.setTimeout(f, t) });
  const MO = win.MutationObserver;
  if (typeof MO === 'function') {
    safeCall(() => new MO(throttled).observe(doc, { childList: true, subtree: true }));
  }
  for (const t of ['yt-navigate-finish', 'DOMContentLoaded']) safeCall(() => doc.addEventListener(t, throttled, true));
  safeCall(refresh);
  store.subscribe(function () {
    style.update();
    refresh();
  });
  return { refresh, menuButtonPresent: () => isMenuButtonPresent(doc) };
}
