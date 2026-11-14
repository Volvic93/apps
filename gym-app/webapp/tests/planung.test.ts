import { describe, expect, it } from 'vitest';
import { ALL_CATALOG_EQUIPMENT, ALL_CATALOG_EXERCISES } from '../src/data/seed';
import type { Entry, Equipment, Exercise, Plan, Session, SetEntry } from '../src/data/types';
import { exerciseCount, generatePlan, ROLES, schemeFor, templatesFor, weightForReps } from '../src/logic/assistant';
import { computeHints, deloadTargets, dismissHint, groupSetsPerWeek, isDismissed, lagging, visibleHints } from '../src/logic/hints';
import {
  buildAiExportText,
  filePlanToPlan,
  jsonCandidates,
  matchAll,
  matchExercise,
  nameSimilarity,
  offeredExercises,
  parsePlanText,
  planToFile,
  PLAN_FORMAT_EXAMPLE,
} from '../src/logic/planio';

const DAY = 24 * 3600 * 1000;
const NOW = new Date(2026, 10, 14, 12).getTime();

const toEx = (e: (typeof ALL_CATALOG_EXERCISES)[number]): Exercise => ({ ...e, createdAt: 1, updatedAt: 1, hidden: false, builtin: true });
const toEq = (e: (typeof ALL_CATALOG_EQUIPMENT)[number]): Equipment => ({ ...e, createdAt: 1, updatedAt: 1, hidden: false, builtin: true });
const exercises = ALL_CATALOG_EXERCISES.map(toEx);
const exMap = new Map(exercises.map((e) => [e.id, e]));
const equipment = new Map(ALL_CATALOG_EQUIPMENT.map((e) => [e.id, toEq(e)]));

const done = (weight: number, reps: number, kind: SetEntry['kind'] = 'normal'): SetEntry => ({ kind, weight, reps, doneAt: 1 });
const entry = (exerciseId: string, sets: SetEntry[], extra: Partial<Entry> = {}): Entry => ({ exerciseId, sets, restSec: 90, repMin: 8, repMax: 12, ...extra });
const session = (id: string, daysAgo: number, entries: Entry[]): Session => {
  const t = NOW - daysAgo * DAY;
  return { id, createdAt: t, updatedAt: t, workoutName: 'W', startedAt: t, endedAt: t + 3600000, entries };
};
const plan = (id: string, status: Plan['status'], startedDaysAgo: number | undefined, weeks: number, ids: string[] = ['ex-brustpresse-maschine']): Plan => ({
  id,
  createdAt: 1,
  updatedAt: 1,
  name: 'Plan ' + id,
  goal: 'Muskelaufbau',
  plannedWeeks: weeks,
  status,
  origin: 'manuell',
  startedAt: startedDaysAgo === undefined ? undefined : NOW - startedDaysAgo * DAY,
  workouts: [{ id: 'w' + id, name: 'Push', items: ids.map((x, i) => ({ id: `i${id}${i}`, exerciseId: x, sets: 3, repMin: 8, repMax: 12, restSec: 90 })) }],
});
const settings = { backupReminder: true, lastBackupAt: NOW - DAY, studioSetupDone: true };

describe('Empfehlungen', () => {
  const base = { now: NOW, settings, exercises: exMap };

  it('meldet Planablauf und kündigt ihn eine Woche vorher an', () => {
    const ended = computeHints({ ...base, plans: [plan('a', 'aktiv', 8 * 7 + 3, 8)], sessions: [] });
    expect(ended.find((h) => h.key.startsWith('plan_end'))?.action.kind).toBe('assistant');
    const soon = computeHints({ ...base, plans: [plan('a', 'aktiv', 7 * 7 + 3, 8)], sessions: [] });
    expect(soon.some((h) => h.key.startsWith('plan_soon'))).toBe(true);
    expect(soon.some((h) => h.key.startsWith('plan_end'))).toBe(false);
    expect(computeHints({ ...base, plans: [plan('a', 'aktiv', 3 * 7, 8)], sessions: [] }).length).toBe(0);
    expect(computeHints({ ...base, plans: [plan('a', 'entwurf', undefined, 8)], sessions: [] }).length).toBe(0);
  });

  it('erkennt Stagnation einer Übung (3 Einheiten ohne Steigerung)', () => {
    const s = [session('1', 40, [entry('ex-brustpresse-maschine', [done(50, 10)])]), ...[30, 20, 10].map((d, i) => session('s' + i, d, [entry('ex-brustpresse-maschine', [done(40, 10)])]))];
    const h = computeHints({ ...base, plans: [plan('a', 'aktiv', 14, 8)], sessions: s });
    const hint = h.find((x) => x.key === 'stall:ex-brustpresse-maschine');
    expect(hint?.action).toMatchObject({ kind: 'exercise', exerciseId: 'ex-brustpresse-maschine' });
    expect(hint?.why).toContain('Seit 3 Einheiten');
  });

  it('empfiehlt eine Entlastungswoche, wenn mehrere Übungen zugleich stagnieren', () => {
    const ids = ['ex-brustpresse-maschine', 'ex-pec-dec-fly', 'ex-prime-seated-row'];
    const s = [60, 50, 40, 30, 20].map((d, i) => session('s' + i, d, ids.map((id) => entry(id, [done(i === 0 ? 50 : 40, 10)]))));
    const h = computeHints({ ...base, plans: [plan('a', 'aktiv', 14, 8, ids)], sessions: s });
    const deload = h.find((x) => x.key.startsWith('deload'));
    expect(deload?.action.kind).toBe('deload');
    expect(h.some((x) => x.key.startsWith('stall:'))).toBe(false);
  });

  it('empfiehlt einen sanften Wiedereinstieg nach mehr als 10 Tagen und eine Sicherung nach 30 Tagen', () => {
    const s = [session('1', 12, [entry('ex-brustpresse-maschine', [done(40, 10)])])];
    const h = computeHints({ ...base, plans: [plan('a', 'aktiv', 14, 8)], sessions: s });
    expect(h.find((x) => x.key.startsWith('comeback'))?.action.kind).toBe('start');
    expect(h.some((x) => x.key === 'backup')).toBe(false);
    const old = computeHints({ ...base, settings: { backupReminder: true, lastBackupAt: NOW - 40 * DAY }, plans: [], sessions: s });
    expect(old.find((x) => x.key === 'backup')?.why).toContain('40 Tage');
    expect(computeHints({ ...base, settings: { backupReminder: false, lastBackupAt: undefined }, plans: [], sessions: s }).some((x) => x.key === 'backup')).toBe(false);
  });

  it('erkennt eine zurückliegende Muskelgruppe', () => {
    const ids = ['ex-brustpresse-maschine', 'ex-gym80-latzug', 'ex-schulterpresse-maschine', 'ex-curl-kurzhantel', 'ex-beinpresse'];
    const sets = [done(30, 10), done(30, 10), done(30, 10), done(30, 10)];
    const s = [1, 3, 5, 8].map((d, i) => session('s' + i, d, [...ids.slice(0, 4).map((id) => entry(id, sets)), entry(ids[4], [done(30, 10)])]));
    const g = groupSetsPerWeek(s, exMap, 14, NOW);
    expect(g.brust).toBeGreaterThan(g.beine);
    const lag = lagging(g);
    expect(lag?.group).toBe('beine');
    const h = computeHints({ ...base, plans: [plan('a', 'aktiv', 10, 8)], sessions: s });
    expect(h.some((x) => x.key.startsWith('imbalance:beine'))).toBe(true);
  });

  it('stellt Karten zurück („Später“ eine Woche) oder blendet sie dauerhaft aus; höchstens zwei sichtbar', () => {
    const hints = [1, 2, 3].map((n) => ({ key: 'k' + n, priority: n, title: 't', why: 'w', action: { kind: 'backup', label: 'x' } as const }));
    expect(visibleHints(hints, [], NOW).map((h) => h.key)).toEqual(['k1', 'k2']);
    const later = dismissHint([], 'k1', 'later', NOW);
    expect(isDismissed(later, 'k1', NOW + 3 * DAY)).toBe(true);
    expect(isDismissed(later, 'k1', NOW + 8 * DAY)).toBe(false);
    expect(visibleHints(hints, later, NOW).map((h) => h.key)).toEqual(['k2', 'k3']);
    const never = dismissHint(later, 'k2', 'never', NOW);
    expect(visibleHints(hints, never, NOW + 9 * DAY).map((h) => h.key)).toEqual(['k1', 'k3']);
    // abgelaufene Einträge werden beim nächsten Schreiben entfernt
    expect(dismissHint(later, 'k9', 'never', NOW + 10 * DAY).filter((d) => d.startsWith('later:'))).toEqual([]);
  });

  it('berechnet Entlastungsgewichte (60 %) in den Stufen des Geräts', () => {
    const s = [session('1', 5, [entry('ex-brustpresse-maschine', [done(50, 10)])])];
    const p = plan('a', 'aktiv', 14, 8);
    const t = deloadTargets(p, s, exMap, new Map([['ex-brustpresse-maschine', { minKg: 5, maxKg: 100, stepKg: 5 }]]));
    expect(t.get(p.workouts[0].items[0].id)).toBe(30);
  });
});

describe('Plan-Assistent', () => {
  const input = (over: Partial<Parameters<typeof generatePlan>[0]> = {}) => ({
    goal: 'muskelaufbau' as const,
    days: 3,
    minutes: 60,
    weeks: 8,
    focus: [],
    excludedExerciseIds: [],
    allowGeneral: false,
    exercises,
    equipment,
    sessions: [],
    plans: [],
    now: NOW,
    ...over,
  });

  it('teilt nach Tagen auf: 2–3 Ganzkörper, 4 Ober-/Unterkörper, 5–6 Push/Pull/Beine', () => {
    expect(templatesFor(2).map((t) => t.name)).toEqual(['Ganzkörper A', 'Ganzkörper B']);
    expect(templatesFor(3).length).toBe(3);
    expect(templatesFor(4).map((t) => t.name)).toEqual(['Oberkörper A', 'Unterkörper A', 'Oberkörper B', 'Unterkörper B']);
    expect(templatesFor(5).length).toBe(5);
    expect(templatesFor(6).map((t) => t.name)).toEqual(['Push', 'Pull', 'Beine', 'Push B', 'Pull B', 'Beine B']);
  });

  it('kennt nur vorhandene Übungen als Kandidaten der Rollen', () => {
    for (const r of Object.values(ROLES)) for (const c of r.candidates) expect(exMap.has(c), `${r.id}: ${c}`).toBe(true);
  });

  it('wählt je Einheit die Anzahl nach Zeit und nur Studio-Übungen, ohne Doppelungen', () => {
    const r = generatePlan(input());
    expect(r.workouts.length).toBe(3);
    for (const w of r.workouts) {
      expect(w.items.length).toBeLessThanOrEqual(exerciseCount(60) + 1);
      expect(w.items.length).toBeGreaterThanOrEqual(4);
      expect(new Set(w.items.map((i) => i.exerciseId)).size).toBe(w.items.length);
      for (const i of w.items) {
        const ex = exMap.get(i.exerciseId)!;
        const eq = equipment.get(ex.equipmentId ?? '');
        expect(eq?.inStudio || eq?.kind === 'koerpergewicht', ex.id).toBe(true);
      }
    }
    expect(generatePlan(input({ minutes: 45 })).workouts[0].items.length).toBeLessThan(generatePlan(input({ minutes: 90 })).workouts[0].items.length);
  });

  it('nutzt Schemata nach Ziel', () => {
    expect(schemeFor('kraft', 'compound')).toMatchObject({ repMin: 4, repMax: 6 });
    expect(schemeFor('muskelaufbau', 'compound')).toMatchObject({ repMin: 8, repMax: 12 });
    expect(schemeFor('fitness', 'isolation')).toMatchObject({ repMin: 12, repMax: 15 });
    const kraft = generatePlan(input({ goal: 'kraft' }));
    expect(kraft.workouts[0].items[0]).toMatchObject({ repMin: 4, repMax: 6 });
  });

  it('beachtet Ausschlüsse und meldet fehlende Rollen', () => {
    const exclude = ROLES.pull_v.candidates;
    const r = generatePlan(input({ excludedExerciseIds: exclude }));
    const used = new Set(r.workouts.flatMap((w) => w.items.map((i) => i.exerciseId)));
    for (const id of exclude) expect(used.has(id)).toBe(false);
    const none = generatePlan(input({ excludedExerciseIds: [...ROLES.pull_v.candidates, ...ROLES.knee.candidates] }));
    expect(none.warnings.some((w) => w.includes('Ziehen senkrecht'))).toBe(true);
  });

  it('ersetzt stagnierende Übungen, behält gut laufende Grundübungen und leitet Startgewichte ab', () => {
    // Brustpresse läuft gut, Pec Dec stagniert
    const s = [70, 60, 50, 40, 30, 20, 10].map((d, i) =>
      session('s' + i, d, [entry('ex-panatta-power-smith', [done(40 + i * 2.5, 10)]), entry('ex-pec-dec-fly', [done(30, 12)])]),
    );
    const r = generatePlan(input({ days: 5, sessions: s }));
    const items = r.workouts.flatMap((w) => w.items);
    const press = items.find((i) => i.exerciseId === 'ex-panatta-power-smith');
    expect(press, 'Power Smith bleibt').toBeDefined();
    expect(press!.targetWeight).toBeGreaterThan(0);
    // Startgewicht liegt unter dem zuletzt geschätzten Wert und auf einer Gerätestufe
    expect(press!.targetWeight!).toBeLessThan(55 * (1 + 10 / 30));
    expect(items.some((i) => i.exerciseId === 'ex-pec-dec-fly')).toBe(false);
    expect(r.summary.join(' ')).toContain('Wegen Stagnation gewechselt');
  });

  it('wechselt Nebenübungen gegenüber dem letzten Plan', () => {
    const prevIds = ['ex-pec-dec-fly', 'ex-seitheben-maschine', 'ex-mp-trizepsdruecken'];
    const prev = plan('p', 'archiv', undefined, 8, prevIds);
    prev.updatedAt = 5;
    const r = generatePlan(input({ plans: [prev], days: 5 }));
    // Die erste Einheit wählt eine andere Brust-Isolationsübung (eine spätere Variante darf wieder auf die frühere zurückgreifen)
    const push = r.workouts[0].items.map((i) => i.exerciseId);
    expect(push.includes('ex-pec-dec-fly')).toBe(false);
    expect(r.workouts[0].items.some((i) => i.why.includes('Wechsel gegenüber'))).toBe(true);
  });

  it('fügt bei Schwerpunkt eine Übung hinzu und bei Fitness einen Ausdauerabschluss (nur mit Gerät)', () => {
    const base = generatePlan(input({ days: 4 }));
    const focus = generatePlan(input({ days: 4, focus: ['arme'] }));
    expect(focus.workouts[0].items.length).toBeGreaterThanOrEqual(base.workouts[0].items.length);
    const fit = generatePlan(input({ goal: 'fitness', allowGeneral: true }));
    expect(fit.workouts[0].items.some((i) => exMap.get(i.exerciseId)?.tracking === 'cardio')).toBe(true);
    const fitStudio = generatePlan(input({ goal: 'fitness' }));
    expect(fitStudio.workouts[0].items.some((i) => exMap.get(i.exerciseId)?.tracking === 'cardio')).toBe(false);
  });

  it('rechnet Gewicht aus der geschätzten Maximalkraft zurück', () => {
    expect(weightForReps(100, 1)).toBe(100);
    expect(weightForReps(100, 10)).toBeCloseTo(75);
  });
});

describe('Plan-Austauschformat', () => {
  const sample = {
    format: 'eisenzeit-plan',
    version: 1,
    name: 'Test',
    goal: 'Kraft',
    plannedWeeks: 6,
    workouts: [{ name: 'A', items: [{ exercise: 'ex-brustpresse-maschine', sets: 4, repMin: 5, repMax: 8, restSec: 150, targetWeight: 40, note: 'langsam' }] }],
    explanation: 'weil',
  };

  it('findet den JSON-Block auch in umgebendem Text und in Codeblöcken', () => {
    const text = `Hier ist dein Plan:\n\`\`\`json\n${JSON.stringify(sample, null, 2)}\n\`\`\`\nViel Erfolg! {nicht json}`;
    const r = parsePlanText(text);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.name).toBe('Test');
      expect(r.plan.explanation).toBe('weil');
    }
    expect(parsePlanText(`Text vorher ${JSON.stringify(sample)} Text nachher`).ok).toBe(true);
    expect(jsonCandidates('{"a":"}"} {"b":1}').length).toBeGreaterThanOrEqual(2);
  });

  it('lehnt fehlerhafte Eingaben mit verständlicher Meldung ab', () => {
    const bad = (mut: (o: typeof sample) => unknown) => {
      const copy = JSON.parse(JSON.stringify(sample));
      mut(copy);
      return parsePlanText(JSON.stringify(copy));
    };
    const e = (r: ReturnType<typeof parsePlanText>) => (r.ok ? [] : r.errors).join(' ');
    expect(e(parsePlanText(''))).toContain('nichts');
    expect(e(parsePlanText('kein json hier'))).toContain('kein Plan');
    expect(e(parsePlanText('{"format":"eisenzeit-plan", "workouts": [}'))).toContain('fehlerhaft');
    expect(e(bad((o) => (o.workouts = [])))).toContain('keine Einheiten');
    expect(e(bad((o) => (o.workouts[0].items[0].repMin = 12)))).toContain('repMin');
    expect(e(bad((o) => ((o.workouts[0].items[0] as { sets: unknown }).sets = 'x')))).toContain('sets');
    expect(e(bad((o) => ((o.workouts[0].items[0] as { restSec: unknown }).restSec = 5000)))).toContain('restSec');
    expect(e(bad((o) => ((o as { format: string }).format = 'anderes')))).toContain('Unbekanntes Format');
    expect(e(bad((o) => ((o as { version: number }).version = 9)))).toContain('Version');
    expect(e(bad((o) => ((o.workouts[0].items[0] as { exercise: string }).exercise = ' ')))).toContain('exercise');
  });

  it('ergänzt fehlende Angaben mit Standardwerten und warnt', () => {
    const r = parsePlanText(JSON.stringify({ workouts: [{ items: [{ exercise: 'Bankdrücken' }] }] }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.name).toBe('Importierter Plan');
      expect(r.plan.plannedWeeks).toBe(8);
      expect(r.plan.workouts[0]).toMatchObject({ name: 'Einheit 1', items: [{ sets: 3, repMin: 8, repMax: 12, restSec: 90 }] });
      expect(r.warnings.length).toBeGreaterThan(0);
    }
  });

  it('ordnet Übungen zu: Kennung → Name → ähnlich → neu', () => {
    expect(matchExercise('ex-brustpresse-maschine', exercises).kind).toBe('id');
    expect(matchExercise('brustpresse (maschine)', exercises).kind).toBe('name');
    const sim = matchExercise('Lat Pulldown breit Latzug', exercises);
    expect(['similar', 'new']).toContain(sim.kind);
    expect(matchExercise('Schrägbankdrücken Kurzhantel', exercises)).toMatchObject({ kind: 'name', exerciseId: 'ex-schraegbankdruecken-kurzhantel' });
    expect(matchExercise('Kniebeuge Langhantel Rack', exercises)).toMatchObject({ kind: 'similar', exerciseId: 'ex-kniebeuge-langhantel' });
    expect(matchExercise('Zirkusakrobatik mit Feuerbällen', exercises).kind).toBe('new');
    expect(nameSimilarity('Bankdrücken (Langhantel)', 'Langhantel Bankdrücken')).toBeGreaterThan(0.9);
    const m = matchAll(
      { format: 'eisenzeit-plan', version: 1, name: 'x', goal: '', plannedWeeks: 8, workouts: [{ name: 'A', items: [{ exercise: 'ex-xyz', exerciseName: 'Brustpresse (Maschine)', sets: 3, repMin: 8, repMax: 12, restSec: 90 }] }] },
      exercises,
    );
    expect(m.get('ex-xyz')?.kind).toBe('name');
  });

  it('macht aus der Datei einen Plan als Entwurf mit neuen Kennungen und Herkunft „KI-Import“', () => {
    const r = parsePlanText(JSON.stringify(sample));
    if (!r.ok) throw new Error('parse');
    let n = 0;
    const p = filePlanToPlan(r.plan, (ref) => ref, () => 'id' + n++, 123);
    expect(p).toMatchObject({ status: 'entwurf', origin: 'ki_import', name: 'Test', plannedWeeks: 6 });
    expect(p.workouts[0].items[0]).toMatchObject({ exerciseId: 'ex-brustpresse-maschine', sets: 4, repMin: 5, repMax: 8, restSec: 150, targetWeight: 40, note: 'langsam' });
    expect(new Set([p.id, p.workouts[0].id, p.workouts[0].items[0].id]).size).toBe(3);
  });

  it('exportiert einen Plan so, dass der Import ihn wieder einliest (Rundreise)', () => {
    const p = plan('x', 'aktiv', 5, 6, ['ex-brustpresse-maschine', 'ex-plank']);
    p.workouts[0].items[0].targetWeight = 45;
    p.workouts[0].items[1].supersetGroup = 2;
    const file = planToFile(p, exMap, 'Begründung');
    const r = parsePlanText(JSON.stringify(file));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.workouts[0].items.map((i) => i.exercise)).toEqual(['ex-brustpresse-maschine', 'ex-plank']);
      expect(r.plan.workouts[0].items[0].targetWeight).toBe(45);
      expect(r.plan.workouts[0].items[1].supersetGroup).toBe(2);
      expect(r.plan.explanation).toBe('Begründung');
    }
  });

  it('erzeugt den KI-Text mit Aufgabe, Profil, Übungsliste, Plan, Verlauf und Format', () => {
    const s = [session('1', 20, [entry('ex-brustpresse-maschine', [done(40, 10), done(40, 9)])]), session('2', 10, [entry('ex-brustpresse-maschine', [done(45, 10)])])];
    const text = buildAiExportText({
      now: NOW,
      settings: { profile: { goal: 'kraft', experience: 'fortgeschritten', daysPerWeek: 4 }, planWeeksDefault: 8 },
      wishes: 'Schulter links schonen',
      weeks: 10,
      includeGeneral: false,
      exercises,
      equipment,
      plans: [plan('a', 'aktiv', 14, 8)],
      sessions: s,
    });
    for (const part of ['# Aufgabe', '# Profil', 'Kraft', 'Fortgeschritten', 'Schulter links schonen', '10 Wochen', '# Verfügbare Übungen', 'ex-brustpresse-maschine', '# Bisheriger Plan', '# Verlauf', '2× trainiert', '# Antwortformat', '"format": "eisenzeit-plan"']) {
      expect(text, part).toContain(part);
    }
    // Das Beispiel im Text ist selbst ein gültiger Plan
    expect(parsePlanText(PLAN_FORMAT_EXAMPLE).ok).toBe(true);
    // Der Text enthält keine privaten Angaben jenseits des Gewünschten (kein Name, keine E-Mail)
    expect(text).not.toMatch(/@/);
    expect(offeredExercises(exercises, equipment, false).length).toBeLessThan(offeredExercises(exercises, equipment, true).length);
  });
});

describe('Prüfrunde Stufe 2/3: Regressionen', () => {
  const base = { now: NOW, settings, exercises: exMap };

  it('meldet Körpergewichts-, Cardio- und Hilfsgewichts-Übungen nicht fälschlich als stagnierend', async () => {
    const { isStalled } = await import('../src/logic/progress');
    const bw = [50, 40, 30, 20, 10].map((d, i) => session('b' + i, d, [entry('ex-dips', [done(0, 5 + i)])]));
    expect(isStalled(bw, 'ex-dips')).toBe(false);
    const flat = [50, 40, 30, 20, 10].map((d, i) => session('f' + i, d, [entry('ex-dips', [done(0, 8)])]));
    expect(isStalled(flat, 'ex-dips')).toBe(true);
    const h = computeHints({ ...base, plans: [plan('a', 'aktiv', 14, 8, ['ex-dips', 'ex-crunch-boden', 'ex-beinheben-haengend'])], sessions: [50, 40, 30, 20, 10].map((d, i) => session('s' + i, d, ['ex-dips', 'ex-crunch-boden', 'ex-beinheben-haengend'].map((id) => entry(id, [done(0, 5 + i)])))) });
    expect(h.some((x) => x.key.startsWith('deload'))).toBe(false);
  });

  it('löst nach einem Planwechsel keine Entlastung auf alter Historie aus', () => {
    const ids = ['ex-brustpresse-maschine', 'ex-pec-dec-fly', 'ex-prime-seated-row'];
    const s = [60, 50, 40, 30, 20].map((d, i) => session('s' + i, d, ids.map((id) => entry(id, [done(i === 0 ? 50 : 40, 10)]))));
    const neu = plan('neu', 'aktiv', 2, 8, ['ex-plank', 'ex-laufband']);
    const h = computeHints({ ...base, plans: [neu], sessions: s });
    expect(h.some((x) => x.key.startsWith('deload') || x.key.startsWith('stall:'))).toBe(false);
  });

  it('hält „Nicht mehr zeigen“ auch bei Entlastung und Muskelungleichgewicht dauerhaft', () => {
    const ids = ['ex-brustpresse-maschine', 'ex-pec-dec-fly', 'ex-prime-seated-row'];
    const s = [60, 50, 40, 30, 20].map((d, i) => session('s' + i, d, ids.map((id) => entry(id, [done(i === 0 ? 50 : 40, 10)]))));
    const p = [plan('a', 'aktiv', 14, 8, ids)];
    const deload = computeHints({ ...base, plans: p, sessions: s }).find((h) => h.key.startsWith('deload'))!;
    const dismissed = dismissHint([], deload.key, 'never', NOW);
    const later = computeHints({ ...base, now: NOW + 30 * DAY, plans: p, sessions: s.map((x) => ({ ...x, startedAt: x.startedAt + 30 * DAY })) }).find((h) => h.key.startsWith('deload'));
    expect(later?.key).toBe(deload.key);
    expect(isDismissed(dismissed, later!.key, NOW + 30 * DAY)).toBe(true);
  });

  it('übersteht ungültige Einträge in dismissedHints', () => {
    expect(isDismissed([null as never, 5 as never, 'never:x'], 'x')).toBe(true);
    expect(dismissHint(null as never, 'k', 'never').length).toBe(1);
  });

  it('durchläuft den Abschluss-Ablauf: Plan abgelaufen → Hinweis → neuer Plan aktiv → Hinweis weg', () => {
    const old = plan('alt', 'aktiv', 8 * 7 + 3, 8);
    expect(computeHints({ ...base, plans: [old], sessions: [] }).some((h) => h.key.startsWith('plan_end'))).toBe(true);
    const neu = plan('neu', 'aktiv', 0, 8);
    const alt = { ...old, status: 'entwurf' as const };
    expect(computeHints({ ...base, plans: [alt, neu], sessions: [] }).some((h) => h.key.startsWith('plan_end'))).toBe(false);
  });

  it('zählt keine Hilfsgewichte als Rekord und kein negatives Volumen', async () => {
    const { recordList, weeklyStats } = await import('../src/logic/progress');
    const s = [session('a', 1, [entry('ex-klimmzug-hilfe', [done(-30, 8)]), entry('ex-x', [done(40, 10)])])];
    expect(recordList(s).some((r) => r.exerciseId === 'ex-klimmzug-hilfe')).toBe(false);
    expect(weeklyStats(s, 1, NOW)[0].volume).toBeGreaterThanOrEqual(0);
  });

  it('ordnet Übungen strenger zu: kein Präfix-Treffer über Muskelgruppen, Teilnamen werden ähnlich', () => {
    expect(matchExercise('Beinstrecker sitzend', exercises).exerciseId).not.toBe('ex-beinbeuger-sitzend');
    expect(matchExercise('Crunch', exercises)).toMatchObject({ kind: 'similar' });
    expect(matchExercise('Kniebeuge', exercises).kind).toBe('similar');
  });

  it('nimmt beim Import den letzten gültigen Plan und lehnt zu lange Texte ab', () => {
    const mk = (n: string) => JSON.stringify({ format: 'eisenzeit-plan', version: 1, name: n, workouts: [{ name: 'A', items: [{ exercise: 'ex-plank' }] }] });
    const r = parsePlanText(`Auftrag mit Beispiel ${mk('Beispiel')} und dann die Antwort ${mk('Antwort')}`);
    expect(r.ok && r.plan.name).toBe('Antwort');
    expect(parsePlanText('{'.repeat(400_000)).ok).toBe(false);
    const w = parsePlanText(mk('X'));
    expect(w.ok && w.warnings.join(' ')).toContain('Standardwerte');
  });

  it('beschriftet Plattennummern im KI-Text und zeigt „Plan abgelaufen“', async () => {
    const { planWeekLabel } = await import('../src/logic/stats');
    expect(planWeekLabel(NOW - 3 * 7 * DAY, 8, NOW)).toBe('Woche 4 von 8');
    expect(planWeekLabel(NOW - 9 * 7 * DAY, 8, NOW)).toBe('Plan abgelaufen (Woche 10)');
    const p = plan('x', 'aktiv', 5, 8, ['ex-gym80-waden']);
    p.workouts[0].items[0].targetWeight = 10;
    const text = buildAiExportText({ now: NOW, settings: { profile: { goal: 'kraft', experience: 'einsteiger', daysPerWeek: 3 }, planWeeksDefault: 8 }, wishes: '', weeks: 8, includeGeneral: false, exercises, equipment, plans: [p], sessions: [] });
    expect(text).toContain('Ziel Platte 10');
  });
});
