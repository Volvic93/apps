import type { Equipment, Exercise, Session } from '../data/types';
import { SETKIND_LABEL } from '../data/types';

/** Trainingsdaten als CSV für Excel: Semikolon, Dezimalkomma, UTF-8 mit BOM. Nur abgehakte Sätze abgeschlossener Einheiten. */
export const CSV_HEADER = ['Datum', 'Einheit', 'Übung', 'Gerät', 'Satz', 'Art', 'Gewicht', 'Gewichtseinheit', 'Wiederholungen', 'Anstrengung (noch möglich)', 'Notiz'];

/** Für Dateinamen: Umlaute und ß auflösen, Sonderzeichen zu „-“. */
export function fileSlug(s: string): string {
  const t = s
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return t || 'training';
}

const cell = (v: string | number | undefined): string => {
  if (v === undefined) return '';
  let t = typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : v;
  // Tabellenprogramme würden Text mit = + - @ am Anfang als Formel ausführen: mit ' davor entschärfen
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

const date = (ts: number) => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function trainingCsv(sessions: Session[], exercises: Exercise[], equipment: Equipment[]): string {
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const eqMap = new Map(equipment.map((e) => [e.id, e]));
  const rows: string[] = [CSV_HEADER.join(';')];
  const done = sessions.filter((s) => s.endedAt !== undefined).sort((a, b) => a.startedAt - b.startedAt);
  for (const s of done) {
    let sessionNote = true; // Notiz der Einheit nur in der ersten Zeile
    for (const e of s.entries) {
      if (e.skipped) continue;
      const ex = exMap.get(e.exerciseId);
      const eq = ex?.equipmentId ? eqMap.get(ex.equipmentId) : undefined;
      let n = 0;
      let first = true;
      for (const st of e.sets) {
        if (st.doneAt === undefined) continue;
        const warm = st.kind === 'aufwaermen';
        if (!warm) n++;
        const note = [first ? e.note : undefined, sessionNote ? s.note : undefined].filter(Boolean).join(' | ');
        first = false;
        sessionNote = false;
        rows.push(
          [
            cell(date(s.startedAt)),
            cell(s.workoutName),
            cell(ex?.name ?? e.exerciseId),
            cell(eq?.name),
            cell(warm ? undefined : n),
            cell(SETKIND_LABEL[st.kind]),
            cell(st.weight),
            cell(st.weight === undefined ? undefined : e.unit === 'platte' ? 'Platte' : 'kg'),
            cell(st.reps ?? (st.durationSec !== undefined ? `${st.durationSec} s` : undefined)),
            cell(st.rir === undefined ? undefined : st.rir >= 3 ? '3+' : st.rir),
            cell(note || undefined),
          ].join(';'),
        );
      }
    }
  }
  return '﻿' + rows.join('\r\n') + '\r\n';
}

export function csvFileName(at = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `eisenzeit-training-${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}.csv`;
}
