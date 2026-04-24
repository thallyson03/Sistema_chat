import { useEffect, useState } from 'react';
import api from '../utils/api';
import { useConfirm } from '../components/ui/ConfirmProvider';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastActiveAt?: string | null;
  /** Presença no sistema: atividade nos últimos 5 min (mesma regra da distribuição de filas). */
  isOnline?: boolean;
  presenceSummary?: string;
  isPaused?: boolean;
  pauseReason?: string | null;
  pausedUntil?: string | null;
  sectors?: Array<{
    sector: {
      id: string;
      name: string;
      color: string;
    };
  }>;
  pipelineAccesses?: Array<{
    pipeline: {
      id: string;
      name: string;
    };
  }>;
  channelAccesses?: Array<{
    channel: {
      id: string;
      name: string;
      type: string;
    };
  }>;
  _count?: {
    assignedConversations: number;
    assignedTickets: number;
  };
}

interface Sector {
  id: string;
  name: string;
  color: string;
}

interface Pipeline {
  id: string;
  name: string;
}

interface Channel {
  id: string;
  name: string;
  type: string;
}

/** Indicador visual + textos: pausa tem prioridade sobre “online” na fila. */
function getPresenceDisplay(user: User) {
  if (user.isPaused) {
    const reason = user.pauseReason?.trim();
    const until = user.pausedUntil
      ? new Date(user.pausedUntil).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
      : null;
    return {
      dotClass: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.55)]',
      title: reason
        ? `Em pausa: ${reason}${until ? ` · até ${until}` : ''}`
        : `Em pausa — não entra na distribuição de conversas${until ? ` · até ${until}` : ''}`,
      primary: user.isOnline ? 'Conectado · em pausa' : 'Em pausa',
      secondary:
        reason ||
        (user.isOnline
          ? 'Indisponível na fila (botão Pausar no menu)'
          : user.presenceSummary && user.presenceSummary !== 'Sem registro no sistema'
            ? user.presenceSummary
            : 'Sem atividade nos últimos 5 min ou deslogado'),
    };
  }
  if (user.isOnline) {
    return {
      dotClass: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.65)]',
      title: 'No sistema agora — atividade nos últimos 5 minutos',
      primary: user.presenceSummary || 'No sistema agora',
      secondary: null as string | null,
    };
  }
  return {
    dotClass: 'bg-on-surface-variant/35',
    title:
      user.presenceSummary ||
      'Fora do sistema (sem atividade recente, deslogado ou nunca acessou)',
    primary: user.presenceSummary || 'Sem registro no sistema',
    secondary: null as string | null,
  };
}

export default function Users() {
  const confirmModal = useConfirm();
  const [users, setUsers] = useState<User[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'AGENT',
    sectorIds: [] as string[],
    pipelineIds: [] as string[],
    channelIds: [] as string[],
    isActive: true,
  });

  useEffect(() => {
    void fetchUsers();
    fetchSectors();
    fetchPipelines();
    fetchChannels();
  }, []);

  const fetchUsers = async (opts?: { quiet?: boolean }) => {
    try {
      if (!opts?.quiet) setLoading(true);
      const response = await api.get('/api/users?includeInactive=true');
      setUsers(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  };

  useEffect(() => {
    const id = setInterval(() => {
      void fetchUsers({ quiet: true });
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const fetchSectors = async () => {
    try {
      const response = await api.get('/api/sectors');
      setSectors(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
    }
  };

  const fetchPipelines = async () => {
    try {
      const response = await api.get('/api/pipelines?includeInactive=true');
      setPipelines(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar pipelines:', error);
    }
  };

  const fetchChannels = async () => {
    try {
      const response = await api.get('/api/channels');
      setChannels(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar canais:', error);
    }
  };

  const handleCreate = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      name: '',
      role: 'AGENT',
      sectorIds: [],
      pipelineIds: [],
      channelIds: [],
      isActive: true,
    });
    setShowModal(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      name: user.name,
      role: user.role,
      sectorIds: user.sectors?.map((us) => us.sector.id) || [],
      pipelineIds: user.pipelineAccesses?.map((pa) => pa.pipeline.id) || [],
      channelIds: user.channelAccesses?.map((ca) => ca.channel.id) || [],
      isActive: user.isActive,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmModal({
      title: 'Excluir usuário',
      message: 'Tem certeza que deseja deletar este usuário?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
    });
    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/api/users/${id}`);
      await fetchUsers();
    } catch (error: any) {
      console.error('Erro ao deletar usuário:', error);
      alert(error.response?.data?.error || 'Erro ao deletar usuário');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.name) {
      alert('Email e nome são obrigatórios');
      return;
    }

    if (!editingUser && !formData.password) {
      alert('Senha é obrigatória para novos usuários');
      return;
    }

    try {
      if (editingUser) {
        await api.put(`/api/users/${editingUser.id}`, formData);
      } else {
        await api.post('/api/users', formData);
      }

      setShowModal(false);
      await fetchUsers();
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error);
      alert(error.response?.data?.error || 'Erro ao salvar usuário');
    }
  };

  const handleToggleSector = (sectorId: string) => {
    setFormData((prev) => ({
      ...prev,
      sectorIds: prev.sectorIds.includes(sectorId)
        ? prev.sectorIds.filter((id) => id !== sectorId)
        : [...prev.sectorIds, sectorId],
    }));
  };

  const handleTogglePipeline = (pipelineId: string) => {
    setFormData((prev) => ({
      ...prev,
      pipelineIds: prev.pipelineIds.includes(pipelineId)
        ? prev.pipelineIds.filter((id) => id !== pipelineId)
        : [...prev.pipelineIds, pipelineId],
    }));
  };

  const handleToggleChannel = (channelId: string) => {
    setFormData((prev) => ({
      ...prev,
      channelIds: prev.channelIds.includes(channelId)
        ? prev.channelIds.filter((id) => id !== channelId)
        : [...prev.channelIds, channelId],
    }));
  };

  const filteredUsers = users.filter((user) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      user.name.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search) ||
      user.role.toLowerCase().includes(search)
    );
  });

  return (
    <div className="mx-auto max-w-7xl p-8 font-body text-on-surface">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-headline text-3xl font-bold text-on-surface">Usuários</h1>
          <p className="text-sm text-on-surface-variant">
            Gerencie os usuários da equipe, suas funções e setores de atendimento.
          </p>
          <p className="mt-2 text-xs text-on-surface-variant/90 leading-relaxed">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
              Online
            </span>
            <span className="mx-1.5 text-on-surface-variant/40">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.55)]" />
              Pausa
            </span>
            <span className="mx-1.5 text-on-surface-variant/40">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-on-surface-variant/40" />
              Ausente
            </span>
            <br />
            <span className="text-[11px] opacity-90">
              Online = atividade nos últimos 5 min. Pausa = não entra na fila (pode estar logado). Ausente = sem
              sinal recente ou deslogado.
            </span>
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="primary-gradient-channel inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold text-[#003919] shadow-emerald-send transition hover:brightness-105"
        >
          👥 Novo Usuário
        </button>
      </div>

      {/* Busca */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3">
        <div className="relative w-full max-w-[28rem]">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-on-surface-variant text-sm">
            🔍
          </span>
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou função..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2.5 pl-9 pr-3 text-sm text-on-surface outline-none transition focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-lg border border-outline-variant bg-surface-container-highest px-3 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container">
            Filtros
          </button>
          <button className="rounded-lg border border-outline-variant bg-surface-container-highest px-3 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container">
            Exportar
          </button>
        </div>
      </div>

      {/* Lista de Usuários */}
      {loading ? (
        <div className="flex justify-center py-16 text-on-surface-variant text-sm">
          Carregando usuários...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
          <p className="text-sm mb-4">Nenhum usuário encontrado.</p>
          <button
            onClick={handleCreate}
            className="primary-gradient-channel inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold text-[#003919] shadow-emerald-send transition hover:brightness-105"
          >
            Criar primeiro usuário
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredUsers.map((user) => {
            const presence = getPresenceDisplay(user);
            return (
            <div
              key={user.id}
              className="group relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low shadow-forest-glow transition hover:border-primary/35"
            >
              <div className="p-5 flex flex-col h-full">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${presence.dotClass}`}
                        title={presence.title}
                        aria-hidden
                      />
                      <h3 className="text-sm font-semibold text-on-surface">{user.name}</h3>
                    </div>
                    <p className="mt-0.5 text-[11px] font-medium text-on-surface-variant">
                      {presence.primary}
                    </p>
                    {presence.secondary ? (
                      <p className="mt-0.5 text-[10px] text-on-surface-variant/85">{presence.secondary}</p>
                    ) : null}
                    <p className="mt-1 break-all text-xs text-on-surface-variant">
                      {user.email}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          user.role === 'ADMIN'
                            ? 'bg-red-900/40 text-red-300 border border-red-500/25'
                            : user.role === 'SUPERVISOR'
                            ? 'bg-amber-900/40 text-amber-200 border border-amber-500/25'
                            : 'bg-primary/20 text-primary-fixed-dim border border-primary/25'
                        }`}
                      >
                        {user.role}
                      </span>
                      {!user.isActive && (
                        <span className="inline-flex items-center rounded-full border border-on-surface-variant/20 bg-surface-container-highest px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
                          Inativo
                        </span>
                      )}
                      {user.isActive && (
                        <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary-fixed-dim">
                          Ativo
                        </span>
                      )}
                      {user.isActive && user.isPaused && (
                        <span className="inline-flex items-center rounded-full border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                          Em pausa
                        </span>
                      )}
                    </div>

                    {user.sectors && user.sectors.length > 0 && (
                      <div className="mt-3">
                        <div className="mb-1 text-[11px] text-on-surface-variant">
                          Setores:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {user.sectors.map((us) => (
                            <span
                              key={us.sector.id}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{
                                backgroundColor: `${us.sector.color}20`,
                                color: us.sector.color,
                              }}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: us.sector.color }}
                              />
                              {us.sector.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex gap-4 text-[11px] text-on-surface-variant">
                      <span>
                        <span className="font-semibold text-primary-fixed-dim">
                          {user._count?.assignedConversations || 0}
                        </span>{' '}
                        conversas
                      </span>
                      <span>
                        <span className="font-semibold text-primary-fixed-dim">
                          {user._count?.assignedTickets || 0}
                        </span>{' '}
                        tickets
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="inline-flex items-center justify-center rounded-md border border-primary/25 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary-fixed-dim transition hover:bg-primary/20"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="inline-flex items-center justify-center rounded-md border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-300 transition hover:bg-red-500/20"
                    >
                      Deletar
                    </button>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criar/Editar */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-highest p-6 shadow-forest-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-on-surface">
                  {editingUser ? 'Editar usuário' : 'Novo usuário'}
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Defina dados de acesso, função e setores em que o usuário poderá atuar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-low text-xs text-on-surface-variant hover:bg-surface-container"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: João Silva"
                  required
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="exemplo@email.com"
                  required
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">
                  Senha {!editingUser && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={
                    editingUser ? 'Deixe em branco para não alterar' : 'Mínimo 6 caracteres'
                  }
                  required={!editingUser}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                />
                {editingUser && (
                  <p className="mt-1 text-[11px] text-on-surface-variant">
                    Deixe em branco para manter a senha atual.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">
                  Função
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                >
                  <option value="AGENT">Agente</option>
                  <option value="SUPERVISOR">Supervisor</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">
                  Setores que pode atender
                </label>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-low p-2.5">
                  {sectors.length === 0 ? (
                    <p className="m-0 text-xs text-on-surface-variant">
                      Nenhum setor cadastrado. Crie setores primeiro.
                    </p>
                  ) : (
                    sectors.map((sector) => (
                      <label
                        key={sector.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs text-on-surface hover:bg-surface-container-highest"
                      >
                        <input
                          type="checkbox"
                          checked={formData.sectorIds.includes(sector.id)}
                          onChange={() => handleToggleSector(sector.id)}
                          className="h-4 w-4 rounded border-outline-variant bg-surface-container-lowest text-primary focus:ring-primary/50"
                        />
                        <div
                          className="h-4 w-4 rounded-md flex-shrink-0"
                          style={{ backgroundColor: sector.color }}
                        />
                        <span>{sector.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">
                  Pipelines que pode acessar
                </label>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-low p-2.5">
                  {pipelines.length === 0 ? (
                    <p className="m-0 text-xs text-on-surface-variant">Nenhum pipeline cadastrado.</p>
                  ) : (
                    pipelines.map((pipeline) => (
                      <label
                        key={pipeline.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs text-on-surface hover:bg-surface-container-highest"
                      >
                        <input
                          type="checkbox"
                          checked={formData.pipelineIds.includes(pipeline.id)}
                          onChange={() => handleTogglePipeline(pipeline.id)}
                          className="h-4 w-4 rounded border-outline-variant bg-surface-container-lowest text-primary focus:ring-primary/50"
                        />
                        <span>{pipeline.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">
                  Canais que pode acessar
                </label>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-low p-2.5">
                  {channels.length === 0 ? (
                    <p className="m-0 text-xs text-on-surface-variant">Nenhum canal cadastrado.</p>
                  ) : (
                    channels.map((channel) => (
                      <label
                        key={channel.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs text-on-surface hover:bg-surface-container-highest"
                      >
                        <input
                          type="checkbox"
                          checked={formData.channelIds.includes(channel.id)}
                          onChange={() => handleToggleChannel(channel.id)}
                          className="h-4 w-4 rounded border-outline-variant bg-surface-container-lowest text-primary focus:ring-primary/50"
                        />
                        <span>
                          {channel.name} ({channel.type})
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-on-surface">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-outline-variant bg-surface-container-lowest text-primary focus:ring-primary/50"
                  />
                  <span className="font-semibold">Ativo</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-gradient-channel rounded-lg px-5 py-2 text-xs font-semibold text-[#003919] hover:brightness-110"
                >
                  {editingUser ? 'Salvar alterações' : 'Criar usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

