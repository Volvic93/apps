import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, uid } from '../data/db';
import { blankEquipment, saveEquipment } from '../data/repo';
import { KIND_LABEL, LOADING_LABEL, type Equipment, type EquipmentKind, type Loading } from '../data/types';
import { parseLevels } from '../logic/progression';
import { BackButton, ScreenHeader } from '../ui/Header';
import { assetUrl } from '../ui/hooks';
import { IconPlus, IconTrash } from '../ui/Icons';
import { Field, NumberInput, useUi } from '../ui/kit';
import { PhotoField } from '../ui/PhotoField';
import { ALL_PICTOGRAMS, PICTOGRAM_LABEL, Pictogram } from '../ui/Pictogram';

function LevelsField({ levels, onCommit, onError }: { levels: number[] | undefined; onCommit: (levels: number[] | undefined) => void; onError: (error: string | undefined) => void }) {
  const fmt = (l: number[] | undefined) => (l ?? []).map((x) => String(x).replace('.', ',')).join('; ');
  const [text, setText] = useState(fmt(levels));
  const [error, setError] = useState<string | undefined>(undefined);
  const change = (value: string) => {
    setText(value);
    if (!value.trim()) {
      setError(undefined);
      onError(undefined);
      onCommit(undefined);
      return;
    }
    const r = parseLevels(value);
    if ('error' in r) {
      setError(r.error);
      onError(r.error);
      return;
    }
    setError(undefined);
    onError(undefined);
    onCommit(r.levels);
  };
  return (
    <Field label="Stufenliste (optional, für unregelmäßige Blöcke)" hint="Mit Semikolon oder Leerzeichen trennen, z. B. 13,6; 22,7; 31,8. Das Komma ist das Dezimalkomma. Leer lassen für gleichmäßige Schritte.">
      <input className="input" inputMode="decimal" value={text} onChange={(e) => change(e.target.value)} onBlur={() => !error && setText(fmt(levels))} aria-invalid={!!error} />
      {error && <p className="muted small" style={{ color: 'var(--danger)' }}>{error}</p>}
    </Field>
  );
}

export function EquipmentEdit() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { toast } = useUi();
  const [eq, setEq] = useState<Equipment | undefined>(undefined);
  const isNew = id === 'neu';
  const [levelsError, setLevelsError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isNew) setEq(blankEquipment());
    else void db.equipment.get(id).then(setEq);
  }, [id, isNew]);

  if (!eq) return <div className="screen" />;
  const patch = (p: Partial<Equipment>) => setEq({ ...eq, ...p });
  const stack = eq.weightStack;

  const save = async () => {
    if (!eq.name.trim()) return toast('Bitte einen Namen eingeben.', 'error');
    if (levelsError) return toast('Die Stufenliste ist ungültig: ' + levelsError, 'error');
    if (stack && !(stack.maxKg > stack.minKg && stack.stepKg > 0)) return toast('Gewichtsstufen: Maximum muss größer als Minimum sein, Schritt größer 0.', 'error');
    for (const a of eq.adjustments) {
      if (!a.label.trim()) return toast('Jeder Einstellpunkt braucht eine Bezeichnung.', 'error');
      if (!(a.max >= a.min)) return toast(`Einstellpunkt „${a.label}“: Maximum darf nicht unter dem Minimum liegen.`, 'error');
    }
    await saveEquipment({ ...eq, name: eq.name.trim() });
    toast('Gerät gespeichert');
    if (isNew) nav(`/uebungen/geraet/${eq.id}`, { replace: true });
    else nav(-1);
  };

  return (
    <div className="screen has-footer">
      <ScreenHeader back={<BackButton label="Abbrechen" />} title={isNew ? 'Neues Gerät' : 'Gerät bearbeiten'} />

      {eq.hint && <div className="notice">{eq.hint}</div>}

      <PhotoField photoId={eq.photoId} fallbackUrl={eq.builtinPhoto ? assetUrl(eq.builtinPhoto) : undefined} onChange={(photoId) => patch({ photoId })} label="Gerätefoto" />

      <Field label="Name im Studio">
        <input className="input" value={eq.name} onChange={(e) => patch({ name: e.target.value })} placeholder="z. B. Beinpresse 45°" />
      </Field>
      <div className="grid2">
        <Field label="Hersteller">
          <input className="input" value={eq.brand ?? ''} onChange={(e) => patch({ brand: e.target.value || undefined })} />
        </Field>
        <Field label="Modell">
          <input className="input" value={eq.model ?? ''} onChange={(e) => patch({ model: e.target.value || undefined })} />
        </Field>
      </div>
      <div className="grid2">
        <Field label="Studio-Nummer">
          <input className="input" value={eq.studioNumber ?? ''} onChange={(e) => patch({ studioNumber: e.target.value || undefined })} placeholder="optional" />
        </Field>
        <Field label="Standort">
          <input className="input" value={eq.location ?? ''} onChange={(e) => patch({ location: e.target.value || undefined })} placeholder="z. B. hinten links" />
        </Field>
      </div>
      <div className="grid2">
        <Field label="Typ">
          <select className="input" value={eq.kind} onChange={(e) => patch({ kind: e.target.value as EquipmentKind })}>
            {(Object.keys(KIND_LABEL) as EquipmentKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Belastung">
          <select className="input" value={eq.loading} onChange={(e) => patch({ loading: e.target.value as Loading })}>
            {(Object.keys(LOADING_LABEL) as Loading[]).map((k) => (
              <option key={k} value={k}>
                {LOADING_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="section-label">Piktogramm</div>
      <div className="picto-grid">
        {ALL_PICTOGRAMS.map((p) => (
          <button key={p} type="button" className={'picto-opt' + (eq.pictogram === p ? ' on' : '')} onClick={() => patch({ pictogram: p })} aria-label={PICTOGRAM_LABEL[p]} title={PICTOGRAM_LABEL[p]}>
            <Pictogram id={p} size={36} />
          </button>
        ))}
      </div>

      <div className="section-label">Gewichtsstufen</div>
      <section className="card">
        <label className="switch-row">
          <span>Gerät hat feste Gewichtsstufen (Gewichtsblock)</span>
          <input
            type="checkbox"
            checked={!!stack}
            onChange={(e) => patch({ weightStack: e.target.checked ? { minKg: 5, maxKg: 100, stepKg: 5 } : undefined })}
          />
        </label>
        {stack && !stack.levels?.length && (
          <div className="grid3">
            <Field label="Minimum (kg)">
              <NumberInput value={stack.minKg} onChange={(v) => patch({ weightStack: { ...stack, minKg: v ?? 0 } })} />
            </Field>
            <Field label="Maximum (kg)">
              <NumberInput value={stack.maxKg} onChange={(v) => patch({ weightStack: { ...stack, maxKg: v ?? 0 } })} />
            </Field>
            <Field label="Schritt (kg)">
              <NumberInput value={stack.stepKg} onChange={(v) => patch({ weightStack: { ...stack, stepKg: v ?? 0 } })} />
            </Field>
          </div>
        )}
        {stack && (
          <>
            <LevelsField
              onError={setLevelsError}
              levels={stack.levels}
              onCommit={(levels) =>
                patch({ weightStack: levels ? { ...stack, levels, minKg: levels[0], maxKg: levels[levels.length - 1] } : { ...stack, levels: undefined } })
              }
            />
            <label className="switch-row">
              <span>Block trägt nur Plattennummern (statt Kilogramm)</span>
              <input type="checkbox" checked={stack.unit === 'platte'} onChange={(e) => patch({ weightStack: { ...stack, unit: e.target.checked ? 'platte' : undefined } })} />
            </label>
          </>
        )}
        <p className="muted small">Die +/−-Tasten im Training springen genau in diesen Stufen.</p>
      </section>

      {eq.loading === 'scheiben' && (
        <section className="card">
          <label className="switch-row">
            <span>Eingabehilfe „Scheiben je Seite“</span>
            <input type="checkbox" checked={!!eq.perSideInput} onChange={(e) => patch({ perSideInput: e.target.checked || undefined })} />
          </label>
          <Field label="Eigengewicht von Hebelarm/Schlitten (kg, optional)">
            <NumberInput value={eq.ownWeightKg} onChange={(v) => patch({ ownWeightKg: v })} placeholder="–" />
          </Field>
        </section>
      )}

      <div className="section-label">Einstellpunkte</div>
      <section className="card">
        {eq.adjustments.map((a, i) => (
          <div key={a.id} className="adj-edit">
            <Field label="Bezeichnung">
              <input
                className="input"
                value={a.label}
                placeholder="z. B. Sitzhöhe"
                onChange={(e) => patch({ adjustments: eq.adjustments.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })}
              />
            </Field>
            <div className="adj-edit-row">
              <Field label="Skala von">
                <NumberInput decimals={false} value={a.min} onChange={(v) => patch({ adjustments: eq.adjustments.map((x, k) => (k === i ? { ...x, min: v ?? 1 } : x)) })} />
              </Field>
              <Field label="bis">
                <NumberInput decimals={false} value={a.max} onChange={(v) => patch({ adjustments: eq.adjustments.map((x, k) => (k === i ? { ...x, max: v ?? 1 } : x)) })} />
              </Field>
              <Field label="Dein Wert">
                <NumberInput decimals={false} value={a.myValue} onChange={(v) => patch({ adjustments: eq.adjustments.map((x, k) => (k === i ? { ...x, myValue: v } : x)) })} />
              </Field>
              <button className="icon-btn danger" aria-label="Einstellpunkt entfernen" onClick={() => patch({ adjustments: eq.adjustments.filter((_, k) => k !== i) })}>
                <IconTrash size={20} />
              </button>
            </div>
          </div>
        ))}
        <button className="btn small" onClick={() => patch({ adjustments: [...eq.adjustments, { id: uid(), label: '', min: 1, max: 10 }] })}>
          <IconPlus size={18} /> Einstellpunkt hinzufügen
        </button>
      </section>

      <Field label="Notiz zu den Einstellungen">
        <textarea className="input area" rows={2} value={eq.settingsNote ?? ''} onChange={(e) => patch({ settingsNote: e.target.value || undefined })} placeholder="z. B. Pin immer von links stecken" />
      </Field>

      <label className="switch-row card">
        <span>Gehört zu meinem Studio</span>
        <input type="checkbox" checked={eq.inStudio} onChange={(e) => patch({ inStudio: e.target.checked })} />
      </label>

      <div className="footer-bar">
        <button className="btn primary block" onClick={save}>
          Speichern
        </button>
      </div>
    </div>
  );
}
