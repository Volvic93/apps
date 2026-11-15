// Datenmodell nach KONZEPT.md Abschnitt 4.
// Abweichungen/Ergänzungen sind im Konzept nachgetragen (Abschnitt 4, "Ergänzungen Stufe 1").

export type MuscleId =
  | 'brust'
  | 'oberer_ruecken'
  | 'latissimus'
  | 'unterer_ruecken'
  | 'schulter_vorn'
  | 'schulter_seitlich'
  | 'schulter_hinten'
  | 'bizeps'
  | 'trizeps'
  | 'unterarm'
  | 'bauch'
  | 'schraeg'
  | 'gesaess'
  | 'quadrizeps'
  | 'beinbeuger'
  | 'adduktoren'
  | 'abduktoren'
  | 'waden';

export type EquipmentKind = 'maschine' | 'kabelzug' | 'freihantel' | 'koerpergewicht' | 'cardio';
export type Loading = 'gewichtsblock' | 'scheiben' | 'frei' | 'keins';

export type PictogramId =
  | 'brustpresse'
  | 'butterfly'
  | 'schulterpresse'
  | 'latzug'
  | 'rudern'
  | 'kabelzug'
  | 'multi-kabelzug'
  | 'curl-maschine'
  | 'trizeps-maschine'
  | 'beinpresse'
  | 'beinstrecker'
  | 'beinbeuger'
  | 'seitheben-maschine'
  | 'hip-thrust'
  | 'pendelsquat'
  | 'beltsquat'
  | 'pullover'
  | 'adduktor'
  | 'waden'
  | 'bauch'
  | 'rueckenstrecker'
  | 'hantelbank'
  | 'langhantel'
  | 'kurzhantel'
  | 'multipresse'
  | 'klimmzug'
  | 'koerpergewicht'
  | 'laufband'
  | 'rad'
  | 'rudergeraet'
  | 'generisch';

export interface WeightStack {
  minKg: number;
  maxKg: number;
  stepKg: number;
  /** Unregelmäßige Blöcke: ausdrückliche Stufenliste (aufsteigend). +/− springt dann von Stufe zu Stufe. */
  levels?: number[];
  /** "platte": der Block trägt nur Plattennummern; protokolliert wird die Nummer (nicht in Kilogramm-Volumen/Rekorde). */
  unit?: 'kg' | 'platte';
}

export interface Adjustment {
  id: string;
  label: string;
  min: number;
  max: number;
  myValue?: number;
  photoId?: string;
  /** Bild, das fest in der App mitgeliefert wird (Pfad unter public/). */
  builtinPhoto?: string;
}

export interface BuiltinPhoto {
  src: string; // z. B. 'geraete/newtech-multi-pully-tafel.jpg'
  caption: string;
}

export interface Record_ {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export interface Equipment extends Record_ {
  name: string;
  brand?: string;
  model?: string;
  studioNumber?: string;
  kind: EquipmentKind;
  loading: Loading;
  pictogram: PictogramId;
  weightStack?: WeightStack;
  /** Scheibenbeladene Geräte: Eingabehilfe „Scheiben je Seite“ (Wert × 2 + Eigengewicht). */
  perSideInput?: boolean;
  /** Optionales Eigengewicht von Hebelarm/Schlitten in kg. */
  ownWeightKg?: number;
  adjustments: Adjustment[];
  photoId?: string;
  builtinPhoto?: string;
  /** Zusatzbilder (Skalen, Übungstafel, Gewichtsblock) */
  builtinPhotos?: BuiltinPhoto[];
  location?: string;
  settingsNote?: string;
  /** Gehört zu "meinem Studio" (mitgelieferte Studio-Geräte und selbst angelegte). */
  inStudio: boolean;
  /** Kurzer Hinweis, z. B. "noch zu bestätigen". */
  hint?: string;
  hidden: boolean;
  builtin: boolean;
  /** Felder eines Katalogeintrags, die der Nutzer selbst geändert hat und die Updates nicht überschreiben dürfen. */
  edited?: string[];
}

export interface Instructions {
  setup: string;
  steps: string[];
  breathing: string;
  mistakes: string[];
  tip: string;
}

export type Tracking = 'gewicht_wdh' | 'koerpergewicht_wdh' | 'zeit' | 'cardio';

export interface Exercise extends Record_ {
  name: string;
  equipmentId?: string;
  primaryMuscles: MuscleId[];
  secondaryMuscles: MuscleId[];
  tracking: Tracking;
  instructions: Instructions;
  defaultRestSec: number;
  /** Nur wirksam, wenn das Gerät keine Gewichtsstufen hat. */
  weightStep: number;
  /** Einseitige Übung (z. B. einarmig): Wiederholungen zählen je Seite. */
  unilateral?: boolean;
  adjustmentOverrides?: Record<string, number>;
  notes?: string;
  motionPhotoIds?: string[];
  /** Bewegungsmuster der mitgelieferten Skizze (sonst nach Name zugeordnet); für eigene Übungen frei wählbar. */
  motionId?: string;
  hidden: boolean;
  builtin: boolean;
  edited?: string[];
}

export type PlanStatus = 'entwurf' | 'aktiv' | 'archiv';
export type PlanOrigin = 'manuell' | 'assistent' | 'ki_import';

export interface PlanItem {
  id: string;
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  targetWeight?: number;
  supersetGroup?: number;
  note?: string;
}

export interface Workout {
  id: string;
  name: string;
  items: PlanItem[];
}

export interface Plan extends Record_ {
  name: string;
  goal: string;
  plannedWeeks: number;
  startedAt?: number;
  endedAt?: number;
  status: PlanStatus;
  origin: PlanOrigin;
  /** Nur bei Entlastungsplänen: der Plan, zu dem nach der Entlastungswoche zurückgekehrt wird. */
  returnToPlanId?: string;
  workouts: Workout[];
}

export type SetKind = 'aufwaermen' | 'normal' | 'reduktion';

export interface SetEntry {
  kind: SetKind;
  weight?: number;
  reps?: number;
  durationSec?: number;
  distanceKm?: number;
  level?: number;
  /** Zeitpunkt des Abhakens; ohne Wert ist der Satz nur vorgesehen, aber noch nicht gemacht. */
  doneAt?: number;
}

export interface Entry {
  exerciseId: string;
  substitutedFor?: string;
  note?: string;
  skipped?: boolean;
  /** Gewichtseinheit der Sätze, falls nicht kg (Plattennummern). */
  unit?: 'platte';
  sets: SetEntry[];
  // Vorgaben aus dem Plan, damit ein laufendes Training unabhängig von späteren Planänderungen bleibt.
  restSec: number;
  repMin: number;
  repMax: number;
  targetWeight?: number;
  supersetGroup?: number;
}

export interface Session extends Record_ {
  planId?: string;
  workoutId?: string;
  workoutName: string;
  startedAt: number;
  endedAt?: number;
  note?: string;
  entries: Entry[];
  /** Ende der laufenden Pause (Zeitstempel) – damit der Timer einen App-Neustart überlebt. */
  restEndsAt?: number;
  restTotalSec?: number;
  /** Index der gerade angezeigten Übung. */
  currentIndex?: number;
  /** Einheit aus einer Entlastungswoche: zählt nicht für Vorschläge, Vorbelegung und Stagnation. */
  deload?: boolean;
  /** „Leichter wieder starten“: Gewichte etwa 70 %, ein Satz weniger. */
  easier?: boolean;
}

export interface BodyMetric extends Record_ {
  date: string; // JJJJ-MM-TT
  weightKg?: number;
  chest?: number;
  arm?: number;
  waist?: number;
  hip?: number;
  thigh?: number;
}

export interface Photo extends Record_ {
  blob: Blob;
}

export type Goal = 'muskelaufbau' | 'kraft' | 'fitness';
export type Experience = 'einsteiger' | 'fortgeschritten' | 'erfahren';

export type Appearance = 'dunkel' | 'hell' | 'system';

export interface Settings {
  id: 'settings';
  createdAt: number;
  updatedAt: number;
  profile: { goal: Goal; experience: Experience; daysPerWeek: number };
  defaultRestSec: number;
  defaultWeightStep: number;
  planWeeksDefault: number;
  restSignal: boolean;
  vibration: boolean;
  appearance: Appearance;
  backupReminder: boolean;
  dismissedHints: string[];
  lastBackupAt?: number;
  /** „Dein Studio“ wurde eingerichtet: der Katalog zeigt standardmäßig nur vorhandene Geräte. */
  studioSetupDone?: boolean;
  /** Version des eingebauten Katalogs, der zuletzt eingespielt wurde. */
  catalogVersion?: number;
  /** Das Studio, in dem trainiert wird (nur Text, erscheint auf „Heute“ und im KI-Kontext). */
  studio?: { name: string; city: string };
}

export const GOAL_LABEL: Record<Goal, string> = {
  muskelaufbau: 'Muskelaufbau',
  kraft: 'Kraft',
  fitness: 'Allgemeine Fitness',
};
export const EXPERIENCE_LABEL: Record<Experience, string> = {
  einsteiger: 'Einsteiger',
  fortgeschritten: 'Fortgeschritten',
  erfahren: 'Erfahren',
};
export const KIND_LABEL: Record<EquipmentKind, string> = {
  maschine: 'Maschine',
  kabelzug: 'Kabelzug',
  freihantel: 'Freihantel',
  koerpergewicht: 'Körpergewicht',
  cardio: 'Cardio',
};
export const LOADING_LABEL: Record<Loading, string> = {
  gewichtsblock: 'Gewichtsblock',
  scheiben: 'Hantelscheiben',
  frei: 'Freie Gewichte',
  keins: 'Ohne Zusatzgewicht',
};
export const TRACKING_LABEL: Record<Tracking, string> = {
  gewicht_wdh: 'Gewicht × Wiederholungen',
  koerpergewicht_wdh: 'Körpergewicht (Wdh., optional Zusatz)',
  zeit: 'Dauer',
  cardio: 'Cardio (Dauer, Distanz, Stufe)',
};
export const SETKIND_LABEL: Record<SetKind, string> = {
  aufwaermen: 'Aufwärmen',
  normal: 'Normal',
  reduktion: 'Reduktion',
};
