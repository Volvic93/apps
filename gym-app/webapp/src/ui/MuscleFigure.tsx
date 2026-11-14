import type { ReactNode } from 'react';
import type { MuscleId } from '../data/types';
import { MUSCLE_LABEL } from '../data/muscles';

/**
 * Körper von vorn und hinten als SVG. Hauptmuskeln kräftig, Hilfsmuskeln schwach eingefärbt.
 * Gezeichnet auf 100 × 200 je Ansicht; die linke Körperseite (aus Betrachtersicht) wird für rechts gespiegelt.
 */

type Shape = { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rot?: number } | { kind: 'path'; d: string } | { kind: 'rect'; x: number; y: number; w: number; h: number; r?: number };

interface MuscleDef {
  id: MuscleId;
  shape: Shape;
  /** true = Form liegt mittig und wird nicht gespiegelt */
  center?: boolean;
}

const e = (cx: number, cy: number, rx: number, ry: number, rot = 0): Shape => ({ kind: 'ellipse', cx, cy, rx, ry, rot });

const FRONT: MuscleDef[] = [
  { id: 'brust', shape: { kind: 'path', d: 'M49 41 C44 38 36 39 32 44 C32 52 38 57 49 56 Z' } },
  { id: 'schulter_vorn', shape: e(29.5, 41, 5.5, 7.5, 10) },
  { id: 'schulter_seitlich', shape: e(23.5, 43, 3.8, 7, 14) },
  { id: 'bizeps', shape: e(23.5, 56, 4.5, 12, 11) },
  { id: 'unterarm', shape: e(17.5, 88, 4, 13, 6) },
  { id: 'bauch', center: true, shape: { kind: 'rect', x: 43, y: 60, w: 14, h: 36, r: 6 } },
  { id: 'schraeg', shape: e(37.5, 80, 4.2, 14, -4) },
  { id: 'quadrizeps', shape: e(40, 130, 8, 22, -2) },
  { id: 'adduktoren', shape: e(47, 126, 3.3, 14, 0) },
  { id: 'abduktoren', shape: e(33, 116, 2.8, 9, 0) },
  { id: 'waden', shape: e(40, 170, 4.5, 14, 0) },
];

const BACK: MuscleDef[] = [
  { id: 'oberer_ruecken', center: true, shape: { kind: 'path', d: 'M50 31 C44 33 38 36 34 40 L38 56 C44 62 56 62 62 56 L66 40 C62 36 56 33 50 31 Z' } },
  { id: 'schulter_hinten', shape: e(28, 41.5, 5.8, 7.5, 10) },
  { id: 'latissimus', shape: { kind: 'path', d: 'M36 55 C30 68 33 80 40 90 L49 84 L49 62 C44 62 40 59 36 55 Z' } },
  { id: 'unterer_ruecken', center: true, shape: { kind: 'rect', x: 42.5, y: 86, w: 15, h: 17, r: 6 } },
  { id: 'trizeps', shape: e(23.5, 56, 4.6, 12, 11) },
  { id: 'unterarm', shape: e(17.5, 88, 4, 13, 6) },
  { id: 'gesaess', shape: e(42, 113, 9.5, 9, 0) },
  { id: 'abduktoren', shape: e(33, 117, 2.8, 8, 0) },
  { id: 'beinbeuger', shape: e(40.5, 138, 8, 19, -2) },
  { id: 'waden', shape: e(40, 170, 5.8, 14, 0) },
];

function drawShape(s: Shape, extra: Record<string, unknown> = {}): ReactNode {
  if (s.kind === 'ellipse') {
    return <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined} {...extra} />;
  }
  if (s.kind === 'rect') return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r ?? 0} {...extra} />;
  return <path d={s.d} {...extra} />;
}

function Body({ defs, primary, secondary, showAll }: { defs: MuscleDef[]; primary: Set<MuscleId>; secondary: Set<MuscleId>; showAll: boolean }) {
  return (
    <g>
      {/* Silhouette */}
      <g className="mf-body" stroke="none">
        <ellipse cx="50" cy="12" rx="9" ry="11" />
        <rect x="44.5" y="20" width="11" height="12" rx="4" />
        <path d="M29 35 C37 29 63 29 71 35 L68 70 C67 85 66 94 64 104 L36 104 C34 94 33 85 32 70 Z" />
      </g>
      <g className="mf-limb" fill="none" strokeLinecap="round">
        {[0, 1].map((side) => {
          const t = side ? 'translate(100 0) scale(-1 1)' : undefined;
          return (
            <g key={side} transform={t}>
              <path d="M27 40 L21 74" strokeWidth="12" />
              <path d="M21 74 L17 104" strokeWidth="9" />
              <path d="M42 108 L40 152" strokeWidth="18" />
              <path d="M40 152 L40 192" strokeWidth="12" />
            </g>
          );
        })}
      </g>
      {/* Muskeln */}
      {defs.map((m) => {
        const isP = primary.has(m.id);
        const isS = !isP && secondary.has(m.id);
        const cls = isP ? 'mf-m mf-p' : isS ? 'mf-m mf-s' : 'mf-m';
        if (!isP && !isS && !showAll) return null;
        return (
          <g key={m.id} className={cls}>
            {drawShape(m.shape)}
            {!m.center && <g transform="translate(100 0) scale(-1 1)">{drawShape(m.shape)}</g>}
          </g>
        );
      })}
    </g>
  );
}

export function MuscleFigure({
  primary,
  secondary = [],
  height = 150,
  showLabels = true,
}: {
  primary: MuscleId[];
  secondary?: MuscleId[];
  height?: number;
  showLabels?: boolean;
}) {
  const p = new Set(primary);
  const s = new Set(secondary);
  return (
    <div className="mf">
      <svg viewBox="0 0 210 200" height={height} width={(height * 210) / 200} role="img" aria-label={`Beanspruchte Muskeln: ${primary.map((m) => MUSCLE_LABEL[m]).join(', ')}`}>
        <Body defs={FRONT} primary={p} secondary={s} showAll />
        <g transform="translate(110 0)">
          <Body defs={BACK} primary={p} secondary={s} showAll />
        </g>
      </svg>
      {showLabels && (
        <div className="mf-legend">
          <span className="mf-key mf-key-p" /> Hauptmuskeln: {primary.map((m) => MUSCLE_LABEL[m]).join(', ') || '–'}
          {secondary.length > 0 && (
            <>
              <br />
              <span className="mf-key mf-key-s" /> Hilfsmuskeln: {secondary.map((m) => MUSCLE_LABEL[m]).join(', ')}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Kleine Variante ohne Beschriftung (für Gerätekarten). */
export function MuscleMini({ primary, secondary = [], height = 44 }: { primary: MuscleId[]; secondary?: MuscleId[]; height?: number }) {
  return <MuscleFigure primary={primary} secondary={secondary} height={height} showLabels={false} />;
}
