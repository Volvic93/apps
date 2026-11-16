// Untertitel standardmäßig aus: bei jedem neuen Video kurz prüfen und einmal ausschalten.
import { safeCall } from './config.js';

export const CAPTIONS_KEY = 'flimmerfrei.captionsWanted';
export const CAPTIONS_WINDOW_MS = 3000;

export function createCaptionsState() {
  return { turnedOff: 0, handledFor: '', wanted: false, watchId: '', until: 0 };
}

// Ein Prüfschritt am Player (#movie_player). Rückgabe: Grund bzw. 'turned-off'.
export function captionsStep(player, st, videoId) {
  if (st.wanted) return 'wanted';
  if (!videoId) return 'no-video';
  if (st.handledFor === videoId) return 'done';
  if (!player || typeof player.isSubtitlesOn !== 'function' || typeof player.toggleSubtitles !== 'function') return 'none';
  if (!player.isSubtitlesOn()) return 'already-off';
  player.toggleSubtitles();
  st.handledFor = videoId;
  st.turnedOff++;
  return 'turned-off';
}

// Ist das Ziel (oder ein Elternelement) ein Untertitel-Bedienelement?
export function isCaptionsControl(target) {
  let n = target;
  for (let i = 0; n && i < 8; i++) {
    const tag = String(n.tagName || '').toLowerCase();
    const cls = typeof n.className === 'string' ? n.className : '';
    if (tag === 'yt-closed-captions-toggle-button' || cls.split(/\s+/).indexOf('ytp-subtitles-button') !== -1) return true;
    const role = typeof n.getAttribute === 'function' ? n.getAttribute('role') : '';
    const itemLike = role === 'menuitem' || role === 'option' || /item/.test(tag) || tag === 'button';
    const text = typeof n.textContent === 'string' ? n.textContent : '';
    if (itemLike && text.length > 0 && text.length < 80 && /Untertitel/i.test(text)) return true;
    n = n.parentNode;
  }
  return false;
}

// Einhängen: Takt, Ereignisse, Erkennen des Handeinschaltens. isOn = Einstellung captionsOff.
export function installCaptions(win, doc, isOn, st, getVideoId) {
  safeCall(() => {
    if (win.sessionStorage.getItem(CAPTIONS_KEY) === '1') st.wanted = true;
  });
  const markWanted = function () {
    st.wanted = true;
    safeCall(() => win.sessionStorage.setItem(CAPTIONS_KEY, '1'));
  };
  const startWindow = function () {
    st.until = Date.now() + CAPTIONS_WINDOW_MS;
  };
  const player = () => doc.querySelector('#movie_player');
  const tick = function () {
    try {
      if (!isOn() || st.wanted) return;
      const id = getVideoId();
      if (id !== st.watchId) {
        st.watchId = id;
        if (id) startWindow();
      }
      if (id && Date.now() <= st.until) captionsStep(player(), st, id);
    } catch (e) {
      /* nie stören */
    }
  };
  const onMedia = function (e) {
    if (e && e.target && String(e.target.tagName).toUpperCase() === 'VIDEO') startWindow();
  };
  for (const t of ['loadeddata', 'playing']) safeCall(() => doc.addEventListener(t, onMedia, true));
  // Echter Klick auf ein Untertitel-Element: bleibt danach Untertitel an, gilt das für die Sitzung.
  safeCall(() =>
    doc.addEventListener('click', function (e) {
      if (e && e.isTrusted === false) return;
      if (!isCaptionsControl(e && e.target)) return;
      win.setTimeout(function () {
        safeCall(() => {
          const p = player();
          if (p && typeof p.isSubtitlesOn === 'function' && p.isSubtitlesOn()) markWanted();
        });
      }, 400);
    }, true)
  );
  safeCall(() => win.setInterval(tick, 250));
  return { state: st, tick: tick, markWanted: markWanted };
}
