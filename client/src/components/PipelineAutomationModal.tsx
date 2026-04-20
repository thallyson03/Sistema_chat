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
    case 'change_user':
      return 'Alterar usuário de lead';
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
      case 'change_user':
        return {
          trigger: 'when_moved_to_stage',
          assignTo: 'current_user',
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

  const sortedStages = [...pipeline.stages].sort((a, b) => a.order - b.order);
  const selectedStageName = sortedStages.find((stage) => stage.id === selectedStageForBlock)?.name;
  const blockCatalog = [
    { type: 'sales_bot', icon: '🤖', label: 'Robô de vendas' },
    { type: 'add_task', icon: '➕', label: 'Adicionar tarefa' },
    { type: 'send_email', icon: '✉️', label: 'Enviar e-mail' },
    { type: 'change_stage', icon: '🔄', label: 'Mudar etapa' },
    { type: 'change_user', icon: '👥', label: 'Alterar responsável' },
  ];

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-surface text-on-surface">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant bg-surface-container px-6 py-4">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary/60">Automatize</p>
          <h2 className="font-headline text-xl font-bold text-on-surface">{pipeline.name}</h2>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Configure ações automáticas por etapa do funil.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-outline-variant bg-surface-container-highest px-4 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
          >
            Voltar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary shadow-emerald-send transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
          >
            {saving ? 'Salvando...' : 'Salvar automações'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar Esquerda - Fontes de Lead */}
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-r border-outline-variant bg-surface-container-low p-5 lg:block">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">
            Fontes de lead
          </h3>

          {/* Controle duplicado */}
          <div className="mb-4 rounded-xl border border-outline-variant bg-surface-container p-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-on-surface">
                Controle duplicado
              </h4>
              <label className="relative inline-block h-6 w-11">
                <input
                  type="checkbox"
                  checked={duplicateControlEnabled}
                  onChange={(e) => setDuplicateControlEnabled(e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  className="absolute inset-0 cursor-pointer rounded-full bg-surface-variant transition peer-checked:bg-primary"
                >
                  <span
                    className={`absolute bottom-[3px] left-[3px] h-[18px] w-[18px] rounded-full bg-white transition ${
                      duplicateControlEnabled ? 'translate-x-5' : ''
                    }`}
                  />
                </span>
              </label>
            </div>
            <p className="mb-2 text-xs leading-relaxed text-on-surface-variant">
              Escolha como o sistema detecta e lida com leads de entrada duplicados
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                alert('Configurar regras de duplicados');
              }}
              className="text-xs font-semibold text-primary-fixed-dim transition hover:opacity-80"
            >
              Configurar regras
            </button>
          </div>

          <button
            onClick={() => alert('Adicionar fonte')}
            className="w-full rounded-lg border border-dashed border-primary/35 bg-primary/5 px-3 py-2.5 text-sm font-semibold text-primary-fixed-dim transition hover:bg-primary/10"
          >
            + Adicionar fonte
          </button>
        </aside>

        {/* Área Central - Canvas de Automação */}
        <div className="relative flex-1 overflow-auto bg-surface">
          <div className="min-h-full p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-on-surface-variant">
                Etapas do pipeline ({sortedStages.length})
              </p>
              {showBlockPalette && (
                <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary-fixed-dim">
                  Adicionando em: {selectedStageName || 'Etapa selecionada'}
                </span>
              )}
            </div>
            {/* Colunas de Etapas */}
            <div className="flex gap-4">
              {sortedStages
                .map((stage) => (
                  <div
                    key={stage.id}
                    className="min-h-[250px] min-w-[260px] rounded-xl border border-outline-variant bg-surface-container-low p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-on-surface">
                        {stage.name}
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleCreateTrigger(stage.id)}
                        className="rounded-md border border-outline-variant bg-surface-container px-2 py-1 text-xs font-semibold text-on-surface-variant transition hover:border-primary/35 hover:text-primary-fixed-dim"
                      >
                        + bloco
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        alert('Adicionar dicas');
                      }}
                      className="text-xs text-primary-fixed-dim transition hover:opacity-80"
                    >
                      Adicionar dicas
                    </button>

                    {/* Blocos de automação nesta etapa */}
                    <div className="mt-4 space-y-2">
                      {automationBlocks
                        .filter((block) => block.stageId === stage.id)
                        .map((block) => (
                          <div
                            key={block.id}
                            className={`rounded-lg border p-3 transition ${
                              selectedBlock?.id === block.id
                                ? 'border-primary/45 bg-primary/10'
                                : 'border-outline-variant bg-surface-container'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div
                                onClick={() => {
                                  setSelectedBlock(block);
                                  setConfigData(block.config);
                                  setShowConfigModal(true);
                                }}
                                className="flex-1 cursor-pointer"
                              >
                                <div className="mb-1.5 flex items-center gap-2">
                                  <span className="text-base">
                                    {block.type === 'change_stage' ? '🔄' : 
                                     block.type === 'sales_bot' ? '🤖' :
                                     block.type === 'add_task' ? '➕' : '⚙️'}
                                  </span>
                                  <span className="text-xs font-semibold uppercase tracking-wide text-on-surface">
                                    {getBlockName(block.type)}
                                  </span>
                                </div>
                                <p className="text-xs leading-relaxed text-on-surface-variant">
                                  {getBlockDescription(block)}
                                </p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteBlock(block.id);
                                }}
                                className="rounded-md border border-error/40 bg-error/10 px-2 py-1 text-xs font-semibold text-red-200 transition hover:bg-error/20"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      
                      {/* Área de criar gatilho com gradiente */}
                      <div
                        onClick={() => handleCreateTrigger(stage.id)}
                        className={`cursor-pointer rounded-lg border-2 border-dashed border-primary/40 bg-primary/10 p-4 text-center transition hover:bg-primary/15 ${
                          automationBlocks.filter((block) => block.stageId === stage.id).length > 0 ? 'mt-2' : ''
                        }`}
                      >
                        <span className="text-sm font-semibold text-primary-fixed-dim">
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
        <aside
          className={`w-80 shrink-0 overflow-y-auto border-l border-outline-variant bg-surface-container-low p-5 transition-all ${
            showBlockPalette ? 'block' : 'hidden xl:block xl:w-0 xl:border-l-0 xl:p-0'
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-on-surface-variant">Blocos</h3>
            <button
              onClick={() => {
                setShowBlockPalette(false);
                setSelectedStageForBlock(null);
              }}
              className="rounded-md border border-outline-variant bg-surface-container px-2 py-1 text-xs text-on-surface-variant transition hover:bg-surface-variant"
            >
              ✕
            </button>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-on-surface-variant">
            Clique para adicionar na etapa {selectedStageName ? `"${selectedStageName}"` : 'selecionada'}.
          </p>

          {/* Grid de 3 colunas */}
          <div className="grid grid-cols-2 gap-2">
            {blockCatalog.map((item) => (
              <button
                key={item.type}
                onClick={() => addBlock(item.type, selectedStageForBlock || undefined)}
                className="flex min-h-[92px] flex-col items-center justify-center rounded-lg border border-primary/30 bg-primary/10 p-2.5 text-center transition hover:scale-[1.03] hover:bg-primary/15"
              >
                <span className="mb-1 text-2xl">{item.icon}</span>
                <span className="text-[11px] font-semibold leading-tight text-primary-fixed-dim">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </aside>
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
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/55 backdrop-blur-[2px]">
          <div className="rounded-lg border border-outline-variant bg-surface-container-highest px-5 py-3 text-sm font-semibold text-on-surface">
            Carregando automações...
          </div>
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
    case 'change_user': {
      const assignTo = block.config?.assignTo || 'current_user';
      if (assignTo === 'specific_user') {
        return `Altera usuário do lead para um usuário específico${delayText}`;
      }
      if (assignTo === 'no_assignment') {
        return `Remove usuário responsável do lead${delayText}`;
      }
      return `Mantém/ajusta usuário responsável atual${delayText}`;
    }
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

        {block.type === 'change_user' && (
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

            {/* Para (Usuário responsável) */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                Novo responsável:
              </label>
              <select
                value={config.assignTo || 'current_user'}
                onChange={(e) =>
                  onChange({
                    ...config,
                    assignTo: e.target.value,
                    assignedUserId: e.target.value === 'specific_user' ? config.assignedUserId : undefined,
                  })
                }
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                }}
              >
                <option value="current_user">Manter usuário responsável atual</option>
                <option value="specific_user">Definir usuário específico</option>
                <option value="no_assignment">Sem atribuição</option>
              </select>
              {config.assignTo === 'specific_user' && (
                <TaskUserSelector
                  config={config}
                  onChange={onChange}
                />
              )}
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

