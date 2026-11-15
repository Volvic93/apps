import { useEffect, useRef } from 'react';
import type { Session } from '../data/types';
import { formatNumber } from '../logic/progression';
import { platform } from '../platform';
import type { LiveActivityState } from '../platform/types';
import type { Catalog } from './ExercisePicker';

/** Zustand der Live-Aktivität aus der laufenden Einheit (reine Funktion, getestet). */
export function liveActivityState(s: Session, exName: (id: string) => string | undefined): LiveActivityState {
  const idx = Math.max(0, Math.min(s.currentIndex ?? 0, Math.max(0, s.entries.length - 1)));
  const entry = s.entries[idx];
  const all = s.entries.filter((e) => !e.skipped).flatMap((e) => e.sets);
  const done = all.filter((x) => x.doneAt !== undefined).length;
  const work = entry ? entry.sets.filter((x) => x.kind !== 'aufwaermen') : [];
  const doneWork = work.filter((x) => x.doneAt !== undefined).length;
  const next = work.find((x) => x.doneAt === undefined) ?? work[work.length - 1];
  const unit = entry?.unit === 'platte' ? 'Platte ' : '';
  const kg = entry?.unit === 'platte' ? '' : ' kg';
  const target = next ? `${next.weight !== undefined ? `${unit}${formatNumber(next.weight)}${kg} × ` : ''}${next.reps ?? ''}`.trim() : '';
  const rest = s.restEndsAt && s.restEndsAt > Date.now() ? s.restEndsAt : undefined;
  return {
    workout: s.workoutName,
    startedAt: s.startedAt,
    exercise: (entry && exName(entry.exerciseId)) ?? '',
    setIndex: Math.min(Math.max(1, work.length), doneWork + 1),
    setTotal: Math.max(1, work.length),
    target,
    progress: all.length ? Math.min(1, done / all.length) : 0,
    ...(rest ? { restEndsAt: rest } : {}),
  };
}

/**
 * Hält die Live-Aktivität (Sperrbildschirm / Dynamic Island) mit dem laufenden Training synchron: Start beim Öffnen des
 * Trainingsmodus, Aktualisierung bei Satz, Übung und Pause, Ende beim Verlassen. Ohne die native Erweiterung passiert nichts.
 */
export function LiveActivitySync({ session, cat }: { session: Session; cat: Catalog }) {
  const started = useRef(false);
  const state = liveActivityState(session, (id) => cat.exMap.get(id)?.name);
  const key = JSON.stringify(state);
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    if (platform.name !== 'ios') return;
    if (!started.current) {
      started.current = true;
      void platform.liveActivity.start(latest.current);
    } else {
      void platform.liveActivity.update(latest.current);
    }
  }, [key]);

  useEffect(
    () => () => {
      if (platform.name === 'ios') void platform.liveActivity.end();
    },
    [],
  );
  return null;
}
