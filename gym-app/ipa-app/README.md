# Eisenzeit – iPhone-App (`ipa-app`)

Die iOS-Hülle für die Web-App aus [`../webapp`](../webapp). Sie besteht nur aus der [Capacitor](https://capacitorjs.com)-Konfiguration und einem Skript – das eigentliche `ios/`-Projekt wird bei jedem Bauen **frisch erzeugt** und ist deshalb nicht eingecheckt.

**Zum Installieren der fertigen `.ipa` auf dem iPhone:** [INSTALLATION.md](INSTALLATION.md) (AltStore und Sideloadly, Schritt für Schritt).

## Inhalt

```
ipa-app/
├─ capacitor.config.json   App-Kennung, Name, Quelle der Web-Dateien (../webapp/dist)
├─ package.json            Capacitor und die nativen Plugins (Kamera, Teilen, Haptik, Benachrichtigungen, Wachhalten)
├─ scripts/ios-prepare.sh  erzeugt das iOS-Projekt, setzt Kamera-/Foto-Texte, Hochformat und App-Symbol
└─ INSTALLATION.md         Anleitung für Nutzer
```

**Wichtig:** Die Bundle-Kennung `de.eisenzeit.app` (in `capacitor.config.json` und `scripts/ios-prepare.sh`) darf sich nie ändern. Mit einer neuen Kennung wäre es eine andere App mit leerem Speicher – die Daten der alten gingen verloren.

## `.ipa` bauen (ohne Mac, über GitHub Actions)

Der Workflow `.github/workflows/gym-app-ios.yml` läuft auf einem macOS-Runner und archiviert **ohne Signierung**. Er startet bewusst nicht bei jedem Push:

1. **Von Hand:** GitHub → *Actions* → „Gym-App iOS (unsignierte IPA)“ → *Run workflow*. Ergebnis: Artefakt `eisenzeit-ios-ipa-…` am Lauf (30 Tage abrufbar, Anmeldung nötig).
2. **Mit einem Tag:** `git tag gym-app-v0.3.0 && git push origin gym-app-v0.3.0`. Zusätzlich zum Artefakt entsteht ein **Release** mit `Eisenzeit-0.3.0.ipa` zum Download ohne Anmeldung. Die Versionsnummer wird aus dem Tag übernommen.

Der Lauf dauert etwa 10 bis 15 Minuten.

## Lokal auf einem Mac (optional)

```bash
cd gym-app/webapp && npm ci && npm run build
cd ../ipa-app && npm ci && bash scripts/ios-prepare.sh
open ios/App/App.xcodeproj
```
