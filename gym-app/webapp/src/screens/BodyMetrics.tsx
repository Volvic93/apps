import { useEffect, useMemo, useState } from 'react';
import { db } from '../data/db';
import { deleteBodyMetric, saveBodyMetric } from '../data/repo';
import { BODY_FIELDS, bodySeries, dayKey, rangeStart, RANGE_OPTIONS, type BodyKey, type Range } from '../logic/progress';
import { formatNumber } from '../logic/progression';
import { LineChart } from '../ui/Charts';
import { useLive } from '../ui/hooks';
import { IconTrash } from '../ui/Icons';
import { Chip, EmptyState, Field, NumberInput, Segmented, useUi } from '../ui/kit';

const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: '2-digit' });
const fmtDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
};
type Draft = Partial<Record<BodyKey, number | undefined>>;

/** Körperwerte: Gewicht und Umfänge eintragen und als Kurve verfolgen. */
export function BodyMetrics() {
  const { confirm, toast } = useUi();
  const metrics = useLive(async () => (await db.bodyMetrics.toArray()).sort((a, b) => b.date.localeCompare(a.date)));
  const [date, setDate] = useState(() => dayKey(new Date()));
  const [draft, setDraft] = useState<Draft>({});
  const [field, setField] = useState<BodyKey>('weightKg');
  const [range, setRange] = useState<Range>('6m');
  const [showMore, setShowMore] = useState(false);

  // Beim Wechsel des Tages die vorhandenen Werte laden
  const stored = metrics?.find((m) => m.date === date);
  const storedKey = stored ? `${stored.id}|${stored.updatedAt}` : date;
  useEffect(() => {
    setDraft(stored ? Object.fromEntries(BODY_FIELDS.map((f) => [f.key, stored[f.key]])) : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedKey, date]);

  const series = useMemo(() => (metrics ? bodySeries(metrics, field) : []), [metrics, field]);
  if (!metrics) return null;
  const from = rangeStart(range);
  const shown = series.filter((p) => from === undefined || p.date >= from);
  const def = BODY_FIELDS.find((f) => f.key === field)!;
  const today = dayKey(new Date());
  const change = shown.length > 1 ? shown[shown.length - 1].value - shown[0].value : undefined;

  const save = async () => {
    const any = BODY_FIELDS.some((f) => draft[f.key] !== undefined);
    if (!any && !stored) return toast('Bitte mindestens einen Wert eintragen.', 'error');
    const values: Draft = {};
    for (const f of BODY_FIELDS) {
      const v = draft[f.key];
      if (v !== undefined && !(v > 0 && v <= (f.unit === 'kg' ? 500 : 300))) return toast(`„${f.label}“: bitte einen Wert zwischen 0 und ${f.unit === 'kg' ? 500 : 300} ${f.unit} eintragen.`, 'error');
      values[f.key] = v;
    }
    await saveBodyMetric(date, values);
    toast(any ? 'Gespeichert' : 'Eintrag gelöscht');
  };
  const remove = async (id: string, key: string) => {
    if (await confirm({ title: 'Eintrag löschen?', message: `Die Körperwerte vom ${fmtDay(key)} werden gelöscht.`, confirmLabel: 'Löschen', danger: true })) await deleteBodyMetric(id);
  };

  return (
    <>
      <section className="card">
        <div className="card-title">Eintragen</div>
        <Field label="Datum">
          <input className="input" type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
        <Field label="Körpergewicht (kg)">
          <NumberInput value={draft.weightKg} onChange={(v) => setDraft((d) => ({ ...d, weightKg: v }))} placeholder="–" ariaLabel="Körpergewicht in Kilogramm" />
        </Field>
        <button className="btn ghost small" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}>
          {showMore ? 'Umfänge ausblenden' : 'Umfänge eintragen (optional)'}
        </button>
        {(showMore || BODY_FIELDS.some((f) => f.key !== 'weightKg' && draft[f.key] !== undefined)) && (
          <div className="grid3">
            {BODY_FIELDS.filter((f) => f.key !== 'weightKg').map((f) => (
              <Field key={f.key} label={`${f.label} (cm)`}>
                <NumberInput value={draft[f.key]} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} placeholder="–" ariaLabel={`${f.label} in Zentimetern`} />
              </Field>
            ))}
          </div>
        )}
        <button className="btn primary" onClick={save}>
          {stored ? 'Eintrag aktualisieren' : 'Speichern'}
        </button>
        {stored && <p className="muted small">Für diesen Tag gibt es schon einen Eintrag – ein leeres Feld löscht den Wert.</p>}
      </section>

      <section className="card">
        <div className="card-title">Verlauf</div>
        <div className="chips wrap">
          {BODY_FIELDS.map((f) => (
            <Chip key={f.key} on={f.key === field} onClick={() => setField(f.key)}>
              {f.label}
            </Chip>
          ))}
        </div>
        <Segmented value={range} options={RANGE_OPTIONS} onChange={setRange} />
        {series.length === 0 ? (
          <p className="muted">Noch keine Werte für „{def.label}“.</p>
        ) : shown.length === 0 ? (
          <p className="muted">In diesem Zeitraum gibt es keine Werte. Wähle einen längeren Zeitraum.</p>
        ) : (
          <>
            <LineChart points={shown.map((p) => ({ x: p.date, y: p.value }))} formatValue={(v) => `${formatNumber(Math.round(v * 10) / 10)} ${def.unit}`} formatDate={fmtDate} label={def.label} color="var(--sys-teal)" />
            {change !== undefined && (
              <p className="muted small">
                Im gewählten Zeitraum: {change > 0 ? '+' : ''}
                {formatNumber(Math.round(change * 10) / 10)} {def.unit}
              </p>
            )}
          </>
        )}
      </section>

      <section>
        <div className="section-label">Einträge</div>
        {metrics.length === 0 ? (
          <EmptyState title="Noch keine Einträge" text="Trage dein Gewicht oder deine Umfänge ein, um die Entwicklung zu sehen." />
        ) : (
          <div className="list">
            {metrics.slice(0, 20).map((m) => (
              <div key={m.id} className="list-row static">
                <button className="grow plain" onClick={() => setDate(m.date)} aria-label={`Eintrag vom ${fmtDay(m.date)} bearbeiten`}>
                  <div className="row-title">{fmtDay(m.date)}</div>
                  <div className="row-sub">
                    {BODY_FIELDS.filter((f) => m[f.key] !== undefined)
                      .map((f) => `${f.key === 'weightKg' ? '' : f.label + ' '}${formatNumber(m[f.key] as number)} ${f.unit}`)
                      .join(' · ')}
                  </div>
                </button>
                <button className="icon-btn" aria-label="Eintrag löschen" onClick={() => remove(m.id, m.date)}>
                  <IconTrash size={20} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
