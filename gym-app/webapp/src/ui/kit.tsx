import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './Icons';

// ------------------------------------------------------------------ Sheet (Bottom-Sheet)

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  tall,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  tall?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'sheet' + (tall ? ' tall' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div className="sheet-title">{title}</div>
          <button className="icon-btn sm" onClick={onClose} aria-label="Schließen">
            <IconClose size={20} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ------------------------------------------------------------------ Toast + Bestätigung

interface ToastApi {
  toast: (text: string, kind?: 'ok' | 'record' | 'error') => void;
  confirm: (opts: { title: string; message?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
}
const Ctx = createContext<ToastApi>({ toast: () => {}, confirm: async () => false });
export const useUi = () => useContext(Ctx);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; text: string; kind: string }[]>([]);
  const [dialog, setDialog] = useState<null | { title: string; message?: string; confirmLabel: string; danger: boolean; resolve: (v: boolean) => void }>(null);
  const idRef = useRef(0);

  const toast = useCallback<ToastApi['toast']>((text, kind = 'ok') => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'record' ? 3600 : 2600);
  }, []);

  const confirm = useCallback<ToastApi['confirm']>(
    (o) =>
      new Promise((resolve) => {
        setDialog({ title: o.title, message: o.message, confirmLabel: o.confirmLabel ?? 'OK', danger: !!o.danger, resolve });
      }),
    [],
  );

  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      {createPortal(
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={'toast ' + t.kind}>
              {t.text}
            </div>
          ))}
        </div>,
        document.body,
      )}
      {dialog &&
        createPortal(
          <div className="sheet-backdrop center" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
            <div className="dialog" role="alertdialog" aria-modal="true" aria-label={dialog.title}>
              <div className="dialog-title">{dialog.title}</div>
              {dialog.message && <div className="dialog-msg">{dialog.message}</div>}
              <div className="dialog-actions">
                <button className="btn ghost" onClick={() => close(false)}>
                  Abbrechen
                </button>
                <button className={'btn ' + (dialog.danger ? 'danger' : 'primary')} onClick={() => close(true)}>
                  {dialog.confirmLabel}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
}

// ------------------------------------------------------------------ Kleinteile

export function Chip({ on, onClick, children, dot }: { on?: boolean; onClick?: () => void; children: ReactNode; dot?: string }) {
  return (
    <button type="button" className={'chip' + (on ? ' on' : '')} onClick={onClick} aria-pressed={on}>
      {dot && <span className="chip-dot" style={{ background: dot }} />}
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** Zahlenfeld, das auch unfertige Eingaben ("12,") zulässt und erst beim Verlassen übernimmt. */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
  className,
  decimals = true,
  ariaLabel,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  decimals?: boolean;
  ariaLabel?: string;
}) {
  const fmt = (v: number | undefined) => (v === undefined ? '' : String(v).replace('.', ','));
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(fmt(value));
  }, [value, focused]);
  const commit = (t: string) => {
    const n = parseFloat(t.replace(',', '.'));
    if (t.trim() === '' || Number.isNaN(n)) {
      onChange(undefined);
      return;
    }
    let v = n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    onChange(v);
  };
  return (
    <input
      className={className ?? 'input'}
      inputMode={decimals ? 'decimal' : 'numeric'}
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      data-step={step}
      onFocus={(e) => {
        setFocused(true);
        e.currentTarget.select();
      }}
      onBlur={() => {
        setFocused(false);
        commit(text);
        setText(fmt(value));
      }}
      onChange={(e) => {
        const t = e.target.value.replace(/[^0-9.,-]/g, '');
        setText(t);
        if (/^-?\d+([.,]\d+)?$/.test(t)) commit(t);
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
    />
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {text && <div className="empty-text">{text}</div>}
      {action}
    </div>
  );
}

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function formatDateLong(ts: number): string {
  return new Date(ts).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}
export function formatDateShort(ts: number): string {
  return new Date(ts).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
