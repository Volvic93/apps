# Apps

Sammlung meiner kleinen Apps. Jede App liegt in einem eigenen Ordner.

| App | Beschreibung | Web-App | Installieren |
|---|---|---|---|
| [**gym-app**](gym-app/) – *Eisenzeit* | Trainings-App für das eigene Fitnessstudio: Pläne, Training mit Pausentimer, Fortschritt, Geräte mit Foto. Oberfläche auf Deutsch, Einheiten in kg, alle Daten nur lokal auf dem Gerät. | <https://volvic93.github.io/apps/gym-app/> | [Web-App auf dem iPhone](gym-app/webapp/INSTALLATION.md) · [`.ipa` mit AltStore oder Sideloadly](gym-app/ipa-app/INSTALLATION.md) |

## Schnellstart für das iPhone

**Am einfachsten – als Web-App auf dem Home-Bildschirm:**
1. In **Safari** <https://volvic93.github.io/apps/gym-app/> öffnen.
2. **Teilen-Symbol** → **„Zum Home-Bildschirm“** → **„Hinzufügen“**.

Die ausführliche Anleitung mit allen Hinweisen steht in [gym-app/webapp/INSTALLATION.md](gym-app/webapp/INSTALLATION.md).

**Als echte iPhone-App (`.ipa`)** – mit AltStore oder Sideloadly, jeweils Schritt für Schritt: [gym-app/ipa-app/INSTALLATION.md](gym-app/ipa-app/INSTALLATION.md). Die `.ipa` steht unter [Releases](https://github.com/Volvic93/apps/releases).

## Aufbau des Repositorys

```
apps/
├─ README.md                    diese Datei
├─ site/                        Startseite der Web-Adresse (GitHub Pages)
├─ .github/workflows/
│  ├─ gym-app-webapp.yml        baut und veröffentlicht die Web-App (bei Änderungen auf main)
│  └─ gym-app-ios.yml           baut die unsignierte .ipa (von Hand oder bei Tags gym-app-v…)
└─ gym-app/
   ├─ README.md                 Überblick über die App
   ├─ KONZEPT.md                Konzept, Entscheidungen, Umsetzungsstand
   ├─ webapp/                   die App selbst (React, TypeScript, Vite) – läuft im Browser
   └─ ipa-app/                  iOS-Hülle (Capacitor) und Anleitung für die .ipa
```
