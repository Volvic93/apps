import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './Icons';

export interface LightboxImage {
  src: string;
  caption?: string;
}

const MAX_SCALE = 5;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Vollbildansicht für Fotos: ganzes Bild, Zoomen per Zwei-Finger-Geste, Mausrad oder Doppeltipp,
 * Wischen zwischen mehreren Bildern, Schließen per Knopf, Tippen daneben, Escape oder Wischen nach unten.
 */
export function Lightbox({ images, start = 0, onClose }: { images: LightboxImage[]; start?: number; onClose: () => void }) {
  const [index, setIndex] = useState(clamp(start, 0, Math.max(0, images.length - 1)));
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [drag, setDrag] = useState({ x: 0, y: 0 }); // Wischen zwischen Bildern / nach unten (nur bei scale 1)
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ startDist: 0, startScale: 1, startView: { scale: 1, x: 0, y: 0 }, moved: false, lastTap: 0, startPoint: { x: 0, y: 0 } });
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, images.length]);

  const go = (d: number) => {
    const next = index + d;
    if (next < 0 || next >= images.length) return;
    setIndex(next);
    setView({ scale: 1, x: 0, y: 0 });
    setDrag({ x: 0, y: 0 });
  };

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    g.moved = false;
    g.startView = viewRef.current;
    g.startPoint = { x: e.clientX, y: e.clientY };
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      g.startDist = dist(a, b);
      g.startScale = viewRef.current.scale;
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    const g = gesture.current;
    const prev = { ...p };
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = dist(a, b);
      if (g.startDist > 0) {
        const scale = clamp(g.startScale * (d / g.startDist), 1, MAX_SCALE);
        setView((v) => (scale === 1 ? { scale: 1, x: 0, y: 0 } : { ...v, scale }));
      }
      g.moved = true;
      return;
    }
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    if (Math.abs(e.clientX - g.startPoint.x) + Math.abs(e.clientY - g.startPoint.y) > 6) g.moved = true;
    if (viewRef.current.scale > 1) {
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    } else {
      setDrag({ x: e.clientX - g.startPoint.x, y: e.clientY - g.startPoint.y });
    }
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size > 0) return;
    if (viewRef.current.scale <= 1) {
      const { x, y } = drag;
      setDrag({ x: 0, y: 0 });
      if (g.moved) {
        if (y > 110 && Math.abs(y) > Math.abs(x)) return onClose();
        if (Math.abs(x) > 60 && Math.abs(x) > Math.abs(y)) return go(x < 0 ? 1 : -1);
        return;
      }
    } else if (g.moved) {
      return;
    }
    // Tippen ohne Bewegung: Doppeltipp zoomt, einfaches Tippen neben dem Bild schließt
    const t = Date.now();
    if (t - g.lastTap < 300) {
      g.lastTap = 0;
      setView((v) => (v.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2.5, x: 0, y: 0 }));
    } else {
      g.lastTap = t;
      if ((e.target as HTMLElement).dataset.lbBackdrop) {
        setTimeout(() => {
          if (gesture.current.lastTap === t) onClose();
        }, 310);
      }
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const scale = clamp(viewRef.current.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, MAX_SCALE);
    setView(scale === 1 ? { scale: 1, x: 0, y: 0 } : { ...viewRef.current, scale });
  };

  const img = images[index];
  if (!img) return null;
  const fade = view.scale <= 1 ? clamp(1 - Math.abs(drag.y) / 500, 0.4, 1) : 1;
  return createPortal(
    <div className="lb" role="dialog" aria-modal="true" aria-label="Bild in Vollansicht" style={{ background: `rgba(0, 0, 0, ${0.94 * fade})` }}>
      <div
        className="lb-stage"
        data-lb-backdrop="1"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
      >
        <img
          className="lb-img"
          src={img.src}
          alt={img.caption ?? ''}
          draggable={false}
          style={{ transform: `translate(${view.x + (view.scale <= 1 ? drag.x : 0)}px, ${view.y + (view.scale <= 1 ? drag.y : 0)}px) scale(${view.scale})`, transition: pointers.current.size ? 'none' : 'transform 0.18s ease' }}
        />
      </div>
      <button type="button" className="lb-close" onClick={onClose} aria-label="Schließen">
        <IconClose size={22} />
      </button>
      {images.length > 1 && (
        <>
          <button type="button" className="lb-nav lb-prev" onClick={() => go(-1)} disabled={index === 0} aria-label="Vorheriges Bild">
            ‹
          </button>
          <button type="button" className="lb-nav lb-next" onClick={() => go(1)} disabled={index === images.length - 1} aria-label="Nächstes Bild">
            ›
          </button>
        </>
      )}
      <div className="lb-cap">
        {img.caption && <div>{img.caption}</div>}
        {images.length > 1 && (
          <div className="lb-dots" aria-hidden="true">
            {images.map((_, i) => (
              <span key={i} className={i === index ? 'on' : ''} />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
