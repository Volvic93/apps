import { registerPlugin } from '@capacitor/core';
import type { LiveActivityState, PhotoSource, Platform, SaveResult } from './types';
import { webPlatform } from './web';

// Plugins werden erst bei Gebrauch geladen, damit die Web-Ausgabe sie nicht mitliefern muss.
const REST_NOTIFICATION_ID = 7001;
const WEEKLY_BASE_ID = 7100;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** Natives Plugin (nur vorhanden, wenn die .ipa mit der Live-Aktivität gebaut wurde; sonst schlagen die Aufrufe still fehl). */
const LiveActivity = registerPlugin<{
  start(s: LiveActivityState): Promise<{ started: boolean }>;
  update(s: LiveActivityState): Promise<void>;
  end(): Promise<void>;
}>('EisenzeitLiveActivity');

export const capacitorPlatform: Platform = {
  name: 'ios',

  async pickPhoto(source: PhotoSource) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        quality: 85,
        width: 1600,
        correctOrientation: true,
        resultType: CameraResultType.DataUrl,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      });
      return photo.dataUrl ? await dataUrlToBlob(photo.dataUrl) : null;
    } catch {
      return null; // Abbruch durch den Nutzer oder fehlende Berechtigung
    }
  },

  async saveFile({ filename, text, blob }): Promise<SaveResult> {
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const written = blob
        ? await Filesystem.writeFile({ path: filename, data: await blobToBase64(blob), directory: Directory.Cache })
        : await Filesystem.writeFile({ path: filename, data: text ?? '', directory: Directory.Cache, encoding: Encoding.UTF8 });
      await Share.share({ title: filename, url: written.uri, dialogTitle: 'Sicherung speichern' });
      return 'geteilt';
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (/cancel/i.test(msg)) return 'abgebrochen';
      throw e;
    }
  },

  // Der Dateiauswahl-Dialog funktioniert in der WKWebView direkt (öffnet "Dateien").
  pickFile: webPlatform.pickFile,

  vibrate(kind) {
    void (async () => {
      try {
        const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
        if (kind === 'tap') await Haptics.impact({ style: ImpactStyle.Light });
        else if (kind === 'success') await Haptics.notification({ type: NotificationType.Success });
        else if (kind === 'record') {
          await Haptics.notification({ type: NotificationType.Success });
          setTimeout(() => void Haptics.notification({ type: NotificationType.Success }), 250);
        } else await Haptics.vibrate({ duration: 500 });
      } catch {
        /* ignorieren */
      }
    })();
  },

  playSignal: webPlatform.playSignal,

  canVibrate: true,

  liveActivity: {
    async start(s) {
      try {
        return (await LiveActivity.start(s)).started === true;
      } catch {
        return false;
      }
    },
    async update(s) {
      try {
        await LiveActivity.update(s);
      } catch {
        /* Plugin nicht vorhanden – ignorieren */
      }
    },
    async end() {
      try {
        await LiveActivity.end();
      } catch {
        /* ignorieren */
      }
    },
  },

  async autoBackup(filename, text) {
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      await Filesystem.writeFile({ path: `Sicherungen/${filename}`, data: text, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
      // nur die letzten fünf behalten
      const list = await Filesystem.readdir({ path: 'Sicherungen', directory: Directory.Documents });
      const old = list.files
        .map((f) => f.name)
        .filter((n) => n.startsWith('eisenzeit-sicherung') && n.endsWith('.json'))
        .sort()
        .reverse()
        .slice(5);
      for (const n of old) await Filesystem.deleteFile({ path: `Sicherungen/${n}`, directory: Directory.Documents });
      return true;
    } catch {
      return false;
    }
  },

  async setWeeklyReminders(days, time, title, body) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const ids = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ id: WEEKLY_BASE_ID + d }));
      await LocalNotifications.cancel({ notifications: ids });
      if (!days || days.length === 0) return 'ok';
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') return 'verweigert';
      const [h, m] = time.split(':').map((x) => parseInt(x, 10));
      await LocalNotifications.schedule({
        notifications: days.map((d) => ({
          id: WEEKLY_BASE_ID + d,
          title,
          body,
          // Capacitor: 1 = Sonntag … 7 = Samstag; unsere Tage: 0 = Montag … 6 = Sonntag
          schedule: { on: { weekday: d === 6 ? 1 : d + 2, hour: Number.isFinite(h) ? h : 18, minute: Number.isFinite(m) ? m : 0 }, repeats: true, allowWhileIdle: true },
        })),
      });
      return 'ok';
    } catch {
      return 'nicht verfuegbar';
    }
  },

  async scheduleRestNotification(endsAt, title, body) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') return;
      await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
      await LocalNotifications.schedule({
        notifications: [{ id: REST_NOTIFICATION_ID, title, body, schedule: { at: new Date(endsAt), allowWhileIdle: true } }],
      });
    } catch {
      /* ignorieren */
    }
  },

  async cancelRestNotification() {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
    } catch {
      /* ignorieren */
    }
  },

  async keepAwake(on) {
    try {
      const { KeepAwake } = await import('@capacitor-community/keep-awake');
      if (on) await KeepAwake.keepAwake();
      else await KeepAwake.allowSleep();
    } catch {
      /* ignorieren */
    }
  },

  async requestPersistentStorage() {
    return true; // In der App-Hülle räumt iOS den Speicher nicht eigenmächtig auf.
  },
};
