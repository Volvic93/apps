// Macht Personen im Hintergrund von Gerätefotos unkenntlich (stark verpixelt und weichgezeichnet).
// Wirkt auf die in der App verwendeten Bilder in public/geraete/. Die Originale bleiben unverändert.
// Aufruf:  node scripts/personen-unkenntlich.mjs   (läuft aus dem Original neu, ist also wiederholbar)
//
// Bereiche als Anteile 0–1 des fertigen Bildes: [links, oben, rechts, unten]
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, copyFileSync, mkdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ziel = join(root, 'public', 'geraete');
const quelle = join(root, 'geraete-fotos', 'verarbeitet');

const FOTOS = [
  // Mann hinter dem Gewichtsblock (Wadenheben stehend)
  { kennung: 'gym80-waden', original: '2026-11-14_L3_25_gym80-waden.jpg', bereiche: [[0.5, 0.14, 0.62, 0.26]] },
  // Person hinter der Bauchmaschine (Arm, Oberkörper, Hose)
  { kennung: 'gym80-bauch', original: '2026-11-14_L3_20_gym80-bauch.jpg', bereiche: [[0.54, 0.125, 0.75, 0.275]] },
  // Person am linken Bildrand (Latzug mit Kniepolstern)
  { kennung: 'gym80-latzug', original: '2026-11-14_L3_18_gym80-latzug.jpg', bereiche: [[0, 0.31, 0.07, 0.4]] },
];

for (const f of FOTOS) {
  // Das App-Bild wird wie bei der Aufbereitung aus dem Original gewonnen. Weil der Zuschnitt in
  // geraetefotos.mjs steht, wird hier das bereits fertige App-Bild bearbeitet (ohne Sicherung geht das nur einmal gut).
  const datei = join(ziel, f.kennung + '.jpg');
  const sicherung = join(root, 'geraete-fotos', 'ohne-unkenntlich', f.kennung + '.jpg');
  mkdirSync(dirname(sicherung), { recursive: true });
  if (!existsSync(sicherung)) copyFileSync(datei, sicherung);
  const basis = sicherung;
  const meta = await sharp(basis).metadata();
  const W = meta.width;
  const H = meta.height;
  const layers = [];
  for (const [l, t, r, b] of f.bereiche) {
    const left = Math.round(l * W);
    const top = Math.round(t * H);
    const width = Math.round((r - l) * W);
    const height = Math.round((b - t) * H);
    const klein = Math.max(2, Math.round(width / 14));
    const pix = await sharp(basis)
      .extract({ left, top, width, height })
      .resize({ width: klein, kernel: 'nearest' })
      .resize({ width, height, fit: 'fill', kernel: 'nearest' })
      .blur(6)
      .toBuffer();
    layers.push({ input: pix, left, top });
  }
  const out = await sharp(basis).composite(layers).jpeg({ quality: 85 }).toBuffer();
  await sharp(out).toFile(datei);
  console.log('bearbeitet:', f.kennung);
}
