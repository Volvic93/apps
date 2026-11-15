# Apps

Sammlung meiner kleinen Apps. Jede App liegt in einem eigenen Ordner.

| App | Beschreibung | Web-App | Installieren |
|---|---|---|---|
| [**gym-app**](gym-app/) – *Eisenzeit* | Trainings-App für das eigene Fitnessstudio: Pläne, Training mit Pausentimer, Fortschritt, Geräte mit Foto. Oberfläche auf Deutsch, Einheiten in kg, alle Daten nur lokal auf dem Gerät. | <https://volvic93.github.io/apps/gym-app/> | [Web-App auf dem iPhone](gym-app/webapp/INSTALLATION.md) · [`.ipa` mit AltStore oder Sideloadly](gym-app/ipa-app/INSTALLATION.md) |
| [**video-app**](video-app/) – *Flimmerfrei* | Eigener Video-Browser fürs iPhone: öffnet youtube.com ganz normal, aber ohne Werbung, mit Wiedergabe im Hintergrund (auch bei gesperrtem iPhone), Bild-in-Bild und AirPlay. Enthält keinen Code von Google. | <https://volvic93.github.io/apps/video-app/> (Infoseite und Userscript) | [`.ipa` mit AltStore oder Sideloadly](video-app/ios/INSTALLATION.md) |

## Schnellstart für das iPhone

**Am einfachsten – als Web-App auf dem Home-Bildschirm:**
1. In **Safari** <https://volvic93.github.io/apps/gym-app/> öffnen.
2. **Teilen-Symbol** → **„Zum Home-Bildschirm“** → **„Hinzufügen“**.

Die ausführliche Anleitung mit allen Hinweisen steht in [gym-app/webapp/INSTALLATION.md](gym-app/webapp/INSTALLATION.md).

**Als echte iPhone-App (`.ipa`)** – mit AltStore oder Sideloadly, jeweils Schritt für Schritt: [gym-app/ipa-app/INSTALLATION.md](gym-app/ipa-app/INSTALLATION.md). Die `.ipa` steht unter [Releases](https://github.com/Volvic93/apps/releases).

## Ältere Versionen

Jede Version der iPhone-App bleibt dauerhaft erhalten; von der Web-App bleiben die neuesten drei Versionen im Archiv:

- **Alle Versionen auf einen Blick:** <https://volvic93.github.io/apps/versionen.html> (Web-Version und Release jeder Version).
- **iPhone-App (`.ipa`):** unter [Releases](https://github.com/Volvic93/apps/releases) hat jede Version ihren eigenen Eintrag „Eisenzeit x.y.z“ mit der `.ipa` unter *Assets*.
- **Web-App:** neueste Version unter <https://volvic93.github.io/apps/gym-app/>, die neuesten drei Versionen zusätzlich unter `https://volvic93.github.io/apps/gym-app-archiv/<Version>/` (ältere Web-Versionen werden nicht mehr vorgehalten, ihre `.ipa` aber schon).

Vor dem Wechsel auf eine ältere Version in der App eine **Sicherung exportieren**: Ältere Web-Versionen teilen sich den Speicher mit der neuesten, und eine ältere `.ipa` lässt sich nach iOS-Regeln eventuell nur nach Löschen der neueren App installieren (dabei gehen die Daten der App verloren).

## Aufbau des Repositorys

```
apps/
├─ README.md                    diese Datei
├─ site/                        Startseite der Web-Adresse (GitHub Pages)
├─ .github/workflows/
│  ├─ gym-app-webapp.yml        baut und veröffentlicht die Web-Seiten beider Apps (bei Änderungen auf main)
│  ├─ gym-app-ios.yml           baut die unsignierte .ipa der Gym-App (von Hand oder bei Tags gym-app-v…)
│  └─ video-app-ios.yml         baut die unsignierte .ipa von Flimmerfrei (von Hand oder bei Tags video-app-v…)
├─ .github/scripts/
│  └─ archive-versions.sh       baut die neuesten drei Web-Versionen ins Archiv und schreibt versionen.html
├─ gym-app/
│  ├─ README.md                 Überblick über die App
│  ├─ KONZEPT.md                Konzept, Entscheidungen, Umsetzungsstand
│  ├─ webapp/                   die App selbst (React, TypeScript, Vite) – läuft im Browser
│  └─ ipa-app/                  iOS-Hülle (Capacitor), Live-Aktivität (live-activity/) und Anleitung für die .ipa
└─ video-app/
   ├─ README.md                 Überblick über die App
   ├─ KONZEPT.md                Konzept, Entscheidungen, Umsetzungsstand
   ├─ core/                     Skript-Kern (Werbeblocker, Hintergrundwiedergabe, Bild-in-Bild) mit Tests
   ├─ web/                      Infoseite; dazu wird das Userscript veröffentlicht
   └─ ios/                      iPhone-App (Swift, WKWebView) und Anleitung für die .ipa
```
