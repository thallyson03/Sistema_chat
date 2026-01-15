import { useEffect, useState } from 'react';
import api from '../utils/api';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret?: string;
  channelId?: string;
  channel?: {
    id: string;
    name: string;
    type: string;
  };
  createdAt: string;
  _count?: {
    executions: number;
  };
}

interface Channel {
  id: string;
  name: string;
  type: string;
  status: string;
}

export default function Integrations() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: '',
    channelId: '',
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const availableEvents = [
    { value: 'message.received', label: 'Mensagem Recebida' },
    { value: 'message.sent', label: 'Mensagem Enviada' },
    { value: 'conversation.created', label: 'Conversa Criada' },
    { value: 'conversation.updated', label: 'Conversa Atualizada' },
    { value: 'conversation.assigned', label: 'Conversa Atribuída' },
    { value: 'contact.created', label: 'Contato Criado' },
    { value: 'contact.updated', label: 'Contato Atualizado' },
  ];

  useEffect(() => {
    fetchWebhooks();
    fetchChannels();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const response = await api.get('/api/webhooks/n8n');
      setWebhooks(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar webhooks:', error);
    } finally {
      setLoading(false);
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

  const handleOpenModal = (webhook?: Webhook) => {
    if (webhook) {
      setEditingWebhook(webhook);
      setFormData({
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        secret: '',
        channelId: webhook.channelId || '',
        isActive: webhook.isActive,
      });
    } else {
      setEditingWebhook(null);
      setFormData({
        name: '',
        url: '',
        events: [],
        secret: '',
        channelId: '',
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingWebhook(null);
    setFormData({
      name: '',
      url: '',
      events: [],
      secret: '',
      channelId: '',
      isActive: true,
    });
  };

  const handleEventToggle = (eventValue: string) => {
    setFormData((prev) => {
      const events = prev.events.includes(eventValue)
        ? prev.events.filter((e) => e !== eventValue)
        : [...prev.events, eventValue];
      return { ...prev, events };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.url || formData.events.length === 0) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: formData.name,
        url: formData.url,
        events: formData.events,
        isActive: formData.isActive,
      };

      if (formData.secret) {
        payload.secret = formData.secret;
      }

      if (formData.channelId) {
        payload.channelId = formData.channelId;
      }

      if (editingWebhook) {
        await api.put(`/api/webhooks/n8n/${editingWebhook.id}`, payload);
      } else {
        await api.post('/api/webhooks/n8n/register', payload);
      }

      handleCloseModal();
      fetchWebhooks();
      alert(editingWebhook ? 'Webhook atualizado com sucesso!' : 'Webhook criado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar webhook:', error);
      alert(error.response?.data?.error || 'Erro ao salvar webhook');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja deletar o webhook "${name}"?`)) {
      return;
    }

    try {
      await api.delete(`/api/webhooks/n8n/${id}`);
      fetchWebhooks();
      alert('Webhook deletado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao deletar webhook:', error);
      alert(error.response?.data?.error || 'Erro ao deletar webhook');
    }
  };

  const handleToggleActive = async (webhook: Webhook) => {
    try {
      await api.put(`/api/webhooks/n8n/${webhook.id}`, {
        isActive: !webhook.isActive,
      });
      fetchWebhooks();
    } catch (error: any) {
      console.error('Erro ao atualizar webhook:', error);
      alert(error.response?.data?.error || 'Erro ao atualizar webhook');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copiado para a área de transferência!');
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Carregando...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Integrações</h1>
        <button
          onClick={() => handleOpenModal()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          + Nova Integração
        </button>
      </div>

      <div style={{ 
        backgroundColor: '#f3f4f6', 
        padding: '15px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        fontSize: '14px',
        color: '#4b5563',
      }}>
        <strong>ℹ️ Sobre Integrações n8n:</strong>
        <p style={{ margin: '10px 0 0 0' }}>
          Configure webhooks para integrar com n8n e criar automações personalizadas. 
          Quando os eventos selecionados ocorrerem, o sistema enviará uma requisição HTTP para a URL configurada.
        </p>
      </div>

      {webhooks.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          backgroundColor: 'white', 
          borderRadius: '8px',
          border: '2px dashed #d1d5db',
        }}>
          <p style={{ color: '#6b7280', marginBottom: '20px' }}>Nenhuma integração configurada</p>
          <button
            onClick={() => handleOpenModal()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Criar Primeira Integração
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                border: '1px solid #e5e7eb',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>{webhook.name}</h3>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        backgroundColor: webhook.isActive ? '#10b981' : '#ef4444',
                        color: 'white',
                        fontWeight: 'bold',
                      }}
                    >
                      {webhook.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <p style={{ margin: '5px 0', color: '#6b7280', fontSize: '14px' }}>
                    <strong>URL:</strong>{' '}
                    <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{webhook.url}</span>
                    <button
                      onClick={() => copyToClipboard(webhook.url)}
                      style={{
                        marginLeft: '8px',
                        padding: '2px 6px',
                        fontSize: '11px',
                        backgroundColor: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      📋 Copiar
                    </button>
                  </p>
                  {webhook.channel && (
                    <p style={{ margin: '5px 0', color: '#6b7280', fontSize: '14px' }}>
                      <strong>Canal:</strong> {webhook.channel.name} ({webhook.channel.type})
                    </p>
                  )}
                  {!webhook.channel && (
                    <p style={{ margin: '5px 0', color: '#6b7280', fontSize: '14px' }}>
                      <strong>Canal:</strong> Todos os canais
                    </p>
                  )}
                  <p style={{ margin: '5px 0', color: '#6b7280', fontSize: '14px' }}>
                    <strong>Eventos:</strong> {webhook.events.length} evento(s)
                  </p>
                  {webhook._count && webhook._count.executions > 0 && (
                    <p style={{ margin: '5px 0', color: '#6b7280', fontSize: '14px' }}>
                      <strong>Execuções:</strong> {webhook._count.executions}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                  <button
                    onClick={() => handleToggleActive(webhook)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: webhook.isActive ? '#f59e0b' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    {webhook.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={() => handleOpenModal(webhook)}
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
                    onClick={() => handleDelete(webhook.id, webhook.name)}
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

              <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e5e7eb' }}>
                <strong style={{ fontSize: '13px', color: '#374151' }}>Eventos Configurados:</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                  {webhook.events.map((event) => {
                    const eventLabel = availableEvents.find((e) => e.value === event)?.label || event;
                    return (
                      <span
                        key={event}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#eff6ff',
                          color: '#1e40af',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}
                      >
                        {eventLabel}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '8px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>
              {editingWebhook ? 'Editar Integração' : 'Nova Integração'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Automação de Vendas"
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '5px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                  URL do Webhook n8n *
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://seu-n8n.com/webhook/abc123"
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '5px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                  }}
                />
                <p style={{ marginTop: '5px', fontSize: '12px', color: '#6b7280' }}>
                  Cole aqui a URL do webhook criado no n8n
                </p>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                  Canal (Opcional)
                </label>
                <select
                  value={formData.channelId}
                  onChange={(e) => setFormData({ ...formData, channelId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '5px',
                    fontSize: '14px',
                  }}
                >
                  <option value="">Todos os canais</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name} ({channel.type})
                    </option>
                  ))}
                </select>
                <p style={{ marginTop: '5px', fontSize: '12px', color: '#6b7280' }}>
                  Deixe vazio para receber eventos de todos os canais
                </p>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', fontSize: '14px' }}>
                  Eventos * (selecione pelo menos um)
                </label>
                <div style={{ 
                  border: '1px solid #d1d5db', 
                  borderRadius: '5px', 
                  padding: '10px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}>
                  {availableEvents.map((event) => (
                    <label
                      key={event.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        marginBottom: '4px',
                        backgroundColor: formData.events.includes(event.value) ? '#eff6ff' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event.value)}
                        onChange={() => handleEventToggle(event.value)}
                        style={{ marginRight: '8px' }}
                      />
                      <span style={{ fontSize: '14px' }}>{event.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                        {event.value}
                      </span>
                    </label>
                  ))}
                </div>
                {formData.events.length === 0 && (
                  <p style={{ marginTop: '5px', fontSize: '12px', color: '#ef4444' }}>
                    Selecione pelo menos um evento
                  </p>
                )}
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                  Secret (Opcional)
                </label>
                <input
                  type="text"
                  value={formData.secret}
                  onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                  placeholder="Deixe vazio para gerar automaticamente"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '5px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                  }}
                />
                <p style={{ marginTop: '5px', fontSize: '12px', color: '#6b7280' }}>
                  Secret para autenticação. Se não informado, será gerado automaticamente.
                </p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={{ fontSize: '14px' }}>Ativo</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || formData.events.length === 0}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: submitting || formData.events.length === 0 ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: submitting || formData.events.length === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  {submitting ? 'Salvando...' : editingWebhook ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

