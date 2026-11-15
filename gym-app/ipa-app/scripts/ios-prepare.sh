#!/usr/bin/env bash
# Erzeugt das iOS-Projekt (Capacitor) aus dem Web-Build und passt es an.
# Läuft im GitHub-Actions-Workflow auf macOS – und genauso auf einem Mac.
# Voraussetzung: In ../webapp sind `npm ci` und `npm run build` gelaufen (Ordner ../webapp/dist existiert),
# und in diesem Ordner (ipa-app) ist `npm ci` gelaufen.
set -euo pipefail
cd "$(dirname "$0")/.."

BUNDLE_ID="de.eisenzeit.app"   # muss zu capacitor.config.json passen – nie ändern, sonst gehen Daten verloren

[ -d ../webapp/dist ] || { echo "../webapp/dist fehlt – erst in webapp 'npm run build' ausführen" >&2; exit 1; }

# Das ios/-Projekt wird bei jedem Lauf frisch aus der Capacitor-Vorlage erzeugt (nicht eingecheckt).
rm -rf ios
# Swift Package Manager ist ab Capacitor 8 Standard (kein CocoaPods nötig).
npx cap add ios --packagemanager SPM
npx cap sync ios

PLIST="ios/App/App/Info.plist"
PB=/usr/libexec/PlistBuddy

# Texte für die Berechtigungsabfragen (Kamera / Fotos)
$PB -c "Add :NSCameraUsageDescription string Eisenzeit nutzt die Kamera, um Fotos von Geräten in deinem Studio aufzunehmen." "$PLIST"
$PB -c "Add :NSPhotoLibraryUsageDescription string Eisenzeit greift auf deine Fotos zu, damit du ein Gerätefoto aus der Mediathek wählen kannst." "$PLIST"
$PB -c "Add :NSPhotoLibraryAddUsageDescription string Eisenzeit kann Fotos in deiner Mediathek ablegen." "$PLIST"
# Dokumentenordner der App in „Dateien“ sichtbar (automatische Sicherungen)
$PB -c "Add :UIFileSharingEnabled bool true" "$PLIST"
$PB -c "Add :LSSupportsOpeningDocumentsInPlace bool true" "$PLIST"
# Keine eigene Verschlüsselung -> keine Exportnachweise nötig
$PB -c "Add :ITSAppUsesNonExemptEncryption bool false" "$PLIST"
# Nur Hochformat (die Oberfläche ist für Hochformat gebaut)
$PB -c "Delete :UISupportedInterfaceOrientations" "$PLIST"
$PB -c "Add :UISupportedInterfaceOrientations array" "$PLIST"
$PB -c "Add :UISupportedInterfaceOrientations:0 string UIInterfaceOrientationPortrait" "$PLIST"
$PB -c "Delete :UISupportedInterfaceOrientations~ipad" "$PLIST"
$PB -c "Add :UISupportedInterfaceOrientations~ipad array" "$PLIST"
$PB -c "Add :UISupportedInterfaceOrientations~ipad:0 string UIInterfaceOrientationPortrait" "$PLIST"

# App-Symbol (1024 × 1024, ohne Transparenz)
ICON_DIR="ios/App/App/Assets.xcassets/AppIcon.appiconset"
ICON_FILE="$(ls "$ICON_DIR"/*.png | head -1)"
cp ../webapp/assets/icon-1024.png "$ICON_FILE"

# Live-Aktivität (Widget-Erweiterung) – nur auf Wunsch: LIVE_ACTIVITY=1 (Workflow-Eingabe „Live-Aktivität“)
if [ "${LIVE_ACTIVITY:-0}" = "1" ]; then
  echo "Live-Aktivität wird eingebaut …"
  ruby scripts/add-live-activity.rb
  xcodebuild -list -project ios/App/App.xcodeproj
fi

# Kontrolle: Bundle-Kennung im erzeugten Projekt
if ! grep -q "PRODUCT_BUNDLE_IDENTIFIER = $BUNDLE_ID;" ios/App/App.xcodeproj/project.pbxproj; then
  echo "Bundle-Kennung im Xcode-Projekt ist nicht $BUNDLE_ID" >&2
  exit 1
fi
echo "iOS-Projekt bereit (Bundle-Kennung $BUNDLE_ID)."
