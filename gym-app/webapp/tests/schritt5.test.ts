import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '../src/data/db';
import { activatePlan, createDeloadPlan, duplicatePlan } from '../src/data/repo';
import { seedCatalog } from '../src/data/seed';
import { computeHints, visibleHints } from '../src/logic/hints';
import type { Exercise, Plan } from '../src/data/types';

beforeAll(async () => {
  await seedCatalog();
});

const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 15, 12);
const settings = { backupReminder: false, lastBackupAt: undefined, studioSetupDone: true };

const plan = (over: Partial<Plan>): Plan =>
  ({ id: 'p', createdAt: NOW, updatedAt: NOW, name: 'Plan', goal: '', plannedWeeks: 8, status: 'entwurf', origin: 'manuell', workouts: [], ...over }) as Plan;

describe('Entlastung: Rückweg zum ursprünglichen Plan', () => {
  it('merkt sich den Ursprungsplan, die Kopie davon nicht', async () => {
    const ex = (await db.exercises.toArray()).find((e) => e.builtin) as Exercise;
    const src = plan({
      id: 'src-plan',
      name: 'Hauptplan',
      status: 'aktiv',
      startedAt: NOW - 20 * DAY,
      workouts: [{ id: 'w', name: 'A', items: [{ id: 'i1', exerciseId: ex.id, sets: 3, repMin: 8, repMax: 12, restSec: 90 }] }] as never,
    });
    await db.plans.put(src);
    const deload = await createDeloadPlan('src-plan');
    expect(deload?.returnToPlanId).toBe('src-plan');
    const copy = await duplicatePlan(deload!.id);
    expect(copy?.returnToPlanId).toBeUndefined();
    await activatePlan(deload!.id);
    const after = await db.plans.get('src-plan');
    expect(after?.status).toBe('entwurf');
  });

  it('zeigt nach der Entlastungswoche „zurückkehren“ statt „neuen Plan“', () => {
    const main = plan({ id: 'main', name: 'Hauptplan' });
    const deload = plan({ id: 'dl', name: 'Entlastung – Hauptplan', status: 'aktiv', plannedWeeks: 1, startedAt: NOW - 8 * DAY, returnToPlanId: 'main' });
    const hints = computeHints({ now: NOW, settings, plans: [main, deload], sessions: [], exercises: new Map() });
    expect(hints.some((h) => h.key === 'plan_end:dl')).toBe(false);
    const back = hints.find((h) => h.key === 'deload_back:dl')!;
    expect(back.action).toMatchObject({ kind: 'activate', planId: 'main' });
    expect(visibleHints(hints, []).some((h) => h.key === 'deload_back:dl')).toBe(true);
  });

  it('zeigt vor Ablauf der Woche noch nichts davon und ohne Ursprungsplan den normalen Hinweis', () => {
    const deload = plan({ id: 'dl', status: 'aktiv', plannedWeeks: 1, startedAt: NOW - 2 * DAY, returnToPlanId: 'main' });
    const early = computeHints({ now: NOW, settings, plans: [plan({ id: 'main' }), deload], sessions: [], exercises: new Map() });
    expect(early.some((h) => h.key.startsWith('deload_back'))).toBe(false);
    const gone = plan({ id: 'dl', status: 'aktiv', plannedWeeks: 1, startedAt: NOW - 8 * DAY, returnToPlanId: 'weg' });
    const late = computeHints({ now: NOW, settings, plans: [gone], sessions: [], exercises: new Map() });
    expect(late.some((h) => h.key === 'plan_end:dl')).toBe(true);
  });
});

describe('Bewegungsbild mit mehreren Positionen', () => {
  it('nimmt nur belegte Positionen, höchstens sechs', async () => {
    const { motionFrames, MAX_MOTION_FRAMES } = await import('../src/ui/MotionImage');
    expect(motionFrames(undefined)).toEqual([]);
    expect(motionFrames(['a', '', 'b'])).toEqual(['a', 'b']);
    expect(motionFrames(['1', '2', '3', '4', '5', '6', '7'])).toHaveLength(MAX_MOTION_FRAMES);
  });
});

describe('Abschlussrunde: Entlastungseinheiten und Pausenvorschlag', () => {
  const sess = (id: string, daysAgo: number, weight: number, deload = false) =>
    ({
      id,
      startedAt: NOW - daysAgo * DAY,
      endedAt: NOW - daysAgo * DAY + 3600000,
      workoutName: 'A',
      deload,
      entries: [{ id: `${id}e`, exerciseId: 'x', repMin: 8, repMax: 12, skipped: false, sets: [1, 2, 3].map((n) => ({ id: `${id}${n}`, weight, reps: 10, doneAt: NOW, kind: 'normal' })) }],
    }) as never;

  it('lastPerformance und Vorschlag ignorieren Entlastungseinheiten', async () => {
    const { lastPerformance } = await import('../src/logic/progression');
    const { suggestNext } = await import('../src/logic/progress');
    const list = [sess('a', 10, 40), sess('d', 2, 25, true)];
    expect(lastPerformance(list, 'x')?.sets[0].weight).toBe(40);
    const r = suggestNext(list, { id: 'x', tracking: 'gewicht_wdh', weightStep: 2.5 } as never, undefined, undefined, undefined, NOW)!;
    expect(r.lastWeight).toBe(40);
  });

  it('bietet im Entlastungsplan keine zweite Entlastung und kein „läuft bald aus“ an', () => {
    const ex = new Map(['a', 'b', 'c'].map((id) => [id, { id, name: id, tracking: 'gewicht_wdh', primaryMuscles: ['brust'], secondaryMuscles: [] } as unknown as Exercise]));
    const sessions = ['a', 'b', 'c'].flatMap((id) => [30, 24, 18, 12, 6].map((d, i) => ({ ...(sess(`${id}${i}`, d, 40) as object), entries: [{ ...(sess('q', 1, 40) as { entries: object[] }).entries[0], exerciseId: id }] }))) as never;
    const deload = plan({ id: 'dl', status: 'aktiv', plannedWeeks: 1, startedAt: NOW - 1 * DAY, returnToPlanId: 'main', workouts: [{ id: 'w', name: 'A', items: ['a', 'b', 'c'].map((e, i) => ({ id: `i${i}`, exerciseId: e, sets: 2, repMin: 8, repMax: 12, restSec: 90 })) }] as never });
    const hints = computeHints({ now: NOW, settings, plans: [plan({ id: 'main' }), deload], sessions, exercises: ex });
    expect(hints.some((h) => h.key.startsWith('deload:'))).toBe(false);
    expect(hints.some((h) => h.key.startsWith('plan_soon'))).toBe(false);
  });

  it('Pausengrenze zählt in Millisekunden, grobe Stufen werden ehrlich benannt, nie 0 kg', async () => {
    const { suggestNext } = await import('../src/logic/progress');
    const ex = { id: 'x', tracking: 'gewicht_wdh', weightStep: 2.5 } as never;
    expect(suggestNext([sess('a', 14, 40)], ex, undefined, undefined, undefined, NOW)!.kind).not.toBe('senken');
    const long = suggestNext([sess('a', 14.5, 40)], ex, undefined, undefined, undefined, NOW)!;
    expect(long.kind).toBe('senken');
    expect(long.text).toContain('etwa 10 % weniger');
    const coarse = suggestNext([sess('a', 20, 5)], ex, undefined, undefined, undefined, NOW)!;
    expect(coarse.text).toContain('eine Stufe leichter');
    const tiny = suggestNext([sess('a', 20, 2.5)], ex, undefined, undefined, undefined, NOW)!;
    expect(tiny.weight ?? 1).toBeGreaterThan(0);
  });
});

describe('Abschlussrunde: Vorbelegung bei Entlastung und leichtem Wiedereinstieg', () => {
  const item = { sets: 3, repMin: 8, repMax: 12, targetWeight: 24 } as never;
  const ex = { tracking: 'gewicht_wdh', weightStep: 2.5 } as never;
  const last = { sets: [{ kind: 'normal', weight: 40, reps: 10, doneAt: 1 }] } as never;

  it('Entlastung nimmt das Zielgewicht des Plans statt des letzten Mals', async () => {
    const { prefillSets } = await import('../src/logic/progression');
    expect(prefillSets(item, last, ex, undefined, { preferTarget: true }).map((s) => s.weight)).toEqual([24, 24, 24]);
    expect(prefillSets(item, last, ex).map((s) => s.weight)).toEqual([40, 40, 40]);
  });

  it('leichter Wiedereinstieg: etwa 70 % und ein Satz weniger', async () => {
    const { prefillSets } = await import('../src/logic/progression');
    const sets = prefillSets(item, last, ex, { weightStack: { minKg: 5, maxKg: 100, stepKg: 5 } } as never, { easier: true });
    expect(sets).toHaveLength(2);
    expect(sets[0].weight).toBe(30);
  });
});
