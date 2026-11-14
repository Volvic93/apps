// Erzeugt die App-Symbole (PWA, Favicon, iOS) aus einer SVG-Vorlage.
// Aufruf: npm run icons
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'public'), { recursive: true });
mkdirSync(join(root, 'assets'), { recursive: true });

/** Hantel auf dunklem Grund. `inset` verkleinert das Motiv für die "maskable"-Sicherheitszone. */
function svg({ rounded, inset = 0 }) {
  const s = 1024;
  const g = s * inset;
  const k = (s - 2 * g) / s;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#262a31"/><stop offset="1" stop-color="#0c0d0f"/>
    </linearGradient>
    <linearGradient id="fire" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffa35a"/><stop offset="1" stop-color="#ff6a1f"/>
    </linearGradient>
  </defs>
  <rect width="${s}" height="${s}" ${rounded ? 'rx="230"' : ''} fill="url(#bg)"/>
  <g transform="translate(${g} ${g}) scale(${k})">
    <rect x="150" y="486" width="724" height="52" rx="26" fill="#9aa1ac"/>
    <rect x="236" y="300" width="96" height="424" rx="34" fill="url(#fire)"/>
    <rect x="352" y="352" width="72" height="320" rx="28" fill="url(#fire)" opacity="0.88"/>
    <rect x="692" y="300" width="96" height="424" rx="34" fill="url(#fire)"/>
    <rect x="600" y="352" width="72" height="320" rx="28" fill="url(#fire)" opacity="0.88"/>
    <rect x="150" y="440" width="64" height="144" rx="26" fill="#c4cad3"/>
    <rect x="810" y="440" width="64" height="144" rx="26" fill="#c4cad3"/>
  </g>
</svg>`;
}

async function png(file, size, opts) {
  await sharp(Buffer.from(svg(opts))).resize(size, size).png().toFile(file);
  console.log(file.replace(root, '.'), `${size}px`);
}

await png(join(root, 'public', 'icon-192.png'), 192, { rounded: true });
await png(join(root, 'public', 'icon-512.png'), 512, { rounded: true });
await png(join(root, 'public', 'icon-maskable-512.png'), 512, { rounded: false, inset: 0.12 });
await png(join(root, 'public', 'apple-touch-icon.png'), 180, { rounded: false });
await png(join(root, 'public', 'favicon.png'), 64, { rounded: true });
// iOS-Symbol: 1024 × 1024, ohne Transparenz und ohne eigene Rundung (iOS rundet selbst).
await sharp(Buffer.from(svg({ rounded: false }))).resize(1024, 1024).flatten({ background: '#0c0d0f' }).png().toFile(join(root, 'assets', 'icon-1024.png'));
console.log('./assets/icon-1024.png 1024px');
