import { ex } from './katalog';
import type { CatalogEquipment, CatalogExercise } from './seed';
import { LIEFERUNG3_GERAETE, LIEFERUNG3_UEBUNGEN } from './studio-lieferung3';

/**
 * Geräte aus deinem Studio – erkannt aus den gelieferten Fotos (KONZEPT.md, Abschnitt 4a).
 * Fotos liegen unter public/geraete/. Neue Lieferungen werden hier ergänzt; danach CATALOG_VERSION in katalog.ts erhöhen.
 *
 * Unsichere Zuordnungen stehen im Feld `hint` ("noch zu bestätigen"). Skalen, die nicht auf den Fotos zu lesen waren,
 * sind als vorläufige Bereiche angelegt und in der App änderbar.
 */

const PULL = 'Beim Ziehen/Drücken ausatmen, beim kontrollierten Zurückführen einatmen.';

const STUDIO_GERAETE_1: CatalogEquipment[] = [
  {
    id: 'eq-newtech-multi-pully',
    name: 'Multi Pully',
    brand: 'NEWTECH',
    model: 'Multi Pully',
    kind: 'kabelzug',
    loading: 'gewichtsblock',
    pictogram: 'multi-kabelzug',
    adjustments: [
      {
        id: 'armhoehe',
        label: 'Armhöhe (Raste)',
        min: 1,
        max: 10,
      },
    ],
    builtinPhoto: 'geraete/newtech-multi-pully.jpg',
    builtinPhotos: [{ src: 'geraete/newtech-multi-pully-tafel.jpg', caption: 'Übungstafel des Herstellers (12 Übungen)' }],
    inStudio: true,
    hint: 'Doppel-Kabelzug mit zwei Gewichtsblöcken, schwenkbaren Armen und Klimmzugstange. Skala der Armhöhen noch nicht erfasst (1–10 ist vorläufig, bitte anpassen).',
  },
  {
    id: 'eq-schnell-bizeps',
    name: 'Bizepsmaschine (Scott-Curl)',
    brand: 'SCHNELL',
    model: 'Scott-Curl, scheibenbeladen',
    kind: 'maschine',
    loading: 'scheiben',
    pictogram: 'curl-maschine',
    adjustments: [{ id: 'sitzhoehe', label: 'Sitzhöhe', min: 1, max: 5 }],
    builtinPhoto: 'geraete/schnell-bizepsmaschine.jpg',
    builtinPhotos: [{ src: 'geraete/schnell-bizepsmaschine-seite.jpg', caption: 'Seitenansicht mit Hebelarm' }],
    inStudio: true,
    hint: 'Hantelscheiben (Olympia-Aufnahme) am Hebelarm. Skala der Sitzhöhe noch nicht erfasst (vorläufig 1–5).',
  },
  {
    id: 'eq-gymleco-biceps-curl',
    name: 'Biceps Curl (Maschine)',
    brand: 'Gymleco',
    model: 'Active Line 350 – Biceps Curl',
    kind: 'maschine',
    loading: 'gewichtsblock',
    pictogram: 'curl-maschine',
    adjustments: [
      { id: 'sitzhoehe', label: 'Sitzhöhe', min: 1, max: 10 },
      { id: 'brustpolster', label: 'Brustpolster', min: 1, max: 10 },
    ],
    builtinPhoto: 'geraete/gymleco-biceps-curl.jpg',
    inStudio: true,
    hint: 'Skalen noch nicht erfasst (vorläufig 1–10, bitte anpassen). Das Schild am Gerät: Sitz so einstellen, dass die Arme im selben Winkel wie die Armpolster liegen; Brustpolster so, dass die Ellbogen auf Höhe der Drehachse sind.',
  },
  {
    id: 'eq-newtech-pec-dec-fly',
    name: 'Pec Dec Fly (Butterfly)',
    brand: 'NEWTECH',
    model: 'M-Torture Pec Dec Fly',
    kind: 'maschine',
    loading: 'scheiben',
    pictogram: 'butterfly',
    adjustments: [{ id: 'sitzhoehe', label: 'Sitzhöhe', min: 1, max: 10 }],
    builtinPhoto: 'geraete/newtech-pec-dec-fly.jpg',
    inStudio: true,
    hint: 'Hantelscheiben (Olympia-Aufnahme), Seilzug-Umlenkung. Skala der Sitzhöhe noch nicht erfasst (vorläufig 1–10).',
  },
  {
    id: 'eq-newtech-seitheben-maschine',
    name: 'Seitheben-Maschine (stehend)',
    brand: 'NEWTECH',
    model: 'Olympia-/IFBB-Serie – Standing Lateral Raise',
    kind: 'maschine',
    loading: 'gewichtsblock',
    pictogram: 'seitheben-maschine',
    weightStack: { minKg: 5, maxKg: 100, stepKg: 5 },
    adjustments: [
      {
        id: 'plattformhoehe',
        label: 'Plattformhöhe',
        min: 1,
        max: 16,
        builtinPhoto: 'geraete/newtech-seitheben-maschine-skala.jpg',
      },
    ],
    builtinPhoto: 'geraete/newtech-seitheben-maschine.jpg',
    builtinPhotos: [
      { src: 'geraete/newtech-seitheben-maschine-skala.jpg', caption: 'Skala der Standplattform, Position 1–16' },
      { src: 'geraete/newtech-seitheben-maschine-gewichtsblock.jpg', caption: 'Gewichtsblock 5–100 kg in 5-kg-Schritten' },
    ],
    inStudio: true,
    hint: 'Wird einarmig trainiert, die Wiederholungen zählen je Seite. Als Gerätefoto dient vorerst ein Ausschnitt; ein Foto des ganzen Geräts kann später nachgereicht werden.',
  },
];

const STUDIO_UEBUNGEN_1: CatalogExercise[] = [
  // ------------------------------------------------------------ Multi Pully (12 Übungen der Herstellertafel + Klimmzüge + Face Pulls)
  ex('mp-cross-over', 'Cross Over (Multi Pully)', 'eq-newtech-multi-pully', ['brust'], ['schulter_vorn'], {
    rest: 60,
    step: 2.5,
    setup: 'Arme auf die obere Rasthöhe stellen, Griffe fassen, einen Schritt nach vorn, Oberkörper leicht vorgebeugt, Ellbogen leicht gebeugt.',
    steps: [
      'Mit leicht gebeugten Armen die Griffe in einem weiten Bogen nach unten vorn zusammenführen.',
      'Vor dem Körper die Hände überkreuzen, Brust fest anspannen.',
      'Langsam wieder öffnen, bis die Brust gedehnt ist.',
    ],
    breathing: 'Beim Zusammenführen ausatmen, beim Öffnen einatmen.',
    mistakes: ['Mit dem Oberkörper mitwippen.', 'Ellbogen strecken oder zu stark beugen.', 'Zu schwer wählen.'],
    tip: 'Arme höher einstellen = Betonung untere Brust, tiefer = obere Brust.',
  }),
  ex('mp-brustdruecken', 'Brustdrücken am Kabel (Chest Press)', 'eq-newtech-multi-pully', ['brust'], ['trizeps', 'schulter_vorn'], {
    rest: 90,
    step: 5,
    setup: 'Arme auf Brusthöhe stellen, mit dem Rücken zur Maschine, ein Fuß vor dem anderen, Griffe auf Brusthöhe.',
    steps: [
      'Griffe nach vorn drücken, bis die Arme fast gestreckt sind.',
      'Kurz die Brust anspannen.',
      'Kontrolliert zurückführen, bis die Hände auf Brusthöhe sind.',
    ],
    breathing: 'Beim Drücken ausatmen, beim Zurückführen einatmen.',
    mistakes: ['Ins Hohlkreuz fallen.', 'Schultern nach vorn ziehen.', 'Zu schnell zurücklassen.'],
    tip: 'Stabiler Stand (Schrittstellung) ist wichtig, damit der Rumpf nicht mitwackelt.',
  }),
  ex('mp-rudern-vorgebeugt', 'Vorgebeugtes Rudern (Bent Over Row)', 'eq-newtech-multi-pully', ['oberer_ruecken', 'latissimus'], ['bizeps', 'schulter_hinten', 'unterer_ruecken'], {
    rest: 90,
    step: 5,
    setup: 'Kabel unten, Stange oder Griffe fassen, Oberkörper etwa 45° vorgebeugt, Rücken gerade, Knie leicht gebeugt.',
    steps: [
      'Die Griffe in Richtung unterer Bauch ziehen.',
      'Ellbogen nah am Körper nach hinten führen, Schulterblätter zusammen.',
      'Langsam wieder strecken, ohne den Oberkörper aufzurichten.',
    ],
    breathing: PULL,
    mistakes: ['Rücken rund.', 'Mit dem Oberkörper hochreißen.', 'Arme statt Rücken ziehen.'],
    tip: 'Die Vorbeuge von Anfang bis Ende halten – das Gewicht so wählen, dass das möglich ist.',
  }),
  ex('mp-ueberzug', 'Überzug am Kabel (Pull Over)', 'eq-newtech-multi-pully', ['latissimus'], ['brust', 'trizeps'], {
    rest: 60,
    step: 2.5,
    setup: 'Arme auf die obere Rasthöhe stellen, vorgebeugt stehen, Griff mit gestreckten Armen halten.',
    steps: [
      'Arme gestreckt in einem Bogen nach unten zu den Oberschenkeln ziehen.',
      'Am Ende den Latissimus anspannen.',
      'Langsam wieder bis über Kopfhöhe zurückführen.',
    ],
    breathing: PULL,
    mistakes: ['Ellbogen beugen.', 'Mit dem Oberkörper mitschwingen.', 'Zu schwer.'],
    tip: 'Die Bewegung kommt aus der Schulter – wie ein großer Halbkreis.',
  }),
  ex('mp-schulterdruecken', 'Schulterdrücken am Kabel (Shoulder Press)', 'eq-newtech-multi-pully', ['schulter_vorn', 'schulter_seitlich'], ['trizeps'], {
    rest: 90,
    step: 5,
    setup: 'Arme auf die untere Rasthöhe, Griffe auf Schulterhöhe, mittig zwischen den Armen stehen, Rumpf fest.',
    steps: [
      'Beide Griffe senkrecht nach oben drücken.',
      'Oben die Arme fast strecken.',
      'Kontrolliert bis Schulterhöhe zurückführen.',
    ],
    breathing: PULL,
    mistakes: ['Ins Hohlkreuz fallen.', 'Griffe nach vorn statt nach oben führen.', 'Schwung aus den Knien.'],
    tip: 'Gesäß und Bauch anspannen – das stabilisiert den Rücken.',
  }),
  ex('mp-reverse-fly', 'Reverse Fly am Kabel (Reverse Raise)', 'eq-newtech-multi-pully', ['schulter_hinten'], ['oberer_ruecken'], {
    rest: 60,
    step: 2.5,
    setup: 'Arme auf Schulterhöhe, Griffe über Kreuz (rechte Hand fasst den linken Griff), aufrecht stehen.',
    steps: [
      'Die Arme leicht gebeugt in einem Bogen nach außen hinten ziehen.',
      'Schulterblätter am Ende leicht zusammen.',
      'Langsam zurückführen.',
    ],
    breathing: PULL,
    mistakes: ['Mit dem Rücken schaukeln.', 'Ellbogen zu stark beugen.', 'Schultern hochziehen.'],
    tip: 'Leichtes Gewicht – die hintere Schulter braucht saubere Spannung, keine schweren Gewichte.',
  }),
  ex('mp-seitheben', 'Seitheben am Kabel (Side Lateral Raise)', 'eq-newtech-multi-pully', ['schulter_seitlich'], [], {
    unilateral: true,
    rest: 60,
    step: 2.5,
    setup: 'Arm auf die untere Rasthöhe, seitlich zum Kabel stehen, Griff mit der äußeren Hand fassen.',
    steps: [
      'Arm leicht gebeugt seitlich bis etwa Schulterhöhe heben.',
      'Oben kurz halten.',
      'Langsam absenken.',
    ],
    breathing: 'Beim Heben ausatmen, beim Absenken einatmen.',
    mistakes: ['Mit dem Körper schwingen.', 'Über Schulterhöhe heben.', 'Schulter hochziehen.'],
    tip: 'Das Kabel hält die Spannung auch unten – ein Vorteil gegenüber Kurzhanteln.',
  }),
  ex('mp-seitheben-vorgebeugt', 'Vorgebeugtes Seitheben (Bent Over Lateral Raise)', 'eq-newtech-multi-pully', ['schulter_hinten'], ['oberer_ruecken', 'schulter_seitlich'], {
    rest: 60,
    step: 2.5,
    setup: 'Arme auf untere Rasthöhe, Oberkörper stark vorgebeugt, Rücken gerade, Griff gekreuzt.',
    steps: [
      'Arme leicht gebeugt nach außen oben heben.',
      'Oben kurz halten.',
      'Langsam absenken.',
    ],
    breathing: 'Beim Heben ausatmen, beim Absenken einatmen.',
    mistakes: ['Rücken rund.', 'Mit Schwung arbeiten.', 'Zu schwer.'],
    tip: 'Die Vorbeuge hält die hintere Schulter in der Zugrichtung der Fasern.',
  }),
  ex('mp-bizepscurl-beidarmig', 'Bizepscurl beidarmig (Two Arm Biceps Curl)', 'eq-newtech-multi-pully', ['bizeps'], ['unterarm'], {
    rest: 60,
    step: 2.5,
    setup: 'Arme auf Kopfhöhe oder Rasthöhe, Griffe seitlich fassen, mittig stehen, Arme gestreckt zur Seite, Handflächen nach oben.',
    steps: [
      'Ellbogen beugen und die Hände zu den Ohren/Schultern führen.',
      'Oben fest anspannen („Doppelbizeps“-Pose).',
      'Langsam wieder strecken.',
    ],
    breathing: 'Beim Beugen ausatmen, beim Strecken einatmen.',
    mistakes: ['Ellbogen sinken ab.', 'Mit dem Körper nach vorn lehnen.', 'Zu schnell zurücklassen.'],
    tip: 'Die Ellbogen bleiben auf Schulterhöhe – nur die Unterarme bewegen sich.',
  }),
  ex('mp-bizepscurl-einarmig', 'Bizepscurl einarmig (Biceps Curl)', 'eq-newtech-multi-pully', ['bizeps'], ['unterarm'], {
    unilateral: true,
    rest: 60,
    step: 2.5,
    setup: 'Arm auf die untere Rasthöhe, seitlich stehen, Griff mit Untergriff.',
    steps: [
      'Ellbogen neben den Körper, Unterarm zur Schulter curlen.',
      'Oben kurz anspannen.',
      'Langsam ablassen.',
    ],
    breathing: 'Beim Hochcurlen ausatmen, beim Ablassen einatmen.',
    mistakes: ['Ellbogen nach vorn.', 'Schwung aus dem Körper.', 'Hand abknicken.'],
    tip: 'Einarmig fällt Ungleichgewicht auf – die schwächere Seite zuerst trainieren.',
  }),
  ex('mp-trizepsdruecken', 'Trizepsdrücken (Push Down)', 'eq-newtech-multi-pully', ['trizeps'], [], {
    rest: 60,
    step: 2.5,
    setup: 'Arme auf die obere Rasthöhe, Griff (Stange oder Seil) fassen, Oberarme eng am Körper, leicht vorgebeugt.',
    steps: [
      'Ellbogen fixieren und die Unterarme nach unten strecken.',
      'Unten den Trizeps fest anspannen.',
      'Langsam bis etwa 90° zurückkommen lassen.',
    ],
    breathing: 'Beim Drücken ausatmen, beim Zurückführen einatmen.',
    mistakes: ['Ellbogen vom Körper lösen.', 'Mit dem Oberkörper nachdrücken.', 'Zu schwer und mit Schwung.'],
    tip: 'Die Oberarme bleiben ruhig – nur die Unterarme arbeiten.',
  }),
  ex('mp-trizeps-ueberkopf', 'Trizepsstrecken über Kopf (Overhead Extension)', 'eq-newtech-multi-pully', ['trizeps'], ['schulter_vorn'], {
    rest: 60,
    step: 2.5,
    setup: 'Arme auf die untere Rasthöhe, Seil oder Stange hinter dem Kopf, mit dem Rücken zum Kabel stehen, Schrittstellung.',
    steps: [
      'Ellbogen zeigen nach vorn und bleiben nah am Kopf.',
      'Arme nach vorn oben strecken.',
      'Langsam wieder hinter den Kopf zurückführen.',
    ],
    breathing: 'Beim Strecken ausatmen, beim Zurückführen einatmen.',
    mistakes: ['Ellbogen weichen nach außen aus.', 'Hohlkreuz.', 'Zu schwer.'],
    tip: 'Der lange Trizepskopf wird hier besonders gedehnt – ideal für den Muskelaufbau.',
  }),
  ex('mp-klimmzug', 'Klimmzüge (Multi Pully, verschiedene Griffe)', 'eq-newtech-multi-pully', ['latissimus'], ['bizeps', 'oberer_ruecken', 'unterarm'], {
    t: 'koerpergewicht_wdh',
    rest: 120,
    step: 2.5,
    setup: 'Die Klimmzugstange hat mehrere Griffpositionen (Obergriff, Neutralgriff, Untergriff). Frei hängen, Schulterblätter leicht nach unten.',
    steps: [
      'Zuerst die Schulterblätter nach unten ziehen, dann Ellbogen Richtung Hüften führen.',
      'Kinn über die Griffe ziehen.',
      'Kontrolliert ganz hinunter lassen.',
    ],
    breathing: 'Beim Hochziehen ausatmen, beim Ablassen einatmen.',
    mistakes: ['Mit Schwung (Kippen) arbeiten.', 'Nur halbe Bewegung.', 'Schultern bleiben oben an den Ohren.'],
    tip: 'Neutraler Griff (Handflächen zueinander) ist oft am schulterfreundlichsten.',
  }),
  ex('mp-face-pull', 'Face Pulls (Multi Pully)', 'eq-newtech-multi-pully', ['schulter_hinten', 'oberer_ruecken'], ['schulter_seitlich'], {
    rest: 60,
    step: 2.5,
    setup: 'Arme auf Gesichtshöhe (oder darüber), Seilgriffe fassen, einen Schritt zurück.',
    steps: [
      'Seil in Richtung Gesicht ziehen, Ellbogen hoch und nach außen.',
      'Hände neben den Ohren, Schulterblätter zusammen.',
      'Kontrolliert strecken.',
    ],
    breathing: PULL,
    mistakes: ['Zu viel Gewicht, Rücken im Hohlkreuz.', 'Ellbogen sinken ab.', 'Mit Schwung.'],
    tip: 'Leichtes Gewicht, viele Wiederholungen – gut für gesunde Schultern.',
  }),

  // ------------------------------------------------------------ SCHNELL Bizepsmaschine
  ex('schnell-scott-curl', 'Scott-Curl (SCHNELL Bizepsmaschine)', 'eq-schnell-bizeps', ['bizeps'], ['unterarm'], {
    rest: 75,
    step: 2.5,
    setup: 'Sitzhöhe so einstellen, dass die Oberarme bis zu den Achseln flach auf dem schrägen Polster liegen. Hantelscheiben auf den Hebelarm stecken und sichern.',
    steps: [
      'Griffe im Untergriff fassen, Oberarme fest auf dem Polster.',
      'Die Unterarme nach oben curlen, bis der Bizeps maximal gespannt ist.',
      'Langsam (etwa 3 Sekunden) strecken, aber nicht ganz durchdrücken.',
    ],
    breathing: 'Beim Hochcurlen ausatmen, beim Strecken einatmen.',
    mistakes: ['Schultern vom Polster heben.', 'Unten die Arme zu ruckartig durchstrecken (Ellbogenbelastung).', 'Mit dem Oberkörper schwingen.'],
    tip: 'Das Polster verhindert Schummeln – nimm lieber etwas weniger Gewicht und kontrolliere den Weg nach unten.',
  }),

  // ------------------------------------------------------------ Gymleco Biceps Curl
  ex('gymleco-biceps-curl', 'Bizepscurl (Gymleco Biceps Curl)', 'eq-gymleco-biceps-curl', ['bizeps'], ['unterarm'], {
    rest: 75,
    step: 5,
    setup:
      'Sitz so einstellen, dass die Arme im gleichen Winkel wie die Armpolster liegen. Das Brustpolster so einstellen, dass die Ellbogen auf Höhe der Drehachse der Bewegungsarme sind.',
    steps: [
      'Brust gegen das Polster, Oberarme auf den Armpolstern, Griffe im Untergriff.',
      'Die Gewichte kontrolliert nach oben ziehen, bis die Beugung vollständig ist.',
      'Langsam wieder in die Startposition lassen.',
    ],
    breathing: 'Beim Hochziehen ausatmen, beim Ablassen einatmen.',
    mistakes: ['Ellbogen vom Polster lösen.', 'Schwungvoll aus dem Rücken arbeiten.', 'Gewicht ablegen statt Spannung halten.'],
    tip: 'Du kannst auch einarmig im Wechsel trainieren – das gleicht Kraftunterschiede aus. (Hinweis vom Gerät: Zum Aufwärmen leichte Gewichte nehmen.)',
  }),

  // ------------------------------------------------------------ Pec Dec Fly
  ex('pec-dec-fly', 'Butterfly (NEWTECH Pec Dec Fly)', 'eq-newtech-pec-dec-fly', ['brust'], ['schulter_vorn'], {
    rest: 75,
    step: 2.5,
    setup: 'Sitzhöhe so einstellen, dass Ellbogen/Unterarme auf Brusthöhe liegen. Rücken an die Lehne, Schulterblätter zurück. Hantelscheiben auf den Hebel stecken.',
    steps: [
      'Arme (Polster bzw. Griffe) fassen, Ellbogen leicht gebeugt.',
      'Die Arme vor der Brust zusammenführen und die Brust anspannen.',
      'Langsam öffnen, bis die Brust gedehnt ist, aber nicht überdehnen.',
    ],
    breathing: 'Beim Zusammenführen ausatmen, beim Öffnen einatmen.',
    mistakes: ['Zu weit nach hinten öffnen.', 'Schultern hochziehen.', 'Gewicht zurückfallen lassen.'],
    tip: 'Beim Auflegen der Scheiben auf gleichmäßige Beladung achten.',
  }),

  // ------------------------------------------------------------ Seitheben-Maschine (einarmig)
  ex('seitheben-maschine', 'Seitheben an der Maschine', 'eq-newtech-seitheben-maschine', ['schulter_seitlich'], ['schulter_vorn', 'oberer_ruecken'], {
    unilateral: true,
    rest: 60,
    step: 5,
    setup:
      'Plattformhöhe so wählen, dass das Schultergelenk auf Höhe der Drehachse des Schwenkarms liegt. Den Stift am Gerät auf die Seite stecken, die trainiert wird (er wird in die Richtung gesetzt, in die du trainieren willst). Gewicht am Block mit dem Stift wählen.',
    steps: [
      'Aufrecht auf die Plattform stellen, mit der Hand am Gerät festhalten, den trainierenden Arm gegen das Armpolster des Schwenkarms legen.',
      'Den Arm kontrolliert seitlich bis etwa Schulterhöhe heben – der Ellbogen führt, die Schulter bleibt unten.',
      'Oben kurz halten, dann langsam (etwa 3 Sekunden) wieder ablassen. Danach die Seite wechseln.',
    ],
    breathing: 'Beim Heben ausatmen, beim Ablassen einatmen.',
    mistakes: ['Schwung aus dem Rumpf holen oder seitlich zur Seite lehnen.', 'Über Schulterhöhe heben und die Schulter hochziehen.', 'Das Gewicht zu schnell ablassen oder fallen lassen.'],
    tip: 'Wiederholungen zählen je Seite. Beginne mit der schwächeren Seite und halte auf beiden Seiten dieselbe Wiederholungszahl.',
  }),
];

/** Alle Studio-Geräte: erste Lieferung (hier) plus dritte Lieferung (studio-lieferung3.ts). */
export const STUDIO_GERAETE: CatalogEquipment[] = [...STUDIO_GERAETE_1, ...LIEFERUNG3_GERAETE];
export const STUDIO_UEBUNGEN: CatalogExercise[] = [...STUDIO_UEBUNGEN_1, ...LIEFERUNG3_UEBUNGEN];
