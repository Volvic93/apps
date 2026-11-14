import type { PhotoSource, Platform, SaveResult } from './types';
import { webPlatform } from './web';

// Plugins werden erst bei Gebrauch geladen, damit die Web-Ausgabe sie nicht mitliefern muss.
const REST_NOTIFICATION_ID = 7001;

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

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

  async saveFile({ filename, text }): Promise<SaveResult> {
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const written = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
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
