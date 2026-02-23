import { useState, useEffect } from 'react';
import api from '../utils/api';

interface Pipeline {
  id: string;
  name: string;
  stages: Array<{
    id: string;
    name: string;
    order: number;
  }>;
}

interface AutomationBlock {
  id: string;
  type: string;
  stageId: string;
  config: any;
  position: { x: number; y: number };
}

interface Props {
  pipeline: Pipeline;
  onClose: () => void;
}

function getBlockName(type: string): string {
  switch (type) {
    case 'sales_bot':
      return 'Robô de vendas';
    case 'change_stage':
      return 'Mudar etapa';
    case 'add_task':
      return 'Adicionar tarefa';
    default:
      return 'Automação';
  }
}

export default function PipelineAutomationModal({ pipeline, onClose }: Props) {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [duplicateControlEnabled, setDuplicateControlEnabled] = useState(false);
  const [automationBlocks, setAutomationBlocks] = useState<AutomationBlock[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<AutomationBlock | null>(null);
  const [showBlockPalette, setShowBlockPalette] = useState(false);
  const [selectedStageForBlock, setSelectedStageForBlock] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configData, setConfigData] = useState<any>({});

  // Carregar automações ao abrir o modal
  useEffect(() => {
    loadAutomations();
  }, [pipeline.id]);

  const loadAutomations = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/pipelines/${pipeline.id}/automations`);
      const rules = response.data.rules || [];
      
      // Transformar regras do backend para o formato do frontend
      const blocks: AutomationBlock[] = rules.map((rule: any) => ({
        id: rule.id,
        type: rule.type,
        stageId: rule.stageId,
        config: rule.config || {},
        position: { x: 100, y: 100 },
      }));
      
      setAutomationBlocks(blocks);
    } catch (error: any) {
      console.error('Erro ao carregar automações:', error);
      // Não mostrar erro se não houver automações ainda
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Transformar blocos para o formato do backend
      const rules = automationBlocks.map((block) => ({
        id: block.id.startsWith('block_') ? undefined : block.id,
        stageId: block.stageId,
        type: block.type,
        name: getBlockName(block.type),
        config: block.config || {},
        active: true,
      }));

      await api.put(`/api/pipelines/${pipeline.id}/automations`, { rules });
      alert('Automações salvas com sucesso!');
      onClose();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao salvar automações');
    } finally {
      setSaving(false);
    }
  };

  const addBlock = (type: string, stageId?: string) => {
    const targetStageId = stageId || selectedStageForBlock || pipeline.stages[0]?.id || '';
    const newBlock: AutomationBlock = {
      id: `block_${Date.now()}`,
      type,
      stageId: targetStageId,
      config: getDefaultConfig(type),
      position: { x: 100, y: 100 },
    };
    setAutomationBlocks([...automationBlocks, newBlock]);
    setSelectedBlock(newBlock);
    setShowBlockPalette(false);
    setSelectedStageForBlock(null);
    // Abrir modal de configuração
    setConfigData(newBlock.config);
    setShowConfigModal(true);
  };

  const getDefaultConfig = (type: string): any => {
    switch (type) {
      case 'sales_bot':
        return { botId: '', delaySeconds: 0, trigger: 'when_moved_to_stage', active: 'always' };
      case 'change_stage':
        return { 
          targetStageId: '', 
          trigger: 'after_5min_moved',
          delayMinutes: 5,
          delaySeconds: 0 
        };
      case 'add_task':
        return { 
          taskTitle: '', 
          taskDescription: '', 
          trigger: 'when_moved_to_stage',
          deadline: 'immediately',
          assignTo: 'current_user',
          taskType: 'follow_up'
        };
      default:
        return {};
    }
  };

  const handleConfigSave = () => {
    if (selectedBlock) {
      const updatedBlocks = automationBlocks.map((block) =>
        block.id === selectedBlock.id
          ? { ...block, config: configData }
          : block
      );
      setAutomationBlocks(updatedBlocks);
      setSelectedBlock({ ...selectedBlock, config: configData });
    }
    setShowConfigModal(false);
  };

  const handleDeleteBlock = (blockId: string) => {
    if (confirm('Deseja realmente excluir esta automação?')) {
      setAutomationBlocks(automationBlocks.filter((b) => b.id !== blockId));
      if (selectedBlock?.id === blockId) {
        setSelectedBlock(null);
      }
    }
  };

  const handleCreateTrigger = (stageId: string) => {
    setSelectedStageForBlock(stageId);
    setShowBlockPalette(true);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#f9fafb',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #e5e7eb',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
            {pipeline.name}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f3f4f6',
              color: '#1f2937',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Voltar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 16px',
              backgroundColor: saving ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar Esquerda - Fontes de Lead */}
        <div
          style={{
            width: '320px',
            backgroundColor: 'white',
            borderRight: '1px solid #e5e7eb',
            padding: '20px',
            overflowY: 'auto',
          }}
        >
          <h2
            style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '20px',
            }}
          >
            FONTES DE LEAD
          </h2>

          {/* Controle duplicado */}
          <div
            style={{
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px',
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                Controle duplicado
              </h3>
              <label
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  width: '44px',
                  height: '24px',
                }}
              >
                <input
                  type="checkbox"
                  checked={duplicateControlEnabled}
                  onChange={(e) => setDuplicateControlEnabled(e.target.checked)}
                  style={{
                    opacity: 0,
                    width: 0,
                    height: 0,
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: duplicateControlEnabled ? '#10b981' : '#d1d5db',
                    borderRadius: '24px',
                    transition: '0.3s',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      content: '""',
                      height: '18px',
                      width: '18px',
                      left: '3px',
                      bottom: '3px',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      transition: '0.3s',
                      transform: duplicateControlEnabled ? 'translateX(20px)' : 'translateX(0)',
                    }}
                  />
                </span>
              </label>
            </div>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, lineHeight: '1.5', marginBottom: '8px' }}>
              Escolha como o sistema detecta e lida com leads de entrada duplicados
            </p>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                alert('Configurar regras de duplicados');
              }}
              style={{
                fontSize: '12px',
                color: '#3b82f6',
                textDecoration: 'none',
                fontWeight: '500',
              }}
            >
              Configurar regras
            </a>
          </div>

          <button
            onClick={() => alert('Adicionar fonte')}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#f3f4f6',
              color: '#1f2937',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            + Adicionar fonte
          </button>
        </div>

        {/* Área Central - Canvas de Automação */}
        <div style={{ flex: 1, position: 'relative', overflow: 'auto', backgroundColor: '#f9fafb' }}>
          <div style={{ padding: '20px', minHeight: '100%' }}>
            {/* Colunas de Etapas */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
              {pipeline.stages
                .sort((a, b) => a.order - b.order)
                .map((stage) => (
                  <div
                    key={stage.id}
                    style={{
                      minWidth: '250px',
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      padding: '16px',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                        {stage.name.toUpperCase()}
                      </h3>
                      <button
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#f3f4f6',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        +
                      </button>
                    </div>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        alert('Adicionar dicas');
                      }}
                      style={{
                        fontSize: '12px',
                        color: '#3b82f6',
                        textDecoration: 'none',
                      }}
                    >
                      Adicionar dicas
                    </a>

                    {/* Blocos de automação nesta etapa */}
                    <div style={{ marginTop: '16px' }}>
                      {automationBlocks
                        .filter((block) => block.stageId === stage.id)
                        .map((block) => (
                          <div
                            key={block.id}
                            style={{
                              backgroundColor: selectedBlock?.id === block.id ? '#e0f2fe' : 'white',
                              border: `2px solid ${selectedBlock?.id === block.id ? '#0ea5e9' : '#e5e7eb'}`,
                              borderRadius: '6px',
                              padding: '12px',
                              marginBottom: '8px',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div 
                                onClick={() => {
                                  setSelectedBlock(block);
                                  setConfigData(block.config);
                                  setShowConfigModal(true);
                                }}
                                style={{ flex: 1 }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '16px' }}>
                                    {block.type === 'change_stage' ? '🔄' : 
                                     block.type === 'sales_bot' ? '🤖' :
                                     block.type === 'add_task' ? '➕' : '⚙️'}
                                  </span>
                                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#1f2937' }}>
                                    {getBlockName(block.type)}
                                  </span>
                                </div>
                                <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>
                                  {getBlockDescription(block)}
                                </p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteBlock(block.id);
                                }}
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: '#fee2e2',
                                  color: '#dc2626',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      
                      {/* Área de criar gatilho com gradiente */}
                      <div
                        onClick={() => handleCreateTrigger(stage.id)}
                        style={{
                          background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #7dd3fc 100%)',
                          border: '2px dashed #0ea5e9',
                          borderRadius: '8px',
                          padding: '20px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          marginTop: automationBlocks.filter((block) => block.stageId === stage.id).length > 0 ? '8px' : '0',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.02)';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(14, 165, 233, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#0369a1' }}>
                          + Criar gatilho
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Sidebar Direita - Blocos de Automação */}
        <div
          style={{
            width: '320px',
            backgroundColor: 'white',
            borderLeft: '1px solid #e5e7eb',
            padding: '20px',
            overflowY: 'auto',
            display: showBlockPalette ? 'block' : 'none',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2
              style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#1f2937',
                margin: 0,
              }}
            >
              Blocos
            </h2>
            <button
              onClick={() => {
                setShowBlockPalette(false);
                setSelectedStageForBlock(null);
              }}
              style={{
                padding: '4px 8px',
                backgroundColor: '#f3f4f6',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#6b7280',
              }}
            >
              ✕
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '20px' }}>
            💡 Clique para adicionar à etapa
          </p>

          {/* Grid de 3 colunas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {/* Robô de vendas */}
            <button
              onClick={() => addBlock('sales_bot', selectedStageForBlock || undefined)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px',
                backgroundColor: '#e0f2fe',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: '24px', marginBottom: '4px' }}>🤖</span>
              <span style={{ fontSize: '10px', fontWeight: '600', color: '#0369a1', textAlign: 'center' }}>
                + Robô de vendas
              </span>
            </button>

            {/* Adicionar uma tarefa */}
            <button
              onClick={() => addBlock('add_task', selectedStageForBlock || undefined)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px',
                backgroundColor: '#e0f2fe',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: '24px', marginBottom: '4px' }}>➕</span>
              <span style={{ fontSize: '10px', fontWeight: '600', color: '#0369a1', textAlign: 'center' }}>
                + Adicionar uma tarefa
              </span>
            </button>

            {/* Crie um lead */}
            <button
              onClick={() => addBlock('create_lead', selectedStageForBlock || undefined)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px',
                backgroundColor: '#e0f2fe',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: '24px', marginBottom: '4px' }}>💰</span>
              <span style={{ fontSize: '10px', fontWeight: '600', color: '#0369a1', textAlign: 'center' }}>
                + Crie um lead
              </span>
            </button>

            {/* Enviar e-mail */}
            <button
              onClick={() => addBlock('send_email', selectedStageForBlock || undefined)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px',
                backgroundColor: '#e0f2fe',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: '24px', marginBottom: '4px' }}>✉️</span>
              <span style={{ fontSize: '10px', fontWeight: '600', color: '#0369a1', textAlign: 'center' }}>
                + Enviar e-mail
              </span>
            </button>

            {/* Mudar a etapa do lead */}
            <button
              onClick={() => addBlock('change_stage', selectedStageForBlock || undefined)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px',
                backgroundColor: '#e0f2fe',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: '24px', marginBottom: '4px' }}>🔄</span>
              <span style={{ fontSize: '10px', fontWeight: '600', color: '#0369a1', textAlign: 'center' }}>
                + Mudar a etapa do lead
              </span>
            </button>

            {/* Alterar usuário de lead */}
            <button
              onClick={() => addBlock('change_user', selectedStageForBlock || undefined)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px',
                backgroundColor: '#e0f2fe',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: '24px', marginBottom: '4px' }}>👥</span>
              <span style={{ fontSize: '10px', fontWeight: '600', color: '#0369a1', textAlign: 'center' }}>
                + Alterar usuário de lead
              </span>
            </button>

          </div>
        </div>
      </div>

      {/* Modal de Configuração */}
      {showConfigModal && selectedBlock && (
        <ConfigModal
          block={selectedBlock}
          config={configData}
          pipeline={pipeline}
          onClose={() => setShowConfigModal(false)}
          onSave={handleConfigSave}
          onChange={(newConfig) => setConfigData(newConfig)}
        />
      )}

      {loading && (
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
            zIndex: 2000,
          }}
        >
          <div style={{ color: 'white', fontSize: '18px' }}>Carregando...</div>
        </div>
      )}
    </div>
  );
}

function getBlockDescription(block: AutomationBlock): string {
  const delay = block.config?.delaySeconds || 0;
  const delayText = delay > 0 ? ` após ${delay} segundos` : ' imediatamente';
  
  switch (block.type) {
    case 'sales_bot':
      return `Inicia bot${delayText}`;
    case 'change_stage':
      return `Muda para outra etapa${delayText}`;
    case 'add_task':
      const taskType = block.config?.taskType || 'follow_up';
      const taskTypeName = getTaskTypeName(taskType);
      return `Cria tarefa: ${taskTypeName}${delayText}`;
    default:
      return `Executa${delayText}`;
  }
}

function getDefaultTaskTitle(taskType?: string): string {
  switch (taskType) {
    case 'follow_up':
      return 'Acompanhar lead';
    case 'meeting':
      return 'Reunião com cliente';
    case 'call':
      return 'Ligar para cliente';
    case 'sms':
      return 'Enviar SMS';
    case 'whatsapp':
      return 'Enviar WhatsApp';
    case 'move_stage':
      return 'Mover para próxima etapa';
    case 'handoff':
      return 'Passar o bastão';
    default:
      return 'Nova tarefa';
  }
}

function getTaskTypeName(taskType?: string): string {
  switch (taskType) {
    case 'follow_up':
      return 'Acompanhar';
    case 'meeting':
      return 'Reunião';
    case 'call':
      return 'Ligação';
    case 'sms':
      return 'SMS';
    case 'whatsapp':
      return 'WhatsApp';
    case 'move_stage':
      return 'Mover etapa';
    case 'handoff':
      return 'Passar bastão';
    default:
      return 'Tarefa';
  }
}

// Componente para opção de gatilho com delay
interface TriggerOptionProps {
  value: string;
  selected: boolean;
  delayMinutes: number;
  triggerType: 'created' | 'moved' | 'moved_or_created';
  onChange: (value: string, delay: number) => void;
}

function TriggerOption({ value, selected, delayMinutes, triggerType, onChange }: TriggerOptionProps) {
  const [delay, setDelay] = useState(delayMinutes);

  useEffect(() => {
    setDelay(delayMinutes);
  }, [delayMinutes]);

  const handleClick = () => {
    onChange(value, delay);
  };

  const handleDelayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDelay = parseInt(e.target.value) || 0;
    setDelay(newDelay);
    onChange(value, newDelay);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        padding: '10px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
        backgroundColor: selected ? '#e0f2fe' : 'transparent',
        border: selected ? '1px solid #0ea5e9' : '1px solid transparent',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {selected && (
        <span style={{ color: '#10b981', fontSize: '16px' }}>✓</span>
      )}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '14px', color: '#1f2937' }}>
          Depois de
        </span>
        <input
          type="number"
          value={delay}
          onChange={handleDelayChange}
          onClick={(e) => e.stopPropagation()}
          min="0"
          style={{
            width: '60px',
            padding: '4px 6px',
            border: '1px solid #e5e7eb',
            borderRadius: '4px',
            fontSize: '14px',
            textAlign: 'center',
          }}
        />
        <span style={{ fontSize: '14px', color: '#1f2937' }}>
          minutos quando {triggerType === 'created' ? 'criado' : triggerType === 'moved' ? 'movido para' : 'movido para ou criado'} nesta etapa
        </span>
      </div>
    </div>
  );
}

// Componente para seleção de usuário
interface TaskUserSelectorProps {
  config: any;
  onChange: (config: any) => void;
}

function TaskUserSelector({ config, onChange }: TaskUserSelectorProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/users?includeInactive=true');
      setUsers(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <select
      value={config.assignedUserId || ''}
      onChange={(e) => onChange({ ...config, assignedUserId: e.target.value })}
      style={{
        width: '100%',
        marginTop: '8px',
        padding: '8px 12px',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        fontSize: '14px',
        backgroundColor: 'white',
      }}
    >
      <option value="">Selecione um usuário</option>
      {loading ? (
        <option disabled>Carregando...</option>
      ) : (
        users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} ({user.email})
          </option>
        ))
      )}
    </select>
  );
}

// Modal de Configuração
interface ConfigModalProps {
  block: AutomationBlock;
  config: any;
  pipeline: Pipeline;
  onClose: () => void;
  onSave: () => void;
  onChange: (config: any) => void;
}

function ConfigModal({ block, config, pipeline, onClose, onSave, onChange }: ConfigModalProps) {
  const [bots, setBots] = useState<any[]>([]);
  const [loadingBots, setLoadingBots] = useState(false);

  useEffect(() => {
    if (block.type === 'sales_bot') {
      loadBots();
    }
  }, [block.type]);

  const loadBots = async () => {
    try {
      setLoadingBots(true);
      const response = await api.get('/api/bots');
      setBots(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar bots:', error);
    } finally {
      setLoadingBots(false);
    }
  };

  return (
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
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '24px', color: '#1f2937' }}>
          Configurar {getBlockName(block.type)}
        </h2>

        {block.type === 'sales_bot' && (
          <>
            {/* Seção de Condições */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                Para todos os leads com:
              </label>
              <input
                type="text"
                placeholder="Adicionar uma condição"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>

            {/* Gatilho de Execução */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                Executar:
              </label>
              <select
                value={config.trigger || 'when_moved_to_stage'}
                onChange={(e) => onChange({ ...config, trigger: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                }}
              >
                <option value="when_created_in_stage">Imediatamente quando criado nesta etapa</option>
                <option value="when_moved_to_stage">Imediatamente quando movido para esta etapa</option>
                <option value="when_moved_or_created">Imediatamente quando movido para ou criado nesta etapa</option>
                <option value="when_user_changed">Quando o usuário responsável é alterado em lead</option>
              </select>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px', margin: 0 }}>
                A mensagem será enviada aos contatos que se comunicaram com você nos aplicativos de mensagens que você integrou
              </p>
            </div>

            {/* Status Ativo */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                Ativo:
              </label>
              <select
                value={config.active || 'always'}
                onChange={(e) => onChange({ ...config, active: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                }}
              >
                <option value="always">sempre</option>
                <option value="scheduled">agendado</option>
              </select>
            </div>

            {/* Deixar mensagem sem resposta */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.leaveUnanswered || false}
                  onChange={(e) => onChange({ ...config, leaveUnanswered: e.target.checked })}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ fontSize: '14px', color: '#1f2937' }}>Deixar mensagem sem resposta</span>
              </label>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', marginLeft: '26px', margin: '4px 0 0 26px' }}>
                As mensagens às quais o Salesbot responde serão marcadas como não respondidas
              </p>
            </div>

            {/* Seção Salesbot */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1f2937' }}>
                Salesbot
              </h3>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                {loadingBots ? (
                  <div style={{ width: '100%', padding: '8px', textAlign: 'center', color: '#6b7280' }}>
                    Carregando bots...
                  </div>
                ) : (
                  <>
                    <select
                      value={config.botId || ''}
                      onChange={(e) => onChange({ ...config, botId: e.target.value })}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '14px',
                        backgroundColor: 'white',
                      }}
                    >
                      <option value="">Nenhum robô selecionado</option>
                      {bots.map((bot) => (
                        <option key={bot.id} value={bot.id}>
                          {bot.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        // Navegar para página de criação de bot
                        window.open('/bots', '_blank');
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      + Criar um novo robô
                    </button>
                  </>
                )}
              </div>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                Crie um novo robô ou selecionar um existente
              </p>
            </div>

            {/* Aplicar gatilho retroativamente */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.applyToExisting || false}
                  onChange={(e) => onChange({ ...config, applyToExisting: e.target.checked })}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ fontSize: '14px', color: '#1f2937' }}>
                  Aplicar o gatilho à todos os leads já nesta etapa
                </span>
              </label>
            </div>
          </>
        )}

        {block.type === 'change_stage' && (
          <>
            {/* Seção de Condições */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                Para todos os leads com:
              </label>
              <input
                type="text"
                placeholder="Adicionar uma condição"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>

            {/* Seção de Gatilhos do Pipeline */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1f2937' }}>
                GATILHOS DO PIPELINE
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <TriggerOption
                  value="after_5min_created"
                  selected={config.trigger === 'after_5min_created'}
                  delayMinutes={config.delayMinutes || 5}
                  triggerType="created"
                  onChange={(value, delay) => onChange({ ...config, trigger: value, delayMinutes: delay })}
                />
                <TriggerOption
                  value="after_5min_moved"
                  selected={config.trigger === 'after_5min_moved'}
                  delayMinutes={config.delayMinutes || 5}
                  triggerType="moved"
                  onChange={(value, delay) => onChange({ ...config, trigger: value, delayMinutes: delay })}
                />
                <TriggerOption
                  value="after_5min_moved_or_created"
                  selected={config.trigger === 'after_5min_moved_or_created'}
                  delayMinutes={config.delayMinutes || 5}
                  triggerType="moved_or_created"
                  onChange={(value, delay) => onChange({ ...config, trigger: value, delayMinutes: delay })}
                />
                <div
                  onClick={() => onChange({ ...config, trigger: 'when_user_changed' })}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: config.trigger === 'when_user_changed' ? '#e0f2fe' : 'transparent',
                    border: config.trigger === 'when_user_changed' ? '1px solid #0ea5e9' : '1px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {config.trigger === 'when_user_changed' && (
                    <span style={{ color: '#10b981', fontSize: '16px' }}>✓</span>
                  )}
                  <span style={{ fontSize: '14px', color: '#1f2937' }}>
                    Quando o usuário responsável é alterado em lead
                  </span>
                </div>
              </div>
            </div>

            {/* Seção de Gatilhos Programados */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1f2937' }}>
                GATILHOS PROGRAMADOS
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Tempo Exato */}
                <div
                  style={{
                    padding: '12px',
                    border: config.trigger === 'exact_time' ? '1px solid #0ea5e9' : '1px solid #e5e7eb',
                    borderRadius: '6px',
                    backgroundColor: config.trigger === 'exact_time' ? '#e0f2fe' : 'white',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={config.trigger === 'exact_time'}
                      onChange={() => onChange({ ...config, trigger: 'exact_time' })}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>Tempo exato</span>
                  </label>
                  {config.trigger === 'exact_time' && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                      <input
                        type="date"
                        value={config.scheduledDate || ''}
                        onChange={(e) => onChange({ ...config, scheduledDate: e.target.value })}
                        style={{
                          padding: '6px 8px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '4px',
                          fontSize: '14px',
                        }}
                      />
                      <span style={{ fontSize: '14px', color: '#6b7280' }}>às</span>
                      <input
                        type="time"
                        value={config.scheduledTime || ''}
                        onChange={(e) => onChange({ ...config, scheduledTime: e.target.value })}
                        style={{
                          padding: '6px 8px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '4px',
                          fontSize: '14px',
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Diariamente */}
                <div
                  style={{
                    padding: '12px',
                    border: config.trigger === 'daily' ? '1px solid #0ea5e9' : '1px solid #e5e7eb',
                    borderRadius: '6px',
                    backgroundColor: config.trigger === 'daily' ? '#e0f2fe' : 'white',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={config.trigger === 'daily'}
                      onChange={() => onChange({ ...config, trigger: 'daily' })}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>Diariamente</span>
                  </label>
                  {config.trigger === 'daily' && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', color: '#6b7280' }}>às</span>
                      <input
                        type="time"
                        value={config.dailyTime || ''}
                        onChange={(e) => onChange({ ...config, dailyTime: e.target.value })}
                        style={{
                          padding: '6px 8px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '4px',
                          fontSize: '14px',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Seção de Gatilhos Baseados em Ações */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1f2937' }}>
                GATILHOS BASEADOS EM AÇÕES
              </h3>
              <p style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                Em desenvolvimento...
              </p>
            </div>

            {/* Seção de Gatilhos de Conversação */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1f2937' }}>
                GATILHOS DE CONVERSAÇÃO
              </h3>
              <p style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                Em desenvolvimento...
              </p>
            </div>

            {/* Etapa de Destino */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                Etapa de Destino *
              </label>
              <select
                value={config.targetStageId || ''}
                onChange={(e) => onChange({ ...config, targetStageId: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                }}
              >
                <option value="">Selecione uma etapa</option>
                {pipeline.stages
                  .sort((a, b) => a.order - b.order)
                  .map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
              </select>
            </div>
          </>
        )}

        {block.type === 'add_task' && (
          <>
            {/* Seção de Condições */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                Para todos os leads com:
              </label>
              <input
                type="text"
                placeholder="Adicionar uma condição"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>

            {/* Gatilho de Execução */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                Executar:
              </label>
              <select
                value={config.trigger || 'when_moved_to_stage'}
                onChange={(e) => onChange({ ...config, trigger: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                }}
              >
                <option value="when_created_in_stage">Imediatamente quando criado nesta etapa</option>
                <option value="when_moved_to_stage">Imediatamente quando movido para esta etapa</option>
                <option value="when_moved_or_created">Imediatamente quando movido para ou criado nesta etapa</option>
                <option value="when_user_changed">Quando o usuário responsável é alterado em lead</option>
              </select>
            </div>

            {/* Prazo da Tarefa */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                Prazo da tarefa:
              </label>
              <select
                value={config.deadline || 'immediately'}
                onChange={(e) => onChange({ ...config, deadline: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                }}
              >
                <option value="immediately">Imediatamente</option>
                <option value="1_day">1 dia</option>
                <option value="2_days">2 dias</option>
                <option value="3_days">3 dias</option>
                <option value="5_days">5 dias</option>
                <option value="7_days">7 dias</option>
                <option value="custom">Personalizado</option>
              </select>
              {config.deadline === 'custom' && (
                <input
                  type="number"
                  value={config.customDeadlineDays || 0}
                  onChange={(e) => onChange({ ...config, customDeadlineDays: parseInt(e.target.value) || 0 })}
                  placeholder="Número de dias"
                  min="0"
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              )}
            </div>

            {/* Para (Usuário responsável) */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                Para:
              </label>
              <select
                value={config.assignTo || 'current_user'}
                onChange={(e) => onChange({ ...config, assignTo: e.target.value, assignedUserId: e.target.value === 'specific_user' ? config.assignedUserId : undefined })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                }}
              >
                <option value="current_user">Usuário responsável atual</option>
                <option value="specific_user">Usuário específico</option>
                <option value="no_assignment">Sem atribuição</option>
              </select>
              {config.assignTo === 'specific_user' && (
                <TaskUserSelector
                  config={config}
                  onChange={onChange}
                />
              )}
            </div>

            {/* Tipo de Ação/Tarefa */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                Tipo de tarefa:
              </label>
              <select
                value={config.taskType || 'follow_up'}
                onChange={(e) => onChange({ ...config, taskType: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                }}
              >
                <option value="follow_up">Acompanhar</option>
                <option value="meeting">Reunião</option>
                <option value="call">Ligação</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="move_stage">Mover p/ etapa</option>
                <option value="handoff">Passar o bastão</option>
              </select>
            </div>

            {/* Título da Tarefa (baseado no tipo) */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                Título da Tarefa *
              </label>
              <input
                type="text"
                value={config.taskTitle || getDefaultTaskTitle(config.taskType)}
                onChange={(e) => onChange({ ...config, taskTitle: e.target.value })}
                placeholder={getDefaultTaskTitle(config.taskType)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>

            {/* Descrição (opcional) */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                Descrição (opcional)
              </label>
              <textarea
                value={config.taskDescription || ''}
                onChange={(e) => onChange({ ...config, taskDescription: e.target.value })}
                placeholder="Descrição da tarefa..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  resize: 'vertical',
                  fontSize: '14px',
                }}
              />
            </div>
          </>
        )}

        {/* Delay comum a todos os tipos (apenas para outros tipos, não sales_bot) */}
        {block.type !== 'sales_bot' && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              Atraso antes de executar (segundos)
            </label>
            <input
              type="number"
              value={config.delaySeconds || 0}
              onChange={(e) => onChange({ ...config, delaySeconds: parseInt(e.target.value) || 0 })}
              min="0"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f3f4f6',
              color: '#1f2937',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            Finalizado
          </button>
        </div>
      </div>
    </div>
  );
}

