import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, getSettings } from '../data/db';
import { activatePlan, copyWorkout, deletePlan, duplicatePlan, moveInList, newPlanItem, newWorkout, savePlan, setPlanStatus, startSession } from '../data/repo';
import type { Exercise, Plan, PlanItem, Workout } from '../data/types';
import { formatNumber, weightUnit } from '../logic/progression';
import { planToFile } from '../logic/planio';
import { planWeekLabel } from '../logic/stats';
import { platform } from '../platform';
import { EquipmentThumb } from '../ui/EquipmentCard';
import { ExercisePicker, useCatalog, type Catalog } from '../ui/ExercisePicker';
import { MissingPhotos } from '../ui/MissingPhotos';
import { BackButton, ScreenHeader } from '../ui/Header';
import { useLive } from '../ui/hooks';
import { IconArrowDown, IconArrowUp, IconCopy, IconDots, IconPlay, IconPlus, IconTrash } from '../ui/Icons';
import { Field, NumberInput, Sheet, useUi } from '../ui/kit';
import { Stepper } from '../ui/Stepper';

function DraftInput({ value, onCommit, placeholder, className, label }: { value: string; onCommit: (v: string) => void; placeholder?: string; className?: string; label: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      className={className ?? 'input'}
      value={v}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() !== value && onCommit(v.trim())}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
    />
  );
}

function itemSummary(it: PlanItem, ex: Exercise | undefined, platte = false): string {
  if (ex?.tracking === 'cardio' || ex?.tracking === 'zeit') return ex.tracking === 'zeit' ? `${it.sets} × Dauer` : 'Cardio';
  const reps = it.repMin === it.repMax ? `${it.repMin}` : `${it.repMin}–${it.repMax}`;
  const parts = [`${it.sets} × ${reps}${ex?.unilateral ? ' je Seite' : ''}`, it.restSec ? `Pause ${it.restSec} s` : undefined, it.targetWeight ? (platte ? `Platte ${formatNumber(it.targetWeight)}` : `${formatNumber(it.targetWeight)} kg`) : undefined];
  return parts.filter(Boolean).join(' · ');
}

export function PlanEditor() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { confirm, toast } = useUi();
  const plan = useLive(() => db.plans.get(id), [id]);
  const allPlans = useLive(() => db.plans.toArray());
  const cat = useCatalog();
  const [menu, setMenu] = useState(false);
  const [pickFor, setPickFor] = useState<string | null>(null); // workoutId
  const [editing, setEditing] = useState<{ workoutId: string; itemId: string } | null>(null);
  const [addWorkout, setAddWorkout] = useState(false);
  const [workoutName, setWorkoutName] = useState('');
  const [copyOpen, setCopyOpen] = useState(false);

  if (plan === undefined || !cat) return <div className="screen" />;
  if (!plan) {
    return (
      <div className="screen">
        <BackButton to="/plaene" />
        <p className="muted">Diesen Plan gibt es nicht mehr.</p>
      </div>
    );
  }

  const update = (p: Plan) => savePlan(p);
  const setWorkout = (wid: string, fn: (w: Workout) => Workout) => update({ ...plan, workouts: plan.workouts.map((w) => (w.id === wid ? fn(w) : w)) });

  const addItem = async (workoutId: string, ex: Exercise) => {
    const s = await getSettings();
    setWorkout(workoutId, (w) => ({ ...w, items: [...w.items, newPlanItem(ex, s.defaultRestSec)] }));
    setPickFor(null);
  };

  const start = async (w: Workout) => {
    if (w.items.length === 0) return toast('Diese Einheit hat noch keine Übungen.', 'error');
    const s = await startSession(plan.id, w.id);
    if (s) nav('/training');
  };

  const editingItem = editing ? plan.workouts.find((w) => w.id === editing.workoutId)?.items.find((i) => i.id === editing.itemId) : undefined;

  return (
    <div className="screen">
      <ScreenHeader
        back={<BackButton to="/plaene" label="Pläne" />}
        eyebrow={plan.status === 'aktiv' ? `Aktiv · ${planWeekLabel(plan.startedAt, plan.plannedWeeks)}` : plan.status === 'archiv' ? 'Archiv' : 'Plan'}
        title={plan.name}
        right={
          <button className="icon-btn" aria-label="Planaktionen" onClick={() => setMenu(true)}>
            <IconDots size={24} />
          </button>
        }
      />

      <section className="card">
        <Field label="Name">
          <DraftInput label="Planname" value={plan.name} onCommit={(v) => v && update({ ...plan, name: v })} />
        </Field>
        <Field label="Ziel">
          <DraftInput label="Ziel" value={plan.goal} placeholder="z. B. Muskelaufbau" onCommit={(v) => update({ ...plan, goal: v })} />
        </Field>
        <div className="row between">
          <span className="field-label">Laufzeit</span>
          <Stepper
            compact
            label="Laufzeit in Wochen"
            decimals={false}
            value={plan.plannedWeeks}
            unit="Wo."
            onStep={(d) => update({ ...plan, plannedWeeks: Math.min(52, Math.max(1, plan.plannedWeeks + d)) })}
            onSet={(v) => v && update({ ...plan, plannedWeeks: Math.round(Math.min(52, Math.max(1, v))) })}
          />
        </div>
        {plan.status !== 'aktiv' && plan.status !== 'archiv' && (
          <button className="btn primary block" onClick={async () => { await activatePlan(plan.id); toast('Plan ist jetzt aktiv'); }}>
            Plan aktivieren
          </button>
        )}
      </section>

      <MissingPhotos plan={plan} cat={cat} />

      {plan.workouts.map((w, wi) => (
        <section key={w.id} className="card workout">
          <div className="workout-head">
            <DraftInput className="input workout-name" label="Name der Einheit" value={w.name} onCommit={(v) => v && setWorkout(w.id, (x) => ({ ...x, name: v }))} />
            <div className="row">
              <button className="icon-btn sm" aria-label="Einheit nach oben" disabled={wi === 0} onClick={() => update({ ...plan, workouts: moveInList(plan.workouts, wi, -1) })}>
                <IconArrowUp size={18} />
              </button>
              <button className="icon-btn sm" aria-label="Einheit nach unten" disabled={wi === plan.workouts.length - 1} onClick={() => update({ ...plan, workouts: moveInList(plan.workouts, wi, 1) })}>
                <IconArrowDown size={18} />
              </button>
              <button
                className="icon-btn sm"
                aria-label="Einheit duplizieren"
                onClick={() => copyWorkout(plan.id, w.id, plan.id).then(() => toast('Einheit dupliziert'))}
              >
                <IconCopy size={18} />
              </button>
              <button
                className="icon-btn sm danger"
                aria-label="Einheit löschen"
                onClick={async () => {
                  if (await confirm({ title: `„${w.name}“ löschen?`, message: 'Bereits trainierte Einheiten bleiben im Verlauf.', confirmLabel: 'Löschen', danger: true })) {
                    update({ ...plan, workouts: plan.workouts.filter((x) => x.id !== w.id) });
                  }
                }}
              >
                <IconTrash size={18} />
              </button>
            </div>
          </div>

          <div className="list flat">
            {w.items.map((it, ii) => {
              const ex = cat.exMap.get(it.exerciseId);
              const eq = ex?.equipmentId ? cat.eqMap.get(ex.equipmentId) : undefined;
              return (
                <div key={it.id} className="list-row item-row">
                  <button className="item-main" onClick={() => setEditing({ workoutId: w.id, itemId: it.id })}>
                    <EquipmentThumb eq={eq} size={42} />
                    <div className="grow">
                      <div className="row-title">
                        {ex?.name ?? 'Unbekannte Übung'}
                        {it.supersetGroup && <span className="badge accent">SS{it.supersetGroup}</span>}
                      </div>
                      <div className="row-sub">{itemSummary(it, ex, weightUnit(eq) === 'platte')}</div>
                    </div>
                  </button>
                  <div className="col">
                    <button className="icon-btn xs" aria-label="Übung nach oben" disabled={ii === 0} onClick={() => setWorkout(w.id, (x) => ({ ...x, items: moveInList(x.items, ii, -1) }))}>
                      <IconArrowUp size={16} />
                    </button>
                    <button className="icon-btn xs" aria-label="Übung nach unten" disabled={ii === w.items.length - 1} onClick={() => setWorkout(w.id, (x) => ({ ...x, items: moveInList(x.items, ii, 1) }))}>
                      <IconArrowDown size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
            {w.items.length === 0 && <div className="empty-text pad">Noch keine Übungen.</div>}
          </div>
          <div className="row gap">
            <button className="btn small grow" onClick={() => setPickFor(w.id)}>
              <IconPlus size={18} /> Übung hinzufügen
            </button>
            <button className="btn small primary" onClick={() => start(w)} aria-label={`${w.name} starten`}>
              <IconPlay size={16} /> Starten
            </button>
          </div>
        </section>
      ))}

      <div className="stack">
        <button className="btn" onClick={() => { setWorkoutName(''); setAddWorkout(true); }}>
          <IconPlus size={18} /> Einheit hinzufügen
        </button>
        <button className="btn" onClick={() => setCopyOpen(true)}>
          <IconCopy size={18} /> Aus anderem Plan
        </button>
      </div>

      <ExercisePicker open={pickFor !== null} onClose={() => setPickFor(null)} onPick={(ex) => pickFor && addItem(pickFor, ex)} />

      <Sheet
        open={addWorkout}
        onClose={() => setAddWorkout(false)}
        title="Neue Einheit"
        footer={
          <button
            className="btn primary block"
            onClick={() => {
              update({ ...plan, workouts: [...plan.workouts, newWorkout(workoutName || `Einheit ${plan.workouts.length + 1}`)] });
              setAddWorkout(false);
            }}
          >
            Hinzufügen
          </button>
        }
      >
        <Field label="Name der Einheit">
          <input className="input" autoFocus value={workoutName} onChange={(e) => setWorkoutName(e.target.value)} placeholder="z. B. Push, Pull, Beine" />
        </Field>
        <div className="chips wrap">
          {['Push', 'Pull', 'Beine', 'Oberkörper', 'Unterkörper', 'Ganzkörper A', 'Ganzkörper B'].map((n) => (
            <button key={n} className="chip" onClick={() => setWorkoutName(n)}>
              {n}
            </button>
          ))}
        </div>
      </Sheet>

      <CopyWorkoutSheet open={copyOpen} onClose={() => setCopyOpen(false)} plans={allPlans ?? []} currentId={plan.id} onCopy={(pid, wid) => copyWorkout(pid, wid, plan.id).then(() => { setCopyOpen(false); toast('Einheit kopiert'); })} />

      <ItemSheet
        key={editing?.itemId ?? 'none'}
        open={!!editingItem}
        item={editingItem}
        plan={plan}
        workoutId={editing?.workoutId}
        cat={cat}
        onClose={() => setEditing(null)}
        onSave={(item, moveTo) => {
          if (!editing) return;
          const from = editing.workoutId;
          let workouts = plan.workouts.map((w) => (w.id === from ? { ...w, items: w.items.map((i) => (i.id === item.id ? item : i)) } : w));
          if (moveTo && moveTo !== from) {
            workouts = workouts.map((w) => (w.id === from ? { ...w, items: w.items.filter((i) => i.id !== item.id) } : w.id === moveTo ? { ...w, items: [...w.items, item] } : w));
          }
          update({ ...plan, workouts });
          setEditing(null);
        }}
        onRemove={() => {
          if (!editing) return;
          setWorkout(editing.workoutId, (w) => ({ ...w, items: w.items.filter((i) => i.id !== editing.itemId) }));
          setEditing(null);
        }}
      />

      <Sheet open={menu} onClose={() => setMenu(false)} title="Plan">
        <div className="stack">
          {plan.status !== 'aktiv' && plan.status !== 'archiv' && (
            <button className="btn block" onClick={async () => { await activatePlan(plan.id); setMenu(false); toast('Plan ist jetzt aktiv'); }}>
              Aktivieren
            </button>
          )}
          {plan.status === 'aktiv' && (
            <button className="btn block" onClick={async () => { await setPlanStatus(plan.id, 'entwurf'); setMenu(false); }}>
              Deaktivieren (zu „Weitere Pläne“)
            </button>
          )}
          {plan.status !== 'archiv' ? (
            <button className="btn block" onClick={async () => { await setPlanStatus(plan.id, 'archiv'); setMenu(false); toast('Plan archiviert'); }}>
              Archivieren
            </button>
          ) : (
            <button className="btn block" onClick={async () => { await setPlanStatus(plan.id, 'entwurf'); setMenu(false); }}>
              Aus dem Archiv holen
            </button>
          )}
          <button
            className="btn block"
            onClick={async () => {
              const c = await duplicatePlan(plan.id);
              setMenu(false);
              if (c) {
                toast('Kopie angelegt');
                nav(`/plaene/${c.id}`);
              }
            }}
          >
            Duplizieren
          </button>
          <button
            className="btn block"
            onClick={async () => {
              if (!cat) return;
              setMenu(false);
              const text = JSON.stringify(planToFile(plan, cat.exMap), null, 2);
              const safe = plan.name.replace(/[^\wäöüÄÖÜß-]+/g, '-').replace(/^-+|-+$/g, '') || 'plan';
              const r = await platform.saveFile({ filename: `eisenzeit-plan-${safe}.json`, mime: 'application/json', text });
              if (r !== 'abgebrochen') toast(r === 'heruntergeladen' ? 'Plan heruntergeladen' : 'Plan bereitgestellt');
            }}
          >
            Als Datei exportieren
          </button>
          <button
            className="btn block danger"
            onClick={async () => {
              setMenu(false);
              if (await confirm({ title: `„${plan.name}“ löschen?`, message: 'Bereits trainierte Einheiten bleiben im Verlauf erhalten.', confirmLabel: 'Löschen', danger: true })) {
                await deletePlan(plan.id);
                nav('/plaene', { replace: true });
              }
            }}
          >
            Plan löschen
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function CopyWorkoutSheet({ open, onClose, plans, currentId, onCopy }: { open: boolean; onClose: () => void; plans: Plan[]; currentId: string; onCopy: (planId: string, workoutId: string) => void }) {
  const others = plans.filter((p) => p.id !== currentId && p.workouts.length > 0);
  return (
    <Sheet open={open} onClose={onClose} title="Einheit aus anderem Plan kopieren" tall>
      {others.length === 0 && <div className="empty-text pad">In deinen anderen Plänen gibt es noch keine Einheiten.</div>}
      {others.map((p) => (
        <div key={p.id}>
          <div className="section-label">{p.name}</div>
          <div className="list">
            {p.workouts.map((w) => (
              <button key={w.id} className="list-row" onClick={() => onCopy(p.id, w.id)}>
                <div className="grow">
                  <div className="row-title">{w.name}</div>
                  <div className="row-sub">{w.items.length} Übungen</div>
                </div>
                <IconCopy size={18} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </Sheet>
  );
}

function ItemSheet({
  open,
  item,
  plan,
  workoutId,
  cat,
  onClose,
  onSave,
  onRemove,
}: {
  open: boolean;
  item: PlanItem | undefined;
  plan: Plan;
  workoutId: string | undefined;
  cat: Catalog;
  onClose: () => void;
  onSave: (item: PlanItem, moveTo?: string) => void;
  onRemove: () => void;
}) {
  const [d, setD] = useState<PlanItem | undefined>(item);
  const [moveTo, setMoveTo] = useState<string | undefined>(undefined);
  useEffect(() => {
    setD(item);
    setMoveTo(undefined);
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;
  const ex = cat.exMap.get(d.exerciseId);
  const platte = weightUnit(ex?.equipmentId ? cat.eqMap.get(ex.equipmentId) : undefined) === 'platte';
  const cardio = ex?.tracking === 'cardio';
  const timed = ex?.tracking === 'zeit';
  const set = (p: Partial<PlanItem>) => setD({ ...d, ...p });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={ex?.name ?? 'Übung'}
      tall
      footer={
        <button className="btn primary block" onClick={() => onSave(d, moveTo)}>
          Fertig
        </button>
      }
    >
      {!cardio && (
        <>
          <div className="row between">
            <span className="field-label">Sätze</span>
            <Stepper compact label="Sätze" decimals={false} value={d.sets} onStep={(s) => set({ sets: Math.min(12, Math.max(1, d.sets + s)) })} onSet={(v) => v && set({ sets: Math.round(Math.min(12, Math.max(1, v))) })} />
          </div>
          {!timed && (
            <>
              <div className="row between">
                <span className="field-label">Wiederholungen von</span>
                <Stepper
                  compact
                  label="Wiederholungen von"
                  decimals={false}
                  value={d.repMin}
                  onStep={(s) => { const v = Math.max(1, d.repMin + s); set({ repMin: v, repMax: Math.max(v, d.repMax) }); }}
                  onSet={(v) => v && set({ repMin: Math.round(Math.max(1, v)), repMax: Math.max(Math.round(v), d.repMax) })}
                />
              </div>
              <div className="row between">
                <span className="field-label">bis</span>
                <Stepper
                  compact
                  label="Wiederholungen bis"
                  decimals={false}
                  value={d.repMax}
                  onStep={(s) => set({ repMax: Math.max(d.repMin, d.repMax + s) })}
                  onSet={(v) => v && set({ repMax: Math.round(Math.max(d.repMin, v)) })}
                />
              </div>
            </>
          )}
        </>
      )}
      <div className="row between">
        <span className="field-label">Pause (Sekunden)</span>
        <Stepper compact label="Pause" decimals={false} value={d.restSec} onStep={(s) => set({ restSec: Math.max(0, d.restSec + s * 15) })} onSet={(v) => set({ restSec: Math.max(0, Math.round(v ?? 0)) })} />
      </div>
      {!cardio && !timed && (
        <Field label={platte ? 'Zielplatte (Nr., optional)' : 'Zielgewicht (kg, optional)'} hint="Wird im Training vorbelegt, solange es noch keine Werte vom letzten Mal gibt.">
          <NumberInput value={d.targetWeight} onChange={(v) => set({ targetWeight: v })} placeholder="–" />
        </Field>
      )}
      <div className="section-label">Supersatz</div>
      <div className="chips wrap">
        {[undefined, 1, 2, 3, 4].map((g) => (
          <button key={g ?? 0} className={'chip' + (d.supersetGroup === g ? ' on' : '')} onClick={() => set({ supersetGroup: g })}>
            {g ? `Gruppe ${g}` : 'Keiner'}
          </button>
        ))}
      </div>
      <p className="muted small">Übungen mit derselben Gruppe werden im Training als Supersatz abwechselnd ausgeführt.</p>
      <Field label="Notiz">
        <input className="input" value={d.note ?? ''} onChange={(e) => set({ note: e.target.value || undefined })} placeholder="z. B. langsam absenken" />
      </Field>
      {plan.workouts.length > 1 && workoutId && (
        <Field label="In andere Einheit verschieben">
          <select className="input" value={moveTo ?? workoutId} onChange={(e) => setMoveTo(e.target.value)}>
            {plan.workouts.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <button className="btn block danger" onClick={onRemove}>
        Übung aus der Einheit entfernen
      </button>
    </Sheet>
  );
}
