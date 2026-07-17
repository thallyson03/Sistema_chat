import { useEffect, useRef, useState } from 'react';
import api from '../utils/api';

type SoftphoneStatus = 'idle' | 'registering' | 'ready' | 'error';
type CallPhase = 'ringing' | 'connecting' | 'active';
type OutboundTarget = { phone?: string; channelId?: string; channelName?: string };

/**
 * Mantém o softphone Twilio registrado e atende o primeiro trecho das ligações
 * outbound: Twilio -> navegador do agente -> número do cliente.
 */
export default function SoftphoneRegistrar() {
  const deviceRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const channelIdRef = useRef<string | null>(null);
  const targetRef = useRef<OutboundTarget>({});
  const [status, setStatus] = useState<SoftphoneStatus>('idle');
  const [callPhase, setCallPhase] = useState<CallPhase | null>(null);
  const [callTarget, setCallTarget] = useState<OutboundTarget>({});
  const [callError, setCallError] = useState('');

  useEffect(() => {
    const rememberOutboundTarget = (event: Event) => {
      const detail = (event as CustomEvent<OutboundTarget>).detail || {};
      targetRef.current = detail;
    };
    window.addEventListener('crm:voice-call-started', rememberOutboundTarget);
    return () => window.removeEventListener('crm:voice-call-started', rememberOutboundTarget);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchToken = async (channelId: string) => {
      const tokenRes = await api.post(`/api/voice/channels/${channelId}/token`);
      return String(tokenRes.data?.token || '');
    };

    const clearCall = () => {
      callRef.current = null;
      if (!cancelled) {
        setCallPhase(null);
        setCallError('');
      }
    };

    const attachCallEvents = (call: any) => {
      call.on('accept', () => {
        if (!cancelled) setCallPhase('active');
      });
      call.on('disconnect', clearCall);
      call.on('cancel', clearCall);
      call.on('reject', clearCall);
      call.on('error', (error: any) => {
        if (!cancelled) {
          setCallError(error?.message || 'Falha no áudio da ligação');
          setCallPhase(null);
        }
        callRef.current = null;
      });
    };

    const setup = async () => {
      try {
        setStatus('registering');
        const chRes = await api.get('/api/voice/channels');
        const active = (chRes.data || []).find(
          (ch: any) =>
            ch.status === 'ACTIVE' &&
            ch.config?.phoneNumber &&
            ch.config?.twimlAppSid &&
            ch.config?.apiKeySid &&
            ch.config?.hasApiKeySecret,
        );
        if (!active || cancelled) {
          if (!cancelled) setStatus('idle');
          return;
        }

        channelIdRef.current = active.id;
        const token = await fetchToken(active.id);
        if (!token || cancelled) {
          if (!cancelled) setStatus('error');
          return;
        }

        const { Device } = await import('@twilio/voice-sdk');
        if (cancelled) return;

        const device = new Device(token, { logLevel: 1 });
        deviceRef.current = device;

        device.on('registered', () => {
          if (!cancelled) setStatus('ready');
        });
        device.on('unregistered', () => {
          if (!cancelled) setStatus('registering');
        });
        device.on('error', (error: any) => {
          console.error('[Softphone] Erro Twilio Device:', error);
          if (!cancelled) setStatus('error');
        });
        device.on('tokenWillExpire', async () => {
          try {
            const channelId = channelIdRef.current;
            if (!channelId) return;
            const refreshedToken = await fetchToken(channelId);
            if (refreshedToken && !cancelled) device.updateToken(refreshedToken);
          } catch (error) {
            console.error('[Softphone] Falha ao renovar token:', error);
            if (!cancelled) setStatus('error');
          }
        });
        device.on('incoming', (call: any) => {
          if (callRef.current) {
            call.reject();
            return;
          }
          callRef.current = call;
          attachCallEvents(call);
          const parameters = call.parameters || {};
          const remembered = targetRef.current;
          if (!cancelled) {
            setCallError('');
            setCallTarget({
              ...remembered,
              phone: remembered.phone || parameters.From || parameters.To,
              channelName: remembered.channelName || active.name,
            });
            setCallPhase('ringing');
          }
          try {
            navigator.vibrate?.([200, 100, 200]);
          } catch {
            /* recurso opcional */
          }
        });

        await device.register();
      } catch (error) {
        console.error('[Softphone] Falha ao registrar:', error);
        if (!cancelled) setStatus('error');
      }
    };

    void setup();
    return () => {
      cancelled = true;
      try {
        callRef.current?.disconnect?.();
        deviceRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      callRef.current = null;
      deviceRef.current = null;
    };
  }, []);

  const answer = async () => {
    const call = callRef.current;
    if (!call) return;
    try {
      setCallError('');
      setCallPhase('connecting');
      const permissionStream = await navigator.mediaDevices?.getUserMedia?.({ audio: true });
      permissionStream?.getTracks().forEach((track) => track.stop());
      call.accept();
    } catch (error: any) {
      setCallPhase('ringing');
      setCallError(
        error?.name === 'NotAllowedError'
          ? 'Permita o acesso ao microfone para atender.'
          : error?.message || 'Não foi possível acessar o microfone.',
      );
    }
  };

  const reject = () => {
    try {
      callRef.current?.reject?.();
    } finally {
      callRef.current = null;
      setCallPhase(null);
      setCallError('');
    }
  };

  const hangup = () => {
    try {
      callRef.current?.disconnect?.();
    } finally {
      callRef.current = null;
      setCallPhase(null);
      setCallError('');
    }
  };

  const statusLabel =
    status === 'ready'
      ? '● Softphone online'
      : status === 'registering'
        ? '◌ Conectando softphone'
        : '○ Softphone offline';

  return (
    <>
      {status !== 'idle' ? (
        <div
          className="pointer-events-none fixed bottom-3 right-3 z-[1500] rounded-full border border-outline-variant bg-surface-container-highest/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide shadow-lg"
          title="Softphone Twilio"
        >
          <span className={status === 'ready' ? 'text-primary-fixed-dim' : 'text-on-surface-variant'}>
            {statusLabel}
          </span>
        </div>
      ) : null}

      {callPhase ? (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-outline-variant bg-surface-container-highest p-6 text-center shadow-2xl">
            <div
              className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
                callPhase === 'active' ? 'bg-primary/20 text-primary' : 'bg-emerald-900/30 text-primary-fixed-dim'
              }`}
            >
              <span className="material-symbols-outlined text-3xl">
                {callPhase === 'active' ? 'phone_in_talk' : 'ring_volume'}
              </span>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {callPhase === 'ringing'
                ? 'Ligação pronta para iniciar'
                : callPhase === 'connecting'
                  ? 'Conectando...'
                  : 'Ligação em andamento'}
            </p>
            <h2 className="mt-2 text-xl font-bold text-on-surface">
              {callTarget.phone || 'Cliente'}
            </h2>
            {callTarget.channelName ? (
              <p className="mt-1 text-xs text-on-surface-variant">{callTarget.channelName}</p>
            ) : null}
            {callPhase === 'ringing' ? (
              <p className="mt-3 text-xs text-on-surface-variant">
                Atenda no navegador; depois a Twilio discará para o cliente.
              </p>
            ) : null}
            {callError ? (
              <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-xs text-red-200">{callError}</p>
            ) : null}

            <div className="mt-6 flex justify-center gap-4">
              {callPhase === 'ringing' || callPhase === 'connecting' ? (
                <>
                  <button
                    type="button"
                    onClick={reject}
                    disabled={callPhase === 'connecting'}
                    className="flex h-12 min-w-12 items-center justify-center rounded-full bg-error-container px-4 font-semibold text-on-error disabled:opacity-50"
                    title="Recusar"
                  >
                    <span className="material-symbols-outlined">call_end</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void answer()}
                    disabled={callPhase === 'connecting'}
                    className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 font-bold text-on-primary disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">call</span>
                    Atender
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={hangup}
                  className="flex h-12 items-center justify-center gap-2 rounded-full bg-error-container px-5 font-bold text-on-error"
                >
                  <span className="material-symbols-outlined">call_end</span>
                  Desligar
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
