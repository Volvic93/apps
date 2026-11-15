import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

/** Platzhalter, solange kein Bewegungsbild da ist: sagt, was möglich ist, und führt direkt zum Hinzufügen. */
export function MotionPlaceholder({ exercises, title }: { exercises: { id: string; name: string }[]; title: string }) {
  const nav = useNavigate();
  if (exercises.length === 0) return null;
  return (
    <section className="card">
      <div className="card-title">{title}</div>
      <p className="muted small">Noch kein Bewegungsbild. Füge zwei bis sechs Fotos oder Zeichnungen hinzu, damit du den richtigen Ablauf hier siehst.</p>
      <div className="row gap wrap">
        {exercises.map((e) => (
          <button key={e.id} className="btn small" onClick={() => nav(`/uebungen/uebung-bearbeiten/${e.id}`)}>
            {exercises.length > 1 ? `Bilder für „${e.name}“` : 'Bilder hinzufügen'}
          </button>
        ))}
      </div>
    </section>
  );
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
