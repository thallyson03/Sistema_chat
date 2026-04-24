import { useEffect, useState } from 'react';
import api from '../utils/api';
import { useConfirm } from '../components/ui/ConfirmProvider';

interface QuickReply {
  id: string;
  name: string;
  shortcut?: string;
  content: string;
  type: string;
  mediaUrl?: string;
  category?: string;
  isGlobal: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function QuickReplies() {
  const confirmModal = useConfirm();
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingQuickReply, setEditingQuickReply] = useState<QuickReply | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    shortcut: '',
    content: '',
    type: 'TEXT',
    mediaUrl: '',
    category: '',
    isGlobal: false,
  });

  useEffect(() => {
    fetchQuickReplies();
    fetchCategories();
  }, [selectedCategory]);

  const fetchQuickReplies = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory) {
        params.append('category', selectedCategory);
      }

      const response = await api.get(`/api/quick-replies?${params.toString()}`);
      setQuickReplies(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar respostas rápidas:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/api/quick-replies/categories');
      setCategories(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  };

  const handleCreate = () => {
    setEditingQuickReply(null);
    setFormData({
      name: '',
      shortcut: '',
      content: '',
      type: 'TEXT',
      mediaUrl: '',
      category: '',
      isGlobal: false,
    });
    setShowModal(true);
  };

  const handleEdit = (quickReply: QuickReply) => {
    setEditingQuickReply(quickReply);
    setFormData({
      name: quickReply.name,
      shortcut: quickReply.shortcut || '',
      content: quickReply.content,
      type: quickReply.type,
      mediaUrl: quickReply.mediaUrl || '',
      category: quickReply.category || '',
      isGlobal: quickReply.isGlobal,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmModal({
      title: 'Excluir resposta rápida',
      message: 'Tem certeza que deseja deletar esta resposta rápida?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
    });
    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/api/quick-replies/${id}`);
      await fetchQuickReplies();
    } catch (error: any) {
      console.error('Erro ao deletar resposta rápida:', error);
      alert(error.response?.data?.error || 'Erro ao deletar resposta rápida');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.content) {
      alert('Nome e conteúdo são obrigatórios');
      return;
    }

    try {
      if (editingQuickReply) {
        await api.put(`/api/quick-replies/${editingQuickReply.id}`, formData);
      } else {
        await api.post('/api/quick-replies', formData);
      }

      setShowModal(false);
      await fetchQuickReplies();
    } catch (error: any) {
      console.error('Erro ao salvar resposta rápida:', error);
      alert(error.response?.data?.error || 'Erro ao salvar resposta rápida');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await api.post('/api/media/upload', formDataUpload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setFormData((prev) => ({
        ...prev,
        mediaUrl: response.data.url,
        type: response.data.mimetype.startsWith('image/')
          ? 'IMAGE'
          : response.data.mimetype.startsWith('video/')
          ? 'VIDEO'
          : response.data.mimetype.startsWith('audio/')
          ? 'AUDIO'
          : 'DOCUMENT',
      }));
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      alert('Erro ao fazer upload do arquivo');
    }
  };

  const filteredQuickReplies = quickReplies.filter((qr) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      qr.name.toLowerCase().includes(search) ||
      qr.content.toLowerCase().includes(search) ||
      qr.shortcut?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="font-body text-on-surface">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary/60">
            Messaging Assets
          </p>
          <h1 className="m-0 font-headline text-2xl font-bold text-on-surface">
            Templates & Respostas Rápidas
          </h1>
        </div>
        <button
          onClick={handleCreate}
          className="primary-gradient-channel rounded-lg px-4 py-2.5 text-sm font-bold text-[#003919] shadow-emerald-send transition hover:brightness-110"
        >
          + Nova Resposta Rápida
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-5 flex flex-wrap gap-2.5 rounded-xl border border-outline-variant bg-surface-container-low p-3">
        <input
          type="text"
          placeholder="Buscar respostas rápidas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="min-w-[220px] flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        {categories.length > 0 && (
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="cursor-pointer rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            <option value="">Todas as categorias</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Lista de Respostas Rápidas */}
      {loading ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low py-12 text-center text-on-surface-variant">
          Carregando...
        </div>
      ) : filteredQuickReplies.length === 0 ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low py-12 text-center text-on-surface-variant">
          <p>Nenhuma resposta rápida encontrada.</p>
          <button
            onClick={handleCreate}
            className="primary-gradient-channel mt-5 rounded-lg px-4 py-2 text-sm font-bold text-[#003919] shadow-emerald-send transition hover:brightness-110"
          >
            Criar primeira resposta rápida
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {filteredQuickReplies.map((qr) => (
            <div
              key={qr.id}
              className="rounded-xl border border-outline-variant bg-surface-container-low p-4 shadow-forest-glow transition-colors hover:border-primary/30"
            >
              <div className="mb-2.5 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="m-0 text-base font-semibold text-primary-fixed-dim">{qr.name}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {qr.isGlobal && (
                      <span className="rounded-md bg-primary/20 px-2 py-0.5 text-[11px] font-semibold text-primary-fixed-dim">
                        Global
                      </span>
                    )}
                    {qr.category && (
                      <span className="rounded-md bg-surface-container-highest px-2 py-0.5 text-[11px] text-on-surface-variant">
                        {qr.category}
                      </span>
                    )}
                    {qr.type !== 'TEXT' && (
                      <span className="rounded-md bg-surface-container-highest px-2 py-0.5 text-[11px] text-on-surface-variant">
                        {qr.type}
                      </span>
                    )}
                  </div>
                  {qr.shortcut && (
                    <div className="mt-1.5 text-xs text-on-surface-variant" style={{ fontFamily: 'monospace' }}>
                      Atalho: <strong className="text-primary-fixed-dim">{qr.shortcut}</strong>
                    </div>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleEdit(qr)}
                    className="rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary-fixed-dim transition hover:bg-primary/20"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(qr.id)}
                    className="rounded-md border border-red-500/25 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
                  >
                    Deletar
                  </button>
                </div>
              </div>
              <div
                className="mt-2.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-on-surface"
                style={{ maxHeight: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {qr.content}
              </div>
              {qr.mediaUrl && <div className="mt-2.5 text-xs text-primary/75">📎 Mídia anexada</div>}
            </div>
          ))}
        </div>
      )}

      {/* Modal de Criar/Editar */}
      {showModal && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-[90%] max-w-[600px] max-h-[90vh] overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-highest p-6 text-on-surface shadow-forest-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-5 mt-0 font-headline text-lg font-bold">
              {editingQuickReply ? 'Editar Resposta Rápida' : 'Nova Resposta Rápida'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-semibold text-on-surface">
                  Nome <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Boas-vindas"
                  required
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>

              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-semibold text-on-surface">
                  Atalho (opcional)
                </label>
                <input
                  type="text"
                  value={formData.shortcut}
                  onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
                  placeholder="Ex: /boasvindas"
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  style={{ fontFamily: 'monospace' }}
                />
                <small className="mt-1.5 block text-xs text-on-surface-variant">
                  Use este atalho para buscar rapidamente a resposta
                </small>
              </div>

              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-semibold text-on-surface">
                  Categoria (opcional)
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Ex: Vendas, Suporte, Geral"
                  list="categories"
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                <datalist id="categories">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-semibold text-on-surface">Tipo</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full cursor-pointer rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                >
                  <option value="TEXT">Texto</option>
                  <option value="IMAGE">Imagem</option>
                  <option value="VIDEO">Vídeo</option>
                  <option value="AUDIO">Áudio</option>
                  <option value="DOCUMENT">Documento</option>
                </select>
              </div>

              {formData.type !== 'TEXT' && (
                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-semibold text-on-surface">
                    Upload de Mídia
                  </label>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    accept={
                      formData.type === 'IMAGE'
                        ? 'image/*'
                        : formData.type === 'VIDEO'
                        ? 'video/*'
                        : formData.type === 'AUDIO'
                        ? 'audio/*'
                        : '.pdf,.doc,.docx,.xls,.xlsx'
                    }
                    className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface file:mr-3 file:rounded-md file:border-0 file:bg-primary/15 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-fixed-dim hover:file:bg-primary/25"
                  />
                  {formData.mediaUrl && (
                    <small className="mt-1.5 block text-xs text-primary-fixed-dim">
                      ✅ Arquivo carregado: {formData.mediaUrl}
                    </small>
                  )}
                </div>
              )}

              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-semibold text-on-surface">
                  Conteúdo <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Digite a mensagem... Use {{nome}}, {{telefone}}, {{email}}, {{canal}} para variáveis dinâmicas"
                  required
                  rows={6}
                  className="w-full resize-y rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                <small className="mt-1.5 block text-xs text-on-surface-variant">
                  💡 Variáveis disponíveis: <code>{'{{nome}}'}</code>, <code>{'{{telefone}}'}</code>,{' '}
                  <code>{'{{email}}'}</code>, <code>{'{{canal}}'}</code>
                </small>
              </div>

              <div className="mb-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isGlobal}
                    onChange={(e) => setFormData({ ...formData, isGlobal: e.target.checked })}
                    className="h-4 w-4 rounded border-outline-variant bg-surface-container-lowest text-primary focus:ring-primary/40"
                  />
                  <span className="text-sm font-semibold text-on-surface">
                    Resposta global (disponível para todos os usuários)
                  </span>
                </label>
                <small className="ml-7 mt-1.5 block text-xs text-on-surface-variant">
                  Apenas administradores e supervisores podem criar respostas globais
                </small>
              </div>

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-outline-variant bg-surface-container-low px-5 py-2.5 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-gradient-channel rounded-lg px-5 py-2.5 text-sm font-bold text-[#003919] shadow-emerald-send transition hover:brightness-110"
                >
                  {editingQuickReply ? 'Salvar Alterações' : 'Criar Resposta Rápida'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

