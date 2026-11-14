// Bereitet Gerätefotos aus geraete-fotos/eingang/ auf (zuschneiden, auf max. 1280 px verkleinern)
// und legt sie nach public/geraete/<kennung>.jpg. Erledigte Originale wandern nach geraete-fotos/verarbeitet/
// (mit der Kennung im Dateinamen).
//
// Aufruf:  node scripts/geraetefotos.mjs
// Neue Lieferung: Einträge in LIEFERUNGEN ergänzen. Zuschnitt:
//   box  = [links, oben, rechts, unten] in Pixeln einer auf 2000 Pixel Höhe skalierten Ansicht, oder
//   frac = [links, oben, rechts, unten] als Anteile 0–1 der Bildgröße (einfacher, bevorzugt).
//   Ohne Angabe: ganzes Bild. Personen im Hintergrund werden möglichst weggeschnitten.
import sharp from 'sharp';
import { mkdirSync, renameSync, existsSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const eingang = join(root, 'geraete-fotos', 'eingang');
const verarbeitet = join(root, 'geraete-fotos', 'verarbeitet');
const ziel = join(root, 'public', 'geraete');
const MAX = 1280;
const VIEW_H = 2000;

const L3 = (nr) => `2026-11-14_L3_${String(nr).padStart(2, '0')}.jpg`;

const LIEFERUNGEN = [
  // ---- Lieferung 1 und 2 (14.11.2026)
  { datei: '2026-11-14_01_newtech-multi-pulley.jpg', kennung: 'newtech-multi-pully', box: [40, 160, 1410, 1510] },
  { datei: '2026-11-14_02_schnell-bizeps-scott_a.jpg', kennung: 'schnell-bizepsmaschine', box: [150, 80, 1500, 1960] },
  { datei: '2026-11-14_03_gymleco-biceps-curl.jpg', kennung: 'gymleco-biceps-curl', box: [235, 0, 1500, 1800] },
  { datei: '2026-11-14_04_schnell-bizeps-scott_b.jpg', kennung: 'schnell-bizepsmaschine-seite', box: [0, 300, 1500, 1900] },
  { datei: '2026-11-14_05_newtech-seitheben-maschine_uebersicht.jpg', kennung: 'newtech-seitheben-maschine', box: [0, 0, 1500, 1850] },
  { datei: '2026-11-14_06_newtech-seitheben-maschine_fussplatte-skala.jpg', kennung: 'newtech-seitheben-maschine-skala' },
  { datei: '2026-11-14_07_newtech-pec-dec-fly.jpg', kennung: 'newtech-pec-dec-fly', box: [0, 140, 1125, 1990] },
  { datei: '2026-11-14_09_newtech-multi-pulley_uebungstafel.jpg', kennung: 'newtech-multi-pully-tafel', box: [80, 820, 1360, 1780] },
  { datei: '2026-11-14_10_newtech-gewichtsblock-5-100kg.jpg', kennung: 'newtech-seitheben-maschine-gewichtsblock', box: [230, 250, 1090, 1900] },

  // ---- Lieferung 3 (14.11.2026, 44 Fotos)
  { datei: L3(10), kennung: 'prime-seated-row', frac: [0, 0.18, 0.85, 1] },
  { datei: L3(11), kennung: 'prime-seated-row-2', frac: [0, 0.1, 0.82, 1] },
  // Skala 1–7 der Polsterhöhe (gehört zum Prime Seated Row); der Fuß am linken Rand wird abgeschnitten
  { datei: '2026-11-14_08_unbekannt_polster-skala-1-7.jpg', kennung: 'prime-seated-row-skala', frac: [0.1, 0.05, 1, 0.92] },
  { datei: L3(1), kennung: 'prime-brustrudern', frac: [0, 0.2, 1, 1] },
  { datei: L3(2), kennung: 'newtech-2way-row', frac: [0.03, 0.1, 0.97, 1] },
  { datei: L3(12), kennung: 'purekraft-tbar', frac: [0.1, 0.05, 0.95, 0.95] },
  { datei: L3(14), kennung: 'cybex-eagle-rudern', frac: [0.2, 0.3, 1, 1] },
  { datei: L3(15), kennung: 'panatta-super-low-row', frac: [0, 0.12, 1, 1] },
  { datei: L3(18), kennung: 'gym80-latzug', frac: [0.1, 0, 1, 1] },
  { datei: L3(21), kennung: 'granite-latzug', frac: [0.05, 0, 1, 0.95] },
  { datei: L3(22), kennung: 'panatta-super-pullover', frac: [0, 0.1, 1, 1] },
  { datei: L3(35), kennung: 'gym80-unterer-ruecken', frac: [0, 0.15, 1, 1] },
  { datei: L3(17), kennung: 'paramount-leg-curl', frac: [0.15, 0.33, 1, 1] },
  { datei: L3(24), kennung: 'gym80-beinstrecker' },
  { datei: L3(23), kennung: 'gym80-beinstrecker-2' },
  { datei: L3(27), kennung: 'newtech-leg-extension' },
  { datei: L3(26), kennung: 'gym80-beinbeuger-stehend', frac: [0, 0.2, 0.88, 1] },
  { datei: L3(25), kennung: 'gym80-waden' },
  { datei: L3(34), kennung: 'panatta-donkey-calf', frac: [0, 0.1, 1, 1] },
  { datei: L3(36), kennung: 'gym80-kickmaschine', frac: [0, 0.1, 1, 1] },
  { datei: L3(29), kennung: 'glutebuilder-hip-thrust', frac: [0.05, 0.1, 1, 1] },
  { datei: L3(30), kennung: 'glutebuilder-hip-thrust-2', frac: [0, 0.3, 1, 1] },
  { datei: L3(13), kennung: 'pendulum-hip-press', frac: [0.1, 0.1, 1, 1] },
  { datei: L3(31), kennung: 'gym80-belt-squat', frac: [0, 0.25, 1, 1] },
  { datei: L3(43), kennung: 'panatta-pendulum-squat', frac: [0, 0.15, 1, 1] },
  { datei: L3(44), kennung: 'cybex-beinpresse', frac: [0, 0.24, 1, 1] },
  { datei: L3(16), kennung: 'purekraft-beinpresse' },
  { datei: L3(32), kennung: 'purekraft-beinpresse-2', frac: [0, 0.15, 1, 1] },
  { datei: L3(37), kennung: 'gym80-sitz-a', frac: [0, 0.1, 1, 1] },
  { datei: L3(38), kennung: 'gym80-sitz-b' },
  { datei: L3(39), kennung: 'gymleco-abduktoren', frac: [0, 0.05, 1, 1] },
  { datei: L3(28), kennung: 'abduktoren-scheiben', frac: [0, 0.1, 1, 1] },
  { datei: L3(41), kennung: 'sissy-squat', frac: [0.1, 0.2, 1, 1] },
  { datei: L3(19), kennung: 'cybex-eagle-bauch', frac: [0, 0.1, 1, 1] },
  { datei: L3(20), kennung: 'gym80-bauch' },
  { datei: L3(33), kennung: 'panatta-power-smith' },
  { datei: L3(40), kennung: 'gym80-multipresse', frac: [0, 0.05, 1, 1] },
  { datei: L3(42), kennung: 'multipresse-silber' },
  // Noch nicht zugeordnet (bleiben im Eingang, Rückfrage an den Nutzer): L3_03, 04, 05, 06, 07, 08, 09
];

mkdirSync(ziel, { recursive: true });
mkdirSync(verarbeitet, { recursive: true });

for (const e of LIEFERUNGEN) {
  const quelle = join(eingang, e.datei);
  if (!existsSync(quelle)) {
    console.log('übersprungen (nicht im Eingang):', e.datei);
    continue;
  }
  const oriented = await sharp(quelle).rotate().toBuffer();
  const meta = await sharp(oriented).metadata();
  let img = sharp(oriented);
  let rect;
  if (e.frac) {
    const [l, t, r, b] = e.frac;
    rect = { left: Math.round(l * meta.width), top: Math.round(t * meta.height), width: Math.round((r - l) * meta.width), height: Math.round((b - t) * meta.height) };
  } else if (e.box) {
    const f = meta.height / VIEW_H;
    const [l, t, r, b] = e.box.map((v) => Math.round(v * f));
    rect = { left: Math.max(0, l), top: Math.max(0, t), width: Math.min(meta.width, r) - Math.max(0, l), height: Math.min(meta.height, b) - Math.max(0, t) };
  }
  if (rect) img = img.extract(rect);
  const out = join(ziel, `${e.kennung}.jpg`);
  const info = await img.resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(out);
  console.log(`${e.kennung}.jpg  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} kB`);
  const base = basename(e.datei, extname(e.datei));
  const neu = base.includes('_L3_') ? `${base}_${e.kennung}${extname(e.datei)}` : e.datei;
  renameSync(quelle, join(verarbeitet, neu));
}
