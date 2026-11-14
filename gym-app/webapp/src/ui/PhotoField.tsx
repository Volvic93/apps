import { addPhoto } from '../data/repo';
import { platform, resizeImage } from '../platform';
import { usePhotoUrl } from './hooks';
import { IconCamera, IconImage, IconTrash } from './Icons';
import { useUi } from './kit';

/** Foto aufnehmen oder aus der Mediathek wählen; wird auf 1280 px verkleinert gespeichert. */
export function PhotoField({
  photoId,
  fallbackUrl,
  onChange,
  label = 'Foto',
}: {
  photoId: string | undefined;
  fallbackUrl?: string;
  onChange: (id: string | undefined) => void;
  label?: string;
}) {
  const url = usePhotoUrl(photoId);
  const { toast } = useUi();
  const pick = async (source: 'camera' | 'library') => {
    try {
      const blob = await platform.pickPhoto(source);
      if (!blob) return;
      const small = await resizeImage(blob, 1280, 0.82);
      const id = await addPhoto(small);
      // Das alte Foto bleibt, bis gespeichert ist – bricht jemand das Bearbeiten ab, geht nichts verloren.
      onChange(id);
    } catch (e) {
      toast((e as Error).message || 'Das Foto konnte nicht übernommen werden.', 'error');
    }
  };
  const shown = url ?? fallbackUrl;
  return (
    <div className="photofield">
      <div className="photofield-preview">{shown ? <img src={shown} alt={label} /> : <span className="muted">Kein Foto</span>}</div>
      <div className="photofield-actions">
        <button type="button" className="btn small" onClick={() => pick('camera')}>
          <IconCamera size={18} /> Aufnehmen
        </button>
        <button type="button" className="btn small" onClick={() => pick('library')}>
          <IconImage size={18} /> Auswählen
        </button>
        {photoId && (
          <button
            type="button"
            className="btn small ghost"
            onClick={() => onChange(undefined)}
          >
            <IconTrash size={18} /> Entfernen
          </button>
        )}
      </div>
    </div>
  );
}
