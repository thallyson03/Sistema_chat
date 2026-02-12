import React, { useState, useEffect } from 'react';
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

export default function PipelineAutomationModal({ pipeline, onClose }: Props) {
  const [saving, setSaving] = useState(false);
  const [duplicateControlEnabled, setDuplicateControlEnabled] = useState(false);
  const [automationBlocks, setAutomationBlocks] = useState<AutomationBlock[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<AutomationBlock | null>(null);
  const [showBlockPalette, setShowBlockPalette] = useState(false);
  const [selectedStageForBlock, setSelectedStageForBlock] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setSaving(true);
      // TODO: Salvar automações no backend
      await new Promise(resolve => setTimeout(resolve, 500));
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
      config: {},
      position: { x: 100, y: 100 },
    };
    setAutomationBlocks([...automationBlocks, newBlock]);
    setSelectedBlock(newBlock);
    setShowBlockPalette(false);
    setSelectedStageForBlock(null);
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
                            onClick={() => setSelectedBlock(block)}
                            style={{
                              backgroundColor: selectedBlock?.id === block.id ? '#e0f2fe' : 'white',
                              border: `2px solid ${selectedBlock?.id === block.id ? '#0ea5e9' : '#e5e7eb'}`,
                              borderRadius: '6px',
                              padding: '12px',
                              marginBottom: '8px',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '16px' }}>
                                {block.type === 'change_stage' ? '✏️' : 
                                 block.type === 'send_email' ? '✉️' : 
                                 block.type === 'sales_bot' ? '🤖' :
                                 block.type === 'add_task' ? '➕' :
                                 block.type === 'create_lead' ? '💰' :
                                 block.type === 'change_user' ? '👥' : '⚙️'}
                              </span>
                              <span style={{ fontSize: '12px', fontWeight: '600', color: '#1f2937' }}>
                                {block.type === 'change_stage' ? 'Alterar etapa lead' : 
                                 block.type === 'send_email' ? 'Enviar email' : 
                                 block.type === 'sales_bot' ? 'Robô de vendas' :
                                 block.type === 'add_task' ? 'Adicionar tarefa' :
                                 block.type === 'create_lead' ? 'Criar lead' :
                                 block.type === 'change_user' ? 'Alterar usuário' : 'Automação'}
                              </span>
                            </div>
                            <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>
                              Quando movido para ou criado nesta etapa depois 1 minuto
                            </p>
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
    </div>
  );
}

