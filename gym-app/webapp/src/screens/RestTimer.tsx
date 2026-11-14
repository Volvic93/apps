import { useEffect, useRef } from 'react';
import { useNow, } from '../ui/hooks';
import { formatDuration } from '../ui/kit';

/** Pausentimer: zählt bis zum gespeicherten Endzeitpunkt (übersteht App-Neustart), meldet das Ende genau einmal. */
export function RestTimer({
  endsAt,
  totalSec,
  onAdjust,
  onSkip,
  onFinished,
}: {
  endsAt: number;
  totalSec: number;
  onAdjust: (deltaSec: number) => void;
  onSkip: () => void;
  onFinished: () => void;
}) {
  const now = useNow(true, 250);
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const fired = useRef(false);
  useEffect(() => {
    fired.current = false;
  }, [endsAt]);
  useEffect(() => {
    if (remaining <= 0 && !fired.current) {
      fired.current = true;
      onFinished();
    }
  }, [remaining, onFinished]);
  const pct = totalSec > 0 ? Math.max(0, Math.min(100, (remaining / totalSec) * 100)) : 0;
  return (
    <div className="rest" role="timer" aria-label="Pause">
      <div className="rest-bar">
        <div className="rest-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="rest-row">
        <div>
          <div className="rest-label">Pause</div>
          <div className="rest-time" data-testid="rest-time">{formatDuration(remaining)}</div>
        </div>
        <div className="rest-actions">
          <button className="btn small" onClick={() => onAdjust(-15)}>
            −15
          </button>
          <button className="btn small" onClick={() => onAdjust(30)}>
            +30
          </button>
          <button className="btn small primary" onClick={onSkip}>
            Überspringen
          </button>
        </div>
      </div>
    </div>
  );
}
