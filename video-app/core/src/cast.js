// Übertragen per TV-Code (Lounge-Schnittstelle von YouTube): reine Hilfen, Sitzung und Steuerung.
import { safeCall } from './config.js';

export const CAST_STORAGE_KEY = 'flimmerfrei.cast';
export const LOUNGE_REL = '/api/lounge';
export const LOUNGE_ABS = 'https://www.youtube.com/api/lounge';
export const CAST_TIMEOUT_MS = 15000;

// ---- reine Funktionen ----

function castEncode(text) {
  return encodeURIComponent(String(text)).replace(/[!'()*]/g, function (c) {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase();
  });
}

// pairs: Liste aus [Schlüssel, Wert]
export function formEncode(pairs) {
  return pairs.map(function (p) {
    return castEncode(p[0]) + '=' + castEncode(p[1]);
  }).join('&');
}

// TV-Code: Leerzeichen/Bindestriche weg, nur Ziffern, 6 bis 16 Stellen; sonst ''.
export function normalizeTvCode(input) {
  if (typeof input !== 'string' && typeof input !== 'number') return '';
  const t = String(input).replace(/[\s\-‐-―]/g, '');
  return /^[0-9]{6,16}$/.test(t) ? t : '';
}

export function buildBindUrl(base, rid) {
  return base + '/bc/bind?RID=' + rid + '&VER=8&CVER=1';
}

export function buildCommandUrl(base, sid, gsessionid, rid) {
  let u = base + '/bc/bind?SID=' + castEncode(sid);
  if (gsessionid) u += '&gsessionid=' + castEncode(gsessionid);
  return u + '&RID=' + rid + '&VER=8&CVER=1';
}

export function buildBindForm(clientId) {
  return formEncode([
    ['device', 'REMOTE_CONTROL'],
    ['id', clientId],
    ['name', 'Flimmerfrei'],
    ['mdx-version', '3'],
    ['pairing_type', 'cast'],
    ['app', 'android-phone-13.14.55'],
  ]);
}

// params: Schlüssel mit führendem Unterstrich, z. B. { _videoId: 'abc' }
export function buildCommandForm(offset, command, params) {
  const pairs = [['count', '1'], ['ofs', String(offset)], ['req0__sc', command]];
  const keys = Object.keys(params || {}).sort();
  for (let i = 0; i < keys.length; i++) pairs.push(['req0_' + keys[i], params[keys[i]] == null ? '' : String(params[keys[i]])]);
  return formEncode(pairs);
}

// SID und gsessionid aus dem Antworttext der Bind-Anfrage
export function parseBindResponse(text) {
  const t = String(text || '');
  const c = t.match(/"c","(.*?)",/);
  const s = t.match(/"S","(.*?)"\]/);
  return { sid: c ? c[1] : '', gsessionid: s ? s[1] : '' };
}

function castJson(text) {
  try {
    const o = JSON.parse(text);
    return o && typeof o === 'object' ? o : null;
  } catch (e) {
    return null;
  }
}

export function parsePairResponse(text) {
  const j = castJson(text);
  const s = j && j.screen;
  if (!s || typeof s.screenId !== 'string' || !s.screenId || typeof s.loungeToken !== 'string' || !s.loungeToken) return null;
  return { screenId: s.screenId, loungeToken: s.loungeToken, name: typeof s.name === 'string' && s.name ? s.name : 'Fernseher' };
}

export function parseTokenResponse(text) {
  const j = castJson(text);
  const s = j && Array.isArray(j.screens) ? j.screens[0] : null;
  return s && typeof s.loungeToken === 'string' && s.loungeToken ? s.loungeToken : '';
}

export function castErrorText(code) {
  if (code === 'invalid') return 'Code ungültig oder abgelaufen';
  if (code === 'network') return 'Fernseher nicht erreichbar';
  if (code === 'novideo') return 'Kein Video zum Senden';
  return 'Verbindung fehlgeschlagen';
}

function castOk(status) {
  return status >= 200 && status < 300;
}

// ---- Sitzung ----

// deps: { setTimeout, clearTimeout, AbortController }  (für Tests ersetzbar)
export function createLounge(fetchFn, storage, log, deps) {
  const d = deps || {};
  const setT = d.setTimeout || ((f, t) => setTimeout(f, t));
  const clearT0 = d.clearTimeout || ((id) => clearTimeout(id));
  const clearT = (id) => safeCall(() => clearT0(id));
  const AC = d.AbortController || (typeof AbortController === 'function' ? AbortController : null);
  const say = function (m) {
    if (typeof log === 'function') safeCall(() => log(m));
  };
  const clientId = 'ff' + Math.random().toString(36).slice(2) + Date.now().toString(36);

  let base = LOUNGE_REL;
  let screen = null; // { screenId, name }
  let token = '';
  let sid = '';
  let gsessionid = '';
  let rid = 0;
  let ofs = 0;
  let connected = false;
  let lastError = '';

  const saved = function () {
    try {
      const o = JSON.parse(storage.getItem(CAST_STORAGE_KEY));
      if (o && typeof o.screenId === 'string' && o.screenId) return { screenId: o.screenId, name: typeof o.name === 'string' && o.name ? o.name : 'Fernseher', connected: o.connected === true };
    } catch (e) {
      /* kein Speicher */
    }
    return null;
  };
  const persist = function () {
    if (!screen) return;
    try {
      storage.setItem(CAST_STORAGE_KEY, JSON.stringify({ screenId: screen.screenId, name: screen.name, connected: connected }));
    } catch (e) {
      /* ignorieren */
    }
  };
  const fail = function (code) {
    lastError = castErrorText(code);
    return { ok: false, error: code, text: lastError };
  };

  // Eine Anfrage; Status -1 = Netzwerkfehler/Zeitlimit.
  async function once(url, body, tok) {
    const ctrl = AC ? new AC() : null;
    const timer = setT(function () {
      if (ctrl) safeCall(() => ctrl.abort());
    }, CAST_TIMEOUT_MS);
    try {
      const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      if (tok) headers['X-YouTube-LoungeId-Token'] = tok;
      const res = await fetchFn(url, { method: 'POST', credentials: 'omit', headers: headers, body: body, signal: ctrl ? ctrl.signal : undefined });
      let text = '';
      try {
        text = await res.text();
      } catch (e) {
        /* leer */
      }
      return { status: res.status, text: text };
    } catch (e) {
      return { status: -1, text: '' };
    } finally {
      clearT(timer);
    }
  }

  // path: z. B. '/pairing/get_screen'; Adresse zuerst relativ, bei Netzwerkfehler einmal absolut.
  async function post(buildUrl, body, tok) {
    let r = await once(buildUrl(base), body, tok);
    if (r.status === -1 && base === LOUNGE_REL) {
      say('Lounge: Netzwerkfehler, versuche absolute Adresse');
      const r2 = await once(buildUrl(LOUNGE_ABS), body, tok);
      if (r2.status !== -1) base = LOUNGE_ABS;
      r = r2;
    }
    return r;
  }

  async function fetchToken() {
    if (!screen) return '';
    const r = await post((b) => b + '/pairing/get_lounge_token_batch', formEncode([['screen_ids', screen.screenId]]), '');
    say('Lounge: Token-Abruf HTTP ' + r.status);
    return castOk(r.status) ? parseTokenResponse(r.text) : '';
  }

  async function bind() {
    sid = '';
    gsessionid = '';
    rid = 1;
    ofs = 0;
    const r = await post((b) => buildBindUrl(b, 1), buildBindForm(clientId), token);
    say('Lounge: bind HTTP ' + r.status);
    if (!castOk(r.status)) return r.status === -1 ? 'network' : 'bind';
    const p = parseBindResponse(r.text);
    if (!p.sid) return 'bind';
    sid = p.sid;
    gsessionid = p.gsessionid;
    return '';
  }

  async function sendOnce(command, params) {
    if (!sid) return 400;
    rid += 1;
    const body = buildCommandForm(ofs, command, params);
    ofs += 1;
    say('Lounge: Befehl ' + command + ' (RID ' + rid + ')');
    const r = await post((b) => buildCommandUrl(b, sid, gsessionid, rid), body, token);
    say('Lounge: ' + command + ' HTTP ' + r.status);
    return r.status;
  }

  return {
    // TV-Code -> Gerät merken (noch nicht verbunden)
    async pair(code) {
      const c = normalizeTvCode(code);
      if (!c) return fail('invalid');
      const r = await post((b) => b + '/pairing/get_screen', formEncode([['pairing_code', c]]), '');
      say('Lounge: get_screen HTTP ' + r.status);
      if (r.status === -1) return fail('network');
      if (r.status >= 500) return fail('network');
      const p = castOk(r.status) ? parsePairResponse(r.text) : null;
      if (!p) return fail('invalid');
      screen = { screenId: p.screenId, name: p.name };
      token = p.loungeToken;
      connected = false;
      persist();
      lastError = '';
      return { ok: true, screen: { screenId: screen.screenId, name: screen.name } };
    },
    // Gemerktes Gerät laden (ohne Verbindung). true = vorhanden
    restore() {
      const s = saved();
      if (!s) return null;
      if (!screen) screen = { screenId: s.screenId, name: s.name };
      return s;
    },
    async connect() {
      if (!screen) this.restore();
      if (!screen) return fail('bind');
      if (!token) {
        token = await fetchToken();
        if (!token) return fail('bind');
      }
      let err = await bind();
      if (err) return fail(err);
      connected = true;
      lastError = '';
      persist();
      return { ok: true };
    },
    async send(command, params) {
      const st = await sendOnce(command, params || {});
      if (castOk(st)) return true;
      if (st === 400 || st === 404 || st === 410) {
        say('Lounge: ' + command + ' HTTP ' + st + ', neu binden');
        const nt = await fetchToken();
        if (nt) token = nt;
        const err = await bind();
        if (err) {
          lastError = castErrorText(err);
          return false;
        }
        return castOk(await sendOnce(command, params || {}));
      }
      lastError = castErrorText(st === -1 ? 'network' : 'bind');
      return false;
    },
    async disconnect() {
      try {
        if (connected) await sendOnce('stopVideo', {});
      } catch (e) {
        /* Fehler ignorieren */
      }
      connected = false;
      sid = '';
      gsessionid = '';
      persist();
    },
    isConnected: () => connected,
    deviceName: () => (screen ? screen.name : ''),
    savedDevice: saved,
    lastError: () => lastError,
    setError(text) {
      lastError = text;
    },
  };
}

// ---- Steuerung: Video senden, bei neuem Video automatisch senden ----

// deps: { lounge, getState: () => { hasVideo, playing, videoId, listId, currentTime }, pause: () => bool }
export function createCastController(deps) {
  let lastTried = '';
  async function sendCurrent() {
    const s = deps.getState();
    if (!s || !s.videoId) return { ok: false, error: 'novideo', text: castErrorText('novideo') };
    lastTried = s.videoId;
    const ok = await deps.lounge.send('setPlaylist', {
      _videoId: s.videoId,
      _currentTime: String(Math.max(0, Math.floor(Number(s.currentTime) || 0))),
      _currentIndex: '-1',
      _audioOnly: 'false',
      _listId: s.listId || '',
    });
    if (!ok) return { ok: false, error: 'bind', text: deps.lounge.lastError() || castErrorText('bind') };
    safeCall(() => deps.pause());
    return { ok: true };
  }
  return {
    sendCurrent,
    // Nach dem Verbinden: laufendes Video sofort senden
    async onConnected() {
      const s = deps.getState();
      if (s && s.videoId) return sendCurrent();
      return { ok: true };
    },
    // Nach einem Neuladen der Seite: das aktuelle Video nicht noch einmal senden
    markSeen() {
      const s = deps.getState();
      if (s && s.videoId) lastTried = s.videoId;
    },
    // Regelmäßig: neues, laufendes Video automatisch senden (nur wenn verbunden)
    async tick() {
      if (!deps.lounge.isConnected()) return false;
      const s = deps.getState();
      if (!s || !s.videoId || !s.playing || s.videoId === lastTried) return false;
      await sendCurrent();
      return true;
    },
  };
}
