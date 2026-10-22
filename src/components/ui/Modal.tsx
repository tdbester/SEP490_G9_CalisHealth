import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Rendered in the header, next to the close button. */
  title?: ReactNode;
  children: ReactNode;
  /** Extra class on the panel, e.g. to cap the max width. */
  panelClassName?: string;
  /** Extra inline style on the panel, e.g. to set its background/colour. */
  panelStyle?: CSSProperties;
  /** BCP-47 language for the panel, e.g. "en" so English text picks an
   *  English font even when <html lang> differs. */
  lang?: string;
  /** Custom control rendered at the far right of the header, instead of the
   *  default ✕ icon button. Use for designs with a text "Close". */
  headerRight?: ReactNode;
  /** Extra class on the scrollable body wrapper. */
  bodyClassName?: string;
  /** Label for the close button (a11y). */
  closeLabel?: string;
}

/**
 * Accessible modal dialog: rendered in a portal, closes on overlay click,
 * Escape, and the close button. Locks body scroll while open and restores
 * focus to whatever was focused before it mounted.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  panelClassName,
  panelStyle,
  lang,
  headerRight,
  bodyClassName,
  closeLabel = 'Close',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Escape to close + remember what had focus so we can hand it back.
  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  // Prevent the page behind the dialog from scrolling.
  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  // Move focus into the panel so keyboard users aren't left behind it.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(e) => {
        // Only a press that both starts AND ends on the overlay closes, so a
        // drag-select that began inside the panel doesn't dismiss it.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Scrim */}
      <div className="absolute inset-0 bg-black/70" aria-hidden="true" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'relative w-full max-w-[560px] max-h-[85vh] overflow-y-auto rounded-2xl outline-none',
          panelClassName
        )}
        style={panelStyle}
        lang={lang}
      >
        {title != null && (
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 px-5 pt-5 pb-3"
            style={{ background: panelStyle?.background }}
          >
            <h2 className="text-lg font-semibold leading-tight">{title}</h2>
            {headerRight ?? (
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="shrink-0 rounded-md p-1 text-current opacity-70 transition-opacity hover:opacity-100 cursor-pointer"
              >
                <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
                  <path
                    d="M5 5L15 15M15 5L5 15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
        )}
        {bodyClassName ? <div className={bodyClassName}>{children}</div> : children}
      </div>
    </div>,
    document.body
  );
}