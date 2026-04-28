import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import PipelineAutomationModal from '../components/PipelineAutomationModal';
import { useConfirm, usePrompt } from '../components/ui/ConfirmProvider';

interface Pipeline {
  id: string;
  name: string;
  description?: string;
  color: string;
  isActive: boolean;
  stages: PipelineStage[];
  customFields?: PipelineCustomField[];
  _count?: {
    deals: number;
  };
}

interface PipelineStage {
  id: string;
  name: string;
  description?: string;
  color: string;
  order: number;
  probability: number;
  isActive: boolean;
  deals?: Deal[];
}

interface Deal {
  id: string;
  name: string; // Nome do lead/negócio
  value?: number;
  currency: string;
  status: 'OPEN' | 'WON' | 'LOST' | 'ABANDONED';
  probability: number;
  customFields?: Record<string, any>; // Campos personalizados
  contact: {
    id: string;
    name: string;
    phone?: string;
    profilePicture?: string;
  };
  assignedTo?: {
    id: string;
    name: string;
  };
  conversation?: {
    id: string;
    status: string;
    tags?: Array<{
      tagId: string;
      tag: {
        id: string;
        name: string;
        color?: string;
      };
    }>;
  };
}

interface PipelineCustomField {
  id: string;
  name: string;
  type: string; // TEXT, NUMBER, DATE, EMAIL, PHONE, SELECT
  required: boolean;
  options?: string[];
  order: number;
}

export default function Pipelines() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateDealModal, setShowCreateDealModal] = useState(false);
  const [showAutomationModal, setShowAutomationModal] = useState(false);
  const [draggedDeal, setDraggedDeal] = useState<{ dealId: string; stageId: string } | null>(null);
  const [selectedDealIds, setSelectedDealIds] = useState<string[]>([]);

  useEffect(() => {
    fetchPipelines();
  }, []);

  const fetchPipelines = async () => {
    try {
      const response = await api.get('/api/pipelines');
      setPipelines(response.data);
      if (response.data.length > 0 && !selectedPipeline) {
        setSelectedPipeline(response.data[0]);
        await fetchPipelineDetails(response.data[0].id);
      }
    } catch (error: any) {
      console.error('Erro ao carregar pipelines:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPipelineDetails = async (pipelineId: string) => {
    try {
      const response = await api.get(`/api/pipelines/${pipelineId}`);
      const updatedPipeline = response.data;
      setSelectedPipeline(updatedPipeline);
      setPipelines((prev) =>
        prev.map((p) => (p.id === pipelineId ? updatedPipeline : p))
      );
    } catch (error: any) {
      console.error('Erro ao carregar detalhes do pipeline:', error);
    }
  };

  const handlePipelineSelect = async (pipeline: Pipeline) => {
    setSelectedPipeline(pipeline);
    setSelectedDealIds([]);
    await fetchPipelineDetails(pipeline.id);
  };

  const handleDragStart = (dealId: string, stageId: string) => {
    setDraggedDeal({ dealId, stageId });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetStageId: string) => {
    if (!draggedDeal || draggedDeal.stageId === targetStageId) {
      setDraggedDeal(null);
      return;
    }

    try {
      await api.put(`/api/pipelines/deals/${draggedDeal.dealId}/move`, {
        stageId: targetStageId,
      });

      // Atualizar pipeline
      if (selectedPipeline) {
        await fetchPipelineDetails(selectedPipeline.id);
      }
    } catch (error: any) {
      console.error('Erro ao mover negócio:', error);
      alert(error.response?.data?.error || 'Erro ao mover negócio');
    } finally {
      setDraggedDeal(null);
    }
  };

  const formatCurrency = (value: number, currency: string = 'BRL') => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency,
    }).format(value);
  };

  const toggleDealSelection = (dealId: string) => {
    setSelectedDealIds((prev) =>
      prev.includes(dealId) ? prev.filter((id) => id !== dealId) : [...prev, dealId]
    );
  };

  const handleDeleteSelectedDeals = async () => {
    if (!selectedPipeline || selectedDealIds.length === 0) return;

    const confirmed = await confirm({
      title: 'Excluir negócios',
      message: `Deseja realmente excluir ${selectedDealIds.length} negócio(s) selecionado(s)? Esta ação não pode ser desfeita.`,
    });
    if (!confirmed) {
      return;
    }

    try {
      await Promise.all(
        selectedDealIds.map((dealId) =>
          api.delete(`/api/pipelines/deals/${dealId}`)
        )
      );

      setSelectedDealIds([]);
      await fetchPipelineDetails(selectedPipeline.id);
    } catch (error: any) {
      console.error('Erro ao excluir negócios selecionados:', error);
      alert(error.response?.data?.error || 'Erro ao excluir negócios selecionados');
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-60px)] items-center justify-center bg-surface font-body text-on-surface-variant">
        Carregando pipelines...
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-60px)] flex-col bg-surface px-5 py-5 font-body text-on-surface">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary/60">CRM</p>
          <h1 className="m-0 font-headline text-3xl font-bold text-on-surface">Pipeline de Vendas</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedPipeline && (
            <>
              <button
                onClick={() => setShowEditModal(true)}
                className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/20"
              >
                ✏️ Editar funil
              </button>
              <button
                onClick={() => setShowAutomationModal(true)}
                className="rounded-lg border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary-fixed-dim transition hover:bg-primary/20"
              >
                ⚡ AUTOMATIZE
              </button>
              <button
                onClick={() => setShowCreateDealModal(true)}
                className="primary-gradient-channel rounded-lg px-4 py-2 text-sm font-bold text-[#003919] shadow-emerald-send transition hover:brightness-110"
              >
                + Novo Negócio
              </button>
            </>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg border border-outline-variant bg-surface-container-highest px-4 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
          >
            + Novo Pipeline
          </button>
        </div>
      </div>

      {/* Lista de Pipelines */}
      {pipelines.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2.5 rounded-xl border border-outline-variant bg-surface-container-low p-3">
          {pipelines.map((pipeline) => (
            <button
              key={pipeline.id}
              onClick={() => handlePipelineSelect(pipeline)}
              className={`rounded-lg border px-3.5 py-2 text-sm transition ${
                selectedPipeline?.id === pipeline.id
                  ? 'border-primary/40 bg-primary/15 font-semibold text-primary-fixed-dim'
                  : 'border-outline-variant bg-surface-container-highest text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {pipeline.name} ({pipeline._count?.deals || 0})
            </button>
          ))}
        </div>
      )}

      {/* Barra de ações em massa para deals selecionados */}
      {selectedPipeline && selectedDealIds.length > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-900/25 px-4 py-2.5 text-sm text-amber-100">
          <span>
            {selectedDealIds.length} negócio(s) selecionado(s)
          </span>
          <button
            onClick={handleDeleteSelectedDeals}
            className="rounded-md border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
          >
            Excluir selecionados
          </button>
        </div>
      )}

      {/* Visualização do Pipeline (Kanban) */}
      {selectedPipeline && (
        <div className="flex flex-1 gap-4 overflow-x-auto overflow-y-hidden pb-4">
          {selectedPipeline.stages
            .filter((stage) => stage.isActive)
            .sort((a, b) => a.order - b.order)
            .map((stage) => (
              <div
                key={stage.id}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(stage.id)}
                className="flex max-h-full min-w-[300px] flex-col rounded-xl border border-outline-variant bg-surface-container-low p-4 shadow-forest-glow"
              >
                {/* Header da Stage */}
                <div className="mb-4 flex items-center justify-between border-b-2 pb-3" style={{ borderColor: stage.color }}>
                  <div>
                    <h3 className="m-0 text-base font-semibold text-on-surface">{stage.name}</h3>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {stage.deals?.length || 0} negócios • {stage.probability}% probabilidade
                    </p>
                  </div>
                </div>

                {/* Lista de Deals */}
                <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
                  {stage.deals && stage.deals.length > 0 ? (
                    stage.deals.map((deal) => (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={() => handleDragStart(deal.id, stage.id)}
                        onClick={() => navigate(`/pipelines/deals/${deal.id}`)}
                        className={`cursor-pointer rounded-lg border p-3 transition-all hover:-translate-y-0.5 hover:shadow-forest-glow ${
                          selectedDealIds.includes(deal.id)
                            ? 'border-primary/45 bg-primary/10'
                            : 'border-outline-variant bg-surface-container-high'
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <input
                            type="checkbox"
                            checked={selectedDealIds.includes(deal.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleDealSelection(deal.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="mb-2">
                          <h4 className="m-0 text-sm font-semibold text-on-surface">{deal.name}</h4>
                          {deal.customFields && Object.keys(deal.customFields).length > 0 && (
                            <div className="mt-1 text-[11px] text-on-surface-variant">
                              {Object.entries(deal.customFields).slice(0, 2).map(([key, value]) => (
                                <div key={key}>
                                  <strong>{key}:</strong> {String(value)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-base font-semibold text-primary-fixed-dim">
                            {formatCurrency(Number(deal.value || 0), deal.currency)}
                          </span>
                          <span className="rounded-md bg-surface-container-highest px-1.5 py-0.5 text-[11px] text-on-surface-variant">
                            {deal.probability}%
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-on-surface-variant">
                          <span>{deal.contact.name}</span>
                          {deal.assignedTo && (
                            <span className="text-[11px]">👤 {deal.assignedTo.name}</span>
                          )}
                        </div>
                        {(deal.conversation?.tags || []).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {deal.conversation!.tags!.slice(0, 3).map((item) => (
                              <span
                                key={item.tag.id}
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                                style={{ backgroundColor: item.tag.color || '#3B82F6' }}
                                title={item.tag.name}
                              >
                                {item.tag.name}
                              </span>
                            ))}
                            {deal.conversation!.tags!.length > 3 && (
                              <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
                                +{deal.conversation!.tags!.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="px-5 py-10 text-center text-sm text-on-surface-variant">
                      Nenhum negócio nesta etapa
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Modal de Criar Pipeline */}
      {showCreateModal && (
        <CreatePipelineModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchPipelines();
          }}
        />
      )}

      {/* Modal de Editar Pipeline */}
      {showEditModal && selectedPipeline && (
        <EditPipelineModal
          pipeline={selectedPipeline}
          onClose={() => setShowEditModal(false)}
          onSuccess={async () => {
            await fetchPipelines();
            await fetchPipelineDetails(selectedPipeline.id);
          }}
        />
      )}

      {/* Modal de Criar Deal */}
      {showCreateDealModal && selectedPipeline && (
        <CreateDealModal
          pipeline={selectedPipeline}
          onClose={() => setShowCreateDealModal(false)}
          onSuccess={() => {
            setShowCreateDealModal(false);
            fetchPipelineDetails(selectedPipeline.id);
          }}
        />
      )}

      {/* Modal de Automação */}
      {showAutomationModal && selectedPipeline && (
        <PipelineAutomationModal
          pipeline={selectedPipeline}
          onClose={() => setShowAutomationModal(false)}
        />
      )}

    </div>
  );
}

const PIPELINE_MODAL_LABEL =
  'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant';
const PIPELINE_MODAL_INPUT =
  'w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/55 outline-none transition focus:border-primary/45 focus:ring-1 focus:ring-primary/25';
const PIPELINE_MODAL_SELECT = `${PIPELINE_MODAL_INPUT} cursor-pointer`;

// Modal para criar pipeline
function CreatePipelineModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [stages, setStages] = useState<Array<{ name: string; order: number; probability: number }>>([
    { name: 'Qualificação', order: 0, probability: 10 },
    { name: 'Proposta', order: 1, probability: 50 },
    { name: 'Negociação', order: 2, probability: 75 },
    { name: 'Fechamento', order: 3, probability: 100 },
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/pipelines', {
        name,
        description,
        color,
        stages,
      });
      onSuccess();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao criar pipeline');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-highest p-6 shadow-2xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="create-pipeline-title"
      >
        <div className="mb-6 border-b border-outline-variant pb-4">
          <h2
            id="create-pipeline-title"
            className="font-headline text-xl font-bold tracking-tight text-on-surface"
          >
            Criar novo pipeline
          </h2>
          <p className="mt-1.5 text-sm text-on-surface-variant">
            Defina nome, cor e etapas iniciais. Você pode ajustar depois em &quot;Editar funil&quot;.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="pipeline-name" className={PIPELINE_MODAL_LABEL}>
              Nome do pipeline
            </label>
            <input
              id="pipeline-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={PIPELINE_MODAL_INPUT}
              placeholder="Ex.: Vendas, Suporte, etc."
            />
          </div>

          <div>
            <label htmlFor="pipeline-desc" className={PIPELINE_MODAL_LABEL}>
              Descrição
            </label>
            <textarea
              id="pipeline-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${PIPELINE_MODAL_INPUT} min-h-[88px] resize-y`}
              placeholder="Descrição opcional (visível para a equipe)"
            />
          </div>

          <div>
            <label className={PIPELINE_MODAL_LABEL}>Cor do funil</label>
            <p className="mb-2 text-xs text-on-surface-variant/90">
              Clique no retângulo para abrir o seletor do sistema. A cor aparece na lista de pipelines.
            </p>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface-container px-3 py-3 sm:py-2.5">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                title="Escolher cor"
                aria-label="Escolher cor do pipeline"
                className="h-11 w-[4.5rem] shrink-0 cursor-pointer rounded-lg border border-outline-variant bg-surface-container-highest p-1"
              />
              <code className="rounded-md bg-surface-container-highest px-2 py-1 font-mono text-sm text-on-surface">
                {color.toUpperCase()}
              </code>
              <span
                className="ml-auto h-9 w-9 shrink-0 rounded-lg border border-outline-variant shadow-inner"
                style={{ backgroundColor: color }}
                aria-hidden
              />
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-end justify-between gap-2">
              <div>
                <span className={PIPELINE_MODAL_LABEL}>Etapas do pipeline</span>
                <p className="mt-0.5 text-xs text-on-surface-variant/90">
                  Probabilidade em % (0–100) por etapa.
                </p>
              </div>
            </div>
            <div className="space-y-2.5">
              {stages.map((stage, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-2.5 rounded-xl border border-outline-variant bg-surface-container p-3 sm:flex-row sm:items-center sm:gap-3"
                >
                  <input
                    type="text"
                    value={stage.name}
                    onChange={(e) => {
                      const newStages = [...stages];
                      newStages[index].name = e.target.value;
                      setStages(newStages);
                    }}
                    placeholder="Nome da etapa"
                    className={`${PIPELINE_MODAL_INPUT} sm:min-w-0 sm:flex-1`}
                  />
                  <div className="flex shrink-0 items-center gap-2 sm:w-auto">
                    <label className="sr-only" htmlFor={`stage-prob-${index}`}>
                      Probabilidade %
                    </label>
                    <div className="relative">
                      <input
                        id={`stage-prob-${index}`}
                        type="number"
                        value={stage.probability}
                        onChange={(e) => {
                          const newStages = [...stages];
                          newStages[index].probability = parseInt(e.target.value, 10) || 0;
                          setStages(newStages);
                        }}
                        min={0}
                        max={100}
                        className={`${PIPELINE_MODAL_INPUT} w-[5.5rem] pr-7 text-center tabular-nums sm:w-[6rem]`}
                        aria-describedby={`stage-prob-hint-${index}`}
                      />
                      <span
                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant"
                        id={`stage-prob-hint-${index}`}
                      >
                        %
                      </span>
                    </div>
                    {stages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setStages(stages.filter((_, i) => i !== index));
                        }}
                        className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-error/20"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setStages([
                  ...stages,
                  { name: '', order: stages.length, probability: 0 },
                ]);
              }}
              className="mt-3 w-full rounded-lg border border-dashed border-primary/35 bg-primary/5 py-2.5 text-sm font-semibold text-primary-fixed-dim transition hover:bg-primary/10 sm:w-auto sm:px-4"
            >
              + Adicionar etapa
            </button>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-outline-variant pt-5 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-outline-variant bg-surface-container px-5 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-variant"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-on-primary transition hover:brightness-110"
            >
              Criar pipeline
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal para editar pipeline
function EditPipelineModal({
  pipeline,
  onClose,
  onSuccess,
}: {
  pipeline: Pipeline;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [name, setName] = useState(pipeline.name);
  const [description, setDescription] = useState(pipeline.description || '');
  const [color, setColor] = useState(pipeline.color || '#3B82F6');
  const [stages, setStages] = useState<PipelineStage[]>(
    [...(pipeline.stages || [])].sort((a, b) => a.order - b.order)
  );
  const [savingStages, setSavingStages] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/api/pipelines/${pipeline.id}`, {
        name,
        description,
        color,
      });
      await onSuccess();
      onClose();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao atualizar pipeline');
    }
  };

  const handleAddStage = async () => {
    const name = await prompt({
      title: 'Nova etapa',
      message: 'Nome da nova etapa:',
      placeholder: 'Ex: Qualificação',
      confirmText: 'Criar',
    });
    if (!name) return;

    try {
      setSavingStages(true);
      const response = await api.post(`/api/pipelines/${pipeline.id}/stages`, {
        name,
        order: stages.length,
        probability: 0,
      });
      setStages((prev) =>
        [...prev, response.data].sort((a, b) => a.order - b.order)
      );
      onSuccess();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao criar etapa');
    } finally {
      setSavingStages(false);
    }
  };

  const handleDeleteStage = async (stage: PipelineStage) => {
    const confirmed = await confirm({
      title: 'Excluir etapa',
      message: `Deseja realmente excluir a etapa "${stage.name}"? Ela não pode ter negócios associados.`,
    });
    if (!confirmed) {
      return;
    }

    try {
      setSavingStages(true);
      await api.delete(`/api/pipelines/stages/${stage.id}`);
      setStages((prev) => prev.filter((s) => s.id !== stage.id));
      onSuccess();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao excluir etapa');
    } finally {
      setSavingStages(false);
    }
  };

  const handleMoveStage = async (stageId: string, direction: 'up' | 'down') => {
    const currentIndex = stages.findIndex((s) => s.id === stageId);
    if (currentIndex === -1) return;

    const targetIndex =
      direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const newStages = [...stages];
    const [removed] = newStages.splice(currentIndex, 1);
    newStages.splice(targetIndex, 0, removed);

    // Recalcular order localmente
    const stageOrders = newStages.map((s, index) => ({
      id: s.id,
      order: index,
    }));

    try {
      setSavingStages(true);
      await api.put(`/api/pipelines/${pipeline.id}/stages/reorder`, {
        stages: stageOrders,
      });
      setStages(
        newStages.map((s, index) => ({
          ...s,
          order: index,
        }))
      );
      onSuccess();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao reordenar etapas');
    } finally {
      setSavingStages(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-highest p-6 shadow-2xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="edit-pipeline-title"
      >
        <div className="mb-6 border-b border-outline-variant pb-4">
          <h2 id="edit-pipeline-title" className="font-headline text-xl font-bold tracking-tight text-on-surface">
            Editar pipeline
          </h2>
          <p className="mt-1.5 text-sm text-on-surface-variant">
            Nome, descrição e cor. Reordene ou remova etapas — negócios não podem ficar em etapa excluída.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="edit-pipeline-name" className={PIPELINE_MODAL_LABEL}>
              Nome do pipeline
            </label>
            <input
              id="edit-pipeline-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={PIPELINE_MODAL_INPUT}
            />
          </div>

          <div>
            <label htmlFor="edit-pipeline-desc" className={PIPELINE_MODAL_LABEL}>
              Descrição
            </label>
            <textarea
              id="edit-pipeline-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${PIPELINE_MODAL_INPUT} min-h-[88px] resize-y`}
              placeholder="Descrição opcional do pipeline"
            />
          </div>

          <div>
            <label className={PIPELINE_MODAL_LABEL}>Cor do funil</label>
            <p className="mb-2 text-xs text-on-surface-variant/90">
              Clique no retângulo para alterar. O código hex é só referência.
            </p>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface-container px-3 py-3 sm:py-2.5">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                title="Escolher cor"
                aria-label="Escolher cor do pipeline"
                className="h-11 w-[4.5rem] shrink-0 cursor-pointer rounded-lg border border-outline-variant bg-surface-container-highest p-1"
              />
              <code className="rounded-md bg-surface-container-highest px-2 py-1 font-mono text-sm text-on-surface">
                {color.toUpperCase()}
              </code>
              <span
                className="ml-auto h-9 w-9 shrink-0 rounded-lg border border-outline-variant shadow-inner"
                style={{ backgroundColor: color }}
                aria-hidden
              />
            </div>
          </div>

          <div>
            <div className="mb-3">
              <span className={PIPELINE_MODAL_LABEL}>Etapas</span>
              <p className="mt-0.5 text-xs text-on-surface-variant/90">
                Use as setas para reordenar. {savingStages ? 'Salvando…' : ''}
              </p>
            </div>
            <div className="space-y-2">
              {stages
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((stage, index) => (
                  <div
                    key={stage.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 sm:flex-nowrap"
                  >
                    <span className="w-6 shrink-0 text-center text-xs font-bold tabular-nums text-on-surface-variant">
                      {index + 1}.
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium text-on-surface">{stage.name}</span>
                    <span className="shrink-0 rounded-md bg-surface-container-highest px-2 py-0.5 text-xs tabular-nums text-on-surface-variant">
                      {stage.probability}%
                    </span>
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0 || savingStages}
                        onClick={() => handleMoveStage(stage.id, 'up')}
                        className="rounded-lg border border-outline-variant bg-surface-container-highest px-2 py-1.5 text-xs font-semibold text-on-surface transition enabled:hover:border-primary/40 enabled:hover:text-primary-fixed-dim disabled:cursor-not-allowed disabled:opacity-35"
                        title="Mover para cima"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={index === stages.length - 1 || savingStages}
                        onClick={() => handleMoveStage(stage.id, 'down')}
                        className="rounded-lg border border-outline-variant bg-surface-container-highest px-2 py-1.5 text-xs font-semibold text-on-surface transition enabled:hover:border-primary/40 enabled:hover:text-primary-fixed-dim disabled:cursor-not-allowed disabled:opacity-35"
                        title="Mover para baixo"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteStage(stage)}
                        disabled={savingStages}
                        className="rounded-lg border border-error/40 bg-error/10 px-2.5 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-error/20 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
            </div>
            <button
              type="button"
              onClick={handleAddStage}
              disabled={savingStages}
              className="mt-3 w-full rounded-lg border border-dashed border-primary/35 bg-primary/5 py-2.5 text-sm font-semibold text-primary-fixed-dim transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-4"
            >
              + Adicionar etapa
            </button>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-outline-variant pt-5 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-outline-variant bg-surface-container px-5 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-variant"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-on-primary transition hover:brightness-110"
            >
              Salvar alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal para criar deal
function CreateDealModal({
  pipeline,
  onClose,
  onSuccess,
}: {
  pipeline: Pipeline;
  onClose: () => void;
  onSuccess: () => void;
}) {
  interface ContactOption {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    channelId?: string | null;
  }

  interface ChannelOption {
    id: string;
    name: string;
    type: string;
  }

  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('BRL');
  const [selectedStageId, setSelectedStageId] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [customFieldsValues, setCustomFieldsValues] = useState<Record<string, any>>({});
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [createNewContact, setCreateNewContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactChannelId, setNewContactChannelId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Definir primeira etapa como padrão
    if (pipeline.stages && pipeline.stages.length > 0) {
      const firstStage = pipeline.stages
        .filter((s) => s.isActive)
        .sort((a, b) => a.order - b.order)[0];
      if (firstStage) {
        setSelectedStageId(firstStage.id);
      }
    }
    fetchContactsAndChannels();
  }, [pipeline]);

  const fetchContactsAndChannels = async () => {
    try {
      setLoading(true);
      const [contactsResponse, channelsResponse] = await Promise.all([
        api.get('/api/contacts?limit=300'),
        api.get('/api/channels'),
      ]);
      setContacts(contactsResponse.data?.contacts || []);
      setChannels(channelsResponse.data || []);
    } catch (error: any) {
      console.error('Erro ao carregar contatos/canais:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStageId) {
      alert('Por favor, selecione uma etapa');
      return;
    }

    try {
      setSubmitting(true);
      let finalContactId = selectedContactId;

      if (createNewContact) {
        if (!newContactName.trim() || !newContactChannelId) {
          alert('Para criar contato, informe nome e canal.');
          setSubmitting(false);
          return;
        }
        const channelIdentifier =
          newContactPhone.trim() ||
          newContactEmail.trim() ||
          `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const createdContactResponse = await api.post('/api/contacts', {
          name: newContactName.trim(),
          phone: newContactPhone.trim() || undefined,
          email: newContactEmail.trim() || undefined,
          channelId: newContactChannelId,
          channelIdentifier,
        });
        finalContactId = createdContactResponse.data.id;
      }

      if (!finalContactId) {
        alert('Selecione um contato existente ou crie um novo contato.');
        setSubmitting(false);
        return;
      }

      // Montar customFields apenas com valores preenchidos
      const customFields: Record<string, any> = {};
      if (pipeline.customFields) {
        pipeline.customFields.forEach((field) => {
          const fieldValue = customFieldsValues[field.id];
          if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
            customFields[field.id] = fieldValue;
          }
        });
      }

      await api.post('/api/pipelines/deals', {
        pipelineId: pipeline.id,
        stageId: selectedStageId,
        contactId: finalContactId,
        name: name,
        value: value ? parseFloat(value) : undefined,
        currency: currency,
        customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      });
      onSuccess();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao criar negócio');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-highest p-6 text-on-surface shadow-2xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="create-deal-title"
      >
        <div className="mb-6 border-b border-outline-variant pb-4">
          <h2 id="create-deal-title" className="font-headline text-xl font-bold tracking-tight">
            Criar novo negócio
          </h2>
          <p className="mt-1.5 text-sm text-on-surface-variant">
            Vincule a um contato e escolha a etapa inicial do funil <span className="text-on-surface">{pipeline.name}</span>.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="deal-contact" className={PIPELINE_MODAL_LABEL}>
              Contato *
            </label>
            <div className="mb-2 flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-on-surface-variant">
                <input
                  type="radio"
                  checked={!createNewContact}
                  onChange={() => setCreateNewContact(false)}
                />
                Selecionar existente
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-on-surface-variant">
                <input
                  type="radio"
                  checked={createNewContact}
                  onChange={() => setCreateNewContact(true)}
                />
                Criar novo contato
              </label>
            </div>
            {loading ? (
              <div className="rounded-lg border border-outline-variant bg-surface-container py-8 text-center text-sm text-on-surface-variant">
                Carregando contatos…
              </div>
            ) : createNewContact ? (
              <div className="space-y-3 rounded-lg border border-outline-variant bg-surface-container p-3">
                <input
                  type="text"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="Nome do contato *"
                  className={PIPELINE_MODAL_INPUT}
                  required={createNewContact}
                />
                <input
                  type="text"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  placeholder="Telefone (opcional)"
                  className={PIPELINE_MODAL_INPUT}
                />
                <input
                  type="email"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  placeholder="E-mail (opcional)"
                  className={PIPELINE_MODAL_INPUT}
                />
                <select
                  value={newContactChannelId}
                  onChange={(e) => setNewContactChannelId(e.target.value)}
                  className={PIPELINE_MODAL_SELECT}
                  required={createNewContact}
                >
                  <option value="">Selecione o canal *</option>
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name} ({ch.type})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <select
                id="deal-contact"
                value={selectedContactId}
                onChange={(e) => {
                  setSelectedContactId(e.target.value);
                }}
                required
                className={PIPELINE_MODAL_SELECT}
              >
                <option value="">Selecione um contato</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name} {contact.phone ? `(${contact.phone})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label htmlFor="deal-stage" className={PIPELINE_MODAL_LABEL}>
              Etapa inicial *
            </label>
            <select
              id="deal-stage"
              value={selectedStageId}
              onChange={(e) => setSelectedStageId(e.target.value)}
              required
              className={PIPELINE_MODAL_SELECT}
            >
              {pipeline.stages
                .filter((s) => s.isActive)
                .sort((a, b) => a.order - b.order)
                .map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name} ({stage.probability}%)
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label htmlFor="deal-name" className={PIPELINE_MODAL_LABEL}>
              Nome do lead / negócio *
            </label>
            <input
              id="deal-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: João Silva"
              required
              className={PIPELINE_MODAL_INPUT}
            />
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:gap-4">
            <div className="min-w-0 flex-1">
              <label htmlFor="deal-value" className={PIPELINE_MODAL_LABEL}>
                Valor
              </label>
              <input
                id="deal-value"
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0,00"
                className={PIPELINE_MODAL_INPUT}
              />
            </div>
            <div className="w-full shrink-0 sm:w-28">
              <label htmlFor="deal-currency" className={PIPELINE_MODAL_LABEL}>
                Moeda
              </label>
              <select
                id="deal-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={PIPELINE_MODAL_SELECT}
              >
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          {pipeline.customFields && pipeline.customFields.length > 0 && (
            <div className="rounded-xl border border-outline-variant bg-surface-container p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Informações adicionais
              </p>
              <div className="space-y-3">
                {pipeline.customFields.map((field) => (
                  <div key={field.id}>
                    <label htmlFor={`cf-${field.id}`} className="mb-1 block text-sm font-medium text-on-surface">
                      {field.name} {field.required && <span className="text-primary">*</span>}
                    </label>
                    {field.type === 'SELECT' ? (
                      <select
                        id={`cf-${field.id}`}
                        value={customFieldsValues[field.id] || ''}
                        onChange={(e) => setCustomFieldsValues({ ...customFieldsValues, [field.id]: e.target.value })}
                        required={field.required}
                        className={PIPELINE_MODAL_SELECT}
                      >
                        <option value="">Selecione…</option>
                        {field.options?.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'NUMBER' ? (
                      <input
                        id={`cf-${field.id}`}
                        type="number"
                        value={customFieldsValues[field.id] || ''}
                        onChange={(e) => setCustomFieldsValues({ ...customFieldsValues, [field.id]: e.target.value })}
                        required={field.required}
                        className={PIPELINE_MODAL_INPUT}
                      />
                    ) : field.type === 'DATE' ? (
                      <input
                        id={`cf-${field.id}`}
                        type="date"
                        value={customFieldsValues[field.id] || ''}
                        onChange={(e) => setCustomFieldsValues({ ...customFieldsValues, [field.id]: e.target.value })}
                        required={field.required}
                        className={PIPELINE_MODAL_INPUT}
                      />
                    ) : (
                      <input
                        id={`cf-${field.id}`}
                        type={field.type === 'EMAIL' ? 'email' : field.type === 'PHONE' ? 'tel' : 'text'}
                        value={customFieldsValues[field.id] || ''}
                        onChange={(e) => setCustomFieldsValues({ ...customFieldsValues, [field.id]: e.target.value })}
                        required={field.required}
                        placeholder={`Digite ${field.name.toLowerCase()}`}
                        className={PIPELINE_MODAL_INPUT}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-outline-variant pt-5 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-outline-variant bg-surface-container px-5 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-variant"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-on-primary shadow-emerald-send transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {submitting ? 'Criando…' : 'Criar negócio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal removido - Agora usa página separada DealDetail

