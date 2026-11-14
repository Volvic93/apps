import { describe, expect, it } from 'vitest';
import type { Equipment, Exercise, Session, SetEntry } from '../src/data/types';
import { entryFromItem, lastPerformance, parseLevels, prefillSets, snapToStack, stackWeights, stepFor, stepWeight, summarizeSets } from '../src/logic/progression';

const stack = { minKg: 5, maxKg: 100, stepKg: 5 };
const eqStack = { weightStack: stack };
const exFree = { weightStep: 2.5 };

describe('Gewichtsstufen', () => {
  it('erzeugt alle Stufen 5–100 in 5er-Schritten', () => {
    const w = stackWeights(stack);
    expect(w.length).toBe(20);
    expect(w[0]).toBe(5);
    expect(w[19]).toBe(100);
  });

  it('rastet Werte auf die nächste Stufe ein', () => {
    expect(snapToStack(42, stack)).toBe(40);
    expect(snapToStack(43, stack)).toBe(45);
    expect(snapToStack(1, stack)).toBe(5);
    expect(snapToStack(250, stack)).toBe(100);
  });

  it('springt mit + und − genau in den Stufen des Geräts', () => {
    expect(stepWeight(40, 1, exFree, eqStack)).toBe(45);
    expect(stepWeight(40, -1, exFree, eqStack)).toBe(35);
    expect(stepWeight(100, 1, exFree, eqStack)).toBe(100);
    expect(stepWeight(5, -1, exFree, eqStack)).toBe(5);
    expect(stepWeight(undefined, 1, exFree, eqStack)).toBe(5);
  });

  it('behandelt Direkteingaben zwischen den Stufen sinnvoll', () => {
    expect(stepWeight(42, 1, exFree, eqStack)).toBe(45);
    expect(stepWeight(42, -1, exFree, eqStack)).toBe(40);
    expect(stepWeight(43, 1, exFree, eqStack)).toBe(45);
    expect(stepWeight(43, -1, exFree, eqStack)).toBe(40);
  });

  it('nutzt ohne Gewichtsstufen die Schrittweite der Übung', () => {
    expect(stepWeight(20, 1, { weightStep: 2.5 }, undefined)).toBe(22.5);
    expect(stepWeight(20, -1, { weightStep: 2.5 }, undefined)).toBe(17.5);
    expect(stepWeight(0, -1, { weightStep: 2.5 }, undefined)).toBe(0);
    expect(stepWeight(0, -1, { weightStep: 2.5 }, undefined, { allowNegative: true })).toBe(-2.5);
    expect(stepFor({ weightStep: 5 }, undefined)).toBe(5);
    expect(stepFor({ weightStep: 5 }, eqStack)).toBe(5);
    expect(stepFor({ weightStep: 2 }, { weightStack: { minKg: 1, maxKg: 50, stepKg: 1 } })).toBe(1);
  });

  it('rechnet Dezimalstufen ohne Fließkommafehler', () => {
    const s = { minKg: 2.5, maxKg: 50, stepKg: 2.5 };
    let w: number | undefined = 2.5;
    for (let i = 0; i < 3; i++) w = stepWeight(w, 1, exFree, { weightStack: s });
    expect(w).toBe(10);
    expect(stepWeight(0.1 + 0.2, 1, { weightStep: 0.1 }, undefined)).toBe(0.4);
  });
});

function session(id: string, startedAt: number, endedAt: number | undefined, sets: SetEntry[], exerciseId = 'ex-a'): Session {
  return {
    id,
    createdAt: startedAt,
    updatedAt: startedAt,
    workoutName: 'Push',
    startedAt,
    endedAt,
    entries: [{ exerciseId, sets, restSec: 90, repMin: 8, repMax: 12 }],
  };
}

describe('Vorbelegung vom letzten Mal', () => {
  const done = (weight: number, reps: number, kind: SetEntry['kind'] = 'normal'): SetEntry => ({ kind, weight, reps, doneAt: 1 });

  it('findet das letzte abgeschlossene Training und ignoriert laufende und Aufwärmsätze', () => {
    const s = [
      session('1', 1000, 2000, [done(30, 10), done(30, 9)]),
      session('2', 3000, 4000, [done(20, 12, 'aufwaermen'), done(40, 10), done(40, 8)]),
      session('3', 5000, undefined, [done(99, 1)]), // läuft noch
    ];
    const last = lastPerformance(s, 'ex-a');
    expect(last?.session.id).toBe('2');
    expect(last?.sets.map((x) => x.weight)).toEqual([40, 40]);
    expect(lastPerformance(s, 'ex-a', '2')?.session.id).toBe('1');
    expect(lastPerformance(s, 'ex-b')).toBeUndefined();
  });

  it('belegt Sätze mit den Werten vom letzten Mal vor, weitere Sätze übernehmen den letzten Wert', () => {
    const last = { sets: [done(40, 10), done(40, 9), done(35, 8)] };
    const sets = prefillSets({ sets: 4, repMin: 8, repMax: 12 }, last, { tracking: 'gewicht_wdh', weightStep: 2.5 });
    expect(sets.map((s) => [s.weight, s.reps])).toEqual([[40, 10], [40, 9], [35, 8], [35, 8]]);
    expect(sets.every((s) => s.kind === 'normal' && s.doneAt === undefined)).toBe(true);
  });

  it('rastet vorbelegte Gewichte auf die Gewichtsstufen des Geräts ein', () => {
    const sets = prefillSets({ sets: 2, repMin: 8, repMax: 12 }, { sets: [done(42, 10)] }, { tracking: 'gewicht_wdh', weightStep: 5 }, eqStack);
    expect(sets[0].weight).toBe(40);
  });

  it('nimmt ohne Historie das Zielgewicht, sonst den Anfang der Stufen, und die untere Wiederholungsgrenze', () => {
    const a = prefillSets({ sets: 3, repMin: 8, repMax: 12, targetWeight: 50 }, undefined, { tracking: 'gewicht_wdh', weightStep: 2.5 });
    expect(a.map((s) => [s.weight, s.reps])).toEqual([[50, 8], [50, 8], [50, 8]]);
    const b = prefillSets({ sets: 1, repMin: 10, repMax: 12 }, undefined, { tracking: 'gewicht_wdh', weightStep: 5 }, eqStack);
    expect(b[0]).toMatchObject({ weight: 5, reps: 10 });
    const c = prefillSets({ sets: 1, repMin: 10, repMax: 12 }, undefined, { tracking: 'gewicht_wdh', weightStep: 2.5 });
    expect(c[0].weight).toBeUndefined();
  });

  it('belegt Cardio und Zeitübungen mit Dauer vor', () => {
    const c = prefillSets({ sets: 1, repMin: 1, repMax: 1 }, { sets: [{ kind: 'normal', durationSec: 1500, distanceKm: 4, doneAt: 1 }] }, { tracking: 'cardio', weightStep: 0 });
    expect(c[0]).toMatchObject({ durationSec: 1500, distanceKm: 4 });
    const z = prefillSets({ sets: 2, repMin: 1, repMax: 1 }, undefined, { tracking: 'zeit', weightStep: 0 });
    expect(z[0].durationSec).toBe(45);
  });

  it('erzeugt einen Trainingseintrag mit Planvorgaben und Werten vom letzten Mal', () => {
    const ex = { id: 'ex-a', tracking: 'gewicht_wdh', weightStep: 2.5 } as Exercise;
    const e = entryFromItem(
      { id: 'i', exerciseId: 'ex-a', sets: 2, repMin: 8, repMax: 12, restSec: 75 },
      ex,
      { weightStack: stack } as Equipment,
      [session('1', 1, 2, [done(55, 12)])],
    );
    expect(e.restSec).toBe(75);
    expect(e.sets.map((s) => s.weight)).toEqual([55, 55]);
  });

  it('formatiert die Zusammenfassung', () => {
    expect(summarizeSets([done(40, 10), done(40, 10), done(40, 10)])).toBe('3 × 10 · 40 kg');
    expect(summarizeSets([done(40, 10), done(35, 8)])).toBe('40 kg × 10 · 35 kg × 8');
    expect(summarizeSets([])).toBe('–');
    expect(summarizeSets([done(0, 12)])).toBe('1 × 12');
    expect(summarizeSets([done(20, 12), done(20, 12)], 'gewicht_wdh', true)).toBe('2 × 12 je Seite · 20 kg');
  });
});

describe('Vorbelegung nach Einheit und Stufenliste', () => {
  const done = (weight: number, reps: number): SetEntry => ({ kind: 'normal', weight, reps, doneAt: 1 });

  it('führt mehrere Einträge derselben Übung einer Einheit zusammen', () => {
    const s = session('1', 1000, 2000, [done(40, 10)]);
    s.entries.push({ exerciseId: 'ex-a', sets: [done(42, 8)], restSec: 90, repMin: 8, repMax: 12 });
    expect(lastPerformance([s], 'ex-a')?.sets.map((x) => x.weight)).toEqual([40, 42]);
  });

  it('nimmt Werte vom letzten Mal nur in derselben Einheit (kg/Platte) und nichts aus der anderen', () => {
    const kg = session('1', 1000, 2000, [done(40, 10)]);
    const platte = session('2', 3000, 4000, [done(12, 10)]);
    platte.entries[0].unit = 'platte';
    expect(lastPerformance([kg, platte], 'ex-a')?.session.id).toBe('1');
    expect(lastPerformance([kg, platte], 'ex-a', undefined, 'platte')?.session.id).toBe('2');
    expect(lastPerformance([kg], 'ex-a', undefined, 'platte')).toBeUndefined();
  });

  it('liest Stufenlisten mit Dezimalkomma', () => {
    expect(parseLevels('13,6; 22,7; 31,8')).toEqual({ levels: [13.6, 22.7, 31.8] });
    expect(parseLevels('13,6 22,7')).toEqual({ levels: [13.6, 22.7] });
    expect(parseLevels('9,14,18,23')).toEqual({ levels: [9, 14, 18, 23] });
    expect(parseLevels('9.5;\t14')).toEqual({ levels: [9.5, 14] });
    expect(parseLevels('9; abc')).toHaveProperty('error');
    expect(parseLevels('0x10 5')).toHaveProperty('error');
    expect(parseLevels('9')).toHaveProperty('error');
  });
});
