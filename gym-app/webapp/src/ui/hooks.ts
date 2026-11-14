import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { db } from '../data/db';

/** Abonniert eine Datenbankabfrage; die Oberfläche aktualisiert sich bei jeder Änderung von selbst. */
export function useLive<T>(query: () => Promise<T> | T, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  useEffect(() => {
    const sub = liveQuery(async () => query()).subscribe({
      next: (v) => setValue(v),
      error: (e) => console.error('Datenbankfehler', e),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

const urlCache = new Map<string, { url: string; users: number }>();

/** Objekt-URL für ein in der Datenbank gespeichertes Foto. */
export function usePhotoUrl(photoId: string | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!photoId) {
      setUrl(undefined);
      return;
    }
    let cancelled = false;
    const cached = urlCache.get(photoId);
    if (cached) {
      cached.users++;
      setUrl(cached.url);
    } else {
      void db.photos.get(photoId).then((p) => {
        if (cancelled || !p) return;
        const entry = urlCache.get(photoId) ?? { url: URL.createObjectURL(p.blob), users: 0 };
        entry.users++;
        urlCache.set(photoId, entry);
        setUrl(entry.url);
      });
    }
    return () => {
      cancelled = true;
      const c = urlCache.get(photoId);
      if (c) {
        c.users--;
        if (c.users <= 0) {
          // URL kurz stehen lassen – Listen springen oft zwischen Ansichten.
          setTimeout(() => {
            const again = urlCache.get(photoId);
            if (again && again.users <= 0) {
              URL.revokeObjectURL(again.url);
              urlCache.delete(photoId);
            }
          }, 30_000);
        }
      }
    };
  }, [photoId]);
  return url;
}

export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

/** Sekundenzähler, der jede Sekunde neu rendert, solange `active` gilt. */
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}
