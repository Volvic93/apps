import type { AiEvaluation } from '../data/types';

const SECTIONS: [keyof Pick<AiEvaluation, 'wentWell' | 'stalled' | 'recommendations' | 'nextPlanNotes'>, string][] = [
  ['wentWell', 'Das lief gut'],
  ['stalled', 'Das stagniert'],
  ['recommendations', 'Empfehlungen'],
  ['nextPlanNotes', 'Für den nächsten Plan'],
];

/** Auswertung eines Plans durch eine KI (aus „Mit KI planen“ eingelesen). */
export function EvaluationCard({ evaluation, title }: { evaluation: AiEvaluation; title?: string }) {
  return (
    <section className="card">
      <div className="card-title">{title ?? 'Auswertung'} · {new Date(evaluation.at).toLocaleDateString('de-DE')}</div>
      <p>{evaluation.summary}</p>
      {SECTIONS.filter(([k]) => evaluation[k].length > 0).map(([k, label]) => (
        <div key={k}>
          <b>{label}</b>
          <ul className="plain-list">
            {evaluation[k].map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
