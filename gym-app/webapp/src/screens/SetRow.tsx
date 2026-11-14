import { SETKIND_LABEL, type Equipment, type Exercise, type SetEntry, type SetKind } from '../data/types';
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
}: {
  index: number;
  set: SetEntry;
  ex: Exercise;
  eq: Equipment | undefined;
  onChange: (patch: Partial<SetEntry>) => void;
  onToggleDone: () => void;
  onRemove: () => void;
  workIndex: number | undefined;
}) {
  const done = set.doneAt !== undefined;
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
      {eq?.perSideInput && set.weight !== undefined && (ex.tracking === 'gewicht_wdh' || ex.tracking === 'koerpergewicht_wdh') && (
        <div className="set-hint">
          Je Seite: {formatNumber(Math.max(0, (set.weight - (eq.ownWeightKg ?? 0)) / 2))} kg
          {eq.ownWeightKg ? ` (Gesamt abzüglich ${formatNumber(eq.ownWeightKg)} kg Eigengewicht, geteilt durch 2)` : ' (Gesamtgewicht ÷ 2)'}
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

