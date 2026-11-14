import { beforeEach, describe, expect, it } from 'vitest';
import { DB_SCHEMA_VERSION, EisenzeitDB, getSettings, saveSettings, uid } from '../src/data/db';
import { seedCatalog } from '../src/data/seed';
import type { Plan, Session } from '../src/data/types';
import { backupFileName, buildBackup, importBackup, parseBackupText, validateBackup } from '../src/logic/backup';

let db: EisenzeitDB;
beforeEach(async () => {
  db = new EisenzeitDB('test-' + uid());
  await seedCatalog(db);
});

function plan(): Plan {
  return {
    id: 'plan-1', createdAt: 1, updatedAt: 1, name: 'Mein Plan', goal: 'Muskelaufbau', plannedWeeks: 8, status: 'aktiv', origin: 'manuell',
    workouts: [{ id: 'w1', name: 'Push', items: [{ id: 'i1', exerciseId: 'ex-bankdruecken-langhantel', sets: 3, repMin: 8, repMax: 12, restSec: 90 }] }],
  };
}
function session(id = 'sess-1', updatedAt = 10): Session {
  return {
    id, createdAt: 1, updatedAt, planId: 'plan-1', workoutId: 'w1', workoutName: 'Push', startedAt: 1_700_000_000_000, endedAt: 1_700_000_900_000,
    entries: [{ exerciseId: 'ex-bankdruecken-langhantel', restSec: 90, repMin: 8, repMax: 12, sets: [{ kind: 'normal', weight: 60, reps: 10, doneAt: 1_700_000_100_000 }] }],
  };
}

describe('Sicherung Export/Import', () => {
  it('exportiert und importiert verlustfrei (Ersetzen) – inklusive Fotos', async () => {
    await db.plans.put(plan());
    await db.sessions.put(session());
    await db.bodyMetrics.put({ id: 'b1', createdAt: 1, updatedAt: 1, date: '2026-11-14', weightKg: 82.5 });
    await db.photos.put({ id: 'ph1', createdAt: 1, updatedAt: 1, blob: new Blob([new Uint8Array([1, 2, 3, 255, 0, 7])], { type: 'image/jpeg' }) });
    await saveSettings({ defaultRestSec: 120 }, db);

    const backup = await buildBackup(db, true);
    expect(backup.format).toBe('eisenzeit-sicherung');
    expect(backup.schemaVersion).toBe(DB_SCHEMA_VERSION);
    const text = JSON.stringify(backup);

    const fresh = new EisenzeitDB('test-' + uid());
    const parsed = parseBackupText(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.summary).toMatchObject({ plans: 1, workouts: 1, sessions: 1, bodyMetrics: 1, photos: 1 });
    await importBackup(parsed.backup, 'ersetzen', fresh);

    expect(await fresh.plans.get('plan-1')).toEqual(plan());
    expect((await fresh.sessions.get('sess-1'))?.entries[0].sets[0]).toMatchObject({ weight: 60, reps: 10 });
    expect((await fresh.bodyMetrics.get('b1'))?.weightKg).toBe(82.5);
    expect((await getSettings(fresh)).defaultRestSec).toBe(120);
    const photo = await fresh.photos.get('ph1');
    expect(photo?.blob.type).toBe('image/jpeg');
    expect(Array.from(new Uint8Array(await photo!.blob.arrayBuffer()))).toEqual([1, 2, 3, 255, 0, 7]);
    // Katalog ist nach dem Import weiterhin vollständig
    expect(await fresh.exercises.count()).toBe(await db.exercises.count());
  });

  it('ersetzen verwirft vorhandene Daten, die nicht in der Sicherung stehen', async () => {
    const backup = await buildBackup(db, false);
    await db.plans.put(plan());
    await importBackup(backup, 'ersetzen', db);
    expect(await db.plans.count()).toBe(0);
  });

  it('zusammenführen behält Neueres und ergänzt Fehlendes', async () => {
    await db.sessions.bulkPut([session('s1', 10), session('s2', 10)]);
    const backup = await buildBackup(db, false);
    // lokal: s1 neuer, s2 unverändert, s3 nur lokal
    await db.sessions.put({ ...session('s1', 50), workoutName: 'Lokal neuer' });
    await db.sessions.put(session('s3', 5));
    // Sicherung: s2 ist neuer, s4 neu
    const b = JSON.parse(JSON.stringify(backup));
    b.data.sessions.find((s: Session) => s.id === 's2').updatedAt = 99;
    b.data.sessions.find((s: Session) => s.id === 's2').workoutName = 'Aus Sicherung';
    b.data.sessions.push({ ...session('s4', 1) });
    const v = validateBackup(b);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    await importBackup(v.backup, 'zusammenfuehren', db);
    const names = Object.fromEntries((await db.sessions.toArray()).map((s) => [s.id, s.workoutName]));
    expect(names).toEqual({ s1: 'Lokal neuer', s2: 'Aus Sicherung', s3: 'Push', s4: 'Push' });
  });

  it('lässt eigene Änderungen an Katalogeinträgen beim Import bestehen', async () => {
    await db.exercises.update('ex-bankdruecken-langhantel', { notes: 'Griff eine Handbreit', hidden: true });
    const backup = await buildBackup(db, false);
    const fresh = new EisenzeitDB('test-' + uid());
    await importBackup(backup, 'ersetzen', fresh);
    const ex = await fresh.exercises.get('ex-bankdruecken-langhantel');
    expect(ex?.notes).toBe('Griff eine Handbreit');
    expect(ex?.hidden).toBe(true);
  });

  it('erzeugt den Dateinamen mit Datum', () => {
    expect(backupFileName(new Date(2026, 10, 4))).toBe('eisenzeit-sicherung-2026-11-04.json');
  });
});

describe('Prüfung von Sicherungen', () => {
  const good = async () => JSON.parse(JSON.stringify(await buildBackup(db, false)));

  it('lehnt Text ab, der kein JSON ist', () => {
    const r = parseBackupText('das ist keine datei {');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/kein gültiges JSON/);
  });

  it('lehnt fremde JSON-Dateien ab', () => {
    expect(validateBackup({ foo: 1 }).ok).toBe(false);
    expect(validateBackup([]).ok).toBe(false);
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup('x').ok).toBe(false);
  });

  it('lehnt Sicherungen aus einer neueren Schema-Version ab', async () => {
    const b = await good();
    b.schemaVersion = DB_SCHEMA_VERSION + 1;
    const r = validateBackup(b);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/neueren App-Version/);
  });

  it('lehnt fehlende Tabellen, doppelte Kennungen und fehlerhafte Einträge ab', async () => {
    const b1 = await good();
    delete b1.data.plans;
    expect(validateBackup(b1).ok).toBe(false);

    const b2 = await good();
    b2.data.plans = [plan(), plan()];
    const r2 = validateBackup(b2);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.errors.join(' ')).toMatch(/doppelt/);

    const b3 = await good();
    b3.data.sessions = [{ ...session(), entries: [{ exerciseId: 'x', sets: [{ kind: 'unsinn' }] }] }];
    expect(validateBackup(b3).ok).toBe(false);

    const b4 = await good();
    b4.data.sessions = [{ ...session(), startedAt: 'gestern' }];
    expect(validateBackup(b4).ok).toBe(false);

    const b5 = await good();
    b5.data.sessions = [{ ...session(), entries: [{ exerciseId: 'x', restSec: 1, repMin: 1, repMax: 1, sets: [{ kind: 'normal', weight: 'viel' }] }] }];
    expect(validateBackup(b5).ok).toBe(false);

    const b6 = await good();
    b6.data.plans = [{ ...plan(), workouts: [{ id: 'w', name: 'x', items: [{ sets: 3 }] }] }];
    expect(validateBackup(b6).ok).toBe(false);
  });

  it('lehnt beschädigte Fotodaten ab', async () => {
    const b = await good();
    b.photos = [{ id: 'p', mime: 'image/jpeg', base64: '***kaputt***' }];
    expect(validateBackup(b).ok).toBe(false);
    const c = await good();
    c.photos = [{ id: 'p', mime: 'image/jpeg' }];
    expect(validateBackup(c).ok).toBe(false);
  });

  it('schreibt bei einem Fehler nichts in die Datenbank', async () => {
    await db.plans.put(plan());
    const b = await good();
    b.data.plans = 'kaputt';
    const r = validateBackup(b);
    expect(r.ok).toBe(false);
    expect(await db.plans.count()).toBe(1);
  });

  it('warnt vor Verweisen auf unbekannte Übungen, bricht aber nicht ab', async () => {
    const b = await good();
    b.data.plans = [{ ...plan(), workouts: [{ id: 'w', name: 'x', items: [{ id: 'i', exerciseId: 'ex-gibts-nicht', sets: 3, repMin: 8, repMax: 12, restSec: 60 }] }] }];
    const r = validateBackup(b);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.length).toBe(1);
  });
});
