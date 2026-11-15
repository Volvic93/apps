import { useNavigate } from 'react-router-dom';
import { db, getSettings, saveSettings } from '../data/db';
import { useRef } from 'react';
import { activatePlan, createDeloadPlan, startSession } from '../data/repo';
import { suggestNextWorkout } from '../logic/stats';
import { computeHints, dismissHint, visibleHints, type Hint } from '../logic/hints';
import { useCatalog } from './ExercisePicker';
import { useLive } from './hooks';
import { useUi } from './kit';

/** Hinweiskarten auf „Heute“ (höchstens zwei): Begründung, „Jetzt angehen“, „Später“, „Nicht mehr zeigen“. */
export function HintCards() {
  const nav = useNavigate();
  const { toast } = useUi();
  const cat = useCatalog();
  const busy = useRef(false);
  const data = useLive(async () => {
    const [settings, plans, sessions] = await Promise.all([getSettings(), db.plans.toArray(), db.sessions.toArray()]);
    return { settings, plans, sessions };
  });
  if (!data || !cat) return null;
  const now = Date.now();
  const hints = computeHints({ now, settings: data.settings, plans: data.plans, sessions: data.sessions, exercises: cat.exMap, equipment: cat.eqMap });
  const shown = visibleHints(hints, data.settings.dismissedHints, now);
  if (!shown.length) return null;

  const dismiss = async (h: Hint, mode: 'never' | 'later') => {
    await saveSettings({ dismissedHints: dismissHint(data.settings.dismissedHints, h.key, mode, Date.now()) });
    toast(mode === 'later' ? 'In einer Woche wieder' : 'Wird nicht mehr gezeigt');
  };

  const go = async (h: Hint) => {
    const a = h.action;
    if (a.kind === 'assistant') nav('/plaene/assistent');
    else if (a.kind === 'exercise') nav(`/fortschritt/uebung/${a.exerciseId}`);
    else if (a.kind === 'plan') {
      if (a.note) toast(a.note);
      nav(`/plaene/${a.planId}`);
    }
    else if (a.kind === 'activate') {
      await activatePlan(a.planId);
      toast('Plan wieder aktiv');
      nav('/heute');
    }
    else if (a.kind === 'backup') nav('/einstellungen');
    else if (a.kind === 'studio') nav('/uebungen/studio');
    else if (a.kind === 'equipment') nav(`/uebungen/geraet-bearbeiten/${a.equipmentId}`);
    else if (a.kind === 'start') {
      if (busy.current) return;
      busy.current = true;
      try {
        const p = data.plans.find((x) => x.id === a.planId);
        const nextId = p ? suggestNextWorkout(p.workouts, data.sessions.filter((s) => s.endedAt !== undefined), p.id) : undefined;
        if (p && nextId) {
          await startSession(p.id, nextId);
          toast('Training gestartet – gehe heute etwa 30 % leichter ran');
        }
        nav('/training');
      } finally {
        busy.current = false;
      }
    }
    else if (a.kind === 'deload') {
      if (busy.current) return; // Doppeltipp legt sonst zwei Pläne an
      busy.current = true;
      try {
        const p = await createDeloadPlan(a.planId);
        if (p) {
          toast('Entlastungsplan als Entwurf angelegt – aktiviere ihn für eine Woche, danach führt dich Heute zurück');
          nav(`/plaene/${p.id}`);
        }
      } finally {
        busy.current = false;
      }
    }
  };

  return (
    <>
      {shown.map((h) => (
        <section key={h.key} className="card hint-card" aria-label="Empfehlung">
          <div className="eyebrow">Empfehlung</div>
          <div className="row-title">{h.title}</div>
          <p className="hint-why">{h.why}</p>
          <div className="row gap wrap">
            <button className="btn small primary" onClick={() => go(h)}>
              {h.action.label}
            </button>
            <button className="btn small" onClick={() => dismiss(h, 'later')}>
              Später
            </button>
            <button className="btn small ghost" onClick={() => dismiss(h, 'never')}>
              Nicht mehr zeigen
            </button>
          </div>
        </section>
      ))}
    </>
  );
}
