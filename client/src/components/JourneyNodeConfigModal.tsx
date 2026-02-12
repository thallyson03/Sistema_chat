import { useState, useEffect } from 'react';
import api from '../utils/api';

interface Channel {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

interface ContactList {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  _count: {
    members: number;
  };
}

interface JourneyNodeConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  nodeType: 'TRIGGER' | 'ACTION' | 'CONDITION' | 'CONTROL';
  nodeLabel: string;
  nodeConfig?: any;
  onSave: (config: any, label: string) => void;
}

export default function JourneyNodeConfigModal({
  isOpen,
  onClose,
  nodeId,
  nodeType,
  nodeLabel,
  nodeConfig = {},
  onSave,
}: JourneyNodeConfigModalProps) {
  const [label, setLabel] = useState(nodeLabel);
  const [config, setConfig] = useState<any>(nodeConfig || {});

  // Dados para selects
  const [channels, setChannels] = useState<Channel[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);

  useEffect(() => {
    setLabel(nodeLabel);
    const initialConfig = nodeConfig || {};
    
    // Se for ACTION e não tiver actionType definido, definir como 'send_message' por padrão
    if (nodeType === 'ACTION' && !initialConfig.actionType) {
      initialConfig.actionType = 'send_message';
    }
    
    setConfig(initialConfig);
  }, [nodeId, nodeLabel, nodeConfig, nodeType]);

  useEffect(() => {
    if (isOpen) {
      if (nodeType === 'ACTION' || nodeType === 'TRIGGER') {
        fetchChannels();
      }
      if (nodeType === 'TRIGGER') {
        fetchContacts();
        fetchContactLists();
      }
    }
  }, [isOpen, nodeType]);

  const fetchChannels = async () => {
    setLoadingChannels(true);
    try {
      const response = await api.get('/api/channels');
      setChannels(response.data.filter((c: Channel) => c.status === 'ACTIVE') || []);
    } catch (error) {
      console.error('Erro ao carregar canais:', error);
    } finally {
      setLoadingChannels(false);
    }
  };

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const response = await api.get('/api/contacts', { params: { limit: 100 } });
      setContacts(response.data?.contacts || response.data || []);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchContactLists = async () => {
    setLoadingLists(true);
    try {
      const response = await api.get('/api/contact-lists');
      setContactLists(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar listas:', error);
    } finally {
      setLoadingLists(false);
    }
  };

  const handleSave = () => {
    onSave(config, label);
    onClose();
  };

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
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
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
          Configurar {nodeType === 'TRIGGER' ? 'Trigger' : nodeType === 'ACTION' ? 'Ação' : nodeType === 'CONDITION' ? 'Condição' : 'Controle'}
        </h2>

        {/* Nome do bloco */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
            Nome do bloco *
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Enviar mensagem de boas-vindas"
            required
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
            }}
          />
        </div>

        {/* Configuração específica por tipo */}
        {nodeType === 'TRIGGER' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                Quando o contato deve entrar na jornada? *
              </label>
              <select
                value={config.triggerType || 'manual'}
                onChange={(e) => setConfig({ ...config, triggerType: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              >
                <option value="manual">Adicionado manualmente</option>
                <option value="new_contact">Novo contato criado</option>
                <option value="new_conversation">Nova conversa iniciada</option>
                <option value="message_received">Recebeu mensagem</option>
                <option value="tag_added">Tag adicionada</option>
                <option value="list_added">Adicionado a uma lista</option>
              </select>
            </div>

            {config.triggerType === 'list_added' && (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                    Lista de contatos *
                  </label>
                  {loadingLists ? (
                    <p style={{ fontSize: '14px', color: '#6b7280' }}>Carregando listas...</p>
                  ) : (
                    <select
                      value={config.listId || ''}
                      onChange={(e) => setConfig({ ...config, listId: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="">Selecione uma lista</option>
                      {contactLists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name} ({list._count.members} contatos)
                        </option>
                      ))}
                    </select>
                  )}
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Apenas contatos desta lista entrarão na jornada
                  </p>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={config.includeExistingContacts || false}
                      onChange={(e) => setConfig({ ...config, includeExistingContacts: e.target.checked })}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                      }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>
                      Executar para contatos já existentes na lista
                    </span>
                  </label>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', marginLeft: '26px' }}>
                    Quando a jornada for ativada, também executará para todos os contatos que já estão nesta lista
                  </p>
                </div>
              </>
            )}

            {config.triggerType === 'tag_added' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                  Tag (opcional)
                </label>
                <input
                  type="text"
                  value={config.tagName || ''}
                  onChange={(e) => setConfig({ ...config, tagName: e.target.value })}
                  placeholder="Ex: cliente-vip"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                Canal (opcional)
              </label>
              {loadingChannels ? (
                <p style={{ fontSize: '14px', color: '#6b7280' }}>Carregando canais...</p>
              ) : (
                <select
                  value={config.channelId || ''}
                  onChange={(e) => setConfig({ ...config, channelId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
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
              )}
            </div>
          </div>
        )}

        {nodeType === 'ACTION' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                Tipo de ação *
              </label>
              <select
                value={config.actionType || 'send_message'}
                onChange={(e) => setConfig({ ...config, actionType: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              >
                <option value="send_message">💬 Enviar mensagem WhatsApp</option>
                <option value="send_email">📧 Enviar email</option>
                <option value="add_tag">🏷️ Adicionar tag</option>
                <option value="remove_tag">➖ Remover tag</option>
                <option value="update_field">📝 Atualizar campo do contato</option>
                <option value="add_to_list">📋 Adicionar à lista</option>
                <option value="remove_from_list">📋 Remover da lista</option>
                <option value="create_ticket">🎫 Criar ticket</option>
                <option value="assign_to_user">👤 Atribuir a usuário</option>
                <option value="move_to_pipeline">🔄 Mover para pipeline</option>
              </select>
            </div>

            {(config.actionType === 'send_message' || (nodeType === 'ACTION' && !config.actionType)) && (
              <>
                <div style={{ 
                  marginBottom: '20px', 
                  padding: '12px', 
                  backgroundColor: '#f0f9ff', 
                  border: '1px solid #0ea5e9', 
                  borderRadius: '8px' 
                }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#0369a1', fontWeight: '500' }}>
                    ⚠️ Esta ação enviará uma mensagem WhatsApp. Configure a mensagem abaixo.
                  </p>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                    Canal WhatsApp *
                  </label>
                  {loadingChannels ? (
                    <p style={{ fontSize: '14px', color: '#6b7280' }}>Carregando canais...</p>
                  ) : (
                    <select
                      value={config.channelId || ''}
                      onChange={(e) => setConfig({ ...config, channelId: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="">Selecione um canal</option>
                      {channels
                        .filter((c) => c.type === 'WHATSAPP')
                        .map((channel) => (
                          <option key={channel.id} value={channel.id}>
                            {channel.name}
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                    Mensagem que será enviada *
                  </label>
                  <textarea
                    value={config.message || ''}
                    onChange={(e) => setConfig({ ...config, message: e.target.value })}
                    placeholder="Ex: Olá {{nome}}! Bem-vindo à nossa jornada. Como posso ajudar?"
                    rows={8}
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: config.message ? '2px solid #10b981' : '2px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      minHeight: '120px',
                    }}
                  />
                  <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                      💡 Use variáveis: {'{'}{'{'}nome{'}'}{'}'}, {'{'}{'{'}telefone{'}'}{'}'}, {'{'}{'{'}email{'}'}{'}'}
                    </p>
                    <span style={{ 
                      fontSize: '12px', 
                      color: config.message ? '#10b981' : '#ef4444',
                      fontWeight: '500'
                    }}>
                      {config.message ? `✓ ${config.message.length} caracteres` : '⚠️ Mensagem obrigatória'}
                    </span>
                  </div>
                  
                  {/* Preview da mensagem */}
                  {config.message && (
                    <div style={{ 
                      marginTop: '12px', 
                      padding: '12px', 
                      backgroundColor: '#f9fafb', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '6px' 
                    }}>
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 8px 0', fontWeight: '500' }}>
                        📋 Preview (exemplo com dados fictícios):
                      </p>
                      <p style={{ 
                        fontSize: '14px', 
                        color: '#1f2937', 
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        lineHeight: '1.6'
                      }}>
                        {config.message
                          .replace(/\{\{nome\}\}/g, 'João Silva')
                          .replace(/\{\{telefone\}\}/g, '(85) 99999-9999')
                          .replace(/\{\{email\}\}/g, 'joao@exemplo.com')}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {config.actionType === 'add_tag' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                  Nome da tag *
                </label>
                <input
                  type="text"
                  value={config.tagName || ''}
                  onChange={(e) => setConfig({ ...config, tagName: e.target.value })}
                  placeholder="Ex: cliente-vip"
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>
            )}

            {config.actionType === 'move_to_pipeline' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                  Pipeline (em desenvolvimento)
                </label>
                <input
                  type="text"
                  value={config.pipelineId || ''}
                  onChange={(e) => setConfig({ ...config, pipelineId: e.target.value })}
                  placeholder="ID do pipeline"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>
            )}
          </div>
        )}

        {nodeType === 'CONDITION' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                Tipo de condição *
              </label>
              <select
                value={config.conditionType || 'has_tag'}
                onChange={(e) => setConfig({ ...config, conditionType: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              >
                <option value="has_tag">🏷️ Tem tag</option>
                <option value="has_field">📊 Campo do contato</option>
                <option value="message_received">💬 Recebeu mensagem</option>
                <option value="in_list">📋 Está na lista</option>
                <option value="date_time">📅 Data/Hora</option>
                <option value="field_equals">✅ Campo igual a</option>
                <option value="field_contains">🔍 Campo contém</option>
                <option value="in_pipeline">🔄 Está no pipeline</option>
              </select>
            </div>

            {config.conditionType === 'has_tag' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                  Nome da tag *
                </label>
                <input
                  type="text"
                  value={config.tagName || ''}
                  onChange={(e) => setConfig({ ...config, tagName: e.target.value })}
                  placeholder="Ex: cliente-vip"
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>
            )}

            {config.conditionType === 'in_list' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                  Lista de contatos *
                </label>
                {loadingLists ? (
                  <p style={{ fontSize: '14px', color: '#6b7280' }}>Carregando listas...</p>
                ) : (
                  <select
                    value={config.listId || ''}
                    onChange={(e) => setConfig({ ...config, listId: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  >
                    <option value="">Selecione uma lista</option>
                    {contactLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name} ({list._count.members} contatos)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {(config.conditionType === 'has_field' || config.conditionType === 'field_equals' || config.conditionType === 'field_contains') && (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                    Campo do contato *
                  </label>
                  <select
                    value={config.fieldName || 'name'}
                    onChange={(e) => setConfig({ ...config, fieldName: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  >
                    <option value="name">Nome</option>
                    <option value="email">Email</option>
                    <option value="phone">Telefone</option>
                  </select>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                    Valor para comparar *
                  </label>
                  <input
                    type="text"
                    value={config.fieldValue || ''}
                    onChange={(e) => setConfig({ ...config, fieldValue: e.target.value })}
                    placeholder="Digite o valor"
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  />
                </div>
              </>
            )}

            {config.conditionType === 'date_time' && (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                    Tipo de comparação *
                  </label>
                  <select
                    value={config.dateComparison || 'before'}
                    onChange={(e) => setConfig({ ...config, dateComparison: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  >
                    <option value="before">Antes de</option>
                    <option value="after">Depois de</option>
                    <option value="between">Entre</option>
                  </select>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                    Data/Hora *
                  </label>
                  <input
                    type="datetime-local"
                    value={config.dateValue || ''}
                    onChange={(e) => setConfig({ ...config, dateValue: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  />
                </div>
              </>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                Operador *
              </label>
              <select
                value={config.operator || 'equals'}
                onChange={(e) => setConfig({ ...config, operator: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              >
                <option value="equals">Igual a</option>
                <option value="not_equals">Diferente de</option>
                <option value="contains">Contém</option>
                <option value="not_contains">Não contém</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                Valor (opcional)
              </label>
              <input
                type="text"
                value={config.value || ''}
                onChange={(e) => setConfig({ ...config, value: e.target.value })}
                placeholder="Valor para comparar"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>
        )}

        {nodeType === 'CONTROL' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                Tipo de controle *
              </label>
              <select
                value={config.controlType || 'delay'}
                onChange={(e) => setConfig({ ...config, controlType: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              >
                <option value="delay">⏱️ Esperar (delay)</option>
                <option value="split">🔀 Dividir tráfego (A/B)</option>
                <option value="wait_event">⏳ Aguardar evento</option>
                <option value="loop">🔁 Loop / Repetir</option>
                <option value="stop">🛑 Parar jornada</option>
              </select>
            </div>

            {config.controlType === 'delay' && (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                    Tempo de espera *
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="number"
                      value={config.delayValue || 1}
                      onChange={(e) => setConfig({ ...config, delayValue: parseInt(e.target.value) || 1 })}
                      min="1"
                      style={{
                        flex: 1,
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    />
                    <select
                      value={config.delayUnit || 'hours'}
                      onChange={(e) => setConfig({ ...config, delayUnit: e.target.value })}
                      style={{
                        flex: 1,
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="minutes">Minutos</option>
                      <option value="hours">Horas</option>
                      <option value="days">Dias</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {config.controlType === 'split' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                  Percentual para caminho A (0-100) *
                </label>
                <input
                  type="number"
                  value={config.splitPercent || 50}
                  onChange={(e) => setConfig({ ...config, splitPercent: parseInt(e.target.value) || 50 })}
                  min="0"
                  max="100"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  O restante vai para o caminho B
                </p>
              </div>
            )}

            {config.controlType === 'wait_event' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                  Tipo de evento *
                </label>
                <select
                  value={config.eventType || 'message_received'}
                  onChange={(e) => setConfig({ ...config, eventType: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                >
                  <option value="message_received">💬 Recebeu mensagem</option>
                  <option value="tag_added">🏷️ Tag adicionada</option>
                  <option value="list_added">📋 Adicionado à lista</option>
                  <option value="field_updated">📝 Campo atualizado</option>
                </select>
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  A jornada aguardará este evento antes de continuar
                </p>
              </div>
            )}

            {config.controlType === 'loop' && (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                    Número de repetições *
                  </label>
                  <input
                    type="number"
                    value={config.loopCount || 1}
                    onChange={(e) => setConfig({ ...config, loopCount: parseInt(e.target.value) || 1 })}
                    min="1"
                    max="100"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                    Delay entre repetições (opcional)
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="number"
                      value={config.loopDelay || 0}
                      onChange={(e) => setConfig({ ...config, loopDelay: parseInt(e.target.value) || 0 })}
                      min="0"
                      style={{
                        flex: 1,
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    />
                    <select
                      value={config.loopDelayUnit || 'minutes'}
                      onChange={(e) => setConfig({ ...config, loopDelayUnit: e.target.value })}
                      style={{
                        flex: 1,
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="minutes">Minutos</option>
                      <option value="hours">Horas</option>
                      <option value="days">Dias</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {config.controlType === 'stop' && (
              <div style={{ 
                marginBottom: '20px', 
                padding: '12px', 
                backgroundColor: '#fee2e2', 
                border: '1px solid #ef4444', 
                borderRadius: '8px' 
              }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#991b1b', fontWeight: '500' }}>
                  ⚠️ Esta ação interromperá a jornada para este contato. O contato não continuará no fluxo após este ponto.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Botões */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!label.trim() || (nodeType === 'ACTION' && config.actionType === 'send_message' && (!config.message || !config.channelId))}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: (!label.trim() || (nodeType === 'ACTION' && config.actionType === 'send_message' && (!config.message || !config.channelId))) ? '#9ca3af' : '#3b82f6',
              color: 'white',
              cursor: (!label.trim() || (nodeType === 'ACTION' && config.actionType === 'send_message' && (!config.message || !config.channelId))) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

