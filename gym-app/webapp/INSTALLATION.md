# Eisenzeit als Web-App auf dem iPhone

Die Web-App läuft im Browser, lässt sich aber wie eine richtige App auf den Home-Bildschirm legen (eigenes Symbol, kein Browser-Rahmen) und funktioniert danach auch ohne Internet. Dafür braucht es **keinen Mac, keinen Computer und keine Apple-ID**.

**Adresse der Web-App:** <https://volvic93.github.io/apps/gym-app/>

> Die echte iPhone-App (`.ipa`) wird nicht mehr öffentlich angeboten; sie liegt mit ihrer Anleitung im privaten Repository `Volvic93/Apps-IPA-Dateien` (`gym-app/ipa-app/INSTALLATION.md`). Die Web-App ist der einfachere Einstieg und hat im Kern denselben Funktionsumfang. Nur die iPhone-App (`.ipa`) kann Vibration, Mitteilungen/Erinnerungen, die automatische Sicherung in „Dateien“ und (optional) die Live-Aktivität; ein paar Kleinigkeiten (siehe unten) sind dort ebenfalls zuverlässiger.

---

## 1. Auf den Home-Bildschirm legen (Schritt für Schritt)

Das geht nur mit **Safari** (in anderen Browsern auf dem iPhone fehlt die Funktion teilweise).

1. **Safari** öffnen und die Adresse oben eingeben: `https://volvic93.github.io/apps/gym-app/`
   (Tipp: Die Adresse am Computer in eine Nachricht an dich selbst kopieren und auf dem iPhone antippen.)
2. Warten, bis die App geladen ist, und **einmal kurz benutzen** (z. B. durch die Reiter tippen). Beim ersten Öffnen lädt die App ihre Dateien für den Offline-Betrieb herunter – dafür ist Internet nötig.
3. Unten (oder oben rechts, je nach iOS-Version) auf das **Teilen-Symbol** tippen – das Quadrat mit dem Pfeil nach oben.
4. Im Menü nach unten wischen und **„Zum Home-Bildschirm“** wählen. (Wenn der Eintrag fehlt: ganz unten „Aktionen bearbeiten“ und ihn zu den Favoriten hinzufügen.)
5. Den Namen **„Eisenzeit“** stehen lassen und oben rechts auf **„Hinzufügen“** tippen.
6. Das Symbol „Eisenzeit“ liegt jetzt auf dem Home-Bildschirm. Ab jetzt immer **darüber** starten, nicht über Safari.

## 2. Alternative: mit einem Kurzbefehl

Wer die App lieber über einen eigenen Kurzbefehl starten will (z. B. auch in der Aktionstaste oder per Siri):

1. App **Kurzbefehle** öffnen → **„+“** → **„Aktion hinzufügen“**.
2. Nach **„URL“** suchen und die Aktion hinzufügen, dann die Adresse `https://volvic93.github.io/apps/gym-app/` eintragen.
3. Darunter die Aktion **„URLs in Safari öffnen“** (oder „Webseiten in Safari öffnen“) hinzufügen.
4. Oben auf den Namen tippen, **„Eisenzeit“** vergeben, dann über das **Teilen-/Info-Symbol** **„Zum Home-Bildschirm“** wählen.

Der Kurzbefehl öffnet die Seite in Safari. Für das Erlebnis ohne Browser-Rahmen ist **Abschnitt 1** besser.

## Kann ich die App als Datei auf dem iPhone ablegen und per Shortcut starten?

Nein, das geht nicht zuverlässig. Die App besteht aus vielen Dateien und braucht für Speicher, Offline-Betrieb und die Home-Bildschirm-Funktion eine HTTPS-Adresse. Eine lokal abgelegte `index.html` öffnet Safari ohne diese Funktionen; ein Kurzbefehl kann sie nicht als App starten. Nimm stattdessen die Web-App über **„Zum Home-Bildschirm“** (Abschnitt 1) oder die `.ipa` (privates Repository, siehe oben).

## Ältere Version der Web-App

Die Hauptadresse zeigt immer die neueste Version. Die neuesten drei Versionen bleiben unter `https://volvic93.github.io/apps/gym-app-archiv/<Version>/` erreichbar (ältere nur noch als `.ipa` im privaten Repository); die Übersicht aller Versionen steht unter <https://volvic93.github.io/apps/versionen.html>. Ältere Versionen teilen sich den Speicher mit der neuesten (gleiche Server-Adresse) – vor dem Wechsel in der App *Einstellungen → Sicherung exportieren*. Als eigenes Symbol auf dem Home-Bildschirm funktioniert eine ältere Version wie in Abschnitt 1 beschrieben, sie sollte aber nicht zusätzlich zur neuesten benutzt werden.

## 3. Wichtig zu wissen

- **Daten liegen nur auf dem Gerät.** Es gibt kein Konto und keine Cloud. Lege deshalb regelmäßig eine **Sicherung** an: In der App *Heute → Zahnrad → Sicherung*. Die Datei kannst du in der Dateien-App oder iCloud Drive ablegen.
- **Safari und Home-Bildschirm-App haben getrennte Daten.** Wer erst in Safari und dann über das Symbol arbeitet, sieht in der zweiten Variante eine leere App. Bleib bei einer Variante, am besten dem Symbol auf dem Home-Bildschirm. Zum Umziehen: Sicherung exportieren, in der anderen Variante importieren.
- **Web-App und `.ipa` haben ebenfalls getrennte Daten** – gleicher Weg über die Sicherungsdatei.
- **App nicht löschen**, ohne vorher zu sichern: Mit dem Symbol wird auch der lokale Speicher der Web-App entfernt.
- **Updates:** Wenn du die App mit Internetverbindung öffnest, lädt sie neue Versionen im Hintergrund. Nach dem Laden einmal die App schließen (im App-Wechsler nach oben wischen) und neu öffnen, dann ist die neue Version aktiv.
- **Kamera und Fotos:** Beim ersten Foto fragt iOS nach der Erlaubnis. Wenn du sie versehentlich verweigert hast: *Einstellungen → Safari → Kamera* bzw. *Einstellungen → Datenschutz & Sicherheit → Fotos*.
- **Einschränkungen im Browser:** Vibration beim Ende der Pause, das Wachhalten des Bildschirms und Erinnerungen sind in der Web-App auf dem iPhone nach Apples Regeln eingeschränkt. In der `.ipa`-Version funktionieren sie zuverlässiger.
- **Speicher:** iOS räumt den Speicher von Web-Seiten, die lange nicht benutzt wurden, unter Umständen auf. Eine App auf dem Home-Bildschirm ist davon nach Apples Angaben deutlich weniger betroffen – trotzdem gilt: **regelmäßig sichern**.

## 4. Auf dem Computer oder Android

- **Chrome oder Edge (Windows, Mac, Android):** Adresse öffnen, in der Adressleiste auf das Installieren-Symbol klicken (bzw. Menü → *App installieren*). Die App läuft dann in einem eigenen Fenster und offline.
- Die Daten gehören immer zum jeweiligen Browser-Profil und zu genau dieser Adresse.

## 5. Selbst ausführen (für Entwickler)

Voraussetzung: [Node.js](https://nodejs.org) ab Version 22.

```bash
cd gym-app/webapp
npm install
npm run dev        # Entwicklungsserver auf http://localhost:5173
```

Eigene gebaute Version lokal ansehen:

```bash
npm run build
npm run preview    # http://localhost:4173
```

Für das iPhone im selben WLAN: `npm run preview -- --host` und die angezeigte Netzwerk-Adresse in Safari öffnen. **Achtung:** Das „Zum Home-Bildschirm“-Hinzufügen mit Offline-Betrieb funktioniert nur über eine HTTPS-Adresse (wie die GitHub-Pages-Adresse oben); über `http://` im WLAN läuft die App nur online.
