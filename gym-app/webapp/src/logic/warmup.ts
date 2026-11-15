import { groupOfMuscle } from '../data/muscles';
import type { Entry, Equipment, Exercise, Goal } from '../data/types';
import { snapToStack } from './progression';

export interface WarmupSet {
  weight: number;
  reps: number;
}

/**
 * Aufwärmsätze aus dem heutigen Zielgewicht: etwa 50 % × 10 und 70 % × 5, bei Ziel „Kraft“ zusätzlich 85 % × 2.
 * Gerundet auf die Stufen des Geräts (sonst auf die Schrittweite der Übung); Sätze, die dabei nicht leichter als der
 * Arbeitssatz wären oder doppelt vorkämen, entfallen. Bei Plattennummern gibt es keine Vorschläge (keine kg-Prozente).
 */
export function warmupSets(target: number, goal: Goal, ex: Pick<Exercise, 'weightStep'>, eq?: Pick<Equipment, 'weightStack'>): WarmupSet[] {
  if (!(target > 0) || eq?.weightStack?.unit === 'platte') return [];
  const plan: [number, number][] = goal === 'kraft' ? [[0.5, 10], [0.7, 5], [0.85, 2]] : [[0.5, 10], [0.7, 5]];
  const step = eq?.weightStack?.stepKg ?? (ex.weightStep > 0 ? ex.weightStep : 2.5);
  const out: WarmupSet[] = [];
  for (const [pct, reps] of plan) {
    const raw = target * pct;
    const weight = eq?.weightStack ? snapToStack(raw, eq.weightStack) : Math.max(step, Math.round(raw / step) * step);
    const w = Math.round(weight * 100) / 100;
    if (w <= 0 || w >= target * 0.95) continue;
    if (out.length && w <= out[out.length - 1].weight) continue;
    out.push({ weight: w, reps });
  }
  return out;
}

/**
 * Soll bei dieser Übung ein Knopf „Aufwärmsätze“ erscheinen? Nur bei der ersten Übung mit Gewicht je Muskelgruppe in der Einheit,
 * solange noch kein Satz gemacht und noch kein Aufwärmsatz angelegt ist.
 */
export function warmupOffer(
  entries: Entry[],
  idx: number,
  exMap: Map<string, Exercise>,
  eqMap: Map<string, Equipment>,
  goal: Goal,
  enabled: boolean,
): { target: number; sets: WarmupSet[] } | undefined {
  if (!enabled) return undefined;
  const entry = entries[idx];
  const ex = entry && exMap.get(entry.exerciseId);
  if (!entry || !ex || entry.skipped || ex.tracking !== 'gewicht_wdh') return undefined;
  if (entry.sets.some((s) => s.kind === 'aufwaermen' || s.doneAt !== undefined)) return undefined;
  const groups = new Set(ex.primaryMuscles.map((m) => groupOfMuscle(m)));
  for (let i = 0; i < idx; i++) {
    const before = exMap.get(entries[i].exerciseId);
    if (!before || entries[i].skipped || before.tracking !== 'gewicht_wdh') continue;
    if (before.primaryMuscles.some((m) => groups.has(groupOfMuscle(m)))) return undefined;
  }
  const target = entry.sets.find((s) => s.kind === 'normal' && s.weight)?.weight ?? entry.targetWeight;
  if (!target) return undefined;
  const sets = warmupSets(target, goal, ex, ex.equipmentId ? eqMap.get(ex.equipmentId) : undefined);
  return sets.length ? { target, sets } : undefined;
}
