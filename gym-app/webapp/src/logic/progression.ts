import type { Entry, Equipment, Exercise, PlanItem, Session, SetEntry, WeightStack } from '../data/types';

const EPS = 1e-6;

export function roundTo(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Alle Gewichte, die an einem Gerät mit Gewichtsstufen einstellbar sind. */
export function stackWeights(stack: WeightStack): number[] {
  // Unregelmäßige Blöcke (z. B. 9, 14, 18, 23 … kg oder Plattennummern) haben eine ausdrückliche Stufenliste.
  if (stack.levels?.length) return [...new Set(stack.levels)].sort((a, b) => a - b);
  const out: number[] = [];
  const n = Math.floor((stack.maxKg - stack.minKg) / stack.stepKg + EPS);
  for (let i = 0; i <= n; i++) out.push(roundTo(stack.minKg + i * stack.stepKg));
  return out;
}

/**
 * Liest eine Stufenliste aus Text. Trenner sind Semikolon, Zeilenumbruch und Leerzeichen; ein Komma ist das Dezimalkomma
 * ("13,6 22,7"). Nur wenn ein Eintrag mehrere Kommas enthält ("9,14,18"), gelten sie als Trenner.
 * Liefert die sortierten, eindeutigen Werte oder einen Fehlertext.
 */
export function parseLevels(text: string): { levels: number[] } | { error: string } {
  const tokens = text
    .split(/[;\s]+/)
    .flatMap((t) => (t.split(',').length > 2 ? t.split(',') : [t]))
    .filter(Boolean);
  const nums: number[] = [];
  for (const t of tokens) {
    const n = /^\d+([.,]\d+)?$/.test(t) ? Number(t.replace(',', '.')) : NaN;
    if (!Number.isFinite(n)) return { error: `„${t}“ ist keine gültige Zahl.` };
    nums.push(n);
  }
  const levels = [...new Set(nums)].sort((a, b) => a - b);
  if (levels.length === 1) return { error: 'Mindestens zwei Stufen angeben – oder das Feld leer lassen.' };
  return { levels };
}

/** Nächstgelegenes tatsächlich einstellbares Gewicht. */
export function snapToStack(weight: number, stack: WeightStack): number {
  if (stack.levels?.length) {
    const lv = stackWeights(stack);
    let best = lv[0];
    for (const l of lv) if (Math.abs(l - weight) < Math.abs(best - weight) - EPS || (Math.abs(Math.abs(l - weight) - Math.abs(best - weight)) <= EPS && l > best)) best = l;
    return best;
  }
  if (weight <= stack.minKg) return stack.minKg;
  if (weight >= stack.maxKg) return roundTo(stack.minKg + Math.floor((stack.maxKg - stack.minKg) / stack.stepKg + EPS) * stack.stepKg);
  const idx = Math.round((weight - stack.minKg) / stack.stepKg);
  return roundTo(stack.minKg + idx * stack.stepKg);
}

/** Schrittweite für die +/−-Tasten einer Übung. */
export function stepFor(ex: Pick<Exercise, 'weightStep'>, eq: Pick<Equipment, 'weightStack'> | undefined, fallback = 2.5): number {
  return eq?.weightStack?.stepKg ?? (ex.weightStep > 0 ? ex.weightStep : fallback);
}

/** Einheit der Gewichtsangabe: "kg" oder "platte" (Blöcke, die nur Plattennummern tragen). */
export function weightUnit(eq: Pick<Equipment, 'weightStack'> | undefined): 'kg' | 'platte' {
  return eq?.weightStack?.unit === 'platte' ? 'platte' : 'kg';
}

/**
 * Ein Tipp auf + / −: bei Geräten mit Gewichtsstufen springt der Wert genau in diesen Stufen,
 * sonst in Schrittweiten der Übung. `dir` ist +1 oder −1. Ohne Wert beginnt es am Minimum bzw. bei einem Schritt.
 * `allowNegative` erlaubt Hilfsgewichte (z. B. Klimmzug mit Unterstützung).
 */
export function stepWeight(
  current: number | undefined,
  dir: 1 | -1,
  ex: Pick<Exercise, 'weightStep'>,
  eq: Pick<Equipment, 'weightStack'> | undefined,
  opts: { allowNegative?: boolean; fallbackStep?: number } = {},
): number {
  const stack = eq?.weightStack;
  if (stack?.levels?.length) {
    const lv = stackWeights(stack);
    if (current === undefined) return lv[0];
    if (dir > 0) return lv.find((l) => l > current + EPS) ?? lv[lv.length - 1];
    return [...lv].reverse().find((l) => l < current - EPS) ?? lv[0];
  }
  if (stack) {
    if (current === undefined) return dir > 0 ? stack.minKg : stack.minKg;
    const snapped = snapToStack(current, stack);
    // Wenn der Wert zwischen zwei Stufen lag (Direkteingabe), landet die Taste auf der nächsten Stufe in Richtung dir.
    if (Math.abs(snapped - current) > EPS) {
      if (dir > 0 && snapped < current) return Math.min(stack.maxKg, roundTo(snapped + stack.stepKg));
      if (dir < 0 && snapped > current) return Math.max(stack.minKg, roundTo(snapped - stack.stepKg));
      return snapped;
    }
    return dir > 0 ? Math.min(stack.maxKg, roundTo(snapped + stack.stepKg)) : Math.max(stack.minKg, roundTo(snapped - stack.stepKg));
  }
  const step = stepFor(ex, eq, opts.fallbackStep);
  const base = current ?? 0;
  const next = roundTo(base + dir * step);
  return opts.allowNegative ? next : Math.max(0, next);
}

/**
 * Letztes abgeschlossenes Training mit dieser Übung (nur echte Sätze, ohne Aufwärmen).
 * Kommt die Übung in einer Einheit mehrfach vor (z. B. nach einem Tausch), werden die Sätze zusammengeführt.
 * `unit` beschränkt auf Einträge mit derselben Einheit (kg oder Plattennummer), damit Werte nicht vermischt werden.
 */
export function lastPerformance(
  sessions: Session[],
  exerciseId: string,
  excludeSessionId?: string,
  unit: 'kg' | 'platte' = 'kg',
): { session: Session; sets: SetEntry[] } | undefined {
  const done = sessions
    .filter((s) => s.id !== excludeSessionId && s.endedAt !== undefined)
    .sort((a, b) => b.startedAt - a.startedAt);
  for (const s of done) {
    const sets = s.entries
      .filter((e) => e.exerciseId === exerciseId && !e.skipped && (e.unit ?? 'kg') === unit)
      .flatMap((e) => e.sets.filter((x) => x.doneAt !== undefined && x.kind !== 'aufwaermen'));
    if (sets.length) return { session: s, sets };
  }
  return undefined;
}

export function formatNumber(n: number): string {
  return String(roundTo(n, 2)).replace('.', ',');
}

/** "3 × 10 @ 40 kg" aus einer Satzliste; bei wechselnden Werten das Mittel der Arbeitssätze. */
export function summarizeSets(sets: SetEntry[], tracking: Exercise['tracking'] = 'gewicht_wdh', unilateral = false, unit: 'kg' | 'platte' = 'kg'): string {
  const work = sets.filter((s) => s.kind !== 'aufwaermen');
  if (!work.length) return '–';
  if (tracking === 'cardio' || tracking === 'zeit') {
    const s = work[work.length - 1];
    const parts: string[] = [];
    if (s.durationSec) parts.push(tracking === 'zeit' ? `${work.length > 1 ? work.length + ' × ' : ''}${s.durationSec} s` : `${Math.round(s.durationSec / 60)} min`);
    if (s.distanceKm) parts.push(`${formatNumber(s.distanceKm)} km`);
    return parts.join(' · ') || '–';
  }
  const first = work[0];
  const uniform = work.every((s) => s.weight === first.weight && s.reps === first.reps);
  const w = first.weight !== undefined && first.weight !== 0 ? (unit === 'platte' ? ` · Platte ${formatNumber(first.weight)}` : ` · ${formatNumber(first.weight)} kg`) : '';
  const side = unilateral ? ' je Seite' : '';
  if (uniform) return `${work.length} × ${first.reps ?? '–'}${side}${w}`;
  // wechselnde Werte: „40 kg × 10 · 35 kg × 8“ – wie im Rest der App erst das Gewicht, dann die Wiederholungen
  const lab = (w: number | undefined) => (w ? (unit === 'platte' ? `Platte ${formatNumber(w)}` : `${formatNumber(w)} kg`) + ' × ' : '');
  return work.map((s) => `${lab(s.weight)}${s.reps ?? '–'}`).join(' · ') + side;
}

/**
 * Vorbelegte Sätze für eine Übung im Training:
 * die Werte vom letzten Mal (Satz für Satz, weitere Sätze übernehmen den letzten Wert),
 * sonst das Zielgewicht aus dem Plan bzw. der Anfang der Gewichtsstufen und die untere Wiederholungsgrenze.
 */
export function prefillSets(
  item: Pick<PlanItem, 'sets' | 'repMin' | 'repMax' | 'targetWeight'>,
  last: { sets: SetEntry[] } | undefined,
  ex: Pick<Exercise, 'tracking' | 'weightStep'>,
  eq?: Pick<Equipment, 'weightStack'>,
): SetEntry[] {
  const count = Math.max(1, item.sets);
  const sets: SetEntry[] = [];
  const lastWork = last?.sets.filter((s) => s.kind !== 'aufwaermen') ?? [];
  for (let i = 0; i < count; i++) {
    const src = lastWork.length ? lastWork[Math.min(i, lastWork.length - 1)] : undefined;
    if (ex.tracking === 'cardio') {
      sets.push({ kind: 'normal', durationSec: src?.durationSec ?? 20 * 60, distanceKm: src?.distanceKm, level: src?.level });
    } else if (ex.tracking === 'zeit') {
      sets.push({ kind: 'normal', durationSec: src?.durationSec ?? 45 });
    } else {
      let weight = src?.weight ?? item.targetWeight;
      if (weight !== undefined && eq?.weightStack) weight = snapToStack(weight, eq.weightStack);
      if (weight === undefined && ex.tracking === 'gewicht_wdh') weight = eq?.weightStack ? eq.weightStack.minKg : undefined;
      sets.push({
        kind: 'normal',
        weight,
        reps: src?.reps ?? item.repMin,
      });
    }
  }
  return sets;
}

/** Neuen Trainingseintrag aus einem Planeintrag erzeugen. */
export function entryFromItem(
  item: PlanItem,
  ex: Exercise,
  eq: Equipment | undefined,
  sessions: Session[],
): Entry {
  const last = lastPerformance(sessions, item.exerciseId, undefined, weightUnit(eq));
  return {
    exerciseId: item.exerciseId,
    ...(weightUnit(eq) === 'platte' ? { unit: 'platte' as const } : {}),
    sets: prefillSets(item, last, ex, eq),
    restSec: item.restSec,
    repMin: item.repMin,
    repMax: item.repMax,
    targetWeight: item.targetWeight,
    supersetGroup: item.supersetGroup,
  };
}

/** Wiederholungen schrittweise; nie unter 0. */
export function stepReps(current: number | undefined, dir: 1 | -1): number {
  return Math.max(0, (current ?? 0) + dir);
}
