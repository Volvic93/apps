/** Gleichmäßige, „runde“ Achsenwerte (1, 2, 2,5, 5 × 10ⁿ), die den Bereich min…max umfassen. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    const d = Math.abs(min) * 0.1 || 1;
    min -= d;
    max += d;
  }
  const raw = (max - min) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(min / step + 1e-9) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step - 1e-9 && out.length < 12; v += step) {
    out.push(Math.round(v * 1e6) / 1e6);
    if (v >= max - 1e-9) break;
  }
  return out;
}

/** Index des Punkts, dessen x-Wert am nächsten an `x` liegt (xs aufsteigend sortiert, nicht leer). */
export function nearestIndex(xs: number[], x: number): number {
  let best = 0;
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
  return best;
}
