import { MUSCLE_GROUPS, type MuscleGroupId } from '../data/muscles';
import type { Equipment, Exercise, Plan, Session, Settings } from '../data/types';
import { planEquipmentWithoutPhoto } from './catalog';
import { exerciseSeries, finishedSessions, isStalled } from './progress';
import { snapToStack, stepFor } from './progression';
import { isWorkSet, planWeek } from './stats';

const DAY = 24 * 3600 * 1000;

/** Wie die Karte auf „Jetzt angehen“ reagiert. */
export type HintAction =
  | { kind: 'assistant'; label: string }
  | { kind: 'exercise'; label: string; exerciseId: string }
  | { kind: 'deload'; label: string; planId: string }
  | { kind: 'plan'; label: string; planId: string; note?: string }
  | { kind: 'backup'; label: string }
  | { kind: 'studio'; label: string }
  | { kind: 'equipment'; label: string; equipmentId: string }
  | { kind: 'start'; label: string; planId: string };

export interface Hint {
  /** Eindeutiger Schlüssel (enthält den Anlass, damit ein neuer Anlass die Karte wieder zeigt). */
  key: string;
  /** Kleinere Zahl = wichtiger. */
  priority: number;
  title: string;
  /** „Warum?“ – die Zahlen hinter der Empfehlung. */
  why: string;
  action: HintAction;
}

export const STALL_HINT_SESSIONS = 3;
export const MAX_HINTS = 2;
export const LATER_DAYS = 7;
export const COMEBACK_DAYS = 10;
export const BACKUP_DAYS = 30;

// ------------------------------------------------------------------------------------------ Zurückgestellt / ausgeblendet

/** `never:<Schlüssel>` blendet dauerhaft aus, `later:<Schlüssel>:<bis>` bis zu einem Zeitpunkt. */
export function isDismissed(dismissed: string[], key: string, now = Date.now()): boolean {
  for (const d of Array.isArray(dismissed) ? dismissed : []) {
    if (typeof d !== 'string') continue;
    if (d === `never:${key}`) return true;
    if (d.startsWith(`later:${key}:`)) {
      const until = Number(d.slice(`later:${key}:`.length));
      if (Number.isFinite(until) && until > now) return true;
    }
  }
  return false;
}

/** Neue Liste mit der gewünschten Zurückstellung; abgelaufene „Später“-Einträge werden dabei entfernt. */
export function dismissHint(dismissed: string[], key: string, mode: 'never' | 'later', now = Date.now()): string[] {
  const keep = (Array.isArray(dismissed) ? dismissed : []).filter((d) => {
    if (typeof d !== 'string') return false;
    if (d.startsWith('later:')) {
      const until = Number(d.slice(d.lastIndexOf(':') + 1));
      if (!(until > now)) return false;
    }
    return d !== `never:${key}` && !d.startsWith(`later:${key}:`);
  });
  return [...keep, mode === 'never' ? `never:${key}` : `later:${key}:${now + LATER_DAYS * DAY}`];
}

/** Sichtbare Karten: nicht ausgeblendet, nach Wichtigkeit, höchstens `MAX_HINTS`. */
export function visibleHints(hints: Hint[], dismissed: string[], now = Date.now()): Hint[] {
  return hints
    .filter((h) => !isDismissed(dismissed, h.key, now))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_HINTS);
}

// ------------------------------------------------------------------------------------------ Muskelgruppen

/** Arbeitssätze je Muskelgruppe und Woche, gemittelt über die letzten `days` Tage. Ein Satz zählt einmal je Gruppe seiner Hauptmuskeln. */
export function groupSetsPerWeek(
  sessions: Session[],
  exercises: Map<string, Pick<Exercise, 'primaryMuscles'>>,
  days = 14,
  now = Date.now(),
): Record<MuscleGroupId, number> {
  const out = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g.id, 0])) as Record<MuscleGroupId, number>;
  const from = now - days * DAY;
  for (const s of finishedSessions(sessions)) {
    if (s.startedAt < from) continue;
    for (const e of s.entries) {
      if (e.skipped) continue;
      const ex = exercises.get(e.exerciseId);
      if (!ex) continue;
      const n = e.sets.filter(isWorkSet).length;
      if (!n) continue;
      for (const g of MUSCLE_GROUPS) if (ex.primaryMuscles.some((m) => g.muscles.includes(m))) out[g.id] += n;
    }
  }
  for (const g of MUSCLE_GROUPS) out[g.id] = (out[g.id] / days) * 7;
  return out;
}

/** Muskelgruppe, die deutlich hinter den anderen zurückliegt (unter der Hälfte des Mittelwerts der übrigen, die schon trainiert werden). */
export function lagging(perWeek: Record<MuscleGroupId, number>): { group: MuscleGroupId; value: number; median: number } | undefined {
  // Der Rumpf bekommt von Natur aus wenig Sätze und zählt nicht als Maßstab oder Kandidat
  const entries = (Object.entries(perWeek) as [MuscleGroupId, number][]).filter(([g]) => g !== 'rumpf');
  let worst: { group: MuscleGroupId; value: number; median: number } | undefined;
  for (const [g, v] of entries) {
    const others = entries.filter(([k]) => k !== g).map(([, x]) => x).sort((a, b) => a - b);
    const median = others[Math.floor(others.length / 2)] ?? 0;
    if (median >= 6 && v < median * 0.5 && (!worst || v / median < worst.value / worst.median)) worst = { group: g, value: v, median };
  }
  return worst;
}

// ------------------------------------------------------------------------------------------ Empfehlungen berechnen

export interface HintInput {
  now: number;
  settings: Pick<Settings, 'backupReminder' | 'lastBackupAt'> & { studioSetupDone?: boolean };
  plans: Plan[];
  sessions: Session[];
  exercises: Map<string, Exercise>;
  /** Geräte (für den Hinweis „Foto fehlt“); ohne Angabe entfällt der Hinweis. */
  equipment?: Map<string, Pick<Equipment, 'id' | 'name' | 'kind' | 'photoId' | 'builtinPhoto' | 'hidden'>>;
}

const fmtN = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/** Alle zutreffenden Empfehlungen (ungefiltert). Die Oberfläche zeigt davon höchstens zwei. */
export function computeHints(input: HintInput): Hint[] {
  const { now, settings, plans, sessions, exercises } = input;
  const done = finishedSessions(sessions);
  const hints: Hint[] = [];
  const active = plans.find((p) => p.status === 'aktiv');

  // 1./2. Planlaufzeit
  if (active?.startedAt) {
    const end = active.startedAt + active.plannedWeeks * 7 * DAY;
    const week = planWeek(active.startedAt, now);
    if (now >= end) {
      hints.push({
        key: `plan_end:${active.id}`,
        priority: 1,
        title: 'Zeit für einen neuen Plan',
        why: `„${active.name}“ lief ${active.plannedWeeks} Wochen (jetzt Woche ${week}). Der Assistent berücksichtigt deinen bisherigen Verlauf.`,
        action: { kind: 'assistant', label: 'Neuen Plan erstellen' },
      });
    } else if (end - now <= 7 * DAY) {
      hints.push({
        key: `plan_soon:${active.id}`,
        priority: 4,
        title: 'Dein Plan läuft bald aus',
        why: `„${active.name}“ endet in ${Math.max(1, Math.ceil((end - now) / DAY))} Tagen (Woche ${Math.min(week, active.plannedWeeks)} von ${active.plannedWeeks}). Du kannst schon einen Nachfolger vorbereiten.`,
        action: { kind: 'assistant', label: 'Nachfolger planen' },
      });
    }
  }

  // 3./4. Stagnation (nur Übungen mit Gewicht und Wiederholungen)
  // Nur Übungen, die jetzt zählen: die des aktiven Plans, sonst die der letzten 8 Wochen – so feuert nach einem Planwechsel nichts auf alter Historie
  const inPlan = new Set(active?.workouts.flatMap((w) => w.items.map((i) => i.exerciseId)) ?? []);
  const trained = new Set<string>();
  for (const s of done) {
    if (s.startedAt < now - 56 * DAY) continue;
    for (const e of s.entries) if (!e.skipped && e.sets.some(isWorkSet) && (!active || inPlan.has(e.exerciseId))) trained.add(e.exerciseId);
  }
  const stalled: { id: string; name: string; sessions: number; value: number }[] = [];
  for (const id of trained) {
    const ex = exercises.get(id);
    if (!ex || (ex.tracking !== 'gewicht_wdh' && ex.tracking !== 'koerpergewicht_wdh')) continue;
    // Plattennummern und kg getrennt betrachten – es genügt, wenn eine Einheit stagniert
    for (const unit of ['kg', 'platte'] as const) {
      if (isStalled(done, id, unit, undefined, STALL_HINT_SESSIONS)) {
        const pts = exerciseSeries(done, id, unit);
        const last = pts[pts.length - 1];
        stalled.push({ id, name: ex.name, sessions: STALL_HINT_SESSIONS, value: unit === 'kg' ? last.best1rm || last.maxWeight : last.maxWeight });
        break;
      }
    }
  }
  if (stalled.length >= 3 && active) {
    hints.push({
      key: `deload:${active.id}`,
      priority: 2,
      title: 'Entlastungswoche einlegen',
      why: `${stalled.length} Übungen stagnieren gleichzeitig (${stalled.slice(0, 3).map((s) => s.name).join(', ')}${stalled.length > 3 ? ' …' : ''}). Eine Woche mit rund 40 % weniger Gewicht lässt den Körper nachziehen.`,
      action: { kind: 'deload', label: 'Entlastungsplan anlegen', planId: active.id },
    });
  } else if (stalled.length > 0) {
    const s = stalled[0];
    hints.push({
      key: `stall:${s.id}`,
      priority: 3,
      title: `„${s.name}“ stagnierte zuletzt`,
      why: `Seit ${s.sessions} Einheiten keine Steigerung der geschätzten Maximalkraft (zuletzt ${fmtN(s.value)}). Variiere die Übung, ändere den Wiederholungsbereich oder plane eine Entlastungswoche.`,
      action: { kind: 'exercise', label: 'Verlauf ansehen', exerciseId: s.id },
    });
  }

  // 5. Muskelgruppe fällt zurück (nur bei regelmäßigem Training in den letzten zwei Wochen)
  const recent = done.filter((s) => s.startedAt >= now - 14 * DAY);
  if (active && recent.length >= 4) {
    const lag = lagging(groupSetsPerWeek(done, exercises, 14, now));
    if (lag) {
      const label = MUSCLE_GROUPS.find((g) => g.id === lag.group)!.label;
      hints.push({
        key: `imbalance:${lag.group}`,
        priority: 5,
        title: `${label} kommt zu kurz`,
        why: `In den letzten 2 Wochen im Schnitt ${fmtN(lag.value)} Sätze pro Woche – die übrigen Muskelgruppen liegen bei etwa ${fmtN(lag.median)}. Eine zusätzliche Übung gleicht das aus.`,
        action: { kind: 'plan', label: 'Plan ergänzen', planId: active.id, note: `Tipp: Füge eine Übung für „${label}“ hinzu.` },
      });
    }
  }

  // 6. Wiedereinstieg
  const lastSession = done[done.length - 1];
  if (lastSession && active && now - lastSession.startedAt > COMEBACK_DAYS * DAY) {
    const days = Math.floor((now - lastSession.startedAt) / DAY);
    hints.push({
      key: `comeback:${lastSession.id}`,
      priority: 1,
      title: 'Sanfter Wiedereinstieg',
      why: `Dein letztes Training liegt ${days} Tage zurück. Starte mit etwa 70 % der letzten Gewichte und je einem Satz weniger, dann steigere dich über die Einheiten.`,
      action: { kind: 'start', label: 'Leichter wieder starten', planId: active.id },
    });
  }

  // 6a. Studio einrichten (einmalig, bis es erledigt oder weggewischt ist)
  if (!settings.studioSetupDone) {
    hints.push({
      key: 'studio_setup',
      priority: 3,
      title: 'Dein Studio einrichten',
      why: 'Markiere die Geräte, die es bei dir gibt. Katalog, Suche und Plan-Assistent zeigen dann nur diese – das geht in zwei Minuten.',
      action: { kind: 'studio', label: 'Studio einrichten' },
    });
  }

  // 6b. Geräte des aktiven Plans ohne Foto
  if (active && input.equipment) {
    const missing = planEquipmentWithoutPhoto(active, exercises, input.equipment);
    if (missing.length) {
      const names = missing.slice(0, 3).map((e) => e.name).join(', ') + (missing.length > 3 ? ' …' : '');
      hints.push({
        key: `photos:${active.id}`,
        priority: 5,
        title: missing.length === 1 ? 'Ein Gerät hat noch kein Foto' : `${missing.length} Geräte haben noch kein Foto`,
        why: `In „${active.name}“ fehlt ein Foto bei: ${names}. Mit eigenem Foto erkennst du das Gerät im Training sofort.`,
        action: { kind: 'equipment', label: 'Foto aufnehmen', equipmentId: missing[0].id },
      });
    }
  }

  // 7. Sicherung
  if (settings.backupReminder && done.length > 0) {
    const last = settings.lastBackupAt;
    const age = last ? now - last : now - done[0].startedAt;
    if (age > BACKUP_DAYS * DAY) {
      hints.push({
        key: 'backup',
        priority: 6,
        title: 'Sicherung anlegen',
        why: last ? `Die letzte Sicherung ist ${Math.floor(age / DAY)} Tage alt. Deine Daten liegen nur auf diesem Gerät.` : 'Du hast noch nie eine Sicherung angelegt – deine Daten liegen nur auf diesem Gerät.',
        action: { kind: 'backup', label: 'Zur Sicherung' },
      });
    }
  }
  return hints;
}

// ------------------------------------------------------------------------------------------ Entlastungswoche

/**
 * Entlastungsplan: Kopie des Plans mit einer Woche Laufzeit; Zielgewicht je Übung = 60 % des zuletzt verwendeten Arbeitsgewichts
 * (auf die Gewichtsstufen des Geräts gerundet). Übungen ohne Historie behalten ihre Vorgaben.
 */
export function deloadTargets(
  plan: Pick<Plan, 'workouts'>,
  sessions: Session[],
  exercises: Map<string, Pick<Exercise, 'id' | 'weightStep' | 'tracking'>>,
  stacks: Map<string, { minKg: number; maxKg: number; stepKg: number; levels?: number[]; unit?: 'platte' | 'kg' } | undefined>,
  factor = 0.6,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const w of plan.workouts) {
    for (const item of w.items) {
      const ex = exercises.get(item.exerciseId);
      if (!ex || ex.tracking === 'cardio' || ex.tracking === 'zeit') continue;
      const stack = stacks.get(item.exerciseId);
      if (stack?.unit === 'platte') continue; // Plattennummern lassen sich nicht in Prozent kürzen
      const pts = exerciseSeries(sessions, item.exerciseId, 'kg');
      const last = pts[pts.length - 1];
      const base = last?.maxWeight || item.targetWeight;
      if (!base) continue;
      let target = base * factor;
      target = stack ? snapToStack(target, stack) : Math.max(0, Math.round(target / stepFor(ex, undefined)) * stepFor(ex, undefined));
      if (target > 0) out.set(item.id, target);
    }
  }
  return out;
}
