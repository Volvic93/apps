import type { ReactNode } from 'react';
import type { PictogramId } from '../data/types';

/**
 * Einheitlicher Strichzeichnungs-Satz für Gerätekategorien (48 × 48, 2 px Strich, runde Enden).
 * Jedes Piktogramm besteht aus einer Bodenlinie und der Silhouette des Geräts – Polster als kurze dicke Striche,
 * Gewichtsblöcke als Rechtecke mit Teilungslinien, Scheiben als Kreise.
 */
const FLOOR = <path d="M5 42h38" />;

const SHAPES: Record<PictogramId, ReactNode> = {
  brustpresse: (
    <>
      {FLOOR}
      <path d="M13 12v22M10 34h16M13 21h19M32 16v10M36 12v26h5V12" />
      <path d="M26 34v8" />
    </>
  ),
  butterfly: (
    <>
      {FLOOR}
      <path d="M24 10v22M17 34h14M24 42v-8" />
      <path d="M24 17c-9 0-14 3-14 10M24 17c9 0 14 3 14 10" />
      <path d="M10 27v5M38 27v5" />
    </>
  ),
  schulterpresse: (
    <>
      {FLOOR}
      <path d="M16 14v22M12 36h16M16 42v-6" />
      <path d="M16 24l14-8M30 16V8M30 16l6 4M36 20v-8" />
    </>
  ),
  latzug: (
    <>
      {FLOOR}
      <path d="M36 6v36M32 6h8" />
      <path d="M17 8h14M17 8v6M31 8v6" />
      <path d="M24 8v8M12 40h20M20 32h8v8" />
      <path d="M24 16v14" />
    </>
  ),
  rudern: (
    <>
      {FLOOR}
      <path d="M11 22v12M8 34h14M11 42v-8" />
      <path d="M14 26h18M32 22v8" />
      <path d="M38 12v26h4V12z" />
    </>
  ),
  kabelzug: (
    <>
      {FLOOR}
      <path d="M12 6v36M12 6h24M36 6v8" />
      <path d="M36 14l-3 6h6z" />
      <path d="M18 18h-3v18h3z" />
    </>
  ),
  'multi-kabelzug': (
    <>
      {FLOOR}
      <path d="M17 14v28M31 14v28M17 14h14" />
      <path d="M17 14L8 6M31 14l9-8M8 6v6M40 6v6" />
      <path d="M12 8h-4M40 8h-4" />
      <path d="M22 42v-8M26 42v-8" />
    </>
  ),
  'curl-maschine': (
    <>
      {FLOOR}
      <path d="M14 14v28M10 42h14" />
      <path d="M14 20l16 6" />
      <path d="M14 20v-6l14-4" />
      <path d="M30 26l8 10" />
      <circle cx="38" cy="14" r="5" />
    </>
  ),
  'trizeps-maschine': (
    <>
      {FLOOR}
      <path d="M14 10v32M10 42h14" />
      <path d="M14 16h12l6 12" />
      <path d="M32 28h6" />
      <path d="M38 12v26h4V12z" />
    </>
  ),
  beinpresse: (
    <>
      {FLOOR}
      <path d="M8 40L26 24" />
      <path d="M6 30l8-8" />
      <path d="M30 14l10 14M26 20l10 14" />
      <circle cx="33" cy="22" r="3" />
    </>
  ),
  beinstrecker: (
    <>
      {FLOOR}
      <path d="M12 12v20h14M12 32v10" />
      <path d="M26 32l10 4M36 36l2 6" />
      <path d="M8 18h4" />
      <path d="M40 12v18h3V12z" />
    </>
  ),
  beinbeuger: (
    <>
      {FLOOR}
      <path d="M8 28h22M8 34v8M30 28v14" />
      <path d="M30 28l10-8M40 20l2 6" />
      <path d="M6 24h4" />
    </>
  ),
  'seitheben-maschine': (
    <>
      {FLOOR}
      <path d="M13 6v36M13 6h8" />
      <path d="M26 42V30h14v12" />
      <path d="M21 6v8l12 8" />
      <path d="M33 22l8-6" />
      <path d="M38 8v22h4V8z" />
    </>
  ),
  'hip-thrust': (
    <>
      {FLOOR}
      <path d="M6 30h12M10 30v12M18 30l14-8M32 22h8M36 14v16M40 14v16" />
    </>
  ),
  pendelsquat: (
    <>
      {FLOOR}
      <path d="M8 40l14-8M22 32l12-20M34 12v8M30 16h8" />
      <circle cx="38" cy="32" r="5" />
    </>
  ),
  beltsquat: (
    <>
      {FLOOR}
      <path d="M6 38h24M10 38v4M26 38v4M18 38V12M12 12h12" />
      <path d="M18 12v-4M34 30v12M40 30v12M34 36h6" />
    </>
  ),
  pullover: (
    <>
      {FLOOR}
      <path d="M12 34h16M20 34v8M20 34V18M20 18l16-8M36 10v10" />
      <path d="M14 18h-4" />
    </>
  ),
  adduktor: (
    <>
      {FLOOR}
      <path d="M24 10v26M16 36h16M24 42v-6" />
      <path d="M24 22l-11 8M24 22l11 8" />
      <path d="M11 28l4 6M37 28l-4 6" />
    </>
  ),
  waden: (
    <>
      {FLOOR}
      <path d="M12 10h18M12 10v32M30 10v8" />
      <path d="M18 36h18M18 36v6M36 36v6" />
      <path d="M24 10v26" />
    </>
  ),
  bauch: (
    <>
      {FLOOR}
      <path d="M14 14v22M10 36h14M14 42v-6" />
      <path d="M14 20c6-2 14 0 18 8" />
      <path d="M32 28l4 8" />
      <path d="M38 10v26h4V10z" />
    </>
  ),
  rueckenstrecker: (
    <>
      {FLOOR}
      <path d="M12 38h14M19 42v-4" />
      <path d="M12 38V22l12-10" />
      <path d="M24 12h8" />
      <path d="M36 12v26h4V12z" />
    </>
  ),
  hantelbank: (
    <>
      {FLOOR}
      <path d="M8 28h24" />
      <path d="M12 28v14M28 28v14" />
      <path d="M36 28l4-10" />
      <path d="M32 28h4" />
    </>
  ),
  langhantel: (
    <>
      {FLOOR}
      <path d="M6 24h36" />
      <path d="M12 14v20M17 17v14M36 14v20M31 17v14" />
    </>
  ),
  kurzhantel: (
    <>
      {FLOOR}
      <path d="M16 24h16" />
      <path d="M12 16v16M16 18v12M36 16v16M32 18v12" />
    </>
  ),
  multipresse: (
    <>
      {FLOOR}
      <path d="M12 6v36M36 6v36" />
      <path d="M8 24h32" />
      <path d="M8 20v8M40 20v8" />
      <path d="M12 12h-3M12 36h-3" />
    </>
  ),
  klimmzug: (
    <>
      {FLOOR}
      <path d="M8 8h32" />
      <path d="M12 8v34M36 8v34" />
      <path d="M20 14c0 6 3 10 4 12 1-2 4-6 4-12" />
    </>
  ),
  koerpergewicht: (
    <>
      {FLOOR}
      <circle cx="14" cy="20" r="3.5" />
      <path d="M17 22l16 8" />
      <path d="M33 30l8 8M33 30l-3 12" />
      <path d="M17 22l-5 14" />
    </>
  ),
  laufband: (
    <>
      {FLOOR}
      <path d="M6 36h30l4-6" />
      <path d="M8 36v6M34 36v6" />
      <path d="M36 30V10h-6" />
      <circle cx="14" cy="36" r="1.5" />
      <circle cx="30" cy="36" r="1.5" />
    </>
  ),
  rad: (
    <>
      {FLOOR}
      <circle cx="16" cy="32" r="8" />
      <circle cx="36" cy="32" r="8" />
      <path d="M16 32l8-14h10M36 32L28 18M22 14h6" />
    </>
  ),
  rudergeraet: (
    <>
      {FLOOR}
      <path d="M6 38h30" />
      <path d="M36 38v-8h-6" />
      <path d="M36 30l6-10" />
      <path d="M16 38v-4h8v4" />
      <circle cx="38" cy="18" r="5" />
    </>
  ),
  generisch: (
    <>
      {FLOOR}
      <path d="M14 10v32M34 10v32M14 10h20" />
      <path d="M14 26h20" />
      <path d="M20 26v8h8v-8" />
    </>
  ),
};

export function Pictogram({ id, size = 40, className }: { id: PictogramId; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {SHAPES[id] ?? SHAPES.generisch}
    </svg>
  );
}

export const PICTOGRAM_LABEL: Record<PictogramId, string> = {
  brustpresse: 'Brustpresse',
  butterfly: 'Butterfly',
  schulterpresse: 'Schulterpresse',
  latzug: 'Latzug',
  rudern: 'Rudermaschine',
  kabelzug: 'Kabelzug',
  'multi-kabelzug': 'Doppel-Kabelzug',
  'curl-maschine': 'Curl-Maschine',
  'trizeps-maschine': 'Trizeps-Maschine',
  beinpresse: 'Beinpresse',
  beinstrecker: 'Beinstrecker',
  beinbeuger: 'Beinbeuger',
  'seitheben-maschine': 'Seitheben-Maschine',
  'hip-thrust': 'Hip Thrust',
  pendelsquat: 'Pendel-Kniebeuge',
  beltsquat: 'Belt Squat',
  pullover: 'Pullover-Maschine',
  adduktor: 'Adduktor/Abduktor',
  waden: 'Wadenmaschine',
  bauch: 'Bauchmaschine',
  rueckenstrecker: 'Rückenstrecker',
  hantelbank: 'Hantelbank',
  langhantel: 'Langhantel',
  kurzhantel: 'Kurzhantel',
  multipresse: 'Multipresse',
  klimmzug: 'Klimmzug / Dip',
  koerpergewicht: 'Körpergewicht',
  laufband: 'Laufband',
  rad: 'Fahrrad / Crosstrainer',
  rudergeraet: 'Rudergerät',
  generisch: 'Sonstiges Gerät',
};

export const ALL_PICTOGRAMS = Object.keys(SHAPES) as PictogramId[];
