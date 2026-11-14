import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../data/db';
import { getActiveSession, startFreeSession, startSession } from '../data/repo';
import { suggestNextWorkout } from '../logic/stats';
import { ScreenHeader } from '../ui/Header';
import { useLive } from '../ui/hooks';
import { IconPlay } from '../ui/Icons';
import { EmptyState } from '../ui/kit';
import { Summary } from './Summary';
import { TrainingMode } from './TrainingMode';

/** Reiter „Training“: läuft eine Einheit, füllt der Trainingsmodus den Bildschirm; sonst die Startauswahl. */
export function Training() {
  const nav = useNavigate();
  const loaded = useLive(async () => ({ active: (await getActiveSession()) ?? null }));
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  if (summaryId) {
    return (
      <Summary
        sessionId={summaryId}
        onClose={() => {
          setSummaryId(null);
          nav('/heute');
        }}
      />
    );
  }
  if (!loaded) return <div className="screen" />;
  if (loaded.active && !ending) {
    return (
      <TrainingMode
        key={loaded.active.id}
        initial={loaded.active}
        onEnd={(id) => {
          setEnding(true);
          if (id) setSummaryId(id);
          else nav('/heute');
          setTimeout(() => setEnding(false), 300);
        }}
      />
    );
  }
  return <TrainingStart />;
}

function TrainingStart() {
  const nav = useNavigate();
  const data = useLive(async () => {
    const plans = await db.plans.toArray();
    const sessions = await db.sessions.toArray();
    return { plans, sessions };
  });
  const active = data?.plans.find((p) => p.status === 'aktiv');
  const nextId = active && data ? suggestNextWorkout(active.workouts, data.sessions, active.id) : undefined;

  const begin = async (planId: string, workoutId: string) => {
    const s = await startSession(planId, workoutId);
    if (s) nav('/training', { replace: true });
  };

  return (
    <div className="screen">
      <ScreenHeader title="Training" eyebrow="Kein Training aktiv" />
      {active && active.workouts.length > 0 ? (
        <>
          <div className="section-label">{active.name}</div>
          <div className="stack">
            {active.workouts.map((w) => (
              <button key={w.id} className={'card start-card' + (w.id === nextId ? ' next' : '')} onClick={() => begin(active.id, w.id)}>
                <div className="grow">
                  <div className="row-title">{w.name}</div>
                  <div className="row-sub">
                    {w.items.length} Übungen{w.id === nextId ? ' · als Nächstes dran' : ''}
                  </div>
                </div>
                <IconPlay size={20} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <EmptyState title="Kein aktiver Plan" text="Aktiviere einen Plan unter „Pläne“ oder starte ein freies Training." />
      )}
      <button
        className="btn block"
        onClick={async () => {
          await startFreeSession();
          nav('/training', { replace: true });
        }}
      >
        Freies Training (ohne Plan)
      </button>
    </div>
  );
}
