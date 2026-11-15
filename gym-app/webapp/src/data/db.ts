import Dexie, { type Table } from 'dexie';
import type { BodyMetric, Equipment, Exercise, Photo, Plan, Session, Settings } from './types';

/**
 * Schema-Version der gespeicherten Daten. Sie steht auch in jeder Sicherungsdatei.
 * Bei jeder Änderung am Datenmodell: Zahl erhöhen, einen Schritt in migrations.ts ergänzen
 * und – falls sich Indizes ändern – eine neue `db.version(n)` unten anlegen.
 */
export const DB_SCHEMA_VERSION = 1;

export class EisenzeitDB extends Dexie {
  equipment!: Table<Equipment, string>;
  exercises!: Table<Exercise, string>;
  plans!: Table<Plan, string>;
  sessions!: Table<Session, string>;
  bodyMetrics!: Table<BodyMetric, string>;
  photos!: Table<Photo, string>;
  settings!: Table<Settings, string>;

  constructor(name = 'eisenzeit') {
    super(name);
    // Version 1: Ausgangsschema. Booleans sind in IndexedDB keine gültigen Indexschlüssel und werden daher nicht indiziert.
    this.version(DB_SCHEMA_VERSION).stores({
      equipment: 'id, kind, name',
      exercises: 'id, equipmentId, name, *primaryMuscles',
      plans: 'id, status',
      sessions: 'id, startedAt, planId',
      bodyMetrics: 'id, date',
      photos: 'id',
      settings: 'id',
    });
  }
}

export const db = new EisenzeitDB();

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function defaultSettings(): Settings {
  const now = Date.now();
  return {
    id: 'settings',
    createdAt: now,
    updatedAt: now,
    profile: { goal: 'muskelaufbau', experience: 'fortgeschritten', daysPerWeek: 4 },
    defaultRestSec: 90,
    defaultWeightStep: 2.5,
    planWeeksDefault: 8,
    restSignal: true,
    vibration: true,
    appearance: 'dunkel',
    backupReminder: true,
    dismissedHints: [],
    // Ab Werk: die mitgelieferten Geräte sind die des Studios, also ist es eingerichtet
    studioSetupDone: true,
    studio: { name: 'Kraftkultur Gym', city: 'Mönchengladbach' },
  };
}

export async function getSettings(d: EisenzeitDB = db): Promise<Settings> {
  const s = await d.settings.get('settings');
  if (s) return { ...defaultSettings(), ...s };
  const fresh = defaultSettings();
  await d.settings.put(fresh);
  return fresh;
}

export async function saveSettings(patch: Partial<Settings>, d: EisenzeitDB = db): Promise<Settings> {
  const cur = await getSettings(d);
  const next: Settings = { ...cur, ...patch, id: 'settings', updatedAt: Date.now() };
  await d.settings.put(next);
  return next;
}
