import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

interface Bot {
  id: string;
  name: string;
  description?: string;
  channelId: string;
  isActive: boolean;
  autoCloseEnabled?: boolean;
  autoCloseAfterMinutes?: number | null;
  autoCloseMessage?: string | null;
  channel?: {
    id: string;
    name: string;
    type: string;
  };
  _count?: {
    intents: number;
    flows: number;
    sessions: number;
  };
}

interface Channel {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface Sector {
  id: string;
  name: string;
  color: string;
}

interface BotVariable {
  id: string;
  name: string;
  type: string;
  defaultValue?: string;
  isGlobal: boolean;
  description?: string;
}

export default function Bots() {
  const navigate = useNavigate();
  const [bots, setBots] = useState<Bot[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    channelId: '',
    sectorId: '',
    welcomeMessage: '',
    fallbackMessage: '',
    autoCloseEnabled: false,
    autoCloseAfterMinutes: 0,
    autoCloseMessage: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [showVariablesModal, setShowVariablesModal] = useState(false);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [variables, setVariables] = useState<BotVariable[]>([]);
  const [showVariableForm, setShowVariableForm] = useState(false);
  const [editingVariable, setEditingVariable] = useState<BotVariable | null>(null);
  const [variableFormData, setVariableFormData] = useState({
    name: '',
    type: 'STRING' as 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'JSON',
    defaultValue: '',
    isGlobal: false,
    description: '',
  });

  useEffect(() => {
    fetchBots();
    fetchChannels();
    fetchSectors();
  }, []);

  const fetchBots = async () => {
    try {
      const response = await api.get('/api/bots');
      setBots(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar bots:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const response = await api.get('/api/channels');
      const channelsData = response.data || [];
      console.log('Canais carregados:', channelsData);
      setChannels(channelsData);
      
      if (channelsData.length === 0) {
        console.warn('Nenhum canal encontrado. Crie um canal primeiro na página de Canais.');
      }
    } catch (error: any) {
      console.error('Erro ao carregar canais:', error);
      console.error('Erro completo:', error.response?.data || error.message);
      alert('Erro ao carregar canais. Verifique o console para mais detalhes.');
    }
  };

  const fetchSectors = async () => {
    try {
      const response = await api.get('/api/sectors');
      setSectors(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
    }
  };

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.channelId) {
      alert('Preencha nome e canal');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/bots', formData);
      setShowModal(false);
      setFormData({
        name: '',
        description: '',
        channelId: '',
        sectorId: '',
        welcomeMessage: '',
        fallbackMessage: '',
        autoCloseEnabled: false,
        autoCloseAfterMinutes: 0,
        autoCloseMessage: '',
      });
      fetchBots();
      alert('Bot criado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao criar bot:', error);
      alert(error.response?.data?.error || 'Erro ao criar bot');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleBotActive = async (bot: Bot) => {
    try {
      await api.put(`/api/bots/${bot.id}`, {
        isActive: !bot.isActive,
      });
      await fetchBots();
      alert(!bot.isActive ? 'Bot retomado com sucesso!' : 'Bot pausado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao pausar/retomar bot:', error);
      alert(error.response?.data?.error || 'Erro ao atualizar status do bot');
    }
  };

  const handleDeleteBot = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja deletar o bot "${name}"?`)) {
      return;
    }

    try {
      await api.delete(`/api/bots/${id}`);
      fetchBots();
      alert('Bot deletado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao deletar bot:', error);
      alert(error.response?.data?.error || 'Erro ao deletar bot');
    }
  };

  if (loading) {
    return <div className="p-5 text-on-surface-variant">Carregando...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl p-6 font-body text-on-surface">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-headline text-3xl font-bold text-on-surface">Chatbots</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Gerencie bots, fluxos visuais e variáveis por canal.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="primary-gradient-channel rounded-lg px-4 py-2.5 text-sm font-bold text-[#003919] shadow-emerald-send transition hover:brightness-110"
        >
          + Novo Bot
        </button>
      </div>

      {bots.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low py-10 text-center">
          <p className="mb-5 text-on-surface-variant">Nenhum bot criado</p>
          <button
            onClick={() => setShowModal(true)}
            className="primary-gradient-channel rounded-lg px-4 py-2 text-sm font-bold text-[#003919] shadow-emerald-send transition hover:brightness-110"
          >
            Criar Primeiro Bot
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {bots.map((bot) => (
            <div
              key={bot.id}
              className="rounded-xl border border-outline-variant bg-surface-container-low p-5 shadow-forest-glow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <h3 className="m-0 text-lg font-semibold text-on-surface">{bot.name}</h3>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                        bot.isActive
                          ? 'border border-primary/25 bg-primary/20 text-primary-fixed-dim'
                          : 'border border-red-500/25 bg-red-500/10 text-red-300'
                      }`}
                    >
                      {bot.isActive ? 'Ativo' : 'Pausado'}
                    </span>
                  </div>
                  {bot.description && (
                    <p className="my-1 text-sm text-on-surface-variant">{bot.description}</p>
                  )}
                  {bot.channel && (
                    <p className="my-1 text-sm text-on-surface-variant">
                      <strong className="text-on-surface">Canal:</strong> {bot.channel.name} ({bot.channel.type})
                    </p>
                  )}
                  {bot._count && (
                    <div className="mt-2.5 flex gap-4 text-xs text-on-surface-variant">
                      <span><strong className="text-primary-fixed-dim">{bot._count.intents}</strong> Intents</span>
                      <span><strong className="text-primary-fixed-dim">{bot._count.flows}</strong> Fluxos</span>
                      <span><strong className="text-primary-fixed-dim">{bot._count.sessions}</strong> Sessões</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleToggleBotActive(bot)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      bot.isActive
                        ? 'border border-amber-500/25 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
                        : 'border border-primary/25 bg-primary/10 text-primary-fixed-dim hover:bg-primary/20'
                    }`}
                  >
                    {bot.isActive ? 'Pausar Bot' : 'Retomar Bot'}
                  </button>
                  <button
                    onClick={() => navigate(`/bots/${bot.id}/flows/visual`)}
                    className="rounded-md border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary-fixed-dim transition hover:bg-primary/20"
                  >
                    🎨 Criar Fluxo Visual
                  </button>
                  <button
                    onClick={() => {
                      setSelectedBotId(bot.id);
                      setShowVariablesModal(true);
                      fetchVariables(bot.id);
                    }}
                    className="rounded-md border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20"
                  >
                    📊 Variáveis
                  </button>
                  <button
                    onClick={() => navigate(`/bots/${bot.id}`)}
                    className="rounded-md border border-outline-variant bg-surface-container-highest px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:bg-surface-container"
                  >
                    Ver Detalhes
                  </button>
                  <button
                    onClick={() => handleDeleteBot(bot.id, bot.name)}
                    className="rounded-md border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
                  >
                    Deletar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Criar Bot */}
      {showModal && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bot-modal max-h-[90vh] w-[90%] max-w-[540px] overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-highest p-6 text-on-surface shadow-forest-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-5 mt-0 font-headline text-xl font-bold text-on-surface">Novo Bot</h2>
            <form onSubmit={handleCreateBot}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Bot de Atendimento"
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
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição do bot..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '5px',
                    fontSize: '14px',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                  Canal *
                </label>
                {channels.length === 0 ? (
                  <div style={{
                    padding: '15px', 
                    backgroundColor: 'rgba(245, 158, 11, 0.12)', 
                    borderRadius: '5px',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    marginBottom: '10px',
                  }}>
                    <p style={{ margin: 0, fontSize: '13px', color: '#fde68a' }}>
                      ⚠️ Nenhum canal disponível. 
                      <a 
                        href="/channels" 
                        style={{ color: '#66dd8b', textDecoration: 'underline', marginLeft: '5px' }}
                      >
                        Crie um canal primeiro
                      </a>
                    </p>
                  </div>
                ) : null}
                <select
                  value={formData.channelId}
                  onChange={(e) => setFormData({ ...formData, channelId: e.target.value })}
                  required
                  disabled={channels.length === 0}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '5px',
                    fontSize: '14px',
                    backgroundColor: channels.length === 0 ? '#1f231f' : '#121412',
                    cursor: channels.length === 0 ? 'not-allowed' : 'pointer',
                    color: '#e5e7eb',
                  }}
                >
                  <option value="">Selecione um canal</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name} ({channel.type}) {channel.status ? `- ${channel.status}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                  Setor atendido (opcional)
                </label>
                <select
                  value={formData.sectorId}
                  onChange={(e) => setFormData({ ...formData, sectorId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '5px',
                    fontSize: '14px',
                    backgroundColor: '#121412',
                    color: '#e5e7eb',
                  }}
                >
                  <option value="">Usar fallback do canal</option>
                  {sectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Configuração de encerramento automático */}
              <div style={{ marginBottom: '15px', padding: '12px', borderRadius: '6px', backgroundColor: 'rgba(46,49,46,0.55)', border: '1px solid rgba(63,73,69,0.55)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>
                  <input
                    type="checkbox"
                    checked={formData.autoCloseEnabled}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        autoCloseEnabled: e.target.checked,
                      })
                    }
                  />
                  Encerrar atendimento automaticamente por inatividade
                </label>
                {formData.autoCloseEnabled && (
                  <>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' }}>
                        Minutos sem resposta do cliente *
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={formData.autoCloseAfterMinutes || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            autoCloseAfterMinutes: Number(e.target.value) || 0,
                          })
                        }
                        placeholder="Ex: 15"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '5px',
                          fontSize: '14px',
                        }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' }}>
                        Mensagem de encerramento *
                      </label>
                      <textarea
                        value={formData.autoCloseMessage}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            autoCloseMessage: e.target.value,
                          })
                        }
                        placeholder="Ex: Encerramos este atendimento por inatividade. Se precisar, é só mandar uma nova mensagem."
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '5px',
                          fontSize: '14px',
                        }}
                        required
                      />
                      <small style={{ color: '#9ca3af', fontSize: '12px' }}>
                        Você pode usar variáveis do bot, por exemplo: {'{{Nome}}'}.
                      </small>
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#2e312e',
                    color: '#e5e7eb',
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
                  disabled={submitting}
                  style={{
                    padding: '10px 20px',
                    background: submitting ? '#4b5563' : 'linear-gradient(135deg, #66dd8b 0%, #34d399 100%)',
                    color: submitting ? '#d1d5db' : '#003919',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  {submitting ? 'Criando...' : 'Criar Bot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Variáveis */}
      {showVariablesModal && selectedBotId && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => {
            setShowVariablesModal(false);
            setShowVariableForm(false);
            setEditingVariable(null);
          }}
        >
          <div
            className="bot-modal max-h-[90vh] w-[90%] max-w-[700px] overflow-auto rounded-xl border border-outline-variant bg-surface-container-highest p-6 text-on-surface shadow-forest-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#e5e7eb' }}>Variáveis do Bot</h2>
              <button
                onClick={() => {
                  setShowVariablesModal(false);
                  setShowVariableForm(false);
                  setEditingVariable(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#9ca3af',
                }}
              >
                ×
              </button>
            </div>

            {!showVariableForm ? (
              <>
                <button
                  onClick={() => {
                    setShowVariableForm(true);
                    setEditingVariable(null);
                    setVariableFormData({
                      name: '',
                      type: 'STRING',
                      defaultValue: '',
                      isGlobal: false,
                      description: '',
                    });
                  }}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #66dd8b 0%, #34d399 100%)',
                    color: '#003919',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    marginBottom: '20px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  + Nova Variável
                </button>

                {variables.length === 0 ? (
                  <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px' }}>
                    Nenhuma variável criada. Use variáveis em mensagens com: {'{{nomeVariavel}}'}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {variables.map((variable) => (
                      <div
                        key={variable.id}
                        style={{
                          padding: '15px',
                          border: '1px solid rgba(63,73,69,0.55)',
                          borderRadius: '5px',
                          backgroundColor: 'rgba(46,49,46,0.45)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                            <strong style={{ fontSize: '16px' }}>{variable.name}</strong>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '3px',
                                fontSize: '11px',
                                backgroundColor: variable.isGlobal ? 'rgba(102,221,139,0.16)' : 'rgba(156,163,175,0.16)',
                                color: variable.isGlobal ? '#a7f3d0' : '#d1d5db',
                              }}
                            >
                              {variable.isGlobal ? 'Global' : 'Sessão'}
                            </span>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '3px',
                                fontSize: '11px',
                                backgroundColor: 'rgba(63,73,69,0.35)',
                                color: '#cbd5e1',
                              }}
                            >
                              {variable.type}
                            </span>
                          </div>
                          {variable.description && (
                            <p style={{ margin: '5px 0', color: '#9ca3af', fontSize: '13px' }}>{variable.description}</p>
                          )}
                          {variable.defaultValue && (
                            <p style={{ margin: '5px 0', color: '#9ca3af', fontSize: '12px' }}>
                              Padrão: {variable.defaultValue}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              setEditingVariable(variable);
                              setVariableFormData({
                                name: variable.name,
                                type: variable.type as any,
                                defaultValue: variable.defaultValue || '',
                                isGlobal: variable.isGlobal,
                                description: variable.description || '',
                              });
                              setShowVariableForm(true);
                            }}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: 'rgba(102,221,139,0.14)',
                              color: '#a7f3d0',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            Editar
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`Deletar variável "${variable.name}"?`)) {
                                try {
                                  await api.delete(`/api/bots/variables/${variable.id}`);
                                  fetchVariables(selectedBotId);
                                } catch (error: any) {
                                  alert(error.response?.data?.error || 'Erro ao deletar variável');
                                }
                              }
                            }}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: 'rgba(239,68,68,0.16)',
                              color: '#fca5a5',
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
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div>
                <h3 style={{ marginTop: 0, marginBottom: '20px' }}>
                  {editingVariable ? 'Editar Variável' : 'Nova Variável'}
                </h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      if (editingVariable) {
                        await api.put(`/api/bots/variables/${editingVariable.id}`, variableFormData);
                      } else {
                        await api.post(`/api/bots/${selectedBotId}/variables`, variableFormData);
                      }
                      setShowVariableForm(false);
                      setEditingVariable(null);
                      fetchVariables(selectedBotId!);
                      setVariableFormData({
                        name: '',
                        type: 'STRING',
                        defaultValue: '',
                        isGlobal: false,
                        description: '',
                      });
                    } catch (error: any) {
                      alert(error.response?.data?.error || 'Erro ao salvar variável');
                    }
                  }}
                >
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nome *</label>
                    <input
                      type="text"
                      value={variableFormData.name}
                      onChange={(e) => setVariableFormData({ ...variableFormData, name: e.target.value })}
                      placeholder="Ex: firstName, email, total"
                      required
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
                    />
                    <small style={{ color: '#9ca3af' }}>Use em mensagens: {'{{' + variableFormData.name + '}}'}</small>
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Tipo *</label>
                    <select
                      value={variableFormData.type}
                      onChange={(e) => setVariableFormData({ ...variableFormData, type: e.target.value as any })}
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
                    >
                      <option value="STRING">Texto (STRING)</option>
                      <option value="NUMBER">Número (NUMBER)</option>
                      <option value="BOOLEAN">Booleano (BOOLEAN)</option>
                      <option value="DATE">Data (DATE)</option>
                      <option value="JSON">JSON</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Valor Padrão</label>
                    <input
                      type="text"
                      value={variableFormData.defaultValue}
                      onChange={(e) => setVariableFormData({ ...variableFormData, defaultValue: e.target.value })}
                      placeholder="Valor inicial (opcional)"
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
                    />
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={variableFormData.isGlobal}
                        onChange={(e) => setVariableFormData({ ...variableFormData, isGlobal: e.target.checked })}
                      />
                      <span>Variável Global (compartilhada entre todas as sessões)</span>
                    </label>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Descrição</label>
                    <textarea
                      value={variableFormData.description}
                      onChange={(e) => setVariableFormData({ ...variableFormData, description: e.target.value })}
                      placeholder="Descrição da variável (opcional)"
                      rows={3}
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowVariableForm(false);
                        setEditingVariable(null);
                      }}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#2e312e',
                        color: '#e5e7eb',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      style={{
                        padding: '10px 20px',
                        background: 'linear-gradient(135deg, #66dd8b 0%, #34d399 100%)',
                        color: '#003919',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                      }}
                    >
                      {editingVariable ? 'Atualizar' : 'Criar'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

  const fetchVariables = async (botId: string) => {
    try {
      const response = await api.get(`/api/bots/${botId}/variables`);
      setVariables(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar variáveis:', error);
    }
  };

