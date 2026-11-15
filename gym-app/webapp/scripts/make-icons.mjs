// Erzeugt alle App-Symbole (PWA, Favicon, iOS, Startseite) aus EINER SVG-Quelle: scripts/icon-designs.mjs, Entwurf A „Hantel-E“.
// Aufruf: npm run icons
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { iconSvg } from './icon-designs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, '..', '..', 'site');
mkdirSync(join(root, 'public'), { recursive: true });
mkdirSync(join(root, 'assets'), { recursive: true });
mkdirSync(site, { recursive: true });

const VARIANT = 'a';
const square = iconSvg(VARIANT, { rounded: false });
const rounded = iconSvg(VARIANT, { rounded: true });

async function png(file, size, svg) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file);
  console.log(file.replace(join(root, '..', '..'), '.'), `${size}px`);
}

// PWA und Browser
await png(join(root, 'public', 'icon-192.png'), 192, rounded);
await png(join(root, 'public', 'icon-512.png'), 512, rounded);
// „maskable“: volle Fläche, das Zeichen liegt in der mittleren Sicherheitszone (< 60 % der Fläche)
await png(join(root, 'public', 'icon-maskable-512.png'), 512, square);
// iOS-Startbildschirm (180 px) ohne eigene Rundung – iOS rundet selbst
await png(join(root, 'public', 'apple-touch-icon.png'), 180, square);
await png(join(root, 'public', 'favicon.png'), 64, rounded);
// iOS-App-Symbol der .ipa: 1024 × 1024, ohne Transparenz und ohne eigene Rundung
await sharp(Buffer.from(square)).resize(1024, 1024).flatten({ background: '#033220' }).png().toFile(join(root, 'assets', 'icon-1024.png'));
console.log('./gym-app/webapp/assets/icon-1024.png 1024px');
// Startseite der Web-Adresse (GitHub Pages)
await png(join(site, 'icon.png'), 180, square);
await png(join(site, 'favicon.png'), 64, rounded);
