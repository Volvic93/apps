import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { App } from './App';
import { getSettings } from './data/db';
import { removeOrphanPhotos } from './data/repo';
import { seedCatalog } from './data/seed';
import { platform } from './platform';
import './styles.css';
import './apple.css';
import { applyAppearance, applyStoredAppearance } from './ui/appearance';

applyStoredAppearance();

async function boot() {
  const root = createRoot(document.getElementById('root')!);
  try {
    applyAppearance((await getSettings()).appearance);
    await seedCatalog();
    // Aufräumen ist nur ein Gefallen: scheitert es, startet die App trotzdem
    await removeOrphanPhotos().catch((e) => console.warn('Fotos aufräumen fehlgeschlagen', e));
    void platform.requestPersistentStorage();
  } catch (e) {
    console.error('Start fehlgeschlagen', e);
    root.render(
      <div className="fatal">
        <h1>Die Datenbank konnte nicht geöffnet werden</h1>
        <p>Vermutlich blockiert der Browser den lokalen Speicher (z. B. im privaten Modus). Bitte in einem normalen Fenster öffnen.</p>
        <pre>{String((e as Error)?.message ?? e)}</pre>
      </div>,
    );
    return;
  }
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  // Service Worker nur in der Web-Ausgabe (in der iOS-Hülle liefert die App ihre Dateien selbst aus).
  if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator && import.meta.env.PROD) {
    const { registerSW } = await import('virtual:pwa-register');
    registerSW({ immediate: true });
  }
}

void boot();
