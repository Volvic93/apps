// Übertragen im Userscript: Blatt unten (wie die Blätter der YouTube-App) und Verdrahtung mit der Sitzung.
import { safeCall } from './config.js';
import { castErrorText, createCastController, createLounge, normalizeTvCode } from './cast.js';

const SHEET_EVENTS = ['click', 'touchstart', 'touchend', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'keydown', 'keyup', 'keypress', 'input'];
const BTN_STYLE = 'display:block;width:100%;box-sizing:border-box;margin:8px 0 0;padding:12px 16px;border:0;border-radius:12px;font:inherit;font-size:16px;font-weight:600;cursor:pointer;background:rgba(127,127,127,.18);color:inherit;';
const PRIMARY_STYLE = BTN_STYLE + 'background:#2DD4BF;color:#04201c;';

function castEl(doc, tag, style, text) {
  const e = doc.createElement(tag);
  if (style) e.setAttribute('style', style);
  if (text) e.textContent = text;
  return e;
}

function isInside(root, node) {
  let n = node;
  for (let i = 0; n && i < 50; i++) {
    if (n === root) return true;
    n = n.parentNode;
  }
  return false;
}

// Blatt bauen. api: { lounge, controller, onChange }. Nur createElement/textContent (Trusted Types).
export function createCastSheet(win, doc, api) {
  let backdrop = null;
  let sheet = null;
  let busy = false;
  let errorText = '';
  let input = null;

  const stopAll = function (e) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
  };
  // YouTubes Tastenkürzel dürfen nicht greifen; die Eingabe selbst bleibt erhalten (Standardaktion).
  const keyGuard = function (e) {
    if (sheet && e && isInside(sheet, e.target)) e.stopImmediatePropagation();
  };

  const button = function (text, handler, primary) {
    const b = castEl(doc, 'button', primary ? PRIMARY_STYLE : BTN_STYLE, text);
    b.setAttribute('type', 'button');
    if (busy) b.setAttribute('disabled', '');
    b.addEventListener('click', function () {
      if (!busy) safeCall(handler);
    });
    return b;
  };

  const changed = function () {
    if (api.onChange) safeCall(api.onChange);
  };

  async function run(task) {
    busy = true;
    errorText = '';
    render();
    try {
      const r = await task();
      if (r && r.ok === false) errorText = r.text || castErrorText(r.error);
    } catch (e) {
      errorText = castErrorText('bind');
    }
    busy = false;
    render();
    changed();
  }

  async function connectFlow(pairFirst, code) {
    if (pairFirst) {
      const p = await api.lounge.pair(code);
      if (!p.ok) return p;
    }
    const c = await api.lounge.connect();
    if (!c.ok) return c;
    return api.controller.onConnected();
  }

  function render() {
    if (!sheet) return;
    while (sheet.firstChild) sheet.removeChild(sheet.firstChild);
    input = null;
    const lounge = api.lounge;
    sheet.appendChild(castEl(doc, 'div', 'font-size:18px;font-weight:700;margin-bottom:6px;', 'Auf Fernseher übertragen'));
    if (lounge.isConnected()) {
      sheet.appendChild(castEl(doc, 'div', 'margin:4px 0 8px;opacity:.85;', 'Verbunden mit ' + lounge.deviceName()));
      sheet.appendChild(button('Pause', () => run(async () => ((await lounge.send('pause', {})) ? { ok: true } : { ok: false, error: 'bind', text: lounge.lastError() }))));
      sheet.appendChild(button('Weiter', () => run(async () => ((await lounge.send('play', {})) ? { ok: true } : { ok: false, error: 'bind', text: lounge.lastError() }))));
      sheet.appendChild(button('Aktuelles Video senden', () => run(() => api.controller.sendCurrent()), true));
      sheet.appendChild(button('Trennen', () => run(async () => { await lounge.disconnect(); return { ok: true }; })));
    } else {
      sheet.appendChild(castEl(doc, 'div', 'margin:4px 0 8px;opacity:.85;line-height:1.4;', 'YouTube-App am Fernseher öffnen → Einstellungen → Mit TV-Code verknüpfen. Den angezeigten Code hier eingeben.'));
      input = castEl(doc, 'input', 'display:block;width:100%;box-sizing:border-box;padding:12px;border-radius:12px;border:1px solid rgba(127,127,127,.5);font:inherit;font-size:18px;background:transparent;color:inherit;');
      input.setAttribute('type', 'text');
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('placeholder', 'TV-Code');
      input.setAttribute('aria-label', 'TV-Code');
      sheet.appendChild(input);
      sheet.appendChild(button(busy ? 'Verbinde …' : 'Verbinden', () => {
        const code = normalizeTvCode(input ? input.value : '');
        if (!code) {
          errorText = castErrorText('invalid');
          render();
          return;
        }
        run(() => connectFlow(true, code));
      }, true));
      const s = lounge.savedDevice();
      if (s) sheet.appendChild(button('Erneut verbinden mit ' + s.name, () => run(() => connectFlow(false))));
    }
    if (errorText) {
      const er = castEl(doc, 'div', 'margin-top:10px;color:#ff6b6b;font-weight:600;', errorText);
      er.setAttribute('role', 'alert');
      sheet.appendChild(er);
    }
    sheet.appendChild(button('Schließen', close));
  }

  function open() {
    if (sheet) return;
    const parent = doc.body || doc.documentElement;
    if (!parent) return;
    backdrop = castEl(doc, 'div', 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483646;background:rgba(0,0,0,.5);');
    sheet = castEl(doc, 'div', 'position:fixed;left:0;right:0;bottom:0;margin:0 auto;max-width:560px;box-sizing:border-box;z-index:2147483647;padding:16px 16px calc(16px + env(safe-area-inset-bottom));border-radius:16px 16px 0 0;box-shadow:0 -4px 24px rgba(0,0,0,.4);background:Canvas;color:CanvasText;color-scheme:light dark;font:16px/1.4 system-ui,-apple-system,sans-serif;');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'Auf Fernseher übertragen');
    sheet.setAttribute('data-flimmerfrei', 'cast-sheet');
    for (const t of SHEET_EVENTS) {
      sheet.addEventListener(t, stopAll);
      backdrop.addEventListener(t, stopAll);
    }
    backdrop.addEventListener('click', close);
    for (const t of ['keydown', 'keyup', 'keypress']) safeCall(() => doc.addEventListener(t, keyGuard, true));
    parent.appendChild(backdrop);
    parent.appendChild(sheet);
    render();
  }

  function close() {
    for (const t of ['keydown', 'keyup', 'keypress']) safeCall(() => doc.removeEventListener(t, keyGuard, true));
    if (sheet && sheet.parentNode) sheet.parentNode.removeChild(sheet);
    if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    sheet = null;
    backdrop = null;
  }

  return { open, close, isOpen: () => !!sheet };
}

// Alles für das Userscript: Sitzung, Steuerung, Blatt. deps: { getState, pause, onChange }
export function installCast(win, doc, deps) {
  const storage = safeCall(() => win.localStorage, null) || { getItem: () => null, setItem() {} };
  const fetchFn = (url, init) => win.fetch(url, init);
  const lounge = createLounge(fetchFn, storage, null);
  const controller = createCastController({ lounge: lounge, getState: deps.getState, pause: deps.pause });
  const sheet = createCastSheet(win, doc, { lounge: lounge, controller: controller, onChange: deps.onChange });

  // Verbindung übersteht Neuladen: gemerktes, zuletzt verbundenes Gerät wieder anbinden
  const saved = lounge.restore();
  if (saved && saved.connected) {
    controller.markSeen();
    lounge.connect().then(function () {
      if (deps.onChange) safeCall(deps.onChange);
    });
  }
  safeCall(() => win.setInterval(() => safeCall(() => controller.tick()), 1000));
  return {
    open: sheet.open,
    close: sheet.close,
    isOpen: sheet.isOpen,
    lounge: lounge,
    controller: controller,
    status() {
      if (lounge.isConnected()) return 'verbunden mit ' + lounge.deviceName();
      const err = lounge.lastError();
      return err ? 'nicht verbunden (letzter Fehler: ' + err + ')' : 'nicht verbunden';
    },
  };
}
