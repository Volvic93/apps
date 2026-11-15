// Diagnose: Videostart-Zeiten messen und einen lesbaren Bericht bauen.
import { safeCall } from './config.js';

const AD_PLAYER_SELECTOR = '.html5-video-player.ad-showing, #movie_player.ad-showing';
const MAX_STARTS = 5;

export function createDiagState() {
  return { starts: [], pending: new WeakMap() };
}

// loadstart merken (mit Werbe-Kennzeichen zu diesem Zeitpunkt).
export function recordLoadStart(diag, video, t, isAd) {
  if (!video || typeof video !== 'object') return;
  diag.pending.set(video, { t: t, ad: !!isAd });
}

// Erstes playing nach loadstart: Dauer in ms speichern (Werbung ausgenommen). true = gespeichert.
export function recordPlaying(diag, video, t, isAd) {
  if (!video || typeof video !== 'object') return false;
  const s = diag.pending.get(video);
  if (!s) return false;
  diag.pending.delete(video);
  if (s.ad || isAd) return false;
  diag.starts.push(Math.max(0, t - s.t));
  while (diag.starts.length > MAX_STARTS) diag.starts.shift();
  return true;
}

export function installVideoTiming(doc, diag) {
  const isAd = () => !!safeCall(() => doc.querySelector(AD_PLAYER_SELECTOR), null);
  const isVideo = (e) => e && e.target && String(e.target.tagName).toUpperCase() === 'VIDEO';
  safeCall(() => doc.addEventListener('loadstart', (e) => {
    if (isVideo(e)) recordLoadStart(diag, e.target, Date.now(), isAd());
  }, true));
  safeCall(() => doc.addEventListener('playing', (e) => {
    if (isVideo(e)) recordPlaying(diag, e.target, Date.now(), isAd());
  }, true));
}

export function formatSeconds(ms) {
  return (Math.round(ms / 100) / 10).toFixed(1).replace('.', ',') + ' s';
}

export function sourceKind(v) {
  const s = v && (v.currentSrc || v.src);
  if (!s) return 'leer';
  if (/^blob:/i.test(s)) return 'blob';
  if (/^https?:/i.test(s)) return 'https';
  return 'sonstige';
}

// Rein: info -> mehrzeiliger deutscher Text.
export function buildDiagnostics(i) {
  const onoff = (b) => (b ? 'an' : 'aus');
  const starts = i.starts && i.starts.length ? i.starts.map(formatSeconds).join(' · ') : 'keine';
  const video = i.video ? 'disableRemotePlayback=' + i.video.disableRemotePlayback + ', Quelle: ' + i.video.source : 'keines';
  return [
    'Flimmerfrei ' + i.version,
    'Modus: ' + (i.limited ? 'eingeschränkt (Skript-Kontext)' : 'Seite (voll)'),
    'Hülle: ' + i.host,
    'Werbung aus Daten entfernt: ' + i.dataRemoved,
    'Laufende Werbung übersprungen: ' + i.skipped,
    'ManagedMediaSource: ' + i.mms,
    'AirPlay-Modus: ' + onoff(i.airplayMode),
    'Hintergrund: ' + onoff(i.background) + ' · Bild-in-Bild-Hilfe: ' + onoff(i.pipFix) + ' · Aussehen: ' + onoff(i.look),
    'Letzte Videostarts: ' + starts,
    'Video: ' + video,
    'Adresse: ' + (i.path || '-'),
  ].join('\n');
}
