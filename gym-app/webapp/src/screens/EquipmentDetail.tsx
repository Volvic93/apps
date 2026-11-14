import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { deleteEquipment, saveEquipment, setAdjustmentValue } from '../data/repo';
import { KIND_LABEL, LOADING_LABEL } from '../data/types';
import { equipmentMuscles, hintText, isUnconfirmed } from '../logic/catalog';
import { formatNumber, stackWeights } from '../logic/progression';
import { EquipmentCard, useEquipmentPhoto } from '../ui/EquipmentCard';
import { useCatalog } from '../ui/ExercisePicker';
import { BackButton, ScreenHeader } from '../ui/Header';
import { assetUrl, usePhotoUrl } from '../ui/hooks';
import { IconMinus, IconPlus } from '../ui/Icons';
import { useUi } from '../ui/kit';
import { MuscleFigure } from '../ui/MuscleFigure';
import type { Adjustment } from '../data/types';

function AdjustmentRow({ eqId, a }: { eqId: string; a: Adjustment }) {
  const own = usePhotoUrl(a.photoId);
  const shot = own ?? (a.builtinPhoto ? assetUrl(a.builtinPhoto) : undefined);
  const [zoom, setZoom] = useState(false);
  const v = a.myValue;
  const set = (n: number | undefined) => setAdjustmentValue(eqId, a.id, n === undefined ? undefined : Math.min(a.max, Math.max(a.min, n)));
  return (
    <div className="adj">
      <div className="adj-head">
        <div>
          <div className="row-title">{a.label}</div>
          <div className="row-sub">
            Skala {a.min}–{a.max}
          </div>
        </div>
        <div className="stepper compact">
          <button className="step-btn" aria-label={`${a.label} verringern`} onClick={() => set((v ?? a.min + 1) - 1)}>
            <IconMinus size={20} />
          </button>
          <div className="step-val">{v ?? '–'}</div>
          <button className="step-btn" aria-label={`${a.label} erhöhen`} onClick={() => set((v ?? a.min - 1) + 1)}>
            <IconPlus size={20} />
          </button>
        </div>
      </div>
      {shot && (
        <button className="adj-photo" onClick={() => setZoom((z) => !z)}>
          <img src={shot} alt={`Skala ${a.label}`} className={zoom ? 'zoom' : ''} loading="lazy" />
        </button>
      )}
    </div>
  );
}

export function EquipmentDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { confirm, toast } = useUi();
  const cat = useCatalog();
  const eq = cat?.eqMap.get(id);
  const photo = useEquipmentPhoto(eq);
  const [gallery, setGallery] = useState<string | undefined>(undefined);
  if (!cat) return <div className="screen" />;
  if (!eq) {
    return (
      <div className="screen">
        <BackButton to="/uebungen" />
        <p className="muted">Dieses Gerät gibt es nicht mehr.</p>
      </div>
    );
  }
  const exs = cat.exercises.filter((e) => e.equipmentId === eq.id && !e.hidden).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  // Allgemeine Mehrzweck-Geräte (Langhantel, Kurzhanteln …) haben keine eindeutige Hauptmuskulatur.
  const generic = !eq.inStudio && exs.length > 3;
  const m = generic ? { primary: [], secondary: [] } : equipmentMuscles(eq.id, cat.exercises);
  const stack = eq.weightStack;
  const stackCount = stack ? stackWeights(stack).length : 0;

  return (
    <div className="screen">
      <ScreenHeader
        back={<BackButton to="/uebungen" label="Übungen" />}
        eyebrow={[eq.brand, KIND_LABEL[eq.kind]].filter(Boolean).join(' · ')}
        title={eq.name}
        right={
          <button className="btn small" onClick={() => nav(`/uebungen/geraet-bearbeiten/${eq.id}`)}>
            Bearbeiten
          </button>
        }
      />
      <EquipmentCard eq={eq} primary={m.primary} secondary={m.secondary} onClick={() => photo && setGallery(photo)} />

      {eq.hint && (
        <div className={'notice' + (isUnconfirmed(eq) ? ' warn' : '')}>
          <b>{isUnconfirmed(eq) ? 'Noch zu bestätigen. ' : 'Hinweis. '}</b>
          {isUnconfirmed(eq) ? hintText(eq.hint) : eq.hint}
        </div>
      )}

      {eq.builtinPhotos && eq.builtinPhotos.length > 0 && (
        <section>
          <div className="section-label">Weitere Bilder</div>
          <div className="gallery">
            {eq.builtinPhotos.map((p) => (
              <button key={p.src} className="gallery-item" onClick={() => setGallery(assetUrl(p.src))}>
                <img src={assetUrl(p.src)} alt={p.caption} loading="lazy" />
                <span>{p.caption}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-title">Belastung</div>
        <div className="kv">
          <div>
            <span>Art</span>
            <b>{LOADING_LABEL[eq.loading]}</b>
          </div>
          {stack ? (
            stack.unit === 'platte' ? (
              <div>
                <span>Gewichtsstufen</span>
                <b>Plattennummern {formatNumber(stack.minKg)}–{formatNumber(stack.maxKg)}</b>
                <span className="muted"> – protokolliert wird die Nummer der gesteckten Platte; ohne Kilogramm-Angabe zählt es nicht in das Kilogramm-Volumen</span>
              </div>
            ) : stack.levels?.length ? (
              <div>
                <span>Gewichtsstufen</span>
                <b>{stackWeights(stack).map((w) => formatNumber(w)).join(' · ')} kg</b>
                <span className="muted"> ({stackCount} Stufen, unregelmäßig)</span>
              </div>
            ) : (
              <div>
                <span>Gewichtsstufen</span>
                <b>
                  {formatNumber(stack.minKg)}–{formatNumber(stack.maxKg)} kg in {formatNumber(stack.stepKg)}-kg-Schritten
                </b>
                <span className="muted"> ({stackCount} Stufen)</span>
              </div>
            )
          ) : (
            <div>
              <span>Gewichtsstufen</span>
              <b>nicht hinterlegt</b>
              <span className="muted"> – Schrittweite je Übung</span>
            </div>
          )}
          {eq.perSideInput && (
            <div>
              <span>Scheiben</span>
              <b>Eingabe = aufgelegtes Gesamtgewicht</b>
              <span className="muted"> – die App zeigt „Je Seite“ als Hilfe{eq.ownWeightKg ? `; Eigengewicht ${formatNumber(eq.ownWeightKg)} kg` : ''}</span>
            </div>
          )}
        </div>
      </section>

      {eq.adjustments.length > 0 && (
        <section className="card">
          <div className="card-title">Einstellpunkte – dein Wert</div>
          {eq.adjustments.map((a) => (
            <AdjustmentRow key={a.id} eqId={eq.id} a={a} />
          ))}
          {eq.settingsNote && <p className="muted small">{eq.settingsNote}</p>}
        </section>
      )}

      {(eq.location || eq.settingsNote) && eq.adjustments.length === 0 && (
        <section className="card">
          {eq.location && <p>Standort: {eq.location}</p>}
          {eq.settingsNote && <p>{eq.settingsNote}</p>}
        </section>
      )}

      {m.primary.length > 0 && (
        <section className="card">
          <div className="card-title">Trainierte Muskeln</div>
          <MuscleFigure primary={m.primary} secondary={m.secondary} height={190} />
        </section>
      )}

      <section>
        <div className="section-label">Übungen an diesem Gerät · {exs.length}</div>
        <div className="list">
          {exs.map((e) => (
            <button key={e.id} className="list-row" onClick={() => nav(`/uebungen/uebung/${e.id}`)}>
              <div className="grow">
                <div className="row-title">{e.name}</div>
              </div>
            </button>
          ))}
          {exs.length === 0 && <div className="empty-text pad">Noch keine Übung zugeordnet.</div>}
        </div>
        <button className="btn block" style={{ marginTop: 10 }} onClick={() => nav(`/uebungen/uebung-bearbeiten/neu?geraet=${eq.id}`)}>
          Übung für dieses Gerät anlegen
        </button>
      </section>

      <div className="stack">
        <button
          className="btn block ghost"
          onClick={async () => {
            await saveEquipment({ ...eq, hidden: !eq.hidden });
            toast(eq.hidden ? 'Gerät wieder eingeblendet' : 'Als „nicht in meinem Studio“ ausgeblendet');
          }}
        >
          {eq.hidden ? 'Wieder einblenden' : 'Nicht in meinem Studio (ausblenden)'}
        </button>
        {!eq.builtin && (
          <button
            className="btn block danger"
            onClick={async () => {
              if (await confirm({ title: 'Gerät löschen?', message: 'Die zugehörigen eigenen Übungen bleiben als freie Übungen bestehen.', confirmLabel: 'Löschen', danger: true })) {
                await deleteEquipment(eq.id);
                nav('/uebungen', { replace: true });
              }
            }}
          >
            Gerät löschen
          </button>
        )}
      </div>

      {gallery && (
        <div className="lightbox" onClick={() => setGallery(undefined)} role="dialog" aria-label="Bild">
          <img src={gallery} alt="" />
        </div>
      )}
    </div>
  );
}
