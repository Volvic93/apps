import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../data/db';
import { createEntryForExercise, discardSession, finishSession, newSet, substituteEntries } from '../data/repo';
import type { Entry, Exercise, Session, SetEntry } from '../data/types';
import { alternativesFor } from '../logic/catalog';
import { formatNumber, lastPerformance, summarizeSets } from '../logic/progression';
import { suggestNext } from '../logic/progress';
import { isPersonalRecord, isWorkSet } from '../logic/stats';
import { platform } from '../platform';
import { runAutoBackup } from '../logic/autobackup';
import { LiveActivitySync } from '../ui/LiveActivitySync';
import { warmupOffer } from '../logic/warmup';
import { useEquipmentPhoto } from '../ui/EquipmentCard';
import { Lightbox, type LightboxImage } from '../ui/Lightbox';
import { ExerciseSketch, MotionSketch } from '../ui/MotionSketch';
import { motionFor } from '../data/motions';
import { ExercisePicker, useCatalog, type Catalog } from '../ui/ExercisePicker';
import { assetUrl, useLive, useNow } from '../ui/hooks';
import { InstructionsView } from '../ui/Instructions';
import { MotionImage } from '../ui/MotionImage';
import { IconArrowDown, IconArrowUp, IconCheck, IconDots, IconInfo, IconNote, IconPlus, IconSkip, IconSwap, IconTrash } from '../ui/Icons';
import { Sheet, formatDateShort, formatDuration, useUi } from '../ui/kit';
import { Pictogram } from '../ui/Pictogram';
import { RestTimer } from './RestTimer';
import { SetRow } from './SetRow';
import { getSettings } from '../data/db';

/** Lokaler Sitzungszustand mit sofortigem, der Reihe nach ausgeführtem Speichern jeder Änderung. */
function useSessionState(initial: Session) {
  const [s, setS] = useState(initial);
  const ref = useRef(initial);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const closed = useRef(false);
  const update = useCallback((fn: (cur: Session) => Session) => {
    if (closed.current) return; // nach Abschluss/Verwerfen darf nichts mehr geschrieben werden
    const next = { ...fn(ref.current), updatedAt: Date.now() };
    ref.current = next;
    setS(next);
    queue.current = queue.current.then(() => db.sessions.put(next)).catch((e) => console.error('Speichern fehlgeschlagen', e));
  }, []);
  const flush = useCallback(() => queue.current, []);
  const close = useCallback(() => {
    closed.current = true;
  }, []);
  return { s, update, flush, ref, close };
}

/** Name der Übung und – getrennt davon – das Gerät: „Drücken an der Multipresse“ / „Panatta Power Smith“. */
function splitName(name: string): { title: string; extra?: string } {
  const m = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(name);
  return m && m[1] ? { title: m[1], extra: m[2] } : { title: name };
}

/**
 * Gerätefoto im Training: das ganze Bild (nicht beschnitten), Tippen vergrößert zur Vollbildansicht.
 * Nach dem ersten eingetragenen Satz klappt es zu einer kompakten Zeile zusammen, damit die Sätze Platz haben.
 */
function EntryHero({ ex, cat, started }: { ex: Exercise; cat: Catalog; started: boolean }) {
  const eq = ex.equipmentId ? cat.eqMap.get(ex.equipmentId) : undefined;
  const photo = useEquipmentPhoto(eq);
  const [open, setOpen] = useState(!started);
  const [zoom, setZoom] = useState(false);
  const [sketchOpen, setSketchOpen] = useState(false);
  const pattern = motionFor(ex);
  const touched = useRef(false);
  useEffect(() => {
    if (started && !touched.current) setOpen(false);
  }, [started]);
  const images: LightboxImage[] = photo ? [{ src: photo, caption: eq?.name ?? ex.name }] : [];
  for (const p of eq?.builtinPhotos ?? []) {
    const src = assetUrl(p.src);
    if (src !== photo) images.push({ src, caption: p.caption });
  }
  const { title, extra } = splitName(ex.name);
  const sub = [eq ? [eq.brand, eq.name].filter(Boolean).join(' · ') : 'Freie Übung', extra].filter(Boolean).join(' · ');
  const toggle = () => {
    touched.current = true;
    setOpen((v) => !v);
  };
  return (
    <div className={'hero2' + (open ? ' open' : ' closed')}>
      {open && (
        <div className={'hero2-tiles' + (pattern ? ' two' : '')}>
          <button type="button" className="hero2-photo" onClick={() => photo && setZoom(true)} aria-label={photo ? 'Gerätefoto vergrößern' : 'Gerät'} disabled={!photo}>
            {photo ? <img src={photo} alt={eq?.name ?? ex.name} decoding="async" /> : <Pictogram id={eq?.pictogram ?? 'koerpergewicht'} size={96} className="hero-picto" />}
            {images.length > 1 && <span className="hero2-more">{images.length} Bilder</span>}
          </button>
          {pattern && (
            <div role="button" tabIndex={0} className="hero2-sketch" onClick={() => setSketchOpen(true)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSketchOpen(true)} aria-label="Bewegungsskizze vergrößern">
              <ExerciseSketch ex={ex} compact bare />
              <span className="hero2-more">Skizze</span>
            </div>
          )}
        </div>
      )}
      <button type="button" className="hero2-row" onClick={toggle} aria-expanded={open}>
        {!open && (
          <span className="hero2-thumb">{photo ? <img src={photo} alt="" decoding="async" /> : <Pictogram id={eq?.pictogram ?? 'koerpergewicht'} size={40} />}</span>
        )}
        <span className="hero2-text">
          <span className="hero2-name">{title}</span>
          <span className="hero2-sub">{sub}</span>
        </span>
        <span className="hero2-chev" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {zoom && images.length > 0 && <Lightbox images={images} onClose={() => setZoom(false)} />}
      <Sheet open={sketchOpen} onClose={() => setSketchOpen(false)} title={pattern?.name ?? 'Bewegung'} tall>
        {pattern && <MotionSketch pattern={pattern} />}
      </Sheet>
    </div>
  );
}

export function TrainingMode({ initial, onEnd }: { initial: Session; onEnd: (finishedId: string | null) => void }) {
  const cat = useCatalog();
  const history = useLive(() => db.sessions.filter((x) => x.endedAt !== undefined).toArray());
  const { s, update, flush, ref, close } = useSessionState(initial);
  const { toast, confirm } = useUi();
  const now = useNow(true, 1000);

  const [pickOpen, setPickOpen] = useState(false);
  const [altOpen, setAltOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const swapping = useRef(false);
  const settings = useLive(() => getSettings());
  const [restFlash, setRestFlash] = useState(false);
  const currentIdx = s.currentIndex ?? 0;
  useEffect(() => {
    // neue Übung: wieder nach oben (Foto, Name, „Letztes Mal“ sichtbar)
    document.querySelector('.train-body')?.scrollTo(0, 0);
  }, [currentIdx]);
  // (Hooks stehen vor dem frühen Return)

  const idx = Math.max(0, Math.min(s.currentIndex ?? 0, Math.max(0, s.entries.length - 1)));
  const entry: Entry | undefined = s.entries[idx];

  // Bildschirm wach halten, solange das Training läuft; Pausenmitteilung am Ende aufräumen.
  useEffect(() => {
    void platform.keepAwake(true);
    return () => {
      void platform.keepAwake(false);
      void platform.cancelRestNotification();
    };
  }, []);

  // Nach App-Neustart: eine längst abgelaufene Pause still verwerfen.
  useEffect(() => {
    if (initial.restEndsAt && initial.restEndsAt < Date.now() - 5000) update((c) => ({ ...c, restEndsAt: undefined, restTotalSec: undefined }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cat) return <div className="train" />;

  const exOf = (e: Entry) => cat.exMap.get(e.exerciseId);
  const setEntry = (i: number, fn: (e: Entry) => Entry) => update((c) => ({ ...c, entries: c.entries.map((e, k) => (k === i ? fn(e) : e)) }));
  const goTo = (i: number) => update((c) => ({ ...c, currentIndex: Math.max(0, Math.min(i, c.entries.length - 1)) }));

  const startRest = (sec: number, nextName: string) => {
    if (sec <= 0) return;
    const endsAt = Date.now() + sec * 1000;
    update((c) => ({ ...c, restEndsAt: endsAt, restTotalSec: sec }));
    void platform.scheduleRestNotification(endsAt, 'Pause vorbei', `Weiter mit ${nextName}`);
  };
  const clearRest = () => {
    update((c) => ({ ...c, restEndsAt: undefined, restTotalSec: undefined }));
    void platform.cancelRestNotification();
  };

  const toggleDone = async (si: number) => {
    if (!entry) return;
    const ex = exOf(entry);
    const set = entry.sets[si];
    if (set.doneAt !== undefined) {
      // Pause nur abbrechen, wenn der zuletzt abgehakte Satz zurückgenommen wird.
      const lastDone = Math.max(0, ...s.entries.flatMap((e) => e.sets.map((x) => x.doneAt ?? 0)));
      setEntry(idx, (e) => ({ ...e, sets: e.sets.map((x, k) => (k === si ? { ...x, doneAt: undefined } : x)) }));
      if (set.doneAt === lastDone) clearRest();
      return;
    }
    const doneAt = Date.now();
    const finished: SetEntry = { ...set, doneAt };
    const earlier = entry.sets.filter((x, k) => k !== si && isWorkSet(x));
    const record = ex?.tracking === 'gewicht_wdh' || ex?.tracking === 'koerpergewicht_wdh' ? isPersonalRecord(finished, entry.exerciseId, history ?? [], earlier, s.id, entry.unit ?? 'kg') : false;
    setEntry(idx, (e) => ({ ...e, sets: e.sets.map((x, k) => (k === si ? finished : x)) }));
    if (record) {
      platform.vibrate('record');
      toast(`🏆 Neuer Rekord: ${ex?.name} – ${entry.unit === 'platte' ? 'Platte ' + formatNumber(set.weight ?? 0) : formatNumber(set.weight ?? 0) + ' kg'} × ${set.reps}`, 'record');
    } else {
      platform.vibrate('success');
    }
    // Supersatz: Solange noch eine Partnerübung folgt, keine Pause – sondern Hinweis.
    const partner = entry.supersetGroup && s.entries[idx + 1]?.supersetGroup === entry.supersetGroup ? s.entries[idx + 1] : undefined;
    if (partner) {
      toast(`Supersatz – weiter mit ${exOf(partner)?.name ?? 'der nächsten Übung'}`);
      return;
    }
    const settings = await getSettings();
    const rest = entry.restSec > 0 ? entry.restSec : ex?.tracking === 'cardio' ? 0 : settings.defaultRestSec;
    const sec = set.kind === 'aufwaermen' ? Math.min(rest, 45) : rest;
    startRest(sec, ex?.name ?? 'der nächsten Übung');
  };

  const onRestFinished = () => {
    void getSettings().then((st) => {
      if (st.vibration) platform.vibrate('timer');
      if (st.restSignal) platform.playSignal();
    });
    toast('Pause vorbei – weiter geht’s');
    setRestFlash(true);
    setTimeout(() => setRestFlash(false), 6000);
    update((c) => ({ ...c, restEndsAt: undefined, restTotalSec: undefined }));
  };
  const onRestWarn = () => {
    void getSettings().then((st) => {
      if (!st.restWarn) return;
      if (st.vibration) platform.vibrate('tap');
      if (st.restSignal) platform.playSignal('warn');
    });
  };

  const addSet = () => entry && setEntry(idx, (e) => ({ ...e, sets: [...e.sets, newSet(e.sets[e.sets.length - 1])] }));
  const patchSet = (si: number, patch: Partial<SetEntry>) =>
    setEntry(idx, (e) => {
      const old = e.sets[si];
      return {
        ...e,
        sets: e.sets.map((x, k) => {
          if (k === si) return { ...x, ...patch };
          // Gewicht eines Satzes geändert: noch offene Folgesätze mit demselben bisherigen Gewicht ziehen mit.
          if ('weight' in patch && k > si && x.doneAt === undefined && x.kind === old.kind && x.weight === old.weight) return { ...x, weight: patch.weight };
          return x;
        }),
      };
    });
  const removeSet = (si: number) => setEntry(idx, (e) => ({ ...e, sets: e.sets.filter((_, k) => k !== si) }));

  const addExercise = async (ex: Exercise) => {
    setPickOpen(false);
    const e = await createEntryForExercise(ex.id);
    if (!e) return;
    update((c) => ({ ...c, entries: [...c.entries, e], currentIndex: c.entries.length }));
  };

  const moveEntry = (dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= s.entries.length) return;
    update((c) => {
      const entries = [...c.entries];
      [entries[idx], entries[j]] = [entries[j], entries[idx]];
      return { ...c, entries, currentIndex: j };
    });
  };

  const removeEntry = async () => {
    if (!entry) return;
    if (!(await confirm({ title: 'Übung entfernen?', message: 'Nur aus diesem Training – der Plan bleibt unverändert.', confirmLabel: 'Entfernen', danger: true }))) return;
    update((c) => ({ ...c, entries: c.entries.filter((_, k) => k !== idx), currentIndex: Math.max(0, idx - 1) }));
    setMenuOpen(false);
  };

  const swapTo = async (exerciseId: string): Promise<boolean> => {
    // Ein zweiter Tipp während des Tauschs wird ignoriert, sonst würde mit einem veralteten Eintrag doppelt getauscht.
    if (!entry || swapping.current) return false;
    swapping.current = true;
    try {
      // Immer vom aktuellen Stand ausgehen (nicht vom Stand beim Antippen).
      const current = ref.current.entries[idx] ?? entry;
      const replaced = await substituteEntries(current, exerciseId, s.id);
      update((c) => ({ ...c, entries: [...c.entries.slice(0, idx), ...replaced, ...c.entries.slice(idx + 1)], currentIndex: idx + replaced.length - 1 }));
      return replaced.length > 1;
    } finally {
      swapping.current = false;
    }
  };
  const substitute = async (exerciseId: string) => {
    if (!entry) return;
    const from = cat.exMap.get(entry.exerciseId)?.name;
    const split = await swapTo(exerciseId);
    setAltOpen(false);
    toast(`Nur für heute: ${cat.exMap.get(exerciseId)?.name} statt ${cat.exMap.get(entry.substitutedFor ?? entry.exerciseId)?.name}${split ? ` – abgehakte Sätze bleiben bei ${from}` : ''}`);
  };
  const revertSubstitution = async () => {
    if (!entry?.substitutedFor) return;
    await swapTo(entry.substitutedFor);
    setAltOpen(false);
  };

  const finish = async () => {
    await flush();
    const live = ref.current;
    const active = live.entries.filter((e) => !e.skipped);
    const doneCount = active.reduce((a, e) => a + e.sets.filter((x) => x.doneAt !== undefined).length, 0);
    const open = active.reduce((a, e) => a + e.sets.filter((x) => x.doneAt === undefined).length, 0);
    if (doneCount === 0) {
      if (await confirm({ title: 'Training verwerfen?', message: 'Es wurde noch kein Satz abgehakt. Das Training wird nicht gespeichert.', confirmLabel: 'Verwerfen', danger: true })) {
        await discardSession(s.id);
        onEnd(null);
      }
      return;
    }
    if (open > 0 && !(await confirm({ title: `${open} ${open === 1 ? 'Satz ist' : 'Sätze sind'} nicht abgehakt`, message: 'Nicht abgehakte Sätze werden nicht gespeichert.', confirmLabel: 'Abschließen' }))) return;
    void platform.cancelRestNotification();
    await flush();
    close();
    const done = await finishSession(s.id);
    void runAutoBackup(); // iPhone-App: Sicherung in „Dateien“ ablegen (still, im Hintergrund)
    onEnd(done?.id ?? null);
  };

  const discard = async () => {
    setMenuOpen(false);
    if (await confirm({ title: 'Training verwerfen?', message: 'Alle Sätze dieses Trainings gehen verloren.', confirmLabel: 'Verwerfen', danger: true })) {
      await flush();
      close();
      void platform.cancelRestNotification();
      await discardSession(s.id);
      onEnd(null);
    }
  };

  // ---------------------------------------------------------------- Darstellung
  const elapsed = Math.floor((now - s.startedAt) / 1000);
  const ex = entry ? exOf(entry) : undefined;
  const eq = ex?.equipmentId ? cat.eqMap.get(ex.equipmentId) : undefined;
  const last = entry ? lastPerformance(history ?? [], entry.exerciseId, s.id, entry.unit ?? 'kg') : undefined;
  const suggestion = entry && ex && last ? suggestNext(history ?? [], ex, eq, s.id, 'heute', Date.now(), !s.easier) : undefined;
  const entryDone = (e: Entry) => !e.skipped && e.sets.length > 0 && e.sets.every((x) => x.doneAt !== undefined);
  const isLast = idx >= s.entries.length - 1;
  const doneSets = s.entries.reduce((a, e) => a + (e.skipped ? 0 : e.sets.filter((x) => x.doneAt !== undefined).length), 0);
  const restActive = !!s.restEndsAt && s.restEndsAt > now - 1000;
  let workCounter = 0;

  return (
    <div className="train">
      <LiveActivitySync session={s} cat={cat} />
      <header className="train-top">
        <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Trainingsmenü">
          <IconDots size={24} />
        </button>
        <div className="train-title">
          <div className="train-name">{s.workoutName}</div>
          <div className="train-meta">
            <span data-testid="elapsed">{formatDuration(elapsed)}</span> · {doneSets} {doneSets === 1 ? 'Satz' : 'Sätze'}
          </div>
        </div>
        <button className="btn small primary" onClick={finish}>
          Abschließen
        </button>
      </header>

      <div className="strip" role="tablist" aria-label="Übungen">
        {s.entries.map((e, i) => (
          <button key={i} role="tab" aria-selected={i === idx} className={'strip-item' + (i === idx ? ' on' : '') + (entryDone(e) ? ' done' : '') + (e.skipped ? ' skipped' : '')} onClick={() => goTo(i)} aria-label={`Übung ${i + 1}: ${exOf(e)?.name ?? ''}`}>
            {entryDone(e) ? <IconCheck size={16} /> : i + 1}
          </button>
        ))}
        <button className="strip-item add" onClick={() => setPickOpen(true)} aria-label="Übung hinzufügen">
          <IconPlus size={18} />
        </button>
      </div>

      <div className="train-body">
        {!entry && (
          <div className="empty">
            <div className="empty-title">Noch keine Übung</div>
            <div className="empty-text">Füge Übungen hinzu – frei oder aus deinem Katalog.</div>
            <button className="btn primary" onClick={() => setPickOpen(true)}>
              Übung hinzufügen
            </button>
          </div>
        )}

        {entry && ex && (
          <>
            <EntryHeroWrap ex={ex} cat={cat} started={entry.sets.some((x) => x.doneAt !== undefined)} />
            <div className="entry-info">
              {entry.substitutedFor && (
                <div className="notice small">
                  Nur für heute getauscht – statt {cat.exMap.get(entry.substitutedFor)?.name}.{' '}
                  <button className="linkish inline" onClick={revertSubstitution}>
                    Zurücktauschen
                  </button>
                </div>
              )}
              {eq && eq.adjustments.length > 0 && (
                <div className="adj-pills" aria-label="Deine Geräteeinstellung">
                  {eq.adjustments.map((a) => (
                    <span key={a.id} className="adj-pill">
                      {a.label} <b>{ex.adjustmentOverrides?.[a.id] ?? a.myValue ?? '–'}</b>
                    </span>
                  ))}
                </div>
              )}
              <div className="kv wide compact">
                <div>
                  <span>Letztes Mal</span>
                  <b>{last ? summarizeSets(last.sets, ex.tracking, ex.unilateral, entry.unit) : '–'}</b>
                  {last && <span className="muted nowrap"> · {formatDateShort(last.session.startedAt)}</span>}
                </div>
                <div>
                  <span>Ziel</span>
                  <b>
                    {ex.tracking === 'cardio' || ex.tracking === 'zeit'
                      ? 'Dauer / Distanz'
                      : `${entry.sets.filter((x) => x.kind !== 'aufwaermen').length} × ${entry.repMin === entry.repMax ? entry.repMin : `${entry.repMin}–${entry.repMax}`}${ex.unilateral ? ' je Seite' : ''}${entry.targetWeight ? (entry.unit === 'platte' ? ` · Platte ${formatNumber(entry.targetWeight)}` : ` · ${formatNumber(entry.targetWeight)} kg`) : ''}`}
                  </b>
                </div>
              </div>
              {suggestion && suggestion.kind !== 'start' && (
                <div className="set-hint" data-testid="suggestion">
                  Vorschlag: {suggestion.text}
                </div>
              )}
              {(() => {
                const offer = warmupOffer(s.entries, idx, cat.exMap, cat.eqMap, settings?.profile.goal ?? 'muskelaufbau', settings?.warmupSuggest !== false);
                if (!offer) return null;
                return (
                  <button
                    className="btn small"
                    onClick={() =>
                      setEntry(idx, (e) => ({ ...e, sets: [...offer.sets.map((w) => ({ kind: 'aufwaermen' as const, weight: w.weight, reps: w.reps })), ...e.sets] }))
                    }
                  >
                    Aufwärmsätze anlegen ({offer.sets.map((w) => `${formatNumber(w.weight)} × ${w.reps}`).join(', ')})
                  </button>
                );
              })()}
              {entry.supersetGroup && <div className="badge accent">Supersatz {entry.supersetGroup}</div>}
              {entry.note && <div className="entry-note">{entry.note}</div>}
            </div>

            {entry.skipped ? (
              <div className="card center">
                <p className="muted">Diese Übung wird heute übersprungen.</p>
                <button className="btn" onClick={() => setEntry(idx, (e) => ({ ...e, skipped: false }))}>
                  Doch trainieren
                </button>
              </div>
            ) : (
              <>
                <div className="sets">
                  {entry.sets.map((set, si) => {
                    if (set.kind !== 'aufwaermen') workCounter++;
                    return <SetRow key={si} index={si} workIndex={set.kind === 'aufwaermen' ? undefined : workCounter} set={set} ex={ex} eq={eq} onChange={(p) => patchSet(si, p)} onToggleDone={() => toggleDone(si)} onRemove={() => removeSet(si)} rirEnabled={settings?.rirEnabled !== false} plates={settings?.plates} />;
                  })}
                </div>
                <div className="entry-actions">
                  <button className="btn small" onClick={addSet}>
                    <IconPlus size={18} /> Satz
                  </button>
                  <button className="btn small" onClick={() => setInfoOpen(true)}>
                    <IconInfo size={18} /> Anleitung
                  </button>
                  <button
                    className="btn small"
                    onClick={() => {
                      setNoteDraft(entry.note ?? '');
                      setNoteOpen(true);
                    }}
                  >
                    <IconNote size={18} /> Notiz
                  </button>
                  <button className="btn small" onClick={() => setAltOpen(true)}>
                    <IconSwap size={18} /> Gerät besetzt
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <footer className="train-foot">
        {restActive && s.restEndsAt && (
          <RestTimer
            endsAt={s.restEndsAt}
            totalSec={s.restTotalSec ?? 60}
            onAdjust={(d) => {
              const endsAt = Math.max(Date.now() + 1000, (s.restEndsAt ?? Date.now()) + d * 1000);
              update((c) => ({ ...c, restEndsAt: endsAt, restTotalSec: Math.max(c.restTotalSec ?? 0, Math.ceil((endsAt - Date.now()) / 1000)) }));
              void platform.scheduleRestNotification(endsAt, 'Pause vorbei', `Weiter mit ${ex?.name ?? 'der nächsten Übung'}`);
            }}
            onSkip={clearRest}
            onFinished={onRestFinished}
            onWarn={onRestWarn}
          />
        )}
        {restFlash && !restActive && (
          <div className="rest-done" role="status">
            Pause vorbei – weiter geht’s
          </div>
        )}
        <div className="nav-row">
          <button className="btn" disabled={idx === 0} onClick={() => goTo(idx - 1)}>
            Zurück
          </button>
          {!isLast ? (
            <button className="btn primary grow" onClick={() => goTo(idx + 1)}>
              Nächste Übung
            </button>
          ) : (
            <button className="btn primary grow" onClick={finish}>
              Training abschließen
            </button>
          )}
        </div>
      </footer>

      <ExercisePicker open={pickOpen} onClose={() => setPickOpen(false)} onPick={addExercise} title="Übung hinzufügen" />

      {/* Gerät besetzt */}
      <Sheet open={altOpen} onClose={() => setAltOpen(false)} title="Gerät besetzt – Alternativen" tall>
        {entry && ex && (
          <>
            <p className="muted small">Gleiche Muskelgruppe wie {ex.name}. Der Tausch gilt nur für heute, der Plan bleibt unverändert.</p>
            {entry.substitutedFor && (
              <button className="btn block" onClick={revertSubstitution}>
                Zurück zu {cat.exMap.get(entry.substitutedFor)?.name}
              </button>
            )}
            <div className="list">
              {alternativesFor(
                cat.exMap.get(entry.substitutedFor ?? entry.exerciseId) ?? ex,
                cat.exercises,
                cat.eqMap,
                new Set(s.entries.map((e) => e.exerciseId)),
              )
                .slice(0, 14)
                .map(({ exercise, reason }) => {
                  const e2 = exercise.equipmentId ? cat.eqMap.get(exercise.equipmentId) : undefined;
                  return (
                    <button key={exercise.id} className="list-row" onClick={() => substitute(exercise.id)}>
                      <div className="grow">
                        <div className="row-title">{exercise.name}</div>
                        <div className="row-sub">
                          {e2 ? e2.name : 'Freie Übung'} · {reason}
                          {e2?.inStudio && <span className="badge">Studio</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </>
        )}
      </Sheet>

      {/* Notiz */}
      <Sheet
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Notiz zur Übung"
        footer={
          <button
            className="btn primary block"
            onClick={() => {
              setEntry(idx, (e) => ({ ...e, note: noteDraft.trim() || undefined }));
              setNoteOpen(false);
            }}
          >
            Speichern
          </button>
        }
      >
        <textarea className="input area" rows={4} autoFocus value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="z. B. rechte Schulter zwickt, Sitz 5 war besser …" />
      </Sheet>

      {/* Anleitung */}
      <Sheet open={infoOpen} onClose={() => setInfoOpen(false)} title={ex?.name ?? 'Anleitung'} tall>
        {ex && <ExerciseSketch ex={ex} title="Bewegungsskizze" />}
        {ex && <MotionImage ids={ex.motionPhotoIds} label={ex.name} />}
        {ex && <InstructionsView i={ex.instructions} />}
      </Sheet>

      {/* Menü */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Training">
        <div className="stack">
          {entry && (
            <>
              <div className="row gap">
                <button className="btn grow" disabled={idx === 0} onClick={() => moveEntry(-1)}>
                  <IconArrowUp size={18} /> Übung nach vorn
                </button>
                <button className="btn grow" disabled={isLast} onClick={() => moveEntry(1)}>
                  <IconArrowDown size={18} /> Übung nach hinten
                </button>
              </div>
              <button
                className="btn block"
                onClick={() => {
                  setEntry(idx, (e) => ({ ...e, skipped: !e.skipped }));
                  setMenuOpen(false);
                }}
              >
                <IconSkip size={18} /> {entry.skipped ? 'Übung doch trainieren' : 'Übung überspringen'}
              </button>
              <button className="btn block danger" onClick={removeEntry}>
                <IconTrash size={18} /> Übung entfernen
              </button>
            </>
          )}
          <button
            className="btn block"
            onClick={() => {
              setMenuOpen(false);
              setPickOpen(true);
            }}
          >
            <IconPlus size={18} /> Übung hinzufügen
          </button>
          <button className="btn block danger" onClick={discard}>
            Training verwerfen
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function EntryHeroWrap({ ex, cat, started }: { ex: Exercise; cat: Catalog; started: boolean }) {
  return <EntryHero key={ex.id} ex={ex} cat={cat} started={started} />;
}
