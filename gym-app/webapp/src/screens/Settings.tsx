import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, getSettings, saveSettings } from '../data/db';
import { CATALOG_VERSION } from '../data/katalog';
import { seedCatalog } from '../data/seed';
import { EXPERIENCE_LABEL, GOAL_LABEL, type Appearance, type Experience, type Goal } from '../data/types';
import { applyAppearance } from '../ui/appearance';
import { APP_VERSION, backupFileName, buildBackup, importBackup, markBackupDone, parseBackupText, type BackupSummary, type BackupFile, type ImportMode } from '../logic/backup';
import { platform } from '../platform';
import { csvFileName, trainingCsv } from '../logic/csv';
import { DEFAULT_PLATES } from '../logic/plates';
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
  const activeHintCount = (s?.dismissedHints ?? []).filter((k) => !k.startsWith('later:') || Number(k.split(':').pop()) > Date.now()).length;
  const studioCount = studioCat ? studioCat.equipment.filter(isPresent).length : undefined;
  const [withPhotos, setWithPhotos] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ backup: BackupFile; summary: BackupSummary; warnings: string[]; name: string } | null>(null);
  const [importErrors, setImportErrors] = useState<string[] | null>(null);
  const [reminderNote, setReminderNote] = useState('');

  if (!s) return <div className="screen" />;
  const set = (p: Parameters<typeof saveSettings>[0]) => saveSettings(p);
  type SignalMode = 'aus' | 'ton' | 'vibration' | 'beides';
  const signalMode: SignalMode = s.restSignal && s.vibration ? 'beides' : s.restSignal ? 'ton' : s.vibration ? 'vibration' : 'aus';
  const plates = s.plates ?? DEFAULT_PLATES;
  const PLATE_CHOICES = [0.5, 1.25, 2.5, 5, 10, 15, 20, 25, 30];
  const days = s.trainingDays ?? [];
  const time = s.trainingTime ?? '18:00';
  const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const applyReminders = async (next: { days?: number[]; time?: string; on?: boolean }) => {
    const d = next.days ?? days;
    const t = next.time ?? time;
    const on = next.on ?? !!s.reminderOn;
    await set({ trainingDays: d, trainingTime: t, reminderOn: on });
    const r = await platform.setWeeklyReminders(on ? d : null, t, 'Eisenzeit', 'Heute ist Trainingstag – viel Erfolg!');
    setReminderNote(r === 'verweigert' ? 'Mitteilungen sind für Eisenzeit ausgeschaltet (iPhone: Einstellungen → Mitteilungen).' : r === 'nicht verfuegbar' && on ? 'Erinnerungen gibt es nur in der iPhone-App. In der Web-Version zeigt „Heute“ den Trainingstag an.' : '');
  };
  const doCsv = async () => {
    try {
      const [sessions, exercises, equipment] = await Promise.all([db.sessions.toArray(), db.exercises.toArray(), db.equipment.toArray()]);
      const res = await platform.saveFile({ filename: csvFileName(), mime: 'text/csv', text: trainingCsv(sessions, exercises, equipment) });
      if (res !== 'abgebrochen') toast(res === 'heruntergeladen' ? 'CSV heruntergeladen' : 'CSV bereitgestellt');
    } catch (e) {
      toast(`Export fehlgeschlagen: ${(e as Error).message}`, 'error');
    }
  };

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
          Das hinterlegte Studio. Markiere, welche Geräte es dort gibt – Katalog und Plan-Assistent richten sich danach.
          {s?.studioSetupDone && studioCat && <> Aktuell: <b>{studioCount} von {studioCat.equipment.length} Geräten</b> vorhanden.</>}
        </p>
        <Field label="Name des Studios">
          <input className="input" key={`n-${s?.studio?.name ?? ''}`} defaultValue={s?.studio?.name ?? ''} maxLength={60} onBlur={(e) => void saveSettings({ studio: { name: e.target.value, city: s?.studio?.city ?? '' } })} />
        </Field>
        <Field label="Ort">
          <input className="input" key={`c-${s?.studio?.city ?? ''}`} defaultValue={s?.studio?.city ?? ''} maxLength={60} onBlur={(e) => void saveSettings({ studio: { name: s?.studio?.name ?? '', city: e.target.value } })} />
        </Field>
        <button className="btn block" onClick={() => nav('/uebungen/studio')}>
          {s?.studioSetupDone ? 'Geräte des Studios anpassen' : 'Studio einrichten'}
        </button>
      </section>

      <div className="section-label">Hinweise</div>
      <section className="card">
        <p className="muted small">
          Die Karten auf „Heute“ geben Empfehlungen. Was du mit „Nicht mehr zeigen“ oder „Später“ weggewischt hast, kannst du hier wieder einschalten.
        </p>
        {!activeHintCount && <p className="muted small">Im Moment ist nichts ausgeblendet.</p>}
        <button
          className="btn block"
          disabled={!activeHintCount}
          onClick={async () => {
            await saveSettings({ dismissedHints: [] });
            toast('Hinweise werden wieder gezeigt');
          }}
        >
          Ausgeblendete Hinweise wieder zeigen{activeHintCount ? ` (${activeHintCount})` : ''}
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
        {platform.name === 'ios' ? (
          <>
            <label className="switch-row">
              <span>Nach jedem Training automatisch sichern</span>
              <input type="checkbox" checked={s.autoBackup !== false} onChange={(e) => set({ autoBackup: e.target.checked })} />
            </label>
            <label className="switch-row">
              <span>Fotos in die automatische Sicherung</span>
              <input type="checkbox" checked={!!s.autoBackupPhotos} onChange={(e) => set({ autoBackupPhotos: e.target.checked })} />
            </label>
            <p className="muted small">Die Dateien liegen in der Dateien-App unter „Auf meinem iPhone“ → Eisenzeit → Sicherungen. Es bleiben die letzten fünf.</p>
          </>
        ) : (
          <p className="muted small">Automatisch im Hintergrund sichern kann nur die iPhone-App. In der Web-Version gibt es nach dem Training den Knopf „Sicherung teilen“.</p>
        )}
        <button className="btn block" onClick={doCsv}>
          <IconDownload size={18} /> Trainingsdaten als CSV (Excel)
        </button>
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
        <div className="field-label">Signal am Pausenende</div>
        <Segmented<SignalMode>
          value={signalMode}
          options={[
            { value: 'aus', label: 'Aus' },
            { value: 'ton', label: 'Ton' },
            { value: 'vibration', label: 'Vibration' },
            { value: 'beides', label: 'Beides' },
          ]}
          onChange={(v) => set({ restSignal: v === 'ton' || v === 'beides', vibration: v === 'vibration' || v === 'beides' })}
        />
        {!platform.canVibrate && (
          <p className="muted small">Vibration gibt es auf dem iPhone nur in der iPhone-App. In der Web-Version bleiben Ton und der Hinweis „Pause vorbei“ auf dem Bildschirm.</p>
        )}
        {platform.name === 'ios' && <p className="muted small">Bei gesperrtem Bildschirm kommt zum Pausenende eine Mitteilung (Ton/Vibration nach deiner iPhone-Einstellung).</p>}
        <label className="switch-row">
          <span>10 Sekunden vorher ankündigen</span>
          <input type="checkbox" checked={!!s.restWarn} onChange={(e) => set({ restWarn: e.target.checked })} />
        </label>
        <label className="switch-row">
          <span>Aufwärmsätze vorschlagen</span>
          <input type="checkbox" checked={s.warmupSuggest !== false} onChange={(e) => set({ warmupSuggest: e.target.checked })} />
        </label>
        <label className="switch-row">
          <span>Anstrengung je Satz abfragen („Noch möglich“)</span>
          <input type="checkbox" checked={s.rirEnabled !== false} onChange={(e) => set({ rirEnabled: e.target.checked })} />
        </label>
      </section>

      <div className="section-label">Scheiben (Scheibenrechner)</div>
      <section className="card">
        <p className="muted small">Welche Scheiben gibt es bei dir? Auf scheibenbeladenen Geräten steht unter dem Gewicht, welche Scheiben je Seite aufgelegt werden. Nicht darstellbare Gewichte werden auf das nächste mögliche gerundet.</p>
        <div className="chips wrap">
          {PLATE_CHOICES.map((p) => (
            <Chip key={p} on={plates.includes(p)} onClick={() => set({ plates: plates.includes(p) ? plates.filter((x) => x !== p) : [...plates, p].sort((a, b) => a - b) })}>
              {String(p).replace('.', ',')} kg
            </Chip>
          ))}
        </div>
      </section>

      <div className="section-label">Trainingstage</div>
      <section className="card">
        <div className="chips wrap day-chips">
          {DAY_LABELS.map((l, i) => (
            <Chip key={l} on={days.includes(i)} onClick={() => void applyReminders({ days: days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort() })}>
              {l}
            </Chip>
          ))}
        </div>
        <Field label="Uhrzeit der Erinnerung">
          <input className="input" type="time" value={time} onChange={(e) => e.target.value && void applyReminders({ time: e.target.value })} />
        </Field>
        <label className="switch-row">
          <span>Erinnerung am Trainingstag (iPhone-App)</span>
          <input type="checkbox" checked={!!s.reminderOn} onChange={(e) => void applyReminders({ on: e.target.checked })} />
        </label>
        <p className="muted small">„Heute“ zeigt „Heute ist Trainingstag“, und die Wochenübersicht markiert die geplanten Tage. Die Erinnerung als Mitteilung gibt es nur in der iPhone-App; die Erlaubnis dafür fragt iOS beim Einschalten.</p>
        {reminderNote && <div className="notice warn">{reminderNote}</div>}
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
