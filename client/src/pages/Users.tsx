import { useEffect, useState } from 'react';
import api from '../utils/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  sectors?: Array<{
    sector: {
      id: string;
      name: string;
      color: string;
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

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
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
    isActive: true,
  });

  useEffect(() => {
    fetchUsers();
    fetchSectors();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/users?includeInactive=true');
      setUsers(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSectors = async () => {
    try {
      const response = await api.get('/api/sectors');
      setSectors(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
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
      isActive: user.isActive,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este usuário?')) {
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
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
          <p className="text-sm text-slate-500">
            Gerencie os usuários da equipe, suas funções e setores de atendimento.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 px-5 py-2 text-sm font-semibold text-slate-950 shadow-md hover:shadow-lg hover:brightness-105 transition"
        >
          + Novo Usuário
        </button>
      </div>

      {/* Busca */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou função..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-full border border-slate-200 bg-white/80 pl-9 pr-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none transition"
          />
        </div>
      </div>

      {/* Lista de Usuários */}
      {loading ? (
        <div className="flex justify-center py-16 text-slate-500 text-sm">
          Carregando usuários...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <p className="text-sm mb-4">Nenhum usuário encontrado.</p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-slate-800 transition"
          >
            Criar primeiro usuário
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="group relative rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition card-hover overflow-hidden"
            >
              <div className="p-5 flex flex-col h-full">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {user.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 break-all">
                      {user.email}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white ${
                          user.role === 'ADMIN'
                            ? 'bg-rose-500'
                            : user.role === 'SUPERVISOR'
                            ? 'bg-amber-500'
                            : 'bg-sky-500'
                        }`}
                      >
                        {user.role}
                      </span>
                      {!user.isActive && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                          Inativo
                        </span>
                      )}
                    </div>

                    {user.sectors && user.sectors.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[11px] text-slate-500 mb-1">
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

                    <div className="flex gap-4 mt-3 text-[11px] text-slate-500">
                      <span>
                        <span className="font-semibold text-slate-700">
                          {user._count?.assignedConversations || 0}
                        </span>{' '}
                        conversas
                      </span>
                      <span>
                        <span className="font-semibold text-slate-700">
                          {user._count?.assignedTickets || 0}
                        </span>{' '}
                        tickets
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="inline-flex items-center justify-center rounded-full bg-red-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-600 transition"
                    >
                      Deletar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Criar/Editar */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-white shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingUser ? 'Editar usuário' : 'Novo usuário'}
                </h2>
                <p className="text-xs text-slate-500">
                  Defina dados de acesso, função e setores em que o usuário poderá atuar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: João Silva"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="exemplo@email.com"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                />
                {editingUser && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Deixe em branco para manter a senha atual.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Função
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                >
                  <option value="AGENT">Agente</option>
                  <option value="SUPERVISOR">Supervisor</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Setores que pode atender
                </label>
                <div className="border border-slate-200 rounded-lg p-2.5 max-h-56 overflow-y-auto space-y-1">
                  {sectors.length === 0 ? (
                    <p className="text-xs text-slate-500 m-0">
                      Nenhum setor cadastrado. Crie setores primeiro.
                    </p>
                  ) : (
                    sectors.map((sector) => (
                      <label
                        key={sector.id}
                        className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-slate-50 text-xs text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={formData.sectorIds.includes(sector.id)}
                          onChange={() => handleToggleSector(sector.id)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/60"
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
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/60"
                  />
                  <span className="font-semibold">Ativo</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-slate-900 px-5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
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

