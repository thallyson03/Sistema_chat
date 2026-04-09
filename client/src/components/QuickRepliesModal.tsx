import { useEffect, useState } from 'react';
import api from '../utils/api';

interface QuickReply {
  id: string;
  name: string;
  shortcut?: string;
  content: string;
  type: string;
  mediaUrl?: string;
  category?: string;
  isGlobal: boolean;
  previewContent?: string;
  isTemplate?: boolean;
  templateName?: string;
  templateLanguage?: string;
}

interface WhatsappTemplate {
  id?: string;
  name: string;
  language: string;
  category: string;
  status?: string;
  body?: string;
}

interface QuickRepliesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (quickReply: QuickReply) => void;
  contactId?: string;
  conversationId?: string;
  channelId?: string;
}

export default function QuickRepliesModal({
  isOpen,
  onClose,
  onSelect,
  contactId,
  conversationId,
  channelId,
}: QuickRepliesModalProps) {
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchQuickReplies();
      fetchCategories();
      if (channelId) {
        fetchTemplates(channelId);
      } else {
        setTemplates([]);
      }
    }
  }, [isOpen, selectedCategory, channelId]);

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

  const fetchTemplates = async (channelIdValue: string) => {
    try {
      setLoadingTemplates(true);
      const response = await api.get('/api/whatsapp/templates', {
        params: {
          limit: 100,
          channelId: channelIdValue,
        },
      });

      const items = response.data?.data || [];
      const mapped: WhatsappTemplate[] = items.map((item: any) => {
        const bodyComponent =
          (item.components || []).find((c: any) => c.type === 'BODY') || null;
        return {
          id: item.id,
          name: item.name,
          language: item.language,
          category: item.category,
          status: item.status,
          body: bodyComponent?.text || '',
        };
      });

      setTemplates(mapped);
    } catch (error) {
      console.error('Erro ao carregar templates WhatsApp:', error);
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
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

  const handleSelect = async (quickReply: QuickReply) => {
    // Se tiver contactId ou conversationId, buscar preview com variáveis substituídas
    if (contactId || conversationId) {
      try {
        const params = new URLSearchParams();
        if (contactId) params.append('contactId', contactId);
        if (conversationId) params.append('conversationId', conversationId);

        const response = await api.get(`/api/quick-replies/${quickReply.id}/preview?${params.toString()}`);
        onSelect(response.data);
      } catch (error) {
        console.error('Erro ao gerar preview:', error);
        onSelect(quickReply);
      }
    } else {
      onSelect(quickReply);
    }
    onClose();
  };

  const handleSelectTemplate = (tpl: WhatsappTemplate) => {
    const syntheticQuickReply: QuickReply = {
      id: tpl.id || tpl.name,
      name: tpl.name,
      content: tpl.body || '',
      type: 'TEXT',
      mediaUrl: undefined,
      category: tpl.category,
      isGlobal: true,
      previewContent: tpl.body || '',
      isTemplate: true,
      templateName: tpl.name,
      templateLanguage: tpl.language,
    };

    onSelect(syntheticQuickReply);
    onClose();
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-[90%] max-w-[640px] flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-highest text-on-surface shadow-forest-glow"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
          <h2 className="m-0 font-headline text-xl font-bold text-primary-fixed-dim">Respostas Rápidas</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-0 text-2xl leading-none text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface"
          >
            ×
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2.5 border-b border-outline-variant px-5 py-4">
          <input
            type="text"
            placeholder="Buscar respostas rápidas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="min-w-[200px] flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          {categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="cursor-pointer rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
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
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="p-10 text-center text-on-surface-variant">
              Carregando...
            </div>
          ) : filteredQuickReplies.length === 0 ? (
            <div className="p-10 text-center text-on-surface-variant">
              <p>Nenhuma resposta rápida encontrada.</p>
              {searchTerm && <p className="mt-2 text-sm">Tente buscar com outros termos.</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredQuickReplies.map((qr) => (
                <div
                  key={qr.id}
                  onClick={() => handleSelect(qr)}
                  className="cursor-pointer rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 transition-colors hover:border-primary/35 hover:bg-surface-container"
                >
                  <div className="mb-1.5 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-[15px] font-semibold text-primary-fixed-dim">{qr.name}</span>
                        {qr.isGlobal && (
                          <span className="rounded-md bg-primary/20 px-1.5 py-0.5 text-[11px] font-semibold text-primary-fixed-dim">
                            Global
                          </span>
                        )}
                        {qr.category && (
                          <span className="rounded-md bg-surface-container-highest px-1.5 py-0.5 text-[11px] text-on-surface-variant">
                            {qr.category}
                          </span>
                        )}
                      </div>
                      {qr.shortcut && (
                        <div className="mb-1 text-xs text-on-surface-variant" style={{ fontFamily: 'monospace' }}>
                          Atalho: <span className="font-semibold text-primary-fixed-dim">{qr.shortcut}</span>
                        </div>
                      )}
                    </div>
                    {qr.type !== 'TEXT' && (
                      <span className="whitespace-nowrap rounded-md bg-surface-container-highest px-2 py-1 text-[11px] text-on-surface-variant">
                        {qr.type}
                      </span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-on-surface">
                    {qr.previewContent || qr.content}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Templates WhatsApp Official (quando canalId for fornecido) */}
          {channelId && (
            <div className="mt-4 border-t border-outline-variant pt-3">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-primary-fixed-dim">
                Templates WhatsApp
                <span className="text-[11px] font-medium text-on-surface-variant">
                  (usados para iniciar conversa fora da janela de 24h)
                </span>
              </h3>

              {loadingTemplates ? (
                <div className="p-5 text-center text-[13px] text-on-surface-variant">
                  Carregando templates...
                </div>
              ) : templates.length === 0 ? (
                <div className="p-2.5 text-center text-xs text-on-surface-variant">
                  Nenhum template encontrado para este canal.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id || `${tpl.name}-${tpl.language}`}
                      onClick={() => handleSelectTemplate(tpl)}
                      className="cursor-pointer rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 transition-colors hover:border-primary/35 hover:bg-surface-container"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-on-surface">{tpl.name}</span>
                          <span className="rounded-full bg-surface-container-highest px-1.5 py-0.5 text-[11px] text-on-surface-variant">
                            {tpl.language}
                          </span>
                        </div>
                        {tpl.status && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                              tpl.status === 'APPROVED'
                                ? 'bg-emerald-900/40 text-primary-fixed-dim'
                                : tpl.status === 'REJECTED'
                                ? 'bg-red-900/40 text-red-300'
                                : 'bg-amber-900/40 text-amber-200'
                            }`}
                          >
                            {tpl.status}
                          </span>
                        )}
                      </div>
                      {tpl.body && (
                        <p
                          className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-on-surface-variant"
                          title={tpl.body}
                        >
                          {tpl.body}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

