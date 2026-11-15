import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { db } from '../data/db';
import { blankExercise, saveExercise } from '../data/repo';
import { MUSCLES, MUSCLE_LABEL } from '../data/muscles';
import { TRACKING_LABEL, type Exercise, type MuscleId, type Tracking } from '../data/types';
import { useCatalog } from '../ui/ExercisePicker';
import { BackButton, ScreenHeader } from '../ui/Header';
import { Chip, Field, NumberInput, useUi } from '../ui/kit';
import { MAX_MOTION_FRAMES } from '../ui/MotionImage';
import { MOTION_PATTERNS, motionIdFor } from '../data/motions';
import { ExerciseSketch } from '../ui/MotionSketch';
import { PhotoField } from '../ui/PhotoField';

const lines = (t: string) => t.split('\n').map((s) => s.trim()).filter(Boolean);

export function ExerciseEdit() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { toast } = useUi();
  const cat = useCatalog();
  const [ex, setEx] = useState<Exercise | undefined>(undefined);
  const [motionSlots, setMotionSlots] = useState(2);
  const isNew = id === 'neu';

  useEffect(() => {
    if (isNew) setEx(blankExercise(params.get('geraet') ?? undefined));
    else void db.exercises.get(id).then(setEx);
  }, [id, isNew, params]);

  if (!ex || !cat) return <div className="screen" />;
  const patch = (p: Partial<Exercise>) => setEx({ ...ex, ...p });
  const i = ex.instructions;
  const patchI = (p: Partial<Exercise['instructions']>) => patch({ instructions: { ...i, ...p } });

  const toggle = (key: 'primaryMuscles' | 'secondaryMuscles', m: MuscleId) => {
    const other = key === 'primaryMuscles' ? 'secondaryMuscles' : 'primaryMuscles';
    const has = ex[key].includes(m);
    patch({ [key]: has ? ex[key].filter((x) => x !== m) : [...ex[key], m], [other]: ex[other].filter((x) => x !== m) } as Partial<Exercise>);
  };

  const save = async () => {
    if (!ex.name.trim()) return toast('Bitte einen Namen eingeben.', 'error');
    if (ex.primaryMuscles.length === 0) return toast('Bitte mindestens einen Hauptmuskel wählen.', 'error');
    await saveExercise({ ...ex, name: ex.name.trim() });
    toast('Übung gespeichert');
    if (isNew) nav(`/uebungen/uebung/${ex.id}`, { replace: true });
    else nav(-1);
  };

  const motionIds = ex.motionPhotoIds ?? [];
  const slots = Math.min(MAX_MOTION_FRAMES, Math.max(motionSlots, motionIds.length, 2));
  const writeMotion = (list: string[]) => {
    const trimmed = [...list];
    while (trimmed.length && !trimmed[trimmed.length - 1]) trimmed.pop();
    patch({ motionPhotoIds: trimmed.some(Boolean) ? trimmed : undefined });
  };
  const setFrame = (i: number, id: string | undefined) => {
    const list = Array.from({ length: slots }, (_, k) => motionIds[k] ?? '');
    list[i] = id ?? '';
    writeMotion(list);
  };
  const removeFrame = (i: number) => {
    const list = Array.from({ length: slots }, (_, k) => motionIds[k] ?? '');
    list.splice(i, 1);
    setMotionSlots(Math.max(2, slots - 1));
    writeMotion(list);
  };
  const equipmentSorted = [...cat.equipment].sort((a, b) => Number(b.inStudio) - Number(a.inStudio) || a.name.localeCompare(b.name, 'de'));

  return (
    <div className="screen has-footer">
      <ScreenHeader back={<BackButton label="Abbrechen" />} title={isNew ? 'Neue Übung' : 'Übung bearbeiten'} />

      <Field label="Name">
        <input className="input" value={ex.name} onChange={(e) => patch({ name: e.target.value })} placeholder="z. B. Seitheben einarmig" />
      </Field>
      <Field label="Gerät">
        <select className="input" value={ex.equipmentId ?? ''} onChange={(e) => patch({ equipmentId: e.target.value || undefined })}>
          <option value="">Kein Gerät (freie Übung)</option>
          {equipmentSorted.map((e) => (
            <option key={e.id} value={e.id}>
              {e.inStudio ? '★ ' : ''}
              {e.name}
              {e.brand ? ` (${e.brand})` : ''}
            </option>
          ))}
        </select>
      </Field>

      <div className="section-label">Hauptmuskeln</div>
      <div className="chips wrap">
        {MUSCLES.map((m) => (
          <Chip key={m} on={ex.primaryMuscles.includes(m)} onClick={() => toggle('primaryMuscles', m)}>
            {MUSCLE_LABEL[m]}
          </Chip>
        ))}
      </div>
      <div className="section-label">Hilfsmuskeln</div>
      <div className="chips wrap">
        {MUSCLES.map((m) => (
          <Chip key={m} on={ex.secondaryMuscles.includes(m)} onClick={() => toggle('secondaryMuscles', m)}>
            {MUSCLE_LABEL[m]}
          </Chip>
        ))}
      </div>

      <Field label="Erfassung">
        <select className="input" value={ex.tracking} onChange={(e) => patch({ tracking: e.target.value as Tracking })}>
          {(Object.keys(TRACKING_LABEL) as Tracking[]).map((t) => (
            <option key={t} value={t}>
              {TRACKING_LABEL[t]}
            </option>
          ))}
        </select>
      </Field>
      <label className="switch-row card">
        <span>
          Einseitige Übung
          <span className="field-hint" style={{ display: 'block' }}>
            Wiederholungen zählen je Seite (z. B. einarmig).
          </span>
        </span>
        <input type="checkbox" checked={!!ex.unilateral} onChange={(e) => patch({ unilateral: e.target.checked || undefined })} />
      </label>
      <div className="grid2">
        <Field label="Standardpause (s)">
          <NumberInput decimals={false} value={ex.defaultRestSec} onChange={(v) => patch({ defaultRestSec: v ?? 0 })} />
        </Field>
        <Field label="Schrittweite (kg)" hint="Gilt nur ohne Gewichtsstufen am Gerät.">
          <NumberInput value={ex.weightStep} onChange={(v) => patch({ weightStep: v ?? 2.5 })} />
        </Field>
      </div>

      <div className="section-label">Bewegungsskizze</div>
      <Field label="Muster" hint="Die gezeichnete Skizze zeigt, wie die Übung ausgeführt wird. „Automatisch“ wählt nach dem Namen.">
        <select className="input" value={ex.motionId ?? ''} onChange={(e) => patch({ motionId: e.target.value || undefined })}>
          <option value="">Automatisch{motionIdFor({ id: ex.id, name: ex.name }) ? ` (${MOTION_PATTERNS.find((p) => p.id === motionIdFor({ id: ex.id, name: ex.name }))?.name})` : ' (keine passende)'}</option>
          {MOTION_PATTERNS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <ExerciseSketch ex={ex} compact />

      <div className="section-label">Bewegungsbild (optional)</div>
      <p className="muted small">
        Zwei bis sechs eigene Fotos oder Zeichnungen, die den Bewegungsablauf zeigen (Start, Mitte, Ende …). Die App blendet sie der Reihe nach bei der Übung, am Gerät und im Training ein. Angezeigt wird es, sobald mindestens zwei Bilder da sind.
      </p>
      {Array.from({ length: slots }, (_, i) => {
        const name = i === 0 ? 'Startposition' : i === slots - 1 ? 'Endposition' : `Position ${i + 1}`;
        return (
          <div key={i} className="field">
            <span className="field-label">{name}</span>
            <PhotoField photoId={motionIds[i] || undefined} onChange={(id) => setFrame(i, id)} label={name} />
            {slots > 2 && (
              <button type="button" className="btn small ghost" onClick={() => removeFrame(i)}>
                Feld entfernen
              </button>
            )}
          </div>
        );
      })}
      {slots < MAX_MOTION_FRAMES && (
        <button type="button" className="btn block" onClick={() => setMotionSlots(slots + 1)}>
          Weitere Position hinzufügen
        </button>
      )}

      <div className="section-label">Anleitung</div>
      <Field label="Einstellung">
        <textarea className="input area" rows={3} value={i.setup} onChange={(e) => patchI({ setup: e.target.value })} />
      </Field>
      <Field label="Ausführung (ein Schritt pro Zeile)">
        <textarea className="input area" rows={4} defaultValue={i.steps.join('\n')} onBlur={(e) => patchI({ steps: lines(e.target.value) })} />
      </Field>
      <Field label="Atmung">
        <textarea className="input area" rows={2} value={i.breathing} onChange={(e) => patchI({ breathing: e.target.value })} />
      </Field>
      <Field label="Häufige Fehler (einer pro Zeile)">
        <textarea className="input area" rows={3} defaultValue={i.mistakes.join('\n')} onBlur={(e) => patchI({ mistakes: lines(e.target.value) })} />
      </Field>
      <Field label="Tipp">
        <textarea className="input area" rows={2} value={i.tip} onChange={(e) => patchI({ tip: e.target.value })} />
      </Field>

      <div className="footer-bar">
        <button className="btn primary block" onClick={save}>
          Speichern
        </button>
      </div>
    </div>
  );
}
