import { useEffect, useState } from 'react';
import { usePhotoUrl } from './hooks';

const reducedMotion = (): boolean => {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * Bewegungsbild: zwei eigene Fotos (Start und Ende), die im Wechsel eingeblendet werden.
 * Tippen schaltet um und hält die Wiedergabe an. Bei „Bewegung reduzieren“ wechselt nichts von selbst.
 */
export function MotionImage({ ids, label, title }: { ids: string[] | undefined; label: string; title?: string }) {
  const start = usePhotoUrl(ids?.[0] || undefined);
  const end = usePhotoUrl(ids?.[1] || undefined);
  const [phase, setPhase] = useState<0 | 1>(0);
  const [paused, setPaused] = useState(() => reducedMotion());
  const ready = !!start && !!end;

  useEffect(() => {
    if (!ready || paused) return;
    const t = setInterval(() => setPhase((p) => (p === 0 ? 1 : 0)), 1300);
    return () => clearInterval(t);
  }, [ready, paused]);

  if (!ready) return null;
  const body = (
    <div className="motion">
      <button
        type="button"
        className="motion-frame"
        onClick={() => {
          setPaused(true);
          setPhase((p) => (p === 0 ? 1 : 0));
        }}
        aria-label={`${label}: ${phase === 0 ? 'Startposition' : 'Endposition'}. Tippen zum Umschalten.`}
      >
        <img src={start} alt="" />
        <img src={end} alt="" className={'motion-end' + (phase === 1 ? ' on' : '')} />
      </button>
      <div className="motion-cap">
        <span>{phase === 0 ? 'Start' : 'Ende'}</span>
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
