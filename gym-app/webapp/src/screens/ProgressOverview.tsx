import { EvaluationCard } from '../ui/EvaluationCard';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../data/db';
import { groupColor, groupOfMuscle, MUSCLE_LABEL, MUSCLES } from '../data/muscles';
import { averagePerWeek, dayKey, finishedSessions, muscleLoad, planComparison, recordList, sessionsByDay, weeklyStats } from '../logic/progress';
import { formatNumber } from '../logic/progression';
import { sessionDurationMin } from '../logic/stats';
import { BarChart } from '../ui/Charts';
import { useCatalog } from '../ui/ExercisePicker';
import { useLive } from '../ui/hooks';
import { IconChevronLeft, IconChevronRight, IconTrophy } from '../ui/Icons';
import { Chip, EmptyState, Segmented, formatDateShort } from '../ui/kit';
import { formatVolume } from './Summary';

type WeekMetric = 'sessions' | 'volume' | 'durationMin' | 'workSets';
const WEEK_METRICS: { value: WeekMetric; label: string }[] = [
  { value: 'sessions', label: 'Einheiten' },
  { value: 'workSets', label: 'Sätze' },
  { value: 'volume', label: 'Volumen' },
  { value: 'durationMin', label: 'Dauer' },
];
const WEEKS = 12;
const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const fmtMetric = (m: WeekMetric, v: number): string =>
  m === 'volume' ? formatVolume(v) : m === 'durationMin' ? `${formatNumber(Math.round(v))} min` : `${formatNumber(Math.round(v))}`;

export function ProgressOverview() {
  const nav = useNavigate();
  const cat = useCatalog();
  const data = useLive(async () => {
    const [sessions, plans] = await Promise.all([db.sessions.toArray(), db.plans.toArray()]);
    return { sessions: finishedSessions(sessions), plans };
  });
  const [metric, setMetric] = useState<WeekMetric>('sessions');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [pickedDay, setPickedDay] = useState<string | undefined>(undefined);
  const [allRecords, setAllRecords] = useState(false);
  const [planId, setPlanId] = useState<string | undefined>(undefined);

  const sessions = data?.sessions;
  const weeks = useMemo(() => (sessions ? weeklyStats(sessions, WEEKS) : []), [sessions]);
  const byDay = useMemo(() => (sessions ? sessionsByDay(sessions) : new Map()), [sessions]);
  const load = useMemo(() => (sessions && cat ? muscleLoad(sessions, cat.exMap, 4) : []), [sessions, cat]);
  const records = useMemo(() => (sessions ? recordList(sessions) : []), [sessions]);

  if (!data || !cat || !sessions) return null;
  if (sessions.length === 0) {
    return <EmptyState title="Noch keine Auswertung" text="Sobald du eine Einheit abgeschlossen hast, erscheinen hier Kalender, Wochenwerte, Muskelverteilung und Rekorde." />;
  }

  const comparePlans = data.plans.filter((p) => sessions.some((s) => s.planId === p.id));
  const activePlanId = planId && comparePlans.some((p) => p.id === planId) ? planId : (comparePlans.find((p) => p.status === 'aktiv') ?? comparePlans[0])?.id;
  const plan = comparePlans.find((p) => p.id === activePlanId);
  const compare = plan ? planComparison(plan, sessions) : [];

  // Kalender
  const first = new Date(month);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (Date | undefined)[] = [...Array(lead).fill(undefined), ...Array.from({ length: daysInMonth }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1))];
  const todayKey = dayKey(new Date());
  const daySessions = pickedDay ? (byDay.get(pickedDay) ?? []) : [];
  const monthCount = [...byDay.entries()].filter(([k]) => k.startsWith(`${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}`)).reduce((a, [, v]) => a + v.length, 0);

  const avg = averagePerWeek(weeks);
  const hours = sessions.reduce((a, s) => a + sessionDurationMin(s), 0) / 60;
  const trained = new Set(load.map((l) => l.muscle));
  const gaps = MUSCLES.filter((m) => !trained.has(m));
  const maxLoad = Math.max(20, ...load.map((l) => l.perWeek));
  const shownRecords = allRecords ? records : records.slice(0, 5);

  return (
    <>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-val">{sessions.length}</div>
          <div className="stat-label">Einheiten</div>
        </div>
        <div className="stat">
          <div className="stat-val">{formatNumber(Math.round(avg * 10) / 10)}</div>
          <div className="stat-label">je Woche</div>
        </div>
        <div className="stat">
          <div className="stat-val">{formatNumber(Math.round(hours * 10) / 10)}</div>
          <div className="stat-label">Stunden</div>
        </div>
      </div>

      <section className="card">
        <div className="card-title">Kalender</div>
        <div className="cal-head">
          <button className="icon-btn" aria-label="Voriger Monat" onClick={() => setMonth(new Date(first.getFullYear(), first.getMonth() - 1, 1))}>
            <IconChevronLeft size={22} />
          </button>
          <div className="cal-title">
            {first.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
            <span className="muted"> · {monthCount} {monthCount === 1 ? 'Einheit' : 'Einheiten'}</span>
          </div>
          <button className="icon-btn" aria-label="Nächster Monat" onClick={() => setMonth(new Date(first.getFullYear(), first.getMonth() + 1, 1))}>
            <IconChevronRight size={22} />
          </button>
        </div>
        <div className="cal-grid" role="grid">
          {DAY_LABELS.map((d) => (
            <div key={d} className="cal-dow">
              {d}
            </div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} />;
            const key = dayKey(d);
            const n = byDay.get(key)?.length ?? 0;
            return (
              <button
                key={key}
                className={'cal-day' + (n ? ' has' : '') + (key === todayKey ? ' today' : '') + (key === pickedDay ? ' picked' : '')}
                disabled={!n}
                aria-label={`${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}${n ? `, ${n} ${n === 1 ? 'Einheit' : 'Einheiten'}` : ''}`}
                onClick={() => setPickedDay(key === pickedDay ? undefined : key)}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
        {daySessions.length > 0 && (
          <div className="list flat">
            {daySessions.map((s: (typeof sessions)[number]) => (
              <button key={s.id} className="list-row" onClick={() => nav(`/fortschritt/${s.id}`)}>
                <div className="grow">
                  <div className="row-title">{s.workoutName}</div>
                  <div className="row-sub">
                    {formatDateShort(s.startedAt)} · {sessionDurationMin(s)} min
                  </div>
                </div>
                <IconChevronRight size={18} className="chev" />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-title">Pro Woche (letzte {WEEKS} Wochen)</div>
        <Segmented value={metric} options={WEEK_METRICS} onChange={setMetric} />
        <BarChart
          key={metric}
          label={WEEK_METRICS.find((m) => m.value === metric)!.label + ' pro Woche'}
          bars={weeks.map((w) => ({
            label: new Date(w.start).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' }),
            title: `Woche ab ${new Date(w.start).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}`,
            value: w[metric],
          }))}
          formatValue={(v) => fmtMetric(metric, v)}
          labelEvery={3}
        />
        {metric === 'volume' && <p className="muted small">Volumen = Gewicht × Wiederholungen aller Arbeitssätze in kg. Übungen mit Plattennummern zählen nicht mit.</p>}
      </section>

      <section className="card">
        <div className="card-title">Muskeln – Sätze pro Woche</div>
        <p className="muted small">Durchschnitt der letzten 4 Wochen. Ein Satz zählt für den Hauptmuskel voll, für Nebenmuskeln halb. Der markierte Bereich (10–20 Sätze je Muskel und Woche) ist nur eine grobe Orientierung.</p>
        {load.length === 0 ? (
          <p className="muted">In den letzten 4 Wochen wurde nichts trainiert.</p>
        ) : (
          <div className="mload">
            {load.map((l) => (
              <div key={l.muscle} className="mload-row">
                <span className="mload-label">{MUSCLE_LABEL[l.muscle]}</span>
                <span className="mload-track" aria-hidden="true">
                  <span className="mload-band" style={{ left: `${(10 / maxLoad) * 100}%`, width: `${((Math.min(20, maxLoad) - 10) / maxLoad) * 100}%` }} />
                  <span className="mload-fill" style={{ width: `${Math.min(100, (l.perWeek / maxLoad) * 100)}%`, background: groupColor(groupOfMuscle(l.muscle)) }} />
                </span>
                <span className="mload-val">{formatNumber(Math.round(l.perWeek * 10) / 10)}</span>
              </div>
            ))}
          </div>
        )}
        {gaps.length > 0 && load.length > 0 && (
          <p className="muted small">
            <b>Ohne Sätze:</b> {gaps.map((m) => MUSCLE_LABEL[m]).join(', ')}.
          </p>
        )}
      </section>

      <section className="card">
        <div className="card-title">
          <IconTrophy size={16} /> Rekorde
        </div>
        {records.length === 0 ? (
          <p className="muted">Noch keine Sätze mit Gewicht und Wiederholungen.</p>
        ) : (
          <>
            <div className="list flat">
              {shownRecords.map((r) => (
                <button key={`${r.exerciseId}|${r.unit}`} className="list-row" onClick={() => nav(`/fortschritt/uebung/${r.exerciseId}`)}>
                  <div className="grow">
                    <div className="row-title">{cat.exMap.get(r.exerciseId)?.name ?? 'Übung'}</div>
                    <div className="row-sub">
                      {r.unit === 'platte' ? `Platte ${formatNumber(r.weight)}` : `${formatNumber(r.weight)} kg`} × {r.reps}
                      {r.unit === 'kg' && ` · geschätzt ${formatNumber(Math.round(r.e1rm * 10) / 10)} kg`} · {formatDateShort(r.date)}
                    </div>
                  </div>
                  <IconChevronRight size={18} className="chev" />
                </button>
              ))}
            </div>
            {records.length > 5 && (
              <button className="btn ghost small" onClick={() => setAllRecords((v) => !v)}>
                {allRecords ? 'Weniger anzeigen' : `Alle ${records.length} Rekorde`}
              </button>
            )}
          </>
        )}
      </section>

      {data.plans.filter((p) => p.evaluation).map((p) => (
        <EvaluationCard key={p.id} evaluation={p.evaluation!} title={`Auswertung · ${p.name}`} />
      ))}

      <section className="card">
        <div className="card-title">Planvergleich</div>
        {comparePlans.length === 0 ? (
          <p className="muted">Sobald du Einheiten aus einem Plan trainiert hast, siehst du hier, was der Plan gebracht hat.</p>
        ) : (
          <>
            <div className="chips wrap">
              {comparePlans.map((p) => (
                <Chip key={p.id} on={p.id === activePlanId} onClick={() => setPlanId(p.id)}>
                  {p.name}
                </Chip>
              ))}
            </div>
            {compare.length === 0 ? (
              <p className="muted">Für diesen Plan liegen noch keine auswertbaren Sätze vor.</p>
            ) : (
              <div className="list flat">
                {compare.map((r) => {
                  const f = (p: typeof r.start) => (r.unit === 'platte' ? `Platte ${formatNumber(p.maxWeight)}` : p.best1rm ? `${formatNumber(Math.round(p.best1rm * 10) / 10)} kg` : `${formatNumber(p.maxWeight)} kg`);
                  return (
                    <button key={`${r.exerciseId}|${r.unit}`} className="list-row" onClick={() => nav(`/fortschritt/uebung/${r.exerciseId}`)}>
                      <div className="grow">
                        <div className="row-title">{cat.exMap.get(r.exerciseId)?.name ?? 'Übung'}</div>
                        <div className="row-sub">
                          {r.sessions === 1 ? `Einmal trainiert: ${f(r.start)}` : `${f(r.start)} → ${f(r.end)} in ${r.sessions} Einheiten`}
                        </div>
                      </div>
                      {r.changePct !== undefined && (
                        <span className={'delta ' + (r.changePct > 0.05 ? 'up' : r.changePct < -0.05 ? 'down' : '')}>
                          {/* Plattennummern sind keine Kilogramm: dort ist ein Prozentwert sinnlos, also die Differenz der Nummern */}
                          {r.unit === 'platte'
                            ? `${r.end.maxWeight - r.start.maxWeight > 0 ? '+' : ''}${formatNumber(r.end.maxWeight - r.start.maxWeight)} Pl.`
                            : `${r.changePct > 0 ? '+' : ''}${formatNumber(Math.round(r.changePct * 10) / 10)} %`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="muted small">Verglichen werden erste und letzte Einheit mit diesem Plan (bei Gewichtsübungen die geschätzte Maximalkraft).</p>
          </>
        )}
      </section>
    </>
  );
}
