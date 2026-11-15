import { useEffect, useRef, useState } from 'react';
import { motionFor } from '../data/motions';
import type { Exercise } from '../data/types';
import { dir, mixPose, movingParts, solve, type Gear, type Pattern, type Vec } from './sketch-engine';

const reducedMotion = (): boolean => {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const f = (n: number) => Math.round(n * 10) / 10;

function Seg({ a, b, w, active }: { a: Vec; b: Vec; w: number; active: boolean }) {
  return <line x1={f(a[0])} y1={f(a[1])} x2={f(b[0])} y2={f(b[1])} strokeWidth={w} strokeLinecap="round" className={active ? 'sk-act' : 'sk-body'} />;
}

function GearShape({ g, hand, foot }: { g: Gear; hand: Vec; foot: Vec }) {
  switch (g.k) {
    case 'line':
      return <line x1={g.a[0]} y1={g.a[1]} x2={g.b[0]} y2={g.b[1]} strokeWidth={g.w ?? 2} strokeLinecap="round" className={g.pad ? 'sk-pad' : 'sk-gear'} />;
    case 'rect':
      return <rect x={g.x} y={g.y} width={g.w} height={g.h} rx={g.r ?? 0} className="sk-pad-fill" />;
    case 'circle':
      return <circle cx={g.c[0]} cy={g.c[1]} r={g.r} className={g.fill ? 'sk-gear-fill' : 'sk-gear'} fill={g.fill ? undefined : 'none'} strokeWidth={2} />;
    case 'cable': {
      const t = g.to === 'hand' ? hand : foot;
      return <line x1={g.from[0]} y1={g.from[1]} x2={f(t[0])} y2={f(t[1])} strokeWidth={1.2} className="sk-gear" strokeDasharray="3 2" />;
    }
    case 'lever': {
      const t = g.to === 'hand' ? hand : foot;
      return <line x1={g.from[0]} y1={g.from[1]} x2={f(t[0])} y2={f(t[1])} strokeWidth={g.w ?? 4} strokeLinecap="round" className="sk-gear" />;
    }
    case 'plate': {
      const a = dir(g.ang);
      const h = (g.len ?? 30) / 2;
      return <line x1={f(foot[0] - a[0] * h)} y1={f(foot[1] - a[1] * h)} x2={f(foot[0] + a[0] * h)} y2={f(foot[1] + a[1] * h)} strokeWidth={5} strokeLinecap="round" className="sk-pad" />;
    }
    case 'follow': {
      const p = g.to === 'hand' ? hand : foot;
      if (g.shape === 'bar') return (
        <g>
          <circle cx={f(p[0])} cy={f(p[1])} r={g.r ?? 9} className="sk-gear" fill="none" strokeWidth={2} />
          <circle cx={f(p[0])} cy={f(p[1])} r={2.6} className="sk-gear-fill" />
        </g>
      );
      if (g.shape === 'db') return <circle cx={f(p[0])} cy={f(p[1])} r={g.r ?? 5} className="sk-gear-fill" />;
      return <circle cx={f(p[0])} cy={f(p[1])} r={g.r ?? 3} className="sk-gear-fill" />;
    }
  }
}

/** Eine Momentaufnahme der Skizze zu t ∈ [0, 1] (0 = Start, 1 = Ende). */
export function SketchSvg({ pattern, t, label }: { pattern: Pattern; t: number; label?: string }) {
  const pose = mixPose(pattern.start, pattern.end, t);
  const sk = solve(pose, pattern.view);
  const mv = movingParts(pattern);
  const o = pattern.origin ?? [96, 84];
  const front = pattern.view === 'front';
  const arrow = pattern.arrow;
  let head: Vec[] = [];
  if (arrow) {
    const d = [arrow.b[0] - arrow.a[0], arrow.b[1] - arrow.a[1]];
    const L = Math.hypot(d[0], d[1]) || 1;
    const u: Vec = [d[0] / L, d[1] / L];
    const n: Vec = [-u[1], u[0]];
    const b = arrow.b;
    head = [b, [b[0] - u[0] * 7 + n[0] * 4, b[1] - u[1] * 7 + n[1] * 4], [b[0] - u[0] * 7 - n[0] * 4, b[1] - u[1] * 7 - n[1] * 4]];
  }
  return (
    <svg viewBox="0 0 200 150" role="img" aria-label={label ?? pattern.name} className="sketch-svg">
      <g transform={`translate(${o[0]} ${o[1]})`}>
        {pattern.gear.filter((g) => g.k !== 'follow').map((g, i) => (
          <GearShape key={i} g={g} hand={sk.hand} foot={sk.foot} />
        ))}
        {front ? (
          <g>
            <Seg a={sk.hip} b={[sk.hip[0], sk.hip[1] - 0]} w={1} active={false} />
            <Seg a={[sk.hip[0], sk.hip[1] - 2]} b={[(sk.l!.shoulder[0] + sk.shoulder[0]) / 2, sk.shoulder[1]]} w={22} active={mv.torso} />
            <Seg a={sk.l!.hip} b={sk.l!.knee} w={10} active={mv.leg} />
            <Seg a={sk.l!.knee} b={sk.l!.foot} w={8} active={mv.leg} />
            <Seg a={[sk.hip[0] + 7, sk.hip[1]]} b={sk.knee} w={10} active={mv.leg} />
            <Seg a={sk.knee} b={sk.foot} w={8} active={mv.leg} />
            <Seg a={sk.l!.shoulder} b={sk.l!.elbow} w={7} active={mv.arm} />
            <Seg a={sk.l!.elbow} b={sk.l!.hand} w={6} active={mv.arm} />
            <Seg a={sk.shoulder} b={sk.elbow} w={7} active={mv.arm} />
            <Seg a={sk.elbow} b={sk.hand} w={6} active={mv.arm} />
          </g>
        ) : (
          <g>
            {sk.knee2 && sk.foot2 && sk.toe2 && (
              <g opacity={0.55}>
                <Seg a={sk.hip} b={sk.knee2} w={10} active={mv.leg} />
                <Seg a={sk.knee2} b={sk.foot2} w={8} active={mv.leg} />
                <Seg a={sk.foot2} b={sk.toe2} w={5} active={mv.leg} />
              </g>
            )}
            <Seg a={sk.hip} b={sk.shoulder} w={14} active={mv.torso} />
            <Seg a={sk.hip} b={sk.knee} w={10} active={mv.leg} />
            <Seg a={sk.knee} b={sk.foot} w={8} active={mv.leg} />
            <Seg a={sk.foot} b={sk.toe} w={5} active={mv.leg} />
            <Seg a={sk.shoulder} b={sk.elbow} w={7} active={mv.arm} />
            <Seg a={sk.elbow} b={sk.hand} w={6} active={mv.arm} />
          </g>
        )}
        <circle cx={f(sk.head[0])} cy={f(sk.head[1])} r={8.5} className={mv.torso ? 'sk-act-fill' : 'sk-body-fill'} />
        {pattern.gear.filter((g) => g.k === 'follow').map((g, i) => (
          <GearShape key={`f${i}`} g={g} hand={sk.hand} foot={sk.foot} />
        ))}
        {front && pattern.gear.filter((g) => g.k === 'follow' && g.to === 'hand').map((g, i) => (
          <circle key={`m${i}`} cx={f(sk.l!.hand[0])} cy={f(sk.l!.hand[1])} r={(g as Extract<Gear, { k: 'follow' }>).shape === 'bar' ? 4 : (g as Extract<Gear, { k: 'follow' }>).r ?? 3} className="sk-gear-fill" />
        ))}
        {arrow && (
          <g className="sk-arrow">
            <line x1={arrow.a[0]} y1={arrow.a[1]} x2={arrow.b[0]} y2={arrow.b[1]} strokeWidth={2} strokeLinecap="round" strokeDasharray="1 4" />
            <polygon points={head.map((p) => p.join(',')).join(' ')} />
          </g>
        )}
      </g>
    </svg>
  );
}

/** Skizze eines Bewegungsmusters: läuft von selbst zwischen Start und Ende; Tippen hält an bzw. schaltet um. */
export function MotionSketch({ pattern, title, compact }: { pattern: Pattern; title?: string; compact?: boolean }) {
  const [t, setT] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(reducedMotion()).current;
  useEffect(() => {
    if (reduced || paused) return;
    let raf = 0;
    const t0 = performance.now() - t * 1500;
    const tick = (now: number) => {
      const phase = ((now - t0) % 3000) / 1500; // 0..2
      const lin = phase <= 1 ? phase : 2 - phase;
      setT(lin * lin * (3 - 2 * lin));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, paused]);

  const body = reduced ? (
    <div className="sketch-pair">
      <figure>
        <SketchSvg pattern={pattern} t={0} />
        <figcaption>Start</figcaption>
      </figure>
      <figure>
        <SketchSvg pattern={pattern} t={1} />
        <figcaption>Ende</figcaption>
      </figure>
    </div>
  ) : (
    <div className="sketch">
      <button
        type="button"
        className="sketch-frame"
        onClick={() => {
          setPaused(true);
          setT((v) => (v < 0.5 ? 1 : 0));
        }}
        aria-label={`${pattern.name}: Bewegungsskizze. Tippen zum Umschalten.`}
      >
        <SketchSvg pattern={pattern} t={t} />
      </button>
      <div className="motion-cap">
        <span>{t < 0.5 ? 'Start' : 'Ende'}</span>
        <button type="button" className="btn small ghost" onClick={() => setPaused((v) => !v)}>
          {paused ? 'Abspielen' : 'Anhalten'}
        </button>
      </div>
    </div>
  );
  const cues = !compact && (
    <ul className="sketch-cues">
      {pattern.cues.map((c) => (
        <li key={c}>{c}</li>
      ))}
    </ul>
  );
  return title ? (
    <section className="card">
      <div className="card-title">{title}</div>
      {body}
      {cues}
    </section>
  ) : (
    <div>
      {body}
      {cues}
    </div>
  );
}

/** Skizze zu einer Übung des Katalogs oder einer eigenen Übung (Muster nach `motionId` bzw. Name). */
export function ExerciseSketch({ ex, title, compact }: { ex: Pick<Exercise, 'id' | 'name'> & { motionId?: string }; title?: string; compact?: boolean }) {
  const p = motionFor(ex);
  if (!p) return null;
  return <MotionSketch pattern={p} title={title} compact={compact} />;
}
