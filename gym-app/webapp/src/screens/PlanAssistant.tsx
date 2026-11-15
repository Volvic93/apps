import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, getSettings } from '../data/db';
import { MUSCLE_GROUPS, type MuscleGroupId } from '../data/muscles';
import { savePlanFromAssistant } from '../data/repo';
import { GOAL_LABEL, type Goal } from '../data/types';
import { generatePlan, type AssistantResult } from '../logic/assistant';
import { formatNumber, weightUnit } from '../logic/progression';
import { exerciseGroups } from '../logic/catalog';
import { ExercisePicker, useCatalog } from '../ui/ExercisePicker';
import { BackButton, ScreenHeader } from '../ui/Header';
import { useLive } from '../ui/hooks';
import { IconClose, IconSwap } from '../ui/Icons';
import { Chip, useUi } from '../ui/kit';

const STEPS = ['Ziel', 'Trainingstage', 'Zeit', 'Schwerpunkte', 'Laufzeit'];
const DESC: Record<Goal, string> = {
  muskelaufbau: '8–12 Wiederholungen, mittlere Pausen – Muskeln aufbauen.',
  kraft: '4–6 Wiederholungen bei den Grundübungen, lange Pausen – stärker werden.',
  fitness: '12–15 Wiederholungen, kurze Pausen, ein Ausdauerabschluss – allgemein fit werden und Fett abbauen.',
};

/** Plan-Assistent: fünf Fragen, dann ein Vorschlag mit Begründung, den du anpasst und speicherst. */
export function PlanAssistant() {
  const nav = useNavigate();
  const { toast, confirm } = useUi();
  const cat = useCatalog();
  const settings = useLive(() => getSettings());
  const data = useLive(async () => ({ sessions: await db.sessions.toArray(), plans: await db.plans.toArray() }));
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal | undefined>(undefined);
  const [days, setDays] = useState<number | undefined>(undefined);
  const [minutes, setMinutes] = useState(60);
  const [focus, setFocus] = useState<MuscleGroupId[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [general, setGeneral] = useState(false);
  const [weeks, setWeeks] = useState<number | undefined>(undefined);
  const [pickExclude, setPickExclude] = useState(false);
  const [result, setResult] = useState<AssistantResult | undefined>(undefined);
  const [swap, setSwap] = useState<{ w: number; i: number } | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const g: Goal = goal ?? settings?.profile.goal ?? 'muskelaufbau';
  const d = days ?? Math.min(6, Math.max(2, settings?.profile.daysPerWeek ?? 3)); // der Assistent plant 2–6 Tage
  const wk = weeks ?? settings?.planWeeksDefault ?? 8;
  const trainedBefore = useMemo(() => data?.sessions.filter((s) => s.endedAt !== undefined).length ?? 0, [data]);

  if (!cat || !settings || !data) return <div className="screen" />;

  const build = () => {
    setResult(
      generatePlan({
        goal: g,
        days: d,
        minutes,
        weeks: wk,
        focus,
        excludedExerciseIds: excluded,
        allowGeneral: general,
        exercises: cat.exercises,
        equipment: cat.eqMap,
        sessions: data.sessions,
        plans: data.plans,
      }),
    );
  };

  const update = (fn: (r: AssistantResult) => AssistantResult) => setResult((r) => (r ? fn(r) : r));

  const save = async (activate: boolean) => {
    if (!result) return;
    if (activate && data.plans.some((p) => p.status === 'aktiv')) {
      const ok = await confirm({ title: 'Aktiven Plan ersetzen?', message: 'Der bisherige aktive Plan wird zu „Weitere Pläne“. Deine Trainings bleiben erhalten.', confirmLabel: 'Aktivieren' });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const p = await savePlanFromAssistant(result, activate);
      toast(activate ? 'Plan ist jetzt aktiv' : 'Plan als Entwurf gespeichert');
      nav(`/plaene/${p.id}`, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------------------------ Vorschau
  if (result) {
    const total = result.workouts.reduce((a, w) => a + w.items.length, 0);
    return (
      <div className="screen">
        <ScreenHeader back={<BackButton to="/plaene" label="Pläne" />} title="Dein Vorschlag" eyebrow="Plan-Assistent" />
        <section className="card">
          <div className="row-title">{result.name}</div>
          <div className="row-sub">
            {result.workouts.length} Einheiten · {total} Übungen · {result.plannedWeeks} Wochen
          </div>
          <ul className="plain-list">
            {result.summary.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          {result.warnings.length > 0 && (
            <div className="notice warn">
              <b>Hinweis. </b>
              {result.warnings.join(' ')}
            </div>
          )}
        </section>
        {result.workouts.map((w, wi) => (
          <section key={wi} className="card">
            <div className="card-title">{w.name}</div>
            <p className="muted small">{w.why}</p>
            <div className="list flat">
              {w.items.map((it, ii) => {
                const ex = cat.exMap.get(it.exerciseId);
                const platte = weightUnit(ex?.equipmentId ? cat.eqMap.get(ex.equipmentId) : undefined) === 'platte';
                return (
                  <div key={it.id} className="list-row static import-row">
                    <div className="grow">
                      <div className="row-title">{ex?.name ?? 'Übung'}</div>
                      <div className="row-sub">
                        {it.sets} × {it.repMin === it.repMax ? it.repMin : `${it.repMin}–${it.repMax}`} · Pause {it.restSec} s{it.targetWeight ? (platte ? ` · Platte ${formatNumber(it.targetWeight)}` : ` · ${formatNumber(it.targetWeight)} kg`) : ''}
                      </div>
                      <details className="why">
                        <summary>Warum?</summary>
                        <span>{it.roleLabel ? `${it.roleLabel}: ${it.why}.` : `${it.why[0].toUpperCase()}${it.why.slice(1)}.`}</span>
                      </details>
                    </div>
                    <button className="icon-btn" aria-label={`${ex?.name ?? 'Übung'} tauschen`} onClick={() => setSwap({ w: wi, i: ii })}>
                      <IconSwap size={20} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={`${ex?.name ?? 'Übung'} entfernen`}
                      onClick={() => update((r) => ({ ...r, workouts: r.workouts.map((x, k) => (k === wi ? { ...x, items: x.items.filter((_, j) => j !== ii) } : x)) }))}
                    >
                      <IconClose size={20} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        <div className="stack">
          <button className="btn primary block big" disabled={busy || total === 0} onClick={() => save(true)}>
            Speichern und aktivieren
          </button>
          <button className="btn block" disabled={busy || total === 0} onClick={() => save(false)}>
            Als Entwurf speichern
          </button>
          <button className="btn ghost block" onClick={() => setResult(undefined)}>
            Antworten ändern
          </button>
        </div>
        <ExercisePicker
          open={!!swap}
          onClose={() => setSwap(undefined)}
          title="Übung tauschen"
          initialGroup={swap ? (() => { const cur = result.workouts[swap.w]?.items[swap.i]; const e = cur ? cat.exMap.get(cur.exerciseId) : undefined; return e ? (exerciseGroups(e)[0] ?? null) : null; })() : null}
          onPick={(ex) => {
            if (swap) {
              update((r) => ({
                ...r,
                workouts: r.workouts.map((w, wi) =>
                  wi === swap.w
                    ? { ...w, items: w.items.map((it, ii) => (ii === swap.i ? { ...it, exerciseId: ex.id, targetWeight: undefined, roleLabel: '', why: 'von dir gewählt' } : it)) }
                    : w,
                ),
              }));
            }
            setSwap(undefined);
          }}
        />
      </div>
    );
  }

  // ------------------------------------------------------------------ Fragen
  const last = step === STEPS.length - 1;
  return (
    <div className="screen">
      <ScreenHeader back={<BackButton to="/plaene" label="Pläne" />} title={STEPS[step]} eyebrow={`Plan-Assistent · Schritt ${step + 1} von ${STEPS.length}`} />
      <div className="wiz-dots" aria-hidden="true">
        {STEPS.map((_, i) => (
          <span key={i} className={i <= step ? 'on' : ''} />
        ))}
      </div>
      {trainedBefore > 0 && step === 0 && <p className="muted small">Dein bisheriger Verlauf ({trainedBefore} Einheiten) fließt in den Vorschlag ein.</p>}

      {step === 0 && (
        <section className="card">
          <div className="card-title">Was ist dein Ziel?</div>
          <div className="stack">
            {(Object.keys(GOAL_LABEL) as Goal[]).map((x) => (
              <button key={x} className={'choice' + (g === x ? ' on' : '')} onClick={() => setGoal(x)} aria-pressed={g === x}>
                <b>{GOAL_LABEL[x]}</b>
                <span>{DESC[x]}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {step === 1 && (
        <section className="card">
          <div className="card-title">Wie oft pro Woche willst du trainieren?</div>
          <div className="chips wrap">
            {[2, 3, 4, 5, 6].map((x) => (
              <Chip key={x} on={d === x} onClick={() => setDays(x)}>
                {x} Tage
              </Chip>
            ))}
          </div>
          <p className="muted small">
            {d <= 3 ? 'Ganzkörper-Einheiten (A/B' + (d === 3 ? '/C' : '') + ').' : d === 4 ? 'Oberkörper/Unterkörper, je zweimal.' : d === 5 ? 'Push, Pull, Beine plus Oberkörper und Unterkörper.' : 'Push, Pull, Beine – zwei Durchgänge mit Varianten.'}
          </p>
        </section>
      )}
      {step === 2 && (
        <section className="card">
          <div className="card-title">Wie viel Zeit hast du pro Einheit?</div>
          <div className="chips wrap">
            {[45, 60, 90].map((x) => (
              <Chip key={x} on={minutes === x} onClick={() => setMinutes(x)}>
                {x} Minuten
              </Chip>
            ))}
          </div>
          <p className="muted small">Das bestimmt die Zahl der Übungen: 45 Min. → 5, 60 Min. → 6, 90 Min. → bis zu 7 Übungen (je nach Vorlage).</p>
        </section>
      )}
      {step === 3 && (
        <>
          <section className="card">
            <div className="card-title">Schwerpunkte (optional)</div>
            <p className="muted small">Für jede gewählte Muskelgruppe kommt je Einheit, die sie trainiert, eine zusätzliche Übung dazu.</p>
            <div className="chips wrap">
              {MUSCLE_GROUPS.map((m) => (
                <Chip key={m.id} on={focus.includes(m.id)} dot={m.color} onClick={() => setFocus(focus.includes(m.id) ? focus.filter((f) => f !== m.id) : [...focus, m.id])}>
                  {m.label}
                </Chip>
              ))}
            </div>
          </section>
          <section className="card">
            <div className="card-title">Ausschließen (z. B. bei Beschwerden)</div>
            {excluded.length === 0 ? (
              <p className="muted small">Keine Übung ausgeschlossen.</p>
            ) : (
              <div className="chips wrap">
                {excluded.map((id) => (
                  <button key={id} className="chip on" onClick={() => setExcluded(excluded.filter((x) => x !== id))} aria-label={`${cat.exMap.get(id)?.name ?? id} wieder zulassen`}>
                    {cat.exMap.get(id)?.name ?? id} ✕
                  </button>
                ))}
              </div>
            )}
            <button className="btn small" onClick={() => setPickExclude(true)}>
              Übung ausschließen …
            </button>
            <label className="switch-row">
              <span>Auch Übungen außerhalb meines Studios verwenden (z. B. Kurzhanteln, Langhantel)</span>
              <input type="checkbox" checked={general} onChange={(e) => setGeneral(e.target.checked)} />
            </label>
          </section>
          <ExercisePicker
            open={pickExclude}
            onClose={() => setPickExclude(false)}
            title="Übung ausschließen"
            onPick={(ex) => {
              setExcluded((l) => (l.includes(ex.id) ? l : [...l, ex.id]));
              setPickExclude(false);
            }}
          />
        </>
      )}
      {step === 4 && (
        <section className="card">
          <div className="card-title">Wie lange soll der Plan laufen?</div>
          <div className="chips wrap">
            {[4, 6, 8, 10, 12, 16].map((x) => (
              <Chip key={x} on={wk === x} onClick={() => setWeeks(x)}>
                {x} Wochen
              </Chip>
            ))}
          </div>
          <p className="muted small">Danach schlägt dir die App einen neuen Plan vor. Üblich sind 6–8 Wochen.</p>
        </section>
      )}

      <div className="row gap">
        {step > 0 && (
          <button className="btn grow" onClick={() => setStep(step - 1)}>
            Zurück
          </button>
        )}
        <button className="btn primary grow big" onClick={() => (last ? build() : setStep(step + 1))}>
          {last ? 'Vorschlag erstellen' : 'Weiter'}
        </button>
      </div>
    </div>
  );
}
