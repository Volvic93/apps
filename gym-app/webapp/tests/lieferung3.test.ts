import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { hintText, isUnconfirmed } from '../src/logic/catalog';
import { DB_SCHEMA_VERSION, EisenzeitDB, uid } from '../src/data/db';
import { ALL_CATALOG_EQUIPMENT, ALL_CATALOG_EXERCISES, seedCatalog } from '../src/data/seed';
import type { Entry, Session } from '../src/data/types';
import { buildBackup, carryUserFields, importBackup, normalizeActivePlans, validateBackup } from '../src/logic/backup';
import { snapToStack, stackWeights, stepWeight, summarizeSets, weightUnit } from '../src/logic/progression';
import { sessionVolume } from '../src/logic/stats';

describe('Unregelmäßige Gewichtsblöcke (Stufenliste)', () => {
  const paramount = { minKg: 9, maxKg: 73, stepKg: 4.5, levels: [9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59, 64, 68, 73] };
  const eq = { weightStack: paramount };
  const ex = { weightStep: 5 };

  it('springt mit + und − von Stufe zu Stufe', () => {
    expect(stepWeight(18, 1, ex, eq)).toBe(23);
    expect(stepWeight(18, -1, ex, eq)).toBe(14);
    expect(stepWeight(73, 1, ex, eq)).toBe(73);
    expect(stepWeight(9, -1, ex, eq)).toBe(9);
    expect(stepWeight(undefined, 1, ex, eq)).toBe(9);
  });
  it('behandelt Werte zwischen den Stufen und rastet ein', () => {
    expect(stepWeight(20, 1, ex, eq)).toBe(23);
    expect(stepWeight(20, -1, ex, eq)).toBe(18);
    expect(snapToStack(20, paramount)).toBe(18);
    expect(snapToStack(21, paramount)).toBe(23);
    expect(snapToStack(200, paramount)).toBe(73);
    expect(stackWeights(paramount).length).toBe(15);
  });
  it('kennt die Cybex-Stufen in kg', () => {
    const cybex = ALL_CATALOG_EQUIPMENT.find((e) => e.id === 'eq-cybex-eagle-bauch')!;
    expect(stackWeights(cybex.weightStack!)).toEqual([13.6, 22.7, 31.8, 40.8, 49.9, 59, 68, 77.1]);
  });
});

describe('Blöcke mit Plattennummern', () => {
  const waden = ALL_CATALOG_EQUIPMENT.find((e) => e.id === 'eq-gym80-waden')!;
  it('erkennt die Einheit und geht in Einserschritten', () => {
    expect(weightUnit(waden)).toBe('platte');
    expect(weightUnit(undefined)).toBe('kg');
    expect(stepWeight(2, 1, { weightStep: 5 }, waden)).toBe(3);
    expect(summarizeSets([{ kind: 'normal', weight: 12, reps: 15, doneAt: 1 }], 'gewicht_wdh', false, 'platte')).toBe('1 × 15 · Platte 12');
  });
  it('zählt Plattennummern nicht ins Kilogramm-Volumen', () => {
    const entry: Entry = { exerciseId: 'ex-gym80-waden', unit: 'platte', restSec: 60, repMin: 10, repMax: 15, sets: [{ kind: 'normal', weight: 12, reps: 15, doneAt: 1 }] };
    const kg: Entry = { ...entry, unit: undefined, exerciseId: 'ex-x' };
    const s: Session = { id: 's', createdAt: 1, updatedAt: 1, workoutName: 'W', startedAt: 1, endedAt: 2, entries: [entry, kg] };
    expect(sessionVolume(s)).toBe(12 * 15); // nur der Kilogramm-Eintrag
  });
});

describe('Studio-Geräte der dritten Lieferung', () => {
  it('hat zu jedem Gerät mindestens eine Übung und gültige Verweise', () => {
    const studio = ALL_CATALOG_EQUIPMENT.filter((e) => e.inStudio);
    for (const g of studio) {
      expect(ALL_CATALOG_EXERCISES.some((x) => x.equipmentId === g.id), g.id).toBe(true);
      expect(g.builtinPhoto, g.id).toMatch(/^geraete\/.+\.jpg$/);
    }
  });
  it('übernimmt Studio-Nummern und kennzeichnet Unsicheres', () => {
    const num = (id: string) => ALL_CATALOG_EQUIPMENT.find((e) => e.id === id)?.studioNumber;
    expect(num('eq-paramount-leg-curl')).toBe('6');
    expect(num('eq-gym80-unterer-ruecken')).toBe('18');
    expect(num('eq-gym80-beinbeuger-stehend')).toBe('23');
    // Alle Rückfragen der dritten Lieferung sind beantwortet: kein Gerät trägt mehr „Bitte bestätigen“.
    const unsicher = ALL_CATALOG_EQUIPMENT.filter((e) => /Bitte bestätigen/.test(e.hint ?? ''));
    expect(unsicher.length).toBe(0);
  });
  it('legt einseitige Übungen mit dem Merkmal an', () => {
    expect(ALL_CATALOG_EXERCISES.find((e) => e.id === 'ex-gym80-kickmaschine')?.unilateral).toBe(true);
    expect(ALL_CATALOG_EXERCISES.find((e) => e.id === 'ex-curl-kabel')?.unilateral).toBeUndefined();
  });
});

describe('Sicherung: tiefere Prüfung und aktive Pläne', () => {
  let db: EisenzeitDB;
  beforeEach(async () => {
    db = new EisenzeitDB('test-' + uid());
    await seedCatalog(db);
  });
  const good = async () => JSON.parse(JSON.stringify(await buildBackup(db, false)));

  it('lehnt Übungen mit fehlenden Muskeln oder Anleitung ab', async () => {
    const b = await good();
    b.data.exercises = [{ id: 'x', name: 'Kaputt', equipmentId: 'eq-brustpresse' }];
    const r = validateBackup(b);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/Hauptmuskeln|Anleitung/);
  });
  it('lehnt ungültige Gewichtsstufen ab (Schritt 0, Max unter Min, leere Stufenliste)', async () => {
    for (const ws of [{ minKg: 5, maxKg: 100, stepKg: 0 }, { minKg: 50, maxKg: 10, stepKg: 5 }, { minKg: 5, maxKg: 100, stepKg: 5, levels: [] }]) {
      const b = await good();
      b.data.equipment[0].weightStack = ws;
      expect(validateBackup(b).ok, JSON.stringify(ws)).toBe(false);
    }
  });
  it('lehnt unbekannte Typen und Status ab', async () => {
    const b = await good();
    b.data.equipment[0].kind = 'raumschiff';
    expect(validateBackup(b).ok).toBe(false);
    const c = await good();
    c.data.plans = [{ id: 'p', name: 'P', status: 'läuft', plannedWeeks: 8, workouts: [] }];
    expect(validateBackup(c).ok).toBe(false);
  });
  it('akzeptiert die eigene Sicherung samt Stufenlisten und Plattenblöcken', async () => {
    expect(validateBackup(await good()).ok).toBe(true);
  });
  it('lässt nach „Zusammenführen“ höchstens einen aktiven Plan übrig', async () => {
    const mk = (id: string, startedAt: number) => ({ id, createdAt: 1, updatedAt: startedAt, name: id, goal: '', plannedWeeks: 8, status: 'aktiv' as const, origin: 'manuell' as const, startedAt, workouts: [] });
    await db.plans.put(mk('lokal', 100));
    const b = await good();
    b.data.plans = [mk('aus-sicherung', 200)];
    const v = validateBackup(b);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    await importBackup(v.backup, 'zusammenfuehren', db);
    const active = (await db.plans.toArray()).filter((p) => p.status === 'aktiv');
    expect(active.map((p) => p.id)).toEqual(['aus-sicherung']);
    expect((await db.plans.get('lokal'))?.status).toBe('entwurf');
    await normalizeActivePlans(db); // idempotent
    expect(DB_SCHEMA_VERSION).toBe(1);
  });
});

describe('Katalog-Abgleich bewahrt Eigenes', () => {
  it('blendet veraltete Geräte mit eigenen Einstellwerten aus, statt sie zu löschen', async () => {
    const db = new EisenzeitDB('test-' + uid());
    await seedCatalog(db);
    const now = Date.now();
    await db.equipment.put({
      id: 'eq-alt', createdAt: now, updatedAt: now, name: 'Alt', kind: 'maschine', loading: 'gewichtsblock', pictogram: 'generisch',
      adjustments: [{ id: 'sitz', label: 'Sitz', min: 1, max: 7, myValue: 4 }], inStudio: true, hidden: false, builtin: true,
    });
    await seedCatalog(db, true);
    const eq = await db.equipment.get('eq-alt');
    expect(eq?.hidden).toBe(true);
    expect(eq?.adjustments[0].myValue).toBe(4);
  });
});

describe('Katalog: Umfang, Fotos und Texte (Runde 2)', () => {
  it('hat den dokumentierten Umfang', () => {
    expect(ALL_CATALOG_EQUIPMENT.filter((e) => e.inStudio).length).toBe(39);
    expect(ALL_CATALOG_EXERCISES.filter((x) => ALL_CATALOG_EQUIPMENT.find((e) => e.id === x.equipmentId)?.inStudio).length).toBe(52);
    expect(ALL_CATALOG_EQUIPMENT.filter((e) => !e.inStudio).length).toBe(28);
    expect(ALL_CATALOG_EXERCISES.filter((x) => !ALL_CATALOG_EQUIPMENT.find((e) => e.id === x.equipmentId)?.inStudio).length).toBe(70);
  });

  it('verweist nur auf vorhandene Fotodateien', () => {
    const files = new Set(readdirSync(join(process.cwd(), 'public', 'geraete')));
    for (const g of ALL_CATALOG_EQUIPMENT) {
      for (const src of [g.builtinPhoto, ...(g.builtinPhotos ?? []).map((p) => p.src)]) {
        if (src) expect(files.has(src.replace('geraete/', '')), `${g.id}: ${src}`).toBe(true);
      }
    }
  });

  it('übernimmt in Maschinenanleitungen keine Langhantel- oder Kabel-Formulierungen', () => {
    const maschinen = ALL_CATALOG_EQUIPMENT.filter((e) => e.inStudio && e.kind === 'maschine' && !/multipresse|power-smith/.test(e.id));
    const ids = new Set(maschinen.map((e) => e.id));
    for (const x of ALL_CATALOG_EXERCISES.filter((y) => ids.has(y.equipmentId ?? ''))) {
      const text = [x.instructions.setup, ...x.instructions.steps, x.instructions.tip, ...x.instructions.mistakes].join(' ');
      expect(text, x.id).not.toMatch(/Langhantel|Kabel|Seilgriff|Sicherheitsständer|Nacken tief|aus der Ablage/i);
    }
  });

  it('ordnet die Sitzmaschinen A/B richtig zu (A = Abduktoren, B = Adduktoren) und kennt „bestätigen“-Hinweise', () => {
    const a = ALL_CATALOG_EXERCISES.find((x) => x.id === 'ex-gym80-sitz-a-adduktoren')!;
    const b = ALL_CATALOG_EXERCISES.find((x) => x.id === 'ex-gym80-sitz-b-abduktoren')!;
    expect(a.primaryMuscles).toContain('abduktoren');
    expect(b.primaryMuscles).toEqual(['adduktoren']);
    const ea = ALL_CATALOG_EQUIPMENT.find((e) => e.id === 'eq-gym80-sitz-a')!;
    const eb = ALL_CATALOG_EQUIPMENT.find((e) => e.id === 'eq-gym80-sitz-b')!;
    expect(ea.name).toMatch(/Abduktoren/);
    expect(eb.name).toMatch(/Adduktoren/);
    expect(isUnconfirmed(ea)).toBe(false);
    expect(isUnconfirmed({ hint: 'Bitte bestätigen: stimmt das?' })).toBe(true);
    expect(isUnconfirmed(ALL_CATALOG_EQUIPMENT.find((e) => e.id === 'eq-gym80-waden'))).toBe(false);
    expect(hintText('Bitte bestätigen: stimmt das?')).toBe('stimmt das?');
  });

  it('trennt Hackenschmidt und Hip Press von Pure Kraft und trägt Hersteller und Foto 08 ein', () => {
    const eq = (id: string) => ALL_CATALOG_EQUIPMENT.find((e) => e.id === id)!;
    expect(eq('eq-purekraft-beinpresse').name).toMatch(/Hackenschmidt/);
    expect(eq('eq-purekraft-hip-press').name).toBe('Hip Press');
    expect(eq('eq-purekraft-beinpresse').builtinPhoto).not.toBe(eq('eq-purekraft-hip-press').builtinPhoto);
    expect(eq('eq-multipresse-silber').brand).toBe('Cybex');
    expect(eq('eq-prime-brustrudern').brand).toBe('Prime');
    expect(eq('eq-abduktoren-scheiben').model).toBe('Gluteral');
    expect((eq('eq-prime-seated-row').builtinPhotos ?? []).some((p) => p.src.includes('skala'))).toBe(true);
    expect(ALL_CATALOG_EXERCISES.find((x) => x.id === 'ex-seitheben-maschine')?.unilateral).toBe(true);
  });
});

describe('Sicherung zusammenführen: eigene Eingaben an mitgelieferten Geräten', () => {
  it('übernimmt Notizen, Eigengewicht, Ausblenden und eigene Einstellwerte, wo lokal nichts steht', () => {
    const base = { id: 'eq-x', builtin: true, hidden: false, adjustments: [{ id: 'a', label: 'Sitz', min: 1, max: 9 }], updatedAt: 100 };
    const local = { ...base };
    const incoming = { ...base, updatedAt: 50, hidden: true, ownWeightKg: 20, settingsNote: 'Sitz 4', adjustments: [{ id: 'a', label: 'Sitz', min: 1, max: 9, myValue: 4 }], edited: ['name'] };
    const merged = carryUserFields(local as never, incoming as never) as unknown as typeof incoming;
    expect(merged.hidden).toBe(true);
    expect(merged.ownWeightKg).toBe(20);
    expect(merged.settingsNote).toBe('Sitz 4');
    expect(merged.adjustments[0].myValue).toBe(4);
    expect(merged.edited).toEqual(['name']);
    // lokale Eingaben haben Vorrang, nichts zu übernehmen -> undefined
    expect(carryUserFields({ ...local, ownWeightKg: 5 } as never, { ...base, ownWeightKg: 20 } as never)).toBeUndefined();
  });
});
