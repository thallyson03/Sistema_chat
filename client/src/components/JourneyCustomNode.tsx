import React from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

interface CustomNodeProps {
  data: {
    label: string;
    type: 'TRIGGER' | 'ACTION' | 'CONDITION' | 'CONTROL';
    config?: any;
  };
  id: string;
}

export function JourneyCustomNode({ data, id }: CustomNodeProps) {
  const { label, type, config = {} } = data;
  const { deleteElements } = useReactFlow();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Tem certeza que deseja excluir o bloco "${label}"?`)) {
      deleteElements({ nodes: [{ id }] });
    }
  };

  // Verificar se o nó está configurado
  const isConfigured = () => {
    if (type === 'ACTION' && config.actionType === 'send_message') {
      return !!(config.message && config.channelId);
    }
    if (type === 'TRIGGER') {
      return !!config.triggerType;
    }
    if (type === 'CONDITION') {
      return !!(config.conditionType && config.operator);
    }
    if (type === 'CONTROL') {
      return !!(config.controlType && (config.delayValue || config.splitPercent));
    }
    return true;
  };

  const configured = isConfigured();

  const getNodeColor = () => {
    if (!configured) return { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' };
    
    switch (type) {
      case 'TRIGGER':
        return { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' };
      case 'ACTION':
        return { bg: '#dcfce7', border: '#10b981', text: '#166534' };
      case 'CONDITION':
        return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' };
      case 'CONTROL':
        return { bg: '#e9d5ff', border: '#8b5cf6', text: '#6b21a8' };
      default:
        return { bg: '#f3f4f6', border: '#6b7280', text: '#374151' };
    }
  };

  const colors = getNodeColor();

  return (
    <div
      style={{
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '12px 16px',
        minWidth: '180px',
        boxShadow: configured ? '0 4px 6px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
        position: 'relative',
      }}
    >
      {/* Handle de entrada (apenas se não for TRIGGER) */}
      {type !== 'TRIGGER' && (
        <Handle
          type="target"
          position={Position.Top}
          style={{
            background: colors.border,
            width: '12px',
            height: '12px',
            border: '2px solid white',
          }}
        />
      )}

      {/* Botão de deletar */}
      <button
        onClick={handleDelete}
        style={{
          position: 'absolute',
          top: '6px',
          right: '6px',
          background: '#ef4444',
          border: 'none',
          borderRadius: '50%',
          width: '20px',
          height: '20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          color: 'white',
          fontWeight: 'bold',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          transition: 'all 0.2s',
          zIndex: 10,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#dc2626';
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#ef4444';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="Excluir bloco"
      >
        ×
      </button>

      {/* Indicador de status */}
      <div style={{ position: 'absolute', top: '8px', right: '32px' }}>
        {configured ? (
          <span style={{ fontSize: '12px' }}>✓</span>
        ) : (
          <span style={{ fontSize: '12px', color: '#ef4444' }}>⚠️</span>
        )}
      </div>

      {/* Tipo do nó */}
      <div
        style={{
          fontSize: '10px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          color: colors.text,
          marginBottom: '4px',
          opacity: 0.8,
        }}
      >
        {type === 'TRIGGER' ? '🎯 Trigger' :
         type === 'ACTION' ? '⚡ Ação' :
         type === 'CONDITION' ? '❓ Condição' : '🎛️ Controle'}
      </div>

      {/* Label */}
      <div
        style={{
          fontSize: '13px',
          fontWeight: '600',
          color: colors.text,
          marginBottom: '4px',
        }}
      >
        {label}
      </div>

      {/* Informações adicionais */}
      {type === 'ACTION' && config.actionType === 'send_message' && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: colors.text, opacity: 0.7 }}>
          {config.message ? (
            <div style={{ 
              padding: '6px', 
              backgroundColor: 'rgba(255,255,255,0.5)', 
              borderRadius: '4px',
              maxHeight: '40px',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              💬 {config.message.substring(0, 30)}{config.message.length > 30 ? '...' : ''}
            </div>
          ) : (
            <div style={{ color: '#ef4444', fontWeight: '500' }}>
              ⚠️ Mensagem não configurada
            </div>
          )}
        </div>
      )}

      {/* Handle de saída */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: colors.border,
          width: '12px',
          height: '12px',
          border: '2px solid white',
        }}
      />
    </div>
  );
}

