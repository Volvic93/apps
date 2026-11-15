import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, getSettings, saveSettings } from '../data/db';
import { CATALOG_VERSION } from '../data/katalog';
import { seedCatalog } from '../data/seed';
import { EXPERIENCE_LABEL, GOAL_LABEL, type Appearance, type Experience, type Goal } from '../data/types';
import { applyAppearance } from '../ui/appearance';
import { APP_VERSION, backupFileName, buildBackup, importBackup, markBackupDone, parseBackupText, type BackupSummary, type BackupFile, type ImportMode } from '../logic/backup';
import { platform } from '../platform';
import { BackButton, ScreenHeader } from '../ui/Header';
import { useCatalog } from '../ui/ExercisePicker';
import { isPresent } from '../logic/catalog';
import { useLive } from '../ui/hooks';
import { IconDownload, IconUpload } from '../ui/Icons';
import { Chip, Field, NumberInput, Segmented, Sheet, useUi } from '../ui/kit';
import { Stepper } from '../ui/Stepper';

export function Settings() {
  const nav = useNavigate();
  const { toast, confirm } = useUi();
  const s = useLive(() => getSettings());
  const studioCat = useCatalog();
  const studioCount = studioCat ? studioCat.equipment.filter(isPresent).length : undefined;
  const [withPhotos, setWithPhotos] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ backup: BackupFile; summary: BackupSummary; warnings: string[]; name: string } | null>(null);
  const [importErrors, setImportErrors] = useState<string[] | null>(null);

  if (!s) return <div className="screen" />;
  const set = (p: Parameters<typeof saveSettings>[0]) => saveSettings(p);

  const doExport = async () => {
    setBusy(true);
    try {
      const backup = await buildBackup(db, withPhotos);
      const text = JSON.stringify(backup);
      const result = await platform.saveFile({ filename: backupFileName(), mime: 'application/json', text });
      if (result !== 'abgebrochen') {
        await markBackupDone();
        toast(result === 'heruntergeladen' ? 'Sicherung heruntergeladen' : 'Sicherung bereitgestellt');
      }
    } catch (e) {
      toast(`Export fehlgeschlagen: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const pickImport = async () => {
    const file = await platform.pickFile('application/json,.json');
    if (!file) return;
    try {
      const text = await file.text();
      const res = parseBackupText(text);
      if (!res.ok) {
        setImportErrors(res.errors);
        return;
      }
      setPreview({ backup: res.backup, summary: res.summary, warnings: res.warnings, name: file.name });
    } catch (e) {
      setImportErrors([`Die Datei konnte nicht gelesen werden: ${(e as Error).message}`]);
    }
  };

  const runImport = async (mode: ImportMode) => {
    if (!preview) return;
    if (mode === 'ersetzen') {
      const ok = await confirm({ title: 'Alle Daten ersetzen?', message: 'Pläne, Trainings und Einstellungen auf diesem Gerät werden durch den Inhalt der Sicherung ersetzt.', confirmLabel: 'Ersetzen', danger: true });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await importBackup(preview.backup, mode);
      setPreview(null);
      toast(mode === 'ersetzen' ? 'Sicherung eingespielt' : 'Sicherung zusammengeführt');
    } catch (e) {
      toast(`Import fehlgeschlagen: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const sm = preview?.summary;
  const lastBackup = s.lastBackupAt ? new Date(s.lastBackupAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) : 'noch nie';

  return (
    <div className="screen">
      <ScreenHeader back={<BackButton to="/heute" label="Heute" />} title="Einstellungen" />

      <div className="section-label">Dein Studio</div>
      <section className="card">
        <p className="muted small">
          Markiere, welche Geräte es bei dir gibt. Katalog und Plan-Assistent richten sich danach.
          {s?.studioSetupDone && studioCat && <> Aktuell: <b>{studioCount} von {studioCat.equipment.length} Geräten</b> vorhanden.</>}
        </p>
        <button className="btn block" onClick={() => nav('/uebungen/studio')}>
          {s?.studioSetupDone ? 'Studio anpassen' : 'Studio einrichten'}
        </button>
      </section>

      <div className="section-label">Sicherung</div>
      <section className="card">
        <p className="muted small">
          Deine Daten liegen nur auf diesem Gerät. Die Sicherungsdatei enthält alles – Pläne, Trainings, eigene Geräte. Letzte Sicherung: <b>{lastBackup}</b>.
        </p>
        <label className="switch-row">
          <span>Fotos in die Sicherung aufnehmen</span>
          <input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} />
        </label>
        <button className="btn primary block" onClick={doExport} disabled={busy}>
          <IconDownload size={18} /> Sicherung exportieren
        </button>
        <button className="btn block" onClick={pickImport} disabled={busy}>
          <IconUpload size={18} /> Sicherung importieren
        </button>
        <p className="muted small">Web-Version und iPhone-App haben getrennte Speicher. Zum Wechseln die Sicherung exportieren und dort importieren.</p>
        <label className="switch-row">
          <span>An regelmäßige Sicherung erinnern</span>
          <input type="checkbox" checked={s.backupReminder} onChange={(e) => set({ backupReminder: e.target.checked })} />
        </label>
      </section>

      <div className="section-label">Darstellung</div>
      <section className="card">
        <Segmented<Appearance>
          value={s.appearance}
          options={[
            { value: 'dunkel', label: 'Dunkel' },
            { value: 'system', label: 'System' },
            { value: 'hell', label: 'Hell' },
          ]}
          onChange={(v) => {
            applyAppearance(v);
            void set({ appearance: v });
          }}
        />
        <p className="muted small">Dunkel ist voreingestellt. „System“ folgt der Einstellung deines Geräts.</p>
      </section>

      <div className="section-label">Training</div>
      <section className="card">
        <div className="row between">
          <span className="field-label">Standard-Pause</span>
          <Stepper compact label="Standard-Pause" decimals={false} value={s.defaultRestSec} unit="s" onStep={(d) => set({ defaultRestSec: Math.max(15, s.defaultRestSec + d * 15) })} onSet={(v) => v && set({ defaultRestSec: Math.max(15, Math.round(v)) })} />
        </div>
        <div className="row between">
          <span className="field-label">Standard-Schrittweite</span>
          <Stepper compact label="Standard-Schrittweite" value={s.defaultWeightStep} unit="kg" onStep={(d) => set({ defaultWeightStep: Math.max(0.5, s.defaultWeightStep + d * 0.5) })} onSet={(v) => v && set({ defaultWeightStep: v })} />
        </div>
        <div className="row between">
          <span className="field-label">Planlaufzeit</span>
          <Stepper compact label="Planlaufzeit" decimals={false} value={s.planWeeksDefault} unit="Wo." onStep={(d) => set({ planWeeksDefault: Math.min(16, Math.max(4, s.planWeeksDefault + d)) })} onSet={(v) => v && set({ planWeeksDefault: Math.min(16, Math.max(4, Math.round(v))) })} />
        </div>
        <label className="switch-row">
          <span>Signalton am Pausenende</span>
          <input type="checkbox" checked={s.restSignal} onChange={(e) => set({ restSignal: e.target.checked })} />
        </label>
        <label className="switch-row">
          <span>Vibration</span>
          <input type="checkbox" checked={s.vibration} onChange={(e) => set({ vibration: e.target.checked })} />
        </label>
      </section>

      <div className="section-label">Profil</div>
      <section className="card">
        <div className="field-label">Ziel</div>
        <div className="chips wrap">
          {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
            <Chip key={g} on={s.profile.goal === g} onClick={() => set({ profile: { ...s.profile, goal: g } })}>
              {GOAL_LABEL[g]}
            </Chip>
          ))}
        </div>
        <div className="field-label">Erfahrung</div>
        <div className="chips wrap">
          {(Object.keys(EXPERIENCE_LABEL) as Experience[]).map((g) => (
            <Chip key={g} on={s.profile.experience === g} onClick={() => set({ profile: { ...s.profile, experience: g } })}>
              {EXPERIENCE_LABEL[g]}
            </Chip>
          ))}
        </div>
        <Field label="Trainingstage pro Woche">
          <NumberInput decimals={false} value={s.profile.daysPerWeek} min={1} max={7} onChange={(v) => v && set({ profile: { ...s.profile, daysPerWeek: Math.round(v) } })} />
        </Field>
        <p className="muted small">Ziel und Trainingstage dienen als Vorbelegung für Plan-Assistent und „Mit KI planen“ (der Assistent plant 2–6 Tage).</p>
      </section>

      <div className="section-label">Info</div>
      <section className="card">
        <div className="kv">
          <div>
            <span>Eisenzeit</span>
            <b>Version {APP_VERSION}</b>
          </div>
          <div>
            <span>Katalog</span>
            <b>Stand {CATALOG_VERSION}</b>
          </div>
          <div>
            <span>Ausgabe</span>
            <b>{platform.name === 'ios' ? 'iPhone-App' : 'Web-App'}</b>
          </div>
        </div>
        <p className="muted small">Verwendet quelloffene Bausteine: React, React Router, Dexie, Vite, Capacitor (MIT bzw. Apache-2.0-Lizenz).</p>
        <button
          className="btn block ghost"
          onClick={async () => {
            await seedCatalog(db, true);
            toast('Katalog abgeglichen');
          }}
        >
          Katalog neu abgleichen
        </button>
        <button
          className="btn block danger"
          onClick={async () => {
            if (!(await confirm({ title: 'Alle Daten löschen?', message: 'Pläne, Trainings, Fotos und eigene Geräte werden unwiderruflich gelöscht. Erstelle vorher eine Sicherung.', confirmLabel: 'Alles löschen', danger: true }))) return;
            await db.transaction('rw', [db.plans, db.sessions, db.bodyMetrics, db.photos, db.equipment, db.exercises, db.settings], async () => {
              await Promise.all([db.plans.clear(), db.sessions.clear(), db.bodyMetrics.clear(), db.photos.clear(), db.equipment.clear(), db.exercises.clear(), db.settings.clear()]);
            });
            await seedCatalog(db, true);
            toast('Alle Daten gelöscht');
            nav('/heute');
          }}
        >
          Alle Daten löschen
        </button>
      </section>

      <Sheet open={!!preview} onClose={() => setPreview(null)} title="Sicherung einspielen" tall>
        {sm && (
          <>
            <p className="muted small">{preview?.name}</p>
            <div className="kv wide">
              <div>
                <span>Pläne</span>
                <b>
                  {sm.plans} ({sm.workouts} Einheiten)
                </b>
              </div>
              <div>
                <span>Trainings</span>
                <b>{sm.sessions}</b>
              </div>
              <div>
                <span>Zeitraum</span>
                <b>{sm.firstSession ? `${new Date(sm.firstSession).toLocaleDateString('de-DE')} – ${new Date(sm.lastSession!).toLocaleDateString('de-DE')}` : '–'}</b>
              </div>
              <div>
                <span>Eigene Geräte / Übungen</span>
                <b>
                  {sm.customEquipment} / {sm.customExercises}
                </b>
              </div>
              <div>
                <span>Fotos</span>
                <b>{sm.photos}</b>
              </div>
              <div>
                <span>Erstellt</span>
                <b>{sm.exportedAt ? new Date(sm.exportedAt).toLocaleString('de-DE') : '–'}</b>
              </div>
            </div>
            {preview?.warnings.map((w) => (
              <div key={w} className="notice small">
                {w}
              </div>
            ))}
            <div className="stack">
              <button className="btn danger block" disabled={busy} onClick={() => runImport('ersetzen')}>
                Ersetzen – alles auf diesem Gerät überschreiben
              </button>
              <button className="btn primary block" disabled={busy} onClick={() => runImport('zusammenfuehren')}>
                Zusammenführen – Neues ergänzen, Neueres behalten
              </button>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={!!importErrors} onClose={() => setImportErrors(null)} title="Sicherung nicht lesbar">
        <div className="notice warn">Es wurde nichts verändert.</div>
        <ul className="errlist">
          {importErrors?.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
        <button className="btn block" onClick={() => setImportErrors(null)}>
          OK
        </button>
      </Sheet>
    </div>
  );
}
