import { useState } from 'react';
import { useLive } from '../ui/hooks';
import { db, getSettings } from '../data/db';
import { buildAiExportText } from '../logic/planio';
import { platform } from '../platform';
import { BackButton, ScreenHeader } from '../ui/Header';
import { Chip, Field, useUi } from '../ui/kit';
import { ImportPanel } from './PlanImport';

/** „Mit KI planen“: Text für die KI erzeugen (kopieren/teilen) und die Antwort zurück importieren. */
export function AiPlan() {
  const { toast } = useUi();
  const settings = useLive(() => getSettings());
  const [weeksPick, setWeeks] = useState<number | undefined>(undefined);
  const weeks = weeksPick ?? settings?.planWeeksDefault ?? 8;
  const [wishes, setWishes] = useState('');
  const [general, setGeneral] = useState(false);
  const [text, setText] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const build = async (): Promise<string> => {
    const [settings, exercises, equipment, plans, sessions] = await Promise.all([getSettings(), db.exercises.toArray(), db.equipment.toArray(), db.plans.toArray(), db.sessions.toArray()]);
    return buildAiExportText({
      now: Date.now(),
      settings,
      wishes,
      weeks,
      includeGeneral: general,
      exercises,
      equipment: new Map(equipment.map((e) => [e.id, e])),
      plans,
      sessions,
    });
  };

  const create = async () => {
    setBusy(true);
    try {
      setText(await build());
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    const t = await build(); // immer frisch: Auswahl und Wünsche können sich seit dem letzten Erzeugen geändert haben
    setText(t);
    try {
      await navigator.clipboard.writeText(t);
      toast('Text kopiert – jetzt in deine KI einfügen');
    } catch {
      toast('Kopieren nicht möglich – markiere den Text unten und kopiere ihn von Hand.', 'error');
    }
  };

  const share = async () => {
    const t = await build();
    setText(t);
    const r = await platform.saveFile({ filename: 'eisenzeit-ki-auftrag.txt', mime: 'text/plain', text: t });
    if (r !== 'abgebrochen') toast(r === 'heruntergeladen' ? 'Datei heruntergeladen' : 'Datei bereitgestellt');
  };

  return (
    <div className="screen">
      <ScreenHeader back={<BackButton to="/plaene" label="Pläne" />} title="Mit KI planen" eyebrow="Pläne" />
      <p className="muted">
        Die App erzeugt einen Text mit Aufgabe, Profil, deinen Übungen, dem bisherigen Plan und deinem Verlauf. Füge ihn in eine KI deiner Wahl ein (z. B. Claude) und bringe die Antwort hierher zurück.
      </p>

      <section className="card">
        <div className="card-title">1. Text erzeugen</div>
        <div className="section-label">Laufzeit des neuen Plans</div>
        <div className="chips wrap">
          {[4, 6, 8, 10, 12, 16].map((w) => (
            <Chip key={w} on={weeks === w} onClick={() => setWeeks(w)}>
              {w} Wochen
            </Chip>
          ))}
        </div>
        <Field label="Wünsche und Einschränkungen (optional)" hint="z. B. „Schulter links schonen“, „Schwerpunkt Rücken“, „höchstens 60 Minuten“">
          <textarea className="input area" rows={3} value={wishes} onChange={(e) => setWishes(e.target.value)} maxLength={600} />
        </Field>
        <label className="switch-row">
          <span>Auch Übungen außerhalb meines Studios anbieten</span>
          <input type="checkbox" checked={general} onChange={(e) => setGeneral(e.target.checked)} />
        </label>
        <div className="row gap">
          <button className="btn primary grow" onClick={copy}>
            Text kopieren
          </button>
          <button className="btn" onClick={share}>
            Als Datei teilen
          </button>
        </div>
        <button className="btn ghost small" onClick={create} disabled={busy}>
          {text ? 'Text neu erzeugen' : 'Text zuerst ansehen'}
        </button>
        {text && (
          <>
            <p className="muted small">
              {text.length.toLocaleString('de-DE')} Zeichen. Der Text enthält nur Trainingsdaten (Ziel, Übungen, Verlauf) – keinen Namen und keine Kontaktdaten. Er wird nirgendwohin gesendet; du entscheidest, wo du ihn einfügst.
            </p>
            <textarea className="input area mono" rows={8} readOnly value={text} aria-label="Text für die KI" onFocus={(e) => e.currentTarget.select()} />
          </>
        )}
      </section>

      <div className="section-label">2. Antwort der KI einfügen</div>
      <ImportPanel placeholder="Antwort der KI hier einfügen – der JSON-Block wird auch in umgebendem Text gefunden." />
    </div>
  );
}
