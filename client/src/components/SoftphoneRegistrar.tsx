import { useEffect, useRef, useState } from 'react';
import api from '../utils/api';

/**
 * Mantém o softphone Twilio registrado para receber o trecho "agent" das ligações outbound.
 * Requer canal com apiKey + twimlAppSid e número comprado.
 */
export default function SoftphoneRegistrar() {
  const deviceRef = useRef<any>(null);
  const [status, setStatus] = useState<'idle' | 'ready' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      try {
        const chRes = await api.get('/api/voice/channels');
        const active = (chRes.data || []).find(
          (ch: any) => ch.status === 'ACTIVE' && ch.config?.phoneNumber && ch.config?.twimlAppSid,
        );
        if (!active || cancelled) return;

        const tokenRes = await api.post(`/api/voice/channels/${active.id}/token`);
        const token = tokenRes.data?.token;
        if (!token || cancelled) return;

        const { Device } = await import('@twilio/voice-sdk');
        if (cancelled) return;

        if (deviceRef.current) {
          try {
            deviceRef.current.destroy();
          } catch {
            /* ignore */
          }
        }

        const device = new Device(token, { logLevel: 1 });
        deviceRef.current = device;
        device.on('registered', () => {
          if (!cancelled) setStatus('ready');
        });
        device.on('error', () => {
          if (!cancelled) setStatus('error');
        });
        await device.register();
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    setup();
    return () => {
      cancelled = true;
      try {
        deviceRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  if (status === 'idle') return null;

  return (
    <div
      className="pointer-events-none fixed bottom-3 right-3 z-[1500] rounded-full border border-outline-variant bg-surface-container-highest/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide shadow-lg"
      title="Softphone Twilio"
    >
      {status === 'ready' ? (
        <span className="text-primary-fixed-dim">● Softphone online</span>
      ) : (
        <span className="text-on-surface-variant">○ Softphone offline</span>
      )}
    </div>
  );
}
