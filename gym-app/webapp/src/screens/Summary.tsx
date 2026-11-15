import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, getSettings } from '../data/db';
import { backupFileName, buildBackup, markBackupDone } from '../logic/backup';
import { renderSummaryImage } from '../logic/summaryImage';
import { platform } from '../platform';
import { useUi } from '../ui/kit';
import { formatNumber, summarizeSets } from '../logic/progression';
import { previousSameWorkout, sessionDurationMin, sessionRecords, sessionVolume, sessionWorkSets } from '../logic/stats';
import { useCatalog } from '../ui/ExercisePicker';
import { useLive } from '../ui/hooks';
import { IconTrophy } from '../ui/Icons';

export function formatVolume(kg: number): string {
  if (kg >= 10000) return `${formatNumber(Math.round(kg / 100) / 10)} t`;
  return `${formatNumber(Math.round(kg))} kg`;
}

/** Abschluss-Zusammenfassung: Dauer, bewegtes Gesamtgewicht, Rekorde, Vergleich zur letzten gleichen Einheit. */
export function Summary({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const nav = useNavigate();
  const cat = useCatalog();
  const data = useLive(async () => {
    const session = await db.sessions.get(sessionId);
    const all = await db.sessions.filter((s) => s.endedAt !== undefined).toArray();
    return { session, all };
  }, [sessionId]);
  const [note, setNote] = useState<string | undefined>(undefined);
  const { toast } = useUi();
  if (!data?.session || !cat) return <div className="screen" />;
  const s = data.session;
  const vol = sessionVolume(s);
  const prev = previousSameWorkout(s, data.all);
  const prevVol = prev ? sessionVolume(prev) : undefined;
  const delta = prevVol && prevVol > 0 ? ((vol - prevVol) / prevVol) * 100 : undefined;
  const records = sessionRecords(s, data.all);

  const shareImage = async () => {
    const st = await getSettings();
    const blob = await renderSummaryImage({
      title: s.workoutName,
      date: new Date(s.startedAt).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
      studio: st.studio?.name,
      stats: [
        { label: 'Dauer', value: `${sessionDurationMin(s)} Min.` },
        { label: 'Sätze', value: String(sessionWorkSets(s)) },
        { label: 'Volumen', value: formatVolume(vol) },
      ],
      records: records.map((r) => `${cat.exMap.get(r.exerciseId)?.name ?? ''}: ${r.unit === 'platte' ? 'Platte ' : ''}${formatNumber(r.weight)}${r.unit === 'platte' ? '' : ' kg'} × ${r.reps}`),
    });
    if (!blob) return toast('Das Bild konnte nicht erzeugt werden.', 'error');
    const res = await platform.saveFile({ filename: `eisenzeit-${s.workoutName.replace(/\W+/g, '-').toLowerCase()}.png`, mime: 'image/png', blob });
    if (res !== 'abgebrochen') toast('Bild bereitgestellt');
  };

  const shareBackup = async () => {
    try {
      const backup = await buildBackup(db, false);
      const res = await platform.saveFile({ filename: backupFileName(), mime: 'application/json', text: JSON.stringify(backup) });
      if (res !== 'abgebrochen') {
        await markBackupDone();
        toast('Sicherung bereitgestellt');
      }
    } catch (e) {
      toast(`Sicherung fehlgeschlagen: ${(e as Error).message}`, 'error');
    }
  };

  return (
    <div className="screen summary">
      <div className="summary-hero">
        <div className="eyebrow">Training abgeschlossen</div>
        <h1 className="h1">{s.workoutName}</h1>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-val" data-testid="sum-duration">{sessionDurationMin(s)}</div>
          <div className="stat-label">{sessionDurationMin(s) === 1 ? 'Minute' : 'Minuten'}</div>
        </div>
        <div className="stat">
          <div className="stat-val" data-testid="sum-volume">{formatVolume(vol)}</div>
          <div className="stat-label">bewegt</div>
        </div>
        <div className="stat">
          <div className="stat-val" data-testid="sum-sets">{sessionWorkSets(s)}</div>
          <div className="stat-label">Sätze</div>
        </div>
      </div>

      {records.length > 0 && (
        <section className="card records">
          <div className="card-title">
            <IconTrophy size={18} /> Neue Rekorde
          </div>
          {records.map((r) => (
            <div key={r.exerciseId} className="rec-row">
              <span>{cat.exMap.get(r.exerciseId)?.name}</span>
              <b>
                {r.unit === 'platte' ? `Platte ${formatNumber(r.weight)}` : `${formatNumber(r.weight)} kg`} × {r.reps}
              </b>
            </div>
          ))}
        </section>
      )}

      {prev && (
        <section className="card">
          <div className="card-title">Im Vergleich zum letzten Mal</div>
          <p>
            Beim letzten „{s.workoutName}“ hast du {formatVolume(prevVol ?? 0)} bewegt.{' '}
            {delta !== undefined && (
              <b className={delta >= 0 ? 'up' : 'down'}>
                {delta >= 0 ? '+' : '−'}
                {formatNumber(Math.round(Math.abs(delta) * 10) / 10)} % heute.
              </b>
            )}
          </p>
        </section>
      )}

      <section className="card">
        <div className="card-title">Übungen</div>
        <div className="list flat">
          {s.entries.map((e, i) => (
            <div key={i} className="list-row">
              <div className="grow">
                <div className="row-title">{cat.exMap.get(e.exerciseId)?.name}</div>
                <div className="row-sub">{summarizeSets(e.sets, cat.exMap.get(e.exerciseId)?.tracking, cat.exMap.get(e.exerciseId)?.unilateral, e.unit)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-title">Notiz zum Training</div>
        <textarea
          className="input area"
          rows={2}
          placeholder="Wie war’s?"
          value={note ?? s.note ?? ''}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== undefined && db.sessions.update(s.id, { note: note.trim() || undefined, updatedAt: Date.now() })}
        />
      </section>

      <div className="stack">
        <button className="btn primary block" onClick={onClose}>
          Fertig
        </button>
        <button className="btn block" onClick={shareImage}>
          Zusammenfassung als Bild teilen
        </button>
        <button className="btn block" onClick={shareBackup}>
          Sicherung teilen
        </button>
        <button className="btn block ghost" onClick={() => nav(`/fortschritt/${s.id}`)}>
          Im Verlauf ansehen
        </button>
      </div>
    </div>
  );
}
