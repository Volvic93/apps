import { assetUrl, usePhotoUrl } from './hooks';
import { MuscleMini } from './MuscleFigure';
import { Pictogram } from './Pictogram';
import { groupColor, groupOfMuscle, MUSCLE_GROUPS } from '../data/muscles';
import type { Equipment, MuscleId } from '../data/types';
import { isUnconfirmed } from '../logic/catalog';

export function useEquipmentPhoto(eq: Pick<Equipment, 'photoId' | 'builtinPhoto'> | undefined): string | undefined {
  const own = usePhotoUrl(eq?.photoId);
  if (own) return own;
  return eq?.builtinPhoto ? assetUrl(eq.builtinPhoto) : undefined;
}

export function groupLabelOf(m: MuscleId | undefined): string {
  if (!m) return '';
  return MUSCLE_GROUPS.find((g) => g.id === groupOfMuscle(m))?.label ?? '';
}

/**
 * Gerätekarte: Foto (oder Piktogramm), Namensband mit Gerätename, Hersteller und Studio-Nummer,
 * Kennzeichnung der Hauptmuskelgruppe mit kleiner Muskelgrafik. Aus Daten zusammengesetzt, nicht als Bild gespeichert.
 */
export function EquipmentCard({
  eq,
  primary,
  secondary,
  onClick,
  compact,
}: {
  eq: Equipment;
  primary: MuscleId[];
  secondary?: MuscleId[];
  onClick?: () => void;
  compact?: boolean;
}) {
  const photo = useEquipmentPhoto(eq);
  const mainMuscle = primary[0];
  const color = mainMuscle ? groupColor(groupOfMuscle(mainMuscle)) : 'var(--muted)';
  const brand = [eq.brand, eq.model && eq.model !== eq.name ? eq.model : undefined].filter(Boolean).join(' · ');
  return (
    <button type="button" className={'eqcard' + (compact ? ' compact' : '') + (eq.hidden ? ' is-hidden' : '')} onClick={onClick} style={{ ['--tag' as string]: color }}>
      <div className="eqcard-photo">
        {photo ? <img src={photo} alt={eq.name} loading="lazy" decoding="async" /> : <Pictogram id={eq.pictogram} size={compact ? 56 : 84} className="eqcard-picto" />}
        <div className="eqcard-top">
          {mainMuscle && (
            <span className="eqcard-tag">
              <span className="eqcard-tag-dot" />
              {groupLabelOf(mainMuscle)}
            </span>
          )}
          {eq.studioNumber && <span className="eqcard-num">Nr. {eq.studioNumber}</span>}
        </div>
        {!compact && primary.length > 0 && (
          <div className="eqcard-mini">
            <MuscleMini primary={primary} secondary={secondary} height={54} />
          </div>
        )}
        <div className="eqcard-band">
          {isUnconfirmed(eq) && <div className="eqcard-tbc">Zu bestätigen</div>}
          <div className="eqcard-name">{eq.name}</div>
          {brand && <div className="eqcard-brand">{brand}</div>}
        </div>
      </div>
    </button>
  );
}

/** Kompakte Listenzeile mit Piktogramm (für Pläne, Auswahllisten). */
export function EquipmentThumb({ eq, size = 44 }: { eq: Pick<Equipment, 'photoId' | 'builtinPhoto' | 'pictogram' | 'name'> | undefined; size?: number }) {
  const photo = useEquipmentPhoto(eq);
  return (
    <div className="thumb" style={{ width: size, height: size }}>
      {photo ? <img src={photo} alt="" loading="lazy" decoding="async" /> : <Pictogram id={eq?.pictogram ?? 'generisch'} size={size - 10} />}
    </div>
  );
}
