import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
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

interface ChannelHealthItem {
  id: string;
  name: string;
  type: string;
  status: string;
  provider: string;
  checks: {
    credentialsOk: boolean;
    webhookReady: boolean;
  };
  metrics: {
    conversationCount: number;
    lastActivityAt: string | null;
  };
}

interface ChannelHealthPanel {
  summary: {
    total: number;
    active: number;
    withIssues: number;
  };
  items: ChannelHealthItem[];
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    WHATSAPP: 'WhatsApp',
    TELEGRAM: 'Telegram',
    EMAIL: 'Email',
    WEBCHAT: 'Webchat',
  };
  return map[type] || type;
}

function channelTypeVisual(type: string): { icon: string; boxClass: string } {
  const t = type.toUpperCase();
  if (t === 'WHATSAPP')
    return { icon: 'chat', boxClass: 'bg-[#66dd8b]/10 text-[#66dd8b]' };
  if (t === 'TELEGRAM')
    return { icon: 'send', boxClass: 'bg-[#88d982]/10 text-[#88d982]' };
  if (t === 'EMAIL')
    return { icon: 'mail', boxClass: 'bg-on-surface-variant/15 text-on-surface-variant' };
  if (t === 'WEBCHAT')
    return { icon: 'forum', boxClass: 'bg-secondary/10 text-secondary' };
  return { icon: 'hub', boxClass: 'bg-primary/10 text-primary' };
}

function channelMetaLine(channel: Channel): string {
  if (channel.type === 'WHATSAPP' && channel.status !== 'ACTIVE') {
    return 'Nenhuma conta vinculada';
  }
  const parts: string[] = [];
  if (channel.sector?.name) parts.push(channel.sector.name);
  if (channel.evolutionInstanceId)
    parts.push(`Instância: ${channel.evolutionInstanceId.slice(0, 10)}…`);
  if (parts.length) return parts.join(' · ');
  return `${typeLabel(channel.type)}`;
}

export default function Channels() {
  const metaWebhookUrl = 'https://crm.chat.chatia.qzz.io/api/webhooks/whatsapp';
  const [channels, setChannels] = useState<Channel[]>([]);
  const [healthPanel, setHealthPanel] = useState<ChannelHealthPanel | null>(null);
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
    whatsappAppSecret: '',
    whatsappPhoneNumberId: '',
    whatsappBusinessAccountId: '',
    whatsappWebhookVerifyToken: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetchChannels();
    fetchSectors();
    fetchHealthPanel();
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

  const fetchHealthPanel = async () => {
    try {
      const response = await api.get('/api/channels/health/panel');
      setHealthPanel(response.data || null);
    } catch (error) {
      console.error('Erro ao carregar painel de saúde dos canais:', error);
    }
  };

  const handleCreateChannel = async (e: FormEvent) => {
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
          channelData.config.appSecret = formData.whatsappAppSecret || undefined;
          channelData.config.phoneNumberId = formData.whatsappPhoneNumberId || undefined;
          channelData.config.businessAccountId = formData.whatsappBusinessAccountId || undefined;
          channelData.config.webhookVerifyToken = formData.whatsappWebhookVerifyToken || undefined;
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
        whatsappAppSecret: '',
        whatsappPhoneNumberId: '',
        whatsappBusinessAccountId: '',
        whatsappWebhookVerifyToken: '',
      });
      fetchChannels();
      fetchHealthPanel();
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
      fetchHealthPanel();
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
      fetchHealthPanel();
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
      <div className="flex min-h-[50vh] items-center justify-center px-8 font-body text-on-surface-variant">
        <p className="text-sm">Carregando canais...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-surface px-6 py-8 font-body text-on-surface md:px-10">
      <div className="mx-auto max-w-6xl">
        {healthPanel && (
          <div className="mb-6 rounded-xl border border-[rgba(63,73,69,0.2)] bg-surface-container-low/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-headline text-sm font-bold text-on-surface">Painel de Saúde dos Canais</h2>
              <button
                type="button"
                onClick={fetchHealthPanel}
                className="rounded-md border border-[rgba(63,73,69,0.25)] bg-surface-container-highest px-3 py-1 text-[11px] font-semibold text-on-surface-variant transition hover:bg-surface-variant"
              >
                Atualizar painel
              </button>
            </div>
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-[rgba(63,73,69,0.2)] bg-surface-container-highest p-2.5 text-xs text-on-surface-variant">
                Total de canais: <span className="font-semibold text-on-surface">{healthPanel.summary.total}</span>
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-2.5 text-xs text-primary-fixed-dim">
                Ativos: <span className="font-semibold">{healthPanel.summary.active}</span>
              </div>
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-2.5 text-xs text-amber-200">
                Com pendências: <span className="font-semibold">{healthPanel.summary.withIssues}</span>
              </div>
            </div>
            <div className="space-y-2">
              {healthPanel.items.slice(0, 6).map((item) => {
                const ok = item.checks.credentialsOk && item.checks.webhookReady;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-1 rounded-lg border border-[rgba(63,73,69,0.2)] bg-surface-container-highest px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="text-on-surface">
                      <span className="font-semibold">{item.name}</span>{' '}
                      <span className="text-on-surface-variant">({typeLabel(item.type)} / {item.provider})</span>
                    </div>
                    <div className={`font-semibold ${ok ? 'text-[#66dd8b]' : 'text-amber-300'}`}>
                      {ok ? 'Saudável' : 'Requer atenção'}
                    </div>
                    <div className="text-on-surface-variant">
                      Conv: {item.metrics.conversationCount} · Última atividade:{' '}
                      {item.metrics.lastActivityAt
                        ? new Date(item.metrics.lastActivityAt).toLocaleString('pt-BR')
                        : 'n/a'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
              Canais
            </h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              Gerencie suas conexões de comunicação em um só lugar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="primary-gradient-channel inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-on-primary-channel shadow-lg shadow-[#66dd8b]/10 transition hover:opacity-90 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Novo Canal
          </button>
        </div>

        {channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-[rgba(63,73,69,0.15)] bg-surface-container-low/60 py-20 text-on-surface-variant">
            <span className="material-symbols-outlined mb-4 text-4xl text-[#66dd8b]/40">hub</span>
            <p className="mb-4 text-sm">Nenhum canal configurado.</p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="primary-gradient-channel inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-semibold text-on-primary-channel transition hover:opacity-90 active:scale-[0.98]"
            >
              Criar primeiro canal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {channels.map((channel) => {
              const visual = channelTypeVisual(channel.type);
              const isActive = channel.status === 'ACTIVE';
              return (
                <div
                  key={channel.id}
                  className="glass-channel-card flex min-h-[160px] flex-col justify-between rounded-xl border border-[rgba(63,73,69,0.15)] p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-4">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${visual.boxClass}`}
                      >
                        <span
                          className="material-symbols-outlined text-3xl"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          {visual.icon}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-headline text-lg font-bold text-on-surface">
                          {channel.name}
                        </h3>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                          {typeLabel(channel.type)}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              isActive ? 'animate-pulse bg-[#66dd8b]' : 'bg-red-400'
                            }`}
                          />
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider ${
                              isActive ? 'text-[#4fc777]' : 'text-red-300'
                            }`}
                          >
                            {isActive ? 'Ativo' : 'Desconectado'}
                          </span>
                        </div>
                        {channel.sector && (
                          <div className="mt-2 flex items-center gap-1 text-[10px] text-on-surface-variant">
                            <span
                              className="inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 font-semibold"
                              style={{
                                backgroundColor: `${channel.sector.color}24`,
                                color: channel.sector.color,
                              }}
                            >
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{ backgroundColor: channel.sector.color }}
                              />
                              {channel.sector.name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuId((id) => (id === channel.id ? null : channel.id))
                        }
                        className="p-1 text-outline transition-colors hover:text-primary"
                        aria-label="Mais opções"
                      >
                        <span className="material-symbols-outlined">more_vert</span>
                      </button>
                      {openMenuId === channel.id && (
                        <div className="absolute right-0 top-9 z-20 min-w-[11rem] rounded-lg border border-[rgba(63,73,69,0.2)] bg-surface-container-highest/95 py-1 shadow-forest-glow backdrop-blur-xl">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setDeleteTarget({ id: channel.id, name: channel.name });
                            }}
                            className="w-full px-3 py-2 text-left text-xs font-semibold text-red-300 transition hover:bg-red-950/40"
                          >
                            Excluir canal
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span
                      className={`text-xs text-on-surface-variant ${
                        channel.type === 'WHATSAPP' && !isActive ? 'italic' : ''
                      }`}
                    >
                      {channelMetaLine(channel)}
                    </span>
                    <div className="flex flex-wrap justify-end gap-2">
                      {channel.type === 'WHATSAPP' && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await handleRefreshStatus(channel.id);
                              setTimeout(() => fetchChannels(), 1000);
                            } catch (error) {
                              console.error('Erro ao atualizar status:', error);
                            }
                          }}
                          className="rounded-md border border-[rgba(63,73,69,0.25)] bg-surface-container-highest px-4 py-2 text-sm font-medium text-primary transition hover:bg-surface-variant active:scale-[0.98]"
                        >
                          Atualizar status
                        </button>
                      )}
                      {channel.type === 'WHATSAPP' && channel.status !== 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => handleViewQRCode(channel.id)}
                          className="primary-gradient-channel rounded-md px-4 py-2 text-sm font-semibold text-on-primary-channel transition hover:opacity-90 active:scale-[0.98]"
                        >
                          Conectar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-12 flex items-start gap-4 rounded-lg border border-[rgba(63,73,69,0.12)] bg-surface-container-low p-6">
          <span className="material-symbols-outlined shrink-0 text-[#66dd8b]">info</span>
          <p className="text-sm text-on-surface-variant">
            Todos os canais são gerenciados pelo servidor central. No WhatsApp, use{' '}
            <span className="font-semibold text-[#66dd8b]">Atualizar status</span> para sincronizar o
            estado da conexão ou <span className="font-semibold text-[#66dd8b]">Conectar</span> para
            escanear o QR Code.
          </p>
        </div>
      </div>

      {/* Modal de criar canal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-xl border border-[rgba(63,73,69,0.2)] bg-surface-container-highest/95 p-6 shadow-forest-glow backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-headline text-lg font-bold text-on-surface">Criar novo canal</h2>
                <p className="text-xs text-on-surface-variant">
                  Configure integrações com WhatsApp, email e outros canais de atendimento.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-low text-xs text-on-surface-variant hover:bg-surface-variant"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface">
                  Nome do canal
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full rounded-lg border border-[rgba(63,73,69,0.35)] bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-on-surface">
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
                  className="w-full rounded-lg border border-[rgba(63,73,69,0.35)] bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
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
                <label className="mb-1 block text-xs font-semibold text-on-surface">
                  Setores secundários (opcional)
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {sectors.map((sector) => {
                    const isPrimary = formData.primarySectorId === sector.id;
                    const checked = formData.secondarySectorIds.includes(sector.id);
                    return (
                      <label
                        key={sector.id}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                          isPrimary
                            ? 'border-[rgba(63,73,69,0.2)] bg-surface-container-low opacity-70'
                            : 'border-[rgba(63,73,69,0.25)] bg-surface-container-lowest'
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
                        <span className="text-on-surface">{sector.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-on-surface">
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
                    className="w-full rounded-lg border border-[rgba(63,73,69,0.35)] bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="TELEGRAM">Telegram</option>
                    <option value="EMAIL">Email</option>
                    <option value="WEBCHAT">Webchat</option>
                  </select>
                </div>

                {formData.type === 'WHATSAPP' && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-on-surface">
                      Provedor WhatsApp
                    </label>
                    <select
                      value={formData.provider}
                      onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                      className="w-full rounded-lg border border-[rgba(63,73,69,0.35)] bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                    >
                      <option value="evolution">Evolution API</option>
                      <option value="whatsapp_official">WhatsApp Official (Meta Cloud API)</option>
                    </select>
                  </div>
                )}
              </div>

              {formData.type === 'WHATSAPP' && (
                <p className="text-[11px] text-on-surface-variant">
                  {formData.provider === 'whatsapp_official'
                    ? 'Usa a API oficial do WhatsApp (Meta Cloud API). Requer credenciais copiadas do Meta Developers.'
                    : 'Usa Evolution API com a API Key configurada no servidor.'}
                </p>
              )}

              {formData.type === 'WHATSAPP' && formData.provider === 'whatsapp_official' && (
                <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-3">
                  <p className="text-[11px] text-primary-fixed-dim">
                    Preencha com Access Token, App Secret, Phone Number ID, WABA ID e Verify Token obtidos no painel do Meta.
                  </p>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-on-surface">
                      URL do Webhook (colar no Meta)
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={metaWebhookUrl}
                        readOnly
                        className="w-full rounded-lg border border-[rgba(63,73,69,0.35)] bg-surface-container-lowest px-3 py-2 text-xs text-on-surface outline-none"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(metaWebhookUrl);
                            alert('URL do webhook copiada!');
                          } catch {
                            alert('Não foi possível copiar automaticamente.');
                          }
                        }}
                        className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary-fixed-dim transition hover:bg-primary/20"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-on-surface">
                      Access Token
                    </label>
                    <input
                      type="text"
                      value={formData.whatsappToken}
                      onChange={(e) => setFormData({ ...formData, whatsappToken: e.target.value })}
                      placeholder="EAAG..."
                      className="w-full rounded-lg border border-[rgba(63,73,69,0.35)] bg-surface-container-lowest px-3 py-2 text-xs text-on-surface outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-on-surface">
                      App Secret
                    </label>
                    <input
                      type="password"
                      value={formData.whatsappAppSecret}
                      onChange={(e) => setFormData({ ...formData, whatsappAppSecret: e.target.value })}
                      placeholder="Segredo do app Meta"
                      className="w-full rounded-lg border border-[rgba(63,73,69,0.35)] bg-surface-container-lowest px-3 py-2 text-xs text-on-surface outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-on-surface">
                        Phone Number ID
                      </label>
                      <input
                        type="text"
                        value={formData.whatsappPhoneNumberId}
                        onChange={(e) =>
                          setFormData({ ...formData, whatsappPhoneNumberId: e.target.value })
                        }
                        placeholder="Ex: 123456789012345"
                        className="w-full rounded-lg border border-[rgba(63,73,69,0.35)] bg-surface-container-lowest px-3 py-2 text-xs text-on-surface outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-on-surface">
                        WABA ID
                      </label>
                      <input
                        type="text"
                        value={formData.whatsappBusinessAccountId}
                        onChange={(e) =>
                          setFormData({ ...formData, whatsappBusinessAccountId: e.target.value })
                        }
                        placeholder="Ex: 123456789012345"
                        className="w-full rounded-lg border border-[rgba(63,73,69,0.35)] bg-surface-container-lowest px-3 py-2 text-xs text-on-surface outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-on-surface">
                      Webhook Verify Token
                    </label>
                    <input
                      type="text"
                      value={formData.whatsappWebhookVerifyToken}
                      onChange={(e) =>
                        setFormData({ ...formData, whatsappWebhookVerifyToken: e.target.value })
                      }
                      placeholder="Ex: meta_verify_token_2026"
                      className="w-full rounded-lg border border-[rgba(63,73,69,0.35)] bg-surface-container-lowest px-3 py-2 text-xs text-on-surface outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                    />
                    <p className="text-[10px] text-on-surface-variant">
                      Use o mesmo valor no campo &quot;Verify Token&quot; ao validar o webhook no Meta.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-[rgba(63,73,69,0.25)] bg-surface-container-highest px-4 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:bg-surface-variant"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="primary-gradient-channel rounded-lg px-5 py-1.5 text-xs font-semibold text-on-primary-channel transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => {
            if (!checkingConnection) {
              setShowQRModal(false);
              setQrCode(null);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[rgba(63,73,69,0.2)] bg-surface-container-highest/95 p-6 text-center shadow-forest-glow backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 font-headline text-lg font-bold text-[#66dd8b]">Conectar WhatsApp</h2>
            <p className="mb-4 text-xs text-on-surface-variant">
              Escaneie este QR Code com o aplicativo WhatsApp para conectar sua instância.
            </p>
            <div className="mb-4 flex justify-center rounded-xl bg-surface-container-low p-4">
              <img
                src={qrCode}
                alt="QR Code"
                className="h-auto max-w-full rounded-xl border-4 border-[#66dd8b]/50"
              />
            </div>
            {checkingConnection && (
              <div className="mt-3 flex items-center justify-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary-fixed-dim">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#66dd8b] border-t-transparent" />
                Aguardando conexão...
              </div>
            )}
            <div className="mt-5">
              <button
                type="button"
                onClick={() => {
                  setShowQRModal(false);
                  setQrCode(null);
                  setCheckingConnection(false);
                }}
                className="rounded-lg border border-[rgba(63,73,69,0.25)] bg-surface-container-highest px-5 py-1.5 text-xs font-semibold text-on-surface transition hover:bg-surface-variant"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[rgba(63,73,69,0.2)] bg-surface-container-highest/95 p-6 shadow-forest-glow backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4">
              <h2 className="mb-1 font-headline text-lg font-bold text-on-surface">Excluir canal</h2>
              <p className="text-xs text-on-surface-variant">
                Tem certeza que deseja excluir o canal{' '}
                <span className="font-semibold text-on-surface">&quot;{deleteTarget.name}&quot;</span>?
              </p>
              <p className="mt-2 rounded-lg border border-primary/25 bg-primary-container/20 px-3 py-2 text-xs text-on-secondary-container">
                Esta ação não pode ser desfeita e também excluirá a instância na Evolution API, se
                existir.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-[rgba(63,73,69,0.25)] bg-surface-container-highest px-4 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:bg-surface-variant"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleDeleteChannel(deleteTarget.id, deleteTarget.name);
                  setDeleteTarget(null);
                }}
                className="rounded-lg bg-error-container px-5 py-1.5 text-xs font-semibold text-on-error-container transition hover:brightness-110"
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
          <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-surface-container-highest/95 px-4 py-3 shadow-forest-glow backdrop-blur-xl">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#66dd8b]/15 text-[#66dd8b]">
              ✓
            </div>
            <div className="text-xs">
              <p className="font-semibold text-on-surface">Pronto!</p>
              <p className="text-on-surface-variant">{successMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="ml-2 text-xs text-on-surface-variant hover:text-on-surface"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
