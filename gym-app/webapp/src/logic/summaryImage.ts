/** Trainingszusammenfassung als Bild zum Teilen (Hochformat, Kraftkultur-Farbschema). */
export interface SummaryImageInput {
  title: string;
  date: string;
  studio?: string;
  stats: { label: string; value: string }[];
  records: string[];
}

export function renderSummaryImage(i: SummaryImageInput): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#033220');
  g.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#e0f84a';
  ctx.font = `700 40px ${font}`;
  ctx.fillText('TRAINING ABGESCHLOSSEN', 80, 150);
  ctx.fillStyle = '#f4f6ee';
  ctx.font = `800 96px ${font}`;
  ctx.fillText(i.title.slice(0, 22), 80, 270);
  ctx.fillStyle = 'rgba(244,246,238,0.65)';
  ctx.font = `400 40px ${font}`;
  ctx.fillText(i.date, 80, 335);
  // Kennzahlen
  const cols = Math.min(3, Math.max(1, i.stats.length));
  i.stats.slice(0, 6).forEach((s, k) => {
    const x = 80 + (k % cols) * ((W - 160) / cols);
    const y = 520 + Math.floor(k / cols) * 230;
    ctx.fillStyle = '#e0f84a';
    ctx.font = `800 84px ${font}`;
    ctx.fillText(s.value, x, y);
    ctx.fillStyle = 'rgba(244,246,238,0.65)';
    ctx.font = `400 36px ${font}`;
    ctx.fillText(s.label, x, y + 52);
  });
  if (i.records.length) {
    ctx.fillStyle = '#e0f84a';
    ctx.font = `700 40px ${font}`;
    ctx.fillText('REKORDE', 80, 1010);
    ctx.fillStyle = '#f4f6ee';
    ctx.font = `500 42px ${font}`;
    i.records.slice(0, 3).forEach((r, k) => ctx.fillText(r.slice(0, 40), 80, 1075 + k * 62));
  }
  ctx.fillStyle = 'rgba(244,246,238,0.5)';
  ctx.font = `500 34px ${font}`;
  ctx.fillText(`Eisenzeit${i.studio ? ` · ${i.studio}` : ''}`, 80, H - 80);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
