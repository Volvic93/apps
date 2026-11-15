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
