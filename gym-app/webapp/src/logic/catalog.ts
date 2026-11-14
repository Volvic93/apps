import { groupOfMuscle, type MuscleGroupId } from '../data/muscles';
import type { Equipment, Exercise, MuscleId, Plan } from '../data/types';

/** Vereinfacht Text für die Suche: Kleinbuchstaben, Umlaute ausgeschrieben, ohne Akzente. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Jedes Suchwort muss irgendwo im Text vorkommen. */
export function matchesQuery(haystack: string, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const h = fold(haystack);
  return words.every((w) => h.includes(w));
}

/** Geräte, deren Zuordnung der Nutzer noch bestätigen soll (Hinweistext enthält „bestätigen“). */
export function isUnconfirmed(eq: Pick<Equipment, 'hint'> | undefined): boolean {
  return !!eq?.hint && /bestätigen/i.test(eq.hint);
}

/** Hinweistext ohne die einleitende Aufforderung „Bitte bestätigen:“ (die Kennzeichnung steht schon davor). */
export function hintText(hint: string): string {
  return hint.replace(/^\s*(noch zu bestätigen|bitte bestätigen)\s*[:.]?\s*/i, '');
}

export function exerciseGroups(ex: Pick<Exercise, 'primaryMuscles'>): MuscleGroupId[] {
  return [...new Set(ex.primaryMuscles.map(groupOfMuscle))];
}

/** Die häufigsten Hauptmuskeln der Übungen eines Geräts (für die Kennzeichnung auf der Gerätekarte). */
export function equipmentMuscles(equipmentId: string, exercises: Exercise[]): { primary: MuscleId[]; secondary: MuscleId[] } {
  const count = new Map<MuscleId, number>();
  const sec = new Map<MuscleId, number>();
  for (const e of exercises) {
    if (e.equipmentId !== equipmentId) continue;
    for (const m of e.primaryMuscles) count.set(m, (count.get(m) ?? 0) + 1);
    for (const m of e.secondaryMuscles) sec.set(m, (sec.get(m) ?? 0) + 1);
  }
  const top = [...count.entries()].sort((a, b) => b[1] - a[1]);
  if (!top.length) return { primary: [], secondary: [] };
  // Bei Mehrzweckgeräten (viele Übungen) nur Muskeln, die in mindestens einem Viertel der Übungen vorkommen.
  const total = exercises.filter((e) => e.equipmentId === equipmentId).length;
  const primary = top.filter(([, c]) => c >= Math.max(1, total / 4)).slice(0, 4).map(([m]) => m);
  const secondary = [...sec.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m)
    .filter((m) => !primary.includes(m))
    .slice(0, 4);
  return { primary: primary.length ? primary : [top[0][0]], secondary };
}

/**
 * Alternativen für "Gerät besetzt": Übungen mit gleichem Hauptmuskel.
 * Reihenfolge: gleiche Hauptmuskeln und Studio-Geräte zuerst, ähnliche Beanspruchung vor loser Verwandtschaft.
 */
export function alternativesFor(
  current: Exercise,
  all: Exercise[],
  equipment: Map<string, Equipment>,
  excludeIds: Set<string> = new Set(),
): { exercise: Exercise; score: number; reason: string }[] {
  const prim = new Set(current.primaryMuscles);
  const out: { exercise: Exercise; score: number; reason: string }[] = [];
  for (const ex of all) {
    if (ex.id === current.id || ex.hidden || excludeIds.has(ex.id)) continue;
    const eq = ex.equipmentId ? equipment.get(ex.equipmentId) : undefined;
    if (eq?.hidden) continue;
    if (ex.tracking === 'cardio') continue;
    const sharedPrimary = ex.primaryMuscles.filter((m) => prim.has(m)).length;
    const sharedSecondary = ex.secondaryMuscles.filter((m) => prim.has(m)).length;
    if (!sharedPrimary && !sharedSecondary) continue;
    let score = sharedPrimary * 10 + sharedSecondary * 3;
    if (sharedPrimary === current.primaryMuscles.length && sharedPrimary === ex.primaryMuscles.length) score += 6; // gleiches Muskelprofil
    if (eq?.inStudio) score += 4;
    if (eq && current.equipmentId && eq.kind === equipment.get(current.equipmentId)?.kind) score += 2;
    const reason = sharedPrimary ? 'Gleicher Hauptmuskel' : 'Unterstützt denselben Muskel';
    out.push({ exercise: ex, score, reason });
  }
  return out.sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name, 'de'));
}

/** Gerät ist „bei mir vorhanden“: gehört zum Studio und ist nicht ausgeblendet. */
export function isPresent(eq: Pick<Equipment, 'inStudio' | 'hidden'>): boolean {
  return eq.inStudio && !eq.hidden;
}

type PhotoEquipment = Pick<Equipment, 'id' | 'name' | 'kind' | 'photoId' | 'builtinPhoto' | 'hidden'>;

/** Maschinen und Kabelzüge eines Plans, die weder ein eigenes noch ein mitgeliefertes Foto haben (jedes Gerät einmal). */
export function planEquipmentWithoutPhoto(
  plan: Pick<Plan, 'workouts'>,
  exercises: Map<string, Pick<Exercise, 'equipmentId'>>,
  equipment: Map<string, PhotoEquipment>,
): PhotoEquipment[] {
  const seen = new Set<string>();
  const out: PhotoEquipment[] = [];
  for (const w of plan.workouts) {
    for (const it of w.items) {
      const eqId = exercises.get(it.exerciseId)?.equipmentId;
      if (!eqId || seen.has(eqId)) continue;
      seen.add(eqId);
      const eq = equipment.get(eqId);
      if (!eq || eq.hidden || eq.photoId || eq.builtinPhoto) continue;
      if (eq.kind !== 'maschine' && eq.kind !== 'kabelzug') continue;
      out.push(eq);
    }
  }
  return out;
}
