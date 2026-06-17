import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../utils/api';
import { Button } from '../components/ui/Button';
import { useConfirm } from '../components/ui/ConfirmProvider';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface Ticket {
  id: string;
  title: string;
  description?: string | null;
  status: TicketStatus;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  assignedTo?: { id: string; name: string; email: string } | null;
  conversation: {
    id: string;
    status: string;
    contact: {
      id: string;
      name: string;
      phone?: string;
      email?: string;
      profilePicture?: string;
    };
    channel?: { id: string; name: string; type: string } | null;
    sector?: { id: string; name: string; color: string } | null;
    assignedTo?: { id: string; name: string } | null;
  };
}

interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
}

interface ConversationOption {
  id: string;
  contact: { name: string; phone?: string };
  channel?: { name: string } | null;
}

interface UserOption {
  id: string;
  name: string;
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  RESOLVED: 'Resolvido',
  CLOSED: 'Encerrado',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN: '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  RESOLVED: '#10b981',
  CLOSED: '#6b7280',
};

export default function Tickets() {
  const confirmModal = useConfirm();
  const [searchParams] = useSearchParams();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [conversations, setConversations] = useState<ConversationOption[]>([]);

  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'ALL'>(
    (searchParams.get('status') as TicketStatus) || 'ALL',
  );
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'ALL'>('ALL');
  const [assignedFilter, setAssignedFilter] = useState<string>('ALL');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    conversationId: searchParams.get('conversationId') || '',
    title: '',
    description: '',
    priority: 'MEDIUM' as Priority,
    assignedToId: '',
  });
  const [closeNote, setCloseNote] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (priorityFilter !== 'ALL') params.priority = priorityFilter;
      if (assignedFilter !== 'ALL') params.assignedToId = assignedFilter;
      if (search.trim()) params.search = search.trim();
      const conversationId = searchParams.get('conversationId');
      if (conversationId) params.conversationId = conversationId;

      const [listRes, statsRes] = await Promise.all([
        api.get('/api/tickets', { params }),
        api.get('/api/tickets/stats'),
      ]);
      setTickets(listRes.data?.tickets || []);
      setTotal(listRes.data?.total || 0);
      setStats(statsRes.data || null);
    } catch (error: any) {
      console.error('Erro ao carregar tickets:', error);
      alert(error.response?.data?.error || 'Erro ao carregar tickets');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, assignedFilter, search, searchParams]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    const loadAux = async () => {
      try {
        const [usersRes, convRes] = await Promise.all([
          api.get('/api/users', { params: { limit: 200 } }),
          api.get('/api/conversations', { params: { limit: 100, status: 'OPEN' } }),
        ]);
        setUsers((usersRes.data?.users || usersRes.data || []).map((u: any) => ({ id: u.id, name: u.name })));
        const convList = convRes.data?.conversations || convRes.data || [];
        setConversations(convList);
        if (searchParams.get('conversationId') && searchParams.get('create') === '1') {
          setShowCreateModal(true);
        }
      } catch (error) {
        console.error('Erro ao carregar dados auxiliares:', error);
      }
    };
    loadAux();
  }, [searchParams]);

  const refreshSelected = async (ticketId: string) => {
    try {
      const res = await api.get(`/api/tickets/${ticketId}`);
      setSelectedTicket(res.data);
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? res.data : t)));
    } catch {
      setSelectedTicket(null);
    }
  };

  const handleCreate = async () => {
    if (!createForm.conversationId || !createForm.title.trim()) {
      alert('Informe a conversa e o título do ticket');
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/tickets', {
        conversationId: createForm.conversationId,
        title: createForm.title.trim(),
        description: createForm.description.trim() || null,
        priority: createForm.priority,
        assignedToId: createForm.assignedToId || null,
      });
      setShowCreateModal(false);
      setCreateForm({ conversationId: '', title: '', description: '', priority: 'MEDIUM', assignedToId: '' });
      await fetchTickets();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao criar ticket');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (ticket: Ticket, status: TicketStatus) => {
    setSaving(true);
    try {
      if (status === 'CLOSED') {
        await api.post(`/api/tickets/${ticket.id}/close`, { resolutionNote: closeNote || null });
        setCloseNote('');
      } else {
        await api.put(`/api/tickets/${ticket.id}`, { status });
      }
      await refreshSelected(ticket.id);
      await fetchTickets();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao atualizar status');
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (ticketId: string, assignedToId: string) => {
    setSaving(true);
    try {
      await api.post(`/api/tickets/${ticketId}/assign`, {
        assignedToId: assignedToId || null,
      });
      await refreshSelected(ticketId);
      await fetchTickets();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao atribuir ticket');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ticket: Ticket) => {
    const confirmed = await confirmModal({
      title: 'Excluir ticket',
      message: `Deseja excluir o ticket "${ticket.title}"?`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    try {
      await api.delete(`/api/tickets/${ticket.id}`);
      setSelectedTicket(null);
      await fetchTickets();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao excluir ticket');
    }
  };

  const filteredCountLabel = useMemo(() => {
    if (total === tickets.length) return `${total} ticket(s)`;
    return `${tickets.length} de ${total} ticket(s)`;
  }, [tickets.length, total]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Tickets</h1>
          <p className="text-sm text-on-surface-variant">
            Gestão nativa de tickets vinculados às conversas do CRM
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>+ Novo ticket</Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: 'Total', value: stats.total, color: '#64748b' },
            { label: 'Abertos', value: stats.open, color: STATUS_COLORS.OPEN },
            { label: 'Em andamento', value: stats.inProgress, color: STATUS_COLORS.IN_PROGRESS },
            { label: 'Resolvidos', value: stats.resolved, color: STATUS_COLORS.RESOLVED },
            { label: 'Encerrados', value: stats.closed, color: STATUS_COLORS.CLOSED },
          ].map((item) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-primary/10 bg-surface-container p-4"
            >
              <p className="text-xs text-on-surface-variant">{item.label}</p>
              <p className="text-2xl font-bold" style={{ color: item.color }}>
                {item.value}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 rounded-xl border border-primary/10 bg-surface-container p-3">
        <input
          type="text"
          placeholder="Buscar por título, contato ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[220px] flex-1 rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TicketStatus | 'ALL')}
          className="rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm"
        >
          <option value="ALL">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as Priority | 'ALL')}
          className="rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm"
        >
          <option value="ALL">Todas prioridades</option>
          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value)}
          className="rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm"
        >
          <option value="ALL">Todos responsáveis</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={fetchTickets}>
          Atualizar
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-primary/10 bg-surface-container">
          <div className="border-b border-primary/10 px-4 py-2 text-xs text-on-surface-variant">
            {filteredCountLabel}
          </div>
          {loading ? (
            <p className="p-6 text-sm text-on-surface-variant">Carregando tickets...</p>
          ) : tickets.length === 0 ? (
            <p className="p-6 text-sm text-on-surface-variant">Nenhum ticket encontrado.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface-container-high text-xs uppercase text-on-surface-variant">
                <tr>
                  <th className="px-4 py-3">Ticket</th>
                  <th className="px-4 py-3">Contato</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`cursor-pointer border-t border-primary/5 hover:bg-surface-container-high ${
                      selectedTicket?.id === ticket.id ? 'bg-primary/10' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium">{ticket.title}</td>
                    <td className="px-4 py-3">
                      <div>{ticket.conversation.contact.name}</div>
                      <div className="text-xs text-on-surface-variant">
                        {ticket.conversation.contact.phone || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2 py-1 text-xs font-semibold text-white"
                        style={{ backgroundColor: STATUS_COLORS[ticket.status] }}
                      >
                        {STATUS_LABELS[ticket.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">{PRIORITY_LABELS[ticket.priority]}</td>
                    <td className="px-4 py-3">{ticket.assignedTo?.name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">
                      {new Date(ticket.updatedAt).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selectedTicket && (
          <motion.aside
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-primary/10 bg-surface-container md:w-96"
          >
            <div className="border-b border-primary/10 p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h2 className="text-lg font-semibold">{selectedTicket.title}</h2>
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="text-on-surface-variant hover:text-on-surface"
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className="rounded-full px-2 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: STATUS_COLORS[selectedTicket.status] }}
                >
                  {STATUS_LABELS[selectedTicket.status]}
                </span>
                <span className="rounded-full bg-surface-container-high px-2 py-1 text-xs">
                  {PRIORITY_LABELS[selectedTicket.priority]}
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-auto p-4 text-sm">
              {selectedTicket.description && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-on-surface-variant">Descrição</p>
                  <p className="whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>
              )}

              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-on-surface-variant">Contato</p>
                <p className="font-medium">{selectedTicket.conversation.contact.name}</p>
                <p className="text-on-surface-variant">
                  {selectedTicket.conversation.contact.phone || selectedTicket.conversation.contact.email || '—'}
                </p>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-on-surface-variant">Conversa / Canal</p>
                <p>{selectedTicket.conversation.channel?.name || '—'}</p>
                {selectedTicket.conversation.sector && (
                  <p className="text-xs text-on-surface-variant">
                    Setor: {selectedTicket.conversation.sector.name}
                  </p>
                )}
                <Link
                  to={`/conversations/${selectedTicket.conversation.id}`}
                  className="mt-1 inline-block text-xs font-semibold text-primary hover:underline"
                >
                  Abrir conversa →
                </Link>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-on-surface-variant">Responsável</p>
                <select
                  value={selectedTicket.assignedTo?.id || ''}
                  onChange={(e) => handleAssign(selectedTicket.id, e.target.value)}
                  disabled={saving}
                  className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm"
                >
                  <option value="">Sem responsável</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-on-surface-variant">Ações</p>
                <div className="flex flex-wrap gap-2">
                  {selectedTicket.status === 'OPEN' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={saving}
                      onClick={() => handleStatusChange(selectedTicket, 'IN_PROGRESS')}
                    >
                      Iniciar
                    </Button>
                  )}
                  {['OPEN', 'IN_PROGRESS'].includes(selectedTicket.status) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={saving}
                      onClick={() => handleStatusChange(selectedTicket, 'RESOLVED')}
                    >
                      Resolver
                    </Button>
                  )}
                  {selectedTicket.status !== 'CLOSED' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={saving}
                      onClick={() => handleStatusChange(selectedTicket, 'CLOSED')}
                    >
                      Encerrar
                    </Button>
                  )}
                  {['CLOSED', 'RESOLVED'].includes(selectedTicket.status) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={saving}
                      onClick={async () => {
                        setSaving(true);
                        try {
                          await api.post(`/api/tickets/${selectedTicket.id}/reopen`);
                          await refreshSelected(selectedTicket.id);
                          await fetchTickets();
                        } catch (error: any) {
                          alert(error.response?.data?.error || 'Erro ao reabrir');
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      Reabrir
                    </Button>
                  )}
                </div>
                {selectedTicket.status !== 'CLOSED' && (
                  <textarea
                    value={closeNote}
                    onChange={(e) => setCloseNote(e.target.value)}
                    placeholder="Nota de encerramento (opcional)"
                    className="mt-2 w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm"
                    rows={2}
                  />
                )}
              </div>

              <div className="text-xs text-on-surface-variant">
                <p>Criado: {new Date(selectedTicket.createdAt).toLocaleString('pt-BR')}</p>
                {selectedTicket.closedAt && (
                  <p>Encerrado: {new Date(selectedTicket.closedAt).toLocaleString('pt-BR')}</p>
                )}
              </div>
            </div>

            <div className="border-t border-primary/10 p-4">
              <Button
                variant="secondary"
                className="w-full text-red-400"
                onClick={() => handleDelete(selectedTicket)}
              >
                Excluir ticket
              </Button>
            </div>
          </motion.aside>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-primary/10 bg-surface-container p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Novo ticket</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">Conversa *</label>
                <select
                  value={createForm.conversationId}
                  onChange={(e) => setCreateForm({ ...createForm, conversationId: e.target.value })}
                  className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm"
                >
                  <option value="">Selecione uma conversa</option>
                  {conversations.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contact.name} — {c.channel?.name || 'Canal'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">Título *</label>
                <input
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm"
                  placeholder="Ex: Problema com pedido #1234"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">Descrição</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-on-surface-variant">Prioridade</label>
                  <select
                    value={createForm.priority}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, priority: e.target.value as Priority })
                    }
                    className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm"
                  >
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-on-surface-variant">Responsável</label>
                  <select
                    value={createForm.assignedToId}
                    onChange={(e) => setCreateForm({ ...createForm, assignedToId: e.target.value })}
                    className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm"
                  >
                    <option value="">Nenhum</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? 'Salvando...' : 'Criar ticket'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
