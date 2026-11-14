import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../data/db';
import { cardioSeries, exerciseSeries, finishedSessions, rangeStart, RANGE_OPTIONS, recordList, suggestNext, type Range } from '../logic/progress';
import { formatNumber, weightUnit } from '../logic/progression';
import { LineChart } from '../ui/Charts';
import { useCatalog } from '../ui/ExercisePicker';
import { BackButton, ScreenHeader } from '../ui/Header';
import { useLive } from '../ui/hooks';
import { EmptyState, Segmented } from '../ui/kit';

type Metric = 'maxWeight' | 'best1rm' | 'volume' | 'reps' | 'duration' | 'distance' | 'pace';

const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: '2-digit' });
const round1 = (n: number) => formatNumber(Math.round(n * 10) / 10);

function formatPace(minPerKm: number): string {
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return s === 60 ? `${m + 1}:00 min/km` : `${m}:${String(s).padStart(2, '0')} min/km`;
}

/** Verlauf einer einzelnen Übung: Kurven, Rekord und Steigerungsvorschlag. */
export function ExerciseProgress() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const cat = useCatalog();
  const sessions = useLive(async () => finishedSessions(await db.sessions.toArray()));
  const [range, setRange] = useState<Range>('3m');
  const [metricPick, setMetricPick] = useState<Metric | undefined>(undefined);
  const [unitPick, setUnitPick] = useState<'kg' | 'platte' | undefined>(undefined);

  const ex = cat?.exMap.get(id);
  const eq = ex?.equipmentId ? cat?.eqMap.get(ex.equipmentId) : undefined;
  const timed = ex?.tracking === 'cardio' || ex?.tracking === 'zeit';

  const all = useMemo(() => (sessions ? { kg: exerciseSeries(sessions, id, 'kg'), platte: exerciseSeries(sessions, id, 'platte'), cardio: cardioSeries(sessions, id) } : undefined), [sessions, id]);

  if (!cat || !sessions || !all) return <div className="screen" />;
  if (!ex) {
    return (
      <div className="screen">
        <ScreenHeader back={<BackButton to="/fortschritt" label="Fortschritt" />} title="Übung nicht gefunden" />
      </div>
    );
  }

  const defaultUnit = weightUnit(eq);
  const unit: 'kg' | 'platte' = unitPick ?? (all[defaultUnit].length ? defaultUnit : all.platte.length ? 'platte' : 'kg');
  const hasBothUnits = all.kg.length > 0 && all.platte.length > 0;
  const from = rangeStart(range);
  const inRange = <T extends { date: number }>(rows: T[]) => rows.filter((r) => from === undefined || r.date >= from);

  // verfügbare Kurven
  const series = unit === 'kg' ? inRange(all.kg) : inRange(all.platte);
  const cardio = inRange(all.cardio);
  const hasWeight = unit === 'kg' && all.kg.some((p) => p.maxWeight > 0);
  const metrics: { value: Metric; label: string }[] = timed
    ? [
        { value: 'duration', label: 'Dauer' },
        ...(all.cardio.some((p) => p.distanceKm > 0) ? [{ value: 'distance' as const, label: 'Strecke' }] : []),
        ...(all.cardio.some((p) => p.pace) ? [{ value: 'pace' as const, label: 'Tempo' }] : []),
      ]
    : unit === 'platte'
      ? [
          { value: 'maxWeight', label: 'Höchste Platte' },
          { value: 'reps', label: 'Wdh.' },
        ]
      : hasWeight
        ? [
            { value: 'maxWeight', label: 'Gewicht' },
            { value: 'best1rm', label: 'Max-Kraft (geschätzt)' },
            { value: 'volume', label: 'Volumen' },
            { value: 'reps', label: 'Wdh.' },
          ]
        : [{ value: 'reps', label: 'Wdh.' }];
  const metric = metricPick && metrics.some((m) => m.value === metricPick) ? metricPick : metrics[0].value;

  const points = timed
    ? cardio.map((p) => ({ x: p.date, y: metric === 'distance' ? p.distanceKm : metric === 'pace' ? (p.pace ?? 0) : p.durationMin })).filter((p) => (metric === 'pace' ? p.y > 0 : true))
    : series.map((p) => ({ x: p.date, y: metric === 'maxWeight' ? p.maxWeight : metric === 'best1rm' ? p.best1rm : metric === 'volume' ? p.volume : p.reps })).filter((p) => (metric === 'best1rm' ? p.y > 0 : true));

  const fmtValue = (v: number): string => {
    if (metric === 'duration') return `${round1(v)} min`;
    if (metric === 'distance') return `${round1(v)} km`;
    if (metric === 'pace') return formatPace(v);
    if (metric === 'reps') return `${formatNumber(Math.round(v))} Wdh.`;
    if (unit === 'platte') return `Platte ${formatNumber(v)}`;
    if (metric === 'volume') return `${formatNumber(Math.round(v))} kg`;
    return `${round1(v)} kg`;
  };

  const total = timed ? all.cardio.length : (unit === 'kg' ? all.kg : all.platte).length;
  const first = points[0];
  const last = points[points.length - 1];
  const change = first && last && points.length > 1 ? last.y - first.y : undefined;
  const record = recordList(sessions).find((r) => r.exerciseId === id && r.unit === (timed ? 'kg' : unit));
  const suggestion = suggestNext(sessions, ex, eq);

  return (
    <div className="screen">
      <ScreenHeader
        back={<BackButton to="/fortschritt" label="Fortschritt" />}
        eyebrow="Fortschritt"
        title={ex.name}
        right={
          <button className="btn small" onClick={() => nav(`/uebungen/uebung/${ex.id}`)}>
            Übung
          </button>
        }
      />

      {total === 0 ? (
        <EmptyState title="Noch keine Werte" text="Sobald du diese Übung in einer abgeschlossenen Einheit trainiert hast, erscheint hier die Kurve." />
      ) : (
        <>
          {hasBothUnits && (
            <Segmented
              value={unit}
              options={[
                { value: 'kg', label: 'Kilogramm' },
                { value: 'platte', label: 'Plattennummer' },
              ]}
              onChange={(v) => {
                setUnitPick(v);
                setMetricPick(undefined);
              }}
            />
          )}
          <section className="card">
            <div className="card-title">Verlauf</div>
            <Segmented value={range} options={RANGE_OPTIONS} onChange={setRange} />
            {metrics.length > 1 && <Segmented value={metric} options={metrics} onChange={setMetricPick} />}
            {points.length === 0 ? (
              <p className="muted">In diesem Zeitraum gibt es keine Werte. Wähle einen längeren Zeitraum.</p>
            ) : (
              <>
                <LineChart points={points} formatValue={fmtValue} formatDate={fmtDate} label={`${ex.name}, ${metrics.find((m) => m.value === metric)?.label}`} />
                {change !== undefined && (
                  <p className="muted small">
                    Im gewählten Zeitraum: {change > 0 ? '+' : ''}
                    {metric === 'pace' ? formatPace(Math.abs(change)).replace(' min/km', '') + ' min/km' : fmtValue(change).replace(/^Platte /, '')}
                    {metric === 'pace' && (change < 0 ? ' (schneller)' : change > 0 ? ' (langsamer)' : '')}
                  </p>
                )}
              </>
            )}
            {unit === 'kg' && !timed && metric === 'best1rm' && <p className="muted small">Geschätzte Maximalkraft nach Epley: Gewicht × (1 + Wdh. ÷ 30) – ein Richtwert, kein Test.</p>}
          </section>

          <div className="stat-grid">
            <div className="stat">
              <div className="stat-val">{total}</div>
              <div className="stat-label">Einheiten</div>
            </div>
            {record && !timed && (
              <div className="stat wide">
                <div className="stat-val">{record.unit === 'platte' ? `Platte ${formatNumber(record.weight)}` : `${formatNumber(record.weight)} kg`} × {record.reps}</div>
                <div className="stat-label">Rekord · {fmtDate(record.date)}</div>
              </div>
            )}
          </div>

          {suggestion && (
            <section className="card">
              <div className="card-title">Vorschlag fürs nächste Mal</div>
              <p className={'suggest ' + suggestion.kind}>{suggestion.text}</p>
              {suggestion.stalled && (
                <p className="muted small">
                  Seit mehreren Einheiten keine Steigerung. Ein paar Wochen mit etwas weniger Gewicht oder eine Übungsvariante können helfen – ein leichteres Training (Deload) ist keine Schwäche.
                </p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
