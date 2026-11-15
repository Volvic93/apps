import { db, getSettings, uid } from './db';
import type { Adjustment, BodyMetric, Entry, Equipment, Exercise, Plan, PlanItem, Session, SetEntry, Workout } from './types';
import { entryFromItem, lastPerformance, prefillSets, weightUnit } from '../logic/progression';
import type { AssistantResult } from '../logic/assistant';
import { deloadTargets } from '../logic/hints';
import { filePlanToPlan, type PlanFile } from '../logic/planio';

const now = () => Date.now();

// ------------------------------------------------------------------------------------------ Pläne

export async function createPlan(init: { name: string; goal: string; plannedWeeks: number }): Promise<Plan> {
  const t = now();
  const plan: Plan = {
    id: uid(),
    createdAt: t,
    updatedAt: t,
    name: init.name.trim() || 'Neuer Plan',
    goal: init.goal,
    plannedWeeks: init.plannedWeeks,
    status: 'entwurf',
    origin: 'manuell',
    workouts: [],
  };
  await db.plans.put(plan);
  return plan;
}

export async function savePlan(plan: Plan): Promise<void> {
  await db.plans.put({ ...plan, updatedAt: now() });
}

export async function deletePlan(id: string): Promise<void> {
  await db.plans.delete(id);
}

function cloneWorkout(w: Workout): Workout {
  return { id: uid(), name: w.name, items: w.items.map((i) => ({ ...i, id: uid() })) };
}

export async function duplicatePlan(id: string): Promise<Plan | undefined> {
  const src = await db.plans.get(id);
  if (!src) return;
  const t = now();
  const copy: Plan = {
    ...src,
    id: uid(),
    name: `${src.name} (Kopie)`,
    returnToPlanId: undefined,
    status: 'entwurf',
    startedAt: undefined,
    endedAt: undefined,
    createdAt: t,
    updatedAt: t,
    workouts: src.workouts.map(cloneWorkout),
  };
  await db.plans.put(copy);
  return copy;
}

/** Macht einen Plan aktiv; ein bisher aktiver Plan wird zu "weitere Pläne". */
export async function activatePlan(id: string): Promise<void> {
  await db.transaction('rw', db.plans, async () => {
    const all = await db.plans.toArray();
    const t = now();
    for (const p of all) {
      if (p.id === id) await db.plans.put({ ...p, status: 'aktiv', startedAt: p.status === 'aktiv' ? p.startedAt : t, endedAt: undefined, updatedAt: t });
      else if (p.status === 'aktiv') await db.plans.put({ ...p, status: 'entwurf', updatedAt: t });
    }
  });
}

export async function setPlanStatus(id: string, status: Plan['status']): Promise<void> {
  const p = await db.plans.get(id);
  if (!p) return;
  await db.plans.put({ ...p, status, endedAt: status === 'archiv' ? now() : undefined, updatedAt: now() });
}

/** Kopiert eine Einheit aus einem Plan in einen anderen (oder denselben). */
export async function copyWorkout(fromPlanId: string, workoutId: string, toPlanId: string): Promise<void> {
  const from = await db.plans.get(fromPlanId);
  const to = fromPlanId === toPlanId ? from : await db.plans.get(toPlanId);
  const w = from?.workouts.find((x) => x.id === workoutId);
  if (!from || !to || !w) return;
  const copy = cloneWorkout(w);
  if (fromPlanId === toPlanId) copy.name = `${w.name} (Kopie)`;
  await db.plans.put({ ...to, workouts: [...to.workouts, copy], updatedAt: now() });
}

export function newWorkout(name: string): Workout {
  return { id: uid(), name: name.trim() || 'Einheit', items: [] };
}

export function newPlanItem(ex: Pick<Exercise, 'id' | 'defaultRestSec' | 'tracking'>, defaultRest: number): PlanItem {
  const cardio = ex.tracking === 'cardio' || ex.tracking === 'zeit';
  return {
    id: uid(),
    exerciseId: ex.id,
    sets: cardio ? 1 : 3,
    repMin: cardio ? 1 : 8,
    repMax: cardio ? 1 : 12,
    restSec: ex.defaultRestSec > 0 ? ex.defaultRestSec : cardio ? 0 : defaultRest,
  };
}

export function moveInList<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const j = index + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

// ------------------------------------------------------------------------------------------ Training

export async function getActiveSession(): Promise<Session | undefined> {
  const open = (await db.sessions.toArray()).filter((s) => s.endedAt === undefined);
  return open.sort((a, b) => b.startedAt - a.startedAt)[0];
}

async function loadMaps() {
  const [exercises, equipment, sessions] = await Promise.all([db.exercises.toArray(), db.equipment.toArray(), db.sessions.toArray()]);
  return {
    exMap: new Map(exercises.map((e) => [e.id, e])),
    eqMap: new Map(equipment.map((e) => [e.id, e])),
    sessions,
  };
}

/**
 * Startet ein Training aus einer Einheit eines Plans. Läuft schon eines, wird dieses zurückgegeben.
 * Prüfung und Anlegen laufen in einer Transaktion: ein Doppeltipp erzeugt keine zwei offenen Trainings.
 */
export async function startSession(planId: string, workoutId: string, opts: { easier?: boolean } = {}): Promise<Session | undefined> {
  return db.transaction('rw', [db.sessions, db.plans, db.exercises, db.equipment], async () => {
    const existing = await getActiveSession();
    if (existing) return existing;
    const plan = await db.plans.get(planId);
    const workout = plan?.workouts.find((w) => w.id === workoutId);
    if (!plan || !workout) return undefined;
    const { exMap, eqMap, sessions } = await loadMaps();
    const entries: Entry[] = [];
    for (const item of workout.items) {
      const ex = exMap.get(item.exerciseId);
      if (!ex) continue;
      entries.push(entryFromItem(item, ex, ex.equipmentId ? eqMap.get(ex.equipmentId) : undefined, sessions, { preferTarget: !!plan.returnToPlanId, easier: opts.easier }));
    }
    const t = now();
    const s: Session = {
      id: uid(),
      createdAt: t,
      updatedAt: t,
      planId: plan.id,
      workoutId: workout.id,
      workoutName: workout.name,
      startedAt: t,
      entries,
      currentIndex: 0,
      deload: plan.returnToPlanId ? true : undefined,
      easier: opts.easier ? true : undefined,
    };
    await db.sessions.put(s);
    return s;
  });
}

export async function startFreeSession(): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const existing = await getActiveSession();
    if (existing) return existing;
    const t = now();
    const s: Session = { id: uid(), createdAt: t, updatedAt: t, workoutName: 'Freies Training', startedAt: t, entries: [], currentIndex: 0 };
    await db.sessions.put(s);
    return s;
  });
}

export async function saveSession(s: Session): Promise<void> {
  await db.sessions.put({ ...s, updatedAt: now() });
}

export async function finishSession(id: string): Promise<Session | undefined> {
  const s = await db.sessions.get(id);
  if (!s) return;
  // Nicht abgehakte Sätze sind nur Vorschläge und gehören nicht ins Protokoll.
  const entries = s.entries
    .map((e) => ({ ...e, sets: e.sets.filter((x) => x.doneAt !== undefined) }))
    .filter((e) => e.sets.length > 0);
  const done: Session = { ...s, entries, endedAt: now(), restEndsAt: undefined, restTotalSec: undefined, updatedAt: now() };
  await db.sessions.put(done);
  return done;
}

export async function discardSession(id: string): Promise<void> {
  await db.sessions.delete(id);
}

export async function createEntryForExercise(exerciseId: string, opts: { sets?: number; repMin?: number; repMax?: number } = {}): Promise<Entry | undefined> {
  const { exMap, eqMap, sessions } = await loadMaps();
  const ex = exMap.get(exerciseId);
  if (!ex) return;
  const settings = await getSettings();
  const cardio = ex.tracking === 'cardio' || ex.tracking === 'zeit';
  const item = {
    sets: opts.sets ?? (cardio ? 1 : 3),
    repMin: opts.repMin ?? (cardio ? 1 : 8),
    repMax: opts.repMax ?? (cardio ? 1 : 12),
    restSec: ex.defaultRestSec > 0 ? ex.defaultRestSec : cardio ? 0 : settings.defaultRestSec,
  };
  const e = entryFromItem({ id: 'x', exerciseId, ...item }, ex, ex.equipmentId ? eqMap.get(ex.equipmentId) : undefined, sessions);
  return e;
}

/**
 * Ersetzt die Übung eines Eintrags nur für diese Einheit ("Gerät besetzt" bzw. Zurücktauschen).
 * Bereits abgehakte Sätze gehen nie verloren: Gibt es welche, bleiben sie beim bisherigen Eintrag, und die
 * offenen Sätze wandern in einen neuen Eintrag mit der neuen Übung (direkt dahinter). Ergebnis: ein oder zwei Einträge.
 */
export async function substituteEntries(entry: Entry, newExerciseId: string, sessionId: string): Promise<Entry[]> {
  const { exMap, eqMap, sessions } = await loadMaps();
  const ex = exMap.get(newExerciseId);
  if (!ex) return [entry];
  const eq = ex.equipmentId ? eqMap.get(ex.equipmentId) : undefined;
  const doneSets = entry.sets.filter((x) => x.doneAt !== undefined);
  const openSets = entry.sets.filter((x) => x.doneAt === undefined && x.kind !== 'aufwaermen');
  const count = Math.max(1, doneSets.length ? openSets.length : entry.sets.filter((x) => x.kind !== 'aufwaermen').length);
  const sets = prefillSets({ sets: count, repMin: entry.repMin, repMax: entry.repMax }, lastPerformance(sessions, newExerciseId, sessionId, weightUnit(eq)), ex, eq);
  const { unit: _old, ...rest } = entry;
  void _old;
  const original = entry.substitutedFor ?? entry.exerciseId;
  const fresh: Entry = {
    ...rest,
    ...(weightUnit(eq) === 'platte' ? { unit: 'platte' as const } : {}),
    exerciseId: newExerciseId,
    substitutedFor: newExerciseId === original ? undefined : original,
    sets,
    targetWeight: undefined,
    skipped: false,
  };
  if (!doneSets.length) return [fresh];
  return [{ ...entry, sets: doneSets }, fresh];
}

export function newSet(prev?: SetEntry): SetEntry {
  return { kind: 'normal', weight: prev?.weight, reps: prev?.reps, durationSec: prev?.durationSec, distanceKm: prev?.distanceKm, level: prev?.level };
}

// ------------------------------------------------------------------------------------------ Geräte & Übungen

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const EQUIPMENT_TRACKED = ['name', 'brand', 'model', 'studioNumber', 'kind', 'loading', 'pictogram', 'weightStack', 'perSideInput', 'ownWeightKg', 'adjustments', 'inStudio'] as const;
const EXERCISE_TRACKED = ['name', 'equipmentId', 'primaryMuscles', 'secondaryMuscles', 'tracking', 'instructions', 'defaultRestSec', 'weightStep', 'unilateral'] as const;

const structure = (a: Adjustment[]) => a.map(({ id, label, min, max }) => ({ id, label, min, max }));

/** Speichert ein Gerät. Bei mitgelieferten Geräten merkt sich die App, welche Felder du geändert hast, damit Katalog-Updates sie nicht überschreiben. */
export async function saveEquipment(next: Equipment): Promise<void> {
  const prev = await db.equipment.get(next.id);
  const edited = new Set(next.edited ?? prev?.edited ?? []);
  if (prev?.builtin) {
    for (const k of EQUIPMENT_TRACKED) {
      const a = prev[k];
      const b = next[k];
      const differs = k === 'adjustments' ? !sameJson(structure(prev.adjustments), structure(next.adjustments)) : !sameJson(a, b);
      if (differs) edited.add(k);
    }
  }
  await db.equipment.put({ ...next, edited: prev?.builtin ? [...edited] : undefined, updatedAt: now() });
}

export async function saveExercise(next: Exercise): Promise<void> {
  const prev = await db.exercises.get(next.id);
  const edited = new Set(next.edited ?? prev?.edited ?? []);
  if (prev?.builtin) {
    for (const k of EXERCISE_TRACKED) if (!sameJson(prev[k], next[k])) edited.add(k);
  }
  await db.exercises.put({ ...next, edited: prev?.builtin ? [...edited] : undefined, updatedAt: now() });
}

export async function setAdjustmentValue(equipmentId: string, adjustmentId: string, value: number | undefined): Promise<void> {
  const eq = await db.equipment.get(equipmentId);
  if (!eq) return;
  await db.equipment.put({
    ...eq,
    adjustments: eq.adjustments.map((a) => (a.id === adjustmentId ? { ...a, myValue: value } : a)),
    updatedAt: now(),
  });
}

export async function deleteEquipment(id: string): Promise<void> {
  await db.transaction('rw', db.equipment, db.exercises, async () => {
    await db.equipment.delete(id);
    const orphans = await db.exercises.where('equipmentId').equals(id).toArray();
    for (const e of orphans) if (!e.builtin) await db.exercises.put({ ...e, equipmentId: undefined, updatedAt: now() });
  });
}

export async function deleteExercise(id: string): Promise<void> {
  await db.exercises.delete(id);
}

/**
 * „Dein Studio“: Geräte als vorhanden oder nicht vorhanden markieren (in einem Zug).
 * Vorhanden = im Studio und eingeblendet; nicht vorhanden = nicht im Studio. Bei mitgelieferten Geräten merkt sich die App die Änderung.
 */
export async function setEquipmentPresent(changes: { id: string; present: boolean }[]): Promise<void> {
  await db.transaction('rw', db.equipment, async () => {
    for (const c of changes) {
      const eq = await db.equipment.get(c.id);
      if (!eq) continue;
      const next: Equipment = c.present ? { ...eq, inStudio: true, hidden: false } : { ...eq, inStudio: false };
      if (next.inStudio === eq.inStudio && next.hidden === eq.hidden) continue;
      await saveEquipment(next);
    }
  });
}

/**
 * Räumt Fotos auf, die nirgends mehr verwendet werden (z. B. ersetzte oder verworfene Aufnahmen).
 * Fotos, die jünger als `minAgeMs` sind, bleiben stehen – so geht eine gerade laufende Bearbeitung nicht verloren.
 */
export async function removeOrphanPhotos(minAgeMs = 10 * 60 * 1000, at = now()): Promise<number> {
  return db.transaction('rw', db.photos, db.equipment, db.exercises, async () => {
    const used = new Set<string>();
    for (const e of await db.equipment.toArray()) {
      if (e.photoId) used.add(e.photoId);
      for (const a of e.adjustments ?? []) if (a.photoId) used.add(a.photoId);
    }
    for (const x of await db.exercises.toArray()) for (const id of x.motionPhotoIds ?? []) if (id) used.add(id);
    let removed = 0;
    for (const p of await db.photos.toArray()) {
      if (used.has(p.id) || at - p.createdAt < minAgeMs) continue;
      await db.photos.delete(p.id);
      removed++;
    }
    return removed;
  });
}

export function blankEquipment(): Equipment {
  const t = now();
  return {
    id: uid(),
    createdAt: t,
    updatedAt: t,
    name: '',
    kind: 'maschine',
    loading: 'gewichtsblock',
    pictogram: 'generisch',
    adjustments: [],
    inStudio: true,
    hidden: false,
    builtin: false,
  };
}

export function blankExercise(equipmentId?: string): Exercise {
  const t = now();
  return {
    id: uid(),
    createdAt: t,
    updatedAt: t,
    name: '',
    equipmentId,
    primaryMuscles: [],
    secondaryMuscles: [],
    tracking: 'gewicht_wdh',
    instructions: { setup: '', steps: [], breathing: '', mistakes: [], tip: '' },
    defaultRestSec: 90,
    weightStep: 2.5,
    hidden: false,
    builtin: false,
  };
}

export async function addPhoto(blob: Blob): Promise<string> {
  const id = uid();
  const t = now();
  await db.photos.put({ id, blob, createdAt: t, updatedAt: t });
  return id;
}

export async function deletePhoto(id: string | undefined): Promise<void> {
  if (id) await db.photos.delete(id);
}

// ------------------------------------------------------------------------------------------ Körperwerte

const BODY_KEYS = ['weightKg', 'chest', 'arm', 'waist', 'hip', 'thigh'] as const;

/**
 * Speichert die Körperwerte eines Tages (JJJJ-MM-TT). Ein Tag hat höchstens einen Datensatz; angegebene Werte ersetzen die
 * bisherigen, `undefined` löscht einen Wert. Bleibt nichts übrig, wird der Datensatz entfernt.
 */
export async function saveBodyMetric(date: string, values: Partial<Record<(typeof BODY_KEYS)[number], number | undefined>>): Promise<void> {
  await db.transaction('rw', db.bodyMetrics, async () => {
    const existing = await db.bodyMetrics.where('date').equals(date).toArray();
    const base: BodyMetric = existing[0] ?? { id: uid(), createdAt: Date.now(), updatedAt: Date.now(), date };
    const next: BodyMetric = { ...base, updatedAt: Date.now() };
    for (const k of BODY_KEYS) {
      if (!(k in values)) continue;
      const v = values[k];
      if (v === undefined || !Number.isFinite(v) || v <= 0) delete next[k];
      else next[k] = v;
    }
    // Doppelte Tage (z. B. nach einem Import) zusammenführen: fehlende Werte aus den Duplikaten übernehmen
    for (const dup of existing.slice(1)) {
      for (const k of BODY_KEYS) if (!(k in values) && next[k] === undefined && dup[k] !== undefined) next[k] = dup[k];
      await db.bodyMetrics.delete(dup.id);
    }
    if (BODY_KEYS.every((k) => next[k] === undefined)) await db.bodyMetrics.delete(next.id);
    else await db.bodyMetrics.put(next);
  });
}

export async function deleteBodyMetric(id: string): Promise<void> {
  await db.bodyMetrics.delete(id);
}

// ------------------------------------------------------------------------------------------ Stufe 3: Planung

/** Speichert das Ergebnis des Plan-Assistenten als Plan (Entwurf) und aktiviert ihn auf Wunsch. */
export async function savePlanFromAssistant(result: AssistantResult, activate: boolean): Promise<Plan> {
  const t = now();
  const plan: Plan = {
    id: uid(),
    createdAt: t,
    updatedAt: t,
    name: result.name,
    goal: result.goal,
    plannedWeeks: result.plannedWeeks,
    status: 'entwurf',
    origin: 'assistent',
    workouts: result.workouts
      .filter((w) => w.items.length > 0)
      .map((w) => ({
        id: uid(),
        name: w.name,
        items: w.items.map(({ roleLabel: _r, why: _w, ...it }) => {
          void _r;
          void _w;
          return { ...it, id: uid() };
        }),
      })),
  };
  await db.plans.put(plan);
  if (activate) await activatePlan(plan.id);
  return (await db.plans.get(plan.id)) ?? plan;
}

/**
 * Importiert einen geprüften Plan. `resolutions` ordnet jede Übungsreferenz einer vorhandenen Kennung zu oder `null`
 * („neu anlegen“). Neue Übungen und der Plan werden in einer Transaktion gespeichert – nie halb.
 */
export async function importPlanFile(file: PlanFile, resolutions: Map<string, string | null>): Promise<Plan> {
  return db.transaction('rw', db.plans, db.exercises, async () => {
    const created = new Map<string, string>();
    const names = new Map(file.workouts.flatMap((w) => w.items).map((i) => [i.exercise, i.exerciseName ?? i.exercise]));
    for (const [ref, target] of resolutions) {
      if (target !== null) continue;
      const ex = blankExercise();
      ex.name = (names.get(ref) ?? ref).trim().slice(0, 80) || 'Neue Übung';
      ex.notes = 'Aus einem importierten Plan angelegt – bitte Muskeln und Anleitung ergänzen.';
      await db.exercises.put(ex);
      created.set(ref, ex.id);
    }
    const resolve = (ref: string): string => {
      const r = resolutions.get(ref);
      if (typeof r === 'string') return r;
      const c = created.get(ref);
      if (c) return c;
      throw new Error(`Übung nicht zugeordnet: ${ref}`);
    };
    const plan = filePlanToPlan(file, resolve, uid, now());
    await db.plans.put(plan);
    return plan;
  });
}

/** Neuer Plan aus gewählten Einheiten (auch aus verschiedenen Plänen), in der gewählten Reihenfolge. */
export async function mergePlans(picks: { planId: string; workoutId: string }[], name: string, plannedWeeks: number): Promise<Plan | undefined> {
  const plans = new Map((await db.plans.toArray()).map((p) => [p.id, p]));
  const workouts: Workout[] = [];
  for (const pick of picks) {
    const w = plans.get(pick.planId)?.workouts.find((x) => x.id === pick.workoutId);
    if (w) workouts.push(cloneWorkout(w));
  }
  if (!workouts.length) return undefined;
  const t = now();
  const plan: Plan = { id: uid(), createdAt: t, updatedAt: t, name: name.trim() || 'Kombinierter Plan', goal: '', plannedWeeks, status: 'entwurf', origin: 'manuell', workouts };
  const first = plans.get(picks[0].planId);
  if (first?.goal) plan.goal = first.goal;
  await db.plans.put(plan);
  return plan;
}

/** Entlastungswoche: Kopie des Plans mit einer Woche Laufzeit und rund 40 % weniger Gewicht (als Entwurf). */
export async function createDeloadPlan(planId: string): Promise<Plan | undefined> {
  const src = await db.plans.get(planId);
  if (!src) return;
  const { exMap, eqMap, sessions } = await loadMaps();
  const stacks = new Map<string, import('./types').WeightStack | undefined>();
  for (const w of src.workouts) for (const i of w.items) stacks.set(i.exerciseId, eqMap.get(exMap.get(i.exerciseId)?.equipmentId ?? '')?.weightStack);
  const targets = deloadTargets(src, sessions, exMap, stacks);
  const t = now();
  const plan: Plan = {
    ...src,
    id: uid(),
    name: (() => {
      const n = `Entlastung – ${src.name}`;
      return n.length > 80 ? `${n.slice(0, 79).trimEnd()}…` : n;
    })(),
    plannedWeeks: 1,
    returnToPlanId: src.returnToPlanId ?? src.id,
    status: 'entwurf',
    origin: 'manuell',
    startedAt: undefined,
    endedAt: undefined,
    createdAt: t,
    updatedAt: t,
    workouts: src.workouts.map((w) => {
      const c = cloneWorkout(w);
      return { ...c, items: c.items.map((it, k) => ({ ...it, targetWeight: targets.get(w.items[k].id) ?? it.targetWeight, sets: it.sets > 1 ? Math.max(2, it.sets - 1) : 1 })) };
    }),
  };
  await db.plans.put(plan);
  return plan;
}
