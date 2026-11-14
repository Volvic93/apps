import { describe, expect, it } from 'vitest';
import { nearestIndex, niceTicks } from '../src/logic/chart';

describe('Diagrammachsen', () => {
  it('liefert runde Achsenwerte, die den Bereich umfassen', () => {
    const t = niceTicks(40, 60, 3);
    expect(t[0]).toBeLessThanOrEqual(40);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(60);
    for (let i = 1; i < t.length; i++) expect(t[i] - t[i - 1]).toBeCloseTo(t[1] - t[0]);
  });
  it('behandelt gleiche Werte und Nullbereiche', () => {
    const t = niceTicks(5, 5, 3);
    expect(t.length).toBeGreaterThan(1);
    expect(t[0]).toBeLessThan(5);
    expect(niceTicks(0, 0, 3).length).toBeGreaterThan(1);
    expect(niceTicks(0, 2, 3)[0]).toBe(0);
  });
  it('findet den nächsten Punkt', () => {
    expect(nearestIndex([10, 20, 30], 24)).toBe(1);
    expect(nearestIndex([10, 20, 30], 100)).toBe(2);
    expect(nearestIndex([10], 0)).toBe(0);
  });
});
