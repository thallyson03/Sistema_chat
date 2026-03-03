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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Respostas Rápidas</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Filtros */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <input
            type="text"
            placeholder="Buscar respostas rápidas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '8px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '14px',
            }}
          />
          {categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
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
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px',
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              Carregando...
            </div>
          ) : filteredQuickReplies.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <p>Nenhuma resposta rápida encontrada.</p>
              {searchTerm && <p style={{ fontSize: '14px', marginTop: '8px' }}>Tente buscar com outros termos.</p>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredQuickReplies.map((qr) => (
                <div
                  key={qr.id}
                  onClick={() => handleSelect(qr)}
                  style={{
                    padding: '12px 16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: 'white',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '6px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '600', fontSize: '15px' }}>{qr.name}</span>
                        {qr.isGlobal && (
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: '#dbeafe',
                              color: '#1e40af',
                              fontSize: '11px',
                              fontWeight: '600',
                            }}
                          >
                            Global
                          </span>
                        )}
                        {qr.category && (
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: '#f3f4f6',
                              color: '#6b7280',
                              fontSize: '11px',
                            }}
                          >
                            {qr.category}
                          </span>
                        )}
                      </div>
                      {qr.shortcut && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#6b7280',
                            fontFamily: 'monospace',
                            marginBottom: '4px',
                          }}
                        >
                          Atalho: <span style={{ fontWeight: '600' }}>{qr.shortcut}</span>
                        </div>
                      )}
                    </div>
                    {qr.type !== 'TEXT' && (
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          backgroundColor: '#e5e7eb',
                          fontSize: '11px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {qr.type}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      color: '#374151',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {qr.previewContent || qr.content}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Templates WhatsApp Official (quando canalId for fornecido) */}
          {channelId && (
            <div style={{ marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
              <h3
                style={{
                  margin: '0 0 8px 0',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#111827',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                Templates WhatsApp
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#6b7280',
                  }}
                >
                  (usados para iniciar conversa fora da janela de 24h)
                </span>
              </h3>

              {loadingTemplates ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280', fontSize: '13px' }}>
                  Carregando templates...
                </div>
              ) : templates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '10px', color: '#9ca3af', fontSize: '12px' }}>
                  Nenhum template encontrado para este canal.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id || `${tpl.name}-${tpl.language}`}
                      onClick={() => handleSelectTemplate(tpl)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        cursor: 'pointer',
                        backgroundColor: '#f9fafb',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#eff6ff';
                        e.currentTarget.style.borderColor = '#3b82f6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '14px' }}>{tpl.name}</span>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '999px',
                              backgroundColor: '#e5e7eb',
                              fontSize: '11px',
                            }}
                          >
                            {tpl.language}
                          </span>
                        </div>
                        {tpl.status && (
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor:
                                tpl.status === 'APPROVED'
                                  ? '#dcfce7'
                                  : tpl.status === 'REJECTED'
                                  ? '#fee2e2'
                                  : '#fef9c3',
                              color:
                                tpl.status === 'APPROVED'
                                  ? '#166534'
                                  : tpl.status === 'REJECTED'
                                  ? '#b91c1c'
                                  : '#854d0e',
                            }}
                          >
                            {tpl.status}
                          </span>
                        )}
                      </div>
                      {tpl.body && (
                        <p
                          style={{
                            margin: 0,
                            fontSize: '12px',
                            color: '#4b5563',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
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

