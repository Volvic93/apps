import { beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '../src/data/db';
import { seedCatalog } from '../src/data/seed';
import { buildBackup } from '../src/logic/backup';
import { PLAN_TOOL, PLAN_TOOL_NAME, clearApiKey, explainError, getApiKey, maskKey, setApiKey, streamTurn, testConnection } from '../src/logic/claude';
import { PLAN_FORMAT, PLAN_FORMAT_EXAMPLE, buildAiExportText, validatePlanObject } from '../src/logic/planio';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

// Nachgebildetes SDK: keine echten Aufrufe in Tests
const calls: { args: unknown[] }[] = [];
let nextMessage: unknown;
let nextError: Error | undefined;
vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {}
  class AuthenticationError extends APIError {}
  class RateLimitError extends APIError {}
  class APIConnectionError extends APIError {}
  class APIUserAbortError extends APIError {}
  class PermissionDeniedError extends APIError {}
  class NotFoundError extends APIError {}
  class BadRequestError extends APIError {}
  class InternalServerError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static AuthenticationError = AuthenticationError;
    static RateLimitError = RateLimitError;
    static APIConnectionError = APIConnectionError;
    static APIUserAbortError = APIUserAbortError;
    static PermissionDeniedError = PermissionDeniedError;
    static NotFoundError = NotFoundError;
    static BadRequestError = BadRequestError;
    static InternalServerError = InternalServerError;
    opts: unknown;
    constructor(opts: unknown) {
      this.opts = opts;
    }
    messages = {
      create: async (...args: unknown[]) => {
        calls.push({ args });
        if (nextError) throw nextError;
        return nextMessage;
      },
      stream: (...args: unknown[]) => {
        calls.push({ args });
        const handlers: ((d: string) => void)[] = [];
        return {
          on: (_e: string, h: (d: string) => void) => void handlers.push(h),
          finalMessage: async () => {
            if (nextError) throw nextError;
            handlers.forEach((h) => h('Hallo'));
            return nextMessage;
          },
        };
      },
    };
  }
  return { default: Anthropic };
});

beforeAll(async () => {
  await seedCatalog();
});

describe('Claude-Anbindung', () => {
  it('der Schlüssel liegt nur im Gerätespeicher und nie in der Sicherungsdatei', async () => {
    setApiKey('sk-ant-geheim-1234567890abcdef');
    expect(getApiKey()).toBe('sk-ant-geheim-1234567890abcdef');
    expect(maskKey(getApiKey()!)).toBe('…cdef');
    const backup = await buildBackup(db, true);
    expect(JSON.stringify(backup)).not.toContain('geheim');
    clearApiKey();
    expect(getApiKey()).toBeUndefined();
  });

  it('das Plan-Werkzeug verlangt dieselben Pflichtfelder wie das Austauschformat', () => {
    expect(PLAN_TOOL.name).toBe(PLAN_TOOL_NAME);
    const props = (PLAN_TOOL.input_schema as { properties: Record<string, unknown>; required: string[] }).properties;
    for (const k of ['format', 'version', 'name', 'goal', 'plannedWeeks', 'workouts', 'explanation']) expect(props[k]).toBeDefined();
    // Beispiel aus dem Austauschformat besteht die Import-Prüfung auch mit ergänzten Kopfzeilen
    const example = JSON.parse(PLAN_FORMAT_EXAMPLE) as Record<string, unknown>;
    expect(validatePlanObject({ ...example, format: PLAN_FORMAT }).ok).toBe(true);
  });

  it('der Gesprächsauftrag nennt das Werkzeug und enthält keinen JSON-Antwortblock', async () => {
    const [exercises, equipment, plans, sessions] = await Promise.all([db.exercises.toArray(), db.equipment.toArray(), db.plans.toArray(), db.sessions.toArray()]);
    const input = { now: Date.now(), settings: { profile: { goal: 'muskelaufbau', experience: 'fortgeschritten', daysPerWeek: 4 }, planWeeksDefault: 8, studio: { name: 'Kraftkultur Gym', city: 'Mönchengladbach' } } as never, wishes: '', weeks: 8, includeGeneral: false, exercises, equipment: new Map(equipment.map((e) => [e.id, e])), plans, sessions };
    const chat = buildAiExportText({ ...input, mode: 'chat' });
    expect(chat).toContain('submit_plan');
    expect(chat).toContain('Kraftkultur Gym Mönchengladbach');
    expect(chat).not.toContain('```json');
    expect(buildAiExportText(input)).toContain('```json');
  });

  it('streamTurn schickt das Werkzeug mit, streamt Text und liefert die Nachricht', async () => {
    nextError = undefined;
    nextMessage = { content: [{ type: 'text', text: 'Hallo' }], stop_reason: 'end_turn' };
    calls.length = 0;
    let got = '';
    const m = await streamTurn({ key: 'k', model: 'claude-haiku-5-5', system: 'S', messages: [{ role: 'user', content: 'x' }], onText: (d) => (got += d) });
    expect(got).toBe('Hallo');
    expect(m.stop_reason).toBe('end_turn');
    const sent = calls[0].args[0] as { model: string; tools: { name: string }[]; max_tokens: number };
    expect(sent.model).toBe('claude-haiku-5-5');
    expect(sent.tools[0].name).toBe('submit_plan');
    expect(sent.max_tokens).toBeGreaterThanOrEqual(8000);
  });

  it('Fehler werden verständlich erklärt', async () => {
    const A = (await import('@anthropic-ai/sdk')).default as unknown as Record<string, new (m: string) => Error>;
    expect(await explainError(new A.AuthenticationError('x'))).toContain('Schlüssel');
    expect(await explainError(new A.RateLimitError('x'))).toContain('Limit');
    expect(await explainError(new A.APIConnectionError('x'))).toContain('Verbindung');
    expect(await explainError(new A.NotFoundError('x'))).toContain('Modell');
  });

  it('Verbindungstest meldet ok oder den Grund', async () => {
    nextError = undefined;
    nextMessage = { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' };
    expect(await testConnection('k', 'claude-haiku-5-5')).toEqual({ ok: true });
    const A = (await import('@anthropic-ai/sdk')).default as unknown as Record<string, new (m: string) => Error>;
    nextError = new A.AuthenticationError('401');
    const r = await testConnection('k', 'claude-haiku-5-5');
    expect(r.ok).toBe(false);
    nextError = undefined;
  });
});
