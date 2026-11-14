import type { Instructions } from '../data/types';

/** Anleitung in festen Abschnitten: Einstellung · Ausführung · Atmung · Häufige Fehler · Tipp. */
export function InstructionsView({ i }: { i: Instructions }) {
  return (
    <div className="instr">
      {i.setup && (
        <>
          <h3>Einstellung</h3>
          <p>{i.setup}</p>
        </>
      )}
      {i.steps.length > 0 && (
        <>
          <h3>Ausführung</h3>
          <ol>
            {i.steps.map((s, k) => (
              <li key={k}>{s}</li>
            ))}
          </ol>
        </>
      )}
      {i.breathing && (
        <>
          <h3>Atmung</h3>
          <p>{i.breathing}</p>
        </>
      )}
      {i.mistakes.length > 0 && (
        <>
          <h3>Häufige Fehler</h3>
          <ul>
            {i.mistakes.map((s, k) => (
              <li key={k}>{s}</li>
            ))}
          </ul>
        </>
      )}
      {i.tip && (
        <>
          <h3>Tipp</h3>
          <p className="tip">{i.tip}</p>
        </>
      )}
    </div>
  );
}
