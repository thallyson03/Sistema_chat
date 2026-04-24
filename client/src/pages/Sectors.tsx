import { useEffect, useState } from 'react';
import api from '../utils/api';
import { useConfirm } from '../components/ui/ConfirmProvider';

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
  const confirmModal = useConfirm();
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
    const confirmed = await confirmModal({
      title: 'Excluir setor',
      message: 'Tem certeza que deseja deletar este setor?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
    });
    if (!confirmed) {
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
    <div className="mx-auto max-w-7xl p-8 font-body text-on-surface">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-headline text-3xl font-bold text-on-surface">Setores</h1>
          <p className="text-sm text-on-surface-variant">
            Organize times, filas e canais por áreas da sua empresa.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="primary-gradient-channel inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold text-[#003919] shadow-emerald-send transition hover:brightness-105"
        >
          + Novo setor
        </button>
      </div>

      {/* Busca */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3">
        <div className="relative w-full max-w-[28rem]">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-on-surface-variant">
            🔍
          </span>
          <input
            type="text"
            placeholder="Buscar por nome ou descrição..."
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

      {/* Lista de Setores */}
      {loading ? (
        <div className="flex justify-center py-16 text-sm text-on-surface-variant">
          Carregando setores...
        </div>
      ) : filteredSectors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
          <p className="text-sm mb-4">Nenhum setor encontrado.</p>
          <button
            onClick={handleCreate}
            className="primary-gradient-channel inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold text-[#003919] shadow-emerald-send transition hover:brightness-105"
          >
            Criar primeiro setor
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredSectors.map((sector) => (
            <div
              key={sector.id}
              className="group relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low shadow-forest-glow transition hover:border-primary/35"
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
                      <h3 className="text-sm font-semibold text-on-surface">
                        {sector.name}
                      </h3>
                      <p className="text-[11px] uppercase tracking-wide text-on-surface-variant">
                        Setor operacional
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      sector.isActive
                        ? 'bg-primary/20 text-primary-fixed-dim border border-primary/25'
                        : 'bg-on-surface-variant/20 text-on-surface-variant border border-on-surface-variant/25'
                    }`}
                  >
                    <span className="mr-1 text-[8px]">
                      {sector.isActive ? '●' : '○'}
                    </span>
                    {sector.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {sector.description && (
                  <p className="mb-3 line-clamp-3 text-xs text-on-surface-variant">
                    {sector.description}
                  </p>
                )}

                <div className="mt-auto">
                  <div className="mb-3 flex gap-4 text-[11px] text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <span className="text-primary/70">📡</span>
                      <span className="font-semibold text-primary-fixed-dim">
                        {sector._count?.channels || 0}
                      </span>
                      <span>canais</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-primary/70">👤</span>
                      <span className="font-semibold text-primary-fixed-dim">
                        {sector._count?.users || 0}
                      </span>
                      <span>usuários</span>
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(sector)}
                      className="flex-1 inline-flex items-center justify-center rounded-md border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary-fixed-dim transition hover:bg-primary/20"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(sector.id)}
                      className="inline-flex items-center justify-center rounded-md border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="relative w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-highest p-6 shadow-forest-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-on-surface">
                  {editingSector ? 'Editar setor' : 'Novo setor'}
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Defina nome, cor e status para organizar seus canais e usuários.
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
                  placeholder="Ex: Vendas, Suporte, Financeiro"
                  required
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">
                  Descrição (opcional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva o propósito deste setor"
                  rows={3}
                  className="w-full resize-y rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">
                  Cor
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-outline-variant bg-surface-container-low"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#3B82F6"
                    className="flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm font-mono text-on-surface outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
                  />
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

