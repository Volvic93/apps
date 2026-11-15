import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { importPlanFile } from '../data/repo';
import { matchAll, parsePlanText, type Match, type PlanFile } from '../logic/planio';
import { formatNumber, weightUnit } from '../logic/progression';
import { platform } from '../platform';
import { ExercisePicker, useCatalog } from '../ui/ExercisePicker';
import { BackButton, ScreenHeader } from '../ui/Header';
import { useUi } from '../ui/kit';

const NEW = '__neu__';

/**
 * Plan einfügen (Text oder Datei), prüfen, Übungen zuordnen, Vorschau mit Begründung – gespeichert wird erst nach Bestätigung.
 * Wird vom Plan-Import und von „Mit KI planen“ verwendet.
 */
export function ImportPanel({ placeholder, prefill }: { placeholder?: string; prefill?: { text: string; key: number } }) {
  const nav = useNavigate();
  const { toast } = useUi();
  const cat = useCatalog();
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [parsed, setParsed] = useState<{ plan: PlanFile; warnings: string[] } | undefined>(undefined);
  const [matches, setMatches] = useState<Map<string, Match>>(new Map());
  const [choice, setChoice] = useState<Map<string, string>>(new Map()); // Referenz → Kennung | NEW
  const [pickFor, setPickFor] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const resultRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const analyze = (value: string) => {
    if (!cat) return;
    const r = parsePlanText(value);
    if (!r.ok) {
      setErrors(r.errors);
      setParsed(undefined);
      return;
    }
    const m = matchAll(r.plan, cat.exercises);
    setErrors([]);
    setParsed({ plan: r.plan, warnings: r.warnings });
    setMatches(m);
    setChoice(new Map([...m.entries()].map(([ref, mm]) => [ref, mm.exerciseId ?? NEW])));
    setConfirmed(new Set());
  };

  // Plan von außen übergeben (z. B. aus dem Gespräch mit Claude): wie eingefügt analysieren
  useEffect(() => {
    if (prefill && cat) {
      setText(prefill.text);
      analyze(prefill.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.key, !!cat]);

  // Ergebnis bzw. Fehlermeldung in den Blick holen (liegt sonst unter dem Bildschirmrand)
  useEffect(() => {
    if (parsed) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [parsed]);
  useEffect(() => {
    if (errors.length) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [errors]);
  const decide = (ref: string, value: string) => {
    setChoice(new Map(choice).set(ref, value));
    setConfirmed(new Set(confirmed).add(ref));
  };

  const pickFile = async () => {
    const f = await platform.pickFile('application/json,.json,.txt,text/plain');
    if (!f) return;
    try {
      const t = await f.text();
      setText(t);
      analyze(t);
    } catch (e) {
      setErrors([`Die Datei konnte nicht gelesen werden: ${(e as Error).message}`]);
    }
  };

  // „Ähnlicher Name“ muss je Übung ausdrücklich bestätigt werden, bevor gespeichert werden kann
  const unresolved = useMemo(() => [...matches.entries()].filter(([ref, m]) => m.kind === 'similar' && !confirmed.has(ref)), [matches, confirmed]);
  const newCount = useMemo(() => [...choice.values()].filter((v) => v === NEW).length, [choice]);

  const save = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      const res = new Map<string, string | null>([...choice.entries()].map(([ref, v]) => [ref, v === NEW ? null : v]));
      const plan = await importPlanFile(parsed.plan, res);
      toast('Plan als Entwurf gespeichert');
      nav(`/plaene/${plan.id}`);
    } catch (e) {
      setErrors([`Der Plan konnte nicht gespeichert werden: ${(e as Error).message}. Es wurde nichts übernommen.`]);
    } finally {
      setBusy(false);
    }
  };

  if (!cat) return null;
  const nameOf = (id: string) => cat.exMap.get(id)?.name ?? id;

  return (
    <>
      <section className="card">
        <div className="card-title">Plan einfügen</div>
        <textarea
          className="input area"
          rows={6}
          value={text}
          placeholder={placeholder ?? 'Plan hier einfügen – auch mit umgebendem Text, der JSON-Block wird gefunden.'}
          onChange={(e) => setText(e.target.value)}
          aria-label="Plan als Text"
        />
        <div className="row gap">
          <button className="btn primary grow" disabled={!text.trim()} onClick={() => analyze(text)}>
            Prüfen
          </button>
          <button className="btn" onClick={pickFile}>
            Datei wählen
          </button>
        </div>
        {errors.length > 0 && (
          <div className="notice warn" role="alert" ref={errorRef}>
            <b>Das hat nicht geklappt. </b>
            <ul className="plain-list">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {parsed && (
        <>
          <section className="card" ref={resultRef}>
            <div className="card-title">Vorschau</div>
            <div className="row-title">{parsed.plan.name}</div>
            <div className="row-sub">
              {parsed.plan.workouts.length} {parsed.plan.workouts.length === 1 ? 'Einheit' : 'Einheiten'} · {parsed.plan.plannedWeeks} Wochen{parsed.plan.goal ? ` · ${parsed.plan.goal}` : ''}
            </div>
            {parsed.warnings.map((w, i) => (
              <p key={i} className="muted small">
                {w}
              </p>
            ))}
            {parsed.plan.explanation && (
              <div className="notice">
                <b>Begründung. </b>
                {parsed.plan.explanation}
              </div>
            )}
          </section>

          {parsed.plan.workouts.map((w, wi) => (
            <section key={wi} className="card">
              <div className="card-title">{w.name}</div>
              <div className="list flat">
                {w.items.map((it, ii) => {
                  const m = matches.get(it.exercise)!;
                  const c = choice.get(it.exercise) ?? NEW;
                  const chosen = c === NEW ? undefined : cat.exMap.get(c);
                  const platte = weightUnit(chosen?.equipmentId ? cat.eqMap.get(chosen.equipmentId) : undefined) === 'platte';
                  return (
                    <div key={ii} className="list-row static import-row">
                      <div className="grow">
                        <div className="row-title">{c === NEW ? it.exerciseName || it.exercise : nameOf(c)}</div>
                        <div className="row-sub">
                          {it.sets} × {it.repMin === it.repMax ? it.repMin : `${it.repMin}–${it.repMax}`} · Pause {it.restSec} s{it.targetWeight ? (platte ? ` · Platte ${formatNumber(it.targetWeight)}` : ` · ${formatNumber(it.targetWeight)} kg`) : ''}
                        </div>
                        {it.note && <div className="row-sub">{it.note}</div>}
                        <div className={'match ' + (c === NEW ? 'new' : m.kind === 'similar' && !confirmed.has(it.exercise) ? 'ask' : 'ok')}>
                          {c === NEW ? 'Wird als neue Übung angelegt' : m.kind === 'similar' && !confirmed.has(it.exercise) ? 'Ähnlicher Name – bitte bestätigen' : m.kind === 'similar' ? 'Von dir bestätigt' : m.kind === 'name' ? 'Name erkannt' : m.kind === 'id' ? 'Kennung erkannt' : 'Zugeordnet'}
                        </div>
                        {(m.kind === 'similar' || m.kind === 'new' || c === NEW) && (
                          <div className="row gap wrap">
                            {m.candidates.map((cand) => (
                              <button key={cand.id} className={'chip small' + (c === cand.id ? ' on' : '')} aria-pressed={c === cand.id} onClick={() => decide(it.exercise, cand.id)}>
                                {cand.name}
                              </button>
                            ))}
                            <button className={'chip small' + (c === NEW ? ' on' : '')} aria-pressed={c === NEW} onClick={() => decide(it.exercise, NEW)}>
                              Neu anlegen
                            </button>
                            <button className="chip small" onClick={() => setPickFor(it.exercise)}>
                              Andere wählen …
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          <div className="notice">
            {unresolved.length > 0 && (
              <p>
                <b>{unresolved.length}</b> {unresolved.length === 1 ? 'Übung hat' : 'Übungen haben'} nur einen ähnlichen Namen. Tippe bei jeder auf die richtige Zuordnung (oder „Neu anlegen“), dann lässt sich speichern.
              </p>
            )}
            {newCount > 0 && (
              <p>
                <b>{newCount}</b> {newCount === 1 ? 'Übung wird' : 'Übungen werden'} neu angelegt (ohne Muskeln und Anleitung – die kannst du später ergänzen).
              </p>
            )}
            <p className="muted small">Der Plan wird als Entwurf gespeichert und ändert nichts an deinem aktiven Plan.</p>
          </div>
          <button className="btn primary block big" onClick={save} disabled={busy || unresolved.length > 0}>
            Plan als Entwurf speichern
          </button>
        </>
      )}

      <ExercisePicker
        open={pickFor !== undefined}
        onClose={() => setPickFor(undefined)}
        title="Übung zuordnen"
        initialQuery={pickFor ? (parsed?.plan.workouts.flatMap((w) => w.items).find((i) => i.exercise === pickFor)?.exerciseName ?? pickFor) : ''}
        onPick={(ex) => {
          if (pickFor) decide(pickFor, ex.id);
          setPickFor(undefined);
        }}
      />
    </>
  );
}

/** Reiner Plan-Import (Text oder Datei, z. B. ein exportierter Plan). */
export function PlanImport() {
  return (
    <div className="screen">
      <ScreenHeader back={<BackButton to="/plaene" label="Pläne" />} title="Plan importieren" eyebrow="Pläne" />
      <p className="muted">Füge einen Plan im Format „eisenzeit-plan“ ein oder wähle die exportierte Datei. Die App prüft ihn, ordnet die Übungen zu und zeigt eine Vorschau. Erst danach wird gespeichert.</p>
      <ImportPanel />
    </div>
  );
}

