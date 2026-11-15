import { useEffect, useRef, useState } from 'react';
import type Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_AI_MODEL, PLAN_TOOL_NAME, explainError, getApiKey, streamTurn } from '../logic/claude';
import { PLAN_FORMAT, PLAN_FORMAT_VERSION, validatePlanObject, type PlanFile } from '../logic/planio';
import { useCatalog } from '../ui/ExercisePicker';

type Bubble =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'plan'; plan: PlanFile; warnings: string[] }
  | { kind: 'error'; text: string };

/**
 * Gespräch mit Claude über den eigenen API-Schlüssel. Claude liefert den Plan über ein Werkzeug (`submit_plan`);
 * die App prüft ihn mit der vorhandenen Import-Prüfung (ungültige Pläne gehen einmal mit der Fehlerliste zurück)
 * und zeigt ihn als Vorschau mit „Plan übernehmen“.
 */
export function AiChat({ buildSystem, model, onAdopt }: { buildSystem: () => Promise<string>; model: string | undefined; onAdopt: (plan: PlanFile) => void }) {
  const cat = useCatalog();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState('');
  const [live, setLive] = useState('');
  const [busy, setBusy] = useState(false);
  const history = useRef<Anthropic.MessageParam[]>([]);
  const system = useRef<string | undefined>(undefined);
  const pendingToolId = useRef<string | undefined>(undefined);
  const abort = useRef<AbortController | undefined>(undefined);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [bubbles, live]);
  useEffect(() => () => abort.current?.abort(), []);

  const runTurn = async (retriesLeft: number): Promise<void> => {
    const key = getApiKey();
    if (!key) {
      setBubbles((b) => [...b, { kind: 'error', text: 'Kein API-Schlüssel gespeichert (Einstellungen → KI-Anbindung).' }]);
      return;
    }
    abort.current = new AbortController();
    setLive('');
    let acc = '';
    try {
      const message = await streamTurn({
        key,
        model: model ?? DEFAULT_AI_MODEL,
        system: system.current ?? '',
        messages: history.current,
        onText: (d) => {
          acc += d;
          setLive(acc);
        },
        signal: abort.current.signal,
      });
      setLive('');
      history.current = [...history.current, { role: 'assistant', content: message.content }];
      const text = message.content.flatMap((c) => (c.type === 'text' ? [c.text] : [])).join('').trim();
      const next: Bubble[] = [];
      if (text) next.push({ kind: 'assistant', text });
      if (message.stop_reason === 'refusal') next.push({ kind: 'error', text: 'Claude hat diese Anfrage abgelehnt. Formuliere sie anders oder versuche ein anderes Modell.' });
      if (message.stop_reason === 'max_tokens') next.push({ kind: 'error', text: 'Die Antwort war zu lang und wurde abgeschnitten. Bitte um einen kürzeren Plan (weniger Einheiten oder Übungen).' });
      const tool = message.content.find((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use' && c.name === PLAN_TOOL_NAME);
      if (tool) {
        const input = (tool.input ?? {}) as Record<string, unknown>;
        const r = validatePlanObject({ format: PLAN_FORMAT, version: PLAN_FORMAT_VERSION, ...input });
        if (r.ok) {
          pendingToolId.current = tool.id;
          next.push({ kind: 'plan', plan: r.plan, warnings: r.warnings });
        } else if (retriesLeft > 0) {
          setBubbles((b) => [...b, ...next, { kind: 'assistant', text: 'Der Plan war nicht ganz gültig – ich bitte Claude, ihn zu korrigieren …' }]);
          history.current = [
            ...history.current,
            { role: 'user', content: [{ type: 'tool_result', tool_use_id: tool.id, is_error: true, content: `Der Plan ist ungültig:\n- ${r.errors.join('\n- ')}\nBitte rufe ${PLAN_TOOL_NAME} noch einmal mit einem korrigierten, vollständigen Plan auf.` }] },
          ];
          return runTurn(retriesLeft - 1);
        } else {
          pendingToolId.current = tool.id;
          next.push({ kind: 'error', text: `Der Plan von Claude ist ungültig: ${r.errors.join(' ')}` });
        }
      }
      setBubbles((b) => [...b, ...next]);
    } catch (e) {
      setLive('');
      const msg = await explainError(e);
      if (msg !== 'Abgebrochen.') setBubbles((b) => [...b, { kind: 'error', text: msg }]);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput('');
    setBubbles((b) => [...b, { kind: 'user', text }]);
    try {
      if (system.current === undefined) system.current = await buildSystem();
      const content: Anthropic.ContentBlockParam[] = [];
      if (pendingToolId.current) {
        content.push({ type: 'tool_result', tool_use_id: pendingToolId.current, content: 'Der Plan wurde dem Nutzer als Vorschau gezeigt. Er entscheidet selbst, ob er ihn übernimmt.' });
        pendingToolId.current = undefined;
      }
      content.push({ type: 'text', text });
      history.current = [...history.current, { role: 'user', content }];
      await runTurn(1);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    abort.current?.abort();
    history.current = [];
    system.current = undefined;
    pendingToolId.current = undefined;
    setBubbles([]);
    setLive('');
    setBusy(false);
  };

  const exName = (ref: string) => cat?.exMap.get(ref)?.name ?? ref;

  return (
    <div className="aichat">
      {bubbles.length === 0 && !live && (
        <p className="muted small">
          Schreibe, was du dir wünschst (zum Beispiel „4 Tage, Schwerpunkt Rücken, höchstens 60 Minuten“). Claude kennt dein Profil, dein Studio, deine Übungen und deinen Verlauf und kann nachfragen. Du kannst jederzeit nachschärfen.
        </p>
      )}
      {bubbles.map((b, i) =>
        b.kind === 'plan' ? (
          <div key={i} className="aichat-plan card">
            <div className="card-title">Planvorschlag</div>
            <div className="aichat-plan-name">{b.plan.name}</div>
            <div className="muted small">
              {b.plan.plannedWeeks} Wochen · {b.plan.workouts.length} Einheiten
            </div>
            {b.plan.workouts.map((w, wi) => (
              <div key={wi} className="aichat-plan-w">
                <b>{w.name}</b>
                <ul>
                  {w.items.map((it, ii) => (
                    <li key={ii}>
                      {exName(it.exercise)}: {it.sets} × {it.repMin === it.repMax ? it.repMin : `${it.repMin}–${it.repMax}`}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {b.plan.explanation && <p className="muted small">{b.plan.explanation}</p>}
            {b.warnings.map((w) => (
              <p key={w} className="muted small">
                {w}
              </p>
            ))}
            <button className="btn primary block" onClick={() => onAdopt(b.plan)}>
              Plan übernehmen
            </button>
          </div>
        ) : (
          <div key={i} className={'aichat-bubble ' + b.kind}>
            {b.text}
          </div>
        ),
      )}
      {live && <div className="aichat-bubble assistant">{live}</div>}
      {busy && !live && <div className="aichat-bubble assistant muted">Claude denkt nach …</div>}
      <div ref={endRef} />
      <div className="aichat-input">
        <textarea
          className="input area"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={bubbles.length ? 'Nachschärfen …' : 'Deine Wünsche …'}
          aria-label="Nachricht an Claude"
          maxLength={2000}
        />
        <div className="row gap">
          <button className="btn primary grow" onClick={send} disabled={busy || !input.trim()}>
            Senden
          </button>
          {busy ? (
            <button className="btn" onClick={() => abort.current?.abort()}>
              Stopp
            </button>
          ) : (
            bubbles.length > 0 && (
              <button className="btn ghost" onClick={reset}>
                Neu beginnen
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
