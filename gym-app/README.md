# Eisenzeit – Trainings-App

Persönliche Trainings-App für ein Fitnessstudio: Pläne anlegen, Sätze und Gewichte protokollieren, Fortschritt als Kurven sehen, Geräte des eigenen Studios mit Foto, Einstellpunkten und Gewichtsstufen. Oberfläche auf Deutsch, Einheiten in kg. Alle Daten liegen nur lokal auf dem Gerät, gesichert wird über eine Export-/Importdatei.

**Ein Code, zwei Ausgaben** (die zweite liegt seit dem 17.11.2026 nicht mehr in diesem Repository):

| Ordner | Inhalt | Anleitung |
|---|---|---|
| [`webapp/`](webapp/) | Die App selbst (React, TypeScript, Vite, Dexie). Läuft im Browser, lässt sich auf den Home-Bildschirm legen und arbeitet offline. | [Web-App auf dem iPhone](webapp/INSTALLATION.md) |
| `ipa-app/` (privat) | Die iOS-Hülle (Capacitor) um die Web-App. Daraus entsteht die unsignierte `.ipa` für AltStore und Sideloadly. Liegt samt allen `.ipa`-Versionen im privaten Repository `Volvic93/Apps-IPA-Dateien`, Ordner `gym-app/ipa-app/`. | dort: `gym-app/ipa-app/INSTALLATION.md` |

Web-App online: <https://volvic93.github.io/apps/gym-app/>

Konzept, Entscheidungen und Umsetzungsstand: [KONZEPT.md](KONZEPT.md) (Stufen 1 bis 4 sind umgesetzt).

## So hängen die Ordner zusammen

- `ipa-app` baut **auf** `webapp` auf: Der Workflow `gym-app-ios.yml` im privaten Repository holt `webapp/` von hier (bei einem Tag `gym-app-vX.Y.Z` denselben Tag, sonst `main`), erzeugt den Produktions-Build (`webapp/dist`) und packt ihn mit der iOS-Hülle in die App. Für eine neue Version also erst hier taggen, dann dort.
- Die Web-App veröffentlicht der Workflow `.github/workflows/gym-app-webapp.yml` bei jeder Änderung an `webapp/` auf dem Branch `main`.
