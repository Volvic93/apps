import { getSettings } from '../data/db';
import { platform } from '../platform';

/** Gleicht die wöchentlichen Trainings-Erinnerungen der iPhone-App mit den gespeicherten Einstellungen ab (nach Löschen und Import). */
export async function syncReminders(): Promise<void> {
  try {
    const st = await getSettings();
    await platform.setWeeklyReminders(st.reminderOn && st.trainingDays?.length ? st.trainingDays : null, st.trainingTime ?? '18:00', 'Eisenzeit', 'Heute ist Trainingstag – viel Erfolg!');
  } catch {
    /* Erinnerungen sind ein Zusatz */
  }
}
