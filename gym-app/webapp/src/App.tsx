import { useEffect } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { getActiveSession } from './data/repo';
import { Catalog } from './screens/Catalog';
import { EquipmentDetail } from './screens/EquipmentDetail';
import { EquipmentEdit } from './screens/EquipmentEdit';
import { ExerciseDetail } from './screens/ExerciseDetail';
import { ExerciseEdit } from './screens/ExerciseEdit';
import { ExerciseProgress } from './screens/ExerciseProgress';
import { Progress } from './screens/Progress';
import { PlanEditor } from './screens/PlanEditor';
import { AiPlan } from './screens/AiPlan';
import { PlanAssistant } from './screens/PlanAssistant';
import { PlanImport } from './screens/PlanImport';
import { PlanMerge } from './screens/PlanMerge';
import { Plans } from './screens/Plans';
import { SessionDetail } from './screens/SessionDetail';
import { Sketches } from './screens/Sketches';
import { Settings } from './screens/Settings';
import { StudioSetup } from './screens/StudioSetup';
import { Today } from './screens/Today';
import { Training } from './screens/Training';
import { useLive } from './ui/hooks';
import { IconExercises, IconPlans, IconProgress, IconToday, IconTrain } from './ui/Icons';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { UiProvider } from './ui/kit';

const TABS = [
  { to: '/heute', label: 'Heute', icon: IconToday },
  { to: '/training', label: 'Training', icon: IconTrain },
  { to: '/plaene', label: 'Pläne', icon: IconPlans },
  { to: '/uebungen', label: 'Übungen', icon: IconExercises },
  { to: '/fortschritt', label: 'Fortschritt', icon: IconProgress },
];

function Shell() {
  const { pathname } = useLocation();
  const active = useLive(() => getActiveSession());
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  const inTraining = pathname.startsWith('/training') && !!active;
  const hideTabs = inTraining || pathname.includes('bearbeiten') || pathname === '/uebungen/studio';
  return (
    <div className="app">
      <div className="edge-band" aria-hidden="true" />
      <ErrorBoundary key={pathname}>
      <Routes>
        <Route path="/" element={<Navigate to="/heute" replace />} />
        <Route path="/heute" element={<Today />} />
        <Route path="/training" element={<Training />} />
        <Route path="/plaene" element={<Plans />} />
        <Route path="/plaene/assistent" element={<PlanAssistant />} />
        <Route path="/plaene/ki" element={<AiPlan />} />
        <Route path="/plaene/importieren" element={<PlanImport />} />
        <Route path="/plaene/zusammenfuehren" element={<PlanMerge />} />
        <Route path="/plaene/:id" element={<PlanEditor />} />
        <Route path="/uebungen" element={<Catalog />} />
        <Route path="/uebungen/studio" element={<StudioSetup />} />
        <Route path="/uebungen/uebung/:id" element={<ExerciseDetail />} />
        <Route path="/uebungen/geraet/:id" element={<EquipmentDetail />} />
        <Route path="/uebungen/geraet-bearbeiten/:id" element={<EquipmentEdit />} />
        <Route path="/uebungen/uebung-bearbeiten/:id" element={<ExerciseEdit />} />
        <Route path="/fortschritt" element={<Progress />} />
        <Route path="/fortschritt/uebung/:id" element={<ExerciseProgress />} />
        <Route path="/fortschritt/:id" element={<SessionDetail />} />
        <Route path="/einstellungen" element={<Settings />} />
        <Route path="/skizzen" element={<Sketches />} />
        <Route path="*" element={<Navigate to="/heute" replace />} />
      </Routes>
      </ErrorBoundary>
      {!hideTabs && (
        <nav className="tabbar" aria-label="Hauptnavigation">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}>
              <span className="tab-icon">
                <t.icon size={25} />
                {t.to === '/training' && active && <span className="tab-dot" />}
              </span>
              <span className="tab-label">{t.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <UiProvider>
        <Shell />
      </UiProvider>
    </HashRouter>
  );
}
