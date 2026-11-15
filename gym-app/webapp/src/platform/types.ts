/**
 * Alles Gerätenahe läuft über diese Schnittstelle. Es gibt zwei Umsetzungen:
 * web.ts (Browser/PWA) und capacitor.ts (iOS-Hülle). Die Oberfläche kennt nur `platform`.
 */
export type PhotoSource = 'camera' | 'library';
export type SaveResult = 'geteilt' | 'heruntergeladen' | 'abgebrochen';

/** Zustand der Live-Aktivität „Training läuft“ (Sperrbildschirm, Dynamic Island). Zeiten in Millisekunden seit 1970. */
export interface LiveActivityState {
  workout: string;
  startedAt: number;
  exercise: string;
  setIndex: number;
  setTotal: number;
  target: string;
  /** Fortschritt der Einheit, 0 bis 1 */
  progress: number;
  restEndsAt?: number;
}

export interface Platform {
  readonly name: 'web' | 'ios';
  /** Foto aufnehmen oder aus der Mediathek wählen; null bei Abbruch. */
  pickPhoto(source: PhotoSource): Promise<Blob | null>;
  /** Datei (Text oder Bild) speichern/teilen: im Browser Download bzw. Teilen-Dialog, auf dem iPhone der Teilen-Dialog. */
  saveFile(opts: { filename: string; mime: string; text?: string; blob?: Blob }): Promise<SaveResult>;
  /** Gibt es Vibration? (Safari auf dem iPhone kennt sie nicht – nur die iPhone-App.) */
  readonly canVibrate: boolean;
  /** Sicherung still im Dokumentenordner der App ablegen (nur iPhone-App; sichtbar in „Dateien“), behält die letzten fünf. */
  autoBackup(filename: string, text: string): Promise<boolean>;
  /** Wöchentliche Erinnerungen zu festen Trainingstagen (0 = Montag … 6 = Sonntag, Uhrzeit „HH:MM“); null löscht sie. Nur iPhone-App. */
  setWeeklyReminders(days: number[] | null, time: string, title: string, body: string): Promise<'ok' | 'verweigert' | 'nicht verfuegbar'>;
  /** Datei zum Einlesen wählen (Sicherung importieren); null bei Abbruch. */
  pickFile(accept: string): Promise<File | null>;
  /** Kurze Vibration; kind unterscheidet Bestätigung, Rekord und Timerende. */
  vibrate(kind: 'tap' | 'success' | 'record' | 'timer'): void;
  /** Ton am Pausenende (im Vordergrund); `warn` ist ein kurzer Ton zur Ankündigung. */
  playSignal(kind?: 'end' | 'warn'): void;
  /** Mitteilung zum Pausenende planen (auf iOS: lokale Mitteilung, kommt auch bei gesperrtem Bildschirm). */
  scheduleRestNotification(endsAt: number, title: string, body: string): Promise<void>;
  cancelRestNotification(): Promise<void>;
  /** Live-Aktivität fürs laufende Training (nur iPhone-App mit eingebauter Widget-Erweiterung; sonst ohne Wirkung). */
  liveActivity: {
    start(s: LiveActivityState): Promise<boolean>;
    update(s: LiveActivityState): Promise<void>;
    end(): Promise<void>;
  };
  /** Bildschirm während des Trainings wach halten. */
  keepAwake(on: boolean): Promise<void>;
  /** Dauerhaften Speicher anfordern (Browser räumt sonst im Notfall auf). */
  requestPersistentStorage(): Promise<boolean>;
}
