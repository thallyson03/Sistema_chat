import { useEffect, useState } from 'react';
import api from '../utils/api';

interface Sector {
  id: string;
  name: string;
  description?: string;
  color: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    channels: number;
    users: number;
  };
}

export default function Sectors() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    isActive: true,
  });

  useEffect(() => {
    fetchSectors();
  }, []);

  const fetchSectors = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/sectors?includeInactive=true');
      setSectors(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingSector(null);
    setFormData({
      name: '',
      description: '',
      color: '#3B82F6',
      isActive: true,
    });
    setShowModal(true);
  };

  const handleEdit = (sector: Sector) => {
    setEditingSector(sector);
    setFormData({
      name: sector.name,
      description: sector.description || '',
      color: sector.color,
      isActive: sector.isActive,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este setor?')) {
      return;
    }

    try {
      await api.delete(`/api/sectors/${id}`);
      await fetchSectors();
    } catch (error: any) {
      console.error('Erro ao deletar setor:', error);
      alert(error.response?.data?.error || 'Erro ao deletar setor');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      alert('Nome é obrigatório');
      return;
    }

    try {
      if (editingSector) {
        await api.put(`/api/sectors/${editingSector.id}`, formData);
      } else {
        await api.post('/api/sectors', formData);
      }

      setShowModal(false);
      await fetchSectors();
    } catch (error: any) {
      console.error('Erro ao salvar setor:', error);
      alert(error.response?.data?.error || 'Erro ao salvar setor');
    }
  };

  const filteredSectors = sectors.filter((s) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return s.name.toLowerCase().includes(search) || s.description?.toLowerCase().includes(search);
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Setores</h1>
          <p className="text-sm text-slate-500">
            Organize times, filas e canais por áreas da sua empresa.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 px-5 py-2 text-sm font-semibold text-slate-950 shadow-md hover:shadow-lg hover:brightness-105 transition"
        >
          + Novo Setor
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
            placeholder="Buscar por nome ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-full border border-slate-200 bg-white/80 pl-9 pr-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none transition"
          />
        </div>
      </div>

      {/* Lista de Setores */}
      {loading ? (
        <div className="flex justify-center py-16 text-slate-500 text-sm">
          Carregando setores...
        </div>
      ) : filteredSectors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <p className="text-sm mb-4">Nenhum setor encontrado.</p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-slate-800 transition"
          >
            Criar primeiro setor
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredSectors.map((sector) => (
            <div
              key={sector.id}
              className="group relative rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition card-hover overflow-hidden"
            >
              <div
                className="h-1.5 w-full bg-gradient-to-r"
                style={{ backgroundImage: `linear-gradient(to right, ${sector.color}, #0f172a)` }}
              />
              <div className="p-5 flex flex-col h-full">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-8 w-8 rounded-xl shadow-sm"
                      style={{ backgroundColor: sector.color }}
                    />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {sector.name}
                      </h3>
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Setor operacional
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      sector.isActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}
                  >
                    <span className="mr-1 text-[8px]">
                      {sector.isActive ? '●' : '○'}
                    </span>
                    {sector.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {sector.description && (
                  <p className="text-xs text-slate-600 mb-3 line-clamp-3">
                    {sector.description}
                  </p>
                )}

                <div className="mt-auto">
                  <div className="flex gap-4 text-[11px] text-slate-500 mb-3">
                    <span className="flex items-center gap-1">
                      <span className="text-slate-400">📡</span>
                      <span className="font-semibold text-slate-700">
                        {sector._count?.channels || 0}
                      </span>
                      <span>canais</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-slate-400">👤</span>
                      <span className="font-semibold text-slate-700">
                        {sector._count?.users || 0}
                      </span>
                      <span>usuários</span>
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(sector)}
                      className="flex-1 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(sector.id)}
                      className="inline-flex items-center justify-center rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                    >
                      Remover
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
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingSector ? 'Editar setor' : 'Novo setor'}
                </h2>
                <p className="text-xs text-slate-500">
                  Defina nome, cor e status para organizar seus canais e usuários.
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
                  placeholder="Ex: Vendas, Suporte, Financeiro"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descrição (opcional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva o propósito deste setor"
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cor
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="h-10 w-14 rounded-lg border border-slate-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#3B82F6"
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                  />
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
                  {editingSector ? 'Salvar alterações' : 'Criar setor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

