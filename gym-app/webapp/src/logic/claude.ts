import type Anthropic from '@anthropic-ai/sdk';

/**
 * Direkte Claude-Anbindung (eigener API-Schlüssel, Aufruf aus dem Browser bzw. der iOS-Hülle).
 * Der Schlüssel liegt nur auf diesem Gerät (localStorage), nicht in der Datenbank – damit steht er nie in der
 * Sicherungsdatei – und wird nirgends protokolliert. Das SDK wird erst beim ersten Gebrauch nachgeladen.
 */
export const AI_MODELS = [
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5', hint: 'günstig und schnell (empfohlen zum Start)' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', hint: 'ausgewogen' },
  { id: 'claude-opus-5-5', label: 'Opus 5.5', hint: 'am stärksten, am teuersten' },
] as const;
export const DEFAULT_AI_MODEL = 'claude-haiku-5-5';

const KEY_NAME = 'eisenzeit.ai.apikey';

export function getApiKey(): string | undefined {
  try {
    return localStorage.getItem(KEY_NAME) || undefined;
  } catch {
    return undefined;
  }
}
export function setApiKey(key: string): boolean {
  try {
    localStorage.setItem(KEY_NAME, key.trim());
    return true;
  } catch {
    return false;
  }
}
export function clearApiKey(): void {
  try {
    localStorage.removeItem(KEY_NAME);
  } catch {
    /* nichts zu tun */
  }
}
/** Nur die letzten Zeichen zeigen. */
export function maskKey(key: string): string {
  return key.length > 8 ? `…${key.slice(-4)}` : '…';
}

type SdkModule = typeof import('@anthropic-ai/sdk');

async function loadSdk(): Promise<SdkModule['default']> {
  const m = await import('@anthropic-ai/sdk');
  return m.default;
}

export async function createClient(key: string): Promise<Anthropic> {
  const A = await loadSdk();
  // Aufruf direkt aus der App: nötig, weil es keinen eigenen Server gibt (der Schlüssel bleibt auf dem Gerät)
  return new A({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1 });
}

/** Verständliche deutsche Fehlermeldung zu einem Fehler des SDK. */
export async function explainError(e: unknown): Promise<string> {
  const A = await loadSdk();
  if (e instanceof A.APIUserAbortError) return 'Abgebrochen.';
  if (e instanceof A.AuthenticationError) return 'Der API-Schlüssel wird nicht akzeptiert. Prüfe ihn in den Einstellungen unter „KI-Anbindung“.';
  if (e instanceof A.PermissionDeniedError) return 'Mit diesem Schlüssel ist dieser Zugriff nicht erlaubt (Berechtigung oder Modell).';
  if (e instanceof A.NotFoundError) return 'Das gewählte Modell wurde nicht gefunden. Wähle in den Einstellungen ein anderes Modell.';
  if (e instanceof A.RateLimitError) return 'Das Limit bei Anthropic ist erreicht (Anfragen oder Kontingent). Warte kurz oder prüfe Guthaben und Limits in der Anthropic-Konsole.';
  if (e instanceof A.APIConnectionError) return 'Keine Verbindung zu Anthropic. Prüfe dein Netz und versuche es noch einmal.';
  if (e instanceof A.BadRequestError) return `Die Anfrage wurde abgelehnt: ${(e as Error).message}`;
  if (e instanceof A.InternalServerError || e instanceof A.APIError) return 'Anthropic hat gerade ein Problem. Versuche es in ein paar Minuten noch einmal.';
  return e instanceof Error ? e.message : 'Unbekannter Fehler.';
}

/** Kleine Testanfrage; liefert `ok` oder eine verständliche Fehlermeldung. */
export async function testConnection(key: string, model: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const c = await createClient(key);
    const r = await c.messages.create({ model, max_tokens: 200, messages: [{ role: 'user', content: 'Antworte nur mit dem Wort: ok' }] });
    if (r.stop_reason === 'refusal') return { ok: false, error: 'Die Anfrage wurde abgelehnt.' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: await explainError(e) };
  }
}

// ------------------------------------------------------------------------------------------ Plan als Werkzeug

export const PLAN_TOOL_NAME = 'submit_plan';

/** Werkzeug, über das Claude den fertigen Plan liefert (JSON-Schema des Formats „eisenzeit-plan“). */
export const PLAN_TOOL: Anthropic.Tool = {
  name: PLAN_TOOL_NAME,
  description:
    'Zeigt dem Nutzer einen fertigen Trainingsplan als Vorschau. Rufe dieses Werkzeug auf, sobald ein Plan steht – gib den Plan nicht zusätzlich als Text aus. Der Nutzer entscheidet danach selbst, ob er ihn übernimmt.',
  input_schema: {
    type: 'object',
    properties: {
      format: { type: 'string', enum: ['eisenzeit-plan'] },
      version: { type: 'integer', enum: [1] },
      name: { type: 'string', description: 'Name des Plans, höchstens 80 Zeichen' },
      goal: { type: 'string', description: 'z. B. Muskelaufbau, Kraft, Allgemeine Fitness' },
      plannedWeeks: { type: 'integer', description: 'Laufzeit in Wochen' },
      workouts: {
        type: 'array',
        description: 'Einheiten in Trainingsreihenfolge (höchstens 14)',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            items: {
              type: 'array',
              description: 'Übungen der Einheit (höchstens 20)',
              items: {
                type: 'object',
                properties: {
                  exercise: { type: 'string', description: 'Kennung aus der Liste der verfügbaren Übungen' },
                  sets: { type: 'integer', description: '1 bis 10' },
                  repMin: { type: 'integer' },
                  repMax: { type: 'integer' },
                  restSec: { type: 'integer', description: 'Pause in Sekunden' },
                  targetWeight: { type: 'number', description: 'Zielgewicht in kg (oder Plattennummer bei Plattengeräten); nur wenn aus dem Verlauf ableitbar' },
                  supersetGroup: { type: 'integer' },
                  note: { type: 'string' },
                },
                required: ['exercise', 'sets', 'repMin', 'repMax', 'restSec'],
              },
            },
          },
          required: ['name', 'items'],
        },
      },
      explanation: { type: 'string', description: 'Kurze Begründung der Auswahl und Aufteilung' },
    },
    required: ['format', 'version', 'name', 'goal', 'plannedWeeks', 'workouts'],
  },
};

export interface TurnArgs {
  key: string;
  model: string;
  system: string;
  messages: Anthropic.MessageParam[];
  onText: (delta: string) => void;
  signal?: AbortSignal;
}

/** Eine Antwort von Claude, gestreamt (Text kommt über `onText`); gibt die vollständige Nachricht zurück. */
export async function streamTurn(a: TurnArgs): Promise<Anthropic.Message> {
  const c = await createClient(a.key);
  const stream = c.messages.stream({ model: a.model, max_tokens: 16000, system: a.system, messages: a.messages, tools: [PLAN_TOOL] }, { signal: a.signal });
  stream.on('text', (delta) => a.onText(delta));
  return stream.finalMessage();
}
