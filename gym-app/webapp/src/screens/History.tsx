import { useNavigate } from 'react-router-dom';
import { db } from '../data/db';
import { sessionDurationMin, sessionVolume, sessionWorkSets } from '../logic/stats';
import { useLive } from '../ui/hooks';
import { IconChevronRight } from '../ui/Icons';
import { EmptyState, formatDateShort } from '../ui/kit';
import { formatVolume } from './Summary';

/** Trainingsverlauf: jede abgeschlossene Einheit, nach Monaten gruppiert; Tippen öffnet sie zum Ansehen und Korrigieren. */
export function SessionList() {
  const nav = useNavigate();
  const sessions = useLive(async () => (await db.sessions.filter((s) => s.endedAt !== undefined).toArray()).sort((a, b) => b.startedAt - a.startedAt));
  if (!sessions) return null;
  if (sessions.length === 0) {
    return <EmptyState title="Noch kein Training" text="Sobald du eine Einheit abgeschlossen hast, findest du sie hier wieder – und kannst sie nachträglich korrigieren." />;
  }
  const byMonth = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = new Date(s.startedAt).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    byMonth.set(key, [...(byMonth.get(key) ?? []), s]);
  }
  return (
    <>
      {[...byMonth.entries()].map(([month, list]) => (
        <section key={month}>
          <div className="section-label">{month}</div>
          <div className="list">
            {list.map((s) => (
              <button key={s.id} className="list-row" onClick={() => nav(`/fortschritt/${s.id}`)}>
                <div className="grow">
                  <div className="row-title">{s.workoutName}</div>
                  <div className="row-sub">
                    {formatDateShort(s.startedAt)} · {sessionDurationMin(s)} min · {sessionWorkSets(s)} {sessionWorkSets(s) === 1 ? 'Satz' : 'Sätze'} · {formatVolume(sessionVolume(s))}
                  </div>
                </div>
                <IconChevronRight size={18} className="chev" />
              </button>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
