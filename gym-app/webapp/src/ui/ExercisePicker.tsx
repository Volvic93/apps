import { useEffect, useMemo, useState } from 'react';
import { db } from '../data/db';
import { MUSCLE_GROUPS } from '../data/muscles';
import type { Equipment, Exercise } from '../data/types';
import { exerciseGroups, isUnconfirmed, matchesQuery } from '../logic/catalog';
import { EquipmentThumb } from './EquipmentCard';
import { useLive } from './hooks';
import { IconSearch } from './Icons';
import { Chip, Sheet } from './kit';
import type { MuscleGroupId } from '../data/muscles';

export interface Catalog {
  exercises: Exercise[];
  equipment: Equipment[];
  exMap: Map<string, Exercise>;
  eqMap: Map<string, Equipment>;
}

export function useCatalog(): Catalog | undefined {
  return useLive(async () => {
    const [exercises, equipment] = await Promise.all([db.exercises.toArray(), db.equipment.toArray()]);
    return {
      exercises,
      equipment,
      exMap: new Map(exercises.map((e) => [e.id, e])),
      eqMap: new Map(equipment.map((e) => [e.id, e])),
    };
  });
}

export function ExercisePicker({
  open,
  onClose,
  onPick,
  title = 'Übung wählen',
  initialGroup,
  initialQuery = '',
}: {
  open: boolean;
  onClose: () => void;
  onPick: (ex: Exercise) => void;
  title?: string;
  /** Beim Öffnen vorgewählte Muskelgruppe (z. B. die der zu tauschenden Übung). */
  initialGroup?: MuscleGroupId | null;
  /** Beim Öffnen vorbelegte Suche (z. B. der Name aus einem Import). */
  initialQuery?: string;
}) {
  const cat = useCatalog();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<MuscleGroupId | null>(null);
  const [studioOnly, setStudioOnly] = useState(false);
  useEffect(() => {
    if (open) {
      setQ(initialQuery);
      setGroup(initialGroup ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const list = useMemo(() => {
    if (!cat) return [];
    return cat.exercises
      .filter((e) => !e.hidden)
      .filter((e) => {
        const eq = e.equipmentId ? cat.eqMap.get(e.equipmentId) : undefined;
        if (eq?.hidden) return false;
        if (studioOnly && !eq?.inStudio) return false;
        if (group && !exerciseGroups(e).includes(group)) return false;
        return matchesQuery(`${e.name} ${eq?.name ?? ''} ${eq?.brand ?? ''}`, q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }, [cat, q, group, studioOnly]);

  return (
    <Sheet open={open} onClose={onClose} title={title} tall>
      <div className="search">
        <IconSearch size={18} />
        <input placeholder="Übung oder Gerät suchen" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Suche" />
      </div>
      <div className="chips">
        <Chip on={studioOnly} onClick={() => setStudioOnly((v) => !v)}>
          Mein Studio
        </Chip>
        {MUSCLE_GROUPS.map((g) => (
          <Chip key={g.id} on={group === g.id} onClick={() => setGroup(group === g.id ? null : g.id)} dot={g.color}>
            {g.label}
          </Chip>
        ))}
      </div>
      <div className="list">
        {list.map((e) => {
          const eq = e.equipmentId ? cat?.eqMap.get(e.equipmentId) : undefined;
          return (
            <button key={e.id} className="list-row" onClick={() => onPick(e)}>
              <EquipmentThumb eq={eq} />
              <div className="grow">
                <div className="row-title">{e.name}</div>
                <div className="row-sub">
                  {eq ? eq.name : 'Freie Übung'}
                  {isUnconfirmed(eq) && <span className="badge warn">Zu bestätigen</span>}
                </div>
              </div>
            </button>
          );
        })}
        {cat && list.length === 0 && <div className="empty-text pad">Keine passende Übung gefunden.</div>}
      </div>
    </Sheet>
  );
}
