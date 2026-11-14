import type { Entry, Session, SetEntry } from '../data/types';

/** Geschätzte Maximalkraft nach Epley: Gewicht × (1 + Wdh/30). */
export function epley1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Zählt für Statistik und Rekorde: abgehakt und kein Aufwärmsatz. */
export function isWorkSet(s: SetEntry): boolean {
  return s.doneAt !== undefined && s.kind !== 'aufwaermen';
}

export function setVolume(s: SetEntry): number {
  if (!isWorkSet(s)) return 0;
  return Math.max(0, (s.weight ?? 0)) * (s.reps ?? 0);
}

export function entryVolume(e: Entry): number {
  // Plattennummern sind keine Kilogramm: solche Einträge zählen nicht ins Kilogramm-Volumen.
  return e.skipped || e.unit === 'platte' ? 0 : e.sets.reduce((a, s) => a + setVolume(s), 0);
}

export function sessionVolume(s: Session): number {
  return s.entries.reduce((a, e) => a + entryVolume(e), 0);
}

export function sessionWorkSets(s: Session): number {
  return s.entries.reduce((a, e) => a + (e.skipped ? 0 : e.sets.filter(isWorkSet).length), 0);
}

export function sessionDurationMin(s: Session): number {
  const end = s.endedAt ?? Date.now();
  return Math.max(0, Math.round((end - s.startedAt) / 60000));
}

/** Bester bisheriger Wert je Übung über alle anderen Einheiten (und optional frühere Sätze dieser Einheit). */
export function bestBefore(
  sessions: Session[],
  exerciseId: string,
  excludeSessionId?: string,
  unit: 'kg' | 'platte' = 'kg',
): { e1rm: number; weight: number } {
  let e1rm = 0;
  let weight = 0;
  for (const s of sessions) {
    if (s.id === excludeSessionId) continue;
    for (const e of s.entries) {
      if (e.exerciseId !== exerciseId || e.skipped || (e.unit ?? 'kg') !== unit) continue;
      for (const set of e.sets) {
        if (!isWorkSet(set) || !set.weight || !set.reps) continue;
        e1rm = Math.max(e1rm, epley1RM(set.weight, set.reps));
        weight = Math.max(weight, set.weight);
      }
    }
  }
  return { e1rm, weight };
}

/**
 * Ist der gerade abgehakte Satz ein persönlicher Rekord?
 * Als Rekord zählt eine höhere geschätzte Maximalkraft als je zuvor. Bei der allerersten Einheit mit dieser Übung
 * gibt es keinen Rekord (keine Vergleichsbasis). `earlierInSession` sind die schon abgehakten Sätze der laufenden Einheit.
 */
export function isPersonalRecord(
  set: SetEntry,
  exerciseId: string,
  history: Session[],
  earlierInSession: SetEntry[],
  currentSessionId?: string,
  unit: 'kg' | 'platte' = 'kg',
): boolean {
  if (!isWorkSet(set) || !set.weight || !set.reps) return false;
  const before = bestBefore(history, exerciseId, currentSessionId, unit);
  if (before.e1rm === 0) return false;
  let best = before.e1rm;
  for (const s of earlierInSession) {
    if (isWorkSet(s) && s.weight && s.reps) best = Math.max(best, epley1RM(s.weight, s.reps));
  }
  return epley1RM(set.weight, set.reps) > best + 1e-9;
}

/** Rekorde, die in dieser Einheit gesetzt wurden (je Übung höchstens einer). */
export function sessionRecords(session: Session, history: Session[]): { exerciseId: string; weight: number; reps: number; unit: 'kg' | 'platte' }[] {
  const out: { exerciseId: string; weight: number; reps: number; unit: 'kg' | 'platte' }[] = [];
  for (const e of session.entries) {
    if (e.skipped) continue;
    const before = bestBefore(history, e.exerciseId, session.id, e.unit ?? 'kg');
    if (before.e1rm === 0) continue;
    let bestSet: SetEntry | undefined;
    let best = before.e1rm;
    for (const s of e.sets) {
      if (!isWorkSet(s) || !s.weight || !s.reps) continue;
      const v = epley1RM(s.weight, s.reps);
      if (v > best + 1e-9) {
        best = v;
        bestSet = s;
      }
    }
    if (bestSet) out.push({ exerciseId: e.exerciseId, weight: bestSet.weight!, reps: bestSet.reps!, unit: e.unit ?? 'kg' });
  }
  // Kommt eine Übung nach einem Tausch mehrfach vor: nur der beste Rekord je Übung und Einheit.
  const best = new Map<string, (typeof out)[number]>();
  for (const r of out) {
    const key = `${r.exerciseId}|${r.unit}`;
    const cur = best.get(key);
    if (!cur || epley1RM(r.weight, r.reps) > epley1RM(cur.weight, cur.reps)) best.set(key, r);
  }
  return [...best.values()];
}

/** Vorherige abgeschlossene Einheit mit gleichem Namen (und gleichem Plan, falls vorhanden). */
export function previousSameWorkout(session: Session, history: Session[]): Session | undefined {
  return history
    .filter(
      (s) =>
        s.id !== session.id &&
        s.endedAt !== undefined &&
        s.startedAt < session.startedAt &&
        s.workoutName === session.workoutName &&
        (session.planId === undefined || s.planId === session.planId),
    )
    .sort((a, b) => b.startedAt - a.startedAt)[0];
}

/** Montag 00:00 der Woche, in der `d` liegt (lokale Zeit). */
export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // Montag = 0
  x.setDate(x.getDate() - day);
  return x;
}

export function weekDays(d: Date): Date[] {
  const s = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(s);
    x.setDate(s.getDate() + i);
    return x;
  });
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Laufende Woche eines Plans ("Woche 5 von 8"), mindestens 1. */
export function planWeek(startedAt: number | undefined, now = Date.now()): number {
  if (!startedAt) return 1;
  return Math.max(1, Math.floor((now - startedAt) / (7 * 24 * 3600 * 1000)) + 1);
}

/** Welche Einheit eines Plans ist als Nächstes dran: nie gemachte zuerst (in Planreihenfolge), sonst die am längsten zurückliegende. */
export function suggestNextWorkout(
  workouts: { id: string; name: string }[],
  sessions: Session[],
  planId: string,
): string | undefined {
  if (!workouts.length) return undefined;
  const last = new Map<string, number>();
  for (const s of sessions) {
    if (s.planId !== planId || !s.workoutId || s.endedAt === undefined) continue;
    last.set(s.workoutId, Math.max(last.get(s.workoutId) ?? 0, s.startedAt));
  }
  let best = workouts[0];
  let bestT = last.get(best.id) ?? -1;
  for (const w of workouts.slice(1)) {
    const t = last.get(w.id) ?? -1;
    if (t < bestT) {
      best = w;
      bestT = t;
    }
  }
  return best.id;
}

/** „Woche 5 von 8“ – oder „Plan abgelaufen“, wenn die Laufzeit überschritten ist. */
export function planWeekLabel(startedAt: number | undefined, plannedWeeks: number, now = Date.now()): string {
  const w = planWeek(startedAt, now);
  return w > plannedWeeks ? `Plan abgelaufen (Woche ${w})` : `Woche ${w} von ${plannedWeeks}`;
}
