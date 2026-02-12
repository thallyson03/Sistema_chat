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
  const [showCreateDealModal, setShowCreateDealModal] = useState(false);
  const [showAutomationModal, setShowAutomationModal] = useState(false);
  const [draggedDeal, setDraggedDeal] = useState<{ dealId: string; stageId: string } | null>(null);

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

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        Carregando pipelines...
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>Pipelines</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          {selectedPipeline && (
            <>
              <button
                onClick={() => setShowAutomationModal(true)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                ⚡ AUTOMATIZE
              </button>
              <button
                onClick={() => setShowCreateDealModal(true)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                + Novo Negócio
              </button>
            </>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
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
            + Novo Pipeline
          </button>
        </div>
      </div>

      {/* Lista de Pipelines */}
      {pipelines.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {pipelines.map((pipeline) => (
            <button
              key={pipeline.id}
              onClick={() => handlePipelineSelect(pipeline)}
              style={{
                padding: '10px 16px',
                backgroundColor: selectedPipeline?.id === pipeline.id ? pipeline.color : '#f3f4f6',
                color: selectedPipeline?.id === pipeline.id ? 'white' : '#1f2937',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: selectedPipeline?.id === pipeline.id ? '600' : '400',
              }}
            >
              {pipeline.name} ({pipeline._count?.deals || 0})
            </button>
          ))}
        </div>
      )}

      {/* Visualização do Pipeline (Kanban) */}
      {selectedPipeline && (
        <div
          style={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'hidden',
            display: 'flex',
            gap: '16px',
            paddingBottom: '20px',
          }}
        >
          {selectedPipeline.stages
            .filter((stage) => stage.isActive)
            .sort((a, b) => a.order - b.order)
            .map((stage) => (
              <div
                key={stage.id}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(stage.id)}
                style={{
                  minWidth: '300px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: '100%',
                }}
              >
                {/* Header da Stage */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    paddingBottom: '12px',
                    borderBottom: '2px solid',
                    borderColor: stage.color,
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1f2937',
                      }}
                    >
                      {stage.name}
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                      {stage.deals?.length || 0} negócios • {stage.probability}% probabilidade
                    </p>
                  </div>
                </div>

                {/* Lista de Deals */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {stage.deals && stage.deals.length > 0 ? (
                    stage.deals.map((deal) => (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={() => handleDragStart(deal.id, stage.id)}
                        onClick={() => navigate(`/pipelines/deals/${deal.id}`)}
                        style={{
                          backgroundColor: 'white',
                          borderRadius: '8px',
                          padding: '12px',
                          cursor: 'pointer',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          transition: 'all 0.2s',
                          border: '1px solid #e5e7eb',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <div style={{ marginBottom: '8px' }}>
                          <h4
                            style={{
                              margin: 0,
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#1f2937',
                            }}
                          >
                            {deal.name}
                          </h4>
                          {deal.customFields && Object.keys(deal.customFields).length > 0 && (
                            <div style={{ marginTop: '4px', fontSize: '11px', color: '#6b7280' }}>
                              {Object.entries(deal.customFields).slice(0, 2).map(([key, value]) => (
                                <div key={key}>
                                  <strong>{key}:</strong> {String(value)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span
                            style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#10b981',
                            }}
                          >
                            {formatCurrency(Number(deal.value || 0), deal.currency)}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: '#e5e7eb',
                              color: '#6b7280',
                            }}
                          >
                            {deal.probability}%
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#6b7280' }}>
                          <span>{deal.contact.name}</span>
                          {deal.assignedTo && (
                            <span style={{ fontSize: '11px' }}>👤 {deal.assignedTo.name}</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        padding: '40px 20px',
                        textAlign: 'center',
                        color: '#9ca3af',
                        fontSize: '14px',
                      }}
                    >
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

