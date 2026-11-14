import { MUSCLE_GROUPS, type MuscleGroupId } from '../data/muscles';
import { GOAL_LABEL, type Equipment, type Exercise, type Goal, type PlanItem, type Plan, type Session } from '../data/types';
import { isUnconfirmed } from './catalog';
import { exerciseSeries, finishedSessions, isStalled } from './progress';
import { snapToStack, stepFor, weightUnit } from './progression';

/**
 * Regelbasierter Plan-Assistent (ohne Internet): wählt je Einheit passende Übungen aus den Geräten des Studios.
 * Jede Einheit besteht aus Rollen („Drücken waagerecht“, „Kniedominant“ …); je Rolle gibt es eine Rangliste von Übungen.
 */

export type RoleType = 'compound' | 'isolation' | 'core';

export interface Role {
  id: string;
  label: string;
  type: RoleType;
  group: MuscleGroupId;
  /** Übungskennungen in Reihenfolge der Vorliebe (Studio-Geräte vor allgemeinen Übungen). */
  candidates: string[];
}

const R = (id: string, label: string, type: RoleType, group: MuscleGroupId, candidates: string[]): Role => ({ id, label, type, group, candidates: candidates.map((c) => `ex-${c}`) });

export const ROLES: Record<string, Role> = Object.fromEntries(
  [
    R('push_h', 'Drücken waagerecht (Grundübung)', 'compound', 'brust', ['brustpresse-maschine', 'panatta-power-smith', 'gym80-multipresse', 'multipresse-silber', 'mp-brustdruecken', 'bankdruecken-kurzhantel', 'bankdruecken-langhantel', 'schraegbankdruecken-kurzhantel', 'liegestuetze']),
    R('push_v', 'Drücken über Kopf', 'compound', 'schultern', ['schulterpresse-maschine', 'mp-schulterdruecken', 'schulterdruecken-kurzhantel', 'schulterdruecken-langhantel']),
    R('brust_iso', 'Brust – Isolation', 'isolation', 'brust', ['pec-dec-fly', 'butterfly-maschine', 'mp-cross-over', 'cross-over-kabel', 'fliegende-kurzhantel']),
    R('schulter_seitlich', 'Seitliche Schulter', 'isolation', 'schultern', ['seitheben-maschine', 'mp-seitheben', 'seitheben-kabel', 'seitheben-kurzhantel']),
    R('schulter_hinten', 'Hintere Schulter', 'isolation', 'schultern', ['reverse-butterfly-maschine', 'mp-reverse-fly', 'mp-face-pull', 'face-pull-kabel']),
    R('pull_v', 'Ziehen senkrecht (Grundübung)', 'compound', 'ruecken', ['gym80-latzug', 'granite-latzug', 'latzug-breit', 'latzug-eng', 'klimmzug-hilfe', 'klimmzug']),
    R('pull_h', 'Ziehen waagerecht (Grundübung)', 'compound', 'ruecken', ['prime-seated-row', 'cybex-eagle-rudern', 'newtech-2way-row', 'purekraft-tbar', 'panatta-super-low-row', 'prime-brustrudern', 'mp-rudern-vorgebeugt', 'rudern-maschine-sitzend', 'kabelrudern-sitzend']),
    R('lat_iso', 'Latissimus – Isolation (Überzug)', 'isolation', 'ruecken', ['panatta-super-pullover', 'mp-ueberzug', 'ueberzug-kabel']),
    R('rueck', 'Unterer Rücken', 'isolation', 'ruecken', ['gym80-unterer-ruecken', 'rueckenstrecker-maschine', 'hyperextension']),
    R('bizeps', 'Bizeps', 'isolation', 'arme', ['schnell-scott-curl', 'gymleco-biceps-curl', 'mp-bizepscurl-beidarmig', 'curl-kabel', 'curl-kurzhantel', 'curl-sz']),
    R('trizeps', 'Trizeps', 'isolation', 'arme', ['mp-trizepsdruecken', 'mp-trizeps-ueberkopf', 'trizepsdruecken-kabel', 'dips', 'trizeps-ueberkopf']),
    R('knee', 'Kniedominant (Grundübung)', 'compound', 'beine', ['cybex-beinpresse', 'purekraft-beinpresse', 'panatta-pendulum-squat', 'gym80-belt-squat', 'beinpresse', 'kniebeuge-multipresse', 'goblet-squat', 'kniebeuge-langhantel']),
    R('ham', 'Beinbeuger / Hüftdominant', 'compound', 'beine', ['paramount-leg-curl', 'gym80-beinbeuger-stehend', 'beinbeuger-sitzend', 'beinbeuger-liegend', 'rumaenisches-kreuzheben']),
    R('quad_iso', 'Quadrizeps – Isolation', 'isolation', 'beine', ['gym80-beinstrecker', 'newtech-leg-extension', 'beinstrecker-maschine']),
    R('glutes', 'Gesäß', 'isolation', 'beine', ['glutebuilder-hip-thrust', 'pendulum-hip-press', 'purekraft-hip-press', 'gym80-kickmaschine', 'hip-thrust', 'gymleco-abduktoren', 'abduktoren-scheiben', 'abduktoren-maschine']),
    R('waden', 'Waden', 'isolation', 'beine', ['gym80-waden', 'panatta-donkey-calf', 'waden-stehend', 'waden-sitzend']),
    R('core', 'Rumpf', 'core', 'rumpf', ['cybex-eagle-bauch', 'gym80-bauch', 'bauchmaschine', 'kabel-crunch', 'plank', 'crunch-boden']),
    R('cardio', 'Ausdauer (Abschluss)', 'core', 'rumpf', ['laufband', 'crosstrainer', 'ergometer', 'stepper', 'rudergeraet']),
  ].map((r) => [r.id, r]),
);

interface Template {
  name: string;
  roles: string[];
  /** Zweite Auflage derselben Einheit: bevorzugt andere Übungen als bisher im Plan. */
  variant?: boolean;
  why: string;
}

const GK_WHY = 'Ganzkörper: jede Muskelgruppe wird bei 2–3 Tagen pro Woche mehrmals pro Woche angesprochen.';
const OU_WHY = 'Oberkörper/Unterkörper: bei 4 Tagen trifft jede Muskelgruppe zweimal pro Woche mit genug Erholung dazwischen.';
const PPL_WHY = 'Push/Pull/Beine: bei 5–6 Tagen bleibt pro Einheit Zeit für mehr Übungen je Muskelgruppe.';

export function templatesFor(days: number): Template[] {
  if (days <= 3) {
    const a: Template = { name: 'Ganzkörper A', roles: ['push_h', 'pull_v', 'knee', 'schulter_seitlich', 'bizeps', 'core', 'waden'], why: GK_WHY };
    const b: Template = { name: 'Ganzkörper B', roles: ['pull_h', 'push_v', 'ham', 'glutes', 'trizeps', 'rueck', 'core'], why: GK_WHY };
    const c: Template = { name: 'Ganzkörper C', roles: ['knee', 'push_h', 'pull_h', 'schulter_hinten', 'trizeps', 'bizeps', 'waden'], variant: true, why: GK_WHY };
    return days === 2 ? [a, b] : [a, b, c];
  }
  const oberA: Template = { name: 'Oberkörper A', roles: ['push_h', 'pull_v', 'push_v', 'pull_h', 'bizeps', 'trizeps', 'schulter_seitlich'], why: OU_WHY };
  const unterA: Template = { name: 'Unterkörper A', roles: ['knee', 'ham', 'glutes', 'waden', 'core', 'quad_iso', 'rueck'], why: OU_WHY };
  const oberB: Template = { name: 'Oberkörper B', roles: ['pull_h', 'push_v', 'push_h', 'pull_v', 'schulter_hinten', 'brust_iso', 'lat_iso'], variant: true, why: OU_WHY };
  const unterB: Template = { name: 'Unterkörper B', roles: ['ham', 'knee', 'quad_iso', 'glutes', 'waden', 'core', 'rueck'], variant: true, why: OU_WHY };
  if (days === 4) return [oberA, unterA, oberB, unterB];
  const push: Template = { name: 'Push', roles: ['push_h', 'push_v', 'brust_iso', 'schulter_seitlich', 'trizeps', 'core'], why: PPL_WHY };
  const pull: Template = { name: 'Pull', roles: ['pull_v', 'pull_h', 'lat_iso', 'schulter_hinten', 'bizeps', 'rueck'], why: PPL_WHY };
  const legs: Template = { name: 'Beine', roles: ['knee', 'ham', 'glutes', 'quad_iso', 'waden', 'core'], why: PPL_WHY };
  if (days === 5) return [push, pull, legs, { ...oberB, name: 'Oberkörper' }, { ...unterB, name: 'Unterkörper' }];
  return [push, pull, legs, { ...push, name: 'Push B', variant: true }, { ...pull, name: 'Pull B', variant: true }, { ...legs, name: 'Beine B', variant: true }];
}

// ------------------------------------------------------------------------------------------ Eingabe/Ausgabe

export interface AssistantInput {
  goal: Goal;
  days: number;
  minutes: number;
  weeks: number;
  focus: MuscleGroupId[];
  excludedExerciseIds: string[];
  /** Auch Übungen verwenden, deren Gerät nicht als „mein Studio“ markiert ist (z. B. Kurzhanteln, Langhantel). */
  allowGeneral: boolean;
  exercises: Exercise[];
  equipment: Map<string, Equipment>;
  sessions: Session[];
  plans: Plan[];
  now?: number;
}

export type AssistantItem = PlanItem & { roleLabel: string; why: string };
export interface AssistantWorkout {
  name: string;
  why: string;
  items: AssistantItem[];
}
export interface AssistantResult {
  name: string;
  goal: string;
  plannedWeeks: number;
  workouts: AssistantWorkout[];
  summary: string[];
  warnings: string[];
}

export function exerciseCount(minutes: number): number {
  return minutes <= 45 ? 5 : minutes <= 60 ? 6 : 8;
}

interface Scheme {
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
}
export function schemeFor(goal: Goal, type: RoleType, first = false): Scheme {
  if (goal === 'kraft') return type === 'compound' ? { sets: first ? 5 : 4, repMin: 4, repMax: 6, restSec: 180 } : type === 'core' ? { sets: 3, repMin: 10, repMax: 15, restSec: 60 } : { sets: 3, repMin: 8, repMax: 10, restSec: 90 };
  if (goal === 'muskelaufbau') return type === 'compound' ? { sets: first ? 4 : 3, repMin: 8, repMax: 12, restSec: 120 } : type === 'core' ? { sets: 3, repMin: 12, repMax: 15, restSec: 60 } : { sets: 3, repMin: 10, repMax: 15, restSec: 75 };
  return type === 'core' ? { sets: 3, repMin: 12, repMax: 15, restSec: 45 } : { sets: 3, repMin: 12, repMax: 15, restSec: 60 };
}

/** Gewicht für `reps` Wiederholungen aus der geschätzten Maximalkraft (Umkehrung der Epley-Formel). */
export function weightForReps(e1rm: number, reps: number): number {
  return reps <= 1 ? e1rm : e1rm / (1 + reps / 30);
}

// ------------------------------------------------------------------------------------------ Erzeugung

export function generatePlan(input: AssistantInput): AssistantResult {
  const { goal, days, minutes, weeks, focus, allowGeneral, exercises, equipment, plans } = input;
  const done = finishedSessions(input.sessions);
  const excluded = new Set(input.excludedExerciseIds);
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const warnings: string[] = [];
  const summary: string[] = [];

  const available = (id: string): Exercise | undefined => {
    const ex = exMap.get(id);
    if (!ex || ex.hidden || excluded.has(id)) return undefined;
    const eq = ex.equipmentId ? equipment.get(ex.equipmentId) : undefined;
    if (eq?.hidden) return undefined;
    if (!eq) return ex; // freie Übung ohne Gerät
    if (eq.inStudio || !eq.builtin) return ex;
    if (eq.kind === 'koerpergewicht') return ex;
    return allowGeneral ? ex : undefined;
  };

  const history = new Map<string, { stalled: boolean; points: number }>();
  const histOf = (ex: Exercise) => {
    let h = history.get(ex.id);
    if (!h) {
      const eq = ex.equipmentId ? equipment.get(ex.equipmentId) : undefined;
      const unit = weightUnit(eq);
      h = { points: exerciseSeries(done, ex.id, unit).length, stalled: isStalled(done, ex.id, unit, undefined, 3) };
      history.set(ex.id, h);
    }
    return h;
  };

  // Übungen des zuletzt bearbeiteten Plans – Nebenübungen werden gegenüber diesem Plan gewechselt
  const previous = [...plans].filter((p) => p.startedAt).sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))[0] ?? [...plans].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const previousIds = new Set(previous?.workouts.flatMap((w) => w.items.map((i) => i.exerciseId)) ?? []);

  const templates = templatesFor(days);
  const usedInPlan = new Set<string>();
  const count = exerciseCount(minutes);
  const swappedStalled: string[] = [];
  const kept: string[] = [];
  const rotated: string[] = [];

  const rank = (role: Role, avoid: Set<string>, tpl: Template): Exercise[] => {
    const list = role.candidates
      .map((id, i) => ({ ex: available(id), i }))
      .filter((c): c is { ex: Exercise; i: number } => !!c.ex);
    const nonStalled = list.filter((c) => !histOf(c.ex).stalled);
    const pool = nonStalled.length ? nonStalled : list;
    const scored = pool.map((c) => {
      const h = histOf(c.ex);
      const eq = c.ex.equipmentId ? equipment.get(c.ex.equipmentId) : undefined;
      let score = -c.i;
      if (eq?.inStudio) score += 20;
      if (isUnconfirmed(eq)) score -= 8; // Geräte mit unsicherer Zuordnung nur, wenn es keine gute Alternative gibt
      if (role.type === 'compound' && h.points > 0) score += 40; // gut laufende Grundübungen bleiben
      if (role.type !== 'compound' && previousIds.has(c.ex.id)) score -= 15; // Nebenübungen wechseln
      if (tpl.variant && usedInPlan.has(c.ex.id)) score -= 30;
      if (avoid.has(c.ex.id)) score -= 1000;
      return { ex: c.ex, score };
    });
    return scored.sort((a, b) => b.score - a.score).map((s) => s.ex);
  };

  const weightFor = (ex: Exercise, scheme: Scheme): number | undefined => {
    if (ex.tracking !== 'gewicht_wdh') return undefined;
    const eq = ex.equipmentId ? equipment.get(ex.equipmentId) : undefined;
    const unit = weightUnit(eq);
    const pts = exerciseSeries(done, ex.id, unit).slice(-3);
    if (!pts.length) return undefined;
    if (unit === 'platte') return pts[pts.length - 1].maxWeight || undefined;
    const e1rm = Math.max(...pts.map((p) => p.best1rm));
    if (!e1rm) return undefined;
    const raw = weightForReps(e1rm, Math.round((scheme.repMin + scheme.repMax) / 2)) * 0.95; // leicht unter dem Schätzwert starten
    const stack = eq?.weightStack;
    return stack ? snapToStack(raw, stack) : Math.round(raw / stepFor(ex, eq)) * stepFor(ex, eq) || undefined;
  };

  const workouts: AssistantWorkout[] = templates.map((tpl) => {
    const items: AssistantItem[] = [];
    const inWorkout = new Set<string>();
    let rolesToUse = tpl.roles.slice(0, count);
    // Schwerpunkte: eine zusätzliche Übung für die Gruppe, falls die Einheit sie trainiert, aber noch nicht abdeckt
    for (const g of focus) {
      const extra = Object.values(ROLES).find((r) => r.group === g && r.type !== 'compound' && r.id !== 'cardio' && !rolesToUse.includes(r.id));
      const trains = tpl.roles.some((id) => ROLES[id]?.group === g);
      if (extra && trains && !rolesToUse.includes(extra.id)) rolesToUse = [...rolesToUse, extra.id];
    }
    if (goal === 'fitness') rolesToUse = [...rolesToUse, 'cardio'];
    let firstCompound = true;
    for (const roleId of rolesToUse) {
      const role = ROLES[roleId];
      const cands = rank(role, inWorkout, tpl);
      const ex = cands.find((c) => !inWorkout.has(c.id));
      if (!ex) {
        if (roleId === 'cardio') continue; // Ausdauergeräte sind optional – kein Hinweis nötig
        const msg = `Für „${role.label}“ gibt es keine verfügbare Übung (ausgeschlossen oder nicht im Studio).`;
        if (!warnings.includes(msg)) warnings.push(msg);
        continue;
      }
      const scheme = roleId === 'cardio' ? { sets: 1, repMin: 1, repMax: 1, restSec: 0 } : schemeFor(goal, role.type, firstCompound && role.type === 'compound');
      if (role.type === 'compound') firstCompound = false;
      const timed = ex.tracking === 'zeit';
      const why: string[] = [];
      const h = histOf(ex);
      if (h.points > 0 && !h.stalled && role.type === 'compound') {
        why.push(`bleibt im Plan – du trainierst sie bereits (${h.points}×) und steigerst dich`);
        kept.push(ex.name);
      }
      const staleSibling = role.candidates.map((id) => exMap.get(id)).find((c) => c && c.id !== ex.id && histOf(c).stalled && available(c.id));
      if (staleSibling) {
        why.push(`ersetzt „${staleSibling.name}“ (keine Steigerung seit 3 Einheiten)`);
        swappedStalled.push(staleSibling.name);
      } else if (role.type !== 'compound' && previous && !previousIds.has(ex.id) && role.candidates.some((id) => previousIds.has(id))) {
        why.push('Wechsel gegenüber deinem letzten Plan');
        rotated.push(ex.name);
      }
      const eq = ex.equipmentId ? equipment.get(ex.equipmentId) : undefined;
      if (isUnconfirmed(eq)) why.push('Zuordnung des Geräts noch zu bestätigen');
      if (eq && !eq.inStudio && eq.builtin && eq.kind !== 'koerpergewicht') why.push('nicht als „mein Studio“ markiert – bitte prüfen, ob vorhanden');
      const w = weightFor(ex, scheme);
      if (w !== undefined) why.push(`Startgewicht aus deiner geschätzten Maximalkraft abgeleitet`);
      items.push({
        id: `tmp-${items.length}-${ex.id}`,
        exerciseId: ex.id,
        sets: scheme.sets,
        repMin: timed ? 1 : scheme.repMin,
        repMax: timed ? 1 : scheme.repMax,
        restSec: timed ? 45 : scheme.restSec,
        targetWeight: w,
        roleLabel: role.label,
        why: why.length ? why.join('; ') : 'passende Übung aus deinem Studio',
      });
      inWorkout.add(ex.id);
    }
    for (const it of items) usedInPlan.add(it.exerciseId);
    return { name: tpl.name, why: tpl.why, items };
  });

  const sch = schemeFor(goal, 'compound');
  summary.push(`${GOAL_LABEL[goal]}, ${days} Tage pro Woche, ${minutes} Minuten pro Einheit, ${weeks} Wochen.`);
  summary.push(`Grundübungen mit ${sch.repMin}–${sch.repMax} Wiederholungen und ${sch.restSec / 60 >= 2 ? Math.round(sch.restSec / 60) + ' Minuten' : sch.restSec + ' Sekunden'} Pause, Nebenübungen etwas höher in den Wiederholungen.`);
  if (kept.length) summary.push(`Beibehalten: ${[...new Set(kept)].slice(0, 5).join(', ')}.`);
  if (swappedStalled.length) summary.push(`Wegen Stagnation gewechselt: ${[...new Set(swappedStalled)].join(', ')}.`);
  if (rotated.length) summary.push(`Neu gegenüber dem letzten Plan: ${[...new Set(rotated)].slice(0, 5).join(', ')}.`);
  if (!done.length) summary.push('Noch kein Verlauf vorhanden – die Startgewichte wählst du im ersten Training.');
  if (focus.length) summary.push(`Schwerpunkt: ${focus.map((g) => MUSCLE_GROUPS.find((x) => x.id === g)?.label).join(', ')} (je eine zusätzliche Übung).`);

  return { name: `${GOAL_LABEL[goal]} – ${days} Tage`, goal: GOAL_LABEL[goal], plannedWeeks: weeks, workouts, summary, warnings };
}
