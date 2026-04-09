import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import PipelineAutomationModal from '../components/PipelineAutomationModal';

interface Pipeline {
  id: string;
  name: string;
  description?: string;
  color: string;
  isActive: boolean;
  stages: PipelineStage[];
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

    if (
      !window.confirm(
        `Deseja realmente excluir ${selectedDealIds.length} negócio(s) selecionado(s)? Esta ação não pode ser desfeita.`
      )
    ) {
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
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          width: '90%',
          maxWidth: '500px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 20px 0' }}>Criar Novo Pipeline</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
              Nome do Pipeline
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
              }}
              placeholder="Ex: Vendas, Suporte, etc."
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
              Descrição
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                minHeight: '80px',
                resize: 'vertical',
              }}
              placeholder="Descrição opcional do pipeline"
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
              Cor
            </label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{
                width: '100%',
                height: '40px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              Etapas do Pipeline
            </label>
            {stages.map((stage, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '8px',
                  alignItems: 'center',
                }}
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
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
                <input
                  type="number"
                  value={stage.probability}
                  onChange={(e) => {
                    const newStages = [...stages];
                    newStages[index].probability = parseInt(e.target.value) || 0;
                    setStages(newStages);
                  }}
                  min="0"
                  max="100"
                  placeholder="%"
                  style={{
                    width: '80px',
                    padding: '6px 10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
                {stages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setStages(stages.filter((_, i) => i !== index));
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Remover
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setStages([
                  ...stages,
                  { name: '', order: stages.length, probability: 0 },
                ]);
              }}
              style={{
                marginTop: '8px',
                padding: '8px 16px',
                backgroundColor: '#e5e7eb',
                color: '#1f2937',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              + Adicionar Etapa
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                backgroundColor: '#e5e7eb',
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
              type="submit"
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
              Criar Pipeline
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
    const name = window.prompt('Nome da nova etapa:');
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
    if (
      !window.confirm(
        `Deseja realmente excluir a etapa "${stage.name}"? Ela não pode ter negócios associados.`
      )
    ) {
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
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          width: '90%',
          maxWidth: '500px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 20px 0' }}>Editar Pipeline</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
              Nome do Pipeline
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
              Descrição
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                minHeight: '80px',
                resize: 'vertical',
              }}
              placeholder="Descrição opcional do pipeline"
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
              Cor
            </label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{
                width: '100%',
                height: '40px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              Etapas do Pipeline
            </label>
            {stages
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((stage, index) => (
                <div
                  key={stage.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#f9fafb',
                  }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      width: '20px',
                      textAlign: 'center',
                    }}
                  >
                    {index + 1}.
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: '14px',
                      color: '#111827',
                    }}
                  >
                    {stage.name}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#6b7280',
                    }}
                  >
                    {stage.probability}%
                  </span>
                  <button
                    type="button"
                    disabled={index === 0 || savingStages}
                    onClick={() => handleMoveStage(stage.id, 'up')}
                    style={{
                      padding: '4px 6px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: index === 0 ? '#e5e7eb' : '#d1fae5',
                      color: '#065f46',
                      cursor: index === 0 || savingStages ? 'default' : 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === stages.length - 1 || savingStages}
                    onClick={() => handleMoveStage(stage.id, 'down')}
                    style={{
                      padding: '4px 6px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor:
                        index === stages.length - 1 ? '#e5e7eb' : '#dbeafe',
                      color: '#1d4ed8',
                      cursor:
                        index === stages.length - 1 || savingStages
                          ? 'default'
                          : 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteStage(stage)}
                    disabled={savingStages}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: savingStages ? 'default' : 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Excluir
                  </button>
                </div>
              ))}
            <button
              type="button"
              onClick={handleAddStage}
              disabled={savingStages}
              style={{
                marginTop: '8px',
                padding: '8px 16px',
                backgroundColor: '#e5e7eb',
                color: '#1f2937',
                border: 'none',
                borderRadius: '6px',
                cursor: savingStages ? 'default' : 'pointer',
                fontSize: '14px',
              }}
            >
              + Adicionar etapa
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                backgroundColor: '#e5e7eb',
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
              type="submit"
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
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('BRL');
  const [selectedStageId, setSelectedStageId] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [customFieldsValues, setCustomFieldsValues] = useState<Record<string, any>>({});
  const [conversations, setConversations] = useState<any[]>([]);
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
    fetchConversations();
  }, [pipeline]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/conversations?limit=100');
      setConversations(response.data.conversations || []);
    } catch (error: any) {
      console.error('Erro ao carregar conversas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedContactId || !selectedStageId) {
      alert('Por favor, selecione um contato e uma etapa');
      return;
    }

    try {
      setSubmitting(true);
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
        contactId: selectedContactId,
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

  // Agrupar conversas por contato
  const contactsMap = new Map();
  conversations.forEach((conv) => {
    if (conv.contact) {
      const contactId = conv.contact.id;
      if (!contactsMap.has(contactId)) {
        contactsMap.set(contactId, {
          id: contactId,
          name: conv.contact.name,
          phone: conv.contact.phone,
          profilePicture: conv.contact.profilePicture,
          conversations: [],
        });
      }
      contactsMap.get(contactId).conversations.push(conv);
    }
  });

  const contacts = Array.from(contactsMap.values());

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
        zIndex: 1000,
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
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 20px 0' }}>Criar Novo Negócio</h2>
        <form onSubmit={handleSubmit}>
          {/* Seleção de Contato */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
              Contato *
            </label>
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>Carregando contatos...</div>
            ) : (
              <select
                value={selectedContactId}
                onChange={(e) => {
                  setSelectedContactId(e.target.value);
                }}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
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

          {/* Seleção de Etapa */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
              Etapa Inicial *
            </label>
            <select
              value={selectedStageId}
              onChange={(e) => setSelectedStageId(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
              }}
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

          {/* Nome */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
              Nome do Lead/Negócio *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Silva"
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
          </div>

          {/* Valor e Moeda */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                Valor
              </label>
              <input
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>
            <div style={{ width: '100px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                Moeda
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              >
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          {/* Campos Personalizados */}
          {pipeline.customFields && pipeline.customFields.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                Informações Adicionais
              </label>
              {pipeline.customFields.map((field) => (
                <div key={field.id} style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>
                    {field.name} {field.required && '*'}
                  </label>
                  {field.type === 'SELECT' ? (
                    <select
                      value={customFieldsValues[field.id] || ''}
                      onChange={(e) => setCustomFieldsValues({ ...customFieldsValues, [field.id]: e.target.value })}
                      required={field.required}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="">Selecione...</option>
                      {field.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'NUMBER' ? (
                    <input
                      type="number"
                      value={customFieldsValues[field.id] || ''}
                      onChange={(e) => setCustomFieldsValues({ ...customFieldsValues, [field.id]: e.target.value })}
                      required={field.required}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    />
                  ) : field.type === 'DATE' ? (
                    <input
                      type="date"
                      value={customFieldsValues[field.id] || ''}
                      onChange={(e) => setCustomFieldsValues({ ...customFieldsValues, [field.id]: e.target.value })}
                      required={field.required}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    />
                  ) : (
                    <input
                      type={field.type === 'EMAIL' ? 'email' : field.type === 'PHONE' ? 'tel' : 'text'}
                      value={customFieldsValues[field.id] || ''}
                      onChange={(e) => setCustomFieldsValues({ ...customFieldsValues, [field.id]: e.target.value })}
                      required={field.required}
                      placeholder={`Digite ${field.name.toLowerCase()}`}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                backgroundColor: '#e5e7eb',
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
              type="submit"
              disabled={submitting}
              style={{
                padding: '10px 20px',
                backgroundColor: submitting ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              {submitting ? 'Criando...' : 'Criar Negócio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal removido - Agora usa página separada DealDetail

