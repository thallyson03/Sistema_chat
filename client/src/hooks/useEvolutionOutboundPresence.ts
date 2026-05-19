import { useCallback, useEffect, useRef } from 'react';
import api from '../utils/api';

type PresenceState = 'composing' | 'recording' | 'paused';

const RENEW_MS = 12_000;
const IDLE_MS = 4_000;
const THROTTLE_MS = 2_000;

export function useEvolutionOutboundPresence(options: {
  conversationId: string | undefined;
  evolutionInstanceId: string | null | undefined;
  enabled: boolean;
  messageInput: string;
  recording: boolean;
}) {
  const { conversationId, evolutionInstanceId, enabled, messageInput, recording } = options;
  const lastStateRef = useRef<PresenceState | null>(null);
  const lastSentAtRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renewTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (renewTimerRef.current) {
      clearInterval(renewTimerRef.current);
      renewTimerRef.current = null;
    }
  }, []);

  const sendPresence = useCallback(
    (state: PresenceState, force = false) => {
      if (!conversationId || !evolutionInstanceId || !enabled) return;
      const now = Date.now();
      if (
        !force &&
        state !== 'paused' &&
        lastStateRef.current === state &&
        now - lastSentAtRef.current < THROTTLE_MS
      ) {
        return;
      }
      lastStateRef.current = state;
      lastSentAtRef.current = now;
      api.post(`/api/conversations/${conversationId}/presence`, { state }).catch(() => {});
    },
    [conversationId, evolutionInstanceId, enabled],
  );

  const stopPresence = useCallback(() => {
    clearTimers();
    sendPresence('paused', true);
  }, [clearTimers, sendPresence]);

  useEffect(() => {
    if (!enabled || !conversationId || !evolutionInstanceId) {
      clearTimers();
      return;
    }

    if (recording) {
      clearTimers();
      sendPresence('recording', true);
      renewTimerRef.current = setInterval(() => sendPresence('recording', true), RENEW_MS);
      return () => {
        clearTimers();
        sendPresence('paused', true);
      };
    }

    const trimmed = messageInput.trim();
    if (!trimmed) {
      clearTimers();
      // Não envia paused aqui: evita competir com a inscrição inbound (cliente → CRM).
      // paused só em idle, stopPresence ou ao sair da conversa.
      return;
    }

    sendPresence('composing', true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      sendPresence('paused', true);
      clearTimers();
    }, IDLE_MS);

    if (!renewTimerRef.current) {
      renewTimerRef.current = setInterval(() => sendPresence('composing', true), RENEW_MS);
    }

    return () => {
      clearTimers();
    };
  }, [
    messageInput,
    recording,
    conversationId,
    evolutionInstanceId,
    enabled,
    sendPresence,
    clearTimers,
  ]);

  useEffect(() => {
    return () => {
      clearTimers();
      if (conversationId && evolutionInstanceId && enabled) {
        api.post(`/api/conversations/${conversationId}/presence`, { state: 'paused' }).catch(() => {});
      }
      lastStateRef.current = null;
      lastSentAtRef.current = 0;
    };
  }, [conversationId, evolutionInstanceId, enabled, clearTimers]);

  return { stopPresence };
}
