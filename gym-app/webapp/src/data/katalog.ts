import type { CatalogEquipment, CatalogExercise } from './seed';
import type { EquipmentKind, Instructions, Loading, MuscleId, PictogramId, Tracking } from './types';

/**
 * Version des eingebauten Katalogs. Bei jeder inhaltlichen Änderung (auch an studio-geraete.ts) erhöhen,
 * damit die App ihn beim nächsten Start in die Datenbank einspielt.
 */
export const CATALOG_VERSION = 6;

// ---------------------------------------------------------------------------------------------
// Allgemeine Geräte (nicht studiospezifisch). Studio-Geräte stehen in studio-geraete.ts.
// ---------------------------------------------------------------------------------------------

function eq(
  id: string,
  name: string,
  kind: EquipmentKind,
  loading: Loading,
  pictogram: PictogramId,
): CatalogEquipment {
  return { id: `eq-${id}`, name, kind, loading, pictogram, adjustments: [], inStudio: false };
}

export const KATALOG_GERAETE: CatalogEquipment[] = [
  eq('brustpresse', 'Brustpresse', 'maschine', 'gewichtsblock', 'brustpresse'),
  eq('butterfly', 'Butterfly / Pec Deck', 'maschine', 'gewichtsblock', 'butterfly'),
  eq('schulterpresse', 'Schulterpresse', 'maschine', 'gewichtsblock', 'schulterpresse'),
  eq('latzug', 'Latzugturm', 'kabelzug', 'gewichtsblock', 'latzug'),
  eq('rudermaschine', 'Rudermaschine sitzend', 'maschine', 'gewichtsblock', 'rudern'),
  eq('kabelzug', 'Kabelzug', 'kabelzug', 'gewichtsblock', 'kabelzug'),
  eq('beinpresse', 'Beinpresse', 'maschine', 'scheiben', 'beinpresse'),
  eq('beinstrecker', 'Beinstrecker', 'maschine', 'gewichtsblock', 'beinstrecker'),
  eq('beinbeuger', 'Beinbeuger', 'maschine', 'gewichtsblock', 'beinbeuger'),
  eq('adduktor', 'Adduktorenmaschine', 'maschine', 'gewichtsblock', 'adduktor'),
  eq('abduktor', 'Abduktorenmaschine', 'maschine', 'gewichtsblock', 'adduktor'),
  eq('wadenmaschine', 'Wadenmaschine', 'maschine', 'gewichtsblock', 'waden'),
  eq('bauchmaschine', 'Bauchmaschine', 'maschine', 'gewichtsblock', 'bauch'),
  eq('rueckenstrecker', 'Rückenstrecker-Maschine', 'maschine', 'gewichtsblock', 'rueckenstrecker'),
  eq('klimmzughilfe', 'Klimmzug-/Dip-Station mit Hilfe', 'maschine', 'gewichtsblock', 'klimmzug'),
  eq('multipresse', 'Multipresse (Smith-Maschine)', 'maschine', 'scheiben', 'multipresse'),
  eq('langhantel', 'Langhantel', 'freihantel', 'frei', 'langhantel'),
  eq('kurzhanteln', 'Kurzhanteln', 'freihantel', 'frei', 'kurzhantel'),
  eq('szstange', 'SZ-Stange', 'freihantel', 'frei', 'langhantel'),
  eq('hantelbank', 'Hantelbank', 'freihantel', 'frei', 'hantelbank'),
  eq('klimmzugstange', 'Klimmzugstange / Dip-Barren', 'koerpergewicht', 'keins', 'klimmzug'),
  eq('hyperextension', 'Hyperextension-Bank (Römischer Stuhl)', 'koerpergewicht', 'keins', 'rueckenstrecker'),
  eq('koerpergewicht', 'Körpergewicht (Matte)', 'koerpergewicht', 'keins', 'koerpergewicht'),
  eq('laufband', 'Laufband', 'cardio', 'keins', 'laufband'),
  eq('crosstrainer', 'Crosstrainer', 'cardio', 'keins', 'rad'),
  eq('ergometer', 'Ergometer (Fahrrad)', 'cardio', 'keins', 'rad'),
  eq('rudergeraet', 'Rudergerät', 'cardio', 'keins', 'rudergeraet'),
  eq('stepper', 'Stepper', 'cardio', 'keins', 'rad'),
];

// ---------------------------------------------------------------------------------------------
// Übungen
// ---------------------------------------------------------------------------------------------

export interface ExOpts {
  t?: Tracking;
  /** Einseitige Übung: Wiederholungen zählen je Seite. */
  unilateral?: boolean;
  rest?: number;
  step?: number;
  setup: string;
  steps: string[];
  breathing: string;
  mistakes: string[];
  tip: string;
}

export function ex(
  id: string,
  name: string,
  equipmentId: string | undefined,
  primary: MuscleId[],
  secondary: MuscleId[],
  o: ExOpts,
): CatalogExercise {
  const instructions: Instructions = {
    setup: o.setup,
    steps: o.steps,
    breathing: o.breathing,
    mistakes: o.mistakes,
    tip: o.tip,
  };
  return {
    id: `ex-${id}`,
    name,
    equipmentId,
    primaryMuscles: primary,
    secondaryMuscles: secondary,
    tracking: o.t ?? 'gewicht_wdh',
    instructions,
    defaultRestSec: o.rest ?? 90,
    weightStep: o.step ?? 2.5,
    ...(o.unilateral ? { unilateral: true } : {}),
  };
}

const PUSH_BREATH = 'Beim Drücken ausatmen, beim kontrollierten Zurückführen einatmen.';
const PULL_BREATH = 'Beim Ziehen ausatmen, beim langsamen Zurückführen einatmen.';
const NO_PRESS = 'Nicht den Atem anhalten und pressen – gleichmäßig weiteratmen.';

export const KATALOG_UEBUNGEN: CatalogExercise[] = [
  // ---------------------------------------------------------------- Brust
  ex('brustpresse-maschine', 'Brustpresse (Maschine)', 'eq-brustpresse', ['brust'], ['trizeps', 'schulter_vorn'], {
    rest: 90,
    step: 5,
    setup:
      'Sitzhöhe so einstellen, dass die Griffe auf Brusthöhe (etwa Höhe der Brustwarzen) liegen. Rücken fest an die Lehne, Füße flach auf dem Boden.',
    steps: [
      'Griffe fassen, Schulterblätter zusammenziehen und leicht nach unten halten.',
      'Die Arme nach vorn strecken, ohne die Ellbogen ganz durchzudrücken.',
      'Kurz oben halten, dann langsam (etwa 2–3 Sekunden) zurückführen, bis die Hände auf Brusthöhe sind.',
    ],
    breathing: PUSH_BREATH,
    mistakes: [
      'Schultern nach vorn ziehen, statt sie hinten zu fixieren.',
      'Ellbogen am Ende durchdrücken oder Gewicht zurückfallen lassen.',
      'Gesäß von der Sitzfläche heben.',
    ],
    tip: 'Die Griffe nur so weit zurückführen, wie die Schultern bequem mitgehen – die Brust bleibt unter Spannung.',
  }),
  ex('butterfly-maschine', 'Butterfly (Maschine)', 'eq-butterfly', ['brust'], ['schulter_vorn'], {
    rest: 75,
    step: 5,
    setup:
      'Sitz so einstellen, dass die Ellbogen bzw. Unterarme auf Brusthöhe liegen. Rücken an die Lehne, Schulterblätter zurück.',
    steps: [
      'Arme (Unterarmpolster bzw. Griffe) leicht gebeugt fassen.',
      'Die Arme in einem großen Bogen vor der Brust zusammenführen.',
      'Am Ende die Brust kurz anspannen, dann langsam bis knapp auf Schulterhöhe öffnen.',
    ],
    breathing: 'Beim Zusammenführen ausatmen, beim Öffnen einatmen.',
    mistakes: [
      'Zu weit nach hinten öffnen (belastet die Schultervorderseite).',
      'Mit Schwung arbeiten statt kontrolliert.',
      'Schultern nach oben ziehen.',
    ],
    tip: 'Stell dir vor, einen großen Baum zu umarmen – die Bewegung kommt aus der Brust, nicht aus den Händen.',
  }),
  ex('bankdruecken-langhantel', 'Bankdrücken (Langhantel)', 'eq-langhantel', ['brust'], ['trizeps', 'schulter_vorn'], {
    rest: 150,
    step: 2.5,
    setup:
      'Flach auf die Bank legen, Augen unter der Stange. Schulterblätter zusammenziehen und nach unten, leichtes Hohlkreuz, Füße fest am Boden. Griff etwa schulterbreit plus eine Handbreit. Nur mit Sicherheitsbügeln oder Partner arbeiten.',
    steps: [
      'Stange aus der Ablage heben und über der Brust stabilisieren.',
      'Kontrolliert zur unteren Brust senken (Unterarme senkrecht).',
      'Kurz berühren, ohne abzuprallen, dann explosiv nach oben drücken.',
    ],
    breathing: 'Beim Senken einatmen, beim Drücken ausatmen.',
    mistakes: [
      'Gesäß von der Bank heben.',
      'Die Stange von der Brust abfedern.',
      'Die Ellbogen rechtwinklig vom Körper abspreizen – besser etwa 45–70° zum Rumpf führen.',
    ],
    tip: 'Die Schulterblätter von Anfang bis Ende fest halten – das schützt die Schulter und bringt mehr Kraft.',
  }),
  ex('bankdruecken-kurzhantel', 'Bankdrücken (Kurzhantel)', 'eq-kurzhanteln', ['brust'], ['trizeps', 'schulter_vorn'], {
    rest: 120,
    step: 2,
    setup:
      'Mit den Hanteln auf der Bank sitzen, sie auf die Oberschenkel stellen, rückwärts hinlegen und die Hanteln mit Schwung in die Startposition über der Brust bringen. Schulterblätter zusammen, Füße fest am Boden.',
    steps: [
      'Hanteln mit gestreckten Armen über der Brust halten, Handflächen zeigen nach vorn.',
      'Langsam senken, bis die Ellbogen etwa auf Bankhöhe sind.',
      'Die Hanteln in einem leichten Bogen nach oben drücken, bis sie sich oben fast berühren.',
    ],
    breathing: PUSH_BREATH,
    mistakes: [
      'Hanteln zu tief senken und die Schultern überdehnen.',
      'Ellbogen im 90°-Winkel nach außen drehen.',
      'Hanteln oben zusammenschlagen.',
    ],
    tip: 'Beim Absetzen die Hanteln auf die Knie legen und mit Schwung nach vorn abrollen – nicht aus der Streckung fallen lassen.',
  }),
  ex('schraegbankdruecken-kurzhantel', 'Schrägbankdrücken (Kurzhantel)', 'eq-kurzhanteln', ['brust', 'schulter_vorn'], ['trizeps'], {
    rest: 120,
    step: 2,
    setup: 'Bank auf etwa 30° einstellen (nicht steiler, sonst übernehmen die Schultern). Hanteln wie beim Bankdrücken in Position bringen.',
    steps: [
      'Hanteln über der oberen Brust halten, Schulterblätter zusammen.',
      'Kontrolliert senken, bis die Ellbogen knapp unter Schulterhöhe sind.',
      'Nach oben drücken, bis die Arme fast gestreckt sind.',
    ],
    breathing: PUSH_BREATH,
    mistakes: ['Bank zu steil stellen.', 'Mit Schwung aus dem Rücken drücken.', 'Hanteln unkontrolliert fallen lassen.'],
    tip: 'Die obere Brust arbeitet am meisten, wenn die Hanteln leicht nach innen zeigen und oben zusammenlaufen.',
  }),
  ex('fliegende-kurzhantel', 'Fliegende (Kurzhantel)', 'eq-kurzhanteln', ['brust'], ['schulter_vorn'], {
    rest: 75,
    step: 2,
    setup: 'Flach auf der Bank liegen, Hanteln mit leicht gebeugten Armen über der Brust halten, Handflächen zeigen zueinander.',
    steps: [
      'Die Arme in einem weiten Bogen seitlich absenken, Ellbogen bleiben leicht gebeugt.',
      'Bis auf Brusthöhe oder knapp darunter öffnen – du spürst die Dehnung in der Brust.',
      'In demselben Bogen wieder zusammenführen, als würdest du jemanden umarmen.',
    ],
    breathing: 'Beim Öffnen einatmen, beim Zusammenführen ausatmen.',
    mistakes: [
      'Zu tief absenken und die Schultern überdehnen.',
      'Den Ellbogenwinkel während der Bewegung ändern (wird zur Presse).',
      'Zu schwere Hanteln wählen.',
    ],
    tip: 'Hier zählt Gefühl, nicht Gewicht: lieber leichter und sauber als schwer und ruckartig.',
  }),
  ex('liegestuetze', 'Liegestütze', 'eq-koerpergewicht', ['brust'], ['trizeps', 'schulter_vorn', 'bauch'], {
    t: 'koerpergewicht_wdh',
    rest: 75,
    step: 2.5,
    setup: 'Hände etwas mehr als schulterbreit aufstützen, Körper bildet eine gerade Linie von Kopf bis Ferse. Bauch und Gesäß anspannen.',
    steps: [
      'Ellbogen beugen (etwa 45° zum Körper) und den Brustkorb zwischen den Händen absenken.',
      'Kurz vor dem Boden stoppen.',
      'Kraftvoll nach oben drücken, bis die Arme gestreckt sind.',
    ],
    breathing: 'Beim Absenken einatmen, beim Hochdrücken ausatmen.',
    mistakes: ['Hüfte hängt durch oder streckt sich nach oben.', 'Kopf nach vorn fallen lassen.', 'Nur halbe Bewegung.'],
    tip: 'Zu schwer? Hände auf eine Bank oder Stange stellen – je höher, desto leichter.',
  }),

  // ---------------------------------------------------------------- Schultern
  ex('schulterpresse-maschine', 'Schulterpresse (Maschine)', 'eq-schulterpresse', ['schulter_vorn', 'schulter_seitlich'], ['trizeps'], {
    rest: 90,
    step: 5,
    setup: 'Sitz so einstellen, dass die Griffe auf Höhe der Schultern bzw. knapp darüber liegen. Rücken fest an die Lehne.',
    steps: [
      'Griffe fassen, Ellbogen etwa auf Schulterhöhe.',
      'Gerade nach oben drücken, bis die Arme fast gestreckt sind.',
      'Langsam zurück bis auf Schulterhöhe.',
    ],
    breathing: PUSH_BREATH,
    mistakes: ['Hohlkreuz machen.', 'Schultern zu den Ohren hochziehen.', 'Arme im obersten Punkt durchdrücken.'],
    tip: 'Bauch leicht anspannen – das hält den Rücken an der Lehne.',
  }),
  ex('schulterdruecken-kurzhantel', 'Schulterdrücken (Kurzhantel)', 'eq-kurzhanteln', ['schulter_vorn', 'schulter_seitlich'], ['trizeps', 'oberer_ruecken'], {
    rest: 105,
    step: 2,
    setup: 'Auf einer Bank mit steiler Lehne (80–90°) sitzen oder stehen. Hanteln auf Schulterhöhe, Handflächen nach vorn, Unterarme senkrecht.',
    steps: [
      'Hanteln gleichmäßig nach oben drücken, bis die Arme fast gestreckt sind.',
      'Oben nicht zusammenschlagen lassen.',
      'Langsam bis auf Ohrhöhe zurückführen.',
    ],
    breathing: PUSH_BREATH,
    mistakes: ['Mit dem Oberkörper nach hinten kippen.', 'Hanteln zu weit nach vorn führen.', 'Zu schnell absenken.'],
    tip: 'Stehend braucht es mehr Rumpfspannung – Gesäß und Bauch fest, Rippen nach unten.',
  }),
  ex('schulterdruecken-langhantel', 'Schulterdrücken (Langhantel, stehend)', 'eq-langhantel', ['schulter_vorn', 'schulter_seitlich'], ['trizeps', 'bauch', 'oberer_ruecken'], {
    rest: 150,
    step: 2.5,
    setup: 'Stange auf Schlüsselbeinhöhe aus dem Ständer nehmen, Griff knapp schulterbreit, Ellbogen leicht vor der Stange. Füße hüftbreit, Gesäß und Bauch fest.',
    steps: [
      'Kopf leicht zurück, Stange senkrecht nach oben drücken.',
      'Oben den Kopf durch die Arme „durchschieben“, Stange über dem Mittelfuß.',
      'Kontrolliert zurück zu den Schlüsselbeinen.',
    ],
    breathing: 'Vor dem Drücken tief einatmen und den Rumpf festmachen, beim Hochdrücken ausatmen.',
    mistakes: ['Starkes Hohlkreuz.', 'Mit den Knien „anschieben“ (wird zum Push Press).', 'Stange um das Gesicht herum führen statt senkrecht.'],
    tip: 'Starte mit leichtem Gewicht – diese Übung belastet Rumpf und Schultern gleichzeitig.',
  }),
  ex('seitheben-kurzhantel', 'Seitheben (Kurzhantel)', 'eq-kurzhanteln', ['schulter_seitlich'], ['schulter_vorn', 'oberer_ruecken'], {
    rest: 60,
    step: 1,
    setup: 'Aufrecht stehen, Hanteln neben den Oberschenkeln, Ellbogen leicht gebeugt, Oberkörper minimal nach vorn.',
    steps: [
      'Arme seitlich bis etwa Schulterhöhe anheben – Ellbogen führen, nicht die Hände.',
      'Oben eine Sekunde halten.',
      'Langsam (etwa 3 Sekunden) wieder absenken.',
    ],
    breathing: 'Beim Anheben ausatmen, beim Absenken einatmen.',
    mistakes: ['Mit Schwung aus dem Rücken arbeiten.', 'Über Schulterhöhe heben (Trapezmuskel übernimmt).', 'Schultern hochziehen.'],
    tip: 'Das Gewicht klein halten. Die Bewegung so führen, als würdest du Wasser aus Krügen ausschütten – kleiner Finger leicht oben.',
  }),
  ex('frontheben-kurzhantel', 'Frontheben (Kurzhantel)', 'eq-kurzhanteln', ['schulter_vorn'], ['brust'], {
    rest: 60,
    step: 1,
    setup: 'Aufrecht stehen, Hanteln vor den Oberschenkeln, Arme fast gestreckt, Rumpf angespannt.',
    steps: [
      'Eine Hantel (oder beide im Wechsel) bis etwa Augenhöhe nach vorn oben heben.',
      'Oben kurz halten.',
      'Langsam wieder absenken, ohne den Körper mitzuschwingen.',
    ],
    breathing: 'Beim Heben ausatmen, beim Absenken einatmen.',
    mistakes: ['Mit dem Oberkörper nach hinten pendeln.', 'Zu schwer wählen.', 'Über Kopfhöhe heben.'],
    tip: 'Die vordere Schulter wird schon bei Brust- und Schulterdrücken stark belastet – hier eher wenig Volumen einplanen.',
  }),
  ex('reverse-butterfly-maschine', 'Reverse Butterfly (Maschine)', 'eq-butterfly', ['schulter_hinten'], ['oberer_ruecken'], {
    rest: 60,
    step: 5,
    setup: 'Auf die Maschine mit der Brust zur Lehne setzen, Griffe auf Schulterhöhe einstellen, Arme leicht gebeugt.',
    steps: [
      'Die Arme in einem Bogen nach hinten außen führen.',
      'Am Ende die Schulterblätter leicht zusammenziehen.',
      'Langsam zurückführen, ohne das Gewicht abzulegen.',
    ],
    breathing: PULL_BREATH,
    mistakes: ['Mit dem Rücken Schwung holen.', 'Ellbogen zu stark beugen.', 'Schultern hochziehen.'],
    tip: 'Die hintere Schulter ist klein – ein leichtes Gewicht mit sauberer Spannung wirkt besser als ein schweres.',
  }),
  ex('aufrechtes-rudern', 'Aufrechtes Rudern (SZ-Stange)', 'eq-szstange', ['schulter_seitlich', 'oberer_ruecken'], ['bizeps'], {
    rest: 75,
    step: 2.5,
    setup: 'Aufrecht stehen, SZ-Stange mit engem Obergriff (etwa schulterbreit) vor den Oberschenkeln halten.',
    steps: [
      'Die Stange dicht am Körper bis etwa Brustbeinhöhe ziehen, Ellbogen führen nach oben außen.',
      'Oben kurz halten – Ellbogen bleiben höher als die Hände.',
      'Langsam absenken.',
    ],
    breathing: PULL_BREATH,
    mistakes: ['Zu hoch ziehen (Schulterengpass).', 'Zu schmaler Griff.', 'Mit dem Rücken Schwung holen.'],
    tip: 'Bei Schulterproblemen weglassen oder nur bis zur Brust ziehen.',
  }),
  ex('shrugs-kurzhantel', 'Shrugs (Kurzhantel)', 'eq-kurzhanteln', ['oberer_ruecken'], ['unterarm'], {
    rest: 75,
    step: 2,
    setup: 'Aufrecht stehen, Hanteln seitlich am Körper, Arme gestreckt.',
    steps: [
      'Die Schultern gerade nach oben zu den Ohren ziehen.',
      'Oben eine Sekunde halten.',
      'Langsam wieder absenken.',
    ],
    breathing: 'Beim Hochziehen ausatmen, beim Absenken einatmen.',
    mistakes: ['Schultern kreisen lassen.', 'Kopf nach vorn strecken.', 'Mit Schwung aus den Knien.'],
    tip: 'Griffkraft ist oft die Grenze – bei schweren Sätzen Zughilfen (Straps) erwägen.',
  }),

  // ---------------------------------------------------------------- Rücken
  ex('latzug-breit', 'Latzug breit (zur Brust)', 'eq-latzug', ['latissimus'], ['bizeps', 'oberer_ruecken', 'schulter_hinten'], {
    rest: 90,
    step: 5,
    setup: 'Oberschenkelpolster so einstellen, dass du fest sitzt. Breiten Obergriff etwas weiter als schulterbreit fassen.',
    steps: [
      'Brust leicht heraus, Oberkörper minimal nach hinten geneigt.',
      'Die Stange zum oberen Brustbereich ziehen, Ellbogen führen nach unten.',
      'Schulterblätter am Ende zusammen- und nach unten ziehen, dann langsam wieder strecken.',
    ],
    breathing: PULL_BREATH,
    mistakes: ['Mit den Armen statt mit dem Rücken ziehen.', 'Hinter den Nacken ziehen.', 'Mit Schwung aus dem Oberkörper.'],
    tip: 'Denk an „Ellbogen in die Hosentaschen“ – so arbeitet der Latissimus statt des Bizeps.',
  }),
  ex('latzug-eng', 'Latzug eng / Untergriff', 'eq-latzug', ['latissimus'], ['bizeps', 'oberer_ruecken'], {
    rest: 90,
    step: 5,
    setup: 'Enge V-Stange oder Untergriff schulterbreit fassen, Oberschenkelpolster fest.',
    steps: [
      'Oberkörper leicht nach hinten lehnen, Brust raus.',
      'Griff zur Brust ziehen, Ellbogen nah am Körper.',
      'Kontrolliert wieder strecken, bis die Schultern leicht gedehnt sind.',
    ],
    breathing: PULL_BREATH,
    mistakes: ['Oberkörper pendelt mit.', 'Schultern oben lassen.', 'Gewicht zu schnell nach oben ziehen lassen.'],
    tip: 'Der Untergriff beteiligt den Bizeps stärker – gut als Abwechslung zum breiten Latzug.',
  }),
  ex('klimmzug', 'Klimmzug', 'eq-klimmzugstange', ['latissimus'], ['bizeps', 'oberer_ruecken', 'unterarm'], {
    t: 'koerpergewicht_wdh',
    rest: 120,
    step: 2.5,
    setup: 'Stange etwas weiter als schulterbreit mit Obergriff (oder Untergriff/Neutralgriff) fassen, frei hängen, Schulterblätter leicht nach unten.',
    steps: [
      'Zuerst die Schulterblätter nach unten ziehen, dann Ellbogen Richtung Hüften führen.',
      'Kinn über die Stange ziehen, ohne den Kopf nach vorn zu strecken.',
      'Kontrolliert ganz hinunter lassen.',
    ],
    breathing: 'Beim Hochziehen ausatmen, beim Ablassen einatmen.',
    mistakes: ['Mit Schwung (Kippen) arbeiten.', 'Nur halbe Bewegung.', 'Schultern bleiben oben an den Ohren.'],
    tip: 'Zusatzgewicht (Gürtel) als positiven Wert eintragen, Hilfe (Gummiband) als negativen Wert, z. B. −20 kg bei 20 kg Hilfe.',
  }),
  ex('klimmzug-hilfe', 'Klimmzug mit Hilfe (Maschine)', 'eq-klimmzughilfe', ['latissimus'], ['bizeps', 'oberer_ruecken'], {
    t: 'koerpergewicht_wdh',
    rest: 105,
    step: 5,
    setup: 'Hilfsgewicht wählen (mehr Gewicht = leichter), Knie auf die Polster, Griffe breit fassen.',
    steps: [
      'Schulterblätter nach unten ziehen.',
      'Ellbogen zu den Hüften ziehen, bis das Kinn über den Griffen ist.',
      'Langsam wieder strecken.',
    ],
    breathing: PULL_BREATH,
    mistakes: ['Mit Schwung arbeiten.', 'Zu viel Hilfe wählen und kaum noch Spannung haben.', 'Oben abbrechen.'],
    tip: 'Die eingestellte Hilfe als negativen Zusatz eintragen (z. B. −20 kg bei 20 kg Hilfe) – Ziel ist, die Hilfe nach und nach zu senken.',
  }),
  ex('rudern-maschine-sitzend', 'Rudern sitzend (Maschine)', 'eq-rudermaschine', ['oberer_ruecken', 'latissimus'], ['bizeps', 'schulter_hinten'], {
    rest: 90,
    step: 5,
    setup: 'Sitzhöhe so einstellen, dass die Griffe auf Brusthöhe liegen, Brust fest am Polster.',
    steps: [
      'Griffe fassen, Schultern nach unten.',
      'Ellbogen nach hinten führen, bis die Schulterblätter zusammen sind.',
      'Kurz halten und langsam zurückführen, die Schulter darf nach vorn „wandern“.',
    ],
    breathing: PULL_BREATH,
    mistakes: ['Oberkörper von der Lehne abheben.', 'Schultern hochziehen.', 'Mit dem Bizeps statt dem Rücken ziehen.'],
    tip: 'Stell dir vor, die Ellbogen sind die Griffe – die Hände sind nur Haken.',
  }),
  ex('kabelrudern-sitzend', 'Kabelrudern sitzend', 'eq-kabelzug', ['oberer_ruecken', 'latissimus'], ['bizeps', 'unterer_ruecken'], {
    rest: 90,
    step: 5,
    setup: 'Fußstützen, leicht gebeugte Knie, aufrecht sitzen, V-Griff an das untere Kabel.',
    steps: [
      'Brust raus, Rücken gerade, den Griff zum Bauchnabel ziehen.',
      'Schulterblätter zusammendrücken.',
      'Arme wieder strecken lassen, ohne den Rücken zu runden.',
    ],
    breathing: PULL_BREATH,
    mistakes: ['Mit dem Oberkörper vor- und zurückschaukeln.', 'Rücken runden.', 'Schultern hochziehen.'],
    tip: 'Den Oberkörper möglichst still lassen – das Gewicht so wählen, dass das gelingt.',
  }),
  ex('rudern-langhantel', 'Langhantelrudern (vorgebeugt)', 'eq-langhantel', ['oberer_ruecken', 'latissimus'], ['bizeps', 'unterer_ruecken', 'schulter_hinten'], {
    rest: 135,
    step: 2.5,
    setup: 'Hüftbreit stehen, Knie leicht gebeugt, Oberkörper etwa 45° nach vorn, Rücken gerade. Stange im Obergriff schulterbreit.',
    steps: [
      'Stange gestreckt vor den Knien hängen lassen.',
      'Zum unteren Bauch ziehen, Ellbogen nah am Körper.',
      'Kontrolliert wieder absenken, ohne den Oberkörper aufzurichten.',
    ],
    breathing: PULL_BREATH,
    mistakes: ['Rücken rund machen.', 'Mit dem Oberkörper hochreißen.', 'Stange zu hoch zur Brust ziehen.'],
    tip: 'Starte leicht – der untere Rücken hält die Position, das limitiert oft zuerst.',
  }),
  ex('rudern-kurzhantel-einarmig', 'Kurzhantelrudern einarmig', 'eq-kurzhanteln', ['latissimus', 'oberer_ruecken'], ['bizeps', 'schulter_hinten'], {
    unilateral: true,
    rest: 75,
    step: 2,
    setup: 'Eine Hand und das gleiche Knie auf die Bank, Rücken waagerecht, die andere Hand hält die Hantel.',
    steps: [
      'Hantel gestreckt hängen lassen.',
      'Ellbogen nach hinten oben ziehen, Hantel zur Hüfte führen.',
      'Oben kurz halten, dann langsam ablassen.',
    ],
    breathing: PULL_BREATH,
    mistakes: ['Oberkörper aufdrehen.', 'Mit dem Arm statt dem Rücken ziehen.', 'Schulter nach vorn hängen lassen.'],
    tip: 'Die Hantel zur Hüfte, nicht zur Brust ziehen – so arbeitet der Latissimus stärker.',
  }),
  ex('rueckenstrecker-maschine', 'Rückenstrecker (Maschine)', 'eq-rueckenstrecker', ['unterer_ruecken'], ['gesaess', 'beinbeuger'], {
    rest: 75,
    step: 5,
    setup: 'Sitz und Polster so einstellen, dass die Drehachse auf Hüfthöhe liegt. Füße fest, Oberschenkel gesichert.',
    steps: [
      'Aufrecht sitzen, Arme vor der Brust.',
      'Oberkörper kontrolliert in Verlängerung der Wirbelsäule nach hinten drücken.',
      'Langsam zurück, ohne den Rücken zu runden.',
    ],
    breathing: 'Beim Strecken ausatmen, beim Zurückführen einatmen.',
    mistakes: ['Zu weit ins Hohlkreuz strecken.', 'Mit Schwung arbeiten.', 'Zu schweres Gewicht.'],
    tip: 'Bis in die gerade Linie strecken, nicht darüber hinaus.',
  }),
  ex('hyperextension', 'Hyperextension (Rückenstrecken)', 'eq-hyperextension', ['unterer_ruecken', 'gesaess'], ['beinbeuger'], {
    t: 'koerpergewicht_wdh',
    rest: 60,
    step: 2.5,
    setup: 'Hüfte knapp über dem Polster, Füße fixiert, Körper gerade, Arme vor der Brust verschränkt.',
    steps: [
      'Oberkörper kontrolliert nach unten neigen (Rücken bleibt gerade).',
      'Aus der Hüfte wieder aufrichten, bis der Körper eine Linie bildet.',
      'Oben Gesäß anspannen, nicht ins Hohlkreuz gehen.',
    ],
    breathing: 'Beim Aufrichten ausatmen, beim Absenken einatmen.',
    mistakes: ['Schwungvoll überstrecken.', 'Rücken runden beim Absenken.', 'Kopf in den Nacken legen.'],
    tip: 'Mehr Gesäßbetonung: Füße leicht nach außen drehen und bewusst aus dem Gesäß aufrichten.',
  }),
  ex('kreuzheben', 'Kreuzheben (Langhantel)', 'eq-langhantel', ['unterer_ruecken', 'gesaess', 'beinbeuger'], ['quadrizeps', 'oberer_ruecken', 'unterarm'], {
    rest: 180,
    step: 2.5,
    setup: 'Füße hüftbreit, Stange über dem Mittelfuß. Mit gestrecktem Rücken in die Hocke, Stange schulterbreit greifen, Brust raus, Schulterblätter über der Stange.',
    steps: [
      'Spannung aufbauen, die Stange „aus dem Boden ziehen“, dabei Beine und Hüfte gleichzeitig strecken.',
      'Die Stange bleibt dicht am Körper, bis du aufrecht stehst.',
      'Kontrolliert in umgekehrter Reihenfolge zurück: erst Hüfte nach hinten, dann Knie.',
    ],
    breathing: 'Vor dem Heben tief einatmen und den Rumpf fest machen, oben ausatmen.',
    mistakes: ['Rücken rund machen.', 'Stange vom Körper weg hängen lassen.', 'Mit den Armen ziehen statt mit den Beinen zu drücken.'],
    tip: 'Mit leichten Gewichten und einem Video von der Seite die Technik prüfen, bevor es schwer wird.',
  }),
  ex('ueberzug-kabel', 'Überzug am Kabel (gerade Arme)', 'eq-kabelzug', ['latissimus'], ['brust', 'trizeps'], {
    rest: 60,
    step: 5,
    setup: 'Stange oder Seilgriff am hohen Kabel, einen Schritt zurücktreten, Oberkörper leicht nach vorn, Arme fast gestreckt.',
    steps: [
      'Arme gestreckt in einem Bogen nach unten zu den Oberschenkeln ziehen.',
      'Am Ende den Latissimus fest anspannen.',
      'Langsam zurück bis über Kopfhöhe.',
    ],
    breathing: 'Beim Ziehen ausatmen, beim Zurückführen einatmen.',
    mistakes: ['Ellbogen beugen (wird zum Trizepsdrücken).', 'Mit dem Oberkörper mitgehen.', 'Zu schwer.'],
    tip: 'Eine gute Isolationsübung für den Latissimus ohne Bizeps-Einsatz.',
  }),

  // ---------------------------------------------------------------- Arme
  ex('curl-langhantel', 'Bizepscurl (Langhantel)', 'eq-langhantel', ['bizeps'], ['unterarm'], {
    rest: 75,
    step: 2.5,
    setup: 'Aufrecht stehen, Stange im Untergriff schulterbreit, Ellbogen neben dem Körper.',
    steps: [
      'Stange mit Beugung der Ellbogen nach oben curlen.',
      'Oben den Bizeps kurz anspannen.',
      'Langsam (etwa 3 Sekunden) wieder ablassen.',
    ],
    breathing: 'Beim Hochcurlen ausatmen, beim Ablassen einatmen.',
    mistakes: ['Mit dem Oberkörper schwingen.', 'Ellbogen nach vorn wandern lassen.', 'Unten die Arme nicht ganz strecken.'],
    tip: 'Fällt es schwer, den Rücken ruhig zu halten: Rücken an eine Wand lehnen.',
  }),
  ex('curl-sz', 'Bizepscurl (SZ-Stange)', 'eq-szstange', ['bizeps'], ['unterarm'], {
    rest: 75,
    step: 2.5,
    setup: 'Aufrecht stehen, SZ-Stange an den inneren oder äußeren Biegungen im Untergriff fassen – das schont die Handgelenke.',
    steps: [
      'Ellbogen am Körper fixieren.',
      'Die Stange nach oben curlen, bis die Unterarme senkrecht sind.',
      'Kontrolliert absenken.',
    ],
    breathing: 'Beim Hochcurlen ausatmen, beim Ablassen einatmen.',
    mistakes: ['Schwung aus dem Rücken.', 'Handgelenke abknicken.', 'Nur halbe Bewegung.'],
    tip: 'Die SZ-Stange ist handgelenkfreundlicher als die gerade Stange – gut für schwere Sätze.',
  }),
  ex('curl-kurzhantel', 'Bizepscurl (Kurzhantel)', 'eq-kurzhanteln', ['bizeps'], ['unterarm'], {
    rest: 60,
    step: 1,
    setup: 'Stehen oder sitzen, Hanteln neben dem Körper, Handflächen nach vorn.',
    steps: [
      'Eine Hantel (oder beide im Wechsel) nach oben curlen, dabei die Handfläche leicht nach oben drehen.',
      'Oben kurz anspannen.',
      'Langsam ablassen.',
    ],
    breathing: 'Beim Hochcurlen ausatmen, beim Ablassen einatmen.',
    mistakes: ['Ellbogen vorziehen.', 'Schaukeln.', 'Hantel fallen lassen.'],
    tip: 'Im Sitzen auf einer Schrägbank wird der Bizeps stärker gedehnt – guter Reiz für Fortgeschrittene.',
  }),
  ex('hammercurl', 'Hammercurl (Kurzhantel)', 'eq-kurzhanteln', ['bizeps', 'unterarm'], [], {
    rest: 60,
    step: 1,
    setup: 'Hanteln seitlich am Körper, Handflächen zeigen zueinander (neutraler Griff).',
    steps: [
      'Hantel mit dem Daumen nach oben zur Schulter curlen.',
      'Oben kurz halten.',
      'Langsam wieder senken.',
    ],
    breathing: 'Beim Hochcurlen ausatmen, beim Ablassen einatmen.',
    mistakes: ['Ellbogen nach vorn.', 'Schwung aus dem Oberkörper.', 'Handgelenk knicken.'],
    tip: 'Trainiert den Brachialis und Unterarm mit – gibt dem Oberarm mehr Breite.',
  }),
  ex('konzentrationscurl', 'Konzentrationscurl', 'eq-kurzhanteln', ['bizeps'], ['unterarm'], {
    unilateral: true,
    rest: 60,
    step: 1,
    setup: 'Auf der Bank sitzen, Ellbogen innen am Oberschenkel abstützen, Hantel hängt gestreckt.',
    steps: [
      'Hantel zur Schulter curlen.',
      'Oben fest anspannen.',
      'Langsam wieder strecken.',
    ],
    breathing: 'Beim Hochcurlen ausatmen, beim Ablassen einatmen.',
    mistakes: ['Oberkörper mitbewegen.', 'Ellbogen vom Oberschenkel lösen.', 'Zu schnell ablassen.'],
    tip: 'Eine reine Isolationsübung – wähle das Gewicht so, dass die letzten Wiederholungen noch sauber gehen.',
  }),
  ex('curl-kabel', 'Bizepscurl am Kabel', 'eq-kabelzug', ['bizeps'], ['unterarm'], {
    rest: 60,
    step: 5,
    setup: 'Kabel ganz unten, gerade oder SZ-Stange im Untergriff, Ellbogen am Körper, einen halben Schritt zurück.',
    steps: [
      'Stange nach oben curlen.',
      'Oben kurz anspannen.',
      'Langsam ablassen, die Spannung bleibt im Kabel.',
    ],
    breathing: 'Beim Hochcurlen ausatmen, beim Ablassen einatmen.',
    mistakes: ['Zurücklehnen.', 'Ellbogen nach vorn.', 'Gewicht ablegen statt Spannung zu halten.'],
    tip: 'Das Kabel hält die Spannung über die ganze Bewegung – ideal als Abschluss.',
  }),
  ex('trizepsdruecken-kabel', 'Trizepsdrücken am Kabel', 'eq-kabelzug', ['trizeps'], [], {
    rest: 60,
    step: 5,
    setup: 'Kabel oben, gerade Stange oder Seil, Oberarme eng am Körper, leicht nach vorn gebeugt.',
    steps: [
      'Ellbogen fixieren, die Unterarme nach unten strecken.',
      'Unten den Trizeps fest anspannen, beim Seil die Enden leicht auseinanderziehen.',
      'Langsam bis etwa 90° zurückkommen lassen.',
    ],
    breathing: 'Beim Drücken ausatmen, beim Zurückführen einatmen.',
    mistakes: ['Ellbogen vom Körper lösen.', 'Mit dem Oberkörper nachdrücken.', 'Zu schwer und mit Schwung.'],
    tip: 'Die Oberarme sollen bewegungslos bleiben – nur die Unterarme arbeiten.',
  }),
  ex('skullcrusher-sz', 'Stirndrücken (SZ-Stange)', 'eq-szstange', ['trizeps'], [], {
    rest: 75,
    step: 2.5,
    setup: 'Flach auf der Bank liegen, SZ-Stange mit engem Obergriff über der Brust halten, Arme senkrecht.',
    steps: [
      'Nur die Ellbogen beugen und die Stange zur Stirn bzw. knapp dahinter senken.',
      'Oberarme bleiben ruhig senkrecht.',
      'Wieder strecken, bis die Arme fast gestreckt sind.',
    ],
    breathing: 'Beim Senken einatmen, beim Strecken ausatmen.',
    mistakes: ['Ellbogen nach außen kippen.', 'Oberarme mitschwingen.', 'Zu schwer wählen – Ellbogen werden belastet.'],
    tip: 'Bei Ellbogenschmerzen Kurzhantel-Variante oder Kabel bevorzugen.',
  }),
  ex('trizeps-ueberkopf', 'Trizepsstrecken über Kopf (Kurzhantel)', 'eq-kurzhanteln', ['trizeps'], [], {
    rest: 60,
    step: 1,
    setup: 'Sitzen oder stehen, eine Hantel mit beiden Händen über den Kopf halten, Arme gestreckt.',
    steps: [
      'Ellbogen beugen und die Hantel hinter den Kopf senken.',
      'Ellbogen zeigen nach vorn und bleiben nah am Kopf.',
      'Nach oben strecken.',
    ],
    breathing: 'Beim Senken einatmen, beim Strecken ausatmen.',
    mistakes: ['Ellbogen nach außen.', 'Hohlkreuz.', 'Gewicht zu schwer.'],
    tip: 'Der lange Trizepskopf wird in der Überkopf-Position besonders gedehnt – gut für den Muskelaufbau.',
  }),
  ex('dips', 'Dips (Barren)', 'eq-klimmzugstange', ['trizeps', 'brust'], ['schulter_vorn'], {
    t: 'koerpergewicht_wdh',
    rest: 105,
    step: 2.5,
    setup: 'Auf den Barren stützen, Arme gestreckt, Körper leicht vorgeneigt für Brust, aufrecht für Trizeps.',
    steps: [
      'Ellbogen beugen und kontrolliert absenken, bis die Oberarme etwa waagerecht sind.',
      'Kraftvoll nach oben drücken.',
      'Oben Schultern nach unten halten.',
    ],
    breathing: 'Beim Absenken einatmen, beim Hochdrücken ausatmen.',
    mistakes: ['Zu tief absenken (Schulter).', 'Schultern hochziehen.', 'Mit Schwung arbeiten.'],
    tip: 'Mit der Dip-Hilfe-Maschine beginnen, wenn Körpergewicht noch zu schwer ist.',
  }),
  ex('enges-bankdruecken', 'Enges Bankdrücken (Langhantel)', 'eq-langhantel', ['trizeps'], ['brust', 'schulter_vorn'], {
    rest: 120,
    step: 2.5,
    setup: 'Wie Bankdrücken, aber Griff etwa schulterbreit, Ellbogen näher am Körper.',
    steps: [
      'Stange zur unteren Brust senken, Ellbogen nah am Körper.',
      'Kurz berühren.',
      'Kraftvoll nach oben drücken.',
    ],
    breathing: PUSH_BREATH,
    mistakes: ['Griff zu eng (Handgelenke).', 'Schultern nach vorn.', 'Gesäß von der Bank.'],
    tip: 'Schulterbreit reicht – noch engerer Griff belastet vor allem die Handgelenke.',
  }),
  ex('handgelenkcurl', 'Handgelenkcurl (Unterarm)', 'eq-szstange', ['unterarm'], [], {
    rest: 45,
    step: 1,
    setup: 'Auf der Bank sitzen, Unterarme auf den Oberschenkeln, Handrücken nach unten, Stange mit Untergriff.',
    steps: [
      'Stange mit den Fingern nach unten rollen lassen.',
      'Wieder zurückrollen und die Handgelenke nach oben beugen.',
      'Oben kurz halten.',
    ],
    breathing: NO_PRESS,
    mistakes: ['Zu schwer.', 'Unterarme heben.', 'Ruckartig arbeiten.'],
    tip: 'Hohe Wiederholungszahlen (15–20) funktionieren am besten.',
  }),

  // ---------------------------------------------------------------- Beine
  ex('beinpresse', 'Beinpresse', 'eq-beinpresse', ['quadrizeps', 'gesaess'], ['beinbeuger', 'adduktoren'], {
    rest: 120,
    step: 10,
    setup: 'Rückenlehne so einstellen, dass die Knie in der Beugung nicht an die Brust stoßen. Füße etwa schulterbreit auf die Plattform, Rücken und Gesäß fest an die Polster.',
    steps: [
      'Sicherungen lösen, Plattform nach unten lassen, bis die Knie etwa 90° gebeugt sind.',
      'Mit der ganzen Fußfläche kräftig nach oben drücken.',
      'Knie oben nicht ganz durchstrecken.',
    ],
    breathing: PUSH_BREATH,
    mistakes: ['Gesäß hebt sich ab (Beckenaufrichtung).', 'Knie fallen nach innen.', 'Knie komplett durchdrücken.'],
    tip: 'Fußposition höher = mehr Gesäß/Beinbeuger, tiefer = mehr Quadrizeps.',
  }),
  ex('kniebeuge-langhantel', 'Kniebeuge (Langhantel)', 'eq-langhantel', ['quadrizeps', 'gesaess'], ['beinbeuger', 'unterer_ruecken', 'bauch'], {
    rest: 180,
    step: 2.5,
    setup: 'Stange auf dem oberen Rücken (Nacken tief), Füße schulterbreit, Fußspitzen leicht nach außen. Bauch fest, Blick geradeaus. Mit Sicherheitsständer arbeiten.',
    steps: [
      'Hüfte und Knie gleichzeitig beugen, Knie folgen den Fußspitzen.',
      'Tief absenken, bis die Oberschenkel mindestens waagerecht sind (so tief, wie der Rücken gerade bleibt).',
      'Aus den Fersen kräftig nach oben drücken.',
    ],
    breathing: 'Oben einatmen und Rumpf festmachen, beim Hochdrücken ausatmen.',
    mistakes: ['Knie fallen nach innen.', 'Rücken rundet sich unten.', 'Fersen heben ab.'],
    tip: 'Mit leichter Stange und Spiegel oder Video die Technik prüfen; Gewicht erst steigern, wenn die Tiefe passt.',
  }),
  ex('kniebeuge-multipresse', 'Kniebeuge (Multipresse)', 'eq-multipresse', ['quadrizeps', 'gesaess'], ['beinbeuger'], {
    rest: 120,
    step: 2.5,
    setup: 'Stange auf dem oberen Rücken, Füße etwas vor der Stange (Schrittbreite), Haken beim Absetzen sichern.',
    steps: [
      'In die Knie gehen, bis die Oberschenkel waagerecht sind.',
      'Die Knie bleiben über den Füßen.',
      'Kräftig nach oben drücken.',
    ],
    breathing: 'Oben einatmen und Rumpf festmachen, beim Hochdrücken ausatmen.',
    mistakes: ['Füße zu weit unter der Stange.', 'Rücken runden.', 'Sicherungshaken vergessen.'],
    tip: 'Die geführte Bahn nimmt dir Stabilisierungsarbeit ab – deshalb nicht blind zu schwer gehen.',
  }),
  ex('ausfallschritte-kurzhantel', 'Ausfallschritte (Kurzhantel)', 'eq-kurzhanteln', ['quadrizeps', 'gesaess'], ['beinbeuger', 'adduktoren'], {
    rest: 90,
    step: 2,
    setup: 'Aufrecht stehen, Hanteln seitlich, Blick geradeaus, Rumpf fest.',
    steps: [
      'Mit einem Bein einen großen Schritt nach vorn machen.',
      'Beide Knie beugen, bis das hintere Knie knapp über dem Boden ist.',
      'Aus dem vorderen Fuß abdrücken und zurück zum Start.',
    ],
    breathing: 'Beim Absenken einatmen, beim Hochdrücken ausatmen.',
    mistakes: ['Knie fällt nach innen.', 'Oberkörper kippt nach vorn.', 'Schritt zu kurz, Knie schiebt über die Zehen.'],
    tip: 'Alternativ rückwärts ausfallen: schont die Knie und trainiert das Gesäß stärker.',
  }),
  ex('bulgarian-split-squat', 'Bulgarian Split Squat', 'eq-kurzhanteln', ['quadrizeps', 'gesaess'], ['beinbeuger', 'adduktoren'], {
    rest: 105,
    step: 2,
    setup: 'Hinteren Fuß auf einer Bank ablegen, vorderer Fuß etwa einen großen Schritt vor der Bank. Hanteln seitlich.',
    steps: [
      'Senkrecht absenken, bis der vordere Oberschenkel waagerecht ist.',
      'Oberkörper aufrecht, Knie über dem Fuß.',
      'Aus dem vorderen Bein nach oben drücken.',
    ],
    breathing: 'Beim Absenken einatmen, beim Hochdrücken ausatmen.',
    mistakes: ['Zu nah an der Bank.', 'Knie kippt nach innen.', 'Gewicht auf den hinteren Fuß verlagern.'],
    tip: 'Anspruchsvoll für das Gleichgewicht – erst ohne Gewicht üben.',
  }),
  ex('beinstrecker-maschine', 'Beinstrecker (Maschine)', 'eq-beinstrecker', ['quadrizeps'], [], {
    rest: 75,
    step: 5,
    setup: 'Rückenlehne so einstellen, dass die Knie am Gelenkpunkt der Maschine sitzen; das Beinpolster liegt knapp über den Knöcheln.',
    steps: [
      'Beine bis fast zur Streckung heben.',
      'Oben den Quadrizeps kurz anspannen.',
      'Langsam absenken, nicht ablegen.',
    ],
    breathing: 'Beim Strecken ausatmen, beim Absenken einatmen.',
    mistakes: ['Mit Schwung arbeiten.', 'Gesäß hebt ab.', 'Knie voll durchdrücken.'],
    tip: 'Bei Knieproblemen den Bewegungsumfang nach unten begrenzen.',
  }),
  ex('beinbeuger-sitzend', 'Beinbeuger sitzend (Maschine)', 'eq-beinbeuger', ['beinbeuger'], ['waden'], {
    rest: 75,
    step: 5,
    setup: 'Lehne und Polster so einstellen, dass die Knie in Höhe der Drehachse liegen. Oberschenkelpolster fest herunter.',
    steps: [
      'Fersen unter die Rolle, Beine strecken.',
      'Unterschenkel kräftig nach unten/hinten beugen.',
      'Langsam wieder zurückführen.',
    ],
    breathing: 'Beim Beugen ausatmen, beim Zurückführen einatmen.',
    mistakes: ['Hüfte heben.', 'Mit Schwung arbeiten.', 'Zu schnell zurücklassen.'],
    tip: 'Fußspitzen anziehen, so wird der Beinbeuger stärker betont.',
  }),
  ex('beinbeuger-liegend', 'Beinbeuger liegend (Maschine)', 'eq-beinbeuger', ['beinbeuger'], ['waden'], {
    rest: 75,
    step: 5,
    setup: 'Auf den Bauch legen, Knie knapp über der Bankkante, Polster liegt an den Fersen/Achillessehnen.',
    steps: [
      'Fersen in Richtung Gesäß beugen.',
      'Oben kurz halten.',
      'Langsam wieder strecken.',
    ],
    breathing: 'Beim Beugen ausatmen, beim Strecken einatmen.',
    mistakes: ['Hüfte hebt ab.', 'Hohlkreuz.', 'Ruckartig arbeiten.'],
    tip: 'Hüfte aktiv in die Bank drücken, das schützt den unteren Rücken.',
  }),
  ex('rumaenisches-kreuzheben', 'Rumänisches Kreuzheben', 'eq-langhantel', ['beinbeuger', 'gesaess'], ['unterer_ruecken'], {
    rest: 135,
    step: 2.5,
    setup: 'Aufrecht stehen, Stange mit Obergriff vor den Oberschenkeln, Knie nur leicht gebeugt, Rücken gerade.',
    steps: [
      'Die Hüfte weit nach hinten schieben, die Stange bleibt nah an den Beinen.',
      'Absenken, bis du die Dehnung in den Beinbeugern spürst (etwa Kniehöhe).',
      'Hüfte nach vorn schieben und aufrichten.',
    ],
    breathing: 'Beim Absenken einatmen, beim Aufrichten ausatmen.',
    mistakes: ['Rücken rundet sich.', 'Stange wandert vom Körper weg.', 'Knie zu stark beugen (wird zum Kreuzheben).'],
    tip: 'Die Bewegung kommt aus der Hüfte – wie eine Tür, die mit dem Gesäß zugeschoben wird.',
  }),
  ex('hip-thrust', 'Hip Thrust (Langhantel)', 'eq-langhantel', ['gesaess'], ['beinbeuger', 'quadrizeps'], {
    rest: 105,
    step: 5,
    setup: 'Oberer Rücken an einer Bank, Stange (mit Polster) über der Hüfte, Füße hüftbreit, Schienbeine oben senkrecht.',
    steps: [
      'Hüfte nach unten sinken lassen, ohne abzusetzen.',
      'Gesäß fest anspannen und die Hüfte nach oben drücken, bis Rücken und Oberschenkel eine Linie bilden.',
      'Oben kurz halten, dann kontrolliert absenken.',
    ],
    breathing: 'Beim Hochdrücken ausatmen, beim Absenken einatmen.',
    mistakes: ['Ins Hohlkreuz überstrecken.', 'Füße zu weit weg oder zu nah.', 'Kinn nach oben reißen.'],
    tip: 'Das Kinn leicht zur Brust halten, so bleibt die Wirbelsäule neutral.',
  }),
  ex('adduktoren-maschine', 'Adduktoren (Maschine)', 'eq-adduktor', ['adduktoren'], [], {
    rest: 60,
    step: 5,
    setup: 'Auf die Maschine setzen, Rücken an der Lehne, Beinpolster an den Innenseiten der Knie.',
    steps: [
      'Beine kontrolliert zusammenführen.',
      'Kurz anspannen.',
      'Langsam wieder öffnen.',
    ],
    breathing: 'Beim Zusammenführen ausatmen, beim Öffnen einatmen.',
    mistakes: ['Zu weit öffnen und die Hüfte überdehnen.', 'Mit Schwung arbeiten.', 'Zu schwer.'],
    tip: 'Starte mit einem bequemen Öffnungswinkel und erweitere ihn über die Wochen.',
  }),
  ex('abduktoren-maschine', 'Abduktoren (Maschine)', 'eq-abduktor', ['abduktoren', 'gesaess'], [], {
    rest: 60,
    step: 5,
    setup: 'Auf die Maschine setzen, Rücken an der Lehne, Polster an den Außenseiten der Knie.',
    steps: [
      'Beine nach außen drücken.',
      'Kurz halten.',
      'Langsam wieder schließen, nicht zusammenschlagen lassen.',
    ],
    breathing: 'Beim Öffnen ausatmen, beim Schließen einatmen.',
    mistakes: ['Oberkörper nach vorn lehnen und schaukeln.', 'Zu schwer.', 'Ruckartig.'],
    tip: 'Leicht nach vorn lehnen betont das Gesäß stärker.',
  }),
  ex('waden-stehend', 'Wadenheben stehend (Maschine)', 'eq-wadenmaschine', ['waden'], [], {
    rest: 60,
    step: 5,
    setup: 'Schulterpolster auf die Schultern, Fußballen auf die Plattform, Fersen frei hängen.',
    steps: [
      'Fersen maximal nach oben drücken.',
      'Oben eine Sekunde halten.',
      'Langsam bis zur tiefen Dehnung absenken.',
    ],
    breathing: NO_PRESS,
    mistakes: ['Federn statt voller Bewegung.', 'Knie beugen.', 'Zu schnelle Wiederholungen.'],
    tip: 'Waden sind ausdauernd – 12–20 Wiederholungen mit voller Dehnung sind sinnvoll.',
  }),
  ex('waden-sitzend', 'Wadenheben sitzend', 'eq-wadenmaschine', ['waden'], [], {
    rest: 60,
    step: 5,
    setup: 'Sitzen, Knie unter dem Polster, Fußballen auf der Plattform.',
    steps: [
      'Fersen nach oben drücken.',
      'Oben kurz halten.',
      'Langsam wieder absenken, bis die Dehnung spürbar ist.',
    ],
    breathing: NO_PRESS,
    mistakes: ['Zu kurzer Weg.', 'Schwung holen.', 'Fußspitzen nach außen kippen.'],
    tip: 'Im Sitzen arbeitet vor allem der tiefe Schollenmuskel – ergänzt das Stehen gut.',
  }),
  ex('kickback-kabel', 'Gesäß-Kickback am Kabel', 'eq-kabelzug', ['gesaess'], ['beinbeuger', 'unterer_ruecken'], {
    unilateral: true,
    rest: 60,
    step: 2.5,
    setup: 'Manschette am Fußgelenk, Kabel ganz unten, leicht nach vorn gebeugt an der Maschine abstützen.',
    steps: [
      'Bein gestreckt (oder leicht gebeugt) nach hinten oben führen.',
      'Oben das Gesäß fest anspannen.',
      'Langsam zurückführen.',
    ],
    breathing: 'Beim Nach-hinten-Führen ausatmen, beim Zurückführen einatmen.',
    mistakes: ['Ins Hohlkreuz schwingen.', 'Becken dreht auf.', 'Zu schwer.'],
    tip: 'Die Bewegung endet, wo die Hüfte aufhört – nicht aus dem Rücken weiterführen.',
  }),
  ex('goblet-squat', 'Goblet Squat (Kurzhantel)', 'eq-kurzhanteln', ['quadrizeps', 'gesaess'], ['bauch', 'unterer_ruecken'], {
    rest: 90,
    step: 2,
    setup: 'Eine Hantel senkrecht vor der Brust halten, Füße etwas mehr als schulterbreit, Fußspitzen leicht nach außen.',
    steps: [
      'Hüfte und Knie beugen, bis du tief in der Hocke bist, Ellbogen innen zwischen den Knien.',
      'Brust bleibt aufrecht.',
      'Aus den Fersen wieder hochdrücken.',
    ],
    breathing: 'Beim Absenken einatmen, beim Hochdrücken ausatmen.',
    mistakes: ['Knie fallen nach innen.', 'Oberkörper kippt nach vorn.', 'Fersen heben ab.'],
    tip: 'Ideal zum Üben der Kniebeugetechnik und zum Aufwärmen.',
  }),

  // ---------------------------------------------------------------- Rumpf
  ex('bauchmaschine', 'Bauchmaschine (Crunch)', 'eq-bauchmaschine', ['bauch'], ['schraeg'], {
    rest: 60,
    step: 5,
    setup: 'Sitz und Polster so einstellen, dass die Drehachse auf Höhe des Bauchnabels liegt. Füße fest, Arme am Polster.',
    steps: [
      'Oberkörper durch Anspannen des Bauchs nach vorn unten einrollen.',
      'Unten die Bauchmuskeln kurz zusammenziehen.',
      'Langsam wieder zurückkommen, Spannung halten.',
    ],
    breathing: 'Beim Einrollen ausatmen, beim Aufrichten einatmen.',
    mistakes: ['Mit den Armen oder Hüftbeugern ziehen.', 'Schnell und mit Schwung.', 'Rücken zu weit nach hinten überstrecken.'],
    tip: 'Rippen Richtung Becken zusammenziehen – nicht nur den Kopf bewegen.',
  }),
  ex('crunch-boden', 'Crunch (Boden)', 'eq-koerpergewicht', ['bauch'], ['schraeg'], {
    t: 'koerpergewicht_wdh',
    rest: 45,
    step: 2.5,
    setup: 'Auf dem Rücken liegen, Füße aufgestellt, Hände an den Schläfen (nicht hinter dem Kopf ziehen).',
    steps: [
      'Schulterblätter vom Boden heben, indem die Rippen zum Becken wandern.',
      'Oben kurz halten.',
      'Langsam absenken, ohne ganz abzulegen.',
    ],
    breathing: 'Beim Hochkommen ausatmen, beim Absenken einatmen.',
    mistakes: ['Am Nacken ziehen.', 'Mit Schwung hochkommen.', 'Zu hoch kommen (wird zum Sit-up).'],
    tip: 'Ein kleiner Bewegungsumfang mit viel Spannung ist besser als hochkommen mit Schwung.',
  }),
  ex('beinheben-haengend', 'Beinheben hängend', 'eq-klimmzugstange', ['bauch'], ['unterarm', 'quadrizeps'], {
    t: 'koerpergewicht_wdh',
    rest: 75,
    step: 2.5,
    setup: 'An der Stange hängen oder im Armstütz-Gerät, Schultern leicht nach unten gezogen.',
    steps: [
      'Becken leicht nach hinten kippen.',
      'Beine (angewinkelt oder gestreckt) bis etwa Hüfthöhe heben, dabei das Becken einrollen.',
      'Langsam wieder absenken, nicht schwingen.',
    ],
    breathing: 'Beim Heben ausatmen, beim Absenken einatmen.',
    mistakes: ['Schwung aus dem Körper.', 'Nur Hüftbeuger statt Bauch einsetzen.', 'Schultern hochziehen.'],
    tip: 'Zu schwer? Beine angewinkelt heben.',
  }),
  ex('plank', 'Unterarmstütz (Plank)', 'eq-koerpergewicht', ['bauch'], ['schraeg', 'schulter_vorn'], {
    t: 'zeit',
    rest: 45,
    step: 2.5,
    setup: 'Unterarme parallel auf dem Boden, Ellbogen unter den Schultern, Körper bildet eine Linie.',
    steps: [
      'Bauch und Gesäß fest anspannen.',
      'Position halten, ohne dass die Hüfte durchhängt.',
      'Gleichmäßig weiteratmen.',
    ],
    breathing: 'Ruhig und gleichmäßig weiteratmen, nicht den Atem anhalten.',
    mistakes: ['Hüfte hängt durch.', 'Hüfte zu hoch.', 'Kopf fällt nach unten.'],
    tip: 'Lieber 30 Sekunden sauber als zwei Minuten durchhängend.',
  }),
  ex('seitstuetz', 'Seitstütz', 'eq-koerpergewicht', ['schraeg'], ['bauch', 'abduktoren'], {
    t: 'zeit',
    rest: 45,
    step: 2.5,
    setup: 'Auf der Seite liegen, Ellbogen unter der Schulter, Füße übereinander oder gestaffelt.',
    steps: [
      'Hüfte anheben, bis der Körper eine gerade Linie bildet.',
      'Position halten.',
      'Seitenwechsel.',
    ],
    breathing: 'Ruhig weiteratmen.',
    mistakes: ['Hüfte sinkt ab.', 'Becken dreht nach vorn/hinten.', 'Schulter wird belastet statt aktiv gehalten.'],
    tip: 'Das untere Knie darf zur Erleichterung auf dem Boden bleiben.',
  }),
  ex('russian-twist', 'Russian Twist', 'eq-koerpergewicht', ['schraeg'], ['bauch'], {
    t: 'koerpergewicht_wdh',
    rest: 45,
    step: 2,
    setup: 'Auf dem Boden sitzen, Oberkörper leicht zurück, Füße angehoben oder aufgestellt, ggf. mit Gewicht.',
    steps: [
      'Rücken gerade halten, beide Hände (mit Gewicht) vor der Brust.',
      'Oberkörper und Arme zur Seite drehen.',
      'Zur anderen Seite wechseln.',
    ],
    breathing: 'Beim Drehen ausatmen.',
    mistakes: ['Rücken rund machen.', 'Nur die Arme bewegen.', 'Mit Schwung.'],
    tip: 'Blick folgt den Händen – die Drehung kommt aus dem Brustkorb.',
  }),
  ex('kabel-crunch', 'Kabel-Crunch (kniend)', 'eq-kabelzug', ['bauch'], ['schraeg'], {
    rest: 60,
    step: 5,
    setup: 'Seilgriff am oberen Kabel, kniend, Hände neben dem Kopf, Rücken leicht gebeugt.',
    steps: [
      'Oberkörper einrollen, Ellbogen Richtung Knie.',
      'Unten Bauch anspannen.',
      'Langsam wieder aufrichten, Spannung halten.',
    ],
    breathing: 'Beim Einrollen ausatmen, beim Aufrichten einatmen.',
    mistakes: ['Mit den Armen ziehen.', 'Hüfte bewegt sich.', 'Zu viel Gewicht.'],
    tip: 'Die Hüfte bleibt ruhig – der Bauch ist der einzige Bewegungsmotor.',
  }),

  // ---------------------------------------------------------------- Kabelzug allgemein
  ex('cross-over-kabel', 'Kabel-Cross-Over', 'eq-kabelzug', ['brust'], ['schulter_vorn'], {
    rest: 60,
    step: 5,
    setup: 'Zwei Kabelzüge oben, Griffe fassen, einen Schritt nach vorn, leicht vorgebeugt, Arme seitlich leicht gebeugt.',
    steps: [
      'Die Arme in einem Bogen nach unten vorn zusammenführen.',
      'Vor dem Körper die Hände kurz überkreuzen und die Brust anspannen.',
      'Langsam wieder öffnen, bis die Brust gedehnt ist.',
    ],
    breathing: 'Beim Zusammenführen ausatmen, beim Öffnen einatmen.',
    mistakes: ['Mit dem Oberkörper mitwippen.', 'Ellbogen strecken.', 'Zu schwer.'],
    tip: 'Mit der Höhe der Kabelzüge variierst du die Betonung (oben = untere Brust, unten = obere Brust).',
  }),
  ex('face-pull-kabel', 'Face Pull (Kabel)', 'eq-kabelzug', ['schulter_hinten', 'oberer_ruecken'], ['schulter_seitlich'], {
    rest: 60,
    step: 5,
    setup: 'Seilgriff am Kabel in Gesichtshöhe, Seilenden mit Daumen zu dir fassen, einen Schritt zurück.',
    steps: [
      'Das Seil in Richtung Gesicht ziehen, Ellbogen hoch und nach außen.',
      'Hände neben den Ohren, Schulterblätter zusammen.',
      'Kontrolliert strecken.',
    ],
    breathing: PULL_BREATH,
    mistakes: ['Zu viel Gewicht und Rücken ins Hohlkreuz.', 'Ellbogen sinken ab.', 'Mit Schwung.'],
    tip: 'Eine der besten Übungen für gesunde Schultern – leicht und mit vielen Wiederholungen.',
  }),
  ex('seitheben-kabel', 'Seitheben am Kabel', 'eq-kabelzug', ['schulter_seitlich'], [], {
    unilateral: true,
    rest: 60,
    step: 2.5,
    setup: 'Kabel ganz unten, seitlich zum Kabel stehen, Handgriff mit der äußeren Hand fassen.',
    steps: [
      'Arm leicht gebeugt seitlich bis etwa Schulterhöhe heben.',
      'Oben kurz halten.',
      'Langsam absenken.',
    ],
    breathing: 'Beim Heben ausatmen, beim Absenken einatmen.',
    mistakes: ['Mit dem Körper Schwung holen.', 'Zu hoch heben.', 'Schulter hochziehen.'],
    tip: 'Das Kabel hält die Spannung unten – anders als Kurzhanteln, die dort fast gewichtslos sind.',
  }),

  // ---------------------------------------------------------------- Cardio
  ex('laufband', 'Laufband', 'eq-laufband', ['quadrizeps', 'waden'], ['beinbeuger', 'gesaess'], {
    t: 'cardio',
    rest: 0,
    step: 0,
    setup: 'Auf die Seitenflächen stellen, Band starten, erst dann draufgehen. Not-Aus-Clip am Gürtel befestigen.',
    steps: [
      'Mit 3–5 Minuten Gehen aufwärmen.',
      'Steigung und Tempo schrittweise erhöhen.',
      'Zum Schluss 3–5 Minuten ausgehen.',
    ],
    breathing: 'Gleichmäßig atmen; ein Gespräch sollte noch möglich sein (lockeres Ausdauertempo).',
    mistakes: ['Sich am Handlauf festhalten.', 'Zu schnell starten.', 'Zu weit hinten auf dem Band laufen.'],
    tip: 'Steigung statt Tempo erhöht die Belastung gelenkschonender.',
  }),
  ex('crosstrainer', 'Crosstrainer', 'eq-crosstrainer', ['quadrizeps', 'gesaess'], ['beinbeuger', 'bizeps', 'trizeps'], {
    t: 'cardio',
    rest: 0,
    step: 0,
    setup: 'Auf die Pedale steigen, Griffe fassen, aufrecht stehen.',
    steps: [
      'In gleichmäßigem Rhythmus laufen.',
      'Arme aktiv mitarbeiten lassen.',
      'Widerstand nach Gefühl erhöhen.',
    ],
    breathing: 'Gleichmäßig atmen.',
    mistakes: ['Nach vorn lehnen und aufstützen.', 'Zu geringer Widerstand.', 'Fußsohle abheben.'],
    tip: 'Rückwärts laufen betont Beinbeuger und Gesäß etwas mehr.',
  }),
  ex('ergometer', 'Ergometer (Fahrrad)', 'eq-ergometer', ['quadrizeps'], ['beinbeuger', 'gesaess', 'waden'], {
    t: 'cardio',
    rest: 0,
    step: 0,
    setup: 'Sattel so einstellen, dass das Knie unten leicht gebeugt ist, Lenker bequem.',
    steps: [
      'Locker einrollen, 3–5 Minuten.',
      'Widerstand erhöhen, gleichmäßige Trittfrequenz (70–90).',
      'Zum Schluss ausrollen.',
    ],
    breathing: 'Gleichmäßig atmen.',
    mistakes: ['Sattel zu tief.', 'Hüfte wackelt.', 'Zu hoher Widerstand mit niedriger Frequenz.'],
    tip: 'Ideal für schonendes Ausdauertraining oder Aufwärmen der Beine.',
  }),
  ex('rudergeraet', 'Rudergerät', 'eq-rudergeraet', ['latissimus', 'quadrizeps'], ['oberer_ruecken', 'bizeps', 'gesaess', 'beinbeuger'], {
    t: 'cardio',
    rest: 0,
    step: 0,
    setup: 'Füße in die Schlaufen, Dämpfer auf 3–5, Griff mit gestreckten Armen fassen.',
    steps: [
      'Zuerst die Beine drücken, dann den Oberkörper nach hinten, dann die Arme ziehen.',
      'Zurück in umgekehrter Reihenfolge: Arme, Oberkörper, Beine.',
      'Gleichmäßigen Rhythmus halten.',
    ],
    breathing: 'Beim Zug ausatmen, beim Zurückrollen einatmen.',
    mistakes: ['Mit dem Rücken starten.', 'Rücken rund machen.', 'Zu schnell zurückrollen.'],
    tip: 'Ungefähr 60 % der Kraft kommen aus den Beinen, 20 % Rumpf, 20 % Arme.',
  }),
  ex('stepper', 'Stepper', 'eq-stepper', ['quadrizeps', 'gesaess'], ['waden'], {
    t: 'cardio',
    rest: 0,
    step: 0,
    setup: 'Aufrecht auf die Pedale/Stufen stellen, leicht an den Griffen halten.',
    steps: [
      'Im gleichmäßigen Rhythmus steigen.',
      'Aufrecht bleiben, Blick geradeaus.',
      'Stufe/Tempo allmählich steigern.',
    ],
    breathing: 'Gleichmäßig atmen.',
    mistakes: ['Auf die Griffe stützen.', 'Nur auf den Zehenspitzen steigen.', 'Mit krummem Rücken.'],
    tip: 'Stütz dich nur leicht ab, sonst spart der Körper Arbeit.',
  }),
];
