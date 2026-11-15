# Eisenzeit – iPhone-App (`ipa-app`)

Die iOS-Hülle für die Web-App aus [`../webapp`](../webapp). Sie besteht nur aus der [Capacitor](https://capacitorjs.com)-Konfiguration und einem Skript – das eigentliche `ios/`-Projekt wird bei jedem Bauen **frisch erzeugt** und ist deshalb nicht eingecheckt.

**Zum Installieren der fertigen `.ipa` auf dem iPhone:** [INSTALLATION.md](INSTALLATION.md) (AltStore und Sideloadly, Schritt für Schritt).

## Inhalt

```
ipa-app/
├─ capacitor.config.json   App-Kennung, Name, Quelle der Web-Dateien (../webapp/dist)
├─ package.json            Capacitor und die nativen Plugins (Kamera, Teilen, Haptik, Benachrichtigungen, Wachhalten)
├─ scripts/ios-prepare.sh  erzeugt das iOS-Projekt, setzt Kamera-/Foto-Texte, Hochformat, „Dateien“-Sichtbarkeit und App-Symbol
├─ scripts/add-live-activity.rb  baut optional die Live-Aktivität (Widget-Erweiterung) in das Xcode-Projekt ein
├─ live-activity/          Swift-Quellen der Live-Aktivität (Shared, App-Plugin, Widget) – nur bei LIVE_ACTIVITY=1
└─ INSTALLATION.md         Anleitung für Nutzer
```

**Wichtig:** Die Bundle-Kennung `de.eisenzeit.app` (in `capacitor.config.json` und `scripts/ios-prepare.sh`) darf sich nie ändern. Mit einer neuen Kennung wäre es eine andere App mit leerem Speicher – die Daten der alten gingen verloren.

## `.ipa` bauen (ohne Mac, über GitHub Actions)

Der Workflow `.github/workflows/gym-app-ios.yml` läuft auf einem macOS-Runner und archiviert **ohne Signierung**. Er startet bewusst nicht bei jedem Push:

1. **Von Hand:** GitHub → *Actions* → „Gym-App iOS (unsignierte IPA)“ → *Run workflow*. Ergebnis: Artefakt `eisenzeit-ios-ipa-…` am Lauf (30 Tage abrufbar, Anmeldung nötig).
2. **Mit einem Tag:** `git tag gym-app-v<Version> && git push origin gym-app-v<Version>` (z. B. `gym-app-v0.4.0`; der Tag darf noch nicht existieren). Zusätzlich zum Artefakt entsteht ein **Release** mit `Eisenzeit-<Version>.ipa` zum Download ohne Anmeldung. Die Versionsnummer der `.ipa` wird aus dem Tag übernommen; die Anzeige in der App kommt aus `APP_VERSION` (`webapp/src/logic/backup.ts`) – vor einem Tag beides und die beiden `package.json` auf dieselbe Nummer setzen.

Der Lauf dauert etwa 10 bis 15 Minuten.

**Live-Aktivität (optional, ungetestet):** Beim Start von Hand gibt es die Eingabe „Live-Aktivität (Widget-Erweiterung) einbauen“ (Standard aus). Mit Haken enthält die `.ipa` zusätzlich die Erweiterung; Tag-Builds/Releases enthalten sie nie.

**Versionsregel:** Jede neue Version bekommt einen **neuen Tag** und damit ein **neues Release** (`gym-app-v<Version>`); bestehende Tags und Releases werden nie überschrieben oder gelöscht, damit ältere Stände installierbar bleiben. Nach jedem Tag baut der Web-Workflow zusätzlich ein Archiv der neuesten drei Web-Versionen (`/gym-app-archiv/<Version>/`) und die Übersicht `versionen.html` (alle Versionen mit Link zum Release).

## Lokal auf einem Mac (optional)

```bash
cd gym-app/webapp && npm ci && npm run build
cd ../ipa-app && npm ci && bash scripts/ios-prepare.sh
open ios/App/App.xcodeproj
```
