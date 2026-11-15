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
  onWarn,
}: {
  endsAt: number;
  totalSec: number;
  onAdjust: (deltaSec: number) => void;
  onSkip: () => void;
  onFinished: () => void;
  /** 10 Sekunden vor dem Ende (nur wenn die Pause länger ist). */
  onWarn?: () => void;
}) {
  const now = useNow(true, 250);
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const fired = useRef(false);
  const warned = useRef(false);
  useEffect(() => {
    fired.current = false;
    // Wer mit −15 schon in den letzten 10 Sekunden landet, bekommt die Vorwarnung nicht noch einmal
    warned.current = Math.ceil((endsAt - Date.now()) / 1000) <= 10;
  }, [endsAt]);
  useEffect(() => {
    if (remaining <= 10 && remaining > 0 && totalSec > 12 && !warned.current) {
      warned.current = true;
      onWarn?.();
    }
  }, [remaining, totalSec, onWarn]);
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
