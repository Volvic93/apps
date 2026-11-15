// Drei Entwürfe für das App-Symbol (Kraftkultur-Palette). Eine SVG-Quelle je Entwurf; make-icons.mjs erzeugt daraus alle Größen.
// Aufruf: node scripts/icon-designs.mjs   (schreibt assets/icon-vorschau.png zur Auswahl)
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const NEON = '#E0F84A';
const defs = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#033220"/><stop offset="1" stop-color="#0A0A0A"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${NEON}" stop-opacity="0.16"/><stop offset="1" stop-color="${NEON}" stop-opacity="0"/>
  </radialGradient>`;

/** Inhalt der 1024 × 1024-Fläche (ohne Hintergrund); das Zeichen liegt in der mittleren Fläche. */
export const MARKS = {
  /** A: „Hantel-E“ – E aus drei Balken, der mittlere ist eine Langhantel mit Scheiben. */
  a: `
    <g transform="translate(-34 0)" fill="${NEON}">
      <rect x="318" y="326" width="76" height="372" rx="38"/>
      <rect x="318" y="326" width="292" height="76" rx="38"/>
      <rect x="318" y="622" width="292" height="76" rx="38"/>
      <rect x="318" y="486" width="440" height="52" rx="26"/>
      <rect x="650" y="410" width="66" height="204" rx="26"/>
      <rect x="730" y="440" width="50" height="144" rx="22"/>
    </g>`,
  /** B: „Scheibe“ – Hantelscheibe als Ring, ein Teil als Fortschrittsbogen abgesetzt. */
  b: `
    <g transform="translate(512 512) rotate(-90)" fill="none" stroke-linecap="round">
      <circle r="196" stroke="${NEON}" stroke-opacity="0.2" stroke-width="76"/>
      <circle r="196" stroke="${NEON}" stroke-width="76" stroke-dasharray="${(2 * Math.PI * 196 * 0.68).toFixed(1)} ${(2 * Math.PI * 196).toFixed(1)}"/>
    </g>
    <circle cx="512" cy="512" r="44" fill="${NEON}"/>`,
  /** C: „Langhantel“ – schräg gestellt, je zwei Scheiben, stark vereinfacht. */
  c: `
    <g transform="rotate(-28 512 512)" fill="${NEON}">
      <rect x="206" y="486" width="612" height="52" rx="26"/>
      <rect x="272" y="350" width="72" height="324" rx="28"/>
      <rect x="360" y="402" width="52" height="220" rx="22"/>
      <rect x="680" y="350" width="72" height="324" rx="28"/>
      <rect x="612" y="402" width="52" height="220" rx="22"/>
    </g>`,
};

/** Volles Quadrat (1024) mit Hintergrund; `rounded` für Vorschauen mit iOS-Maske. */
export function iconSvg(key, { rounded = false, size = 1024, bare = false } = {}) {
  const inner = `<defs>${defs}</defs>
    <rect width="1024" height="1024" ${rounded ? 'rx="229"' : ''} fill="url(#bg)"/>
    ${bare ? '' : `<circle cx="512" cy="512" r="330" fill="url(#glow)"/>`}
    ${MARKS[key]}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${inner}</svg>`;
}

if (process.argv[1] && process.argv[1].endsWith('icon-designs.mjs')) {
  mkdirSync(join(root, 'assets'), { recursive: true });
  const names = { a: 'A  Hantel-E', b: 'B  Scheibe', c: 'C  Langhantel' };
  const W = 1500;
  const H = 960;
  let body = `<rect width="${W}" height="${H}" fill="#2a2d2a"/>`;
  const keys = ['a', 'b', 'c'];
  for (let i = 0; i < 3; i++) {
    const k = keys[i];
    const x = 40 + i * 480;
    const svgDataUri = (opts) => `data:image/svg+xml;base64,${Buffer.from(iconSvg(k, opts)).toString('base64')}`;
    body += `<text x="${x + 220}" y="44" fill="#f4f6ee" font-family="Arial" font-size="26" font-weight="700" text-anchor="middle">${names[k]}</text>`;
    body += `<image x="${x}" y="64" width="440" height="440" href="${svgDataUri({ rounded: true, size: 440 })}"/>`;
    // Home-Bildschirm-Größe (60 pt ≈ 120 px) auf hellem und dunklem Grund
    body += `<rect x="${x}" y="540" width="215" height="190" rx="18" fill="#f4f6ef"/><rect x="${x + 225}" y="540" width="215" height="190" rx="18" fill="#0a0a0a"/>`;
    body += `<image x="${x + 48}" y="560" width="120" height="120" href="${svgDataUri({ rounded: true, size: 120 })}"/>`;
    body += `<image x="${x + 273}" y="560" width="120" height="120" href="${svgDataUri({ rounded: true, size: 120 })}"/>`;
    body += `<text x="${x + 108}" y="712" fill="#0a0a0a" font-family="Arial" font-size="16" text-anchor="middle">Eisenzeit</text>`;
    body += `<text x="${x + 333}" y="712" fill="#f4f6ee" font-family="Arial" font-size="16" text-anchor="middle">Eisenzeit</text>`;
    // ganz klein (Favicon-/Spotlight-Größe)
    body += `<image x="${x + 20}" y="760" width="60" height="60" href="${svgDataUri({ rounded: true, size: 60 })}"/>`;
    body += `<image x="${x + 100}" y="772" width="40" height="40" href="${svgDataUri({ rounded: true, size: 40 })}"/>`;
    body += `<text x="${x + 160}" y="796" fill="#c9d3c4" font-family="Arial" font-size="15">60 px · 40 px</text>`;
  }
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H - 120}" viewBox="0 0 ${W} ${H - 120}">${body}</svg>`;
  await sharp(Buffer.from(sheet)).png().toFile(join(root, 'assets', 'icon-vorschau.png'));
  console.log('assets/icon-vorschau.png');
}
