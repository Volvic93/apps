import type { MuscleId } from './types';

export const MUSCLES: MuscleId[] = [
  'brust',
  'oberer_ruecken',
  'latissimus',
  'unterer_ruecken',
  'schulter_vorn',
  'schulter_seitlich',
  'schulter_hinten',
  'bizeps',
  'trizeps',
  'unterarm',
  'bauch',
  'schraeg',
  'gesaess',
  'quadrizeps',
  'beinbeuger',
  'adduktoren',
  'abduktoren',
  'waden',
];

export const MUSCLE_LABEL: Record<MuscleId, string> = {
  brust: 'Brust',
  oberer_ruecken: 'Oberer Rücken',
  latissimus: 'Latissimus',
  unterer_ruecken: 'Unterer Rücken',
  schulter_vorn: 'Vordere Schulter',
  schulter_seitlich: 'Seitliche Schulter',
  schulter_hinten: 'Hintere Schulter',
  bizeps: 'Bizeps',
  trizeps: 'Trizeps',
  unterarm: 'Unterarm',
  bauch: 'Bauch',
  schraeg: 'Schräge Bauchmuskeln',
  gesaess: 'Gesäß',
  quadrizeps: 'Quadrizeps',
  beinbeuger: 'Beinbeuger',
  adduktoren: 'Adduktoren',
  abduktoren: 'Abduktoren',
  waden: 'Waden',
};

/** Grobe Gruppen für Filter und Kennzeichnung. */
export type MuscleGroupId = 'brust' | 'ruecken' | 'schultern' | 'arme' | 'rumpf' | 'beine';

export const MUSCLE_GROUPS: { id: MuscleGroupId; label: string; muscles: MuscleId[]; color: string }[] = [
  { id: 'brust', label: 'Brust', muscles: ['brust'], color: 'var(--grp-brust)' },
  { id: 'ruecken', label: 'Rücken', muscles: ['oberer_ruecken', 'latissimus', 'unterer_ruecken'], color: 'var(--grp-ruecken)' },
  { id: 'schultern', label: 'Schultern', muscles: ['schulter_vorn', 'schulter_seitlich', 'schulter_hinten'], color: 'var(--grp-schultern)' },
  { id: 'arme', label: 'Arme', muscles: ['bizeps', 'trizeps', 'unterarm'], color: 'var(--grp-arme)' },
  { id: 'rumpf', label: 'Rumpf', muscles: ['bauch', 'schraeg'], color: 'var(--grp-rumpf)' },
  { id: 'beine', label: 'Beine & Gesäß', muscles: ['gesaess', 'quadrizeps', 'beinbeuger', 'adduktoren', 'abduktoren', 'waden'], color: 'var(--grp-beine)' },
];

export function groupOfMuscle(m: MuscleId): MuscleGroupId {
  return MUSCLE_GROUPS.find((g) => g.muscles.includes(m))!.id;
}

export function groupColor(g: MuscleGroupId): string {
  return MUSCLE_GROUPS.find((x) => x.id === g)!.color;
}

export function muscleColor(m: MuscleId): string {
  return groupColor(groupOfMuscle(m));
}
