import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api from '../utils/api';
import { queryKeys } from '../lib/queryKeys';

export function useChannelsQuery() {
  return useQuery({
    queryKey: queryKeys.channels,
    queryFn: async () => {
      const res = await api.get('/api/channels');
      return res.data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

export function useSectorsQuery(includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.sectors(includeInactive),
    queryFn: async () => {
      const res = await api.get('/api/sectors', {
        params: includeInactive ? { includeInactive: true } : undefined,
      });
      return res.data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

export function useUsersQuery(params?: { limit?: number }) {
  return useQuery({
    queryKey: queryKeys.users(params),
    queryFn: async () => {
      const res = await api.get('/api/users', { params });
      return res.data?.users ?? res.data ?? [];
    },
    staleTime: 2 * 60_000,
  });
}

export function useConversationsQuery(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: queryKeys.conversations(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.append(k, v);
      });
      const qs = params.toString();
      const res = await api.get(`/api/conversations${qs ? `?${qs}` : ''}`);
      return res.data?.conversations ?? res.data ?? [];
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function usePipelinesListQuery() {
  return useQuery({
    queryKey: queryKeys.pipelines,
    queryFn: async () => {
      const res = await api.get('/api/pipelines');
      return res.data ?? [];
    },
    staleTime: 2 * 60_000,
  });
}

export function usePipelineDetailQuery(pipelineId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.pipeline(pipelineId ?? ''),
    queryFn: async () => {
      const res = await api.get(`/api/pipelines/${pipelineId}`);
      return res.data;
    },
    enabled: !!pipelineId,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}
