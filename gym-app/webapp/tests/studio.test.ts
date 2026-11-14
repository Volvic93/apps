import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '../src/data/db';
import { addPhoto, removeOrphanPhotos, saveExercise, setEquipmentPresent } from '../src/data/repo';
import { seedCatalog } from '../src/data/seed';
import { buildBackup, importBackup, validateBackup } from '../src/logic/backup';
import { isPresent, planEquipmentWithoutPhoto } from '../src/logic/catalog';
import { computeHints, visibleHints } from '../src/logic/hints';
import type { Equipment, Exercise, Plan } from '../src/data/types';

beforeAll(async () => {
  await seedCatalog();
});

const NOW = Date.UTC(2026, 10, 14, 12);
const blob = (t: string) => new Blob([t], { type: 'image/jpeg' });

function planOf(exerciseIds: string[], status: Plan['status'] = 'aktiv'): Plan {
  return {
    id: 'p1',
    createdAt: NOW,
    updatedAt: NOW,
    name: 'Testplan',
    goal: 'Muskelaufbau',
    plannedWeeks: 8,
    status,
    startedAt: NOW - 3 * 86400000,
    origin: 'manuell',
    workouts: [
      {
        id: 'w1',
        name: 'A',
        items: exerciseIds.map((exerciseId, i) => ({ id: `i${i}`, exerciseId, sets: 3, repMin: 8, repMax: 12, restSec: 90 })),
      },
    ],
  } as unknown as Plan;
}

describe('Dein Studio: vorhanden / nicht vorhanden', () => {
  it('markiert Geräte in einem Zug und überlebt ein Katalog-Update', async () => {
    const general = (await db.equipment.toArray()).find((e) => e.builtin && !e.inStudio)!;
    const studio = (await db.equipment.toArray()).find((e) => e.builtin && e.inStudio && !e.hidden)!;
    await setEquipmentPresent([
      { id: general.id, present: true },
      { id: studio.id, present: false },
    ]);
    expect(isPresent((await db.equipment.get(general.id))!)).toBe(true);
    expect(isPresent((await db.equipment.get(studio.id))!)).toBe(false);
    // Katalog-Update darf die Auswahl nicht zurücksetzen
    await seedCatalog(db, true);
    expect(isPresent((await db.equipment.get(general.id))!)).toBe(true);
    expect(isPresent((await db.equipment.get(studio.id))!)).toBe(false);
  });

  it('blendet ein ausgeblendetes Gerät wieder ein, wenn es als vorhanden markiert wird', async () => {
    const eq = (await db.equipment.toArray()).find((e) => e.builtin && e.inStudio)!;
    await db.equipment.put({ ...eq, hidden: true });
    expect(isPresent((await db.equipment.get(eq.id))!)).toBe(false);
    await setEquipmentPresent([{ id: eq.id, present: true }]);
    const after = (await db.equipment.get(eq.id))!;
    expect(after.hidden).toBe(false);
    expect(after.inStudio).toBe(true);
  });
});

describe('Fotos im Plan', () => {
  const eq = (id: string, over: Partial<Equipment>): Equipment => ({ id, name: id, kind: 'maschine', ...over }) as Equipment;
  const exMap = new Map<string, Pick<Exercise, 'equipmentId'>>([
    ['e1', { equipmentId: 'g1' }],
    ['e2', { equipmentId: 'g2' }],
    ['e3', { equipmentId: 'g3' }],
    ['e4', { equipmentId: 'g4' }],
    ['e5', { equipmentId: 'g1' }],
    ['e6', {}],
  ]);
  const eqMap = new Map<string, Equipment>([
    ['g1', eq('g1', {})],
    ['g2', eq('g2', { photoId: 'x' })],
    ['g3', eq('g3', { builtinPhoto: 'geraete/a.jpg' })],
    ['g4', eq('g4', { kind: 'freihantel' })],
  ]);

  it('findet Maschinen ohne Foto, jedes Gerät nur einmal', () => {
    const r = planEquipmentWithoutPhoto(planOf(['e1', 'e2', 'e3', 'e4', 'e5', 'e6']), exMap, eqMap);
    expect(r.map((e) => e.id)).toEqual(['g1']);
  });

  it('meldet „Foto fehlt“ und „Studio einrichten“ als Empfehlungen', () => {
    const base = { now: NOW, exercises: new Map<string, Exercise>(), plans: [planOf(['e1'])], sessions: [] };
    const exFull = new Map(exMap as unknown as Map<string, Exercise>);
    const h = computeHints({ ...base, exercises: exFull, equipment: eqMap, settings: { backupReminder: false, lastBackupAt: undefined, studioSetupDone: false } });
    expect(h.some((x) => x.key === 'studio_setup')).toBe(true);
    const photos = h.find((x) => x.key.startsWith('photos:'))!;
    expect(photos.action).toMatchObject({ kind: 'equipment', equipmentId: 'g1' });
    const done = computeHints({ ...base, exercises: exFull, equipment: eqMap, settings: { backupReminder: false, lastBackupAt: undefined, studioSetupDone: true } });
    expect(done.some((x) => x.key === 'studio_setup')).toBe(false);
    // ohne Geräteangabe entfällt der Foto-Hinweis; die Zahl der Karten bleibt auf zwei begrenzt
    expect(computeHints({ ...base, exercises: exFull, settings: { backupReminder: false, lastBackupAt: undefined, studioSetupDone: true } }).some((x) => x.key.startsWith('photos:'))).toBe(false);
    expect(visibleHints(h, []).length).toBeLessThanOrEqual(2);
  });
});

describe('Fotos aufräumen', () => {
  it('löscht nur ungenutzte, ältere Fotos', async () => {
    const eq = (await db.equipment.toArray()).find((e) => e.builtin)!;
    const ex = (await db.exercises.toArray()).find((e) => e.builtin)!;
    const used = await addPhoto(blob('a'));
    const motion = await addPhoto(blob('b'));
    const orphan = await addPhoto(blob('c'));
    const fresh = await addPhoto(blob('d'));
    await db.equipment.put({ ...eq, photoId: used });
    await db.exercises.put({ ...ex, motionPhotoIds: [motion, ''] });
    // „frisch“ gerade aufgenommen, „orphan“ schon älter
    await db.photos.update(orphan, { createdAt: Date.now() - 3600_000 });
    const removed = await removeOrphanPhotos();
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await db.photos.get(used)).toBeDefined();
    expect(await db.photos.get(motion)).toBeDefined();
    expect(await db.photos.get(orphan)).toBeUndefined();
    expect(await db.photos.get(fresh)).toBeDefined();
  });
});

describe('Bewegungsbild und Sicherung', () => {
  it('bleibt beim Katalog-Update und in der Sicherung erhalten, ungültige Werte werden abgelehnt', async () => {
    const ex = (await db.exercises.toArray()).find((e) => e.builtin)!;
    const start = await addPhoto(blob('s'));
    const end = await addPhoto(blob('e'));
    await saveExercise({ ...ex, motionPhotoIds: [start, end] });
    await seedCatalog(db, true);
    expect((await db.exercises.get(ex.id))!.motionPhotoIds).toEqual([start, end]);

    const backup = await buildBackup(db, true);
    expect(validateBackup(JSON.parse(JSON.stringify(backup))).ok).toBe(true);
    await importBackup(backup, 'ersetzen', db);
    expect((await db.exercises.get(ex.id))!.motionPhotoIds).toEqual([start, end]);
    expect(await db.photos.get(start)).toBeDefined();

    const broken = JSON.parse(JSON.stringify(backup));
    broken.data.exercises[0].motionPhotoIds = 'foto';
    expect(validateBackup(broken).ok).toBe(false);
    const brokenSetup = JSON.parse(JSON.stringify(backup));
    brokenSetup.data.settings[0] = { ...(brokenSetup.data.settings[0] ?? { id: 'settings' }), studioSetupDone: 'ja' };
    expect(validateBackup(brokenSetup).ok).toBe(false);
  });
});
