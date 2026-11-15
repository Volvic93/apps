import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconChevronLeft } from './Icons';

export function BackButton({ to, label = 'Zurück' }: { to?: string; label?: string }) {
  const nav = useNavigate();
  return (
    <button className="back" onClick={() => (to ? nav(to) : nav(-1))} aria-label={label}>
      <IconChevronLeft size={22} />
      <span>{label}</span>
    </button>
  );
}

/** Wird die Seite gescrollt, schrumpft die feste Kopfleiste (Zurück, kompakter Titel, Aktionen bleiben sichtbar). */
function useCompact(): boolean {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setCompact((c) => (c ? y > 8 : y > 48)); // Hysterese gegen Flackern an der Schwelle
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return compact;
}

export function ScreenHeader({ title, eyebrow, right, back }: { title: string; eyebrow?: string; right?: ReactNode; back?: ReactNode }) {
  const compact = useCompact();
  return (
    <header className={'screen-header' + (compact ? ' compact' : '')}>
      {back}
      <div className="screen-header-main">
        <div className="screen-header-text">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1 className={'h1' + (title.length > 26 ? ' long' : '')}>{title}</h1>
        </div>
        {right && <div className="screen-header-right">{right}</div>}
      </div>
    </header>
  );
}
