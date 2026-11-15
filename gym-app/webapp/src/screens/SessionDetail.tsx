import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../data/db';
import { saveSession } from '../data/repo';
import { SETKIND_LABEL, type Entry, type Session, type SetEntry } from '../data/types';
import { sessionDurationMin, sessionVolume, sessionWorkSets } from '../logic/stats';
import { useCatalog } from '../ui/ExercisePicker';
import { BackButton, ScreenHeader } from '../ui/Header';
import { useLive } from '../ui/hooks';
import { IconTrash } from '../ui/Icons';
import { NumberInput, formatDateLong, formatTime, useUi } from '../ui/kit';
import { formatVolume } from './Summary';

/** Vergangene Einheit ansehen und nachträglich korrigieren. */
export function SessionDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { confirm, toast } = useUi();
  const cat = useCatalog();
  const s = useLive(() => db.sessions.get(id), [id]);
  if (s === undefined || !cat) return <div className="screen" />;
  if (!s) {
    return (
      <div className="screen">
        <BackButton to="/fortschritt" />
        <p className="muted">Diese Einheit gibt es nicht mehr.</p>
      </div>
    );
  }
  const patchEntry = (i: number, fn: (e: Entry) => Entry) => saveSession({ ...s, entries: s.entries.map((e, k) => (k === i ? fn(e) : e)) });
  const patchSet = (ei: number, si: number, p: Partial<SetEntry>) => patchEntry(ei, (e) => ({ ...e, sets: e.sets.map((x, k) => (k === si ? { ...x, ...p } : x)) }));
  const removeSet = (ei: number, si: number) => patchEntry(ei, (e) => ({ ...e, sets: e.sets.filter((_, k) => k !== si) }));

  const delSession = async () => {
    if (await confirm({ title: 'Einheit löschen?', message: 'Sie verschwindet aus dem Verlauf und aus allen Auswertungen.', confirmLabel: 'Löschen', danger: true })) {
      await db.sessions.delete(s.id);
      toast('Einheit gelöscht');
      nav('/fortschritt', { replace: true });
    }
  };

  const running = s.endedAt === undefined;

  return (
    <div className="screen">
      <ScreenHeader back={<BackButton to="/fortschritt" label="Verlauf" />} eyebrow={`${formatDateLong(s.startedAt)} · ${formatTime(s.startedAt)}`} title={s.workoutName} />
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-val">{running ? '…' : sessionDurationMin(s)}</div>
          <div className="stat-label">Minuten</div>
        </div>
        <div className="stat">
          <div className="stat-val">{formatVolume(sessionVolume(s))}</div>
          <div className="stat-label">bewegt</div>
        </div>
        <div className="stat">
          <div className="stat-val">{sessionWorkSets(s)}</div>
          <div className="stat-label">Sätze</div>
        </div>
      </div>

      {s.entries.map((e, ei) => {
        const ex = cat.exMap.get(e.exerciseId);
        const weighted = ex?.tracking === 'gewicht_wdh' || ex?.tracking === 'koerpergewicht_wdh';
        return (
          <section key={ei} className="card">
            <div className="card-title">
              {ex?.name ?? 'Unbekannte Übung'}
              {e.substitutedFor && <span className="badge">statt {cat.exMap.get(e.substitutedFor)?.name}</span>}
            </div>
            {e.note && <p className="muted small">{e.note}</p>}
            {e.sets.map((set, si) => (
              <div key={si} className="hist-set">
                <span className={'hist-kind' + (set.kind !== 'normal' ? ' alt' : '')}>{set.kind === 'normal' ? si + 1 : SETKIND_LABEL[set.kind]}</span>
                {weighted && (
                  <>
                    <NumberInput className="input mini" ariaLabel="Gewicht" value={set.weight} onChange={(v) => patchSet(ei, si, { weight: v })} />
                    <span className="muted">{e.unit === 'platte' ? 'Platte ×' : 'kg ×'}</span>
                    <NumberInput className="input mini" ariaLabel="Wiederholungen" decimals={false} value={set.reps} onChange={(v) => patchSet(ei, si, { reps: v === undefined ? undefined : Math.round(v) })} />
                  </>
                )}
                {weighted && set.rir !== undefined && set.doneAt !== undefined && <span className="badge" title="Wie viele Wiederholungen wären noch möglich gewesen">noch {set.rir >= 3 ? '3+' : set.rir}</span>}
                {ex?.tracking === 'zeit' && (
                  <>
                    <NumberInput className="input mini" ariaLabel="Dauer in Sekunden" decimals={false} value={set.durationSec} onChange={(v) => patchSet(ei, si, { durationSec: v })} />
                    <span className="muted">s</span>
                  </>
                )}
                {ex?.tracking === 'cardio' && (
                  <>
                    <NumberInput className="input mini" ariaLabel="Dauer in Minuten" decimals={false} value={set.durationSec === undefined ? undefined : Math.round(set.durationSec / 60)} onChange={(v) => patchSet(ei, si, { durationSec: v === undefined ? undefined : v * 60 })} />
                    <span className="muted">min</span>
                    <NumberInput className="input mini" ariaLabel="Distanz in km" value={set.distanceKm} onChange={(v) => patchSet(ei, si, { distanceKm: v })} />
                    <span className="muted">km</span>
                  </>
                )}
                <button className="icon-btn sm ghost" aria-label="Satz löschen" onClick={() => removeSet(ei, si)}>
                  <IconTrash size={18} />
                </button>
              </div>
            ))}
            {e.sets.length === 0 && <p className="muted small">Keine Sätze.</p>}
          </section>
        );
      })}

      <section className="card">
        <div className="card-title">Notiz</div>
        <textarea className="input area" rows={2} defaultValue={s.note ?? ''} onBlur={(e) => saveSession({ ...(s as Session), note: e.target.value.trim() || undefined })} placeholder="Notiz zum Training" />
      </section>

      <button className="btn block danger" onClick={delSession}>
        Einheit löschen
      </button>
    </div>
  );
}
