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
| Chromecast / Fernseher | Pflicht (Vorgabe des Nutzers, 15.11.2026). Die mobile Seite kann nicht übertragen, deshalb baut die App es selbst ein: Geräte im WLAN finden, die YouTube-App auf dem Gerät starten und über YouTubes Fernseh-Schnittstelle steuern; zusätzlich „Mit TV-Code verbinden“ (Abschnitt 5c). Inoffizielle Schnittstelle – kann brechen, wenn Google sie ändert | 1 |

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
- `core/dist/flimmerfrei.user.js` – dasselbe mit Userscript-Kopf (`@match https://*.youtube.com/*`, `@run-at document-start`, `@grant none`, `@inject-into content`, `@version`, `@name Flimmerfrei`, `@downloadURL`/`@updateURL` = `https://volvic93.github.io/apps/video-app/flimmerfrei.user.js`).
- **Lader des Userscripts (seit 0.1.1):** m.youtube.com verlangt `require-trusted-types-for 'script'` und Nonce-Skripte; das direkte Einschleusen durch die Erweiterung („`@inject-into page`“) scheitert daran (am iPhone des Nutzers aufgefallen, 15.11.2026). Das Userscript läuft deshalb als Inhalts-Skript und bringt den Kern selbst in die Seite: `<script>` mit der Nonce eines vorhandenen Skripts und einer eigenen Trusted-Types-Richtlinie (`flimmerfrei-loader`). Der Kern setzt als Erfolgszeichen `data-flimmerfrei="<Version>"` am `<html>`-Element. Fehlt das Zeichen, läuft der Kern im Kontext des Userscripts weiter (eingeschränkt: Werbung wird übersprungen statt vorab entfernt). Die App ist nicht betroffen (WKUserScript unterliegt diesen Regeln nicht).
- `core/rules/content-blocker.json` – WKContentRuleList. Einschränkungen des WebKit-Formats beachten: in `url-filter` **kein** `|` (keine Alternativen), **keine** `{n}`-Wiederholungen, keine `\d`/`\w`-Kürzel, nur ASCII; höchstens ca. 200 Regeln. Nur Werbe-/Mess-Adressen sperren (z. B. `doubleclick.net`, `googlesyndication.com`, `googleadservices.com`, `youtube.com/pagead/`, `youtube.com/api/stats/ads`, `youtube.com/ptracking`, `youtube.com/get_midroll_`), **nichts**, was Wiedergabe, Anmeldung oder Vorschaubilder braucht (`googlevideo.com`, `ytimg.com`, `accounts.google.com`, `youtubei/v1/player` usw. bleiben frei).
- Bauen: `node build.mjs` im Ordner `core/` (Node ≥ 20, keine `npm install` nötig). Tests: `node --test test/`.

### 3.2 Einstellungen

Die Hülle darf **vor** dem Skript setzen:

```js
window.__FLIMMERFREI_CONFIG__ = {
  adblock: true, background: true, pipFix: true,
  look: true,           // „App öffnen“-Hinweise ausblenden, App-Gefühl (Abschnitt 5b)
  playerButtons: true,  // Knöpfe Bild-in-Bild / AirPlay / Übertragen in der Player-Leiste
  menuButton: true,     // Menü- und Übertragen-Knopf in der oberen Leiste (nur host 'ios')
  host: 'ios' /* oder 'userscript' */
};
```

Fehlt das Objekt oder ein Feld, gilt der Standard (alles `true`, `host: 'userscript'`).

### 3.3 Objekt im Seitenkontext

```js
window.__flimmerfrei = {
  version: '0.1.0',
  pip(),            // Bild-in-Bild für das aktive Video umschalten → true/false (false = kein Video)
  airplay(),        // AirPlay-Auswahl öffnen (webkitShowPlaybackTargetPicker) → true/false
  state(),          // { hasVideo, playing, pip, title, url, adsBlocked, menuButton, videoId, listId, currentTime }
  pause(),          // aktives Video anhalten (z. B. wenn es auf dem Fernseher weiterläuft) → true/false
  setConfig(teil),  // Einstellungen im Betrieb ändern, z. B. { background: false }
};
```

### 3.4 Meldungen an die App

Wenn `window.webkit?.messageHandlers?.flimmerfrei` existiert, schickt der Kern bei Änderungen (Start/Pause, neues Video, Bild-in-Bild an/aus, Seitenwechsel) gedrosselt (höchstens alle 250 ms):

```js
postMessage({ type: 'state', hasVideo, playing, pip, title, url, adsBlocked, menuButton, videoId, listId, currentTime })
```

- `menuButton`: `true`, solange der eingefügte Menü-Knopf in der oberen Leiste der Seite hängt (Abschnitt 5b).
- `videoId`: Kennung des aktiven Videos (aus `?v=…` bzw. `/shorts/<id>`), sonst `''`. `listId`: `?list=…`, sonst `''`. `currentTime`: Sekunden (Zahl).
- Ein Wechsel von `videoId` zählt als Änderung und wird gemeldet; `currentTime` allein löst **keine** Meldung aus.

Knöpfe, die der Kern in die Seite einfügt, melden sich sofort (ungedrosselt):

```js
postMessage({ type: 'menu' })   // Menü-Knopf in der oberen Leiste
postMessage({ type: 'cast' })   // Übertragen-Knopf (obere Leiste oder Player)
```

Weitere Meldungstypen gibt es in Stufe 1 nicht. Die App muss unbekannte Typen ignorieren.

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
- **Bedienung:** siehe Abschnitt 5b (Knöpfe in der Leiste der Seite und im Player, Schütteln, Ersatzknopf). Bild-in-Bild/AirPlay sind im Menü nur aktiv, wenn laut Zustand ein Video da ist.
- **Einstellungen** (eigene Ansicht, in `UserDefaults`): Werbeblocker an/aus · Hintergrundwiedergabe an/aus · „Beim Verlassen der App automatisch Bild-in-Bild“ (Versuch, Standard aus) · Zähler „blockierte Werbung“ · Browserdaten löschen (abmelden) · Version. Änderungen wirken sofort über `setConfig` bzw. Neuladen.
- **Gestaltung:** siehe Abschnitt 5b (Systemoptik, folgt Hell/Dunkel). Türkis `#2DD4BF` auf Fast-Schwarz `#0B0F14` gilt nur noch für App-Symbol und Infoseite. **App-Symbol:** eigenes Motiv (türkises Wiedergabe-Dreieck in einem offenen Ring auf dunklem Grund) – ausdrücklich **kein** rotes YouTube-Logo, kein „YouTube“ im Namen.
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

## 5b. Erscheinungsbild wie die YouTube-App (verbindlich)

Vorgabe des Nutzers (15.11.2026): Die App soll optisch **wie die normale YouTube-App aufgebaut** sein; Vorbild ist die vorliegende IPA (YouTube 13 mit Zusatzfunktionen, die sich in die Oberfläche von YouTube einfügen, statt daneben zu stehen).

**Grundsatz:** Alles Sichtbare kommt von YouTube selbst (mobile Seite): obere Leiste mit Logo, Suche und Konto, Videoliste, Player mit Titel/Aktionen/Kommentaren, untere Leiste mit den Bereichen. Die App fügt **keine eigene sichtbare Browser-Oberfläche** hinzu; ihre Zusatzfunktionen sitzen dort, wo man sie in der YouTube-App erwartet.

| YouTube-App (Vorbild) | Flimmerfrei |
|---|---|
| Obere Leiste: Logo links, rechts Übertragen, Suche, Konto | Leiste der Seite; rechts zusätzlich zwei Symbole im selben Stil: **Übertragen** und **Menü der App** |
| Untere Leiste mit den Bereichen | Leiste der Seite (heute: Startseite, Shorts, Abos, Mein YouTube – „Trends“ und „Posteingang“ aus der alten App hat YouTube selbst abgeschafft) |
| Player-Leiste oben rechts mit Symbolen | zusätzlich im selben Stil: Übertragen, Bild-in-Bild, AirPlay |
| Farben folgen Hell/Dunkel des iPhones | ebenso; Statusleiste und Ränder nehmen die Farbe der Seite an |
| Zum Aktualisieren nach unten ziehen | ebenso (nicht im Player und nicht in Shorts) |
| Keine Browser-Eigenheiten | kein Zoomen, keine Link-Vorschau beim langen Druck, keine „App öffnen“-Knöpfe und -Banner |

**Kern (`look.js`):**
- „App öffnen“ ausblenden: `.mobile-topbar-header-sign-in-button:has(a[href*="open_app"])`, Verweise mit `href^="intent://"`, `href^="vnd.youtube"`, `href*="redirect_app_store_ios"`, `href*="itc_campaign=mweb"`, dazu `ytm-mealbar-promo-renderer` und vergleichbare Hinweis-Banner. Jede Regel einzeln, damit ein unbekannter Selektor die anderen nicht entwertet.
- App-Gefühl: `-webkit-tap-highlight-color: transparent`, `-webkit-touch-callout: none` für Verweise, Bilder, Knöpfe.
- **Knöpfe in der oberen Leiste** (nur `host: 'ios'`, Einstellung `menuButton`): in `ytm-mobile-topbar-renderer .mobile-topbar-header-content` vor dem Such-Knopf zwei `button.icon-button` mit eigenen 24-px-Symbolen (`currentColor`, damit Hell/Dunkel stimmt): Übertragen (`aria-label="Auf Fernseher übertragen"`, Meldung `{ type: 'cast' }`) und Menü (`aria-label="Flimmerfrei-Menü"`, Meldung `{ type: 'menu' }`). Die Seite baut die Leiste öfter neu – die Knöpfe werden dann wieder eingesetzt (MutationObserver, gedrosselt).
- **Knöpfe im Player** (Einstellung `playerButtons`): in `player-top-controls .player-controls-top` im Stil der vorhandenen (weißes 24-px-Symbol, Berührfläche ≥ 40 px): Übertragen (nur `host: 'ios'`, Meldung `{ type: 'cast' }`), Bild-in-Bild → `pip()`, AirPlay → `airplay()` (nur wenn der Browser `webkitShowPlaybackTargetPicker` kennt). Antippen darf die Player-Bedienung nicht ein-/ausblenden (`stopPropagation`).
- Symbole sind selbst gezeichnet (einfache Linien: Bildschirm mit Wellen, zwei Rechtecke, Bildschirm mit Dreieck, drei Regler) – keine fremden Markenzeichen.
- Stand 15.11.2026, an der echten Seite ermittelt: `ytm-mobile-topbar-renderer#header-bar > header.mobile-topbar-header > div.mobile-topbar-header-content` (enthält `button.icon-button.topbar-button-search-button`, bei abgemeldetem Nutzer außerdem `div.mobile-topbar-header-sign-in-button` mit dem „App öffnen“-Verweis `intent://…open_app…`); `ytm-watch-player-controls #player-control-overlay … player-top-controls > div.player-controls-top`; `ytm-pivot-bar-renderer` (untere Leiste, `position: fixed`); das `<video>` trägt `disablepictureinpicture`; `<meta name="theme-color">` liefert die Leistenfarbe.
- Findet der Kern die Ankerstellen nicht (YouTube hat umgebaut), passiert nichts Schlimmes: `menuButton` bleibt `false`, die App zeigt dann ihren Ersatzknopf.

**App:**
- Folgt Hell/Dunkel des Systems (Einstellung „Darstellung“: Automatisch · Hell · Dunkel). Hintergrund der Hauptansicht und Statusleisten-Stil richten sich nach der Farbe der Seite (`themeColor` bzw. `underPageBackgroundColor` der Web-Ansicht), damit die Leisten optisch bis zum Rand reichen.
- Web-Ansicht an allen vier Seiten am sicheren Bereich; mobile Darstellung auch auf dem iPad.
- Menü der App als Auswahlblatt von unten (wie die Blätter der YouTube-App): Auf Fernseher übertragen · Bild-in-Bild · AirPlay · Neu laden · Link teilen · In Safari öffnen · Mit Google anmelden · Zurück · Startseite · Einstellungen. Es öffnet sich über den Menü-Knopf in der oberen Leiste, über **Schütteln** des iPhones und über den Ersatzknopf.
- **Ersatzknopf** (klein, grau, halbtransparent, verschiebbar): nur sichtbar, wenn der Menü-Knopf der Seite fehlt (`menuButton == false`, z. B. Anmelde-Seite, Fehlerseite, Umbau bei YouTube) oder wenn „Schwebenden Knopf immer anzeigen“ eingeschaltet ist.
- Kein Zoomen mit zwei Fingern, keine Link-Vorschau, Ziehen zum Aktualisieren.
- Einstellungen in Systemoptik (hell/dunkel), ohne eigene Farbwelt.

**Bewusst anders als das Vorbild:** Name und App-Symbol bleiben eigene (kein YouTube-Logo, kein „YouTube“ im Namen) – die App wird öffentlich abgelegt und darf sich nicht als YouTube ausgeben. In der App selbst ist das Logo der Seite ganz normal zu sehen, weil es YouTubes eigene Seite ist.

## 5c. Übertragen auf Chromecast und Fernseher (verbindlich)

Die mobile Seite hat keine Übertragen-Funktion. Die App baut sie nativ nach, so wie es die YouTube-App tut: Der Fernseher spielt das Video selbst (seine eigene YouTube-App), das iPhone ist nur Fernbedienung. Dadurch läuft das Video weiter, auch wenn das iPhone gesperrt wird.

**Zwei Wege zum Gerät**
1. **Im WLAN gefunden** (Chromecast, Google TV, Android TV, Fernseher mit Chromecast): Suche per Bonjour nach `_googlecast._tcp` (`NWBrowser`, Gerätename aus dem TXT-Eintrag `fn`). Verbindung zum Gerät über das Cast-Protokoll (TLS auf Port 8009, selbstsigniertes Zertifikat wird akzeptiert; Nachrichten = 4 Byte Länge (Big-Endian) + Protobuf `CastMessage`):
   - `urn:x-cast:com.google.cast.tp.connection` → `{"type":"CONNECT"}` an `receiver-0`
   - `urn:x-cast:com.google.cast.tp.heartbeat` → alle 5 s `{"type":"PING"}`, auf `PING` mit `{"type":"PONG"}` antworten
   - `urn:x-cast:com.google.cast.receiver` → `{"type":"LAUNCH","appId":"233637DE","requestId":n}` (YouTube-Empfänger); aus `RECEIVER_STATUS` die `transportId` der Anwendung lesen
   - `CONNECT` an die `transportId`, dann auf `urn:x-cast:com.google.youtube.mdx` → `{"type":"getMdxSessionStatus"}`; die Antwort `mdxSessionStatus` enthält `data.screenId`
   - `CastMessage`-Felder: 1 `protocol_version` (varint 0), 2 `source_id` (`sender-0`), 3 `destination_id`, 4 `namespace`, 5 `payload_type` (varint 0 = Text), 6 `payload_utf8`
2. **Mit TV-Code** (Smart-TV, Konsole, Fire TV, Google TV – in der YouTube-App des Fernsehers unter „Einstellungen → Mit TV-Code verknüpfen“): `POST https://www.youtube.com/api/lounge/pairing/get_screen` mit `pairing_code=<Ziffern>` → `screen.screenId`, `screen.loungeToken`, `screen.name`. Zuletzt verbundene Geräte dieser Art merkt sich die App (`screenId`, Name) für „Erneut verbinden“.

**Steuerung (für beide Wege gleich, HTTPS)**
- Lounge-Token: `POST https://www.youtube.com/api/lounge/pairing/get_lounge_token_batch`, Formular `screen_ids=<screenId>` → `screens[0].loungeToken`.
- Sitzung: `POST https://www.youtube.com/api/lounge/bc/bind?RID=<n>&VER=8&CVER=1`, Kopfzeile `X-YouTube-LoungeId-Token: <Token>`, Formular `device=REMOTE_CONTROL&id=<zufällige Kennung>&name=Flimmerfrei&mdx-version=3&pairing_type=cast&app=android-phone-13.14.55`. Aus der Antwort per Muster lesen: `SID` (`"c","<SID>",`) und `gsessionid` (`"S","<gsessionid>"]`).
- Befehle: `POST …/bc/bind?SID=…&gsessionid=…&RID=<n+1>&VER=8&CVER=1` mit Formular `count=1&req0__sc=<Befehl>&req0_<Parameter>=…`:
  - Video starten: `setPlaylist` mit `_videoId`, `_currentTime` (Sekunden), `_currentIndex=-1`, `_audioOnly=false`, `_listId` (leer oder Wiedergabeliste)
  - `pause`, `play`, `seekTo` (`_newTime`), `stopVideo`
  - Antwort 400/404/410 → Sitzung neu aufbauen und Befehl einmal wiederholen.
- Statusrückmeldungen vom Fernseher werden in Stufe 1 nicht gelesen (keine Zeitleiste in der App); die Fernbedienung bietet Pause/Weiter, 10 s vor/zurück entfällt deshalb, Lautstärke regelt die Fernbedienung des Fernsehers.

**Verhalten in der App**
- Übertragen-Knopf (obere Leiste, Player, Menü) öffnet ein Blatt: gefundene Geräte · „Mit TV-Code verbinden“ · zuletzt verbundene Geräte. Beim ersten Öffnen fragt iOS nach dem Zugriff aufs lokale Netzwerk (`NSLocalNetworkUsageDescription`, `NSBonjourServices`). Die Suche läuft nur, solange das Blatt offen ist.
- Nach dem Verbinden: Läuft gerade ein Video, wird es mit der aktuellen Stelle an den Fernseher geschickt und auf dem iPhone angehalten. Solange die Verbindung besteht, geht **jedes neu gestartete Video** automatisch an den Fernseher (wie in der YouTube-App).
- Verbunden zeigt das Blatt: Gerätename · Pause/Weiter · „Aktuelles Video senden“ · Trennen. Trennen schickt `stopVideo` und beendet die Sitzung.
- Fehler werden verständlich gemeldet („Gerät nicht erreichbar“, „Code ungültig“, „YouTube auf dem Gerät konnte nicht gestartet werden“). Für die Fehlersuche gibt es in den Einstellungen ein **Übertragungs-Protokoll** (letzte ~200 Zeilen, kopierbar) – die Funktion kann erst am echten Gerät erprobt werden.
- Auf dem Fernseher spielt dessen YouTube-App; Werbung dort kann die App nicht entfernen.

## 6. Web-Teil

`web/index.html` (eine Datei, ohne Abhängigkeiten, dunkel, deutsch, am Handy gut lesbar): was die App kann, Verweis auf die `.ipa` unter Releases, Anleitung fürs Userscript (Safari + „Userscripts“, Rechner + Violentmonkey), Knopf „Userscript installieren“ (`flimmerfrei.user.js` im selben Ordner), ehrliche Liste der Grenzen. Veröffentlicht unter `https://volvic93.github.io/apps/video-app/`.

## 7. Grenzen (ehrlich)

- Die App lässt sich von Windows aus nicht starten; geprüft werden kann nur: Kern-Tests, Bau der `.ipa` auf dem GitHub-Runner und Durchsicht des Codes. **Der erste echte Test passiert auf dem iPhone.**
- YouTube ändert seine Seite laufend. Werbeblocker und Hintergrundwiedergabe können dadurch zeitweise ausfallen, bis der Kern angepasst ist.
- Ohne Apple-Entwicklerkonto muss die App alle 7 Tage neu signiert werden (AltStore macht das automatisch).
- Übertragen auf Chromecast/Fernseher nutzt eine inoffizielle Schnittstelle und ist ohne Gerät nicht prüfbar; auf dem Fernseher spielt dessen eigene YouTube-App – dort kann Werbung laufen, die der Werbeblocker der App nicht erreicht.

## 8. Umsetzungsstand

| Teil | Stand |
|---|---|
| Konzept | fertig (15.11.2026) |
| Kern + Web | fertig, 58 Tests grün (Node) |
| iPhone-App + Bau-Workflow | fertig, `.ipa` baut auf dem GitHub-Runner |
| Übertragen (Chromecast/TV-Code) | fertig geschrieben, kompiliert; **nicht an einem Gerät erprobt** |
| Prüfschleife Runde 1 (15.11.2026) | Kern-Tests, zwei Test-Bauten der `.ipa`, Durchsicht der zentralen Dateien, Sichttest der eingefügten Knöpfe an der echten mobilen YouTube-Seite (obere Leiste und Player-Leiste passen; „App öffnen“ wird ausgeblendet) |
| Veröffentlichung | Version 0.1.0 (15.11.2026), 0.1.1 mit neuem Userscript-Lader (15.11.2026) |

**Offen bis zum Test auf dem iPhone** (von Windows aus nicht prüfbar): Google-Anmeldung in der Web-Ansicht, Weiterspielen bei gesperrtem Gerät, Bild-in-Bild und AirPlay, Übersetzung der Sperrliste durch WebKit (Status steht in den Einstellungen), Wirkung des Werbeblockers gegen echte Werbung, Übertragen auf Chromecast/Fernseher (bei Problemen: Übertragungs-Protokoll in den Einstellungen kopieren).
