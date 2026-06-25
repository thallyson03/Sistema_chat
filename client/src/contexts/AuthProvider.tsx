import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { queryKeys } from '../lib/queryKeys';
import { queryClient } from '../lib/queryClient';
import type { AuthUser, PauseStatus, UserRole } from '../types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  pause: PauseStatus | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPauseLoading: boolean;
  hasRole: (roles: UserRole[]) => boolean;
  refetchUser: () => Promise<void>;
  refetchPause: () => Promise<void>;
  logout: () => Promise<void>;
  applyPause: (pause: boolean, reason?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const meQuery = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      const res = await api.get<AuthUser>('/api/auth/me');
      return res.data;
    },
    retry: false,
    staleTime: 60_000,
  });

  const userId = meQuery.data?.id;

  const pauseQuery = useQuery({
    queryKey: queryKeys.auth.pause(userId),
    queryFn: async () => {
      const res = await api.get<PauseStatus>(`/api/users/${userId}/pause`);
      return {
        isPaused: res.data.isPaused || false,
        pauseReason: res.data.pauseReason || null,
        openAssignedConversationsCount:
          typeof res.data.openAssignedConversationsCount === 'number'
            ? res.data.openAssignedConversationsCount
            : 0,
      };
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  useEffect(() => {
    const onFocus = () => {
      if (userId) {
        void pauseQuery.refetch();
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [userId, pauseQuery]);

  const hasRole = useCallback(
    (roles: UserRole[]) => {
      if (!meQuery.data?.role) return false;
      return roles.includes(meQuery.data.role);
    },
    [meQuery.data?.role],
  );

  const refetchUser = useCallback(async () => {
    await meQuery.refetch();
  }, [meQuery]);

  const refetchPause = useCallback(async () => {
    await pauseQuery.refetch();
  }, [pauseQuery]);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      qc.clear();
    }
  }, [qc]);

  const applyPause = useCallback(
    async (pause: boolean, reason?: string) => {
      if (!userId) return;
      await api.post(`/api/users/${userId}/pause`, { pause, reason });
      await pauseQuery.refetch();
    },
    [userId, pauseQuery],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      pause: pauseQuery.data ?? null,
      isLoading: meQuery.isLoading,
      isAuthenticated: meQuery.isSuccess && !!meQuery.data,
      isPauseLoading: !!userId && pauseQuery.isLoading,
      hasRole,
      refetchUser,
      refetchPause,
      logout,
      applyPause,
    }),
    [
      meQuery.data,
      meQuery.isLoading,
      meQuery.isSuccess,
      pauseQuery.data,
      pauseQuery.isLoading,
      userId,
      hasRole,
      refetchUser,
      refetchPause,
      logout,
      applyPause,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return ctx;
}

/** Após login bem-sucedido, invalida cache de sessão. */
export function invalidateAuthSession() {
  void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
}
