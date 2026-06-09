import { useCallback, useEffect, useState } from 'react';
import api from '../utils/api';

interface AuditLogUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: AuditLogUser | null;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = { limit, offset };
      if (actionFilter.trim()) params.action = actionFilter.trim();
      const res = await api.get('/api/audit-logs', { params });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar logs de auditoria');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, offset]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Logs de auditoria</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Registro de ações sensíveis no sistema (login, alterações de dados, LGPD).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-outline-variant bg-surface-container-low p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="action-filter" className="text-xs font-medium text-on-surface-variant">
            Filtrar por ação
          </label>
          <input
            id="action-filter"
            type="text"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setOffset(0);
            }}
            placeholder="ex: login.success"
            className="rounded-md border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
          />
        </div>
        <button
          type="button"
          onClick={() => void fetchLogs()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary"
        >
          Atualizar
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-on-surface-variant">Carregando logs...</div>
      ) : logs.length === 0 ? (
        <div className="py-12 text-center text-on-surface-variant">Nenhum registro encontrado.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-outline-variant">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-highest text-left text-on-surface-variant">
                <th className="px-3 py-3 font-semibold">Data</th>
                <th className="px-3 py-3 font-semibold">Usuário</th>
                <th className="px-3 py-3 font-semibold">Ação</th>
                <th className="px-3 py-3 font-semibold">Recurso</th>
                <th className="px-3 py-3 font-semibold">IP</th>
                <th className="px-3 py-3 font-semibold">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-outline-variant bg-surface-container-low/30">
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-on-surface-variant">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="px-3 py-3">
                    {log.user ? (
                      <div>
                        <div className="font-medium text-on-surface">{log.user.name}</div>
                        <div className="text-xs text-on-surface-variant">{log.user.email}</div>
                      </div>
                    ) : (
                      <span className="text-on-surface-variant">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-md bg-primary/10 px-2 py-1 font-mono text-xs text-primary">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-on-surface-variant">
                    {log.resource ? (
                      <>
                        {log.resource}
                        {log.resourceId ? ` #${log.resourceId.slice(0, 8)}…` : ''}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-on-surface-variant">{log.ip || '—'}</td>
                  <td className="max-w-xs truncate px-3 py-3 text-xs text-on-surface-variant">
                    {log.metadata ? JSON.stringify(log.metadata) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > limit && (
        <div className="flex items-center justify-between text-sm text-on-surface-variant">
          <span>
            Página {currentPage} de {totalPages} ({total} registros)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="rounded-md border border-outline-variant px-3 py-1 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
              className="rounded-md border border-outline-variant px-3 py-1 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
