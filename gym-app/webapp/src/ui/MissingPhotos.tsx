import { useNavigate } from 'react-router-dom';
import type { Plan } from '../data/types';
import { planEquipmentWithoutPhoto } from '../logic/catalog';
import type { Catalog } from './ExercisePicker';
import { IconCamera } from './Icons';
import { Chip } from './kit';

/** Hinweis im Plan: Geräte ohne Foto, mit Sprung zum Fotografieren. */
export function MissingPhotos({ plan, cat }: { plan: Pick<Plan, 'workouts'>; cat: Catalog }) {
  const nav = useNavigate();
  const missing = planEquipmentWithoutPhoto(plan, cat.exMap, cat.eqMap);
  if (!missing.length) return null;
  return (
    <div className="notice">
      <b>{missing.length === 1 ? 'Ein Gerät hat noch kein Foto.' : `${missing.length} Geräte haben noch kein Foto.`}</b> Mit eigenem Foto erkennst du es im Training sofort wieder. Tippe auf ein Gerät, um es zu fotografieren.
      <div className="chips wrap" style={{ marginTop: 8 }}>
        {missing.map((e) => (
          <Chip key={e.id} onClick={() => nav(`/uebungen/geraet-bearbeiten/${e.id}`)}>
            <IconCamera size={16} /> {e.name}
          </Chip>
        ))}
      </div>
    </div>
  );
}
