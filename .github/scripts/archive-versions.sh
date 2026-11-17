#!/usr/bin/env bash
# Baut die neuesten drei Versionen der Web-App (Tags gym-app-v…) und legt sie unter <Ausgabe>/gym-app-archiv/<Version>/ ab,
# dazu eine Übersichtsseite <Ausgabe>/versionen.html mit Links zu jeder Version im Web-Archiv.
# Die .ipa jeder Version liegt im privaten Repository Volvic93/Apps-IPA-Dateien (Releases) und wird hier nicht verlinkt.
# So bleibt jeder Stand installierbar, auch wenn die Hauptadresse immer die neueste Version zeigt.
# Die Archive liegen bewusst NICHT unter /gym-app/ (sonst würde der Service Worker der neuesten Version sie übernehmen).
# Aufruf (Repository-Stamm, alle Tags geholt): bash .github/scripts/archive-versions.sh _site
set -uo pipefail
OUT="${1:?Ausgabeordner fehlt}"
KEEP=3 # so viele Web-Versionen bleiben im Archiv (die neuesten)
COUNT=0
mkdir -p "$OUT/gym-app-archiv"
ROWS=""

for TAG in $(git tag -l 'gym-app-v*' | sort -V -r); do
  VER="${TAG#gym-app-v}"
  [[ "$VER" =~ ^[0-9]+(\.[0-9]+){0,2}$ ]] || continue
  DATE="$(git log -1 --format=%cd --date=format:%d.%m.%Y "$TAG")"
  DIR="$(mktemp -d)"
  WEB='<span class="muted">Web-Version nicht mehr im Archiv</span>'
  COUNT=$((COUNT + 1))
  if [ "$COUNT" -le "$KEEP" ] && git worktree add --detach "$DIR" "$TAG" >/dev/null 2>&1 && [ -f "$DIR/gym-app/webapp/package.json" ]; then
    if (cd "$DIR/gym-app/webapp" && npm ci --no-audit --no-fund >/dev/null 2>&1 && npm run build >/dev/null 2>&1); then
      mkdir -p "$OUT/gym-app-archiv/$VER"
      cp -R "$DIR/gym-app/webapp/dist/." "$OUT/gym-app-archiv/$VER/"
      WEB="<a href=\"gym-app-archiv/$VER/\">Web-App öffnen</a>"
      echo "Archiviert: $VER"
    else
      echo "Version $VER lässt sich nicht bauen – übersprungen" >&2
    fi
  fi
  git worktree remove --force "$DIR" >/dev/null 2>&1 || true
  ROWS+="<li><strong>Version $VER</strong> <span class=\"muted\">($DATE)</span><br>$WEB</li>"$'\n'
done

cat > "$OUT/versionen.html" <<HTML
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="color-scheme" content="dark light" />
    <meta name="theme-color" content="#0a0a0a" />
    <link rel="icon" type="image/png" href="favicon.png" />
    <title>Eisenzeit – alle Versionen</title>
    <style>
      :root { --bg: #0a0a0a; --card: #121613; --text: #f4f6ee; --muted: rgba(244,246,238,.62); --accent: #e0f84a; }
      @media (prefers-color-scheme: light) { :root { --bg: #f4f6ef; --card: #fff; --text: #0a0a0a; --muted: rgba(10,10,10,.72); --accent: #033220; } }
      body { margin: 0; padding: 24px 16px calc(24px + env(safe-area-inset-bottom)); background: var(--bg); color: var(--text); font: 17px/1.4 -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif; }
      main { max-width: 560px; margin: 0 auto; }
      h1 { font-size: 30px; margin: 8px 0 12px; }
      ul { list-style: none; padding: 0; display: grid; gap: 10px; }
      li { background: var(--card); border-radius: 14px; padding: 14px 16px; }
      a { color: var(--accent); font-weight: 600; }
      .muted { color: var(--muted); font-size: 15px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Eisenzeit – alle Versionen</h1>
      <p class="muted">Die <a href="gym-app/">neueste Web-App</a> liegt auf der Hauptadresse; im Web-Archiv bleiben die neuesten drei Versionen. Ältere Web-Versionen teilen sich den Speicher mit der neuesten (gleiche Adresse des Servers): vor dem Wechsel in den Einstellungen eine <strong>Sicherung exportieren</strong>. Die iPhone-App (<strong>.ipa</strong>) wird nicht mehr öffentlich angeboten.</p>
      <ul>
$ROWS      </ul>
    </main>
  </body>
</html>
HTML
echo "versionen.html geschrieben."
