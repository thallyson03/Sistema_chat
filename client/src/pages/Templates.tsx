import { useEffect, useState } from 'react';
import api from '../utils/api';

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

export default function Templates() {
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

    const confirmed = window.confirm(
      `Tem certeza que deseja remover o template "${tpl.name}" (${tpl.language})?`,
    );
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
    <div className="min-h-screen bg-slate-50/60">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Templates WhatsApp</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              Gerencie os templates aprovados pela Meta para iniciar conversas fora da janela de
              24h. A criação aqui envia o template para aprovação; o status final (APROVADO/REJEITADO)
              é definido pela Meta.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Canal WhatsApp Official
              </label>
              <select
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 min-w-[220px]"
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>+ Novo template</span>
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              Templates cadastrados ({templates.length})
            </span>
            {loading && (
              <span className="text-xs text-slate-400 animate-pulse">Carregando templates…</span>
            )}
          </div>

          {error && (
            <div className="px-4 py-2 bg-red-50 text-red-600 text-sm border-b border-red-100">
              {error}
            </div>
          )}

          <div className="divide-y divide-slate-100">
            {templates.length === 0 && !loading ? (
              <div className="px-4 py-10 text-center text-slate-400 text-sm">
                Nenhum template encontrado. Clique em &quot;Novo template&quot; para cadastrar o
                primeiro.
              </div>
            ) : (
              templates.map((tpl) => (
                <div
                  key={tpl.id || `${tpl.name}-${tpl.language}`}
                  className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{tpl.name}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                        {tpl.language}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="uppercase tracking-wide">
                        Categoria: <strong className="font-semibold">{tpl.category}</strong>
                      </span>
                      {tpl.status && (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            tpl.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : tpl.status === 'REJECTED'
                              ? 'bg-red-50 text-red-700 border border-red-100'
                              : 'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}
                        >
                          {tpl.status}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(tpl)}
                      disabled={!!deletingId && deletingId === (tpl.id || tpl.name)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingId === (tpl.id || tpl.name) ? 'Removendo…' : 'Remover'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal de criação */}
      {showCreateModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 text-sm"
            >
              Fechar ✕
            </button>

            <h2 className="text-lg font-semibold text-slate-900 mb-1">Novo template</h2>
            <p className="text-xs text-slate-500 mb-4">
              Informe os dados básicos do template. O texto do corpo pode usar variáveis{' '}
              <code className="px-1 py-0.5 bg-slate-100 rounded text-[11px]">{"{{1}}"}</code>,{' '}
              <code className="px-1 py-0.5 bg-slate-100 rounded text-[11px]">{"{{2}}"}</code> etc.
            </p>

            {error && (
              <div className="mb-3 px-3 py-2 bg-red-50 text-red-600 text-xs rounded border border-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nome do template
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="ex: notificacao_status_pedido"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Categoria
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="UTILITY">UTILITÁRIO</option>
                    <option value="MARKETING">MARKETING</option>
                    <option value="AUTHENTICATION">AUTENTICAÇÃO</option>
                    <option value="SERVICE">SERVIÇO</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Idioma</label>
                  <select
                    value={form.language}
                    onChange={(e) => setForm((prev) => ({ ...prev, language: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="pt_BR">Português (Brasil)</option>
                    <option value="en_US">Inglês (EUA)</option>
                    <option value="es_ES">Espanhol</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Corpo da mensagem (BODY)
                </label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                  rows={5}
                  placeholder="Olá {{1}}, sua solicitação {{2}} foi recebida."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

