import { describe, expect, it } from 'vitest';
import { csvFileName, trainingCsv } from '../src/logic/csv';
import { formatPlates, platesPerSide } from '../src/logic/plates';
import { suggestNext } from '../src/logic/progress';
import { warmupSets } from '../src/logic/warmup';
import type { Equipment, Exercise, Session } from '../src/data/types';

describe('Scheibenrechner', () => {
  it('rechnet Gesamtgewicht in Scheiben je Seite um', () => {
    const r = platesPerSide(90, 20); // (90 − 20) / 2 = 35 je Seite
    expect(r.perSide).toEqual([25, 10]);
    expect(r.exact).toBe(true);
    expect(formatPlates(r.perSide)).toBe('25 + 10');
    const r2 = platesPerSide(100, 0);
    expect(r2.perSide).toEqual([25, 25]);
    expect(formatPlates(r2.perSide)).toBe('2 × 25');
    expect(formatPlates(platesPerSide(47.5, 0).perSide)).toBe('20 + 2,5 + 1,25');
  });

  it('rundet nicht darstellbare Gewichte auf das nächste mögliche', () => {
    const r = platesPerSide(61, 20, 2, [2.5, 5, 10]); // 20,5 je Seite, kleinste Scheibe 2,5
    expect(r.exact).toBe(false);
    expect(r.perSideKg % 2.5).toBe(0);
    expect(Math.abs(r.totalKg - 61)).toBeLessThanOrEqual(5);
    expect(r.totalKg).toBe(20 + 2 * r.perSideKg);
  });

  it('berücksichtigt nur vorhandene Scheiben und die Zahl der Aufnahmen', () => {
    expect(platesPerSide(40, 0, 2, [10, 20]).perSide).toEqual([20]);
    expect(platesPerSide(30, 0, 1, [10, 20]).perSide).toEqual([20, 10]); // eine Aufnahme
    expect(platesPerSide(0, 0).perSide).toEqual([]);
    expect(platesPerSide(10, 20).perSideKg).toBe(0); // leichter als das Eigengewicht
  });
});

describe('Aufwärmsätze', () => {
  const ex = { weightStep: 2.5 } as Pick<Exercise, 'weightStep'>;
  it('schlägt 50 % × 10 und 70 % × 5 vor, bei Kraft zusätzlich 85 % × 2', () => {
    const w = warmupSets(100, 'muskelaufbau', ex);
    expect(w).toEqual([{ weight: 50, reps: 10 }, { weight: 70, reps: 5 }]);
    const k = warmupSets(100, 'kraft', ex);
    expect(k).toEqual([{ weight: 50, reps: 10 }, { weight: 70, reps: 5 }, { weight: 85, reps: 2 }]);
  });

  it('rundet auf die Stufen des Geräts und lässt doppelte oder zu schwere Sätze weg', () => {
    const eq = { weightStack: { minKg: 10, maxKg: 100, stepKg: 10 } } as Pick<Equipment, 'weightStack'>;
    const w = warmupSets(60, 'muskelaufbau', ex, eq);
    expect(w.every((s) => s.weight % 10 === 0 && s.weight < 60)).toBe(true);
    expect(warmupSets(20, 'kraft', ex, eq).length).toBeLessThanOrEqual(1); // 10 kg-Stufen: kaum Spielraum
  });

  it('gibt bei Plattennummern und ohne Zielgewicht nichts zurück', () => {
    expect(warmupSets(8, 'kraft', ex, { weightStack: { minKg: 1, maxKg: 20, stepKg: 1, unit: 'platte' } })).toEqual([]);
    expect(warmupSets(0, 'kraft', ex)).toEqual([]);
  });
});

const DAY = 86400000;
const set = (weight: number, reps: number, rir?: number) => ({ kind: 'normal', weight, reps, doneAt: 1, ...(rir === undefined ? {} : { rir }) });
const sess = (id: string, daysAgo: number, sets: unknown[]): Session =>
  ({ id, startedAt: 1_000_000_000_000 - daysAgo * DAY, endedAt: 1_000_000_000_000 - daysAgo * DAY + 3600000, workoutName: 'A', entries: [{ id: id + 'e', exerciseId: 'x', repMin: 8, repMax: 12, skipped: false, sets }] }) as unknown as Session;
const exx = { id: 'x', tracking: 'gewicht_wdh', weightStep: 2.5 } as never;
const NOW = 1_000_000_000_000;

describe('Steigerung mit Anstrengung', () => {
  it('steigert mit Hinweis auf die Reserve, wenn die obere Grenze mit Luft erreicht wurde', () => {
    const r = suggestNext([sess('a', 3, [set(40, 12, 3), set(40, 12, 2), set(40, 12, 2)])], exx, undefined, undefined, undefined, NOW)!;
    expect(r.kind).toBe('erhoehen');
    expect(r.text).toContain('Reserve');
  });

  it('steigert auch im Bereich, wenn noch 3 oder mehr möglich waren', () => {
    const r = suggestNext([sess('a', 3, [set(40, 9, 3), set(40, 9, 3), set(40, 9, 3)])], exx, undefined, undefined, undefined, NOW)!;
    expect(r.kind).toBe('erhoehen');
    expect(r.weight).toBe(42.5);
  });

  it('hält, wenn keine Reserve übrig war', () => {
    const r = suggestNext([sess('a', 3, [set(40, 9, 0), set(40, 8, 0), set(40, 8, 0)])], exx, undefined, undefined, undefined, NOW)!;
    expect(r.kind).toBe('halten');
    expect(r.text).toContain('keine Reserve');
  });

  it('ohne notierte Anstrengung bleibt die bisherige Regel', () => {
    const r = suggestNext([sess('a', 3, [set(40, 9), set(40, 9), set(40, 9)])], exx, undefined, undefined, undefined, NOW)!;
    expect(r.kind).toBe('halten');
    expect(r.text).toContain('eine Wiederholung mehr');
  });
});

describe('CSV-Export', () => {
  it('Semikolon, Dezimalkomma, BOM, nur abgehakte Sätze abgeschlossener Einheiten', () => {
    const exercises = [{ id: 'x', name: 'Brust; "Presse"', equipmentId: 'g' }] as unknown as Exercise[];
    const equipment = [{ id: 'g', name: 'Gerät' }] as unknown as Equipment[];
    const s = sess('a', 1, [set(42.5, 10, 1), { kind: 'normal', weight: 40, reps: 8 }, { kind: 'aufwaermen', weight: 20, reps: 12, doneAt: 1 }]);
    const open = { ...sess('b', 0, [set(50, 5)]), endedAt: undefined } as Session;
    const csv = trainingCsv([s, open], exercises, equipment);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(lines[0].split(';')).toHaveLength(11);
    expect(lines).toHaveLength(3); // Kopf + 1 Arbeitssatz + 1 Aufwärmsatz (der nicht abgehakte und die offene Einheit fehlen)
    expect(lines[1]).toContain('42,5');
    expect(lines[1]).toContain('"Brust; ""Presse"""');
    expect(lines[1]).toContain(';1;'.replace(';1;', ';1')); // Anstrengung 1
    expect(csvFileName(new Date(2026, 10, 16))).toBe('eisenzeit-training-2026-11-16.csv');
  });
});

describe('Live-Aktivität: Zustand aus der Einheit', () => {
  it('zählt Sätze und Fortschritt und nimmt den nächsten offenen Satz als Ziel', async () => {
    const { liveActivityState } = await import('../src/ui/LiveActivitySync');
    const s = {
      id: 's', workoutName: 'Push', startedAt: 1000, currentIndex: 0, restEndsAt: Date.now() + 60000,
      entries: [
        { exerciseId: 'a', repMin: 8, repMax: 12, restSec: 90, sets: [{ kind: 'aufwaermen', weight: 20, reps: 10, doneAt: 1 }, { kind: 'normal', weight: 40, reps: 10, doneAt: 2 }, { kind: 'normal', weight: 42.5, reps: 8 }, { kind: 'normal', weight: 42.5, reps: 8 }] },
        { exerciseId: 'b', repMin: 8, repMax: 12, restSec: 60, sets: [{ kind: 'normal', weight: 30, reps: 12 }] },
      ],
    } as unknown as Session;
    const st = liveActivityState(s, (id) => (id === 'a' ? 'Brustpresse' : 'Butterfly'));
    expect(st.exercise).toBe('Brustpresse');
    expect(st.setTotal).toBe(3);
    expect(st.setIndex).toBe(2);
    expect(st.target).toBe('42,5 kg × 8');
    expect(st.progress).toBeCloseTo(2 / 5);
    expect(st.restEndsAt).toBeGreaterThan(Date.now());
    const platte = liveActivityState({ ...s, restEndsAt: undefined, entries: [{ ...s.entries[0], unit: 'platte' }] } as unknown as Session, () => 'X');
    expect(platte.target).toContain('Platte');
    expect(platte.restEndsAt).toBeUndefined();
  });
});
