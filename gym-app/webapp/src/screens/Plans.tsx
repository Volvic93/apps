import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../data/db';
import { createPlan, duplicatePlan } from '../data/repo';
import { GOAL_LABEL, type Goal, type Plan } from '../data/types';
import { planWeek, planWeekLabel } from '../logic/stats';
import { getSettings } from '../data/db';
import { ScreenHeader } from '../ui/Header';
import { useLive } from '../ui/hooks';
import { IconChevronRight, IconPlus } from '../ui/Icons';
import { Chip, EmptyState, Field, Sheet } from '../ui/kit';

export function PlanCard({ plan, onClick }: { plan: Plan; onClick: () => void }) {
  const n = plan.workouts.reduce((a, w) => a + w.items.length, 0);
  return (
    <button className={'card plan-card' + (plan.status === 'aktiv' ? ' active' : '')} onClick={onClick}>
      <div className="plan-card-main">
        <div className="row-title">{plan.name}</div>
        <div className="row-sub">
          {plan.workouts.length} {plan.workouts.length === 1 ? 'Einheit' : 'Einheiten'} · {n} Übungen
          {plan.goal ? ` · ${plan.goal}` : ''}
        </div>
        {plan.status === 'aktiv' && (
          <div className="progress-line">
            <div className="progress-fill" style={{ width: `${Math.min(100, (planWeek(plan.startedAt) / Math.max(1, plan.plannedWeeks)) * 100)}%` }} />
          </div>
        )}
        {plan.status === 'aktiv' && (
          <div className="row-sub">
            {planWeekLabel(plan.startedAt, plan.plannedWeeks)}
          </div>
        )}
      </div>
      <IconChevronRight size={18} className="chev" />
    </button>
  );
}

export function Plans() {
  const nav = useNavigate();
  const plans = useLive(() => db.plans.toArray());
  const [open, setOpen] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState<Goal>('muskelaufbau');
  const [weeks, setWeeks] = useState(8);

  const active = plans?.filter((p) => p.status === 'aktiv') ?? [];
  const drafts = plans?.filter((p) => p.status === 'entwurf').sort((a, b) => b.updatedAt - a.updatedAt) ?? [];
  const archived = plans?.filter((p) => p.status === 'archiv').sort((a, b) => b.updatedAt - a.updatedAt) ?? [];

  const startCreate = async () => {
    const s = await getSettings();
    setWeeks(s.planWeeksDefault);
    setGoal(s.profile.goal);
    setName('');
    setOpen(true);
  };

  const create = async () => {
    const p = await createPlan({ name, goal: GOAL_LABEL[goal], plannedWeeks: weeks });
    setOpen(false);
    nav(`/plaene/${p.id}`);
  };

  return (
    <div className="screen">
      <ScreenHeader
        title="Pläne"
        right={
          <button className="icon-btn" aria-label="Neuen Plan anlegen" onClick={startCreate}>
            <IconPlus size={24} />
          </button>
        }
      />

      {plans && plans.length === 0 && (
        <EmptyState
          title="Noch kein Plan"
          text="Lege einen Plan mit mehreren Einheiten an – zum Beispiel Push, Pull und Beine – und trainiere ihn im Trainingsmodus."
          action={
            <button className="btn primary" onClick={startCreate}>
              Ersten Plan anlegen
            </button>
          }
        />
      )}

      {active.length > 0 && (
        <>
          <div className="section-label">Aktiver Plan</div>
          {active.map((p) => (
            <PlanCard key={p.id} plan={p} onClick={() => nav(`/plaene/${p.id}`)} />
          ))}
        </>
      )}
      {drafts.length > 0 && (
        <>
          <div className="section-label">Weitere Pläne</div>
          <div className="stack">
            {drafts.map((p) => (
              <PlanCard key={p.id} plan={p} onClick={() => nav(`/plaene/${p.id}`)} />
            ))}
          </div>
        </>
      )}
      {archived.length > 0 && (
        <>
          <button className="linkish" onClick={() => setShowArchive((v) => !v)}>
            Archiv ({archived.length}) {showArchive ? 'verbergen' : 'anzeigen'}
          </button>
          {showArchive && (
            <div className="stack">
              {archived.map((p) => (
                <PlanCard key={p.id} plan={p} onClick={() => nav(`/plaene/${p.id}`)} />
              ))}
            </div>
          )}
        </>
      )}
      <div className="section-label">Planen</div>
      <div className="list">
        <button className="list-row" onClick={() => nav('/plaene/assistent')}>
          <div className="grow">
            <div className="row-title">Plan-Assistent</div>
            <div className="row-sub">Fünf Fragen, dann ein Vorschlag aus deinen Geräten – ohne Internet</div>
          </div>
          <IconChevronRight size={18} className="chev" />
        </button>
        <button className="list-row" onClick={() => nav('/plaene/ki')}>
          <div className="grow">
            <div className="row-title">Mit KI planen</div>
            <div className="row-sub">Text für eine KI erzeugen und die Antwort importieren</div>
          </div>
          <IconChevronRight size={18} className="chev" />
        </button>
        <button className="list-row" onClick={() => nav('/plaene/importieren')}>
          <div className="grow">
            <div className="row-title">Plan importieren</div>
            <div className="row-sub">Exportierten Plan einfügen oder als Datei wählen</div>
          </div>
          <IconChevronRight size={18} className="chev" />
        </button>
        {plans && plans.some((p) => p.workouts.length > 0) && (
          <button className="list-row" onClick={() => nav('/plaene/zusammenfuehren')}>
            <div className="grow">
              <div className="row-title">Pläne zusammenführen</div>
              <div className="row-sub">Einheiten aus mehreren Plänen zu einem neuen Plan kombinieren</div>
            </div>
            <IconChevronRight size={18} className="chev" />
          </button>
        )}
      </div>
      {plans && plans.length > 0 && (
        <button
          className="btn block ghost"
          onClick={async () => {
            const src = plans.find((p) => p.status === 'aktiv') ?? plans[0];
            const c = await duplicatePlan(src.id);
            if (c) nav(`/plaene/${c.id}`);
          }}
        >
          {plans.some((p) => p.status === 'aktiv') ? 'Aktiven Plan duplizieren und abwandeln' : 'Letzten Plan duplizieren'}
        </button>
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Neuer Plan"
        footer={
          <button className="btn primary block" onClick={create}>
            Plan anlegen
          </button>
        }
      >
        <Field label="Name">
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Push / Pull / Beine" />
        </Field>
        <div className="section-label">Ziel</div>
        <div className="chips wrap">
          {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
            <Chip key={g} on={goal === g} onClick={() => setGoal(g)}>
              {GOAL_LABEL[g]}
            </Chip>
          ))}
        </div>
        <div className="section-label">Laufzeit</div>
        <div className="chips wrap">
          {[4, 6, 8, 10, 12, 16].map((w) => (
            <Chip key={w} on={weeks === w} onClick={() => setWeeks(w)}>
              {w} Wochen
            </Chip>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
