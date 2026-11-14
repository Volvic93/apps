import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../data/db';
import { exerciseGroups, matchesQuery } from '../logic/catalog';
import { MUSCLE_GROUPS } from '../data/muscles';
import { trainedExercises } from '../logic/progress';
import { useCatalog } from '../ui/ExercisePicker';
import { ScreenHeader } from '../ui/Header';
import { useLive } from '../ui/hooks';
import { IconChevronRight, IconSearch } from '../ui/Icons';
import { EmptyState, Segmented, formatDateShort } from '../ui/kit';
import { BodyMetrics } from './BodyMetrics';
import { SessionList } from './History';
import { ProgressOverview } from './ProgressOverview';

type Tab = 'ueberblick' | 'uebungen' | 'koerper' | 'verlauf';
const TABS: { value: Tab; label: string }[] = [
  { value: 'ueberblick', label: 'Überblick' },
  { value: 'uebungen', label: 'Übungen' },
  { value: 'koerper', label: 'Körper' },
  { value: 'verlauf', label: 'Verlauf' },
];
const KEY = 'eisenzeit-fortschritt-tab';

function loadTab(): Tab {
  try {
    const v = sessionStorage.getItem(KEY);
    if (v && TABS.some((t) => t.value === v)) return v as Tab;
  } catch {
    /* ohne Speicher: Standard */
  }
  return 'ueberblick';
}

/** Reiter „Fortschritt“: Überblick, Übungen (Kurven), Körperwerte und Trainingsverlauf. */
export function Progress() {
  const [tab, setTab] = useState<Tab>(loadTab);
  const change = (t: Tab) => {
    setTab(t);
    try {
      sessionStorage.setItem(KEY, t);
    } catch {
      /* egal */
    }
  };
  return (
    <div className="screen">
      <ScreenHeader title="Fortschritt" eyebrow={TABS.find((t) => t.value === tab)!.label} />
      <Segmented value={tab} options={TABS} onChange={change} />
      {tab === 'ueberblick' && <ProgressOverview />}
      {tab === 'uebungen' && <ExerciseList />}
      {tab === 'koerper' && <BodyMetrics />}
      {tab === 'verlauf' && <SessionList />}
    </div>
  );
}

function ExerciseList() {
  const nav = useNavigate();
  const cat = useCatalog();
  const sessions = useLive(() => db.sessions.toArray());
  const [q, setQ] = useState('');
  const rows = useMemo(() => (sessions ? trainedExercises(sessions) : []), [sessions]);
  if (!cat || !sessions) return null;
  if (rows.length === 0) return <EmptyState title="Noch keine Übungen" text="Sobald du Übungen trainiert hast, findest du hier jeweils die Kurve für Gewicht, Maximalkraft und Volumen." />;
  const shown = rows.filter((r) => {
    const ex = cat.exMap.get(r.exerciseId);
    return ex ? matchesQuery(ex.name, q) : false;
  });
  return (
    <>
      <div className="search">
        <IconSearch size={18} />
        <input placeholder="Übung suchen" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Übung suchen" />
      </div>
      {shown.length === 0 ? (
        <EmptyState title="Nichts gefunden" text="Prüfe die Schreibweise." />
      ) : (
        <div className="list">
          {shown.map((r) => {
            const ex = cat.exMap.get(r.exerciseId)!;
            const groups = exerciseGroups(ex).map((g) => MUSCLE_GROUPS.find((x) => x.id === g)?.label).join(' · ');
            return (
              <button key={r.exerciseId} className="list-row" onClick={() => nav(`/fortschritt/uebung/${r.exerciseId}`)}>
                <div className="grow">
                  <div className="row-title">{ex.name}</div>
                  <div className="row-sub">
                    {r.count} {r.count === 1 ? 'Einheit' : 'Einheiten'} · zuletzt {formatDateShort(r.last)}
                    {groups && ` · ${groups}`}
                  </div>
                </div>
                <IconChevronRight size={18} className="chev" />
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
