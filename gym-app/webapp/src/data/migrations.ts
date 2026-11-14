import { DB_SCHEMA_VERSION } from './db';

/** Alle Tabellen als einfache Listen – dieselbe Form wie im Datenteil einer Sicherungsdatei. */
export interface DataSet {
  equipment: Record<string, unknown>[];
  exercises: Record<string, unknown>[];
  plans: Record<string, unknown>[];
  sessions: Record<string, unknown>[];
  bodyMetrics: Record<string, unknown>[];
  settings: Record<string, unknown>[];
  photos?: Record<string, unknown>[];
}

export interface Migration {
  /** Schema-Version, auf die dieser Schritt hebt (Schritt von to-1 nach to). */
  to: number;
  description: string;
  up: (data: DataSet) => DataSet;
}

/**
 * Datenmigrationen für Sicherungsdateien und Datenbank-Umstellungen.
 * Aktuell gibt es nur das Ausgangsschema (1); der erste Eintrag kommt mit der ersten Schemaänderung,
 * z. B. { to: 2, description: '…', up: (d) => ({ …d, sessions: d.sessions.map(…) }) }.
 */
export const MIGRATIONS: Migration[] = [];

export class MigrationError extends Error {}

/** Hebt Daten von Version `from` auf `to`. Wirft bei zu neuen oder nicht migrierbaren Daten. */
export function migrateData(
  data: DataSet,
  from: number,
  to: number = DB_SCHEMA_VERSION,
  migrations: Migration[] = MIGRATIONS,
): DataSet {
  if (!Number.isInteger(from) || from < 1) throw new MigrationError(`Ungültige Schema-Version: ${from}`);
  if (from > to) {
    throw new MigrationError(
      `Die Daten stammen aus einer neueren App-Version (Schema ${from}, diese App kennt Schema ${to}). Bitte die App aktualisieren.`,
    );
  }
  let cur = data;
  for (let v = from + 1; v <= to; v++) {
    const step = migrations.find((m) => m.to === v);
    if (!step) throw new MigrationError(`Es fehlt die Migration auf Schema ${v}.`);
    cur = step.up(cur);
  }
  return cur;
}
