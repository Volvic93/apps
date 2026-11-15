import { useEffect, useRef, useState } from 'react';
import { SETKIND_LABEL, type Equipment, type Exercise, type SetEntry, type SetKind } from '../data/types';
import { DEFAULT_PLATES, formatPlates, platesPerSide } from '../logic/plates';
import { PlateSheet } from '../ui/PlateSheet';
import { formatNumber, stepReps, stepWeight, weightUnit } from '../logic/progression';
import { IconCheck, IconTrash } from '../ui/Icons';
import { Stepper } from '../ui/Stepper';

const KIND_CYCLE: SetKind[] = ['normal', 'aufwaermen', 'reduktion'];

export function SetRow({
  index,
  set,
  ex,
  eq,
  onChange,
  onToggleDone,
  onRemove,
  workIndex,
  rirEnabled = true,
  plates,
}: {
  index: number;
  set: SetEntry;
  ex: Exercise;
  eq: Equipment | undefined;
  onChange: (patch: Partial<SetEntry>) => void;
  onToggleDone: () => void;
  onRemove: () => void;
  workIndex: number | undefined;
  rirEnabled?: boolean;
  plates?: number[];
}) {
  const [platesOpen, setPlatesOpen] = useState(false);
  const weighted = ex.tracking === 'gewicht_wdh' || ex.tracking === 'koerpergewicht_wdh';
  const slots = eq?.plateSlots ?? 2;
  const plateLoaded = !!eq && (eq.perSideInput || eq.loading === 'scheiben') && weightUnit(eq) !== 'platte';
  const rirRef = useRef<HTMLDivElement>(null);
  const wasDone = useRef(set.doneAt !== undefined);
  const done = set.doneAt !== undefined;
  // Nach dem Abhaken die Zeile „Noch möglich“ ins Bild holen (die Pausenleiste liegt unten darüber)
  useEffect(() => {
    if (done && !wasDone.current) rirRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    wasDone.current = done;
  }, [done]);
  const platePlan = plateLoaded && set.weight !== undefined && weighted ? platesPerSide(set.weight, eq.ownWeightKg ?? 0, eq.plateSlots ?? 2, plates ?? DEFAULT_PLATES) : undefined;
  const cycleKind = () => onChange({ kind: KIND_CYCLE[(KIND_CYCLE.indexOf(set.kind) + 1) % KIND_CYCLE.length] });
  const label = set.kind === 'normal' ? `Satz ${workIndex ?? index + 1}` : SETKIND_LABEL[set.kind];

  return (
    <div className={'set-card' + (done ? ' done' : '') + (set.kind !== 'normal' ? ' kind-' + set.kind : '')} data-testid="set-row">
      <div className="set-head">
        <button className="set-kind" onClick={cycleKind} aria-label={`Satzart ändern (jetzt ${SETKIND_LABEL[set.kind]})`}>
          <span className="set-num">{label}</span>
          {set.kind === 'normal' && <span className="set-kind-hint">Normal</span>}
          {set.kind !== 'normal' && <span className="set-kind-hint">zählt nicht in die Statistik</span>}
        </button>
        <button className="icon-btn sm ghost" onClick={onRemove} aria-label="Satz entfernen">
          <IconTrash size={18} />
        </button>
        <button className={'check-btn' + (done ? ' on' : '')} onClick={onToggleDone} aria-pressed={done} aria-label={done ? 'Satz zurücknehmen' : 'Satz abhaken'}>
          <IconCheck size={28} />
        </button>
      </div>

      {(ex.tracking === 'gewicht_wdh' || ex.tracking === 'koerpergewicht_wdh') && (
        <div className="set-fields">
          <div className="set-field">
            <div className="set-field-label">{ex.tracking === 'koerpergewicht_wdh' ? 'Zusatz (kg)' : weightUnit(eq) === 'platte' ? 'Platte (Nr.)' : 'Gewicht (kg)'}</div>
            <Stepper
              label="Gewicht"
              value={set.weight}
              placeholder={ex.tracking === 'koerpergewicht_wdh' ? '0' : '–'}
              onStep={(d) => onChange({ weight: stepWeight(set.weight, d, ex, eq, { allowNegative: ex.tracking === 'koerpergewicht_wdh' }) })}
              onSet={(v) => onChange({ weight: v })}
            />
          </div>
          <div className="set-field">
            <div className="set-field-label">{ex.unilateral ? 'Wdh. je Seite' : 'Wiederholungen'}</div>
            <Stepper label="Wiederholungen" decimals={false} value={set.reps} onStep={(d) => onChange({ reps: stepReps(set.reps, d) })} onSet={(v) => onChange({ reps: v === undefined ? undefined : Math.max(0, Math.round(v)) })} />
          </div>
        </div>
      )}
      {eq && platePlan && set.weight !== undefined && (
        <>
          <button type="button" className="set-hint plate-hint" onClick={() => setPlatesOpen(true)} aria-label="Scheiben ansehen">
            {slots > 1 ? 'Je Seite' : 'Scheiben'}: <b>{formatPlates(platePlan.perSide)}</b>
            {!platePlan.exact ? ` (gerundet auf ${formatNumber(platePlan.totalKg)} kg)` : ''} · Scheiben ansehen
          </button>
          <PlateSheet open={platesOpen} onClose={() => setPlatesOpen(false)} totalKg={set.weight} ownKg={eq.ownWeightKg ?? 0} slots={eq.plateSlots ?? 2} plates={plates ?? DEFAULT_PLATES} name={eq.name} />
        </>
      )}
      {done && rirEnabled && weighted && set.kind !== 'aufwaermen' && (
        <div className="rir-row" ref={rirRef} role="group" aria-label="Wie viele Wiederholungen wären noch möglich gewesen?">
          <span className="rir-label">Noch möglich:</span>
          {[0, 1, 2, 3].map((v) => (
            <button key={v} type="button" className={'chip small' + (set.rir === v ? ' on' : '')} aria-pressed={set.rir === v} onClick={() => onChange({ rir: set.rir === v ? undefined : v })}>
              {v === 3 ? '3+' : v}
            </button>
          ))}
        </div>
      )}

      {ex.tracking === 'zeit' && (
        <div className="set-fields one">
          <div className="set-field">
            <div className="set-field-label">Dauer (Sekunden)</div>
            <Stepper label="Dauer" decimals={false} value={set.durationSec} unit="s" onStep={(d) => onChange({ durationSec: Math.max(0, (set.durationSec ?? 0) + d * 5) })} onSet={(v) => onChange({ durationSec: v === undefined ? undefined : Math.max(0, Math.round(v)) })} />
          </div>
        </div>
      )}

      {ex.tracking === 'cardio' && (
        <div className="set-fields cardio">
          <div className="set-field">
            <div className="set-field-label">Dauer (Min.)</div>
            <Stepper label="Dauer" decimals={false} value={set.durationSec === undefined ? undefined : Math.round(set.durationSec / 60)} onStep={(d) => onChange({ durationSec: Math.max(0, (Math.round((set.durationSec ?? 0) / 60) + d) * 60) })} onSet={(v) => onChange({ durationSec: v === undefined ? undefined : Math.max(0, Math.round(v) * 60) })} />
          </div>
          <div className="set-field">
            <div className="set-field-label">Distanz (km)</div>
            <Stepper label="Distanz" value={set.distanceKm} onStep={(d) => onChange({ distanceKm: Math.max(0, Math.round(((set.distanceKm ?? 0) + d * 0.5) * 100) / 100) })} onSet={(v) => onChange({ distanceKm: v })} />
          </div>
          <div className="set-field">
            <div className="set-field-label">Stufe / Steigung</div>
            <Stepper label="Stufe" decimals={false} value={set.level} onStep={(d) => onChange({ level: Math.max(0, (set.level ?? 0) + d) })} onSet={(v) => onChange({ level: v })} />
          </div>
        </div>
      )}
    </div>
  );
}

