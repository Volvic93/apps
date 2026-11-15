import type { BodyMetric, Entry, Equipment, Exercise, MuscleId, Plan, Session, SetEntry } from '../data/types';
import { stepWeight, weightUnit } from './progression';
import { epley1RM, isWorkSet, sessionDurationMin, sessionWorkSets, setVolume, startOfWeek } from './stats';

type Unit = 'kg' | 'platte';
const DAY = 24 * 3600 * 1000;
const unitOf = (e: Entry): Unit => (e.unit === 'platte' ? 'platte' : 'kg');

// ------------------------------------------------------------------------------------------ Zeitraum

export type Range = '4w' | '3m' | '6m' | 'alles';
export const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: '4w', label: '4 Wo.' },
  { value: '3m', label: '3 Mon.' },
  { value: '6m', label: '6 Mon.' },
  { value: 'alles', label: 'Alles' },
];

/** Beginn des Zeitraums als Zeitstempel (undefined = ohne Grenze). */
export function rangeStart(range: Range, now = Date.now()): number | undefined {
  if (range === 'alles') return undefined;
  const days = range === '4w' ? 28 : range === '3m' ? 91 : 182;
  return now - days * DAY;
}

export function finishedSessions(sessions: Session[]): Session[] {
  return sessions.filter((s) => s.endedAt !== undefined).sort((a, b) => a.startedAt - b.startedAt);
}

// ------------------------------------------------------------------------------------------ Übungsverlauf

export interface ExercisePoint {
  sessionId: string;
  date: number;
  /** Höchstes Gewicht (kg bzw. Plattennummer) der Arbeitssätze. */
  maxWeight: number;
  /** Beste geschätzte Maximalkraft (Epley), 0 bei Plattennummern oder ohne Zusatzgewicht. */
  best1rm: number;
  /** Volumen in kg (Gewicht × Wdh.), 0 bei Plattennummern. */
  volume: number;
  /** Wiederholungen insgesamt. */
  reps: number;
  /** Anzahl Arbeitssätze. */
  sets: number;
}

/** Ein Punkt je abgeschlossener Einheit; mehrere Einträge derselben Übung (z. B. nach einem Tausch) werden zusammengefasst. */
export function exerciseSeries(sessions: Session[], exerciseId: string, unit: Unit = 'kg'): ExercisePoint[] {
  const out: ExercisePoint[] = [];
  for (const s of finishedSessions(sessions)) {
    const sets: SetEntry[] = s.entries
      .filter((e) => e.exerciseId === exerciseId && !e.skipped && unitOf(e) === unit)
      .flatMap((e) => e.sets.filter(isWorkSet));
    if (!sets.length) continue;
    let maxWeight = 0;
    let best1rm = 0;
    let volume = 0;
    let reps = 0;
    for (const x of sets) {
      const w = x.weight ?? 0;
      const r = x.reps ?? 0;
      maxWeight = Math.max(maxWeight, w);
      reps += r;
      if (unit === 'kg' && w > 0 && r > 0) {
        best1rm = Math.max(best1rm, epley1RM(w, r));
        volume += w * r;
      }
    }
    out.push({ sessionId: s.id, date: s.startedAt, maxWeight, best1rm, volume, reps, sets: sets.length });
  }
  return out;
}

export interface CardioPoint {
  sessionId: string;
  date: number;
  durationMin: number;
  distanceKm: number;
  /** Minuten je Kilometer, falls Dauer und Strecke vorliegen. */
  pace?: number;
}

export function cardioSeries(sessions: Session[], exerciseId: string): CardioPoint[] {
  const out: CardioPoint[] = [];
  for (const s of finishedSessions(sessions)) {
    const sets = s.entries.filter((e) => e.exerciseId === exerciseId && !e.skipped).flatMap((e) => e.sets.filter(isWorkSet));
    if (!sets.length) continue;
    const sec = sets.reduce((a, x) => a + (x.durationSec ?? 0), 0);
    const km = sets.reduce((a, x) => a + (x.distanceKm ?? 0), 0);
    out.push({ sessionId: s.id, date: s.startedAt, durationMin: sec / 60, distanceKm: km, pace: km > 0 && sec > 0 ? sec / 60 / km : undefined });
  }
  return out;
}

/** Übungen mit mindestens einem abgeschlossenen Training, mit Anzahl Einheiten und letztem Datum. */
export function trainedExercises(sessions: Session[]): { exerciseId: string; count: number; last: number }[] {
  const map = new Map<string, { count: number; last: number }>();
  for (const s of finishedSessions(sessions)) {
    const seen = new Set<string>();
    for (const e of s.entries) {
      if (e.skipped || !e.sets.some(isWorkSet) || seen.has(e.exerciseId)) continue;
      seen.add(e.exerciseId);
      const cur = map.get(e.exerciseId) ?? { count: 0, last: 0 };
      map.set(e.exerciseId, { count: cur.count + 1, last: Math.max(cur.last, s.startedAt) });
    }
  }
  return [...map.entries()].map(([exerciseId, v]) => ({ exerciseId, ...v })).sort((a, b) => b.last - a.last);
}

// ------------------------------------------------------------------------------------------ Rekorde

export interface RecordRow {
  exerciseId: string;
  unit: Unit;
  weight: number;
  reps: number;
  e1rm: number;
  date: number;
  sessionId: string;
}

/** Bester Satz je Übung (und Einheit): nach geschätzter Maximalkraft, bei Plattennummern nach Gewicht und Wiederholungen. */
export function recordList(sessions: Session[]): RecordRow[] {
  const best = new Map<string, RecordRow>();
  for (const s of finishedSessions(sessions)) {
    for (const e of s.entries) {
      if (e.skipped) continue;
      const unit = unitOf(e);
      for (const x of e.sets) {
        if (!isWorkSet(x) || !x.weight || x.weight < 0 || !x.reps) continue; // Hilfsgewichte (negativ) sind keine Rekorde
        const e1rm = unit === 'kg' ? epley1RM(x.weight, x.reps) : x.weight + x.reps / 1000;
        const key = `${e.exerciseId}|${unit}`;
        const cur = best.get(key);
        if (!cur || e1rm > cur.e1rm + 1e-9) best.set(key, { exerciseId: e.exerciseId, unit, weight: x.weight, reps: x.reps, e1rm, date: s.startedAt, sessionId: s.id });
      }
    }
  }
  return [...best.values()].sort((a, b) => b.date - a.date);
}

// ------------------------------------------------------------------------------------------ Gesamt (Wochen)

export interface WeekStat {
  start: number;
  sessions: number;
  volume: number;
  durationMin: number;
  workSets: number;
}

/** Die letzten `weeks` Kalenderwochen (Montag bis Sonntag), älteste zuerst; die laufende Woche steht zuletzt. */
export function weeklyStats(sessions: Session[], weeks: number, now = Date.now()): WeekStat[] {
  const thisWeek = startOfWeek(new Date(now));
  const starts: number[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(thisWeek);
    d.setDate(d.getDate() - 7 * i);
    starts.push(d.getTime());
  }
  const out: WeekStat[] = starts.map((start) => ({ start, sessions: 0, volume: 0, durationMin: 0, workSets: 0 }));
  for (const s of finishedSessions(sessions)) {
    const wk = startOfWeek(new Date(s.startedAt)).getTime();
    const row = out.find((r) => r.start === wk);
    if (!row) continue;
    row.sessions++;
    row.durationMin += sessionDurationMin(s);
    row.workSets += sessionWorkSets(s);
    row.volume += s.entries.reduce((a, e) => a + (e.skipped || unitOf(e) === 'platte' ? 0 : e.sets.reduce((b, x) => b + setVolume(x), 0)), 0);
  }
  return out;
}

/** Tage (JJJJ-MM-TT, lokale Zeit) mit mindestens einer abgeschlossenen Einheit → Einheiten. */
export function sessionsByDay(sessions: Session[]): Map<string, Session[]> {
  const map = new Map<string, Session[]>();
  for (const s of finishedSessions(sessions)) {
    const key = dayKey(new Date(s.startedAt));
    map.set(key, [...(map.get(key) ?? []), s]);
  }
  return map;
}

export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Einheiten pro Woche im Schnitt über die letzten Wochen mit mindestens einer Einheit seit dem ersten Training (max. `weeks`). */
export function averagePerWeek(stats: WeekStat[]): number {
  const firstIdx = stats.findIndex((w) => w.sessions > 0);
  if (firstIdx < 0) return 0;
  let used = stats.slice(firstIdx);
  // Die laufende, noch unvollständige Woche würde den Schnitt drücken – sie zählt nur, wenn es keine andere gibt
  if (used.length > 1) used = used.slice(0, -1);
  return used.reduce((a, w) => a + w.sessions, 0) / used.length;
}

// ------------------------------------------------------------------------------------------ Muskeln

export interface MuscleLoad {
  muscle: MuscleId;
  /** Gewichtete Sätze pro Woche im Schnitt (Hauptmuskel 1, Nebenmuskel 0,5). */
  perWeek: number;
}

export const SECONDARY_WEIGHT = 0.5;

/** Sätze je Muskel und Woche, gemittelt über die letzten `weeks` Wochen (rollierend ab jetzt). Nur Muskeln mit Sätzen. */
export function muscleLoad(
  sessions: Session[],
  exercises: Map<string, Pick<Exercise, 'primaryMuscles' | 'secondaryMuscles'>>,
  weeks = 4,
  now = Date.now(),
): MuscleLoad[] {
  const from = now - weeks * 7 * DAY;
  const sum = new Map<MuscleId, number>();
  for (const s of finishedSessions(sessions)) {
    if (s.startedAt < from) continue;
    for (const e of s.entries) {
      if (e.skipped) continue;
      const ex = exercises.get(e.exerciseId);
      if (!ex) continue;
      const n = e.sets.filter(isWorkSet).length;
      if (!n) continue;
      for (const m of ex.primaryMuscles) sum.set(m, (sum.get(m) ?? 0) + n);
      for (const m of ex.secondaryMuscles) if (!ex.primaryMuscles.includes(m)) sum.set(m, (sum.get(m) ?? 0) + n * SECONDARY_WEIGHT);
    }
  }
  return [...sum.entries()].map(([muscle, v]) => ({ muscle, perWeek: v / weeks })).sort((a, b) => b.perWeek - a.perWeek);
}

// ------------------------------------------------------------------------------------------ Planvergleich

export interface PlanCompareRow {
  exerciseId: string;
  unit: Unit;
  sessions: number;
  start: ExercisePoint;
  end: ExercisePoint;
  /** Veränderung der geschätzten Maximalkraft (kg) bzw. des Höchstgewichts (Platte) in Prozent; undefined, wenn nur ein Punkt. */
  changePct?: number;
}

/** Start- und Endwerte der Übungen eines Plans aus den Einheiten, die mit diesem Plan trainiert wurden. Meist trainierte zuerst. */
export function planComparison(plan: Pick<Plan, 'id' | 'workouts'>, sessions: Session[], maxRows = 8): PlanCompareRow[] {
  const own = finishedSessions(sessions).filter((s) => s.planId === plan.id);
  if (!own.length) return [];
  const ids = [...new Set(plan.workouts.flatMap((w) => w.items.map((i) => i.exerciseId)))];
  const rows: PlanCompareRow[] = [];
  for (const exerciseId of ids) {
    for (const unit of ['kg', 'platte'] as const) {
      const pts = exerciseSeries(own, exerciseId, unit);
      if (!pts.length) continue;
      const start = pts[0];
      const end = pts[pts.length - 1];
      const a = unit === 'kg' ? start.best1rm || start.maxWeight : start.maxWeight;
      const b = unit === 'kg' ? end.best1rm || end.maxWeight : end.maxWeight;
      rows.push({ exerciseId, unit, sessions: pts.length, start, end, changePct: pts.length > 1 && a > 0 ? ((b - a) / a) * 100 : undefined });
    }
  }
  return rows.sort((a, b) => b.sessions - a.sessions).slice(0, maxRows);
}

// ------------------------------------------------------------------------------------------ Steigerungsvorschlag

export interface Suggestion {
  kind: 'start' | 'erhoehen' | 'halten' | 'senken';
  /** Vorgeschlagenes Gewicht (kg bzw. Plattennummer), falls sinnvoll. */
  weight?: number;
  /** Letztes Arbeitsgewicht und die Wiederholungen dabei. */
  lastWeight?: number;
  text: string;
  /** Seit mehreren Einheiten keine Verbesserung der geschätzten Maximalkraft. */
  stalled: boolean;
}

const STALL_SESSIONS = 3;

/**
 * Einfache Doppelprogression: Schafft man in allen Arbeitssätzen mit dem letzten Gewicht die obere Wiederholungsgrenze,
 * folgt die nächste Gewichtsstufe; liegt man unter der unteren Grenze, bleibt das Gewicht (nach zwei Mal in Folge: eine Stufe weniger);
 * sonst gilt: gleiches Gewicht, mehr Wiederholungen. Gilt nur für Übungen mit Gewicht und Wiederholungen.
 */
export function suggestNext(
  sessions: Session[],
  exercise: Pick<Exercise, 'id' | 'tracking' | 'weightStep'>,
  eq: Pick<Equipment, 'weightStack'> | undefined,
  excludeSessionId?: string,
  /** „nächstes Mal“ im Verlauf, „heute“ mitten im Training. */
  when = 'nächstes Mal',
): Suggestion | undefined {
  if (exercise.tracking !== 'gewicht_wdh' && exercise.tracking !== 'koerpergewicht_wdh') return undefined;
  const unit = weightUnit(eq);
  const unitLabel = (w: number) => (unit === 'platte' ? `Platte ${fmt(w)}` : `${fmt(w)} kg`);
  const done = finishedSessions(sessions).filter((s) => s.id !== excludeSessionId);
  const perSession: { sets: SetEntry[]; repMin: number; repMax: number }[] = [];
  for (const s of done) {
    const entries = s.entries.filter((e) => e.exerciseId === exercise.id && !e.skipped && unitOf(e) === unit);
    const sets = entries.flatMap((e) => e.sets.filter(isWorkSet));
    if (!sets.length) continue;
    perSession.push({ sets, repMin: entries[entries.length - 1].repMin || 8, repMax: entries[entries.length - 1].repMax || 12 });
  }
  if (!perSession.length) return { kind: 'start', text: 'Noch keine Werte – wähle ein Gewicht, mit dem du die Wiederholungen sauber schaffst.', stalled: false };

  const last = perSession[perSession.length - 1];
  const w = Math.max(...last.sets.map((x) => x.weight ?? 0));
  const atW = last.sets.filter((x) => (x.weight ?? 0) === w);
  const minReps = Math.min(...atW.map((x) => x.reps ?? 0));
  const stalled = isStalled(sessions, exercise.id, unit, excludeSessionId);
  const base = { lastWeight: w, stalled };

  if (w > 0 && minReps >= last.repMax) {
    const next = stepWeight(w, 1, exercise, eq);
    if (next > w) return { kind: 'erhoehen', weight: next, ...base, text: `Alle Sätze mit ${unitLabel(w)} bis ${last.repMax} Wdh. geschafft – ${when} ${unitLabel(next)}.` };
    return { kind: 'halten', weight: w, ...base, text: `Höchste Stufe erreicht – ${unitLabel(w)} halten und die Ausführung verfeinern.` };
  }
  if (w > 0 && minReps < last.repMin) {
    const prev = perSession.length > 1 ? perSession[perSession.length - 2] : undefined;
    const prevW = prev ? Math.max(...prev.sets.map((x) => x.weight ?? 0)) : 0;
    const prevMin = prev ? Math.min(...prev.sets.filter((x) => (x.weight ?? 0) === prevW).map((x) => x.reps ?? 0)) : 0;
    if (prev && prevW === w && prevMin < prev.repMin) {
      const lower = stepWeight(w, -1, exercise, eq);
      if (lower < w) return { kind: 'senken', weight: lower, ...base, text: `Zwei Mal unter ${last.repMin} Wdh. mit ${unitLabel(w)} – eine Stufe leichter (${unitLabel(lower)}) und sauber aufbauen.` };
    }
    return { kind: 'halten', weight: w, ...base, text: `${unitLabel(w)} halten und mindestens ${last.repMin} Wdh. in jedem Satz erreichen.` };
  }
  return { kind: 'halten', weight: w || undefined, ...base, text: w > 0 ? `${unitLabel(w)} halten und jeweils eine Wiederholung mehr schaffen (Ziel: ${last.repMax}).` : `Wiederholungen steigern (Ziel: ${last.repMax}).` };
}

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

/** Keine Verbesserung der geschätzten Maximalkraft (bzw. des Höchstgewichts) in den letzten Einheiten. */
export function isStalled(sessions: Session[], exerciseId: string, unit: Unit = 'kg', excludeSessionId?: string, window = STALL_SESSIONS): boolean {
  const pts = exerciseSeries(sessions.filter((s) => s.id !== excludeSessionId), exerciseId, unit);
  if (pts.length < window + 1) return false;
  // Ohne Zusatzgewicht (Körpergewicht, Hilfsgewicht) zählen die Wiederholungen
  const value = (p: ExercisePoint) => (unit === 'kg' ? p.best1rm || p.maxWeight || p.reps : p.maxWeight || p.reps);
  const recent = pts.slice(-window);
  const before = Math.max(...pts.slice(0, -window).map(value));
  return Math.max(...recent.map(value)) <= before + 1e-9;
}

// ------------------------------------------------------------------------------------------ Körperwerte

export type BodyKey = 'weightKg' | 'chest' | 'arm' | 'waist' | 'hip' | 'thigh';
export const BODY_FIELDS: { key: BodyKey; label: string; unit: string }[] = [
  { key: 'weightKg', label: 'Körpergewicht', unit: 'kg' },
  { key: 'chest', label: 'Brust', unit: 'cm' },
  { key: 'arm', label: 'Oberarm', unit: 'cm' },
  { key: 'waist', label: 'Taille', unit: 'cm' },
  { key: 'hip', label: 'Hüfte', unit: 'cm' },
  { key: 'thigh', label: 'Oberschenkel', unit: 'cm' },
];

/** Zeitpunkte eines Körperwerts, älteste zuerst. `date` ist JJJJ-MM-TT (Mittag lokaler Zeit als Zeitstempel). */
export function bodySeries(metrics: Pick<BodyMetric, 'date' | BodyKey>[], key: BodyKey): { date: number; label: string; value: number }[] {
  return metrics
    .filter((m) => typeof m[key] === 'number' && Number.isFinite(m[key]))
    .map((m) => {
      const [y, mo, d] = m.date.split('-').map(Number);
      return { date: new Date(y, mo - 1, d, 12).getTime(), label: m.date, value: m[key] as number };
    })
    .sort((a, b) => a.date - b.date);
}
