import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLive } from '../ui/hooks';
import { db, getSettings } from '../data/db';
import { buildOrderMarkdown, orderFileName, ORDER_LABEL, type OrderKind } from '../logic/aiorder';
import { platform } from '../platform';
import { BackButton, ScreenHeader } from '../ui/Header';
import { Chip, Field, useUi } from '../ui/kit';
import { ImportPanel } from './PlanImport';

const KINDS: OrderKind[] = ['neu', 'anpassen', 'auswertung'];
const KIND_HINT: Record<OrderKind, string> = {
  neu: 'Die KI entwirft einen neuen Plan nach Ziel, Verlauf und deinen Geräten.',
  anpassen: 'Die KI überarbeitet einen bestehenden Plan nach deinen Wünschen. Die App zeigt danach die Unterschiede.',
  auswertung: 'Die KI wertet einen abgelaufenen Plan aus: Kurzfazit, was lief, was stagniert, Empfehlungen – optional mit Vorschlag für den nächsten Plan.',
};

/** „Mit KI planen“: Auftrag als Markdown-Datei für eine beliebige KI schreiben und die Antwort zurück importieren. */
export function AiPlan() {
  const { toast } = useUi();
  const [params] = useSearchParams();
  const settings = useLive(() => getSettings());
  const plans = useLive(() => db.plans.toArray());
  const [kind, setKind] = useState<OrderKind>(() => (KINDS.includes(params.get('art') as OrderKind) ? (params.get('art') as OrderKind) : 'neu'));
  const [planPick, setPlanPick] = useState<string | undefined>(params.get('plan') ?? undefined);
  const [weeksPick, setWeeks] = useState<number | undefined>(undefined);
  const weeks = weeksPick ?? settings?.planWeeksDefault ?? 8;
  const [wishes, setWishes] = useState('');
  const [general, setGeneral] = useState(false);
  const [text, setText] = useState<string | undefined>(undefined);

  const list = plans ?? [];
  const planId = planPick ?? (list.find((p) => p.status === 'aktiv') ?? [...list].sort((a, b) => b.updatedAt - a.updatedAt)[0])?.id;
  const needsPlan = kind !== 'neu';
  useEffect(() => setText(undefined), [kind, planId, weeks, wishes, general]);

  const build = async (): Promise<string> => {
    const [settings, exercises, equipment, plans, sessions] = await Promise.all([getSettings(), db.exercises.toArray(), db.equipment.toArray(), db.plans.toArray(), db.sessions.toArray()]);
    return buildOrderMarkdown(
      kind,
      { now: Date.now(), settings, wishes, weeks, includeGeneral: general, exercises, equipment: new Map(equipment.map((e) => [e.id, e])), plans, sessions },
      plans.find((p) => p.id === planId),
    );
  };

  const copy = async () => {
    const t = await build(); // immer frisch: Auswahl und Wünsche können sich seit dem letzten Erzeugen geändert haben
    setText(t);
    try {
      await navigator.clipboard.writeText(t);
      toast('Auftrag kopiert – jetzt in deine KI einfügen');
    } catch {
      toast('Kopieren nicht möglich – markiere den Text unten und kopiere ihn von Hand.', 'error');
    }
  };

  const share = async () => {
    const t = await build();
    setText(t);
    const r = await platform.saveFile({ filename: orderFileName(kind), mime: 'text/markdown', text: t });
    if (r !== 'abgebrochen') toast(r === 'heruntergeladen' ? 'Datei heruntergeladen – schicke sie an deine KI' : 'Datei bereitgestellt');
  };

  return (
    <div className="screen">
      <ScreenHeader back={<BackButton to="/plaene" label="Pläne" />} title="Mit KI planen" eyebrow="Pläne" />
      <p className="muted">
        Die App schreibt einen <b>Auftrag als Markdown-Datei</b>: Er erklärt einer KI deiner Wahl (Claude, ChatGPT …), was zu tun ist, und enthält dein Profil, dein Studio, deine Geräte und Übungen, den bisherigen Plan und deinen Verlauf. Die Antwort der KI bringst du hierher zurück; die App prüft sie und übernimmt sie erst nach deiner Bestätigung. Es wird nichts automatisch gesendet.
      </p>

      <section className="card">
        <div className="card-title">1. Auftrag erstellen</div>
        <div className="chips wrap">
          {KINDS.map((k) => (
            <Chip key={k} on={kind === k} onClick={() => setKind(k)}>
              {ORDER_LABEL[k]}
            </Chip>
          ))}
        </div>
        <p className="muted small">{KIND_HINT[kind]}</p>
        {needsPlan && (
          <Field label={kind === 'anpassen' ? 'Welcher Plan soll angepasst werden?' : 'Welcher Plan soll ausgewertet werden?'}>
            <select className="input" value={planId ?? ''} onChange={(e) => setPlanPick(e.target.value)}>
              {list.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.status === 'aktiv' ? ' (aktiv)' : ''}
                </option>
              ))}
            </select>
          </Field>
        )}
        {needsPlan && list.length === 0 && <p className="muted small">Es gibt noch keinen Plan. Wähle „Neuer Plan“.</p>}
        {kind !== 'auswertung' && (
          <>
            <div className="section-label">Laufzeit des neuen Plans</div>
            <div className="chips wrap">
              {[4, 6, 8, 10, 12, 16].map((w) => (
                <Chip key={w} on={weeks === w} onClick={() => setWeeks(w)}>
                  {w} Wochen
                </Chip>
              ))}
            </div>
          </>
        )}
        <Field label="Wünsche und Einschränkungen (optional)" hint="z. B. „Schulter links schonen“, „Schwerpunkt Rücken“, „höchstens 60 Minuten“">
          <textarea className="input area" rows={3} value={wishes} onChange={(e) => setWishes(e.target.value)} maxLength={600} />
        </Field>
        <label className="switch-row">
          <span>Auch Übungen außerhalb meines Studios anbieten</span>
          <input type="checkbox" checked={general} onChange={(e) => setGeneral(e.target.checked)} />
        </label>
        <div className="row gap">
          <button className="btn primary grow" onClick={share} disabled={needsPlan && !planId}>
            Als Datei teilen
          </button>
          <button className="btn" onClick={copy} disabled={needsPlan && !planId}>
            Text kopieren
          </button>
        </div>
        <button
          className="btn ghost small"
          disabled={needsPlan && !planId}
          onClick={async () => {
            setText(await build());
          }}
        >
          {text ? 'Auftrag neu erzeugen' : 'Auftrag ansehen'}
        </button>
        {text && (
          <>
            <p className="muted small">
              {text.length.toLocaleString('de-DE')} Zeichen. Der Auftrag enthält nur Trainingsdaten (Ziel, Studio, Übungen, Plan, Verlauf) – keinen Namen und keine Kontaktdaten. Er verlässt die App nur, wenn du ihn teilst oder kopierst.
            </p>
            <textarea className="input area mono" rows={8} readOnly value={text} aria-label="Auftrag für die KI" onFocus={(e) => e.currentTarget.select()} />
          </>
        )}
      </section>

      <div className="section-label">2. Antwort der KI zurückbringen</div>
      <p className="muted small">Text einfügen oder die Antwortdatei wählen (.md, .txt, .json). Die App findet den JSON-Block auch in umgebendem Text.</p>
      <ImportPanel placeholder="Antwort der KI hier einfügen – der JSON-Block wird auch in umgebendem Text gefunden." />
    </div>
  );
}
