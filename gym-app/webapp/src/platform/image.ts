/** Verkleinert ein Bild auf höchstens `maxEdge` Pixel (längste Kante) und gibt ein JPEG zurück. */
export async function resizeImage(blob: Blob, maxEdge = 1280, quality = 0.82): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Das Bild konnte nicht gelesen werden.'));
      el.src = url;
    });
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Bildbearbeitung nicht verfügbar.');
    // JPEG kennt keine Transparenz: Zeichnungen als PNG bekämen sonst einen schwarzen Hintergrund
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!out) throw new Error('Das Bild konnte nicht umgewandelt werden.');
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
