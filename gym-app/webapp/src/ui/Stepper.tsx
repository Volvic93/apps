import { IconMinus, IconPlus } from './Icons';
import { NumberInput } from './kit';

/** Zahl mit großen −/+-Tasten (mindestens 44 pt) und Direkteingabe. */
export function Stepper({
  value,
  onStep,
  onSet,
  unit,
  label,
  decimals = true,
  placeholder = '–',
  compact,
}: {
  value: number | undefined;
  onStep: (dir: 1 | -1) => void;
  onSet: (v: number | undefined) => void;
  unit?: string;
  label: string;
  decimals?: boolean;
  placeholder?: string;
  compact?: boolean;
}) {
  return (
    <div className={'stepper' + (compact ? ' compact' : '')} role="group" aria-label={label}>
      <button type="button" className="step-btn" aria-label={`${label} verringern`} onClick={() => onStep(-1)}>
        <IconMinus size={22} />
      </button>
      <div className="step-mid">
        <NumberInput className="step-input" ariaLabel={label} value={value} onChange={onSet} decimals={decimals} placeholder={placeholder} />
        {unit && <span className="step-unit">{unit}</span>}
      </div>
      <button type="button" className="step-btn" aria-label={`${label} erhöhen`} onClick={() => onStep(1)}>
        <IconPlus size={22} />
      </button>
    </div>
  );
}
