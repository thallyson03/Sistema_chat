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
  user?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function QuickReplies() {
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
    if (!confirm('Tem certeza que deseja deletar esta resposta rápida?')) {
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>Respostas Rápidas</h1>
        <button
          onClick={handleCreate}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          + Nova Resposta Rápida
        </button>
      </div>

      {/* Filtros */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px',
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
            padding: '10px',
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
              padding: '10px',
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
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Carregando...</div>
      ) : filteredQuickReplies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          <p>Nenhuma resposta rápida encontrada.</p>
          <button
            onClick={handleCreate}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Criar primeira resposta rápida
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {filteredQuickReplies.map((qr) => (
            <div
              key={qr.id}
              style={{
                padding: '20px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>{qr.name}</h3>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {qr.isGlobal && (
                      <span
                        style={{
                          padding: '2px 8px',
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
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: '#f3f4f6',
                          color: '#6b7280',
                          fontSize: '11px',
                        }}
                      >
                        {qr.category}
                      </span>
                    )}
                    {qr.type !== 'TEXT' && (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: '#e5e7eb',
                          fontSize: '11px',
                        }}
                      >
                        {qr.type}
                      </span>
                    )}
                  </div>
                  {qr.shortcut && (
                    <div
                      style={{
                        marginTop: '6px',
                        fontSize: '12px',
                        color: '#6b7280',
                        fontFamily: 'monospace',
                      }}
                    >
                      Atalho: <strong>{qr.shortcut}</strong>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button
                    onClick={() => handleEdit(qr)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(qr.id)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Deletar
                  </button>
                </div>
              </div>
              <div
                style={{
                  fontSize: '14px',
                  color: '#374151',
                  lineHeight: '1.5',
                  marginTop: '10px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '100px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {qr.content}
              </div>
              {qr.mediaUrl && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#6b7280' }}>
                  📎 Mídia anexada
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de Criar/Editar */}
      {showModal && (
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
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>
              {editingQuickReply ? 'Editar Resposta Rápida' : 'Nova Resposta Rápida'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Nome <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Boas-vindas"
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Atalho (opcional)
                </label>
                <input
                  type="text"
                  value={formData.shortcut}
                  onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
                  placeholder="Ex: /boasvindas"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                  }}
                />
                <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                  Use este atalho para buscar rapidamente a resposta
                </small>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Categoria (opcional)
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Ex: Vendas, Suporte, Geral"
                  list="categories"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
                <datalist id="categories">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Tipo
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  <option value="TEXT">Texto</option>
                  <option value="IMAGE">Imagem</option>
                  <option value="VIDEO">Vídeo</option>
                  <option value="AUDIO">Áudio</option>
                  <option value="DOCUMENT">Documento</option>
                </select>
              </div>

              {formData.type !== 'TEXT' && (
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
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
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  />
                  {formData.mediaUrl && (
                    <small style={{ color: '#10b981', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                      ✅ Arquivo carregado: {formData.mediaUrl}
                    </small>
                  )}
                </div>
              )}

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Conteúdo <span style={{ color: 'red' }}>*</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Digite a mensagem... Use {{nome}}, {{telefone}}, {{email}}, {{canal}} para variáveis dinâmicas"
                  required
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
                <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                  💡 Variáveis disponíveis: <code>{'{{nome}}'}</code>, <code>{'{{telefone}}'}</code>,{' '}
                  <code>{'{{email}}'}</code>, <code>{'{{canal}}'}</code>
                </small>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.isGlobal}
                    onChange={(e) => setFormData({ ...formData, isGlobal: e.target.checked })}
                  />
                  <span style={{ fontWeight: '600' }}>Resposta global (disponível para todos os usuários)</span>
                </label>
                <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '5px', marginLeft: '28px' }}>
                  Apenas administradores e supervisores podem criar respostas globais
                </small>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
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

