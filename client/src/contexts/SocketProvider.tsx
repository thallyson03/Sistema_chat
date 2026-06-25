import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { createAuthenticatedSocket } from '../utils/socket';
import { useAuth } from './AuthProvider';
import api from '../utils/api';

interface SocketContextValue {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextValue>({ socket: null });

export function SocketProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setSocket((prev) => {
        prev?.disconnect();
        return null;
      });
      return;
    }

    const s = createAuthenticatedSocket();
    setSocket(s);

    s.on('new_message', (data: { conversationId: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      void queryClient.invalidateQueries({
        queryKey: ['conversationMessages', data.conversationId],
      });
    });

    s.on('conversation_updated', () => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [isAuthenticated, queryClient]);

  return <SocketContext.Provider value={{ socket }}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}

/** Registra listener no socket global; remove ao desmontar. */
export function useSocketEvent<T = unknown>(
  event: string,
  handler: (data: T) => void,
  enabled = true,
) {
  const { socket } = useSocket();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket || !enabled) return;
    const wrapped = (data: T) => handlerRef.current(data);
    socket.on(event, wrapped);
    return () => {
      socket.off(event, wrapped);
    };
  }, [socket, event, enabled]);
}

/** Notificação global de tarefa de pipeline (usado no Layout). */
export function useTaskNotificationListener(
  onTask: (payload: { conversationId: string; content: string }) => void,
) {
  const onTaskRef = useRef(onTask);
  onTaskRef.current = onTask;

  useSocketEvent<{ conversationId: string; messageId?: string }>(
    'new_message',
    async (data) => {
      try {
        const response = await api.get(`/api/messages/conversation/${data.conversationId}`, {
          params: { limit: 1, offset: 0 },
        });
        const messages = response.data || [];
        if (!messages.length) return;
        const message = messages[messages.length - 1];
        const isTaskNotification =
          message?.metadata?.fromBot === true &&
          typeof message.content === 'string' &&
          message.content.startsWith('⏰ Chegou a hora de realizar uma tarefa deste negócio.');
        if (!isTaskNotification) return;
        onTaskRef.current({ conversationId: data.conversationId, content: message.content });
      } catch (error) {
        console.error('[Socket] Erro ao processar notificação de tarefa:', error);
      }
    },
    true,
  );
}
