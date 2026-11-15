import { formatNumber } from '../logic/progression';
import { formatPlates, platesPerSide } from '../logic/plates';
import { Sheet } from './kit';

/** Scheibenrechner: welche Scheiben je Seite auf das Gerät gehören (Gesamtgewicht, Eigengewicht, Aufnahmen, vorhandene Scheiben). */
export function PlateSheet({ open, onClose, totalKg, ownKg, slots, plates, name }: { open: boolean; onClose: () => void; totalKg: number; ownKg: number; slots: number; plates: number[]; name?: string }) {
  const r = platesPerSide(totalKg, ownKg, slots, plates);
  const max = Math.max(1, ...r.perSide, 5);
  return (
    <Sheet open={open} onClose={onClose} title={name ? `Scheiben · ${name}` : 'Scheiben'}>
      <div className="plate-sheet">
        <p>
          Gesamt <b>{formatNumber(totalKg)} kg</b>
          {ownKg > 0 ? ` – Eigengewicht ${formatNumber(ownKg)} kg` : ''}
          {slots > 1 ? ` – je Seite (${slots} Aufnahmen)` : ''}
        </p>
        <div className="plate-stack" role="img" aria-label={`Scheiben: ${formatPlates(r.perSide)}`}>
          <div className="plate-bar" />
          {r.perSide.map((p, i) => (
            <div key={i} className="plate" style={{ height: `${28 + (p / max) * 72}px` }}>
              <span>{formatNumber(p)}</span>
            </div>
          ))}
        </div>
        <div className="plate-sum">
          Je Seite: <b>{formatPlates(r.perSide)}</b> ({formatNumber(r.perSideKg)} kg)
        </div>
        {!r.exact && (
          <div className="notice warn">
            {formatNumber(totalKg)} kg lassen sich mit deinen Scheiben nicht genau darstellen – gerundet auf <b>{formatNumber(r.totalKg)} kg</b>.
          </div>
        )}
        <p className="muted small">Die vorhandenen Scheiben stellst du in den Einstellungen ein, die Zahl der Aufnahmen und das Eigengewicht am Gerät.</p>
      </div>
    </Sheet>
  );
}
