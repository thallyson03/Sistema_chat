import { useEffect, useState } from 'react';
import api from '../utils/api';

/**
 * Obtém a URL do sistema externo de tickets e redireciona na mesma aba (experiência unificada).
 */
export default function TicketsRedirect() {
  const [message, setMessage] = useState('Abrindo sistema de tickets…');

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ url: string }>('/api/ticket-portal/portal')
      .then((res) => {
        if (cancelled) return;
        window.location.replace(res.data.url);
      })
      .catch((err: { response?: { data?: { error?: string; hint?: string } } }) => {
        if (cancelled) return;
        const d = err.response?.data;
        const text = [d?.error, d?.hint].filter(Boolean).join(' ') || 'Não foi possível abrir o portal de tickets.';
        setMessage(text);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="max-w-md text-sm text-on-surface-variant">{message}</p>
    </div>
  );
}
