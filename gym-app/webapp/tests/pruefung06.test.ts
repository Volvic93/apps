import { describe, expect, it } from 'vitest';
import { fileSlug, trainingCsv } from '../src/logic/csv';
import { platesPerSide } from '../src/logic/plates';
import type { Equipment, Exercise, Session } from '../src/data/types';

describe('Prüfung 0.6.0', () => {
  it('Scheibenrechner begrenzt unsinnige Eingaben', () => {
    expect(() => platesPerSide(1e9, 0)).not.toThrow();
    expect(platesPerSide(1e9, 0).totalKg).toBeLessThanOrEqual(2000);
    expect(platesPerSide(Number.NaN, 0).perSide).toEqual([]);
    expect(platesPerSide(100, 0, 1000).perSide.length).toBeGreaterThan(0);
    expect(platesPerSide(100, 0, 2, [Number.POSITIVE_INFINITY, 25]).perSide).toEqual([25, 25]);
  });

  it('Dateinamen ohne Umlaute und Sonderzeichen', () => {
    expect(fileSlug('Oberkörper schwer – Push')).toBe('oberkorper-schwer-push');
    expect(fileSlug('Straße')).toBe('strasse');
    expect(fileSlug('???')).toBe('training');
  });

  it('CSV: Formeln werden entschärft, Aufwärmsätze zählen nicht als Satz, Notizen stehen drin', () => {
    const exercises = [{ id: 'x', name: '=SUMME(A1)', equipmentId: 'g' }] as unknown as Exercise[];
    const equipment = [{ id: 'g', name: '+Gerät' }] as unknown as Equipment[];
    const s = {
      id: 'a',
      startedAt: 1_000_000,
      endedAt: 2_000_000,
      workoutName: '@Tag',
      note: 'Einheit gut',
      entries: [
        {
          exerciseId: 'x',
          note: 'Schulter zwickt',
          sets: [
            { kind: 'aufwaermen', weight: 20, reps: 10, doneAt: 1 },
            { kind: 'normal', weight: 40, reps: 8, doneAt: 2 },
            { kind: 'normal', weight: -5, reps: 8, doneAt: 3 },
          ],
        },
      ],
    } as unknown as Session;
    const lines = trainingCsv([s], exercises, equipment).replace('﻿', '').trim().split('\r\n');
    const cols = lines.slice(1).map((l) => l.split(';'));
    expect(cols[0][1]).toBe("'@Tag");
    expect(cols[0][2]).toBe("'=SUMME(A1)");
    expect(cols[0][3]).toBe("'+Gerät");
    expect(cols[0][4]).toBe(''); // Aufwärmsatz ohne Satznummer
    expect(cols[1][4]).toBe('1');
    expect(cols[2][4]).toBe('2');
    expect(cols[2][6]).toBe('-5'); // Zahlen bleiben Zahlen
    expect(cols[0][10]).toContain('Schulter zwickt');
    expect(cols[0][10]).toContain('Einheit gut');
    expect(cols[1][10]).toBe('');
  });
});
