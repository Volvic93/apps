# Flimmerfrei

Eigener Video-Browser fürs iPhone. Öffnet youtube.com ganz normal – Anmeldung, Abos, Verlauf, Kommentare – und bringt mit, was sonst nur ein Browser wie Brave kann:

- **keine Werbung** (Netz-Sperrliste plus Skript, das Werbung aus den Antworten der Seite entfernt)
- **Wiedergabe im Hintergrund**, auch bei gesperrtem oder minimiertem iPhone
- **Bild-in-Bild** auf Knopfdruck
- **AirPlay** auf Apple TV und andere AirPlay-Geräte
- **Übertragen auf Chromecast und Fernseher** – Geräte im WLAN oder per TV-Code (nur iPhone-App)
- **Anmeldung mit dem Google-Konto** auf Googles eigener Seite
- **aufgebaut wie die YouTube-App**: Die Zusatzknöpfe sitzen in YouTubes eigenen Leisten und im Player, eine eigene Browser-Oberfläche gibt es nicht

Die App enthält keinen Code und keine Marken von Google; sie ist eine Web-Ansicht mit eigenem Skript. Name und App-Symbol sind bewusst eigene.

## Installieren

| Weg | Für wen | Anleitung |
|---|---|---|
| **iPhone-App (`.ipa`)** | volle Funktion | [ios/INSTALLATION.md](ios/INSTALLATION.md) – die `.ipa` liegt unter [Releases](https://github.com/Volvic93/apps/releases) („Flimmerfrei x.y.z“) |
| **Userscript** | Safari mit der Erweiterung „Userscripts“ oder Browser am Rechner mit Violentmonkey/Tampermonkey | <https://volvic93.github.io/apps/video-app/> |

## Aufbau

```
video-app/
├─ KONZEPT.md   Konzept, Schnittstellen, Grenzen, Umsetzungsstand
├─ core/        Skript-Kern (reines JavaScript, ohne Abhängigkeiten)
├─ web/         Infoseite für https://volvic93.github.io/apps/video-app/
└─ ios/         iPhone-App (Swift, UIKit, WKWebView; Projekt per XcodeGen)
```

Die gesamte YouTube-spezifische Logik steckt in `core/`. App und Userscript verwenden dasselbe Skript.

## Entwickeln

```bash
cd video-app/core
node build.mjs        # erzeugt dist/flimmerfrei.inject.js und dist/flimmerfrei.user.js
node --test test/     # Tests
```

Die `.ipa` baut der Workflow `.github/workflows/video-app-ios.yml` auf einem macOS-Runner (von Hand, bei Pushes auf Zweige `video-app*` oder bei Tags `video-app-vX.Y.Z`; bei Tags entsteht zusätzlich ein Release).

## Grenzen

- YouTube ändert seine Seite laufend; Werbeblocker und Hintergrundwiedergabe können zeitweise ausfallen, bis der Kern angepasst ist.
- Das Übertragen auf Chromecast/Fernseher nutzt eine inoffizielle Schnittstelle von YouTube. Auf dem Fernseher spielt dessen eigene YouTube-App; Werbung dort kann die App nicht entfernen.
- Ohne Apple-Entwicklerkonto muss die App alle 7 Tage neu signiert werden (AltStore erledigt das automatisch).
- Werbeblocker und Hintergrundwiedergabe widersprechen den Nutzungsbedingungen von YouTube. Die App ist für den privaten Gebrauch gedacht.
