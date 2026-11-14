/**
 * Alles Gerätenahe läuft über diese Schnittstelle. Es gibt zwei Umsetzungen:
 * web.ts (Browser/PWA) und capacitor.ts (iOS-Hülle). Die Oberfläche kennt nur `platform`.
 */
export type PhotoSource = 'camera' | 'library';
export type SaveResult = 'geteilt' | 'heruntergeladen' | 'abgebrochen';

export interface Platform {
  readonly name: 'web' | 'ios';
  /** Foto aufnehmen oder aus der Mediathek wählen; null bei Abbruch. */
  pickPhoto(source: PhotoSource): Promise<Blob | null>;
  /** Textdatei (z. B. Sicherung) speichern/teilen: im Browser Download, auf dem iPhone der Teilen-Dialog. */
  saveFile(opts: { filename: string; mime: string; text: string }): Promise<SaveResult>;
  /** Datei zum Einlesen wählen (Sicherung importieren); null bei Abbruch. */
  pickFile(accept: string): Promise<File | null>;
  /** Kurze Vibration; kind unterscheidet Bestätigung, Rekord und Timerende. */
  vibrate(kind: 'tap' | 'success' | 'record' | 'timer'): void;
  /** Ton am Pausenende (im Vordergrund). */
  playSignal(): void;
  /** Mitteilung zum Pausenende planen (auf iOS: lokale Mitteilung, kommt auch bei gesperrtem Bildschirm). */
  scheduleRestNotification(endsAt: number, title: string, body: string): Promise<void>;
  cancelRestNotification(): Promise<void>;
  /** Bildschirm während des Trainings wach halten. */
  keepAwake(on: boolean): Promise<void>;
  /** Dauerhaften Speicher anfordern (Browser räumt sonst im Notfall auf). */
  requestPersistentStorage(): Promise<boolean>;
}
