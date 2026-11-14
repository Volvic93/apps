import { beforeEach, describe, expect, it } from 'vitest';
import { EisenzeitDB, uid } from '../src/data/db';
import { ALL_CATALOG_EQUIPMENT, ALL_CATALOG_EXERCISES, mergeBuiltinEquipment, mergeBuiltinExercise, seedCatalog } from '../src/data/seed';
import { MUSCLES } from '../src/data/muscles';
import { STUDIO_GERAETE, STUDIO_UEBUNGEN } from '../src/data/studio-geraete';
import { KATALOG_UEBUNGEN } from '../src/data/katalog';

describe('Katalog-Inhalt', () => {
  it('hat rund 70 allgemeine Übungen und eindeutige Kennungen', () => {
    expect(KATALOG_UEBUNGEN.length).toBeGreaterThanOrEqual(65);
    const ids = ALL_CATALOG_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const eqIds = ALL_CATALOG_EQUIPMENT.map((e) => e.id);
    expect(new Set(eqIds).size).toBe(eqIds.length);
  });

  it('verweist nur auf vorhandene Geräte und Muskelgruppen', () => {
    const eq = new Set(ALL_CATALOG_EQUIPMENT.map((e) => e.id));
    for (const e of ALL_CATALOG_EXERCISES) {
      if (e.equipmentId) expect(eq.has(e.equipmentId), `${e.id} → ${e.equipmentId}`).toBe(true);
      for (const m of [...e.primaryMuscles, ...e.secondaryMuscles]) expect(MUSCLES).toContain(m);
      expect(e.primaryMuscles.length, e.id).toBeGreaterThan(0);
    }
  });

  it('hat für jede Übung eine vollständige Anleitung', () => {
    for (const e of ALL_CATALOG_EXERCISES) {
      const i = e.instructions;
      expect(i.setup.length, `${e.id} Einstellung`).toBeGreaterThan(20);
      expect(i.steps.length, `${e.id} Ausführung`).toBeGreaterThanOrEqual(3);
      expect(i.breathing.length, `${e.id} Atmung`).toBeGreaterThan(10);
      expect(i.mistakes.length, `${e.id} Fehler`).toBeGreaterThanOrEqual(2);
      expect(i.tip.length, `${e.id} Tipp`).toBeGreaterThan(10);
    }
  });

  it('enthält die Studio-Geräte aus der ersten Fotolieferung', () => {
    // 5 Geräte aus Lieferung 1/2 plus die Geräte der dritten Lieferung
    expect(STUDIO_GERAETE.length).toBeGreaterThanOrEqual(35);
    expect(STUDIO_GERAETE.every((g) => g.inStudio && g.builtinPhoto)).toBe(true);
    const mp = STUDIO_UEBUNGEN.filter((e) => e.equipmentId === 'eq-newtech-multi-pully');
    expect(mp.length).toBe(14); // 12 Übungen der Herstellertafel + Klimmzüge + Face Pulls
    const lat = STUDIO_GERAETE.find((g) => g.id === 'eq-newtech-seitheben-maschine')!;
    expect(lat.weightStack).toEqual({ minKg: 5, maxKg: 100, stepKg: 5 });
    expect(lat.adjustments[0]).toMatchObject({ label: 'Plattformhöhe', min: 1, max: 16 });
    expect(lat.hint ?? '').not.toMatch(/bestätigen/); // Gerät ist bestätigt
    const lateral = STUDIO_UEBUNGEN.filter((e) => e.equipmentId === 'eq-newtech-seitheben-maschine');
    expect(lateral.length).toBe(1);
    expect(lateral[0]).toMatchObject({ name: 'Seitheben an der Maschine', unilateral: true, primaryMuscles: ['schulter_seitlich'] });
    // Multi-Hip war eine Fehlerkennung und darf nicht mehr vorkommen
    expect(JSON.stringify([STUDIO_GERAETE, STUDIO_UEBUNGEN])).not.toMatch(/multi-hip|Multi-Hip/);
  });
});

describe('Katalog einspielen und aktualisieren', () => {
  let db: EisenzeitDB;
  beforeEach(() => {
    db = new EisenzeitDB('test-' + uid());
  });

  it('legt Geräte und Übungen an und ist wiederholbar', async () => {
    await seedCatalog(db);
    const n = await db.exercises.count();
    expect(n).toBe(ALL_CATALOG_EXERCISES.length);
    await seedCatalog(db, true);
    expect(await db.exercises.count()).toBe(n);
  });

  it('überschreibt eigene Änderungen bei Katalog-Updates nicht', () => {
    const incoming = STUDIO_GERAETE.find((g) => g.id === 'eq-newtech-seitheben-maschine')!;
    const first = mergeBuiltinEquipment(undefined, incoming, 1);
    const edited = {
      ...first,
      name: 'Hüftmaschine',
      edited: ['name'],
      hidden: true,
      location: 'Ecke hinten',
      adjustments: first.adjustments.map((a) => ({ ...a, myValue: 9 })),
    };
    const updated = mergeBuiltinEquipment(edited, { ...incoming, name: 'Seitheben (neu)', hint: 'neuer Hinweis' }, 2);
    expect(updated.name).toBe('Hüftmaschine'); // vom Nutzer umbenannt
    expect(updated.hint).toBe('neuer Hinweis'); // Katalog-Inhalt wird aktualisiert
    expect(updated.hidden).toBe(true);
    expect(updated.location).toBe('Ecke hinten');
    expect(updated.adjustments[0].myValue).toBe(9);
  });

  it('aktualisiert nicht umbenannte Namen und erhält Notizen bei Übungen', () => {
    const incoming = ALL_CATALOG_EXERCISES[0];
    const first = mergeBuiltinExercise(undefined, incoming, 1);
    const cur = { ...first, notes: 'meine Notiz', hidden: true, adjustmentOverrides: { a: 3 } };
    const u = mergeBuiltinExercise(cur, { ...incoming, name: 'Neuer Name' }, 2);
    expect(u.name).toBe('Neuer Name');
    expect(u.notes).toBe('meine Notiz');
    expect(u.hidden).toBe(true);
    expect(u.adjustmentOverrides).toEqual({ a: 3 });
    const renamed = mergeBuiltinExercise({ ...cur, name: 'Mein Name', edited: ['name'] }, { ...incoming, name: 'Neuer Name' }, 3);
    expect(renamed.name).toBe('Mein Name');
  });

  it('übernimmt neue Einstellpunkte aus dem Katalog und behält selbst angelegte', () => {
    const incoming = STUDIO_GERAETE.find((g) => g.id === 'eq-gymleco-biceps-curl')!;
    const cur = mergeBuiltinEquipment(undefined, incoming, 1);
    cur.adjustments = [...cur.adjustments, { id: 'eigener', label: 'Eigener', min: 1, max: 3, myValue: 2 }];
    const u = mergeBuiltinEquipment(cur, { ...incoming, adjustments: [...incoming.adjustments, { id: 'neu', label: 'Neu', min: 1, max: 5 }] }, 2);
    expect(u.adjustments.map((a) => a.id)).toEqual(['sitzhoehe', 'brustpolster', 'neu', 'eigener']);
    expect(u.adjustments.find((a) => a.id === 'eigener')?.myValue).toBe(2);
  });
});

describe('Veraltete Katalogeinträge', () => {
  it('entfernt nicht mehr vorhandene mitgelieferte Einträge, außer sie werden noch verwendet', async () => {
    const db = new EisenzeitDB('test-' + uid());
    await seedCatalog(db);
    const now = Date.now();
    const base = { createdAt: now, updatedAt: now, kind: 'maschine' as const, loading: 'gewichtsblock' as const, pictogram: 'generisch' as const, adjustments: [], inStudio: true, hidden: false, builtin: true };
    await db.equipment.bulkPut([
      { ...base, id: 'eq-alt-frei', name: 'Alt frei' },
      { ...base, id: 'eq-alt-benutzt', name: 'Alt benutzt' },
    ]);
    const ex0 = (await db.exercises.toArray())[0];
    await db.exercises.bulkPut([
      { ...ex0, id: 'ex-alt-frei', equipmentId: 'eq-alt-frei', name: 'Alt frei' },
      { ...ex0, id: 'ex-alt-benutzt', equipmentId: 'eq-alt-benutzt', name: 'Alt benutzt' },
      { ...ex0, id: 'ex-eigene', equipmentId: undefined, builtin: false, name: 'Meine Übung' },
    ]);
    await db.plans.put({ id: 'p', createdAt: now, updatedAt: now, name: 'P', goal: '', plannedWeeks: 8, status: 'entwurf', origin: 'manuell', workouts: [{ id: 'w', name: 'W', items: [{ id: 'i', exerciseId: 'ex-alt-benutzt', sets: 3, repMin: 8, repMax: 12, restSec: 60 }] }] });
    await seedCatalog(db, true);
    expect(await db.exercises.get('ex-alt-frei')).toBeUndefined();
    expect(await db.equipment.get('eq-alt-frei')).toBeUndefined();
    expect((await db.exercises.get('ex-alt-benutzt'))?.hidden).toBe(true);
    expect((await db.equipment.get('eq-alt-benutzt'))?.hidden).toBe(true);
    expect((await db.exercises.get('ex-eigene'))?.name).toBe('Meine Übung'); // eigene Übungen bleiben immer
  });
});
