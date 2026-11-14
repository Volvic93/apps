import { describe, expect, it } from 'vitest';
import { DB_SCHEMA_VERSION } from '../src/data/db';
import { migrateData, MigrationError, type DataSet, type Migration } from '../src/data/migrations';

const empty = (): DataSet => ({ equipment: [], exercises: [], plans: [], sessions: [], bodyMetrics: [], settings: [] });

describe('Datenmigration', () => {
  it('lässt Daten der aktuellen Version unverändert', () => {
    const d = empty();
    expect(migrateData(d, DB_SCHEMA_VERSION)).toBe(d);
  });

  it('führt Schritte nacheinander in der richtigen Reihenfolge aus', () => {
    const log: number[] = [];
    const steps: Migration[] = [
      { to: 3, description: 'c', up: (d) => (log.push(3), { ...d, sessions: d.sessions.map((s) => ({ ...s, v3: true })) }) },
      { to: 2, description: 'b', up: (d) => (log.push(2), { ...d, sessions: d.sessions.map((s) => ({ ...s, v2: true })) }) },
    ];
    const d = { ...empty(), sessions: [{ id: 'a' }] };
    const out = migrateData(d, 1, 3, steps);
    expect(log).toEqual([2, 3]);
    expect(out.sessions[0]).toEqual({ id: 'a', v2: true, v3: true });
  });

  it('überspringt bereits angewendete Schritte', () => {
    const log: number[] = [];
    const steps: Migration[] = [
      { to: 2, description: 'b', up: (d) => (log.push(2), d) },
      { to: 3, description: 'c', up: (d) => (log.push(3), d) },
    ];
    migrateData(empty(), 2, 3, steps);
    expect(log).toEqual([3]);
  });

  it('lehnt Daten aus einer neueren App-Version ab', () => {
    expect(() => migrateData(empty(), DB_SCHEMA_VERSION + 1)).toThrow(MigrationError);
    expect(() => migrateData(empty(), DB_SCHEMA_VERSION + 1)).toThrow(/neueren App-Version/);
  });

  it('meldet fehlende Zwischenschritte', () => {
    expect(() => migrateData(empty(), 1, 3, [{ to: 2, description: 'b', up: (d) => d }])).toThrow(/Migration auf Schema 3/);
  });

  it('lehnt ungültige Versionsnummern ab', () => {
    expect(() => migrateData(empty(), 0)).toThrow(MigrationError);
    expect(() => migrateData(empty(), 1.5)).toThrow(MigrationError);
  });
});
