import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regel der Hooks: Sie müssen vor jedem frühen `return` einer Komponente stehen. Ein `useRef` hinter dem frühen Return
 * hat in Version 0.1.1 den Trainingsbildschirm zum Absturz gebracht („Rendered more hooks than during the previous render“).
 */
describe('Hooks vor dem frühen Return', () => {
  for (const file of ['TrainingMode.tsx', 'ExerciseProgress.tsx', 'ProgressOverview.tsx', 'BodyMetrics.tsx', 'PlanAssistant.tsx', 'PlanMerge.tsx']) {
    it(`${file}: kein Hook nach einem frühen Return der Hauptkomponente`, () => {
      const src = readFileSync(join(process.cwd(), 'src', 'screens', file), 'utf8').replace(/\r\n/g, '\n');
      const mainStart = src.search(/export function \w+\(/);
      const body = src.slice(mainStart);
      const early = body.search(/\n {2}if \(!\w+( \|\| !\w+)*\) return /);
      expect(early, 'früher Return gefunden').toBeGreaterThan(0);
      const after = body.slice(early);
      // Hooks (useState/useRef/useMemo/useEffect/useLive …) auf Komponentenebene (zwei Leerzeichen Einrückung)
      expect(after).not.toMatch(/\n {2}(const \[?[\w, ]+\]? = )?use(State|Ref|Memo|Effect|Callback|Live|Now|Catalog|Ui|Navigate|Params)\(/);
    });
  }
});
