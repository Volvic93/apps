# Eisenzeit – Trainings-App

Persönliche Trainings-App für ein Fitnessstudio: Pläne anlegen, Sätze und Gewichte protokollieren, Fortschritt als Kurven sehen, Geräte des eigenen Studios mit Foto, Einstellpunkten und Gewichtsstufen. Oberfläche auf Deutsch, Einheiten in kg. Alle Daten liegen nur lokal auf dem Gerät, gesichert wird über eine Export-/Importdatei.

**Ein Code, zwei Ausgaben:**

| Ordner | Inhalt | Anleitung |
|---|---|---|
| [`webapp/`](webapp/) | Die App selbst (React, TypeScript, Vite, Dexie). Läuft im Browser, lässt sich auf den Home-Bildschirm legen und arbeitet offline. | [Web-App auf dem iPhone](webapp/INSTALLATION.md) |
| [`ipa-app/`](ipa-app/) | Die iOS-Hülle (Capacitor) um die Web-App. Daraus entsteht die unsignierte `.ipa` für AltStore und Sideloadly. | [`.ipa` installieren](ipa-app/INSTALLATION.md) |

Web-App online: <https://volvic93.github.io/apps/gym-app/>

Konzept, Entscheidungen und Umsetzungsstand: [KONZEPT.md](KONZEPT.md) (Stufen 1 bis 4 sind umgesetzt).

## So hängen die Ordner zusammen

- `ipa-app` baut **auf** `webapp` auf: Erst wird in `webapp` der Produktions-Build erzeugt (`webapp/dist`), dann packt die iOS-Hülle diesen Build in die App. Beides übernimmt der Workflow `.github/workflows/gym-app-ios.yml`.
- Die Web-App veröffentlicht der Workflow `.github/workflows/gym-app-webapp.yml` bei jeder Änderung an `webapp/` auf dem Branch `main`.
