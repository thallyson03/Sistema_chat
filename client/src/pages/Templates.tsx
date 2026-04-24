import { useEffect, useState } from 'react';
import api from '../utils/api';
import { useConfirm } from '../components/ui/ConfirmProvider';

interface WhatsappTemplate {
  id?: string;
  name: string;
  language: string;
  category: string;
  status?: string;
}

interface CreateTemplateForm {
  name: string;
  category: string;
  language: string;
  body: string;
}

interface Channel {
  id: string;
  name: string;
  type: string;
  status: string;
  config?: any;
}

function statusClasses(status?: string) {
  if (status === 'APPROVED') return 'bg-emerald-900/35 text-primary-fixed-dim border border-primary/25';
  if (status === 'REJECTED') return 'bg-red-900/35 text-red-300 border border-red-500/25';
  return 'bg-amber-900/30 text-amber-200 border border-amber-500/25';
}

export default function Templates() {
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [loadingChannels, setLoadingChannels] = useState(true);

  const [form, setForm] = useState<CreateTemplateForm>({
    name: '',
    category: 'UTILITY',
    language: 'pt_BR',
    body: '',
  });

  useEffect(() => {
    fetchChannels();
  }, []);

  useEffect(() => {
    if (selectedChannelId) {
      fetchTemplates(selectedChannelId);
    } else {
      setTemplates([]);
    }
  }, [selectedChannelId]);

  const fetchChannels = async () => {
    try {
      setLoadingChannels(true);
      const response = await api.get('/api/channels');
      const allChannels: Channel[] = response.data || [];

      const official = allChannels.filter((ch) => {
        const cfg = (ch.config || {}) as any;
        return ch.type === 'WHATSAPP' && cfg?.provider === 'whatsapp_official';
      });

      setChannels(official);

      if (official.length > 0) {
        setSelectedChannelId(official[0].id);
      }
    } catch (err: any) {
      console.error('[Templates] Erro ao buscar canais WhatsApp:', err);
      setError(err.response?.data?.error || 'Erro ao carregar canais WhatsApp');
    } finally {
      setLoadingChannels(false);
    }
  };

  const fetchTemplates = async (channelId: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/api/whatsapp/templates', {
        params: {
          limit: 100,
          channelId,
        },
      });
      // A resposta da Graph API vem em response.data.data
      const items = response.data?.data || [];

      const mapped: WhatsappTemplate[] = items.map((item: any) => ({
        id: item.id,
        name: item.name,
        language: item.language,
        category: item.category,
        status: item.status,
      }));

      setTemplates(mapped);
    } catch (err: any) {
      console.error('[Templates] Erro ao buscar templates:', err);
      setError(err.response?.data?.error || 'Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      setError(null);

      if (!selectedChannelId) {
        setError('Selecione um canal WhatsApp Official antes de criar um template.');
        return;
      }

      if (!form.name || !form.category || !form.language || !form.body) {
        setError('Preencha todos os campos obrigatórios.');
        return;
      }

      await api.post('/api/whatsapp/templates', {
        ...form,
        channelId: selectedChannelId,
      });

      setShowCreateModal(false);
      setForm({
        name: '',
        category: 'UTILITY',
        language: 'pt_BR',
        body: '',
      });

      await fetchTemplates(selectedChannelId);
    } catch (err: any) {
      console.error('[Templates] Erro ao criar template:', err);
      setError(err.response?.data?.error || 'Erro ao criar template');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTemplate = async (tpl: WhatsappTemplate) => {
    if (!tpl.name || !tpl.language) return;

    if (!selectedChannelId) {
      alert('Selecione um canal WhatsApp Official antes de remover templates.');
      return;
    }

    const confirmed = await confirm({
      title: 'Excluir template',
      message: `Tem certeza que deseja remover o template "${tpl.name}" (${tpl.language})?`,
    });
    if (!confirmed) return;

    try {
      setDeletingId(tpl.id || tpl.name);
      await api.delete(
        `/api/whatsapp/templates/${encodeURIComponent(tpl.name)}?language=${encodeURIComponent(
          tpl.language,
        )}&channelId=${encodeURIComponent(selectedChannelId)}`,
      );
      await fetchTemplates(selectedChannelId);
    } catch (err: any) {
      console.error('[Templates] Erro ao remover template:', err);
      alert(err.response?.data?.error || 'Erro ao remover template');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-60px)] bg-surface font-body text-on-surface">
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Cabeçalho */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-3xl font-bold text-on-surface">Templates de WhatsApp</h1>
            <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
              Gerencie os templates aprovados pela Meta para iniciar conversas fora da janela de
              24h. A criação aqui envia o template para aprovação; o status final (APROVADO/REJEITADO)
              é definido pela Meta.
            </p>
          </div>
          <div className="flex items-end gap-3">
            <div className="min-w-[260px]">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Canal WhatsApp Official
              </label>
              <select
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                {loadingChannels ? (
                  <option value="">Carregando canais...</option>
                ) : channels.length === 0 ? (
                  <option value="">Nenhum canal WhatsApp Official encontrado</option>
                ) : (
                  <>
                    <option value="">Selecione um canal</option>
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowCreateModal(true);
                setError(null);
              }}
              disabled={!selectedChannelId}
              className="primary-gradient-channel inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-[#003919] shadow-emerald-send transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>+ Novo template</span>
            </button>
          </div>
        </div>

        {/* Filtros rápidos */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2">
          <span className="rounded-md bg-primary/20 px-2.5 py-1 text-xs font-semibold text-primary-fixed-dim">
            Todos
          </span>
          <span className="rounded-md bg-surface-container-highest px-2.5 py-1 text-xs text-on-surface-variant">
            Marketing
          </span>
          <span className="rounded-md bg-surface-container-highest px-2.5 py-1 text-xs text-on-surface-variant">
            Utilitários
          </span>
          <span className="rounded-md bg-surface-container-highest px-2.5 py-1 text-xs text-on-surface-variant">
            Autenticação
          </span>
        </div>

        {/* Lista */}
        <div className="rounded-xl border border-outline-variant bg-surface-container-low shadow-forest-glow">
          <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
            <span className="text-sm font-medium text-on-surface">
              Templates cadastrados ({templates.length})
            </span>
            {loading && (
              <span className="animate-pulse text-xs text-on-surface-variant">Carregando templates…</span>
            )}
          </div>

          {error && (
            <div className="border-b border-red-500/20 bg-red-950/30 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="p-4">
            {templates.length === 0 && !loading ? (
              <div className="px-4 py-10 text-center text-sm text-on-surface-variant">
                Nenhum template encontrado. Clique em &quot;Novo template&quot; para cadastrar o
                primeiro.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id || `${tpl.name}-${tpl.language}`}
                    className="rounded-lg border border-outline-variant bg-surface-container-high p-4 transition-colors hover:border-primary/30"
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-lg font-bold text-on-surface">{tpl.name}</div>
                        <div className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                          {tpl.category} • {tpl.language}
                        </div>
                      </div>
                      {tpl.status && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClasses(
                            tpl.status,
                          )}`}
                        >
                          {tpl.status}
                        </span>
                      )}
                    </div>

                    <div className="mb-4 rounded-md border border-outline-variant bg-surface-container-lowest p-3 text-xs text-on-surface-variant">
                      Template sincronizado com a API da Meta.
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        className="rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1.5 font-semibold text-primary-fixed-dim transition hover:bg-primary/20"
                        disabled
                        title="Ação visual no momento"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(tpl)}
                        disabled={!!deletingId && deletingId === (tpl.id || tpl.name)}
                        className="rounded-md border border-red-500/25 bg-red-500/10 px-2.5 py-1.5 font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === (tpl.id || tpl.name) ? 'Removendo…' : 'Remover'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de criação */}
      {showCreateModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-xl border border-outline-variant bg-surface-container-highest p-6 text-on-surface shadow-forest-glow">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="absolute right-3 top-3 text-sm text-on-surface-variant transition hover:text-on-surface"
            >
              Fechar ✕
            </button>

            <h2 className="mb-1 text-lg font-semibold text-on-surface">Novo template</h2>
            <p className="mb-4 text-xs text-on-surface-variant">
              Informe os dados básicos do template. O texto do corpo pode usar variáveis{' '}
              <code className="rounded bg-surface-container-low px-1 py-0.5 text-[11px]">{"{{1}}"}</code>,{' '}
              <code className="rounded bg-surface-container-low px-1 py-0.5 text-[11px]">{"{{2}}"}</code> etc.
            </p>

            {error && (
              <div className="mb-3 rounded border border-red-500/20 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-on-surface-variant">
                  Nome do template
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="ex: notificacao_status_pedido"
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-on-surface-variant">
                    Categoria
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  >
                    <option value="UTILITY">UTILITÁRIO</option>
                    <option value="MARKETING">MARKETING</option>
                    <option value="AUTHENTICATION">AUTENTICAÇÃO</option>
                    <option value="SERVICE">SERVIÇO</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-on-surface-variant">Idioma</label>
                  <select
                    value={form.language}
                    onChange={(e) => setForm((prev) => ({ ...prev, language: e.target.value }))}
                    className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  >
                    <option value="pt_BR">Português (Brasil)</option>
                    <option value="en_US">Inglês (EUA)</option>
                    <option value="es_ES">Espanhol</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-on-surface-variant">
                  Corpo da mensagem (BODY)
                </label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                  rows={5}
                  placeholder="Olá {{1}}, sua solicitação {{2}} foi recebida."
                  className="w-full resize-none rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 text-sm text-on-surface-variant transition hover:bg-surface-container"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="primary-gradient-channel rounded-lg px-4 py-2 text-sm font-bold text-[#003919] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? 'Salvando…' : 'Criar template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

