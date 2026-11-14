import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings } from '../data/db';
import { KIND_LABEL, type EquipmentKind } from '../data/types';
import { groupColor, groupOfMuscle, MUSCLE_GROUPS, type MuscleGroupId } from '../data/muscles';
import { equipmentMuscles, exerciseGroups, isUnconfirmed, matchesQuery } from '../logic/catalog';
import { EquipmentCard, EquipmentThumb } from '../ui/EquipmentCard';
import { useCatalog } from '../ui/ExercisePicker';
import { ScreenHeader } from '../ui/Header';
import { useLive } from '../ui/hooks';
import { IconChevronRight, IconPlus, IconSearch } from '../ui/Icons';
import { Chip, EmptyState, Segmented, Sheet } from '../ui/kit';

type Tab = 'uebungen' | 'geraete';

export function Catalog() {
  const nav = useNavigate();
  const cat = useCatalog();
  const [tab, setTab] = useState<Tab>((sessionStorage.getItem('catalogTab') as Tab) || 'uebungen');
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<MuscleGroupId | null>(null);
  const [kind, setKind] = useState<EquipmentKind | null>(null);
  const settings = useLive(getSettings);
  const [studioPick, setStudioPick] = useState<boolean | undefined>(undefined);
  // Nach „Dein Studio einrichten“ zeigt der Katalog standardmäßig nur vorhandene Geräte
  const studioOnly = studioPick ?? !!settings?.studioSetupDone;
  const setStudioOnly = (fn: (v: boolean) => boolean) => setStudioPick(fn(studioOnly));
  const [noPhoto, setNoPhoto] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const setTabP = (t: Tab) => {
    setTab(t);
    sessionStorage.setItem('catalogTab', t);
  };

  const exercises = useMemo(() => {
    if (!cat) return [];
    return cat.exercises
      .filter((e) => (showHidden ? true : !e.hidden))
      .filter((e) => {
        const eq = e.equipmentId ? cat.eqMap.get(e.equipmentId) : undefined;
        if (!showHidden && eq?.hidden) return false;
        if (studioOnly && !eq?.inStudio) return false;
        if (group && !exerciseGroups(e).includes(group)) return false;
        return matchesQuery(`${e.name} ${eq?.name ?? ''} ${eq?.brand ?? ''}`, q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }, [cat, q, group, studioOnly, showHidden]);

  const equipment = useMemo(() => {
    if (!cat) return [];
    return cat.equipment
      .filter((e) => (showHidden ? true : !e.hidden))
      .filter((e) => {
        if (studioOnly && !e.inStudio) return false;
        if (noPhoto && (e.photoId || e.builtinPhoto)) return false;
        if (kind && e.kind !== kind) return false;
        if (group) {
          const m = equipmentMuscles(e.id, cat.exercises).primary;
          if (!m.some((x) => groupOfMuscle(x) === group)) return false;
        }
        return matchesQuery(`${e.name} ${e.brand ?? ''} ${e.model ?? ''}`, q);
      })
      .sort((a, b) => Number(b.inStudio) - Number(a.inStudio) || a.name.localeCompare(b.name, 'de'));
  }, [cat, q, group, kind, studioOnly, noPhoto, showHidden]);

  const studio = equipment.filter((e) => e.inStudio);
  const others = equipment.filter((e) => !e.inStudio);

  return (
    <div className="screen">
      <ScreenHeader
        title="Übungen"
        right={
          <button className="icon-btn" aria-label="Neu anlegen" onClick={() => setAddOpen(true)}>
            <IconPlus size={24} />
          </button>
        }
      />
      <Segmented
        value={tab}
        onChange={setTabP}
        options={[
          { value: 'uebungen', label: `Übungen${cat ? ` · ${exercises.length}` : ''}` },
          { value: 'geraete', label: `Geräte${cat ? ` · ${equipment.length}` : ''}` },
        ]}
      />
      <div className="search">
        <IconSearch size={18} />
        <input placeholder={tab === 'uebungen' ? 'Übung, Gerät oder Hersteller' : 'Gerät oder Hersteller'} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Suche" />
      </div>
      <div className="chips">
        <Chip on={studioOnly} onClick={() => setStudioOnly((v) => !v)}>
          Nur mein Studio
        </Chip>
        {MUSCLE_GROUPS.map((g) => (
          <Chip key={g.id} on={group === g.id} onClick={() => setGroup(group === g.id ? null : g.id)} dot={g.color}>
            {g.label}
          </Chip>
        ))}
      </div>
      <button className="btn small ghost" onClick={() => nav('/uebungen/studio')}>
        Studio einrichten
      </button>
      {tab === 'geraete' && (
        <div className="chips">
          {(Object.keys(KIND_LABEL) as EquipmentKind[]).map((k) => (
            <Chip key={k} on={kind === k} onClick={() => setKind(kind === k ? null : k)}>
              {KIND_LABEL[k]}
            </Chip>
          ))}
          <Chip on={noPhoto} onClick={() => setNoPhoto((v) => !v)}>
            Ohne Foto
          </Chip>
        </div>
      )}

      {tab === 'uebungen' && (
        <div className="list">
          {exercises.map((e) => {
            const eq = e.equipmentId ? cat?.eqMap.get(e.equipmentId) : undefined;
            return (
              <button key={e.id} className={'list-row' + (e.hidden ? ' dim' : '')} onClick={() => nav(`/uebungen/uebung/${e.id}`)}>
                <EquipmentThumb eq={eq} />
                <div className="grow">
                  <div className="row-title">{e.name}</div>
                  <div className="row-sub">
                    {eq ? eq.name : 'Freie Übung'}
                    {eq?.inStudio && <span className="badge">Studio</span>}
                    {isUnconfirmed(eq) && <span className="badge warn">Zu bestätigen</span>}
                  </div>
                  <div className="group-text">
                    {exerciseGroups(e).slice(0, 1).map((g) => (
                      <span key={g} className="dot" style={{ background: groupColor(g) }} />
                    ))}
                    {exerciseGroups(e).map((g) => MUSCLE_GROUPS.find((x) => x.id === g)?.label).join(' · ')}
                  </div>
                </div>
                <IconChevronRight size={18} className="chev" />
              </button>
            );
          })}
          {cat && exercises.length === 0 && <EmptyState title="Nichts gefunden" text="Suche oder Filter anpassen." />}
        </div>
      )}

      {tab === 'geraete' && (
        <>
          {studio.length > 0 && (
            <>
              <div className="section-label">Mein Studio</div>
              <div className="eq-grid">
                {studio.map((e) => {
                  const m = cat ? equipmentMuscles(e.id, cat.exercises) : { primary: [], secondary: [] };
                  return <EquipmentCard key={e.id} compact eq={e} primary={m.primary} secondary={m.secondary} onClick={() => nav(`/uebungen/geraet/${e.id}`)} />;
                })}
              </div>
            </>
          )}
          {others.length > 0 && (
            <>
              <div className="section-label">Allgemeine Geräte</div>
              <div className="list">
                {others.map((e) => (
                  <button key={e.id} className={'list-row' + (e.hidden ? ' dim' : '')} onClick={() => nav(`/uebungen/geraet/${e.id}`)}>
                    <EquipmentThumb eq={e} />
                    <div className="grow">
                      <div className="row-title">{e.name}</div>
                      <div className="row-sub">
                        {KIND_LABEL[e.kind]}
                        {isUnconfirmed(e) && <span className="badge warn">Zu bestätigen</span>}
                      </div>
                    </div>
                    <IconChevronRight size={18} className="chev" />
                  </button>
                ))}
              </div>
            </>
          )}
          {cat && equipment.length === 0 && <EmptyState title="Nichts gefunden" text="Suche oder Filter anpassen." />}
        </>
      )}

      <button className="linkish" onClick={() => setShowHidden((v) => !v)}>
        {showHidden ? 'Ausgeblendete wieder verbergen' : 'Ausgeblendete anzeigen'}
      </button>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Neu anlegen">
        <div className="stack">
          <button
            className="btn block"
            onClick={() => {
              setAddOpen(false);
              nav('/uebungen/geraet-bearbeiten/neu');
            }}
          >
            Neues Gerät (mit Foto, Einstellpunkten, Gewichtsstufen)
          </button>
          <button
            className="btn block"
            onClick={() => {
              setAddOpen(false);
              nav('/uebungen/uebung-bearbeiten/neu');
            }}
          >
            Neue Übung
          </button>
        </div>
      </Sheet>
    </div>
  );
}
