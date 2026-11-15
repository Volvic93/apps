# Eisenzeit – Web-App (`webapp`)

Die App selbst: React, TypeScript, Vite, Dexie (IndexedDB), HashRouter, vite-plugin-pwa, Vitest. Läuft im Browser, ist offlinefähig und lässt sich auf den Home-Bildschirm legen. Alle Daten liegen nur lokal; Sicherung über eine Export-/Importdatei.

**Zum Installieren auf dem iPhone:** [INSTALLATION.md](INSTALLATION.md). Online: <https://volvic93.github.io/apps/gym-app/>

Konzept und Entscheidungen: [../KONZEPT.md](../KONZEPT.md).

## Entwickeln, testen, bauen

Voraussetzung: [Node.js](https://nodejs.org) ab Version 22 und npm.

```bash
cd gym-app/webapp
npm install
```

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver mit Live-Neuladen (http://localhost:5173) |
| `npm test` | Vitest-Tests (Datenmigration, Katalog, Sicherung, Pläne/Training, Fortschritt, Planung, Studio) |
| `npm run build` | Typprüfung + Produktions-Build nach `dist/` (inkl. Service Worker) |
| `npm run preview` | gebauten Stand lokal ansehen (http://localhost:4173) |
| `npm run icons` | App-Symbole (PWA, Favicon, iOS) neu erzeugen |
| `node scripts/geraetefotos.mjs` | Gerätefotos aus `geraete-fotos/eingang/` zuschneiden und nach `public/geraete/` legen |

Zum Testen im Handy-Format: Entwicklerwerkzeuge des Browsers → Geräteansicht (z. B. iPhone 14, 390 × 844).

## Ordnerstruktur

```
webapp/
├─ INSTALLATION.md, README.md
├─ package.json, vite.config.ts, tsconfig.json
├─ assets/            App-Symbol 1024 px (wird von ../ipa-app für die iOS-App verwendet)
├─ geraete-fotos/     eingang/ (neue Originale) · verarbeitet/ (erledigte Originale) – lokal, nicht im Repository
├─ public/            Icons, geraete/ (zugeschnittene, fest eingebaute Gerätefotos)
├─ scripts/           Foto- und Icon-Werkzeuge
├─ src/
│  ├─ data/           Datenbank (Dexie), Typen, Migrationen, Startkatalog, Studio-Geräte
│  ├─ logic/          Gewichtsstufen, Statistik, Fortschritt, Empfehlungen, Plan-Assistent, KI-Export/-Import, Sicherung, Scheibenrechner, Aufwärmsätze, CSV, Auto-Sicherung, Erinnerungen, Zusammenfassungsbild
│  ├─ platform/       Web- und Capacitor-Umsetzung (Kamera, Teilen, Vibration, Timer-Signal, Wachhalten, Mitteilungen, Auto-Sicherung, Live-Aktivität)
│  ├─ ui/             Bausteine, Gerätekarte, Diagramme, Muskelgrafik, Piktogramme
│  └─ screens/        Heute, Training, Pläne, Übungen & Geräte, Fortschritt, Einstellungen, Dein Studio
└─ tests/
```

Die Originalfotos aus dem Studio (mit teils sichtbaren Personen im Hintergrund) liegen bewusst **nicht** im Repository; veröffentlicht sind nur die zugeschnittenen Bilder in `public/geraete/` (bei drei davon sind Personen verpixelt, siehe `scripts/personen-unkenntlich.mjs`, das die Originale lokal voraussetzt).

## Wichtige Regeln beim Weiterentwickeln

- **Datenmodell ändern:** `DB_SCHEMA_VERSION` in `src/data/db.ts` erhöhen, einen Schritt in `src/data/migrations.ts` ergänzen (und bei neuen Indizes eine neue `db.version(n)` anlegen), Test ergänzen. Sicherungsdateien aus älteren Versionen werden damit automatisch hochgezogen.
- **Katalog ändern** (`katalog.ts`, `studio-geraete.ts`, `studio-lieferung3.ts`): `CATALOG_VERSION` erhöhen – dann spielt die App den Katalog beim nächsten Start ein. Eigene Änderungen des Nutzers (Namen, Notizen, ausgeblendet, eigene Einstellwerte, Fotos) bleiben dabei erhalten.
- **Bundle-Kennung `de.eisenzeit.app`** (in `../ipa-app/capacitor.config.json` und `../ipa-app/scripts/ios-prepare.sh`) nie ändern, sonst startet die iPhone-App mit leerem Speicher.
- **Hooks vor jedem frühen `return`** (React-Regel; abgesichert durch `tests/hooks-order.test.ts`).
- **Neue Gerätefotos:** Originale nach `geraete-fotos/eingang/`, Erkennung und Einbau nach Abschnitt 4a des Konzepts.

## Veröffentlichung

Die Web-App wird bei jeder Änderung an `webapp/` auf dem Branch `main` automatisch gebaut und über GitHub Pages veröffentlicht (Workflow `.github/workflows/gym-app-webapp.yml` im Repo-Stamm). Die Pfade im Build sind relativ (`base: './'`), deshalb läuft die App unter dem Unterpfad `/apps/gym-app/` genauso wie lokal.

## Lizenzen der verwendeten Bausteine

React, React Router, Vite, Vitest, Capacitor (MIT) · Dexie (Apache-2.0) · Workbox / vite-plugin-pwa (MIT).
