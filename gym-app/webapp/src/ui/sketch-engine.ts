/**
 * Gliederfigur für die Bewegungsskizzen: zweigliedrige Arme und Beine mit inverser Kinematik.
 * Eine Pose wird nur durch wenige Werte beschrieben (Hüfte, Rumpfwinkel, Hand- und Fußziel in Polarform);
 * Ellbogen und Knie sowie die Griff- und Fußpunkte der Geräte ergeben sich daraus – nichts wird geschätzt.
 */
export type Vec = [number, number];

export const SEG = { torso: 40, uarm: 23, farm: 21, thigh: 31, shin: 30, head: 9, foot: 9 };
export const ARM_LEN = SEG.uarm + SEG.farm;
export const LEG_LEN = SEG.thigh + SEG.shin;

export interface Pose {
  /** Hüfte, relativ zum Ursprung der Szene. */
  hip?: Vec;
  /** Richtung Hüfte → Schulter in Grad (Bildschirmwinkel: 0 = rechts, 90 = unten, −90 = oben). */
  torso: number;
  /** Handziel von der Schulter: [Winkel in Grad, Anteil der Armlänge 0..1]. */
  hand: Vec;
  /** Fußziel von der Hüfte: [Winkel, Anteil der Beinlänge 0..1]. */
  foot: Vec;
  /** Beugerichtung Ellbogen / Knie (+1 im Uhrzeigersinn). */
  elbow?: 1 | -1;
  knee?: 1 | -1;
  /** Kopfneigung relativ zum Rumpf in Grad. */
  head?: number;
  /** Schultern nach oben ziehen (Shrugs), in Bildpunkten. */
  lift?: number;
  /** Absolute Ziele (relativ zum Ursprung) statt Polarwerte: feste Griffe bzw. Bodenkontakt. */
  handAt?: Vec;
  footAt?: Vec;
  /** Zweites Bein (Seitenansicht), absolutes Ziel. */
  foot2At?: Vec;
}

export type Gear =
  | { k: 'line'; a: Vec; b: Vec; w?: number; pad?: boolean }
  | { k: 'rect'; x: number; y: number; w: number; h: number; r?: number }
  | { k: 'circle'; c: Vec; r: number; fill?: boolean }
  | { k: 'follow'; to: 'hand' | 'foot'; shape: 'bar' | 'db' | 'handle' | 'pad'; r?: number }
  | { k: 'plate'; to: 'foot'; len?: number; ang: number }
  | { k: 'cable'; from: Vec; to: 'hand' | 'foot' }
  | { k: 'lever'; from: Vec; to: 'hand' | 'foot'; w?: number };

export interface Pattern {
  id: string;
  name: string;
  view: 'side' | 'front';
  /** Auf der Skizze zu sehende Stichworte. */
  cues: string[];
  start: Pose;
  end: Pose;
  gear: Gear[];
  arrow?: { a: Vec; b: Vec };
  /** Ursprung (Hüfte der Startpose) im 200 × 150-Bild. */
  origin?: Vec;
}

const rad = (d: number) => (d * Math.PI) / 180;
export const dir = (deg: number): Vec => [Math.cos(rad(deg)), Math.sin(rad(deg))];
const add = (p: Vec, q: Vec): Vec => [p[0] + q[0], p[1] + q[1]];
const mul = (p: Vec, k: number): Vec => [p[0] * k, p[1] * k];
const sub = (p: Vec, q: Vec): Vec => [p[0] - q[0], p[1] - q[1]];
const len = (p: Vec) => Math.hypot(p[0], p[1]);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: Vec, b: Vec, t: number): Vec => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
/** Winkel auf kürzestem Weg mischen. */
const lerpAng = (a: number, b: number, t: number) => {
  let d = ((b - a + 540) % 360) - 180;
  if (d === -180) d = 180;
  return a + d * t;
};

/** Zweigliedrige Kette: Wurzel, Ziel, Gliedlängen → Gelenk. `s` wählt die Beugerichtung. */
export function ik(root: Vec, target: Vec, a: number, b: number, s: 1 | -1): { joint: Vec; end: Vec } {
  const to = sub(target, root);
  const dist = Math.min(Math.max(len(to), Math.abs(a - b) + 0.5), a + b - 0.01);
  const base = (Math.atan2(to[1], to[0]) * 180) / Math.PI;
  const cosA = (a * a + dist * dist - b * b) / (2 * a * dist);
  const alpha = (Math.acos(Math.min(1, Math.max(-1, cosA))) * 180) / Math.PI;
  const joint = add(root, mul(dir(base + s * alpha), a));
  const end = add(root, mul(dir(base), dist));
  return { joint, end };
}

export interface Skeleton {
  hip: Vec;
  shoulder: Vec;
  head: Vec;
  elbow: Vec;
  hand: Vec;
  knee: Vec;
  foot: Vec;
  toe: Vec;
  /** Zweites Bein (Seitenansicht). */
  knee2?: Vec;
  foot2?: Vec;
  toe2?: Vec;
  /** Nur Vorderansicht: linke Seite (gespiegelt). */
  l?: { shoulder: Vec; elbow: Vec; hand: Vec; hip: Vec; knee: Vec; foot: Vec };
}

export function solve(p: Pose, view: 'side' | 'front'): Skeleton {
  const hip: Vec = p.hip ?? [0, 0];
  const center0 = add(hip, mul(dir(p.torso), SEG.torso));
  const center: Vec = [center0[0], center0[1] - (p.lift ?? 0)];
  const head = add(center, mul(dir(p.torso + (p.head ?? 0)), SEG.head + 4));
  if (view === 'side') {
    const shoulder = center;
    const handT = p.handAt ?? add(shoulder, mul(dir(p.hand[0]), p.hand[1] * ARM_LEN));
    const arm = ik(shoulder, handT, SEG.uarm, SEG.farm, p.elbow ?? 1);
    const footT = p.footAt ?? add(hip, mul(dir(p.foot[0]), p.foot[1] * LEG_LEN));
    const leg = ik(hip, footT, SEG.thigh, SEG.shin, p.knee ?? -1);
    const toe = add(leg.end, [SEG.foot, 0]);
    const out: Skeleton = { hip, shoulder, head, elbow: arm.joint, hand: arm.end, knee: leg.joint, foot: leg.end, toe };
    if (p.foot2At) {
      const l2 = ik(hip, p.foot2At, SEG.thigh, SEG.shin, p.knee ?? -1);
      out.knee2 = l2.joint;
      out.foot2 = l2.end;
      out.toe2 = add(l2.end, [SEG.foot, 0]);
    }
    return out;
  }
  // Vorderansicht: rechte Körperhälfte berechnen, linke spiegeln (Achse x = hip.x)
  const mirror = (v: Vec): Vec => [2 * hip[0] - v[0], v[1]];
  const sx = 13;
  const hx = 7;
  const shoulderR: Vec = [center[0] + sx, center[1]];
  const hipR: Vec = [hip[0] + hx, hip[1]];
  const handT = p.handAt ?? add(shoulderR, mul(dir(p.hand[0]), p.hand[1] * ARM_LEN));
  const arm = ik(shoulderR, handT, SEG.uarm, SEG.farm, p.elbow ?? 1);
  const footT = p.footAt ?? add(hipR, mul(dir(p.foot[0]), p.foot[1] * LEG_LEN));
  const leg = ik(hipR, footT, SEG.thigh, SEG.shin, p.knee ?? 1);
  return {
    hip,
    shoulder: shoulderR,
    head,
    elbow: arm.joint,
    hand: arm.end,
    knee: leg.joint,
    foot: leg.end,
    toe: add(leg.end, [SEG.foot * 0.6, 0]),
    l: { shoulder: mirror(shoulderR), elbow: mirror(arm.joint), hand: mirror(arm.end), hip: mirror(hipR), knee: mirror(leg.joint), foot: mirror(leg.end) },
  };
}

/** Zwischenpose zu t ∈ [0, 1]. */
export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const opt = (x?: Vec, y?: Vec): Vec | undefined => (x && y ? lerpV(x, y, t) : undefined);
  return {
    handAt: opt(a.handAt, b.handAt),
    footAt: opt(a.footAt, b.footAt),
    foot2At: opt(a.foot2At, b.foot2At),
    lift: lerp(a.lift ?? 0, b.lift ?? 0, t),
    hip: lerpV(a.hip ?? [0, 0], b.hip ?? [0, 0], t),
    torso: lerpAng(a.torso, b.torso, t),
    hand: [lerpAng(a.hand[0], b.hand[0], t), lerp(a.hand[1], b.hand[1], t)],
    foot: [lerpAng(a.foot[0], b.foot[0], t), lerp(a.foot[1], b.foot[1], t)],
    elbow: a.elbow,
    knee: a.knee,
    head: lerp(a.head ?? 0, b.head ?? 0, t),
  };
}

/** Welche Körperteile bewegen sich zwischen Start und Ende (werden neongelb gezeichnet)? */
export function movingParts(p: Pattern): { arm: boolean; leg: boolean; torso: boolean } {
  const a = solve(p.start, p.view);
  const b = solve(p.end, p.view);
  const far = (u: Vec, v: Vec) => len(sub(u, v)) > 7;
  return {
    arm: far(a.hand, b.hand) || far(a.elbow, b.elbow),
    leg: far(a.foot, b.foot) || far(a.knee, b.knee) || (!!a.foot2 && !!b.foot2 && far(a.foot2, b.foot2)),
    torso: far(a.shoulder, b.shoulder) || far(a.head, b.head) || far(a.hip, b.hip),
  };
}

/** Beschreibt die Gerätformen zu t (bewegte Teile hängen an Hand oder Fuß). */
export function gearPoints(g: Gear, sk: Skeleton): Gear {
  if (g.k === 'follow') return { k: 'circle', c: g.to === 'hand' ? sk.hand : sk.foot, r: g.r ?? 3, fill: g.shape !== 'bar' };
  return g;
}
