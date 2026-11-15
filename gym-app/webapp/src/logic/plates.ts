/**
 * Scheibenrechner für scheibenbeladene Geräte: aus dem Gesamtgewicht ergibt sich, welche Scheiben je Seite aufgelegt werden.
 * Nicht darstellbare Gewichte werden auf das nächste mögliche gerundet (und als gerundet gekennzeichnet).
 */
export const DEFAULT_PLATES = [1.25, 2.5, 5, 10, 15, 20, 25];

export interface PlatePlan {
  /** Scheiben je Seite, schwerste zuerst. */
  perSide: number[];
  /** Gewicht je Seite in kg. */
  perSideKg: number;
  /** Tatsächlich erreichtes Gesamtgewicht (Eigengewicht + Aufnahmen × je Seite). */
  totalKg: number;
  /** Wunsch-Gesamtgewicht. */
  requestedKg: number;
  /** Stimmt der Wunsch genau mit dem erreichbaren Gewicht überein? */
  exact: boolean;
}

const cents = (kg: number) => Math.round(kg * 100);

/**
 * `ownKg`: Eigengewicht von Hebelarm/Schlitten, `slots`: Zahl der Aufnahmen (meist 2: links und rechts).
 * Es werden so wenige Scheiben wie möglich verwendet (Münzwechsel-Verfahren), unbegrenzt viele je Größe.
 */
export function platesPerSide(totalKg: number, ownKg = 0, slots = 2, available: number[] = DEFAULT_PLATES): PlatePlan {
  const num = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);
  // Eingaben begrenzen (Gewichte aus Sicherungen/Eingabe können unsinnig sein; die Tabelle wächst mit dem Gewicht)
  const plates = [...new Set(available.filter((p) => Number.isFinite(p) && p > 0 && p <= 100).map(cents))].sort((a, b) => b - a);
  const s = Math.min(8, Math.max(1, Math.round(num(slots, 2))));
  ownKg = Math.min(500, Math.max(0, num(ownKg, 0)));
  const requestedKg = num(totalKg, 0);
  totalKg = Math.min(2000, Math.max(0, requestedKg));
  if (!plates.length) return { perSide: [], perSideKg: 0, totalKg: ownKg, requestedKg, exact: Math.abs(totalKg - ownKg) < 0.005 };
  const wanted = Math.max(0, cents((totalKg - ownKg) / s));
  const limit = wanted + plates[0] + 1;
  // minimale Scheibenzahl je erreichbarem Betrag
  const best: number[] = new Array(limit + 1).fill(Infinity);
  const take: number[] = new Array(limit + 1).fill(0);
  best[0] = 0;
  for (let v = 1; v <= limit; v++) {
    for (const p of plates) {
      if (p <= v && best[v - p] + 1 < best[v]) {
        best[v] = best[v - p] + 1;
        take[v] = p;
      }
    }
  }
  // nächster erreichbarer Betrag (bei Gleichstand der niedrigere)
  let target = -1;
  for (let d = 0; d <= limit; d++) {
    if (wanted - d >= 0 && best[wanted - d] < Infinity) {
      target = wanted - d;
      break;
    }
    if (wanted + d <= limit && best[wanted + d] < Infinity) {
      target = wanted + d;
      break;
    }
  }
  if (target < 0) target = 0;
  const perSide: number[] = [];
  for (let v = target; v > 0; v -= take[v]) perSide.push(take[v] / 100);
  perSide.sort((a, b) => b - a);
  const perSideKg = target / 100;
  const achieved = Math.round((ownKg + perSideKg * s) * 100) / 100;
  return { perSide, perSideKg, totalKg: achieved, requestedKg, exact: Math.abs(achieved - requestedKg) < 0.005 };
}

/** „20 + 5 + 2,5“ – gleiche Scheiben zusammengefasst („2 × 20 + 5“). */
export function formatPlates(perSide: number[]): string {
  if (!perSide.length) return 'keine Scheiben';
  const counts = new Map<number, number>();
  for (const p of perSide) counts.set(p, (counts.get(p) ?? 0) + 1);
  const num = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
  return [...counts.entries()].map(([p, n]) => (n > 1 ? `${n} × ${num(p)}` : num(p))).join(' + ');
}
