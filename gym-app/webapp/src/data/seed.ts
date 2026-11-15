import type { EisenzeitDB } from './db';
import { db as defaultDb, getSettings, saveSettings } from './db';
import type { Equipment, Exercise } from './types';
import { CATALOG_VERSION, KATALOG_GERAETE, KATALOG_UEBUNGEN } from './katalog';
import { STUDIO_GERAETE, STUDIO_UEBUNGEN } from './studio-geraete';

/** Katalogeintrag: wie das Datenmodell, aber ohne Verwaltungsfelder, die die App selbst führt. */
export type CatalogEquipment = Omit<Equipment, 'createdAt' | 'updatedAt' | 'builtin' | 'hidden' | 'edited' | 'photoId'>;
export type CatalogExercise = Omit<Exercise, 'createdAt' | 'updatedAt' | 'builtin' | 'hidden' | 'edited' | 'notes' | 'adjustmentOverrides' | 'motionPhotoIds' | 'motionId'>;

function applyEdited<T extends { edited?: string[] }>(result: T, existing: T): T {
  const edited = existing.edited ?? [];
  const out = { ...result, edited } as Record<string, unknown>;
  for (const key of edited) out[key] = (existing as Record<string, unknown>)[key];
  return out as T;
}

/**
 * Spielt einen Katalogeintrag in einen vorhandenen Datensatz ein:
 * Inhalte des Katalogs werden aktualisiert, eigene Änderungen des Nutzers bleiben erhalten
 * (ausgeblendet, eigenes Foto, Notizen, eigene Einstellwerte und alle Felder, die er umbenannt/geändert hat).
 */
export function mergeBuiltinEquipment(existing: Equipment | undefined, incoming: CatalogEquipment, now = Date.now()): Equipment {
  if (!existing) {
    return { ...incoming, hidden: false, builtin: true, createdAt: now, updatedAt: now };
  }
  const adjustments = incoming.adjustments.map((a) => {
    const old = existing.adjustments.find((x) => x.id === a.id);
    return old ? { ...a, myValue: old.myValue, photoId: old.photoId } : a;
  });
  const extra = existing.adjustments.filter((x) => !incoming.adjustments.some((a) => a.id === x.id));
  const merged: Equipment = {
    ...incoming,
    adjustments: [...adjustments, ...extra],
    hidden: existing.hidden,
    builtin: true,
    photoId: existing.photoId,
    location: existing.location ?? incoming.location,
    settingsNote: existing.settingsNote ?? incoming.settingsNote,
    createdAt: existing.createdAt,
    updatedAt: existing.updatedAt,
    edited: existing.edited,
  };
  const withEdits = applyEdited(merged, existing);
  // Der Teil mit eigenen Einstellwerten bleibt auch dann erhalten, wenn "adjustments" als geändert markiert ist.
  return withEdits;
}

export function mergeBuiltinExercise(existing: Exercise | undefined, incoming: CatalogExercise, now = Date.now()): Exercise {
  if (!existing) {
    return { ...incoming, hidden: false, builtin: true, createdAt: now, updatedAt: now };
  }
  const merged: Exercise = {
    ...incoming,
    hidden: existing.hidden,
    builtin: true,
    notes: existing.notes,
    adjustmentOverrides: existing.adjustmentOverrides,
    motionPhotoIds: existing.motionPhotoIds,
    motionId: existing.motionId,
    createdAt: existing.createdAt,
    updatedAt: existing.updatedAt,
    edited: existing.edited,
  };
  return applyEdited(merged, existing);
}

export const ALL_CATALOG_EQUIPMENT: CatalogEquipment[] = [...STUDIO_GERAETE, ...KATALOG_GERAETE];
export const ALL_CATALOG_EXERCISES: CatalogExercise[] = [...STUDIO_UEBUNGEN, ...KATALOG_UEBUNGEN];

/**
 * Mitgelieferte Einträge, die der Katalog nicht mehr enthält (z. B. nach einer Korrektur der Geräteerkennung),
 * werden entfernt. Wird eine solche Übung noch von einem Plan oder einem protokollierten Training verwendet,
 * bleibt sie erhalten und wird nur ausgeblendet, damit nichts ins Leere zeigt.
 */
async function removeObsoleteBuiltins(d: EisenzeitDB, eqBefore: Map<string, Equipment>, exBefore: Map<string, Exercise>): Promise<void> {
  const keepEq = new Set(ALL_CATALOG_EQUIPMENT.map((e) => e.id));
  const keepEx = new Set(ALL_CATALOG_EXERCISES.map((e) => e.id));
  const used = new Set<string>();
  for (const p of await d.plans.toArray()) for (const w of p.workouts) for (const i of w.items) used.add(i.exerciseId);
  for (const s of await d.sessions.toArray()) for (const e of s.entries) {
    used.add(e.exerciseId);
    if (e.substitutedFor) used.add(e.substitutedFor);
  }
  const keptEquipment = new Set<string>();
  const hasOwnData = (e: { edited?: string[]; notes?: string; motionPhotoIds?: string[]; adjustmentOverrides?: Record<string, unknown> }) =>
    (e.edited?.length ?? 0) > 0 || !!e.notes || !!e.motionPhotoIds?.some(Boolean) || Object.keys(e.adjustmentOverrides ?? {}).length > 0;
  for (const ex of exBefore.values()) {
    if (!ex.builtin || keepEx.has(ex.id)) continue;
    if (used.has(ex.id) || hasOwnData(ex)) {
      await d.exercises.put({ ...ex, hidden: true });
      if (ex.equipmentId) keptEquipment.add(ex.equipmentId);
    } else {
      await d.exercises.delete(ex.id);
    }
  }
  for (const eq of eqBefore.values()) {
    if (!eq.builtin || keepEq.has(eq.id)) continue;
    // Eigene Einstellwerte, Fotos und Notizen werden nie stillschweigend gelöscht.
    const own = eq.photoId || eq.settingsNote || eq.location || (eq.edited?.length ?? 0) > 0 || eq.adjustments.some((a) => a.myValue !== undefined || a.photoId);
    if (keptEquipment.has(eq.id) || own) {
      await d.equipment.put({ ...eq, hidden: true });
      continue;
    }
    await d.equipment.delete(eq.id);
    // Eigene Übungen, die auf das entfernte Gerät zeigten, werden zu freien Übungen.
    for (const mine of await d.exercises.where('equipmentId').equals(eq.id).toArray()) {
      if (!mine.builtin) await d.exercises.put({ ...mine, equipmentId: undefined });
    }
  }
}

/** Spielt den eingebauten Katalog in die Datenbank ein (beim Start; nur wenn sich der Katalog geändert hat). */
export async function seedCatalog(d: EisenzeitDB = defaultDb, force = false): Promise<void> {
  const settings = await getSettings(d);
  const equipmentCount = await d.equipment.count();
  if (!force && settings.catalogVersion === CATALOG_VERSION && equipmentCount > 0) return;
  const now = Date.now();
  await d.transaction('rw', [d.equipment, d.exercises, d.settings, d.plans, d.sessions], async () => {
    const existingEq = new Map((await d.equipment.toArray()).map((e) => [e.id, e]));
    await d.equipment.bulkPut(ALL_CATALOG_EQUIPMENT.map((c) => mergeBuiltinEquipment(existingEq.get(c.id), c, now)));
    const existingEx = new Map((await d.exercises.toArray()).map((e) => [e.id, e]));
    await d.exercises.bulkPut(ALL_CATALOG_EXERCISES.map((c) => mergeBuiltinExercise(existingEx.get(c.id), c, now)));
    await removeObsoleteBuiltins(d, existingEq, existingEx);
  });
  await saveSettings({ catalogVersion: CATALOG_VERSION }, d);
}
