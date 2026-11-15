import { describe, expect, it } from 'vitest';
import { carryUserFields, validateBackup } from '../src/logic/backup';
import { offeredExercises } from '../src/logic/planio';
import { computeHints } from '../src/logic/hints';
import { suggestNext } from '../src/logic/progress';
import { isPersonalRecord, sessionRecords } from '../src/logic/stats';
import type { Entry, Equipment, Exercise, Session, SetEntry } from '../src/data/types';

const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 14, 12);

const sets = (weight: number, reps: number, n = 3): SetEntry[] =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, weight, reps, doneAt: NOW, kind: 'arbeit' }) as unknown as SetEntry);

function session(id: string, daysAgo: number, entries: Partial<Entry>[]): Session {
  return {
    id,
    startedAt: NOW - daysAgo * DAY,
    endedAt: NOW - daysAgo * DAY + 3600000,
    workoutName: 'A',
    entries: entries.map((e, i) => ({ id: `${id}-e${i}`, repMin: 8, repMax: 12, skipped: false, ...e })),
  } as unknown as Session;
}

describe('Runde 2: Rekorde bei Plattennummern', () => {
  const history = [session('h1', 7, [{ exerciseId: 'x', unit: 'platte', sets: sets(6, 15) }])];

  it('höhere Plattennummer ist ein Rekord, auch mit weniger Wiederholungen', () => {
    const set = sets(7, 6, 1)[0];
    expect(isPersonalRecord(set, 'x', history, [], 'cur', 'platte')).toBe(true);
  });

  it('niedrigere Plattennummer mit mehr Wiederholungen ist kein Rekord', () => {
    const hist = [session('h1', 7, [{ exerciseId: 'x', unit: 'platte', sets: sets(7, 6) }])];
    const set = sets(6, 15, 1)[0];
    expect(isPersonalRecord(set, 'x', hist, [], 'cur', 'platte')).toBe(false);
  });

  it('sessionRecords stimmt mit der Plattenlogik überein', () => {
    const cur = session('cur', 0, [{ exerciseId: 'x', unit: 'platte', sets: sets(7, 6) }]);
    expect(sessionRecords(cur, history)).toEqual([{ exerciseId: 'x', weight: 7, reps: 6, unit: 'platte' }]);
  });
});

describe('Runde 2: Zusammenführen übernimmt geänderte Werte', () => {
  it('übernimmt inStudio und Name samt Wert, wenn sie in der Sicherung als geändert markiert sind', () => {
    const local = { id: 'eq1', builtin: true, name: 'Beinpresse', inStudio: false, adjustments: [] };
    const incoming = { id: 'eq1', builtin: true, name: 'Meine Beinpresse', inStudio: true, adjustments: [], edited: ['inStudio', 'name'] };
    const merged = carryUserFields(local as never, incoming as never) as unknown as typeof incoming;
    expect(merged.inStudio).toBe(true);
    expect(merged.name).toBe('Meine Beinpresse');
    expect(merged.edited).toEqual(['inStudio', 'name']);
  });

  it('überschreibt lokal bereits geänderte Felder nicht', () => {
    const local = { id: 'eq1', builtin: true, name: 'Lokal', inStudio: true, edited: ['name'] };
    const incoming = { id: 'eq1', builtin: true, name: 'Backup', inStudio: false, edited: ['name'] };
    expect(carryUserFields(local as never, incoming as never)).toBeUndefined();
  });
});

describe('Runde 2: Sicherung mit abgeschnittenem Foto', () => {
  it('lehnt Base64 mit unmöglicher Länge ab', () => {
    const r = validateBackup({
      app: 'eisenzeit',
      schemaVersion: 1,
      exportedAt: NOW,
      data: { settings: [], equipment: [], exercises: [], plans: [], sessions: [], bodyMetrics: [] },
      photos: [{ id: 'p', mime: 'image/jpeg', base64: 'QUJDR' }],
    });
    expect(r.ok).toBe(false);
  });
});

describe('Runde 2: Studio-Filter bei KI-Export', () => {
  it('bietet abgewählte eigene Geräte nicht an, Körpergewicht und freie Übungen schon', () => {
    const mk = (id: string, equipmentId?: string): Exercise => ({ id, name: id, equipmentId }) as unknown as Exercise;
    const eqs = new Map<string, Equipment>([
      ['own', { id: 'own', kind: 'maschine', inStudio: false, builtin: false, hidden: false } as unknown as Equipment],
      ['bw', { id: 'bw', kind: 'koerpergewicht', inStudio: false, builtin: true, hidden: false } as unknown as Equipment],
    ]);
    const out = offeredExercises([mk('a', 'own'), mk('b', 'bw'), mk('c')], eqs, false).map((e) => e.id);
    expect(out).toEqual(['b', 'c']);
  });
});

describe('Runde 2: Wortlaut im Training', () => {
  const ex = { id: 'x', tracking: 'gewicht_wdh', weightStep: 2.5 } as unknown as Exercise;
  const hist = [session('h1', 3, [{ exerciseId: 'x', sets: sets(40, 12), repMin: 8, repMax: 12 }])];

  it('sagt „nächstes Mal“ im Verlauf und „heute“ im Training', () => {
    expect(suggestNext(hist, ex, undefined)?.text).toContain('nächstes Mal');
    expect(suggestNext(hist, ex, undefined, undefined, 'heute')?.text).toContain('heute');
  });

  it('Stagnationskarte nennt bei Plattennummern keine Maximalkraft', () => {
    const exercises = new Map([['x', { id: 'x', name: 'Presse', tracking: 'gewicht_wdh' } as unknown as Exercise]]);
    const sessions = [21, 14, 7, 1].map((d, i) => session(`s${i}`, d, [{ exerciseId: 'x', unit: 'platte', sets: sets(6, 10) }]));
    const hints = computeHints({ sessions, exercises, plans: [], now: NOW, settings: { backupReminder: false, lastBackupAt: undefined, studioSetupDone: true } });
    const stall = hints.find((h) => h.key.startsWith('stall:'));
    expect(stall).toBeDefined();
    expect(stall!.why).toContain('Plattennummer');
    expect(stall!.why).not.toContain('Maximalkraft');
  });
});
