import { describe, expect, it } from 'vitest';
import { ALL_CATALOG_EXERCISES } from '../src/data/seed';
import { MOTION_BY_ID, MOTION_PATTERNS, motionFor, motionIdFor } from '../src/data/motions';
import { ARM_LEN, ik, LEG_LEN, SEG, solve, mixPose } from '../src/ui/sketch-engine';

const d = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('Bewegungsskizzen', () => {
  it('jede mitgelieferte Übung hat eine Skizze', () => {
    const without = ALL_CATALOG_EXERCISES.filter((e) => !motionFor(e)).map((e) => `${e.id} (${e.name})`);
    expect(without).toEqual([]);
  });

  it('typische Übungen bekommen das passende Muster', () => {
    const id = (n: string, name = n) => motionIdFor({ id: `ex-${n}`, name });
    expect(id('bankdruecken-langhantel', 'Bankdrücken (Langhantel)')).toBe('bankdruecken');
    expect(id('brustpresse-maschine', 'Brustpresse (Maschine)')).toBe('brustpresse');
    expect(id('latzug-breit', 'Latzug breit (zur Brust)')).toBe('latzug');
    expect(id('beinpresse', 'Beinpresse')).toBe('beinpresse');
    expect(id('gym80-waden', 'Wadenheben stehend (gym80)')).toBe('waden-stehend');
    expect(id('x', 'Abduktoren (Maschine)')).toBe('abduktion');
    expect(id('x', 'Adduktoren (Maschine)')).toBe('adduktion');
    expect(id('curl-kurzhantel', 'Bizepscurl (Kurzhantel)')).toBe('bizepscurl');
  });

  it('eine ausdrücklich gesetzte motionId hat Vorrang', () => {
    expect(motionIdFor({ id: 'eigen', name: 'Meine Übung', motionId: 'plank' } as never)).toBe('plank');
    expect(motionIdFor({ id: 'eigen', name: 'Meine Übung', motionId: 'gibt-es-nicht' } as never)).toBeUndefined();
  });

  it('alle Muster haben Start, Ende, Stichworte und eindeutige Kennungen', () => {
    expect(new Set(MOTION_PATTERNS.map((p) => p.id)).size).toBe(MOTION_PATTERNS.length);
    for (const p of MOTION_PATTERNS) {
      expect(p.cues.length).toBeGreaterThanOrEqual(2);
      expect(MOTION_BY_ID[p.id]).toBe(p);
    }
  });

  it('die Gliederlängen bleiben in jeder Pose erhalten (Seiten- und Vorderansicht)', () => {
    for (const p of MOTION_PATTERNS) {
      for (const t of [0, 0.35, 1]) {
        const sk = solve(mixPose(p.start, p.end, t), p.view);
        expect(d(sk.shoulder, sk.elbow)).toBeCloseTo(SEG.uarm, 3);
        expect(d(sk.elbow, sk.hand)).toBeCloseTo(SEG.farm, 3);
        expect(d(p.view === 'side' ? sk.hip : [sk.hip[0] + 7, sk.hip[1]], sk.knee)).toBeCloseTo(SEG.thigh, 3);
        expect(d(sk.knee, sk.foot)).toBeCloseTo(SEG.shin, 3);
      }
    }
  });

  it('Griff- und Bodenpunkte werden berechnet, nicht geschätzt', () => {
    // Klimmzug: die Hand bleibt an der Stange, auch wenn die Hüfte steigt
    const k = MOTION_BY_ID['klimmzug'];
    const a = solve(k.start, 'side');
    const b = solve(mixPose(k.start, k.end, 1), 'side');
    expect(a.hand[1]).toBeCloseTo(-84, 0);
    expect(b.hand[1]).toBeCloseTo(-84, 0);
    // Kniebeuge: der Fuß bleibt auf dem Boden (y = 61)
    const s = MOTION_BY_ID['kniebeuge'];
    for (const t of [0, 0.5, 1]) expect(solve(mixPose(s.start, s.end, t), 'side').foot[1]).toBeCloseTo(61, 0);
  });

  it('Ellbogen und Knie knicken nur in die gewählte Richtung und strecken sich nicht über', () => {
    const j = ik([0, 0], [100, 0], 23, 21, 1);
    expect(d([0, 0], j.end)).toBeLessThanOrEqual(ARM_LEN);
    const bent = ik([0, 0], [30, 0], 31, 30, -1);
    expect(bent.joint[1]).toBeLessThan(0); // −1 knickt nach oben (gegen den Uhrzeigersinn)
    const bent2 = ik([0, 0], [30, 0], 31, 30, 1);
    expect(bent2.joint[1]).toBeGreaterThan(0);
    expect(LEG_LEN).toBe(61);
  });
});
