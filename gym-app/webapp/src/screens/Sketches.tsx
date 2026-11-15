import { useMemo } from 'react';
import { ALL_CATALOG_EXERCISES } from '../data/seed';
import { MOTION_PATTERNS, motionIdFor } from '../data/motions';
import { BackButton, ScreenHeader } from '../ui/Header';
import { SketchSvg } from '../ui/MotionSketch';

/** Übersicht aller Bewegungsmuster in Start- und Endposition (nur über die Adresse #/skizzen erreichbar; Qualitätskontrolle). */
export function Sketches() {
  const usage = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of ALL_CATALOG_EXERCISES) {
      const id = motionIdFor(e);
      if (id) m.set(id, [...(m.get(id) ?? []), e.name]);
    }
    return m;
  }, []);
  return (
    <div className="screen">
      <ScreenHeader back={<BackButton to="/heute" label="Heute" />} title="Skizzen" eyebrow={`${MOTION_PATTERNS.length} Bewegungsmuster`} />
      <div className="sketch-grid">
        {MOTION_PATTERNS.map((p) => (
          <section key={p.id} className="card sketch-card" id={p.id}>
            <div className="card-title">{p.name}</div>
            <div className="sketch-pair">
              <figure>
                <SketchSvg pattern={p} t={0} />
                <figcaption>Start</figcaption>
              </figure>
              <figure>
                <SketchSvg pattern={p} t={1} />
                <figcaption>Ende</figcaption>
              </figure>
            </div>
            <div className="muted small">{(usage.get(p.id) ?? []).length} Übungen</div>
          </section>
        ))}
      </div>
    </div>
  );
}
