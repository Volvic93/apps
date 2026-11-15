# Gym-App – Konzept

Arbeitstitel: **Eisenzeit** (frei änderbar). Persönliche Trainings-App für ein bestimmtes Fitnessstudio, ein Nutzer, kein Store-Release.

Stand: 15.11.2026 · Status: Konzept vom Nutzer freigegeben, **Stufen 1 bis 4 umgesetzt** (Details und Abweichungen in Abschnitt 13, 15, 17; Prüfschleife Stufe 2–4 in Abschnitt 19; Feinschliff Abschnitt 20; Bewegungsbild mit mehreren Positionen Abschnitt 21; Abschnitt 22 Abschlussrunde; v0.4.0: Abschnitt 23; v0.5/0.6: Abschnitt 24)

---

## 1. Entscheidungen (mit dem Nutzer geklärt)

| Thema | Entscheidung |
|---|---|
| Plattform | **Zwei Ausgaben aus einem Code**: Web-App (PWA) **und** iOS-App als `.ipa` zum Sideloading (Sideloadly / AltStore). Im Kern gleicher Funktionsumfang, parallel entwickelt; Ausnahmen, die nur die iPhone-App kann (Vibration, Mitteilungen/Erinnerungen, automatische Sicherung in „Dateien“, Live-Aktivität), stehen in Abschnitt 24. |
| Daten | Nur lokal auf dem Gerät, kein Konto, kein Server. Sicherung über Export-/Import-Datei. |
| Plan-Hilfe | Eingebauter regelbasierter Assistent **und** KI-Export (Text für Claude o. ä.) **mit Rück-Import** des fertigen Plans. |
| Geräte/Fotos | Start mit allgemeinem Katalog. Fotos können in der App selbst aufgenommen werden. Gelieferte Fotos werden **erkannt** (Hersteller, Modell, Gerätetyp), als Gerät mit Namen, Übungen und **Gerätegrafik** angelegt und fest eingebaut. Fotos kommen nach und nach – siehe Abschnitt 4a. |
| Umfang | Gerätetraining, Freihanteln & Körpergewicht, Cardio, Körperwerte, Pausentimer. |
| Hosting Web-Version | (Überholt, siehe Abschnitt 18: GitHub Pages.) Vorerst keins – Web-Version läuft lokal am PC. Aufs iPhone kommt zunächst die Sideloading-Version. Hosting später entscheidbar (Cloudflare Pages oder öffentliches Repo + GitHub Pages). |
| Ablage | Eigenes Repository `Volvic93/apps` (öffentlich), Ordner `gym-app/` mit den Unterordnern `webapp/` (die App) und `ipa-app/` (iOS-Hülle). Vorher Unterordner im Repo `Volvic93/3d-druckdateien`, Branch `gym-app` (siehe Abschnitt 18). |
| Sprache | Oberfläche und Übungstexte auf Deutsch, Einheiten kg / km. |

---

## 2. Leitgedanken

1. **Im Studio zählt eine Hand und drei Sekunden.** Einen Satz eintragen = ein Tipp. Werte vom letzten Mal sind vorausgefüllt.
2. **Es geht nie etwas verloren.** Jeder Satz wird sofort gespeichert; App schließen, Anruf, leerer Akku – das Training ist beim Öffnen noch da.
3. **Dein Studio, nicht irgendeins.** Geräte heißen so wie bei dir, zeigen dein Foto und deine Einstellungen (Sitzhöhe, Polsterposition).
4. **Empfehlungen sind begründet.** Jeder Hinweis hat ein „Warum?" mit den Zahlen dahinter. Nichts passiert automatisch – die App schlägt vor, du entscheidest.
5. **Offline zuerst.** Keine Funktion braucht Internet.

---

## 3. Aufbau der App

Fünf Reiter unten (Tab-Leiste). **Gestaltung:** nach Apples Human Interface Guidelines – Systemschrift, Inset-Grouped-Listen, Standard-Tab-Leiste, Tippflächen mindestens 44 pt, Safe-Area-Abstände; Farben: seit v0.4.0 die Kraftkultur-Palette (Abschnitt 23); früher ausschließlich Apples Systemfarben mit Systemblau als Akzent (überholt). Dunkel ist voreingestellt, Hell läuft sauber mit (Einstellungen → Darstellung: Dunkel · System · Hell).

### 3.1 Heute
- Aktiver Plan mit Fortschritt („Woche 5 von 8").
- **Nächste Einheit** als großer Startknopf (die App schlägt die Einheit vor, die am längsten zurückliegt; andere wählbar; „Freies Training" ohne Plan möglich).
- Wochenübersicht: trainierte Tage, Einheiten diese Woche.
- Hinweiskarten (siehe 6. Empfehlungen), höchstens zwei gleichzeitig.

### 3.2 Training (Trainingsmodus – das Herzstück)
Wird aus „Heute" gestartet und füllt den ganzen Bildschirm.

- Eine Übung pro Karte: Gerätefoto, Name, deine Geräteeinstellung, „Letztes Mal: 3 × 10 @ 40 kg", Ziel für heute.
- Satzzeilen sind mit den Werten vom letzten Mal vorbelegt. Gewicht und Wiederholungen über große +/−-Tasten (Schrittweite je Übung, z. B. 2,5 kg oder 5 kg) oder Direkteingabe.
- Haken setzen = Satz gespeichert → **Pausentimer** startet automatisch (Länge je Übung, Signal + Vibration am Ende, überspringbar, +30 s).
- Satzarten: Aufwärmsatz, normaler Satz, Reduktionssatz. Aufwärmsätze zählen nicht in Statistik und Rekorde.
- Sätze hinzufügen/entfernen, Übung überspringen, Reihenfolge ändern, Notiz zur Übung.
- **„Gerät besetzt"**: schlägt Alternativen für dieselbe Muskelgruppe vor und tauscht nur für heute.
- Sofortiges Feedback bei persönlichem Rekord.
- Bildschirm bleibt während des Trainings an.
- Abschluss: Zusammenfassung mit Dauer, bewegtem Gesamtgewicht, Rekorden und Vergleich zur letzten gleichen Einheit.
- Cardio-Übungen: statt Sätzen Dauer, Distanz, Stufe/Steigung, optional Puls.

### 3.3 Pläne
- Liste: aktiver Plan, weitere Pläne, Archiv.
- **Plan** = Name, Ziel, Laufzeit in Wochen, mehrere **Einheiten** (z. B. „Push", „Pull", „Beine").
- **Einheit** = geordnete Liste von Übungen mit Satzzahl, Wiederholungsbereich (z. B. 8–12), Pausenlänge, optional Zielgewicht, optional Supersatz-Kopplung.
- **Kombinieren**: Einheiten sind Bausteine. Man kann
  - eine Einheit aus einem anderen Plan in den aktuellen kopieren,
  - zwei Pläne zu einem neuen zusammenführen (Einheiten auswählen, Reihenfolge festlegen),
  - einen Plan duplizieren und abwandeln,
  - einzelne Übungen zwischen Einheiten verschieben.
- **Plan-Assistent** und **KI-Export/-Import** (siehe 7. und 8.).
- Plan als Datei exportieren/importieren.

### 3.4 Übungen & Geräte
- Katalog mit Suche und Filtern (Muskelgruppe, Gerätetyp, „nur in meinem Studio").
- **Gerät**: Name (umbenennbar auf Studio-Bezeichnung), Typ, Foto, Standort-/Nummernnotiz, **Einstellpunkte mit Skala und eigenem Wert** (z. B. Sitz 4 von 7), **Gewichtsstufen** (z. B. 5–100 kg in 5er-Schritten), „nicht in meinem Studio" (ausblenden).
- **Übung** (gehört zu einem Gerät oder ist frei): 
  - Foto des Geräts,
  - **Muskelgrafik** (Körper von vorn und hinten, Hauptmuskeln kräftig, Hilfsmuskeln schwach eingefärbt),
  - Anleitung in festen Abschnitten: *Einstellung · Ausführung (Schritt für Schritt) · Atmung · Häufige Fehler · Tipp*,
  - eigene Notizen,
  - Verlauf und Rekorde dieser Übung.
- Eigene Geräte und Übungen anlegen, Foto direkt mit der iPhone-Kamera aufnehmen oder aus der Mediathek wählen.
- **Bewegungsbild** (spätere Ausbaustufe): (inzwischen 2–6 Positionen, siehe Abschnitt 21) zwei eigene Fotos je Übung (Start- und Endposition), die die App als Wechselbild abspielt. Das ist die realistische Form von „Animation" – gezeichnete Bewegungsanimationen aus Gerätefotos zu erzeugen, wäre aufwendig und qualitativ unsicher.

### 3.5 Fortschritt
- **Je Übung**: Kurven für Höchstgewicht, geschätzte Maximalkraft (1RM nach Epley: Gewicht × (1 + Wdh/30)), Volumen je Einheit; Zeitraum wählbar; Rekordliste.
- **Je Muskelgruppe**: Sätze pro Woche (zeigt Lücken und Übergewichtungen).
- **Gesamt**: Trainingskalender, Einheiten pro Woche, Gesamtvolumen pro Woche, Trainingsdauer.
- **Planvergleich**: Start- und Endwerte der Hauptübungen je Plan – „Was hat dieser Plan gebracht?".
- **Körperwerte**: Körpergewicht und optional Umfänge (Brust, Oberarm, Taille, Hüfte, Oberschenkel) mit Verlaufskurve.
- Trainingsverlauf: jede vergangene Einheit einsehbar und nachträglich korrigierbar.

### 3.6 Einstellungen (über Zahnrad in „Heute")
- Sicherung: Export / Import (siehe 9.), Erinnerung an regelmäßige Sicherung.
- Standard-Pausenlänge, Schrittweiten, Planlaufzeit für die Wechselempfehlung, Signalton/Vibration.
- Profil für den Assistenten: Ziel, Erfahrung, Trainingstage.
- App-Version, Lizenzhinweise.

---

## 4. Datenmodell

Speicher: IndexedDB. Alle Datensätze mit `id` (UUID), `createdAt`, `updatedAt`. Schema-Version wird mitgeführt, Migrationen bei Änderungen.

```
Equipment      id, name, brand?, model?, studioNumber?,
               kind (maschine | kabelzug | freihantel | koerpergewicht | cardio),
               loading (gewichtsblock | scheiben | frei | keins), pictogram (Gerätekategorie),
               weightStack? { minKg, maxKg, stepKg },
               adjustments[] { id, label, min, max, myValue?, photoId? },
               photoId? | builtinPhoto?, location?, settingsNote?, hidden, builtin
Exercise       id, name, equipmentId?, primaryMuscles[], secondaryMuscles[],
               tracking (gewicht_wdh | koerpergewicht_wdh | zeit | cardio),
               instructions { setup, steps[], breathing, mistakes[], tip },
               defaultRestSec, weightStep (nur ohne weightStack am Gerät),
               adjustmentOverrides? { adjustmentId: Wert }, notes?, motionPhotoIds?[2–6], hidden, builtin
Plan           id, name, goal, plannedWeeks, startedAt?, endedAt?, status (entwurf | aktiv | archiv),
               origin (manuell | assistent | ki_import), workouts[]
  Workout      id, name, items[]
    Item       exerciseId, sets, repMin, repMax, restSec, targetWeight?, supersetGroup?, note?
Session        id, planId?, workoutId?, workoutName, startedAt, endedAt?, note?, entries[]
  Entry        exerciseId, substitutedFor?, note?, sets[]
    Set        kind (aufwaermen | normal | reduktion), weight?, reps?, durationSec?,
               distanceKm?, level?, doneAt
BodyMetric     id, date, weightKg?, chest?, arm?, waist?, hip?, thigh?
Photo          id, blob (JPEG, längste Kante max. 1280 px), createdAt
Settings       ein Datensatz: Profil, Standardwerte, abgewiesene Hinweise, letzte Sicherung
```

Muskelgruppen (feste Liste): Brust, oberer Rücken, Latissimus, unterer Rücken, vordere/seitliche/hintere Schulter, Bizeps, Trizeps, Unterarm, Bauch, schräge Bauchmuskeln, Gesäß, Quadrizeps, Beinbeuger, Adduktoren, Abduktoren, Waden.

Mitgelieferte Katalogeinträge (`builtin`) werden bei App-Updates aktualisiert, ohne eigene Änderungen (Name, Foto, Notizen, ausgeblendet) zu überschreiben.

**Startkatalog**: rund 70 Übungen – gängige Studiomaschinen (Brustpresse, Butterfly, Schulterpresse, Latzug, Rudermaschine, Beinpresse, Beinstrecker, Beinbeuger, Adduktor, Abduktor, Wadenmaschine, Bauchmaschine, Rückenstrecker, Klimmzug-/Dip-Hilfe, Multipresse), Kabelzugübungen, Lang- und Kurzhantelübungen, Eigengewichtsübungen, Cardiogeräte (Laufband, Crosstrainer, Ergometer, Rudergerät, Stepper).

---

## 4a. Geräte aus Fotos erfassen

Fotos kommen in Schüben. Der Ablauf ist deshalb ein wiederholbarer Arbeitsgang, kein einmaliger Schritt.

**Ablauf je Lieferung**
1. Originale landen unverändert in `geraete-fotos/eingang/` (Dateiname: Datum, laufende Nummer, vorläufiger Name).
2. **Erkennen**: aus Beschriftung, Herstellerlogo, Bauform und Hinweisschildern werden Hersteller, Modell, Gerätetyp, Belastungsart (Gewichtsblock / Scheiben) und die damit möglichen Übungen bestimmt. Mehrere Fotos desselben Geräts werden zusammengefasst. Unsichere Zuordnungen werden als „bitte bestätigen" markiert und nicht stillschweigend übernommen.
3. **Aufbereiten**: Foto aufs Gerät zuschneiden (Personen im Hintergrund möglichst wegschneiden), auf max. 1280 px verkleinern, nach `public/geraete/<kennung>.jpg` legen.
4. **Katalogeintrag** in `src/data/studio-geraete.ts`: Gerät mit Namen, Hersteller, Modell, Studio-Nummer (falls ein Nummernschild sichtbar ist), zugehörigen Übungen samt Anleitung und Muskelgruppen.
5. Erledigte Originale wandern nach `geraete-fotos/verarbeitet/`; die Tabelle unten wird fortgeschrieben.

**Gerätegrafik mit Namen** – jedes Gerät erscheint in der App als einheitliche **Gerätekarte**:
- zugeschnittenes Foto,
- Namensband mit Gerätename, Hersteller und ggf. Studio-Nummer,
- Kennzeichnung der Hauptmuskelgruppe (Farbe + kleine Muskelgrafik),
- **Piktogramm der Gerätekategorie** (einheitlicher Strichzeichnungs-Satz, z. B. Kabelzug, Curl-Maschine, Beinpresse, Latzug, Hantelbank) für Listen und Pläne, wo das Foto zu klein wäre.

Die Karte wird von der App aus Foto + Daten zusammengesetzt, nicht als fertiges Bild gespeichert – so bleibt der Name änderbar und die Darstellung überall gleich. Geräte ohne Foto zeigen nur das Piktogramm.

Erkennung findet beim Einbau statt (durch Claude anhand der gelieferten Fotos). In der App selbst – offline, ohne KI – wird ein neu fotografiertes Gerät von Hand benannt und einer Kategorie zugeordnet.

**Erste Lieferung (14.11.2026)**

| Foto | Erkannt als | Hersteller / Modell | Belastung | Übungen | Sicherheit |
|---|---|---|---|---|---|
| 01 (+ 09 Übungstafel) | **Doppel-Kabelzug mit Klimmzugstange** („Multi Pully") | NEWTECH, Multi Pully | 2 Gewichtsblöcke, schwenkbare Arme | Laut Herstellertafel: Cross Over, Brustdrücken am Kabel, vorgebeugtes Rudern, Überzug, Schulterdrücken, Reverse Fly, Seitheben, vorgebeugtes Seitheben, Bizepscurl beidarmig, Bizepscurl einarmig, Trizepsdrücken (Push Down), Trizepsstrecken über Kopf. Zusätzlich: Klimmzüge (verschiedene Griffe), Face Pulls | sicher (Schild lesbar) |
| 02 + 04 | **Bizepsmaschine (Scott-Curl), scheibenbeladen** | SCHNELL | Hantelscheiben am Hebelarm | Scott-Curl an der Maschine | vom Nutzer bestätigt: Bizeps, 02 und 04 zeigen dasselbe Gerät |
| 03 | **Bizeps-Curl-Maschine sitzend** | Gymleco, Active Line 350 „Biceps Curl" | Gewichtsblock | Bizepscurl an der Maschine (beidarmig / einarmig) | sicher (Schild lesbar) |

**Zweite Lieferung (14.11.2026)**

| Foto | Erkannt als | Hersteller / Modell | Belastung | Übungen / Nutzen | Sicherheit |
|---|---|---|---|---|---|
| 05 | **Seitheben-Maschine (stehend)** – Standplattform höhenverstellbar, hoher Turm mit Gewichtsblock, Schwenkarm mit Armpolster, Stift wählt die Richtung/Seite (vom Nutzer als „Maschine für die Schulter, einarmig schwingend“ beschrieben, per Vergleichsbild bestätigt) | NEWTECH (Olympia-/IFBB-Serie) | Gewichtsblock | Seitheben an der Maschine – einarmig (Merkmal „einseitig“, Wiederholungen je Seite) | bestätigt; Gerät nur im Anschnitt zu sehen, Gesamtfoto folgt ggf. (**frühere Erkennung als „Multi-Hip“ war falsch** und ist entfernt) |
| 06 | Detail zu 05: **Skala der Standplattform, Positionen 1–16** | – | – | Einstellpunkt „Plattformhöhe 1–16“ am Seitheben-Gerät | sicher |
| 07 | **Butterfly / Pec Deck, scheibenbeladen** | NEWTECH, M-Torture „Pec Dec Fly" | Hantelscheiben, Seilzug-Umlenkung | Butterfly (Brust) | sicher (Schild lesbar) |
| 08 | Detail: **Polster-/Sitzverstellung mit grüner Skala 1–7** | unbekannt (grauer Rahmen, grüne Einstellknöpfe) | – | Einstellpunkt „Position 1–7“ | **zurückgestellt – weitere Fotos folgen** (keinem Gerät zugeordnet, Original bleibt in `eingang/`) |
| 09 | Übungstafel zum Multi Pully (Gerät 01) | NEWTECH | – | 12 Übungen, oben bei Gerät 01 eingetragen | sicher |
| 10 | Detail: **Gewichtsblock 5–100 kg in 5-kg-Schritten** | NEWTECH | – | Gewichtsstufen des Seitheben-Geräts (05) | bestätigt (Nutzer: gehört zu Gerät 05) |

Das zweite Pec-Deck-Foto war dasselbe Bild in kleinerer Auflösung und wurde nicht übernommen.

**Folgerung aus den Detailfotos** – Einstellungen und Gewichtsstufen werden nicht als freier Notiztext, sondern strukturiert geführt (siehe Datenmodell):
- **Einstellpunkte je Gerät**: Bezeichnung + Skala (z. B. „Plattformhöhe 1–16", „Sitz 1–7"), dazu dein persönlicher Wert. Der Trainingsmodus zeigt sie auf der Übungskarte („Plattform 9 · Sitz 4"), damit du nicht jedes Mal neu suchst. Ein Detailfoto der Skala kann hinterlegt werden.
- **Gewichtsstufen je Gerät**: Minimum, Maximum, Schrittweite (z. B. 5–100 kg in 5er-Schritten). Die +/−-Tasten springen genau in diesen Stufen, und Steigerungsvorschläge schlagen nur Gewichte vor, die es am Gerät wirklich gibt.
- Bei Mehrzweckgeräten (Kabelzug) können Einstellwerte je Übung abweichen (z. B. Armhöhe beim Cross Over anders als beim Push Down).

Beobachtung: Im Studio hängen Nummernschilder an Geräten (im Hintergrund z. B. „11 – Hinterer Oberschenkel sitzend"). Wo sichtbar, wird die Nummer als `studioNumber` übernommen.

---

## 5. Steigerungslogik im Training

Doppelte Progression, je Übung:

- Alle normalen Sätze erreichen die obere Wiederholungsgrenze → beim nächsten Mal **Gewicht + Schrittweite**, Ziel untere Grenze.
- Wiederholungen liegen im Bereich → **gleiches Gewicht**, Ziel: eine Wiederholung mehr.
- Zwei Einheiten in Folge unter der unteren Grenze → Vorschlag **Gewicht reduzieren**.
- Nach Trainingspause von mehr als 14 Tagen → Vorschlag, mit etwa 10 % weniger einzusteigen.

Der Vorschlag steht als „Ziel für heute" auf der Übungskarte und ist immer überschreibbar.

---

## 6. Empfehlungen

Jede Empfehlung ist eine Karte mit Begründung, „Jetzt angehen" und „Später" (kommt nach einer Woche wieder) bzw. „Nicht mehr zeigen".

| Auslöser | Empfehlung |
|---|---|
| Plan hat die geplante Laufzeit erreicht (Standard 8 Wochen, einstellbar 4–16) | Neuen Plan erstellen – öffnet den Assistenten mit dem bisherigen Verlauf |
| Eine Woche vor Ablauf | Vorankündigung |
| Übung seit 3 Einheiten ohne Steigerung (weder Gewicht noch Wiederholungen) | Übung variieren, Wiederholungsbereich ändern oder Entlastungswoche |
| Mehrere Übungen stagnieren gleichzeitig | Entlastungswoche (Gewichte −40 %, eine Woche) |
| Muskelgruppe über 2 Wochen deutlich unter den anderen (Sätze pro Woche) | Übung ergänzen |
| Mehr als 10 Tage kein Training | Sanfter Wiedereinstieg |
| Länger als 30 Tage keine Sicherung | Sicherung anlegen |

---

## 7. Plan-Assistent (eingebaut, ohne Internet)

**Abfrage** (4–5 Schritte, vorbelegt aus dem Profil):
1. Ziel: Muskelaufbau · Kraft · allgemeine Fitness / Fettabbau
2. Trainingstage pro Woche: 2–6
3. Zeit pro Einheit: 45 · 60 · 90 Minuten
4. Schwerpunkte (optional) und auszuschließende Übungen/Geräte (z. B. bei Beschwerden)
5. Laufzeit in Wochen

**Erzeugung**:
- Aufteilung nach Tagen: 2–3 → Ganzkörper (A/B) · 4 → Oberkörper/Unterkörper · 5 → Push/Pull/Beine + Oberkörper + Unterkörper · 6 → Push/Pull/Beine zweimal.
- Jede Einheit besteht aus **Rollen** (z. B. „Drücken waagerecht – Grundübung", „Ziehen senkrecht", „Kniedominant", „Isolation Bizeps"). Je Rolle wählt die App eine passende Übung aus den Geräten, die im Studio vorhanden sind.
- Satz- und Wiederholungsschema nach Ziel (Kraft 4–6, Muskelaufbau 8–12, Fitness 12–15), Anzahl der Übungen nach verfügbarer Zeit.
- **Bezug auf den Verlauf**: stagnierende Übungen werden durch eine Variante derselben Rolle ersetzt, gut laufende Grundübungen bleiben; bei jedem neuen Plan wird ein Teil der Nebenübungen gewechselt; Startgewichte werden aus der geschätzten Maximalkraft abgeleitet.

**Ergebnis**: Vorschau mit kurzer Begründung je Einheit, jede Übung austauschbar, dann als Entwurf speichern oder direkt aktivieren.

---

## 8. KI-Export und Rück-Import

*(Seit v0.4.0 ersetzt durch den KI-Austausch per Markdown-Datei mit drei Auftragsarten, siehe Abschnitt 23; die Beschreibung unten gilt für den Kern weiter.)*

**Export** („Mit KI planen"): Die App erzeugt einen Text zum Kopieren/Teilen, bestehend aus
- einer fertigen Aufgabenstellung für die KI,
- Profil und Ziel,
- der Liste der im Studio vorhandenen Übungen mit ihren Kennungen,
- dem bisherigen Plan und einer Verlaufszusammenfassung (Start-/Endwerte je Übung, Stagnationen, Trainingshäufigkeit, Sätze je Muskelgruppe),
- der genauen Beschreibung des Antwortformats.

**Antwortformat** (`eisenzeit-plan`, Version 1, JSON):
```json
{
  "format": "eisenzeit-plan", "version": 1,
  "name": "…", "goal": "…", "plannedWeeks": 8,
  "workouts": [
    { "name": "Push",
      "items": [ { "exercise": "<Kennung oder Name>", "sets": 3, "repMin": 8, "repMax": 12,
                   "restSec": 90, "targetWeight": 40, "note": "…" } ] }
  ],
  "explanation": "Begründung der KI in Textform"
}
```

**Import**: Antwort einfügen (oder Datei wählen) → die App findet den JSON-Block auch in umgebendem Text, prüft ihn, ordnet Übungen zu (Kennung → genauer Name → ähnlicher Name mit Rückfrage → „neu anlegen") und zeigt eine Vorschau samt Begründung. Erst nach Bestätigung wird der Plan gespeichert. Fehlerhafte Eingaben werden mit verständlicher Meldung abgelehnt, nie halb importiert.

Dasselbe Format dient auch dem normalen Plan-Export/-Import.

---

## 9. Sicherung und Geräteübergreifendes

- **Export**: eine Datei `eisenzeit-sicherung-JJJJ-MM-TT.json` mit allen Daten; Fotos wahlweise enthalten. Auf dem iPhone über den Teilen-Dialog (in „Dateien"/iCloud Drive ablegen), im Browser als Download.
- **Import**: Datei wählen → Vorschau (Anzahl Pläne, Einheiten, Zeitraum) → „Ersetzen" oder „Zusammenführen".
- **Wichtig**: Web-Version und Sideloading-Version haben getrennte Datenspeicher. Wer wechselt, überträgt die Daten per Sicherungsdatei.
- In der Web-Version wird dauerhafter Speicher beim Browser angefordert, damit Daten nicht automatisch geräumt werden.

---

## 10. Technik

**Ein Code, zwei Ausgaben.**

| Baustein | Wahl | Grund |
|---|---|---|
| Sprache / Oberfläche | TypeScript, React, Vite | verbreitet, gut wartbar |
| Navigation | React Router mit Hash-Routing | funktioniert identisch im Browser und in der iOS-Hülle |
| Speicher | IndexedDB über Dexie | offline, ausreichend groß, Migrationen |
| Diagramme | schlanke Diagrammbibliothek oder eigenes SVG | wenig Ballast |
| Gestaltung | (Farben seit v0.4.0 überholt, siehe Abschnitt 23) eigenes CSS mit Apple-Systemfarben als Variablen (Dunkel Standard, Hell/System wählbar), Systemschrift, Safe-Area-Abstände fürs iPhone | iOS-typisches Aussehen, volle Kontrolle; keine eigene Markenpalette |
| Web-Ausgabe | PWA (Manifest, Service Worker über `vite-plugin-pwa`) | installierbar, offline |
| iOS-Ausgabe | Capacitor-Hülle um denselben Build | echte App ohne zweiten Code |
| Tests | Vitest für Logik (Progression, Assistent, Import-Prüfung, Migrationen) | die fehleranfälligen Teile |

**Plattform-Schicht**: Alles Gerätenahe läuft über eine kleine Schnittstelle `platform/` mit zwei Umsetzungen (Web / Capacitor): Kamera/Fotoauswahl, Datei teilen/speichern, Vibration, Signal bei Timerende (auf iOS als lokale Mitteilung, damit es auch bei gesperrtem Bildschirm kommt), Bildschirm wachhalten. So bleibt der Funktionsumfang beider Ausgaben im Kern gleich; was nur die iPhone-App kann (Vibration, Mitteilungen, Auto-Sicherung, Live-Aktivität), meldet die Schnittstelle als „nicht verfügbar“ und die Oberfläche weist darauf hin.

**iOS-Build ohne Mac**: GitHub Actions auf einem macOS-Runner baut eine **unsignierte `.ipa`**; Sideloadly bzw. AltStore signiert sie beim Aufspielen mit der eigenen Apple-ID.
- Ablauf: Abhängigkeiten installieren → Web-Build → iOS-Projekt erzeugen/synchronisieren (Capacitor) → `xcodebuild archive` mit abgeschalteter Signierung → `.app` in `Payload/` packen → als `.ipa` zippen → als Download am Workflow-Lauf bereitstellen.
- Auslöser: **nur von Hand** (und bei Versions-Tags), nicht bei jedem Push. Grund (damals; das Repo ist inzwischen öffentlich, siehe Abschnitt 18): Das Repo ist privat; macOS-Minuten werden im Freikontingent zehnfach gezählt (grob 20 Builds pro Monat).
- Die Workflow-Datei muss im Repo-Stamm unter `.github/workflows/` liegen und arbeitet im Unterordner `gym-app/`.
- Feste Bundle-Kennung, damit Daten bei Updates und beim Neusignieren erhalten bleiben.
- Der Umsetzer prüft die aktuellen Capacitor- und Xcode-Befehle gegen die offizielle Dokumentation, statt sie aus dem Gedächtnis zu übernehmen.

**Grenzen, die man kennen sollte**
- Kostenlose Apple-ID: sideloaded Apps laufen **7 Tage** und müssen dann aufgefrischt werden (AltStore/Sideloadly können das automatisch, wenn PC und iPhone im selben WLAN sind). Die Daten bleiben dabei erhalten, solange die App nicht gelöscht wird.
- (Überholt, siehe Abschnitt 18.) Ohne Hosting ist die Web-Version nur am PC nutzbar; aufs iPhone als PWA kommt sie erst mit einer HTTPS-Adresse.
- Die iOS-Ausgabe kann hier nicht auf einem echten iPhone getestet werden. Geprüft wird im Browser in iPhone-Größe und durch den erfolgreichen Build; die erste Installation ist der eigentliche Gerätetest.

**Ordnerstruktur**
```
3d-druckdateien/   (überholt – seit Abschnitt 18 liegt alles in `apps/gym-app/`)
├─ .github/workflows/gym-app-ios.yml      (einzige Datei außerhalb des Unterordners)
└─ gym-app/
   ├─ KONZEPT.md, README.md
   ├─ package.json, vite.config.ts, capacitor.config.ts
   ├─ geraete-fotos/     eingang/ (Originale, neu) · verarbeitet/ (Originale, erledigt)
   ├─ public/            Icons, Manifest, geraete/ (zugeschnittene, fest eingebaute Gerätefotos)
   ├─ src/
   │  ├─ data/           Datenbank, Typen, Migrationen, Startkatalog
   │  ├─ logic/          Progression, Empfehlungen, Assistent, Im-/Export
   │  ├─ platform/       Web- und Capacitor-Umsetzung
   │  ├─ ui/             wiederverwendbare Bausteine, Muskelgrafik, Diagramme
   │  └─ screens/        Heute, Training, Pläne, Übungen, Fortschritt, Einstellungen
   └─ tests/
```
Der Unterordner ist in sich geschlossen; der spätere Umzug in ein eigenes Repository geht samt Verlauf mit `git subtree split --prefix=gym-app`.

---

## 11. Umsetzung in Stufen

Beide Ausgaben entstehen von Stufe 1 an gemeinsam; jede Stufe endet mit einem lauffähigen Stand.

| Stufe | Inhalt | Fertig, wenn |
|---|---|---|
| **1 Fundament** | Projektgerüst, Datenbank, Startkatalog inkl. der Geräte aus der ersten Fotolieferung, Übungs-/Gerätekatalog mit Gerätekarte, Anleitung und Muskelgrafik, Plan-Editor, Trainingsmodus mit Pausentimer, Sicherung, PWA, Capacitor-Hülle + IPA-Workflow | ein Plan lässt sich anlegen, eine Einheit komplett durchtrainieren und wiederfinden; die `.ipa` wird gebaut |
| **2 Fortschritt** | Diagramme, Rekorde, Verlauf, Planvergleich, Körperwerte, Cardio, Steigerungsvorschläge | Entwicklung jeder Übung ist als Kurve sichtbar |
| **3 Planung** | Empfehlungen, Plan-Assistent, Pläne kombinieren, KI-Export/-Import | nach Ablauf eines Plans führt die App zu einem neuen |
| **4 Dein Studio** | eigene Fotos in der App, weitere Fotolieferungen einbauen (Abschnitt 4a), Katalog aufs Studio zuschneiden, Bewegungsbilder | jedes Gerät im Plan zeigt das echte Foto |

---

## 12. Offen / später

- Name und App-Symbol endgültig festlegen.
- Hosting der Web-Version.
- Gerätefotos und Geräteliste des Studios (in Stufe 4 umgesetzt, siehe Abschnitt 16 und 17).
- Denkbare Erweiterungen: Apple-Health-Anbindung, Trainingspartner-Modus – bewusst nicht im ersten Umfang. (Der Scheibenrechner kam mit 0.5.0/0.6.0, Abschnitt 24.)

---

## 13. Umsetzungsstand und Ergänzungen (Stufe 1, 14.11.2026)

Lücken im Konzept, die bei der Umsetzung mit der naheliegenden Lösung geschlossen wurden:

### Datenmodell (Ergänzungen zu Abschnitt 4)
- **Equipment:** `inStudio` (gehört zu „meinem Studio“: mitgelieferte Studio-Geräte und selbst angelegte; Filter „Nur mein Studio“), `hint` (Hinweistext, z. B. „noch zu bestätigen“), `builtinPhotos[]` (Zusatzbilder wie Skalen, Übungstafel, Gewichtsblock), `edited[]` (Felder, die der Nutzer an einem Katalogeintrag selbst geändert hat und die Katalog-Updates nicht überschreiben).
- **Adjustment:** zusätzlich `builtinPhoto` (mitgeliefertes Skalenfoto).
- **Exercise:** `edited[]` wie oben.
- **Set:** `doneAt` ist optional – ein Satz ohne `doneAt` ist nur vorgesehen/vorbelegt und zählt nicht. Beim Abschluss einer Einheit werden nicht abgehakte Sätze verworfen.
- **Entry:** trägt die Planvorgaben mit (`restSec`, `repMin`, `repMax`, `targetWeight`, `supersetGroup`) und `skipped`; ein laufendes Training ist so unabhängig von späteren Planänderungen.
- **Session:** `restEndsAt`/`restTotalSec` (Pausentimer überlebt App-Neustart) und `currentIndex` (angezeigte Übung). Das laufende Training ist die Session ohne `endedAt`.
- **Settings:** `defaultWeightStep`, `restSignal`, `vibration`, `backupReminder`, `catalogVersion`; ab 0.5/0.6 zusätzlich `restWarn`, `rirEnabled`, `warmupSuggest`, `plates` (vorhandene Scheiben), `autoBackup`, `autoBackupPhotos`, `trainingDays` (0 = Montag … 6 = Sonntag), `trainingTime` („HH:MM“), `reminderOn`.
- **Set:** zusätzlich `rir` (0–3, 3 = „3 oder mehr“; optional). **Equipment:** zusätzlich `plateSlots` (Zahl der Scheibenaufnahmen, 1–8, Standard 2). **Plan:** `evaluation` (KI-Auswertung). **Exercise:** `motionId` (Bewegungsskizze, „none“ = keine). **Session:** `deload`, `easier`.
- Mitgelieferte Kennungen sind lesbare Texte (`ex-bankdruecken-langhantel`, `eq-newtech-seitheben-maschine`), keine UUIDs – wichtig für den späteren KI-Export/-Import. Entfällt ein mitgelieferter Eintrag aus dem Katalog, wird er beim nächsten Abgleich entfernt (wird er noch von einem Plan oder Training verwendet, nur ausgeblendet).
- **Exercise.unilateral** (einseitig): Wiederholungen zählen je Seite; im Training steht „Wdh. je Seite“, in Plänen, Verlauf und Zusammenfassung „je Seite“. Das Volumen zählt die Wiederholungen je Seite einfach (kein Verdoppeln). Gesetzt bei Seitheben an der Maschine, Bizepscurl einarmig/Seitheben am Kabel (Multi Pully) und einarmigen Übungen im Katalog; in der Übungsbearbeitung einstellbar.
- **Schema-Version 1.** Sicherungsdateien tragen `schemaVersion`; ältere werden über `src/data/migrations.ts` hochgezogen, neuere abgelehnt. Katalog-Updates laufen über `CATALOG_VERSION`.

### Verhalten
- **Reiter:** Heute · Training · Pläne · Übungen · Fortschritt (Zahnrad für Einstellungen in „Heute“). Der Reiter „Training“ zeigt bei laufender Einheit den Trainingsmodus im Vollbild (Tab-Leiste ausgeblendet), sonst die Startauswahl.
- **Vorbelegung:** Sätze übernehmen Satz für Satz die Werte vom letzten Training dieser Übung (nur echte Sätze, ohne Aufwärmen); weitere Sätze den letzten Wert; ohne Historie Zielgewicht aus dem Plan bzw. Beginn der Gewichtsstufen und untere Wiederholungsgrenze. Gewichte werden auf die Stufen des Geräts eingerastet. Ändert man das Gewicht eines Satzes, ziehen noch offene Folgesätze mit gleichem Gewicht mit.
- **Gerät besetzt:** Alternativen mit gleichem Hauptmuskel; gleiches Muskelprofil, Studio-Geräte und gleiche Geräteart ranken höher; ausgeblendete Geräte, Cardio und Übungen, die schon in der Einheit stehen, fehlen. Der Tausch gilt nur für diese Einheit und ist zurücknehmbar.
- **Rekord:** höhere geschätzte Maximalkraft (Epley) als je zuvor bei dieser Übung; die allererste Einheit mit einer Übung löst keinen Rekord aus. Aufwärmsätze zählen nicht.
- **Supersatz:** Übungen mit gleicher Supersatz-Gruppe stehen im Plan hintereinander; nach einem Satz mit Partnerübung startet keine Pause, sondern es kommt ein Hinweis auf die Partnerübung.
- **Pausen:** Aufwärmsätze höchstens 45 s; Timer-Ende gibt Ton und Vibration (Einstellungen), auf iOS zusätzlich eine lokale Mitteilung; −15 s/+30 s/Überspringen.
- **Pläne:** Genau ein aktiver Plan; ein neu aktivierter ersetzt den bisherigen (der wird „Weiterer Plan“). Einheiten und Übungen lassen sich per Pfeiltasten umordnen (statt Ziehen – zuverlässiger auf dem Handy); Einheit aus anderem Plan kopieren, Einheit/Plan duplizieren, Übung in andere Einheit verschieben sind drin. Zusammenführen zweier Pläne, Assistent und KI-Import sind in Stufe 3 umgesetzt (Abschnitt 15).
- **Sicherung:** „Ersetzen“ leert Pläne/Trainings/Geräte/Übungen; Fotos nur, wenn die Sicherung Fotos enthält. „Zusammenführen“ nimmt bei gleicher Kennung den Datensatz mit dem neueren Änderungsdatum. Vor dem Schreiben wird die Datei vollständig geprüft; bei Fehlern bleibt alles unverändert. Der eingebaute Katalog wird danach abgeglichen.

### Geräte aus der ersten Lieferung (Ergänzung zu 4a)
- Eingebaut: NEWTECH Multi Pully (14 Übungen: 12 der Herstellertafel + Klimmzüge + Face Pulls), SCHNELL Bizepsmaschine (Foto 02 + 04), Gymleco Biceps Curl (Active Line 350), NEWTECH M-Torture Pec Dec Fly, NEWTECH Seitheben-Maschine stehend (Foto 05/06/10: Plattformhöhe 1–16, Gewichtsblock 5–100 kg in 5er-Schritten, Übung „Seitheben an der Maschine“, einseitig). Der Nutzer trainiert daran einarmig; eine beidarmige Variante wurde nicht angelegt.
- *(überholt, siehe Abschnitt 16)* **Foto 08** (Polster-Skala 1–7) ist **zurückgestellt, weitere Fotos folgen**: keinem Gerät zugeordnet, das Original bleibt in `geraete-fotos/eingang/`. Alle drei früheren Foto-Fragen sind geklärt (Foto 05 = Seitheben-Maschine, Foto 10 gehört dazu, Foto 08 offen).
- Skalen, die nicht auf den Fotos zu lesen waren, sind als **vorläufige Bereiche** angelegt und in der App änderbar: Multi Pully „Armhöhe (Raste)“ 1–10, SCHNELL „Sitzhöhe“ 1–5, Gymleco „Sitzhöhe“/„Brustpolster“ 1–10, Pec Dec „Sitzhöhe“ 1–10. Gewichtsstufen von Multi Pully, Gymleco und Pec Dec (Scheiben) sind nicht erfasst; dort gilt die Schrittweite der Übung.
- Startkatalog (Stand Katalogversion 6): 70 allgemeine Übungen + 52 Studio-Übungen, 28 allgemeine Geräte + 39 Studio-Geräte; jede Übung mit Einstellung · Ausführung · Atmung · Häufige Fehler · Tipp.
- Gerätekarte: Foto (oder Piktogramm), Namensband, Hersteller/Modell, Studio-Nummer, Kennzeichnung der Hauptmuskelgruppe mit kleiner Muskelgrafik. Bei allgemeinen Mehrzweckgeräten (Langhantel, Kurzhanteln …) entfällt die Kennzeichnung.
- Fotos: Zuschnitt/Verkleinerung mit `scripts/geraetefotos.mjs` (längste Kante 1280 px). Die Zuschnitte entfernen Personen soweit möglich; im Hintergrund des Gymleco-Fotos sind noch unscharfe Personen/Beine im Spiegel zu sehen (vom Foto nicht trennbar).

### Dritte Fotolieferung (14.11.2026, 44 Fotos) und Folgen fürs Datenmodell
- **Eingebaut: 33 weitere Geräte** (`src/data/studio-lieferung3.ts`) mit je einer Übung, die aus der allgemeinen Katalogübung abgeleitet ist (Muskeln, Anleitung, Pausen werden übernommen, die gerätespezifische Einstellung kommt davor – keine doppelten Texte). Die allgemeinen Katalogübungen bleiben bestehen; die Studio-Geräte ranken in „Gerät besetzt“ vorn. Insgesamt jetzt 38 Studio-Geräte, 51 Studio-Übungen, 28 allgemeine Geräte, 70 allgemeine Übungen.
- **Rücken:** Prime Seated Row (2 Fotos), NEWTECH 2 Way Row, Pure Kraft T-Bar-Rudern, Cybex Eagle Rudermaschine, Panatta Super Low Row, gym80 Latzug (zwei Zugarme), Granite Latzug, Panatta Super Pullover Machine, gym80 Nr. 18 Unterer Rücken. **Beine/Gesäß:** Paramount Leg Curl Nr. 6, gym80 Beinstrecker (2 Fotos), NEWTECH Leg Extension, gym80 Nr. 23 Beinbeuger stehend, gym80 Waden, Panatta Donkey Calf, gym80 Kickmaschine, GluteBuilder Hip Thrust (2 Fotos), Pendulum Hip Press, gym80 Belt Squat, Panatta Super Pendulum Squat, Cybex Beinpresse, Pure Kraft Beingerät (2 Fotos), zwei gym80-Sitzmaschinen, Gymleco Abduktoren, Abduktoren-/Gesäßmaschine (scheibenbeladen), Sissy-Squat-Ständer. **Bauch:** Cybex Eagle Abdominal, gym80 Bauch. **Multipressen:** Panatta Power Smith, gym80 Multipresse, silberne Multipresse.
- *(überholt, siehe Abschnitt 16)* **Nicht zugeordnet** (bleiben mit Originalnamen in `eingang/`): L3_03, 04, 05, 06, 07, 08, 09 sowie das zurückgestellte Foto 08 der ersten Lieferung. Nr. 11 „Hinterer Oberschenkel sitzend“ ist nur vorgemerkt (kein Foto, kein Gerät).
- *(überholt, siehe Abschnitt 16)* **Als „noch zu bestätigen“ gekennzeichnet:** alle Geräte, deren Hinweis „Bitte bestätigen“ enthält (Prime Brustrudern, Prime Seated Row ↔ Skala 1–7, Donkey Calf, Pure Kraft Beingerät, beide gym80-Sitzmaschinen, Abduktoren scheibenbeladen, silberne Multipresse); aus der Bauform erkannte Geräte tragen den Hinweis „bei Abweichung bitte melden“.
- **Datenmodell:** `WeightStack.levels` (ausdrückliche, ggf. unregelmäßige Stufenliste; +/− springt von Stufe zu Stufe; Paramount 9 … 73 kg, Cybex 13,6 … 77,1 kg), `WeightStack.unit = 'platte'` (Block trägt nur Plattennummern, gym80 Waden 2–28, Kickmaschine 2–17; `Entry.unit = 'platte'`; solche Einträge zählen nicht ins Kilogramm-Volumen, Rekorde und Verlauf laufen in Plattennummern; „Kilogramm je Platte“ ist noch nicht nachtragbar), `Equipment.perSideInput` (Eingabehilfe: im Training steht „Je Seite: X kg“ = (Gesamt − Eigengewicht) ÷ 2) und `Equipment.ownWeightKg`. Alle Felder sind optional; ältere Daten bleiben unverändert gültig, deshalb **keine neue Schema-Version** (`DB_SCHEMA_VERSION` bleibt 1). Studio-Nummern 6, 18, 23 stehen als `studioNumber` auf den Gerätekarten.
- Fotos: 44 Originale der dritten Lieferung (37 Zuschnitte; zusammen mit den 9 Fotos der ersten Lieferungen liegen 46 Dateien in `public/geraete/`) (Personen soweit möglich entfernt; auf einigen Fotos bleiben unscharfe Personen im Hintergrund/Spiegel); Originale mit Kennung im Dateinamen nach `verarbeitet/`.

### Prüfschleife (Runde 1, 14.11.2026) – eingearbeitet
Doppelstart eines Trainings (Transaktion), „Gerät besetzt“ behält abgehakte Sätze (Eintrag wird geteilt), Pause bleibt beim Zurücknehmen älterer Sätze, nach Abschluss keine späten Schreibvorgänge, Katalog-Abgleich löscht nie Geräte mit eigenen Daten, Sicherung wird inhaltlich tief geprüft (Muskeln, Anleitung, Gewichtsstufen, Typen, Status), höchstens ein aktiver Plan nach dem Import, Fehlergrenze (ErrorBoundary) in der App; Lesbarkeit (Textfarbe des Akzents in Hell mit Apples Kontrast-Variante, Tipp-Flächen 44 pt), Gerätekarten als 2-Spalten-Raster.

### Prüfschleife (Runde 2, 14.11.2026) – eingearbeitet
- **Einheit kg/Platte durchgängig:** „Letztes Mal“, Vorbelegung, Rekorde (auch beim Tausch) vergleichen nur Werte derselben Einheit; Plattennummern erscheinen im Rekord-Toast, in der Zusammenfassung, im Übungsverlauf („Höchste Platte“, keine geschätzte Maximalkraft) und im Plan („Zielplatte“). Mehrere Einträge derselben Übung in einer Einheit werden für „Letztes Mal“ zusammengeführt.
- **Stufenliste im Gerät-Editor:** Trenner sind Semikolon/Leerzeichen/Zeilenumbruch, das Komma ist das Dezimalkomma („13,6; 22,7“); ungültige Eingaben werden gemeldet, ein einzelner Wert wird abgelehnt, ein leeres Feld stellt auf gleichmäßige Schritte zurück.
- **„Gerät besetzt“:** ein zweiter Tipp während des Tauschs wird ignoriert; getauscht wird immer vom aktuellen Stand.
- **Anleitungen der Studio-Maschinen:** eigene Texte statt Langhantel-/Kabel-Formulierungen für Belt Squat, Pendel-Kniebeuge, Pendulum Hip Press, GluteBuilder Hip Thrust, Kickmaschine, Super Pullover, Donkey Calf, Beinbeuger stehend, die drei Multipressen, beide Latzüge und die Rudermaschinen mit Brustauflage. Ein Test verhindert solche Fehlübernahmen (keine „Langhantel“, „Kabel“, „Sicherheitsständer“ … bei Maschinen). Die beiden gym80-Sitzmaschinen A/B tragen bis zur Bestätigung dieselben neutralen Muskeln (Adduktoren + Abduktoren) und Schritte.
- **„Zu bestätigen“** erscheint jetzt als Kennzeichnung auf der Gerätekarte, in der Übungsliste, in der Übungsauswahl und im Übungsdetail, nicht nur im Gerätedetail.
- **Oberfläche:** lange Namen im Geräte-Raster brechen um (kein Abschneiden mehr), Studio-Nummer/Muskelgruppe bleiben einzeilig, Suchfeld wird nicht mehr zusammengedrückt, Abstand der Abschnittsüberschriften, „1 Satz“ statt „1 Sätze“, Suche in der Übungsauswahl wird beim Öffnen geleert, Notiz-Feld ohne Größengriff.
- **Katalogversion 5**, damit bestehende Installationen die Korrekturen aus Runde 1 und 2 übernehmen.
- **Bewusst nicht geändert / offen:** Personen im Hintergrund einiger Gerätefotos (Wadenheben stehend, Bauchmaschine gym80, Latzug mit Kniepolstern) – Fotos müssten neu aufgenommen oder von Hand retuschiert werden; die Eingabehilfe „Je Seite“ ist bei Belt Squat/Hip Press nur eingeschränkt sinnvoll und bei den Multipressen (Eigengewicht der Stange) nicht eingeschaltet; Kontrast des sekundären Graus im Hell-Modus entspricht Apples Systemfarbe (rund 3,3 : 1); kein Löschknopf im Suchfeld; der Kopf der Geräteliste ist nicht „klebend“.

### Prüfschleife (Runde 3, 14.11.2026) – teilweise
Nur Prüfer A (Korrektheit) hat berichtet; Prüfer B (Sichttest) und C (Konzepttreue) wurden vom Nutzungslimit unterbrochen. Eingearbeitet: „Zusammenführen“ einer Sicherung übernimmt eigene Eingaben an mitgelieferten Geräten/Übungen feldweise (Notizen, Eigengewicht, Ausblenden, eigene Einstellwerte), doppelte Rekord-Zeilen nach einem Tausch, ungültige Stufenliste blockiert das Speichern, Minimum/Maximum/Schritt sind bei vorhandener Stufenliste ausgeblendet, strengere Zahlenprüfung der Stufenliste, „Platte ×“ im Trainingsdetail, Prüfung von `unit`/`ownWeightKg`/`perSideInput` beim Import. Bekannt und nicht geändert: kleines Zeitfenster beim Tausch („Gerät besetzt“), in dem ein gleichzeitig abgehakter Satz überschrieben werden könnte.

### iOS-Build (Ergänzung zu Abschnitt 10)
- Die Erzeugung des `ios/`-Projekts unter Windows funktioniert (`npx cap add ios --packagemanager SPM`, Swift Package Manager ist ab Capacitor 8 Standard). Trotzdem wird `ios/` **nicht eingecheckt**, sondern bei jedem Lauf im Workflow frisch erzeugt und per Skript (`scripts/ios-prepare.sh`) angepasst: so bleibt es immer zur Capacitor-Version passend, und es gibt keine Windows-/Mac-Unterschiede (Zeilenenden, Pfade).
- Runner `macos-26` (Apple Silicon, Xcode 26 – Capacitor 8 verlangt mindestens Xcode 26.0). Ablauf: Tests → Web-Build → Capacitor-Projekt erzeugen → Info.plist (Kamera-/Fototexte, Hochformat, keine Exportnachweise) → `xcodebuild archive` mit `CODE_SIGNING_ALLOWED=NO` → `.app` in `Payload/` → `.ipa` → Artefakt (30 Tage).
- Auslöser: `workflow_dispatch` und Tags `gym-app-v*`; nie bei normalen Pushes.

### Umsetzungsstand Stufe 1
Fertig und im Browser (iPhone-Größe) durchgespielt: Plan anlegen → Einheit starten → Sätze, Pausentimer, „Gerät besetzt“ → abschließen → im Verlauf wiederfinden und korrigieren → Sicherung exportieren/importieren; eigenes Gerät mit Foto anlegen; Wiederaufnahme nach Neuladen.
**Nicht geprüft** (hier nicht möglich): Verhalten auf einem echten iPhone (Kamera, Teilen-Dialog, Haptik, lokale Mitteilung, Bildschirm wachhalten, Safe-Areas), Service-Worker-Offlinebetrieb in einem echten Browser (der Vorschau-Browser blockiert Service Worker; der Precache ist geprüft), und der Lauf des iOS-Workflows selbst, bis er einmal auf GitHub gelaufen ist.

---

## 14. Stufe 2 „Fortschritt“ (14.11.2026)

Der Reiter „Fortschritt“ hat vier Bereiche (Segment oben; die Auswahl bleibt während der Sitzung erhalten):

- **Überblick:** Einheiten gesamt, Einheiten je Woche (Schnitt seit dem ersten Training), Stunden; **Kalender** (Monat blättern, Trainingstage markiert, Tippen auf einen Tag öffnet die Einheit); **Pro Woche** (letzte 12 Kalenderwochen, Montag bis Sonntag) als Balken für Einheiten, Sätze, Volumen und Dauer; **Muskeln – Sätze pro Woche** (Schnitt der letzten 4 Wochen; Hauptmuskel zählt 1, Nebenmuskel 0,5; Orientierung „10–20 Sätze je Muskel und Woche“ als grobe Faustregel, Muskeln ohne Sätze werden aufgelistet); **Rekorde** (bester Satz je Übung); **Planvergleich** (erste gegen letzte Einheit mit dem gewählten Plan, bei Gewichtsübungen die geschätzte Maximalkraft, bei Plattennummern die Differenz der Nummern).
- **Übungen:** alle trainierten Übungen mit Suche → **Übungsverlauf** (`/fortschritt/uebung/:id`): Kurven für Gewicht, geschätzte Maximalkraft (Epley), Volumen und Wiederholungen; bei Cardio und Zeitübungen Dauer, Strecke und Tempo; Zeitraum 4 Wochen / 3 Monate / 6 Monate / alles; Rekord; **Vorschlag fürs nächste Mal**. Hat eine Übung Werte in kg und in Plattennummern, lässt sich die Einheit umschalten – beides wird nie vermischt.
- **Körper:** Körpergewicht und optional Umfänge (Brust, Oberarm, Taille, Hüfte, Oberschenkel) je Tag eintragen, ändern, löschen; Verlaufskurve mit Zeitraum. Ein Tag hat höchstens einen Eintrag.
- **Verlauf:** wie in Stufe 1 die Liste aller Einheiten zum Ansehen und Korrigieren.

**Diagramme** sind eigene SVGs (keine Zusatzbibliothek), tippbar/ziehbar, per Pfeiltasten bedienbar, mit Systemfarben in Dunkel und Hell. Der Wert und das Datum des gewählten Punkts stehen darüber.

**Steigerungsvorschlag** (Doppelprogression, in Übungsverlauf und Trainingsmodus unter „Letztes Mal“): Schaffen alle Arbeitssätze mit dem letzten Gewicht die obere Wiederholungsgrenze, kommt die nächste Gewichtsstufe des Geräts (bei Plattennummern die nächste Nummer); liegt man unter der unteren Grenze, bleibt das Gewicht, nach zwei Mal in Folge folgt eine Stufe weniger; sonst „gleiches Gewicht, eine Wiederholung mehr“. Nach mehreren Einheiten ohne Verbesserung erscheint ein Hinweis auf Deload oder Variante. Gilt nur für Übungen mit Gewicht und Wiederholungen.

**Technik:** Berechnungen in `src/logic/progress.ts` und `src/logic/chart.ts` (getestet), Diagramme in `src/ui/Charts.tsx`, Bildschirme `Progress`, `ProgressOverview`, `ExerciseProgress`, `BodyMetrics`; Körperwerte über `saveBodyMetric` (ein Datensatz je Tag), die Sicherung prüft Körperwerte jetzt inhaltlich. Keine Änderung des Datenbankschemas.

**Fehlerbehebung aus dem Test:** In Version 0.1.1 (Tag `gym-app-v0.1.1`) stürzte der Trainingsbildschirm ab („Rendered more hooks …“), weil ein `useRef` aus der Prüfrunde 2 hinter einem frühen `return` stand. Behoben; ein Test prüft jetzt die Reihenfolge der Hooks in den Hauptbildschirmen.

**Nicht geprüft:** echtes iPhone (Berührungsbedienung der Diagramme, Datumsfeld), Cardio-Auswertung mit echten Daten über Wochen, Verhalten bei sehr langer Historie (Hunderte Einheiten), Prüfschleife mit frischen Prüfern für Stufe 2 (damals Nutzungslimit; inzwischen als Runde 2 für Stufe 2–4 durchgeführt, siehe Abschnitt 19).

---

## 15. Stufe 3 „Planung“ (14.11.2026)

Alles läuft offline und regelbasiert; nichts passiert automatisch – die App schlägt vor, du entscheidest.

**Empfehlungen** (Karten auf „Heute“, höchstens zwei, nach Wichtigkeit; jede mit Begründung samt Zahlen, „Jetzt angehen“, „Später“ = eine Woche, „Nicht mehr zeigen“; gespeichert in `Settings.dismissedHints` als `never:<Schlüssel>` / `later:<Schlüssel>:<bis>`):
- Plan hat seine Laufzeit erreicht → „Neuen Plan erstellen“ (öffnet den Assistenten); eine Woche vorher Vorankündigung.
- Eine Übung stagniert seit 3 Einheiten (geschätzte Maximalkraft/Höchstgewicht nicht über dem Bisherigen) → Verlauf ansehen, variieren, Entlastung.
- Mindestens 3 Übungen stagnieren zugleich → Entlastungswoche: legt eine Kopie des Plans mit 1 Woche Laufzeit, 60 % des letzten Gewichts (in den Gerätestufen) und einem Satz weniger als Entwurf an.
- Eine Muskelgruppe liegt 2 Wochen unter der Hälfte des Medians der übrigen (Rumpf zählt nicht als Maßstab) → Plan ergänzen. Nur bei mindestens 4 Einheiten in 14 Tagen.
- Mehr als 10 Tage kein Training → sanfter Wiedereinstieg (ca. 70 % der letzten Gewichte, ein Satz weniger).
- Länger als 30 Tage keine Sicherung (oder nie, bei Training älter als 30 Tage) → Sicherung anlegen.

**Plan-Assistent** (`/plaene/assistent`, `src/logic/assistant.ts`): fünf Schritte (Ziel · Tage 2–6 · Zeit 45/60/90 · Schwerpunkte und Ausschlüsse · Laufzeit), vorbelegt aus dem Profil. Aufteilung: 2–3 Tage Ganzkörper A/B(/C), 4 Oberkörper/Unterkörper (je zweimal, B mit Varianten), 5 Push/Pull/Beine + Oberkörper + Unterkörper, 6 Push/Pull/Beine zweimal. Jede Einheit besteht aus Rollen (z. B. „Drücken waagerecht“, „Kniedominant“) mit einer Rangliste von Übungen; verwendet werden Studio-Geräte und Körpergewichtsübungen (optional auch allgemeine Geräte); selbst angelegte Übungen wählt der Assistent nicht von selbst, der KI-Export bietet sie dagegen an. Schema nach Ziel (Kraft 4–6 Wdh., 3–5 Min. Pause; Muskelaufbau 8–12; Fitness 12–15 plus Ausdauerabschluss), Übungszahl nach Zeit (45 Min. → 5, 60 Min. → 6, 90 Min. → bis zu 7, je nach Vorlage). Bezug auf den Verlauf: stagnierende Übungen werden durch eine Variante derselben Rolle ersetzt, gut laufende Grundübungen bleiben, Nebenübungen wechseln gegenüber dem letzten Plan, Startgewichte = 95 % des Gewichts für die mittlere Wiederholungszahl aus der geschätzten Maximalkraft (in Gerätestufen). Geräte mit „noch zu bestätigen“ werden nachrangig gewählt. Ergebnis: Vorschau mit Begründung je Übung („Warum?“), jede Übung austauschbar oder entfernbar, dann als Entwurf speichern oder aktivieren.

**Pläne kombinieren:** Einheit aus anderem Plan kopieren, Plan duplizieren, Übung verschieben (Stufe 1) und neu **Pläne zusammenführen** (`/plaene/zusammenfuehren`): Einheiten aus beliebigen Plänen wählen, Reihenfolge festlegen, als neuer Entwurf speichern; Originale bleiben unverändert.

**KI-Export/-Import** (`/plaene/ki`, `/plaene/importieren`, `src/logic/planio.ts`): „Mit KI planen“ erzeugt einen Text (Aufgabe, Profil, Wünsche, Liste der verfügbaren Übungen mit Kennungen, bisheriger Plan, Verlaufszusammenfassung, Antwortformat) zum Kopieren oder Teilen – ohne Namen oder Kontaktdaten und ohne Übertragung. Antwortformat `eisenzeit-plan` Version 1 (JSON). Import: der JSON-Block wird auch in umgebendem Text oder Codeblöcken gefunden, streng geprüft (Zahlenbereiche, repMin ≤ repMax, höchstens 14 Einheiten/20 Übungen; fehlende Angaben bekommen Standardwerte mit Hinweis; verständliche Fehlermeldungen), Übungen werden zugeordnet (Kennung → genauer Name, auch bei anderer Wortfolge oder Klammern → ähnlicher Name mit Rückfrage und Alternativen → „neu anlegen“ oder „andere wählen“), Vorschau mit Begründung; gespeichert wird erst nach Bestätigung, als Entwurf, in einer Transaktion (Plan und neu angelegte Übungen zusammen oder gar nicht). Derselbe Weg dient dem normalen Plan-Export („Als Datei exportieren“ im Plan-Menü) und -Import.

**Nicht geprüft:** echtes iPhone (Teilen-Dialog, Dateiauswahl, Zwischenablage), Qualität der Pläne mit sehr langem Verlauf oder mit Übungen ohne Gerät, Verhalten der KI-Antworten echter KI-Dienste (getestet mit selbst erzeugten Antworten), Prüfschleife mit frischen Prüfern für Stufe 2 und 3 (inzwischen als Runde 2 durchgeführt, siehe Abschnitt 19).

### Prüfschleife Stufe 2/3, Runde 1 (14.11.2026) – eingearbeitet
Drei frische Prüfer (Korrektheit, Sichttest, Konzepttreue) fanden keine kritischen, aber mehrere wichtige Befunde. Behoben:
- **Stagnation:** Körpergewichts-, Hilfsgewichts- und Cardio-Übungen gelten nicht mehr fälschlich als stagnierend (ohne Zusatzgewicht zählen die Wiederholungen; Cardio/Zeit stehen nicht als „STAGNIERT“ im KI-Text); einheitliche Schwelle 3 Einheiten. Empfehlungen zur Stagnation und Entlastung gelten nur für Übungen des aktiven Plans der letzten 8 Wochen – nach einem Planwechsel feuert nichts auf alter Historie.
- **„Nicht mehr zeigen“** wirkt jetzt bei allen Karten dauerhaft (die 14-Tage-Zeitblöcke in den Schlüsseln von Entlastung und Muskelungleichgewicht entfallen); ungültige Einträge in `dismissedHints` werfen keinen Fehler mehr, die Sicherungsprüfung kontrolliert Hinweisliste und Profil.
- **Wiedereinstieg** startet jetzt die nächste Einheit (mit Hinweis, etwa 30 % leichter zu beginnen); „Plan ergänzen“ nennt die zurückliegende Muskelgruppe; ein Doppeltipp legt keine zwei Entlastungspläne an. „Plan abgelaufen (Woche 9)“ statt „Woche 8 von 8“.
- **Import/KI:** ähnliche Namen müssen je Übung ausdrücklich bestätigt werden (Speichern erst danach), strengere Ähnlichkeit (kein „Beinstrecker“ → „Beinbeuger“), Teilnamen („Crunch“) werden als ähnlich erkannt, bei mehreren Plänen im Text gewinnt der letzte gültige, Größenbegrenzung 300.000 Zeichen, Hinweis bei eingesetzten Standardwerten, Vorschau/Fehler werden in den Blick gescrollt, „Andere wählen“ startet mit Suche nach dem Namen aus dem Import, „Übung tauschen“ mit der Muskelgruppe vorgefiltert, „Text kopieren/teilen“ baut den Text immer frisch, Plattennummern heißen „Platte N“ (Assistent, Import, KI-Text), Laufzeit-Vorbelegung aus den Einstellungen auch bei KI und Zusammenführen, Profil-Tage werden auf 2–6 begrenzt.
- **Statistik:** Hilfsgewichte (negativ) zählen nicht als Rekord und nicht als negatives Volumen; Wochenschnitt ohne die laufende unvollständige Woche; Körperwerte: Duplikate am selben Tag werden zusammengeführt, unplausible Werte abgelehnt; Entlastungsplan lässt Ein-Satz-Einträge bei einem Satz.
- **Oberfläche:** Geräte-Raster bis zu vier Namenszeilen (kein Abschneiden mehr), Großtitel ohne Abschneiden, Hell-Modus mit kräftigerem Sekundärgrau und Apples Text-Varianten für Orange/Grün/Rot (≥ 4,5 : 1), Tippflächen 44 pt (Warum?, kleine Chips, Kalendertage), Muskelbalken in einer Farbe mit grünem Orientierungsbereich 10–20, „Letztes Mal“ als „40 kg × 10 · 35 kg × 8“ (Datum bricht nicht mehr um), veralteter Profil-Text ersetzt.

**Bewusst offen:** (Pause über 14 Tage: seit Abschnitt 20 umgesetzt;) Geräte (statt einzelner Übungen) ausschließen fehlt im Assistenten; die Stagnationskarte bietet nur „Verlauf ansehen“ (die anderen Wege stehen im Text); die „Sätze je Woche“ der Empfehlung zählen nur Hauptmuskeln, die Anzeige im Überblick gewichtet Nebenmuskeln mit 0,5; die Schwelle der Muskel-Empfehlung ist „unter der Hälfte des Medians der übrigen Gruppen (Median ≥ 6)“, Rumpf zählt nicht; Segment-Schalter sind 40 pt hoch (Apples Standard-Segment), Toasts liegen oben und überdecken kurz die Kopfzeile, „Später“/Entfernen im Assistenten ohne Rückgängig, ein Import kann viele neue Übungen anlegen, Zeitüberschreitung bei absichtlich verschachtelten Klammern nur bis 300.000 Zeichen abgesichert. **Nicht erneut geprüft:** die Korrekturen aus Runde 1 – die Runde 2 (Abschnitt 19) hat sie nur indirekt mitgeprüft.

## 16. Antworten auf die Geräte-Rückfragen (14.11.2026, Katalogversion 6)

Alle zehn Rückfragen zur dritten Fotolieferung sind vom Nutzer beantwortet und eingearbeitet. Kein Gerät trägt mehr „Bitte bestätigen“.

- **Prime Brustrudern:** Hersteller Prime bestätigt. **Prime Seated Row:** Die Skala 1–7 (Foto 08) gehört dazu; sie ist als Zusatzbild „Skala 1–7 der Polsterhöhe“ eingebaut (`prime-seated-row-skala.jpg`, der Fuß am Bildrand abgeschnitten).
- **Panatta Donkey Calf:** Zuordnung des Fotos bestätigt.
- **Pure Kraft:** zwei verschiedene Geräte. Foto 1 = **Hackenschmidt-Kniebeuge** (Kennung `eq-purekraft-beinpresse` bleibt, damit vorhandene Daten gültig bleiben; Übung jetzt von der allgemeinen Kniebeuge abgeleitet, mit eigener Anleitung), Foto 2 = **Hip Press** (neu: `eq-purekraft-hip-press`, Übung `ex-purekraft-hip-press`, im Assistenten bei „Gesäß“).
- **gym80-Sitzmaschinen:** A (Beine werden auseinandergedrückt) = **Abduktoren**, B (Beine werden zusammengedrückt) = **Adduktoren**. Die Kennungen `ex-gym80-sitz-a-adduktoren` / `ex-gym80-sitz-b-abduktoren` blieben unverändert (vorhandene Daten), tragen aber nun jeweils die Gegenrichtung; Namen, Muskeln und Anleitung stimmen.
- **Abduktoren scheibenbeladen:** Hersteller unbekannt, auf dem Gerät steht „Gluteral“ (als Modell eingetragen).
- **Silberne Multipresse:** Hersteller Cybex bestätigt. **Seitheben-Maschine:** „einarmig“ = Wiederholungen je Seite (war schon so umgesetzt).
- **Fotos L3_03 bis L3_09:** Nutzer weiß nicht, welche Geräte das sind; sie bleiben in `eingang/`, neue Fotos folgen bei Gelegenheit.
- **Personen im Hintergrund** (Wadenheben stehend, Bauchmaschine gym80, Latzug gym80): unkenntlich gemacht (verpixelt) mit `scripts/personen-unkenntlich.mjs`, nur in den App-Bildern unter `public/geraete/`. Die Originale in `geraete-fotos/` sind unverändert und liegen im Git-Verlauf.
- **Umfang jetzt:** 39 Studio-Geräte, 52 Studio-Übungen (vorher 38/51). Katalogversion 6.

## 17. Stufe 4 „Dein Studio“ (14.11.2026)

**Stand vor dieser Stufe** (aus Stufe 1 und 3, nicht neu gebaut): eigene Gerätefotos in der App (Kamera oder Mediathek, auf 1280 px verkleinert), Foto je Einstellpunkt, „Nur mein Studio“-Filter, Gerät ausblenden, die 39 Studio-Geräte mit Foto und Gerätekarte.

**Neu in Stufe 4**
- **Studio einrichten** (`/uebungen/studio`, `src/screens/StudioSetup.tsx`): alle Geräte des Katalogs in drei Gruppen (Geräte mit Foto aus deinem Studio · weitere Geräte aus dem Katalog · selbst angelegt), je Gerät ein Schalter „bei mir vorhanden“, Suche, „Alle vorhanden / Alle abwählen“ je Gruppe, Zähler. „Fertig“ speichert in einem Zug (`setEquipmentPresent`): vorhanden = im Studio und eingeblendet, nicht vorhanden = nicht im Studio. Die Änderung wird bei mitgelieferten Geräten als „geändert“ gemerkt und überlebt Katalog-Updates. Danach zeigt der Katalog standardmäßig nur vorhandene Geräte (`Settings.studioSetupDone`, abwählbar über „Nur mein Studio“). Einstiege: Empfehlungskarte auf „Heute“ (bis erledigt oder weggewischt), Link im Katalog, Einstellungen. Im Bildschirm ist die Tab-Leiste ausgeblendet.
- **Foto fehlt:** Maschinen und Kabelzüge eines Plans ohne eigenes oder mitgeliefertes Foto werden im Plan-Editor aufgelistet (Tippen führt zum Gerät-Bearbeiten mit Aufnehmen/Auswählen) und als Empfehlungskarte auf „Heute“ gemeldet (`planEquipmentWithoutPhoto`). Im Katalog gibt es unter „Geräte“ den Filter „Ohne Foto“. Freihanteln, Körpergewicht und Cardio werden nicht angemahnt.
- **Bewegungsbild:** (Seit Abschnitt 21 2–6 Positionen.) Je Übung zwei eigene Fotos (Start/Ende) in „Übung bearbeiten“. Die App blendet sie im Wechsel ein (`MotionImage`), Tippen schaltet um und hält an, „Abspielen/Anhalten“; bei „Bewegung reduzieren“ (iOS-Einstellung) wechselt nichts von selbst. Zu sehen bei der Übung und im Trainingsmodus (Anleitung). Gespeichert als `Exercise.motionPhotoIds = [Start, Ende]` (leerer Eintrag = fehlt); mindestens zwei belegte Positionen müssen vorhanden sein, damit etwas angezeigt wird. Bleibt bei Katalog-Updates, Sicherung und Zusammenführen erhalten.
- **Fotos aufräumen (Fehlerbehebung):** Beim Ersetzen oder Entfernen eines Fotos wurde das alte sofort gelöscht, auch wenn man das Bearbeiten danach abbrach – das Gerät zeigte dann kein Bild mehr. Jetzt bleibt das alte Foto, bis gespeichert ist; nicht mehr verwendete Fotos räumt `removeOrphanPhotos` beim Start auf (nur solche, die älter als 10 Minuten sind).
- **Datenmodell:** nur Erweiterungen (`Settings.studioSetupDone`, `Exercise.motionPhotoIds` war schon im Typ). Die Sicherung prüft beide Felder; Schema-Version bleibt 1.

**Weitere Fotolieferungen:** Der Ablauf aus Abschnitt 4a bleibt bestehen. Offen sind die Fotos `L3_03` bis `L3_09` (der Nutzer macht neue Fotos). Die App selbst braucht dafür nichts Neues; neue Geräte entstehen in der App durch „Neues Gerät“ mit Foto.

**Bewusst offen**
- (Überholt, siehe Abschnitt 21: 2–6 Positionen.) Bewegungsbilder sind reine Foto-Paare; es gibt keine mitgelieferten Bewegungsbilder und keine Zeichenanimation (wie in Abschnitt 3.4 vorgesehen).
- Kein Zuschneiden der eigenen Fotos in der App (die Kamera- und Mediathek-Auswahl liefert das ganze Bild, verkleinert).
- Mehr als ein Foto je Gerät (außer den mitgelieferten Zusatzbildern und den Skalenfotos) gibt es nicht.
- Auf einem echten iPhone ungetestet: Kamera, Mediathek, Speicherverbrauch vieler Fotos, Verhalten von „Bewegung reduzieren“.
- Keine UI-Tests für StudioSetup, MotionImage und MissingPhotos (Logik und Datenhaltung sind in `tests/studio.test.ts` getestet).

## 18. Umzug in das Repository „apps“ (14.11.2026)

Auf Wunsch des Nutzers liegt die App jetzt in einem **eigenen, öffentlichen Repository `Volvic93/apps`** als Oberordner für Apps; `gym-app/` ist ein Unterordner mit zwei Teilen:

- **`gym-app/webapp/`** – die App (Code, Tests, Katalogfotos, `INSTALLATION.md` für die Web-App auf dem iPhone). Aus dem früheren Stamm von `gym-app/`, ohne `capacitor.config.ts` und `ios-prepare.sh`.
- **`gym-app/ipa-app/`** – die iOS-Hülle: `capacitor.config.json` (Quelle der Web-Dateien `../webapp/dist`), `package.json` (Capacitor und Plugins, dazu `@capacitor/cli` und `@capacitor/ios`, die in der Web-App entfallen sind), `scripts/ios-prepare.sh`, `INSTALLATION.md` (AltStore und Sideloadly).
- **Veröffentlichung:** `.github/workflows/gym-app-webapp.yml` baut die Web-App bei Änderungen auf `main` und stellt sie über GitHub Pages bereit (`https://volvic93.github.io/apps/gym-app/`, dazu eine Startseite unter `/apps/`). `.github/workflows/gym-app-ios.yml` baut die `.ipa` (von Hand oder bei Tags `gym-app-v…`; bei Tags zusätzlich ein Release mit der `.ipa`).
- **Frischer Verlauf:** Das neue Repository beginnt mit einem ersten Stand. Die Originalfotos mit Personen im Hintergrund (`geraete-fotos/`) gehören nicht dazu; veröffentlicht sind nur die zugeschnittenen Bilder in `webapp/public/geraete/` (drei davon verpixelt). Die alten Commits und Tags (`gym-app-v0.1.0` bis `v0.3.0`) bleiben im Repository `3d-druckdateien`.
- Ab hier gilt für alle Pfade in diesem Dokument: `src/…`, `tests/…`, `public/…`, `scripts/…` liegen unter `gym-app/webapp/`; `scripts/ios-prepare.sh` und `capacitor.config.json` unter `gym-app/ipa-app/`.

## 19. Prüfschleife Stufe 2–4, Runde 2 (15.11.2026)

Drei frische Prüfer (A Korrektheit im Code, B Sichttest im Browser in iPhone-Größe, C Konzepttreue), danach Korrekturen. **Browser in iPhone-Größe, kein echtes iPhone.** Gesehen: Prüfer B in 375×812 dunkel und hell, 768×1024 hell, Desktop-Breite dunkel (Heute, Pläne, Planeditor, Assistent, Import, Training, Fortschritt, Katalog, Dein Studio, Geräte-/Übung bearbeiten, Einstellungen); Konsole ohne Fehler. Ergebnis: keine Befunde mit Schweregrad „hoch“.

**Behoben (mit Tests in `tests/runde2.test.ts`):**
- Rekorde bei Plattennummern rechneten mit Epley (Platte 6 × 15 schlug Platte 7 × 6); jetzt höchste Nummer, bei Gleichstand mehr Wiederholungen – wie Rekordliste und Verlauf (`recordScore`).
- „Zusammenführen“ übernahm bei mitgelieferten Geräten/Übungen nur die Markierung `edited`, nicht den Wert („Dein Studio“, Umbenennung): jetzt wird der Wert mit übernommen, wo lokal nichts als geändert gilt (Gewichtsstufen/Einstellpunkte-Struktur `adjustments` ausgenommen).
- Katalog und Übungsauswahl blendeten mit „Nur mein Studio“ Übungen ohne Gerät und Körpergewichtsübungen aus; sie bleiben jetzt sichtbar (wie im Assistenten).
- Assistent und KI-Export boten abgewählte eigene Geräte weiter an.
- Stagnationskarte: Text je nach Einheit („Plattennummer“, „Maximalkraft … kg“, bei Wiederholungsübungen ohne Wert).
- Trainingsvorschlag sagt im Training „heute“ statt „nächstes Mal“.
- Assistent-Hinweis „90 Min. → 8 Übungen“ stimmte nicht (Vorlagen haben höchstens 7 Rollen): Text auf „bis zu 7“.
- Backup-Prüfung lehnt Foto-Base64 mit unmöglicher Länge verständlich ab.
- Versionsnummer in `package.json` (webapp, ipa-app) und Info-Anzeige auf 0.3.0.
- Oberfläche: langer Planname im Planvergleich läuft nicht mehr aus der Karte; lange Gerätenamen in „Dein Studio“ berühren den Schalter nicht mehr; Leerzustand „Keine Treffer“ in „Dein Studio“; Katalog flackert nach „Studio einrichten“ nicht mehr; „Ohne Foto“ steht vorn in der Chip-Reihe, bei „alle Geräte haben ein Foto“ erscheint ein passender Text; Tippfehler „… .“ in der Foto-Karte; Einstellungen zeigen Anzahl vorhandener Geräte und „Studio anpassen“; „Deload“ → „Entlastung“.

**Bewusst offen (neu):**
- Entlastungsplan führt nicht zum ursprünglichen Plan zurück (kein Hinweis „alten Plan wieder aktivieren“; Planwoche startet beim Reaktivieren bei 1).
- „Nicht mehr zeigen“ bei Hinweisen lässt sich nicht rückgängig machen (keine Liste in den Einstellungen).
- „Dein Studio“ verwirft Änderungen bei Zurück ohne Rückfrage; „Alle vorhanden“ blendet bewusst ausgeblendete Geräte wieder ein.
- Der Assistent wählt nie selbst angelegte Übungen/Geräte; KI-Export: Trainingstage nur aus dem Profil.
- Begriffe uneinheitlich („Nur mein Studio“, „Mein Studio“, „bei mir vorhanden“; „SS1“ vs. „Supersatz“; „Entwurf“ vs. „Weitere Pläne“).
- Sicherung ohne Fotos: Geräte behalten eine Foto-Kennung ohne Datei, die Karte „Foto fehlt“ erscheint dafür nicht; Zeitraum der Sicherung als UTC-Datum (kosmetisch); `usePhotoUrl` kann in einem engen Zeitfenster eine Bild-Adresse zu früh freigeben; Plan-Editor schreibt den ganzen Plan aus dem zuletzt gezeichneten Stand.
- Darstellung: Titel brechen ohne deutsche Silbentrennung mitten im Wort (auf dem iPhone ungeprüft); Volumen wechselt bei 10.000 kg von „kg“ zu „t“; Zusammenfassung nach einem Satz zeigt „−89,4 %“; Planname im Import bei 80 Zeichen stumm gekürzt; Button „Vorschlag erstellen“ bricht um; „Stepper“ hat das Fahrrad-Piktogramm; Namensfeld bei Übung bearbeiten einzeilig, leere Bewegungsbild-Platzhalter sehr hoch.
- Nicht geprüft: echtes iPhone (Safe-Area, Kamera, Teilen, Service Worker), Bewegungsbild-Animation, Sicherung Export/Import in der Oberfläche, Querformat, Dynamic Type, 320 pt Breite, Training/Assistent in hell und auf dem Tablet.
- Die Korrekturen aus dieser Runde wurden nur durch Tests und eine kurze Sichtprüfung der Studio-Liste kontrolliert; eine Runde 3 mit frischen Prüfern hat nicht stattgefunden.

## 20. Feinschliff nach Stufe 4 (15.11.2026)

Auf Wunsch des Nutzers ohne Runde 3 der Prüfschleife. Umgesetzt wurden drei Punkte, die das Konzept versprach oder die Runde 2 als Lücke fand (Tests in `tests/progress.test.ts` und `tests/schritt5.test.ts`):

- **Pause über 14 Tage** (Abschnitt 5): Hat man eine Übung länger als 14 Tage nicht trainiert, schlägt der Steigerungsvorschlag etwa 10 % weniger Gewicht vor („20 Tage Pause – steig mit etwa 10 % weniger ein“). Bei Gewichtsstufen wird auf die nächste Stufe gerundet, bei Plattennummern gilt eine Nummer weniger, sonst wird auf die Schrittweite der Übung gerundet.
- **Rückweg aus der Entlastung:** Ein Entlastungsplan merkt sich den Ursprungsplan (`returnToPlanId`, neues optionales Feld ohne Änderung der Datenbankversion). Ist die Entlastungswoche vorbei, zeigt „Heute“ statt „Zeit für einen neuen Plan“ die Karte „Entlastungswoche geschafft“ mit „Zu … zurückkehren“. Beim Aktivieren beginnt die Planwoche des Ursprungsplans wieder bei 1.
- **Hinweise wieder einschalten:** Einstellungen → Hinweise → „Ausgeblendete Hinweise wieder zeigen“ (setzt „Nicht mehr zeigen“ und „Später“ zurück).

Weiterhin offen: siehe Abschnitt 19 (ohne die drei Punkte oben).

## 21. Bewegungsbild mit mehreren Positionen (15.11.2026)

Auf Wunsch des Nutzers zeigt die App zu jedem Gerät, wie die Übung richtig ausgeführt wird – mit mehreren Bildern für den Ablauf:

- Das **Bewegungsbild** einer Übung hat jetzt **zwei bis sechs Positionen** (Start, Mitte …, Ende) statt genau zwei. Es können eigene Fotos **oder Zeichnungen** sein (Bilddatei aus Fotos/Dateien, Kamera). Bearbeiten: Übung bearbeiten → „Bewegungsbild“ → „Weitere Position hinzufügen“ / „Position entfernen“.
- Anzeige: Übungsdetail, **Gerätedetail** (Karte „So geht’s: …“ je Übung mit Bewegungsbild) und Trainingsmodus. Die Positionen blenden der Reihe nach ein („Position 2 von 4“, bei zwei Bildern „Start“/„Ende“); Tippen schaltet weiter und hält an; bei „Bewegung reduzieren“ startet nichts von selbst.
- Gespeichert wird wie bisher in `motionPhotoIds` (Liste von Foto-Kennungen); alte Bewegungsbilder mit zwei Bildern bleiben gültig. Backup, Aufräumen und Zusammenführen sind unverändert.
- **Offen:** Mitgelieferte Zeichnungen für die 39 Studio-Geräte gibt es nicht – die Bilder legt der Nutzer selbst an (eigene Fotos oder selbst erstellte/gekaufte Zeichnungen). Ein In-App-Zuschneiden und ein Raster zum Zeichnen fehlen.

## 22. Abschlussrunde (15.11.2026)

Letzte Prüfrunde mit drei frischen Prüfern (A Code, B Sichttest im Browser in iPhone-Größe – **kein echtes iPhone**, C Konzept und Anleitungen), danach Korrekturen. Keine Befunde, die Daten zerstören; B und A fanden aber zwei echte Mängel an der neuen Entlastung/Pause.

**Behoben (Tests in `tests/schritt5.test.ts`):**
- Entlastungswoche wirkte im Training nicht (Vorbelegung nahm die alten Gewichte): jetzt Zielgewichte des Entlastungsplans. Einheiten der Entlastung (`Session.deload`) zählen nicht für Vorbelegung, Vorschlag und Stagnation; im Entlastungsplan gibt es keine zweite Entlastungskarte und kein „läuft bald aus“; Ketten aus Entlastungsplänen zeigen auf den Ursprungsplan.
- „Leichter wieder starten“ (Heute) tat nur einen Toast: jetzt wirklich etwa 70 % der Gewichte und ein Satz weniger (`Session.easier`); die Pausenregel unterdrückt in solchen Einheiten ihren zweiten Vorschlag.
- Pausenregel: Grenze exakt in Millisekunden (> 14 Tage), nie 0 kg, bei groben Stufen „eine Stufe leichter“ statt „etwa 10 %“.
- Bewegungsbild: Platzhalter mit Weg zum Hinzufügen bei Übung und Gerät (vorher unsichtbar); transparente PNG-Zeichnungen bekommen weißen statt schwarzen Hintergrund; Beschriftungen im Formular bereinigt, Vorschau zeigt Hochformat vollständig; Tippen auf die Beschriftung öffnet nicht mehr die Kamera.
- Katalog-Update löscht keine Übung mehr, die eigene Bewegungsbilder oder Einstellwerte hat; Backup-Prüfung für Foto-Daten genauer; Hinweis-Zähler ohne abgelaufene „Später“-Einträge; Katalog-Knopf „Studio anpassen“; Knöpfe mit mehreren Zeilen haben Innenabstand; langer Entlastungsplan-Name wird mit „…“ gekürzt.
- Dokumentation: Konzept-Stellen zu Bewegungsbild, Hosting, Median aktualisiert; Version in App und `package.json` 0.3.2; Tag-Beispiel in `ipa-app/README.md`; Antwort auf „App als Datei auf dem iPhone“ in `webapp/INSTALLATION.md`.

**Bewusst offen:** keine mitgelieferten Zeichnungen für die Geräte (der Nutzer legt die Bilder selbst an); „Zusammenführen“ kann lokal wieder eingeblendete Geräte erneut ausblenden (Regel „wo lokal nichts steht“); wer den Entlastungsplan archiviert statt zu aktivieren, bekommt keinen Rückweg-Hinweis; „Letztes Mal“ bricht auf kleinen Bildschirmen an Zahl und Einheit um; fehlt eine Bilddatei eines Bewegungsbilds (Sicherung ohne Fotos), bleibt die Beschriftung stehen; Punkte aus Abschnitt 19. **Nicht geprüft:** echtes iPhone (Kamera, Mediathek, Safe-Area, Service Worker), Plan-Assistent/KI-Import/Sicherung in der Oberfläche nach den letzten Änderungen, Querformat, Dynamic Type. Eine weitere Runde nach diesen Korrekturen hat nicht stattgefunden.

## 23. Version 0.4.0: Farbschema, Studio, Kopfleiste, Gerätebilder, Skizzen, Claude (15.11.2026)

Neuer Auftrag des Nutzers (über die Konzept-Sitzung). Alles Folgende ist Umsetzung; wo etwas entschieden wurde, steht es dabei.

**Farbschema „Kraftkultur“ (ersetzt „ausschließlich Apple-Systemfarben“; Aufbau und Bedienmuster bleiben nach Apples HIG).** Dunkelgrün `#033220`, Schwarz `#0A0A0A`, Neongelb `#E0F84A` (aus dem Screenshot des Nutzers).
- Dunkel (Standard): Hintergrund `#0A0A0A`, Karten `#121613`, erhöhte Flächen `#1A211C`, Trennlinien weiß 8 %, Text `#F4F6EE` (zweitrangig 62 %, drittrangig 40 %). Akzent Neongelb: Hauptknöpfe (Schrift `#0A0A0A`, nie weiß), aktiver Reiter, Fortschrittsbalken, erledigte Sätze, Schalter an. Markenfläche Dunkelgrün mit Rand `rgba(224,248,74,.18)` für „Nächste Einheit“, laufendes Training, Zusammenfassung. Warnung `#FFB340`, Fehler `#FF5A4F`; Erfolg ist Neongelb (kein zusätzliches Grün).
- Hell (Option): Hintergrund `#F4F6EF`, Karten weiß, Text `#0A0A0A`, Akzent/Links `#033220`, Hauptknopf `#033220` mit Schrift `#E0F84A`; Neongelb nie als Schrift auf Weiß.
- Umsetzung über Variablen (`--accent`, `--accent-ink`, `--brand`, Muskelgruppen `--grp-*`); die alten `--sys-*`-Namen zeigen auf die neuen Farben, Blau kommt nirgends mehr vor. `theme-color`, Manifest, Capacitor-Hintergrund und das App-Symbol (neongelbe Hantel auf Dunkelgrün, alle Größen neu) sind angepasst. Muskelgrafik und Diagramme nutzen den Akzent.

**Studio.** `Settings.studio = { name, city }`, ab Werk „Kraftkultur Gym“ / „Mönchengladbach“ (in den Einstellungen änderbar); nur Text, kein Logo. Anzeige in der Kopfzeile von „Heute“, in Einstellungen → Dein Studio und im Kontext für die KI. Die mitgelieferten Studio-Geräte gelten ab Werk als vorhanden (`studioSetupDone` standardmäßig an, auch bei bestehenden Installationen; „Geräte des Studios anpassen“ bleibt erreichbar), der Katalog zeigt standardmäßig „Nur mein Studio“. **Abweichung:** die generischen Maschinen des Startkatalogs werden dafür nicht zusätzlich ausgeblendet – sie sind mit „Nur mein Studio“ ohnehin nicht sichtbar, ohne Daten zu verändern.

**Kopfbereich abgedunkelt (Fehler auf dem iPhone 15 Pro Max, iOS 27.2.1, Web-App vom Home-Bildschirm).** Auf dem Bildschirmfoto des Nutzers liegt über dem oberen Rand ein weicher dunkler Verlauf mit Unschärfe, der bis etwa 50 pt unter die Statusleiste reicht; Menü, Titel und „Abschließen“ sind ausgegraut. Der Verlauf kommt nicht aus dem CSS der App, sondern von iOS (der „Scroll-Edge-Effekt“ seit iOS 26). Recherche (Entwicklerberichte und Fehlermeldungen auf GitHub und in Apples Forum, **keine Apple-Dokumentation**): Der Effekt lässt sich per CSS oder Meta-Tag nicht abschalten; mehrere Projekte berichten, dass er ausbleibt oder abgeschwächt wird, wenn am oberen Rand eine **feste, vollbreite, deckende** Fläche liegt und alle Bedienelemente erst unterhalb der überblendeten Zone beginnen; ein Bericht meldet, dass das unter iOS 27 nicht ausreicht; ein anderer, dass der Effekt auch ohne `black-translucent` unter der Statusleiste bleibt. Umgesetzt (alles zusammen, weil keine Quelle eine einzelne Lösung sicher belegt):
- **Fester deckender Schutzbereich** (`.edge-band`, `position: fixed`, Hintergrund `#0A0A0A`) über Safe-Area plus **48 px**; Kopfzeilen, Zurück-Knöpfe, Zahnrad, Trainingsleiste („…“, Titel, „Abschließen“) und der Schließen-Knopf der Vollbildansicht beginnen erst darunter. Nur als Home-Bildschirm-App bzw. in der iOS-Hülle (`html.standalone`), im Browser bleibt alles wie vorher.
- Kopfleiste fest (`sticky`) unterhalb des Schutzbereichs, schrumpft beim Scrollen.
- Statusleisten-Stil `black` statt `black-translucent`.
Das ist **eine Vermutung mit Absicherung, kein bewiesener Fix**; auf dem iPhone nicht geprüft. Bitte nach dem Aktualisieren ein neues Bildschirmfoto schicken. Die 48 px sind eine Schätzung aus dem Foto und lassen sich in `apple.css` (`--edge-clear`) ändern. **Aktualisieren:** Die Web-App holt den neuen Stand beim Öffnen mit Internet; Statusleisten-Stil und Symbol einer bereits installierten Web-App übernimmt iOS nach Erfahrung nur nach Entfernen und erneutem Hinzufügen. **Dabei gehen die Daten der Web-App verloren** (Safari-Speicher): vorher *Einstellungen → Sicherung exportieren*, nach dem erneuten Hinzufügen importieren. **.ipa (WKWebView):** gleiche Maßnahmen (Schutzbereich greift über `location.protocol === 'capacitor:'`); der native Effekt (`UIScrollView.topEdgeEffect`) und die Statusleistenfarbe bei hellem iOS-Modus sind **nicht geprüft und nicht angepasst**.

**Fußleiste im Training.** Der leere Streifen unter „Zurück / Nächste Übung“ war die untere Safe-Area plus 10 px; jetzt nur noch die Safe-Area (mindestens 12 px). „Zurück“ ist bei der ersten Übung gedämpft, aber lesbar.

**Empfehlungskarten.** Schlichte Karte im Stil der übrigen Karten, ohne farbigen Randstreifen, Überschrift neutral (Wunsch des Nutzers).

**Gerätebilder im Training.** Das Foto zeigt das Gerät vollständig (`contain`, höchstens 44 % der Höhe) mit Name und Gerät darunter (Klammerzusätze im Namen werden als zweite Zeile getrennt); nach dem ersten eingetragenen Satz klappt es zu einer Zeile mit Vorschaubild zusammen (Tippen klappt auf). Tippen auf das Foto öffnet die **Vollbildansicht** (`Lightbox`): ganzes Bild, Zoomen per Zwei-Finger-Geste, Mausrad und Doppeltipp, Wischen zwischen Hauptbild und Zusatzbildern, Schließen per Knopf, Tippen daneben, Escape oder Wischen nach unten. Dieselbe Ansicht im Gerätedetail. **Offen:** Katalog-, Plan-Editor- und „Gerät besetzt“-Listen zeigen weiter nur Vorschaubilder (Tippen öffnet dort das Detail, nicht die Vollansicht).

**Bewegungsskizzen (mitgeliefert).** `src/ui/sketch-engine.ts` (Gliederfigur mit inverser Kinematik für Arme und Beine, Gelenkrichtung gewählt, Griff- und Fußpunkte aus den Winkeln berechnet), `src/data/motions.ts` (57 Bewegungsmuster mit Start- und Endpose, Gerätformen, Stichworten, Richtungspfeil), `src/ui/MotionSketch.tsx` (weich animiert zwischen Start und Ende, bewegte Körperteile neongelb, Tippen hält an; bei „Bewegung reduzieren“ beide Positionen nebeneinander). Jede mitgelieferte Übung bekommt ihr Muster nach Kennung und Name (Test: keine Übung ohne Skizze); bei eigenen Übungen frei wählbar (`Exercise.motionId`, „Übung bearbeiten → Bewegungsskizze“). Anzeige: Übungsdetail, Gerätedetail, im Training als zweite Kachel neben dem Foto (Tippen vergrößert) und im Blatt „Anleitung“; eigene Bewegungsbild-Fotos bleiben zusätzlich. Übersicht aller Muster nur über die Adresse **`#/skizzen`**. Ich habe jede Skizze als Bild geprüft und nachgebessert. **Schwächere Muster (Sichttest):** Butterfly und Abduktoren/Adduktoren (Vorderansicht im Sitzen nur als breiter Stand dargestellt, Adduktoren-Ende wirkt wie eine Raute), Russian Twist (weder V-Sitz noch Drehung erkennbar), Dips (wirkt wie Hocke), Klimmzug (Körper ganz neongelb, Beine stark nach vorn), Rudern mit Brustauflage, Sissy Squat (Ende ähnelt einer normalen Kniebeuge), Hüftpresse und Beinpresse sehen gleich aus, Aufrechtes Rudern (Ende klein), Start und Ende fast gleich bei Shrugs, den Wadenheben, Stepper, Handgelenkcurl; die Gerätformen sind überall nur angedeutet, und eine Figur zeigt nur ein Bein pro Seite (zweites Bein nur bei Gehen/Laufen). Die Kachel „Skizze“ im Training ist für die kleine Figur recht groß.

**KI-Austausch per Markdown-Datei (ersetzt „Mit KI planen“; eine direkte Claude-Anbindung per API-Schlüssel wurde auf Wunsch des Nutzers nicht gebaut und wieder entfernt – kein Schlüsselfeld, kein Netzaufruf an eine KI).** Die App schreibt einen **Auftrag als `.md`-Datei** (`eisenzeit-auftrag-<art>-JJJJ-MM-TT.md`), den eine beliebige KI ohne Vorwissen versteht: Rolle und Aufgabe, Regeln (bis zu **drei Rückfragen** vor der Antwort, genau **ein** eingezäunter JSON-Block, davor/danach Erklärtext erlaubt), Antwortformat mit ausgefülltem Beispiel, Kontext (Studio, Profil, Wünsche, verfügbare Übungen mit Kennungen, bisheriger Plan, Verlauf). Auftragsarten: **Neuer Plan** (`eisenzeit-plan` v1), **Plan anpassen** (`eisenzeit-plan` mit `basedOn`; die Vorschau zeigt neue, entfernte und geänderte Übungen je Einheit) und **Auswertung am Planende** (neues Format `eisenzeit-auswertung` v1: Kurzfazit, was gut lief, was stagniert, Empfehlungen, Hinweise für den nächsten Plan, optional `nextPlan`). Ausgabe: „Als Datei teilen“ (Teilen-Dialog), „Text kopieren“, „Auftrag ansehen“. Rückweg: **ein** Import für alle Arten (Text einfügen oder Datei `.md`/`.txt`/`.json`): die App findet den Block auch in umgebendem Text oder einem ganzen Chat, erkennt die Art am Feld `format`, prüft streng, zeigt die Vorschau und übernimmt erst nach Bestätigung; Fehlerhaftes wird mit verständlicher Meldung abgelehnt (nie halb importiert), auf Wunsch erzeugt die App einen **Korrekturtext** zum Zurückgeben an die KI. Auswertungen werden am Plan gespeichert (`Plan.evaluation`, in der Sicherung enthalten und geprüft) und erscheinen beim Plan und unter Fortschritt; die Karte „Zeit für einen neuen Plan“ bietet zusätzlich „Auswertung per KI“ an. Technik: `src/logic/aiorder.ts` (Auftrag, Antwortprüfung, Unterschiede; unabhängig von der Quelle – eine lokale KI könnte später dieselben Aufträge direkt beantworten), `src/logic/planio.ts` (gemeinsamer Kontext), `AiPlan.tsx`, `PlanImport.tsx`. Es wird nichts automatisch gesendet; der Auftrag verlässt die App nur, wenn der Nutzer ihn teilt oder kopiert (er enthält Ziel, Studio, Übungen, Plan und Verlauf, keinen Namen und keine Kontaktdaten). Tests: `tests/aiorder.test.ts`. **Nicht geprüft:** echte Antworten verschiedener KI-Dienste (Formattreue, Rückfragen), Teilen-Dialog auf dem iPhone.

**App-Symbol (neu).** Entwurf **A „Hantel-E“** (vom Nutzer gewählt): ein E aus drei Balken, der mittlere ist eine Langhantel mit Scheiben; Neongelb auf Dunkelgrün mit weichem Verlauf nach Schwarz. Eine SVG-Quelle (`scripts/icon-designs.mjs`, dort auch die verworfenen Entwürfe B „Scheibe“ und C „Langhantel“), daraus `npm run icons`: iOS-Master 1024 px (ohne Transparenz, ohne eigene Rundung), `apple-touch-icon`, Manifest 192/512 und „maskable“, Favicon, Symbol der Startseite `site/`. Auf dem iPhone ändert sich das Symbol einer bereits installierten Web-App erst nach Entfernen und erneutem Hinzufügen (**Daten gehen dabei verloren – vorher Sicherung exportieren**); bei der `.ipa` mit dem nächsten Aufspielen.

**Zielgerät.** iPhone 15 Pro Max (430 × 932 pt, Dynamic Island, iOS 27.2.1); Sichttests zusätzlich zu 375 × 812 in dieser Größe mit simulierter Safe-Area (59 pt oben, 34 pt unten).

**Prüfschleife v0.4.0 (Runde 1, drei Prüfer; Runde 2 nicht gelaufen).** Behoben: Beispielblöcke aus dem Auftrag gelten nicht als Antwort; Korrekturtext nennt das richtige Format; Plattennummer-Geräte im Auftrag gekennzeichnet; Plan-Unterschiede bei eingefügten Einheiten richtig, mehr Felder verglichen; Auswertung mit Planvorschlag: beides nacheinander speicherbar; bevorzugter Plan aus dem Auftrag; Hell-Modus: Text auf Markenflächen lesbar, Abhak-Kreis und Platzhalter kontrastreicher; Training: neue Übung beginnt oben, Foto-/Skizzenkachel niedriger (Satz 1 sichtbar), Skizze ohne Knopf-im-Knopf; Schutzbereich nur auf iOS/Hülle und nur auf schmalen Bildschirmen, Toasts und hohe Blätter unterhalb; Skizzen-Zuordnung (Gymleco-Curl, Dips, Kickboxen u. a.) und „Keine Skizze“ wählbar; Symbole der Startseite werden mitveröffentlicht. **Offen:** „Letztes Mal“ bricht auf kleinen Bildschirmen an Zahl und Einheit um; Segmentschalter 40 pt; Schalter „Aus“ im Hellmodus schwach; die Skizzen-Vollansicht ist überwiegend leer; Skizzen siehe oben; der obere Schutzbereich (107 pt mit Safe-Area) nimmt auf Plan- und Detailseiten rund ein Fünftel der Höhe; Gesten der Vollbildansicht nur im Code geprüft.

**Lokale KI (nur Machbarkeit, nichts gebaut).** *WebGPU-Modell in der Web-App/Hülle (z. B. WebLLM):* WebGPU gibt es seit iOS 26 in Safari; die Grenze ist der Speicher (Einzelpuffer ca. 256 MB–1 GB je nach Gerät, iOS beendet Seiten bei Speicherdruck ohne abfangbaren Fehler). Berichte: ein 4-Bit-Modell mit 1 Mrd. Parametern braucht etwa 700 MB Download und rund 900 MB GPU-Speicher und lädt die Seite auf iPhones teils neu. Nicht gefunden: Angaben, ob eine Home-Bildschirm-Web-App oder die Capacitor-WKWebView dieselbe Grenze hat. Erwartbar: nur Modelle bis etwa 1–3 Mrd. Parameter, deutsche Pläne mit striktem JSON dort unzuverlässig, Download Hunderte MB. *Apples Foundation-Models-Framework (geräteeigenes Modell, iOS 26+, Apple Intelligence aktiv, iPhone 15 Pro oder neuer):* passt zum iPhone 15 Pro Max mit iOS 27.2.1; strukturierte Ausgabe über Swift-Typen (`@Generable`), Kontextfenster etwa 4.096 Token (ein Auftrag mit Übungsliste und Verlauf ist größer und müsste verkleinert werden), kleines Modell; nur über ein natives Plugin in der `.ipa` erreichbar (ein fertiges Capacitor-Plugin dafür wurde nicht gefunden, es müsste geschrieben werden), nicht in der Web-App. Quellen: Entwicklerberichte und Blogs, keine Apple-Dokumentation; auf dem Gerät ungeprüft. **Empfehlung:** erst den Markdown-Austausch nutzen; die Apple-Variante lohnt, wenn kurze, eng geführte Aufträge (Auswertung, Anpassen einzelner Einheiten) reichen (Aufwand mittel: Swift-Plugin, Verkleinerung des Kontexts, Prüfung gegen dasselbe Antwortformat – `aiorder.ts` ist dafür quellenunabhängig); WebGPU im Browser rate ich wegen Speichergrenzen und Qualität ab.

## 24. Version 0.5.0 / 0.6.0: Komfortfunktionen, Pausensignal, Live-Aktivität (15.11.2026)

Auf Wunsch des Nutzers („alles außer 7“; Nr. 7 „links und rechts getrennt eintragen“ wird nicht gebaut) und ohne Zwischenprüfung gebaut; die Prüfschleife folgt gesammelt. Zielgerät iPhone 15 Pro Max mit iOS 27.2.1.

**Scheibenrechner.** Bei scheibenbeladenen Geräten steht unter dem Gewicht „Je Seite: 25 + 10“ (gleiche Scheiben zusammengefasst, z. B. „2 × 25“); Tippen öffnet eine Ansicht mit den Scheiben als Balken. Vorhandene Scheiben: Einstellungen → Scheiben (Standard 1,25 / 2,5 / 5 / 10 / 15 / 20 / 25 kg, zusätzlich 0,5 und 30 wählbar). Am Gerät: Zahl der Aufnahmen (Standard 2) und optionales Eigengewicht. Nicht darstellbare Gewichte werden mit möglichst wenigen Scheiben auf das nächste mögliche gerundet und so angezeigt („gerundet auf …“). `src/logic/plates.ts`.

**Aufwärmsätze.** Bei der ersten Übung mit Gewicht je Muskelgruppe der Einheit erscheint „Aufwärmsätze anlegen (z. B. 20 × 10, 30 × 5)“: aus dem heutigen Zielgewicht etwa 50 % × 10 und 70 % × 5, bei Ziel „Kraft“ zusätzlich 85 % × 2; gerundet auf die Stufen des Geräts, als Aufwärmsatz markiert (zählt nicht in die Statistik). Nicht bei Plattennummern. Abschaltbar (Einstellungen → Training). `src/logic/warmup.ts`.

**Anstrengung je Satz.** Nach dem Abhaken erscheint nicht blockierend „Noch möglich: 0 · 1 · 2 · 3+“ (`SetEntry.rir`, optional; erneutes Tippen nimmt es zurück). Der Steigerungsvorschlag nutzt es: obere Wiederholungsgrenze erreicht → es wird immer gesteigert (bei noch 2+ möglich ergänzt der Text einen Hinweis auf die Reserve); im Bereich, aber im Schnitt 3+ möglich → eine Stufe schwerer; im Schnitt keine Reserve → halten. Ohne Angabe gilt die bisherige Regel. Sichtbar im Verlauf der Einheit („noch 2“). Abschaltbar.

**Pausensignal.** Einstellungen → Training: „Aus · Ton · Vibration · Beides“ (in der Web-Version nur „Aus · Ton“) plus „10 Sekunden vorher ankündigen“ (kurzer Ton/kurze Vibration). Der Timer beruht auf Zeitstempeln (überlebt Sperren und Neustart). iPhone-App: Haptik und Ton im Vordergrund, bei gesperrtem Bildschirm eine zum Pausenende geplante lokale Mitteilung mit dem iOS-Standardton – nur wenn ein Signal gewählt ist (bei „Aus“ bleibt es still); wird bei „Überspringen“ oder neuem Satz gestrichen; die Erlaubnis fragt iOS beim ersten abgehakten Satz. Die 10-Sekunden-Vorwarnung kommt nicht erneut, wenn die Pause mit −15 schon in die letzten 10 Sekunden rutscht. Web-Version: Safari auf dem iPhone kennt keine Vibration (`navigator.vibrate` fehlt) – die Einstellung weist darauf hin („nur in der iPhone-App“), Ton und ein deutlicher Hinweis „Pause vorbei“ im Training bleiben.

**Automatische Sicherung.** iPhone-App: nach jedem abgeschlossenen Training wird still `Sicherungen/eisenzeit-sicherung-auto-<Datum>-<Zeit>.json` im Dokumentenordner der App abgelegt (Standard ohne Fotos, einstellbar; die letzten fünf bleiben). Die Dateien enthalten alle Daten **unverschlüsselt** (auch Körperwerte) und gehen mit dem Löschen der App verloren; sie gelten deshalb **nicht** als „Sicherung erledigt“ (die Erinnerung an eine echte Sicherung bleibt). Dafür setzt `ios-prepare.sh` `UIFileSharingEnabled` und `LSSupportsOpeningDocumentsInPlace` – sichtbar in „Dateien → Auf meinem iPhone → Eisenzeit“. **Nicht auf einem Gerät geprüft.** Web-Version: nach dem Training in der Zusammenfassung „Sicherung teilen“ (Teilen-Dialog bzw. Download).

**Feste Trainingstage mit Erinnerung.** Einstellungen → Trainingstage: Wochentage, Uhrzeit, Schalter „Erinnerung“. „Heute“ zeigt „Heute ist Trainingstag: <Einheit>“ (bis trainiert wurde), die Wochenübersicht umrandet geplante Tage. Die Erinnerung als wöchentliche lokale Mitteilung gibt es nur in der iPhone-App (iOS fragt die Erlaubnis erst beim Einschalten); in der Web-Version steht das klar dabei.

**Export.** Trainingsdaten als **CSV** für Excel (Semikolon, Dezimalkomma, UTF-8 mit BOM; Spalten Datum, Einheit, Übung, Gerät, Satz, Art, Gewicht, Gewichtseinheit, Wiederholungen, Anstrengung, Notiz; nur abgehakte Sätze abgeschlossener Einheiten; Aufwärmsätze ohne Satznummer; Text mit = + − @ am Anfang wird gegen Formelausführung in Excel mit einem Apostroph entschärft) unter Einstellungen → Sicherung, und die **Trainingszusammenfassung als Bild** (PNG, Kraftkultur-Farben) zum Teilen aus der Zusammenfassung. `src/logic/csv.ts`, `src/logic/summaryImage.ts` (Bild nur im Browser erzeugbar, nicht in Tests).

**Live-Aktivität „Training läuft“ – Schritt 1 (nur Anzeige; nicht auf einem Gerät oder Mac getestet).** Sperrbildschirm und Dynamic Island zeigen Einheit, aktuelle Übung, „Satz x von y“, Ziel (Gewicht × Wiederholungen), Fortschrittsbalken, laufende Trainingsdauer und – während der Pause – einen nativ mitlaufenden Countdown (kompakt, erweitert und minimal in der Dynamic Island). Start mit dem Trainingsmodus, Aktualisierung bei Satz, Übung und Pause, Ende beim Verlassen. Technik: Swift-Quellen unter `ipa-app/live-activity/` (`EisenzeitActivityAttributes` für App und Widget, Capacitor-Plugin `EisenzeitLiveActivity` mit `start/update/end`, eigene `EisenzeitViewController` zum Anmelden des Plugins, Widget-Erweiterung `EisenzeitWidget` mit `ActivityConfiguration` und Dynamic Island); `scripts/add-live-activity.rb` fügt mit der Ruby-Bibliothek `xcodeproj` Dateien, Ziel `EisenzeitWidget` (Bundle-Kennung `de.eisenzeit.app.LiveActivity`, iOS 16.2+), Einbetten in die App, `NSSupportsLiveActivities` und das Storyboard ein; JavaScript-Seite `platform.liveActivity` (nur in der iPhone-App wirksam, sonst ohne Wirkung), Zustand aus der Einheit `liveActivityState` (getestet). **Riskant eingebaut:** weil Xcode-Projekt, Widget und Signierung hier nicht ausprobiert werden konnten, ist die Live-Aktivität **nur auf Wunsch** im Bau: Actions → „Gym-App iOS“ → Run workflow → Haken „Live-Aktivität (Widget-Erweiterung) einbauen“ (Artefakt mit Zusatz `-live-aktivitaet`); die Tag-Builds/Releases bleiben ohne Erweiterung, damit die bewährte `.ipa` nicht gefährdet wird. Scheitert der Bau mit Haken, ist das Protokoll der Ausgangspunkt für die Korrektur. **Sideloading mit kostenloser Apple-ID:** Die Erweiterung braucht eine eigene App-Kennung (zusätzlich zu `de.eisenzeit.app`); nach Berichten der Hersteller kann das gegen die Grenzen kostenloser Apple-IDs (wenige aktive Apps, wenige neue Kennungen pro Woche) zählen – ungeprüft. Live-Aktivitäten müssen in iOS aktiv sein (Einstellungen → Eisenzeit → Live-Aktivitäten); iOS beendet sie nach spätestens 8 Stunden. **Schritt 2 (Bedienen: Gewicht −/+, Wiederholungen −/+, „Satz erledigt“, „Pause überspringen“ in der Kachel)** ist nicht gebaut: Er braucht App Intents (`LiveActivityIntent`, iOS 17+) und den verlustfreien Abgleich der in der Kachel eingetragenen Sätze; er folgt erst, wenn der Nutzer Schritt 1 auf dem iPhone bestätigt hat.

**Prüfliste für Schritt 1 (iPhone):** (1) `.ipa` mit Haken „Live-Aktivität“ bauen und installieren; (2) iOS-Einstellung „Live-Aktivitäten“ für Eisenzeit an; (3) Training starten → Kachel auf dem Sperrbildschirm und in der Dynamic Island sichtbar? (4) Satz abhaken → Satznummer und Fortschrittsbalken ändern sich? (5) Pause → Countdown läuft nativ weiter, auch bei gesperrtem Bildschirm? (6) Training beenden oder verwerfen → Kachel verschwindet? (7) App aus dem App-Wechsler schließen und neu öffnen mit laufendem Training → Kachel wieder aktuell? Bei Fehlern bitte Bildschirmfoto und, wenn der Bau scheitert, das Protokoll des Workflow-Laufs.

**Frühere Versionen bleiben erhalten (Wunsch des Nutzers, 15.11.2026).** Jede Version bekommt einen eigenen Tag `gym-app-v<Version>` und ein eigenes Release mit der `.ipa` – bestehende Tags und Releases werden nie überschrieben (das war schon so; jetzt als Regel dokumentiert). Neu für die Web-App: `.github/scripts/archive-versions.sh` baut beim Veröffentlichen die **neuesten drei** Versionen (Tags `gym-app-v…`; Obergrenze `KEEP=3` im Skript, auf Wunsch des Nutzers; ältere Web-Versionen entfallen, ihre `.ipa`-Releases bleiben unbegrenzt) und legt sie unter `/gym-app-archiv/<Version>/` ab – bewusst **neben** und nicht unter `/gym-app/`, weil der Service Worker der neuesten Version sonst die Archivseiten übernähme –, dazu die Übersicht `versionen.html` (Web-Version und Release je Version). Der iOS-Workflow stößt nach jedem Tag die Web-Veröffentlichung an, damit die neue Version sofort im Archiv steht. Grenzen: Archivierte Web-Versionen teilen sich den Browser-Speicher mit der neuesten (gleicher Ursprung) – Sicherung vor dem Wechsel; die Bauzeit der Web-Veröffentlichung bleibt durch die Obergrenze klein; ältere `.ipa` über eine neuere zu installieren kann an iOS scheitern (ungeprüft). Die zwei früheren Versionen aus dem alten Repository (0.1.x, 0.2.x) sind dort mit dem Zweig gelöscht worden und nicht mehr verfügbar.

**Prüfrunde zu 0.6.0 (drei Prüfer: Code, Bedienung/Plattform, Sichttest im iPhone-Format) – umgesetzt.** Live-Aktivität: Capacitor 8 erzeugt das Hauptfenster in einer `SceneDelegate`; das Skript `add-live-activity.rb` ersetzt dort ebenfalls `CAPBridgeViewController()` durch `EisenzeitViewController()` (sonst wäre das Plugin nie angemeldet worden), setzt das Bereitstellungsziel der App auf iOS 16.2 (ActivityKit), der Bau stellt die Ruby-Bibliothek `xcodeproj` sicher und prüft, dass `PlugIns/EisenzeitWidget.appex` in der App liegt; der Restzeit-Bereich der Pause wird in Swift nur einmal berechnet (kein Absturz bei Ablauf zwischen Prüfung und Anzeige). Weiter: `plateSlots` zählt als vom Nutzer geändertes Gerätefeld (Katalog-Updates überschreiben es nicht) und wird bei Sicherungs-Import geprüft (ebenso `rir`); der Scheibenrechner begrenzt Gewicht (0–2000 kg), Aufnahmen (1–8) und Scheibengrößen; mindestens eine Scheibe bleibt gewählt; Erinnerungen werden nach „Alle Daten löschen“ und Import abgeglichen; „Bild teilen“ fängt Fehler ab; das Zusammenfassungsbild passt Titel, Kennzahlen und Rekordzeilen an die Breite an (Zahlen bleiben vollständig); die Scheiben-Anzeige erscheint auch bei `loading = scheiben`, nicht bei Plattennummern, und sagt bei einer Aufnahme „Scheiben“ statt „Je Seite“; Dateinamen ohne Umlaute; Web-Ton wird beim ersten Tippen freigeschaltet; das ausgewählte Segment ist im Dunkelmodus jetzt neongelb (vorher unsichtbar); die Zeile „Noch möglich“ scrollt über die Pausenleiste. Bekannt/offen (nur notiert): Live-Aktivität startet/endet nur, solange die App läuft (kein Push); Dynamic Island erweitert zeigt keine Gesamtdauer; der Hinweis „Pause vorbei“ erscheint oben kurz über dem Titel; Aufwärmen-Label im Hellmodus 3,5:1 Kontrast.
