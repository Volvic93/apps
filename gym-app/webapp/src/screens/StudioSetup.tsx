import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveSettings } from '../data/db';
import { setEquipmentPresent } from '../data/repo';
import { KIND_LABEL, type Equipment } from '../data/types';
import { isPresent } from '../logic/catalog';
import { matchesQuery } from '../logic/catalog';
import { EquipmentThumb } from '../ui/EquipmentCard';
import { useCatalog } from '../ui/ExercisePicker';
import { BackButton, ScreenHeader } from '../ui/Header';
import { IconSearch } from '../ui/Icons';
import { EmptyState, useUi } from '../ui/kit';

/** Studio einrichten: alle Geräte des Katalogs durchgehen und markieren, welche es bei dir gibt. */
export function StudioSetup() {
  const nav = useNavigate();
  const { toast } = useUi();
  const cat = useCatalog();
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => {
    const all = (cat?.equipment ?? []).filter((e) => matchesQuery(`${e.name} ${e.brand ?? ''} ${e.model ?? ''}`, q)).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    return [
      { id: 'studio', title: 'Geräte mit Foto aus deinem Studio', items: all.filter((e) => e.builtin && !!e.builtinPhoto) },
      { id: 'general', title: 'Weitere Geräte aus dem Katalog', items: all.filter((e) => e.builtin && !e.builtinPhoto) },
      { id: 'own', title: 'Selbst angelegt', items: all.filter((e) => !e.builtin) },
    ].filter((g) => g.items.length > 0);
  }, [cat, q]);

  if (!cat) return <div className="screen" />;
  const present = (e: Equipment) => draft[e.id] ?? isPresent(e);
  const total = cat.equipment.length;
  const count = cat.equipment.filter(present).length;
  const setMany = (items: Equipment[], value: boolean) => setDraft((d) => ({ ...d, ...Object.fromEntries(items.map((e) => [e.id, value])) }));

  const done = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const changes = cat.equipment.filter((e) => present(e) !== isPresent(e)).map((e) => ({ id: e.id, present: present(e) }));
      await setEquipmentPresent(changes);
      await saveSettings({ studioSetupDone: true });
      toast(changes.length ? `Studio gespeichert – ${count} Geräte vorhanden` : 'Studio gespeichert');
      nav('/uebungen', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen has-footer">
      <ScreenHeader back={<BackButton to="/uebungen" label="Übungen" />} title="Dein Studio" />
      <p className="muted">
        Markiere, welche Geräte es bei dir gibt. Der Katalog zeigt danach nur diese, und der Plan-Assistent wählt nur daraus. Geräte, die du abwählst, bleiben im Katalog erhalten – du kannst sie jederzeit wieder einschalten.
      </p>
      <div className="search">
        <IconSearch size={18} />
        <input placeholder="Gerät suchen" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Geräte suchen" />
      </div>
      <p className="muted small" aria-live="polite">
        {count} von {total} Geräten vorhanden
      </p>

      {groups.length === 0 && <EmptyState title="Keine Treffer" text="Prüfe die Schreibweise oder suche nach einer Marke oder Geräteart." />}

      {groups.map((g) => (
        <section key={g.id}>
          <div className="section-label">{g.title}</div>
          <div className="row gap wrap studio-bulk">
            <button className="btn small" onClick={() => setMany(g.items, true)}>
              Alle vorhanden
            </button>
            <button className="btn small ghost" onClick={() => setMany(g.items, false)}>
              Alle abwählen
            </button>
          </div>
          <div className="list">
            {g.items.map((e) => (
              <label key={e.id} className="list-row static studio-row">
                <EquipmentThumb eq={e} size={44} />
                <div className="grow">
                  <div className="row-title">{e.name}</div>
                  <div className="row-sub">{[e.brand, KIND_LABEL[e.kind]].filter(Boolean).join(' · ')}</div>
                </div>
                <input type="checkbox" role="switch" checked={present(e)} onChange={(ev) => setDraft((d) => ({ ...d, [e.id]: ev.target.checked }))} aria-label={`${e.name} ist bei mir vorhanden`} />
              </label>
            ))}
          </div>
        </section>
      ))}

      <div className="footer-bar">
        <button className="btn primary block" onClick={done} disabled={busy}>
          Fertig
        </button>
      </div>
    </div>
  );
}
