import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '../src/data/db';
import { saveEvaluation } from '../src/data/repo';
import { seedCatalog } from '../src/data/seed';
import { buildBackup, validateBackup } from '../src/logic/backup';
import { EVAL_FORMAT_EXAMPLE, buildOrderMarkdown, correctionText, diffPlanFile, orderFileName, parseAiAnswer, toStoredEvaluation } from '../src/logic/aiorder';
import { PLAN_FORMAT_EXAMPLE as PLAN_EXAMPLE_RAW } from '../src/logic/planio';

// Die Beispiele aus dem Auftrag gelten nicht als Antwort – für Tests mit eigenem Text/Begründung
const PLAN_FORMAT_EXAMPLE = PLAN_EXAMPLE_RAW.replace('Kurze Begründung der Auswahl und Aufteilung.', 'Meine Begründung.');
const EVAL_ANSWER = EVAL_FORMAT_EXAMPLE.replace('Zwei bis drei Sätze Kurzfazit.', 'Gutes Training, solide Fortschritte.');
import type { Plan } from '../src/data/types';

beforeAll(async () => {
  await seedCatalog();
});

const base = async () => {
  const [exercises, equipment] = await Promise.all([db.exercises.toArray(), db.equipment.toArray()]);
  const plan = { id: 'p1', createdAt: 1, updatedAt: 1, name: 'Hauptplan', goal: 'Muskelaufbau', plannedWeeks: 8, status: 'aktiv', origin: 'manuell', startedAt: 1, workouts: [{ id: 'w1', name: 'Push', items: [{ id: 'i1', exerciseId: 'ex-brustpresse-maschine', sets: 3, repMin: 8, repMax: 12, restSec: 90 }, { id: 'i2', exerciseId: 'ex-pec-dec-fly', sets: 3, repMin: 10, repMax: 15, restSec: 60 }] }] } as unknown as Plan;
  return {
    plan,
    input: { now: new Date(2026, 10, 16).getTime(), settings: { profile: { goal: 'muskelaufbau', experience: 'fortgeschritten', daysPerWeek: 4 }, planWeeksDefault: 8, studio: { name: 'Kraftkultur Gym', city: 'Mönchengladbach' } } as never, wishes: 'Schwerpunkt Rücken', weeks: 8, includeGeneral: false, exercises, equipment: new Map(equipment.map((e) => [e.id, e])), plans: [plan], sessions: [] },
  };
};

describe('KI-Auftrag als Markdown', () => {
  it('jede Auftragsart erklärt Rolle, Regeln, Antwortformat und Kontext', async () => {
    const { plan, input } = await base();
    for (const kind of ['neu', 'anpassen', 'auswertung'] as const) {
      const md = buildOrderMarkdown(kind, input, plan);
      expect(md).toContain('## Deine Rolle und Aufgabe');
      expect(md).toContain('bis zu drei kurze, nummerierte Rückfragen');
      expect(md).toContain('genau einen JSON-Block');
      expect(md).toContain('## Antwortformat');
      expect(md).toContain('## Kontext');
      expect(md).toContain('Kraftkultur Gym Mönchengladbach');
      expect(md).toContain('Schwerpunkt Rücken');
      expect(md).toContain('ex-brustpresse-maschine');
    }
    expect(buildOrderMarkdown('auswertung', input, plan)).toContain('eisenzeit-auswertung');
    expect(buildOrderMarkdown('anpassen', input, plan)).toContain('basedOn');
    expect(buildOrderMarkdown('neu', input, plan)).toContain('"format": "eisenzeit-plan"');
  });

  it('Dateiname nach Art und Datum', () => {
    expect(orderFileName('neu', new Date(2026, 10, 16))).toBe('eisenzeit-auftrag-neuer-plan-2026-11-16.md');
    expect(orderFileName('anpassen', new Date(2026, 0, 5))).toBe('eisenzeit-auftrag-plan-anpassen-2026-01-05.md');
    expect(orderFileName('auswertung', new Date(2026, 10, 16))).toBe('eisenzeit-auftrag-auswertung-2026-11-16.md');
  });
});

describe('Antwort einlesen', () => {
  it('findet einen Plan in umgebendem Text', () => {
    const r = parseAiAnswer(`Gerne! Hier der Plan:\n\n\`\`\`json\n${PLAN_FORMAT_EXAMPLE}\n\`\`\`\n\nViel Erfolg.`);
    expect(r.ok && r.kind).toBe('plan');
  });

  it('erkennt eine Auswertung und deren Planvorschlag', () => {
    const o = { ...JSON.parse(EVAL_ANSWER), nextPlan: JSON.parse(PLAN_FORMAT_EXAMPLE) };
    const r = parseAiAnswer('```json\n' + JSON.stringify(o) + '\n```');
    expect(r.ok && r.kind).toBe('auswertung');
    if (r.ok && r.kind === 'auswertung') expect(r.evaluation.nextPlan?.workouts.length).toBeGreaterThan(0);
  });

  it('lehnt Fehlerhaftes streng und verständlich ab', () => {
    expect(parseAiAnswer('').ok).toBe(false);
    expect(parseAiAnswer('nur Text ohne Block').ok).toBe(false);
    const bad = parseAiAnswer('```json\n{"format":"eisenzeit-auswertung","version":1,"wentWell":"kein Array"}\n```');
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.join(' ')).toContain('summary');
      expect(bad.errors.join(' ')).toContain('wentWell');
    }
    expect(parseAiAnswer('```json\n{"format":"eisenzeit-plan","workouts":[]}\n```').ok).toBe(false);
    const broken = parseAiAnswer('```json\n{"format": "eisenzeit-plan", "workouts": [ {\n```');
    expect(broken.ok).toBe(false);
  });

  it('der ganze Auftrag (mit den Beispielen) ist keine Antwort', async () => {
    const { plan, input } = await base();
    for (const kind of ['neu', 'anpassen', 'auswertung'] as const) {
      const r = parseAiAnswer(buildOrderMarkdown(kind, input, plan));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.join(' ')).toContain('Beispiel');
    }
    // Auftrag plus echte Antwort: die Antwort gewinnt
    const md = buildOrderMarkdown('neu', input, plan);
    const ok = parseAiAnswer(md + '\n\nAntwort:\n```json\n' + PLAN_FORMAT_EXAMPLE + '\n```');
    expect(ok.ok && ok.kind).toBe('plan');
  });

  it('merkt sich die Art des Fehlers für den Korrekturtext', () => {
    const bad = parseAiAnswer('```json\n{"format":"eisenzeit-auswertung","version":1}\n```');
    expect(!bad.ok && bad.kind).toBe('auswertung');
    const bad2 = parseAiAnswer('```json\n{"format":"eisenzeit-plan","workouts":[]}\n```');
    expect(!bad2.ok && bad2.kind).toBe('plan');
  });

  it('erzeugt einen Korrekturtext zum Zurückgeben', () => {
    const t = correctionText(['"summary" (Kurzfazit) fehlt.'], 'auswertung');
    expect(t).toContain('nicht übernommen');
    expect(t).toContain('"summary"');
    expect(t).toContain('eisenzeit-auswertung');
  });
});

describe('Plan anpassen: Unterschiede', () => {
  it('eine eingefügte Einheit ist eine neue Einheit, nicht ein Ersatz', async () => {
    const mk = (name: string, ids: string[]) => ({ id: name, name, items: ids.map((e, i) => ({ id: `${name}${i}`, exerciseId: e, sets: 3, repMin: 8, repMax: 12, restSec: 90 })) });
    const old = { workouts: [mk('A', ['e1']), mk('B', ['e3'])] } as unknown as Plan;
    const file = { format: 'eisenzeit-plan', version: 1, name: 'x', goal: '', plannedWeeks: 8, workouts: [{ name: 'A', items: [{ exercise: 'e1', sets: 3, repMin: 8, repMax: 12, restSec: 90 }] }, { name: 'Rumpf', items: [{ exercise: 'e9', sets: 3, repMin: 8, repMax: 12, restSec: 60 }] }, { name: 'B', items: [{ exercise: 'e3', sets: 3, repMin: 8, repMax: 12, restSec: 90 }] }] };
    const text = diffPlanFile(old, file as never, (r) => r, (id) => id).join('\n');
    expect(text).toContain('Neue Einheit „Rumpf“');
    expect(text).toContain('„B“ – unverändert');
    expect(text).not.toContain('entfernt');
  });

  it('zeigt neue, entfernte und geänderte Übungen', async () => {
    const { plan } = await base();
    const file = parseAiAnswer(
      '```json\n' +
        JSON.stringify({
          format: 'eisenzeit-plan',
          version: 1,
          name: 'Hauptplan (angepasst)',
          goal: '',
          plannedWeeks: 8,
          basedOn: 'Hauptplan',
          workouts: [{ name: 'Push', items: [{ exercise: 'ex-brustpresse-maschine', sets: 4, repMin: 6, repMax: 8, restSec: 120 }, { exercise: 'ex-gym80-waden', sets: 3, repMin: 10, repMax: 15, restSec: 60 }] }],
        }) +
        '\n```',
    );
    expect(file.ok && file.kind === 'plan' && file.plan.basedOn).toBe('Hauptplan');
    if (!file.ok || file.kind !== 'plan') throw new Error('kein Plan');
    const lines = diffPlanFile(plan, file.plan, (ref) => ref, (id) => id);
    const text = lines.join('\n');
    expect(text).toContain('geändert: ex-brustpresse-maschine (3 × 8–12 → 4 × 6–8)');
    expect(text).toContain('neu: ex-gym80-waden');
    expect(text).toContain('entfernt: ex-pec-dec-fly');
  });
});

describe('Auswertung speichern', () => {
  it('wird am Plan gespeichert, bleibt in der Sicherung und besteht die Prüfung', async () => {
    const { plan } = await base();
    await db.plans.put(plan);
    const r = parseAiAnswer('```json\n' + EVAL_ANSWER + '\n```');
    if (!r.ok || r.kind !== 'auswertung') throw new Error('keine Auswertung');
    expect(await saveEvaluation('p1', toStoredEvaluation(r.evaluation, 123))).toBe(true);
    expect(await saveEvaluation('gibt-es-nicht', toStoredEvaluation(r.evaluation, 123))).toBe(false);
    const stored = await db.plans.get('p1');
    expect(stored?.evaluation?.summary).toContain('Gutes Training');
    const backup = await buildBackup(db, false);
    const v = validateBackup(JSON.parse(JSON.stringify(backup)));
    expect(v.ok).toBe(true);
    const bad = JSON.parse(JSON.stringify(backup));
    bad.data.plans.find((p: { id: string }) => p.id === 'p1').evaluation = { summary: 5 };
    expect(validateBackup(bad).ok).toBe(false);
  });
});
