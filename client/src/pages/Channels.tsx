import { useEffect, useState } from 'react';
import api from '../utils/api';

interface Channel {
  id: string;
  name: string;
  type: string;
  status: string;
  evolutionApiKey?: string;
  evolutionInstanceId?: string;
  sectorId?: string;
  sector?: {
    id: string;
    name: string;
    color: string;
  };
  // secundários (opcional - pode não existir no retorno atual da API)
  secondarySectors?: Array<{
    sector: {
      id: string;
      name: string;
      color: string;
    };
  }>;
}

export default function Channels() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [sectors, setSectors] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    type: 'WHATSAPP',
    primarySectorId: '',
    secondarySectorIds: [] as string[],
    provider: 'evolution', // 'evolution' ou 'whatsapp_official'
    whatsappToken: '',
    whatsappPhoneNumberId: '',
    whatsappBusinessAccountId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchChannels();
    fetchSectors();
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timeout);
  }, [successMessage]);

  const fetchSectors = async () => {
    try {
      const response = await api.get('/api/sectors');
      setSectors(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
    }
  };

  const fetchChannels = async () => {
    try {
      const response = await api.get('/api/channels');
      setChannels(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar canais:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Preparar dados para envio
      const channelData: any = {
        name: formData.name,
        type: formData.type,
        primarySectorId: formData.primarySectorId || undefined,
        secondarySectorIds: formData.secondarySectorIds || [],
      };

      // Se for WhatsApp, adicionar config com provider
      if (formData.type === 'WHATSAPP') {
        channelData.config = {
          provider: formData.provider,
        };

        if (formData.provider === 'whatsapp_official') {
          channelData.config.token = formData.whatsappToken || undefined;
          channelData.config.phoneNumberId = formData.whatsappPhoneNumberId || undefined;
          channelData.config.businessAccountId = formData.whatsappBusinessAccountId || undefined;
        }
      }

      await api.post('/api/channels', channelData);
      setShowModal(false);
      setFormData({
        name: '',
        type: 'WHATSAPP',
        primarySectorId: '',
        secondarySectorIds: [],
        provider: 'evolution',
        whatsappToken: '',
        whatsappPhoneNumberId: '',
        whatsappBusinessAccountId: '',
      });
      fetchChannels();
      alert('Canal criado com sucesso!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao criar canal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefreshStatus = async (channelId: string) => {
    try {
      await api.get(`/api/channels/${channelId}/status`);
      fetchChannels(); // Recarregar lista
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao atualizar status');
    }
  };

  const handleViewQRCode = async (channelId: string) => {
    try {
      const response = await api.get(`/api/channels/${channelId}/qrcode`);
      if (response.data.qrcode) {
        setQrCode(response.data.qrcode);
        setShowQRModal(true);
        startConnectionCheck(channelId);
      } else {
        alert('QR Code ainda não disponível. Aguarde alguns segundos.');
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao obter QR Code');
    }
  };

  const startConnectionCheck = (channelId: string) => {
    setCheckingConnection(true);
    let checkCount = 0;
    const maxChecks = 100; // 100 verificações = 5 minutos (100 * 3s = 300s)
    
    const interval = setInterval(async () => {
      checkCount++;
      try {
        console.log(`[Channels] Verificando status (tentativa ${checkCount}/${maxChecks})...`);
        const response = await api.get(`/api/channels/${channelId}/status`);
        const status = response.data.status;
        
        console.log(`[Channels] Status recebido:`, status);
        
        // Aceitar múltiplos formatos de status conectado
        const isConnected = status === 'ACTIVE' || 
                           status === 'active' || 
                           status === 'open' || 
                           status === 'connected' ||
                           status === 'ready' ||
                           status === 'authenticated';
        
        if (isConnected) {
          // Conexão estabelecida!
          console.log('[Channels] ✅ Conexão detectada! Fechando modal...');
          clearInterval(interval);
          setCheckingConnection(false);
          setShowQRModal(false);
          setQrCode(null);
          
          // Atualizar lista de canais
          await fetchChannels();
          
          alert('✅ WhatsApp conectado com sucesso!');
        } else {
          console.log(`[Channels] Ainda aguardando conexão... Status atual: ${status}`);
        }
      } catch (error: any) {
        console.error('[Channels] Erro ao verificar status:', error);
        console.error('[Channels] Erro detalhado:', error.response?.data);
      }
      
      // Limpar intervalo após maxChecks verificações
      if (checkCount >= maxChecks) {
        console.log('[Channels] ⚠️ Timeout: Parando verificação após 5 minutos');
        clearInterval(interval);
        setCheckingConnection(false);
        alert('⏱️ Tempo de espera esgotado. Verifique manualmente o status do canal.');
      }
    }, 3000); // Verificar a cada 3 segundos
  };

  const handleDeleteChannel = async (channelId: string, channelName: string) => {
    try {
      console.log('🗑️ Excluindo canal:', channelId, channelName);
      const response = await api.delete(`/api/channels/${channelId}`);
      console.log('✅ Canal excluído com sucesso:', response.data);
      setSuccessMessage('Canal excluído com sucesso!');
      fetchChannels();
    } catch (error: any) {
      console.error('❌ Erro ao excluir canal:', error);
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      const errorMessage = error.response?.data?.error || error.message || 'Erro ao excluir canal';
      alert(`Erro ao excluir canal: ${errorMessage}`);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto text-sm text-slate-500">
        Carregando canais...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Canais</h1>
          <p className="text-sm text-slate-500">
            Gerencie integrações com WhatsApp, email e outros canais de atendimento.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-slate-800 transition"
        >
          + Novo Canal
        </button>
      </div>

      {/* Lista de canais */}
      {channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <p className="text-sm mb-4">Nenhum canal configurado.</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow hover:bg-emerald-600 transition"
          >
            Criar primeiro canal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className="group relative rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition card-hover overflow-hidden"
            >
              <div className="p-5 flex flex-col h-full">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {channel.name}
                      </h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {channel.type}
                      </span>
                    </div>
                    {channel.sector && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                        <span>Setor:</span>
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: `${channel.sector.color}20`,
                            color: channel.sector.color,
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: channel.sector.color }}
                          />
                          {channel.sector.name}
                        </span>
                      </div>
                    )}
                  </div>

                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      channel.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}
                  >
                    <span className="mr-1 text-[8px]">
                      {channel.status === 'ACTIVE' ? '●' : '○'}
                    </span>
                    {channel.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div className="mt-auto space-y-3">
                  {channel.type === 'WHATSAPP' && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={async () => {
                          try {
                            await handleRefreshStatus(channel.id);
                            setTimeout(() => fetchChannels(), 1000);
                          } catch (error) {
                            console.error('Erro ao atualizar status:', error);
                          }
                        }}
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        Atualizar status
                      </button>
                      {channel.status !== 'ACTIVE' && (
                        <button
                          onClick={() => handleViewQRCode(channel.id)}
                          className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-slate-950 shadow hover:bg-emerald-600 transition"
                        >
                          Ver QR Code
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => setDeleteTarget({ id: channel.id, name: channel.name })}
                    className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-red-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-600 transition"
                  >
                    Excluir canal
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de criar canal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Criar novo canal</h2>
                <p className="text-xs text-slate-500">
                  Configure integrações com WhatsApp, email e outros canais de atendimento.
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

            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome do canal
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Setor principal (opcional)
                </label>
                <select
                  value={formData.primarySectorId}
                  onChange={(e) => {
                    const nextPrimary = e.target.value;
                    setFormData((prev) => {
                      // remover o setor principal da lista de secundários (se estiver)
                      const filteredSecondary = prev.secondarySectorIds.filter((sid) => sid !== nextPrimary);
                      return { ...prev, primarySectorId: nextPrimary, secondarySectorIds: filteredSecondary };
                    });
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                >
                  <option value="">Nenhum setor principal</option>
                  {sectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Setores secundários (opcional)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sectors.map((sector) => {
                    const isPrimary = formData.primarySectorId === sector.id;
                    const checked = formData.secondarySectorIds.includes(sector.id);
                    return (
                      <label
                        key={sector.id}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                          isPrimary ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={isPrimary}
                          checked={checked}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setFormData((prev) => {
                              const next = on
                                ? [...prev.secondarySectorIds, sector.id]
                                : prev.secondarySectorIds.filter((sid) => sid !== sector.id);
                              // nunca permitir duplicar o primary na secondary
                              return {
                                ...prev,
                                secondarySectorIds: next.filter((sid) => sid !== prev.primarySectorId),
                              };
                            });
                          }}
                        />
                        <span className="text-slate-800">{sector.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tipo
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: e.target.value,
                        provider: e.target.value === 'WHATSAPP' ? formData.provider : 'evolution',
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="TELEGRAM">Telegram</option>
                    <option value="EMAIL">Email</option>
                    <option value="WEBCHAT">Webchat</option>
                  </select>
                </div>

                {formData.type === 'WHATSAPP' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Provedor WhatsApp
                    </label>
                    <select
                      value={formData.provider}
                      onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                    >
                      <option value="evolution">Evolution API</option>
                      <option value="whatsapp_official">WhatsApp Official (Meta Cloud API)</option>
                    </select>
                  </div>
                )}
              </div>

              {formData.type === 'WHATSAPP' && (
                <p className="text-[11px] text-slate-500">
                  {formData.provider === 'whatsapp_official'
                    ? 'Usa a API oficial do WhatsApp (Meta Cloud API). Requer credenciais copiadas do Meta Developers.'
                    : 'Usa Evolution API com a API Key configurada no servidor.'}
                </p>
              )}

              {formData.type === 'WHATSAPP' && formData.provider === 'whatsapp_official' && (
                <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-3">
                  <p className="text-[11px] text-emerald-800">
                    Preencha com o Access Token, Phone Number ID e WABA ID obtidos no painel do Meta.
                  </p>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-slate-700">
                      Access Token
                    </label>
                    <input
                      type="text"
                      value={formData.whatsappToken}
                      onChange={(e) => setFormData({ ...formData, whatsappToken: e.target.value })}
                      placeholder="EAAG..."
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Phone Number ID
                      </label>
                      <input
                        type="text"
                        value={formData.whatsappPhoneNumberId}
                        onChange={(e) =>
                          setFormData({ ...formData, whatsappPhoneNumberId: e.target.value })
                        }
                        placeholder="Ex: 123456789012345"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700">
                        WABA ID
                      </label>
                      <input
                        type="text"
                        value={formData.whatsappBusinessAccountId}
                        onChange={(e) =>
                          setFormData({ ...formData, whatsappBusinessAccountId: e.target.value })
                        }
                        placeholder="Ex: 123456789012345"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

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
                  disabled={submitting}
                  className="rounded-full bg-slate-900 px-5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Criando...' : 'Criar canal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de QR Code */}
      {showQRModal && qrCode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70"
          onClick={() => {
            if (!checkingConnection) {
              setShowQRModal(false);
              setQrCode(null);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-emerald-600 mb-1">Conectar WhatsApp</h2>
            <p className="text-xs text-slate-500 mb-4">
              Escaneie este QR Code com o aplicativo WhatsApp para conectar sua instância.
            </p>
            <div className="flex justify-center mb-4 p-4 bg-slate-50 rounded-xl">
              <img
                src={qrCode}
                alt="QR Code"
                className="max-w-full h-auto rounded-xl border-4 border-emerald-500"
              />
            </div>
            {checkingConnection && (
              <div className="mt-3 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800 flex items-center justify-center gap-2">
                <span className="h-4 w-4 border-2 border-sky-700 border-t-transparent rounded-full animate-spin" />
                Aguardando conexão...
              </div>
            )}
            <div className="mt-5">
              <button
                onClick={() => {
                  setShowQRModal(false);
                  setQrCode(null);
                  setCheckingConnection(false);
                }}
                className="rounded-full bg-slate-900 px-5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900 mb-1">
                Excluir canal
              </h2>
              <p className="text-xs text-slate-500">
                Tem certeza que deseja excluir o canal{' '}
                <span className="font-semibold text-slate-900">
                  "{deleteTarget.name}"
                </span>
                ?
              </p>
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Esta ação não pode ser desfeita e também excluirá a instância na Evolution API,
                se existir.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleDeleteChannel(deleteTarget.id, deleteTarget.name);
                  setDeleteTarget(null);
                }}
                className="rounded-full bg-red-500 px-5 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
              >
                Excluir canal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast de sucesso */}
      {successMessage && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-lg shadow-slate-900/40">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              ✓
            </div>
            <div className="text-xs">
              <p className="font-semibold text-white">Pronto!</p>
              <p className="text-slate-200">{successMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="ml-2 text-slate-400 hover:text-slate-200 text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
