import { db, getSettings } from '../data/db';
import { platform } from '../platform';
import { buildBackup, markBackupDone } from './backup';

export function autoBackupName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `eisenzeit-sicherung-auto-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

/**
 * Nach einem abgeschlossenen Training: in der iPhone-App still eine Sicherungsdatei im Dokumentenordner ablegen
 * (sichtbar in „Dateien“, die letzten fünf bleiben). In der Web-Version passiert nichts – dort gibt es „Sicherung teilen“.
 */
export async function runAutoBackup(): Promise<boolean> {
  try {
    if (platform.name !== 'ios') return false;
    const st = await getSettings();
    if (st.autoBackup === false) return false;
    const backup = await buildBackup(db, !!st.autoBackupPhotos);
    const ok = await platform.autoBackup(autoBackupName(), JSON.stringify(backup));
    if (ok) await markBackupDone();
    return ok;
  } catch {
    return false;
  }
}
