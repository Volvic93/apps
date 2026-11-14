import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { nearestIndex, niceTicks } from '../logic/chart';

const W = 340;
const PAD = { l: 38, r: 10, t: 10, b: 22 };

export interface LinePoint {
  x: number; // Zeitstempel
  y: number;
}

/**
 * Liniendiagramm über der Zeit. Ein Tipp (oder Ziehen / Pfeiltasten) wählt einen Punkt; Wert und Datum stehen darüber.
 * Aufgebaut als reines SVG ohne Zusatzbibliothek, mit Systemfarben, damit es in Dunkel und Hell passt.
 */
export function LineChart({
  points,
  formatValue,
  formatDate,
  label,
  color = 'var(--accent)',
  height = 170,
}: {
  points: LinePoint[];
  formatValue: (v: number) => string;
  formatDate: (ts: number) => string;
  label: string;
  color?: string;
  height?: number;
}) {
  const [sel, setSel] = useState<number | undefined>(undefined);
  const svgRef = useRef<SVGSVGElement>(null);
  const id = useId();
  const geo = useMemo(() => {
    if (!points.length) return undefined;
    const ys = points.map((p) => p.y);
    const ticks = niceTicks(Math.min(...ys), Math.max(...ys), 3);
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const xMin = points[0].x;
    const xMax = points[points.length - 1].x;
    const innerW = W - PAD.l - PAD.r;
    const innerH = height - PAD.t - PAD.b;
    const sx = (x: number) => (xMax === xMin ? PAD.l + innerW / 2 : PAD.l + ((x - xMin) / (xMax - xMin)) * innerW);
    const sy = (y: number) => PAD.t + innerH - ((y - yMin) / (yMax - yMin || 1)) * innerH;
    return { ticks, sx, sy, xs: points.map((p) => sx(p.x)) };
  }, [points, height]);

  if (!geo) return null;
  const idx = Math.min(sel ?? points.length - 1, points.length - 1);
  const cur = points[idx];

  const pick = (clientX: number) => {
    const el = svgRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * W;
    setSel(nearestIndex(geo.xs, x));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setSel(Math.max(0, idx - 1));
    else if (e.key === 'ArrowRight') setSel(Math.min(points.length - 1, idx + 1));
    else return;
    e.preventDefault();
  };
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${geo.sx(p.x).toFixed(1)},${geo.sy(p.y).toFixed(1)}`).join(' ');
  const area = `${path} L${geo.sx(points[points.length - 1].x).toFixed(1)},${height - PAD.b} L${geo.sx(points[0].x).toFixed(1)},${height - PAD.b} Z`;

  return (
    <div className="chart">
      <div className="chart-readout" aria-live="polite">
        <b>{formatValue(cur.y)}</b>
        <span>{formatDate(cur.x)}</span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${height}`}
        className="chart-svg"
        role="img"
        aria-label={`${label}: ${points.length} ${points.length === 1 ? 'Wert' : 'Werte'}, zuletzt ${formatValue(points[points.length - 1].y)}`}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerDown={(e: PointerEvent) => pick(e.clientX)}
        onPointerMove={(e: PointerEvent) => e.buttons === 1 && pick(e.clientX)}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.28" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {geo.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={geo.sy(t)} y2={geo.sy(t)} className="chart-grid" />
            <text x={PAD.l - 6} y={geo.sy(t) + 4} textAnchor="end" className="chart-axis">
              {formatTick(t)}
            </text>
          </g>
        ))}
        {points.length > 1 && <path d={area} fill={`url(#${id})`} />}
        {points.length > 1 && <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((p, i) => (
          <circle key={i} cx={geo.sx(p.x)} cy={geo.sy(p.y)} r={i === idx ? 5.5 : points.length > 40 ? 1.5 : 3} fill={i === idx ? color : 'var(--bg-2)'} stroke={color} strokeWidth={i === idx ? 2.5 : 2} />
        ))}
        <line x1={geo.sx(cur.x)} x2={geo.sx(cur.x)} y1={PAD.t} y2={height - PAD.b} className="chart-cursor" />
        <text x={PAD.l} y={height - 5} textAnchor="start" className="chart-axis">
          {formatDate(points[0].x)}
        </text>
        {points.length > 1 && (
          <text x={W - PAD.r} y={height - 5} textAnchor="end" className="chart-axis">
            {formatDate(points[points.length - 1].x)}
          </text>
        )}
      </svg>
    </div>
  );
}

export interface Bar {
  label: string;
  value: number;
  /** Beschriftung im Readout (z. B. „KW 46“). */
  title?: string;
}

/** Balkendiagramm (z. B. Einheiten oder Volumen je Woche). Die letzte Säule (laufende Woche) ist vorgewählt. */
export function BarChart({
  bars,
  formatValue,
  label,
  color = 'var(--accent)',
  height = 150,
  labelEvery = 1,
}: {
  bars: Bar[];
  formatValue: (v: number) => string;
  label: string;
  color?: string;
  height?: number;
  labelEvery?: number;
}) {
  const [sel, setSel] = useState<number | undefined>(undefined);
  if (!bars.length) return null;
  const idx = Math.min(sel ?? bars.length - 1, bars.length - 1);
  const max = Math.max(...bars.map((b) => b.value), 0);
  const ticks = niceTicks(0, max || 1, 3);
  const top = ticks[ticks.length - 1] || 1;
  const innerW = W - PAD.l - PAD.r;
  const innerH = height - PAD.t - PAD.b;
  const slot = innerW / bars.length;
  const bw = Math.min(26, slot * 0.66);
  const sy = (v: number) => PAD.t + innerH - (v / top) * innerH;
  const cur = bars[idx];
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setSel(Math.max(0, idx - 1));
    else if (e.key === 'ArrowRight') setSel(Math.min(bars.length - 1, idx + 1));
    else return;
    e.preventDefault();
  };
  return (
    <div className="chart">
      <div className="chart-readout" aria-live="polite">
        <b>{formatValue(cur.value)}</b>
        <span>{cur.title ?? cur.label}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} className="chart-svg" role="img" aria-label={`${label}: ${bars.length} Balken, zuletzt ${formatValue(bars[bars.length - 1].value)}`} tabIndex={0} onKeyDown={onKey}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} className="chart-grid" />
            <text x={PAD.l - 6} y={sy(t) + 4} textAnchor="end" className="chart-axis">
              {formatTick(t)}
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const x = PAD.l + slot * i + (slot - bw) / 2;
          const h = Math.max(b.value > 0 ? 2 : 0, innerH - (sy(b.value) - PAD.t));
          return (
            <g key={i} onPointerDown={() => setSel(i)}>
              <rect x={PAD.l + slot * i} y={PAD.t} width={slot} height={innerH} fill="transparent" />
              <rect x={x} y={PAD.t + innerH - h} width={bw} height={h} rx={Math.min(4, bw / 2)} fill={color} opacity={i === idx ? 1 : 0.45} />
              {i % labelEvery === 0 || i === bars.length - 1 ? (
                <text x={x + bw / 2} y={height - 5} textAnchor="middle" className="chart-axis">
                  {b.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function formatTick(t: number): string {
  const a = Math.abs(t);
  if (a >= 10000) return `${String(Math.round(t / 100) / 10).replace('.', ',')}k`;
  return String(Math.round(t * 100) / 100).replace('.', ',');
}
