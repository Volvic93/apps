import type { PhotoSource, Platform, SaveResult } from './types';

function pickViaInput(accept: string, capture?: 'environment'): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    if (capture) input.setAttribute('capture', capture);
    input.style.display = 'none';
    let settled = false;
    const done = (f: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(f);
    };
    input.addEventListener('change', () => done(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => done(null));
    document.body.appendChild(input);
    input.click();
  });
}

let audioCtx: AudioContext | undefined;
let wakeLock: WakeLockSentinel | null = null;
let wantAwake = false;

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    const ctx = audioCtx;
    void ctx.resume();
    const t0 = ctx.currentTime;
    [0, 0.22, 0.44].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 2 ? 1175 : 880;
      gain.gain.setValueAtTime(0.0001, t0 + offset);
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + offset);
      osc.stop(t0 + offset + 0.2);
    });
  } catch {
    /* Ton ist ein Zusatz – Fehler ignorieren */
  }
}

async function acquireWakeLock() {
  try {
    if ('wakeLock' in navigator && wantAwake && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    }
  } catch {
    /* nicht unterstützt oder abgelehnt */
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wantAwake && !wakeLock) void acquireWakeLock();
  });
}

export const webPlatform: Platform = {
  name: 'web',

  async pickPhoto(source: PhotoSource) {
    const file = await pickViaInput('image/*', source === 'camera' ? 'environment' : undefined);
    return file;
  },

  async saveFile({ filename, mime, text }): Promise<SaveResult> {
    const blob = new Blob([text], { type: mime });
    const file = new File([blob], filename, { type: mime });
    // Auf Mobilgeräten bietet der Teilen-Dialog das Ablegen in "Dateien" an.
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (typeof navigator.share === 'function' && nav.canShare?.({ files: [file] }) && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
      try {
        await navigator.share({ files: [file], title: filename });
        return 'geteilt';
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return 'abgebrochen';
        // sonst auf Download zurückfallen
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'heruntergeladen';
  },

  pickFile(accept) {
    return pickViaInput(accept);
  },

  vibrate(kind) {
    if (!('vibrate' in navigator)) return;
    // Chrome blockiert Vibration vor der ersten Berührung der Seite (und meldet das als Fehler).
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    const pattern = { tap: 10, success: [20, 40, 20], record: [40, 60, 40, 60, 120], timer: [200, 100, 200, 100, 400] }[kind];
    navigator.vibrate(pattern);
  },

  playSignal: beep,

  async scheduleRestNotification() {
    /* Im Browser gibt es keine verlässliche Mitteilung bei gesperrtem Bildschirm – Ton und Vibration im Vordergrund genügen. */
  },
  async cancelRestNotification() {},

  async keepAwake(on) {
    wantAwake = on;
    if (on) await acquireWakeLock();
    else {
      try {
        await wakeLock?.release();
      } catch {
        /* ignorieren */
      }
      wakeLock = null;
    }
  },

  async requestPersistentStorage() {
    try {
      if (navigator.storage?.persist) return await navigator.storage.persist();
    } catch {
      /* ignorieren */
    }
    return false;
  },
};
