# Eisenzeit als iPhone-App (`.ipa`) installieren

Die `.ipa` ist die echte iPhone-App (Capacitor-Hülle um die Web-App). Sie ist **unsigniert**: Du bringst sie mit einem Hilfsprogramm auf dein iPhone, das sie mit **deiner eigenen Apple-ID** signiert. Das geht ohne Mac und ohne bezahltes Entwicklerkonto.

Zwei Wege, beide für **Windows** beschrieben:

| | AltStore | Sideloadly |
|---|---|---|
| Ablauf | Einmal AltStore aufs iPhone bringen, dann Apps direkt auf dem iPhone hinzufügen | Programm am PC, `.ipa` hineinziehen, fertig |
| Erneuern (alle 7 Tage) | automatisch im Hintergrund, wenn PC und iPhone im selben WLAN sind | von Hand am PC (oder mit der Auto-Erneuerung des Programms, je nach Version) |
| Gut für | Dauerbetrieb ohne Kabel | schnelle Installation |

> **Stand der Anleitung: November 2026.** Die Oberflächen und Bedingungen von AltStore, Sideloadly und Apple ändern sich gelegentlich. Bei Abweichungen gelten die Anleitungen der Hersteller: <https://altstore.io> und <https://sideloadly.io>.

> **Wenn dir das zu aufwendig ist:** Die [Web-App](../webapp/INSTALLATION.md) läuft ohne all das und lässt sich ebenfalls aufs Home-Bild legen.

---

## 0. Die `.ipa` besorgen

Du brauchst die Datei **`Eisenzeit-<Version>.ipa`** (bzw. `Eisenzeit.ipa`).

**Weg A – Release (ohne Anmeldung, empfohlen):**
1. Im Repository auf der Startseite rechts auf **Releases** gehen (<https://github.com/Volvic93/apps/releases>).
2. Beim neuesten Eintrag **„Eisenzeit &lt;Version&gt;“** unter *Assets* die `.ipa` herunterladen.

Releases entstehen, wenn ein Tag der Form `gym-app-v1.2.3` gesetzt wird (siehe [README](README.md)).

**Weg B – Build-Artefakt (mit GitHub-Anmeldung):**
1. Im Repository **Actions** öffnen → Workflow **„Gym-App iOS (unsignierte IPA)“** → den neuesten grünen Lauf.
2. Ganz unten unter **Artifacts** das ZIP `eisenzeit-ios-ipa-…` herunterladen und entpacken. Darin liegt `Eisenzeit.ipa`. (Artefakte sind 30 Tage abrufbar.)

Für Sideloadly und AltStore am Windows-PC reicht der Download am PC. Für AltStore auf dem iPhone kannst du die Datei auch direkt in Safari auf dem iPhone laden (landet in der Dateien-App unter „Downloads“).

---

## 1. Vorbereitung (für beide Wege)

**Am iPhone**
- Empfohlen ist iOS 16 oder neuer (den „Entwicklermodus“, der für selbst installierte Apps nötig ist, gibt es ab iOS 16). Die Anleitung wurde nicht mit allen iOS-Versionen geprüft.
- Eine **Apple-ID** (die normale, kostenlose reicht). Wenn du die Apple-ID nicht für fremde Programme verwenden möchtest, lege dir dafür eine zweite an.
- Das iPhone per **USB-Kabel** mit dem PC verbinden und auf dem iPhone **„Diesem Computer vertrauen“** bestätigen.

**Am Windows-PC – iTunes und iCloud**
- **iTunes** und **iCloud** installieren – und zwar die Versionen **von apple.com**, **nicht** aus dem Microsoft Store. (AltStore und Sideloadly brauchen die Apple-Treiber aus diesen Versionen.) Danach den PC neu starten, falls verlangt.
- iTunes einmal öffnen und das iPhone dort sehen lassen.

---

## 2. Weg 1: AltStore (mit automatischem Erneuern)

1. **AltServer** von <https://altstore.io> herunterladen und installieren. Er läuft danach als Symbol im Infobereich der Taskleiste (neben der Uhr; eventuell erst über den kleinen Pfeil sichtbar).
2. iPhone per Kabel anschließen. In **iTunes** das iPhone auswählen und unter *Zusammenfassung* **„Mit diesem iPhone über WLAN synchronisieren“** aktivieren (nötig für das automatische Erneuern ohne Kabel).
3. Auf das **AltServer-Symbol** in der Taskleiste klicken → **„Install AltStore“** → dein iPhone wählen → **Apple-ID und Passwort** eingeben (bei Zwei-Faktor-Anmeldung den Code, der auf deinem Gerät erscheint).
4. Auf dem iPhone erscheint nach kurzer Zeit die App **AltStore**.
5. **Entwickler vertrauen:** *Einstellungen → Allgemein → VPN & Geräteverwaltung* → deine Apple-ID antippen → **„Vertrauen“**.
6. **Entwicklermodus** einschalten: *Einstellungen → Datenschutz & Sicherheit → Entwicklermodus* → einschalten, iPhone neu starten, nach dem Neustart bestätigen. (Der Eintrag erscheint erst, nachdem AltStore installiert wurde.)
7. **AltStore** öffnen → unten **„My Apps“** → oben links **„+“** → die Datei **`Eisenzeit.ipa`** auswählen (aus der Dateien-App). AltStore fragt nach der Apple-ID und installiert die App.
8. **Eisenzeit** liegt jetzt auf dem Home-Bildschirm.

**Erneuern:** Die Signatur gilt **7 Tage**. Solange **AltServer auf dem PC läuft** und PC und iPhone im **selben WLAN** sind, erneuert AltStore die App im Hintergrund. Alternativ in AltStore unter *My Apps* auf **„Refresh All“** tippen. Nach Ablauf lässt sich die App nicht mehr öffnen, bis sie erneuert wurde – **die Daten bleiben dabei erhalten**.

**Grenzen kostenloser Apple-IDs** (nach den Angaben der Anbieter, Stand kann sich ändern): höchstens 3 aktive Apps gleichzeitig (AltStore zählt mit), und nur eine begrenzte Zahl neuer App-IDs pro Woche.

---

## 3. Weg 2: Sideloadly

1. **Sideloadly** von <https://sideloadly.io> herunterladen und installieren (iTunes/iCloud wie in Abschnitt 1).
2. iPhone per Kabel anschließen, Vertrauen bestätigen. Das iPhone erscheint oben im Programm bei **„iDevice“**.
3. Die Datei **`Eisenzeit.ipa`** in das Fenster ziehen (oder auf das IPA-Symbol klicken und auswählen).
4. Im Feld **„Apple ID“** deine Apple-ID eintragen.
5. Auf **„Start“** klicken. Beim ersten Mal wird das **Passwort** abgefragt (bei Zwei-Faktor-Anmeldung zusätzlich der Code). Warten, bis „Done“ erscheint.
6. **Entwickler vertrauen:** *Einstellungen → Allgemein → VPN & Geräteverwaltung* → deine Apple-ID → **„Vertrauen“**.
7. **Entwicklermodus** einschalten: *Einstellungen → Datenschutz & Sicherheit → Entwicklermodus* → einschalten, neu starten und bestätigen. (Der Eintrag erscheint erst nach der ersten Installation.)
8. **Eisenzeit** öffnen.

**Erneuern:** Nach **7 Tagen** läuft die Signatur ab. Dann am PC Sideloadly öffnen, iPhone anschließen und **dieselbe `.ipa` mit derselben Apple-ID** noch einmal mit **„Start“** installieren – **ohne** die App vorher zu löschen. Sideloadly bietet außerdem eine automatische Erneuerung an (in den erweiterten Einstellungen; je nach Version) – dafür muss der PC mit dem Programm laufen.

---

## 4. Nach der Installation und bei Updates

- **Daten:** Alles liegt nur auf dem iPhone. Lege vor jedem Update und regelmäßig eine **Sicherung** an: *Heute → Zahnrad → Sicherung*. Die Datei in der Dateien-App oder iCloud Drive speichern.
- **Update installieren:** Neue `.ipa` laden und mit **derselben Apple-ID** über die alte installieren (AltStore: „+“, Sideloadly: „Start“). Die App **nicht vorher löschen** – sonst sind die Daten weg. Die Bundle-Kennung der App (`de.eisenzeit.app`) bleibt immer gleich, damit die Daten erhalten bleiben.
- **Web-App und `.ipa` haben getrennte Daten.** Zum Umziehen: Sicherung in der einen Ausgabe exportieren, in der anderen importieren.
- **Kamera und Fotos:** Beim ersten Foto fragt iOS nach der Erlaubnis.

## 5. Wenn etwas nicht klappt

| Problem | Lösung |
|---|---|
| iPhone wird in iTunes/Sideloadly nicht gefunden | Anderes Kabel/USB-Anschluss, iPhone entsperren, „Vertrauen“ bestätigen; iTunes und iCloud müssen von apple.com stammen, nicht aus dem Microsoft Store. |
| „Entwicklermodus“ fehlt in den Einstellungen | Er erscheint erst, nachdem AltStore oder die App einmal installiert wurde. Danach neu starten. |
| App meldet „Nicht vertrauenswürdiger Entwickler“ | *Einstellungen → Allgemein → VPN & Geräteverwaltung* → Apple-ID → Vertrauen. |
| App startet nicht mehr | Die 7 Tage sind abgelaufen: erneuern (Abschnitt 2 bzw. 3). Daten bleiben erhalten. |
| Anmeldung mit der Apple-ID scheitert | Zwei-Faktor-Code prüfen; bei einigen Konten ein **App-spezifisches Passwort** erzeugen (appleid.apple.com → Anmelden und Sicherheit) und statt des normalen Passworts verwenden. |
| „Maximale Zahl an Apps erreicht“ | Mit einer kostenlosen Apple-ID sind nur wenige Apps gleichzeitig erlaubt: eine andere Test-App entfernen oder eine zweite Apple-ID verwenden. |

## 6. Datenschutz

Die Apple-ID gibst du nur in AltServer bzw. Sideloadly ein, nie in der Eisenzeit-App. Die App selbst sendet keine Daten ins Internet; alles bleibt lokal auf dem iPhone.
