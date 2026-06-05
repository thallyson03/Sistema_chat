import { useEffect, useId, useRef, useState } from 'react';
import {
  formatMetaSendErrorDisplay,
  type MessageSendErrorPayload,
} from '../../utils/metaSendError';

interface MessageSendErrorBadgeProps {
  sendError?: MessageSendErrorPayload | null;
  className?: string;
}

export default function MessageSendErrorBadge({
  sendError,
  className = '',
}: MessageSendErrorBadgeProps) {
  const popoverId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const display = formatMetaSendErrorDisplay(sendError);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((prev) => !prev)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center gap-1 rounded-md bg-[#5c2d3a] text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#6b3544]"
        style={{ padding: '2px 8px' }}
      >
        <span
          aria-hidden
          className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white"
        >
          !
        </span>
        Erro
      </button>

      {open && (
        <div
          id={popoverId}
          role="tooltip"
          className="absolute bottom-[calc(100%+8px)] right-0 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-md border border-red-300/80 bg-[#fde8ea] px-3 py-2.5 text-left text-[12px] leading-snug text-[#3d2a2e] shadow-lg"
        >
          <p>
            {display.description}
            {display.codeLabel ? (
              <span className="font-semibold text-[#8b1e2d]"> ({display.codeLabel})</span>
            ) : null}
            {' '}
            <a
              href={display.learnMoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#1877f2] underline underline-offset-2 hover:text-[#0d65d9]"
              onClick={(event) => event.stopPropagation()}
            >
              Saiba mais
            </a>
          </p>
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-1.5 right-4 h-3 w-3 rotate-45 border-b border-r border-red-300/80 bg-[#fde8ea]"
          />
        </div>
      )}
    </div>
  );
}
