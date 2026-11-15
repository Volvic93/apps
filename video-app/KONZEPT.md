# Flimmerfrei – Konzept

Stand: 15.11.2026 · Version 0.1.0 · Ordner `video-app/` im Repository `Volvic93/apps`

## 1. Ziel

Eine eigene, schlanke iPhone-App, die **youtube.com ganz normal öffnet** (Anmeldung, Abos, Verlauf, Kommentare – alles wie im Browser) und dabei das kann, was der Browser Brave auf youtube.com kann:

| Wunsch | Umsetzung | Stufe |
|---|---|---|
| YouTube normal nutzen | Eingebettete Web-Ansicht (WKWebView) mit Safari-Kennung, lädt `https://m.youtube.com` | 1 |
| Google-Anmeldung | Anmeldung direkt auf der Google-Seite in der Web-Ansicht (Abschnitt 5a); bleibt über App-Neustarts erhalten | 1 |
| Werbeblocker | Netz-Sperrliste (WKContentRuleList) + Skript, das Werbe-Einträge aus den Antworten von YouTube entfernt + Ausblenden von Werbeflächen + Notausgang (läuft doch eine Werbung, wird sie übersprungen) | 1 |
| Weiterspielen bei gesperrtem/minimiertem iPhone | Hintergrund-Audio (`UIBackgroundModes: audio`, Audio-Sitzung „playback“) + Skript, das der Seite vorspielt, sie sei sichtbar, und ungewolltes Pausieren rückgängig macht | 1 |
| Bild-in-Bild (Video im kleinen Fenster) | Knopf in der App, der das laufende Video ins Bild-in-Bild-Fenster schickt; Sperren von YouTube dagegen werden aufgehoben | 1 |
| Teilen auf Apple-Geräte (AirPlay) | AirPlay in der Web-Ansicht erlaubt + Knopf „AirPlay“ | 1 |
| Chromecast | **Nicht in Stufe 1.** Google gibt den YouTube-Empfänger auf dem Chromecast nur für die eigene App frei; im Web gibt es Cast nur in Chrome am Rechner. Möglicher späterer Weg: Kopplung „Mit TV-Code verbinden“ über die inoffizielle Fernseh-Schnittstelle von YouTube (wackelig, kann jederzeit brechen) | 2 |

**Warum keine Reparatur der alten IPA:** `YouTubePlus_v13.02.9` ist die Original-YouTube-App von 2018 mit eingeschleusten Fremd-Bibliotheken (`libuasharedtools`, `MobileSubstrate`, Flurry-Analyse). So alte App-Versionen bedient YouTube nicht mehr; reparieren hieße, Googles Programm neu zu patchen und weiterzugeben – technisch von Windows aus nicht machbar und rechtlich nicht veröffentlichbar. Die neue App enthält **keinen** Code und keine Marken von Google; sie ist ein spezialisierter Browser.

**Warum keine reine Web-App:** Eine Seite auf `volvic93.github.io` darf youtube.com weder einbetten noch verändern (Browser-Sicherheitsregeln). Der Web-Teil ist deshalb ein **Userscript** – dasselbe Skript, das auch in der App steckt – für Safari (mit der kostenlosen Erweiterung „Userscripts“) oder für Brave/Firefox/Chrome am Rechner (Violentmonkey/Tampermonkey), plus eine Infoseite mit Anleitung.

Hinweis: Werbeblocker und Hintergrundwiedergabe widersprechen den Nutzungsbedingungen von YouTube. Die App ist für den privaten Gebrauch gedacht.

## 2. Aufbau

```
video-app/
├─ KONZEPT.md          diese Datei (verbindlich)
├─ README.md
├─ core/               Skript-Kern (reines JavaScript, keine Abhängigkeiten)
│  ├─ src/             Module: adblock, background, pip, bridge, config, index
│  ├─ rules/content-blocker.json   Netz-Sperrliste im WebKit-Format
│  ├─ test/            Tests mit `node --test`
│  ├─ build.mjs        baut dist/
│  └─ dist/            (nicht eingecheckt) flimmerfrei.inject.js, flimmerfrei.user.js
├─ web/                Infoseite für GitHub Pages (…/apps/video-app/)
└─ ios/                iPhone-App (Swift, UIKit, XcodeGen)
   ├─ project.yml
   ├─ Sources/
   ├─ Resources/       Assets.xcassets (App-Symbol), Info.plist
   ├─ scripts/
   └─ INSTALLATION.md
```

Ein Kern, zwei Hüllen: `core/` ist die einzige Stelle mit YouTube-spezifischer Logik. Ändert YouTube etwas, wird nur dort nachgezogen.

## 3. Schnittstelle Kern ↔ Hüllen (verbindlich für beide Bau-Teile)

### 3.1 Dateien aus dem Kern

- `core/dist/flimmerfrei.inject.js` – ein einzelnes, in sich geschlossenes Skript (IIFE, kein `import`/`export`), wird **bei Dokumentbeginn im Seitenkontext, nur im Hauptrahmen** ausgeführt. Muss mehrfaches Laden vertragen (Schutz über `window.__flimmerfrei`).
- `core/dist/flimmerfrei.user.js` – dasselbe mit Userscript-Kopf (`@match https://*.youtube.com/*`, `@run-at document-start`, `@grant none`, `@inject-into page`, `@version`, `@name Flimmerfrei`, `@downloadURL`/`@updateURL` = `https://volvic93.github.io/apps/video-app/flimmerfrei.user.js`).
- `core/rules/content-blocker.json` – WKContentRuleList. Einschränkungen des WebKit-Formats beachten: in `url-filter` **kein** `|` (keine Alternativen), **keine** `{n}`-Wiederholungen, keine `\d`/`\w`-Kürzel, nur ASCII; höchstens ca. 200 Regeln. Nur Werbe-/Mess-Adressen sperren (z. B. `doubleclick.net`, `googlesyndication.com`, `googleadservices.com`, `youtube.com/pagead/`, `youtube.com/api/stats/ads`, `youtube.com/ptracking`, `youtube.com/get_midroll_`), **nichts**, was Wiedergabe, Anmeldung oder Vorschaubilder braucht (`googlevideo.com`, `ytimg.com`, `accounts.google.com`, `youtubei/v1/player` usw. bleiben frei).
- Bauen: `node build.mjs` im Ordner `core/` (Node ≥ 20, keine `npm install` nötig). Tests: `node --test test/`.

### 3.2 Einstellungen

Die Hülle darf **vor** dem Skript setzen:

```js
window.__FLIMMERFREI_CONFIG__ = { adblock: true, background: true, pipFix: true, host: 'ios' /* oder 'userscript' */ };
```

Fehlt das Objekt oder ein Feld, gilt der Standard (alles `true`, `host: 'userscript'`).

### 3.3 Objekt im Seitenkontext

```js
window.__flimmerfrei = {
  version: '0.1.0',
  pip(),            // Bild-in-Bild für das aktive Video umschalten → true/false (false = kein Video)
  airplay(),        // AirPlay-Auswahl öffnen (webkitShowPlaybackTargetPicker) → true/false
  state(),          // { hasVideo, playing, pip, title, url, adsBlocked }
  setConfig(teil),  // Einstellungen im Betrieb ändern, z. B. { background: false }
};
```

### 3.4 Meldungen an die App

Wenn `window.webkit?.messageHandlers?.flimmerfrei` existiert, schickt der Kern bei Änderungen (Start/Pause, neues Video, Bild-in-Bild an/aus, Seitenwechsel) gedrosselt (höchstens alle 250 ms):

```js
postMessage({ type: 'state', hasVideo, playing, pip, title, url, adsBlocked })
```

Andere Meldungstypen gibt es in Stufe 1 nicht. Die App muss unbekannte Typen ignorieren.

## 4. Kern im Detail

1. **Werbeblocker (`adblock.js`)**
   - Antworten bereinigen: `JSON.parse`, `Response.prototype.json` und die Setter von `window.ytInitialPlayerResponse` / `window.ytInitialData` einhängen; aus Objekten die Schlüssel `adPlacements`, `adSlots`, `playerAds`, `adBreakHeartbeatParams` entfernen (rekursiv, mit Tiefen-/Größenbremse, nie Ausnahmen nach außen werfen – im Fehlerfall das Original unverändert zurückgeben).
   - Listen bereinigen: Einträge entfernen, deren Inhalt ein Werbe-Renderer ist (`adSlotRenderer`, `promotedSparklesWebRenderer`, `promotedVideoRenderer`, `compactPromotedVideoRenderer`, `displayAdRenderer`, `inFeedAdLayoutRenderer`, `statementBannerRenderer`, `mastheadAdRenderer`, `bannerPromoRenderer`), auch wenn sie in `richItemRenderer.content` oder `itemSectionRenderer.contents` stecken.
   - Flächen ausblenden: ein `<style>` mit den passenden Selektoren für Mobil- und Desktop-Seite (`ytm-promoted-sparkles-web-renderer`, `ytm-companion-ad-renderer`, `ytd-ad-slot-renderer`, `ytd-in-feed-ad-layout-renderer`, `#masthead-ad`, `.ytp-ad-module`, `ytm-statement-banner-renderer`, …).
   - Notausgang: Hat der Player die Klasse `ad-showing`, Video stumm an das Ende spulen und „Überspringen“ drücken; danach Stummschaltung zurücknehmen.
   - Zähler `adsBlocked` (entfernte Einträge + übersprungene Werbungen) für die Anzeige in der App.
2. **Hintergrundwiedergabe (`background.js`)**
   - `document.hidden` → `false`, `document.visibilityState` → `'visible'` (auch `webkitHidden`/`webkitVisibilityState`), `document.hasFocus()` → `true`.
   - `visibilitychange`, `webkitvisibilitychange`, sowie `blur`/`pagehide` auf `window` in der Fangphase stoppen, solange die Funktion aktiv ist.
   - Pausiert das Video, während die Seite tatsächlich verborgen ist, und kam die Pause **nicht** vom Nutzer (keine Berührung/Taste und keine Media-Session-Aktion in den letzten 1,5 s, Video nicht zu Ende), nach 100–300 ms wieder `play()` aufrufen. Höchstens 3 Versuche je Pause, damit nichts endlos kämpft.
   - Die echte Sichtbarkeit merkt sich das Modul über den ursprünglichen Getter, bevor es ihn überschreibt.
3. **Bild-in-Bild und AirPlay (`pip.js`)**
   - `disablePictureInPicture` entfernen und fernhalten, `playsinline`/`webkit-playsinline` setzen, `x-webkit-airplay="allow"` setzen (per MutationObserver für neue `<video>`).
   - `pip()`: `webkitSetPresentationMode('picture-in-picture' | 'inline')`, Rückfall auf `requestPictureInPicture()`.
   - Versucht die Seite, Bild-in-Bild sofort wieder zu beenden (binnen 1 s nach Start, ohne Nutzeraktion), wird das unterbunden.
   - „Aktives Video“ = das sichtbare, größte `<video>` mit Quelle; Kurzvideos (Shorts) zählen mit.
4. **Brücke (`bridge.js`)** – Zustand sammeln und melden (3.4), `yt-navigate-finish`/`popstate` beachten.
5. **Tests** – reine Funktionen (Bereinigen von Antworten/Listen, Userscript-Kopf, Regeldatei gültig und ohne verbotene Muster) mit Beispiel-Daten; ein Test mit nachgebautem `document`/`window` für die Sichtbarkeits-Täuschung.

## 5. iPhone-App im Detail

- **Technik:** Swift 5, UIKit, ein `UIViewController` mit `WKWebView`; Projektdatei wird mit **XcodeGen** aus `project.yml` erzeugt (kein eingechecktes `.xcodeproj`). Mindestens iOS 16.0, iPhone und iPad, alle Ausrichtungen. Bundle-Kennung `de.flimmerfrei.app`, Anzeigename „Flimmerfrei“, URL-Schema `flimmerfrei://` (öffnet `flimmerfrei://open?url=<kodierte YouTube-Adresse>`).
- **Web-Ansicht:** Standard-Datenspeicher (Anmeldung bleibt erhalten); `allowsInlineMediaPlayback = true`; `mediaTypesRequiringUserActionForPlayback = []`; `allowsPictureInPictureMediaPlayback = true`; `allowsAirPlayForMediaPlayback = true`; `preferences.isElementFullscreenEnabled = true`; `applicationNameForUserAgent = "Version/18.0 Mobile/15E148 Safari/604.1"` (damit Google die Ansicht wie Safari behandelt); Wischgesten vor/zurück an; Kennung der App **nicht** im User-Agent.
- **Skripte:** `WKUserScript` bei `atDocumentStart`, nur Hauptrahmen, Inhaltswelt `.page`: erst die Einstellungen (3.2, `host: 'ios'`), dann `flimmerfrei.inject.js` aus dem App-Paket. Nachrichtenkanal `flimmerfrei`.
- **Sperrliste:** `content-blocker.json` aus dem App-Paket mit `WKContentRuleListStore` übersetzen (Kennung mit Versionsnummer, damit neue Listen greifen); schlägt das fehl, startet die App trotzdem.
- **Ton im Hintergrund:** `AVAudioSession` Kategorie `.playback`, Modus `.moviePlayback`, beim Start und bei jedem Wiedergabe-Beginn aktiv setzen; `UIBackgroundModes: [audio]`. Unterbrechungen (Anruf) sauber behandeln.
- **Navigation:** In der App bleiben `youtube.com`, `youtu.be`, `youtube-nocookie.com`, `google.com`/`google.de` (Anmeldung, Einwilligung), `gstatic.com`, `googleusercontent.com`. Alles andere im Hauptrahmen öffnet sich in Safari-Ansicht (`SFSafariViewController`). `target=_blank` lädt in derselben Ansicht. Ladefehler/Offline: schlichte Fehlerseite mit „Erneut versuchen“.
- **Bedienung:** YouTube bringt eigene Leisten mit, deshalb keine feste Leiste. Ein kleiner, verschiebbarer runder Knopf (merkt sich seine Position, weicht dem sicheren Bereich aus, blendet im Vollbild aus) öffnet ein Menü: Bild-in-Bild · AirPlay · Zurück · Neu laden · Startseite · Link teilen · In Safari öffnen · Einstellungen. Bild-in-Bild/AirPlay sind nur aktiv, wenn laut Zustand ein Video da ist.
- **Einstellungen** (eigene Ansicht, in `UserDefaults`): Werbeblocker an/aus · Hintergrundwiedergabe an/aus · „Beim Verlassen der App automatisch Bild-in-Bild“ (Versuch, Standard aus) · Zähler „blockierte Werbung“ · Browserdaten löschen (abmelden) · Version. Änderungen wirken sofort über `setConfig` bzw. Neuladen.
- **Gestaltung:** dunkel, zurückhaltend, Systemschrift und SF-Symbole; Akzentfarbe Türkis `#2DD4BF` auf Fast-Schwarz `#0B0F14`. **App-Symbol:** eigenes Motiv (türkises Wiedergabe-Dreieck in einem offenen Ring auf dunklem Grund) – ausdrücklich **kein** rotes YouTube-Logo, kein „YouTube“ im Namen.
- **Bau:** Workflow `.github/workflows/video-app-ios.yml` (macOS-Runner): Kern bauen und testen → XcodeGen → `xcodebuild archive` ohne Signierung → `Flimmerfrei.ipa` als Artefakt; bei Tags `video-app-v*` zusätzlich Release „Flimmerfrei x.y.z“. Auslöser: von Hand, Tags, und Pushes auf Zweige `video-app*` (zum Prüfen vor der Veröffentlichung).
- **Installation:** wie bei der Gym-App mit AltStore oder Sideloadly (`ios/INSTALLATION.md`).

## 5a. Google-Anmeldung (verbindlich)

Die Anmeldung mit dem Google-Konto ist Pflichtfunktion der Stufe 1. Sie läuft **auf Googles eigener Seite** in derselben Web-Ansicht; die App sieht, speichert und überträgt weder Kennwort noch Konto-Daten.

- **Einstieg:** der normale „Anmelden“-Knopf von YouTube, zusätzlich Menüeintrag „Mit Google anmelden“ im schwebenden Knopf. Er lädt `https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fm.youtube.com%2F`.
- **Safari-Kennung:** Google lehnt eingebettete Ansichten ab („Dieser Browser oder diese App ist möglicherweise nicht sicher“), wenn der User-Agent nicht wie ein vollwertiger Browser aussieht. Deshalb `applicationNameForUserAgent` wie in Abschnitt 5 und **kein** eigener App-Name im User-Agent. `customUserAgent` bleibt ungesetzt, damit die echte iOS-Version erhalten bleibt.
- **Anmelde-Seiten bleiben in der App** (nicht in die Safari-Ansicht auslagern, sonst landet die Anmeldung im falschen Speicher): `accounts.google.com`, `accounts.google.<Land>`, `accounts.youtube.com`, `myaccount.google.com`, `consent.google.com`/`consent.youtube.com`, `gds.google.com`, `ogs.google.com`, `support.google.com`, außerdem alle Unterseiten von `google.com`, `google.de`, `youtube.com`, `gstatic.com`, `googleusercontent.com`. Weiterleitungen quer durch diese Adressen dürfen nicht unterbrochen werden.
- **Fenster:** Öffnet die Anmeldung ein neues Fenster (`window.open`/`target=_blank`), wird es in derselben Ansicht geladen.
- **Kern und Sperrliste halten sich heraus:** `flimmerfrei.inject.js` beendet sich sofort, wenn die Seite nicht zu `youtube.com`/`youtube-nocookie.com` gehört (auf Google-Seiten wird nichts eingehängt). Die Sperrliste enthält keine Regel, die `accounts.google.*`, `accounts.youtube.com`, `/signin`, `ServiceLogin`, `CheckCookie`, `SetSID` oder `gstatic.com` trifft.
- **Speicher:** Standard-`WKWebsiteDataStore` (dauerhaft), Cookies von Dritten nicht sperren. „Browserdaten löschen“ in den Einstellungen meldet ab; der Text dort sagt das ausdrücklich.
- **Zustand:** Kehrt die Ansicht von einer Anmelde-Seite zu YouTube zurück, wird die Startseite einmal frisch geladen, damit das Konto sofort sichtbar ist.
- **Grenzen:** Passkeys und Sicherheitsschlüssel funktionieren in eingebetteten Ansichten nicht zuverlässig – dann „Andere Option wählen“ (Kennwort, Bestätigung am Handy, Code). Google kann die Anmeldung in eingebetteten Ansichten jederzeit strenger behandeln; die Safari-Kennung ist der übliche Weg, den auch andere iOS-Browser gehen.

## 6. Web-Teil

`web/index.html` (eine Datei, ohne Abhängigkeiten, dunkel, deutsch, am Handy gut lesbar): was die App kann, Verweis auf die `.ipa` unter Releases, Anleitung fürs Userscript (Safari + „Userscripts“, Rechner + Violentmonkey), Knopf „Userscript installieren“ (`flimmerfrei.user.js` im selben Ordner), ehrliche Liste der Grenzen. Veröffentlicht unter `https://volvic93.github.io/apps/video-app/`.

## 7. Grenzen (ehrlich)

- Die App lässt sich von Windows aus nicht starten; geprüft werden kann nur: Kern-Tests, Bau der `.ipa` auf dem GitHub-Runner und Durchsicht des Codes. **Der erste echte Test passiert auf dem iPhone.**
- YouTube ändert seine Seite laufend. Werbeblocker und Hintergrundwiedergabe können dadurch zeitweise ausfallen, bis der Kern angepasst ist.
- Ohne Apple-Entwicklerkonto muss die App alle 7 Tage neu signiert werden (AltStore macht das automatisch).
- Chromecast fehlt in Stufe 1 (siehe Abschnitt 1).

## 8. Umsetzungsstand

| Teil | Stand |
|---|---|
| Konzept | fertig (15.11.2026) |
| Kern + Web | in Arbeit |
| iPhone-App + Bau-Workflow | in Arbeit |
| Prüfschleife | offen |
| Veröffentlichung | offen |
