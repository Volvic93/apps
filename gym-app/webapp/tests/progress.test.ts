import { describe, expect, it } from 'vitest';
import type { Entry, Plan, Session, SetEntry } from '../src/data/types';
import {
  averagePerWeek,
  bodySeries,
  cardioSeries,
  dayKey,
  exerciseSeries,
  isStalled,
  muscleLoad,
  planComparison,
  rangeStart,
  recordList,
  suggestNext as suggestNextAt,
  trainedExercises,
  weeklyStats,
} from '../src/logic/progress';

const DAY = 24 * 3600 * 1000;

/** Die Beispiel-Einheiten haben feste, kleine Zeitstempel: „jetzt“ liegt hier einen Tag nach der letzten Einheit. */
const suggestNext = (sessions: Session[], ex: Parameters<typeof suggestNextAt>[1], eq: Parameters<typeof suggestNextAt>[2], excl?: string) =>
  suggestNextAt(sessions, ex, eq, excl, undefined, Math.max(0, ...sessions.map((x) => x.startedAt)) + DAY);
const done = (weight: number, reps: number, kind: SetEntry['kind'] = 'normal'): SetEntry => ({ kind, weight, reps, doneAt: 1 });
function entry(exerciseId: string, sets: SetEntry[], extra: Partial<Entry> = {}): Entry {
  return { exerciseId, sets, restSec: 90, repMin: 8, repMax: 12, ...extra };
}
function session(id: string, startedAt: number, entries: Entry[], extra: Partial<Session> = {}): Session {
  return { id, createdAt: startedAt, updatedAt: startedAt, workoutName: 'Push', startedAt, endedAt: startedAt + 3600 * 1000, entries, ...extra };
}
const ex = { id: 'ex', tracking: 'gewicht_wdh' as const, weightStep: 2.5 };

describe('Übungsverlauf', () => {
  it('bildet je Einheit Höchstgewicht, geschätzte Maximalkraft und Volumen', () => {
    const s = [
      session('a', 1 * DAY, [entry('ex', [done(40, 10), done(40, 8), done(20, 12, 'aufwaermen')])]),
      session('b', 2 * DAY, [entry('ex', [done(45, 8)])]),
      session('c', 3 * DAY, [entry('ex', [done(99, 1)])], { endedAt: undefined }), // läuft noch
    ];
    const pts = exerciseSeries(s, 'ex');
    expect(pts.length).toBe(2);
    expect(pts[0]).toMatchObject({ maxWeight: 40, volume: 40 * 10 + 40 * 8, reps: 18, sets: 2 });
    expect(pts[0].best1rm).toBeCloseTo(40 * (1 + 10 / 30));
    expect(pts[1].maxWeight).toBe(45);
  });

  it('fasst mehrere Einträge derselben Übung zusammen und trennt kg von Plattennummern', () => {
    const s = [session('a', DAY, [entry('ex', [done(40, 10)]), entry('ex', [done(50, 5)]), entry('ex', [done(12, 10)], { unit: 'platte' })])];
    const kg = exerciseSeries(s, 'ex', 'kg');
    expect(kg.length).toBe(1);
    expect(kg[0].maxWeight).toBe(50);
    const pl = exerciseSeries(s, 'ex', 'platte');
    expect(pl[0]).toMatchObject({ maxWeight: 12, volume: 0, best1rm: 0, reps: 10 });
  });

  it('wertet Cardio nach Dauer, Strecke und Tempo aus', () => {
    const s = [session('a', DAY, [entry('lauf', [{ kind: 'normal', durationSec: 1800, distanceKm: 5, doneAt: 1 }])])];
    const c = cardioSeries(s, 'lauf');
    expect(c[0].durationMin).toBe(30);
    expect(c[0].pace).toBeCloseTo(6);
  });

  it('listet trainierte Übungen mit Anzahl und letztem Datum', () => {
    const s = [session('a', DAY, [entry('x', [done(10, 10)]), entry('y', [])]), session('b', 2 * DAY, [entry('x', [done(10, 10)])])];
    const t = trainedExercises(s);
    expect(t).toEqual([{ exerciseId: 'x', count: 2, last: 2 * DAY }]);
  });
});

describe('Rekorde', () => {
  it('nimmt den besten Satz je Übung und Einheit, ohne Aufwärmsätze', () => {
    const s = [
      session('a', DAY, [entry('ex', [done(40, 10), done(100, 5, 'aufwaermen')])]),
      session('b', 2 * DAY, [entry('ex', [done(42.5, 10)]), entry('p', [done(12, 10)], { unit: 'platte' })]),
    ];
    const r = recordList(s);
    expect(r.find((x) => x.exerciseId === 'ex')).toMatchObject({ weight: 42.5, reps: 10, unit: 'kg', sessionId: 'b' });
    expect(r.find((x) => x.exerciseId === 'p')?.unit).toBe('platte');
  });
});

describe('Wochen und Muskeln', () => {
  const now = new Date(2026, 10, 14, 12).getTime(); // Samstag, 14.11.2026

  it('zählt Einheiten, Sätze, Volumen und Dauer je Kalenderwoche (Montag bis Sonntag)', () => {
    const mon = new Date(2026, 10, 9, 18).getTime();
    const prevWeek = new Date(2026, 10, 3, 18).getTime();
    const s = [session('a', mon, [entry('ex', [done(40, 10), done(40, 10)])]), session('b', prevWeek, [entry('ex', [done(30, 10)])])];
    const w = weeklyStats(s, 4, now);
    expect(w.length).toBe(4);
    expect(w[3]).toMatchObject({ sessions: 1, workSets: 2, volume: 800, durationMin: 60 });
    expect(w[2]).toMatchObject({ sessions: 1, workSets: 1, volume: 300 });
    expect(w[0].sessions).toBe(0);
    expect(averagePerWeek(w)).toBeCloseTo(1); // erste Einheit in Woche 3 von 4 → 2 Einheiten / 2 Wochen
  });

  it('zählt Plattennummern nicht ins Wochenvolumen', () => {
    const s = [session('a', new Date(2026, 10, 10, 18).getTime(), [entry('p', [done(12, 15)], { unit: 'platte' })])];
    expect(weeklyStats(s, 1, now)[0].volume).toBe(0);
  });

  it('rechnet Sätze je Muskel und Woche (Hauptmuskel 1, Nebenmuskel 0,5)', () => {
    const exercises = new Map([['ex', { primaryMuscles: ['brust' as const], secondaryMuscles: ['trizeps' as const] }]]);
    const s = [session('a', now - 2 * DAY, [entry('ex', [done(40, 10), done(40, 10), done(40, 10), done(40, 10)])])];
    const load = muscleLoad(s, exercises, 4, now);
    expect(load.find((l) => l.muscle === 'brust')?.perWeek).toBe(1);
    expect(load.find((l) => l.muscle === 'trizeps')?.perWeek).toBe(0.5);
    expect(muscleLoad(s, exercises, 4, now + 60 * DAY)).toEqual([]); // zu lange her
  });

  it('kennt Tagesschlüssel und Zeiträume', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(rangeStart('alles')).toBeUndefined();
    expect(rangeStart('4w', 100 * DAY)).toBe(72 * DAY);
  });
});

describe('Planvergleich', () => {
  const plan = { id: 'p', workouts: [{ id: 'w', name: 'Push', items: [{ id: 'i', exerciseId: 'ex', sets: 3, repMin: 8, repMax: 12, restSec: 90 }] }] } as unknown as Plan;
  it('vergleicht erste und letzte Einheit mit diesem Plan', () => {
    const s = [
      session('a', DAY, [entry('ex', [done(40, 10)])], { planId: 'p' }),
      session('b', 2 * DAY, [entry('ex', [done(60, 10)])], { planId: 'p' }),
      session('x', 3 * DAY, [entry('ex', [done(200, 10)])], { planId: 'anderer' }),
    ];
    const rows = planComparison(plan, s);
    expect(rows.length).toBe(1);
    expect(rows[0].sessions).toBe(2);
    expect(rows[0].start.maxWeight).toBe(40);
    expect(rows[0].end.maxWeight).toBe(60);
    expect(rows[0].changePct).toBeCloseTo(50);
    expect(planComparison(plan, [])).toEqual([]);
  });
});

describe('Steigerungsvorschlag', () => {
  const eq = { weightStack: { minKg: 5, maxKg: 100, stepKg: 5 } };

  it('schlägt zum Start nur eine Auswahl vor', () => {
    expect(suggestNext([], ex, undefined)?.kind).toBe('start');
  });

  it('erhöht, wenn alle Sätze die obere Wiederholungsgrenze erreichen – in den Stufen des Geräts', () => {
    const s = [session('a', DAY, [entry('ex', [done(40, 12), done(40, 12), done(40, 12)])])];
    const r = suggestNext(s, ex, eq)!;
    expect(r.kind).toBe('erhoehen');
    expect(r.weight).toBe(45);
    expect(suggestNext(s, ex, undefined)!.weight).toBe(42.5);
  });

  it('hält das Gewicht, wenn die obere Grenze noch nicht erreicht ist', () => {
    const s = [session('a', DAY, [entry('ex', [done(40, 12), done(40, 10)])])];
    const r = suggestNext(s, ex, eq)!;
    expect(r.kind).toBe('halten');
    expect(r.weight).toBe(40);
  });

  it('senkt erst, wenn die untere Grenze zwei Mal in Folge verfehlt wurde', () => {
    const one = [session('a', DAY, [entry('ex', [done(40, 6), done(40, 5)])])];
    expect(suggestNext(one, ex, eq)!.kind).toBe('halten');
    const two = [...one, session('b', 2 * DAY, [entry('ex', [done(40, 6), done(40, 6)])])];
    const r = suggestNext(two, ex, eq)!;
    expect(r.kind).toBe('senken');
    expect(r.weight).toBe(35);
  });

  it('bleibt an der höchsten Stufe und kennt Plattennummern', () => {
    const top = [session('a', DAY, [entry('ex', [done(100, 12), done(100, 12)])])];
    expect(suggestNext(top, ex, eq)!.kind).toBe('halten');
    const pl = { weightStack: { minKg: 2, maxKg: 28, stepKg: 1, unit: 'platte' as const } };
    const s = [session('a', DAY, [entry('ex', [done(12, 15), done(12, 15)], { unit: 'platte', repMax: 15, repMin: 10 })])];
    const r = suggestNext(s, ex, pl)!;
    expect(r.weight).toBe(13);
    expect(r.text).toContain('Platte 13');
  });

  it('gilt nicht für Cardio und Zeitübungen', () => {
    expect(suggestNext([], { ...ex, tracking: 'cardio' }, undefined)).toBeUndefined();
  });

  it('erkennt Stagnation über mehrere Einheiten', () => {
    const mk = (i: number, w: number) => session('s' + i, i * DAY, [entry('ex', [done(w, 10)])]);
    expect(isStalled([mk(1, 40), mk(2, 40), mk(3, 40), mk(4, 40), mk(5, 40)], 'ex')).toBe(true);
    expect(isStalled([mk(1, 40), mk(2, 40), mk(3, 40), mk(4, 40), mk(5, 45)], 'ex')).toBe(false);
    expect(isStalled([mk(1, 40), mk(2, 40)], 'ex')).toBe(false);
  });
});

describe('Körperwerte', () => {
  it('liefert die Reihe eines Werts, sortiert und ohne Lücken', () => {
    const m = [
      { date: '2026-11-10', weightKg: 82 },
      { date: '2026-11-01', weightKg: 83.5, waist: 90 },
      { date: '2026-11-05' },
    ];
    const w = bodySeries(m, 'weightKg');
    expect(w.map((x) => x.value)).toEqual([83.5, 82]);
    expect(bodySeries(m, 'waist').length).toBe(1);
    expect(bodySeries(m, 'chest')).toEqual([]);
  });
});

describe('Steigerungsvorschlag nach langer Pause', () => {
  const ex = { id: 'ex', tracking: 'gewicht_wdh', weightStep: 2.5 } as never;
  const mk = (w: number) => [session('a', 10 * DAY, [entry('ex', [done(w, 12), done(w, 12), done(w, 12)])])];

  it('schlägt nach mehr als 14 Tagen etwa 10 % weniger vor', () => {
    const r = suggestNextAt(mk(60), ex, undefined, undefined, undefined, 10 * DAY + 20 * DAY)!;
    expect(r.kind).toBe('senken');
    expect(r.weight).toBe(55);
    expect(r.text).toContain('20 Tage Pause');
  });

  it('bleibt bei der normalen Regel, wenn die Pause höchstens 14 Tage dauert', () => {
    const r = suggestNextAt(mk(60), ex, undefined, undefined, undefined, 10 * DAY + 14 * DAY)!;
    expect(r.kind).toBe('erhoehen');
  });

  it('nutzt bei Plattennummern eine Stufe weniger und bei Gewichtsstufen die nächste Stufe', () => {
    const pl = { weightStack: { minKg: 2, maxKg: 28, stepKg: 1, unit: 'platte' } } as never;
    const sPl = [session('a', 10 * DAY, [{ ...entry('ex', [done(12, 12), done(12, 12), done(12, 12)]), unit: 'platte' } as Entry])];
    expect(suggestNextAt(sPl, ex, pl, undefined, undefined, 40 * DAY)!.weight).toBe(11);
    const kg = { weightStack: { minKg: 5, maxKg: 100, stepKg: 5 } } as never;
    expect(suggestNextAt(mk(60), ex, kg, undefined, undefined, 40 * DAY)!.weight).toBe(55);
  });
});
