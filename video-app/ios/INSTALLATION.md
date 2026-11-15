# Flimmerfrei als iPhone-App (`.ipa`) installieren

Flimmerfrei ist ein eigener, schlanker Browser für youtube.com mit Werbeblocker, Hintergrundwiedergabe, Bild-in-Bild und AirPlay. Die `.ipa` ist **unsigniert**: Du bringst sie mit einem Hilfsprogramm auf dein iPhone, das sie mit **deiner eigenen Apple-ID** signiert. Das geht ohne Mac und ohne bezahltes Entwicklerkonto.

Zwei Wege, beide für **Windows** beschrieben:

| | AltStore | Sideloadly |
|---|---|---|
| Ablauf | Einmal AltStore aufs iPhone bringen, dann Apps direkt auf dem iPhone hinzufügen | Programm am PC, `.ipa` hineinziehen, fertig |
| Erneuern (alle 7 Tage) | automatisch im Hintergrund, wenn PC und iPhone im selben WLAN sind | von Hand am PC (oder mit der Auto-Erneuerung des Programms, je nach Version) |
| Gut für | Dauerbetrieb ohne Kabel | schnelle Installation |

> **Stand der Anleitung: November 2026.** Die Oberflächen und Bedingungen von AltStore, Sideloadly und Apple ändern sich gelegentlich. Bei Abweichungen gelten die Anleitungen der Hersteller: <https://altstore.io> und <https://sideloadly.io>.

> **Hinweis:** Werbeblocker und Hintergrundwiedergabe widersprechen den Nutzungsbedingungen von YouTube. Die App ist für den privaten Gebrauch gedacht.

---

## 0. Die `.ipa` besorgen

Du brauchst die Datei **`Flimmerfrei-<Version>.ipa`** (bzw. `Flimmerfrei.ipa`).

**Weg A – Release (ohne Anmeldung, empfohlen):**
1. Im Repository auf der Startseite rechts auf **Releases** gehen (<https://github.com/Volvic93/apps/releases>).
2. Beim neuesten Eintrag **„Flimmerfrei &lt;Version&gt;“** unter *Assets* die `.ipa` herunterladen.

Releases entstehen, wenn ein Tag der Form `video-app-v0.1.0` gesetzt wird. Jede Version behält ihr eigenes Release.

**Weg B – Build-Artefakt (mit GitHub-Anmeldung):**
1. Im Repository **Actions** öffnen → Workflow **„Flimmerfrei iOS (unsignierte IPA)“** → den neuesten grünen Lauf.
2. Ganz unten unter **Artifacts** das ZIP `flimmerfrei-ios-ipa-…` herunterladen und entpacken. Darin liegt `Flimmerfrei.ipa`. (Artefakte sind 30 Tage abrufbar.)

Für Sideloadly und AltStore am Windows-PC reicht der Download am PC. Für AltStore auf dem iPhone kannst du die Datei auch direkt in Safari auf dem iPhone laden (landet in der Dateien-App unter „Downloads“).

---

## 1. Vorbereitung (für beide Wege)

**Am iPhone**
- Es wird **iOS 16 oder neuer** gebraucht (die App verlangt iOS 16.0; den „Entwicklermodus“ für selbst installierte Apps gibt es ebenfalls ab iOS 16).
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
7. **AltStore** öffnen → unten **„My Apps“** → oben links **„+“** → die Datei **`Flimmerfrei.ipa`** auswählen (aus der Dateien-App). AltStore fragt nach der Apple-ID und installiert die App.
8. **Flimmerfrei** liegt jetzt auf dem Home-Bildschirm.

**Erneuern:** Die Signatur gilt **7 Tage**. Solange **AltServer auf dem PC läuft** und PC und iPhone im **selben WLAN** sind, erneuert AltStore die App im Hintergrund. Alternativ in AltStore unter *My Apps* auf **„Refresh All“** tippen. Nach Ablauf lässt sich die App nicht mehr öffnen, bis sie erneuert wurde – **die Anmeldung bei YouTube bleibt dabei erhalten**.

**Grenzen kostenloser Apple-IDs** (nach den Angaben der Anbieter, Stand kann sich ändern): höchstens 3 aktive Apps gleichzeitig (AltStore zählt mit), und nur eine begrenzte Zahl neuer App-IDs pro Woche.

---

## 3. Weg 2: Sideloadly

1. **Sideloadly** von <https://sideloadly.io> herunterladen und installieren (iTunes/iCloud wie in Abschnitt 1).
2. iPhone per Kabel anschließen, Vertrauen bestätigen. Das iPhone erscheint oben im Programm bei **„iDevice“**.
3. Die Datei **`Flimmerfrei.ipa`** in das Fenster ziehen (oder auf das IPA-Symbol klicken und auswählen).
4. Im Feld **„Apple ID“** deine Apple-ID eintragen.
5. Auf **„Start“** klicken. Beim ersten Mal wird das **Passwort** abgefragt (bei Zwei-Faktor-Anmeldung zusätzlich der Code). Warten, bis „Done“ erscheint.
6. **Entwickler vertrauen:** *Einstellungen → Allgemein → VPN & Geräteverwaltung* → deine Apple-ID → **„Vertrauen“**.
7. **Entwicklermodus** einschalten: *Einstellungen → Datenschutz & Sicherheit → Entwicklermodus* → einschalten, neu starten und bestätigen. (Der Eintrag erscheint erst nach der ersten Installation.)
8. **Flimmerfrei** öffnen.

**Erneuern:** Nach **7 Tagen** läuft die Signatur ab. Dann am PC Sideloadly öffnen, iPhone anschließen und **dieselbe `.ipa` mit derselben Apple-ID** noch einmal mit **„Start“** installieren – **ohne** die App vorher zu löschen. Sideloadly bietet außerdem eine automatische Erneuerung an (in den erweiterten Einstellungen; je nach Version) – dafür muss der PC mit dem Programm laufen.

---

## 4. Updates

Neue `.ipa` laden und mit **derselben Apple-ID** über die alte installieren (AltStore: „+“, Sideloadly: „Start“). Die App **nicht vorher löschen**, sonst bist du bei YouTube abgemeldet. Die Bundle-Kennung (`de.flimmerfrei.app`) bleibt immer gleich.

---

## 5. Erste Schritte in der App

- **Aussehen:** Die App sieht aus wie YouTube selbst: obere Leiste, Videoliste, untere Leiste, alles kommt von der Seite. Hell und Dunkel folgen dem iPhone (änderbar unter *Einstellungen → Darstellung*). Statusleiste und Ränder nehmen die Farbe der Seite an.
- **Start:** Flimmerfrei öffnet `m.youtube.com`. Melde dich wie im Browser an; die Anmeldung bleibt gespeichert.
- **Zusätzliche Knöpfe in YouTubes Leisten:** In der oberen Leiste sitzen links neben der Suche zwei Symbole: **Übertragen** und **Menü der App**. Im Player kommen oben rechts **Übertragen**, **Bild-in-Bild** und **AirPlay** dazu (abschaltbar unter *Einstellungen → Knöpfe im Player*).
- **Menü der App:** Es öffnet sich als Auswahlblatt von unten – über das Menü-Symbol in der oberen Leiste, durch **Schütteln** des iPhones oder über den **Ersatzknopf**. Es enthält: Auf Fernseher übertragen, Bild-in-Bild, AirPlay, Neu laden, Link teilen, In Safari öffnen, Mit Google anmelden, Zurück, Startseite, Einstellungen. Bild-in-Bild und AirPlay sind ausgegraut, solange kein Video da ist.
- **Ersatzknopf:** Ein kleiner grauer, halbtransparenter Knopf mit drei Punkten. Er erscheint nur, wenn das Menü-Symbol in der Leiste fehlt (z. B. auf der Anmelde-Seite oder wenn YouTube umgebaut hat), oder immer, wenn du *Schwebenden Knopf immer anzeigen* einschaltest. Du kannst ihn mit dem Finger verschieben; er rastet am Rand ein.
- **Bild-in-Bild:** Video starten, Menü → **„Bild-in-Bild“** (oder das Symbol im Player). Das Video läuft in einem kleinen Fenster über anderen Apps weiter.
- **AirPlay:** Menü oder Player-Symbol → **„AirPlay“** öffnet die Geräteauswahl (Apple TV, AirPlay-Fernseher, Lautsprecher). AirPlay braucht den **AirPlay-Modus** (*Einstellungen → AirPlay-Modus (Versuch)*): Ist er aus, fragt die App beim Antippen, ob sie ihn einschalten soll; danach lädt die Seite neu und du tippst AirPlay noch einmal an. Im AirPlay-Modus überträgt YouTube das Video auf andere Art, die Auflösung kann geringer sein. Wer AirPlay nicht braucht, lässt ihn aus, damit Videos schnell starten.
- **Aktualisieren:** Auf Startseite, Abos und Listen nach unten ziehen (nicht im Player und nicht in Shorts).
- **Hintergrundwiedergabe:** Ton läuft weiter, wenn du die App verlässt oder das iPhone sperrt. Läuft er doch einmal nicht weiter, in der Sperrbildschirm-Steuerung auf Wiedergabe tippen.
- **Einstellungen:**
  - *Darstellung*: Automatisch, Hell, Dunkel.
  - *Werbeblocker* an/aus (lädt die Seite neu).
  - *Hintergrundwiedergabe* an/aus.
  - *Beim Verlassen automatisch Bild-in-Bild* (Versuch; Standard aus; iOS erlaubt es nicht in jeder Lage).
  - *Knöpfe im Player* und *Schwebenden Knopf immer anzeigen*.
  - *Blockierte Werbung*: Zähler; *Sperrliste*: zeigt, ob die Netz-Sperrliste geladen ist.
  - *Übertragungs-Protokoll*: Protokoll der Übertragung zur Fehlersuche (kopierbar).
  - *Browserdaten löschen*: meldet dich bei YouTube und Google ab.
- **Links aus anderen Apps:** Adressen der Form `flimmerfrei://open?url=<kodierte YouTube-Adresse>` öffnen die Seite in der App.
- **Fremde Seiten:** Verweise auf Seiten außerhalb von YouTube/Google öffnen sich in einer Safari-Ansicht, nicht in der App.

---

## Mit Google anmelden

1. In der App auf YouTubes **„Anmelden“** tippen – oder den schwebenden Knopf antippen oder per Schütteln das Menü öffnen → **„Mit Google anmelden“**.
2. Die Anmeldung läuft auf der Seite von Google selbst, in der App. Die App sieht dein Kennwort nicht und speichert es nicht.
3. Nach der Anmeldung lädt die App YouTube einmal neu, damit dein Konto sofort sichtbar ist. Die Anmeldung bleibt gespeichert.
4. **Passkey oder Sicherheitsschlüssel** funktionieren in der App möglicherweise nicht. Dann auf **„Andere Option wählen“** tippen und Kennwort, Bestätigung am Handy oder einen Code verwenden.
5. Abmelden: *Einstellungen → Browserdaten löschen* (mit Bestätigung; löscht auch alle anderen gespeicherten Web-Daten der App).

## Auf Chromecast oder Fernseher übertragen

Der Fernseher spielt das Video selbst (mit seiner eigenen YouTube-App); das iPhone ist nur Fernbedienung. Das Video läuft deshalb weiter, auch wenn du das iPhone sperrst.

1. Das **Übertragen-Symbol** in der oberen Leiste oder im Player antippen (oder Menü → *Auf Fernseher übertragen*). Es öffnet sich ein Blatt.
2. Beim ersten Mal fragt iOS nach dem Zugriff aufs **lokale Netzwerk**: **„Erlauben“** wählen, sonst findet die App keine Geräte. (Später änderbar unter *Einstellungen → Flimmerfrei → Lokales Netzwerk*.)
3. **Im WLAN gefundene Geräte** (Chromecast, Google TV, Android TV, Fernseher mit Chromecast) erscheinen in der Liste – iPhone und Gerät müssen im selben WLAN sein. Gerät antippen.
4. **Mit TV-Code** (Smart-TV, Konsole, Fire TV): In der YouTube-App am Fernseher *Einstellungen → Mit TV-Code verknüpfen* öffnen und den angezeigten Code im Blatt unter *Mit TV-Code verbinden* eingeben. Zuletzt verbundene Geräte lassen sich später erneut verbinden.
5. Nach dem Verbinden wird ein laufendes Video an der aktuellen Stelle zum Fernseher geschickt und am iPhone angehalten. Solange die Verbindung besteht, geht **jedes neu gestartete Video** automatisch an den Fernseher. Im Blatt gibt es Pause/Weiter, *Aktuelles Video senden* und *Trennen*.

Hinweise: Auf dem Fernseher spielt dessen YouTube-App – **Werbung dort kann die App nicht entfernen**. Dies ist neu und konnte bisher nicht an echten Geräten erprobt werden. Bei Problemen: *Einstellungen → Übertragungs-Protokoll → Kopieren* und das Protokoll weitergeben.

## 6. Wenn etwas nicht geht

| Problem | Lösung |
|---|---|
| iPhone wird in iTunes/Sideloadly nicht gefunden | Anderes Kabel/USB-Anschluss, iPhone entsperren, „Vertrauen“ bestätigen; iTunes und iCloud müssen von apple.com stammen, nicht aus dem Microsoft Store. |
| „Entwicklermodus“ fehlt in den Einstellungen | Er erscheint erst, nachdem AltStore oder die App einmal installiert wurde. Danach neu starten. |
| App meldet „Nicht vertrauenswürdiger Entwickler“ | *Einstellungen → Allgemein → VPN & Geräteverwaltung* → Apple-ID → Vertrauen. |
| App startet nicht mehr | Die 7 Tage sind abgelaufen: erneuern (Abschnitt 2 bzw. 3). Die Anmeldung bleibt erhalten. |
| Anmeldung mit der Apple-ID scheitert | Zwei-Faktor-Code prüfen; bei einigen Konten ein **App-spezifisches Passwort** erzeugen (appleid.apple.com → Anmelden und Sicherheit) und statt des normalen Passworts verwenden. |
| „Maximale Zahl an Apps erreicht“ | Mit einer kostenlosen Apple-ID sind nur wenige Apps gleichzeitig erlaubt: eine andere Test-App entfernen oder eine zweite Apple-ID verwenden. |
| Etwas verhält sich seltsam (Werbung, Ton, Knöpfe fehlen) | *Einstellungen → Diagnose* öffnen, **„Kopieren“** tippen und den Text mitschicken. |
| Es erscheint doch Werbung | YouTube ändert seine Seite laufend; der Werbeblocker kann zeitweise ausfallen, bis die App aktualisiert wird. Seite neu laden hilft manchmal. |
| Ton stoppt im Hintergrund | In den Einstellungen prüfen, ob *Hintergrundwiedergabe* an ist; Video einmal in der App starten. Nach einem Anruf ggf. Wiedergabe neu starten. |
| Bild-in-Bild geht nicht | Es muss ein Video laufen (Menüpunkt nicht ausgegraut). Manche Videos sperren es; dann das Video-Vollbild versuchen und von dort das Bild-in-Bild-Symbol des Players nutzen. |
| Keine Geräte beim Übertragen | Lokales Netzwerk für Flimmerfrei erlauben (*Einstellungen → Flimmerfrei*), iPhone und Gerät im selben WLAN, ggf. stattdessen den TV-Code verwenden. |
| Seite bleibt weiß/Fehlerseite | „Erneut versuchen“ tippen oder Menü → Neu laden. Hilft das nicht: *Einstellungen → Browserdaten löschen* (meldet ab). |

## 7. Datenschutz

Die Apple-ID gibst du nur in AltServer bzw. Sideloadly ein, nie in der Flimmerfrei-App. Die App selbst sendet keine Daten an eigene Server; sie lädt nur youtube.com bzw. Google-Seiten für die Anmeldung. Die App enthält weder Code noch Marken von Google.
