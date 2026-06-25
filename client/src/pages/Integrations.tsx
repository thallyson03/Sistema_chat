import { useEffect, useState } from 'react';
import api from '../utils/api';
import { useConfirm } from '../components/ui/ConfirmProvider';

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
  autoCloseEnabled?: boolean;
  autoCloseAfterMinutes?: number | null;
  autoCloseMessage?: string | null;
}

interface Channel {
  id: string;
  name: string;
  type: string;
  status: string;
}

export default function Integrations() {
  const confirmModal = useConfirm();
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
    autoCloseEnabled: false,
    autoCloseAfterMinutes: 0,
    autoCloseMessage: '',
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
        autoCloseEnabled: webhook.autoCloseEnabled ?? false,
        autoCloseAfterMinutes: webhook.autoCloseAfterMinutes ?? 0,
        autoCloseMessage: webhook.autoCloseMessage || '',
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
        autoCloseEnabled: false,
        autoCloseAfterMinutes: 0,
        autoCloseMessage: '',
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
      autoCloseEnabled: false,
      autoCloseAfterMinutes: 0,
      autoCloseMessage: '',
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
        autoCloseEnabled: formData.autoCloseEnabled,
        autoCloseAfterMinutes: formData.autoCloseEnabled
          ? formData.autoCloseAfterMinutes || null
          : null,
        autoCloseMessage: formData.autoCloseEnabled ? formData.autoCloseMessage || '' : null,
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
    const confirmed = await confirmModal({
      title: 'Excluir webhook',
      message: `Tem certeza que deseja deletar o webhook "${name}"?`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
    });
    if (!confirmed) {
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
    return <div className="p-5 text-on-surface-variant">Carregando...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl p-6 font-body text-on-surface">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-headline text-3xl font-bold text-on-surface">Integrações</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Gerencie webhooks e automações do n8n.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="primary-gradient-channel rounded-lg px-4 py-2.5 text-sm font-bold text-[#003919] shadow-emerald-send transition hover:brightness-110"
        >
          + Nova Integração
        </button>
      </div>

      <div className="mb-5 rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
        <strong className="text-on-surface">ℹ️ Sobre Integrações n8n:</strong>
        <p className="mt-2.5">
          Configure webhooks para integrar com n8n e criar automações personalizadas. 
          Quando os eventos selecionados ocorrerem, o sistema enviará uma requisição HTTP para a URL configurada.
        </p>
        <p className="mt-2.5">
          Você também pode configurar o encerramento automático de conversas por inatividade para canais vinculados a esta integração.
        </p>
      </div>

      {webhooks.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low py-10 text-center">
          <p className="mb-5 text-on-surface-variant">Nenhuma integração configurada</p>
          <button
            onClick={() => handleOpenModal()}
            className="primary-gradient-channel rounded-lg px-4 py-2 text-sm font-bold text-[#003919] shadow-emerald-send transition hover:brightness-110"
          >
            Criar Primeira Integração
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="rounded-xl border border-outline-variant bg-surface-container-low p-5 shadow-forest-glow"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2.5">
                    <h3 className="m-0 text-lg font-semibold text-on-surface">{webhook.name}</h3>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                        webhook.isActive
                          ? 'border border-primary/25 bg-primary/20 text-primary-fixed-dim'
                          : 'border border-red-500/25 bg-red-500/10 text-red-300'
                      }`}
                    >
                      {webhook.isActive ? 'Ativo' : 'Pausado'}
                    </span>
                  </div>
                  <p className="my-1 text-sm text-on-surface-variant">
                    <strong className="text-on-surface">URL:</strong>{' '}
                    <span className="text-xs" style={{ fontFamily: 'monospace' }}>{webhook.url}</span>
                    <button
                      onClick={() => copyToClipboard(webhook.url)}
                      className="ml-2 rounded border border-outline-variant bg-surface-container-highest px-1.5 py-0.5 text-[11px] text-on-surface-variant transition hover:bg-surface-container"
                    >
                      📋 Copiar
                    </button>
                  </p>
                  {webhook.channel && (
                    <p className="my-1 text-sm text-on-surface-variant">
                      <strong className="text-on-surface">Canal:</strong> {webhook.channel.name} ({webhook.channel.type})
                    </p>
                  )}
                  {!webhook.channel && (
                    <p className="my-1 text-sm text-on-surface-variant">
                      <strong className="text-on-surface">Canal:</strong> Todos os canais
                    </p>
                  )}
                  <p className="my-1 text-sm text-on-surface-variant">
                    <strong className="text-on-surface">Eventos:</strong> {webhook.events.length} evento(s)
                  </p>
                  {webhook._count && webhook._count.executions > 0 && (
                    <p className="my-1 text-sm text-on-surface-variant">
                      <strong className="text-on-surface">Execuções:</strong> {webhook._count.executions}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleToggleActive(webhook)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      webhook.isActive
                        ? 'border border-amber-500/25 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
                        : 'border border-primary/25 bg-primary/10 text-primary-fixed-dim hover:bg-primary/20'
                    }`}
                  >
                    {webhook.isActive ? 'Pausar' : 'Retomar'}
                  </button>
                  <button
                    onClick={() => handleOpenModal(webhook)}
                    className="rounded-md border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary-fixed-dim transition hover:bg-primary/20"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(webhook.id, webhook.name)}
                    className="rounded-md border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
                  >
                    Deletar
                  </button>
                </div>
              </div>

              <div className="mt-3 border-t border-outline-variant pt-3">
                <strong className="text-sm text-on-surface">Eventos Configurados:</strong>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {webhook.events.map((event) => {
                    const eventLabel = availableEvents.find((e) => e.value === event)?.label || event;
                    return (
                      <span
                        key={event}
                        className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary-fixed-dim"
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
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={handleCloseModal}
        >
          <div
            className="max-h-[90vh] w-[90%] max-w-[640px] overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-highest p-6 text-on-surface shadow-forest-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-5 mt-0 font-headline text-xl font-bold text-on-surface">
              {editingWebhook ? 'Editar Integração' : 'Nova Integração'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-semibold text-on-surface-variant">
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Automação de Vendas"
                  required
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
                />
              </div>

              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-semibold text-on-surface-variant">
                  URL do Webhook n8n *
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://seu-n8n.com/webhook/abc123"
                  required
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
                  style={{ fontFamily: 'monospace' }}
                />
                <p className="mt-1.5 text-xs text-on-surface-variant">
                  Cole aqui a URL do webhook criado no n8n
                </p>
              </div>

              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-semibold text-on-surface-variant">
                  Canal (Opcional)
                </label>
                <select
                  value={formData.channelId}
                  onChange={(e) => setFormData({ ...formData, channelId: e.target.value })}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
                >
                  <option value="">Todos os canais</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name} ({channel.type})
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-on-surface-variant">
                  Deixe vazio para receber eventos de todos os canais
                </p>
              </div>

              <div className="mb-4">
                <label className="mb-2 block text-sm font-semibold text-on-surface-variant">
                  Eventos * (selecione pelo menos um)
                </label>
                <div className="max-h-[200px] overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-low p-2.5">
                  {availableEvents.map((event) => (
                    <label
                      key={event.value}
                      className={`mb-1 flex cursor-pointer items-center rounded-md px-2 py-2 ${
                        formData.events.includes(event.value) ? 'bg-primary/10' : 'hover:bg-surface-container-highest'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event.value)}
                        onChange={() => handleEventToggle(event.value)}
                        className="mr-2"
                      />
                      <span className="text-sm text-on-surface">{event.label}</span>
                      <span className="ml-auto text-[11px] text-on-surface-variant" style={{ fontFamily: 'monospace' }}>
                        {event.value}
                      </span>
                    </label>
                  ))}
                </div>
                {formData.events.length === 0 && (
                  <p className="mt-1.5 text-xs text-red-400">
                    Selecione pelo menos um evento
                  </p>
                )}
              </div>

              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-semibold text-on-surface-variant">
                  Secret (Opcional)
                </label>
                <input
                  type="text"
                  value={formData.secret}
                  onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                  placeholder="Deixe vazio para gerar automaticamente"
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
                  style={{ fontFamily: 'monospace' }}
                />
                <p className="mt-1.5 text-xs text-on-surface-variant">
                  Secret para autenticação. Se não informado, será gerado automaticamente.
                </p>
              </div>

              {/* Encerramento automático por inatividade */}
              <div className="mb-4 rounded-lg border border-outline-variant bg-surface-container-low p-3">
                <label
                  className="mb-2 flex items-center gap-2 text-sm font-semibold text-on-surface"
                >
                  <input
                    type="checkbox"
                    checked={formData.autoCloseEnabled}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        autoCloseEnabled: e.target.checked,
                      }))
                    }
                  />
                  Encerrar atendimento automaticamente por inatividade
                </label>

                {formData.autoCloseEnabled && (
                  <>
                    <div className="mb-2.5">
                      <label
                        className="mb-1 block text-xs font-semibold text-on-surface-variant"
                      >
                        Minutos sem resposta do cliente *
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={formData.autoCloseAfterMinutes || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            autoCloseAfterMinutes: Number(e.target.value) || 0,
                          }))
                        }
                        placeholder="Ex: 15"
                        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
                        required
                      />
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-xs font-semibold text-on-surface-variant"
                      >
                        Mensagem de encerramento *
                      </label>
                      <textarea
                        value={formData.autoCloseMessage}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            autoCloseMessage: e.target.value,
                          }))
                        }
                        placeholder="Ex: Encerramos este atendimento por inatividade. Se precisar, é só mandar uma nova mensagem."
                        rows={3}
                        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
                        required
                      />
                      <small className="text-xs text-on-surface-variant">
                        Esta mensagem será enviada automaticamente antes de a conversa ser marcada como
                        encerrada.
                      </small>
                    </div>
                  </>
                )}
              </div>

              <div className="mb-5">
                <label className="flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-on-surface">Ativo</span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 text-sm text-on-surface-variant transition hover:bg-surface-container"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || formData.events.length === 0}
                  className={`rounded-lg px-4 py-2 text-sm font-bold ${
                    submitting || formData.events.length === 0
                      ? 'cursor-not-allowed bg-surface-container-highest text-on-surface-variant'
                      : 'primary-gradient-channel text-[#003919] shadow-emerald-send transition hover:brightness-110'
                  }`}
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



