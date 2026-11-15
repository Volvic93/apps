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
  // Text in die verfügbare Breite bringen: erst Schrift verkleinern (bis min), dann mit … kürzen
  const fit = (text: string, maxW: number, weight: number, size: number, min: number): string => {
    let px = size;
    ctx.font = `${weight} ${px}px ${font}`;
    while (px > min && ctx.measureText(text).width > maxW) {
      px -= 2;
      ctx.font = `${weight} ${px}px ${font}`;
    }
    let t = text;
    while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -1);
    return t === text ? t : `${t.trimEnd()}…`;
  };
  const maxW = W - 160;
  ctx.fillStyle = '#f4f6ee';
  ctx.fillText(fit(i.title, maxW, 800, 96, 56), 80, 270);
  ctx.fillStyle = 'rgba(244,246,238,0.65)';
  ctx.font = `400 40px ${font}`;
  ctx.font = `400 40px ${font}`;
  ctx.fillText(fit(i.date, maxW, 400, 40, 28), 80, 335);
  // Kennzahlen
  const cols = Math.min(3, Math.max(1, i.stats.length));
  i.stats.slice(0, 6).forEach((s, k) => {
    const x = 80 + (k % cols) * ((W - 160) / cols);
    const y = 520 + Math.floor(k / cols) * 230;
    const colW = (W - 160) / cols - 24;
    ctx.fillStyle = '#e0f84a';
    ctx.fillText(fit(s.value, colW, 800, 84, 40), x, y);
    ctx.fillStyle = 'rgba(244,246,238,0.65)';
    ctx.fillText(fit(s.label, colW, 400, 36, 24), x, y + 52);
  });
  if (i.records.length) {
    ctx.fillStyle = '#e0f84a';
    ctx.font = `700 40px ${font}`;
    ctx.fillText('REKORDE', 80, 1010);
    ctx.fillStyle = '#f4f6ee';
    ctx.font = `500 42px ${font}`;
    i.records.slice(0, 3).forEach((r, k) => {
      // Zahlen („…: 43 kg × 10“) bleiben immer vollständig, nur der Übungsname wird gekürzt
      const cut = r.lastIndexOf(': ');
      const name = cut > 0 ? r.slice(0, cut) : r;
      const detail = cut > 0 ? r.slice(cut) : '';
      ctx.font = `500 42px ${font}`;
      const room = maxW - ctx.measureText(detail).width;
      ctx.fillText(`${fit(name, Math.max(120, room), 500, 42, 42)}${detail}`, 80, 1075 + k * 62);
    });
  }
  ctx.fillStyle = 'rgba(244,246,238,0.5)';
  ctx.font = `500 34px ${font}`;
  ctx.fillText(`Eisenzeit${i.studio ? ` · ${i.studio}` : ''}`, 80, H - 80);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
