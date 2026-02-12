import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

interface Bot {
  id: string;
  name: string;
  description?: string;
  channelId: string;
  isActive: boolean;
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
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    channelId: '',
    welcomeMessage: '',
    fallbackMessage: '',
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
        welcomeMessage: '',
        fallbackMessage: '',
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
    return <div style={{ padding: '20px' }}>Carregando...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Chatbots</h1>
        <button
          onClick={() => setShowModal(true)}
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
          + Novo Bot
        </button>
      </div>

      {bots.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          backgroundColor: 'white', 
          borderRadius: '8px',
          border: '2px dashed #d1d5db',
        }}>
          <p style={{ color: '#6b7280', marginBottom: '20px' }}>Nenhum bot criado</p>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Criar Primeiro Bot
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {bots.map((bot) => (
            <div
              key={bot.id}
              style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                border: '1px solid #e5e7eb',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>{bot.name}</h3>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        backgroundColor: bot.isActive ? '#10b981' : '#ef4444',
                        color: 'white',
                        fontWeight: 'bold',
                      }}
                    >
                      {bot.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  {bot.description && (
                    <p style={{ margin: '5px 0', color: '#6b7280', fontSize: '14px' }}>{bot.description}</p>
                  )}
                  {bot.channel && (
                    <p style={{ margin: '5px 0', color: '#6b7280', fontSize: '14px' }}>
                      <strong>Canal:</strong> {bot.channel.name} ({bot.channel.type})
                    </p>
                  )}
                  {bot._count && (
                    <div style={{ display: 'flex', gap: '15px', marginTop: '10px', fontSize: '13px', color: '#6b7280' }}>
                      <span><strong>{bot._count.intents}</strong> Intents</span>
                      <span><strong>{bot._count.flows}</strong> Fluxos</span>
                      <span><strong>{bot._count.sessions}</strong> Sessões</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                  <button
                    onClick={() => navigate(`/bots/${bot.id}/flows/visual`)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 'bold',
                    }}
                  >
                    🎨 Criar Fluxo Visual
                  </button>
                  <button
                    onClick={() => {
                      setSelectedBotId(bot.id);
                      setShowVariablesModal(true);
                      fetchVariables(bot.id);
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    📊 Variáveis
                  </button>
                  <button
                    onClick={() => navigate(`/bots/${bot.id}`)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Ver Detalhes
                  </button>
                  <button
                    onClick={() => handleDeleteBot(bot.id, bot.name)}
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
            </div>
          ))}
        </div>
      )}

      {/* Modal Criar Bot */}
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
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '8px',
              maxWidth: '500px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Novo Bot</h2>
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
                    backgroundColor: '#fef3c7', 
                    borderRadius: '5px',
                    border: '1px solid #fbbf24',
                    marginBottom: '10px',
                  }}>
                    <p style={{ margin: 0, fontSize: '13px', color: '#92400e' }}>
                      ⚠️ Nenhum canal disponível. 
                      <a 
                        href="/channels" 
                        style={{ color: '#3b82f6', textDecoration: 'underline', marginLeft: '5px' }}
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
                    backgroundColor: channels.length === 0 ? '#f3f4f6' : 'white',
                    cursor: channels.length === 0 ? 'not-allowed' : 'pointer',
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
                  Mensagem de Boas-vindas
                </label>
                <input
                  type="text"
                  value={formData.welcomeMessage}
                  onChange={(e) => setFormData({ ...formData, welcomeMessage: e.target.value })}
                  placeholder="Ex: Olá! Como posso ajudar?"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '5px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                  Mensagem de Fallback
                </label>
                <input
                  type="text"
                  value={formData.fallbackMessage}
                  onChange={(e) => setFormData({ ...formData, fallbackMessage: e.target.value })}
                  placeholder="Ex: Desculpe, não entendi. Pode reformular?"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '5px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                  disabled={submitting}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: submitting ? '#9ca3af' : '#3b82f6',
                    color: 'white',
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
          onClick={() => {
            setShowVariablesModal(false);
            setShowVariableForm(false);
            setEditingVariable(null);
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '8px',
              maxWidth: '700px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Variáveis do Bot</h2>
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
                  color: '#6b7280',
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
                    backgroundColor: '#10b981',
                    color: 'white',
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
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>
                    Nenhuma variável criada. Use variáveis em mensagens com: {'{{nomeVariavel}}'}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {variables.map((variable) => (
                      <div
                        key={variable.id}
                        style={{
                          padding: '15px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '5px',
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
                                backgroundColor: variable.isGlobal ? '#3b82f6' : '#6b7280',
                                color: 'white',
                              }}
                            >
                              {variable.isGlobal ? 'Global' : 'Sessão'}
                            </span>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '3px',
                                fontSize: '11px',
                                backgroundColor: '#f3f4f6',
                                color: '#374151',
                              }}
                            >
                              {variable.type}
                            </span>
                          </div>
                          {variable.description && (
                            <p style={{ margin: '5px 0', color: '#6b7280', fontSize: '13px' }}>{variable.description}</p>
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
                    <small style={{ color: '#6b7280' }}>Use em mensagens: {'{{' + variableFormData.name + '}}'}</small>
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
                        backgroundColor: '#6b7280',
                        color: 'white',
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
                        backgroundColor: '#10b981',
                        color: 'white',
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

