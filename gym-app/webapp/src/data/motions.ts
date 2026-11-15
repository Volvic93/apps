import type { Exercise } from './types';
import type { Gear, Pattern, Pose, Vec } from '../ui/sketch-engine';

/**
 * Bewegungsmuster für die Skizzen. Alle Koordinaten sind relativ zur Hüfte der Startpose (Ursprung);
 * Hand- und Fußziele sind Polarwerte [Winkel in Grad, Anteil der Glied-Gesamtlänge].
 * Bildschirmwinkel: 0 = rechts, 90 = unten, −90 = oben. Die Figur blickt nach rechts.
 */
const FLOOR = (y: number): Gear => ({ k: 'line', a: [-90, y], b: [90, y], w: 1.5 });
const pad = (a: Vec, b: Vec): Gear => ({ k: 'line', a, b, w: 7, pad: true });
const bench = (x: number, y: number, w: number): Gear => ({ k: 'rect', x, y, w, h: 7, r: 2 });
const handle: Gear = { k: 'follow', to: 'hand', shape: 'handle', r: 3 };
const bar: Gear = { k: 'follow', to: 'hand', shape: 'bar', r: 9 };
const db: Gear = { k: 'follow', to: 'hand', shape: 'db', r: 5 };

const P = (torso: number, hand: Vec, foot: Vec, extra: Partial<Pose> = {}): Pose => ({ torso, hand, foot, ...extra });

const patterns: Pattern[] = [];
/** Fuß/Hand auf festem Punkt (relativ zum Ursprung). */
const at = (x: number, y: number): Vec => [x, y];
const def = (p: Pattern) => patterns.push(p);

// ------------------------------------------------------------------ Brust
def({
  id: 'brustpresse',
  name: 'Brustpresse sitzend',
  view: 'side',
  cues: ['Rücken am Polster', 'Griffe auf Brusthöhe', 'Nach vorn drücken, nicht überstrecken'],
  start: P(-98, [-5, 0.36], [53, 0.7], { elbow: 1 }),
  end: P(-98, [-3, 1], [53, 0.7], { elbow: 1 }),
  gear: [{ k: 'rect', x: -18, y: 6, w: 36, h: 6, r: 2 }, pad([-5, -52], [-12, 4]), FLOOR(36), handle],
  arrow: { a: [16, -62], b: [52, -62] },
});
def({
  id: 'bankdruecken',
  name: 'Bankdrücken',
  view: 'side',
  cues: ['Schulterblätter zusammen', 'Stange zur Brust', 'Gerade nach oben drücken'],
  start: P(0, [-92, 0.3], [112, 0.93], { elbow: -1, knee: 1 }),
  end: P(0, [-90, 1], [112, 0.93], { elbow: -1, knee: 1 }),
  gear: [bench(-36, 9, 104), FLOOR(54), bar],
  arrow: { a: [44, -14], b: [44, -50] },
  origin: [70, 92],
});
def({
  id: 'schraegbankdruecken',
  name: 'Schrägbankdrücken',
  view: 'side',
  cues: ['Bank etwa 30°', 'Stange zur oberen Brust', 'Nach oben drücken'],
  start: P(-124, [-50, 0.45], [58, 0.74], { elbow: -1 }),
  end: P(-124, [-50, 1], [58, 0.74], { elbow: -1 }),
  gear: [{ k: 'rect', x: -16, y: 6, w: 34, h: 6, r: 2 }, pad([-26, -48], [-6, 10]), FLOOR(38), bar],
  arrow: { a: [-8, -76], b: [16, -86] },
  origin: [112, 100],
});
def({
  id: 'liegestuetze',
  name: 'Liegestütze',
  view: 'side',
  cues: ['Körper bleibt gerade', 'Brust zum Boden', 'Hochdrücken'],
  start: P(-20, [90, 1], [150, 1], { elbow: 1, knee: 1 }),
  end: { ...P(-8, [90, 0.52], [165, 0.98], { elbow: 1, knee: 1 }), hip: [0, 14] },
  gear: [{ k: 'line', a: [-80, 30], b: [80, 30], w: 1.5 }],
  origin: [64, 62],
});
def({
  id: 'butterfly',
  name: 'Butterfly',
  view: 'front',
  cues: ['Ellbogen leicht gebeugt', 'Arme vor der Brust zusammenführen', 'Langsam zurück'],
  start: P(-90, [-8, 1], [70, 0.75], { elbow: 1, knee: -1, footAt: at(22, 44) }),
  end: P(-90, [172, 0.3], [70, 0.75], { elbow: -1, knee: -1, footAt: at(22, 44) }),
  gear: [{ k: 'rect', x: -20, y: 6, w: 40, h: 6, r: 2 }, pad([0, -52], [0, 4]), FLOOR(44), handle],
  arrow: { a: [58, -34], b: [24, -34] },
});
def({
  id: 'fliegende',
  name: 'Fliegende / Reverse Fly',
  view: 'front',
  cues: ['Arme leicht gebeugt', 'Seitlich öffnen', 'Schulterblätter zusammen'],
  start: P(-90, [160, 0.5], [88, 1], { elbow: 1 }),
  end: P(-90, [-8, 1], [88, 1], { elbow: 1 }),
  gear: [FLOOR(61), db],
  arrow: { a: [24, -34], b: [58, -34] },
});
def({
  id: 'crossover',
  name: 'Kabel-Cross-Over',
  view: 'front',
  cues: ['Leicht vorgebeugt', 'Hände vor der Körpermitte zusammen', 'Ellbogen leicht gebeugt'],
  start: P(-90, [-30, 1], [88, 1], { elbow: 1 }),
  end: P(-90, [95, 0.42], [88, 1], { elbow: -1 }),
  gear: [FLOOR(61), { k: 'cable', from: [58, -70], to: 'hand' }, handle],
  arrow: { a: [52, -30], b: [22, 6] },
});

// ------------------------------------------------------------------ Schultern
def({
  id: 'schulterdruecken',
  name: 'Schulterdrücken',
  view: 'side',
  cues: ['Rücken gerade', 'Über den Kopf drücken', 'Nicht ins Hohlkreuz'],
  start: P(-92, [-60, 0.5], [60, 0.7], { elbow: 1 }),
  end: P(-92, [-90, 1], [60, 0.7], { elbow: 1 }),
  gear: [{ k: 'rect', x: -18, y: 6, w: 36, h: 6, r: 2 }, pad([-6, -54], [-8, 4]), FLOOR(40), db],
  arrow: { a: [20, -50], b: [20, -84] },
  origin: [96, 104],
});
def({
  id: 'seitheben',
  name: 'Seitheben',
  view: 'front',
  cues: ['Ellbogen leicht gebeugt', 'Bis auf Schulterhöhe', 'Langsam senken'],
  start: P(-90, [80, 1], [88, 1], { elbow: 1 }),
  end: P(-90, [0, 1], [88, 1], { elbow: 1 }),
  gear: [FLOOR(61), db],
  arrow: { a: [44, -6], b: [44, -34] },
});
def({
  id: 'frontheben',
  name: 'Frontheben',
  view: 'side',
  cues: ['Aufrecht stehen', 'Arme bis Schulterhöhe', 'Nicht schwingen'],
  start: P(-90, [90, 1], [88, 1], { elbow: 1 }),
  end: P(-90, [0, 1], [88, 1], { elbow: 1 }),
  gear: [FLOOR(61), db],
  arrow: { a: [30, 10], b: [30, -30] },
});
def({
  id: 'aufrechtes-rudern',
  name: 'Aufrechtes Rudern',
  view: 'side',
  cues: ['Stange am Körper hochziehen', 'Ellbogen führen', 'Bis Brusthöhe'],
  start: P(-90, [88, 1], [88, 1], { elbow: -1 }),
  end: P(-90, [20, 0.3], [88, 1], { elbow: -1 }),
  gear: [FLOOR(61), bar],
  arrow: { a: [26, 14], b: [26, -24] },
});
def({
  id: 'shrugs',
  name: 'Shrugs',
  view: 'side',
  cues: ['Arme gestreckt', 'Schultern hochziehen', 'Kurz halten'],
  start: P(-90, [90, 1], [88, 1], { elbow: 1 }),
  end: P(-90, [90, 1], [88, 1], { elbow: 1, lift: 8 }),
  gear: [FLOOR(61), db],
  arrow: { a: [24, -14], b: [24, -32] },
});

// ------------------------------------------------------------------ Rücken
def({
  id: 'latzug',
  name: 'Latzug',
  view: 'side',
  cues: ['Leicht zurücklehnen', 'Stange zur oberen Brust', 'Ellbogen nach unten'],
  start: P(-98, [-90, 1], [55, 0.58], { elbow: -1 }),
  end: P(-104, [-5, 0.45], [55, 0.58], { elbow: 1 }),
  gear: [{ k: 'rect', x: -14, y: 6, w: 34, h: 6, r: 2 }, { k: 'line', a: [20, -6], b: [20, 14], w: 7, pad: true }, FLOOR(36), { k: 'cable', from: [30, -120], to: 'hand' }, bar],
  arrow: { a: [30, -64], b: [30, -22] },
  origin: [98, 104],
});
def({
  id: 'klimmzug',
  name: 'Klimmzug',
  view: 'side',
  cues: ['Schulterblätter zuerst', 'Kinn über die Stange', 'Kontrolliert ablassen'],
  start: P(-90, [-90, 1], [118, 0.6], { elbow: -1, handAt: at(6, -84) }),
  end: { ...P(-90, [-90, 0.5], [118, 0.6], { elbow: -1, handAt: at(6, -84) }), hip: [0, -30] },
  gear: [{ k: 'line', a: [-30, -84], b: [44, -84], w: 3 }, handle],
  arrow: { a: [34, -20], b: [34, -60] },
  origin: [92, 100],
});
def({
  id: 'rudern-sitzend',
  name: 'Rudern sitzend',
  view: 'side',
  cues: ['Aufrecht sitzen', 'Griff zum Bauch', 'Schulterblätter zusammen'],
  start: P(-90, [0, 1], [10, 0.95], { elbow: 1, knee: -1 }),
  end: P(-96, [160, 0.5], [10, 0.95], { elbow: -1, knee: -1 }),
  gear: [{ k: 'rect', x: -16, y: 6, w: 32, h: 6, r: 2 }, FLOOR(32), { k: 'line', a: [70, 4], b: [70, 20], w: 6, pad: true }, { k: 'cable', from: [110, 0], to: 'hand' }, handle],
  arrow: { a: [58, -20], b: [20, -20] },
});
def({
  id: 'rudern-brustauflage',
  name: 'Rudern mit Brustauflage',
  view: 'side',
  cues: ['Brust am Polster', 'Ellbogen nach hinten ziehen', 'Kurz halten'],
  start: P(-70, [-5, 1], [60, 0.7], { elbow: 1 }),
  end: P(-70, [150, 0.5], [60, 0.7], { elbow: -1 }),
  gear: [pad([52, -44], [30, 16]), FLOOR(38), handle],
  arrow: { a: [60, -10], b: [20, -10] },
});
def({
  id: 'rudern-vorgebeugt',
  name: 'Rudern vorgebeugt',
  view: 'side',
  cues: ['Rücken gerade, Oberkörper vorgebeugt', 'Stange zum Bauch', 'Ellbogen nah am Körper'],
  start: P(-35, [90, 1], [100, 0.95], { elbow: 1, knee: -1 }),
  end: P(-35, [140, 0.55], [100, 0.95], { elbow: -1, knee: -1 }),
  gear: [FLOOR(60), bar],
  arrow: { a: [36, 20], b: [20, -2] },
});
def({
  id: 'ueberzug',
  name: 'Überzug',
  view: 'side',
  cues: ['Arme fast gestreckt', 'Bogen nach unten zu den Hüften', 'Rumpf fest'],
  start: P(-90, [-60, 1], [88, 1], { elbow: 1 }),
  end: P(-90, [75, 1], [88, 1], { elbow: 1 }),
  gear: [FLOOR(61), { k: 'cable', from: [10, -110], to: 'hand' }, handle],
  arrow: { a: [24, -70], b: [30, 0] },
});
def({
  id: 'face-pull',
  name: 'Face Pull',
  view: 'side',
  cues: ['Seil zum Gesicht', 'Ellbogen hoch', 'Schulterblätter zusammen'],
  start: P(-90, [0, 1], [88, 1], { elbow: 1 }),
  end: P(-90, [170, 0.45], [88, 1], { elbow: -1 }),
  gear: [FLOOR(61), { k: 'cable', from: [100, -40], to: 'hand' }, handle],
  arrow: { a: [56, -40], b: [22, -40] },
});
def({
  id: 'rueckenstrecker',
  name: 'Rückenstrecker',
  view: 'side',
  cues: ['Hüfte am Polster', 'Oberkörper bis in die Gerade heben', 'Nicht überstrecken'],
  start: P(55, [90, 1], [170, 1], { elbow: 1 }),
  end: P(-72, [90, 1], [170, 1], { elbow: 1 }),
  gear: [{ k: 'line', a: [-10, 12], b: [26, 12], w: 8, pad: true }, { k: 'line', a: [-62, 16], b: [-30, 12], w: 6, pad: true }, FLOOR(56)],
  arrow: { a: [40, 14], b: [34, -30] },
  origin: [92, 70],
});
def({
  id: 'kreuzheben',
  name: 'Kreuzheben',
  view: 'side',
  cues: ['Rücken gerade', 'Stange am Körper', 'Aus den Beinen und der Hüfte aufrichten'],
  start: { ...P(-30, [90, 1], [100, 0.78], { elbow: 1, knee: -1 }), hip: [-4, 14] },
  end: P(-90, [90, 1], [90, 1], { elbow: 1, knee: -1 }),
  gear: [FLOOR(61), bar],
  arrow: { a: [30, 0], b: [30, -40] },
});
def({
  id: 'rumaenisches-kreuzheben',
  name: 'Rumänisches Kreuzheben',
  view: 'side',
  cues: ['Beine fast gestreckt', 'Hüfte nach hinten schieben', 'Stange entlang der Beine'],
  start: P(-90, [90, 1], [88, 1], { elbow: 1, knee: -1 }),
  end: { ...P(-30, [90, 1], [96, 1], { elbow: 1, knee: -1 }), hip: [-14, 0] },
  gear: [FLOOR(61), bar],
  arrow: { a: [34, -20], b: [40, 16] },
});

// ------------------------------------------------------------------ Arme
def({
  id: 'bizepscurl',
  name: 'Bizepscurl',
  view: 'side',
  cues: ['Ellbogen am Körper', 'Nach oben beugen', 'Langsam senken'],
  start: P(-90, [90, 1], [88, 1], { elbow: 1 }),
  end: P(-90, [-30, 0.5], [88, 1], { elbow: 1 }),
  gear: [FLOOR(61), db],
  arrow: { a: [34, 14], b: [34, -26] },
});
def({
  id: 'scott-curl',
  name: 'Scott-Curl',
  view: 'side',
  cues: ['Oberarme auf dem Polster', 'Nach oben beugen', 'Unten fast strecken'],
  start: P(-92, [50, 1], [60, 0.7], { elbow: 1 }),
  end: P(-92, [-40, 0.5], [60, 0.7], { elbow: 1 }),
  gear: [{ k: 'rect', x: -16, y: 6, w: 34, h: 6, r: 2 }, { k: 'line', a: [24, -30], b: [36, 6], w: 8, pad: true }, FLOOR(38), handle],
  arrow: { a: [52, 6], b: [50, -34] },
});
def({
  id: 'trizepsdruecken',
  name: 'Trizepsdrücken am Kabel',
  view: 'side',
  cues: ['Ellbogen am Körper', 'Nach unten strecken', 'Oberarme still'],
  start: P(-90, [-5, 0.55], [88, 1], { elbow: 1 }),
  end: P(-90, [78, 1], [88, 1], { elbow: 1 }),
  gear: [FLOOR(61), { k: 'cable', from: [14, -110], to: 'hand' }, handle],
  arrow: { a: [44, -18], b: [44, 18] },
});
def({
  id: 'trizeps-ueberkopf',
  name: 'Trizepsstrecken über Kopf',
  view: 'side',
  cues: ['Oberarme am Kopf', 'Nach oben strecken', 'Ellbogen zeigen nach vorn'],
  start: P(-90, [-10, 0.55], [88, 1], { elbow: 1 }),
  end: P(-90, [-90, 1], [88, 1], { elbow: 1 }),
  gear: [FLOOR(61), db],
  arrow: { a: [6, -40], b: [6, -76] },
});
def({
  id: 'skullcrusher',
  name: 'Stirndrücken',
  view: 'side',
  cues: ['Ellbogen zeigen zur Decke', 'Zur Stirn beugen', 'Wieder strecken'],
  start: P(0, [-90, 1], [112, 0.93], { elbow: -1, knee: 1 }),
  end: P(0, [-150, 0.55], [112, 0.93], { elbow: -1, knee: 1 }),
  gear: [bench(-36, 9, 104), FLOOR(54), bar],
  arrow: { a: [60, -50], b: [50, -24] },
  origin: [70, 92],
});
def({
  id: 'dips',
  name: 'Dips',
  view: 'side',
  cues: ['Körper leicht nach vorn', 'Ellbogen beugen', 'Wieder hochdrücken'],
  start: P(-86, [90, 1], [118, 0.6], { elbow: 1, handAt: at(4, 6) }),
  end: { ...P(-72, [90, 0.55], [118, 0.6], { elbow: 1, handAt: at(4, 6) }), hip: [0, 22] },
  gear: [{ k: 'line', a: [-14, 6], b: [28, 6], w: 3 }, handle],
  arrow: { a: [-34, -30], b: [-34, 4] },
  origin: [96, 62],
});
def({
  id: 'handgelenkcurl',
  name: 'Handgelenkcurl',
  view: 'side',
  cues: ['Unterarme aufgelegt', 'Nur die Handgelenke bewegen', 'Langsam senken'],
  start: P(-90, [60, 0.55], [60, 0.7], { elbow: 1 }),
  end: P(-90, [10, 0.55], [60, 0.7], { elbow: 1 }),
  gear: [bench(-10, 18, 80), FLOOR(40), db],
  arrow: { a: [64, 8], b: [64, -10] },
});

// ------------------------------------------------------------------ Beine
def({
  id: 'beinpresse',
  name: 'Beinpresse',
  view: 'side',
  cues: ['Füße hüftbreit auf der Platte', 'Knie in Fußrichtung', 'Nicht ganz durchstrecken'],
  start: P(-150, [10, 0.6], [-30, 0.5], { elbow: 1, knee: 1 }),
  end: P(-150, [10, 0.6], [-24, 0.97], { elbow: 1, knee: 1 }),
  gear: [{ k: 'line', a: [-58, 22], b: [-6, -26], w: 8, pad: true }, { k: 'plate', to: 'foot', len: 34, ang: -60 }],
  arrow: { a: [20, -30], b: [50, -52] },
  origin: [92, 96],
});
def({
  id: 'hueftpresse',
  name: 'Hüftpresse',
  view: 'side',
  cues: ['Füße hoch auf der Platte', 'Aus der Hüfte drücken', 'Becken bleibt am Polster'],
  start: P(-150, [10, 0.6], [-40, 0.52], { elbow: 1, knee: 1 }),
  end: P(-150, [10, 0.6], [-34, 0.97], { elbow: 1, knee: 1 }),
  gear: [{ k: 'line', a: [-58, 22], b: [-6, -26], w: 8, pad: true }, { k: 'plate', to: 'foot', len: 34, ang: -60 }],
  arrow: { a: [20, -40], b: [50, -62] },
  origin: [92, 96],
});
def({
  id: 'hackenschmidt',
  name: 'Hackenschmidt / Pendel-Kniebeuge',
  view: 'side',
  cues: ['Rücken am Polster', 'Tief beugen', 'Aus den Beinen aufstehen'],
  start: P(-108, [80, 0.9], [78, 0.93], { elbow: 1, knee: -1 }),
  end: { ...P(-108, [80, 0.9], [62, 0.6], { elbow: 1, knee: -1 }), hip: [0, 18] },
  gear: [{ k: 'line', a: [-22, -48], b: [-10, 40], w: 7, pad: true }, FLOOR(61), { k: 'plate', to: 'foot', len: 26, ang: 0 }],
  arrow: { a: [44, 36], b: [44, -4] },
});
def({
  id: 'belt-squat',
  name: 'Belt Squat',
  view: 'side',
  cues: ['Gewicht hängt an der Hüfte', 'Aufrecht beugen', 'Aus den Beinen aufstehen'],
  start: P(-90, [90, 0.4], [88, 1], { elbow: 1, knee: -1, footAt: at(6, 61) }),
  end: { ...P(-88, [90, 0.4], [70, 0.7], { elbow: 1, knee: -1, footAt: at(6, 61) }), hip: [-4, 26] },
  gear: [FLOOR(61), { k: 'line', a: [0, 4], b: [0, 52], w: 2 }],
  arrow: { a: [40, 24], b: [40, -4] },
});
def({
  id: 'kniebeuge',
  name: 'Kniebeuge',
  view: 'side',
  cues: ['Brust hoch, Rücken gerade', 'Knie über den Füßen', 'Mindestens bis parallel'],
  start: P(-90, [-30, 0.5], [88, 1], { elbow: -1, knee: -1, footAt: at(2, 61) }),
  end: { ...P(-62, [-30, 0.5], [75, 0.82], { elbow: -1, knee: -1, footAt: at(2, 61) }), hip: [-16, 26] },
  gear: [FLOOR(61), bar],
  arrow: { a: [44, 24], b: [44, -6] },
});
def({
  id: 'sissy-squat',
  name: 'Sissy Squat',
  view: 'side',
  cues: ['Knie schieben nach vorn', 'Oberkörper nach hinten', 'Mit Halt am Ständer'],
  start: P(-90, [-10, 0.8], [88, 1], { elbow: 1, knee: -1, footAt: at(2, 61), handAt: at(44, -26) }),
  end: { ...P(-108, [-10, 0.8], [96, 0.7], { elbow: 1, knee: -1, footAt: at(10, 61), handAt: at(44, -26) }), hip: [-12, 20] },
  gear: [FLOOR(61), { k: 'line', a: [50, -70], b: [50, 61], w: 4 }],
  arrow: { a: [-30, 18], b: [-30, -4] },
});
def({
  id: 'ausfallschritt',
  name: 'Ausfallschritt',
  view: 'side',
  cues: ['Großer Schritt', 'Hinteres Knie Richtung Boden', 'Vorderes Knie über dem Fuß'],
  start: P(-90, [90, 1], [100, 1], { elbow: 1, footAt: at(4, 61), foot2At: at(-4, 61) }),
  end: { ...P(-90, [90, 1], [60, 0.88], { elbow: 1, footAt: at(30, 61), foot2At: at(-28, 61) }), hip: [10, 26] },
  gear: [FLOOR(61), db],
  arrow: { a: [44, 20], b: [44, -4] },
});
def({
  id: 'beinstrecker',
  name: 'Beinstrecker',
  view: 'side',
  cues: ['Rücken am Polster', 'Beine nach vorn strecken', 'Oben kurz halten'],
  start: P(-98, [60, 0.5], [78, 0.82], { elbow: 1, knee: -1 }),
  end: P(-98, [60, 0.5], [2, 1], { elbow: 1, knee: -1 }),
  gear: [{ k: 'rect', x: -18, y: 6, w: 36, h: 6, r: 2 }, pad([-6, -52], [-12, 4]), FLOOR(44), { k: 'lever', from: [30, 28], to: 'foot', w: 5 }],
  arrow: { a: [40, 36], b: [60, 6] },
});
def({
  id: 'beinbeuger-sitzend',
  name: 'Beinbeuger sitzend',
  view: 'side',
  cues: ['Waden auf dem Polster', 'Fersen zum Gesäß ziehen', 'Langsam zurück'],
  start: P(-98, [60, 0.5], [2, 1], { elbow: 1, knee: -1 }),
  end: P(-98, [60, 0.5], [70, 0.74], { elbow: 1, knee: -1 }),
  gear: [{ k: 'rect', x: -18, y: 6, w: 36, h: 6, r: 2 }, pad([-6, -52], [-12, 4]), FLOOR(44), { k: 'lever', from: [26, 22], to: 'foot', w: 5 }],
  arrow: { a: [62, 6], b: [44, 36] },
});
def({
  id: 'beinbeuger-liegend',
  name: 'Beinbeuger liegend',
  view: 'side',
  cues: ['Hüfte am Polster', 'Fersen zum Gesäß', 'Langsam senken'],
  start: P(-180, [90, 0.6], [180, 1], { elbow: 1, knee: 1 }),
  end: P(-180, [90, 0.6], [-120, 0.8], { elbow: 1, knee: 1 }),
  gear: [bench(-80, 7, 110), FLOOR(48)],
  arrow: { a: [-66, 0], b: [-30, -40] },
  origin: [110, 80],
});
def({
  id: 'beinbeuger-stehend',
  name: 'Beinbeuger stehend',
  view: 'side',
  cues: ['Aufrecht am Gerät abstützen', 'Ferse zum Gesäß', 'Hüfte ruhig'],
  start: P(-85, [20, 0.7], [90, 1], { elbow: 1, knee: 1 }),
  end: P(-85, [20, 0.7], [160, 0.55], { elbow: 1, knee: 1 }),
  gear: [FLOOR(61), { k: 'line', a: [40, -40], b: [40, 30], w: 6, pad: true }],
  arrow: { a: [-20, 40], b: [-20, 10] },
});
def({
  id: 'hip-thrust',
  name: 'Hip Thrust',
  view: 'side',
  cues: ['Schulterblätter auf der Bank', 'Hüfte nach oben drücken', 'Gesäß oben anspannen'],
  start: { ...P(-160, [-90, 0.3], [20, 0.9], { elbow: 1, knee: -1 }), hip: [0, 18] },
  end: P(-168, [-90, 0.3], [30, 0.82], { elbow: 1, knee: -1 }),
  gear: [bench(-52, 6, 30), FLOOR(48)],
  arrow: { a: [0, -20], b: [0, -44] },
  origin: [108, 82],
});
def({
  id: 'kickback',
  name: 'Gesäß-Kickback',
  view: 'side',
  cues: ['Leicht vorgebeugt, abstützen', 'Bein nach hinten oben strecken', 'Hüfte bleibt ruhig'],
  start: P(-60, [70, 0.8], [110, 0.7], { elbow: 1, knee: 1 }),
  end: P(-60, [70, 0.8], [150, 1], { elbow: 1, knee: 1 }),
  gear: [FLOOR(61), { k: 'line', a: [50, -30], b: [50, 20], w: 5, pad: true }],
  arrow: { a: [-30, 30], b: [-60, 10] },
});
def({
  id: 'abduktion',
  name: 'Abduktoren (Beine auseinander)',
  view: 'front',
  cues: ['Aufrecht sitzen', 'Beine kontrolliert nach außen', 'Nicht ins Hohlkreuz'],
  start: P(-90, [90, 0.9], [80, 0.6], { elbow: 1, knee: -1, footAt: at(10, 44) }),
  end: P(-90, [90, 0.9], [60, 0.7], { elbow: 1, knee: -1, footAt: at(32, 44) }),
  gear: [{ k: 'rect', x: -20, y: 6, w: 40, h: 6, r: 2 }, pad([0, -52], [0, 4]), FLOOR(44)],
  arrow: { a: [14, 52], b: [38, 52] },
});
def({
  id: 'adduktion',
  name: 'Adduktoren (Beine zusammen)',
  view: 'front',
  cues: ['Aufrecht sitzen', 'Beine kontrolliert zusammenführen', 'Langsam öffnen'],
  start: P(-90, [90, 0.9], [60, 0.7], { elbow: 1, knee: -1, footAt: at(32, 44) }),
  end: P(-90, [90, 0.9], [80, 0.6], { elbow: 1, knee: -1, footAt: at(10, 44) }),
  gear: [{ k: 'rect', x: -20, y: 6, w: 40, h: 6, r: 2 }, pad([0, -52], [0, 4]), FLOOR(44)],
  arrow: { a: [38, 52], b: [14, 52] },
});
def({
  id: 'waden-stehend',
  name: 'Wadenheben stehend',
  view: 'side',
  cues: ['Fersen tief absenken', 'Auf die Zehenspitzen drücken', 'Oben kurz halten'],
  start: { ...P(-90, [90, 0.7], [90, 1], { elbow: 1 }), hip: [0, 6] },
  end: { ...P(-90, [90, 0.7], [78, 1], { elbow: 1 }), hip: [0, -4] },
  gear: [{ k: 'rect', x: -10, y: 62, w: 34, h: 6, r: 2 }, FLOOR(68)],
  arrow: { a: [36, 20], b: [36, -10] },
  origin: [92, 70],
});
def({
  id: 'waden-vorgebeugt',
  name: 'Wadenheben vorgebeugt',
  view: 'side',
  cues: ['Hüfte am Polster, Beine gestreckt', 'Fersen tief absenken', 'Hoch auf die Zehen'],
  start: { ...P(-10, [90, 0.6], [90, 1], { elbow: 1 }), hip: [0, 6] },
  end: { ...P(-10, [90, 0.6], [80, 1], { elbow: 1 }), hip: [0, -4] },
  gear: [{ k: 'rect', x: -10, y: 62, w: 34, h: 6, r: 2 }, FLOOR(68), { k: 'line', a: [-14, -14], b: [14, -14], w: 8, pad: true }],
  arrow: { a: [-30, 30], b: [-30, 6] },
  origin: [76, 70],
});
def({
  id: 'waden-sitzend',
  name: 'Wadenheben sitzend',
  view: 'side',
  cues: ['Gewicht auf den Knien', 'Fersen heben', 'Langsam absenken'],
  start: { ...P(-90, [60, 0.5], [30, 0.6], { elbow: 1, knee: -1 }), hip: [0, 0] },
  end: { ...P(-90, [60, 0.5], [20, 0.62], { elbow: 1, knee: -1 }), hip: [0, -4] },
  gear: [{ k: 'rect', x: -16, y: 6, w: 32, h: 6, r: 2 }, FLOOR(40)],
  arrow: { a: [44, 36], b: [44, 22] },
});

// ------------------------------------------------------------------ Rumpf
def({
  id: 'bauchmaschine',
  name: 'Bauchmaschine / Crunch',
  view: 'side',
  cues: ['Oberkörper einrollen', 'Bauch fest anspannen', 'Langsam zurück'],
  start: P(-100, [20, 0.6], [60, 0.7], { elbow: 1, knee: -1 }),
  end: P(-60, [30, 0.55], [60, 0.7], { elbow: 1, knee: -1 }),
  gear: [{ k: 'rect', x: -18, y: 6, w: 34, h: 6, r: 2 }, FLOOR(40)],
  arrow: { a: [-24, -50], b: [4, -48] },
});
def({
  id: 'crunch-boden',
  name: 'Crunch am Boden',
  view: 'side',
  cues: ['Füße aufgestellt', 'Oberkörper einrollen', 'Nicht am Nacken ziehen'],
  start: P(-8, [-60, 0.5], [-130, 0.85], { elbow: 1, knee: 1 }),
  end: P(-50, [-60, 0.5], [-130, 0.85], { elbow: 1, knee: 1 }),
  gear: [{ k: 'line', a: [-70, 10], b: [80, 10], w: 1.5 }],
  arrow: { a: [20, -12], b: [30, -40] },
  origin: [70, 72],
});
def({
  id: 'beinheben',
  name: 'Beinheben hängend',
  view: 'side',
  cues: ['Aufrecht hängen', 'Beine bis waagerecht heben', 'Nicht schwingen'],
  start: P(-90, [-90, 1], [100, 0.7], { elbow: -1, knee: -1, handAt: at(4, -84) }),
  end: P(-90, [-90, 1], [8, 0.95], { elbow: -1, knee: -1, handAt: at(4, -84) }),
  gear: [{ k: 'line', a: [-30, -84], b: [40, -84], w: 3 }, handle],
  arrow: { a: [34, 36], b: [50, 4] },
  origin: [92, 92],
});
def({
  id: 'plank',
  name: 'Unterarmstütz',
  view: 'side',
  cues: ['Körper bildet eine Linie', 'Bauch und Gesäß anspannen', 'Ruhig atmen'],
  start: P(-14, [90, 0.5], [166, 1], { elbow: 1, knee: 1 }),
  end: P(-14, [90, 0.5], [166, 1], { elbow: 1, knee: 1 }),
  gear: [{ k: 'line', a: [-70, 15], b: [90, 15], w: 1.5 }],
  origin: [70, 62],
});
def({
  id: 'russian-twist',
  name: 'Russian Twist',
  view: 'front',
  cues: ['Zurücklehnen, Füße anheben', 'Oberkörper seitlich drehen', 'Hände führen'],
  start: P(-90, [160, 0.5], [60, 0.7], { elbow: 1, knee: -1, footAt: at(18, 40) }),
  end: P(-90, [20, 0.5], [60, 0.7], { elbow: 1, knee: -1, footAt: at(18, 40) }),
  gear: [FLOOR(46)],
  arrow: { a: [30, -20], b: [-30, -20] },
});

// ------------------------------------------------------------------ Ausdauer
def({
  id: 'laufband',
  name: 'Laufband',
  view: 'side',
  cues: ['Aufrecht laufen', 'Locker abrollen', 'Arme schwingen mit'],
  start: P(-86, [40, 0.8], [112, 1], { elbow: 1, knee: -1, footAt: at(26, 58), foot2At: at(-28, 61) }),
  end: P(-86, [150, 0.8], [68, 1], { elbow: 1, knee: -1, footAt: at(-28, 61), foot2At: at(26, 58) }),
  gear: [{ k: 'line', a: [-60, 63], b: [60, 63], w: 3 }],
  arrow: { a: [50, 40], b: [-10, 40] },
});
def({
  id: 'ergometer',
  name: 'Ergometer',
  view: 'side',
  cues: ['Sattel auf Hüfthöhe', 'Rund treten', 'Rücken gerade'],
  start: P(-62, [-10, 0.95], [60, 0.95], { elbow: 1, knee: -1, handAt: at(44, -16), footAt: at(16, 46), foot2At: at(-12, 46) }),
  end: P(-62, [-10, 0.95], [100, 0.7], { elbow: 1, knee: -1, handAt: at(44, -16), footAt: at(2, 60), foot2At: at(2, 32) }),
  gear: [{ k: 'rect', x: -22, y: 6, w: 24, h: 4, r: 2 }, FLOOR(70), { k: 'line', a: [44, -16], b: [48, 20], w: 4 }, { k: 'circle', c: [2, 46], r: 14 }],
  arrow: { a: [-20, 70], b: [20, 70] },
});
def({
  id: 'crosstrainer',
  name: 'Crosstrainer',
  view: 'side',
  cues: ['Aufrecht, Blick nach vorn', 'Gleichmäßig ellipsenförmig', 'Arme mitführen'],
  start: P(-90, [50, 0.9], [100, 1], { elbow: 1, knee: -1, footAt: at(24, 58), foot2At: at(-24, 58) }),
  end: P(-90, [130, 0.9], [80, 1], { elbow: 1, knee: -1, footAt: at(-24, 58), foot2At: at(24, 58) }),
  gear: [{ k: 'line', a: [-50, 62], b: [50, 62], w: 3 }, { k: 'line', a: [44, -50], b: [44, 30], w: 4 }],
  arrow: { a: [20, 72], b: [-20, 72] },
});
def({
  id: 'rudergeraet',
  name: 'Rudergerät',
  view: 'side',
  cues: ['Erst Beine, dann Rücken, dann Arme', 'Griff zum Bauch', 'Zurück in umgekehrter Reihenfolge'],
  start: P(-60, [0, 1], [-30, 0.5], { elbow: 1, knee: 1 }),
  end: P(-110, [160, 0.5], [10, 0.97], { elbow: -1, knee: 1 }),
  gear: [{ k: 'line', a: [-50, 8], b: [90, 8], w: 3 }, { k: 'cable', from: [100, 10], to: 'hand' }, handle],
  arrow: { a: [60, -30], b: [10, -30] },
});
def({
  id: 'stepper',
  name: 'Stepper',
  view: 'side',
  cues: ['Aufrecht, nicht aufstützen', 'Kontrolliert steigen', 'Gleichmäßiger Rhythmus'],
  start: P(-90, [50, 0.8], [100, 0.95], { elbow: 1, knee: -1, handAt: at(34, -2), footAt: at(8, 61), foot2At: at(8, 44) }),
  end: P(-90, [50, 0.8], [80, 0.88], { elbow: 1, knee: -1, handAt: at(34, -2), footAt: at(8, 44), foot2At: at(8, 61) }),
  gear: [FLOOR(61), { k: 'line', a: [38, -50], b: [38, 20], w: 4 }],
  arrow: { a: [26, 62], b: [26, 44] },
});

export const MOTION_PATTERNS: Pattern[] = patterns;
export const MOTION_BY_ID: Record<string, Pattern> = Object.fromEntries(patterns.map((p) => [p.id, p]));

// ------------------------------------------------------------------ Zuordnung Übung → Muster
/** Reihenfolge zählt: die erste passende Regel gewinnt. Gesucht wird in Kennung und Name (Kleinbuchstaben). */
const RULES: [RegExp, string][] = [
  [/laufband/, 'laufband'],
  [/crosstrainer/, 'crosstrainer'],
  [/ergometer|fahrrad/, 'ergometer'],
  [/rudergeraet|rudergerät/, 'rudergeraet'],
  [/stepper/, 'stepper'],
  [/russian/, 'russian-twist'],
  [/plank|unterarmstütz|seitstuetz|seitstütz/, 'plank'],
  [/beinheben/, 'beinheben'],
  [/crunch-boden|crunch \(boden\)/, 'crunch-boden'],
  [/kabel-crunch|bauchmaschine|crunch|abdominal/, 'bauchmaschine'],
  [/hyperextension|rückenstrecker|rueckenstrecker|unterer-ruecken|unterer rücken/, 'rueckenstrecker'],
  [/rumaenisches|rumänisches/, 'rumaenisches-kreuzheben'],
  [/kreuzheben/, 'kreuzheben'],
  [/handgelenk/, 'handgelenkcurl'],
  [/skullcrusher|stirndrücken/, 'skullcrusher'],
  [/trizeps-ueberkopf|trizepsstrecken|overhead extension/, 'trizeps-ueberkopf'],
  [/trizeps|push down|pushdown/, 'trizepsdruecken'],
  [/dips/, 'dips'],
  [/scott|gymleco-biceps|konzentrationscurl/, 'scott-curl'],
  [/curl/, 'bizepscurl'],
  [/face-pull|face pull/, 'face-pull'],
  [/überzug|ueberzug|pullover|pull over/, 'ueberzug'],
  [/klimmzug|klimmzüge/, 'klimmzug'],
  [/latzug/, 'latzug'],
  [/brustrudern|brustauflage|2way-row|tbar/, 'rudern-brustauflage'],
  [/vorgebeugt.*rudern|rudern.*vorgebeugt|rudern-langhantel|rudern-kurzhantel|rudern-vorgebeugt|bent over row/, 'rudern-vorgebeugt'],
  [/aufrechtes-rudern/, 'aufrechtes-rudern'],
  [/rudern|row/, 'rudern-sitzend'],
  [/shrug/, 'shrugs'],
  [/reverse|vorgebeugtes seitheben|seitheben-vorgebeugt|fliegende/, 'fliegende'],
  [/cross-over|crossover|cross over/, 'crossover'],
  [/butterfly|pec-dec|pec dec/, 'butterfly'],
  [/seitheben|lateral/, 'seitheben'],
  [/frontheben/, 'frontheben'],
  [/schulterdr|schulterpresse|shoulder press/, 'schulterdruecken'],
  [/liegestütz|liegestuetz/, 'liegestuetze'],
  [/schraegbank|schrägbank/, 'schraegbankdruecken'],
  [/bankdr|multipresse|power-smith|power smith/, 'bankdruecken'],
  [/brustpresse|brustdrücken|brustdruecken|chest press/, 'brustpresse'],
  [/sissy/, 'sissy-squat'],
  [/hackenschmidt|purekraft-beinpresse|pendulum-squat|pendel-kniebeuge/, 'hackenschmidt'],
  [/belt-squat|belt squat/, 'belt-squat'],
  [/hip-press|hüftpresse|hueftpresse/, 'hueftpresse'],
  [/beinpresse/, 'beinpresse'],
  [/ausfall|bulgarian/, 'ausfallschritt'],
  [/kniebeuge|squat/, 'kniebeuge'],
  [/beinstrecker|leg-extension|leg extension/, 'beinstrecker'],
  [/beinbeuger-liegend|liegend/, 'beinbeuger-liegend'],
  [/beinbeuger-stehend|beinbeuger stehend/, 'beinbeuger-stehend'],
  [/beinbeuger|leg-curl|leg curl/, 'beinbeuger-sitzend'],
  [/hip-thrust|hip thrust/, 'hip-thrust'],
  [/kick/, 'kickback'],
  [/adduktoren/, 'adduktion'],
  [/abduktoren|gluteral/, 'abduktion'],
  [/donkey|vorgebeugt/, 'waden-vorgebeugt'],
  [/waden-sitzend|wadenheben sitzend/, 'waden-sitzend'],
  [/waden/, 'waden-stehend'],
];

/** Muster einer Übung: ausdrücklich gesetzte `motionId`, sonst nach Kennung und Name. */
export function motionIdFor(ex: Pick<Exercise, 'id' | 'name'> & { motionId?: string }): string | undefined {
  if (ex.motionId && MOTION_BY_ID[ex.motionId]) return ex.motionId;
  const hay = `${ex.id} ${ex.name}`.toLowerCase();
  for (const [re, id] of RULES) if (re.test(hay)) return id;
  return undefined;
}

export function motionFor(ex: Pick<Exercise, 'id' | 'name'> & { motionId?: string }): Pattern | undefined {
  const id = motionIdFor(ex);
  return id ? MOTION_BY_ID[id] : undefined;
}
