import type { AiEvaluation, Plan } from '../data/types';
import { PLAN_FORMAT, PLAN_FORMAT_EXAMPLE, aiContext, jsonCandidates, validatePlanObject, type AiExportInput, type PlanFile } from './planio';

/**
 * KI-Austausch per Markdown-Datei: Die App schreibt einen Auftrag, den jede KI ohne Vorwissen verstehen kann, und liest die
 * Antwort wieder ein. Auftrag und Antwortprüfung kennen keine Quelle – ein Chat in einer KI-App, eine Datei oder später
 * eine lokale KI können dieselben Aufträge beantworten.
 */
export type OrderKind = 'neu' | 'anpassen' | 'auswertung';

export const ORDER_LABEL: Record<OrderKind, string> = {
  neu: 'Neuer Plan',
  anpassen: 'Plan anpassen',
  auswertung: 'Auswertung am Planende',
};
const ORDER_SLUG: Record<OrderKind, string> = { neu: 'neuer-plan', anpassen: 'plan-anpassen', auswertung: 'auswertung' };

export const EVAL_FORMAT = 'eisenzeit-auswertung';
export const EVAL_FORMAT_VERSION = 1;

export type { AiEvaluation };

export interface EvaluationFile {
  format: typeof EVAL_FORMAT;
  version: number;
  planName?: string;
  summary: string;
  wentWell: string[];
  stalled: string[];
  recommendations: string[];
  nextPlanNotes: string[];
  nextPlan?: PlanFile;
}

export const EVAL_FORMAT_EXAMPLE = `{
  "format": "eisenzeit-auswertung",
  "version": 1,
  "planName": "Muskelaufbau – Oberkörper/Unterkörper",
  "summary": "Zwei bis drei Sätze Kurzfazit.",
  "wentWell": ["Brustpresse: Gewicht in 8 Wochen von 40 auf 52,5 kg"],
  "stalled": ["Seitheben: seit vier Einheiten keine Steigerung"],
  "recommendations": ["Seitheben mit höherer Wiederholungszahl (12–15) trainieren"],
  "nextPlanNotes": ["Im nächsten Plan mehr Rückenvolumen vorsehen"]
}`;

export function orderFileName(kind: OrderKind, at = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `eisenzeit-auftrag-${ORDER_SLUG[kind]}-${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}.md`;
}

// ------------------------------------------------------------------------------------------ Auftrag schreiben

const RULES_COMMON = [
  'Du darfst **vor deiner endgültigen Antwort bis zu drei kurze, nummerierte Rückfragen** stellen – aber nur, wenn etwas Wesentliches fehlt. Frage nicht nach Dingen, die im Kontext unten stehen.',
  'Deine **endgültige Antwort enthält genau einen JSON-Block** in dreifachen Backticks (```json … ```), und zwar im Format unter „Antwortformat“. Davor und danach darf ein kurzer Erklärtext stehen, aber kein weiterer JSON-Block.',
  'Das JSON muss gültig sein: Anführungszeichen " statt „ “, kein Komma nach dem letzten Eintrag, keine Kommentare.',
  'Schreibe auf Deutsch. Gewichte stehen in Kilogramm; bei Geräten mit Plattennummern (steht beim Gerät) ist „targetWeight“ eine Plattennummer.',
];

const TASK: Record<OrderKind, string> = {
  neu: 'Erstelle für mich einen **neuen Trainingsplan**. Berücksichtige Ziel, Erfahrung, Trainingstage, das Studio, den bisherigen Plan und meinen Verlauf. Ersetze stagnierende Übungen durch Varianten derselben Muskelgruppe, behalte gut laufende Grundübungen und wechsle einen Teil der Nebenübungen.',
  anpassen: 'Überarbeite den **bestehenden Plan** unten nach meinen Wünschen. Ändere nur, was die Wünsche und der Verlauf nahelegen, und lass den Rest unverändert. Gib den **vollständigen** überarbeiteten Plan zurück (nicht nur die Änderungen) und nenne im Feld "basedOn" den Namen des Ausgangsplans; die Begründung der Änderungen gehört in "explanation".',
  auswertung: 'Werte den **abgelaufenen Plan** unten anhand meines Verlaufs aus: ein Kurzfazit, was gut lief, was stagniert, konkrete Empfehlungen und Hinweise für den nächsten Plan. Optional kannst du im Feld "nextPlan" einen Vorschlag für den nächsten Plan im Planformat (siehe Beispiel) mitliefern.',
};

function planFormatBlock(offeredFirstId: string): string[] {
  return [
    'Regeln für das Planformat: "exercise" ist die **Kennung** aus der Liste „Verfügbare Übungen“; "sets" 1–10; "repMin"/"repMax" ganze Zahlen (repMin ≤ repMax); "restSec" in Sekunden; "targetWeight" ist optional (nur wenn aus dem Verlauf sinnvoll ableitbar); Cardio-Übungen mit sets 1, repMin 1, repMax 1. Einheiten in Trainingsreihenfolge, höchstens 14 Einheiten mit je höchstens 20 Übungen.',
    '',
    '```json',
    PLAN_FORMAT_EXAMPLE.replace('ex-brustpresse-maschine', offeredFirstId),
    '```',
  ];
}

/** Der Auftrag als Markdown – vollständig für eine KI ohne Vorwissen. */
export function buildOrderMarkdown(kind: OrderKind, input: AiExportInput, basePlan?: Plan): string {
  const { lines, offered } = aiContext(input, kind === 'neu' ? undefined : basePlan);
  const firstId = offered.find((e) => e.tracking === 'gewicht_wdh')?.id ?? offered[0]?.id ?? 'ex-brustpresse-maschine';
  const date = new Date(input.now).toLocaleDateString('de-DE');
  const out: string[] = [];
  out.push(`# Eisenzeit – KI-Auftrag: ${ORDER_LABEL[kind]}`);
  out.push('');
  out.push(`*Erstellt am ${date} von der Trainings-App „Eisenzeit“. Dieser Auftrag ist für eine KI gedacht (Claude, ChatGPT oder ähnlich) und enthält alles, was du wissen musst.*`);
  out.push('');
  out.push('## Deine Rolle und Aufgabe');
  out.push('');
  out.push('Du bist ein erfahrener Krafttrainer. Der Nutzer trainiert mit der App „Eisenzeit“ und lässt dich seinen Plan erstellen oder auswerten. Deine Antwort wird von der App **automatisch eingelesen** – halte dich deshalb genau an das Antwortformat.');
  out.push('');
  out.push(TASK[kind]);
  out.push('');
  out.push('## Regeln');
  out.push('');
  RULES_COMMON.forEach((r, i) => out.push(`${i + 1}. ${r}`));
  if (kind !== 'auswertung') out.push(`${RULES_COMMON.length + 1}. Verwende **ausschließlich Übungen aus der Liste „Verfügbare Übungen“** und gib deren Kennung an.`);
  out.push('');
  out.push('## Antwortformat');
  out.push('');
  if (kind === 'auswertung') {
    out.push('Format `eisenzeit-auswertung`, Version 1. Alle Listen sind Listen kurzer Sätze (höchstens 12 Einträge, je höchstens 400 Zeichen).');
    out.push('');
    out.push('```json');
    out.push(EVAL_FORMAT_EXAMPLE);
    out.push('```');
    out.push('');
    out.push('Optional kannst du ein weiteres Feld `"nextPlan"` ergänzen, das einen vollständigen Plan im Format `eisenzeit-plan` enthält:');
    out.push('');
    out.push(...planFormatBlock(firstId));
  } else {
    out.push(`Format \`${PLAN_FORMAT}\`, Version 1.${kind === 'anpassen' ? ' Zusätzlich das Feld `"basedOn"` mit dem Namen des Ausgangsplans.' : ''}`);
    out.push('');
    out.push(...planFormatBlock(firstId));
  }
  out.push('');
  out.push('## Kontext');
  out.push('');
  for (const l of lines) out.push(l.startsWith('# ') ? `#${l}` : l); // „# Profil“ → „## Profil“
  out.push('');
  out.push('---');
  out.push('*Ende des Auftrags. Antworte jetzt – mit Rückfragen (höchstens drei) oder mit der endgültigen Antwort samt JSON-Block.*');
  return out.join('\n');
}

// ------------------------------------------------------------------------------------------ Antwort einlesen

export type AiAnswer =
  | { ok: true; kind: 'plan'; plan: PlanFile; warnings: string[] }
  | { ok: true; kind: 'auswertung'; evaluation: EvaluationFile; warnings: string[] }
  | { ok: false; errors: string[]; kind?: 'plan' | 'auswertung' };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Die Beispiele aus dem Auftrag selbst sind keine Antwort (sie kommen mit, wenn der ganze Auftrag eingefügt wird). */
const isExample = (o: Record<string, unknown>) => o.explanation === 'Kurze Begründung der Auswahl und Aufteilung.' || o.summary === 'Zwei bis drei Sätze Kurzfazit.';

function stringList(v: unknown, label: string, errors: string[]): string[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) {
    errors.push(`"${label}" muss eine Liste sein.`);
    return [];
  }
  if (v.length > 12) errors.push(`"${label}" hat mehr als 12 Einträge.`);
  const out: string[] = [];
  v.slice(0, 12).forEach((x, i) => {
    if (typeof x !== 'string' || !x.trim()) errors.push(`"${label}", Eintrag ${i + 1}: ist kein Text.`);
    else out.push(x.trim().slice(0, 400));
  });
  return out;
}

export function validateEvaluationObject(o: Record<string, unknown>): { ok: true; evaluation: EvaluationFile; warnings: string[] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (o.format !== EVAL_FORMAT) errors.push(`Unbekanntes Format „${String(o.format)}“ (erwartet: ${EVAL_FORMAT}).`);
  if (o.version !== undefined && (typeof o.version !== 'number' || o.version > EVAL_FORMAT_VERSION)) errors.push('Die Version des Auswertungsformats wird von dieser App-Version nicht unterstützt.');
  const summary = typeof o.summary === 'string' ? o.summary.trim().slice(0, 2000) : '';
  if (typeof o.summary !== 'string') errors.push(o.summary === undefined ? '"summary" (Kurzfazit) fehlt.' : '"summary" muss ein Text sein.');
  else if (!summary) errors.push('"summary" (Kurzfazit) ist leer.');
  const wentWell = stringList(o.wentWell, 'wentWell', errors);
  const stalled = stringList(o.stalled, 'stalled', errors);
  const recommendations = stringList(o.recommendations, 'recommendations', errors);
  const nextPlanNotes = stringList(o.nextPlanNotes, 'nextPlanNotes', errors);
  let nextPlan: PlanFile | undefined;
  if (o.nextPlan !== undefined) {
    if (!isObj(o.nextPlan)) errors.push('"nextPlan" muss ein Plan im Format eisenzeit-plan sein.');
    else {
      const r = validatePlanObject({ format: PLAN_FORMAT, ...o.nextPlan });
      if (r.ok) {
        nextPlan = r.plan;
        warnings.push(...r.warnings.map((w) => `Planvorschlag: ${w}`));
      } else errors.push(...r.errors.map((e) => `Planvorschlag: ${e}`));
    }
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    evaluation: {
      format: EVAL_FORMAT,
      version: EVAL_FORMAT_VERSION,
      ...(typeof o.planName === 'string' && o.planName.trim() ? { planName: o.planName.trim().slice(0, 80) } : {}),
      summary,
      wentWell,
      stalled,
      recommendations,
      nextPlanNotes,
      ...(nextPlan ? { nextPlan } : {}),
    },
    warnings,
  };
}

/** Findet in beliebigem Text (auch einem ganzen Chat) den letzten gültigen Plan bzw. die letzte gültige Auswertung. */
export function parseAiAnswer(text: string): AiAnswer {
  if (!text.trim()) return { ok: false, errors: ['Es wurde nichts eingefügt.'] };
  if (text.length > 300_000) return { ok: false, errors: ['Der Text ist zu lang (mehr als 300.000 Zeichen). Füge nur die Antwort der KI ein.'] };
  const found: Record<string, unknown>[] = [];
  let parseError = false;
  for (const c of jsonCandidates(text)) {
    try {
      const v = JSON.parse(c);
      if (isObj(v) && (v.format === PLAN_FORMAT || v.format === EVAL_FORMAT || Array.isArray(v.workouts) || v.summary !== undefined)) found.push(v);
    } catch {
      parseError = true;
    }
  }
  const real = found.filter((o) => !isExample(o));
  if (found.length > 0 && real.length === 0) {
    return { ok: false, errors: ['Das ist nur das Beispiel aus dem Auftrag, keine Antwort der KI. Füge die Antwort der KI ein (den Block, den sie geschrieben hat).'] };
  }
  found.length = 0;
  found.push(...real);
  if (!found.length) {
    return {
      ok: false,
      errors: [
        parseError
          ? 'Der JSON-Block ist fehlerhaft (zum Beispiel ein Komma zu viel oder eine fehlende Klammer).'
          : `In dem Text wurde kein Block gefunden. Die Antwort muss einen JSON-Block mit "format": "${PLAN_FORMAT}" oder "${EVAL_FORMAT}" enthalten.`,
      ],
    };
  }
  let lastErrors: string[] | undefined;
  let lastKind: 'plan' | 'auswertung' | undefined;
  for (let i = found.length - 1; i >= 0; i--) {
    const o = found[i];
    if (o.format === EVAL_FORMAT || (o.format === undefined && o.summary !== undefined && !Array.isArray(o.workouts))) {
      const r = validateEvaluationObject({ ...o, format: EVAL_FORMAT });
      if (r.ok) return { ok: true, kind: 'auswertung', evaluation: r.evaluation, warnings: r.warnings };
      if (!lastErrors) {
        lastErrors = r.errors;
        lastKind = 'auswertung';
      }
    } else {
      const r = validatePlanObject(o);
      if (r.ok) return { ok: true, kind: 'plan', plan: r.plan, warnings: r.warnings };
      if (!lastErrors) {
        lastErrors = r.errors;
        lastKind = 'plan';
      }
    }
  }
  return { ok: false, errors: lastErrors ?? ['In dem Text wurde keine gültige Antwort gefunden.'], kind: lastKind };
}

/** Kurzer Text, den man der KI zurückgeben kann, wenn ihre Antwort nicht übernommen werden konnte. */
export function correctionText(errors: string[], kind: OrderKind | 'plan' | 'auswertung' = 'plan'): string {
  const example = kind === 'auswertung' ? EVAL_FORMAT_EXAMPLE : PLAN_FORMAT_EXAMPLE;
  return [
    'Deine Antwort konnte von der App „Eisenzeit“ nicht übernommen werden:',
    ...errors.map((e) => `- ${e}`),
    '',
    'Bitte antworte noch einmal mit der vollständigen, korrigierten Antwort: genau ein gültiger JSON-Block in dreifachen Backticks (```json), im gleichen Format wie zuvor. Zum Format (Beispiel):',
    '',
    '```json',
    example,
    '```',
  ].join('\n');
}

/** Übernimmt die gespeicherte Form einer Auswertung. */
export function toStoredEvaluation(e: EvaluationFile, at: number): AiEvaluation {
  return { at, summary: e.summary, wentWell: e.wentWell, stalled: e.stalled, recommendations: e.recommendations, nextPlanNotes: e.nextPlanNotes };
}

// ------------------------------------------------------------------------------------------ Unterschiede zum Ausgangsplan

const range = (a: number, b: number) => (a === b ? String(a) : `${a}–${b}`);

/**
 * Unterschiede zwischen einem bestehenden Plan und einem importierten Vorschlag (für „Plan anpassen“).
 * `resolve` liefert die Übungskennung zu einer Referenz der Datei (oder null, wenn sie neu angelegt würde).
 */
export function diffPlanFile(old: Pick<Plan, 'workouts'>, file: PlanFile, resolve: (ref: string) => string | null, nameOf: (id: string) => string): string[] {
  const lines: string[] = [];
  const norm = (s: string) => s.trim().toLowerCase();
  // 1. Durchgang: Einheiten mit gleichem Namen; 2. Durchgang: übrige nach Position (nur, wenn dort nichts Namensgleiches wartet)
  const match = new Map<number, (typeof old.workouts)[number]>();
  const taken = new Set<number>();
  file.workouts.forEach((w, wi) => {
    const oi = old.workouts.findIndex((o, k) => !taken.has(k) && norm(o.name) === norm(w.name));
    if (oi >= 0) {
      match.set(wi, old.workouts[oi]);
      taken.add(oi);
    }
  });
  file.workouts.forEach((_w, wi) => {
    if (match.has(wi)) return;
    const o = old.workouts[wi];
    const sameNameLater = o && file.workouts.some((x) => norm(x.name) === norm(o.name));
    if (o && !taken.has(wi) && !sameNameLater) {
      match.set(wi, o);
      taken.add(wi);
    }
  });
  file.workouts.forEach((w, wi) => {
    const o = match.get(wi);
    if (!o) {
      lines.push(`Neue Einheit „${w.name}“ (${w.items.length} Übungen)`);
      return;
    }
    const oldItems = new Map<string, (typeof o.items)[number]>();
    for (const i of o.items) if (!oldItems.has(i.exerciseId)) oldItems.set(i.exerciseId, i);
    const parts: string[] = [];
    const seen = new Set<string>();
    for (const it of w.items) {
      const id = resolve(it.exercise);
      const label = id ? nameOf(id) : it.exerciseName || it.exercise;
      const prev = id ? oldItems.get(id) : undefined;
      if (id) seen.add(id);
      if (!prev) parts.push(`neu: ${label}`);
      else if (prev.sets !== it.sets || prev.repMin !== it.repMin || prev.repMax !== it.repMax) parts.push(`geändert: ${label} (${prev.sets} × ${range(prev.repMin, prev.repMax)} → ${it.sets} × ${range(it.repMin, it.repMax)})`);
      else if (prev.restSec !== it.restSec) parts.push(`Pause geändert: ${label} (${prev.restSec} s → ${it.restSec} s)`);
      else if ((prev.targetWeight ?? 0) !== (it.targetWeight ?? 0)) parts.push(`Zielgewicht geändert: ${label}`);
    }
    for (const [id] of oldItems) if (!seen.has(id)) parts.push(`entfernt: ${nameOf(id)}`);
    lines.push(parts.length ? `„${w.name}“ – ${parts.join(' · ')}` : `„${w.name}“ – unverändert`);
  });
  old.workouts.forEach((o, k) => {
    if (!taken.has(k)) lines.push(`Einheit „${o.name}“ entfällt`);
  });
  return lines;
}
