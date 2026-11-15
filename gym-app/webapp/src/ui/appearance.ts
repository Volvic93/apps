import type { Appearance } from '../data/types';

const KEY = 'eisenzeit.appearance';

/** Setzt Hell/Dunkel. „system“ folgt der Einstellung des Geräts; Standard ist Dunkel. */
export function applyAppearance(a: Appearance): void {
  const theme = a === 'hell' ? 'light' : a === 'system' ? 'auto' : 'dark';
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, a);
  } catch {
    /* Speicher nicht verfügbar – dann gilt die Einstellung nur für diese Sitzung */
  }
  const dark = theme === 'dark' || (theme === 'auto' && !window.matchMedia('(prefers-color-scheme: light)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a0a0a' : '#f4f6ef');
}

/** Beim Start (vor dem ersten Zeichnen) aus dem lokalen Zwischenspeicher, damit nichts aufblitzt. */
export function applyStoredAppearance(): void {
  let a: Appearance = 'dunkel';
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'hell' || v === 'system' || v === 'dunkel') a = v;
  } catch {
    /* ignorieren */
  }
  applyAppearance(a);
}
