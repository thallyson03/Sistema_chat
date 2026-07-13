import { useEffect, useState } from 'react';
import api from '../utils/api';

type VoiceChannelOption = {
  id: string;
  name: string;
  config?: { phoneNumber?: string | null };
  status?: string;
};

type Props = {
  phone?: string | null;
  contactId?: string | null;
  conversationId?: string | null;
  dealId?: string | null;
  className?: string;
  compact?: boolean;
};

export default function CallContactButton({
  phone,
  contactId,
  conversationId,
  dealId,
  className = '',
  compact = false,
}: Props) {
  const [channels, setChannels] = useState<VoiceChannelOption[]>([]);
  const [open, setOpen] = useState(false);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/api/voice/channels');
        if (!cancelled) {
          setChannels(
            (res.data || []).filter(
              (ch: VoiceChannelOption) => ch.config?.phoneNumber && ch.status === 'ACTIVE',
            ),
          );
        }
      } catch {
        if (!cancelled) setChannels([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!phone) return null;

  const startCall = async (channelId: string) => {
    setCalling(true);
    try {
      await api.post('/api/voice/calls', {
        channelId,
        to: phone,
        contactId: contactId || undefined,
        conversationId: conversationId || undefined,
        dealId: dealId || undefined,
      });
      setOpen(false);
      alert('Chamada iniciada via Twilio.');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao iniciar chamada');
    } finally {
      setCalling(false);
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        title="Ligar (Twilio)"
        onClick={() => setOpen((v) => !v)}
        className={
          compact
            ? 'inline-flex items-center gap-1 rounded-lg border border-primary/35 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary-fixed-dim transition hover:bg-primary/15'
            : 'inline-flex items-center gap-1.5 rounded-lg border border-primary/35 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary-fixed-dim transition hover:bg-primary/15'
        }
      >
        <span className="material-symbols-outlined text-sm">call</span>
        Ligar
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-1 min-w-[220px] rounded-lg border border-outline-variant bg-surface-container-highest p-2 shadow-xl">
          {channels.length === 0 ? (
            <p className="px-2 py-2 text-xs text-on-surface-variant">
              Nenhum canal de voz ativo com número. Configure em Telefonia.
            </p>
          ) : (
            channels.map((ch) => (
              <button
                key={ch.id}
                type="button"
                disabled={calling}
                onClick={() => startCall(ch.id)}
                className="flex w-full flex-col rounded-md px-2 py-2 text-left text-xs transition hover:bg-surface-container"
              >
                <span className="font-semibold text-on-surface">{ch.name}</span>
                <span className="text-on-surface-variant">{ch.config?.phoneNumber}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
