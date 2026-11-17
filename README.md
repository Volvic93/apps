# Apps

Sammlung meiner kleinen Web-Apps. Jede App liegt in einem eigenen Ordner.

| App | Beschreibung | Web-App | Installieren |
|---|---|---|---|
| [**gym-app**](gym-app/) – *Eisenzeit* | Trainings-App für das eigene Fitnessstudio: Pläne, Training mit Pausentimer, Fortschritt, Geräte mit Foto. Oberfläche auf Deutsch, Einheiten in kg, alle Daten nur lokal auf dem Gerät. | <https://volvic93.github.io/apps/gym-app/> | [Web-App auf dem iPhone](gym-app/webapp/INSTALLATION.md) |

Dieses Repository enthält nur Web-Apps. Alles, woraus iPhone-Apps (`.ipa`) entstehen – die iOS-Hülle von Eisenzeit und die einzelnen Versionen als `.ipa` –, liegt seit dem 17.11.2026 in einem privaten Repository und wird hier nicht mehr angeboten.

## Schnellstart für das iPhone

1. In **Safari** <https://volvic93.github.io/apps/gym-app/> öffnen.
2. **Teilen-Symbol** → **„Zum Home-Bildschirm“** → **„Hinzufügen“**.

Die ausführliche Anleitung mit allen Hinweisen steht in [gym-app/webapp/INSTALLATION.md](gym-app/webapp/INSTALLATION.md).

## Ältere Versionen

Von der Web-App bleiben die neuesten drei Versionen im Archiv:

- **Alle Versionen auf einen Blick:** <https://volvic93.github.io/apps/versionen.html>
- **Web-App:** neueste Version unter <https://volvic93.github.io/apps/gym-app/>, die neuesten drei Versionen zusätzlich unter `https://volvic93.github.io/apps/gym-app-archiv/<Version>/`.

Vor dem Wechsel auf eine ältere Version in der App eine **Sicherung exportieren**: Ältere Web-Versionen teilen sich den Speicher mit der neuesten.

## Aufbau des Repositorys

```
apps/
├─ README.md                    diese Datei
├─ site/                        Startseite der Web-Adresse (GitHub Pages)
├─ .github/workflows/
│  ├─ gym-app-webapp.yml        baut und veröffentlicht die Web-Seite (bei Änderungen auf main)
│  └─ gym-app-version-tag.yml   stößt den Seitenbau nach einem neuen Tag gym-app-v… an (Web-Archiv)
├─ .github/scripts/
│  └─ archive-versions.sh       baut die neuesten drei Web-Versionen ins Archiv und schreibt versionen.html
└─ gym-app/
   ├─ README.md                 Überblick über die App
   ├─ KONZEPT.md                Konzept, Entscheidungen, Umsetzungsstand
   └─ webapp/                   die App selbst (React, TypeScript, Vite) – läuft im Browser
```

## Neue Version von Eisenzeit

1. Änderung an `gym-app/webapp/` auf `main` – die Web-App wird automatisch veröffentlicht.
2. Tag `gym-app-vX.Y.Z` setzen – die Version erscheint im Web-Archiv.
3. Für die iPhone-App denselben Tag im privaten Repository setzen; dessen Workflow holt die Web-App von hier (gleicher Tag) und baut daraus die `.ipa`.
