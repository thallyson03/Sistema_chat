import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useConfirm } from './ui/ConfirmProvider';

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

const PIPELINE_MODAL_LABEL =
  'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant';
const PIPELINE_MODAL_INPUT =
  'w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/55 outline-none transition focus:border-primary/45 focus:ring-1 focus:ring-primary/25';
const PIPELINE_MODAL_SELECT = `${PIPELINE_MODAL_INPUT} cursor-pointer`;
const AUTOMATION_SECTION_TITLE =
  'mb-3 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant';
const AUTOMATION_HINT = 'mt-1.5 text-xs leading-relaxed text-on-surface-variant';

const SALES_BOT_TRIGGERS = [
  { value: 'when_created_in_stage', label: 'Quando criado nesta etapa' },
  { value: 'when_moved_to_stage', label: 'Quando movido para esta etapa' },
  { value: 'when_moved_or_created', label: 'Quando movido para ou criado nesta etapa' },
  { value: 'when_user_changed', label: 'Quando o usuário responsável é alterado' },
];

const LEAD_CONDITION_OPTIONS = [
  { type: 'tag', label: 'Tag', needsValue: true, valueKind: 'text' as const, placeholder: 'Nome da tag' },
  { type: 'assigned_user', label: 'Usuário responsável', needsValue: true, valueKind: 'user' as const },
  { type: 'whatsapp', label: 'WhatsApp', needsValue: false, valueKind: 'none' as const },
  { type: 'email', label: 'E-mail preenchido', needsValue: false, valueKind: 'none' as const },
  { type: 'phone', label: 'Telefone preenchido', needsValue: false, valueKind: 'none' as const },
  { type: 'channel', label: 'Canal', needsValue: true, valueKind: 'channel' as const },
  { type: 'has_conversation', label: 'Com conversa vinculada', needsValue: false, valueKind: 'none' as const },
  { type: 'no_conversation', label: 'Sem conversa vinculada', needsValue: false, valueKind: 'none' as const },
];

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

type LeadCondition = { type: string; operator?: string; value?: string };

function SalesBotConditionsEditor({
  conditions,
  users,
  channels,
  onChange,
}: {
  conditions: LeadCondition[];
  users: Array<{ id: string; name: string }>;
  channels: Array<{ id: string; name: string }>;
  onChange: (next: LeadCondition[]) => void;
}) {
  const addCondition = () => {
    onChange([...(conditions || []), { type: 'tag', value: '' }]);
  };

  const updateCondition = (index: number, patch: Partial<LeadCondition>) => {
    const next = [...(conditions || [])];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeCondition = (index: number) => {
    onChange((conditions || []).filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {(conditions || []).length === 0 ? (
        <p className="rounded-lg border border-dashed border-outline-variant bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
          Sem condições — a automação vale para todos os leads desta etapa.
        </p>
      ) : null}
      {(conditions || []).map((condition, index) => {
        const meta = LEAD_CONDITION_OPTIONS.find((item) => item.type === condition.type);
        return (
          <div
            key={`${condition.type}-${index}`}
            className="flex flex-col gap-2 rounded-lg border border-outline-variant bg-surface-container p-3 sm:flex-row sm:items-end"
          >
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                Condição
              </label>
              <select
                value={condition.type}
                onChange={(e) =>
                  updateCondition(index, { type: e.target.value, value: '', operator: undefined })
                }
                className={PIPELINE_MODAL_SELECT}
              >
                {LEAD_CONDITION_OPTIONS.map((item) => (
                  <option key={item.type} value={item.type}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            {meta?.needsValue ? (
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                  Valor
                </label>
                {meta.valueKind === 'user' ? (
                  <select
                    value={condition.value || ''}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                    className={PIPELINE_MODAL_SELECT}
                  >
                    <option value="">Selecione o usuário</option>
                    <option value="__none__">Sem responsável</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                ) : meta.valueKind === 'channel' ? (
                  <select
                    value={condition.value || ''}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                    className={PIPELINE_MODAL_SELECT}
                  >
                    <option value="">Selecione o canal</option>
                    {channels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        {channel.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={condition.value || ''}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                    placeholder={meta.placeholder || 'Valor'}
                    className={PIPELINE_MODAL_INPUT}
                  />
                )}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => removeCondition(index)}
              className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-error/20"
            >
              Remover
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={addCondition}
        className="w-full rounded-lg border border-dashed border-primary/35 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary-fixed-dim transition hover:bg-primary/15"
      >
        + Adicionar condição
      </button>
    </div>
  );
}

function SalesBotExecuteEditor({
  config,
  onChange,
  showChannelHint = true,
}: {
  config: any;
  onChange: (config: any) => void;
  showChannelHint?: boolean;
}) {
  const executeTiming = config.executeTiming || 'immediate';

  return (
    <div className="space-y-3">
      <div>
        <label className={PIPELINE_MODAL_LABEL}>Evento do gatilho</label>
        <select
          value={config.trigger || 'when_moved_to_stage'}
          onChange={(e) => onChange({ ...config, trigger: e.target.value })}
          className={PIPELINE_MODAL_SELECT}
        >
          {SALES_BOT_TRIGGERS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={PIPELINE_MODAL_LABEL}>Quando executar</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...config, executeTiming: 'immediate' })}
            className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
              executeTiming === 'immediate'
                ? 'border-primary/45 bg-primary/10 text-primary-fixed-dim'
                : 'border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Imediatamente
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...config, executeTiming: 'custom' })}
            className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
              executeTiming === 'custom'
                ? 'border-primary/45 bg-primary/10 text-primary-fixed-dim'
                : 'border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Personalizar horário
          </button>
        </div>
      </div>

      {executeTiming === 'custom' ? (
        <div className="rounded-lg border border-outline-variant bg-surface-container p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={PIPELINE_MODAL_LABEL}>Horário específico</label>
              <input
                type="time"
                value={config.executeAtTime || ''}
                onChange={(e) => onChange({ ...config, executeAtTime: e.target.value })}
                className={PIPELINE_MODAL_INPUT}
              />
            </div>
            <div>
              <label className={PIPELINE_MODAL_LABEL}>Ou após (minutos)</label>
              <input
                type="number"
                min="0"
                value={config.executeDelayMinutes ?? 0}
                onChange={(e) =>
                  onChange({ ...config, executeDelayMinutes: parseInt(e.target.value, 10) || 0 })
                }
                className={PIPELINE_MODAL_INPUT}
              />
            </div>
          </div>
          <p className={AUTOMATION_HINT}>
            Use o horário para agendar no mesmo dia, ou os minutos para atrasar após o gatilho.
          </p>
        </div>
      ) : null}

      {showChannelHint ? (
        <p className={AUTOMATION_HINT}>
          A mensagem será enviada aos contatos que se comunicaram nos canais integrados.
        </p>
      ) : null}
    </div>
  );
}

function TaskDeadlineEditor({
  config,
  onChange,
}: {
  config: any;
  onChange: (config: any) => void;
}) {
  const deadline = config.deadline || 'immediately';

  return (
    <div className="space-y-2">
      <select
        value={deadline}
        onChange={(e) => onChange({ ...config, deadline: e.target.value })}
        className={PIPELINE_MODAL_SELECT}
      >
        <option value="immediately">Imediatamente</option>
        <option value="1_day">1 dia</option>
        <option value="2_days">2 dias</option>
        <option value="3_days">3 dias</option>
        <option value="5_days">5 dias</option>
        <option value="7_days">7 dias</option>
        <option value="custom">Personalizado</option>
      </select>
      {deadline === 'custom' ? (
        <div className="rounded-lg border border-outline-variant bg-surface-container p-3">
          <label className={PIPELINE_MODAL_LABEL}>Prazo personalizado</label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                Horas
              </label>
              <input
                type="number"
                min="0"
                value={config.customDeadlineHours ?? 0}
                onChange={(e) =>
                  onChange({ ...config, customDeadlineHours: parseInt(e.target.value, 10) || 0 })
                }
                className={PIPELINE_MODAL_INPUT}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                Minutos
              </label>
              <input
                type="number"
                min="0"
                max="59"
                value={config.customDeadlineMinutes ?? 0}
                onChange={(e) =>
                  onChange({ ...config, customDeadlineMinutes: parseInt(e.target.value, 10) || 0 })
                }
                className={PIPELINE_MODAL_INPUT}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                Segundos
              </label>
              <input
                type="number"
                min="0"
                max="59"
                value={config.customDeadlineSeconds ?? 0}
                onChange={(e) =>
                  onChange({ ...config, customDeadlineSeconds: parseInt(e.target.value, 10) || 0 })
                }
                className={PIPELINE_MODAL_INPUT}
              />
            </div>
          </div>
          <p className={AUTOMATION_HINT}>
            A tarefa vencerá após o tempo definido a partir do momento da criação.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SalesBotActiveEditor({
  config,
  onChange,
}: {
  config: any;
  onChange: (config: any) => void;
}) {
  const activeMode =
    config.active === 'personalized' || config.active === 'scheduled' ? 'personalized' : 'always';
  const schedule = config.activeSchedule || {
    days: [1, 2, 3, 4, 5],
    startTime: '09:00',
    endTime: '18:00',
  };

  const toggleDay = (day: number) => {
    const days: number[] = Array.isArray(schedule.days) ? [...schedule.days] : [];
    const nextDays = days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort();
    onChange({ ...config, activeSchedule: { ...schedule, days: nextDays } });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...config, active: 'always' })}
          className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
            activeMode === 'always'
              ? 'border-primary/45 bg-primary/10 text-primary-fixed-dim'
              : 'border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          Sempre
        </button>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...config,
              active: 'personalized',
              activeSchedule: schedule,
            })
          }
          className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
            activeMode === 'personalized'
              ? 'border-primary/45 bg-primary/10 text-primary-fixed-dim'
              : 'border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          Personalizado
        </button>
      </div>

      {activeMode === 'personalized' ? (
        <div className="rounded-lg border border-outline-variant bg-surface-container p-3 space-y-3">
          <div>
            <label className={PIPELINE_MODAL_LABEL}>Dias da semana</label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((day) => {
                const selected = (schedule.days || []).includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
                      selected
                        ? 'border-primary/45 bg-primary/10 text-primary-fixed-dim'
                        : 'border-outline-variant bg-surface-container-highest text-on-surface-variant'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={PIPELINE_MODAL_LABEL}>Início</label>
              <input
                type="time"
                value={schedule.startTime || '09:00'}
                onChange={(e) =>
                  onChange({
                    ...config,
                    active: 'personalized',
                    activeSchedule: { ...schedule, startTime: e.target.value },
                  })
                }
                className={PIPELINE_MODAL_INPUT}
              />
            </div>
            <div>
              <label className={PIPELINE_MODAL_LABEL}>Fim</label>
              <input
                type="time"
                value={schedule.endTime || '18:00'}
                onChange={(e) =>
                  onChange({
                    ...config,
                    active: 'personalized',
                    activeSchedule: { ...schedule, endTime: e.target.value },
                  })
                }
                className={PIPELINE_MODAL_INPUT}
              />
            </div>
          </div>
          <p className={AUTOMATION_HINT}>
            A automação só dispara dentro desta janela de horário nos dias selecionados.
          </p>
        </div>
      ) : null}
    </div>
  );
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
  const confirmModal = useConfirm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
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
        return {
          botId: '',
          delaySeconds: 0,
          trigger: 'when_moved_to_stage',
          active: 'always',
          executeTiming: 'immediate',
          executeDelayMinutes: 0,
          executeAtTime: '',
          conditions: [],
          activeSchedule: { days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00' },
        };
      case 'change_stage':
        return {
          targetStageId: '',
          trigger: 'when_moved_to_stage',
          executeTiming: 'immediate',
          executeDelayMinutes: 0,
          executeAtTime: '',
          conditions: [],
          active: 'always',
          activeSchedule: { days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00' },
        };
      case 'add_task':
        return {
          taskTitle: '',
          taskDescription: '',
          trigger: 'when_moved_to_stage',
          executeTiming: 'immediate',
          executeDelayMinutes: 0,
          executeAtTime: '',
          conditions: [],
          deadline: 'immediately',
          customDeadlineHours: 0,
          customDeadlineMinutes: 0,
          customDeadlineSeconds: 0,
          taskType: 'follow_up',
        };
      case 'change_user':
        return {
          trigger: 'when_moved_to_stage',
          assignTo: 'current_user',
          conditions: [],
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

  const handleDeleteBlock = async (blockId: string) => {
    const confirmed = await confirmModal({
      title: 'Excluir automação',
      message: 'Deseja realmente excluir esta automação?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
    });
    if (confirmed) {
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
      className={`${PIPELINE_MODAL_SELECT} mt-2`}
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
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (
      block.type === 'sales_bot' ||
      block.type === 'add_task' ||
      block.type === 'change_stage' ||
      block.type === 'change_user'
    ) {
      loadUsers();
      loadChannels();
    }
    if (block.type === 'sales_bot') {
      loadBots();
    }
  }, [block.type]);

  const loadUsers = async () => {
    try {
      const response = await api.get('/api/users?includeInactive=true');
      setUsers(
        (response.data || []).map((user: any) => ({ id: user.id, name: user.name || user.email })),
      );
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const loadChannels = async () => {
    try {
      const response = await api.get('/api/channels');
      setChannels(
        (response.data || []).map((channel: any) => ({ id: channel.id, name: channel.name })),
      );
    } catch (error) {
      console.error('Erro ao carregar canais:', error);
    }
  };

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
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-highest p-6 text-on-surface shadow-2xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="automation-config-title"
      >
        <div className="mb-6 border-b border-outline-variant pb-4">
          <h2 id="automation-config-title" className="font-headline text-xl font-bold tracking-tight">
            Configurar {getBlockName(block.type)}
          </h2>
          <p className="mt-1.5 text-sm text-on-surface-variant">
            Defina quando e como esta automação será executada na etapa.
          </p>
        </div>

        <div className="space-y-5">
        {block.type === 'sales_bot' && (
          <>
            <div>
              <label className={PIPELINE_MODAL_LABEL}>Para todos os leads com:</label>
              <SalesBotConditionsEditor
                conditions={config.conditions || []}
                users={users}
                channels={channels}
                onChange={(conditions) => onChange({ ...config, conditions })}
              />
            </div>

            <div>
              <label className={PIPELINE_MODAL_LABEL}>Executar:</label>
              <SalesBotExecuteEditor config={config} onChange={onChange} />
            </div>

            <div>
              <label className={PIPELINE_MODAL_LABEL}>Ativo:</label>
              <SalesBotActiveEditor config={config} onChange={onChange} />
            </div>

            <div>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={config.leaveUnanswered || false}
                  onChange={(e) => onChange({ ...config, leaveUnanswered: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-outline-variant accent-primary"
                />
                <span className="text-sm text-on-surface">Deixar mensagem sem resposta</span>
              </label>
              <p className={`${AUTOMATION_HINT} ml-6`}>
                As mensagens às quais o robô responde serão marcadas como não respondidas.
              </p>
            </div>

            <div>
              <h3 className={AUTOMATION_SECTION_TITLE}>Robô de vendas</h3>
              <div className="flex flex-col gap-2 sm:flex-row">
                {loadingBots ? (
                  <div className="w-full rounded-lg border border-outline-variant bg-surface-container py-3 text-center text-sm text-on-surface-variant">
                    Carregando bots...
                  </div>
                ) : (
                  <>
                    <select
                      value={config.botId || ''}
                      onChange={(e) => onChange({ ...config, botId: e.target.value })}
                      className={`${PIPELINE_MODAL_SELECT} flex-1`}
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
                      onClick={() => window.open('/bots', '_blank')}
                      className="shrink-0 rounded-lg border border-primary/35 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary-fixed-dim transition hover:bg-primary/15"
                    >
                      + Criar robô
                    </button>
                  </>
                )}
              </div>
              <p className={AUTOMATION_HINT}>Crie um novo robô ou selecione um existente.</p>
            </div>

            <div>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={config.applyToExisting || false}
                  onChange={(e) => onChange({ ...config, applyToExisting: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-outline-variant accent-primary"
                />
                <span className="text-sm text-on-surface">
                  Aplicar o gatilho a todos os leads já nesta etapa
                </span>
              </label>
            </div>
          </>
        )}

        {block.type === 'change_stage' && (
          <>
            <div>
              <label className={PIPELINE_MODAL_LABEL}>Para todos os leads com:</label>
              <SalesBotConditionsEditor
                conditions={config.conditions || []}
                users={users}
                channels={channels}
                onChange={(conditions) => onChange({ ...config, conditions })}
              />
            </div>

            <div>
              <label className={PIPELINE_MODAL_LABEL}>Executar:</label>
              <SalesBotExecuteEditor config={config} onChange={onChange} showChannelHint={false} />
            </div>

            <div>
              <label className={PIPELINE_MODAL_LABEL}>Ativo:</label>
              <SalesBotActiveEditor config={config} onChange={onChange} />
            </div>

            <div>
              <label className={PIPELINE_MODAL_LABEL}>Etapa de destino *</label>
              <select
                value={config.targetStageId || ''}
                onChange={(e) => onChange({ ...config, targetStageId: e.target.value })}
                className={PIPELINE_MODAL_SELECT}
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
            <div>
              <label className={PIPELINE_MODAL_LABEL}>Para todos os leads com:</label>
              <SalesBotConditionsEditor
                conditions={config.conditions || []}
                users={users}
                channels={channels}
                onChange={(conditions) => onChange({ ...config, conditions })}
              />
            </div>

            <div>
              <label className={PIPELINE_MODAL_LABEL}>Executar:</label>
              <SalesBotExecuteEditor config={config} onChange={onChange} showChannelHint={false} />
            </div>

            <div>
              <label className={PIPELINE_MODAL_LABEL}>Prazo da tarefa:</label>
              <TaskDeadlineEditor config={config} onChange={onChange} />
            </div>

            <div>
              <label className={PIPELINE_MODAL_LABEL}>Tipo de tarefa:</label>
              <select
                value={config.taskType || 'follow_up'}
                onChange={(e) => onChange({ ...config, taskType: e.target.value })}
                className={PIPELINE_MODAL_SELECT}
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

            <div>
              <label className={PIPELINE_MODAL_LABEL}>Título da tarefa *</label>
              <input
                type="text"
                value={config.taskTitle || getDefaultTaskTitle(config.taskType)}
                onChange={(e) => onChange({ ...config, taskTitle: e.target.value })}
                placeholder={getDefaultTaskTitle(config.taskType)}
                className={PIPELINE_MODAL_INPUT}
              />
            </div>

            <div>
              <label className={PIPELINE_MODAL_LABEL}>Descrição (opcional)</label>
              <textarea
                value={config.taskDescription || ''}
                onChange={(e) => onChange({ ...config, taskDescription: e.target.value })}
                placeholder="Descrição da tarefa..."
                rows={3}
                className={`${PIPELINE_MODAL_INPUT} min-h-[88px] resize-y`}
              />
            </div>
          </>
        )}

        {block.type === 'change_user' && (
          <>
            <div>
              <label className={PIPELINE_MODAL_LABEL}>Para todos os leads com:</label>
              <SalesBotConditionsEditor
                conditions={config.conditions || []}
                users={users}
                channels={channels}
                onChange={(conditions) => onChange({ ...config, conditions })}
              />
            </div>

            <div>
              <label className={PIPELINE_MODAL_LABEL}>Executar:</label>
              <select
                value={config.trigger || 'when_moved_to_stage'}
                onChange={(e) => onChange({ ...config, trigger: e.target.value })}
                className={PIPELINE_MODAL_SELECT}
              >
                <option value="when_created_in_stage">Imediatamente quando criado nesta etapa</option>
                <option value="when_moved_to_stage">Imediatamente quando movido para esta etapa</option>
                <option value="when_moved_or_created">Imediatamente quando movido para ou criado nesta etapa</option>
                <option value="when_user_changed">Quando o usuário responsável é alterado em lead</option>
              </select>
            </div>

            <div>
              <label className={PIPELINE_MODAL_LABEL}>Novo responsável:</label>
              <select
                value={config.assignTo || 'current_user'}
                onChange={(e) =>
                  onChange({
                    ...config,
                    assignTo: e.target.value,
                    assignedUserId:
                      e.target.value === 'specific_user' ? config.assignedUserId : undefined,
                  })
                }
                className={PIPELINE_MODAL_SELECT}
              >
                <option value="current_user">Manter usuário responsável atual</option>
                <option value="specific_user">Definir usuário específico</option>
                <option value="no_assignment">Sem atribuição</option>
              </select>
              {config.assignTo === 'specific_user' && (
                <TaskUserSelector config={config} onChange={onChange} />
              )}
            </div>
          </>
        )}

        {block.type !== 'sales_bot' && block.type !== 'add_task' && block.type !== 'change_stage' && (
          <div>
            <label className={PIPELINE_MODAL_LABEL}>Atraso antes de executar (segundos)</label>
            <input
              type="number"
              value={config.delaySeconds || 0}
              onChange={(e) => onChange({ ...config, delaySeconds: parseInt(e.target.value) || 0 })}
              min="0"
              className={PIPELINE_MODAL_INPUT}
            />
          </div>
        )}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-outline-variant pt-5 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-outline-variant bg-surface-container px-5 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-variant"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-on-primary shadow-emerald-send transition hover:brightness-110"
          >
            Finalizado
          </button>
        </div>
      </div>
    </div>
  );
}

