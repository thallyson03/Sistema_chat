import { useEffect, useRef, useState } from 'react';
import api from '../utils/api';

/**
 * Obtém a URL do sistema externo de tickets e abre em iframe dentro do sistema.
 */
export default function TicketsRedirect() {
  const [message, setMessage] = useState('');
  const [retryableError, setRetryableError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const startedRef = useRef(false);

  const requestPortalUrl = async (): Promise<string | null> => {
    setLoading(true);
    setRetryableError(false);
    setMessage('');
    try {
      const res = await api.get<{ url: string }>('/api/ticket-portal/portal', { timeout: 15000 });
      const url = (res.data?.url || '').trim();
      if (!url) {
        setRetryableError(true);
        setMessage('Servidor retornou URL inválida para abertura dos tickets.');
        return null;
      }
      setIframeUrl(url);
      return url;
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; hint?: string } }; message?: string };
      const d = e.response?.data;
      const text =
        [d?.error, d?.hint].filter(Boolean).join(' ') ||
        e.message ||
        'Não foi possível abrir o portal de tickets.';
      setRetryableError(true);
      setMessage(text);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Em React StrictMode (dev), useEffect pode disparar duas vezes.
    // Evita chamar /portal duas vezes e gerar redirects concorrentes.
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    requestPortalUrl().then((url) => {
      if (cancelled || !url) return;
      setMessage('');
    });
    const t = window.setTimeout(() => {
      if (!cancelled && !iframeUrl && !retryableError) {
        setRetryableError(true);
        setMessage('Não foi possível carregar o sistema de tickets. Tente novamente.');
      }
    }, 5000);
    return () => window.clearTimeout(t);
  }, [iframeUrl, retryableError]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <div className="flex min-h-[40px] items-center justify-end px-2">
        {iframeUrl && (
          <a
            href={iframeUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
          >
            Abrir em nova aba
          </a>
        )}
      </div>

      {loading && (
        <div className="flex h-full min-h-[60vh] flex-1 items-center justify-center rounded-none border border-primary/10 bg-surface-container text-xs text-on-surface-variant/80">
          Carregando tickets...
        </div>
      )}

      {retryableError && !loading && (
        <div className="flex h-full min-h-[60vh] flex-1 flex-col items-center justify-center gap-3 rounded-none border border-primary/10 bg-surface-container p-4">
          <p className="text-sm text-on-surface-variant">
            {message || 'Não foi possível carregar o sistema de tickets.'}
          </p>
          <button
            type="button"
            onClick={async () => {
              const url = await requestPortalUrl();
              if (url) setMessage('');
            }}
            className="rounded-md border border-primary/30 px-3 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {iframeUrl && !loading && (
        <iframe
          src={iframeUrl}
          title="Sistema de Tickets"
          className="h-full min-h-0 w-full flex-1 border-0 bg-white"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="clipboard-read; clipboard-write"
        />
      )}
    </div>
  );
}
