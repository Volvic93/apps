import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '../src/data/db';
import {
  activatePlan,
  copyWorkout,
  createEntryForExercise,
  createPlan,
  duplicatePlan,
  finishSession,
  getActiveSession,
  moveInList,
  newPlanItem,
  newWorkout,
  saveEquipment,
  savePlan,
  startSession,
  startFreeSession,
  substituteEntries,
} from '../src/data/repo';
import { seedCatalog } from '../src/data/seed';
import { alternativesFor, fold, matchesQuery } from '../src/logic/catalog';

beforeAll(async () => {
  await seedCatalog();
});

async function planWith(name: string, exerciseIds: string[]) {
  const plan = await createPlan({ name, goal: 'Muskelaufbau', plannedWeeks: 8 });
  const w = newWorkout('Push');
  for (const id of exerciseIds) {
    const ex = (await db.exercises.get(id))!;
    w.items.push({ ...newPlanItem(ex, 90), sets: 2 });
  }
  await savePlan({ ...plan, workouts: [w] });
  return (await db.plans.get(plan.id))!;
}

describe('Pläne', () => {
  it('dupliziert Pläne mit neuen Kennungen und als Entwurf', async () => {
    const p = await planWith('Original', ['ex-bankdruecken-langhantel', 'ex-brustpresse-maschine']);
    await activatePlan(p.id);
    const c = (await duplicatePlan(p.id))!;
    expect(c.name).toBe('Original (Kopie)');
    expect(c.status).toBe('entwurf');
    expect(c.workouts[0].id).not.toBe(p.workouts[0].id);
    expect(c.workouts[0].items[0].id).not.toBe(p.workouts[0].items[0].id);
    expect(c.workouts[0].items.map((i) => i.exerciseId)).toEqual(p.workouts[0].items.map((i) => i.exerciseId));
  });

  it('hat immer höchstens einen aktiven Plan', async () => {
    const a = await planWith('A', ['ex-plank']);
    const b = await planWith('B', ['ex-plank']);
    await activatePlan(a.id);
    await activatePlan(b.id);
    const plans = await db.plans.toArray();
    expect(plans.filter((p) => p.status === 'aktiv').map((p) => p.name)).toEqual(['B']);
    expect((await db.plans.get(a.id))!.status).toBe('entwurf');
    expect((await db.plans.get(b.id))!.startedAt).toBeGreaterThan(0);
  });

  it('kopiert Einheiten zwischen Plänen und innerhalb eines Plans', async () => {
    const a = await planWith('Quelle', ['ex-bankdruecken-langhantel']);
    const b = await planWith('Ziel', ['ex-plank']);
    await copyWorkout(a.id, a.workouts[0].id, b.id);
    const b2 = (await db.plans.get(b.id))!;
    expect(b2.workouts.length).toBe(2);
    expect(b2.workouts[1].items[0].exerciseId).toBe('ex-bankdruecken-langhantel');
    expect(b2.workouts[1].id).not.toBe(a.workouts[0].id);
    await copyWorkout(b.id, b2.workouts[0].id, b.id);
    expect((await db.plans.get(b.id))!.workouts[2].name).toBe('Push (Kopie)');
  });

  it('verschiebt Einträge in der Liste', () => {
    expect(moveInList([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveInList([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveInList([1, 2, 3], 2, -1)).toEqual([1, 3, 2]);
  });
});

describe('Training', () => {
  it('startet aus einer Einheit mit Vorbelegung, speichert sofort und erlaubt nur ein laufendes Training', async () => {
    const p = await planWith('Trainingsplan', ['ex-seitheben-maschine', 'ex-plank']);
    const s = (await startSession(p.id, p.workouts[0].id))!;
    expect(s.entries.length).toBe(2);
    // Gerät mit Gewichtsstufen 5–100: Start am Minimum
    expect(s.entries[0].sets[0].weight).toBe(5);
    expect(s.entries[1].sets[0].durationSec).toBe(45);
    expect((await getActiveSession())?.id).toBe(s.id);
    const again = (await startSession(p.id, p.workouts[0].id))!;
    expect(again.id).toBe(s.id);
    expect(await db.sessions.count()).toBe(1);

    // Satz abhaken, Sitzung beenden: nicht abgehakte Sätze fallen weg, leere Übungen ebenso
    const live = (await db.sessions.get(s.id))!;
    live.entries[0].sets[0] = { ...live.entries[0].sets[0], weight: 30, reps: 10, doneAt: Date.now() };
    await db.sessions.put(live);
    const done = (await finishSession(s.id))!;
    expect(done.endedAt).toBeGreaterThan(0);
    expect(done.entries.length).toBe(1);
    expect(done.entries[0].sets.length).toBe(1);
    expect(await getActiveSession()).toBeUndefined();

    // Nächstes Mal: Werte vom letzten Mal vorbelegt (30 kg, 10 Wdh.)
    const next = (await startSession(p.id, p.workouts[0].id))!;
    expect(next.entries[0].sets.map((x) => [x.weight, x.reps])).toEqual([[30, 10], [30, 10]]);
    await db.sessions.delete(next.id);
  });

  it('tauscht Übungen nur für heute und merkt sich das Original', async () => {
    const p = await planWith('Tausch', ['ex-brustpresse-maschine']);
    const s = (await startSession(p.id, p.workouts[0].id))!;
    const swapped = (await substituteEntries(s.entries[0], 'ex-pec-dec-fly', s.id))[0];
    expect(swapped.exerciseId).toBe('ex-pec-dec-fly');
    expect(swapped.substitutedFor).toBe('ex-brustpresse-maschine');
    expect(swapped.sets.length).toBe(2);
    // der Plan bleibt unverändert
    expect((await db.plans.get(p.id))!.workouts[0].items[0].exerciseId).toBe('ex-brustpresse-maschine');
    await db.sessions.delete(s.id);
  });

  it('behält beim Tausch bereits abgehakte Sätze und tauscht nur die offenen', async () => {
    const p = await planWith('Tausch2', ['ex-brustpresse-maschine']);
    const s = (await startSession(p.id, p.workouts[0].id))!;
    const entry = { ...s.entries[0], sets: [{ ...s.entries[0].sets[0], weight: 40, reps: 10, doneAt: Date.now() }, s.entries[0].sets[1]] };
    const parts = await substituteEntries(entry, 'ex-pec-dec-fly', s.id);
    expect(parts.length).toBe(2);
    expect(parts[0].exerciseId).toBe('ex-brustpresse-maschine');
    expect(parts[0].sets.length).toBe(1);
    expect(parts[0].sets[0].doneAt).toBeGreaterThan(0);
    expect(parts[1].exerciseId).toBe('ex-pec-dec-fly');
    expect(parts[1].substitutedFor).toBe('ex-brustpresse-maschine');
    expect(parts[1].sets.length).toBe(1);
    expect(parts[1].sets.every((x) => x.doneAt === undefined)).toBe(true);
    // Zurücktauschen auf die Ursprungsübung: kein "substitutedFor" mehr
    const back = await substituteEntries(parts[1], 'ex-brustpresse-maschine', s.id);
    expect(back[0].substitutedFor).toBeUndefined();
    await db.sessions.delete(s.id);
  });

  it('legt bei schnellem Doppelstart nur ein offenes Training an', async () => {
    const p = await planWith('Doppel', ['ex-plank']);
    await Promise.all([startSession(p.id, p.workouts[0].id), startSession(p.id, p.workouts[0].id), startFreeSession()]);
    const open = (await db.sessions.toArray()).filter((x) => x.endedAt === undefined);
    expect(open.length).toBe(1);
    await db.sessions.clear();
  });

  it('legt Einträge für frei hinzugefügte Übungen an', async () => {
    const e = (await createEntryForExercise('ex-laufband'))!;
    expect(e.sets.length).toBe(1);
    expect(e.sets[0].durationSec).toBe(20 * 60);
  });
});

describe('Geräte', () => {
  it('merkt sich Änderungen an mitgelieferten Geräten, damit Katalog-Updates sie nicht überschreiben', async () => {
    const hip = (await db.equipment.get('eq-newtech-seitheben-maschine'))!;
    await saveEquipment({ ...hip, name: 'Schulter-Maschine hinten' });
    const saved = (await db.equipment.get('eq-newtech-seitheben-maschine'))!;
    expect(saved.edited).toContain('name');
    expect(saved.edited).not.toContain('weightStack');
    await seedCatalog(db, true);
    expect((await db.equipment.get('eq-newtech-seitheben-maschine'))!.name).toBe('Schulter-Maschine hinten');
    // eigener Einstellwert (kein struktureller Eingriff) markiert die Skala nicht als geändert
    await saveEquipment({ ...saved, adjustments: saved.adjustments.map((a) => ({ ...a, myValue: 9 })) });
    expect((await db.equipment.get('eq-newtech-seitheben-maschine'))!.edited).not.toContain('adjustments');
  });
});

describe('Suche und Alternativen', () => {
  it('sucht ohne Rücksicht auf Umlaute und Groß-/Kleinschreibung', () => {
    expect(fold('Schrägbankdrücken')).toBe('schraegbankdruecken');
    expect(matchesQuery('Schrägbankdrücken (Kurzhantel)', 'schraeg kurz')).toBe(true);
    expect(matchesQuery('Schrägbankdrücken (Kurzhantel)', 'SCHRÄG')).toBe(true);
    expect(matchesQuery('Kniebeuge', 'bank')).toBe(false);
    expect(matchesQuery('Kniebeuge', '')).toBe(true);
  });

  it('schlägt bei „Gerät besetzt“ Übungen für denselben Muskel vor, Studio-Geräte zuerst', async () => {
    const exercises = await db.exercises.toArray();
    const eq = new Map((await db.equipment.toArray()).map((e) => [e.id, e]));
    const current = exercises.find((e) => e.id === 'ex-brustpresse-maschine')!;
    const alts = alternativesFor(current, exercises, eq);
    expect(alts.length).toBeGreaterThan(3);
    expect(alts.every((a) => a.exercise.primaryMuscles.includes('brust') || a.exercise.secondaryMuscles.includes('brust'))).toBe(true);
    expect(alts[0].exercise.id).not.toBe(current.id);
    expect(eq.get(alts[0].exercise.equipmentId!)?.inStudio).toBe(true);
    expect(alts.find((a) => a.exercise.id === current.id)).toBeUndefined();
    // ausgeblendete Geräte tauchen nicht auf
    const hidden = new Map(eq);
    hidden.set('eq-newtech-pec-dec-fly', { ...eq.get('eq-newtech-pec-dec-fly')!, hidden: true });
    expect(alternativesFor(current, exercises, hidden).some((a) => a.exercise.id === 'ex-pec-dec-fly')).toBe(false);
  });
});

describe('Körperwerte', () => {
  it('speichert je Tag einen Datensatz, ersetzt Werte und löscht leere Tage', async () => {
    const { saveBodyMetric } = await import('../src/data/repo');
    await db.bodyMetrics.clear();
    await saveBodyMetric('2026-11-14', { weightKg: 80, waist: 90 });
    await saveBodyMetric('2026-11-14', { weightKg: 79.5 });
    let rows = await db.bodyMetrics.toArray();
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ date: '2026-11-14', weightKg: 79.5, waist: 90 });
    await saveBodyMetric('2026-11-14', { waist: undefined, weightKg: 0 }); // 0 und undefined löschen
    rows = await db.bodyMetrics.toArray();
    expect(rows.length).toBe(0);
  });
});

describe('Planung (Stufe 3): Speichern, Importieren, Kombinieren', () => {
  it('speichert das Ergebnis des Assistenten als Plan und aktiviert ihn auf Wunsch', async () => {
    const { savePlanFromAssistant } = await import('../src/data/repo');
    const { generatePlan } = await import('../src/logic/assistant');
    const exercises = await db.exercises.toArray();
    const equipment = new Map((await db.equipment.toArray()).map((e) => [e.id, e]));
    const r = generatePlan({ goal: 'muskelaufbau', days: 3, minutes: 60, weeks: 6, focus: [], excludedExerciseIds: [], allowGeneral: false, exercises, equipment, sessions: [], plans: [] });
    const saved = await savePlanFromAssistant(r, true);
    expect(saved.status).toBe('aktiv');
    expect(saved.origin).toBe('assistent');
    expect(saved.workouts.length).toBe(3);
    expect(saved.workouts[0].items[0]).not.toHaveProperty('roleLabel');
    expect(saved.workouts[0].items[0].id).not.toMatch(/^tmp-/);
    expect(saved.plannedWeeks).toBe(6);
  });

  it('importiert einen Plan mit vorhandenen und neu angelegten Übungen in einer Transaktion', async () => {
    const { importPlanFile } = await import('../src/data/repo');
    const file = {
      format: 'eisenzeit-plan' as const,
      version: 1,
      name: 'Import',
      goal: 'Kraft',
      plannedWeeks: 4,
      workouts: [{ name: 'A', items: [
        { exercise: 'ex-plank', sets: 3, repMin: 1, repMax: 1, restSec: 45 },
        { exercise: 'Zirkus-Übung', sets: 3, repMin: 8, repMax: 12, restSec: 90 },
      ] }],
    };
    const before = await db.exercises.count();
    const p = await importPlanFile(file, new Map([['ex-plank', 'ex-plank'], ['Zirkus-Übung', null]]));
    expect(p.origin).toBe('ki_import');
    expect(await db.exercises.count()).toBe(before + 1);
    const created = (await db.exercises.get(p.workouts[0].items[1].exerciseId))!;
    expect(created.name).toBe('Zirkus-Übung');
    expect(created.builtin).toBe(false);
    // Ein Fehler (nicht zugeordnete Übung) legt nichts an
    const n = await db.plans.count();
    await expect(importPlanFile(file, new Map([['ex-plank', 'ex-plank']]))).rejects.toThrow();
    expect(await db.plans.count()).toBe(n);
    expect(await db.exercises.count()).toBe(before + 1);
  });

  it('kombiniert Einheiten aus mehreren Plänen in gewählter Reihenfolge mit neuen Kennungen', async () => {
    const { mergePlans } = await import('../src/data/repo');
    const a = await planWith('KomboA', ['ex-plank']);
    const b = await planWith('KomboB', ['ex-laufband']);
    const m = (await mergePlans([{ planId: b.id, workoutId: b.workouts[0].id }, { planId: a.id, workoutId: a.workouts[0].id }], 'Mix', 5))!;
    expect(m.workouts.map((w) => w.items[0].exerciseId)).toEqual(['ex-laufband', 'ex-plank']);
    expect(m.workouts[0].id).not.toBe(b.workouts[0].id);
    expect(m.status).toBe('entwurf');
    expect(m.plannedWeeks).toBe(5);
    expect(await mergePlans([], 'leer', 4)).toBeUndefined();
  });

  it('legt einen Entlastungsplan mit einer Woche Laufzeit an', async () => {
    const { createDeloadPlan } = await import('../src/data/repo');
    const a = await planWith('Deload', ['ex-seitheben-maschine']);
    const d = (await createDeloadPlan(a.id))!;
    expect(d.plannedWeeks).toBe(1);
    expect(d.status).toBe('entwurf');
    expect(d.name).toContain('Entlastung');
    expect(d.workouts[0].items[0].sets).toBe(2); // ein Satz weniger, mindestens zwei
  });
});
