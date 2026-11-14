import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, getSettings } from '../data/db';
import { mergePlans, moveInList } from '../data/repo';
import { useCatalog } from '../ui/ExercisePicker';
import { BackButton, ScreenHeader } from '../ui/Header';
import { useLive } from '../ui/hooks';
import { IconArrowDown, IconArrowUp, IconClose } from '../ui/Icons';
import { Chip, EmptyState, Field, useUi } from '../ui/kit';

type Pick = { planId: string; workoutId: string };

/** Pläne zusammenführen: Einheiten aus beliebigen Plänen wählen, Reihenfolge festlegen, als neuen Plan speichern. */
export function PlanMerge() {
  const nav = useNavigate();
  const { toast } = useUi();
  const cat = useCatalog();
  const plans = useLive(() => db.plans.toArray());
  const [picks, setPicks] = useState<Pick[]>([]);
  const [name, setName] = useState('');
  const settings = useLive(() => getSettings());
  const [weeksPick, setWeeks] = useState<number | undefined>(undefined);
  const weeks = weeksPick ?? settings?.planWeeksDefault ?? 8;
  const [busy, setBusy] = useState(false);

  if (!plans || !cat) return <div className="screen" />;
  const sorted = [...plans].sort((a, b) => (a.status === 'aktiv' ? -1 : b.status === 'aktiv' ? 1 : b.updatedAt - a.updatedAt));
  const withWorkouts = sorted.filter((p) => p.workouts.length > 0);
  const isPicked = (planId: string, workoutId: string) => picks.some((p) => p.planId === planId && p.workoutId === workoutId);
  const toggle = (planId: string, workoutId: string) => setPicks(isPicked(planId, workoutId) ? picks.filter((p) => !(p.planId === planId && p.workoutId === workoutId)) : [...picks, { planId, workoutId }]);
  const label = (pk: Pick) => {
    const p = plans.find((x) => x.id === pk.planId);
    const w = p?.workouts.find((x) => x.id === pk.workoutId);
    return { plan: p?.name ?? '?', workout: w?.name ?? '?', count: w?.items.length ?? 0 };
  };

  const save = async () => {
    setBusy(true);
    try {
      const p = await mergePlans(picks, name, weeks);
      if (!p) return toast('Es wurde keine Einheit gefunden.', 'error');
      toast('Neuer Plan als Entwurf angelegt');
      nav(`/plaene/${p.id}`, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <ScreenHeader back={<BackButton to="/plaene" label="Pläne" />} title="Pläne zusammenführen" eyebrow="Pläne" />
      {withWorkouts.length === 0 ? (
        <EmptyState title="Noch keine Einheiten" text="Lege zuerst Pläne mit Einheiten an." />
      ) : (
        <>
          <p className="muted">Wähle die Einheiten, die in den neuen Plan sollen – auch aus verschiedenen Plänen. Die Originale bleiben unverändert.</p>
          {withWorkouts.map((p) => (
            <section key={p.id}>
              <div className="section-label">{p.name}</div>
              <div className="chips wrap">
                {p.workouts.map((w) => (
                  <Chip key={w.id} on={isPicked(p.id, w.id)} onClick={() => toggle(p.id, w.id)}>
                    {w.name} · {w.items.length}
                  </Chip>
                ))}
              </div>
            </section>
          ))}

          <section className="card">
            <div className="card-title">
              Neuer Plan ({picks.length} {picks.length === 1 ? 'Einheit' : 'Einheiten'})
            </div>
            {picks.length === 0 ? (
              <p className="muted small">Noch nichts gewählt.</p>
            ) : (
              <div className="list flat">
                {picks.map((pk, i) => {
                  const l = label(pk);
                  return (
                    <div key={`${pk.planId}${pk.workoutId}`} className="list-row static">
                      <div className="grow">
                        <div className="row-title">{l.workout}</div>
                        <div className="row-sub">
                          aus „{l.plan}“ · {l.count} Übungen
                        </div>
                      </div>
                      <button className="icon-btn" aria-label="Nach oben" disabled={i === 0} onClick={() => setPicks(moveInList(picks, i, -1))}>
                        <IconArrowUp size={20} />
                      </button>
                      <button className="icon-btn" aria-label="Nach unten" disabled={i === picks.length - 1} onClick={() => setPicks(moveInList(picks, i, 1))}>
                        <IconArrowDown size={20} />
                      </button>
                      <button className="icon-btn" aria-label="Entfernen" onClick={() => toggle(pk.planId, pk.workoutId)}>
                        <IconClose size={20} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <Field label="Name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Mein Mix" />
            </Field>
            <div className="section-label">Laufzeit</div>
            <div className="chips wrap">
              {[4, 6, 8, 10, 12, 16].map((w) => (
                <Chip key={w} on={weeks === w} onClick={() => setWeeks(w)}>
                  {w} Wochen
                </Chip>
              ))}
            </div>
          </section>
          <button className="btn primary block big" disabled={busy || picks.length === 0} onClick={save}>
            Als neuen Plan speichern
          </button>
        </>
      )}
    </div>
  );
}
