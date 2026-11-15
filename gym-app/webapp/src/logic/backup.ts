import { db as defaultDb, DB_SCHEMA_VERSION, type EisenzeitDB, saveSettings } from '../data/db';
import { migrateData, MigrationError, type DataSet } from '../data/migrations';
import { seedCatalog } from '../data/seed';
import { MUSCLES } from '../data/muscles';
import type { Photo } from '../data/types';

export const BACKUP_FORMAT = 'eisenzeit-sicherung';
export const BACKUP_FORMAT_VERSION = 1;
export const APP_VERSION = '0.4.0';

export interface BackupPhoto {
  id: string;
  createdAt: number;
  updatedAt: number;
  mime: string;
  base64: string;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  includesPhotos: boolean;
  data: DataSet;
  photos?: BackupPhoto[];
}

export interface BackupSummary {
  plans: number;
  workouts: number;
  sessions: number;
  firstSession?: string;
  lastSession?: string;
  bodyMetrics: number;
  customEquipment: number;
  customExercises: number;
  photos: number;
  exportedAt: string;
  schemaVersion: number;
}

export type ValidationResult =
  | { ok: true; backup: BackupFile; summary: BackupSummary; warnings: string[] }
  | { ok: false; errors: string[] };

export function backupFileName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `eisenzeit-sicherung-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function buildBackup(d: EisenzeitDB = defaultDb, includePhotos = true): Promise<BackupFile> {
  const [equipment, exercises, plans, sessions, bodyMetrics, settings] = await Promise.all([
    d.equipment.toArray(),
    d.exercises.toArray(),
    d.plans.toArray(),
    d.sessions.toArray(),
    d.bodyMetrics.toArray(),
    d.settings.toArray(),
  ]);
  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_FORMAT_VERSION,
    schemaVersion: DB_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    includesPhotos: includePhotos,
    data: { equipment, exercises, plans, sessions, bodyMetrics, settings } as unknown as DataSet,
  };
  if (includePhotos) {
    const photos = await d.photos.toArray();
    backup.photos = await Promise.all(
      photos.map(async (p) => ({
        id: p.id,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        mime: p.blob.type || 'image/jpeg',
        base64: bytesToBase64(new Uint8Array(await p.blob.arrayBuffer())),
      })),
    );
  }
  return backup;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Prüft eine eingelesene Sicherung gründlich, bevor irgendetwas in die Datenbank geschrieben wird. */
export function validateBackup(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['Die Datei enthält keine gültige Sicherung (kein JSON-Objekt).'] };
  if (raw.format !== BACKUP_FORMAT) {
    return { ok: false, errors: ['Das ist keine Eisenzeit-Sicherung (Kennung "eisenzeit-sicherung" fehlt).'] };
  }
  if (raw.version !== BACKUP_FORMAT_VERSION) {
    errors.push(`Unbekannte Dateiformat-Version: ${String(raw.version)}.`);
  }
  if (!Number.isInteger(raw.schemaVersion) || (raw.schemaVersion as number) < 1) {
    errors.push('Die Schema-Version der Sicherung fehlt oder ist ungültig.');
  } else if ((raw.schemaVersion as number) > DB_SCHEMA_VERSION) {
    errors.push(
      `Die Sicherung stammt aus einer neueren App-Version (Schema ${String(raw.schemaVersion)}, diese App kennt Schema ${DB_SCHEMA_VERSION}). Bitte die App aktualisieren.`,
    );
  }
  if (!isObj(raw.data)) {
    errors.push('Der Datenteil der Sicherung fehlt.');
    return { ok: false, errors };
  }
  const data = raw.data as Obj;
  const tables = ['equipment', 'exercises', 'plans', 'sessions', 'bodyMetrics', 'settings'] as const;
  for (const t of tables) {
    if (!Array.isArray(data[t])) errors.push(`Tabelle "${t}" fehlt oder ist keine Liste.`);
  }
  if (errors.length) return { ok: false, errors };

  const checkIds = (name: string, list: unknown[], extra?: (r: Obj, i: number) => void) => {
    const seen = new Set<string>();
    list.forEach((r, i) => {
      if (!isObj(r)) {
        errors.push(`${name} #${i + 1}: kein gültiger Datensatz.`);
        return;
      }
      if (typeof r.id !== 'string' || !r.id) {
        errors.push(`${name} #${i + 1}: Kennung (id) fehlt.`);
        return;
      }
      if (seen.has(r.id)) errors.push(`${name}: Kennung "${r.id}" kommt doppelt vor.`);
      seen.add(r.id);
      extra?.(r, i);
    });
  };

  const KINDS = ['maschine', 'kabelzug', 'freihantel', 'koerpergewicht', 'cardio'];
  const LOADINGS = ['gewichtsblock', 'scheiben', 'frei', 'keins'];
  const TRACKINGS = ['gewicht_wdh', 'koerpergewicht_wdh', 'zeit', 'cardio'];
  const strArr = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');
  checkIds('Geräte', data.equipment as unknown[], (r, i) => {
    const who = `Gerät "${String(r.name ?? i + 1)}"`;
    if (typeof r.name !== 'string') errors.push(`Gerät #${i + 1}: Name fehlt.`);
    if (!KINDS.includes(r.kind as string)) errors.push(`${who}: ungültiger Typ.`);
    if (!LOADINGS.includes(r.loading as string)) errors.push(`${who}: ungültige Belastungsart.`);
    if (!Array.isArray(r.adjustments)) errors.push(`${who}: Einstellpunkte fehlen.`);
    else {
      for (const a of r.adjustments as unknown[]) {
        if (!isObj(a) || typeof a.id !== 'string' || typeof a.label !== 'string' || !isNum(a.min) || !isNum(a.max)) {
          errors.push(`${who}: ein Einstellpunkt ist fehlerhaft.`);
          break;
        }
      }
    }
    if (r.ownWeightKg !== undefined && !isNum(r.ownWeightKg)) errors.push(`${who}: das Eigengewicht ist ungültig.`);
    if (r.perSideInput !== undefined && typeof r.perSideInput !== 'boolean') errors.push(`${who}: die Eingabehilfe „je Seite“ ist ungültig.`);
    if (r.weightStack !== undefined && r.weightStack !== null) {
      const w = r.weightStack;
      const okLevels = !isObj(w) || w.levels === undefined || (Array.isArray(w.levels) && w.levels.length > 0 && w.levels.every(isNum));
      if (!isObj(w) || !isNum(w.minKg) || !isNum(w.maxKg) || !isNum(w.stepKg) || w.stepKg <= 0 || w.maxKg < w.minKg || !okLevels || (w.unit !== undefined && w.unit !== 'platte' && w.unit !== 'kg')) {
        errors.push(`${who}: die Gewichtsstufen sind ungültig.`);
      }
    }
  });
  checkIds('Übungen', data.exercises as unknown[], (r, i) => {
    const who = `Übung "${String(r.name ?? i + 1)}"`;
    if (typeof r.name !== 'string') errors.push(`Übung #${i + 1}: Name fehlt.`);
    for (const key of ['primaryMuscles', 'secondaryMuscles']) {
      const v = r[key];
      if (!Array.isArray(v) || !v.every((m) => MUSCLES.includes(m as never))) errors.push(`${who}: ${key === 'primaryMuscles' ? 'Hauptmuskeln' : 'Hilfsmuskeln'} fehlen oder enthalten unbekannte Muskeln.`);
    }
    if (!TRACKINGS.includes(r.tracking as string)) errors.push(`${who}: ungültige Erfassungsart.`);
    const ins = r.instructions;
    if (!isObj(ins) || typeof ins.setup !== 'string' || !strArr(ins.steps) || typeof ins.breathing !== 'string' || !strArr(ins.mistakes) || typeof ins.tip !== 'string') {
      errors.push(`${who}: die Anleitung ist unvollständig.`);
    }
    if (!isNum(r.defaultRestSec) || !isNum(r.weightStep)) errors.push(`${who}: Pausen- oder Schrittweite fehlt.`);
    if (r.motionPhotoIds !== undefined && !strArr(r.motionPhotoIds)) errors.push(`${who}: das Bewegungsbild ist ungültig.`);
    if (r.motionId !== undefined && typeof r.motionId !== 'string') errors.push(`${who}: die Bewegungsskizze ist ungültig.`);
  });
  checkIds('Pläne', data.plans as unknown[], (r, i) => {
    if (typeof r.name !== 'string') errors.push(`Plan #${i + 1}: Name fehlt.`);
    if (!['entwurf', 'aktiv', 'archiv'].includes(r.status as string)) errors.push(`Plan "${String(r.name)}": ungültiger Status.`);
    if (r.evaluation !== undefined) {
      const ev = r.evaluation;
      if (!isObj(ev) || typeof ev.summary !== 'string' || typeof ev.at !== 'number' || !strArr(ev.wentWell) || !strArr(ev.stalled) || !strArr(ev.recommendations) || !strArr(ev.nextPlanNotes)) errors.push(`Plan "${String(r.name)}": die Auswertung ist ungültig.`);
    }
    if (!Array.isArray(r.workouts)) {
      errors.push(`Plan "${String(r.name)}": Einheiten fehlen.`);
      return;
    }
    for (const w of r.workouts as unknown[]) {
      if (!isObj(w) || !Array.isArray(w.items)) {
        errors.push(`Plan "${String(r.name)}": eine Einheit ist unvollständig.`);
        continue;
      }
      for (const it of w.items as unknown[]) {
        if (!isObj(it) || typeof it.exerciseId !== 'string' || !isNum(it.sets) || !isNum(it.repMin) || !isNum(it.repMax) || !isNum(it.restSec)) {
          errors.push(`Plan "${String(r.name)}", Einheit "${String(w.name)}": ein Übungseintrag ist fehlerhaft.`);
          break;
        }
      }
    }
  });
  checkIds('Einheiten (Training)', data.sessions as unknown[], (r, i) => {
    if (!isNum(r.startedAt)) errors.push(`Training #${i + 1}: Startzeit fehlt.`);
    if (!Array.isArray(r.entries)) {
      errors.push(`Training #${i + 1}: Übungen fehlen.`);
      return;
    }
    for (const e of r.entries as unknown[]) {
      if (!isObj(e) || typeof e.exerciseId !== 'string' || !Array.isArray(e.sets)) {
        errors.push(`Training #${i + 1}: ein Übungseintrag ist fehlerhaft.`);
        break;
      }
      if (e.unit !== undefined && e.unit !== 'kg' && e.unit !== 'platte') errors.push('Training #'+(i + 1)+': ein Übungseintrag hat eine ungültige Einheit.');
      for (const s of e.sets as unknown[]) {
        if (!isObj(s) || !['aufwaermen', 'normal', 'reduktion'].includes(s.kind as string)) {
          errors.push(`Training #${i + 1}: ein Satz hat keine gültige Satzart.`);
          break;
        }
        for (const k of ['weight', 'reps', 'durationSec', 'distanceKm', 'level', 'doneAt']) {
          if (s[k] !== undefined && s[k] !== null && !isNum(s[k])) {
            errors.push(`Training #${i + 1}: Satzwert "${k}" ist keine Zahl.`);
            break;
          }
        }
      }
    }
  });
  checkIds('Körperwerte', data.bodyMetrics as unknown[], (r, i) => {
    if (typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) errors.push(`Körperwert #${i + 1}: Datum fehlt oder ist ungültig (erwartet JJJJ-MM-TT).`);
    for (const k of ['weightKg', 'chest', 'arm', 'waist', 'hip', 'thigh']) {
      if (r[k] !== undefined && r[k] !== null && !isNum(r[k])) errors.push(`Körperwert #${i + 1}: "${k}" ist keine Zahl.`);
    }
  });
  if ((data.settings as unknown[]).length > 1) errors.push('Es darf höchstens einen Einstellungs-Datensatz geben.');
  for (const st of data.settings as unknown[]) {
    if (!isObj(st)) continue;
    if (st.dismissedHints !== undefined && !strArr(st.dismissedHints)) errors.push('Einstellungen: die Liste der ausgeblendeten Hinweise ist ungültig.');
    if (st.studioSetupDone !== undefined && typeof st.studioSetupDone !== 'boolean') errors.push('Einstellungen: „Studio eingerichtet“ ist ungültig.');
    if (st.profile !== undefined && (!isObj(st.profile) || !['muskelaufbau', 'kraft', 'fitness'].includes(st.profile.goal as string))) errors.push('Einstellungen: das Profil ist ungültig.');
  }

  let photos: BackupPhoto[] | undefined;
  if (raw.photos !== undefined) {
    if (!Array.isArray(raw.photos)) errors.push('Der Fototeil der Sicherung ist keine Liste.');
    else {
      photos = [];
      const seen = new Set<string>();
      for (const p of raw.photos as unknown[]) {
        if (!isObj(p) || typeof p.id !== 'string' || typeof p.base64 !== 'string' || typeof p.mime !== 'string') {
          errors.push('Ein Foto in der Sicherung ist unvollständig.');
          break;
        }
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(p.base64) || p.base64.length % 4 === 1 || (p.base64.includes('=') && p.base64.length % 4 !== 0)) {
          errors.push(`Foto "${p.id}" enthält ungültige Daten.`);
          break;
        }
        if (seen.has(p.id)) {
          errors.push(`Foto-Kennung "${p.id}" kommt doppelt vor.`);
          break;
        }
        seen.add(p.id);
        photos.push({
          id: p.id,
          mime: p.mime,
          base64: p.base64,
          createdAt: isNum(p.createdAt) ? p.createdAt : Date.now(),
          updatedAt: isNum(p.updatedAt) ? p.updatedAt : Date.now(),
        });
      }
    }
  }
  if (errors.length) return { ok: false, errors: errors.slice(0, 12) };

  // Verweise prüfen: nur Hinweise, kein Abbruch (die Übung kann ein neuer Katalogeintrag sein).
  const exIds = new Set((data.exercises as Obj[]).map((e) => e.id as string));
  let dangling = 0;
  for (const p of data.plans as Obj[]) for (const w of p.workouts as Obj[]) for (const it of w.items as Obj[]) if (!exIds.has(it.exerciseId as string)) dangling++;
  if (dangling) warnings.push(`${dangling} Plan-Übung(en) verweisen auf Übungen, die nicht in der Sicherung stehen. Mitgelieferte Übungen werden beim Import ergänzt.`);

  const sessions = (data.sessions as Obj[]).map((s) => s.startedAt as number).sort((a, b) => a - b);
  const workouts = (data.plans as Obj[]).reduce((a, p) => a + (p.workouts as unknown[]).length, 0);
  const summary: BackupSummary = {
    plans: (data.plans as unknown[]).length,
    workouts,
    sessions: sessions.length,
    firstSession: sessions.length ? new Date(sessions[0]).toISOString().slice(0, 10) : undefined,
    lastSession: sessions.length ? new Date(sessions[sessions.length - 1]).toISOString().slice(0, 10) : undefined,
    bodyMetrics: (data.bodyMetrics as unknown[]).length,
    customEquipment: (data.equipment as Obj[]).filter((e) => !e.builtin).length,
    customExercises: (data.exercises as Obj[]).filter((e) => !e.builtin).length,
    photos: photos?.length ?? 0,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    schemaVersion: raw.schemaVersion as number,
  };
  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_FORMAT_VERSION,
    schemaVersion: raw.schemaVersion as number,
    appVersion: typeof raw.appVersion === 'string' ? raw.appVersion : '?',
    exportedAt: summary.exportedAt,
    includesPhotos: photos !== undefined,
    data: data as unknown as DataSet,
    photos,
  };
  return { ok: true, backup, summary, warnings };
}

/** Liest Text, parst JSON und prüft. Gibt nie eine Ausnahme nach außen. */
export function parseBackupText(text: string): ValidationResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Die Datei ist kein gültiges JSON. Wurde sie beschädigt oder ist es die falsche Datei?'] };
  }
  return validateBackup(raw);
}

export type ImportMode = 'ersetzen' | 'zusammenfuehren';

type Rec = { id: string; updatedAt?: number };

/**
 * Mitgelieferte Geräte/Übungen werden bei jedem Start frisch eingespielt und sind dadurch „neuer“ als eine ältere Sicherung.
 * Damit eigene Eingaben aus der Sicherung (Notizen, eigene Einstellwerte, Eigengewicht, Ausblenden …) beim Zusammenführen
 * nicht verloren gehen, werden sie feldweise übernommen, wo lokal noch nichts steht.
 */
export function carryUserFields<T extends Rec>(cur: T, inc: T): T | undefined {
  const a = cur as unknown as Record<string, unknown>;
  const b = inc as unknown as Record<string, unknown>;
  if (!a.builtin || !b.builtin) return undefined;
  const out: Record<string, unknown> = { ...a };
  let changed = false;
  // Vom Nutzer geänderte Felder (edited[]) übernehmen, die lokal noch nicht als geändert gelten – samt Wert,
  // sonst bliebe nur die Markierung „geändert“ und der Wert (z. B. „Dein Studio“, Umbenennung) ginge verloren.
  const localEdited = new Set(Array.isArray(a.edited) ? (a.edited as string[]) : []);
  if (Array.isArray(b.edited)) {
    for (const k of b.edited as string[]) {
      if (localEdited.has(k) || k === 'adjustments' || !(k in b)) continue;
      out[k] = b[k];
      changed = true;
    }
  }
  for (const k of ['notes', 'settingsNote', 'location', 'ownWeightKg', 'photoId', 'adjustmentOverrides', 'motionPhotoIds', 'motionId']) {
    if (a[k] === undefined && b[k] !== undefined) {
      out[k] = b[k];
      changed = true;
    }
  }
  if (!a.hidden && b.hidden) {
    out.hidden = true;
    changed = true;
  }
  if (Array.isArray(a.adjustments) && Array.isArray(b.adjustments)) {
    const mine = new Map((b.adjustments as { id: string; myValue?: number }[]).map((x) => [x.id, x.myValue]));
    out.adjustments = (a.adjustments as { id: string; myValue?: number }[]).map((x) => {
      const v = mine.get(x.id);
      if (x.myValue === undefined && v !== undefined) {
        changed = true;
        return { ...x, myValue: v };
      }
      return x;
    });
  }
  if (Array.isArray(b.edited) && b.edited.length) {
    const union = [...new Set([...(Array.isArray(a.edited) ? (a.edited as string[]) : []), ...(b.edited as string[])])];
    if (union.length !== (Array.isArray(a.edited) ? a.edited.length : 0)) {
      out.edited = union;
      changed = true;
    }
  }
  return changed ? (out as unknown as T) : undefined;
}

async function mergeTable<T extends Rec>(table: { toArray(): Promise<T[]>; bulkPut(items: T[]): Promise<unknown> }, incoming: T[], carryUser = false) {
  const existing = new Map((await table.toArray()).map((r) => [r.id, r]));
  const toWrite: T[] = [];
  for (const r of incoming) {
    const cur = existing.get(r.id);
    if (!cur || (r.updatedAt ?? 0) > (cur.updatedAt ?? 0)) toWrite.push(r);
    else if (carryUser) {
      const merged = carryUserFields(cur, r);
      if (merged) toWrite.push(merged);
    }
  }
  if (toWrite.length) await table.bulkPut(toWrite);
}

/**
 * Spielt eine geprüfte Sicherung ein. Alles läuft in einer Transaktion: bei einem Fehler bleibt der alte Stand erhalten.
 * "Ersetzen" leert vorher die Tabellen (Fotos nur, wenn die Sicherung Fotos enthält).
 * "Zusammenführen" fügt Neues hinzu und nimmt bei gleicher Kennung den Datensatz mit dem neueren Änderungsdatum.
 */
export async function importBackup(backup: BackupFile, mode: ImportMode, d: EisenzeitDB = defaultDb): Promise<void> {
  let data: DataSet;
  try {
    data = migrateData(backup.data, backup.schemaVersion);
  } catch (e) {
    if (e instanceof MigrationError) throw e;
    throw new MigrationError('Die Sicherung konnte nicht auf das aktuelle Datenformat gebracht werden.');
  }
  const photos: Photo[] = (backup.photos ?? []).map((p) => ({
    id: p.id,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    blob: new Blob([base64ToBytes(p.base64)], { type: p.mime }),
  }));
  const eq = data.equipment as unknown as import('../data/types').Equipment[];
  const ex = data.exercises as unknown as import('../data/types').Exercise[];
  const plans = data.plans as unknown as import('../data/types').Plan[];
  const sessions = data.sessions as unknown as import('../data/types').Session[];
  const metrics = data.bodyMetrics as unknown as import('../data/types').BodyMetric[];
  const settings = data.settings as unknown as import('../data/types').Settings[];

  await d.transaction('rw', [d.equipment, d.exercises, d.plans, d.sessions, d.bodyMetrics, d.photos, d.settings], async () => {
    if (mode === 'ersetzen') {
      await Promise.all([d.equipment.clear(), d.exercises.clear(), d.plans.clear(), d.sessions.clear(), d.bodyMetrics.clear()]);
      if (backup.includesPhotos) await d.photos.clear();
      await d.equipment.bulkPut(eq);
      await d.exercises.bulkPut(ex);
      await d.plans.bulkPut(plans);
      await d.sessions.bulkPut(sessions);
      await d.bodyMetrics.bulkPut(metrics);
      await d.photos.bulkPut(photos);
      if (settings[0]) await d.settings.put({ ...settings[0], id: 'settings' });
    } else {
      await mergeTable(d.equipment, eq, true);
      await mergeTable(d.exercises, ex, true);
      await mergeTable(d.plans, plans);
      await mergeTable(d.sessions, sessions);
      await mergeTable(d.bodyMetrics, metrics);
      const have = new Set((await d.photos.toArray()).map((p) => p.id));
      await d.photos.bulkPut(photos.filter((p) => !have.has(p.id)));
    }
  });
  await normalizeActivePlans(d);
  // Eingebauten Katalog wieder abgleichen (ergänzt Fehlendes, Eigenes bleibt).
  await seedCatalog(d, true);
}

/** Es gibt höchstens einen aktiven Plan: bei mehreren bleibt der zuletzt gestartete aktiv, die anderen werden zu „Weitere Pläne“. */
export async function normalizeActivePlans(d: EisenzeitDB = defaultDb): Promise<void> {
  const active = (await d.plans.toArray()).filter((p) => p.status === 'aktiv');
  if (active.length <= 1) return;
  const keep = [...active].sort((a, b) => (b.startedAt ?? b.updatedAt) - (a.startedAt ?? a.updatedAt))[0];
  for (const p of active) if (p.id !== keep.id) await d.plans.put({ ...p, status: 'entwurf', updatedAt: Date.now() });
}

export async function markBackupDone(d: EisenzeitDB = defaultDb): Promise<void> {
  await saveSettings({ lastBackupAt: Date.now() }, d);
}
