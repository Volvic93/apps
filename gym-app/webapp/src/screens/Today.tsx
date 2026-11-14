import { useNavigate } from 'react-router-dom';
import { db } from '../data/db';
import { getActiveSession, startFreeSession, startSession } from '../data/repo';
import { planWeek, planWeekLabel, sameDay, suggestNextWorkout, weekDays } from '../logic/stats';
import { useCatalog } from '../ui/ExercisePicker';
import { ScreenHeader } from '../ui/Header';
import { useLive, useNow } from '../ui/hooks';
import { IconGear, IconPlay } from '../ui/Icons';
import { HintCards } from '../ui/HintCards';
import { formatDateLong, formatDuration } from '../ui/kit';

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function Today() {
  const nav = useNavigate();
  const cat = useCatalog();
  const data = useLive(async () => {
    const [plans, sessions, active] = await Promise.all([db.plans.toArray(), db.sessions.toArray(), getActiveSession()]);
    return { plans, sessions, active };
  });
  const now = useNow(!!data?.active, 1000);

  if (!data || !cat) return <div className="screen" />;
  const { plans, sessions, active } = data;
  const plan = plans.find((p) => p.status === 'aktiv');
  const finished = sessions.filter((s) => s.endedAt !== undefined);
  const nextId = plan ? suggestNextWorkout(plan.workouts, finished, plan.id) : undefined;
  const next = plan?.workouts.find((w) => w.id === nextId);
  const week = weekDays(new Date());
  const today = new Date();
  const thisWeek = finished.filter((s) => week.some((d) => sameDay(d, new Date(s.startedAt))));

  const begin = async (workoutId: string) => {
    if (!plan) return;
    const s = await startSession(plan.id, workoutId);
    if (s) nav('/training');
  };

  return (
    <div className="screen">
      <ScreenHeader
        eyebrow={formatDateLong(Date.now())}
        title="Heute"
        right={
          <button className="icon-btn" aria-label="Einstellungen" onClick={() => nav('/einstellungen')}>
            <IconGear size={24} />
          </button>
        }
      />

      {active && (
        <button className="card resume" onClick={() => nav('/training')}>
          <div className="grow">
            <div className="eyebrow">Training läuft</div>
            <div className="row-title">{active.workoutName}</div>
            <div className="row-sub">seit {formatDuration(Math.floor((now - active.startedAt) / 1000))} · {active.entries.reduce((a, e) => a + e.sets.filter((x) => x.doneAt !== undefined).length, 0)} Sätze abgehakt</div>
          </div>
          <span className="btn small primary">Fortsetzen</span>
        </button>
      )}

      <HintCards />

      {plan ? (
        <>
          <button className="card plan-banner" onClick={() => nav(`/plaene/${plan.id}`)}>
            <div className="grow">
              <div className="eyebrow">Aktiver Plan</div>
              <div className="row-title">{plan.name}</div>
              <div className="progress-line">
                <div className="progress-fill" style={{ width: `${Math.min(100, (planWeek(plan.startedAt) / Math.max(1, plan.plannedWeeks)) * 100)}%` }} />
              </div>
              <div className="row-sub">
                {planWeekLabel(plan.startedAt, plan.plannedWeeks)}
              </div>
            </div>
          </button>

          {next && !active && (
            <section className="next-card">
              <div className="eyebrow">Nächste Einheit</div>
              <div className="next-name">{next.name}</div>
              <div className="next-sub">
                {next.items.length} Übungen · {next.items.reduce((a, i) => a + i.sets, 0)} Sätze
              </div>
              <div className="next-list">
                {next.items.slice(0, 4).map((it) => (
                  <div key={it.id}>{cat.exMap.get(it.exerciseId)?.name}</div>
                ))}
                {next.items.length > 4 && <div className="muted">+ {next.items.length - 4} weitere</div>}
              </div>
              <button className="btn primary big block" onClick={() => begin(next.id)} disabled={next.items.length === 0}>
                <IconPlay size={20} /> Einheit starten
              </button>
            </section>
          )}

          {plan.workouts.length > 1 && !active && (
            <>
              <div className="section-label">Andere Einheit wählen</div>
              <div className="chips wrap">
                {plan.workouts
                  .filter((w) => w.id !== nextId)
                  .map((w) => (
                    <button key={w.id} className="chip" onClick={() => begin(w.id)} disabled={w.items.length === 0}>
                      {w.name}
                    </button>
                  ))}
              </div>
            </>
          )}
        </>
      ) : (
        !active && (
          <section className="next-card">
            <div className="eyebrow">Los geht’s</div>
            <div className="next-name">Noch kein aktiver Plan</div>
            <div className="next-sub">Lege einen Plan mit deinen Einheiten an und aktiviere ihn – oder trainiere frei.</div>
            <button className="btn primary big block" onClick={() => nav('/plaene')}>
              Zu den Plänen
            </button>
          </section>
        )
      )}

      {!active && (
        <button
          className="btn block ghost"
          onClick={async () => {
            await startFreeSession();
            nav('/training');
          }}
        >
          Freies Training (ohne Plan)
        </button>
      )}

      <section className="card">
        <div className="card-title">Diese Woche</div>
        <div className="week">
          {week.map((d, i) => {
            const trained = finished.some((s) => sameDay(d, new Date(s.startedAt)));
            return (
              <div key={i} className={'week-day' + (trained ? ' on' : '') + (sameDay(d, today) ? ' today' : '')}>
                <div className="week-dot" aria-label={trained ? 'trainiert' : 'kein Training'} />
                <div className="week-label">{DAY_LABELS[i]}</div>
              </div>
            );
          })}
        </div>
        <div className="row-sub">
          {thisWeek.length === 0 ? 'Noch keine Einheit diese Woche.' : `${thisWeek.length} ${thisWeek.length === 1 ? 'Einheit' : 'Einheiten'} diese Woche`}
        </div>
      </section>
    </div>
  );
}
