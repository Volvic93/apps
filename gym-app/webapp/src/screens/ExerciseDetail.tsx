import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../data/db';
import { deleteExercise, saveExercise } from '../data/repo';
import { MUSCLE_LABEL } from '../data/muscles';
import { TRACKING_LABEL } from '../data/types';
import { hintText, isUnconfirmed } from '../logic/catalog';
import { epley1RM, isWorkSet } from '../logic/stats';
import { formatNumber, summarizeSets } from '../logic/progression';
import { EquipmentCard, EquipmentThumb } from '../ui/EquipmentCard';
import { IconChevronRight } from '../ui/Icons';
import { useCatalog } from '../ui/ExercisePicker';
import { BackButton, ScreenHeader } from '../ui/Header';
import { useLive } from '../ui/hooks';
import { useUi, formatDateShort } from '../ui/kit';
import { InstructionsView } from '../ui/Instructions';
import { MotionImage, MotionPlaceholder, motionFrames } from '../ui/MotionImage';
import { MuscleFigure } from '../ui/MuscleFigure';
import { useState } from 'react';

export function ExerciseDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { confirm, toast } = useUi();
  const cat = useCatalog();
  const ex = cat?.exMap.get(id);
  const eq = ex?.equipmentId ? cat?.eqMap.get(ex.equipmentId) : undefined;
  const history = useLive(async () => {
    const sessions = (await db.sessions.toArray()).filter((s) => s.endedAt !== undefined).sort((a, b) => b.startedAt - a.startedAt);
    const rows: { id: string; date: number; sets: ReturnType<typeof summarizeSets> }[] = [];
    let bestWeight = 0;
    let best1rm = 0;
    let bestPlatte = 0;
    for (const s of sessions) {
      for (const e of s.entries) {
        if (e.exerciseId !== id || e.skipped) continue;
        for (const set of e.sets) {
          if (isWorkSet(set) && set.weight && set.reps && e.unit === 'platte') {
            bestPlatte = Math.max(bestPlatte, set.weight);
          } else if (isWorkSet(set) && set.weight && set.reps) {
            bestWeight = Math.max(bestWeight, set.weight);
            best1rm = Math.max(best1rm, epley1RM(set.weight, set.reps));
          }
        }
        if (rows.length < 5) rows.push({ id: s.id, date: s.startedAt, sets: summarizeSets(e.sets, ex?.tracking, ex?.unilateral, e.unit) });
      }
    }
    return { rows, bestWeight, best1rm, bestPlatte };
  }, [id, ex?.tracking]);
  const [notes, setNotes] = useState<string | undefined>(undefined);

  if (!cat) return <div className="screen" />;
  if (!ex) {
    return (
      <div className="screen">
        <BackButton to="/uebungen" />
        <p className="muted">Diese Übung gibt es nicht mehr.</p>
      </div>
    );
  }
  const i = ex.instructions;
  const noteValue = notes ?? ex.notes ?? '';

  return (
    <div className="screen">
      <ScreenHeader
        back={<BackButton to="/uebungen" label="Übungen" />}
        eyebrow={eq ? [eq.brand, eq.name].filter(Boolean).join(' · ') : 'Freie Übung'}
        title={ex.name}
        right={
          <button className="btn small" onClick={() => nav(`/uebungen/uebung-bearbeiten/${ex.id}`)}>
            Bearbeiten
          </button>
        }
      />

      {eq && (eq.photoId || eq.builtinPhoto) ? (
        <EquipmentCard eq={eq} primary={ex.primaryMuscles} secondary={ex.secondaryMuscles} onClick={() => nav(`/uebungen/geraet/${eq.id}`)} />
      ) : (
        eq && (
          <button className="card plan-card" onClick={() => nav(`/uebungen/geraet/${eq.id}`)}>
            <EquipmentThumb eq={eq} />
            <div className="plan-card-main">
              <div className="row-title">{eq.name}</div>
              <div className="row-sub">Zum Gerät</div>
            </div>
            <IconChevronRight size={18} className="chev" />
          </button>
        )
      )}

      {eq?.hint && isUnconfirmed(eq) && (
        <div className="notice warn">
          <b>Noch zu bestätigen. </b>
          {hintText(eq.hint)}
        </div>
      )}

      {motionFrames(ex.motionPhotoIds).length >= 2 ? (
        <MotionImage ids={ex.motionPhotoIds} label={ex.name} title="Bewegungsbild" />
      ) : (
        <MotionPlaceholder exercises={[{ id: ex.id, name: ex.name }]} title="Bewegungsbild" />
      )}

      <section className="card">
        <div className="card-title">Beanspruchte Muskeln</div>
        <MuscleFigure primary={ex.primaryMuscles} secondary={ex.secondaryMuscles} height={190} />
      </section>

      {eq && eq.adjustments.length > 0 && (
        <section className="card">
          <div className="card-title">Deine Einstellung am Gerät</div>
          <div className="kv">
            {eq.adjustments.map((a) => {
              const v = ex.adjustmentOverrides?.[a.id] ?? a.myValue;
              return (
                <div key={a.id}>
                  <span>{a.label}</span>
                  <b>{v ?? '–'}</b>
                  <span className="muted"> von {a.max}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-title">Anleitung</div>
        <InstructionsView i={i} />
      </section>

      <section className="card">
        <div className="card-title">Eigene Notizen</div>
        <textarea
          className="input area"
          rows={3}
          placeholder="z. B. Griffweite, Sitzposition, Gefühl …"
          value={noteValue}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== undefined && saveExercise({ ...ex, notes: notes.trim() || undefined })}
        />
      </section>

      <section className="card">
        <div className="card-title">Verlauf</div>
        <button className="btn ghost small" onClick={() => nav(`/fortschritt/uebung/${ex.id}`)}>Kurven und Rekord ansehen</button>
        {history && history.rows.length > 0 ? (
          <>
            <div className="kv wide">
              {history.bestWeight > 0 && (
                <div>
                  <span>Höchstgewicht</span>
                  <b>{formatNumber(history.bestWeight)} kg</b>
                </div>
              )}
              {history.best1rm > 0 && (
                <div>
                  <span>Geschätzte Maximalkraft</span>
                  <b>{formatNumber(Math.round(history.best1rm * 10) / 10)} kg</b>
                </div>
              )}
              {history.bestPlatte > 0 && (
                <div>
                  <span>Höchste Platte</span>
                  <b>Nr. {formatNumber(history.bestPlatte)}</b>
                </div>
              )}
            </div>
            <div className="list flat">
              {history.rows.map((r) => (
                <button key={r.id + r.date} className="list-row" onClick={() => nav(`/fortschritt/${r.id}`)}>
                  <div className="grow">
                    <div className="row-title">{r.sets}</div>
                    <div className="row-sub">{formatDateShort(r.date)}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">Noch keine abgeschlossenen Einheiten mit dieser Übung.</p>
        )}
      </section>

      <section className="card">
        <div className="kv">
          <div>
            <span>Erfassung</span>
            <b>{TRACKING_LABEL[ex.tracking]}</b>
          </div>
          {ex.unilateral && (
            <div>
              <span>Ausführung</span>
              <b>einseitig – Wiederholungen je Seite</b>
            </div>
          )}
          <div>
            <span>Standardpause</span>
            <b>{ex.defaultRestSec} s</b>
          </div>
          <div>
            <span>Hauptmuskeln</span>
            <b>{ex.primaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ')}</b>
          </div>
        </div>
      </section>

      <div className="stack">
        <button
          className="btn block ghost"
          onClick={async () => {
            await saveExercise({ ...ex, hidden: !ex.hidden });
            toast(ex.hidden ? 'Übung wieder eingeblendet' : 'Übung ausgeblendet');
          }}
        >
          {ex.hidden ? 'Wieder einblenden' : 'Ausblenden'}
        </button>
        {!ex.builtin && (
          <button
            className="btn block danger"
            onClick={async () => {
              if (await confirm({ title: 'Übung löschen?', message: 'Bereits protokollierte Sätze bleiben erhalten, die Übung verschwindet aus dem Katalog.', confirmLabel: 'Löschen', danger: true })) {
                await deleteExercise(ex.id);
                nav('/uebungen', { replace: true });
              }
            }}
          >
            Übung löschen
          </button>
        )}
      </div>
    </div>
  );
}
