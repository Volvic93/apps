import { MUSCLE_LABEL } from '../data/muscles';
import { EXPERIENCE_LABEL, GOAL_LABEL, type Equipment, type Exercise, type Plan, type PlanItem, type Session, type Settings } from '../data/types';
import { fold } from './catalog';
import { exerciseSeries, finishedSessions, isStalled, muscleLoad, weeklyStats, averagePerWeek } from './progress';
import { weightUnit } from './progression';

export const PLAN_FORMAT = 'eisenzeit-plan';
export const PLAN_FORMAT_VERSION = 1;

// ------------------------------------------------------------------------------------------ Export

export interface PlanFile {
  format: typeof PLAN_FORMAT;
  version: number;
  name: string;
  goal: string;
  plannedWeeks: number;
  workouts: {
    name: string;
    items: { exercise: string; exerciseName?: string; sets: number; repMin: number; repMax: number; restSec: number; targetWeight?: number; supersetGroup?: number; note?: string }[];
  }[];
  explanation?: string;
  /** Nur bei „Plan anpassen“: Name des Ausgangsplans (für die Vorschau der Unterschiede). */
  basedOn?: string;
}

/** Plan im Austauschformat (Dateiexport und Antwortformat der KI). */
export function planToFile(plan: Pick<Plan, 'name' | 'goal' | 'plannedWeeks' | 'workouts'>, exercises: Map<string, Pick<Exercise, 'name'>>, explanation?: string): PlanFile {
  return {
    format: PLAN_FORMAT,
    version: PLAN_FORMAT_VERSION,
    name: plan.name,
    goal: plan.goal,
    plannedWeeks: plan.plannedWeeks,
    workouts: plan.workouts.map((w) => ({
      name: w.name,
      items: w.items.map((i) => ({
        exercise: i.exerciseId,
        exerciseName: exercises.get(i.exerciseId)?.name,
        sets: i.sets,
        repMin: i.repMin,
        repMax: i.repMax,
        restSec: i.restSec,
        ...(i.targetWeight ? { targetWeight: i.targetWeight } : {}),
        ...(i.supersetGroup ? { supersetGroup: i.supersetGroup } : {}),
        ...(i.note ? { note: i.note } : {}),
      })),
    })),
    ...(explanation ? { explanation } : {}),
  };
}

// ------------------------------------------------------------------------------------------ JSON finden

/** Alle JSON-Objekte in einem Text: ganze Eingabe, Codeblöcke (```), sonst jedes ausgeglichene `{ … }`. */
export function jsonCandidates(text: string): string[] {
  const out: string[] = [];
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) out.push(trimmed);
  for (const m of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    const t = m[1].trim();
    if (t.startsWith('{')) out.push(t);
  }
  // ausgeglichene Klammern, Zeichenketten beachten
  let scans = 0; // Schutz gegen Müll-Eingaben mit sehr vielen offenen Klammern (sonst quadratische Laufzeit)
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    if (++scans > 400) break;
    let depth = 0;
    let inStr = false;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (c === '\\') j++;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          out.push(text.slice(i, j + 1));
          i = j;
          break;
        }
      }
    }
  }
  return [...new Set(out)];
}

export const MAX_IMPORT_CHARS = 300_000;

export type ParseResult = { ok: true; plan: PlanFile; warnings: string[] } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Findet im Text einen Plan, prüft ihn streng und liefert verständliche Fehlermeldungen. Importiert nie halb. */
export function parsePlanText(text: string): ParseResult {
  if (!text.trim()) return { ok: false, errors: ['Es wurde nichts eingefügt.'] };
  if (text.length > MAX_IMPORT_CHARS) return { ok: false, errors: ['Der Text ist zu lang (mehr als 300.000 Zeichen). Füge nur die Antwort mit dem Plan ein.'] };
  const found: { obj: Record<string, unknown> }[] = [];
  let parseError = false;
  for (const c of jsonCandidates(text)) {
    try {
      const v = JSON.parse(c);
      if (isObj(v) && (v.format === PLAN_FORMAT || Array.isArray(v.workouts))) found.push({ obj: v });
    } catch {
      parseError = true;
    }
  }
  if (!found.length) {
    return {
      ok: false,
      errors: [
        parseError
          ? 'Der JSON-Block ist fehlerhaft (zum Beispiel ein Komma zu viel oder eine fehlende Klammer). Bitte die KI bitten, die Antwort noch einmal vollständig als JSON auszugeben.'
          : 'In dem Text wurde kein Plan gefunden. Er muss einen JSON-Block mit "format": "eisenzeit-plan" enthalten.',
      ],
    };
  }
  // Auch der ganze Chat darf eingefügt werden (Auftrag mit Beispiel + Antwort): der letzte gültige Plan gewinnt
  let lastError: ParseResult | undefined;
  for (let i = found.length - 1; i >= 0; i--) {
    const r = validatePlanObject(found[i].obj);
    if (r.ok) return r;
    lastError ??= r;
  }
  return lastError ?? { ok: false, errors: ['In dem Text wurde kein gültiger Plan gefunden.'] };
}

export function validatePlanObject(o: Record<string, unknown>): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (o.format !== undefined && o.format !== PLAN_FORMAT) errors.push(`Unbekanntes Format „${String(o.format)}“ (erwartet: ${PLAN_FORMAT}).`);
  if (o.format === undefined) warnings.push('Die Angabe "format" fehlt – der Text wurde trotzdem als Plan gelesen.');
  if (o.version !== undefined && (!isNum(o.version) || o.version > PLAN_FORMAT_VERSION)) errors.push('Die Version des Planformats wird von dieser App-Version nicht unterstützt.');
  const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 80) : 'Importierter Plan';
  if (typeof o.name !== 'string' || !o.name.trim()) warnings.push('Der Plan hatte keinen Namen – er heißt jetzt „Importierter Plan“.');
  let plannedWeeks = 8;
  if (o.plannedWeeks !== undefined) {
    if (!isNum(o.plannedWeeks) || o.plannedWeeks < 1 || o.plannedWeeks > 52) errors.push('plannedWeeks muss eine Zahl zwischen 1 und 52 sein.');
    else plannedWeeks = Math.round(o.plannedWeeks);
  }
  const goal = typeof o.goal === 'string' ? o.goal.trim().slice(0, 80) : '';
  if (!Array.isArray(o.workouts) || o.workouts.length === 0) errors.push('Der Plan enthält keine Einheiten ("workouts").');
  const workouts: PlanFile['workouts'] = [];
  let defaulted = 0;
  if (Array.isArray(o.workouts)) {
    if (o.workouts.length > 14) errors.push('Mehr als 14 Einheiten sind nicht erlaubt.');
    o.workouts.slice(0, 14).forEach((w, wi) => {
      const where = `Einheit ${wi + 1}`;
      if (!isObj(w)) return void errors.push(`${where}: ist kein Objekt.`);
      const wname = typeof w.name === 'string' && w.name.trim() ? w.name.trim().slice(0, 60) : `Einheit ${wi + 1}`;
      if (!Array.isArray(w.items) || w.items.length === 0) return void errors.push(`${where} („${wname}“): keine Übungen ("items").`);
      if (w.items.length > 20) errors.push(`${where} („${wname}“): mehr als 20 Übungen.`);
      const items: PlanFile['workouts'][number]['items'] = [];
      w.items.slice(0, 20).forEach((it, ii) => {
        const at = `${where}, Übung ${ii + 1}`;
        if (!isObj(it)) return void errors.push(`${at}: ist kein Objekt.`);
        const exercise = typeof it.exercise === 'string' ? it.exercise.trim() : '';
        if (!exercise) return void errors.push(`${at}: "exercise" (Kennung oder Name) fehlt.`);
        if (it.sets === undefined || it.repMin === undefined || it.repMax === undefined || it.restSec === undefined) defaulted++;
        const sets = it.sets === undefined ? 3 : it.sets;
        if (!isNum(sets) || !Number.isInteger(sets) || sets < 1 || sets > 10) return void errors.push(`${at} („${exercise}“): "sets" muss eine ganze Zahl von 1 bis 10 sein.`);
        const repMin = it.repMin === undefined ? 8 : it.repMin;
        const repMax = it.repMax === undefined ? (isNum(repMin) ? Math.max(repMin, 12) : 12) : it.repMax;
        if (!isNum(repMin) || !isNum(repMax) || !Number.isInteger(repMin) || !Number.isInteger(repMax) || repMin < 1 || repMax > 100) return void errors.push(`${at} („${exercise}“): "repMin"/"repMax" müssen ganze Zahlen zwischen 1 und 100 sein.`);
        if (repMin > repMax) return void errors.push(`${at} („${exercise}“): repMin (${repMin}) ist größer als repMax (${repMax}).`);
        const restSec = it.restSec === undefined ? 90 : it.restSec;
        if (!isNum(restSec) || restSec < 0 || restSec > 900) return void errors.push(`${at} („${exercise}“): "restSec" muss zwischen 0 und 900 Sekunden liegen.`);
        if (it.targetWeight !== undefined && (!isNum(it.targetWeight) || it.targetWeight < 0 || it.targetWeight > 1000)) return void errors.push(`${at} („${exercise}“): "targetWeight" ist keine sinnvolle Zahl.`);
        if (it.supersetGroup !== undefined && (!isNum(it.supersetGroup) || !Number.isInteger(it.supersetGroup) || it.supersetGroup < 1 || it.supersetGroup > 9)) return void errors.push(`${at} („${exercise}“): "supersetGroup" muss eine ganze Zahl von 1 bis 9 sein.`);
        items.push({
          exercise,
          ...(typeof it.exerciseName === 'string' ? { exerciseName: it.exerciseName.slice(0, 120) } : {}),
          sets,
          repMin,
          repMax,
          restSec: Math.round(restSec),
          ...(isNum(it.targetWeight) && it.targetWeight > 0 ? { targetWeight: it.targetWeight } : {}),
          ...(isNum(it.supersetGroup) ? { supersetGroup: it.supersetGroup } : {}),
          ...(typeof it.note === 'string' && it.note.trim() ? { note: it.note.trim().slice(0, 500) } : {}),
        });
      });
      workouts.push({ name: wname, items });
    });
  }
  if (errors.length) return { ok: false, errors };
  if (defaulted > 0) warnings.push(`Bei ${defaulted} ${defaulted === 1 ? 'Übung fehlten' : 'Übungen fehlten'} Angaben (Sätze, Wiederholungen oder Pause) – es wurden Standardwerte eingesetzt (3 Sätze, 8–12 Wdh., 90 s).`);
  return {
    ok: true,
    plan: { format: PLAN_FORMAT, version: PLAN_FORMAT_VERSION, name, goal, plannedWeeks, workouts, ...(typeof o.explanation === 'string' && o.explanation.trim() ? { explanation: o.explanation.trim().slice(0, 4000) } : {}), ...(typeof o.basedOn === 'string' && o.basedOn.trim() ? { basedOn: o.basedOn.trim().slice(0, 80) } : {}) },
    warnings,
  };
}

// ------------------------------------------------------------------------------------------ Übungen zuordnen

export type MatchKind = 'id' | 'name' | 'similar' | 'new';
export interface Match {
  kind: MatchKind;
  exerciseId?: string;
  /** Bei „similar“: weitere Kandidaten, bestes zuerst. */
  candidates: { id: string; name: string; score: number }[];
}

const STOP = new Set(['an', 'am', 'der', 'die', 'das', 'mit', 'und', 'im', 'in', 'zur', 'zum', 'maschine', 'gerat', 'geraet', 'the', 'of']);
function tokens(s: string): string[] {
  return fold(s)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && !STOP.has(t));
}

/** Ähnlichkeit zweier Namen (0–1): Anteil gemeinsamer Wörter, Teilwörter zählen halb. */
export function nameSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  let hit = 0;
  for (const x of ta) {
    if (tb.includes(x)) hit += 1;
    else if (tb.some((y) => y.length >= 7 && x.length >= 7 && (y.startsWith(x.slice(0, 6)) || x.startsWith(y.slice(0, 6))))) hit += 0.5;
  }
  const score = hit / Math.max(ta.length, tb.length);
  // Alle Wörter des kürzeren Namens kommen im längeren vor („Crunch“ ↔ „Crunch (Boden)“)
  return hit >= Math.min(ta.length, tb.length) && Math.min(ta.length, tb.length) >= 1 ? Math.max(score, 0.65) : score;
}

export const SIMILAR_MIN = 0.6;

/** Kennung → genauer Name → ähnlicher Name (mit Rückfrage) → neu anlegen. */
export function matchExercise(ref: string, exercises: Exercise[]): Match {
  const byId = exercises.find((e) => e.id === ref);
  if (byId) return { kind: 'id', exerciseId: byId.id, candidates: [] };
  const f = fold(ref).trim();
  const exact = exercises.filter((e) => fold(e.name).trim() === f);
  if (exact.length) return { kind: 'name', exerciseId: exact[0].id, candidates: [] };
  const scored = exercises
    .map((e) => ({ id: e.id, name: e.name, score: nameSimilarity(ref, e.name) }))
    .filter((c) => c.score >= SIMILAR_MIN)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  // Gleiche Wörter in anderer Reihenfolge oder mit Klammern („Bankdrücken Kurzhantel“ ↔ „Bankdrücken (Kurzhantel)“) gelten als genauer Name
  if (scored.length && scored[0].score >= 0.999 && (scored.length === 1 || scored[1].score < 0.999)) return { kind: 'name', exerciseId: scored[0].id, candidates: [] };
  if (scored.length) return { kind: 'similar', exerciseId: scored[0].id, candidates: scored };
  return { kind: 'new', candidates: [] };
}

/** Gleiche Referenzen werden gleich zugeordnet (damit „neu anlegen“ nur eine Übung erzeugt). */
export function matchAll(plan: PlanFile, exercises: Exercise[]): Map<string, Match> {
  const out = new Map<string, Match>();
  for (const w of plan.workouts) for (const it of w.items) if (!out.has(it.exercise)) out.set(it.exercise, matchExercise(it.exercise, exercises));
  // Eine Referenz, die weder Kennung noch Name trifft, aber einen mitgelieferten Namen hat, wird über diesen Namen versucht
  for (const w of plan.workouts)
    for (const it of w.items) {
      const m = out.get(it.exercise)!;
      if ((m.kind === 'new' || m.kind === 'similar') && it.exerciseName) {
        const alt = matchExercise(it.exerciseName, exercises);
        if (alt.kind === 'id' || alt.kind === 'name') out.set(it.exercise, alt);
        else if (m.kind === 'new' && alt.kind === 'similar') out.set(it.exercise, alt);
      }
    }
  return out;
}

/** Plan aus der Datei; `resolve` liefert zu jeder Referenz die endgültige Übungskennung. */
export function filePlanToPlan(file: PlanFile, resolve: (ref: string) => string, newId: () => string, now: number): Plan {
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    name: file.name,
    goal: file.goal,
    plannedWeeks: file.plannedWeeks,
    status: 'entwurf',
    origin: 'ki_import',
    workouts: file.workouts.map((w) => ({
      id: newId(),
      name: w.name,
      items: w.items.map(
        (i): PlanItem => ({
          id: newId(),
          exerciseId: resolve(i.exercise),
          sets: i.sets,
          repMin: i.repMin,
          repMax: i.repMax,
          restSec: i.restSec,
          ...(i.targetWeight ? { targetWeight: i.targetWeight } : {}),
          ...(i.supersetGroup ? { supersetGroup: i.supersetGroup } : {}),
          ...(i.note ? { note: i.note } : {}),
        }),
      ),
    })),
  };
}

// ------------------------------------------------------------------------------------------ KI-Export (Text)

export interface AiExportInput {
  now: number;
  settings: Pick<Settings, 'profile' | 'planWeeksDefault'> & { studio?: Settings['studio'] };
  wishes: string;
  weeks: number;
  includeGeneral: boolean;
  exercises: Exercise[];
  equipment: Map<string, Equipment>;
  plans: Plan[];
  sessions: Session[];
}

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

export const PLAN_FORMAT_EXAMPLE = `{
  "format": "eisenzeit-plan",
  "version": 1,
  "name": "Muskelaufbau – Oberkörper/Unterkörper",
  "goal": "Muskelaufbau",
  "plannedWeeks": 8,
  "workouts": [
    {
      "name": "Oberkörper A",
      "items": [
        { "exercise": "ex-brustpresse-maschine", "sets": 3, "repMin": 8, "repMax": 12, "restSec": 90, "targetWeight": 40, "note": "Langsam absenken" }
      ]
    }
  ],
  "explanation": "Kurze Begründung der Auswahl und Aufteilung."
}`;

/** Übungen, die der KI zur Auswahl angeboten werden: Studio-Geräte, eigene Übungen, Körpergewichtsübungen – optional alle. */
export function offeredExercises(exercises: Exercise[], equipment: Map<string, Equipment>, includeGeneral: boolean): Exercise[] {
  return exercises
    .filter((e) => {
      if (e.hidden) return false;
      const eq = e.equipmentId ? equipment.get(e.equipmentId) : undefined;
      if (eq?.hidden) return false;
      if (includeGeneral) return true;
      return !eq || eq.inStudio || eq.kind === 'koerpergewicht';
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Verlaufszusammenfassung als Text: Häufigkeit, Sätze je Muskelgruppe und je Übung Start-/Endwerte mit Stagnation. */
export function historySummary(input: Pick<AiExportInput, 'now' | 'exercises' | 'equipment' | 'sessions'>): string[] {
  const done = finishedSessions(input.sessions);
  if (!done.length) return ['Noch keine abgeschlossenen Trainings.'];
  const exMap = new Map(input.exercises.map((e) => [e.id, e]));
  const lines: string[] = [];
  const weeks = weeklyStats(done, 8, input.now);
  lines.push(`Trainingshäufigkeit: ${fmt(averagePerWeek(weeks))} Einheiten pro Woche im Schnitt (insgesamt ${done.length} Einheiten, erste am ${new Date(done[0].startedAt).toLocaleDateString('de-DE')}).`);
  const load = muscleLoad(done, exMap, 4, input.now).slice(0, 12);
  if (load.length) lines.push(`Sätze je Muskel und Woche (letzte 4 Wochen): ${load.map((l) => `${MUSCLE_LABEL[l.muscle]} ${fmt(l.perWeek)}`).join(', ')}.`);
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const s of done) for (const e of s.entries) seen.add(e.exerciseId);
  for (const id of seen) {
    const ex = exMap.get(id);
    if (!ex || ex.tracking === 'cardio' || ex.tracking === 'zeit') continue; // Dauer/Strecke lassen sich nicht als „Stagnation“ lesen
    const eq = ex.equipmentId ? input.equipment.get(ex.equipmentId) : undefined;
    const unit = weightUnit(eq);
    const pts = exerciseSeries(done, id, unit);
    if (!pts.length) continue;
    const a = pts[0];
    const b = pts[pts.length - 1];
    const val = (p: typeof a) => (unit === 'platte' ? `Platte ${fmt(p.maxWeight)}` : p.best1rm ? `${fmt(p.best1rm)} kg (geschätzte Maximalkraft)` : `${p.reps} Wdh. insgesamt`);
    const stalled = pts.length > 3 && isStalled(done, id, unit, undefined, 3);
    rows.push(`- ${id} „${ex.name}“: ${pts.length}× trainiert, ${val(a)} → ${val(b)}${stalled ? ' – STAGNIERT seit mindestens 3 Einheiten' : ''}`);
  }
  if (rows.length) lines.push('Übungen im Verlauf:', ...rows.slice(0, 40));
  return lines;
}

/** Der komplette Text für die KI („Mit KI planen“). */
/** Abschnitte „Profil“ bis „Verlauf“ für KI-Aufträge (Text und Markdown-Datei). `basePlan` ersetzt den aktiven Plan (Anpassen, Auswertung). */
export function aiContext(input: AiExportInput, basePlan?: Plan): { lines: string[]; offered: Exercise[] } {
  const { settings, wishes, weeks, plans, exercises, equipment } = input;
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const active = basePlan ?? plans.find((p) => p.status === 'aktiv') ?? [...plans].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const offered = offeredExercises(exercises, equipment, input.includeGeneral);
  const out: string[] = [];
  out.push('', '# Profil');
  out.push(`- Ziel: ${GOAL_LABEL[settings.profile.goal]}`);
  out.push(`- Erfahrung: ${EXPERIENCE_LABEL[settings.profile.experience]}`);
  out.push(`- Trainingstage pro Woche: ${settings.profile.daysPerWeek}`);
  if (settings.studio?.name) out.push(`- Trainiert im ${settings.studio.name}${settings.studio.city ? ` ${settings.studio.city}` : ''}`);
  out.push(`- Laufzeit des neuen Plans: ${weeks} Wochen`);
  if (wishes.trim()) out.push(`- Wünsche und Einschränkungen: ${wishes.trim().replace(/\s+/g, ' ')}`);
  out.push('', `# Verfügbare Übungen (${offered.length}) – Format: Kennung | Name | Hauptmuskeln | Gerät`);
  for (const e of offered) {
    const eq = e.equipmentId ? equipment.get(e.equipmentId) : undefined;
    out.push(`${e.id} | ${e.name} | ${e.primaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ') || '–'} | ${eq ? eq.name : 'ohne Gerät'}${e.tracking === 'cardio' ? ' | Ausdauer' : e.tracking === 'zeit' ? ' | Zeit' : ''}${weightUnit(eq) === 'platte' ? ' | Plattennummer (Zahl auf der Platte, keine kg)' : ''}`);
  }
  out.push('', '# Bisheriger Plan');
  if (active) {
    out.push(`„${active.name}“ (${active.plannedWeeks} Wochen, Ziel: ${active.goal || '–'})`);
    for (const w of active.workouts) {
      out.push(`${w.name}:`);
      for (const i of w.items) {
        const platte = weightUnit(exMap.get(i.exerciseId)?.equipmentId ? equipment.get(exMap.get(i.exerciseId)!.equipmentId!) : undefined) === 'platte';
        out.push(`- ${i.exerciseId} „${exMap.get(i.exerciseId)?.name ?? '?'}“: ${i.sets} × ${i.repMin === i.repMax ? i.repMin : `${i.repMin}–${i.repMax}`}, Pause ${i.restSec} s${i.targetWeight ? `, Ziel ${platte ? 'Platte ' + fmt(i.targetWeight) : fmt(i.targetWeight) + ' kg'}` : ''}`);
      }
    }
  } else out.push('Es gibt noch keinen Plan.');
  out.push('', '# Verlauf', ...historySummary(input));
  return { lines: out, offered };
}

export function buildAiExportText(input: AiExportInput): string {
  const { lines, offered } = aiContext(input);
  const out: string[] = [];
  out.push('# Aufgabe');
  out.push(
    'Du bist ein erfahrener Krafttrainer. Erstelle mir einen neuen Trainingsplan für meine Gym-App „Eisenzeit“. Verwende ausschließlich Übungen aus der Liste unten und gib die Kennung (z. B. "ex-brustpresse-maschine") im Feld "exercise" an. Berücksichtige Ziel, Erfahrung, Trainingstage, bisherigen Plan und Verlauf. Ersetze stagnierende Übungen durch Varianten derselben Muskelgruppe, behalte gut laufende Grundübungen und wechsle einen Teil der Nebenübungen. Gib als Antwort NUR den JSON-Block im Format unten aus (in einem ```json-Block), danach nichts weiter – die Begründung gehört in das Feld "explanation".',
  );
  out.push(...lines);
  out.push('', '# Antwortformat (JSON, Version 1)');
  out.push('Regeln: "exercise" ist die Kennung aus der Liste; "sets" 1–10; "repMin"/"repMax" ganze Zahlen (repMin ≤ repMax); "restSec" in Sekunden; "targetWeight" in kg ist optional (nur wenn aus dem Verlauf sinnvoll ableitbar); Cardio-Übungen mit sets 1, repMin 1, repMax 1. Einheiten in Trainingsreihenfolge, höchstens 14 Einheiten mit je höchstens 20 Übungen.');
  out.push('```json', offered[0] ? PLAN_FORMAT_EXAMPLE.replace('ex-brustpresse-maschine', offered.find((e) => e.tracking === 'gewicht_wdh')?.id ?? offered[0].id) : PLAN_FORMAT_EXAMPLE, '```');
  return out.join('\n');
}
