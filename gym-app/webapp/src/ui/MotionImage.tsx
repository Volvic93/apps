import { useEffect, useState } from 'react';
import { usePhotoUrl } from './hooks';

/** So viele Positionen kann ein Bewegungsbild höchstens haben. */
export const MAX_MOTION_FRAMES = 6;

const reducedMotion = (): boolean => {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** Nur belegte Positionen, in der gespeicherten Reihenfolge. */
export function motionFrames(ids: string[] | undefined): string[] {
  return (ids ?? []).filter(Boolean).slice(0, MAX_MOTION_FRAMES);
}

function Frame({ id, on }: { id: string; on: boolean }) {
  const url = usePhotoUrl(id);
  return url ? <img src={url} alt="" className={'motion-step' + (on ? ' on' : '')} /> : null;
}

/**
 * Bewegungsbild: zwei bis sechs eigene Fotos oder Zeichnungen (z. B. Start, Mitte, Ende), die der Reihe nach eingeblendet werden.
 * Tippen schaltet zur nächsten Position und hält die Wiedergabe an. Bei „Bewegung reduzieren“ wechselt nichts von selbst.
 */
export function MotionImage({ ids, label, title }: { ids: string[] | undefined; label: string; title?: string }) {
  const frames = motionFrames(ids);
  const n = frames.length;
  const [phase, setPhase] = useState(0);
  const [paused, setPaused] = useState(() => reducedMotion());
  const ready = n >= 2;
  const idKey = frames.join('|');

  useEffect(() => {
    setPhase(0);
  }, [idKey]);

  useEffect(() => {
    if (!ready || paused) return;
    const t = setInterval(() => setPhase((p) => (p + 1) % n), 1300);
    return () => clearInterval(t);
  }, [ready, paused, n]);

  if (!ready) return null;
  const caption = n === 2 ? (phase === 0 ? 'Start' : 'Ende') : `Position ${phase + 1} von ${n}`;
  const body = (
    <div className="motion">
      <button
        type="button"
        className="motion-frame"
        onClick={() => {
          setPaused(true);
          setPhase((p) => (p + 1) % n);
        }}
        aria-label={`${label}: ${caption}. Tippen für die nächste Position.`}
      >
        {frames.map((id, i) => (
          <Frame key={id + i} id={id} on={i <= phase} />
        ))}
      </button>
      <div className="motion-cap">
        <span>{caption}</span>
        <button type="button" className="btn small ghost" onClick={() => setPaused((v) => !v)}>
          {paused ? 'Abspielen' : 'Anhalten'}
        </button>
      </div>
    </div>
  );
  return title ? (
    <section className="card">
      <div className="card-title">{title}</div>
      {body}
    </section>
  ) : (
    body
  );
}
