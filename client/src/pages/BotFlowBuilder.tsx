import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';

interface Flow {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  steps: FlowStep[];
}

interface FlowStep {
  id: string;
  type: string;
  order: number;
  config: any;
  nextStepId?: string;
  response?: Response;
  conditions?: FlowCondition[];
  intent?: {
    id: string;
    name: string;
  };
}

interface FlowCondition {
  id: string;
  condition: string;
  operator: string;
  value: string;
  trueStepId?: string;
  falseStepId?: string;
}

interface Response {
  id: string;
  type: string;
  content: string;
  buttons?: any;
  mediaUrl?: string;
}

interface Intent {
  id: string;
  name: string;
  keywords: string[];
}

export default function BotFlowBuilder() {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const [bot, setBot] = useState<any>(null);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [showStepModal, setShowStepModal] = useState(false);
  const [editingStep, setEditingStep] = useState<FlowStep | null>(null);
  const [stepFormData, setStepFormData] = useState({
    type: 'MESSAGE',
    content: '',
    order: 0,
    intentId: '',
    config: {} as any,
  });
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [flowFormData, setFlowFormData] = useState({
    name: '',
    description: '',
  });
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (botId) {
      fetchBot();
      fetchFlows();
      fetchIntents();
    }
  }, [botId]);

  const fetchBot = async () => {
    try {
      const response = await api.get(`/api/bots/${botId}`);
      setBot(response.data);
    } catch (error) {
      console.error('Erro ao carregar bot:', error);
    }
  };

  const fetchFlows = async () => {
    try {
      const response = await api.get(`/api/bots/${botId}/flows`);
      setFlows(response.data || []);
      if (response.data && response.data.length > 0 && !selectedFlow) {
        setSelectedFlow(response.data[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar fluxos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchIntents = async () => {
    try {
      const response = await api.get(`/api/bots/${botId}/intents`);
      setIntents(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar intents:', error);
    }
  };

  const handleCreateFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flowFormData.name) {
      alert('Preencha o nome do fluxo');
      return;
    }

    try {
      const response = await api.post(`/api/bots/${botId}/flows`, {
        name: flowFormData.name,
        description: flowFormData.description || null,
      });
      setFlows([...flows, response.data]);
      setSelectedFlow(response.data);
      setShowFlowModal(false);
      setFlowFormData({ name: '', description: '' });
      alert('Fluxo criado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao criar fluxo:', error);
      alert(error.response?.data?.error || 'Erro ao criar fluxo');
    }
  };

  const handleCreateStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFlow) {
      alert('Selecione um fluxo primeiro');
      return;
    }

    try {
      // Criar resposta primeiro se for tipo MESSAGE
      let responseId = null;
      if (stepFormData.type === 'MESSAGE' && stepFormData.content) {
        const response = await api.post('/api/bots/responses', {
          type: 'TEXT',
          content: stepFormData.content,
          intentId: stepFormData.intentId || null,
        });
        responseId = response.data.id;
      }

      // Criar step via API
      const stepResponse = await api.post(`/api/bots/flows/${selectedFlow.id}/steps`, {
        type: stepFormData.type,
        order: stepFormData.order,
        config: stepFormData.config,
        intentId: stepFormData.intentId || null,
        responseId: responseId,
      });

      // Buscar fluxo atualizado com steps
      const updatedFlowResponse = await api.get(`/api/bots/flows/${selectedFlow.id}`);
      const updatedFlow = updatedFlowResponse.data;
      
      setSelectedFlow(updatedFlow);
      setFlows(flows.map(f => f.id === selectedFlow.id ? updatedFlow : f));

      setShowStepModal(false);
      setEditingStep(null);
      setStepFormData({ type: 'MESSAGE', content: '', order: 0, intentId: '', config: {} });
      alert('Step criado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao criar step:', error);
      alert(error.response?.data?.error || 'Erro ao criar step');
    }
  };

  const getStepTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      MESSAGE: '💬 Mensagem',
      CONDITION: '🔀 Condição',
      API_CALL: '🔌 Chamada API',
      HANDOFF: '👤 Transferir para Humano',
      DELAY: '⏱️ Aguardar',
    };
    return labels[type] || type;
  };

  const getStepColor = (type: string) => {
    const colors: { [key: string]: string } = {
      MESSAGE: '#3b82f6',
      CONDITION: '#f59e0b',
      API_CALL: '#8b5cf6',
      HANDOFF: '#ef4444',
      DELAY: '#6b7280',
    };
    return colors[type] || '#6b7280';
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Carregando...</div>;
  }

  if (!bot) {
    return <div style={{ padding: '20px' }}>Bot não encontrado</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', backgroundColor: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <button
              onClick={() => navigate('/bots')}
              style={{
                marginBottom: '10px',
                padding: '8px 16px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
            >
              ← Voltar
            </button>
            <h2 style={{ margin: 0 }}>Criar Fluxo - {bot.name}</h2>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <select
              value={selectedFlow?.id || ''}
              onChange={(e) => {
                const flow = flows.find(f => f.id === e.target.value);
                setSelectedFlow(flow || null);
              }}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '5px',
                fontSize: '14px',
              }}
            >
              <option value="">Selecione um fluxo</option>
              {flows.map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowFlowModal(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              + Novo Fluxo
            </button>
            <button
              onClick={() => setShowStepModal(true)}
              disabled={!selectedFlow}
              style={{
                padding: '8px 16px',
                backgroundColor: !selectedFlow ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: !selectedFlow ? 'not-allowed' : 'pointer',
                fontSize: '14px',
              }}
            >
              + Adicionar Step
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={canvasRef}
        style={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: '#f9fafb',
          padding: '40px',
          position: 'relative',
        }}
      >
        {!selectedFlow ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px', 
            color: '#6b7280' 
          }}>
            <p style={{ fontSize: '18px', marginBottom: '10px' }}>Nenhum fluxo selecionado</p>
            <p>Crie um novo fluxo ou selecione um existente para começar</p>
          </div>
        ) : selectedFlow.steps.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px', 
            color: '#6b7280' 
          }}>
            <p style={{ fontSize: '18px', marginBottom: '10px' }}>Fluxo vazio</p>
            <p>Adicione steps para criar o fluxo do chatbot</p>
            <button
              onClick={() => setShowStepModal(true)}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
            >
              + Adicionar Primeiro Step
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
            {/* Start Node */}
            <div
              style={{
                padding: '15px 25px',
                backgroundColor: '#10b981',
                color: 'white',
                borderRadius: '8px',
                fontWeight: 'bold',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              🚀 Início
            </div>

            {/* Steps */}
            {selectedFlow.steps.map((step, index) => (
              <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                {/* Connection Line */}
                <div style={{ width: '3px', height: '20px', backgroundColor: '#d1d5db' }} />

                {/* Step Node */}
                <div
                  onClick={() => setSelectedNode(selectedNode === step.id ? null : step.id)}
                  style={{
                    padding: '15px 25px',
                    backgroundColor: selectedNode === step.id ? getStepColor(step.type) : 'white',
                    color: selectedNode === step.id ? 'white' : '#1f2937',
                    borderRadius: '8px',
                    minWidth: '200px',
                    textAlign: 'center',
                    boxShadow: selectedNode === step.id 
                      ? `0 4px 12px ${getStepColor(step.type)}40` 
                      : '0 2px 8px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    border: selectedNode === step.id ? `2px solid ${getStepColor(step.type)}` : '2px solid transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                    {getStepTypeLabel(step.type)}
                  </div>
                  {step.response && (
                    <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '5px' }}>
                      {step.response.content.substring(0, 50)}
                      {step.response.content.length > 50 ? '...' : ''}
                    </div>
                  )}
                  {step.type === 'CONDITION' && (
                    <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '5px' }}>
                      {step.conditions && step.conditions.length > 0
                        ? `${step.conditions[0].condition} ${step.conditions[0].operator} ${step.conditions[0].value}`
                        : 'Sem condição'}
                    </div>
                  )}
                  {step.type === 'HANDOFF' && (
                    <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '5px' }}>
                      Transferir para agente
                    </div>
                  )}
                  {step.type === 'DELAY' && step.config.delay && (
                    <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '5px' }}>
                      Aguardar {step.config.delay}ms
                    </div>
                  )}
                </div>

                {/* Actions for selected node */}
                {selectedNode === step.id && (
                  <div style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    marginTop: '10px',
                    padding: '10px',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  }}>
                    <button
                      onClick={() => {
                        setEditingStep(step);
                        setStepFormData({
                          type: step.type,
                          content: step.response?.content || '',
                          order: step.order,
                          intentId: step.intent?.id || '',
                          config: step.config || {},
                        });
                        setShowStepModal(true);
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
                      ✏️ Editar
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm('Tem certeza que deseja deletar este step?')) {
                          return;
                        }
                        try {
                          await api.delete(`/api/bots/steps/${step.id}`);
                          // Buscar fluxo atualizado
                          const updatedFlowResponse = await api.get(`/api/bots/flows/${selectedFlow.id}`);
                          const updatedFlow = updatedFlowResponse.data;
                          setSelectedFlow(updatedFlow);
                          setFlows(flows.map(f => f.id === selectedFlow.id ? updatedFlow : f));
                          setSelectedNode(null);
                          alert('Step deletado com sucesso!');
                        } catch (error: any) {
                          console.error('Erro ao deletar step:', error);
                          alert(error.response?.data?.error || 'Erro ao deletar step');
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
                      🗑️ Deletar
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* End Node */}
            {selectedFlow.steps.length > 0 && (
              <>
                <div style={{ width: '3px', height: '20px', backgroundColor: '#d1d5db' }} />
                <div
                  style={{
                    padding: '15px 25px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  }}
                >
                  🏁 Fim
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal Criar Fluxo */}
      {showFlowModal && (
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
          onClick={() => setShowFlowModal(false)}
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
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Novo Fluxo</h2>
            <form onSubmit={handleCreateFlow}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                  Nome *
                </label>
                <input
                  type="text"
                  value={flowFormData.name}
                  onChange={(e) => setFlowFormData({ ...flowFormData, name: e.target.value })}
                  placeholder="Ex: Fluxo de Vendas"
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
                  value={flowFormData.description}
                  onChange={(e) => setFlowFormData({ ...flowFormData, description: e.target.value })}
                  placeholder="Descrição do fluxo..."
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


              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowFlowModal(false)}
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
                  Criar Fluxo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Criar/Editar Step */}
      {showStepModal && (
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
            setShowStepModal(false);
            setEditingStep(null);
          }}
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
              {editingStep ? 'Editar Step' : 'Novo Step'}
            </h2>
            <form onSubmit={handleCreateStep}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                  Tipo de Step *
                </label>
                <select
                  value={stepFormData.type}
                  onChange={(e) => setStepFormData({ ...stepFormData, type: e.target.value, content: '', config: {} })}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '5px',
                    fontSize: '14px',
                  }}
                >
                  <option value="MESSAGE">💬 Mensagem</option>
                  <option value="CONDITION">🔀 Condição</option>
                  <option value="API_CALL">🔌 Chamada API</option>
                  <option value="HANDOFF">👤 Transferir para Humano</option>
                  <option value="DELAY">⏱️ Aguardar</option>
                </select>
              </div>

              {stepFormData.type === 'MESSAGE' && (
                <>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                      Mensagem *
                    </label>
                    <textarea
                      value={stepFormData.content}
                      onChange={(e) => setStepFormData({ ...stepFormData, content: e.target.value })}
                      placeholder="Digite a mensagem que o bot enviará..."
                      rows={4}
                      required
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
                      Intent (Opcional)
                    </label>
                    <select
                      value={stepFormData.intentId}
                      onChange={(e) => setStepFormData({ ...stepFormData, intentId: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '5px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="">Nenhum (resposta geral)</option>
                      {intents.map((intent) => (
                        <option key={intent.id} value={intent.id}>
                          {intent.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {stepFormData.type === 'CONDITION' && (
                <div style={{ marginBottom: '15px' }}>
                  <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '10px' }}>
                    Configure a condição. Exemplo: Se mensagem contém "preço", então...
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Campo</label>
                      <select
                        value={stepFormData.config.condition || 'message.content'}
                        onChange={(e) => setStepFormData({
                          ...stepFormData,
                          config: { ...stepFormData.config, condition: e.target.value },
                        })}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '5px',
                          fontSize: '12px',
                        }}
                      >
                        <option value="message.content">Conteúdo da Mensagem</option>
                        <option value="context.variable">Variável do Contexto</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Operador</label>
                      <select
                        value={stepFormData.config.operator || 'CONTAINS'}
                        onChange={(e) => setStepFormData({
                          ...stepFormData,
                          config: { ...stepFormData.config, operator: e.target.value },
                        })}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '5px',
                          fontSize: '12px',
                        }}
                      >
                        <option value="EQUALS">Igual a</option>
                        <option value="CONTAINS">Contém</option>
                        <option value="GREATER_THAN">Maior que</option>
                        <option value="LESS_THAN">Menor que</option>
                        <option value="REGEX">Regex</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Valor</label>
                      <input
                        type="text"
                        value={stepFormData.config.value || ''}
                        onChange={(e) => setStepFormData({
                          ...stepFormData,
                          config: { ...stepFormData.config, value: e.target.value },
                        })}
                        placeholder="Ex: preço"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '5px',
                          fontSize: '12px',
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {stepFormData.type === 'DELAY' && (
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                    Tempo de Espera (ms) *
                  </label>
                  <input
                    type="number"
                    value={stepFormData.config.delay || 1000}
                    onChange={(e) => setStepFormData({
                      ...stepFormData,
                      config: { ...stepFormData.config, delay: parseInt(e.target.value) || 1000 },
                    })}
                    min="0"
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      fontSize: '14px',
                    }}
                  />
                  <p style={{ marginTop: '5px', fontSize: '12px', color: '#6b7280' }}>
                    1000ms = 1 segundo
                  </p>
                </div>
              )}

              {stepFormData.type === 'HANDOFF' && (
                <div style={{ 
                  padding: '15px', 
                  backgroundColor: '#fef3c7', 
                  borderRadius: '5px',
                  marginBottom: '15px',
                }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#92400e' }}>
                    ⚠️ Este step transferirá a conversa para um agente humano. 
                    A conversa será atribuída automaticamente quando este step for executado.
                  </p>
                </div>
              )}

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                  Ordem no Fluxo
                </label>
                <input
                  type="number"
                  value={stepFormData.order}
                  onChange={(e) => setStepFormData({ ...stepFormData, order: parseInt(e.target.value) || 0 })}
                  min="0"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '5px',
                    fontSize: '14px',
                  }}
                />
                <p style={{ marginTop: '5px', fontSize: '12px', color: '#6b7280' }}>
                  Ordem de execução (0 = primeiro, 1 = segundo, etc.)
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowStepModal(false);
                    setEditingStep(null);
                  }}
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
                  {editingStep ? 'Atualizar' : 'Criar'} Step
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

