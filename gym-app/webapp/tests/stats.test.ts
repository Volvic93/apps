import { describe, expect, it } from 'vitest';
import type { Session, SetEntry } from '../src/data/types';
import { epley1RM, isPersonalRecord, planWeek, previousSameWorkout, sessionRecords, sessionVolume, suggestNextWorkout } from '../src/logic/stats';

const done = (weight: number, reps: number, kind: SetEntry['kind'] = 'normal'): SetEntry => ({ kind, weight, reps, doneAt: 1 });
function session(id: string, t: number, sets: SetEntry[], extra: Partial<Session> = {}): Session {
  return { id, createdAt: t, updatedAt: t, workoutName: 'Push', startedAt: t, endedAt: t + 1, entries: [{ exerciseId: 'ex', sets, restSec: 90, repMin: 8, repMax: 12 }], ...extra };
}

describe('Statistik', () => {
  it('rechnet die geschätzte Maximalkraft nach Epley', () => {
    expect(epley1RM(100, 1)).toBe(100);
    expect(epley1RM(60, 10)).toBeCloseTo(80);
    expect(epley1RM(0, 10)).toBe(0);
  });

  it('zählt Aufwärmsätze und nicht abgehakte Sätze nicht zum Volumen', () => {
    const s = session('a', 1, [done(20, 10, 'aufwaermen'), done(40, 10), { kind: 'normal', weight: 40, reps: 10 }, done(30, 10, 'reduktion')]);
    expect(sessionVolume(s)).toBe(40 * 10 + 30 * 10);
  });

  it('erkennt Rekorde, ignoriert Aufwärmsätze und die allererste Einheit', () => {
    const history = [session('h', 1, [done(40, 10)])];
    expect(isPersonalRecord(done(40, 10), 'ex', history, [])).toBe(false);
    expect(isPersonalRecord(done(42.5, 10), 'ex', history, [])).toBe(true);
    expect(isPersonalRecord(done(40, 11), 'ex', history, [])).toBe(true);
    expect(isPersonalRecord(done(80, 10, 'aufwaermen'), 'ex', history, [])).toBe(false);
    expect(isPersonalRecord(done(100, 10), 'ex', [], [])).toBe(false);
    // zwei Rekordsätze in einer Einheit: der zweite muss den ersten schlagen
    expect(isPersonalRecord(done(42.5, 10), 'ex', history, [done(45, 10)])).toBe(false);
  });

  it('listet Rekorde einer Einheit', () => {
    const history = [session('h', 1, [done(40, 10)])];
    const now = session('n', 2, [done(40, 10), done(45, 8)]);
    expect(sessionRecords(now, [...history, now])).toEqual([{ exerciseId: 'ex', weight: 45, reps: 8, unit: 'kg' }]);
  });

  it('vergleicht Rekorde nur innerhalb derselben Einheit (kg oder Plattennummer)', () => {
    const platte = (id: string, t: number, w: number): Session => session(id, t, [done(w, 10)], { entries: [{ exerciseId: 'ex', unit: 'platte', sets: [done(w, 10)], restSec: 90, repMin: 8, repMax: 12 }] });
    const kgHistory = [session('h', 1, [done(60, 10)])];
    // Plattennummer 20 ist kein Rekord gegenüber 60 kg – und umgekehrt zählt Platte 20 nicht als Vergleichswert für kg
    expect(isPersonalRecord(done(20, 10), 'ex', kgHistory, [], undefined, 'platte')).toBe(false);
    const plHistory = [platte('p', 1, 10)];
    expect(isPersonalRecord(done(12, 10), 'ex', plHistory, [], undefined, 'platte')).toBe(true);
    expect(isPersonalRecord(done(12, 10), 'ex', plHistory, [], undefined, 'kg')).toBe(false);
    const now = platte('n', 2, 14);
    expect(sessionRecords(now, [...plHistory, now])).toEqual([{ exerciseId: 'ex', weight: 14, reps: 10, unit: 'platte' }]);
  });

  it('findet die vorherige gleiche Einheit', () => {
    const a = session('a', 10, [], { planId: 'p' });
    const b = session('b', 20, [], { planId: 'p' });
    const c = session('c', 30, [], { planId: 'p', workoutName: 'Pull' });
    expect(previousSameWorkout(b, [a, b, c])?.id).toBe('a');
    expect(previousSameWorkout(a, [a, b, c])).toBeUndefined();
  });

  it('schlägt die am längsten zurückliegende Einheit vor, nie gemachte zuerst', () => {
    const w = [{ id: 'w1', name: 'Push' }, { id: 'w2', name: 'Pull' }, { id: 'w3', name: 'Beine' }];
    const s = [
      session('1', 100, [], { planId: 'p', workoutId: 'w1' }),
      session('2', 200, [], { planId: 'p', workoutId: 'w2' }),
    ];
    expect(suggestNextWorkout(w, s, 'p')).toBe('w3');
    s.push(session('3', 300, [], { planId: 'p', workoutId: 'w3' }));
    expect(suggestNextWorkout(w, s, 'p')).toBe('w1');
    expect(suggestNextWorkout([], s, 'p')).toBeUndefined();
  });

  it('zählt die Planwoche', () => {
    const start = Date.UTC(2026, 0, 1);
    const day = 24 * 3600 * 1000;
    expect(planWeek(start, start + 2 * day)).toBe(1);
    expect(planWeek(start, start + 8 * day)).toBe(2);
    expect(planWeek(undefined)).toBe(1);
  });
});

describe('Rekorde bei getauschter Übung', () => {
  it('liefert je Übung und Einheit höchstens einen Rekord', () => {
    const history = [session('h', 1, [done(40, 10)])];
    const now = session('n', 2, [done(45, 10)]);
    now.entries.push({ exerciseId: 'ex', sets: [done(50, 10)], restSec: 90, repMin: 8, repMax: 12 });
    const recs = sessionRecords(now, [...history, now]);
    expect(recs.length).toBe(1);
    expect(recs[0].weight).toBe(50);
  });
});
